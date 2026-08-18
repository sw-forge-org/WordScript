// Copyright 2022-2022 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::collections::BTreeMap;
use std::time::{Duration, Instant};

use crossbeam_channel::{unbounded, Receiver, Sender};
use keyboard_types::{Code, Modifiers};
use x11rb::connection::Connection;
use x11rb::errors::ReplyError;
use x11rb::protocol::xinput;
use x11rb::protocol::xproto::{
    ConnectionExt, GrabMode, KeyButMask, Keycode, ModMask, Window,
};
use x11rb::protocol::{xkb, ErrorKind, Event};
use x11rb::rust_connection::RustConnection;
use xkeysym::RawKeysym;

use crate::{hotkey::HotKey, Error, GlobalHotKeyEvent, HotKeyEventOrigin};

// WordScript patch: modifier-only shortcuts are *observed*, not grabbed.
//
// A passive `grab_key` delivers the key to the grab owner instead of the focused
// window. For `Ctrl+F9` that is exactly right. For a shortcut whose main key is
// a modifier it is not: a grab on a bare `Shift` stops Shift from typing
// capitals anywhere on the desktop, and no activation mode can change that,
// because the activation mode decides when the consumer acts and not whether the
// key still reaches anyone else.
//
// So a hotkey whose main key is a modifier is routed to XInput2 raw key events
// instead. Raw events are delivered without consuming the keystroke and without
// regard to focus, which is what the double-tap-a-modifier idiom needs.
//
// Two properties of this path that matter and are easy to lose:
//
// - **Raw events carry no modifier state.** The state has to be tracked from the
//   raw stream itself, the way the Windows low-level hook does. Only the eight
//   modifier keycodes are tracked; every other keycode is discarded on arrival
//   without being recorded, forwarded or logged.
// - **On XWayland it is still an X11 mechanism.** Raw events cover what the X
//   server sees, so a keystroke delivered to a native Wayland client is invisible
//   here — the same focus limitation grabs have. Observation removes the key
//   theft, not the Wayland gap.

enum ThreadMessage {
    RegisterHotKey(HotKey, Sender<crate::Result<()>>),
    RegisterHotKeys(Vec<HotKey>, Sender<crate::Result<()>>),
    UnRegisterHotKey(HotKey, Sender<crate::Result<()>>),
    UnRegisterHotKeys(Vec<HotKey>, Sender<crate::Result<()>>),
    DropThread,
}

pub struct GlobalHotKeyManager {
    thread_tx: Sender<ThreadMessage>,
}

impl GlobalHotKeyManager {
    pub fn new() -> crate::Result<Self> {
        let (thread_tx, thread_rx) = unbounded();
        std::thread::spawn(|| {
            if let Err(err) = events_processor(thread_rx) {
                // Recorded where a caller can read it, as well as printed. stderr
                // is not the app's log and nothing in-process could poll it; a
                // backend that stops delivering key events while every caller
                // still reads "registered" is the failure shape of
                // docs/known-issues/shortcuts-die-and-cannot-be-re-registered.md,
                // and it has to be answerable by asking rather than by grepping.
                crate::note_event_loop_stopped(err.clone());
                eprintln!("[global-hotkey] x11 event thread ended: {err}");
                #[cfg(feature = "tracing")]
                tracing::error!("{}", err);
            }
        });
        Ok(Self { thread_tx })
    }

    pub fn register(&self, hotkey: HotKey) -> crate::Result<()> {
        let (tx, rx) = crossbeam_channel::bounded(1);
        let _ = self
            .thread_tx
            .send(ThreadMessage::RegisterHotKey(hotkey, tx));

        if let Ok(result) = rx.recv() {
            result?;
        }

        Ok(())
    }

    pub fn unregister(&self, hotkey: HotKey) -> crate::Result<()> {
        let (tx, rx) = crossbeam_channel::bounded(1);
        let _ = self
            .thread_tx
            .send(ThreadMessage::UnRegisterHotKey(hotkey, tx));

        if let Ok(result) = rx.recv() {
            result?;
        }

        Ok(())
    }

    pub fn register_all(&self, hotkeys: &[HotKey]) -> crate::Result<()> {
        let (tx, rx) = crossbeam_channel::bounded(1);
        let _ = self
            .thread_tx
            .send(ThreadMessage::RegisterHotKeys(hotkeys.to_vec(), tx));

        if let Ok(result) = rx.recv() {
            result?;
        }

        Ok(())
    }

    pub fn unregister_all(&self, hotkeys: &[HotKey]) -> crate::Result<()> {
        let (tx, rx) = crossbeam_channel::bounded(1);
        let _ = self
            .thread_tx
            .send(ThreadMessage::UnRegisterHotKeys(hotkeys.to_vec(), tx));

        if let Ok(result) = rx.recv() {
            result?;
        }

        Ok(())
    }
}

impl Drop for GlobalHotKeyManager {
    fn drop(&mut self) {
        let _ = self.thread_tx.send(ThreadMessage::DropThread);
    }
}

// XGrabKey works only with the exact state (modifiers)
// and since X11 considers NumLock, ScrollLock and CapsLock a modifier when it is ON,
// we also need to register our shortcut combined with these extra modifiers as well
fn ignored_mods() -> [ModMask; 4] {
    [
        ModMask::default(), // modifier only
        ModMask::M2,        // NumLock
        ModMask::LOCK,      // CapsLock
        ModMask::M2 | ModMask::LOCK,
    ]
}

#[inline]
fn register_hotkey(
    conn: &RustConnection,
    root: Window,
    hotkeys: &mut BTreeMap<Keycode, Vec<HotKeyState>>,
    observer: &mut Observer,
    hotkey: HotKey,
) -> crate::Result<()> {
    let (mods, key) = (
        modifiers_to_x11_mods(hotkey.mods),
        keycode_to_x11_keysym(hotkey.key),
    );

    let Some(key) = key else {
        return Err(Error::FailedToRegister(format!(
            "Unknown scancode for key: {}",
            hotkey.key
        )));
    };

    let keycode = keysym_to_keycode(conn, key).map_err(Error::FailedToRegister)?;

    let Some(keycode) = keycode else {
        return Err(Error::FailedToRegister(format!(
            "Unable to find keycode for key: {}",
            hotkey.key
        )));
    };

    // A modifier as the main key is observed, never grabbed. See the note at the
    // top of this file.
    if is_modifier_code(hotkey.key) {
        return observer.register(hotkey, keycode);
    }

    for m in ignored_mods() {
        let result = conn
            .grab_key(
                false,
                root,
                mods | m,
                keycode,
                GrabMode::ASYNC,
                GrabMode::ASYNC,
            )
            .map_err(|err| Error::FailedToRegister(err.to_string()))?;

        if let Err(err) = result.check() {
            return match err {
                ReplyError::ConnectionError(err) => Err(Error::FailedToRegister(err.to_string())),
                ReplyError::X11Error(err) => {
                    if let ErrorKind::Access = err.error_kind {
                        for m in ignored_mods() {
                            if let Ok(result) = conn.ungrab_key(keycode, root, mods | m) {
                                result.ignore_error();
                            }
                        }

                        Err(Error::AlreadyRegistered(hotkey))
                    } else {
                        Err(Error::FailedToRegister(format!("{err:?}")))
                    }
                }
            };
        }
    }

    let entry = hotkeys.entry(keycode).or_default();
    match entry.iter().find(|e| e.mods == mods) {
        None => {
            let state = HotKeyState {
                id: hotkey.id(),
                mods,
                pressed: false,
                interrupted: false,
            };
            entry.push(state);
            Ok(())
        }
        Some(_) => Err(Error::AlreadyRegistered(hotkey)),
    }
}

#[inline]
fn unregister_hotkey(
    conn: &RustConnection,
    root: Window,
    hotkeys: &mut BTreeMap<Keycode, Vec<HotKeyState>>,
    observer: &mut Observer,
    hotkey: HotKey,
) -> crate::Result<()> {
    let (modifiers, key) = (
        modifiers_to_x11_mods(hotkey.mods),
        keycode_to_x11_keysym(hotkey.key),
    );

    let Some(key) = key else {
        return Err(Error::FailedToUnRegister(hotkey));
    };

    let keycode = keysym_to_keycode(conn, key).map_err(|_err| Error::FailedToUnRegister(hotkey))?;

    let Some(keycode) = keycode else {
        return Err(Error::FailedToUnRegister(hotkey));
    };

    if is_modifier_code(hotkey.key) {
        observer.unregister(hotkey, keycode);
        return Ok(());
    }

    for m in ignored_mods() {
        if let Ok(result) = conn.ungrab_key(keycode, root, modifiers | m) {
            result.ignore_error();
        }
    }

    let entry = hotkeys.entry(keycode).or_default();
    entry.retain(|k| k.mods != modifiers);
    Ok(())
}

struct HotKeyState {
    id: u32,
    pressed: bool,
    mods: ModMask,
    /// Only meaningful on the observation path: another key went down while this
    /// trigger was held, so the hold was not a clean tap.
    interrupted: bool,
}

/// The eight modifier keys, with the `ModMask` bit each contributes. This is the
/// only key material the observation path retains.
const OBSERVED_MODIFIERS: [(Code, ModMask); 8] = [
    (Code::ControlLeft, ModMask::CONTROL),
    (Code::ControlRight, ModMask::CONTROL),
    (Code::ShiftLeft, ModMask::SHIFT),
    (Code::ShiftRight, ModMask::SHIFT),
    (Code::AltLeft, ModMask::M1),
    (Code::AltRight, ModMask::M1),
    (Code::MetaLeft, ModMask::M4),
    (Code::MetaRight, ModMask::M4),
];

pub(crate) fn is_modifier_code(code: Code) -> bool {
    OBSERVED_MODIFIERS
        .iter()
        .any(|(modifier, _)| *modifier == code)
}

/// How often the pressed states are reconciled against the server while at
/// least one of them says a key is down. Only a lost release makes them
/// disagree, so this is a repair interval, not a poll: it decides how long a
/// stranded hold runs before it is ended, not how fast a key is noticed.
const RECONCILE_INTERVAL: Duration = Duration::from_millis(250);

/// The server's own answer to *which keys are physically down right now*, from
/// `QueryKeymap`: one bit per keycode.
///
/// The observation path used to accumulate this from the raw event stream
/// instead, in a `held` list that only a matching raw release ever removed from.
/// That stream drops events -- measured on the reporting machine, six capture
/// presses in one log with no release before the next -- and every dropped
/// release stranded a modifier in that list **forever**. Nothing cleared it:
/// not `register`, not `unregister`, not suspend/resume, not the hotkey
/// recorder, and the manager is built once per process, so only a restart did.
/// One stranded modifier makes `state.mods == held_mask` false for every later
/// press of a bare-modifier trigger, and the trigger is then silent for good
/// while the app still reads *registered* -- which is the failure recorded in
/// `docs/known-issues/shortcuts-die-and-cannot-be-re-registered.md`.
///
/// Asking the server instead of accumulating does not repair that state; it
/// removes it. There is nothing left to drift.
#[derive(Clone, Copy, Default)]
pub(crate) struct KeyState {
    keys: [u8; 32],
}

impl KeyState {
    fn is_down(&self, keycode: Keycode) -> bool {
        let index = usize::from(keycode);
        self.keys
            .get(index / 8)
            .map(|byte| byte & (1 << (index % 8)) != 0)
            .unwrap_or(false)
    }

    #[cfg(test)]
    fn with_down(down: &[Keycode]) -> Self {
        let mut keys = [0u8; 32];
        for keycode in down {
            let index = usize::from(*keycode);
            keys[index / 8] |= 1 << (index % 8);
        }
        Self { keys }
    }
}

/// Asks the server which keys are down.
///
/// A failure here is a connection failure -- the request carries no arguments
/// that can be wrong -- so it is reported the same way polling reports one, by
/// ending the thread with a stated reason rather than by guessing a key state.
/// Guessing would be worse than stopping: an empty state reads as *no modifier
/// held*, which fires triggers nobody pressed.
fn query_key_state(conn: &RustConnection) -> Result<KeyState, String> {
    let reply = conn
        .query_keymap()
        .map_err(|err| format!("unable to ask the x11 server which keys are down: {err}"))?
        .reply()
        .map_err(|err| format!("x11 server did not answer which keys are down: {err}"))?;

    Ok(KeyState { keys: reply.keys })
}

/// Emits the `Released` the event stream owed and never delivered.
///
/// A lost release leaves `pressed` true, and `!state.pressed` then rejects every
/// later press of that binding: dead until something unregisters and
/// re-registers it. Measured in the reporting machine's log -- a capture press
/// at +148.952 with a hold committed, no release ever, and the next press 25 s
/// later only possible because a re-registration had reset the flag in between.
/// The consumer is owed that release too: the hold it started otherwise runs
/// until a timeout.
///
/// Reports the count so the caller can say it happened.
fn release_stranded_states(
    hotkeys: &mut BTreeMap<Keycode, Vec<HotKeyState>>,
    keys: &KeyState,
    origin: HotKeyEventOrigin,
) -> usize {
    let mut released = 0;

    for (keycode, entry) in hotkeys.iter_mut() {
        if keys.is_down(*keycode) {
            continue;
        }
        for state in entry {
            if !state.pressed {
                continue;
            }
            GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                id: state.id,
                state: crate::HotKeyState::Released,
                interrupted: state.interrupted,
                origin,
            });
            state.pressed = false;
            state.interrupted = false;
            released += 1;
        }
    }

    released
}

/// Whether any binding currently believes its key is down. Reconciling costs a
/// server round trip, and there is nothing to reconcile while nothing is held.
fn any_state_pressed(hotkeys: &BTreeMap<Keycode, Vec<HotKeyState>>) -> bool {
    hotkeys
        .values()
        .any(|entry| entry.iter().any(|state| state.pressed))
}

/// Non-consuming observation of the modifier keys through XInput2 raw events.
struct Observer {
    /// `None` until XInput2 has been negotiated; `Some(false)` when the server
    /// does not offer it, in which case observed hotkeys cannot be registered and
    /// say so rather than failing silently.
    available: bool,
    /// Modifier keycode -> the mask bit it contributes. Built once from the
    /// server's keyboard mapping.
    modifier_keycodes: BTreeMap<Keycode, ModMask>,
    /// Registered observed hotkeys, keyed by the keycode of their main key.
    hotkeys: BTreeMap<Keycode, Vec<HotKeyState>>,
}

impl Observer {
    fn new() -> Self {
        Self {
            available: false,
            modifier_keycodes: BTreeMap::new(),
            hotkeys: BTreeMap::new(),
        }
    }

    /// Negotiates XInput2 and selects raw key events on the root window. Raw
    /// events are delivered regardless of which client has focus and without
    /// consuming the keystroke.
    fn init(&mut self, conn: &RustConnection, root: Window) {
        let negotiated = match xinput::ConnectionExt::xinput_xi_query_version(conn, 2, 0) {
            Ok(cookie) => cookie.reply().is_ok(),
            Err(_) => false,
        };
        if !negotiated {
            return;
        }

        let event_mask = xinput::EventMask {
            deviceid: u16::from(xinput::Device::ALL_MASTER),
            mask: vec![xinput::XIEventMask::RAW_KEY_PRESS | xinput::XIEventMask::RAW_KEY_RELEASE],
        };

        if xinput::ConnectionExt::xinput_xi_select_events(conn, root, &[event_mask])
            .map(|cookie| cookie.check())
            .is_err()
        {
            return;
        }

        for (code, mask) in OBSERVED_MODIFIERS {
            let Some(keysym) = keycode_to_x11_keysym(code) else {
                continue;
            };
            if let Ok(Some(keycode)) = keysym_to_keycode(conn, keysym) {
                self.modifier_keycodes.insert(keycode, mask);
            }
        }

        self.available = true;
    }

    /// The modifier mask currently held, ignoring one keycode. Used to compare
    /// against a hotkey's own modifier set: the key that just went down is the
    /// main key, not one of its modifiers.
    ///
    /// Reads the server's key state rather than a list of its own. See
    /// [`KeyState`] for what the list cost.
    fn held_mask_excluding(&self, keys: &KeyState, excluded: Keycode) -> ModMask {
        let mut mask = ModMask::default();
        for (keycode, bit) in &self.modifier_keycodes {
            if *keycode == excluded {
                continue;
            }
            if keys.is_down(*keycode) {
                mask |= *bit;
            }
        }
        mask
    }

    fn register(&mut self, hotkey: HotKey, keycode: Keycode) -> crate::Result<()> {
        if !self.available {
            return Err(Error::FailedToRegister(format!(
                "'{}' needs XInput2 raw key events to be observed rather than grabbed, and this \
                 X server does not offer them.",
                hotkey.key
            )));
        }

        let mods = modifiers_to_x11_mods(hotkey.mods);
        let entry = self.hotkeys.entry(keycode).or_default();
        if entry.iter().any(|state| state.mods == mods) {
            return Err(Error::AlreadyRegistered(hotkey));
        }

        entry.push(HotKeyState {
            id: hotkey.id(),
            mods,
            pressed: false,
            interrupted: false,
        });
        Ok(())
    }

    fn unregister(&mut self, hotkey: HotKey, keycode: Keycode) {
        let mods = modifiers_to_x11_mods(hotkey.mods);
        if let Some(entry) = self.hotkeys.get_mut(&keycode) {
            entry.retain(|state| state.mods != mods);
        }
    }

    /// A raw key press. Returns nothing and emits at most one `Pressed` per
    /// registered hotkey whose modifier set is exactly what is held.
    /// Whether deciding this press needs the server's key state.
    ///
    /// Raw events arrive for EVERY key on the system, and only a press of a key
    /// something is registered on can fire anything — so only that press is
    /// worth a round trip. Without this, ordinary typing paid one `QueryKeymap`
    /// per character to compute a mask nothing then read.
    fn needs_key_state(&self, keycode: Keycode) -> bool {
        self.hotkeys.contains_key(&keycode)
    }

    /// `keys` is the server's answer for a keycode [`Observer::needs_key_state`]
    /// asked about, and `None` for every other key. `None` therefore cannot
    /// suppress a trigger: no hotkey is registered on that keycode. The pairing
    /// below makes that structural rather than a rule to remember.
    fn on_raw_press(&mut self, keycode: Keycode, keys: Option<&KeyState>) {
        let is_modifier = self.modifier_keycodes.contains_key(&keycode);

        // A key that is not a tracked modifier is discarded as key material, but
        // the fact that *something* was pressed is kept: it interrupts every
        // currently held trigger. That is what separates a deliberate tap of a
        // modifier from `Shift` on the way to a capital letter, and it is the only
        // reason a single modifier can be a trigger at all.
        if !is_modifier {
            for entry in self.hotkeys.values_mut() {
                for state in entry {
                    if state.pressed {
                        state.interrupted = true;
                    }
                }
            }
            return;
        }

        // A second modifier going down also interrupts a held trigger whose own
        // set is now exceeded: holding `Shift` and adding `Ctrl` is not a tap of
        // `Shift`.
        for (registered, entry) in self.hotkeys.iter_mut() {
            if *registered == keycode {
                continue;
            }
            for state in entry {
                if state.pressed {
                    state.interrupted = true;
                }
            }
        }

        let held_mask = keys.map(|keys| self.held_mask_excluding(keys, keycode));
        if let (Some(held_mask), Some(entry)) = (held_mask, self.hotkeys.get_mut(&keycode)) {
            for state in entry {
                if state.mods == held_mask && !state.pressed {
                    state.pressed = true;
                    state.interrupted = false;
                    GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                        id: state.id,
                        state: crate::HotKeyState::Pressed,
                        interrupted: false,
                        origin: HotKeyEventOrigin::RawDevice,
                    });
                }
            }
        }
    }

    fn on_raw_release(&mut self, keycode: Keycode) {
        if !self.modifier_keycodes.contains_key(&keycode) {
            return;
        }

        if let Some(entry) = self.hotkeys.get_mut(&keycode) {
            for state in entry {
                if state.pressed {
                    // The release is always reported, interrupted or not: a
                    // consumer that started something on the press edge has to be
                    // able to end it. The flag is the information, not a filter.
                    GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                        id: state.id,
                        state: crate::HotKeyState::Released,
                        interrupted: state.interrupted,
                        origin: HotKeyEventOrigin::RawDevice,
                    });
                    state.pressed = false;
                    state.interrupted = false;
                }
            }
        }
    }
}

fn events_processor(thread_rx: Receiver<ThreadMessage>) -> Result<(), String> {
    let mut hotkeys = BTreeMap::<Keycode, Vec<HotKeyState>>::new();

    let (conn, screen) = RustConnection::connect(None)
        .map_err(|err| format!("Unable to open x11 connection, maybe you are not running under X11? Other window systems on Linux are not supported by `global-hotkey` crate: {err}"))?;

    xkb::ConnectionExt::xkb_use_extension(&conn, 1, 0)
        .map_err(|err| format!("Unable to send xkb_use_extension request to x11 server: {err}"))?
        .reply()
        .map_err(|err| format!("xkb_use_extension request to x11 server has failed: {err}"))?;

    xkb::ConnectionExt::xkb_per_client_flags(
        &conn,
        xkb::ID::USE_CORE_KBD.into(),
        xkb::PerClientFlag::DETECTABLE_AUTO_REPEAT,
        xkb::PerClientFlag::DETECTABLE_AUTO_REPEAT,
        Default::default(),
        Default::default(),
        Default::default(),
    )
    .map_err(|err| format!("Unable to send xkb_per_client_flags request to x11 server: {err}"))?
    .reply()
    .map_err(|err| format!("xkb_per_client_flags request to x11 server has failed: {err}"))?;

    let root = conn.setup().roots[screen].root;

    let mut observer = Observer::new();
    observer.init(&conn, root);

    // X11 sends masks for Lock keys as well, and we only care about the 4 below
    let full_mask = KeyButMask::CONTROL | KeyButMask::SHIFT | KeyButMask::MOD4 | KeyButMask::MOD1;

    let mut last_reconcile = Instant::now();

    loop {
        // `while let Ok(Some(event))` swallowed the Err arm: a broken X
        // connection made the pattern fail to match, the inner loop ended, and
        // the OUTER loop went straight back to polling a dead connection -- 1 ms
        // apart, forever, delivering nothing and saying nothing. The manager
        // thread stayed alive, so no caller could observe it, and the app's own
        // registration state still read "registered". That is candidate 3 of
        // docs/known-issues/shortcuts-die-and-cannot-be-re-registered.md, and it
        // is the only one of the three that was reachable by reading this file.
        //
        // Not a diagnosis of that bug: this makes the failure REPORTABLE rather
        // than proving it is the one that happened. There is nothing to retry --
        // every grab lives on this connection -- so the thread ends with a
        // reason instead of spinning.
        loop {
            let event = match conn.poll_for_event() {
                Ok(Some(event)) => event,
                Ok(None) => break,
                Err(err) => {
                    return Err(format!(
                        "x11 connection lost while polling for hotkey events, \
                         so no further key event can arrive: {err}"
                    ))
                }
            };
            match event {
                Event::KeyPress(event) => {
                    let keycode = event.detail;

                    let event_mods = event.state & full_mask;
                    let event_mods = ModMask::from(event_mods.bits());

                    if let Some(entry) = hotkeys.get_mut(&keycode) {
                        for state in entry {
                            if event_mods == state.mods && !state.pressed {
                                GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                                    id: state.id,
                                    state: crate::HotKeyState::Pressed,
                                    interrupted: false,
                                    origin: HotKeyEventOrigin::Grab,
                                });
                                state.pressed = true;
                            }
                        }
                    }
                }
                Event::KeyRelease(event) => {
                    let keycode = event.detail;

                    if let Some(entry) = hotkeys.get_mut(&keycode) {
                        for state in entry {
                            if state.pressed {
                                GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                                    id: state.id,
                                    state: crate::HotKeyState::Released,
                                    interrupted: false,
                                    origin: HotKeyEventOrigin::Grab,
                                });
                                state.pressed = false;
                            }
                        }
                    }
                }
                Event::XinputRawKeyPress(event) => {
                    let keycode = event.detail as Keycode;
                    let keys = if observer.needs_key_state(keycode) {
                        Some(query_key_state(&conn)?)
                    } else {
                        None
                    };
                    observer.on_raw_press(keycode, keys.as_ref());
                }
                Event::XinputRawKeyRelease(event) => {
                    observer.on_raw_release(event.detail as Keycode);
                }
                _ => {}
            }
        }

        if let Ok(msg) = thread_rx.try_recv() {
            match msg {
                ThreadMessage::RegisterHotKey(hotkey, tx) => {
                    let _ = tx.send(register_hotkey(
                        &conn,
                        root,
                        &mut hotkeys,
                        &mut observer,
                        hotkey,
                    ));
                }
                ThreadMessage::RegisterHotKeys(keys, tx) => {
                    for hotkey in keys {
                        if let Err(e) =
                            register_hotkey(&conn, root, &mut hotkeys, &mut observer, hotkey)
                        {
                            let _ = tx.send(Err(e));
                        }
                    }
                    let _ = tx.send(Ok(()));
                }
                ThreadMessage::UnRegisterHotKey(hotkey, tx) => {
                    let _ = tx.send(unregister_hotkey(
                        &conn,
                        root,
                        &mut hotkeys,
                        &mut observer,
                        hotkey,
                    ));
                }
                ThreadMessage::UnRegisterHotKeys(keys, tx) => {
                    for hotkey in keys {
                        if let Err(e) =
                            unregister_hotkey(&conn, root, &mut hotkeys, &mut observer, hotkey)
                        {
                            let _ = tx.send(Err(e));
                        }
                    }
                    let _ = tx.send(Ok(()));
                }
                ThreadMessage::DropThread => {
                    return Ok(());
                }
            }
        }

        // The thread is alive and polling. Nothing else in the process could
        // say so: when this loop stopped delivering, every registration state in
        // the app still read *registered*, and the only report of a dead loop
        // was its own last words. A beat is the difference between "no key was
        // pressed" and "nobody is listening", which no event count can tell
        // apart on its own.
        crate::beat_event_loop();

        // Reconcile only while something is held, and only every
        // RECONCILE_INTERVAL: a lost release is the sole way the flags and the
        // server can disagree, and it is rare.
        if last_reconcile.elapsed() >= RECONCILE_INTERVAL
            && (any_state_pressed(&hotkeys) || any_state_pressed(&observer.hotkeys))
        {
            last_reconcile = Instant::now();
            let keys = query_key_state(&conn)?;
            let stranded = release_stranded_states(&mut hotkeys, &keys, HotKeyEventOrigin::Grab)
                + release_stranded_states(
                    &mut observer.hotkeys,
                    &keys,
                    HotKeyEventOrigin::RawDevice,
                );
            if stranded > 0 {
                crate::note_stranded_releases(stranded);
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(1));
    }
}

fn keycode_to_x11_keysym(key: Code) -> Option<RawKeysym> {
    Some(match key {
        Code::KeyA => xkeysym::key::A,
        Code::KeyB => xkeysym::key::B,
        Code::KeyC => xkeysym::key::C,
        Code::KeyD => xkeysym::key::D,
        Code::KeyE => xkeysym::key::E,
        Code::KeyF => xkeysym::key::F,
        Code::KeyG => xkeysym::key::G,
        Code::KeyH => xkeysym::key::H,
        Code::KeyI => xkeysym::key::I,
        Code::KeyJ => xkeysym::key::J,
        Code::KeyK => xkeysym::key::K,
        Code::KeyL => xkeysym::key::L,
        Code::KeyM => xkeysym::key::M,
        Code::KeyN => xkeysym::key::N,
        Code::KeyO => xkeysym::key::O,
        Code::KeyP => xkeysym::key::P,
        Code::KeyQ => xkeysym::key::Q,
        Code::KeyR => xkeysym::key::R,
        Code::KeyS => xkeysym::key::S,
        Code::KeyT => xkeysym::key::T,
        Code::KeyU => xkeysym::key::U,
        Code::KeyV => xkeysym::key::V,
        Code::KeyW => xkeysym::key::W,
        Code::KeyX => xkeysym::key::X,
        Code::KeyY => xkeysym::key::Y,
        Code::KeyZ => xkeysym::key::Z,
        Code::Backslash => xkeysym::key::backslash,
        Code::BracketLeft => xkeysym::key::bracketleft,
        Code::BracketRight => xkeysym::key::bracketright,
        Code::Backquote => xkeysym::key::quoteleft,
        Code::Comma => xkeysym::key::comma,
        Code::Digit0 => xkeysym::key::_0,
        Code::Digit1 => xkeysym::key::_1,
        Code::Digit2 => xkeysym::key::_2,
        Code::Digit3 => xkeysym::key::_3,
        Code::Digit4 => xkeysym::key::_4,
        Code::Digit5 => xkeysym::key::_5,
        Code::Digit6 => xkeysym::key::_6,
        Code::Digit7 => xkeysym::key::_7,
        Code::Digit8 => xkeysym::key::_8,
        Code::Digit9 => xkeysym::key::_9,
        Code::Equal => xkeysym::key::equal,
        Code::Minus => xkeysym::key::minus,
        Code::Period => xkeysym::key::period,
        Code::AltLeft => xkeysym::key::Alt_L,
        Code::AltRight => xkeysym::key::Alt_R,
        Code::ControlLeft => xkeysym::key::Control_L,
        Code::ControlRight => xkeysym::key::Control_R,
        Code::MetaLeft => xkeysym::key::Super_L,
        Code::MetaRight => xkeysym::key::Super_R,
        Code::Quote => xkeysym::key::leftsinglequotemark,
        Code::Semicolon => xkeysym::key::semicolon,
        Code::ShiftLeft => xkeysym::key::Shift_L,
        Code::ShiftRight => xkeysym::key::Shift_R,
        Code::Slash => xkeysym::key::slash,
        Code::Backspace => xkeysym::key::BackSpace,
        Code::CapsLock => xkeysym::key::Caps_Lock,
        Code::Enter => xkeysym::key::Return,
        Code::Space => xkeysym::key::space,
        Code::Tab => xkeysym::key::Tab,
        Code::Delete => xkeysym::key::Delete,
        Code::End => xkeysym::key::End,
        Code::Home => xkeysym::key::Home,
        Code::Insert => xkeysym::key::Insert,
        Code::PageDown => xkeysym::key::Page_Down,
        Code::PageUp => xkeysym::key::Page_Up,
        Code::ArrowDown => xkeysym::key::Down,
        Code::ArrowLeft => xkeysym::key::Left,
        Code::ArrowRight => xkeysym::key::Right,
        Code::ArrowUp => xkeysym::key::Up,
        Code::Numpad0 => xkeysym::key::KP_0,
        Code::Numpad1 => xkeysym::key::KP_1,
        Code::Numpad2 => xkeysym::key::KP_2,
        Code::Numpad3 => xkeysym::key::KP_3,
        Code::Numpad4 => xkeysym::key::KP_4,
        Code::Numpad5 => xkeysym::key::KP_5,
        Code::Numpad6 => xkeysym::key::KP_6,
        Code::Numpad7 => xkeysym::key::KP_7,
        Code::Numpad8 => xkeysym::key::KP_8,
        Code::Numpad9 => xkeysym::key::KP_9,
        Code::NumpadAdd => xkeysym::key::KP_Add,
        Code::NumpadDecimal => xkeysym::key::KP_Decimal,
        Code::NumpadDivide => xkeysym::key::KP_Divide,
        Code::NumpadMultiply => xkeysym::key::KP_Multiply,
        Code::NumpadSubtract => xkeysym::key::KP_Subtract,
        Code::Escape => xkeysym::key::Escape,
        Code::PrintScreen => xkeysym::key::Print,
        Code::ScrollLock => xkeysym::key::Scroll_Lock,
        Code::NumLock => xkeysym::key::F1,
        Code::F1 => xkeysym::key::F1,
        Code::F2 => xkeysym::key::F2,
        Code::F3 => xkeysym::key::F3,
        Code::F4 => xkeysym::key::F4,
        Code::F5 => xkeysym::key::F5,
        Code::F6 => xkeysym::key::F6,
        Code::F7 => xkeysym::key::F7,
        Code::F8 => xkeysym::key::F8,
        Code::F9 => xkeysym::key::F9,
        Code::F10 => xkeysym::key::F10,
        Code::F11 => xkeysym::key::F11,
        Code::F12 => xkeysym::key::F12,
        Code::AudioVolumeDown => xkeysym::key::XF86_AudioLowerVolume,
        Code::AudioVolumeMute => xkeysym::key::XF86_AudioMute,
        Code::AudioVolumeUp => xkeysym::key::XF86_AudioRaiseVolume,
        Code::MediaPlay => xkeysym::key::XF86_AudioPlay,
        Code::MediaPause => xkeysym::key::XF86_AudioPause,
        Code::MediaStop => xkeysym::key::XF86_AudioStop,
        Code::MediaTrackNext => xkeysym::key::XF86_AudioNext,
        Code::MediaTrackPrevious => xkeysym::key::XF86_AudioPrev,
        Code::Pause => xkeysym::key::Pause,
        _ => return None,
    })
}

fn modifiers_to_x11_mods(modifiers: Modifiers) -> ModMask {
    let mut x11mods = ModMask::default();
    if modifiers.contains(Modifiers::SHIFT) {
        x11mods |= ModMask::SHIFT;
    }
    if modifiers.intersects(Modifiers::SUPER | Modifiers::META) {
        x11mods |= ModMask::M4;
    }
    if modifiers.contains(Modifiers::ALT) {
        x11mods |= ModMask::M1;
    }
    if modifiers.contains(Modifiers::CONTROL) {
        x11mods |= ModMask::CONTROL;
    }
    x11mods
}

fn keysym_to_keycode(conn: &RustConnection, keysym: RawKeysym) -> Result<Option<Keycode>, String> {
    let setup = conn.setup();
    let min_keycode = setup.min_keycode;
    let max_keycode = setup.max_keycode;
    let count = max_keycode - min_keycode + 1;

    let mapping = conn
        .get_keyboard_mapping(min_keycode, count)
        .map_err(|err| err.to_string())?
        .reply()
        .map_err(|err| err.to_string())?;

    let keysyms_per_keycode = mapping.keysyms_per_keycode as usize;

    for (i, keysyms) in mapping.keysyms.chunks(keysyms_per_keycode).enumerate() {
        if keysyms.contains(&keysym) {
            return Ok(Some(min_keycode + i as u8));
        }
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHIFT_L: Keycode = 50;
    const CONTROL_L: Keycode = 37;
    const ALT_L: Keycode = 64;

    fn observer_with(hotkey_keycode: Keycode, mods: ModMask) -> Observer {
        let mut observer = Observer::new();
        observer.available = true;
        observer.modifier_keycodes.insert(SHIFT_L, ModMask::SHIFT);
        observer.modifier_keycodes.insert(CONTROL_L, ModMask::CONTROL);
        observer.modifier_keycodes.insert(ALT_L, ModMask::M1);
        observer.hotkeys.insert(
            hotkey_keycode,
            vec![HotKeyState {
                id: 60,
                mods,
                pressed: false,
                interrupted: false,
            }],
        );
        observer
    }

    #[test]
    fn key_state_reads_one_bit_per_keycode() {
        let keys = KeyState::with_down(&[SHIFT_L, ALT_L]);

        assert!(keys.is_down(SHIFT_L));
        assert!(keys.is_down(ALT_L));
        assert!(!keys.is_down(CONTROL_L));
        assert!(!keys.is_down(0));
        assert!(!keys.is_down(255));
    }

    #[test]
    fn the_key_that_just_went_down_is_not_one_of_its_own_modifiers() {
        let observer = observer_with(SHIFT_L, ModMask::default());
        let keys = KeyState::with_down(&[SHIFT_L]);

        assert_eq!(
            observer.held_mask_excluding(&keys, SHIFT_L),
            ModMask::default()
        );
    }

    /// The bug this file's `KeyState` exists for.
    ///
    /// `Alt` went down and its release was lost -- the compositor took the
    /// keyboard and XWayland never saw the key come back up. The old code kept a
    /// `held` list that only a matching release removed from, so `Alt` stayed in
    /// it for the life of the process and bare `Shift` never matched again.
    /// Asking the server, the mask is empty, because the key is up.
    #[test]
    fn a_modifier_whose_release_was_lost_is_not_reported_as_held() {
        let observer = observer_with(SHIFT_L, ModMask::default());
        let keys = KeyState::with_down(&[SHIFT_L]);

        assert_eq!(
            observer.held_mask_excluding(&keys, SHIFT_L),
            ModMask::default(),
            "the server says Alt is up, so it is up"
        );

        let really_held = KeyState::with_down(&[SHIFT_L, ALT_L]);
        assert_eq!(
            observer.held_mask_excluding(&really_held, SHIFT_L),
            ModMask::M1,
            "a modifier that IS down still masks the trigger"
        );
    }

    #[test]
    fn a_press_fires_while_no_other_modifier_is_down() {
        let mut observer = observer_with(SHIFT_L, ModMask::default());

        observer.on_raw_press(SHIFT_L, Some(&KeyState::with_down(&[SHIFT_L])));

        assert!(observer.hotkeys[&SHIFT_L][0].pressed);
    }

    #[test]
    fn a_press_does_not_fire_while_another_modifier_is_down() {
        let mut observer = observer_with(SHIFT_L, ModMask::default());

        observer.on_raw_press(SHIFT_L, Some(&KeyState::with_down(&[SHIFT_L, CONTROL_L])));

        assert!(!observer.hotkeys[&SHIFT_L][0].pressed);
    }

    #[test]
    fn a_lost_release_is_emitted_once_the_server_says_the_key_is_up() {
        let mut observer = observer_with(SHIFT_L, ModMask::default());
        observer.on_raw_press(SHIFT_L, Some(&KeyState::with_down(&[SHIFT_L])));
        assert!(observer.hotkeys[&SHIFT_L][0].pressed);

        let released = release_stranded_states(
            &mut observer.hotkeys,
            &KeyState::default(),
            HotKeyEventOrigin::RawDevice,
        );

        assert_eq!(released, 1);
        assert!(!observer.hotkeys[&SHIFT_L][0].pressed);

        // And the binding works again, which is the whole point: before this,
        // `!state.pressed` rejected every later press for the life of the
        // process unless something re-registered it.
        observer.on_raw_press(SHIFT_L, Some(&KeyState::with_down(&[SHIFT_L])));
        assert!(observer.hotkeys[&SHIFT_L][0].pressed);
    }

    #[test]
    fn a_key_that_is_still_down_is_left_alone() {
        let mut observer = observer_with(SHIFT_L, ModMask::default());
        observer.on_raw_press(SHIFT_L, Some(&KeyState::with_down(&[SHIFT_L])));

        let released = release_stranded_states(
            &mut observer.hotkeys,
            &KeyState::with_down(&[SHIFT_L]),
            HotKeyEventOrigin::RawDevice,
        );

        assert_eq!(released, 0);
        assert!(observer.hotkeys[&SHIFT_L][0].pressed);
    }

    #[test]
    fn nothing_to_reconcile_while_nothing_is_held() {
        let observer = observer_with(SHIFT_L, ModMask::default());

        assert!(!any_state_pressed(&observer.hotkeys));
    }
}
