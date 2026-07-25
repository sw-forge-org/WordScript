// Copyright 2022-2022 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{cell::Cell, collections::HashMap};

use keyboard_types::{Code, Modifiers};
use once_cell::sync::{Lazy, OnceCell};
use windows_sys::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    UI::{
        Input::KeyboardAndMouse::*,
        WindowsAndMessaging::{
            CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
            UnhookWindowsHookEx, WH_KEYBOARD_LL, KBDLLHOOKSTRUCT, MSG, WM_KEYDOWN, WM_KEYUP,
            WM_SYSKEYDOWN, WM_SYSKEYUP,
        },
    },
};

use crate::{hotkey::HotKey, GlobalHotKeyEvent, HotKeyState};

static HOTKEY_REGISTRY: Lazy<std::sync::Mutex<HashMap<u32, HotKey>>> =
    Lazy::new(Default::default);
static HOOK_STARTED: OnceCell<()> = OnceCell::new();

const LLKHF_INJECTED: u32 = 0x10;

thread_local! {
    static MOD_STATE: Cell<Modifiers> = Cell::new(Modifiers::empty());
    static ACTIVE_ID: Cell<Option<u32>> = Cell::new(None);
    static ACTIVE_VK: Cell<u16> = Cell::new(0);
    static WIN_USED: Cell<bool> = Cell::new(false);
}

pub struct GlobalHotKeyManager;

impl GlobalHotKeyManager {
    pub fn new() -> crate::Result<Self> {
        ensure_hook_thread();
        Ok(Self)
    }

    pub fn register(&self, hotkey: HotKey) -> crate::Result<()> {
        if key_to_vk(&hotkey.key).is_none() {
            return Err(crate::Error::FailedToRegister(format!(
                "Unknown VKCode for {}",
                hotkey.key
            )));
        }
        HOTKEY_REGISTRY.lock().unwrap().insert(hotkey.id(), hotkey);
        Ok(())
    }

    pub fn unregister(&self, hotkey: HotKey) -> crate::Result<()> {
        HOTKEY_REGISTRY.lock().unwrap().remove(&hotkey.id());
        Ok(())
    }

    pub fn register_all(&self, hotkeys: &[HotKey]) -> crate::Result<()> {
        for h in hotkeys {
            self.register(*h)?;
        }
        Ok(())
    }

    pub fn unregister_all(&self, hotkeys: &[HotKey]) -> crate::Result<()> {
        for h in hotkeys {
            self.unregister(*h)?;
        }
        Ok(())
    }
}

fn ensure_hook_thread() {
    HOOK_STARTED.get_or_init(|| {
        std::thread::Builder::new()
            .name("global-hotkey-hook".into())
            .spawn(hook_thread_main)
            .expect("failed to spawn hotkey hook thread");
    });
}

fn hook_thread_main() {
    unsafe {
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(ll_keyboard_proc),
            std::ptr::null_mut(),
            0,
        );
        if hook.is_null() {
            eprintln!(
                "global-hotkey: failed to install WH_KEYBOARD_LL: {}",
                std::io::Error::last_os_error()
            );
            return;
        }
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnhookWindowsHookEx(hook);
    }
}

unsafe extern "system" fn ll_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code < 0 {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }
    let kb = &*(lparam as *const KBDLLHOOKSTRUCT);
    if kb.flags & LLKHF_INJECTED != 0 {
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }
    let vk = kb.vkCode as u16;
    let is_down = wparam == WM_KEYDOWN as usize || wparam == WM_SYSKEYDOWN as usize;
    let is_up = wparam == WM_KEYUP as usize || wparam == WM_SYSKEYUP as usize;

    if let Some(modifier) = vk_to_modifier(vk) {
        if is_down {
            MOD_STATE.with(|m| m.set(m.get() | modifier));
        } else if is_up {
            MOD_STATE.with(|m| {
                let mut v = m.get();
                v.remove(modifier);
                m.set(v);
            });
            if modifier == Modifiers::SUPER {
                WIN_USED.with(|w| {
                    if w.get() {
                        send_dummy_key();
                        w.set(false);
                    }
                });
            }
        }
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if is_down {
        let current_mods = MOD_STATE.with(|m| m.get());
        let event = HOTKEY_REGISTRY.try_lock().ok().and_then(|reg| {
            reg.iter().find_map(|(id, hotkey)| {
                key_to_vk(&hotkey.key)
                    .filter(|&hvk| hvk == vk && mods_match(hotkey.mods, current_mods))
                    .map(|_| {
                        (
                            *id,
                            hotkey.mods.intersects(Modifiers::SUPER | Modifiers::META),
                        )
                    })
            })
        });
        if let Some((id, uses_win)) = event {
            ACTIVE_ID.with(|a| a.set(Some(id)));
            ACTIVE_VK.with(|a| a.set(vk));
            if uses_win {
                WIN_USED.with(|w| w.set(true));
            }
            GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                id,
                state: HotKeyState::Pressed,
            });
            return 1;
        }
        return CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam);
    }

    if is_up {
        let maybe = ACTIVE_ID.with(|a| a.get()).zip(Some(ACTIVE_VK.with(|a| a.get())));
        if let Some((active_id, active_vk)) = maybe {
            if active_vk == vk {
                ACTIVE_ID.with(|a| a.set(None));
                ACTIVE_VK.with(|a| a.set(0));
                GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                    id: active_id,
                    state: HotKeyState::Released,
                    interrupted: false,
                });
                return 1;
            }
        }
    }

    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}

fn send_dummy_key() {
    unsafe {
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_F24,
                        wScan: 0,
                        dwFlags: 0,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_F24,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        );
    }
}

fn mods_match(registered: Modifiers, current: Modifiers) -> bool {
    fn norm(m: Modifiers) -> Modifiers {
        let base =
            Modifiers::SHIFT | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SUPER;
        let mut n = m;
        if n.contains(Modifiers::META) {
            n.remove(Modifiers::META);
            n.insert(Modifiers::SUPER);
        }
        n & base
    }
    norm(registered) == norm(current)
}

fn vk_to_modifier(vk: u16) -> Option<Modifiers> {
    match vk {
        v if v == VK_LCONTROL || v == VK_RCONTROL || v == VK_CONTROL => Some(Modifiers::CONTROL),
        v if v == VK_LMENU || v == VK_RMENU || v == VK_MENU => Some(Modifiers::ALT),
        v if v == VK_LSHIFT || v == VK_RSHIFT || v == VK_SHIFT => Some(Modifiers::SHIFT),
        v if v == VK_LWIN || v == VK_RWIN => Some(Modifiers::SUPER),
        _ => None,
    }
}

fn key_to_vk(key: &Code) -> Option<VIRTUAL_KEY> {
    Some(match key {
        Code::KeyA => VK_A,
        Code::KeyB => VK_B,
        Code::KeyC => VK_C,
        Code::KeyD => VK_D,
        Code::KeyE => VK_E,
        Code::KeyF => VK_F,
        Code::KeyG => VK_G,
        Code::KeyH => VK_H,
        Code::KeyI => VK_I,
        Code::KeyJ => VK_J,
        Code::KeyK => VK_K,
        Code::KeyL => VK_L,
        Code::KeyM => VK_M,
        Code::KeyN => VK_N,
        Code::KeyO => VK_O,
        Code::KeyP => VK_P,
        Code::KeyQ => VK_Q,
        Code::KeyR => VK_R,
        Code::KeyS => VK_S,
        Code::KeyT => VK_T,
        Code::KeyU => VK_U,
        Code::KeyV => VK_V,
        Code::KeyW => VK_W,
        Code::KeyX => VK_X,
        Code::KeyY => VK_Y,
        Code::KeyZ => VK_Z,
        Code::Digit0 => VK_0,
        Code::Digit1 => VK_1,
        Code::Digit2 => VK_2,
        Code::Digit3 => VK_3,
        Code::Digit4 => VK_4,
        Code::Digit5 => VK_5,
        Code::Digit6 => VK_6,
        Code::Digit7 => VK_7,
        Code::Digit8 => VK_8,
        Code::Digit9 => VK_9,
        Code::Equal => VK_OEM_PLUS,
        Code::Comma => VK_OEM_COMMA,
        Code::Minus => VK_OEM_MINUS,
        Code::Period => VK_OEM_PERIOD,
        Code::Semicolon => VK_OEM_1,
        Code::Slash => VK_OEM_2,
        Code::Backquote => VK_OEM_3,
        Code::BracketLeft => VK_OEM_4,
        Code::Backslash => VK_OEM_5,
        Code::BracketRight => VK_OEM_6,
        Code::Quote => VK_OEM_7,
        Code::AltLeft => VK_LMENU,
        Code::AltRight => VK_RMENU,
        Code::Backspace => VK_BACK,
        Code::Tab => VK_TAB,
        Code::ControlLeft => VK_LCONTROL,
        Code::ControlRight => VK_RCONTROL,
        Code::Space => VK_SPACE,
        Code::Enter => VK_RETURN,
        Code::CapsLock => VK_CAPITAL,
        Code::Escape => VK_ESCAPE,
        Code::MetaLeft => VK_LWIN,
        Code::MetaRight => VK_RWIN,
        Code::PageUp => VK_PRIOR,
        Code::PageDown => VK_NEXT,
        Code::End => VK_END,
        Code::Home => VK_HOME,
        Code::ShiftLeft => VK_LSHIFT,
        Code::ShiftRight => VK_RSHIFT,
        Code::ArrowLeft => VK_LEFT,
        Code::ArrowUp => VK_UP,
        Code::ArrowRight => VK_RIGHT,
        Code::ArrowDown => VK_DOWN,
        Code::PrintScreen => VK_SNAPSHOT,
        Code::Insert => VK_INSERT,
        Code::Delete => VK_DELETE,
        Code::F1 => VK_F1,
        Code::F2 => VK_F2,
        Code::F3 => VK_F3,
        Code::F4 => VK_F4,
        Code::F5 => VK_F5,
        Code::F6 => VK_F6,
        Code::F7 => VK_F7,
        Code::F8 => VK_F8,
        Code::F9 => VK_F9,
        Code::F10 => VK_F10,
        Code::F11 => VK_F11,
        Code::F12 => VK_F12,
        Code::F13 => VK_F13,
        Code::F14 => VK_F14,
        Code::F15 => VK_F15,
        Code::F16 => VK_F16,
        Code::F17 => VK_F17,
        Code::F18 => VK_F18,
        Code::F19 => VK_F19,
        Code::F20 => VK_F20,
        Code::F21 => VK_F21,
        Code::F22 => VK_F22,
        Code::F23 => VK_F23,
        Code::F24 => VK_F24,
        Code::NumLock => VK_NUMLOCK,
        Code::Numpad0 => VK_NUMPAD0,
        Code::Numpad1 => VK_NUMPAD1,
        Code::Numpad2 => VK_NUMPAD2,
        Code::Numpad3 => VK_NUMPAD3,
        Code::Numpad4 => VK_NUMPAD4,
        Code::Numpad5 => VK_NUMPAD5,
        Code::Numpad6 => VK_NUMPAD6,
        Code::Numpad7 => VK_NUMPAD7,
        Code::Numpad8 => VK_NUMPAD8,
        Code::Numpad9 => VK_NUMPAD9,
        Code::NumpadAdd => VK_ADD,
        Code::NumpadDecimal => VK_DECIMAL,
        Code::NumpadDivide => VK_DIVIDE,
        Code::NumpadEnter => VK_RETURN,
        Code::NumpadEqual => VK_E,
        Code::NumpadMultiply => VK_MULTIPLY,
        Code::NumpadSubtract => VK_SUBTRACT,
        Code::ScrollLock => VK_SCROLL,
        Code::AudioVolumeDown => VK_VOLUME_DOWN,
        Code::AudioVolumeUp => VK_VOLUME_UP,
        Code::AudioVolumeMute => VK_VOLUME_MUTE,
        Code::MediaPlay => VK_PLAY,
        Code::MediaPause => VK_PAUSE,
        Code::MediaPlayPause => VK_MEDIA_PLAY_PAUSE,
        Code::MediaStop => VK_MEDIA_STOP,
        Code::MediaTrackNext => VK_MEDIA_NEXT_TRACK,
        Code::MediaTrackPrevious => VK_MEDIA_PREV_TRACK,
        Code::Pause => VK_PAUSE,
        _ => return None,
    })
}
