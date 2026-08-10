# 0072 -- The target language is set in the profile, and only stated on AI Models

Date: 2026-08-10
Status: Accepted

Corrects the placement half of
[ADR 0071](0071-translate-ships-ahead-of-its-phase-on-the-lane-the-product-already-runs.md),
which followed the drawing where a later record had already ruled the other way.
Everything else 0071 decided stands.

## Context

ADR 0071 shipped `ProcessingMode::Translate` and put its four settings where the
prototype draws them: all four inside the Translate job row on AI Models, two of
them marked `Per profile` and written into the active profile.

That was wrong in a way the repo had already worked out.
[ADR 0068](0068-the-communication-style-is-a-tab-in-the-profile-and-the-legend-states-its-scope.md)
faced the identical question two days earlier for the communication style, and
its rejected alternative is stated in one line: *beside the Rewrite job on AI
Models, which is machine-scope for a profile-scope value (ADR 0024).* The style
went into the profile instead.

The owner asked how the mode is actually used, and the answer was three screens
for one decision: pick Translate on Profiles, set the language on AI Models,
optionally bind a key on Hotkeys. Three screens is not a concept, it is an
assembly, and the drawing is not to blame for it -- the prototype draws four
rows that were all inert, so nothing in it had to answer where a person goes to
change the language they are writing in.

## Decision

**`Into` and `Keep this profile's words` are edited on `Profiles -> Defaults`,
directly under the processing-mode select.** They are the profile's values and
they belong beside the control that makes them apply. On that surface, choosing
Translate and choosing English are one decision made in one place.

**They are HIDDEN when the mode is something else, not disabled.** This is the
one place ADR 0065's rule does not apply. A disabled control states *this cannot
act right now*, which is a claim about readiness; a target language under
Cleanup is not un-ready, it is irrelevant. Disabling it would answer a question
the reader is not asking, and would put two permanently greyed rows on the first
tab of the screen most often opened.

**AI Models keeps both rows, drawn exactly as before, and states them.** Under a
runtime they show what the active profile holds and take no edit; the `Per
profile` tag beside each is the door to where they are set. That is what a scope
tag is for, and it is the same shape the rest of that screen already uses for a
value it does not own. Nothing is deleted, moved or reworded, so ADR 0065's
first rule holds and `npm run port:diff -- models` stays at structural 0 |
style 0.

**The two settings with no scope tag stay on AI Models and stay live.** `When you
already dictated in that language` and `Address form` are the machine's, in the
same shape `enhance_sub_mode` and `enhance_target` already have. The drawing
gives them no tag and they need none.

## Consequences

- **`port:diff -- profiles` does not move.** The two rows render only when the
  profile's mode is Translate, and the gallery's drawn mode is `auto`, so the
  measured state is the one it always was. The screen's recorded departure stays
  ADR 0068's sixth tab and nothing is added to it. Switching the gallery's own
  mode select to Translate reaches both rows, which is how the drawn half stays
  reachable without a runtime.
- **A per-profile value is never edited on a machine-scope surface**, which is
  now true of every value rather than of the communication style alone. The next
  reader who finds a `Per profile` tag on AI Models can rely on it meaning
  "stated here, set there".
- The prototype draws these two as editable on AI Models and the product does
  not. That is a departure from the drawing on a screen that is still measured
  against it -- and it costs nothing, because the departure is in behaviour
  rather than in structure. A row that is disabled measures identically to one
  that is not.
- **The mode is now reachable in one place.** Profiles -> Defaults carries the
  mode, the language and the profile-words switch; a hotkey remains optional and
  ships unbound (ADR 0041).
