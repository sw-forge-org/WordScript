//! The live RemoteDesktop portal session, and the one thread that owns it.
//!
//! WHY A THREAD AND NOT A FUNCTION. A portal session belongs to the D-Bus
//! connection that created it. The previous plumbing spoke D-Bus by spawning
//! `busctl`, which gave every call its own connection: `CreateSession`
//! succeeded, the process exited, the portal destroyed the session, and there
//! was nothing left to send a key event to. `Start` could not even be awaited
//! across invocations, because its result arrives as a signal on the same
//! connection. So the connection has to outlive the call, which means it has to
//! live somewhere -- here, on one thread, for as long as the app runs.
//!
//! WHY THE PASTE PATH NEVER PROMPTS. The compositor's "Control input devices"
//! dialog is raised by `Start`, and the owner's standing objection is to being
//! asked repeatedly (`wtype`/`ydotool` were rejected on exactly that ground,
//! and an early WordScript is remembered for asking every single time). So
//! `Start` has exactly two callers here, and neither of them is a dictation:
//!
//!   * [`request_grant`] -- the Settings action, pressed deliberately, allowed
//!     to raise the dialog and to wait minutes for a human.
//!   * [`restore_grant_in_background`] -- app start, and only when a restore
//!     token from an earlier grant is on disk and no refusal is remembered.
//!
//! [`paste_ctrl_v`] sends four `NotifyKeyboardKeysym` calls on an already
//! started session and nothing else. If there is no session it fails, and the
//! run falls back to the clipboard with a reason. A dialog can therefore not
//! appear mid-dictation by construction, rather than by convention.
//!
//! WHAT THIS BUYS THAT XTEST CANNOT. `notify_keyboard_keysym` is a D-Bus method
//! call with a reply. XTEST through `xdotool` is a request into the X server
//! that exits 0 whether or not any client was listening -- the gap this whole
//! track exists for. A portal paste that returns `Ok` was accepted by the
//! compositor that owns the focused window.
//!
//! See ADR 0228 (the driver and its sequencing) and ADR 0234 (the grant flow,
//! and why an unnameable compositor no longer closes this path).

use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use super::portal::{
    detect_compositor, detect_portal_capabilities, load_portal_grant_record,
    store_portal_grant_record, PortalError, PortalGrantRecord,
};
use super::runtime_log;
use super::sessions::now_ms;

/// A paste is four D-Bus round trips on a warm connection; the observed cost of
/// one is well under a millisecond. This bound exists so a stalled portal
/// backend cannot hold the insert path open -- past it the run falls back to
/// the clipboard, which is a worse delivery but a finished one.
const PASTE_TIMEOUT_MS: u64 = 1_500;
/// Status and the background restore are asked for by screens and by startup;
/// neither may block on a portal that is not answering.
const STATUS_TIMEOUT_MS: u64 = 750;
const RESTORE_TIMEOUT_MS: u64 = 15_000;
/// The interactive grant waits for a person to read a dialog and decide. Two
/// minutes is the point past which the dialog is assumed gone rather than
/// pending.
const GRANT_TIMEOUT_MS: u64 = 120_000;

/// X11 keysyms. `NotifyKeyboardKeysym` takes a keysym rather than a keycode
/// precisely so the caller does not have to know the active keymap: the portal
/// backend resolves it. `XK_Control_L` and `XK_v` are stable numbers from
/// `keysymdef.h` and are not going to move.
const KEYSYM_CONTROL_L: i32 = 0xffe3;
const KEYSYM_V: i32 = 0x0076;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortalGrantPhase {
    /// No RemoteDesktop portal on this platform or compositor. Nothing to ask
    /// for, and the Settings action does not render.
    Unsupported,
    /// The portal is there and nobody has been asked yet.
    NotGranted,
    /// A session is live and can inject right now.
    Granted,
    /// Somebody said no. WordScript does not ask again on its own; the Settings
    /// action asks once more when it is pressed (ADR 0228, answer 2).
    Refused,
    /// A grant exists on disk but restoring it failed. Distinct from `Refused`:
    /// nobody declined anything, something broke.
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct PortalGrantStatus {
    pub phase: PortalGrantPhase,
    /// Whether a paste could be delivered through the portal at this instant.
    pub session_active: bool,
    /// Whether the Settings action has anything to do.
    pub can_request: bool,
    pub compositor: String,
    pub detail: String,
    pub refused_at_ms: Option<u64>,
}

impl PortalGrantStatus {
    fn unsupported(detail: &str) -> Self {
        Self {
            phase: PortalGrantPhase::Unsupported,
            session_active: false,
            can_request: false,
            compositor: detect_compositor().label().to_string(),
            detail: detail.to_string(),
            refused_at_ms: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Public entry points. Everything below the line is one thread's private
// business; these four functions are all the runtime and the UI ever call.
// ---------------------------------------------------------------------------

/// What the Delivery screen draws and what the chain asks before choosing a
/// driver. Never blocks longer than [`STATUS_TIMEOUT_MS`].
pub fn grant_status() -> PortalGrantStatus {
    match ask(Command::Status, STATUS_TIMEOUT_MS) {
        Some(Reply::Status(status)) => status,
        _ => status_without_the_thread(),
    }
}

/// What can still be said when the session thread does not answer in time.
///
/// THE THREAD BEING BUSY IS NORMAL, AND MUST NOT READ AS "NO PORTAL HERE". It
/// serves one command at a time, and one of those commands waits up to
/// [`GRANT_TIMEOUT_MS`] for a person to read the compositor's dialog. Every
/// status read taken during that wait times out. The first version of this
/// answered them with `Unsupported`, which `portal_grant_for_status()` maps to
/// `None`, which removes the whole "Insert on Wayland" card -- so pressing
/// "Grant access" and then letting the screen refresh took the grant button off
/// the screen for as long as the dialog it opened was up. The same happened for
/// the first 15 seconds after app start, while the background restore held the
/// thread.
///
/// So the fallback reports what is knowable without the thread: whether this
/// desktop has a portal at all, and what the last run wrote to disk. It never
/// claims a live session, because that is the one fact only the thread holds.
fn status_without_the_thread() -> PortalGrantStatus {
    fallback_status(
        portal_is_possible(),
        &load_portal_grant_record(),
        detect_compositor().label(),
    )
}

/// The fallback itself, with the two facts it depends on passed in so it can be
/// asserted about without a desktop session.
fn fallback_status(possible: bool, record: &PortalGrantRecord, compositor: &str) -> PortalGrantStatus {
    if !possible {
        return PortalGrantStatus {
            phase: PortalGrantPhase::Unsupported,
            session_active: false,
            can_request: false,
            compositor: compositor.to_string(),
            detail:
                "This desktop has no RemoteDesktop portal, so insert at cursor stays on the clipboard."
                    .to_string(),
            refused_at_ms: None,
        };
    }
    let (phase, detail) = if record.refused_at_ms.is_some() {
        (PortalGrantPhase::Refused, PortalError::Refused.label())
    } else {
        (
            PortalGrantPhase::NotGranted,
            "The permission is being worked on right now. This is what is stored on disk until \
             that finishes."
                .to_string(),
        )
    };
    PortalGrantStatus {
        phase,
        session_active: false,
        // Never `false` on a machine that has a portal: this is the state a
        // person is most likely looking at the screen in, because they just
        // pressed the button that produced it.
        can_request: true,
        compositor: compositor.to_string(),
        detail,
        refused_at_ms: record.refused_at_ms,
    }
}

/// Whether a portal paste can be attempted right now. Cheap enough for the
/// insert path, which asks once per run before it picks a driver.
///
/// Deliberately NOT `grant_status().session_active`: a timeout here is a
/// dictation waiting, and the honest answer is "no session", which needs no
/// disk read and no capability probe to say.
pub fn session_is_live() -> bool {
    matches!(
        ask(Command::Status, STATUS_TIMEOUT_MS),
        Some(Reply::Status(status)) if status.session_active
    )
}

/// Restores a grant from an earlier run, if there is one to restore.
///
/// Called once at app start, off the main thread. This is where the restore
/// happens rather than in the insert path, so that the one call which can in
/// principle raise a dialog is never inside a dictation.
///
/// THE CAPABILITY GATE IS INSIDE THE THREAD, NOT IN FRONT OF IT. Its only
/// caller is Tauri's `setup`, which runs on the main thread before the window
/// exists, and `portal_is_possible()` spawns three processes to answer:
/// `xdg-desktop-portal --version`, two `busctl get-property` calls, and --
/// through `detect_compositor()` on its first call -- `plasmashell --version`.
/// Measured on the reporting machine 2026-08-18: 98-175 ms for plasmashell
/// alone, 16-27 ms for the rest, so ~120-215 ms of subprocess spawning stood
/// between app start and the first frame, to decide something no dictation was
/// waiting for.
pub fn restore_grant_in_background() {
    std::thread::spawn(|| {
        if !portal_is_possible() {
            // Said out loud, because the version of this that returned in
            // silence is why nobody noticed the portal path was closed:
            // `ensure_portal_session` bailed on an unsupported compositor
            // without a word, and 6539 log lines carried no portal line at all.
            // A path that is not taken says so.
            runtime_log::record(
                "[WordScript] Portal grant not restored: no RemoteDesktop portal on this desktop"
                    .to_string(),
            );
            return;
        }
        let started_at = Instant::now();
        let status = match ask(Command::Restore, RESTORE_TIMEOUT_MS) {
            Some(Reply::Status(status)) => status,
            _ => return,
        };
        runtime_log::record(format!(
            "[WordScript] Portal grant restore phase={:?} session_active={} elapsed_ms={} detail={}",
            status.phase,
            status.session_active,
            started_at.elapsed().as_millis(),
            status.detail,
        ));
    });
}

/// The Settings action. May raise the compositor's permission dialog and may
/// wait minutes for an answer, which is why it has exactly one caller and that
/// caller is a button.
pub fn request_grant() -> PortalGrantStatus {
    if !portal_is_possible() {
        return PortalGrantStatus::unsupported(
            "This desktop has no RemoteDesktop portal, so there is no permission to grant.",
        );
    }
    let started_at = Instant::now();
    let status = match ask(Command::Grant, GRANT_TIMEOUT_MS) {
        Some(Reply::Status(status)) => status,
        _ => PortalGrantStatus::unsupported(
            "The permission request did not come back. Nothing was changed.",
        ),
    };
    runtime_log::record(format!(
        "[WordScript] Portal grant requested phase={:?} session_active={} elapsed_ms={} detail={}",
        status.phase,
        status.session_active,
        started_at.elapsed().as_millis(),
        status.detail,
    ));
    status
}

/// Sends Ctrl+V through the live session. The whole driver.
pub fn paste_ctrl_v() -> Result<(), PortalError> {
    match ask(Command::Paste, PASTE_TIMEOUT_MS) {
        Some(Reply::Paste(result)) => result,
        _ => Err(PortalError::PasteFailed(format!(
            "the portal session did not answer within {PASTE_TIMEOUT_MS}ms"
        ))),
    }
}

/// Whether asking is worth anything on this machine at all.
///
/// ASKED ONCE PER RUN, BECAUSE IT IS NOT CHEAP. `detect_portal_capabilities()`
/// spawns `busctl get-property` twice and `plasmashell --version` once. This
/// gate sits in the driver-chain description, which a settings poll re-reads
/// several times a minute, and it used to pay all three spawns each time. None
/// of the three answers can change without the desktop session being replaced,
/// which takes the app with it.
pub fn portal_is_possible() -> bool {
    static POSSIBLE: OnceLock<bool> = OnceLock::new();
    *POSSIBLE.get_or_init(|| {
        if !cfg!(target_os = "linux") {
            return false;
        }
        let capabilities = detect_portal_capabilities();
        let possible = capabilities.compositor.supports_remote_desktop_portal()
            && capabilities.has_remote_desktop_portal;
        runtime_log::record(format!(
            "[WordScript] Portal capability probed compositor={} interface_present={} possible={}",
            capabilities.compositor.label(),
            capabilities.has_remote_desktop_portal,
            possible,
        ));
        possible
    })
}

// ---------------------------------------------------------------------------
// The channel to the session thread.
// ---------------------------------------------------------------------------

enum Command {
    Status,
    Restore,
    Grant,
    Paste,
}

enum Reply {
    Status(PortalGrantStatus),
    Paste(Result<(), PortalError>),
}

struct Envelope {
    command: Command,
    reply: Sender<Reply>,
}

fn service_sender() -> Option<&'static Mutex<Sender<Envelope>>> {
    static SERVICE: OnceLock<Option<Mutex<Sender<Envelope>>>> = OnceLock::new();
    SERVICE.get_or_init(spawn_service).as_ref()
}

/// Sends one command and waits for its answer, bounded.
///
/// A timeout leaves the request in flight on the session thread rather than
/// cancelling it -- the reply is dropped when its `Sender` closes. That is the
/// right shape for a paste: a late portal answer must not be applied to a run
/// that already fell back to the clipboard.
fn ask(command: Command, timeout_ms: u64) -> Option<Reply> {
    let sender = service_sender()?;
    let (reply_tx, reply_rx): (Sender<Reply>, Receiver<Reply>) = std::sync::mpsc::channel();
    {
        let sender = sender.lock().ok()?;
        sender
            .send(Envelope {
                command,
                reply: reply_tx,
            })
            .ok()?;
    }
    match reply_rx.recv_timeout(Duration::from_millis(timeout_ms)) {
        Ok(reply) => Some(reply),
        Err(RecvTimeoutError::Timeout) => {
            runtime_log::record(format!(
                "[WordScript] Portal session request timed out after {timeout_ms}ms"
            ));
            None
        }
        Err(RecvTimeoutError::Disconnected) => None,
    }
}

// ---------------------------------------------------------------------------
// Linux: the session thread itself.
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn spawn_service() -> Option<Mutex<Sender<Envelope>>> {
    let (tx, rx) = std::sync::mpsc::channel::<Envelope>();
    let spawned = std::thread::Builder::new()
        .name("wordscript-portal".to_string())
        .spawn(move || linux::run(rx));
    match spawned {
        Ok(_) => Some(Mutex::new(tx)),
        Err(error) => {
            runtime_log::record(format!(
                "[WordScript] Portal session thread could not start: {error}"
            ));
            None
        }
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::*;
    use ashpd::desktop::remote_desktop::{
        DeviceType, KeyState, RemoteDesktop, SelectDevicesOptions,
    };
    use ashpd::desktop::{PersistMode, Session};
    use ashpd::enumflags2::BitFlags;

    pub(super) fn run(rx: Receiver<Envelope>) {
        // A multi-threaded runtime with one worker rather than a current-thread
        // one: zbus dispatches incoming signals on a spawned task, and `Start`
        // is answered BY a signal. On a current-thread runtime that task only
        // advances while something is being awaited on this thread, which is a
        // deadlock waiting for the one call that matters most.
        let runtime = match tokio::runtime::Builder::new_multi_thread()
            .worker_threads(1)
            .enable_all()
            .build()
        {
            Ok(runtime) => runtime,
            Err(error) => {
                runtime_log::record(format!(
                    "[WordScript] Portal session runtime could not start: {error}"
                ));
                return;
            }
        };

        let mut state = ServiceState::default();
        runtime.block_on(async move {
            while let Ok(envelope) = rx.recv() {
                let reply = match envelope.command {
                    Command::Status => Reply::Status(state.status()),
                    Command::Restore => Reply::Status(state.restore().await),
                    Command::Grant => Reply::Status(state.grant().await),
                    Command::Paste => Reply::Paste(state.paste().await),
                };
                // The receiver is gone when the caller timed out. Dropping the
                // reply is the intended outcome, not an error.
                let _ = envelope.reply.send(reply);
            }
        });
    }

    #[derive(Default)]
    struct ServiceState {
        proxy: Option<RemoteDesktop>,
        session: Option<Session<RemoteDesktop>>,
        last_error: Option<String>,
    }

    impl ServiceState {
        fn status(&self) -> PortalGrantStatus {
            let compositor = detect_compositor();
            // THE SAME GATE `request_grant()` USES, AND FOR THE SAME REASON.
            // These two used to disagree: this one asked only whether the
            // compositor has a persistent grant, while the action also required
            // the interface to be reachable. On a KDE box with no
            // xdg-desktop-portal installed, the row therefore drew "Not granted"
            // with a working-looking button, and pressing it made the whole
            // section disappear instead of doing anything. A control that is
            // offered has to be a control that acts.
            if !compositor.supports_remote_desktop_portal() {
                return PortalGrantStatus::unsupported(&format!(
                    "{} has no persistent RemoteDesktop grant, so insert at cursor stays on the clipboard.",
                    compositor.label()
                ));
            }
            if !portal_is_possible() {
                return PortalGrantStatus::unsupported(
                    &PortalError::NoPortalInterface.label(),
                );
            }

            let record = load_portal_grant_record();
            let (phase, detail) = if self.session.is_some() {
                (
                    PortalGrantPhase::Granted,
                    "Insert at cursor can reach native Wayland windows on this desktop."
                        .to_string(),
                )
            } else if record.refused_at_ms.is_some() {
                (PortalGrantPhase::Refused, PortalError::Refused.label())
            } else if let Some(error) = self.last_error.clone() {
                (PortalGrantPhase::Failed, error)
            } else if record.has_token() {
                (
                    PortalGrantPhase::NotGranted,
                    "A permission from an earlier run is stored but not restored yet.".to_string(),
                )
            } else {
                (PortalGrantPhase::NotGranted, PortalError::NoGrant.label())
            };

            PortalGrantStatus {
                phase,
                session_active: self.session.is_some(),
                can_request: self.session.is_none(),
                compositor: compositor.label().to_string(),
                detail,
                refused_at_ms: record.refused_at_ms,
            }
        }

        /// Silent path: restores only what is already granted.
        ///
        /// Returns without touching the portal when there is no token or when a
        /// refusal is remembered, so app start cannot become a dialog.
        async fn restore(&mut self) -> PortalGrantStatus {
            if self.session.is_some() {
                return self.status();
            }
            let record = load_portal_grant_record();
            if record.refused_at_ms.is_some() || !record.has_token() {
                return self.status();
            }
            self.open_session(record).await;
            self.status()
        }

        /// Interactive path: the Settings action.
        ///
        /// Clears a remembered refusal first -- pressing the button IS the user
        /// coming back to say they changed their mind, which is the only event
        /// that makes WordScript ask again.
        async fn grant(&mut self) -> PortalGrantStatus {
            if self.session.is_some() {
                return self.status();
            }
            let mut record = load_portal_grant_record();
            record.refused_at_ms = None;
            let _ = store_portal_grant_record(&record);
            self.open_session(record).await;
            self.status()
        }

        async fn open_session(&mut self, record: PortalGrantRecord) {
            self.last_error = None;
            let proxy = match RemoteDesktop::new().await {
                Ok(proxy) => proxy,
                Err(error) => {
                    self.fail(PortalError::NoPortalInterface.label(), error);
                    return;
                }
            };

            let session = match proxy.create_session(Default::default()).await {
                Ok(session) => session,
                Err(error) => {
                    self.fail(
                        PortalError::CreateSessionFailed(error.to_string()).label(),
                        error,
                    );
                    return;
                }
            };

            // `ExplicitlyRevoked` is the whole point of choosing this driver
            // over `wtype`/`ydotool`: it asks the compositor to remember the
            // grant until the user takes it back, and to hand back a token that
            // restores it without asking again. `Application` would only last
            // while the process lives, which is the per-run prompt in slower
            // clothing.
            let mut options = SelectDevicesOptions::default()
                .set_devices(BitFlags::from(DeviceType::Keyboard))
                .set_persist_mode(PersistMode::ExplicitlyRevoked);
            if let Some(token) = record.restore_token.as_deref() {
                options = options.set_restore_token(token);
            }

            if let Err(error) = proxy.select_devices(&session, options).await {
                self.fail(
                    PortalError::SelectDevicesFailed(error.to_string()).label(),
                    error,
                );
                let _ = session.close().await;
                return;
            }

            // The one call that can raise the dialog, and the one measurement
            // this driver still rests on (ADR 0234, "what is still
            // unverified"). Two numbers decide it, and both are logged here
            // rather than inferred from the enclosing call: whether a stored
            // token was sent at all, and how long `Start` took. A restore that
            // KWin honours returns in milliseconds; one it re-confirms cannot
            // return until a human has read a dialog, so it returns in seconds.
            // The distinction matters because "it prompted" means nothing
            // without "and it had a token to avoid prompting with".
            let token_sent = record.restore_token.is_some();
            let start_at = Instant::now();
            let response = match proxy.start(&session, None, Default::default()).await {
                Ok(request) => request.response(),
                Err(error) => {
                    self.fail(PortalError::StartFailed(error.to_string()).label(), error);
                    let _ = session.close().await;
                    return;
                }
            };
            let start_elapsed_ms = start_at.elapsed().as_millis();
            runtime_log::record(format!(
                "[WordScript] Portal Start returned restore_token_sent={token_sent} elapsed_ms={start_elapsed_ms}"
            ));

            let devices = match response {
                Ok(devices) => devices,
                Err(error) => {
                    let _ = session.close().await;
                    if is_cancelled(&error) {
                        self.remember_refusal();
                    } else {
                        self.fail(PortalError::StartFailed(error.to_string()).label(), error);
                    }
                    return;
                }
            };

            if !devices.devices().contains(DeviceType::Keyboard) {
                let _ = session.close().await;
                self.last_error = Some(
                    "The desktop granted a remote-desktop session without keyboard access, so it cannot type."
                        .to_string(),
                );
                runtime_log::record(format!(
                    "[WordScript] Portal grant returned no keyboard device devices={:?}",
                    devices.devices()
                ));
                return;
            }

            // Whatever token comes back replaces the one we sent: a compositor
            // is free to rotate it, and writing back the token we already had
            // (which the previous busctl path did) stores nothing new while
            // looking like it did.
            let mut next = PortalGrantRecord {
                restore_token: record.restore_token.clone(),
                refused_at_ms: None,
            };
            if let Some(token) = devices.restore_token() {
                next.restore_token = Some(token.to_string());
            }
            if let Err(error) = store_portal_grant_record(&next) {
                // The session is live either way; only its survival past this
                // app run is lost, and saying so is better than pretending.
                runtime_log::record(format!(
                    "[WordScript] Portal grant could not be persisted: {}",
                    error.label()
                ));
            }

            runtime_log::record(format!(
                "[WordScript] Portal session started devices={:?} restore_token_sent={} restore_token_stored={} restore_token_rotated={} start_elapsed_ms={}",
                devices.devices(),
                token_sent,
                next.restore_token.is_some(),
                next.restore_token != record.restore_token,
                start_elapsed_ms,
            ));
            self.proxy = Some(proxy);
            self.session = Some(session);
        }

        async fn paste(&mut self) -> Result<(), PortalError> {
            let (Some(proxy), Some(session)) = (self.proxy.as_ref(), self.session.as_ref()) else {
                let record = load_portal_grant_record();
                return Err(if record.refused_at_ms.is_some() {
                    PortalError::Refused
                } else {
                    PortalError::NoGrant
                });
            };

            let started_at = Instant::now();
            // Press control, press v, release v, release control. Any failure
            // mid-sequence still releases what was pressed: a modifier left
            // down by an aborted paste would land on the user's next keystroke.
            let mut outcome = notify(proxy, session, KEYSYM_CONTROL_L, KeyState::Pressed).await;
            if outcome.is_ok() {
                outcome = notify(proxy, session, KEYSYM_V, KeyState::Pressed).await;
                let released = notify(proxy, session, KEYSYM_V, KeyState::Released).await;
                outcome = outcome.and(released);
            }
            let control_up = notify(proxy, session, KEYSYM_CONTROL_L, KeyState::Released).await;
            let outcome = outcome.and(control_up);

            match &outcome {
                Ok(()) => runtime_log::record(format!(
                    "[WordScript] Portal paste delivered elapsed_ms={}",
                    started_at.elapsed().as_millis(),
                )),
                Err(error) => {
                    // A session the compositor has revoked answers every call
                    // with an error. Drop it so the next status read says
                    // "not granted" instead of offering a driver that is gone.
                    self.session = None;
                    self.proxy = None;
                    self.last_error = Some(error.label());
                    runtime_log::record(format!(
                        "[WordScript] Portal paste failed, session dropped: {}",
                        error.label()
                    ));
                }
            }
            outcome
        }

        fn remember_refusal(&mut self) {
            let mut record = load_portal_grant_record();
            record.refused_at_ms = Some(now_ms());
            let _ = store_portal_grant_record(&record);
            self.last_error = None;
            runtime_log::record(
                "[WordScript] Portal grant refused; WordScript will not ask again until the Delivery action is pressed"
                    .to_string(),
            );
        }

        fn fail(&mut self, detail: String, error: ashpd::Error) {
            runtime_log::record(format!("[WordScript] Portal session failed: {detail} ({error})"));
            self.last_error = Some(detail);
        }
    }

    async fn notify(
        proxy: &RemoteDesktop,
        session: &Session<RemoteDesktop>,
        keysym: i32,
        state: KeyState,
    ) -> Result<(), PortalError> {
        proxy
            .notify_keyboard_keysym(session, keysym, state, Default::default())
            .await
            .map_err(|error| PortalError::PasteFailed(error.to_string()))
    }

    fn is_cancelled(error: &ashpd::Error) -> bool {
        matches!(
            error,
            ashpd::Error::Response(ashpd::desktop::ResponseError::Cancelled)
        )
    }
}

// ---------------------------------------------------------------------------
// Everywhere else: there is no portal, and the API says so rather than being
// absent, so the callers stay one code path.
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "linux"))]
fn spawn_service() -> Option<Mutex<Sender<Envelope>>> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The two calls that can raise a dialog are named here, so that a future
    /// change which moves `Start` into the paste path has to change this test
    /// and say why. Everything the insert path touches is `Command::Paste`,
    /// and `Command::Paste` never starts a session.
    #[test]
    fn the_paste_path_has_no_route_to_a_permission_dialog() {
        let source = include_str!("portal_session.rs");
        let paste_body = source
            .split("async fn paste(&mut self)")
            .nth(1)
            .expect("paste() is defined in this file");
        let paste_body = paste_body
            .split("fn remember_refusal")
            .next()
            .expect("paste() ends before remember_refusal");
        assert!(
            !paste_body.contains("open_session"),
            "the paste path must never open a session: that is the call that prompts"
        );
        assert!(
            !paste_body.contains(".start("),
            "the paste path must never call Start: that is the call that prompts"
        );
        // `open_session` is not the only way to reach `Start`. Both callers of
        // it are named here so that routing the paste through either of them --
        // "just restore first if the session is gone" is the tempting one --
        // has to change this test.
        for indirect in ["self.grant(", "self.restore(", "request_grant", "open_session"] {
            assert!(
                !paste_body.contains(indirect),
                "the paste path must not reach a session start through {indirect}"
            );
        }
    }

    /// THE BUSY THREAD, WHICH IS THE STATE THE SCREEN IS MOST LIKELY READ IN.
    ///
    /// One command is served at a time and the grant command waits minutes for
    /// a human, so status reads taken while the dialog is up time out. Answering
    /// them with `Unsupported` removed the section the button lives in for
    /// exactly as long as the dialog it opened was on screen.
    #[test]
    fn a_busy_session_thread_does_not_read_as_a_desktop_without_a_portal() {
        let status = fallback_status(true, &PortalGrantRecord::default(), "KDE Plasma 6");
        assert_eq!(status.phase, PortalGrantPhase::NotGranted);
        assert!(status.can_request, "the button must survive its own dialog");
        assert!(!status.session_active, "only the thread knows that, and it did not answer");
    }

    /// A refusal is on disk, so the fallback can still say so -- and must, or a
    /// timed-out read would offer "Grant access" to somebody who already
    /// declined and would be shown "Ask again" a second later.
    #[test]
    fn the_fallback_still_knows_about_a_refusal_because_it_is_on_disk() {
        let record = PortalGrantRecord {
            restore_token: None,
            refused_at_ms: Some(1_787_000_000_000),
        };
        let status = fallback_status(true, &record, "KDE Plasma 6");
        assert_eq!(status.phase, PortalGrantPhase::Refused);
        assert_eq!(status.refused_at_ms, Some(1_787_000_000_000));
        assert!(status.can_request, "pressing the button is how a refusal is taken back");
    }

    /// And where there is genuinely no portal, `Unsupported` is still the
    /// answer: no phase, no button, no section.
    #[test]
    fn a_desktop_with_no_portal_still_gets_no_action() {
        let status = fallback_status(false, &PortalGrantRecord::default(), "Hyprland");
        assert_eq!(status.phase, PortalGrantPhase::Unsupported);
        assert!(!status.can_request);
    }

    #[test]
    fn an_unsupported_desktop_offers_no_action() {
        let status = PortalGrantStatus::unsupported("no portal here");
        assert_eq!(status.phase, PortalGrantPhase::Unsupported);
        assert!(!status.can_request, "there is nothing to press");
        assert!(!status.session_active);
    }

    /// Ctrl+V and not something else. A wrong keysym here is invisible in every
    /// test that mocks the portal away, and lands as "the paste did nothing".
    #[test]
    fn the_injected_chord_is_control_v() {
        assert_eq!(KEYSYM_CONTROL_L, 0xffe3, "XK_Control_L");
        assert_eq!(KEYSYM_V, 0x0076, "XK_v");
    }

    /// The insert path waits on this. A bound long enough to outlast a
    /// dictation would hand the user a frozen app instead of a clipboard.
    #[test]
    fn the_paste_bound_is_short_enough_to_fall_back_from() {
        assert!(PASTE_TIMEOUT_MS <= 2_000, "{PASTE_TIMEOUT_MS}ms");
        assert!(
            GRANT_TIMEOUT_MS > PASTE_TIMEOUT_MS * 10,
            "a human reading a dialog needs far longer than a paste"
        );
    }
}
