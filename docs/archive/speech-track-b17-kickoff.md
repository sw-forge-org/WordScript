# Speech track — B17, B18 and B20: the AI Models screen finishes what it draws

Written 2026-08-17 by the session that closed B16 and B19. **Paste this page into
a fresh session.** It is spent when B17, B18 and B20 are closed.

> **SPENT 2026-08-18.** All three closed (ADR 0220, ADR 0219, ADR 0218) and the
> open report at the foot of this page turned into a fourth step, B23
> (ADR 0217). **This copy is kept because five of its claims were wrong against
> the code and the corrections are worth more than the brief was** — they are in
> [`## What this brief got wrong`](#what-this-brief-got-wrong) at the end. The
> step records in [`speech-track-plan.md`](../tracks/speech-track-plan.md) are
> authoritative; this page is history.

Read [`speech-track-plan.md`](../tracks/speech-track-plan.md) for the full step text —
this page is the brief, not the sequence. Read
[`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) first anyway: three other tracks
share this tree with no branches, and the rules for that are on it.

## The one sentence

**AI Models is organised correctly and finishes two things it draws**: the
account card is unreadable at the width it is actually read at, the language a
profile dictates in can be set nowhere, and the migration that moved credentials
onto accounts leaves an orphan behind on machines that had a self-hosted one.

## Why these three steps are one brief

They are not one step — each has its own record — but two of them share a file,
and doing those in separate sessions would mean two passes over `Models.tsx` and
two `port:diff` runs against a moving baseline.

**Do them in this order**, cheapest and lowest-risk first:

1. **B20** — the orphaned credential. Rust, no surface, no `port:diff`. It is a
   security finding and it does not interact with the other two.
2. **B18** — the language. The smaller surface change, and it carries a Rust
   requirement of its own that has to be decided before anything is drawn.
3. **B17** — the account inventory. The largest drawing change, and the one whose
   `port:diff` movement has to be explained rather than absorbed.

**B19 closed on 2026-08-17 and shrank this brief.** It asked where four drawn
settings are set; the answer was nowhere, and the owner ruled that three of them
should not be settable at all — the bias segment and Prompt Enhance's sub-mode
and target are gone (ADR 0216). What survives of that step is the language pair,
which is B18.

**It also left two steps behind, and they are not in this brief on purpose.**
**B21** (a switch nothing writes, two arms nobody can reach, and a health flag
that can never fire) and **B22** (two fields, two homes, no writer) are Rust
cleanups on the config and hint axes. They do not touch AI Models, they block
nothing here, and folding them in would make this brief four subjects instead of
one. Read them in the plan before touching `bias_mode`, `ManualBias` or
`enhance_*` for any other reason — **each is a place where a deletion is the
likely right answer and a wrong deletion costs a migration.**

## What the owner asked for

Stated close to the original, because a loose paraphrase already went wrong once
in this track:

- On the account card: **the Account UI looks bad, its breakpoints are
  indefensible, and nothing on it can be read.**
- On the language: **it is listed under Dictation on AI Models but only DRAWN,
  and it says *per profile* — while the profile settings themselves offer no way
  to set it.**
- On which settings survive at all, which is what closed B19: **the only ones
  needed are `Into`, `Keep the profile's words`, `Language` and `Pin this
  language`. Nothing else should even be visible, because they are fixed
  settings the user has no interest in and that should simply work.**
  **Read this before adding a control to the job list.**
  A setting whose intent is withdrawn is removed, not marked (ADR 0216).
- On stored local data, standing since 2026-08-11 and restated three times since:
  **nothing has to be held on to from local legacy data, and it does not matter
  in the slightest which local data is lost.** Price the clean cut. Do not
  build a rescue path for an odd stored value, and do not spend a step's budget
  repairing this machine.

## What the previous session established, so you do not re-derive it

**The pattern to copy already exists on this screen and is used twice.** `Into`
and `Keep the profile's words` are edited on Profiles and stated on AI Models,
disabled, each with a `ScopeTag` carrying the door. That is ADR 0068's ruling and
it is the answer to B18. Do not invent a second shape.

**The job list is now four settings and that is the whole of it.** `Into` and
`Keep the profile's words` (live), the language pair (drawn, B18's job). Three
others left on 2026-08-17 and the record says why. If you find yourself adding a
fifth, check ADR 0216 first.

**The language is fully wired on the runtime side already.** `speech.language`
and `language_locked` reach the capture snapshot (`capture.rs`), the drift check
(`transform.rs`) and both cloud adapters as the language hint. B18 needs no Rust
to make the value work — it needs Rust for the *other* half, below.

**B18's trap, and it is the reason that step is not two lines of wiring.**
`history.rs` writes `optional_non_empty(&app_config.language)` into the record at
four sites — the **machine-wide** field — while the capture sends the
**profile's**. Both are empty on every machine today, so they agree by accident.
The step that gives the profile's field a control is the step that makes every
record name a language its request did not carry: **ADR 0203's defect, rebuilt
one axis over, by the fix.** Decide it before drawing anything — either the
record reads the same resolver the capture does, or the machine-wide field goes.

**The seam B17 needs is built.** `accountChoices` returns every account grouped
lane → provider → account with `operable` and a reason per row;
`profileLabelsUsing` and `profilesUsingConnection` derive the used-by sentence;
`buildNewConnectionPatch` creates an account. No new runtime answer is required.

## The measurements you inherit

- **`port:diff` baseline**: `models` `65 | 281 | 33`, `models#1` `262 | 30 | 17`.
  Run it as `npm run port:diff -- models models#1`; **bare `port:diff` walks zero
  screens and reports a free `ALL EXACT`.** Two things about that first number:
  - **It is not what B15's record states**, and neither is the number before it.
    `models` was `28 | 257 | 24` at B15, moved to `29 | 287 | 33` in `8d4e837` —
    the catalogue commit, which changed the model names the gallery draws and
    measured its test counts rather than the port — and then to `65 | 281 | 33`
    with B19.
  - **36 of those structural differences are deliberate** (ADR 0216): the
    prototype draws three rows the product no longer has. A leg reading `65` as
    port damage would be re-adding controls the owner removed.
- **Suite**: 866 frontend across 52 files, 950 Rust / 6 ignored. Say by how much
  you move either and why.
- **The width to check at is 625 CSS px**, not 760. Display scale on the
  reporting machine puts the settings window permanently under the rail floor the
  sheet is designed at, and B17's readability complaint is measured there.

## The rule this screen keeps proving

**Nine defects on this surface have survived a green suite and been found by
looking at it.** ADR 0160, 0161, 0162 each had to be applied twice; ADR 0165 and
0166 each found two more by rendering the window after the tests passed; ADR 0212
found three, the loudest being a collapsed row summarising an OpenAI job as
Groq's model; ADR 0215 found four by reading rather than running. **Render the
screen and read it before you call a step done.** `import -window` refuses on
this machine; what replaces it is the real component tree over the dev server
with `__TAURI_INTERNALS__` stubbed, driven headless through CDP.

## Two things that are not yours

- **A dev host may be running.** Check `pgrep -af "tauri dev"` and say so. Any
  write under `src-tauri/` rebuilds and restarts the whole app, which kills a
  dictation in flight; batch the Rust edits. Never write `vite.config.ts` while a
  host runs. The host itself is expendable — restart it without asking.
- **Do not repair stored configuration as part of a step.** If a value on this
  machine is broken, fix the file with a dated backup beside it and spend the
  step on the code defect.

## One open report, unreproduced

The owner reported on 2026-08-17 that the workspace status strip reads **`Needs
key`** while the connection has a model and a provider selected, and that title
generation and the assistant do not run. **The obvious causes are all
eliminated**: both `connection-default.speech.api_key` and
`connection-default.chat.api_key` exist, they are the same 56-character key, it
answers `HTTP 200` against `api.groq.com/openai/v1/models`, and that response
lists exactly the four ids the config now names. The catalogue's retired ids were
cleared out of the config the same evening.

**One state that existed while the report was made no longer does**, and it is
worth ruling in or out first: a third entry, `self_hosted.speech.api_key`, was in
the store under a vendor scope (B20) and has since been deleted. If the strip was
reading the self-hosted account, that entry made its state ambiguous. It cannot
now, which means a `Needs key` that still reproduces is a different bug from the
one reported.

`connectionReadiness` in `WorkspaceWindow.tsx` reads
`role_credentials.find(role === "speech").configured` and returns `Needs key`
only when that is false, so **either the strip is asking about a different
connection than the one the reader is looking at, or the runtime's
`provider_status` answered something the keyring contents do not explain.**
Nothing in the running host's log shows a credential error.

**Reproduce it before fixing anything**: dictate once with the host running,
then read the runtime log for the `provider_status` answer and the
connection id it was asked about. If it does not reproduce, say so — the config
was corrected between the report and this page, and the report may predate it.

## What this brief got wrong

Written 2026-08-18 by the session that closed all three steps. The direction was
right and the measurements it inherited were all correct —
`models 65 | 281 | 33`, `models#1 262 | 30 | 17`, 866 frontend across 52 files,
950 Rust with 6 ignored, every one re-run and confirmed. Five claims about the
code were not.

**1. It contradicts itself about `Into` and `Keep the profile's words`.** One
paragraph has them *"edited on Profiles and stated on AI Models, disabled"* — the
truth — and another calls them *"(live)"*. `Models.tsx` gives both
`disabled={Boolean(runtime)}` and `onChange={() => undefined}`. The live pair on
that job is `When you already dictated in that language` and `Address form`,
which the brief never names.

**2. "The job list is now four settings" merges two disjoint sets.** The four
come from a comment in `Models.tsx` meaning *the four rows of the Translate job*.
The language pair is under **Dictation**, a different job. Nothing in the product
is a set of four.

**3. "Seven controls in one `ws-rowflex` … and two badges."** Five, and no badge:
a `ScopeTag`, a select, Rename, New, Remove — and Rename replaces the select, so
the resting case is four. The two badges belong to `AddAccountRow`, which renders
only when the lane holds no account at all.

**4. The `+ New account` fault is on the button nobody sees.** The fixed
`runtimeIdFor(LANES.Cloud.provider)` is in `AddAccountRow`, reachable only with
zero accounts on the lane. The button normally on screen is `AccountRow`'s
**`New`**, whose vendor is the *shown account's* — equally unable to reach a
second vendor, and it **also assigned**, which `AddAccountRow`'s own docblock
forbids one component away.

**5. The readability complaint is traced to the wrong cause, and the owner is
more right than the brief.** It reads as a design-shape problem. Measured in the
native host: at a 625 px window the settings sheet's `ws-column` is **379 px**,
below the 460 px tier — **so the breakpoints fire and every row is already
stacked.** What makes the `Account` row 171 px tall showing one account is five
controls carrying 489 px of intrinsic width wrapping into a 313 px column under a
three-line hint. *Stacking is the right answer to a narrow column and the wrong
answer to five controls.* The 569 px figure elsewhere in this track is the
workspace content column; the settings sheet has its own, narrower one, and the
rows in question live in the sheet.

**And the open report at the foot of this page was reproducible all along.**
`WorkspaceWindow.tsx` calls `useProvider` without its fourth argument, so the
connection scope defaults to `""` and the runtime reads `.speech.api_key` — an
entry no writing door can produce. **Since ADR 0208 moved the keys onto accounts,
the strip has read `Needs key` on every machine, on every launch.** This page
listed the right hypothesis and stopped one step short of it, then spent a
paragraph on a deleted `self_hosted` entry the strip never reads. It is B23 and
ADR 0217.

**The pattern in four of the five is the same**: a claim about the code written
from an adjacent fact rather than from the file — the count of one component read
off another, a breakpoint derived from the wrong column, a button named from its
neighbour. Nothing here needed a new instrument to catch; it needed the file
open. The brief's own closing rule — *render the screen and read it before you
call a step done* — applies to a brief before it applies to a step.
