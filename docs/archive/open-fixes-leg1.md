# Record — Leg 1: the small open items from the 2026-08-18 owner session

> **Addendum 2026-08-18 — continued in
> [`open-fixes-leg1-part2.md`](open-fixes-leg1-part2.md), which moved two of the
> claims below.** The body of this record is left exactly as it was written; the
> corrections live there and in the living documents, per this directory's rule
> that a record is not retconned.
>
> - **Item 2's leading explanation is refuted.** The one-field instrument this
>   record asked for went in, and the app-start double reveal is the SAME surface
>   twice, 108 ms apart, with one flush — so the settle window is not in play and
>   the second reveal came from a native route. Numbers in
>   [`../known-issues/overlay-ghosting.md`](../known-issues/overlay-ghosting.md).
> - **Item 4's two switches shipped inoperable.** The runtime half was correct;
>   the frontend resolver that both read them and based every write on dropped
>   them, so the controls read `false` forever. Repaired and guarded.
> - Also closed from the *Left for whoever picks this up* section: the `devtools`
>   `cfg` that could never be true — plus a test with no `#[test]` and an
>   attribute counted twice, found beside it.

Closed 2026-08-18. Four items in the kick-off, all four done, plus one the
measurement opened and the owner asked to be decided rather than deferred.

Validated at close: `cargo test` **973 passed, 0 failed**; `npm test -- --run`
**893 passed, 0 failed**; `npm run build` clean. Baseline at open was 969 / 889
— the suite moved by this leg's own cases (4 Rust, 4 frontend) and by nothing
else.

## 1. The click-abort instrument

`GlobalHotKeyEvent` carries `origin` (`Grab` | `RawDevice`), set at all eleven
construction sites in the vendored crate, and the trigger log prints
`origin=grab` / `origin=raw` on every shortcut event. The vendor change is the
field, the enum and one label per site; `src-tauri` names `global-hotkey`
directly so it can spell the enum, resolved through the existing
`[patch.crates-io]` to the same vendored crate rather than a second copy.

## 2. The measurement round

**Question A — the overlay fix works where it was aimed.** 17 flushes, 17
reveals; every `result_actions -> compact` swap inside the result timeout
produced exactly one. One double remains, once, at the first surface change
after app start, with the 60/61 pair 13 ms apart. Recorded with its leading
explanation and the one-field instrument that would settle it, in
[`../known-issues/overlay-ghosting.md`](../known-issues/overlay-ghosting.md).
Not acted on: no ghosting was observed, and that file's rule is that a residual
is measured and written down.

**Question B — the hypothesis was wrong, and the owner's reproduction was
right.** 44 shortcut events, 44 `origin=raw`, 0 `origin=grab`: no release came
from the path the X server can fabricate. The owner then narrowed it themselves
— only right-click, only on a WordScript window, and the menu outlives the
overlay and holds the input until dismissed. WordScript hides its overlay rather
than closing it, so WebKitGTK's context-menu popup survives its surface.

**This is the leg's lesson.** The kick-off's warning — *measure, do not reason* —
paid twice: once by killing a plausible cause outright, and once because the
owner's three-line description of what they were seeing carried the actual
mechanism, which no amount of reading the vendor patch would have produced.

## 3. Why a dictation stopped at the ceiling

Both ceiling paths announce with the same sentence on the authoritative channel;
the reason rides the session to the history record and History states it ahead
of the capture-gap note.

**The obvious surface was blocked and the owner chose the alternative.** The
overlay result pill is 480x60 with `min == max`, and widening it is out of scope
by the product decision in `overlay-ghosting.md`. Asked, the owner chose the
history record rather than lifting that.

## 4. The two delivery switches

Built as proposed, both defaulting to today's behaviour
([ADR 0231](../decisions/0231-each-delivery-mode-gets-one-switch-and-off-is-what-that-mode-always-did.md)).
The three decisions the record demanded were settled by the owner first: per
profile in `work_mode`; the commit writes again after an edit; the restore does
not run when the transcript is kept.

## 5. The context menu (not in the kick-off)

The fix for Question B *is* this item, so it was built here rather than deferred
([ADR 0230](../decisions/0230-the-native-context-menu-is-a-keyboard-grab-so-it-is-gone-from-every-window.md)).
The owner's first instruction was to keep the native menu in text fields and
withdrew it in the same message on their own reasoning: the defect is the menu,
so a menu kept anywhere keeps the defect there.

## Deliberately not done

- **The overlay double reveal.** Recorded, not fixed. Fixing it means either
  widening the settle rule beyond surface identity or logging the surface in the
  reveal payload first — and only the second is a measurement.
- **Moving Delivery and "When a recording stops" into Settings.** The owner
  raised this as an inconsistency and asked for a decision. Verified against the
  code and **declined**: Profiles is already the sole editing surface for both —
  `General.tsx` excludes them by name with a pointer back, `Delivery.tsx` shows a
  read-only badge that links back, `Diagnostics.tsx` reads them. There is no
  duplication to remove. Activation Mode lives in Settings because it is
  machine-wide; these two are profile fields, and that is the line already drawn.
  Moving them would either make Settings edit the active profile behind the
  reader's back or stop them being per-profile.
- **The countdown badge's supposed mode gating.** The owner reported it appears
  only under `clipboard_only`. Verified false: `recordingLimit` in
  `OverlayWindow.tsx` is gated by `isRecording`, the capture budget, and a
  time-remaining threshold, and references no delivery mode. It appears in both
  modes, only near the ceiling.
- **Leg 2.** Untouched, as instructed.

## Left for whoever picks this up

- `#[cfg(feature = "devtools")]` appears twice in `lib.rs` and the feature is
  not declared in `Cargo.toml`, so the `cfg` can never be true. Harmless today —
  `debug_assertions` covers the dev build — but it is a gate that does not gate.
  Two `unexpected cfg condition value` warnings name the lines.
