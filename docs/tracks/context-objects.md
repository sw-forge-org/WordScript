# The context object track

Opened 2026-08-14. **Open, nothing built.** Both the orientation page and the
sequence — start a session here.

Owns **ADR 0135–0149**. 0135 and 0136 are its founding records and were written
before it existed — they came out of the speech track's donor reading and are
about this track's subject, so they are filed here rather than there. Grep the
tree before claiming a number: one is cited in source before its file lands, and
five tracks share `main`.

## Why this track exists, and why it is not called "meetings"

[ADR 0045](../decisions/0045-everything-recorded-is-one-object.md) declared one
object with five states and five origins on 2026-08-03. **Nothing builds it.**
What exists is a drawing, ported into `src/screens/Context.tsx` behind a banner
that says *Planned for V2*, over `contextData.ts` — a fixture. Every route into
that object is either a candidate in [`../ROADMAP.md`](../ROADMAP.md) or a step
in somebody else's sequence, and the object itself is in neither.

**The meeting is one origin of five, and it is the one behind a capability
gate.** Naming this track after it would file four unblocked origins — a
dictation, an upload, a link, a calendar entry — behind the blocked one, and the
roadmap already makes that mistake readable: *Meeting capture* names system
audio, echo cancellation and a window, and the note it produces is assumed.

So the unit of work is the **object**: what it is on disk, what its four tabs
read, how something enters it, and what happens to what it holds.

## What this track does not own

| Not this | Whose |
|---|---|
| Provider lanes, credentials, the model catalogue, streaming | [`speech-track-plan.md`](speech-track-plan.md) |
| Carrying a drawn screen into the product, the gallery, the shell library | [`gui-port-relay.md`](gui-port-relay.md) |
| Who ends a session and where the commit lives | [`runtime-ownership.md`](runtime-ownership.md) |
| Shortcut defaults per activation mode | [`activation-gestures.md`](activation-gestures.md) |
| Fluent-and-wrong output on the cleanup lane | [`core-hardening.md`](core-hardening.md) |

**The seam with the speech track is the sharpest and is worth stating once.**
That track answers *where does a job run and what can it do*; this one answers
*what is the thing the job produced*. Its C1 (a turn is a recording), C4 (what a
two-hour recording costs) and B7 (the picker at the point of use) are
**required** here and are not duplicated here.

## Where the contract lives

Read the owning document before changing an area. This table is routing, not
content.

| Read | For |
|---|---|
| [`../spec/SPEC.md`](../spec/SPEC.md) | the authoritative contract; if this page disagrees with it, this page is wrong |
| [`../decisions/0045-…`](../decisions/0045-everything-recorded-is-one-object.md) | one object, five states, five origins — the whole premise |
| [`../decisions/0047-…`](../decisions/0047-a-speakers-name-is-never-in-the-audio.md) | three stages of a speaker's name, and why a chip states its provenance |
| [`../decisions/0063-…`](../decisions/0063-a-meeting-has-four-ways-in-one-of-them-watches-the-microphone-and-only-a-press-ends-it.md) | four ways into a capture; only a press ends one |
| [`../decisions/0064-…`](../decisions/0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md) | consent as a field; opt-in leaves nothing behind; the next-utterance rule |
| [`../decisions/0135-…`](../decisions/0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md) | retention as a holder set, the copilot per turn, the picker's form |
| [`../decisions/0136-…`](../decisions/0136-what-is-taken-from-the-donor-and-the-one-thing-it-does-that-must-not-be.md) | the four mechanisms adopted, the three owed additions, the platform refusal |
| [`../ROADMAP.md`](../ROADMAP.md) | *Meeting capture* — gate 3 is the only one left, and it blocks Stage E alone |
| [`../PLATFORMS.md`](../PLATFORMS.md) | *Meeting surfaces* — the five capabilities per OS and the rule that none of them ships as universal when it is not |
| [`../PROVIDERS.md`](../PROVIDERS.md) | what a lane serves; Stage B's summary and Stage E's transcription both spend one |
| [`../donors/README.md`](../donors/README.md) | the mechanism index. **Read it before opening a donor tree** |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | the UI/runtime seam this track must not blur |

## The stages

Five stages. **A through D are unblocked**; E waits on one roadmap gate and
nothing else.

### Stage A — the object exists on disk

- **A1. A note is a Markdown file, and the folder is the truth.** The rail's
  folders are directories under a root; `Notes & Meetings → Where notes live`
  already draws the root, the file-name pattern and *what happens if a file
  changes outside WordScript*. **Requires** nothing. **Done when** a note
  created in the product is a file a text editor opens, and a file dropped into
  the folder is a note.
- **A2. The five states are the runtime's, not the fixture's.** `scheduled`,
  `recording`, `transcribing`, `ready`, `failed` — on the row, in one list
  ordered by time. **Done when** the rail shows a real state and no second
  queue exists.
- **A3. `origin` is a field, not a type.** Five values. **Done when** the
  object's own header line reads the same three answers on all five.
- **A4. The notes root becomes an optional per-profile override** (ADR 0136).
  Empty means the machine-wide root. **Watch:** `_actions/` lives beside the
  notes, so a per-profile root makes actions per profile too — that is the
  consequence to surface, not to hide.

### Stage B — the four tabs read something real

- **B1. Transcript**, with the `who-chips` carrying status and source. A name
  the user set is locked against the re-clustering pass (ADR 0047, ADR 0131).
- **B2. Notes** — what you wrote, which the summary reads and never overwrites.
- **B3. Summary**, produced by an Action. Actions are already Markdown files in
  `_actions/`; what is owed is **the picker beside `Summary` and `Reset to
  default` for the two built-ins** (ADR 0136). **Requires** a chat lane
  (speech track) and the context-window ceiling (speech track C4).
- **B4. Linked** — People, Before this, Came out of it, From the calendar,
  computed on this machine from shared people, shared topics and the calendar
  series. **Nothing on this tab may be fetched.**
- **B5. Selective export at the object** (ADR 0136): memo, summary and
  transcript in any combination. The full archive under `Privacy` already
  exists and is a different control.

### Stage C — the three ways in

- **C1. Write** — an empty object; the words arrive as words.
- **C2. Import** — a file or a link. **This is where speech-track B7's picker
  lands first**, in its degenerate form: one request, so the resolved sentence
  stands alone with no next turn (ADR 0129, ADR 0135).
- **C3. Record** — gated. It is ADR 0063's fourth way in and it starts Stage E.

### Stage D — what happens to what it holds

- **D1. The retention holder set** (ADR 0135): the session ended, a transcript
  with content exists, and neither the notes pass, the re-clustering pass nor a
  running re-transcribe still holds the recording.
- **D2. A second namespace and a second sweep budget** under
  [ADR 0039](../decisions/0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md),
  whose two guards carry over unchanged: `0600`, and the sweep deletes only what
  it created.
- **D3. `Never` means never written**, so it needs a lane that streams and is
  otherwise inert with a reason — the **fourth `InertReason` kind**, shared with
  speech-track C4's `Live transcript` toggle. Whichever lands first builds it.
- **D4. Deleting the audio is its own action and does not delete the note**
  (ADR 0136).

### Stage E — the meeting, behind roadmap gate 3

Gate 3 is *does system-audio capture work without a per-session authorization
prompt on the target platforms*. It blocks this stage and nothing above it.

- **E1. System audio**, per platform. The real cost.
- **E2. Echo cancellation** — shape recorded in ADR 0136. **The cancelled
  microphone is a second view, never a replacement.**
- **E3. The HUD**, its own window, with `Resume listening` (ADR 0136) so a call
  that continues after a break stays one object.
- **E4. Diarization** — three stages, of which only the first two are audio.
- **E5. The copilot** — one index lookup per finished turn, a model only on a
  hit, off by default for ADR 0047's reason. **Two consumers, and the embedding
  one has no axis in any track today.**
- **E6. The recording disclosure**, posted into the call, optional, and making
  no claim about consent (ADR 0136). ADR 0064's field is the other half.

**Content protection, the floating bar and auto-stop are per platform and are
not optional on two of three.** `../PLATFORMS.md` carries the rule.

## Status

| Stage | State |
|---|---|
| A | **not started** |
| B | **not started** — B3 requires speech-track C4 |
| C | **not started** — C2 requires speech-track B7; C3 is gated |
| D | **not started** — D3 shares its mechanism with speech-track C4 |
| E | **blocked** on roadmap gate 3 |

## What has already landed against this track's subject

**2026-08-14, and it is GUI-port work rather than this track's.** Four
`Open decision` badges came off `src/screens/{NoteSettings,Privacy,Meeting}.tsx`
because ADR 0135 answered them, and `Context.tsx`'s three drawn states were
wired to reach each other — `Ask`, `Actions`, the rail's `+` and the intake's
`Back to reading` were drawn and inert, which is ADR 0020's defect four times on
one screen. `screens.test.tsx` gained three cases and one was rewritten to
assert the opposite of what it used to.

**It has no leg behind it**, the way `b330815` has none, and whoever closes GUI
port Leg 13 either adopts it or files it as its own leg. It is recorded here so
it is not rediscovered as this track's work.

**And then the three windows became windows** ([ADR 0137](../decisions/0137-ask-actions-and-the-meeting-hud-are-os-windows-and-a-drawn-box-was-never-going-to-answer-that.md)),
on the owner's instruction the same day. Ask, Actions and the meeting HUD open
as **OS windows** with `decorations: true` at their drawn sizes, created at
runtime by `src/windows/popout.ts` on the `#/popout/<surface>` route; the
stand-in decoration strip is dropped in a real window, because ADR 0003 gives
the frame to the compositor and drawing both would be two title bars. Without a
native host the button draws the in-page box instead, which is what the gallery
needs and what `usePopout` makes draggable. **`Record meeting` raises the
meeting window**, because it is ADR 0063's fourth way in.

**Verification in the native host is owed** — jsdom cannot watch a window open,
and `CLAUDE.md` requires the host for anything window-bound.

**`ENTRY_POINT_HOLES` is stale on two of six and nobody has fixed it.**
`meeting`'s *undecided* text says *how a capture starts and what ends it*,
closed by ADR 0063 on 2026-08-05; `translate`'s says *how the window is opened*,
closed by ADR 0064 the same day. Correcting it is Leg 4a's subject and is the
first thing Stage C3 needs.
