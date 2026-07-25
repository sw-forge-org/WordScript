// Copyright 2022-2022 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::collections::BTreeMap;

use crossbeam_channel::{unbounded, Receiver, Sender};
use keyboard_types::{Code, Modifiers};
use x11rb::connection::Connection;
use x11rb::errors::ReplyError;
use x11rb::protocol::xinput;
use x11rb::protocol::xproto::{ConnectionExt, GrabMode, KeyButMask, Keycode, ModMask, Window};
use x11rb::protocol::{xkb, ErrorKind, Event};
use x11rb::rust_connection::RustConnection;
use xkeysym::RawKeysym;

use crate::{hotkey::HotKey, Error, GlobalHotKeyEvent};

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
            if let Err(_err) = events_processor(thread_rx) {
                #[cfg(feature = "tracing")]
                tracing::error!("{}", _err);
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

/// Non-consuming observation of the modifier keys through XInput2 raw events.
struct Observer {
    /// `None` until XInput2 has been negotiated; `Some(false)` when the server
    /// does not offer it, in which case observed hotkeys cannot be registered and
    /// say so rather than failing silently.
    available: bool,
    /// Modifier keycode -> the mask bit it contributes. Built once from the
    /// server's keyboard mapping.
    modifier_keycodes: BTreeMap<Keycode, ModMask>,
    /// Which modifier keycodes are currently down. Tracked as keycodes rather
    /// than as a mask so releasing one of a pair (left Ctrl while right Ctrl is
    /// still down) does not clear the bit prematurely.
    held: Vec<Keycode>,
    /// Registered observed hotkeys, keyed by the keycode of their main key.
    hotkeys: BTreeMap<Keycode, Vec<HotKeyState>>,
}

impl Observer {
    fn new() -> Self {
        Self {
            available: false,
            modifier_keycodes: BTreeMap::new(),
            held: Vec::new(),
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
    fn held_mask_excluding(&self, excluded: Keycode) -> ModMask {
        let mut mask = ModMask::default();
        for keycode in &self.held {
            if *keycode == excluded {
                continue;
            }
            if let Some(bit) = self.modifier_keycodes.get(keycode) {
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
    fn on_raw_press(&mut self, keycode: Keycode) {
        let is_modifier = self.modifier_keycodes.contains_key(&keycode);
        let held_mask = self.held_mask_excluding(keycode);

        if is_modifier && !self.held.contains(&keycode) {
            self.held.push(keycode);
        }

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

        if let Some(entry) = self.hotkeys.get_mut(&keycode) {
            for state in entry {
                if state.mods == held_mask && !state.pressed {
                    state.pressed = true;
                    state.interrupted = false;
                    GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                        id: state.id,
                        state: crate::HotKeyState::Pressed,
                        interrupted: false,
                    });
                }
            }
        }
    }

    fn on_raw_release(&mut self, keycode: Keycode) {
        if self.modifier_keycodes.contains_key(&keycode) {
            self.held.retain(|held| *held != keycode);
        } else {
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

    loop {
        while let Ok(Some(event)) = conn.poll_for_event() {
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
                                });
                                state.pressed = false;
                            }
                        }
                    }
                }
                Event::XinputRawKeyPress(event) => {
                    observer.on_raw_press(event.detail as Keycode);
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
