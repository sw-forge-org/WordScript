# 0108: A machine-wide setting drawn on a surface that stands more than once needs an echo the runtime does not have

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Falls out of
[ADR 0097](0097-speech-gets-a-second-output-stream-on-a-device-the-user-picks.md)
meeting
[ADR 0100](0100-the-window-family-is-a-class-with-user-owned-geometry.md).

## Context

ADR 0097 decided that per-language output routing is **per machine, not per
conversation**: which speaker the room hears and which earpiece you hear are
properties of a desk, *"the same kind of fact as the overlay's display anchor,
so they persist globally and per language."*

**It is drawn inside the translation window.** `Translate.tsx` carries the two
routings as rows on the `Speaking` card -- a `Silent` / `Out loud` segmented
control and a device `Select` per language. And ADR 0064 allows **several
translation pop-outs to stand at once**, each a separate window with its own
webview.

So a machine-wide value is drawn on a surface that may exist three times
simultaneously, in three webviews that share no state. Nothing in either record
says what the second pop-out shows after the first one changes the routing, and
the naive implementation -- read the config into component state on mount -- gives
three windows three different answers to a question with one answer.

**The runtime has no mechanism for this.** `AppConfig::save_to_disk` writes the
file and `save_config` returns the sanitized config to its **caller**. The event
channels that exist are `wordscript-event`, `wordscript-native-event`,
`wordscript-mode-event`, `wordscript-audio` and the local-preview and learning
channels -- **none of them announces that a setting changed**. It has never been
needed: there is one settings window, and `wordscript-settings-target` navigates
within it rather than telling anyone a value moved.

## Decision

**A machine-wide setting may be drawn wherever it is used, and it has exactly
one holder and one broadcast.**

Drawing the routing inside the translation window is right and stays: the place
you decide which voice goes to which ear is the place you are having the
conversation, not a settings page three clicks away. What has to be true is that
the window is a **view onto a machine value**, not an owner of a conversation
value.

Three rules follow, and they apply to every setting of this kind rather than to
routing alone:

1. **The config is the only holder.** No pop-out keeps an authoritative copy;
   component state is a render of the config and never the source. This is the
   same rule the product already applies to session state, one layer out.
2. **A write is announced.** Persisting a machine-wide setting emits a
   config-changed event that every open window listens to and re-reads from. A
   value changed in one pop-out is visible in the others without either of them
   knowing the other exists.
3. **The surface says the scope on itself.** A routing row inside a conversation
   window that silently governs every conversation is the same class of defect
   as a control whose reach the user has to guess. The window states that this
   is the desk's routing, and it says it on the card rather than in a manual.

**The device that is not there is a drawn state, and it does not exist yet.**
`docs/PLATFORMS.md` already requires that a routing pointing at an absent device
**degrades to the default and says so** -- not silently, and not by failing
mid-sentence. The drawn selects have no row that can carry that sentence: each
one lists two fixed devices and repeats its own selected value at the head of
the list, which is `docs/PROVIDERS.md`'s ninth open disagreement and a prototype
artifact rather than an enumeration. **A wired implementation lists each device
once, marks one selected, and has somewhere to say that the remembered one is
gone.** That somewhere is a drawing, so the gallery grows it first (ADR 0057).

## Consequences

- **A config-changed channel is new runtime surface, and it is small and
  general.** It is not a translation feature: the same absence would bite the
  first time any two windows draw one machine value, which ADR 0100's window
  class makes ordinary rather than hypothetical.
- **It must carry what changed, or every window re-reads everything on every
  keystroke.** A settings write per character with a full config re-read in
  three windows is a performance defect designed in. Scoping the event -- or
  debouncing the write -- is part of building it, not a later optimization.
- **The event must not carry secrets.** `save_config` sanitizes through
  `AppConfig::without_secrets()` before every disk write; an event carrying the
  config is a second path out of the runtime and takes the same scrubbing. This
  is exactly the kind of parallel path a secret leaks through.
- **`Silent` needs no special case here.** ADR 0097 makes it a routing value
  that opens no stream, so it is a value like any other and echoes like one.
- **This record does not decide where else the routing appears.** Whether
  `Settings -> General` or a sound page also draws it is a drawing question and
  belongs with whoever builds the surface; what is decided is that a second
  place drawing it would be a second view, never a second copy.
- **It does not reopen who owns geometry** (ADR 0100). A pop-out's size and
  position are the user's and per window; the routing is the desk's and shared.
  Two kinds of persistence live in the same window and must not be conflated --
  **the thing you dragged is yours, the thing you routed is the machine's.**
