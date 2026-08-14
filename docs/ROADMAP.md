# WordScript Roadmap

Status: 2026-08-11

> This is the canonical phase detail. [STATUS.md](STATUS.md) reports the
> current state; [VISION.md](VISION.md) defines the product direction.

The V1 goal is simple: trigger, speak, receive usable text, recover safely,
and continue working. Each phase must make that path more dependable or more
honest, not merely broader.

## Phase Status

- [x] **Phase 1 - Transcription Bias, Profile Health, Corpus**
- [x] **Phase 2 - Settings Shell Polish**
- [ ] **Phase 3 - Live Preview and Controlled Commit**
- [ ] **Phase 4 - Provider Stack Expansion**
- [ ] **Phase 5 - Local Runtime as a Product Option**
- [ ] **Phase 6 - Guided Setup and Packaging**
- [ ] **Phase 7 - Profile Catalogue and Settings Surface Rework**
- [ ] **Phase 8 - Agents (voice for coding agents, both directions)**
- [ ] **Phase 9 - Voice Nudge**

Outside this pipeline are Notes, Search, Sync, assistant identities, accounts,
hosted workspaces, and browser or computer use. They are V2 or later work and
must not dilute V1. The four surfaces the workspace draws without wiring —
Context, Notes & Meetings, Agents, Integrations — each state their phase on
themselves and do not change this phase boundary.

**MCP is no longer a single fence** (ADR 0029). WordScript **as an MCP server**
is planned work and appears as Phase 8 below. WordScript **as an MCP client in
the dictation path** stays out, permanently rather than provisionally: latency,
the one-commit session model (ADR 0018/0019), the insert contract and the low
confidence of a speech channel each rule it out. MCP as a vocabulary source was
considered and rejected as a distinct feature -- it is the profile context with
a remote origin, and that surface already has a producer and a width (ADR 0021).
Phase 8 does start processes from dictated text, which is not the same thing: the
command and its permission profile are configured once on the target and never
spoken, only the prompt argument is dictated, and a visible keyed confirmation
precedes the start (ADR 0030).

Unscheduled work with an open decision gate is filed below the phases, not
inside them — currently four items: a second paste mechanism on Wayland,
meeting capture, live subtitles, and the live-translation window. Two were added
on 2026-08-05 by relay Leg 4a, which decided the lifecycle of six drawn surfaces
and found that three of them had no roadmap home at all.

**A fifth was added on 2026-08-10 and promoted on 2026-08-11.** *Streaming
recognition and the spoken-output path* was filed as a candidate because the
audio capabilities three surfaces wait on were named only as each other's
blockers. Its first gate — *does any provider on the roadmap stream at all* —
has since been answered against the vendors' own documentation
([PROVIDERS.md](PROVIDERS.md)), and its second by ADR 0095. It is no longer a
candidate; it lands inside Phase 4 and Phase 5, and its entry below records what
the gates returned.

## Phase 1 - Transcription Bias, Profile Health, Corpus

**Status:** completed

**Goal:** Prevent profile-driven transcription drift by making bias explicit,
capturing real failures as regression data, and exposing profile health.

**Delivered:**

- `BiasMode` with conservative, manual, and off behavior plus migration.
- Per-profile manual bias controls and a native/UI transcription-bias preview.
- `ProfileHealthFlag::BiasPolicyWeak` and persisted acknowledgements.
- The regression corpus and loader at
  `src-tauri/tests/fixtures/regression_transcripts.json`.
- A bias-policy stage on Profiles that shows effective cloud and local prompts.

**Success measure:** profile bias is inspectable, regression-tested, and does
not silently turn broad context or snippets into transcription prompts.

## Phase 2 - Settings Shell Polish

**Status:** completed

**Goal:** Make the native utility surfaces calmer and clearer without adding
new runtime heuristics.

**Delivered:**

- Tailwind v4, shadcn/ui components, and shared shell primitives.
- Grouped settings navigation, stable content surfaces, and native window
  decorations on every platform.
- Three background layers, a five-step type scale, standard spacing, and
  focused status primitives.
- WebKitGTK performance work: no card shadows or backdrop filters, contained
  scroll surfaces, fixed background attachment, and a slower history refresh.
- Fixed Linux overlay surfaces, KWin support for KDE Plasma 6, and compositor
  reliability fixes.

**Success measure:** settings, diagnostics, and overlay states remain readable
and stable in the native host on supported platforms.

## Phase 3 - Live Preview and Controlled Commit

**Status:** planned

**Goal:** Let a speaker inspect raw and transformed text, the active mode, and
the delivery decision before final insertion.

**Scope:**

- Extend the current `clipboard_only` preview stop to every insert mode.
- Use one native state path: `idle -> capturing -> processing -> preview ->
  commit | cancel`.
- Use `commit_pending_transcription_preview` as the single commit action.
- Show raw versus transformed text and meaningful guardrail interventions.
- Route commit, retry, restore, cancel, and copy actions through native events
  and history.

**Out of scope:** new auto-commit heuristics, a second insertion implementation,
or changed clipboard restoration rules.

**Success measure:** users can make a delivery decision without duplicating the
native insert or recovery path.

## Phase 4 - Provider Stack Expansion

**Status:** planned. **Widened 2026-08-11** from "a second production provider"
to the complete build-out, by the owner, on the finding that the provider stack
is what blocks the surfaces above it — *no half measures*. The capability survey
that decision produced is [PROVIDERS.md](PROVIDERS.md); the shape is ADR 0094
and the scope decision is ADR 0096, which supersedes ADR 0065.

**Goal:** Evolve from one production adapter to clear `fast`, `quality`,
`local`, and future `self_hosted` semantics — and, since 2026-08-11, to every
lane the surface draws, with the **speech and voice roles built out alongside
chat rather than after it**.

**Scope:**

- **Documented first, then integrated.** A provider's capabilities are read
  against its own documentation and written down before an adapter is written,
  because a capability guessed from a search result is how a surface comes to
  claim something the lane behind it cannot do. **Re-read on 2026-08-11 and it
  caught two of its own**: the survey said OpenRouter has no audio endpoint and
  that speech has no OpenAI-compatible shape for the Self-hosted lane, and both
  were wrong the same way — a page read correctly and a *"not"* written from it.
  ADR 0113 carries what follows. **The rule survives the exception**; what it
  gains is a second clause, which is that a negation needs the second page.
- **The set widened again, on capability rather than on brand** (ADR 0116).
  Only five of the ten drawn vendors transcribe, and the four best at it were
  not drawn at all. Deepgram, ElevenLabs, AssemblyAI and Speechmatics bias the
  recogniser through a **parameter that never becomes decoder text**, which is
  the defect class `known-issues/stt-prompt-leaks-into-the-transcript.md` stays
  open on and that ADR 0017, ADR 0080 and ADR 0081 exist to contain. They enter
  the survey; the synthesis vendors enter as catalogue rows; and **a vendor gets
  its own module only for a reason OpenRouter cannot already answer.**
- **Model names stop living in code** (ADR 0115), as plan stage B3. Three
  uncoordinated places hold them today and they have already drifted a
  generation. One dated catalogue, read by both runtimes, plus a free-typed id
  per lane — so the cost of a new vendor's models is data rather than an edit in
  two languages.
- **The sequence is
  [tracks/speech-track-plan.md](tracks/speech-track-plan.md)**,
  which orders every record in this phase — including the two below, which had
  no position relative to each other, and ADR 0094, which is the precondition of
  both and had none at all. The window class (ADR 0100) and the config echo
  (ADR 0108) were filed unscheduled while no sequence existed; they are stage E
  there, not optional.
- **Two things come before the first adapter and neither is one.**
  **The capability seam** (ADR 0106): `provider_status` returns
  `ProviderCapabilities`, nothing in `src/` reads a field of it, and every
  capability answer on `AI Models` comes from a hand-maintained table. The code
  that makes the runtime govern the drawing has to exist before ten rows depend
  on it, and it is asserted by a test rather than by a sentence. **And the
  credential resolving per role** (ADR 0105), because a second credential kind
  on one vendor breaks the rule that a job following the connection inherits the
  default's credential — **built 2026-08-11** as plan stage A3, so one of the
  two is done and the seam is the one still outstanding.
- **The contract becomes a trait plus a registry** (ADR 0094). The closed
  `enum ProviderId` dispatch does not survive ten providers, and a provider that
  cannot serve a role does not stub it. **Built 2026-08-11** as plan stage A1 —
  the enum is gone, `core/providers/registry.rs` holds the three role traits and
  the id table, and `VoiceProvider` is declared with no implementation. The
  record's other half — the provider axis splitting per role in the config — is
  not built and is not A1.
- **A capability is asked on two axes** (ADR 0110). *Which roles does this
  vendor serve* is the provider's question; *does this model stream, does it
  name the language it heard* is the model's, because one OpenAI key serves
  `gpt-4o-transcribe` and `whisper-1` and the local lane repeats it across
  Parakeet's online and offline models. **Built 2026-08-11** as plan stage A2 —
  `speech_synthesis` on the provider struct, the other three on
  `ModelCapabilities`, resolved per `(provider, model)` and three-valued so an
  unlooked-up capability is not reported as an absent one. Nothing reads either
  axis yet; that is ADR 0106 and stage B1.
- **No adapter lands before the row that operates it** (ADR 0109). An inert lane
  that says so is honest; a capability with no drawn control is not visible as
  missing at all. This is what gates Groq voice: `voice` is not in `JobKey`, and
  the drawn `Speaking` row offers `Cartesia Sonic-3` and `Kokoro-82M` with no
  provider mark and no credential control. **The gate is half lifted since
  2026-08-11** (ADR 0119): the drawing question that blocked it — one row or two
  — is answered, and the answer is **two**, `voice` and `translation_voice`.
  What remains is drawing them, not deciding them.
- **The speaking palette is committed, and it is four modules** (ADR 0118), on
  the owner's *no half measures*. Cartesia, Bland and MiniMax because OpenRouter
  does not carry them; Azure Speech because OpenRouter carries it without the
  SSML its emotion styles live in. **Ordered by a measurement taken here**, not
  by the vendors' pages — plan steps F4 and F5.
- **Speech gains a streaming contract beside the batch one** (ADR 0095), and
  **voice becomes the ninth job** (ADR 0109) — drawn on `AI Models` today and
  absent from the `JobKey` union.
- **A turn becomes a recording and the stream outlives it** (ADR 0107). This is
  the capture half the streaming contract needs and did not have: today the cpal
  stream's lifetime *is* the recording, bounded by one `max_samples` buffer, so
  there is no way to produce the per-utterance file the first streaming
  implementation transcribes.
- Add a second production provider through the shared Rust provider contract.
- **Split the provider axis per role.** A profile currently holds one
  `provider` field and several models, one per role. The obvious second chat
  provider -- Anthropic or OpenAI -- performs no speech recognition at all, so a
  single provider per profile cannot express "recognize with Groq or locally,
  transform with something stronger." `ProviderCapabilities` already models the
  distinction (`transcription` versus `chat_completion`); only the config
  conflates them.
- Reserve `self_hosted` for user-operated remote or LAN services; it is not
  another name for on-device `local`.
- Drive UI capability, setup, and error copy from `ProviderStatus` and
  `ProviderCommandError`.
- **The target set is ten providers across four lanes** (ADR 0042), and they
  land one at a time rather than as a group. Cloud: Groq, OpenAI, Anthropic,
  Google Gemini, Mistral, xAI, OpenRouter. Enterprise: AWS Bedrock, Azure
  OpenAI, GCP Vertex AI. The enterprise three are not a variation on a bearer
  token -- each authenticates against an account and a region with its own
  credential shape, so each is a separate native adapter. A provider with no
  adapter is offered in no picker; the settings surface lists what is intended
  so the shape is settled, and shows only what can actually run.
- **One connection, and per-job overrides.** ADR 0042 makes the settings
  surface state one lane, provider and key that every job follows unless it
  says otherwise. The config has to support that shape directly -- a resolved
  default plus a sparse override per job -- rather than storing a full
  provider/model pair per job and reconstructing what "default" meant.
- **OpenAI takes a second credential kind, and it lands with the OpenAI
  adapter** (ADR 0102). A ChatGPT subscription pays for the five chat jobs; the
  API key stays the default and remains the only path for the three speech jobs
  and `voice`, because the backend a subscription reaches serves no recognition
  and no synthesis. It costs a native OAuth + PKCE flow, a loopback listener and
  a capability entry -- **none of which exist in the tree** -- so it is scheduled
  behind the OpenAI adapter rather than beside it. **No other vendor gets this
  path**: Anthropic and Google both prohibited theirs in February 2026 and the
  remaining vendors sell no subscription, which makes this the one place in the
  ten-provider set where the credential shape is a policy question rather than a
  data-shape one. **It also forces the credential to resolve per role**
  (ADR 0105): *follow the connection* follows the provider and never the
  credential, or a speech job on a subscription-paid connection inherits a
  credential that cannot pay for it. That resolution is a precondition for the
  build-out and not a detail of this vendor — **built 2026-08-11** as plan stage
  A3, together with this record's storage half: the kind exists, it is
  inadmissible for speech and voice in the type, and a registry test holds it to
  the one vendor permitted to carry it. What is left here is acquiring a token
  set, which is stage D3.

The motivation for a stronger chat lane is **instruction following, not cost**.
Real usage sits below a cent, so caching and price are not the argument. The
argument is ADR 0023's rule that a register sets form and never lexis, together
with the writing sample -- subtle instruction following that
`llama-3.3-70b-versatile` is the current limit on. A frontier model is not
required, only a better one. On the local lane the same need is met by a
stronger local model rather than by a new provider.

- **`ProcessingMode::Translate` lands with this phase** (ADR 0041). It is filed
  here and not with the other modes because it is the scope where model quality
  shows first: rendering a German dictation as English prose is a harder
  instruction-following job than tidying one, and the same argument that
  motivates a stronger chat lane motivates this mode being able to reach it. It
  is a mode in the full sense -- cycle, picker, profile default, overlay chip --
  and it is the first with no default hotkey, because the shipped defaults
  occupy `Alt+1` through `Alt+6`. Auto never selects it: **Auto may choose how
  text reads, never what language it is in.** The *live-translation window* is a
  different surface of the same capability, is **not** part of this phase, and
  is a candidate below.

**Out of scope:** runtime provider switching without save, account binding, or
a WordScript proxy.

**Success measure:** at least two production providers work through the same
settings, diagnostics, history, capability, and error contracts.

## Phase 5 - Local Runtime as a Product Option

**Status:** planned

**Goal:** Turn `local` from expert environment configuration into a
guided on-device runtime lane.

**Scope:**

- Guided readiness and remediation for the runner, STT model, cleanup endpoint,
  and cleanup model.
- Profile-owned decode and prompt-bias controls with truthful preview.
- Clear fast-versus-quality tradeoffs.
- **In-app model installation left this phase on 2026-08-12**, on the owner's
  instruction, and is now **B5** on
  [tracks/speech-track-plan.md](tracks/speech-track-plan.md)
  under ADR 0122 -- together with the explicit download-or-pull actions that
  were a separate bullet beside it. It moved because the surface was finished
  and inert while the phase that owed it sat behind the whole provider
  build-out. **ADR 0122 also corrects what this bullet used to say**: speech
  models and language models do *not* sit on the same disk under the same
  runtime, because the local chat lane talks to Ollama and Ollama owns its
  store. One surface still, for the memory argument, but two mechanisms.
- **An OpenAI-compatible server, and the decision of whether WordScript ships
  one.** Local language models need a server in front of them, and the surface
  offers two answers: WordScript bundles and manages one, or it talks to the
  Ollama or LM Studio the user already runs. Bundling means a sidecar binary
  with a lifecycle, a port, a start-on-demand path and a shutdown that survives
  a crash -- the pattern the donor uses for its own sidecars, and a real piece
  of packaging work rather than a flag. **Which server, and whether to bundle
  at all, is open and belongs to this phase.**
- **Local streaming recognition, and it is the same decision one level down.**
  `whisper-cli` takes a file and cannot stream. whisper.cpp offers three shapes
  instead -- the `stream` example, `whisper-server`, or linking the documented C
  API -- and picking one is the same question as the paragraph above, asked
  about the speech runtime rather than the language one. **Take it once**
  (ADR 0096). Silero VAD ships with whisper.cpp and the runtime already passes
  its flags here; the cloud lane has no VAD at all.
- **Local voice, priced with the local runtime and not separately.** Kokoro-82M
  is Apache-2.0 and 82M parameters, but its documented runtime is Python --
  a package, `soundfile` and `espeak-ng`, with no ONNX or Rust build on the
  model card. That is the same shape of cost as the local decoder
  ([PROVIDERS.md](PROVIDERS.md)).
- **Detected acceleration, reported rather than configured.** A CPU-only
  machine runs the small models and struggles above 7B, and that has to be
  visible before a 4 GB download rather than after it.

**Out of scope:** non-Whisper engines, distributed local pipelines, and custom
model training.

**Success measure:** a first-time user can configure and use local dictation
without assembling the full runtime from terminal-only instructions.

**Gate:** until in-app installation exists, the local lane is expert
configuration and the surface says so. ADR 0042 makes this a prerequisite for
offering the lane, not an improvement to it. **The gate stays here and is
answered elsewhere:** the work is B5 in the speech track now, and this phase
stops being gated when that step lands -- not when this page is next edited.

## Phase 6 - Guided Setup and Packaging

**Status:** planned

**Goal:** Connect installation, permissions, provider setup, and first useful
dictation into one honest path.

**Scope:**

- Ordered onboarding for microphone, accessibility, provider key or local
  setup, trigger, and a test dictation.
- Settings hints that explain the next blocking action while diagnostics retain
  detail.
- Honest release and update status that distinguishes internal drafts from
  published releases.

**Out of scope:** a shipped auto-updater, signing infrastructure, and app-store
delivery.

**Success measure:** an installer-to-first-dictation path works without asking a
new user to discover Diagnostics first.

## Phase 7 - Profile Catalogue and Settings Surface Rework

**Status:** planned

**Goal:** Decide what profiles a person actually needs in daily use, then ship
that catalogue and a settings surface that can carry it.

Recorded 2026-07-29 after the reliability slice (ADR 0015/0016/0017) made
per-profile behaviour observable for the first time.

The original entry claimed per-profile cleanup settings, processing modes and
workspace context were all verified working in the native host that day, and that
only profile *content* was left. **Corrected 2026-07-30:** only the processing
mode resolved per profile. The cleanup toggles were never read by the runtime and
the workspace-context toggle wrote a value the runtime ignored; both are addressed
in ADR 0020, which removes the dead toggles and makes the mode the only transform
axis. The lesson for this phase: a per-profile control cannot be verified by
observing that behaviour looks right, only by changing the control and observing
that behaviour changes with it.

What is left in this phase is the *content* of the profiles and the surface around
them.

**Scope:**

- Rebuild the curated catalogue from scratch. Delete the local profiles and
  reconsider the shipped set from real daily use rather than from plausible job
  titles: which profiles does a heavy writer genuinely switch between, and what
  vocabulary, replacements, snippets and non-profile settings does each one
  actually need.
- Ship `General writing` as a curated blank profile rather than as a purely
  local one. It is currently the only non-curated profile, which made it the
  only one unaffected by the delivery-mode reset — an asymmetry that should not
  exist by accident. A blank curated baseline also gives every install the same
  starting point.
- Rework the settings surface completely. The information architecture is
  usable but the presentation is not, and the profile panels only became
  coherent enough to redesign against once the bias policy was retired
  (ADR 0017).

**Out of scope:** team sync and shared profile catalogues; both stay V2.

**Success measure:** a new user can pick a shipped profile that matches their
work without editing it first, and an experienced user can see at a glance what
a profile contains and what stays global.

## Phase 8 - Agents (voice for coding agents, both directions)

**Status:** planned. Decided in ADR 0030; nothing is implemented.

**Goal:** Work with coding agents by voice instead of by reading terminals. One
configured orchestrator asks the user out loud when it genuinely needs a
decision, and the user starts work by speaking without opening a repository.

**Scope:**

- **One orchestrator is WordScript's only client.** Coding agents get no MCP
  entry, no snippet and no per-repository setup -- the orchestrator starts and
  drives them, and for them it is the human. It answers what it can and reaches
  the user only for what it cannot. It may compose the question; it returns the
  answer verbatim.
- Transport is MCP, in the Tauri process (no daemon), bound to `127.0.0.1`,
  bearer token plus `Origin` rejection, port written to a port file. No public
  endpoint -- a remote agent cannot reach a local microphone either. A CLI and
  hook-based delivery stay a later addition.
- **Two tools.** `ask` returns immediately and waits for nobody; `await` blocks
  on an event stream, bounded by a budget stored per harness preset. That split
  is what keeps "no client ever waits on a human" literally true.
- The channel cannot carry a monologue: one short spoken field with a length
  limit, an optional small option list, and a context field that is shown and
  never spoken. Exactly one model-generated spoken path exists -- completion and
  error cues are WordScript's own text. Rate limit and per-target mute as the
  hard backstop, visible in the thread and reported to the caller, never silent.
- Spoken questions are serial: one open spoken question at a time, so an answer
  belongs to it by construction rather than by inference. Every question has a
  deadline.
- The microphone belongs to the user: a request during a dictation gets the busy
  answer, and the dictation hotkey ends a bridge session rather than being
  refused. An output guard keeps it from speaking into a call.
- Starting work is one primitive: a **target** -- label, directory, profile,
  default model, and roles (`inspect` read-only, `work` writing, `resume`), each
  with its own command template and permission profile. Configuration hangs on
  the target, never on the utterance. Runs are headless; a discussion is a
  sequence of runs with resume, not an open connection.
- A target is a thread; WordScript owns the thread and supplies it compacted on
  each run, using harness resume where it exists without depending on it.
- Immediate local acknowledgement on start (cue plus thread entry); the start
  confirmation is visible and by key, never by voice.
- Two answer forms: option questions matched purely lexically with an undo
  window, open questions confirmed before they leave with `edit` retained.
- Text-to-speech chosen by time-to-first-byte, not by price: Cartesia Sonic-3 as
  the default preset with the measured TTFB shown, local Kokoro-82M as an
  honestly labelled privacy mode. **The candidates are surveyed in
  [PROVIDERS.md](PROVIDERS.md) as of 2026-08-11, and it found two things this
  line should absorb.** Cartesia publishes **no** time-to-first-byte in its API
  reference — whatever the figure drawn on the agent window came from, it is not
  the vendor's reference, and `AI Models` already reads `Not measured`, which is
  the honest state. And its websocket buffering **defaults to 3000 ms**, which
  would put three seconds in front of every spoken reply if nobody changed it.
  Groq now serves speech synthesis on the connection the product already holds,
  which makes a first audible sentence cost no new credential — at the price of
  covering English and Saudi Arabic only. **And the preset list stops being two
  entries** (ADR 0118): Cartesia, Bland, MiniMax and Azure Speech get modules,
  four more vendors arrive through OpenRouter without one, and the order is
  decided by plan step F4's measurement rather than by this line. **The desk's
  voice is now one of two rows** (ADR 0119) — this bullet is about the desk;
  the conversation's voice has different languages and a different tempo and
  answers on its own row.
- Cascaded barge-in implemented natively in Rust -- Silero VAD plus Smart Turn
  v3, cancelling playback and generation on detected speech, recording with
  pre-roll. The answer window after a question is the default and needs no mode;
  continuous listening stays an option and requires a visible microphone-active
  indicator.
- **The surface is the shipped overlay plus a tab, and a window the tab opens.**
  Revised 2026-08-03 by the settings rework §11.29: "a pill with two wings" was
  followed to the letter first and produced 1038 px of always-on-top furniture
  with a whole application on it. What ships instead is the recording pill
  unchanged except that the mode chip reads `Agent`, a tab out of its left edge
  (the learned-word tab's slot, structurally free because bridge output runs no
  finalization), and a 620 × 340 window carrying ADR 0030's split intact —
  targets and their state on the left, the thread on the right, Compact and New
  Session at the rail's foot.
- **One orchestrator, drawn as one voice** (ADR 0043). The target rail read as
  three agents talking, which argues against the record it implements. An orb —
  idle small, white and still; speaking larger, warm and moving with its own
  amplitude — sits at the head of the rail as the identity the targets are
  indented under, and again in a dash across the window's foot. Bars are plural
  and a sphere is not, which is the whole reason for the shape.
- **The background case is WordScript's own always-on-top notification, not an
  OS one** (ADR 0043). Focus mode and screen sharing suppress OS notifications,
  and a screen share is exactly when an agent is likely to be running; `await`
  blocks until the budget expires, so a question nobody sees is the one failure
  this surface may not have. It is content-protected like the meeting HUD,
  carries the orb, the question and the offered options, and dismisses when
  answered or expired — never on a timer of its own. Its sound is a cue on the
  existing persistent audio stream (ADR 0010), which means a second motif has to
  be composed rather than sampled.
- Its own settings area, named `Agents`. The voice preset itself is a row in AI
  Models like every other model choice (ADR 0042); what stays in `Agents` is
  targets, the answer budget, the notification and the thread.

**Out of scope:** modelling agents. WordScript starts and supervises **one**
configured orchestrator and knows nothing about what it spawns -- no agent
lifecycle, no per-repository session state, no scheduling. Delegation is the
orchestrator's job and is configured in its instruction file, not in this
product. Also out: rebuilding the CLI's controls in the overlay, and mobile or
remote operation.

**Known limits to state rather than discover:** nothing reaches a running agent
through MCP unprompted -- the 2026-07-28 revision abolished server-initiated
requests, so delivery happens at boundaries. Harness-specific channels beside MCP
can do more but are not portable and are not part of this design. A headless run
that ends after eight minutes with an open decision has spent eight minutes; that
is the price of having no back channel. And aider neither supports MCP nor calls
tools autonomously, so "works with every agent CLI" is false as written and must
not be claimed.

**Open before implementation:** the rate-limit thresholds, the answer-window
lengths and the silence threshold (all measurement questions), whether target runs
ever get a mid-run channel, and whether Codex starts MCP servers inside or outside
its sandbox -- undocumented and to be tested.

**Success measure:** a task can be started, clarified and finished by voice
without opening the repository -- and the share of agent questions the
orchestrator answers by itself is measured, because that number is what decides
whether this design was right.

## Phase 9 - Voice Nudge

**Status:** planned. Decided in ADR 0031; nothing is implemented.

**Goal:** Revise the text just produced without dictating the whole passage
again.

**Scope:**

- One spoken instruction produces one revised text. No conversational state.
- Scope is WordScript's own last output from the scratchpad, not the operating
  system's text selection.
- Entered explicitly, never inferred from the transcript.
- Committed through the existing `clipboard_only` preview surface.
- Guarded against drift by a length and similarity check, on the pattern
  `prompt_enhance` already uses.

**Out of scope:** multi-turn refinement, and reading the OS selection. The first
is unvalidated -- no competitor ships it and one publicly retreated from it. The
second moves the feature onto the Wayland portal layer for a scope the product
can already serve without it.

**Success measure:** a nearly-right dictation can be corrected by one spoken
instruction, and a rewrite unrelated to its input is refused rather than shown.

## Candidate - A second paste mechanism on Wayland (libei)

**Status:** candidate, not scheduled. Needs the decision gate below before it
becomes scope.

**The honest motivation.** Not "auto-paste is unreliable on the maintainer's
machine". That was measured on 2026-07-30 and does not hold: 37 real `xdotool`
pastes between 2026-07-27 and 2026-07-30, zero portal denials, which
`history.json` confirms independently (19 `direct_paste` entries, all
`pasted: true`, no `fallback_reason`). The 116 denial lines in the runtime log
were `cargo test` fixtures writing into the developer's real log file — see
[known-issues/rust-test-global-state-isolation.md](known-issues/rust-test-global-state-isolation.md).
The perceived unreliability of "Copy and insert at cursor" is far better explained
by the config revert fixed in ADR 0019, which forced profiles back to
clipboard-only on every load.

The real gaps are structural, and they hold regardless of any one machine:

- **Pure Wayland has no auto-paste at all.** The paste chain is empty by design.
- **Hybrid XWayland has exactly one mechanism.** XTEST via `xdotool`. `enigo` is
  the same XTEST request through another binding and refuses while `xdotool` is in
  `PATH`, so there is nothing independent behind it. See
  [PLATFORMS.md](PLATFORMS.md).

**What is already there, and why it cannot carry input.**
`core/portal.rs` requests a RemoteDesktop session (`CreateSession`,
`SelectDevices`, `Start`) and persists the restore token under
`$XDG_RUNTIME_DIR/wordscript/remote-desktop.token`, so the "Control input
devices" dialog should appear only once per user. But every call shells out to
`busctl --user call`, which opens a fresh D-Bus connection per invocation, and a
portal session is bound to the connection that created it. Sequential `busctl`
calls therefore cannot hold a session open, and `execute_insert_request_with_io`
never reads `self.portal_session` at all — the handle only ever feeds the
diagnostics display. This needs verifying against a live session before it is
treated as settled, but if it holds, no amount of wiring on top of the current
transport produces a usable input path.

**Scope, if it goes ahead:**

- A persistent D-Bus connection. This is the actual cost, and both input APIs
  need it: `NotifyKeyboardKeycode` on the RemoteDesktop interface (older, no
  libei) and `ConnectToEIS` + libei (newer). `zbus`, or `ashpd` which wraps it.
- Since `ashpd` is required either way, enigo's `libei_tokio` feature is the
  reasonable form: it brings the input layer too instead of hand-rolling keycode
  mapping. New transitive dependencies: `reis`, `ashpd`, `futures`, `nom`. All
  pinned to exact versions, as with every other dependency here.
- The driver joins `paste_driver_execution_chain` as a genuinely independent
  entry — for pure Wayland as the only entry, for hybrid behind `Xdotool`.
- `docs/PLATFORMS.md` compositor matrix updated with what actually works.

**Decision gate — measure before writing code:** confirm on KDE Plasma 6 that a
restored RemoteDesktop session injects input **without a prompt per paste**.
Prompt-per-paste is precisely why `wtype` and `ydotool` were rejected, and libei
inherits that risk if the restore token does not do its job. If the prompt
returns on every paste, this candidate dies and clipboard-only stays the honest
default.

**Out of scope:** replacing `xdotool` on hybrid sessions, where it is measurably
reliable; and any per-paste privilege prompt, under any mechanism.

**Success measure:** a pure Wayland session on Plasma 6 completes
"Copy and insert at cursor" with at most one authorization dialog for the
lifetime of the restore token.

## Streaming recognition and the spoken-output path

**Status:** **scheduled.** Filed as a candidate 2026-08-10; promoted 2026-08-11
once its first two gates were answered. **It is not a phase of its own** — the
recognition half lands with Phase 4 and Phase 5, and the spoken half is Phase
8's, which already owned it. What this entry keeps is the map, because four
other entries read it.

**This entry exists to be read before the ones that wait on it**, and its first
finding was that most of it was never homeless.

| Capability | Owner | What waits on it |
| --- | --- | --- |
| **Streaming recognition** | **Phase 4** (cloud lanes that stream) and **Phase 5** (local) — ADR 0095 | live subtitles' echo, the translation window's `Conversation` tab |
| **Utterance segmentation** | the same, and it is a *separate* requirement — ADR 0095 | the translation window's turns |
| Text-to-speech | **Phase 8**, already scoped; the candidates are surveyed in [PROVIDERS.md](PROVIDERS.md) | the translation window's spoken output |
| Not speaking over the open microphone | **Phase 8**, already scoped and better than the alternative: cascaded barge-in in Rust (Silero VAD plus Smart Turn v3), cancelling playback on detected speech with pre-roll. A hard mute is the first implementation behind the same seam — ADR 0098 | the translation window, which asks for a plain mute of the recogniser |
| Per-language output-device routing | **Phase 4**, with the voice — ADR 0097 | the translation window |
| A second window class | **Phase 4**, stage E2 — ADR 0100 | all four drawn windows |
| **A turn that is a recording** | **Phase 4**, stage C1 — ADR 0107 | anything that transcribes per utterance |
| **A config change that reaches every window** | **Phase 4**, stage E1 — ADR 0108 | any machine-wide setting drawn on a pop-out |
| **A surface that reads a runtime capability** | **Phase 4, before the first adapter** — ADR 0106 | every row that claims a lane can do something |

**Streaming recognition had no owner and no precedent in the runtime.**
`providers/mod.rs` has exactly one speech entry point --
`transcribe_audio_file` -- and `capture.rs` records to a file, stops, uploads
and gets text back. There is no partial result anywhere in the contract, and the
session model is built on the batch shape: one recording ends in exactly one
authoritative result and one reducer commit (ADR 0018, ADR 0019).

**Decision gate — what the four questions returned:**

1. ~~**Does any provider on the roadmap stream at all?**~~ **Answered
   2026-08-11** against the vendors' own documentation
   ([PROVIDERS.md](PROVIDERS.md)). **Groq does not** — one file in, one result
   out, no websocket, no `stream=true`, no partials. OpenAI does, in two shapes;
   xAI does, with partials about every 500 ms; Mistral does, configurable below
   200 ms; Azure OpenAI does. Locally it is possible and not on today's path:
   whisper.cpp ships a `stream` example, a `whisper-server` and a C API, and the
   runtime shells out to `whisper-cli`, which takes a file. **So it is neither a
   pure Phase 4 nor a pure Phase 5 question** — it is both, on different lanes,
   which is why this entry has two owners.
2. ~~**Does a streaming path replace the batch path or sit beside it?**~~
   **Answered by ADR 0095: beside.** `transcribe_audio_file` stays the dictation
   path, no partial reaches the session reducer, and ADR 0018/0019 are untouched.
   The contract is `Partial`* then exactly one `Final` per utterance, and its
   **first implementation emits no partials at all** — a segmenter marks the
   turn and the adapter transcribes it as a file.
3. **Is the language switch detectable without a button per turn?** **Half
   answered.** *Where the answer comes from* is settled — the recogniser's own
   detected language, never a button (ADR 0099), and OpenAI, xAI, ElevenLabs and
   Azure all report it while Groq does not. *Whether it is reliable enough*
   remains a measurement, against bilingual fixtures in the regression corpus,
   and it is still the feature's real gate.
4. ~~**Two output devices reopen ADR 0010.**~~ **Answered by ADR 0097.** A
   second, named output stream for speech, on a device selected by name, beside
   the cue stream whose rules are unchanged. `list_native_output_devices` mirrors
   `list_native_input_devices`. The enumeration is the small part; the routing is
   not.

**Out of scope:** the surfaces themselves. Meeting capture, live subtitles and
the live-translation window keep their own entries and their own gates; this one
is only what sits underneath them. `ProcessingMode::Translate` is unaffected and
already shipped -- it is batch, one utterance, one result (ADR 0041, ADR 0071).

**Success measure:** a sentence reaches a caption strip while the speaker is
still talking, and the machine speaks into one output device while recording
from the microphone without transcribing itself.

## Candidate - Meeting capture

**Status:** candidate, not scheduled. Added 2026-08-03. Needs the decision gate
below before it becomes scope, and an ADR before any of it is built. **Three of
its four gates are closed** as of 2026-08-14; the one that remains is gate 3,
and it is a capability question rather than a product one.

**Why it is written down at all.** `NotesArea` ships speaker separation, and
nothing in the product creates a note that contains audio — a note is authored
as text. That is a feature with no entry point, and it was found while reworking
the settings surface rather than while planning a feature. Either the diarization
goes, or the recording that would feed it arrives. This entry is the second
option, stated as a candidate rather than a promise. The layout it would produce
is sketched in
[prototypes/settings-rework](prototypes/settings-rework/README.md) as
*Meeting capture*, and the open problem is
[archive/plans/settings-rework.md](archive/plans/settings-rework.md) §10.4.

**It is a second capture type, not a longer dictation.** A dictation runs for
seconds, captures the microphone, and ends by inserting text at the cursor. A
meeting runs for an hour, captures the microphone *and* system audio, inserts
nothing, and ends as a note. They share the recorder and nothing else.

**It therefore needs a second window, and that window is not the overlay.** The
dictation pill is 440 × 60 with `focus: false`, because taking focus moves the
insert target away from the app being dictated into. A meeting inserts nothing,
so there is no insert target to protect: its window may be moved, resized,
collapsed and focused. This does not relax anything about the pill and does not
reopen the settings rework's §1 — the two are different windows with different
obligations.

**Scope, if it goes ahead:**

- **System-audio capture**, per platform. This is the real cost and there is no
  native path in the runtime today.
- **Echo cancellation.** The microphone hears the speakers, so every remote
  voice arrives twice. A real component, not a flag — and since 2026-08-14 the
  shape is specific enough to price, read off the donor and recorded in
  [ADR 0136](decisions/0136-what-is-taken-from-the-donor-and-the-one-thing-it-does-that-must-not-be.md):
  a **two-stage ONNX model** of the DTLN-AEC family over a 512-sample block with
  a 128-sample shift, 2–24 MB of weights depending on variant, with the speaker
  signal aligned to the microphone by cross-correlation up to 600 ms of lag and
  the pass **skipped rather than guessed** when the reference is silent or
  uncorrelated. **The cancelled microphone is a second view, never a
  replacement** — the raw sources stay on disk, for the same reason ADR 0039
  keeps a failed capture.
- **Content protection on the meeting window.** It floats over a call that is
  often being screen-shared and must not appear in the share or the recording.
- A **dedicated hotkey**, separate from the dictation trigger, plus the three
  other ways in that ADR 0063 decided (see the gate).
- Notes gains the states a session has — recording, transcribing, ready — and
  the note detail becomes transcript-and-notes side by side.

**Decision gate — answer before writing code:**

1. ~~Does capture start from a hotkey, from detecting a call, or both?~~
   **Closed 2026-08-05 by [ADR 0063](decisions/0063-a-meeting-has-four-ways-in-one-of-them-watches-the-microphone-and-only-a-press-ends-it.md).**
   Four ways in: its own hotkey, a calendar offer shortly before the start, a
   detected call, and `Context → New → Record`. **Detection watches which
   process holds the microphone, not which applications are running** — read
   off the donor, whose own process detector is deliberately context-only
   because a meeting app idling in the background is a false positive. That
   means noticing a call needs no system-audio capture at all; the expensive
   capability blocks recording, not noticing. The prompt is ADR 0043's
   notification window carrying a different payload, so it is **not** a third
   surface to own — which is what this gate had assumed. Only an explicit stop
   ends a capture; nothing infers that a call is over.
2. ~~What happens to the audio of a meeting nobody keeps?~~
   **Closed 2026-08-14 by [ADR 0135](decisions/0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md).**
   The drawn default stands — `Until the note is saved`, with `7 days` and
   `Never` beside it — and what was missing was its definition rather than a
   fourth option. It is **three conditions and a holder set, not one event**:
   the session has ended, a transcript with content exists, and nothing still
   holds the recording, where the notes pass, the diarization re-clustering pass
   and a running re-transcribe each count as a holder. Meeting audio takes a
   **second namespace and a second sweep budget** under ADR 0039 rather than
   sharing its `7 days or 20 files`, because twenty dictations are a few
   megabytes and twenty meetings are tens of gigabytes; ADR 0039's two guards
   (`0600`, and the sweep deletes only what it created) carry over unchanged.
   **`Never` means never written**, which requires a lane that streams and is
   therefore inert with a reason on one that does not. A failed meeting keeps
   its audio under every option.
3. Does system-audio capture work without a per-session authorization prompt on
   the target platforms? Same gate, same reason, as the libei candidate above.
   **Still open.**
4. ~~**Is the meeting live-transcribed, or transcribed when it ends?**~~ Added
   2026-08-13 by [ADR 0130](decisions/0130-a-long-recording-is-a-sequence-of-turns-and-the-ceiling-that-binds-it-is-not-the-upload-size.md),
   which found this chapter never mentioned transcribing the recording at all —
   and **withdrawn the same day by [ADR 0131](decisions/0131-every-surface-that-starts-a-job-names-where-it-runs-and-the-drawing-already-decided-more-than-was-read.md),
   which found it already drawn**: `Live transcript` is a `toggle(true)` on the
   `Meetings` job row of `AI Models`. It was never an owner question; it was a
   prototype nobody had read. *This entry stayed stale for a day and is
   corrected here.*

   **What is real is narrower and is not a product question**: the catalogue
   records Groq speech as batch only — no websocket, no `stream=true` — so the
   toggle is drawn on and would be inoperable on the default connection. It
   stays visible, goes inert, and names the reason. That is a **fourth
   `InertReason` kind**, *this lane does not stream*, which
   [ADR 0135](decisions/0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md)
   gave a second caller (the `Never` retention option) and which speech track
   C4 owes. Live transcription still forces the streaming contract (speech track
   D2) and a second credential for anyone on the default connection; what
   changed is that the product answer was already given and only the inert state
   was missing.

**How the recording becomes a transcript, since this chapter never said.**
It is the speech track's C1 and nothing more: *a turn is a recording, the stream
is not* ([ADR 0107](decisions/0107-an-utterance-is-a-recording-and-the-stream-that-carries-a-conversation-outlives-every-one-of-them.md)).
Turns are cut **on silence rather than on a clock**, so there is no overlap to
reconcile and no seam at which a stitcher can duplicate or drop a word —
fixed-length windows were considered and refused on exactly that ground
(ADR 0130). Every existing instrument then applies per turn unchanged, and the
note is the concatenation. **A meeting needs C1 and system audio; it does not
need a chunker.**

**The ceiling that binds an hour is not the audio size.** It is the context
window of the model that writes the notes over the finished transcript — roughly
twenty thousand words for two hours — and **nothing in this repo records a
model's context window today**. That is speech-track C4's, filed as a catalogue
column beside `streaming`.

**The detection half is separable, and do not build it early on that ground.**
A microphone watch, a calendar read and a prompt window need none of the capture
work — and are useless without it, because accepting the offer would have
nothing to start.

**Out of scope:** joining a call as a participant or a bot — WordScript is
local-first and has no server to send one from; and any cloud-hosted meeting
record.

**Success measure:** a one-hour meeting produces a note whose transcript can be
read beside the notes taken during it, with no prompt after the recording
started and nothing of the window visible in a screen share.

## Candidate - Live subtitles

**Status:** candidate, not scheduled. Added 2026-08-05 by relay Leg 4a. Needs
both gates below before it becomes scope, and it is the one of the six drawn
surfaces whose lifecycle is **still undecided** — deliberately, because its
entry point cannot be settled before the capability that would fill it exists.

**It is two features with one name, and they are built apart.** The screen says
so first and then treats them as the two things they are:

| | Captions | Echo |
| --- | --- | --- |
| Reads | the room — system audio | you — the open microphone |
| Lives | its own strip over somebody else's video | bare text under the dictation pill |
| You are | the audience | the speaker |
| Waits on | system-audio capture, which meeting capture scopes | streaming recognition, which nothing scoped until 2026-08-10 — see *Streaming recognition and the spoken-output path* |

**Why it is written down at all.** It was drawn as part of the settings rework
and has never had a roadmap home. Captions share their whole dependency with
meeting capture, so a reader finding one entry and not the other would price the
audio work twice or not at all.

**Two lifecycle answers this entry can already give**, because both reuse a
mechanism the product has rather than inventing one:

- **The echo belongs to the profile.** What makes it appear under the pill for
  *this* dictation and not that one is the active profile at capture start —
  the same rule every other per-profile capture setting follows (§11.7). A
  long-form profile wants it; a quick-reply profile does not. It is off by
  default.
- **The caption strip's placement is the overlay's placement grammar, per
  display, global to the application** — placement mode, display, anchor,
  exactly as `Settings → General` already carries for the dictation overlay. Not
  per source: a strip you place once is a property of your desk, and a
  per-source memory would move it when you switch from a player to a call,
  which breaks the one promise the feature makes.

**Decision gate — answer before writing code:**

1. **What turns captions on?** Their own hotkey, a control on the surface that
   is already capturing system audio, or nothing until a meeting is running.
   Undecided, and it cannot be decided honestly before the capture exists.
2. Does system-audio capture work without a per-session authorization prompt on
   the target platforms? Shared verbatim with meeting capture — the same gate,
   answered once.
3. ~~**Does the recognition path emit partial results?**~~ **Answered
   2026-08-11.** Not today, and **not ever on the lane the product currently
   runs** — Groq's speech path is one file in, one result out. OpenAI, xAI,
   Mistral and Azure OpenAI stream; locally whisper.cpp can, on a path the
   runtime does not use. ADR 0095 puts a `Partial`/`Final` contract beside the
   batch one. **The echo is the surface that genuinely needs partials** — the
   translation window's conversation needs turn boundaries instead, which is a
   different requirement and is priced separately. So this entry now waits on a
   streaming-capable lane being integrated, which is Phase 4, and on
   system-audio capture for its captions half, which is not.

**Scope, if it goes ahead:** the caption strip as its own always-on-top,
content-protected, click-through window carrying its own opaque ground (never
frosted — ADR 0051 excludes exactly this case, and blurring a moving picture
costs a filter pass per frame of somebody else's video); the echo as two text
weights under the pill with its colour measured against whatever is behind it
rather than taken from a token; and the translated strip reading its language
pair from the same place the translation window does.

**Out of scope:** a scrolling caption history. A strip that scrolls is a
transcript window, and a transcript is what the recording is for.

**Success measure:** a sentence being said right now is readable over somebody
else's video on a frame that changes brightness mid-sentence, and the strip
appears in no screen share.

## Candidate - The live-translation window

**Status:** candidate, not scheduled. Added 2026-08-05 by relay Leg 4a. Its
lifecycle is decided —
[ADR 0064](decisions/0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md)
— and its capability is not.

**This is not `ProcessingMode::Translate`.** That is decided (ADR 0041), it
lands with Phase 4, and nothing here touches it. One capability, two surfaces,
one name: the mode is one person writing into somebody else's document; this is
two people at a table who do not share a language. The dictation contract breaks
in three places the moment there are two of them — there is no insert target, no
end, and it has to be heard.

**What ADR 0064 decided:** it is a workspace **view** whose pop-out is the drawn
window; a conversation is a context object **only if the session opts in**, and
opt-in and consent are one field; opting out leaves no file; several pop-outs may
stand but exactly one live conversation may run, because there is one
microphone; the two output routings are per machine and edited in the view; the
voice is a model row in AI Models like every other model choice (ADR 0042).

**Scope, if it goes ahead:**

- **Speech recognition per direction, with a detected switch between the two
  languages.** The switch is the one interaction that decides whether this works
  at a table or only in a demo — a button per turn is a demo. **It needs turn
  boundaries rather than partial results**, which ADR 0095 separates: a
  segmenter marks the utterance and one authoritative result closes it. Where
  the direction comes from is ADR 0099 — the recogniser's own detected language,
  matched against the pair, never a button.
- **Text-to-speech with per-language output-device routing.** Their language out
  loud to the room, yours in your ear. Routing per language is the whole design
  and is the reason this is a desktop product: a phone has one speaker and one
  screen, so both people share both. **The voice itself is Phase 8's** and the
  candidates are surveyed in [PROVIDERS.md](PROVIDERS.md); **the second output
  stream and the device enumeration are ADR 0097**, and they land with Phase 4.
- **A mute of the recogniser for the length of each spoken utterance.** Out loud
  plus an open microphone is the machine transcribing itself. **Phase 8 already
  scopes a better answer** — cascaded barge-in in Rust, cancelling playback on
  detected speech with pre-roll — so this line is a cruder version of work that
  is already planned rather than a requirement of its own; ADR 0098 puts both
  behind one seam and records that the existing `muted` flag is not the
  primitive it looks like.
- **`Silent` as a real setting**, not a broken one — somebody translating a menu
  at the next table wants no sound at all, and it is the same window. A `Silent`
  routing opens no stream rather than opening one and muting it (ADR 0097).
- The consent field on a conversation object, and a fifth workspace view.
- **The pop-out is a member of a window class that does not exist** (ADR 0100).
  Four drawn windows wait on it, and the runtime declares three windows
  statically with no builder anywhere.
- **The routing is machine-wide and the window it is drawn in may stand several
  times** (ADR 0108). The config is the only holder and a write is announced —
  a channel the runtime does not have, because one settings window never needed
  one. The same row is where a device that has disappeared has to say so.
- **A turn has to be a recording before any of this transcribes** (ADR 0107).
  The cpal stream currently lives exactly as long as the recording does.

**Decision gate — answer before writing code:**

1. Is a view plus a pop-out enough interaction for a conversation held at a
   table, where nobody is looking at a workspace? Named as open by the owner
   when the lifecycle was decided.
2. ~~Does this need a processing mode of its own beyond ADR 0041's?~~
   **Closed 2026-08-11 by the owner — no** (ADR 0101). `ProcessingMode::Translate`
   already exists and a second would be redundant. The window changes the mode's
   *inputs* — the target language comes from the session's pair rather than the
   profile — not its transform. The cycle keeps seven entries.
3. Does the language switch detect reliably enough to take no button per turn?
   **Still the feature's real gate, and still a measurement** — but no longer a
   question about whether the signal exists. It does, on OpenAI, xAI, ElevenLabs
   and Azure, and it does not on Groq ([PROVIDERS.md](PROVIDERS.md)). What is
   unmeasured is the error rate, against bilingual fixtures in the regression
   corpus.
4. **Answered 2026-08-12: `capture-soak` ran a night, and the night was clean.**
   A conversation is the longest capture this product would ever run, on the
   input stream that carries an open, uncaused loss of 12–52 % across 11
   recordings
   ([known-issues/capture-loses-half-the-recording.md](known-issues/capture-loses-half-the-recording.md)).
   Eight hours of open stream produced 96 segments, all `Intact` with `no_gaps`,
   where roughly eight events were expected. The gate this question guarded is
   satisfied — it asked for a measurement, not a cause. **The cause is still
   open and the suspicion has moved into the app** (ADR 0084), so a conversation
   surface still ships on a stream with an unexplained failure history; what it
   no longer does is ship on an unmeasured one.

**Out of scope:** practice or language drilling. Evaluated on the drawn screen
and argued down there — VISION names what this product is not, and a drill
built beside a dictation tool competes on an axis that is not ours. The one form
that would not be a copy — the words your own translations kept getting wrong,
offered where the vocabulary already lives — is recorded as a candidate inside
the candidate and nothing is built for it.

**Success measure:** two people hold a five-minute conversation in two languages
with no button pressed per turn, each hearing their own language on their own
device, and nothing is written to disk unless the session said so.

## Dependencies

Phase 7 depends on the reliability slice, because a profile catalogue can only
be judged once profiles measurably change output. Phase 1 underpins trustworthy
preview and settings work. Phase 4 establishes
the contract needed by Phase 5. Phase 6 comes last because setup cannot be
truthful until the paths it guides are reliable. Phase 3 and Phase 4 can move
independently as long as native provider and session contracts remain stable.

## Maintaining This Roadmap

Update this document when phase order, scope, or completion changes. Keep the
summary in [STATUS.md](STATUS.md) aligned, but do not duplicate phase detail in
other documents. A new architecture decision requires an ADR rather than a
roadmap note.
