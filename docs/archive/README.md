# Archive

**Frozen. Read for derivation, never as current truth.** Nothing here is a
product contract, and a claim in here that disagrees with
[`../spec/SPEC.md`](../spec/SPEC.md) or [`../STATUS.md`](../STATUS.md) is a
claim that was true once.

Live work is in [`../tracks/`](../tracks/README.md); the board is
[`../IMPLEMENTATION.md`](../IMPLEMENTATION.md).

**Paths inside these documents were rewritten on 2026-08-12** when the
documentation was restructured, so links still resolve. The prose was not
touched — where a page says "read `SETTINGS_REWORK_PLAN.md` §0", the link now
points at `plans/settings-rework.md` and the sentence is the one its author
wrote. The one exception is [`../prototypes/`](../prototypes/), which is
read-only under ADR 0055 and still cites the paths that existed when it froze.

## The GUI port relay's history

The relay itself is still live at
[`../tracks/gui-port-relay.md`](../tracks/gui-port-relay.md) and keeps its rules,
its leg-log index and the four most recent leg records. Everything older is
here, in three files that split by *kind of document* rather than by leg:

- [`gui-port-relay-leg-records.md`](gui-port-relay-leg-records.md) — what Legs 1
  through 8 **did**, in the order they ran. Each record is the account its leg
  wrote when it closed.
- [`gui-port-relay-prompts.md`](gui-port-relay-prompts.md) — the **brief** each
  leg ran against, written into the relay by the leg before it. Leg 2's is
  first: it was never a prompt, it stood in the relay as a full specification
  with a reading list.
- [`gui-port-relay-kickoffs.md`](gui-port-relay-kickoffs.md) — the eight spent
  **kick-off pages** (Legs 4d, 5, 6, 7, 8, 10, 11, 12). Each carries the
  instrument notes and standing warnings its leg accumulated, several of which
  are written down nowhere else. Legs 1–4c and Leg 9 had no kick-off page.

- [`speech-track-b14-kickoff.md`](speech-track-b14-kickoff.md) — the spent
  **kick-off page** for the speech track's B14, which closed 2026-08-17 as
  ADR 0208. Kept for the shape of the ask rather than for the answer: it names
  the two candidate connection shapes and hands the choice to the owner, and the
  recommendation the session brought back was the one the owner corrected.

- [`speech-track-b15-kickoff.md`](speech-track-b15-kickoff.md) — the spent
  **kick-off page** for B15, which closed the same day it was written
  (ADR 0211, ADR 0212). Kept for two things nothing else carries: the finding it
  told the next session not to re-derive — *`Account` names a credential and the
  reader hears a bundle* — and **a premise of its own that was false**. It says
  the account deletion is undoable by ADR 0195's notice; that hook belongs to the
  transcript rows, so there was no window to wait for and B14b became an ask
  instead (ADR 0210). A brief can be wrong about the tree it describes, and this
  is the example.
- [`speech-track-b17-kickoff.md`](speech-track-b17-kickoff.md) — the spent
  **kick-off page** for B17, B18 and B20, all three closed 2026-08-18 (ADR 0220,
  ADR 0219, ADR 0218). **Kept for its own closing section**, which lists five
  claims it made about the code that the file did not support: it contradicts
  itself about whether two controls are live, it merges two disjoint sets of
  settings into one count of four, it counts seven controls and two badges in a
  row that has five and none, it names the wrong button for the vendor fault, and
  it traces the readability complaint to breakpoints that in fact fire — the
  settings sheet's column is 379 px at the width in question, not the 569 px the
  brief inherited from the workspace column. **Four of the five are one habit**:
  a claim written from an adjacent fact rather than from the file. The report it
  filed as *unreproduced* was reproducible on every machine and became B23
  (ADR 0217). B15's brief is the example of a brief wrong about the tree; this is
  the example of a brief wrong about its own arithmetic.
- [`insert-delivery-kickoff.md`](insert-delivery-kickoff.md) — the spent
  **kick-off page** for the insert-delivery track's Leg 2, whose four steps all
  ran on 2026-08-18 and closed the track (ADR 0228 confirmed rather than revised,
  ADR 0234). **Kept for two standing warnings and one trap.** The warnings: *a
  probe that answers "no" is not a fact about the machine* — this leg lost hours
  to two silent ones, a compositor check searching for `"plasma"` in variables
  that read `KDE` and an interface check grepping a list of bus names for an
  interface name; and *a complete measurement is not a complete model*, which is
  ADR 0227's decision 2 being withdrawn within hours (→ ADR 0229) because a
  complete enumeration of the session's X windows supported a conclusion the
  owner's experience contradicted. The trap is in its own step 3: a KDE editor is
  single-instance, so `QT_QPA_PLATFORM=xcb kate <file>` hands the file to the
  running Wayland instance and the variable never applies — four dictations were
  measured against a window that was not an XWayland window at all before anyone
  noticed.

## Closed tracks and spent plans

### Insert delivery, closed 2026-08-18

Opened and closed the same day, out of one owner report that insert at cursor
does nothing on this machine. **Its finding is the reason the track existed**:
the last step of a dictation was the only one with no way to tell whether it
worked. XTEST exits 0 whether or not a keystroke was delivered, so nine
consecutive runs recorded `pasted: true` while inserting nothing.

- [`insert-delivery.md`](insert-delivery.md) — the sequence and the record. Steps
  1-7 done, 8 (`ConnectToEIS`/libei) deliberately deferred with its reason. Carries
  the driver landscape and why most of it is closed (`wtype`/`ydotool` rejected on
  prompt grounds by the owner, `kdotool` cannot inject, AT-SPI is off on this
  desktop), both review passes, and every measurement the ADRs rest on. **The two
  findings that travel are not the driver**: a Plasma 6 desktop was classified
  `Other` because the detector searched for `"plasma"` in variables that read
  `KDE`, and the portal interface probe grepped a list of bus *names* for an
  *interface* name — 6539 runtime-log lines carried not one portal line, because
  the early return that closed the path said nothing. Both are the same shape, *a
  probe answering "no" for a reason unrelated to the question*.
- [`open-fixes-leg1.md`](open-fixes-leg1.md) — **Leg 1's record**. Four items and
  one the measurement opened. Its finding travels: the click that ended a
  dictation was not a synthetic key release but WebKitGTK's context menu holding
  the keyboard over a hidden overlay, so the native menu is gone from every
  window (ADR 0230). Also carries what was deliberately not done, including two
  owner requests declined against the code.
- [`open-fixes-leg1-part2.md`](open-fixes-leg1-part2.md) — **Leg 1 part 2's
  record**. Its lesson is the shape of the items rather than any one of them: six
  were *a thing written to hold a fact that could not hold it* — a `cfg` gate on
  an undeclared feature, a test with no `#[test]`, an attribute counted twice, a
  command whose only field has no reader, a resolver that dropped the fields it
  was read for, and an event loop that spun silently on a dead X connection.
  **Two findings travel**: the ADR 0231 delivery switches shipped inoperable
  while their tests stayed green, because the tests asserted on the write and the
  defect was on the read; and the overlay's one-field reveal instrument refuted
  the hypothesis Leg 1 wrote it for on the first app start.
- [`insert-delivery-kickoff.md`](insert-delivery-kickoff.md) — Leg 2's spent
  brief, described in the kick-off list above.

**Two items this track left open belong to their own records rather than here**:
the two owner reproductions in
[`../known-issues/capture-shortcut-recording.md`](../known-issues/capture-shortcut-recording.md)
(a hold that turns into a toggle, a dictation carried past three minutes), and
the overlay double reveal in
[`../known-issues/overlay-ghosting.md`](../known-issues/overlay-ghosting.md).
Both have their instruments in place and neither is guessed at.

### Spent plans and earlier passes

- [`plans/settings-rework.md`](plans/settings-rework.md) — the settings surface
  rework plan. **Spent as an instruction, kept as derivation:** §2 through §11
  are why the surface is shaped the way it is, which nothing else carries. The
  delivery model changed on 2026-08-04 (ADR 0054, 0055) and the relay took over.
- [`plans/ui-ux-overhaul.md`](plans/ui-ux-overhaul.md) — the implemented UI
  direction and its enduring rationale. Current rules live in
  [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).
- [`plans/gui-rework-third-pass.md`](plans/gui-rework-third-pass.md) —
  superseded by the relay, whose work is done.
- [`core-hardening-pass-2.md`](core-hardening-pass-2.md) — the second hardening
  pass's kick-off. The live third pass is
  [`../tracks/core-hardening.md`](../tracks/core-hardening.md).

## Closed hand-off records

Completed implementation specifications, kept as references for their failure
class rather than as active contracts.

- [`handoffs/shortcut-lane-rebuild.md`](handoffs/shortcut-lane-rebuild.md) —
  merged 2026-07-25. The shortcut contract rebuild (S0–S8), the invariants it
  established, and the decisions behind them.
- [`handoffs/overlay-phase-1.md`](handoffs/overlay-phase-1.md) — `OverlayPill`
  is render-only and owns no session semantics.
- [`handoffs/overlay-linux-black-block.md`](handoffs/overlay-linux-black-block.md)
  — 2026-06-20. Black blocks, dead input and always-on-top under KWin. Still
  cited from `src/styles/overlay-pill.css` and `src-tauri/src/main.rs`.
- [`handoffs/overlay-mode-cycling-accepted.md`](handoffs/overlay-mode-cycling-accepted.md)
  — the accepted operational state, with permanent development-only
  diagnostics.
- [`handoffs/overlay-mode-cycling-residual.md`](handoffs/overlay-mode-cycling-residual.md)
  — the predecessor investigation that reduced the residual artifacts.
- [`handoffs/overlay-mode-switch-ghosting.md`](handoffs/overlay-mode-switch-ghosting.md)
  — the 2026-07-19 first look, superseded by the two above.
- [`handoffs/settings-scroll-performance.md`](handoffs/settings-scroll-performance.md)
  — 2026-06-21. Why WebKitGTK scrolling was janky and what was removed.
- [`handoffs/hotkey-cross-platform.md`](handoffs/hotkey-cross-platform.md) —
  historical cross-platform hotkey work, superseded by current per-mode hotkey
  behavior.
- [`handoffs/linux-portal-control-input.md`](handoffs/linux-portal-control-input.md)
  — the repeated portal "Control input devices" prompt and its diagnosis.
- [`handoffs/doc-realignment.md`](handoffs/doc-realignment.md) — 2026-07-24.
  Established the current documentation set and American English throughout.
  Its own file list is superseded by [`../README.md`](../README.md).

## Convention

- **Move a document here when its work closes**, not when it gets long.
- **Record supersession at the top of the affected document**, not in the
  changelog.
- **Nothing is deleted from here.** A record whose conclusion turned out wrong
  is still the record of what was believed, and the correction is an ADR.
