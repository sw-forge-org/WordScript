# Kick-off — the speech track

Opened 2026-08-11. **A third track**, beside the GUI port relay
(`HANDOFF_gui-port-relay.md`) and core hardening (`KICKOFF_core-hardening-*.md`),
in the same tree. Stage your own paths when you commit; never `git add -A`.

Its subject is the capability layer four drawn surfaces wait on: providers,
streaming recognition, the spoken output path, and the windows that carry them.
Its first stage was documentation only and is done. **This page is the
orientation; the records are the brief.**

---

## What stage one did, and what it deliberately did not

**It wrote documents. It changed no code.** Nothing under `src/`, `src-tauri/`,
`package.json` or `tauri.conf.json` was touched. If `npm test`, `npm run build`
or `cargo test` moved, this page was violated.

Delivered:

- **`docs/PROVIDERS.md`** — the provider matrix, read against each vendor's own
  documentation on 2026-08-11, dated and sourced per row.
- **ADR 0094–0102 and ADR 0105–0110** — fifteen records, every one *Accepted
  (planning direction; not implemented)*. The last six came from two review
  passes the same day — one against the code the records describe, one against
  the donor implementation. See *What the review found*, below.
- Roadmap, spec, architecture, platforms, reference, design system, status,
  changelog and the relay's §2.5 updated to match.

Not delivered, deliberately: any adapter, any command, any window, any
migration. **A record is not an implementation**, and this repo has a six-leg
scar from a document that asserted a capability the runtime had stopped having.

---

## The six findings the next stage is built on

**1. Groq does not stream, and it is the only integrated cloud lane.** One file
in, one result out. No websocket, no `stream=true`, no partials, and language is
a hint rather than a detection. OpenAI, xAI, Mistral and Azure OpenAI do stream;
whisper.cpp can, on a path the runtime does not use. So the roadmap's gate 1
resolved to something its own entry did not anticipate — neither a pure Phase 4
nor a pure Phase 5 question, but both, on different lanes.

**2. `muted` is not the primitive it looks like.** Read `process_samples`:
`paused` gates the sample push and is subtracted from `effective_elapsed`;
`muted` gates the level statistics, the voice-activity timestamp and the emitted
meter, and **the audio keeps being recorded**. A duplex mute that reuses `muted`
records the machine's own voice; one that reuses `paused` puts the overlay in a
paused state the user did not ask for. ADR 0098 makes it a third state.

**3. Turn boundaries and partial results are different requirements.** The
translation window's conversation needs the first; live subtitles' echo needs
the second. Pricing them as one capability is how the roadmap came to carry
"streaming recognition" as a single homeless item.

**4. The window family is a drawing with no host.** `DESIGN_SYSTEM.md` has named
five members for two legs; three windows are declared statically in
`tauri.conf.json` and **there is no `WebviewWindowBuilder` in the tree**.

**5. `voice` is drawn and is not a `JobKey`.** `Models.tsx` draws a `Speaking`
group with one job, outside the lane axis. Adding a second row there is a
drawing, and the gallery grows a drawing before the product does (ADR 0057).

**6. The drawing is ahead of the plan in one place, and behind it in another.**
Ahead: the per-job `API key` row appears **only** on an overriding job, with the
reason on the row — the security rule ADR 0094 now states and the donor had to
write a helper for. Behind: **no surface anywhere says whether a lane streams**,
so the difference between Groq and OpenAI that decides whether a conversation
works is invisible on the screen that picks between them.

---

## What the review found, and why six more records exist

The first pass was reviewed twice before any of it was implemented — once
against the code the records describe, once against the donor that already
built this. **Five of its claims did not hold, and the fixes are the records
numbered 0105 and up.** They are listed here rather than folded away, because
each one is a thing the next reader would otherwise have discovered inside an
adapter.

**1. The capability seam does not exist.** ADR 0094 called the
`ProviderCapabilities` mirror the guard that stops a surface over-claiming.
Nothing reads it: no field of `status.capabilities` is consumed in `src/`,
`Models.test.tsx` mocks it `{}` and the suite passes, and every capability
answer on `AI Models` comes from the hand-maintained `PROVIDERS` table. **The
mirror is a precondition for a guard, not a guard.** ADR 0106 makes building it
a step before the first adapter, asserted by a test.

**2. "Follow the connection" and a per-role credential kind contradict each
other.** ADR 0094's credential rule is written for the *overriding* job, so the
following job inherits — and ADR 0102 made the kind per role the same day. A
speech job on a subscription-paid OpenAI connection would inherit a credential
whose backend serves no recognition, **without the user touching that job**.
ADR 0105: the connection carries the provider, never the credential.

**3. ADR 0095's per-utterance file has nowhere to come from.**
`start_native_capture` couples the cpal stream to the recording and
`stop_native_capture` takes one bounded buffer whole. ADR 0107 separates them:
the stream is held for the session, a turn is a recording, and every existing
instrument applies per turn unchanged.

**4. The second adapter in ADR 0096's order has no control that reaches it.**
Groq voice is scheduled second; `voice` is not a `JobKey` and the drawn
`Speaking` row offers two presets, neither of them Groq, with no provider mark
and no credential control. ADR 0109 adds the ninth job and the rule: **no
adapter lands before the row that operates it.** If the owner question about
where the translation voice sits is still open when OpenAI lands, **Local moves
up.**

**And one the review found in the plumbing:** ADR 0097's routing is machine-wide
and drawn inside a window that may stand three times, in webviews sharing no
state, while the runtime announces no config change at all. ADR 0108.

**A second pass over the donor found a fifth, and it is the largest.** ADR 0094
called OpenRouter *"the exception that proves the axes are per provider"*. Their
`src/models/modelRegistryData.json` puts `streaming` on the **model**, and
proves why on the vendor scheduled first: `gpt-4o-transcribe` streams,
`whisper-1` does not, **one key and one endpoint**. The local lane says it again
with `runtime: "online"` on two of four Parakeet models. **The capability axis
was wrong before any adapter was written** — ADR 0110 moves three of the four
new fields onto the model, and this repo's own survey had the evidence in its
OpenAI section the whole time.

Three smaller ones from the same pass, each recorded where it applies: a
credential needs a **generation** so a refresh that lost a race cannot restore a
revoked token (`tokenStore.js` → ADR 0105); **many turns are many uploads** and
nothing bounds them, which the donor fixed with a cross-job in-flight ceiling so
a batch upload cannot starve a dictation (`cloudChunkPolicy.js` → ADR 0107); and
**an empty translation must preserve its input**, which matters more in a
conversation than in a dictation because the lost text is a sentence somebody
else said (`translationChain.js` → ADR 0101). Plus two factual corrections to
`docs/PROVIDERS.md`: Bedrock ids carry a region prefix and are up to four parts,
and the local lane has a fourth streaming option (sherpa-onnx / Parakeet) the
first survey missed.

---

## The donor already built this, and it is worth the read

`donors/app/desktop-shells/openwhispr` ships fourteen provider ids over ten
implementations, four streaming recognisers, three enterprise lanes, a
self-hosted lane and a local one. `docs/PROVIDERS.md` § *The implementation
reference* lists which file answers which question. Three things to take:

- **The registry is many-to-one.** One OpenAI-compatible Chat Completions shape
  serves four of their ids. Read ADR 0096's list as ten ids and rather fewer
  adapters.
- **A provider gets a context, not the world.** Their `InferenceProvider` is one
  method and everything it needs is handed in. Ten adapters that each reach for
  globals become ten sets of assumptions.
- **Do not copy their per-job config shape.** Five jobs times eight flat store
  keys is forty settings, with a fan-out helper to keep them in step. Nine jobs
  would be seventy-two. That is the argument for default-plus-sparse-override,
  made by the alternative.

---

## Stage two, and the order

**The full sequence — including what each step requires and what validates it —
is [PLAN_speech-track-implementation.md](PLAN_speech-track-implementation.md).**
That page exists because this one named an adapter order and no order for the
work in front of it: ADR 0094 is the precondition of both preconditions and
carried no position at all, and six further records carried none either. **Start
there, not here.** This page is stage one's account; the plan is what gets
ticked off.

**Two things come before the first adapter, and neither is one.** The capability
seam (ADR 0106) and the per-role credential resolution (ADR 0105). Both are
load-bearing for every adapter after the first and both are cheaper before ten
rows depend on them. **And both require ADR 0094 first** — the traits and the
registry are what they attach to.

ADR 0096 then fixes the order and the reason for it. **OpenAI first** — the only
vendor on the drawn set serving recognition, chat and voice alone, and the one
whose completion event names detected languages. **Groq voice second, gated** —
same connection and no new credential, but no drawn row that can operate it, so
it waits on the owner question plus the gallery (ADR 0109), and **Local moves up
if that answer is not there**. **Local third, with streaming** — and that step
takes Phase 5's open "does WordScript ship a server" question once rather than
twice. Then the rest.

**Read before starting:** ADR 0094 (the contract), ADR 0105 (which credential
answers for a job), ADR 0106 (the seam that does not exist yet), ADR 0095
(streaming beside batch), ADR 0107 (where a turn's audio comes from), ADR 0096
and ADR 0109 (which lanes, in what order, and what gates each),
`docs/PROVIDERS.md` (what each one actually serves), and `CLAUDE.md`.

---

## What must not happen

- **No partial result may reach the session reducer.** A dictation ends in
  exactly one commit (ADR 0018, ADR 0019). The *beside* cut in ADR 0095 has to
  be held by a test, not by a comment.
- **The overlay resize path does not come back.** ADR 0089 removed it and
  `lib.rs` carries the reason at the site. A new window class is a different
  obligation and still ships **no generic resize command**.
- **Nothing mounts.** The six undecided surfaces (ADRs 0060–0064 plus the
  roadmap candidate) stay unmounted; `ia.test.tsx`'s last case asserts it.
- **Do not settle an owner question quietly.** **Two** are open and named:
  whether a view plus a pop-out is enough interaction for a table (ADR 0064),
  and where the translation voice sits on `AI Models`. The third — whether the
  window needs a processing mode of its own — was answered by the owner on
  2026-08-11: **no** (ADR 0101). **The second of the two now blocks a scheduled
  step**, since ADR 0109 gates the voice adapter on the row that operates it.
- **No adapter lands before the row that operates it** (ADR 0109), and **no
  drawing grows anywhere but in the gallery first** (ADR 0057, ADR 0088). Two
  decisions in this stack need new drawn vocabulary — a second credential kind
  on OpenAI's row (ADR 0102, ADR 0105) and whatever makes `voice` operable. Both
  go gallery, `port:diff`, product, in that order. ADR 0096's *the UI does not
  change* forbids reshaping a surface to fit an adapter; it does not license
  editing the product screen directly either.
- **Do not claim a seam that is not built.** ADR 0094's first pass called the
  `ProviderCapabilities` mirror a guard; nothing reads it. ADR 0106 requires a
  test before any document describes it as one again.
- **Do not price the conversation surface before the soak night.** The input
  stream carries an open, uncaused loss of 12–52 % across 11 recordings
  (`known-issues/capture-loses-half-the-recording.md`). `capture-soak` (ADR 0084)
  exists and has never run longer than seconds. A conversation at a table is the
  longest capture this product would ever run, on exactly that stream.

---

## ADR numbers, and why this page names none as free

This track took **0094–0102**, and then **0105–0110** across two review passes.
It did not take 0092 or 0093: both were already cited in *uncommitted* source by
the other track, which moved its own number between the two while this work was
in progress. **It also did not take 0103 or 0104** — the other track claimed those
while the review was running, in the same tree, untracked. That is the race this
section describes happening twice in one day.

**Grep the whole tree before you claim one** — `src/` and `src-tauri/` as well
as `docs/decisions/` — because a number is cited in code before its file lands,
and a handoff sentence naming "the next free number" is the first thing to go
stale. This page deliberately does not name one.

---

## Checks

Stage one is verified by the suite **not moving**, and it was run: **473
frontend across 39 files, `cargo test` 740 passed / 3 ignored, `cargo check` 15
warnings** — the baseline Leg 10 closed at, re-measured 2026-08-11 after the
port relay landed three commits on top of it. A different number means code was
touched.

**That number went stale the same day, and the reason matters more than the
number.** The review pass re-measured and found **474 frontend across 39
files** — the port relay had added a test to `OverlayWindow.test.tsx`,
uncommitted, in this shared tree. **A frontend count is not a valid check for a
documentation stage while another track is live in the same working tree**: it
measures both tracks and attributes the difference to whoever reads it last. The
check that survives is narrower and is the one to use — **`git status` shows
this track touching only `.md` files**, and the suite is measured before and
after the same session rather than against a number written down earlier. The
review measured 474 before its edits and 474 after.

**`cargo check 2>&1 | grep -c "^warning"` returns 16, and the answer is 15.**
The summary line — *warning: `wordscript` (lib) generated 15 warnings* — is
itself a line beginning `warning:`, so a naive count is always one high. Read
the summary line, not a count of matches. This cost a round trip here and is
recorded so it costs the next reader none.

From stage two onward the normal rules apply: `npm test`, `npm run build`,
`cd src-tauri && cargo test`, `npm run port:diff` after anything that could move
a screen (gallery ids or it measures nothing), `invoke_handler` against every
`invoke(` in `src/` after anything that touches the runtime, `npm audit` after a
dependency change, and the native host for anything drawn. Never `--no-verify`.
Never `pkill -f`.
