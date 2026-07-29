//! WordScript patch: the platform-neutral half of an observed modifier-only
//! shortcut.
//!
//! The x11 backend grew this logic inline first and remains the reference
//! implementation (`platform_impl/x11/mod.rs`). It is deliberately *not* rewired
//! to this module: x11 is the one backend that has actually run, and a
//! refactor there would put the working platform at risk to tidy up two that do
//! not run yet. This module is a port of those same rules, kept honest by its
//! own tests, so that Windows and macOS carry the state machine rather than each
//! reinventing it.
//!
//! What it does *not* know: keycodes, virtual keys, hooks, taps, permissions.
//! An adapter feeds it two facts per raw event -- an opaque key identity and,
//! when the key is a modifier, which modifier it is -- and gets back the events
//! to emit. Everything that needs an OS to be judged stays in the adapter.

use std::collections::BTreeMap;

use keyboard_types::Modifiers;

/// An opaque key identity. The adapter picks the numbering (x11 keycode,
/// Windows virtual key, macOS keycode); this module only compares them.
pub type ObservedKey = u32;

/// One event the adapter should emit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Emission {
    pub id: u32,
    pub pressed: bool,
    /// Only ever true on a release. See the field docs on `GlobalHotKeyEvent`.
    pub interrupted: bool,
}

/// `META` and `SUPER` are the same physical key wearing two names, and the
/// platforms disagree about which one they report. Comparing raw flags would
/// make `Super+Alt` match on one backend and not on another, so every
/// comparison in this module goes through here first.
pub fn normalize(mods: Modifiers) -> Modifiers {
    let base = Modifiers::SHIFT | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SUPER;
    let mut normalized = mods;
    if normalized.contains(Modifiers::META) {
        normalized.remove(Modifiers::META);
        normalized.insert(Modifiers::SUPER);
    }
    normalized & base
}

#[derive(Debug, Clone, Copy)]
struct Registration {
    id: u32,
    mods: Modifiers,
    pressed: bool,
    interrupted: bool,
}

/// Tracks which modifiers are physically held and decides, per raw event, which
/// registered modifier-only shortcuts start, end, or are spoiled by another key.
#[derive(Debug, Default)]
pub struct ModifierOnlyObserver {
    hotkeys: BTreeMap<ObservedKey, Vec<Registration>>,
    held: Vec<(ObservedKey, Modifiers)>,
}

impl ModifierOnlyObserver {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns false if this exact combination is already registered, which the
    /// adapter should surface as `Error::AlreadyRegistered`.
    pub fn register(&mut self, id: u32, key: ObservedKey, mods: Modifiers) -> bool {
        let mods = normalize(mods);
        let entry = self.hotkeys.entry(key).or_default();
        if entry.iter().any(|registration| registration.mods == mods) {
            return false;
        }
        entry.push(Registration {
            id,
            mods,
            pressed: false,
            interrupted: false,
        });
        true
    }

    pub fn unregister(&mut self, key: ObservedKey, mods: Modifiers) {
        let mods = normalize(mods);
        if let Some(entry) = self.hotkeys.get_mut(&key) {
            entry.retain(|registration| registration.mods != mods);
            if entry.is_empty() {
                self.hotkeys.remove(&key);
            }
        }
    }

    pub fn is_empty(&self) -> bool {
        self.hotkeys.is_empty()
    }

    fn held_mask_excluding(&self, key: ObservedKey) -> Modifiers {
        self.held
            .iter()
            .filter(|(held, _)| *held != key)
            .fold(Modifiers::empty(), |mask, (_, modifier)| mask | *modifier)
    }

    fn interrupt_all_held_except(&mut self, key: ObservedKey) {
        for (registered, entry) in self.hotkeys.iter_mut() {
            if *registered == key {
                continue;
            }
            for registration in entry {
                if registration.pressed {
                    registration.interrupted = true;
                }
            }
        }
    }

    /// A raw key press. `modifier` is `None` for anything that is not a tracked
    /// modifier. Emits at most one press per registered shortcut whose modifier
    /// set is exactly what is held.
    pub fn on_press(&mut self, key: ObservedKey, modifier: Option<Modifiers>) -> Vec<Emission> {
        let held_mask = normalize(self.held_mask_excluding(key));

        let Some(modifier) = modifier else {
            // Key material is discarded, but the fact that *something* went down
            // is kept: it spoils every currently held trigger. That is the whole
            // reason a bare modifier can be a trigger at all -- it separates a
            // deliberate tap from `Shift` on the way to a capital letter.
            for entry in self.hotkeys.values_mut() {
                for registration in entry {
                    if registration.pressed {
                        registration.interrupted = true;
                    }
                }
            }
            return Vec::new();
        };

        if self.held.iter().any(|(held, _)| *held == key) {
            // Auto-repeat. x11 never reaches this because it asks the server for
            // `DETECTABLE_AUTO_REPEAT`; the Windows hook has no such switch and
            // delivers a fresh key-down every repeat interval. Treating one as a
            // real press is not merely redundant, it is wrong: with `Ctrl+Alt`
            // held, a repeat of `Ctrl` finds `Alt` in the held mask and would
            // fire the *other* registration of the same combination, so one
            // gesture would report itself twice.
            return Vec::new();
        }
        self.held.push((key, normalize(modifier)));

        // A second modifier going down also spoils a held trigger whose own set
        // is now exceeded: holding `Alt` and adding `Ctrl` is not a tap of `Alt`.
        self.interrupt_all_held_except(key);

        let mut emissions = Vec::new();
        if let Some(entry) = self.hotkeys.get_mut(&key) {
            for registration in entry {
                if registration.mods == held_mask && !registration.pressed {
                    registration.pressed = true;
                    registration.interrupted = false;
                    emissions.push(Emission {
                        id: registration.id,
                        pressed: true,
                        interrupted: false,
                    });
                }
            }
        }
        emissions
    }

    /// A raw key release. The release of a held trigger is always reported,
    /// interrupted or not: a consumer that started something on the press edge
    /// has to be able to end it. The flag is information, not a filter.
    pub fn on_release(&mut self, key: ObservedKey, modifier: Option<Modifiers>) -> Vec<Emission> {
        if modifier.is_none() {
            return Vec::new();
        }
        self.held.retain(|(held, _)| *held != key);

        let mut emissions = Vec::new();
        if let Some(entry) = self.hotkeys.get_mut(&key) {
            for registration in entry {
                if registration.pressed {
                    emissions.push(Emission {
                        id: registration.id,
                        pressed: false,
                        interrupted: registration.interrupted,
                    });
                    registration.pressed = false;
                    registration.interrupted = false;
                }
            }
        }
        emissions
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CTRL: ObservedKey = 1;
    const ALT: ObservedKey = 2;
    const KEY_T: ObservedKey = 3;
    const SHIFT: ObservedKey = 4;

    fn ctrl_alt_observer() -> ModifierOnlyObserver {
        // How `core::shortcut::build_modifier_only` registers `Ctrl+Alt`: each
        // part once as the main key, the rest as its modifiers, so the
        // combination fires whichever modifier is pressed last.
        let mut observer = ModifierOnlyObserver::new();
        assert!(observer.register(10, CTRL, Modifiers::ALT));
        assert!(observer.register(11, ALT, Modifiers::CONTROL));
        observer
    }

    #[test]
    fn a_deliberate_chord_presses_and_releases_uninterrupted() {
        let mut observer = ctrl_alt_observer();

        assert!(observer.on_press(CTRL, Some(Modifiers::CONTROL)).is_empty());
        let pressed = observer.on_press(ALT, Some(Modifiers::ALT));
        assert_eq!(
            pressed,
            vec![Emission {
                id: 11,
                pressed: true,
                interrupted: false
            }]
        );

        let released = observer.on_release(ALT, Some(Modifiers::ALT));
        assert_eq!(
            released,
            vec![Emission {
                id: 11,
                pressed: false,
                interrupted: false
            }]
        );
    }

    #[test]
    fn a_third_key_interrupts_the_chord_and_the_release_says_so() {
        // The shipped abort default on the way to `Ctrl+Alt+T`.
        let mut observer = ctrl_alt_observer();

        observer.on_press(CTRL, Some(Modifiers::CONTROL));
        observer.on_press(ALT, Some(Modifiers::ALT));
        assert!(observer.on_press(KEY_T, None).is_empty());

        let released = observer.on_release(ALT, Some(Modifiers::ALT));
        assert_eq!(
            released,
            vec![Emission {
                id: 11,
                pressed: false,
                interrupted: true
            }]
        );
    }

    #[test]
    fn a_further_modifier_interrupts_a_held_trigger() {
        let mut observer = ModifierOnlyObserver::new();
        assert!(observer.register(20, CTRL, Modifiers::empty()));

        observer.on_press(CTRL, Some(Modifiers::CONTROL));
        observer.on_press(SHIFT, Some(Modifiers::SHIFT));

        let released = observer.on_release(CTRL, Some(Modifiers::CONTROL));
        assert_eq!(
            released,
            vec![Emission {
                id: 20,
                pressed: false,
                interrupted: true
            }]
        );
    }

    #[test]
    fn the_interruption_flag_does_not_leak_into_the_next_gesture() {
        let mut observer = ctrl_alt_observer();

        observer.on_press(CTRL, Some(Modifiers::CONTROL));
        observer.on_press(ALT, Some(Modifiers::ALT));
        observer.on_press(KEY_T, None);
        observer.on_release(ALT, Some(Modifiers::ALT));
        observer.on_release(CTRL, Some(Modifiers::CONTROL));

        observer.on_press(CTRL, Some(Modifiers::CONTROL));
        observer.on_press(ALT, Some(Modifiers::ALT));
        let released = observer.on_release(ALT, Some(Modifiers::ALT));
        assert_eq!(
            released,
            vec![Emission {
                id: 11,
                pressed: false,
                interrupted: false
            }]
        );
    }

    #[test]
    fn auto_repeat_neither_re_presses_nor_spoils() {
        // The Windows low-level hook repeats WM_KEYDOWN while a key is held;
        // x11 suppresses it via DETECTABLE_AUTO_REPEAT. The state machine has to
        // be idempotent either way.
        let mut observer = ctrl_alt_observer();

        observer.on_press(CTRL, Some(Modifiers::CONTROL));
        let first = observer.on_press(ALT, Some(Modifiers::ALT));
        assert_eq!(first.len(), 1);

        assert!(observer.on_press(ALT, Some(Modifiers::ALT)).is_empty());
        assert!(observer.on_press(CTRL, Some(Modifiers::CONTROL)).is_empty());

        let released = observer.on_release(ALT, Some(Modifiers::ALT));
        assert_eq!(
            released,
            vec![Emission {
                id: 11,
                pressed: false,
                interrupted: false
            }]
        );
    }

    #[test]
    fn a_wrong_modifier_set_never_fires() {
        let mut observer = ctrl_alt_observer();

        // `Shift+Alt` is not `Ctrl+Alt`.
        observer.on_press(SHIFT, Some(Modifiers::SHIFT));
        assert!(observer.on_press(ALT, Some(Modifiers::ALT)).is_empty());
        assert!(observer.on_release(ALT, Some(Modifiers::ALT)).is_empty());
    }

    #[test]
    fn a_release_without_a_press_emits_nothing() {
        let mut observer = ctrl_alt_observer();
        assert!(observer.on_release(ALT, Some(Modifiers::ALT)).is_empty());
    }

    #[test]
    fn meta_and_super_are_the_same_key() {
        let mut observer = ModifierOnlyObserver::new();
        assert!(observer.register(30, CTRL, Modifiers::META));

        observer.on_press(SHIFT, Some(Modifiers::SUPER));
        let pressed = observer.on_press(CTRL, Some(Modifiers::CONTROL));
        assert_eq!(pressed.len(), 1, "META registration matches a SUPER hold");
    }

    #[test]
    fn the_same_combination_cannot_be_registered_twice() {
        let mut observer = ModifierOnlyObserver::new();
        assert!(observer.register(40, CTRL, Modifiers::ALT));
        assert!(!observer.register(41, CTRL, Modifiers::ALT));
    }

    #[test]
    fn unregistering_the_last_combination_empties_the_observer() {
        let mut observer = ModifierOnlyObserver::new();
        observer.register(50, CTRL, Modifiers::ALT);
        assert!(!observer.is_empty());
        observer.unregister(CTRL, Modifiers::ALT);
        assert!(observer.is_empty());
    }
}
