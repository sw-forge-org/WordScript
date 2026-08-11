# Implementation plan — the speech track

Opened 2026-08-11, after stage one closed with fifteen records and no code.
**This is the sequence the records do not carry.** ADR 0096 fixes the order of
the *adapters* and names two preconditions; it does not order the preconditions
themselves, and six further records carry no position at all. That gap is what
this page closes.

**It is a living document.** Each step gets its status here as it lands. The
records stay append-only and are not edited to match progress
(`KICKOFF_speech-track.md` is stage one's account and is not updated by this
work either).

---

## How to read a step

Every step carries four things, and a step missing one of them is not ready to
start:

- **Requires** — what must be true before it begins. A step whose requirement is
  an owner decision is blocked, not slow.
- **Touches** — which side of the seam moves. This decides the validation.
- **Validates** — the commands that must pass, plus the assertion specific to
  this step. *Suite unchanged* means the baseline below, not "green".
- **Done when** — the observable fact, never "the code is written".

**The baseline every step measures against:** 474 frontend tests across 39
files, `cargo test` 740 passed / 3 ignored, `cargo check` 15 warnings (read the
summary line, not a count of `^warning` matches — it is always one high). A step
that changes a count says by how much and why, in its commit.

**The baseline moves as steps land, and only for what they moved.** After A2:
`cargo test` **748 passed / 3 ignored**, and the frontend suite reads **480
across 39 files** — the six extra cases are `b330815`'s sidebar work, not this
track's. `cargo check` stays at 15. A step compares against the last line here,
not against the opening one.

**The rules no step may break**, restated from the records because a plan is
where they get quietly dropped: no partial result reaches the session reducer
(ADR 0018, 0019, 0095); no generic resize command returns (ADR 0089, 0100);
nothing mounts (ADR 0057, and `ia.test.tsx`'s last case asserts it); no drawing
grows outside the gallery (ADR 0057, 0088); no adapter lands before the row that
operates it (ADR 0109); never `--no-verify`; never `pkill -f`.

---

## Stage A — the runtime contract

**No vendor, no drawing, no migration of anything a user typed.** This stage
exists so that everything after it has one shape to land in. It is also the
cheapest stage to get wrong late: every later step multiplies its mistakes by
ten providers.

### A1. Traits and registry (ADR 0094)

**The first session.** It is the only precondition with no precondition of its
own, and both of the others need what it produces.

- **Requires** — nothing.
- **Touches** — `src-tauri/src/core/providers/` only. `mod.rs`'s eight top-level
  functions become thin resolvers over a registry; `groq.rs` and
  `local_preview.rs` move behind `SpeechProvider` / `ChatProvider`;
  `VoiceProvider` is declared and implemented by nobody.
- **Validates** — `cargo test` at **740 / 3 ignored, unchanged**, `cargo check`
  at 15 warnings. **Nothing in `src/` changes**, so `npm test` and
  `npm run build` are unchanged by construction; run them anyway, because "I did
  not touch the frontend" is a claim and the suite is the check. Every `invoke(`
  in `src/` still resolves against `invoke_handler`.
- **Done when** — the `ProviderId` enum is gone, adding a provider is a module
  plus a registry line, and **a provider that does not serve a role does not
  implement it** — `local_preview` and `groq` both compile without a
  `VoiceProvider` stub.

**Why it is a pure refactor and must stay one:** two providers in three traits
is more code than two arms in eight functions, and buys nothing today. Its whole
value is that A2, A3 and every adapter have somewhere to attach. **If this step
changes behaviour, it has failed** — 740 unchanged tests are the proof, and the
temptation to "fix one small thing while in here" is what makes a refactor
unreviewable.

### A2. Capability axes (ADR 0110)

- **Requires** — A1.
- **Touches** — `ProviderCapabilities` gains `speech_synthesis`; a **model-level**
  capability type appears carrying `transcription_streaming`,
  `reports_detected_language`, `synthesis_streaming`. `src/types/providers.ts`
  mirrors both.
- **Validates** — `cargo test`, and a test that the two axes answer differently
  for one provider: **OpenAI is not integrated yet, so use the fixture that
  proves the shape** rather than waiting for the vendor. `npm run build` for the
  mirror.
- **Done when** — asking "does this stream" requires a `(provider, model)` pair
  and cannot be answered from a provider alone.

**The precedent is already in the tree:** `capture_limits(provider, model,
tier_id)` in `providers/mod.rs:189` already takes both. This step generalizes an
existing shape rather than inventing one.

### A3. Credential per role (ADR 0105, ADR 0102's storage half)

- **Requires** — A1 (roles must exist to key on).
- **Touches** — `SaveProviderApiKeyRequest` and `clear_provider_api_key` grow
  role and kind; the `SecretStore` entry becomes `(provider, role, kind)`;
  `provider_status` answers per role; **a config migration with a backup path**
  (`core::backup` is the pattern — a migration without a snapshot is not
  written).
- **Validates** — `cargo test`; a migration test that an existing single-string
  credential lands on the right `(provider, role, kind)` and that **clearing one
  role does not clear another**; `invoke_handler` against every `invoke(` in
  `src/`, because two command signatures change.
- **Done when** — "follow the connection" resolves the provider and looks the
  credential up per role, and a role with no credential returns *inert plus the
  name of what is missing* rather than another role's credential.

**Not in this step:** the OAuth flow. A3 is the shape a token set will be stored
in; acquiring one is D3.

---

## Stage B — the seam and the ninth job

First frontend contact. **Both steps grow the drawing, so both go through the
gallery** (ADR 0057) and `npm run port:diff` moves with them.

### B1. The capability seam (ADR 0106)

- **Requires** — A1, A2.
- **Touches** — `AI Models` starts reading `provider_status().capabilities`
  instead of inferring from `src/screens/data.ts`'s `PROVIDERS` table. The drawn
  table stays; it stops being the answer to *can this be operated*.
- **Validates** — **two tests, and the step is not done with one**: (a) a
  provider whose capability denies a role produces a row that cannot be operated
  and says why; (b) the TypeScript mirror still matches the Rust struct. `npm
  test`, `npm run build`, `npm run port:diff` reading `models` at 6 | 6.
- **Done when** — `Models.test.tsx` can no longer mock `capabilities: {}` and
  pass. **That failing mock is the deliverable** — it is the first moment the
  mirror carries load.

**Three inert reasons, three sentences.** A row may be inert because no adapter
exists (0096), because the runtime denies the role (this step), or because a
credential is missing for that role (A3). One greyed control with one hint
conflates them, and the surface has drawn vocabulary for all three.

### B2. `voice` becomes the ninth job (ADR 0109, type half)

- **Requires** — nothing technical. **Independent of A and B1** and can run in
  parallel.
- **Touches** — `JobKey` gains `voice`; `LANES`'s `Record<JobKey, LaneJob>`
  either gains a ninth entry per lane or the type says the job is off the lane
  axis. **The `Speaking` group is already drawn off-axis, so the type follows
  the drawing** — inventing four lane rows for it is the failure mode.
- **Validates** — `npm test`, `npm run build`, `port:diff` at 6 | 6.
- **Done when** — ADR 0094's `VoiceProvider`, ADR 0102's inadmissibility rule
  and ADR 0105's role resolution all name a job that exists.

**Not in this step:** where the translation voice sits. That is the open owner
question and it gates F1, not this.

---

## Stage C — capture

**Independent of A, B and D.** It can run concurrently with the whole provider
build-out and shares no file with it. It is scheduled here because everything in
G waits on it.

### C1. Separate the stream from the recording (ADR 0107)

- **Requires** — nothing.
- **Touches** — `core::capture`. Session open/close as a third and fourth entry
  point beside `start_native_capture` / `stop_native_capture`, which **stay
  exactly as they are** for dictation. A recording window per turn.
  `max_samples` becomes a turn ceiling.
- **Validates** — `cargo test`; a test that a session produces N recordings with
  N integrity verdicts; **and the dictation path is byte-identical** — the
  existing capture tests are the guard and must not be edited to accommodate
  this.
- **Done when** — a turn is a recording that `CaptureIntegrity`,
  `capture_budget` and `transcribe_audio_file` accept unchanged.

**Which of `started_at`, `accumulated_paused` and the mute accumulator reset per
turn and which accumulate per session is the first real decision**, and getting
it wrong makes every verdict after the first wrong in the same direction.

### C2. The runtime mute (ADR 0098)

- **Requires** — C1 (it must hold the segmenter, which C1 introduces).
- **Touches** — a third capture state beside `muted` and `paused`, its own
  accumulator, `is_recording()` as a derivation over both writers.
- **Validates** — `cargo test`; a test that the mute stretch comes off
  `effective_elapsed` so a spoken reply does not push a conversation toward
  ADR 0079's `short` verdict; and that **the user-facing mute is untouched**.
- **Done when** — the machine can stop listening without the overlay showing a
  paused state the user did not ask for.

### C3. The soak night (ADR 0084)

- **Requires** — nothing. **Can start tonight and should.**
- **Touches** — no code. `capture-soak` exists and has never run longer than
  seconds.
- **Done when** — there is a number for the open 12–52 % loss across a
  multi-hour hold.

**This is a gate, not a step.** Stage G ships a conversation surface on the
input stream that carries
[known-issues/capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md).
Shipping it before this measurement is the fake-readiness defect one layer down,
and ADR 0098 says so in its own consequences.

---

## Stage D — the first adapter

### D1. OpenAI, batch speech and chat (ADR 0096 step 1)

- **Requires** — A1, A2, A3, B1.
- **Touches** — one new provider module plus one registry line. **If it touches
  anything else, stage A was incomplete** and the fix belongs there.
- **Validates** — `cargo test`, `npm run audit` after the dependency change, and
  the surface still says what is true for every lane that is still inert.
- **Done when** — a second lane can be operated, and `AI Models` **keeps its
  banner**, because the screen is whole only when the last lane lands.

### D2. The streaming contract (ADR 0095)

- **Requires** — D1, C1.
- **Touches** — `Partial` / `Final` beside `transcribe_audio_file`, a websocket
  transport (`reqwest` does not carry one — a dependency decision), OpenAI
  Realtime as the first true-streaming implementation, resampling **inside the
  adapter** (24 kHz against `TRANSCRIPTION_SAMPLE_RATE`'s 16 kHz).
- **Validates** — `cargo test`, and **a test that no partial result reaches the
  session reducer** — ADR 0095 requires this to be held by a test rather than a
  comment, and this is the step that owes it.
- **Done when** — one contract serves a lane that streams and a lane that does
  not, and the caller cannot tell which without asking the `(provider, model)`
  pair.

**Take the donor's three operational facts as given, not as discoveries:**
sessions die at 60 minutes and get rotated at 55; a cold-start buffer is not
optional because speech begins before the connection does; the dial is bounded
and a socket resolving after the deadline is closed, not leaked.

### D3. Subscription credential (ADR 0102)

- **Requires** — D1, A3.
- **Touches** — a native OAuth 2.0 + PKCE flow, a loopback listener on
  `127.0.0.1:1455`, a capability entry, `tauri-plugin-opener` for the browser.
  **A token set needs the generation guard** — a refresh that lost the race
  against a `clear()` must not restore a revoked credential (ADR 0105).
- **Validates** — `cargo test`, `npm audit`, and the surface states which
  credential pays, that it reaches text jobs only, and that the vendor licenses
  it for interactive use.
- **Done when** — an account can hold a key for recognition and a subscription
  for chat at the same time, and choosing the subscription makes the speech jobs
  say what they now need.

---

## Stage E — what a second window needs

Both were filed *unscheduled* in the roadmap because stage one had no sequence,
**not because they are optional**. They are scheduled here: after the provider
work has a shape and before any surface tries to use a window.

### E1. The config echo (ADR 0108)

- **Requires** — nothing. Small, general, and **E2 needs it.**
- **Touches** — a config-changed channel every window re-reads from; scoped or
  debounced so three windows do not re-read everything per keystroke; scrubbed
  by `without_secrets()` because an event is a second path out of the runtime.
- **Validates** — `cargo test`; a test that the event carries no secret.
- **Done when** — a machine-wide value changed in one window is visible in
  another without either knowing the other exists.

### E2. The window class (ADR 0100)

- **Requires** — E1.
- **Touches** — either `WebviewWindowBuilder` or a fixed pool of declared
  labels — **the first real implementation choice the record leaves open**.
  Geometry is read and persisted, never pushed from content. Per-member
  obligations (content protection, always-on-top, what closing means) are
  declared, not inherited.
- **Validates** — `cargo test`, `npm run build`, **and the native host** — a
  second window class is exactly the change that behaves in jsdom and fails on
  WebKitGTK, and four consecutive legs have found a defect that way.
- **Done when** — a member can be opened, dragged, resized and reopened where it
  was left. **Nothing mounts in it yet**; a class with no member is a capability
  with no door, not a fake affordance.

---

## Stage F — voice and the local lane

### F1. Groq voice (ADR 0096 step 2) — **gated**

- **Requires** — B2, **plus the owner answering where the translation voice sits
  on `AI Models`**, plus the gallery growing whatever row that answer implies.
- **If the answer is not there when D closes, F3 moves up.** Nothing about the
  local lane depends on it.

### F2. The second output stream (ADR 0097)

- **Requires** — E1 (the routing is machine-wide and drawn in a window that may
  stand several times).
- **Touches** — `list_native_output_devices` mirroring the input side; a named
  speech stream with its own lifecycle and its own reopen budget; `Silent` opens
  no stream rather than muting one.
- **Validates** — `cargo test`, the native host, and `docs/PLATFORMS.md` grows
  its measured section — **it currently says "nothing here is measured yet"**
  and this is the step that owes the measurements.

### F3. Local, with streaming (ADR 0096 step 3)

- **Requires** — C1, D2 (the streaming contract must exist before a second
  implementation of it).
- **Touches** — one of four shapes, and **this step picks it**: whisper.cpp's
  `stream` example, `whisper-server`, linking the C API, or the fourth option
  the second donor pass found — sherpa-onnx with a Parakeet online model, whose
  streaming server is what upstream ships and which reports a detected language.
- **Note** — this is the same decision Phase 5 carries as *does WordScript ship
  an OpenAI-compatible server*. **Take it once** (ADR 0096).

---

## Stage G — the conversation

**Gated on C3.** Every step here runs on the input stream with the open loss
defect, for longer than any other capture this product performs.

- **G1. Turn direction (ADR 0099)** — requires C1, D2 and a lane that reports a
  detected language. `TranslateSettings` grows a pair. **Rule 4 is the feature**:
  no match leaves the direction where it was and the line says so. The
  reliability half is a measurement against bilingual fixtures in
  `src-tauri/tests/fixtures/regression_transcripts.json` — **a feature that
  ships before that measurement ships on a guess.**
- **G2. The translation window (ADR 0101, ADR 0064)** — requires E2, G1, F2.
  Runs `ProcessingMode::Translate`; the cycle keeps seven entries. An empty
  translation preserves its input; a turn whose detected language already equals
  the target skips the step. **ADR 0064's first open point — whether a view plus
  a pop-out is enough interaction at a table — is still the owner's** and gates
  the surface, not the runtime beneath it.
- **G3. The remaining adapters** — Anthropic, Gemini, Mistral, xAI, OpenRouter,
  Self-hosted, the enterprise three, the remaining voices. `npm audit` and the
  Rust advisory sweep run **per adapter**, not once at the end. `AI Models`
  loses its banner when the last one lands, not before.

---

## What blocks what, at a glance

```
A1 ──┬── A2 ──┬── B1 ──┐
     │        │        │
     └── A3 ──┴────────┼── D1 ── D2 ──┬── F3
                       │       │      │
              B2 ──────┴── D3  │      │
                               │      │
C1 ── C2                       │      │
 └─────────────────────────────┴──────┴── G1 ── G2
C3 (soak, gates all of G)
E1 ── E2 ──────────────────────────────────┘
E1 ── F2 ──────────────────────────────────┘
B2 + owner answer ── F1
```

**Two owner questions are live**, and only one blocks a step: *where the
translation voice sits* blocks F1; *whether a view plus a pop-out is enough at a
table* blocks G2's surface. Neither blocks A, B, C, D or E.

## Status

| Step | State |
| --- | --- |
| A1 | **done** 2026-08-11 — `core/providers/registry.rs`, the enum gone, four counts unchanged |
| A2 | **done** 2026-08-11 — `ModelCapabilities` per `(provider, model)`, `speech_synthesis` on the provider, +8 Rust tests |
| A3, B1–B2, C1–C3, D1–D3, E1–E2, F1–F3, G1–G3 | **not started** |

Stage one (documentation) closed 2026-08-11: `docs/PROVIDERS.md`, ADR 0094–0102
and ADR 0105–0110, no code.

**A1, as it landed.** Three role traits plus a fourth (`Provider`) for what is
not a role today — status and the credential — because ADR 0105 is where that
half splits per role, and putting it on the three role traits now would be the
same edit in three places later. `SpeechProvider` carries the account plans and
the capture ceiling beside recognition: a plan is today entirely a statement
about how much audio may be uploaded, so a provider with no speech role has none
to choose between. `capture_limits` takes **both** model and tier on the trait,
because a cloud lane is bound by the plan and a local one by the model and the
caller knows which least of all — the shape `providers/mod.rs:189` already had.
The registry is a `&'static [ProviderEntry]` table rather than accessor methods
on a base trait, so "a module plus a registry line" is literally one line, and
the donor's many-to-one shape is two entries pointing at one static. Futures are
boxed (`ProviderFuture<T>`) because an `async fn` in a trait is not
dyn-compatible and no new dependency was worth a pure refactor.

**A2, as it landed.** Four choices the records leave open, and the reasoning
each turned on.

**The model answer is three-valued.** `supported`, `unsupported`, `unknown`
rather than a `bool`, because ADR 0110 requires OpenRouter's per-model answer to
be *a lookup whose values cannot be enumerated ahead of time* and says the
surface must state unknown rather than assume. A `bool` resolves that case at
the point where the value is written, and every reader downstream then treats a
guess as a measurement; the enum makes the mistake need a `match` arm. Adding
the third state later would be a contract change touching every adapter and the
mirror — which is what this stage exists to prevent.

**Both trait methods sit on `Provider`, not on the three role traits.** A model
capability spans roles — synthesis streaming is a voice question and
`VoiceProvider` still carries no method — and a provider that serves one role
lists the models of that role. `capabilities()` is separate from `status()`
because `status()` reads the OS secret store and probes the local runtime, and
**a registry-wide test must be able to ask what a lane can do without touching a
developer's keyring.** That test is the one that holds `speech_synthesis` to
`voice.is_some()` for every entry, which is the property ADR 0094 wanted from
the type and could not get from a struct field.

**The answer travels on `provider_status`, not on a command of its own.**
`ProviderStatusRequest` already carries `model`, so the pair is already there;
and a registered command with no caller is the defect ADR 0089 and ADR 0103
each swept for. A caller asking about a second model asks again with that model.

**Neither registered lane needed a table, and that is the finding.** Groq
answers `unsupported` for every id including ids it does not ship, because the
endpoint decides the matter — batch only, no socket to open. The local lane
answers the same because it shells out to `whisper-cli` and puts the *requested*
language back on the response; ADR 0094 defines `reports_detected_language` as
naming the language heard *rather than echoing the one it was told*, and that
line is `local_preview.rs`'s literal behaviour. So the (provider, model) pair
differentiates nothing yet, and the fixture in `registry.rs` is what proves the
shape — one vendor reached one way, whose `gpt-4o-transcribe` streams and whose
`whisper-1` does not. It stands in for D1 rather than waiting for it.

**What A2 deliberately did not do:** list Groq's Orpheus voices. A model answer
is the wrong place to say a lane has no adapter — ADR 0106 keeps *no adapter*,
*role denied* and *credential missing* as three separate sentences, and folding
one into a model field is how they get conflated. The voices land with F1.

Counts: `cargo test` 748 passed / 3 ignored (**+8**, all new: three in
`registry.rs`, two each in `groq.rs` and `local_preview.rs`, one in `mod.rs`),
`cargo check` 15 warnings unchanged. Nothing in `src/` changed but
`types/providers.ts`, which is types only; `npm run build` passes and the
frontend suite is unmoved by this step. **Its absolute number is no longer the
baseline's 474**: the sidebar work that landed the same day (`b330815`, ADR
0111) added six cases to `WorkspaceWindow.test.tsx`, so the tree reads 480
across 39 files with or without A2 — a change from another track, measured here
so the next step does not read it as this one's.
