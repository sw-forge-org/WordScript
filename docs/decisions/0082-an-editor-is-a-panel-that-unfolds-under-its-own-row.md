# 0082: An editor is a panel that unfolds under its own row

Date: 2026-08-11
Status: Accepted

## Context

Five controls on `Profiles` have been drawn, disabled and carrying a reason
since Leg 4c, and every reason was the same sentence: *"No editor is drawn for
this yet."*

| Control | What it could not do |
| --- | --- |
| Add / Edit on Replacements | `dictionary_entries` is read and Delete writes it back; nothing could write a new pair |
| Add / Edit on Snippets | the same, for `snippet_entries` |
| New profile | `createTextProfile` produces a profile called "New profile" and nothing could rename it |
| More | opens a menu the drawing does not have |
| Check against a sample · Show the effective bias | `analyze_text_rules` is a real command whose ANSWER had nowhere to go |

These are a design gap rather than a runtime one, and they are the first the
port has had to CLOSE by designing rather than by carrying something across:
**the prototype draws no editor anywhere**, so there is nothing to be measured
against and `npm run port:diff` has no opinion here — the same position ADR 0069
was in when it replaced Help's modal.

**The pre-port product did have one, and it is the provenance this record is
decided against.** `src/components/settings/PromptsTab.tsx` — 1720 lines,
deleted by Leg 3's shell overwrite in `8f9077e` — drew every rule as a
permanently-open card with two fields, reorder controls, a remove button, and
the analysis issues attached to the rule that caused them. Reading it first is
what produced two of the decisions below; recommending a shape without reading
it would have been the failure Leg 6 paid for one level up, at the plan.

Three shapes were available.

1. **A dialog.** Rejected. Settings is ALREADY a modal sheet over the workspace
   (ADR 0003, `.ws-modal-win`), so this is a second scrim over the first. It is
   the weight ADR 0069 took off Help eight days ago, for the reason it gave
   then: a scrim says the surface behind it is a detour you come back from, and
   renaming a snippet is not a detour.
2. **The menu popover.** Rejected. `.ws-menu` is 230 px of glyph-label-hint rows
   for choosing among named destinations. It has no field, no validation and no
   commit, and stretching it into a form would leave the library with two things
   called a popover that behave differently.
3. **A panel that unfolds under the row.** `.ws-list-raw` already is one: it
   opens under a list row, sits on the inset plane, and the row above it drops
   its rule so the pair reads as one block. Its own docstring says it is *"not a
   second row and not a dialog: it is the same record, unfolded."* An editor
   wants that sentence with fields in it.

## Decision

**An editor, and an answer, open as a panel under the thing they act on.**

- **`EditorPanel` is the third option**, on the `.ws-list-raw` plane as
  `.ws-list-edit`: same ground, same radius, same margin, same dropped rule
  above. Nothing is dimmed, nothing recedes, and the list stays where it was.
- **`AnswerPanel` is the same panel with N labelled columns**, for a readout
  rather than a commit. `analyze_text_rules` answers under the card that asked —
  the sample check under *Where each list lands*, the effective bias under the
  row that names it — rather than on a screen of its own that would have to
  restate which profile and which list it was computed from.
- **The panel holds the draft, and nothing else does.** Cancel has to be able to
  throw the edit away, which a caller writing each keystroke into the config
  cannot do, and `patchText`'s debounce would have committed half of it anyway.
  So a rule commits through `patch` — one finished value — which is the discrete
  side of plan P1 even though it was typed into a text field. The same
  distinction the Words tab already draws for adding one term.
- **Exactly one editor is open at a time.** Two would make Escape ambiguous and
  would let two drafts exist for one Cancel to be right about.
- **Keyboard, because this is used twenty times in a row.** The first field
  takes focus on open; Enter commits from a single-line field; Escape reverts
  and closes. A textarea keeps Enter for its own newline and commits on
  Ctrl/Cmd+Enter, because a snippet body is the one value here that legitimately
  contains line breaks. A one-field panel selects its whole value, because a
  rename replaces the name; a multi-field panel puts the caret at the end,
  because select-all there would destroy the half you opened the panel to keep.
- **Escape stops at the panel.** `Sheet` listens on `window` and React's
  listener sits on the root container, which is below it in the bubble path, so
  `stopPropagation` in the panel's own handler is what keeps Escape from closing
  the whole settings sheet out from under an open editor. That is the stack
  `Sheet`'s `closeOnEscape` docstring describes, obtained without giving it a
  second flag.
- **Save is disabled while a required field is empty, and names the field**
  (ADR 0065). `apply_dictionary_entries` and `apply_snippet_entries` both skip an
  entry whose halves are blank after trimming, so saving one writes a rule that
  is drawn in the list and never runs — the silent kind of wrong this whole
  surface exists against. A snippet's NAME may be blank: the runtime falls back
  to the trigger and the row already draws that fallback.
- **An analysis issue is drawn under the rule that caused it**, routed by
  `rule_ids`. This is the pre-port behaviour restored rather than a new idea: a
  list of issues at the top of a screen tells the reader something is wrong and
  leaves them to find it.

**The rule lists are ordered, and the surface says so.** `apply_dictionary_entries`
and `apply_snippet_entries` each fold one entry's output into the next, so the
order is a value — and it was one the ported list could neither show nor set,
while the pre-port surface drew reorder controls and stated the rule in copy.
Both lists get `Reorder` (up/down per row, disabled at the ends) and both cards
state the order in their description and in the panel's note. **This is the one
place this record changes a drawn screen rather than filling a gap in it**, and
it is under the exception the Leg 7 brief names: the drawing and the runtime
disagreed on a FACT, and the drawing was the one that was wrong.

**ONE JOB, ONE SHAPE, ON BOTH PANE SCREENS.** The owner reviewed the first
build in the running app and named the real fault, which was not any single
control but the count of them: *"unordentlich, insofern nicht einheitlich"*. It
was. Adding had three shapes — a labelled button at the foot of the profile
list, another at the foot of each rule card, and Context's `+` in a section
head. Acting on a row had two — a menu on the profile rows, a run of four icons
on the rule rows — and none at all on Context. Deleting had two weights: a
profile asked twice, while a rule inside it went on one click with no question.

So, everywhere:

- **Adding is `+` in the HEAD of the list it adds to.** Context's shape wins,
  and it is right for a stated reason: it sits with the count it changes, at the
  top where the reader already looks, and it stays put while the list grows past
  the fold. `AddButton` is one component; `PaneListHead` and `Card` both take
  it. The two labelled foot buttons are gone.
- **A row's actions are a right-click**, answering with the same compact menu on
  every list — profile rows, rule rows, and Context's folders and objects. A
  right-click also SELECTS the row it targets, because a menu acting on
  something other than what the detail shows is how you rename the wrong
  profile.
- **What stays an icon on a row is only what you repeat positionally** — the
  reorder pair. Reaching a move through a menu would mean opening the menu once
  per step. Edit and Delete left the rule rows for the menu.
- **Deleting always asks, at the row.** A rule is now exactly as guarded as the
  profile that holds it.

**`More` in the pane head stays, and the redundancy is deliberate.** A
right-click is fast and invisible; a `⋯` is how a reader finds out the actions
exist. One discoverable way and one quick way is the pair every desktop file
list has, and the owner chose it explicitly over dropping the button.

**A swipe was considered and rejected.** The owner raised dragging a row
sideways to reveal its actions. It is a touch idiom: on the desktop the gesture
is a click-drag that collides with text and row selection, it has no affordance
so it must be known rather than seen, and it would be a second hidden path to
the actions the right-click already gives — the exact redundancy this round
exists to remove. The half of it that is right is the two-step at the row, which
is what `ConfirmPanel` does.

**The menu is placed at viewport coordinates, and that is a defect fix rather
than a preference.** `.ws-menu` was absolutely positioned against an anchor, and
the pane head hides its overflow: the first build shipped a menu with its second
entry cut off, found by the owner in the running host and by no test. A panel
opened from a ROW has the same problem in every list that scrolls. So `Menu`
takes `at={{x, y}}`, renders `fixed`, and clamps itself into the viewport after
measuring — a menu near the bottom edge flips above its pointer.

Two earlier attempts are recorded because both were measured against
`port:diff`: a `.ws-menu-anchor` wrapper cost a DOM node and took `profiles`
from **structural 5 to structural 14**, and making the head's existing action run
the positioned box cost no node but moved **`context`** — a screen this leg may
not touch — by one style property. `fixed` needs no positioned ancestor and
costs neither. `.ws-nav-anchor` is `.ws-menu-anchor` now, since the
positioned-ancestor contract belongs to the menu rather than to the sidebar.

**DELETE IS IN THE MENU AND THE MENU DOES NOT DELETE.** Its neighbours are
Rename and Duplicate, so one stray click would otherwise take a profile and
every list in it. The entry opens `ConfirmPanel` — the same unfolding plane —
which names the profile, states what goes with it (*"3 replacements, 2 snippets
and 8 words go with it"*), and puts the act on a second control. The panel
focuses **Cancel** on open, never the danger button: a panel that opens with the
destructive control focused turns a stray Return into the deletion it exists to
prevent. Nothing is centred, so the row and the lists stay visible behind the
question — which is the evidence the reader needs to check they are deleting what
they think they are, and exactly what a modal would cover.

Two runtime answers the deletion needed, both settled here rather than deferred:
**the last profile cannot be deleted** (something has to be active, and a config
with an empty list is a state no screen can repair — the entry is disabled with
that reason in its hint, ADR 0065), and **deleting the ACTIVE profile hands the
session to the first one left** rather than leaving `active_text_profile_id`
pointing at nothing. A running capture is unaffected: it keeps what it started
with (ADR 0025).

## Consequences

- **Five reasons and one banner come off in the commit that makes them false**
  (rule 7, both directions). Profiles' banner is not deleted: it now names the
  one thing that is still inert — the health flag's click, whose four kinds
  point at three different tabs — so the screen stays `PartlyWiredScreenProps`
  and keeps its gallery entry (ADR 0057). Routing that click is a decision and
  is the last thing between this screen and `WiredScreenProps`.
- **Nothing here is measured by `npm run port:diff`.** The prototype draws no
  editor, so this is judged by eye against `DESIGN_SYSTEM.md` and in the native
  host — the position ADR 0069 recorded. Every panel is drawn only after a
  click, and the measurement never clicks.
- **Every panel and every menu is drawn only after a click, and the measurement
  never clicks — so all of that costs nothing.** `context` is still
  **structural 0 | style 0** with its rail's new gesture on it, which is the
  proof: a right-click that renders nothing until it happens is free.
- **What DOES move is the create control, and it moves `profiles` alone.**
  Baseline 172 vs 176 | structural 5 | style 16; now **172 vs 175 | structural
  14 | style 18**. Exactly two of those differences are this record's and both
  follow from the same edit — the list-foot button leaving and the `+` arriving
  in the head:
  - `.pane-list-head > b` is 24 px narrower, which is the `+` taking its width
    out of the title's `flex: 1`.
  - `.pane-scroll` is 45 px taller, which is the foot the list no longer has.

  The structural count rises from 5 to 14 for the mechanical reason a removed
  element always does: `port:diff` walks by path, so dropping `.pane-list-foot`
  shifts every sibling index after it. Everything else in the report is
  ADR 0068's existing departure — the sixth sub-tab and the fifth legend row —
  unchanged.
- **The two rejected menu anchors were reverted because they moved screens this
  leg had no business moving**, and both were measured before being dropped: a
  wrapper element took `profiles` to structural 14 on its own, and a positioned
  action run moved `context` by one style property.
- **The gallery grows it first.** `EditorPanel`, `AnswerPanel` and `Reorder` are
  library components displayed in Gallery → Components, in the states a screen
  cannot show at once. Nothing was built in the gallery (ADR 0057).
- **A duplicate re-ids its rules as well as itself.** `rule_label` puts a rule's
  id in the runtime's applied-rules line, so two profiles sharing one make that
  line ambiguous about which profile's rule fired.
- **Context's rail gets the row gesture, drawn, and that is a deliberate lifting
  of a standing instruction.** The Leg 7 brief says Context is not to be touched
  in any direction, on the owner's word of 2026-08-10. The owner lifted it for
  this specific change on 2026-08-11, in order that the two pane screens not
  grow two manners: **both tabs, Profiles and Context, have to behave the same
  way.** **Nothing there acts** — the context object does not exist in
  the runtime and the view's banner still says so; what is settled is the shape,
  so whoever wires Context inherits a rail that already behaves like the rest of
  the product. The rest of the instruction stands: no runtime, no new surface,
  and none of the six undecided ones is mounted.
- **`RowMenu` is in the library, not in either screen.** Two screens needing the
  same dismissal logic is how two copies drift apart, which is the thing this
  round was told to police. What a screen still owns is which verbs its rows
  carry.
