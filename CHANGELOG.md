# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Template for new releases:

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or capabilities

### Changed

- **The orb has four states and none of them pulses.** `idle`, `listening`,
  `thinking` and `speaking`, each moving the way that state behaves. The
  predecessor had two and a fixed-period keyframe — a heartbeat, which says
  ALIVE in three states where that is the wrong thing to say, and which drives
  a voice with a symmetrical oscillator when speech has no period at all
  (ADR 0049).
- **The focus ring stopped outweighing the primary action.** It was
  `2px solid var(--accent)` at a 2px offset on eight control classes; the
  offset detached it from its control so it read as a warning badge around the
  object. Now a thin saturated core flush to the control plus a wide low-alpha
  halo — quieter at the same visibility.
- **The accent is spent on one thing at a time.** A disabled toggle no longer
  wears it, a status badge is tinted rather than filled, the toggle knob is
  light in both states so an on switch reads as a track rather than a slab, and
  the input meter's fill is neutral until something is worth acting on.
- **Surfaces have material, not only elevation.** One 1px inset highlight on
  the top edge — the edge that turns toward the light — plus a four-step cast
  shadow ladder replacing four hardcoded literals.
- **Home is built around the shortcut.** "Press Ctrl+Super in any app" was the
  most important fact in the product, set at 13 px in the colour for things you
  may skip. It is now keycaps over a field that responds to input level.
- Changes to existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features removed in this release

### Fixed
- Bug fixes

### Security
- Security patches and vulnerability fixes

-->

## [Unreleased]

### Added — the provider survey's second pass, and five records from it

Documentation only. `cargo test` 760 passed / 3 ignored and `cargo check` 15
warnings, both unchanged, which is the whole claim a documentation stage gets to
make.

- **`docs/PROVIDERS.md` gains seven vendors and a section on what a vendor
  actually costs.** The drawn set was chosen when the question was *which
  language model cleans up a transcript*; only five of its ten members
  transcribe. Deepgram, ElevenLabs, AssemblyAI, Speechmatics, Microsoft's
  MAI-Voice family through Azure Speech, MiniMax and Bland are surveyed, each
  with a source and a read-date. The voice candidate table goes from seven rows
  to fourteen and **still has not one time-to-first-byte this document will
  repeat as fact.**
- **The adapter-shape table is the section that answers *can this be
  implemented*.** Eighteen vendors collapse into seven protocol shapes, and the
  answer is per shape rather than per vendor or per model. One module reaches
  four lanes; one transport reaches nine streaming vendors; exactly one entrant
  costs a credential ladder of its own.
- **ADR 0113 — the OpenAI-compatible audio shape is already in the tree.**
  `GROQ_API_BASE` is `https://api.groq.com/openai/v1` and the speech call posts
  to `{GROQ_API_BASE}/audio/transcriptions`, so the one integrated cloud adapter
  is the OpenAI shape with a Groq host. Parameterized by base URL it also serves
  OpenAI, OpenRouter and a user-run `whisper-server` — which is why **the
  Self-hosted lane gains the three listening jobs.** A free base URL is gated on
  HTTPS or a private host. Self-hosted synthesis was not read and is not
  claimed.
- **ADR 0114 — `VoiceProvider` gets a contract.** It carried zero methods, so
  every synthesis vendor was unexpressible rather than merely unimplemented.
  Fourteen candidates across four shapes agree on the same request, so the
  contract is **one method, `synthesize_speech`**, the voice an optional field
  because Azure puts it inside the model id and ElevenLabs beside it. Streaming
  grows beside it later — the order ADR 0095 already set for recognition.
- **ADR 0115 — a model name is a dated row in one catalogue.** Model ids live in
  `core/config.rs`, in `src/screens/data.ts` and in the survey's prose, and
  those three have drifted a generation apart. One versioned data file, read by
  Rust through `include_str!` and imported by TypeScript, held by a test — the
  shape `core::regression_corpus` already has. **It is not `ModelCapabilities`**:
  one records what a vendor documents, the other what an adapter asserts.
- **ADR 0116 — a vendor comes in because it serves a job better.** The four STT
  specialists bias the recogniser through a parameter that **never becomes
  decoder text**, which is the defect class
  `known-issues/stt-prompt-leaks-into-the-transcript.md` stays open on and that
  three existing records exist to contain. And a vendor gets its own module only
  for a reason OpenRouter cannot already answer.
- **ADR 0117 — Azure Speech is a Cloud credential.** Different host, header,
  body format, resource and key from Azure OpenAI; no deployment and no tenant,
  which this repo's own lane definition makes the deciding test. Same
  relationship Polly has to Bedrock — the shared brand is what makes the wrong
  answer look right.
- **`docs/handoffs/PLAN_speech-track-implementation.md` gains B3 and D1a**, and
  G3 stops being one bullet naming nine adapters. **D1a is not gated on a
  drawing answer**, which makes it the reachable path to a second and third
  speech lane while F1 waits on the owner.

### Added — the speaking palette, and the row question answered

- **ADR 0118 — the palette is offered whole.** *No half measures*, the second
  time that instruction has widened a scope after ADR 0096 did it for the lanes.
  **Cartesia, Bland and MiniMax get their own modules because OpenRouter does
  not carry them**; **Azure Speech gets one because OpenRouter carries it
  flattened** — it serves `microsoft/mai-voice-2` without SSML, and SSML is
  where `mstts:express-as` and the eighteen styles on `de-DE-Klaus` and
  `de-DE-Mia` live. **The order follows a measurement on this machine**, not the
  vendors' pages, because not one of the fourteen candidates publishes a figure
  this repo will repeat as fact. Cartesia's 3000 ms default buffer is named in
  advance rather than discovered in a shipped build.
- **ADR 0119 — the `Speaking` group has two rows**, answering the question
  ADR 0109 left with the owner, who delegated it. The desk speaks **as**
  WordScript — ADR 0043's one voice, one body, and the orb has no meaning
  outside agents. The translation speaks **somebody else's words**, in a
  language that is by definition not the user's, at conversational tempo. They
  need different languages (candidates run 8 to 70+), different latencies and
  different budgets, so they are different jobs: `JobKey` gains `voice` **and**
  `translation_voice`, both on the `Voice` role and therefore on one credential.
  **One row for translation, not one per language** — the route is per language
  (ADR 0064), the model is not, and two model rows for one dialogue would mean
  two vendors and two keys inside a single exchange.
- **A defect the question was hiding.** `Translate.tsx` already tells the user
  the voice is *"chosen on AI Models like the rest"* and draws a button there —
  pointing at a group whose only row is explicitly about coding agents. It was
  recorded as *undecided*; one surface was already promising what the other does
  not answer.
- **Plan steps F4 and F5**, and **F1 loses its gate.** F4 is the
  time-to-first-byte measurement that orders F5's four modules; F1 was blocked
  on the owner's drawing answer and is now blocked only on drawing it.

### Changed — two claims the survey made about itself

- **"Audio rides the chat endpoint, not an audio endpoint" was half right.**
  OpenRouter's multimodal page is correct and simply is not the whole API:
  `/api/v1/audio/speech` has existed since 2026-04-18 and
  `/api/v1/audio/transcriptions` since 2026-07-22, both OpenAI-SDK compatible.
  They reach `microsoft/mai-voice-2`, `google/gemini-3.1-flash-tts-preview`,
  `mistralai/voxtral-mini-tts-2603` and `openai/gpt-4o-mini-tts-2025-12-15` —
  **four vendors' synthesis on one key, for no module each.** The drawn
  `stt: false` on that lane is now provably wrong and is open disagreement 11.
- **"Speech has no OpenAI-compatible shape to talk to" contradicted the same
  file eleven paragraphs earlier**, which already recorded that whisper.cpp
  ships `whisper-server`, *"an HTTP server with an OpenAI-compatible API"*.
  `/v1/audio/transcriptions` is a de-facto standard. The drawn refusal on the
  Self-hosted lane's three listening jobs is open disagreement 10 — a drawing,
  so the gallery corrects it, not this pass.
- **The survey's maintenance rules gain the lesson.** Both errors were one
  mistake made twice: a page read correctly and a *"not"* written from it. So:
  before writing that a vendor cannot do something, look for the second page —
  and before writing it about a lane, grep the file for the opposite claim.

### Added

- **The workspace sidebar has a second width, and the window may choose it**
  (ADR 0111). A toggle at the top of the sidebar — drawn in both states, never
  on hover — collapses it to a **56 px rail**: the app icon in place of the
  wordmark, the search field as the icon it already carries, every navigation
  row as its own tile, the active profile as its avatar. It is the same sidebar
  with its labels withheld, not a second sidebar: every rule about a row's
  tile, its active ground, its accent and its hover is untouched, and the label
  stays in the DOM so a row keeps its accessible name and gains the tooltip a
  label would have been. **The choice is remembered** in
  `AppConfig.workspace_nav_rail`, for the reason `color_scheme` is remembered
  there. **The window rails on its own below 760 CSS px** and that is *not*
  written down — dragging a window narrow and wide again expresses nothing, so
  the breakpoint fires on a crossing and the toggle is the authority in
  between.
- **The icon set gains its 79th glyph, and it is the first that is not the
  prototype's.** `demo.js`'s `ICONS` and `iconPaths.ts` were name-for-name
  identical; the prototype's sidebar has one width and therefore no control to
  change it, so `sidebar` is drawn at this set's radii and stroke rather than
  borrowed from lucide.

### Fixed — the workspace at the widths it is actually used at

ADR 0104 closed with a finding and did not act on it: *"The workspace has no
width breakpoint at all. Below the width the design assumes, the layout does not
rearrange — it compresses, and the text column is what pays."* ADR 0111 is that
finding answered. Reported from the running host on 2026-08-11.

- **Every responsive rule measures the column it is drawn in, never the
  window.** `.ws-content`, the settings sheet's scroller and **a pane's detail
  column** all declare `container: ws-column / inline-size`, and the nearest one
  wins. The rail is what makes this the only correct choice: the content column
  is the window minus a sidebar of one of two widths, so two windows of the same
  width can hand their content a column 176 px apart. The four `@container`
  rules that already existed resolved against `.ws-content-inner`, which in a
  pane is the full column and not the half the row sits in — they now measure
  the half.
- **Three tiers, each giving up the cheapest thing left.** At 620 px the inset
  falls from 32 to 24; at 460 px it falls to 16, **`.ws-row` becomes a stack**
  (the control takes its own line, the text column takes the whole row — the
  arrangement `data-layout="stack"` already draws by hand), and **fixed-track
  grids collapse to one column**. A fixed grid track does not degrade, it
  collides: an `auto` track will not shrink below its content, so a legend row
  came out as `sets / how / a / sentence / is / built` with the badge column
  drawn over the top of it.
- **The pane's list column is a range, not a number.**
  `clamp(176px, 32cqi, 236px)`. It was a flat 236 px, which left the detail
  beside it **227 px** at a 695 px window — a profile's whole settings surface
  at three words to a line.
- **`Change in profile` on Home hung 5 px past the content column.** `.ws-grow`
  was `flex: 1` with a zero basis, so on a wrapping row it never took a line of
  its own; an `auto` basis is what lets the wrap the row already declares
  actually happen.
- **AI Models: every control in an open job's well sat hard against the well's
  right edge** while its label sat 25 px in from the left one. The well pays its
  inset on both sides now. The job's model badge also got a shrinkable track,
  so `whisper-large-v3-turbo default` reaches the ellipsis it already had
  instead of pushing itself off the card.
- **The segment control and the note tab strip wrap** rather than running off
  the card; a section head stacks its title and its sentence; and `.ws-cmd`
  gained the `min-width: 0` that makes the scroller inside it reachable.

### Fixed — the profile control

- **The settings sheet's profile control was a link wearing a popup button's
  chevron.** `ProfileSwitcher`'s own note has claimed since Leg 3 that it is
  "the same control in the workspace sidebar and in the settings sheet's
  header"; it was a `SheetProfile` that navigated to Profiles and closed the
  sheet. It is the same component now, in a `sheet` variant — one runtime call,
  one refusal path, two grounds. `SheetProfile` is deleted rather than aliased
  (ADR 0054); the door to Profiles is not lost with it, because every scoped row
  on those screens carries its own.
- **A refused profile switch is visible.** `.catch(() => {})` swallowed the
  runtime's refusal, so the `<select>` sprang back to where it started with
  nothing said — the whole of "sometimes it just does not switch". The sidebar
  prints the sentence; the sheet's header strip draws the refusal on the row and
  carries the sentence in its tooltip.

### Fixed — two things found on the way

- **The Help panel looked transparent and was never transparent.**
  `.ws-menu` carried no `z-index`, and a positioned box with `z-index: auto`
  paints in DOM order among its siblings' positioned descendants — the sidebar
  comes before the content column, so every positioned box in a pane painted
  over an opaque `--bg-surface` panel. It sits at 8 now: above the note's float
  bar and the chat window, below the settings sheet's scrim.
- **The Help panel was clipped to 56 px in the rail.** `.ws-nav` scrolls, and a
  scrolling box clips both axes whatever the other is declared as. It takes the
  same way out `RowMenu` already takes for the pane's head — the caller
  measures, the panel places itself at viewport coordinates — and only in the
  rail, because expanded, an anchored panel is the better one.

### Added

- **`docs/PROVIDERS.md` — the provider matrix, read against each vendor's own
  documentation rather than from memory.** **Ten providers across four lanes**,
  plus the local and self-hosted ones and the voice-only vendors outside the
  drawn set, each row dated and sourced: which of the nine jobs it serves,
  whether recognition is batch or streaming, whether the response names the
  language it heard, and what the credential shape is. It exists because the
  provider stack turned out to be what blocks the surfaces above it, and because
  three of its findings contradict what a search result says. **Nothing in it is
  a claim about this codebase** — the runtime still integrates exactly two
  providers.
- **A ChatGPT subscription can pay for OpenAI's text jobs, and it is the only
  vendor where that is still allowed** (ADR 0102). The API key stays the default
  and stays available; what is added is a second credential kind on the same
  Cloud row. **It reaches five of the nine jobs.** The backend a subscription
  authenticates against serves `/v1/chat/completions` and `/v1/responses` and
  has **no `/v1/audio/transcriptions` and no `/v1/audio/speech`** — so it can
  pay for `cleanup`, `rewrite`, `translate`, `enhance` and `assistant`, and for
  none of `dictation`, `meetings`, `upload` or `voice`. A subscription pays for
  what happens to a transcript, never for producing one. **The equivalents for
  the other vendors exist and two were shut off this year**: Anthropic added the
  prohibition to its terms on 2026-02-19 and enforced it on 2026-04-04, Google
  suspended accounts in February 2026 including paying Ultra subscribers, and
  Groq, Mistral, xAI and Deepgram sell no subscription at all. That refusal is
  part of the record rather than an omission — the cost of getting it wrong is
  the user's account, not a failed request. Auth is planned as a native Rust
  OAuth + PKCE flow, **not a bundled Node proxy**, which would reverse ADR 0001
  and ADR 0091. Planned; not implemented.
- **The four decision gates the roadmap put in front of streaming recognition
  now have answers, and two of them are closed** (ADR 0095, ADR 0097).
  **Groq — the only integrated cloud lane — does not stream at all**: one file
  in, one result out, no websocket, no `stream=true`, no partials, and language
  is a hint rather than a detection. OpenAI, xAI, Mistral and Azure OpenAI do.
  So the roadmap's conditional resolved to something its entry did not
  anticipate: it is neither a pure Phase 4 nor a pure Phase 5 question, because
  streaming exists on several lanes the product intends to carry and none it
  carries today.
- **A streaming contract that stands beside the batch one rather than replacing
  it** (ADR 0095), so ADR 0018 and ADR 0019 are untouched and no partial result
  reaches the session reducer. Its first implementation emits **no partials at
  all** — a segmenter marks the utterance and the adapter transcribes it as a
  file — which is what lets one contract serve a lane that streams and a lane
  that cannot. **Turn boundaries and partial results are separate requirements**,
  and the two surfaces waiting behind this need different ones: a conversation
  at a table needs turns, a caption strip needs partials.
- **The direction of a spoken turn is read off the recogniser, never off a
  button** (ADR 0099) — the gate the roadmap calls the feature's real one. The
  signal exists on four lanes and not on Groq. The rule that carries it is the
  no-match case: an unrecognised turn keeps the direction it had **and says so**
  rather than being silently turned around. Not to be confused with
  `hallucination_detect.rs`'s language-switch signal, which is quality control
  on one finished batch; wiring the two together would make a conversation's
  normal behaviour look like a hallucination.
- **Speech gets a second output stream on a device the user picks** (ADR 0097),
  extending ADR 0010 without weakening a single cue rule. The difference that
  forced a second object rather than a shared one: a cue pre-empts the running
  cue, because a stale cue is a lie about state — **an utterance cut mid-sentence
  is the other person's half of the conversation**.
- **Every drawn lane gets a real adapter** (ADR 0096, superseding ADR 0065),
  documented before it is written. Three of ADR 0065's terms carry over
  unchanged, including the one most likely to be dropped in a build-out: a lane
  that is not yet integrated stays inert **and still says why**.
- **The provider contract becomes three traits plus a registry** (ADR 0094).
  The closed `enum ProviderId { Groq, LocalPreview }` is two match arms in eight
  functions today and eighty at the drawn target. A provider that cannot serve a
  role does not stub it, which moves the absence somewhere the compiler can see
  it — and the provider axis splits per role, because Anthropic transcribes
  nothing and one `provider` field per profile cannot express that.
- **A window class whose geometry belongs to the user** (ADR 0100), for the four
  drawn windows with no runtime host. `DESIGN_SYSTEM.md` has named a five-member
  window family for two legs and **none of the five exists**: three windows are
  declared statically and there is no `WebviewWindowBuilder` in the tree. The
  class is explicitly *not* the path ADR 0089 abandoned — that was content
  height driving repeated `set_size`, and no generic resize command returns.
- **A credential resolves per role, and a job never inherits one its role cannot
  use** (ADR 0105). ADR 0094 wrote its credential rule for the *overriding* job,
  which makes inheritance the operating case for every other one — and ADR 0102
  broke that premise the same day by making the credential kind per role. Set
  the connection to OpenAI, pay by subscription, and `dictation` would inherit a
  credential whose backend serves no recognition, **without the user touching
  that job**. So *follow the connection* follows the provider and never the
  credential; a role with no credential makes the job inert and **names what is
  missing** rather than borrowing the other kind, which would be the role-shaped
  version of the host mistake ADR 0094's security rule exists to prevent.
- **A turn is a recording, and the stream that carries a conversation outlives
  every one of them** (ADR 0107) — the capture half ADR 0095 assumed and did not
  price. `start_native_capture` opens the device *and* begins the recording;
  samples land in one `max_samples`-bounded buffer; `stop_native_capture` takes
  it whole. **There is no way to lift a segment out of a running capture**, and
  a conversation is nothing but segments. Separating the two keeps every
  instrument applying per turn unchanged — `CaptureIntegrity`, `capture_budget`,
  `transcribe_audio_file` — and makes ADR 0095's sentence about transcribing an
  utterance as a file literally true instead of aspirational.
- **`voice` becomes the ninth `JobKey`, and no adapter lands before the row that
  operates it** (ADR 0109). Four records already write contracts against a job
  the type does not carry. The second half is the rule the build-out order
  needed: ADR 0096 schedules Groq voice second while the drawn `Speaking` row
  offers `Cartesia Sonic-3` and `Kokoro-82M` and nothing else, with no provider
  mark and no credential control — **an adapter written under that order is code
  with no control that reaches it**. An inert lane that says so is honest; a
  capability with no drawn control is not visible as missing at all.
- **A machine-wide setting drawn on a surface that stands more than once needs
  an echo the runtime does not have** (ADR 0108). ADR 0097's per-language
  routing is a property of the desk and is drawn inside a window ADR 0064 lets
  stand several times, in webviews that share no state — and **nothing in the
  runtime announces that a setting changed**. The config is the only holder, a
  write is announced, the card states its own scope, and the event takes the
  same `without_secrets()` scrubbing every disk write does.

- **The on-disk compatibility layer is dropped rather than carried** (ADR 0112,
  planned as stage A5; not implemented). Stage A3 had to hold **three**
  compatibility layers over one API key at once to re-key it safely — a retired
  bundle identifier, a pre-role entry name and the plaintext key in the config
  file — and there is nothing behind any of them: `docs/STATUS.md` records **no
  published versioned releases** and `check_app_update` reports the same. So a
  path that exists only to read an older *local* stored shape goes, with its
  field and the tests that hold it. **Three lookalikes stay, and the record
  names them** so a sweep matching the word does not take them: normalization,
  which canonicalizes every value including one written a second ago; tolerance
  at a boundary where something foreign arrives — an imported archive, an IPC
  payload, a shortcut string typed into the UI; and a name that says *legacy*
  about a session state rather than a file shape. **The import door is not the
  config door**: `stt_hints` survives as a field a foreign document may carry,
  while the migration that rewrote this machine's profiles into
  `vocabulary_hints` does not. The window closes at the first published release,
  and the record says so rather than becoming a precedent for deleting
  migrations later.

### Changed

- **A credential belongs to a role, not to a provider** (ADR 0105 and ADR 0102's
  storage half, plan stage A3). The secret-store entry stopped being one string
  per provider and became one per `(provider, role, kind)`, so **clearing the
  chat credential leaves the speech one standing** — a single provider-keyed
  delete was the bug this shape exists to prevent. A role with no credential
  answers inert and **names what it is missing** rather than spending the kind
  the same provider holds for another role, which is the role-shaped version of
  the mistake ADR 0094's security rule prevents and is not softer for happening
  inside one vendor.
  **A save that names no role reaches every role the kind can pay for.** The one
  drawn key row sits on a connection, and the everyday act is *I gave WordScript
  my key* — not *I paid for recognition but not for cleanup*. A save landing on
  one role would leave somebody having done everything the screen asked while
  half the jobs stayed silently inert. Which roles exist is
  `ProviderEntry::roles()`, so a credential cannot be stored for a role with no
  implementation.
  **A subscription is inadmissible for speech and voice in the type** — the
  backend a ChatGPT plan reaches serves no `/v1/audio/transcriptions` and no
  `/v1/audio/speech`, so there is no call to fail — and it is filtered out of
  that fan-out whether or not a caller names a role. Groq accepts an API key and
  says so; the local lane accepts no kind at all, which is what that lane *is*
  rather than a lane missing one. **A registry test holds the subscription kind
  to OpenAI**, so a later vendor cannot inherit ADR 0102's exception by omission.
  `provider_status` answers per role in `role_credentials` and folds them into
  the one connection block conservatively: configured means every role has one,
  because overstating readiness fails a transform silently and understating it
  is visible. The single key a previous build stored is adopted onto every role
  it used to pay for **before** any write or delete touches it, and the config
  migration copies the file aside through `core::backup` first. `cargo test` 760
  passed / 3 ignored (**+12**); `cargo check` 15 warnings unchanged; in `src/`
  only the type mirror moved and `npm run port:diff` reads `ALL EXACT`. **The
  OAuth flow is not here** — acquiring a token set is stage D3, and no vendor
  accepts a subscription today.
- **A capability is asked on two axes, and "does this stream" needs a model**
  (ADR 0110, plan stage A2). *Which roles does this vendor serve* stays on
  `ProviderCapabilities` and gains `speech_synthesis`; *does this model stream,
  does it name the language it heard, does its voice stream* moved onto
  `ModelCapabilities`, answered by `providers::model_capabilities(provider,
  model)` — **both arguments always**, the shape `capture_limits` already had.
  One OpenAI key serves `gpt-4o-transcribe`, which streams, and `whisper-1`,
  which does not, so a contract answering that from the provider alone forces a
  lie on whichever model loses the vote.
  **A model answer is three-valued** — `supported`, `unsupported`, `unknown` —
  because one drawn lane's model list belongs to the vendor and cannot be
  enumerated ahead of time. A capability nobody has looked up is not a
  capability that is absent, and a `bool` would have settled that at the point
  where the value is written, where no reader can tell a guess from a
  measurement.
  **A lane cannot claim a role it did not register**: a registry test holds
  `speech_synthesis` to `voice.is_some()` across the whole table, which is the
  property ADR 0094 wanted from the type and could not get from a struct field.
  Both lanes answer `unsupported` on every model field today — Groq's speech
  endpoint takes a file and returns a result, and the local lane passes `-l` to
  `whisper-cli` and puts the *requested* language back on the response, which is
  echoing rather than reporting. **So the pair differentiates nothing yet**, and
  the vendor whose two models disagree is proved by a fixture in `registry.rs`
  rather than left unproved until its adapter lands. `cargo test` 748 passed / 3
  ignored (**+8**, all new tests); `cargo check` 15 warnings unchanged. Nothing
  in `src/` changed but the type mirror, and **no surface reads either axis** —
  that seam is ADR 0106.
- **The provider enum is gone; dispatch is a registry over three role traits**
  (ADR 0094, plan stage A1 — the first step of the speech track to change code).
  `core/providers/registry.rs` declares `Provider`, `SpeechProvider`,
  `ChatProvider` and `VoiceProvider`; a `ProviderEntry` names one id, its
  aliases and the implementations behind it; and the eight top-level functions
  in `providers/mod.rs` became thin resolvers that look an entry up and call a
  role. **Adding a provider is now a module plus one entry**, where it was an
  edit in eight match statements. **A provider that cannot serve a role does not
  stub it** — the absence is `voice: None`, and `Some(&GROQ)` in that slot fails
  to compile because `Groq: VoiceProvider` is not satisfied, which was verified
  by making it fail rather than by asserting it here. `VoiceProvider` is
  declared and implemented by nobody, and carries no method: the synthesis shape
  belongs to ADR 0097 and ADR 0109, and a signature invented ahead of them would
  be a guess the compiler cannot check.
  **A pure refactor, and the test counts are the proof**: `cargo test` 740
  passed / 3 ignored and `cargo check` 15 warnings, both unchanged; `npm test`
  474 across 39 files and `npm run build` unchanged by construction, since
  nothing in `src/` was touched and every `invoke(` still resolves against
  `invoke_handler`. ADR 0094's other half is untouched and still planned: the
  config holds one `provider` field per profile, not a resolved default plus a
  sparse override per job.
- **Streaming is a property of a model, not of a provider** (ADR 0110). ADR 0094
  named OpenRouter *"the exception that proves the axes are per provider"*; a
  second read of the donor's model registry shows **it is a constant nowhere**.
  One OpenAI key and one endpoint serve `gpt-4o-transcribe` and
  `gpt-4o-mini-transcribe` with `streaming: true` and `whisper-1` without it,
  and the local lane says it again — two of four Parakeet models carry
  `runtime: "online"` and stream, the other two do not, same binary family and
  same installation. **The role is the provider's and the shape is the
  model's**: `speech_synthesis` stays a provider-level role question,
  `transcription_streaming`, `reports_detected_language` and
  `synthesis_streaming` move onto the model entry — which is the axis the user
  is already standing on, since they pick a model per job and never pick a
  "streaming provider". `docs/PROVIDERS.md` had the evidence in its own OpenAI
  section and its sixth open disagreement before the axis was chosen.
- **Bedrock model ids are up to four parts, and the drawn ones are wrong in
  two.** The survey recorded an `anthropic.` prefix; a shipped implementation
  uses `us.anthropic.claude-sonnet-5` and
  `us.anthropic.claude-haiku-4-5-20251001-v1:0` — a cross-region inference
  profile prefix, then the vendor prefix, then optionally a date and a `-v1:0`
  version. The drawn `LANES.Enterprise` rows carry `anthropic.claude-sonnet-4-6`:
  no region prefix **and** a generation behind. Also recorded: all three
  enterprise lanes need a typed model id rather than only Azure, and Azure ships
  with no model list at all — which is the working answer to *the deployment
  name is the model id*.
- **No surface reads a runtime capability, and a record claimed one did**
  (ADR 0106). ADR 0094's first draft called the `ProviderCapabilities` mirror
  *"the seam that stops a surface from claiming a capability the lane behind it
  does not have"*. The struct is mirrored and returned by `provider_status`, and
  **no field of it is read anywhere in `src/`** — `Models.test.tsx` mocks it as
  `{}` and the suite passes, which is the proof nothing consumes it. Every
  capability answer on `AI Models` comes from the hand-maintained `PROVIDERS`
  table in `src/screens/data.ts`, the same booleans `docs/PROVIDERS.md` runs
  three of its open disagreements against. **The drawing states an intent and
  the runtime answers a capability**; the code that makes the second govern the
  first is a step before the first adapter and is asserted by a test rather than
  by a sentence. The false clause is corrected in ADR 0094 and `SPEC.md` in
  place and recorded rather than deleted — asserting a capability the runtime
  does not have is the defect class this repo has a six-leg scar from.
- **`muted` does not do what its name suggests, and a duplex mute cannot reuse
  it** (ADR 0098). Read against `process_samples`: `paused` gates the sample
  push and is subtracted from the effective wall clock; **`muted` gates only the
  level statistics, the voice-activity timestamp and the emitted meter, and the
  audio keeps being recorded**. So the runtime mute that lets the machine speak
  over an open microphone is a third state, and the stretch it holds must come
  off `CaptureIntegrity`'s clock — otherwise every spoken reply pushes a
  conversation toward ADR 0079's `short` verdict and the one instrument this
  repo has for the open capture defect starts crying wolf on its own behaviour.
- **The copy budget is measured now, and `≤ 90 characters, one line` was wrong
  for every row on the surface** (ADR 0092). `.ws-row-ctl` is `flex: none` and
  `.ws-sel` is `width: auto`, so a Select is as wide as the longest option the
  runtime put in it and every one of those pixels comes off the text column.
  Measured in WebKitGTK across 123 rows and 51 conditional states, **one line
  holds between 12 and 73 characters** depending on the control beside it. The
  `≤ 90` was written in four places — `Card.description`, `SectionHeader.description`,
  `DESIGN_SYSTEM.md`'s budget table and the plan's §5.2, where it was also
  promised a lint rule that was never possible — and all four now carry the
  measurement. **Two lines is the drawing's norm**: 62 of the 74 rows over one
  line are the prototype's copy verbatim, and they are deliberately untouched.
- **Three rows stopped printing the runtime text their own control displays.**
  `General`'s `Input device` built four conditional sentences out of the device
  name its Select was already showing and drew four lines — five where a saved
  device is missing — beside an `Input level` row drawing one; the row now
  carries no hint, the standing fact is on the card, and the two exceptional
  states are a `Note` under it with room for a sentence. `General`'s `Anchor`
  named the monitor with the `(Primary)` suffix its own Select carries, where
  the drawing names it `DP-1`. `About`'s release row grew a 68-character summary
  to 172; the five `check_app_update` summaries state their result only, and the
  clause all five shared is on the **This build** section header once.

### Added

- **Text rules can be shared again, and the two halves are on different screens
  on purpose** (ADR 0090). `export_text_rules` and `import_text_rules` have been
  complete in the runtime — schema version, conflict resolution, merge,
  analysis — and reachable from nothing since Leg 3's shell overwrite deleted
  the surface that called them, while `ARCHITECTURE.md` went on asserting the UI
  did it. **Export acts on a thing and import creates one**, so they are not
  drawn as a pair: `Export rules` is the fourth verb on the profile's own row
  menu, where it writes the profile the menu was opened on and needs no picker;
  import is on Privacy & Data beside the full backup, where it lands as a **new**
  profile and replaces nothing — the profile it makes does not exist yet, so
  there is no row for it to act on and no target to choose. Privacy & Data
  carries the export too, with a profile picker, for a reader who is there to
  move data rather than to edit a profile. The import re-mints the file's rule
  ids and runs the legacy vocabulary migration, or every word in an imported
  file would be drawn in the profile and reach no recognizer (ADR 0035).

- **AI Models has a row for the title call** (ADR 0088). ADR 0077 spends a
  chat-model call on every dictation to name the transcript file, and until now
  it was stated in a decision record and on no surface. Titles is a row in the
  Writing group that names the model it runs — the assistant's, resolved through
  `chat_model_for_provider` — and offers no setting, because ADR 0077 gives it
  none. It does not open, and that is the decision rather than an economy: a
  `<details>` whose body holds no control is the affordance that opens nothing.
  Measured both ends: `models` goes from structural 0 | style 0 to **structural
  6 | style 6**, against the 18 | 6 ADR 0087 had priced for a `LaneJobRow`
  shape. A flat row renders `div.job` where a job row renders `details.job`, so
  it occupies its own sibling index space and shifts no path — the 6 are its own
  nodes and one height reported at each ancestor it cascades through.

- **The profile health flag's click opens the flags** (ADR 0085). It had no
  destination because its four kinds point at three different tabs, so it routes
  to none of them: it opens a panel listing each flag with its sentence and the
  door to the tab that holds its cause — `form_conflict` and
  `cleanup_interference` to Context, `length_bias` to Replacements,
  `bias_policy_weak` to **Defaults**, which corrects the Leg 7 record's "Words".
  `bias_mode` has no control anywhere in the product and Words only displays the
  effect, so a door there would have promised a repair it cannot perform. One
  click on an aggregate count landing on the first of three would have been a
  guess presented as a route.
- **A health flag can be acknowledged, which it could not since Leg 3.**
  `acknowledge_profile_health_flag` and its counterpart have been registered
  commands writing a per-profile set that `get_profile_health` reads back and
  derives `level` from — with no caller, because Leg 3's shell overwrite deleted
  the `PromptsTab.tsx` that wrote it. `derive_health_level` was computing a level
  out of a set nothing could write, so a heuristic warning could never be closed.
  An acknowledged flag stays in the list and in the count, because it is still
  true; what it stops doing is colouring the profile.
- **The flag carries the runtime's `level` as its tone.** Red for a conflict the
  model will act on, amber for the ordinary case, green for every flag read and
  accepted. A red profile and an amber one had looked identical.
- **A transcript states how long its audio is** (ADR 0086). `duration_ms` was
  the one §11.23 frontmatter key with no source, and `render`'s own note said it
  would go in "when the record grows a duration" — the record grew one three legs
  earlier in ADR 0079 and nobody connected the two. It is
  `capture_integrity.recorded_seconds`: the audio, not the clock, because that is
  the length of the file the `audio:` key points at and the only one of the two a
  reader can check. Absent on a retry, an upload and every record older than the
  measurement, rather than written as zero.
- **The defect that needed no dictation got a binary that needs no app**
  (ADR 0084). `capture-soak` opens the device WordScript opens, holds it open
  for hours and reports what it delivers — the loss of audio in
  `capture-loses-half-the-recording.md` happens about once per hour of open
  stream, not once per capture, and every diagnostic it needs is written before
  the empty-recording branch, so nobody has to speak into it. It carries
  `CallbackCadence` and `CaptureIntegrity` themselves rather than copies, does
  the same per-callback work minus the `app.emit`, and rotates its books into
  300 s segments from inside a callback so the segments tile the run without a
  seam a dropout could hide in. Not shipped and not reachable from the UI; run
  by hand, writing its own log. **The eleven events are still eleven** — the
  tool exists, a night has not been recorded.
- **The five controls that had no editor behind them have one, and it unfolds
  under the row it acts on** (ADR 0082). Add and Edit on Profiles' Replacements
  and Snippets, a new profile's rename, `More`'s menu, and both calls to
  `analyze_text_rules` — every one of them had been drawn, disabled and carrying
  *"No editor is drawn for this yet"* since Leg 4c, and the prototype draws no
  editor for any of them, so this is the first surface the port designed rather
  than carried across. It is the plane `RawPanel` already opens on: same inset
  ground, same dropped rule above, nothing dimmed and nothing centred. Not a
  dialog, because Settings is already a modal sheet and a second scrim over it is
  the weight ADR 0069 took off Help. The panel holds the draft until Save, so
  Cancel can throw it away and one finished value reaches the config instead of a
  keystroke; the first field takes focus, Enter commits, Escape reverts, and a
  snippet body keeps Enter for its own newline and commits on Ctrl+Enter.
- **`analyze_text_rules` answers where it was asked.** *Check against a sample*
  opens a live preview under the card — what you say, what gets written, and the
  rules that fired by name — and *Show the effective bias* opens what the
  recognizer actually receives beside what deterministic repair can reach.
  Warnings appear **under the rule that caused them**, routed by `rule_ids`,
  which is the pre-port behaviour restored: a list of issues at the top of a
  screen tells the reader something is wrong and leaves them to find it.
- **The rule lists can be reordered, and say why.** `apply_dictionary_entries`
  and `apply_snippet_entries` each fold one entry's output into the next, so the
  order is a value — and it was one the ported list could neither show nor set.
- **A row's actions are a right-click, on every list in both pane screens.**
  Profiles' profile rows and rule rows, and Context's folders and objects, all
  answer with the same compact menu of verbs. Context's is drawn only: the
  context object does not exist in the runtime and the banner still says so, but
  the two rails no longer have two manners.

### Removed

- **The four session commands, which were the Python sidecar's contract**
  (ADR 0091). `start_native_session`, `stop_native_session`,
  `native_session_status` and `complete_native_session` were named in
  `docs/spec/SPEC.md` as the UI surface and had never been invoked from `src/`
  in any commit. The pre-rewrite `wordscript/ipc.py` documents the Tauri →
  Python channel as `start_recording` / `stop_recording` / `abort_recording`:
  the sidecar owned the session state in another process, so the host had to
  drive it from outside. `febc452` carried that command set across and, in the
  same commit, moved trigger, capture and pipeline into the Rust process — so
  the caller became `start_from_native`, `processing_from_native` and
  `complete_processing_session`, which are untouched. `abort_native_session`
  stays, because abort is the one lifecycle transition a user makes.
  `complete_current_transcription` goes with its only caller: it completed
  whichever session happened to be processing instead of the one the result
  belongs to, and the command emitted only `wordscript-native-event`, so any
  caller would have left the overlay in `processing` until ADR 0018's fallback
  fired. `cargo test` unchanged at 740, `cargo check` unchanged at 15 warnings —
  a `pub` item with no user compiles silently, which is why a sweep is the only
  instrument.

- **Six registered Tauri commands that no caller ever reached** (ADR 0089). A
  sweep of the whole `invoke_handler` list against every `invoke(` in `src/`
  found fourteen caller-less commands, not the two the leg was sent for, so they
  are triaged by *why* they lost a caller rather than by whether they have one.
  Removed as superseded: `acknowledge_profile_health_flag` and
  `unacknowledge_profile_health_flag` (the config seam performs that write since
  ADR 0085, and neither took an `AppHandle`, so neither could emit `ready` — a
  second window would never have learned), `get_workspace_context`,
  `app_config_file_path`, `resize_overlay_to_height` and `resize_edit_overlay`,
  plus the five `OVERLAY_EDIT_MODE_*` clamp constants that existed only to bound
  the last two. The resize pair is why this class goes rather than being
  tolerated: it is the dynamic overlay sizing path this codebase deliberately
  abandoned, and leaving it registered keeps a route back into the ghosting in
  `docs/known-issues/overlay-ghosting.md`.

  **Kept rather than deleted, and now listed:** `preview_prompt_enhance` (ADR
  0065 defers it to Phase 8 explicitly), `export_text_rules` and
  `import_text_rules` (complete runtimes whose UI went with Leg 3's overwrite
  and which nothing replaced — a lost capability, not a corpse), and the session
  command shells (`start_native_session`, `stop_native_session`,
  `native_session_status`, `complete_native_session`) plus
  `transcribe_audio_file`, whose functions the Rust pipeline drives directly.

  **Both kept-and-listed entries were settled by Leg 10 the same day**, in
  opposite directions: the text-rules pair got its surface (ADR 0090) and the
  four session commands were removed as sidecar residue (ADR 0091). What
  separated them was not whether they had a caller — neither did — but *why*,
  which is the question ADR 0089 exists to ask. `transcribe_audio_file` remains
  in this class: its function has live Rust callers and only the registration is
  unreached.

  Corrects Leg 8's premise while keeping its rule: `PromptsTab.tsx` never called
  the acknowledge commands — it held acknowledgements in React state and passed
  them to `get_profile_health` as a request field. No commit in the
  repository's history invoked either from `src/`.

### Changed

- **Profiles is wired and has left the gallery** (ADR 0057, ADR 0085). Every
  fact on the screen has a source now, so `runtime` is required, the drawn
  branch and its sample rows are gone, its banner and its gallery entry went in
  the same commit, and `npm run port:diff` measures 25 screens instead of 26 —
  all 25 at structural 0 | style 0. The two departures the screen carried,
  ADR 0068's sixth sub-tab and ADR 0082's create control, are settled rather
  than carried. Its five fidelity cases moved into the wired suite re-expressed
  against a config rather than being dropped.
- **The style meters wait for the runtime's bound instead of falling back to a
  copy of it.** They fell back to a `400` duplicated out of
  `core::communication_style`, which would have kept reading right on the day
  the runtime changed the budget.
- **Adding is `+` in the head of the list it adds to, everywhere** (ADR 0082).
  The product had three shapes for one job — a labelled button at the foot of
  the profile list, another at the foot of each rule card, and Context's `+` in
  a section head. Context's wins: it sits with the count it changes, at the top,
  and stays put while the list grows past the fold.
- **Deleting always asks, at the row.** A replacement or a snippet used to
  disappear on one click with no question while the profile containing it asked
  twice. Both are one press plus one confirmation now, and the panel focuses
  Cancel rather than the danger button. Deleting the active profile hands the
  session to the first one left; the last profile cannot be deleted at all.
- **What stays an icon on a row is only what you repeat positionally** — the
  reorder pair. Edit and Delete left the rule rows for the menu.

- **A capture reports the cadence of its own input stream** (ADR 0083). ADR 0079
  made a short capture say so; this says *how* it went short. `CallbackCadence`
  counts every cpal callback and every stretch over 200 ms in which the stream
  delivered nothing, and the stop writes one line per capture — healthy ones
  included, because 345 healthy captures are what made eight broken ones legible
  in the first place. Each gap carries **the number of samples the callback that
  ended it delivered**, which is what separates the three hypotheses in
  `capture-loses-half-the-recording.md`: an ordinary period on resume means the
  audio is gone (`stream_suspended`), a catch-up-sized one means it only arrived
  late (`late_delivery`), and **no gap at all on a capture that is still short**
  (`no_gaps_but_audio_missing`) means starvation — a positive finding the line
  names rather than reporting nothing unusual. Nothing is logged from the audio
  callback: the gaps accumulate in memory and flush at the stop, because writing
  a file from a realtime audio thread to report a dropout is a good way to cause
  the next one. A pause and a rebuild reset the cadence so an explained outage is
  not counted as the unexplained defect. **No real gap has been observed yet** —
  this instruments a hypothesis, it does not confirm one.
- **The input level is kept per transcription** (ADR 0083). Peak and mean were
  computed on every capture and kept only when the capture came back empty,
  which is the one case that already explains itself. `InputLevelSummary` gains
  `rms` / `rms_dbfs` and is persisted on the history record as `input_level`,
  and written to the runtime log on every capture. **The mean is the part that
  was missing**: a peak is set by one sample, so a cough sets it as well as
  speech does, and a dictation too quiet to transcribe can still report a
  healthy peak. It is what separates "the recogniser is wrong" from "the
  microphone is quiet", and the text cannot be asked. Reported and not acted on
  — `too_quiet` still reads the peak, whose thresholds were derived against it.
  `None` on older records and on a retry, which never touched a microphone.
- **The first genuine mishearing is in the regression corpus.**
  `recognizer_mishears_a_technical_term`: the owner said `tmux`, the recogniser
  produced `D-Max`, and `applied_rules` carries `overlay_edit` — so the ground
  truth is his own retyped word rather than a guess. It is neither of the two
  identified causes, which is the gap `transcription-accuracy.md` names as its
  open headline. The entry asserts that all three stages which could touch it
  decline: the echo strip, the address repair, and vocabulary learning — the
  last because `tmux` is four characters and `MIN_CANDIDATE_CHARS` is five, so
  the one mechanism that would stop this recurring cannot reach a term this
  short. Recorded as a measured limit with a named cost, not lowered on one case.
- **A capture states how much of its own clock it kept** (ADR 0079). Between
  12 % and 55 % of the audio of some recordings is never captured and nothing
  said so: re-measured 2026-08-10 over 634 paired captures, **11 are short and
  the worst — 54.6 % of a 214 s dictation — is the most recent**, its transcript
  reading as a finished piece of German at a third of the expected density.
  `CaptureIntegrity` compares the untrimmed buffer against the effective wall
  clock and travels with the capture to three places: the runtime log on every
  capture including discarded ones, the history record (an `Audio missing` badge
  and a sentence in the raw panel), and a tab beside the result pill **at
  delivery time**, while the text is still in hand. The tab is a statement and
  not a control — audio that was never captured cannot be recovered, and a
  button there would be an offer the runtime cannot keep. Threshold 10 %,
  derived from a gap in the data running from 7.0 % to 12.0 %; nothing under two
  seconds is judged, and `not_measured` is kept distinct from `intact`.
- **WordScript removes its own initial prompt from the transcript** (ADR 0080).
  Whisper echoes the prompt it is given back as if it had been spoken —
  12.5 % of raw transcripts, 6.6 % delivered still carrying it — and on
  2026-08-10 one such sentence reached an agent **as an instruction and was
  followed**. The strip removes an echo of the prompt *this request sent*,
  carried from the request rather than rebuilt. Matching is a normalised
  in-order subsequence because the echo turned out to be a paraphrase, and the
  unit is the sentence, which is what separates a leak from the owner quoting
  the leak. It never restores the displaced words: a wholly-echoed transcript
  comes back empty, and `raw_transcript` deliberately keeps the leak so the rate
  stays measurable.
- **A pluralized form of address is restored to the singular** (ADR 0081).
  `fix das bitte` shipped as `fixt das bitte`. The obvious suffix rule was
  measured first and rejected — it flags 45 tokens in 31 of 136 records of which
  3 are the defect — so the repair reads grammatical **mood**: clause-initial
  verb from a closed table, not a question, no plural addressee, and a particle
  or `dir`/`dich` vouching for it. It is **German-only by declaration**, gated
  on the detected language, because the bare-stem/stem-plus-`-t` pair that is
  the defect exists in no other language WordScript dictates in.

- **Every transcript is a Markdown file, which is what the surface always said**
  (§11.23, ADR 0074). `core::transcript_store` writes one per record that
  produced text, under `~/WordScript/transcripts/<YYYY>/<MM>/<DD-HHMM>-<slug>.md`
  with the frontmatter the drawing specifies, from the one funnel every history
  record already passes through — so "on every path, including the timeout
  fallback" is structural rather than a rule five callers have to remember.
  `history.json` stays the index and carries the path. Delete, Clear and the
  retention sweep take the file with the entry, and the runtime removes only
  paths an entry named: a file you moved or added yourself is not its to delete.
  One file per transcript rather than one per day, so the runtime creates a file
  once and never edits one. Its **filename is a title the model writes**
  (ADR 0077) — two to six words in the transcript's own language, from the chat
  model already configured, so the folder can be scanned rather than only
  walked. The call is made after the text has reached the cursor, once, with a
  four-second timeout, and any failure falls back to the first words: the title
  decides what a file is called, never whether it exists.
- **`Show transcripts in file manager` acts, on all three surfaces it is drawn
  on** — History's row, Home's row and the command palette. The row reveals the
  record's own file; the palette reveals the folder, because that entry is about
  the collection. The only record that cannot is one that produced no text, and
  it says so on the control (ADR 0065).
- **Full export, Full import and Reset all settings** (`core::backup`). The
  export is the config, the history index and the transcript files as one
  archive — "everything local", which is a different thing from History's own
  Export of the index as JSON. Import and Reset copy the config aside before
  they replace anything and answer with where it went. The API key is not in an
  archive and the import says so: it lives in the OS secret store, which is the
  one thing about a machine that does not travel.
- **History's and Home's rows open with what the record is called** (ADR 0078).
  ADR 0070's `Written` / `Heard` segment gains a third reading, `Title`, and it
  is the default: a list of rows each opening with the first sentence of a
  dictation starts every line mid-thought and cannot be scanned. `Heard` stays,
  because the job it was added for — judging transcription accuracy across many
  records — has not gone away. Home draws the same records on the same builder
  and takes the same derivation, without the segment: five rows of the last few
  minutes is not the surface anybody scans. A record the model never named falls
  back to its own words.
- **Home's decision inbox receives a fallen-back delivery** (ADR 0044,
  ADR 0076). The one of its three sources the runtime can already ask about, and
  it draws nothing when nothing is owed — which is the drawing's own rule and
  the common case. Dismissing is recorded on the record, so a question answered
  once does not come back with the next launch. The desk (Phase 8) and a
  meeting's open questions (V2) still have no receiver and the banner says so.
- **The window follows the colour scheme** (§15.3). `window.theme()` answers
  `system` from the host rather than second-hand through the media query, and
  the window chrome moves with the choice — picking Light on a dark desktop was
  leaving a light workspace inside a dark title bar. The overlay is untouched:
  its pill owns a token capsule with one palette by design.

- **Translate is a processing mode you can select** (ADR 0041, ADR 0071).
  `ProcessingMode` gains a seventh value with its own prompt in
  `core::translate`, its own hotkey slot and its own place in the mode cycle. It
  is not a member of the cleanup family: the correction prompt forbids
  translating, so a translation cannot be that prompt with a flag on it. Auto
  never selects it and no communication style applies to it, both by decision
  rather than by omission. Its four settings — the target language, what happens
  when you already dictated in that language, the address form, and whether the
  profile's names and terms survive untranslated — were drawn on AI Models since
  the port and inert; they are live now, in the scope the drawing gives them.
  It ships ahead of its roadmap phase and therefore on the chat model the
  product already runs, which ADR 0071 records rather than leaves to be
  discovered. The target language and the profile-words switch are set on
  `Profiles → Defaults`, under the mode select that makes them apply, and only
  stated on AI Models with the `Per profile` tag as the door (ADR 0072) — the
  rule ADR 0068 had already set for the communication style.
- **The colour scheme survives a restart.** `AppConfig.color_scheme` is the
  config field the palette's three theme rows had been missing: they switched
  the window and persisted nothing, so every launch came back dark. `system`
  stays a deferral rather than a third palette (ADR 0048) — what lands on
  `<html data-theme>` is always the resolved value — and the shipped default is
  `dark`, which is what every window rendered before the field existed.
- **The style budget meters state what the prompt costs**, not what was typed.
  `analyze_communication_style` returns `core::communication_style`'s own
  `CommunicationStyleAnalysis` — what each of the two bounded fields accepted,
  what it dropped, and the characters the result actually spends. The meters
  used to count the characters in the textarea against two constants copied out
  of the runtime, which reads high whenever whitespace collapses, a rule repeats
  or a rule runs past 120 characters; a meter in the red could only ever mean
  "maybe". It now means the runtime really did drop something. The list of what
  was dropped is not drawn: the field's hint states the two rules a reader can
  act on and `REFERENCE.md` carries the rest.
- **The overlay names the target language** (ADR 0073). `Translate` is the one
  mode name that is half an instruction; the other half is two letters, drawn as
  their own chip beside the mode chip and only while that mode is running. A
  press steps through the languages and persists the step. It is inside the
  pill rather than a third side tab, because every offered language has a
  two-letter code — the width is fixed rather than content-dependent, which is
  what makes it affordable in a window whose rounded ends clip past 480px. The
  gallery's overlay cycle grew Translate with it, so the chip is reachable
  without making a recording.
- **The seventh mode ships with no hotkey**, and that is stated rather than
  papered over with `Alt+7`: the shipped defaults occupy `Alt+1` through
  `Alt+6`. The row on Hotkeys is settable like the other six and empty until
  somebody sets it.
- **The communication style has a surface for the first time.** Relay Leg 4d,
  ADR 0068: a sixth profile tab `Style`, in second position, carrying one card —
  the register with its six levels, the length, your rules and a writing sample,
  each free-text field with the budget meter the runtime's own bounds imply.
  `core::communication_style` has been running the whole time and `transform`,
  `agent` and `capture` all consume it, while the prototype pointed at the
  profile for it three times and never drew it. On this machine one of six
  profiles carried `register: quick` with 256 characters of style rules, applied
  to every Rewrite and invisible — which is the exact defect ADR 0023 was
  written against. Nothing in the runtime changed: no Rust, no migration, no new
  field. The `Where each list lands` legend gains a fifth row that states the
  style's narrow scope — Rewrite and the assistant — once, in one place.
- **The search field and the command palette behind it.** `NavSearch` was ported
  in Leg 2 and stood in no window for three legs, because it opens a palette the
  port did not carry. Both sidebars now mount it, as the prototype does, and
  `Cmd`/`Ctrl`+`K` toggles the palette: thirty-one entries in three groups,
  prefix-then-word-start-then-substring ranking, match highlighting, keyboard
  selection that wraps, and a click outside or Escape to dismiss. Twenty-five of
  the entries navigate, the theme actions switch the scheme, and the three that
  act on a transcript ask the runtime whether there is one. What cannot act is
  drawn inert with the reason in the path column.
- **Help opens four addresses over its own row** (ADR 0069, replacing ADR 0066's
  centred modal): the site, Discord, GitHub, and the documentation, which is
  drawn and inert because it has no address yet. The row had been deliberately
  unmounted for three legs for exactly that reason — nothing behind it.
- **History switches which of a record's two texts its rows carry** (ADR 0070).
  `Written` stays the default and is the drawing unchanged; `Heard` retitles
  every row with the recogniser's own words, so the screen you go to in order to
  judge transcription accuracy can be scanned rather than opened fold by fold.
  It narrows nothing and moves no count.

### Fixed

- **The cleanup invention rate was counting three things that were not cleanup.**
  `measure_invented_tokens_in_shipped_corrections` excluded `agent` mode on the
  argument that it writes an artifact from an instruction, so every word of its
  output is new by construction — and that argument covers `translate` and
  `prompt_enhance` word for word, but neither was excluded. Snippet expansions
  were not on the deterministic allowlist although the harness's own doc comment
  claims they are. And a record the user had retyped in the overlay
  (`overlay_edit`) was credited to cleanup, which is the same false claim
  `apply_edited_preview_text` explicitly refuses to make about history. Together
  they reported **11 of 138 flagged (8.0 %)** where the corrected harness reports
  **7 of 135 (5.2 %)**; hand-read, 6 are real, so **4.4 % against the 6.1 % of
  2026-08-02 — which on 6 events against 12 is not a movement and is not
  reported as one.**
- **`shortfall_ratio` was unreadable on any paused capture** (ADR 0079). Pausing
  calls `Stream::pause`, which stops the cpal callback outright, so a paused
  capture emitted nothing and recorded nothing while its clock kept running —
  measured against the raw clock, every paused capture reported a shortfall by
  construction, on exactly the long dictations the metric exists for. Both
  accountings now measure against `effective_elapsed`. A stream rebuild also
  sets `paused` and is deliberately *not* excused: those samples are genuinely
  lost, and a metric that hides real loss is worse than no metric.
- **Retry was greyed out on every record that had succeeded.** The control
  disabled itself whenever `audio_path` was empty — but that is one of the
  runtime's two retry paths, not both: a record that still holds its raw
  transcript re-runs the transform and needs no capture at all. A successful run
  deletes its audio, so the entire set somebody would actually want to re-run
  after fixing a profile or changing a model was refusing, while the runtime
  would have re-run any of it. The screens now state the runtime's own rule, and
  the control is inert only where there is neither a transcript nor a recording.
  It matters more since ADR 0075, because a retry re-runs the record's mode.
- **A retried Agent, Prompt Enhance or Translate record re-runs its own mode**
  (ADR 0075). `retry_transcription_history_entry` called the cleanup family's
  transform for every entry, so three of the seven modes came back conservatively
  tidied instead of re-run — a defect that had been there for two of them since
  they shipped, invisible because a tidied instruction looks like a plausible
  answer. The mode dispatch moved out of the native pipeline's closure into
  `core::mode_router::apply_mode_transform`, where the retry can reach it, and
  the record grows `effective_mode` — what actually ran — because the stored work
  mode keeps `auto` for an Auto record and could not answer.

### Changed

- **The profile list's subline states the mode and one second fact.** It
  returned an identical string for all six profiles on this machine, because two
  of its three clauses could not vary — `recovery_behavior` has one value in the
  type, and the rewrite style is a lossy function of a mode the row was not
  showing. It now reads `Auto · Insert at cursor` or `Rewrite · Client register`:
  the mode, then the register where one is set and the delivery otherwise, which
  is what the prototype's three rows actually draw.
- **A sub-tab row wraps instead of running off its pane.** Leg 4c measured the
  profile's five sub-tabs clipping inside the detail column in WebKitGTK and
  ADR 0068 adds a sixth. An overflow would put a tab behind a scroll this
  surface draws no scrollbar for.

### Added

- **Every wireable surface now reads the runtime.** Relay Leg 4c, six more:
  **Hotkeys** is `native_trigger_status` per slot — the caps, the registration
  badge, the refusal sentence, the activation timings and this session's
  platform summary; the recorder that sets a shortcut releases and restores the
  OS grabs. **History** lists this machine's transcriptions with both filters
  going to the runtime's own query, and View raw, Retry, Restore to cursor,
  Copy, Delete and Export all act. **Profiles** reads and writes the selected
  profile end to end — mode, delivery, workspace context, both recording limits
  against the runtime's ceiling, the word list, the replacements and the
  snippets — and its Context tab is the first text field in the product.
  **AI Models** wires the Groq connection: the credential in the OS secret
  store with its preview, the account plan from `resolve_provider_tiers`, and
  the recording ceiling from the same command Profiles reads. **Home** states
  the trigger, what the activation mode actually does, which mode is effective
  now, and the last five records. **Privacy & Data** writes both retention rules
  and clears the history.
- **Anything the runtime cannot answer is inert and says why.** Not deleted and
  not left looking settable (ADR 0065): the three provider lanes and seven
  provider chips, `Show in file manager`, Add and Edit on the profile lists, the
  two `analyze_text_rules` doors, Full export, Full import, Reset all settings,
  and the seventh mode `ProcessingMode` does not have. Home's decision inbox is
  absent rather than inert, because its three sources have no receiver and the
  drawing's own rule is that nothing is drawn when nothing is owed.
- **ADR 0067** answers the point ADR 0065 left open: `local_preview` is treated
  like every other unpublished provider everywhere it comes up. A surface that
  offers it makes it inoperable, a surface that reports what is running states
  it and marks it, and a diagnostic prints the runtime identifier unchanged.
- **The first four settings surfaces read the runtime.** Relay Leg 4b:
  **About & Updates** states the running binary's version, copies it, and runs
  `check_app_update` — badge, the runtime's own summary and a Check now that
  re-runs it — plus four project links that open. **Diagnostics** is the
  `RebuildLabTab` the shell overwrite gave up, restored onto the ported drawing:
  the slice snapshot, a real capture-to-insert check with per-stage durations,
  the decoded transform rules and the buffered runtime log, on both of its
  mounts. **General** writes every field it draws — microphone, the four sound
  packs, cue volume, the launch signature, the overlay's placement, display and
  anchor, and the result overlay's dwell — lists the machine's real microphones
  and displays, and plays a cue through the runtime's own synthesiser.
  **Delivery & Insert** is `native_insertion_status` in full: platform, tier,
  readiness, strategy, the two-stage driver chain with each driver's real
  availability, and the scratchpad with a Clear that clears.
- **Two decisions taken against the drawn surfaces.** ADR 0065: Groq is the only
  provider WordScript integrates, and `AI Models` keeps every lane it draws with
  the other three disabled rather than deleted or left looking settable — a
  scope decision, not a capability claim. ADR 0066: the sidebar's `Help` row
  opens a small modal with Discord, GitHub and the documentation, which is what
  finally gives three legs' worth of deliberately unmounted row something to
  open.
- **The transform-rule vocabulary is back**, as `src/lib/transformRules.ts` — the
  forty-odd entries that know what `phrase_repetition_collapsed` means, so a
  Diagnostics screen read because something is wrong does not print runtime
  identifiers at the person reading it.

### Known gaps

- **The communication style has no surface and is still applied.** Register,
  length, style rules and a writing sample are per profile in the runtime
  (`core::communication_style`, ADR 0023) and every Rewrite and assistant run
  reads them — the pre-port surface had the controls, the prototype points at
  the profile for them three times, and the profile screen never drew them. A
  profile carrying a non-default register cannot be seen or changed in the
  product. Recorded in the relay's §2.5 and first on Leg 4d; where it goes is
  settled by ADR 0068 — a sixth profile tab, `Style`.
- **WordScript's own initial prompt is transcribed into the output.** The
  prefix sent to Whisper is echoed back as if spoken — at the start, the end or
  mid-text — displacing real speech, and cleanup keeps it because it is a
  well-formed sentence. Measured on 141 records: 15 % of raw transcripts carry
  it, 9 % are delivered still carrying it. Both prompt forms leak, so the
  ADR 0036 floor is not the only source. See
  `docs/known-issues/stt-prompt-leaks-into-the-transcript.md`.
- **Raw transcription accuracy is poor and unmeasured.** Dictated words come
  back as different words often enough that a dictated brief has to be re-read
  before it is trusted. Distinct from the hallucination record: a mishearing is
  fluent, grammatical and in register, so nothing downstream can see it. Nothing
  is measured yet — see `docs/known-issues/transcription-accuracy.md`.

### Fixed

- **Six controls could be disabled and did not look it.** A segment, a provider
  chip, a select, a text field, a hotkey target and a flag all took the
  attribute, refused the click, and rendered exactly as operable as their
  neighbours — so ADR 0065's inert lanes were not visibly inert. Found in the
  native host; every unit test asserting it had passed.
- **A history read could take the window down.** A runtime that answers
  `transcription_history_entries` with anything but a list has not answered, and
  is not a machine with no history.

### Changed

- **Typing no longer writes to disk on every keystroke.** A text field commits
  through a 400 ms debounce while the draft lands in the form immediately; a
  discrete control keeps instant save, and a discrete change flushes a pending
  text commit first so a late keystroke cannot revert it. (plan P1)
- **A view or a settings section you come back to is no longer rebuilt.** Every
  surface the user has actually opened stays mounted with the inactive ones
  hidden, each keeping its own scroll position. (plan P2)
- **The settings sheet's foot says "Every change applies as you make it." again**
  — derived from whether any section writes, rather than typed.

- **Six drawn surfaces got a decided lifecycle, and nothing was built for
  them.** Relay Leg 4a: how each is entered, what holds its state, what
  dismisses it, and what happens to it when the thing it is about ends —
  onboarding (ADR 0060), the agent overlay's three surfaces (ADR 0061), the
  handoff's effect-verb stage and its refusal counters (ADR 0062), meeting
  capture's four ways in (ADR 0063), and the live-translation window (ADR 0064).
  All six are still mounted nowhere, which is correct: five are Phase 6, Phase 8
  or a V2 candidate.
- **Three roadmap entries.** Meeting capture's first decision gate is closed;
  live subtitles and the live-translation window are new candidates, for the two
  surfaces that genuinely had no roadmap home. Live subtitles is the one of the
  six without an ADR — what turns captions on cannot be decided honestly before
  the capture that would carry the control exists, and saying so is the answer.
- **Detecting that a call is happening turns out to be cheap.** Read off the
  donor: watch which process holds the *microphone*, not which applications are
  running — the donor's own process detector is deliberately inert because an
  idle meeting app is a false positive. Noticing a call therefore needs none of
  the system-audio capture that blocks recording one (ADR 0063).

### Changed

- **The product is one window.** The settings window with fourteen flat areas is
  gone; the main window is the workspace — Home, History, Profiles, Context —
  and settings is a modal sheet laid over it at its own scale (plan §11.22),
  opened with `Cmd+,` / `Ctrl+,` and closed with Escape, the scrim or its close
  control. Ten sections in three groups, APP · AI · SYSTEM. The longest list
  anybody scans drops from 14 to 4. The fourteen areas were deleted in the same
  commit that replaced them, and nothing is aliased (ADR 0054).
- **The settings sheet carries its own scale, and not one component moved with
  it.** `.ws-modal-win` redeclares `--nav-w`, `--nav-row-h`, `--content-max`,
  `--content-pad`, `--pad-card`, `--row-py`, `--gap-block` and `--gap-row`;
  every screen inside reads them without knowing it has moved. The same screens
  stand in the gallery at the workspace's scale and still measure exact against
  the prototype there. That was ADR 0052's claim and this is the test of it.
- **The screens moved out of the gallery into `src/screens/`.** A screen in the
  gallery and the same screen in the product are one implementation with two
  sets of props (ADR 0055); leaving them under `windows/gallery/` would have
  made the gallery a dependency of the product, which is that rule inverted.
- **The pre-port shell is deleted.** `FormCard`, `FormRow`, `Sidebar` and
  `StatTiles` went with their last caller, and the `bodyClassName="py-4"`
  patches went with them — the ported card owns its own vertical inset (§11.17,
  ADR 0052) and the patches are the defect that rule exists to prevent. The
  unreferenced `.ws-sidebar-item`, `.ws-btn-primary` and `.ws-btn-secondary`
  utilities in `globals.css` went in the same commit.
- **The two base rules moved to the window root**, where the prototype has them.
  `svg { flex: none }` and the 16 px default icon size were fenced to
  `.ws-content` / `.ws-nav` while the pre-port areas still rendered lucide icons
  under their own assumptions; those areas are gone, so the fence came off onto
  `.ws-win` — which is now also the gallery's root.
- **The diagnostics pop-out mounts the same section the sheet does.**
  `RebuildLabTab` was the pre-port area and could not stay beside its
  replacement (ADR 0054), so the pop-out renders the ported Diagnostics screen.
  `WindowChrome` went with it: ADR 0003 leaves the title to the OS.

### Fixed

- **The overlay's deep link into settings had been resolving to nothing.**
  `SETTINGS_ANCHOR_AREAS` mapped `capture.auto_stop` to the area `input`, which
  had been renamed to `capture` — so the auto-stop tab opened the window onto a
  header with a blank pane under it. The mapping now names a surface as well as
  an id, resolves to Profiles → Defaults where §11.7 put the control, and
  `settingsAnchors.test.ts` fails if it ever stops naming something the
  workspace mounts.

### Added

- **The gallery is reachable in a built application** by
  `Ctrl`/`Cmd`+`Shift`+`Alt`+`G` (ADR 0059). Nothing names it and no affordance
  leads to it — ADR 0055's terms are unchanged. It replaces the temporary route
  edit and full rebuild that four legs paid for instead.

### Added

- **All 25 of the prototype's screens stand in `/gallery` → Screens, each
  measured exact.** Leg 2d took the last ten: Context with its four note tabs
  and both windows over it, the intake's three ways in, Actions & templates,
  meeting capture, the handoff, live subtitles, translation, client
  conversations and the agent overlay. Into the library with them: the note
  grammar (four tabs, the transcript with its timestamps and speaker chips, the
  derived lists that can carry one action each, the linked groups), the window
  family (Ask, Actions, the meeting HUD, the agent window and its
  notification), the folder rail, the intake and its two equal ways in, the
  shipped overlay pill drawn at its real geometry, the caption strip and the
  echo, the translation window with its per-language routing, and the client
  record with the document it ends in.
- **The prototype has turned from source into provenance (ADR 0057).** With the
  last screen standing, the gallery is the source: a disagreement between the
  two is either an ADR or a bug in the gallery. Relay rule 4b — read the
  prototype's builder before you build a screen — expired with the screens it
  applied to.
- **Fifteen of the prototype's 25 screens stand in `/gallery` → Screens.** Leg 2c
  added Notes & Meetings, AI Models, Onboarding and Agents — every tab and every
  one of onboarding's seven steps measured exact. Into the library with them:
  the job list (a row that opens into its own settings rather than navigating to
  them), the model badge that names where a job went, the downloadable model row
  with its size stated before the download, the onboarding rail, the desk's MCP
  readout and the agent thread.
- **The port's check can reach a screen's other states.** `npm run port:diff`
  now takes `models#1` and `onboarding#4`: it drives BOTH surfaces into the
  named sub-tab or wizard step with their own controls before measuring. Whole
  halves of three screens were previously taken on trust. It immediately found
  false positive the fifth — a transitioning colour measured mid-flight, which
  only the port shows because the prototype rebuilds its window wholesale on
  every render and so never transitions at all.
- **Eleven of the prototype's 25 screens stand in `/gallery` → Screens.** Leg 2b
  ported Home, History, Profiles, General, Hotkeys, Delivery & Insert, Privacy
  & Data, Diagnostics, About & Updates, Integrations and the withdrawn Live
  preview & commit, each measured exact against the running prototype. Into the
  library with them: the icon set (79 drawings, `demo.js`'s own — several exist
  nowhere else and each carries the record of which obvious glyph was
  rejected), the orb and its four states, the provider marks and their sprite,
  the list row and its unfolded raw panel, the decision inbox, the pane, the
  connection block, the runtime log and the raw-beside-transformed diff.
- **The port has a check, and it is committed.** `npm run port:diff <screen>…`
  opens the running prototype and the running gallery in one headless Chromium,
  walks both block trees and reports every structural and computed-style
  difference. Leg 2a described the same check as a hand-run selector list;
  writing it down turned up nine defects in the library that no screen showed
  on its own, four measurement false positives worth knowing about, and the one
  fact where the prototype disagrees with itself.
- **The settings sheet's own scale is ported (§11.22).** `.ws-sheet-scale` is a
  scope, not a density: the structure tokens are redeclared inside it and the
  type is not, so a settings screen is demonstrably drawn smaller than a
  workspace screen without one component knowing about it.
- **The controls the design system is made of are in the library.** Leg 2a of
  the GUI port relay ported `demo.css` §6, §3 and §4 into
  `src/components/shell/` and `src/styles/shell.css`: the button with its
  three-value primary material, the icon button, the switch, the segmented
  control, the pop-up button, the text field, the stepper, the slider, the level
  meter with its threshold mark, the key caps, the chips, the note, the check
  list, the action strip, the disclosure, the source list — plus the sidebar and
  content-column grammar Leg 3 builds the product's navigation on. Leg 1 built
  the eight primitives §5.3 names; these are the controls those primitives sit
  next to, and the Design System screen could not be ported without them.
- **The gallery's own pages are ported rather than composed.** Foundations,
  Components, Motion and the gallery window are read out of `SCREENS.ds` in
  `demo.js` — the prototype's sections, in its order, with its copy. Foundations
  gains *Rules this pass added*, the surface ramp and the contrast table, which
  the composed version did not have; Motion is the readout's own six-mode
  exhibit instead of a row of unlabelled swatches. Verified by diffing computed
  styles against the running prototype, property by property.
- **The frost pair is confirmed running in WebKitGTK.** Leg 1 could not settle
  it because no synthetic pointer event reaches the window under this
  compositor. Shown instead by rendering the pair in both states at once and
  capturing the native window: the layer behind is unreadable when frosted and
  crisp when not, so `filter: blur()` on the layer behind does what
  `backdrop-filter` could not (ADR 0051).

### Changed

- **A switch, a stepper and a slider are the prototype's, not a component
  library's.** The switch was a Radix `Switch` whose knob went dark when checked
  — a near-black disc on a saturated track, which reads as an orange slab with a
  hole in it rather than a knob that has travelled — and which measured its own
  thumb with a `ResizeObserver`. The stepper had an editable number field where
  the design has a readout, because a bounded value adjusted by one is two
  buttons and nothing else. The slider is now the prototype's drawing over a
  native `range`.
- **A segmented control is a group of pressed buttons, not a tablist.** A
  segment sets a value and reveals nothing; a sub-tab swaps the panel under it.
  The prototype draws the two differently on purpose and Leg 1 gave both the tab
  roles, which made every value control on the surface announce itself as
  navigation.
- **A gallery draws a live instrument at rest** (ADR 0058). The prototype
  animates its waveform and VU meter from a synthetic envelope because it has no
  microphone; the real components open one. A moving meter on a page that is
  measuring nothing is a claimed measurement, which is the fake readiness the
  runtime rules forbid.

- **The settings rework is in the product.** Leg 1 of the GUI port relay wrote
  the accepted prototype's design system into `src/`: the lifted palette, the
  radius ladder, the material, the type scale with its optical-size axis, frost,
  and three colour schemes. The shipped surface changes colour, shape and
  contrast with it. The prototype under `docs/prototypes/settings-rework/` stays
  the reference and is read-only from here (ADR 0055).
- **A gallery at `/gallery`, and it is where the port is judged.** One
  design-time route in the bundle, lazy, using no Tauri API and linked from no
  product surface: Foundations · Components · Motion · Overlay · Screens. It
  folds in `/overlay-gallery` and `/component-lab`, which are deleted rather
  than aliased. Foundations **measures** contrast and L\* off the live tokens at
  render time instead of printing stored figures, and re-measures when the
  scheme switches, so a number on that page cannot be true of a palette that has
  moved (ADR 0055).
- **Light, dark and system, in the product.** `system` is a deferral resolved
  against `prefers-color-scheme` and re-resolved when the OS changes, never a
  third palette; `<html data-theme>` always carries the resolved value. The
  light ladder is rebuilt rather than inverted — the window sits grey, the card
  is white and comes forward, the sidebar recedes below the window, the accent
  moves to `#b45c00`, and the material signal inverts from a top highlight to a
  warm downward shading (ADR 0048).
- **The eight primitives of the plan's §5.3.** `LaneCard`, `SubTabs`,
  `SectionHeader`, `PreviewBanner`, `EmptyState`, `DangerRow`, `Toolbar` and
  `ScopeTag`, with `Card`, `CardFooter`, `CardRows` and `Row` under them. Each
  reads `--pad-card`, `--row-py` and `--gap-row` rather than a spacing literal,
  which is what will let the settings sheet redeclare the scale in its own scope
  without a component knowing about it. 63 new tests.
- **Frost is a named surface class, and it is not `backdrop-filter`.** Measured
  in WebKitGTK 2.52.4, the engine the Tauri host loads: `backdrop-filter:
  blur(26px)` and the identical alpha with no blur produce the same stripe
  contrast to four decimals (0.0484 against an unoccluded 0.0858). The property
  is inert, `@supports` reports it as supported, and anything built on it looks
  correct in a Chromium preview and ships to Linux as flat translucency. Frost
  is `filter: blur()` on the layer behind, it is a pair rather than a plane
  (the panel goes translucent, the window recedes), and the receding layers
  nest. It applies only to a surface that floats and is transient — never a
  card, never the sidebar, never the overlay (ADR 0051).
- **Four features that had never been drawn.** A translation window with
  one-way and conversation modes and per-language audio routing — theirs out
  loud, yours in your ear, which is the part a phone cannot do because it has
  one speaker for two audiences. Live subtitles as the two separate features
  they actually are: captions over somebody else's audio, and an echo of your
  own voice under the dictation pill. Client conversations, reusing the meeting
  window with consent asked once per client (ADR 0045 is why it is not a second
  window). And the handoff screen finally drawing what crosses the line.
- **Provider chips on AI Models and in onboarding.** A wrapping row of brand
  marks replaces the select, shared through `providerPick()` so the two
  surfaces cannot drift.
- **The settings rework prototype got a typeface, three colour schemes and a
  search.** Archivo and IBM Plex Mono are now bundled as woff2 rather than
  named and never shipped — every judgement made about this surface before
  2026-08-03 was made in Noto Sans on Linux and Segoe on Windows. Light, dark
  and system schemes, with the light ladder rebuilt rather than inverted and
  the accent moved to `#b45c00`, which the identity value cannot substitute for
  on white (ADR 0048). `Cmd/Ctrl+K` opens a palette that searches screens,
  settings and actions, each row carrying the path it lives at (ADR 0050).
- **A component lab at the unrouted `/component-lab`.** The orb, the live
  waveform, the matrix field and the keycap as real React components on the
  shipped tokens, so a motion model is built once rather than in vanilla now
  and React later. Not linked from any product surface and wired to no runtime.
- **A live waveform where a microphone is actually judged.** The level bar
  reports one number as a length and cannot show whether a signal is steady or
  spiky, or whether peaks clip while the average sits far too low. It sits
  above the bar rather than replacing it — the bar carries the discard
  threshold, which is a boundary the runtime applies.
- **A long recording warns you before it stops itself.** In the last quarter of
  the auto-stop — at most two minutes before it — a small countdown appears
  beside the pill and turns urgent near zero. Tapping it opens the setting that
  owns the number. Recordings that never approach the limit never see it.
- **Three recording limits, each named after what it does.** *Stop after
  silence* reacts to you stopping. *Auto-stop* ends a recording that got long,
  early enough that it still goes through. *Processing limit* is the point past
  which nothing can be transcribed at all — it follows the provider, the account
  plan and the model, and Settings recommends keeping the auto-stop a safe
  distance under it (ADR 0038).
- **Account plan for the speech provider.** Groq's free and developer plans
  allow different upload sizes, and with them different recording lengths.
  Selecting the plan is what lets a paying account record to its real limit
  instead of the free one. Providers declare their own plans, so a lane without
  any (the local runtime) shows no control.
- **A failed recording can be retried from the audio.** A transcription that
  times out keeps its recording, and both the overlay's error surface and the
  history list offer a retry that re-transcribes it. Kept recordings are swept
  after seven days or twenty files (ADR 0039).

### Changed

- **The light scheme's muted step missed AA, and nobody had ever measured it.**
  `--fg-muted: #7d766d` computes to 4.48:1 on the white card — under 4.5:1 by
  two hundredths. The prototype's design-system screen prints the dark ladder's
  figures on both sides of its theme switch, so the light values had been chosen
  by eye against the dark ones' roles and never computed. It moves to `#7a736a`
  at 4.68:1, which is the dark side's own 4.71:1 rather than an arbitrary darker
  value. The other five light foregrounds are confirmed by the same measurement
  (ADR 0056, and ADR 0048 is the record that asked for it).
- **Every radius on the surface is now one of four.** `--r-window` 10,
  `--r-card` 8, `--r-control` 6, `--r-small` 4, assigned by what a thing *is*
  rather than by how big it is. The surface had twelve values and no rule, and a
  badge, a status tag, a segmented control, a sub-tab row and a chip were all
  capsules, so every label-shaped thing on screen was a pill. Capsules survive
  only where the object is physically one — a switch track, a level bar, an
  avatar, a status dot, a radio. The overlay keeps its own two radii and is
  untouched.
- **No scrollbar is drawn anywhere, and nothing replaces it.** Profiles showed
  five permanent rails at once. A scrollbar is a control you use twice a session
  and a border you look at continuously, and on a fixed-size desktop window there
  is no doubt about which region scrolls. The edge fade built as a replacement is
  not adopted: a static mask dims every scroller's first and last 20 px
  permanently, and the scroll-driven variant keeps the surface animating.
- **The window is one flat colour.** The two-layer viewport-fixed body gradient
  left with the palette — it was two literal dark hexes and could not be carried
  into the light scheme at all.
- **The focus ring is in the product, not only in the prototype.** It was
  `2px solid var(--accent)` at a 2 px offset, which detached it from its control
  and outweighed the primary action beside it. Now a 1.5 px saturated core flush
  to the control plus a wide low-alpha halo, with the core on `outline` so a
  control inside an `overflow: hidden` scroller keeps its ring.
- **`PermissionsArea.tsx` deleted.** Exported and imported by nothing, and its
  four cards were a strict subset of `InsertRecoveryArea`'s six.
- **The settings rework becomes a port, and the port overwrites.** `0.2.2-alpha`
  has no users, so the alias map and the coexisting-surfaces provisions in the
  plan have nobody to serve: a replaced area is now deleted in the commit that
  replaces it, and area ids are replaced rather than aliased. The semantic
  anchors in `src/lib/settingsAnchors.ts` survive, because the overlay's
  deep-link into `capture.auto_stop` is a runtime contract and not a habit. The
  decision expires at the first distributed build (ADR 0054).
- **The port is judged in a gallery, not against the shipped surface.** One
  design-time route `/gallery` — Foundations, Components, Motion, Overlay,
  Screens — absorbing the two unlinked routes that already exist
  (`/overlay-gallery`, `/component-lab`). A screen is *ported* when it stands in
  the gallery and *shipped* when it is wired, which is what lets a settled
  25-screen design land against a runtime that cannot yet answer half of it, and
  it gives the palette checkpoint a place to happen in WebKitGTK without the
  shipped surface having to change first (ADR 0055). The prototype at
  `docs/prototypes/settings-rework/` is read-only from 2026-08-04.
- **The work runs as a relay on `main`**, tracked in
  `docs/handoffs/HANDOFF_gui-port-relay.md`: six legs, each one session that ends
  green, pushes, records what it did and writes the prompt for the next. Two
  deliberate ordering corrections against the plan's stages — the design system
  lands before the screens, because the prototype had been patching four missing
  rules screen by screen; and P1 and P2 move out of the performance stage into
  the wiring leg, because wiring 25 screens onto a `patch()` that writes config
  on every keystroke would reproduce that fault 25 times.

### Fixed

- **The dot-matrix level readout drew as a 16 × 16 smudge.** The surface's own
  default icon size — the 16 px base rule ported by Leg 2c — captured the
  readout's `<svg>`, because a component that declares its box in `width` and
  `height` ATTRIBUTES loses to any stylesheet. The prototype hit exactly this
  and answered it with an inline style on the SVG it builds by hand; here the
  SVG is upstream's, so the answer is a rule beside the base rule. It was wrong
  everywhere a matrix was drawn, including the six on `/gallery` → Motion.
- **A card's rows and its body could be the wrong way round, and were, three
  times.** The prototype's `card()` renders head, then ROWS, then BODY, then
  foot; `Card` took free children, so the order was the caller's and three
  separate call sites across three legs got it backwards — visible only once
  the card's first/last-child edge rules drew an inset on the wrong side.
  `Card` now takes `body`, and the order cannot come out reversed.
- **A wide preview had no measure.** `.ws-content-inner[data-layout="wide"]`
  was `max-width: none` where the prototype caps it at 900 px, which would have
  let a 620 px window's preview column run to the width of whatever window it
  was opened in. Handoff is the first screen that asks for the layout.
- **Every icon in the ported shell was two pixels small wherever nothing sized
  it.** `demo.css` carries a second base rule — a default icon size of 16 px —
  which was never ported, and which beats a component's own declaration on
  specificity in the prototype exactly as it does here. Every icon Leg 2b drew
  sat under a more specific rule, so the gap only appeared when a screen finally
  drew one that did not: the provider mark inside a job badge.
- **Long recordings could not be transcribed at all.** The transcription budget
  capped the audio duration at 60 seconds before scaling, so an 11-minute
  recording was granted the same 35 seconds as a one-minute one and timed out
  twice. The pipeline watchdog was a fixed 120 seconds and could fire while the
  provider call was still legitimately running. Both now scale with the
  recording (ADR 0038).
- **A failed recording was deleted immediately.** The pipeline removed the
  capture on every path, the error path included, so a timeout destroyed the
  recording before the error finished rendering — and the existing retry needed
  a transcript a timeout never produces. Recoverable failures now keep their
  audio (ADR 0039).

### Added

- **Words & names fills itself.** You never had a chance of filling it by hand.
  To do that you would have to know in advance which words speech recognition
  will get wrong, and you only find that out in the second the text comes out
  wrong — a second you spend inside whatever you were doing, not inside
  Settings. So the list stayed empty and everything built on it was worth
  nothing.

  It learns from the correction that already happens. When the AI cleanup turns
  "cuber netties" into "Kubernetes", that is proof of three things at once:
  the recognizer cannot spell the word, the word is yours, and the sentence was
  enough to identify it. After the same word has been fixed twice, it is added
  to the profile. Correct a word yourself in the overlay before sending it and
  it is added straight away — you saw the wrong text and wrote the right one,
  and there is nothing left to confirm.

  Twice, not once, because the cleanup rephrases too and one near-miss can be a
  coincidence. Rewording, removed fillers, shortened sentences and capitalized
  first words are all ignored on purpose.

  This is not a detour through the AI to reach a result the AI already gave you.
  A learned word is repaired instantly and for free, with no model call, and it
  works in Verbatim where no AI runs at all. It also makes speech recognition
  get the word right in the first place, which no amount of fixing afterwards
  can do.

- **The overlay shows you the word it just learned.** A small tab slides out of
  the pill's left edge, names the word, and withdraws — under two seconds, once,
  with nothing to click and nothing to answer. On a wide pill, where there is no
  room for the word, you get the marker alone rather than a name cut in half.
  The full list lives in Settings -> Vocabulary. See ADR 0035.

- **A communication style per profile**, in Settings -> Modes, read by Agent and
  Rewrite. A register — Authority, Client, Colleague, Friend, Quick message —
  plus a length, your own rules, and a sample of your own writing. The register
  is named after who you are writing to rather than by a formality adjective,
  because four adjectives from one semantic field cannot be told apart in a
  select.

  **The register sets form, never wording.** Formality and youth language are
  different dimensions, and a model's own slang is measurably misaligned with how
  people actually use it — wrong slang reads as parody, where none merely reads
  as plain. So Friend and Quick message carry an explicit ban on the agent
  supplying slang from its own memory or translating it from another language;
  the only sources are your rules and your writing sample. A dated starter
  lexicon (German, English, Spanish, French) can be loaded into your rules, where
  you can read and edit it — never into a hidden layer.

  Precedence is fixed and written into the prompt: preset, then your rules, then
  your sample, with the sample subordinate for form and authoritative for
  wording. Default is off, at which every prompt is byte-identical to before.
  See ADR 0023.

### Changed

- **`DESIGN_SYSTEM.md` stopped contradicting the product.** Two rules went: the
  faux-glass rule that forbade blur outright, and the flat ban on
  `backdrop-filter`. The second is restated as what it is — a property that
  does nothing in the shipped engine and cannot be feature-guarded — rather
  than a style choice that was rejected. Frost takes its place as a surface
  class beside `--bg-base`, `--bg-surface` and `--bg-elevated`.
- **A group's separators run to its edge.** The item carries the horizontal
  inset and the stack spans the card, so a settings group reads as one object
  with divisions rather than as a container with contents (ADR 0052).
- **A level readout sits next to what it measures.** It leaves Home, which
  reported a room nobody was recording, and appears where the recording is
  happening. `wave(n, seed)` is deleted: a frozen bar row on a surface claiming
  to be listening is a fake state, and it stood in two of them (ADR 0053).

### Removed

- **Account & Sync.** There is no WordScript account and none is planned, so
  the surface that explained the absence is gone with it — a settings entry
  promises that a decision lives behind it. Where the data lives is Privacy &
  Data's sentence now; the fact that the accounts you hold are model vendors'
  is stated in About's list of what is not built. This is about the WordScript
  account only and says nothing about local or self-hosted models.
- **Six dead glass utilities.** `.glass`, `.glass-elevated`, `.glass-strong`,
  `.glass-subtle`, `.glass-panel` and `.ws-pill`, plus `--surface-glass` and
  the `glass` variants of `ui/card.tsx` and `ui/window.tsx`. All were
  `backdrop-filter`, none appeared in any markup, and the property does nothing
  in the shipped engine anyway (plan §5.3).

### Fixed

- **The agent window cut off its own answer strip.** It is fixed at 340 px with
  `overflow: hidden`, and two of its grid items kept the default
  `min-height: auto` — a grid item refuses to become shorter than its content,
  so 12 px went over the edge with no scrollbar and no mark: the rail's two
  buttons and the entire answer strip. The inner thread scroller could not help,
  because it only absorbs what the chain above it allows to shrink.
- **Rows inside an open job disclosure started on the wall of their own well.**
  They aligned with the summary's grid rather than with the summary's text, so
  every detail row sat 25 px left of the job it belonged to.

- **WordScript now identifies itself as SW forge everywhere, including to your
  operating system.** The rename from `SW-Bench` to `sw-forge-org` had only
  reached the interface. Underneath, the app still registered itself under the
  old name — and so did the entry your Groq API key is stored in, and the
  address the update check asks for a new release.

  Your saved API key moves with the rename. The first time WordScript starts
  after this update it finds the key under the old name, files it under the new
  one, removes the old copy and notes the move in the runtime log. You do not
  have to enter it again, and nothing about how it is stored changes: it stays
  in the operating system's secret store, never in a configuration file.

  **On macOS you have to grant microphone and accessibility permission once
  more.** macOS ties those grants to the application's identifier, so with a new
  identifier WordScript is a new application as far as the system is concerned.
  There is no way around it. Your settings, history and log are untouched — they
  were never tied to that identifier.

  On Windows, a build from before this change is not replaced by an in-place
  update but installed alongside; remove the old one by hand. This is exactly
  why the change happens now, while there is no public installer, rather than
  after one exists. See ADR 0037.

- **Which words go to speech recognition is no longer yours to pick, and that is
  the point.** The switch existed, and using it the obvious way did the wrong
  thing: you would switch on your most important words — the long product names
  — and those are exactly the ones that get repaired reliably afterwards anyway.
  The words that actually need the slot are the short ones. "Tauri" is five
  characters; once it has come back as "Tori" there is nothing left to work
  with, because no rule can tell those two apart without putting a word in your
  mouth. Operating the switch sensibly spent every slot on the words that needed
  it least.

  So the runtime allocates the few slots itself, shortest first, then by how
  often a word has actually been mangled. Each row says whether the recognizer
  is carrying it. The switch, the capacity counter and the reordering buttons
  are gone — there is no longer a decision behind them. Adding and removing a
  word by hand stays: a name you are about to start using has no dictation
  behind it to learn from.

  Everything in the list still reaches every AI mode and still gets repaired,
  exactly as before. See ADR 0035.

- **Three direction decisions are recorded; none of them is implemented.**
  Documentation only — no runtime behaviour changes with this entry, and the
  features below do not exist yet.

  **The mode formerly called `agent` carries out an instruction; it does not
  act** (ADR 0029). Text in, text out, one call, and no tool-calling surface —
  stated as a contract rather than left as a current limit, because "agent" now
  generally means something this mode deliberately is not. Side-effecting tools
  stay out of the dictation path: a tool loop has no single session end (ADR
  0018/0019), the delivery architecture presupposes a text result (ADR 0011a),
  and speech is a low-confidence channel that must not drive actions (ADR 0016).
  MCP splits into three questions — WordScript as a server is in scope, as a
  client in the dictation path is rejected, and as a vocabulary source is
  rejected as a distinct feature because it is the profile context with a remote
  origin. The mode will be **renamed to `draft`**, which says what comes out of
  it, and the name `Agents` goes to the settings area for coding agents; a
  config written by an older version keeps working. `docs/ROADMAP.md` and
  `docs/VISION.md` are corrected accordingly: they fenced MCP wholesale, which
  is now wrong in one direction.

  **Working with coding agents by voice is planned** (ADR 0030, ROADMAP Phase
  8): an agent asks you out loud when it needs a decision, and you start work by
  speaking instead of opening a repository. One configured orchestrator is the
  only party WordScript talks to — it drives the coding agents, answers what it
  can, and reaches you only for what it cannot. That is the whole point: an
  agent cannot judge what is worth interrupting a person for, and a voice channel
  without that filter would be worse than the terminal, because terminal output
  can be skimmed and speech cannot. The channel is built so a monologue cannot
  travel through it — one short spoken field, everything else silent in the
  thread. It shares capture and transcription and then returns the transcript to
  the caller rather than inserting it, so it is not a processing mode; the mode
  axis stays the transform axis (ADR 0020).

  That record was **revised on 2026-08-01**, before any of it was built, after
  every external claim in it was checked against primary sources. Two arguments
  turned out to rest on things that were not true — a client timeout that is
  documented nowhere and a specification change that never happened — and both
  were replaced; where a claim is only plausible, the word now appears. The
  revision also settles what the first version left open: the orchestrator may
  compose a question but returns your answer **verbatim**, because you can hear a
  wrongly put question and cannot see a wrongly relayed answer. Asking and waiting
  are split into two calls, so nothing ever blocks on a person. Everything
  configurable — model, permissions, profile — hangs on the target you set up
  once, so speech carries intent only and never configuration. Starting a run with
  write permissions is confirmed on screen with a key, never by voice. Questions
  are spoken one at a time, closed questions can be answered with one word, and a
  misheard answer is never forwarded to the agent as a guess. Voices are picked by
  how fast they start speaking rather than by price, and the measured value is
  shown to you. Bridge answers stay out of the transcript history and are not run
  through your text rules, which exist for text that lands in a document.

  **A voice nudge is planned as one shot on known text** (ADR 0031, ROADMAP
  Phase 9): revise what was just produced without dictating it again. The
  assumption going in was that conversational state was missing; no competitor
  ships multi-turn editing and one publicly retreated from it, so it is not
  built. Entry is explicit and never inferred, because inferring it is where
  shipped products break.

- **Every prompt is now written in English**, whatever language you dictate in.
  English instructions are followed more reliably. Each prompt states explicitly
  that the *output* language is the dictated one, so this does not change what
  comes back — the agent prompt forbids answering in the language of its own
  instructions, and the German `um`-is-a-preposition guard is unchanged because
  it is about the dictated language, not the prompt's.

### Fixed

- **Speech recognition was being sent nothing at all when your profile was
  empty, which is not the same as being sent nothing harmful.** With no words &
  names configured — the state almost everyone is in — the provider received no
  opening line whatsoever. That is not a neutral request: with nothing in front
  of it the decoder falls back on what it was trained on, and on quiet or
  garbled audio the nearest thing in that training is subtitles. It is where
  "Thank you for watching!" and "Untertitel im Auftrag des ZDF" come from in a
  recording that contains neither.

  It now always gets one short constant line that says nothing except what
  register this is: dictated notes, ordinary sentences, ordinary punctuation. No
  topic, no vocabulary, nothing that could come from your profile. The
  recognizer preview in Settings shows it, so the panel cannot keep claiming
  nothing is sent. If you switched the recognizer channel off, it stays off.
  See ADR 0036.

- **The AI cleanup no longer glues spelled-out letters into a fake product
  name.** Dictate a name the recognizer does not know and it sometimes writes it
  out letter by letter, getting the letters wrong: `c a u d e code` for
  "Claude Code". Cleanup then fused those letters into `CAUDE-Code` — capitalized
  and hyphenated, the exact shape of a real product name.

  The wrong letters were never the problem; the transcript was already broken.
  The problem is that you can see `c a u d e code` and fix it in a second,
  whereas `CAUDE-Code` looks deliberate and ships. The letters now go back in
  exactly as the recognizer left them.

  It repairs that one word rather than throwing away the correction, unlike the
  other guardrails: they discard the whole thing, which is right when the model
  answered your question instead of cleaning it, and wrong when a five-minute
  dictation is otherwise fine. That trade was decided by counting rather than by
  arguing — 12 of 197 real dictations, 6.1 %. Two related failures were measured
  and are **not** fixed: a garbled word being turned into a plausible different
  one, and a foreign word being translated. No rule that only sees the
  transcript can tell those apart from a correct repair. See ADR 0036 and
  `docs/known-issues/cleanup-invents-tokens-on-broken-input.md`.

- **Prompt Enhance never received your words & names.** Every other AI mode got
  them; this one had no channel for them at all, which made it the only mode
  that could respell your own product names — and the one whose output you paste
  straight into another tool. It gets them now, through the same bounded block
  the profile context uses.

- **Settings stopped teaching the habit it just removed, and stopped counting a
  field it no longer has.** The empty Replacements panel — the first thing you
  see there — still read "add the phrases Groq hears wrong", three lines under a
  description saying the opposite, and the note below advised one entry per way
  a word might be misheard. Both now point at Words & names, which is the list
  that needs no spoken form. "Profile details" also showed "STT hints: 0" next
  to a profile with terms in it: it was counting an old field the panel has not
  edited in a long time. It counts your words & names now.

- **The rule preview now runs the same passes your dictation does.** It built
  its pipeline without the vocabulary list, so the automatic repair never ran
  there — the panel that exists to show you what the rules do was showing a
  pipeline the app does not have. A repair also gets its own entry in the
  applied rules now ("Repaired: Kubernetes") instead of an unnamed one, which
  matters most for the one change you did not write down yourself.

- **Words & names now works, and misheard names no longer need you to guess.**
  Every term in the list reaches all AI modes as context — before, a term with
  its switch off reached nothing at all, anywhere, and even switched on it never
  reached Cleanup or Rewrite.

  Terms of seven characters or more are also repaired automatically. If you say
  "Kubernetes" and it comes back as "cuber netties", it gets fixed — without you
  writing that down first. This is the part Replacements structurally could not
  do: it needs to know the left-hand side, and the recognizer mangles a name
  differently every time, so there is nothing stable to write. Repair runs in
  every mode, including Verbatim where no AI touches your text, and every fix it
  makes is listed in the applied rules.

  It declines more than it could, on purpose. Short terms are left alone —
  "Tauri" and "Tori" are one character apart and no threshold tells them apart,
  so guessing would put a word in your mouth that you never said. Those rely on
  the AI stages, which can read the sentence.

  Replacements keeps its two columns but is now scoped to what it is actually
  good at: shorthand you say deliberately, like "KA" for "Kundenanfrage". The
  fields are named "What you say" and "What gets written" accordingly. See
  ADR 0033.

- **Each word says what it does, on its own row.** Speech recognition takes a
  small, fixed number of words, and everything beyond that used to be dropped
  without a trace. Now every row states whether the recognizer carries it and
  whether it is long enough to be repaired automatically, resolved from what the
  runtime actually did rather than from a rule the settings panel restates. See
  ADR 0034.

  *(The capacity counter and the reordering this entry originally described are
  gone again, unreleased, in the same cycle. Which words the recognizer carries
  is no longer yours to decide — see the learning entry above.)*

- **Profile context stops being judged by a filter it was never meant to
  reach.** The context field asks for topics — its own description says "topics,
  not spellings" — but the settings panel reported those topics as "not sent to
  the recognizer" and two warnings asked you to replace them with acronyms and
  product names. That advice was backwards. The recognizer conditions Whisper on
  literal words, so a topic cannot bias it; the field exists for the AI stages,
  where naming your domain is exactly what helps it pick `SLO` over `slow`.
  Individual terms have their own place in Words & names.

  The warning was not even true: the path it described had already been switched
  off, so nothing from this field was reaching the recognizer at all. It now
  reaches only the AI stages, and no surface reports a rejection that cannot
  happen. The recognizer preview shows what it actually sends — the words you
  switched on — next to what Replacements corrects afterwards.

  The included profiles are back to topics. They had been rewritten to spellings
  in May to satisfy that same filter, which is how `Product and engineering`
  came to read `API / SDK / SQL` instead of `platform constraints / release
  scope`. Every acronym in those lists was already a Replacement, so nothing is
  lost. If you edited the field yourself, it stays exactly as you left it — the
  migration only replaces the untouched original, character for character.

  Two documents described a profile that had not shipped since 25 May, because
  both read a developer's local config rather than the shipped one. The
  measurement behind ADR 0021 read the same file. Its safety conclusion stands;
  what it cannot support is any claim about profile context in general. See
  ADR 0032.

- **Agent mode writes the thing you asked for instead of answering you.**
  Reported from live use: "Hey WordScript, schreib eine E-Mail an Jürgen, er
  soll das und jenes machen" came back as "Ja, das sollte Jürgen auf jeden Fall
  machen … bis heute Abend um 8 Uhr" — a reply to the dictation, with a deadline
  nobody dictated.

  Every rule in the agent prompt was a negative one — no preamble, no invented
  facts, no profile content — and a conversational reply satisfies all of them.
  Nothing said what the output *is*, and nothing fixed the addressee, so with a
  transcript that is formally a message to an assistant the nearest addressee
  was the user. The prompt now opens with what it owes: the transcript is
  dictated speech and never a message to answer, the output is the artifact
  alone, the addressee is the person the instruction names, and an instruction
  that cannot be carried out comes back as plain text rather than a question.

  The Expansive length was the accelerant, not the cause: "spell out context and
  reasoning" is an invitation to narrate the task, and it now describes the
  result instead — develop the instruction's background and framing inside the
  result, never your own reasoning, never facts the instruction does not
  contain. That wording is shared with Rewrite, where it is the same defect
  under another name. See ADR 0026.

- **Switching the active profile during a recording is refused instead of
  half-applied.** The profile decides the recognizer settings, and those are
  committed the moment recording starts — but the pipeline resolved the profile
  again once the audio was ready. A mid-recording switch therefore produced a
  transform built from two profiles at once (label and terms from the new one,
  context and dictionary from the old) on top of a transcription that had
  already run under the old one. The runtime now refuses the switch, in both the
  explicit command and a settings save that would change it, and the switcher
  says why before you try.

  Alongside it, the agent name and the communication style moved into the
  capture snapshot, where the profile text and vocabulary already lived. One
  rule holds now: **during a recording only the processing mode still changes
  anything; everything else applies from the next recording.** Previously the
  agent name and style applied mid-recording while the profile text did not.
  See ADR 0025.

- **The processing mode in Settings and the mode on the overlay no longer drift
  apart.** Reported as: change the mode while recording and the overlay keeps
  showing the old one — sometimes. The "sometimes" was the clue. Two causes:

  A process-global runtime override was set by every mode-change path (overlay
  tap, mode hotkeys) and cleared by none — `clear_processing_mode_override` had
  no caller, because its only consumer was a hook nothing imported. It outranked
  the profile, so the first tap after a start pinned the mode for the rest of
  the process and every later change in Settings was resolved away. With no tap
  since launch it worked; after one tap it never did again. This was not only
  cosmetic: the pipeline reads the same resolver, so it also kept *processing*
  under the stale value.

  The override is gone. Every path that changes the mode already persists it to
  the profile, and the pipeline loads its config after the recording ends — so
  a mode changed mid-recording is on disk before it is read. The profile is now
  the only source.

  Second: saving in Settings emitted no mode signal at all, and the overlay's
  150 ms fetch guard *discarded* calls inside its window instead of deferring
  them, so a save landing in that window was lost with no retry. Every writer
  now emits `wordscript-mode-event`, and the guard coalesces to the last
  request. See ADR 0024.

- **Agent mode no longer writes profile context into what it generates.**
  Reported as: dictate "write an email to X, content Y" and the email comes back
  carrying material from the profile that was never dictated. Three causes in one
  prompt — only one of six context blocks carried any restriction, the system
  prompt actively said to "take the context into account" with nothing on the
  other side, and the whole block sat in the *user* turn one line above the
  instruction, where it was formally indistinguishable from it.

  The context stays, because it is what lets the agent spell your terms and names
  correctly. What changed is its job: it is a reading aid for the instruction, it
  moved into the system prompt behind an explicit prohibition on deriving content
  from it, and the user turn now carries the transcript and nothing else. Snippets
  contribute their trigger without their expansion — an expansion is finished text,
  and it was already applied deterministically at the end of the pipeline, so
  listing it was a second, generative path for the same data. See ADR 0023.

- **The agent name is visible in every mode.** It used to render only while Agent
  was the selected mode — but the name is also the first thing Auto routes on,
  and Auto is the default, so in the default configuration the field deciding
  whether Auto ever reaches Agent was not on screen. The name itself always
  worked; only the surface was missing. Its placeholder now shows the global
  fallback rather than a hardcoded "WordScript".

- **The overlay is no longer placed where no monitor is.** Reported as "the
  overlay becomes completely invisible mid-recording although the recording
  keeps running, and the stop hotkey brings it back". It was never a freeze:
  reveals only ever positioned the window on the hidden→visible transition, so a
  monitor topology change during a session left stale coordinates behind — and
  the union bounding box of a staggered multi-monitor layout has corners no
  monitor covers. Measured on the reporting machine: 18.3% of a 4320x1568 box is
  dark, and the overlay sat at (3840,1508), on nothing. Stop "fixed" it only
  because ending a session parks and hides the window, so the next reveal
  recomputed placement.

  A rectangle intersecting no monitor work area is now treated as a position the
  user cannot have chosen, and is corrected — on every reveal, and on a 2 s
  cadence inside the existing capture monitor loop, because a long recording
  produces no reveals at all. The drag-snap protection is unchanged for every
  position that is actually visible: the check uses intersection, so a pill
  hanging over an edge is left alone, and it reports nothing when no monitors
  can be enumerated (ADR 0022).

- **The end of a clipboard-only session no longer shows buttons that do
  nothing.** For 240 ms after a session ended, the leave hold replayed the
  preview surface from a snapshot with Copy, Edit and Abort wired to handlers
  that had already bailed on the nulled `pendingResult`. The buttons rendered
  fully enabled and correctly labelled, and did nothing — in `clipboard_only`,
  where that surface is the only route to the transcript, that reads as the app
  eating the dictation. The hold is now inert the way the edit-mode branch
  beside it already was, `handleEditOpen` got the guard it never had, and an
  absent handler renders the button disabled.

- **The overlay layer is visible in the runtime log.** Across 755 captures it
  previously carried zero lines about placement, park, monitor choice or work
  area, which is why a misplacement left nothing to read afterwards. Placement
  decisions, stranded-overlay rescues and parks (including the
  requested-vs-applied position, since X11/KWin clamps an off-screen park back
  onto the screen edge) are now recorded in every build.

- **The KWin overlay pin survives a screen change.** It was applied on
  `windowAdded` only, i.e. once per window lifetime, so an output
  reconfiguration silently dropped always-on-top for the rest of the session.

- **`cargo test` no longer writes into the developer's live data.**
  `core::paths::user_data_dir()` had no test seam and always resolved to the
  real `~/.config/WordScript`, so the suite appended its own lines to the real
  runtime log and wrote synthetic entries into the real history — corrupting
  exactly the evidence the runtime log exists to provide. Test builds are now
  diverted to a per-process temp directory, and a `WORDSCRIPT_DATA_DIR` override
  works in every build.

### Changed

- **Profile context now reaches every mode at the same width.** The same field,
  `TextProfile.prompt`, arrived in three different shapes: Cleanup and Rewrite
  pushed it through the *transcription* hint filter (a line survived only at ≤4
  words and with a capital, digit or punctuation in it), while Agent and Prompt
  Enhance took it raw, untruncated and uncapped. On the curated
  `Product and engineering` profile that meant 2 of 8 lines for Cleanup and all 8
  for Agent. The split was never decided — `git log -L` shows the filter arriving
  in `transform.rs` as a side effect of a commit about STT bias, two months
  before ADR 0017 documented the reasoning for the recognizer path it was
  actually built for. `core::profile_context` is now the single producer for all
  modes: normalized, deduplicated, 80 chars per line, and the block bounded by a
  600-character budget. The mode decides the framing — corrective for Cleanup and
  Rewrite, generative for Agent — never the width. The recognizer filter is
  untouched and stays recognizer-only (ADR 0021).

  Verified by replaying 96 real history transcripts twice through the production
  correction path (192 provider calls): widening Cleanup from 2 lines to 8 left
  74% of outputs identical, produced **zero** occurrences of the six previously
  dropped context lines, and did not increase divergence from the transcript.
  The change is safe and simplifying, not an improvement — recorded that way on
  purpose.

- **Agent's prompt is bounded.** Its dictionary, snippet and `stt_hints` blocks
  grew with the profile and had no cap; they now use the same limits as the
  correction prompt.

- **The context field is now called "Profile context", not "Transcription
  context".** The old name described the minority consumer: the field goes to
  every mode's transform prompt in full, and only a filtered subset reaches the
  recognizer. The card now shows how much of the 600-character budget the profile
  spends and names any line that exceeds it, because a bound the user cannot see
  is indistinguishable from a bug.

- **Two UI strings stopped overclaiming.** The Text Rules warning and the
  Profiles panel said broad context lines "are not forwarded automatically".
  That is true only of the recognizer, so both now say so and add that the lines
  still reach the transform prompt.

### Fixed

- **The recognizer preview showed an initial prompt the provider never
  received.** ADR 0017 made `use_as_prompt_hint` the single per-entry control
  over what reaches Whisper, and the capture path honours it
  (`prompt_hint_phrases`). The Settings panel did not: it sent the legacy
  `stt_hints` free-text field — which migration copies from but never clears —
  into `analyze_text_rules`. With every vocabulary toggle off, the panel
  displayed `Likely phrases: triage summary; release note; qa handoff; incident
  update` while the request carried no initial prompt at all, and flipping a
  toggle changed nothing on screen. `AnalyzeTextRulesRequest` now carries
  `vocabulary_hints` and the analysis derives the phrases the way the capture
  path does. Imported documents, which predate the per-entry opt-in, still fall
  back to the legacy field.

- **The Profiles tab stopped using three names for the same place.** The tab
  said "Vocabulary", its panel header said "Context & Preview", and the
  replacements card said "Personal dictionary" under a tab labelled
  "Replacements". Panel titles now match their tabs. "Step 1 of 4" is gone — the
  three lists are independent, not a sequence, and the fourth step it counted
  (Bias policy) stopped existing with ADR 0017. "Words & names" moved out of the
  "Profile context" card into its own, which is why the difference between a
  free-text topic list and a per-term recognizer opt-in was hard to see. A
  three-column note grid, a four-line paragraph on prompt length and a trailing
  note about team sharing were removed.

### Removed

- **The three "Cleanup settings" toggles, because none of them reached the
  runtime.** AI cleanup, Remove fillers and Rewrite phrasing sat in Settings ->
  Modes under a caption promising they applied to Cleanup and Rewrite.
  `effective_filter_fillers` and `effective_professionalize` took the stored value
  as an argument and opened with `let _ = fallback;`, deriving the result purely
  from the mode; the per-profile fields the UI wrote were dereferenced nowhere in
  the runtime. `post_process` was read and then overwritten per mode. Across 1586
  live correction calls only the three mode-derived flag combinations ever
  occurred — never one produced by a toggle. Two of the three were also redundant
  with the mode axis even had they worked: Cleanup with AI cleanup off is
  Verbatim, Cleanup with Rewrite phrasing on is Rewrite. The processing mode is
  now the only transform axis and each of the six modes is a fixed preset
  (ADR 0020).

### Fixed

- **The workspace-context toggle had no effect.** Settings wrote
  `ProfileModesSettings.auto_detect_mode` on the active profile while the runtime
  read the global `AppConfig.auto_detect_mode` at both of its call sites. Nothing
  connected them, so turning the switch off changed nothing. The runtime now reads
  the per-profile value, with the global as fallback for profiles predating the
  block. The key is renamed to `collect_workspace_context` because the context no
  longer applies only to Auto; the old key is accepted as an alias on both sides.
- **A manually chosen Agent mode could be overridden by the runtime.** After the
  mode resolved to Agent, the Agent branch ran the intent classifier a *second*
  time and, on "no", silently fell through to a cleanup — with flags derived from
  the profile's stored mode rather than the mode the session was running in. Intent
  is now classified only while resolving Auto, at one commit point; reaching the
  Agent branch is itself the decision.
- **The history re-transform mixed flag sources.** It took `post_process` from the
  global field and the other two from the profile, a combination no live session
  could produce. All three now come from one preset.
- **A profile could display a rewrite style it was not running.** `rewrite_style`
  was stored independently of `processing_mode`, and the live config held
  `"polished"` on a profile running `"auto"`. It is now derived from the mode.
- **The per-profile agent name was editable but never read** — the runtime always
  used the global one, so the name shown in Settings and the name the detection
  heuristic matched against could differ. The runtime now reads the profile value
  with the global as fallback.
- **Agent and Prompt Enhance ignored the profile's dictionary and snippets.** The
  text-rule stage sat inside `apply_native_transform`, and neither of those modes
  calls it — so a dictionary replacement the user configured simply did not happen
  there. Agent half hid it by listing dictionary and snippet entries in its prompt,
  which asks the model to honor them instead of applying them; Prompt Enhance did
  neither. Text rules are now a separate final stage
  (`transform::finalize_with_text_rules`) at the single pipeline exit, so every mode
  passes through them. Verbatim was never affected — that call already sat outside
  the `post_process` branch.
- **German `um` was exposed to filler stripping.** It is an English interjection
  and a German preposition, and appears as a preposition in real transcripts. The
  cleanup instruction now states that a filler is stripped only where it stands
  alone as an interjection, and names German `um` explicitly. Guarded by a
  regression-corpus case.

### Added

- **Workspace context reaches every mode**, not just Prompt Enhance: as a category
  signal in Auto routing and as exactly one bounded hint line in the cleanup,
  rewrite and agent prompts, carrying its own instruction never to derive content
  from it. It is detected once per session instead of twice on two paths. This is a
  new input into the correction prompt and therefore a new hallucination surface —
  bounded and corpus-guarded, but the first thing to check if cleanup output starts
  drifting toward the app it was dictated in.
- **An `expected_correction_prompt` block in the regression corpus** with a driver
  test. Prompt shape is the only lever the product has over the cleanup LLM, so the
  guards belong next to the transcripts they protect.
- **Auto routing invariants are enforced by test** rather than stated in prose:
  neither `verbatim` nor `rewrite` can be reached from Auto, and no mode can produce
  the `(filter_fillers=false, professionalize=true)` prompt arm.

### Changed

- **The agent instruction is a working file again instead of a growing
  archive.** `AGENTS.md` had reached 236 lines; a file loaded into context on
  every request costs tokens on every request, and the measured convention puts
  the useful ceiling at 100–150 lines, beyond which the hard rules get buried
  in the volume. It is now 132 lines. Three kinds of weight came out: a spec
  changelog that grew with every ADR (the same anti-pattern the project
  forbids for `ARCHITECTURE.md`), 51 lines of gotchas that were already
  documented in `docs/`, and two rules that had drifted into the file twice.
  No fact was dropped without its owning document being checked first — the
  overlay size and layer-cache invariants moved to `docs/REFERENCE.md`, the
  Windows `vendor/global-hotkey` patch rule to `docs/PLATFORMS.md`,
  `resolve_overlay_monitor` to
  `docs/known-issues/overlay-placement-persist.md`, and the spec drift date to
  `docs/spec/SPEC.md`, which now carries its own `Status:` line like every
  other document. The cpal 0.17 `SampleRate` note was retired outright: it
  described a migration that had already been completed in `capture.rs`.
- **The reference map says when to read a document, not only that it exists.**
  Shortening the file first went one step too far: the rule that the spec
  outranks the living overview docs on conflict was dropped because
  `docs/spec/SPEC.md` states it in its own header. That is the one place it
  cannot help — an agent that opens `ARCHITECTURE.md` first never learns it is
  outranked. Routing rules have to fire before a document is picked, so
  precedence and the append-only ADR rule are back in `AGENTS.md`, and the
  reference map gained a "before touching" column that names the code areas
  which should trigger each read. The separate gotchas list is gone: once the
  map carries triggers, it was a second routing table pointing at the same
  documents.

### Documentation

- **The Linux paste lane is documented by mechanism instead of by symptom.**
  `PLATFORMS.md` grouped `wtype`, `ydotool` and `enigo` under one reason — the
  KDE portal prompt. That is right for the first two and wrong for `enigo`, which
  is pulled with its default `x11rb` backend and drives input through the X11
  XTEST extension: on pure Wayland it is not skipped but inapplicable, and on
  hybrid XWayland it is the *same* request `xdotool` already made, which is why
  `paste_with_enigo` refuses while `xdotool` is in `PATH`. Stated plainly now:
  hybrid sessions have exactly one paste mechanism and pure Wayland has none, so
  a refused XTEST grant has nothing independent behind it. A second mechanism
  (libei) is filed in `ROADMAP.md` as a candidate with an open decision gate —
  deliberately not as scheduled work, because the reliability problem that
  motivated it measured clean (37 real pastes, zero portal denials) and is far
  better explained by the config revert above.
- **`cargo test` writes into the developer's real runtime log**, which cost one
  wrong analysis: 116 lines reading `xdotool blocked by portal ... Authorization
  denied` looked like a 30% XTEST failure rate and were all test fixtures. Real
  sessions have zero. Recorded with the discriminator (the elapsed offset in the
  line prefix) and the fix the repo already uses for `history.json` — a
  `#[cfg(test)]` path override — in
  `known-issues/rust-test-global-state-isolation.md`, whose status is corrected
  from "fixed" to one case still open.

### Fixed

- **The 1.5 s completion fallback no longer ends a session without a surface.**
  The fallback introduced with ADR 0018 set the session to idle but left
  `resultSurfaceOpen` untouched, so an authoritative transcription arriving
  after it flipped the result surface on one commit later — the exact
  two-commit gap ADR 0018 had removed, reachable again through the mechanism
  ADR 0018 added. The fallback now ends the session together with the surface
  that reports it, built from the transcript the native channel actually
  mirrored and with every field the authoritative event owns left null rather
  than guessed. A session that has already ended never has its surface
  re-decided: a late authoritative event updates the open surface in place
  instead of mounting a second one. ADR 0019.
- **A delivery-mode change on the processing preview forces a native repaint.**
  `previewClipboardOnly` swaps the preview's primary button between Copy and
  Insert and toggles `pill--clipboard`, but it only entered `pillVisualEpoch`
  for the result surface. The preview could therefore change its visual identity
  with no native repaint behind it, which on WebKitGTK is the condition under
  which the previous raster stays. ADR 0019.
- **A normalized `work_mode` is written back to disk instead of being
  recomputed forever.** `should_save` did not count a profile normalization, so
  the legacy `insert_behavior` token `"clipboard"` survived on disk and forced
  that profile to clipboard-only on every single load, regardless of what the
  user had selected — the reported "the delivery mode switches itself back".
  The P1 diagnostic recorded that correction 183 times across two runtime logs,
  which is the same statement as "never persisted". A canonical config still
  reports no rewrite, so this does not trade a silent revert for a config
  written on every load. ADR 0019,
  `docs/known-issues/insert-behavior-reverts.md`.
- **The edit surface keeps painting through its own fade.** The leave hold
  required the live `editText` to be non-empty, but a confirmed edit ends the
  session, the new result fires the interaction-reset effect, and that clears
  `editText` — so the surface was pulled out from under its own hold at the
  instant the fade started, measured in 4 of 5 edit closes. The hold now paints
  from a frozen frame captured while the surface was live, the same pattern the
  processing hold already used. ADR 0019.
- **The overlay diagnostics no longer lose lines silently, and no longer go
  quiet where they are being read.** `[ov-*]` output was one fire-and-forget
  `invoke` per line, and concurrent Tauri commands are not ordered against each
  other — so a missing `[ov-repaint]` next to its `[ov-sched]` was
  indistinguishable from an effect that never ran, which is the one distinction
  that log exists to make. Lines now carry a monotonic `#n` and are flushed on a
  microtask. Not `requestAnimationFrame`: WebKitGTK pauses that for the
  not-visible overlay, which buffered every line emitted during the leave until
  the next wake and made a healthy 243 ms transition read as a 258-second stall.
  The `[ov-beat]` heartbeat now also covers the leave window, so a suspended
  main thread there is observable instead of inferred.
- **The result overlay no longer stacks on a processing overlay that never went
  away.** A finished dictation is announced twice — first the native session
  mirror, then the authoritative transcription — as two IPC messages and
  therefore two React commits. The first one already flipped the session to
  idle, so for one render the session was over and no surface owned the pill:
  it unmounted, and on WebKitGTK that orphans the processing pill's compositor
  layers for the result surface to mount on top of. The native channel now only
  mirrors the transcript text; the session ends in exactly one commit, together
  with the surface that reports it, with a bounded 1.5 s fallback in case the
  authoritative event never arrives. Structurally exclusive to "Copy and insert
  at cursor" — "Copy to clipboard only" stops on the processing preview, which
  the leave hold already covered. ADR 0018,
  `docs/known-issues/overlay-ghosting.md`. The reported mode dependence (clean
  in `Auto`, visible in the other five processing modes) is a separate, still
  open axis; it is to be measured with the existing `[ov-*]` diagnostics.

- **Curated profiles no longer lose the delivery mode you chose.** Every profile
  except `General writing` delivered through the wrong pipeline: the overlay
  showed the auto-paste surface while the setting read "Copy to clipboard only".
  `refresh_unedited_curated_text_profile_metadata` reset `work_mode` from the
  shipped template on every save, and its "edited" signal — `curation.curated =
  false` — was only cleared by one of the three UI write paths. `General
  writing` is the one non-curated profile, which is exactly why it was the only
  one unaffected. The refresh now touches presentation only (audience, summary,
  highlights) and never behaviour, and the Modes and Insert & Recovery write
  paths detach a profile from its template like the Profiles tab already did.
  Requiring three call sites to remember one call was the same shape of defect
  as the transcription wiring gap below.

- **Text profiles now actually affect transcription.** Per-profile bias policy
  (`bias_mode`, `manual_bias`) and every local decode setting
  (`local_prompt_strength`, `local_prompt_carry`, `local_beam_size`,
  `local_best_of`, `local_profile`) were written to the config, rendered
  correctly in the Profiles preview, and then dropped before the provider call.
  `capture.rs` hand-built the `audio_ready` payload and `lib.rs` hand-parsed it
  back with per-key lookups; the two schemas had drifted, so every recording ran
  Conservative bias with preset decode defaults regardless of configuration. The
  capture config now crosses the boundary as one flattened value and
  `NativeCaptureConfig::resolve_transcription_request` is the only place a
  request is derived (ADR 0015). Configured profiles will visibly change
  transcripts for the first time — that is the fix, not a regression.

### Changed

- **Profile vocabulary is applied after transcription, not whispered into the
  recognizer** (ADR 0017). Copying vocabulary into Whisper's initial prompt is
  itself a documented cause of repetition loops and language drift, which is why
  the old bias path had to default to "conservative" — and why profiles felt
  like they did nothing. Dictionary terms now leave the prompt entirely
  (`apply_dictionary_entries` already replaced them deterministically, so the
  prompt copy was redundant risk), and the prompt caps drop from 896/480 to
  320/200 characters.
- The four Profiles panels become three: **Vocabulary** (context plus words &
  names), **Replacements** (the dictionary, renamed to what it does) and
  **Snippets**. The **Bias policy** panel is gone. `BiasMode` and its two
  `ManualBias` flags are replaced by a single per-entry "Hint the recognizer"
  toggle, off by default — the only question left is per word, and it is phrased
  as what it does rather than as what it is.
- `TextProfile.stt_hints` (a free-text blob governed by a profile-wide policy)
  becomes `vocabulary_hints: VocabularyHintEntry[]`, separating "teach a word"
  from "replace X with Y" the way Wispr Flow does. `TextProfile.schema_version`
  migrates existing profiles once on load; lines the hint filter would have
  rejected are logged rather than dropped silently, and Manual opt-ins are
  preserved per entry. `bias_mode` / `manual_bias` stay one release as
  migration-only remnants that nothing reads at runtime.

- **The default branch is now `main`.** The repository ran on `master` while
  `CONTRIBUTING.md`, `docs/RELEASE_RUNBOOK.md` and the `ref` inputs of both
  GitHub workflows already named `main` as the target ref. The branch was
  renamed rather than the documentation rewritten, which closes the mismatch in
  the direction of the wider convention. GitHub redirects the old name, so
  existing clones keep fetching; realign one with `git fetch --prune`,
  `git branch -m master main` and `git branch -u origin/main main`. Historical
  records in `docs/handoffs/` that name `master` stay unedited under the
  append-only documentation rule.

### Added

- A speech gate before transcription (ADR 0016). Leading and trailing silence is
  trimmed off the capture, and anything shorter than 200ms of remaining audio
  ends as `InputLevelVerdict::TooShort` with an explicit overlay message rather
  than a silent nothing. The threshold sits far below a real word ("Ja." runs
  400-600ms) because a swallowed dictation is worse than a filtered
  hallucination; `WORDSCRIPT_MIN_SPEECH_MS` overrides it for development.
- A confidence gate on the cloud lane (ADR 0016). The runtime asks for
  `verbose_json` again — it had been overridden to plain `json`, discarding
  Whisper's own per-segment metrics. `core::confidence_gate` drops a segment on
  `no_speech_prob > 0.6` combined with `avg_logprob < -1.0`, or on
  `compression_ratio > 2.4` alone.
- Capability-probed whisper.cpp hallucination controls on the local lane. The
  existing `whisper-cli --help` health probe now also reports which flags the
  installed build understands; `--max-context 0`, `--logprob-thold`,
  `--no-speech-thold` and the `--vad*` family are passed when supported and
  logged when skipped. VAD additionally needs a Silero model via
  `WORDSCRIPT_LOCAL_VAD_MODEL_PATH`. An unsupported flag never fails a run.
- A post-transcription detection stage (`core::hallucination_detect`, ADR 0016)
  that collapses character, word and phrase repetition and filters broadcaster
  subtitle boilerplate by pattern. The previous filter matched exact strings
  only, so it caught `"untertitel von"` as a whole output and missed
  `"Untertitelung des ZDF, 2020"` appended to a real sentence.
- An optional per-profile language pin (`language_locked`, off by default).
  It never makes a language mismatch sufficient on its own to discard text; it
  only lowers the corroboration the drift check requires from two independent
  signals to one. Speaking several languages inside one sentence — anglicisms in
  German, a quoted Spanish phrase in English — is legitimate transcription and
  is left untranslated and byte-identical either way, pinned by two corpus
  entries.
- Editing a transcript before it is delivered. The `clipboard_only` processing
  preview now carries an Edit action next to Copy and Abort — the one surface
  where the text has not left the app yet, so a correction there changes what
  actually gets delivered. Confirming goes through
  `commit_pending_transcription_preview` (new optional `text` argument) rather
  than a separate insert, so the delivered text, the completed session and the
  history entry can never describe different wording; the edit clears the
  machine-corrected flag and records an `overlay_edit` rule. Edit on the
  `auto_paste` result surface is unchanged in behaviour but honest in wording
  now: the button reads "Copy corrected text", because a text already pasted at
  the cursor cannot be retracted.
- Every `transcription` event carries `delivery` (`inserted` | `clipboard`) from
  the new `NativeInsertMode::delivery_label`. Previously only the `auto_paste`
  pipeline emitted it, so the commit and history-retry paths left the UI
  inferring what had happened to the text.
- Diagnostics for the overlay freeze reported during long captures
  (`docs/known-issues/overlay-recording-freeze.md`). Runtime log lines now carry
  an epoch-millisecond and a monotonic timestamp, overlay diagnostic lines carry
  the matching epoch stamp, and every capture records its `audio_level` emit
  accounting on stop (`expected` / `attempted` / `failed` / `shortfall_ratio` /
  `slowest_emit_ms`). A dev-only `[ov-beat]` main-thread heartbeat in the
  overlay reports intervals that land late. Together these separate a genuine
  freeze from the overlay legitimately not re-rendering during silence, which
  the previous telemetry could not distinguish.
- A complete audio-feedback rework (ADR 0010). Cues are synthesised from one
  G-major theme: a startup signature (G3 -> D4 -> G4) that every operational
  cue quotes a fragment of. New `Done` cue on a successful insert — the first
  audible confirmation that a round trip actually finished. Four selectable
  timbre packs (`timber`, `glass`, `air`, `tap`), a volume slider, a startup
  toggle and per-cue preview buttons in Settings. New config:
  `sound_volume`, `sound_pack`, `play_startup_sound`; new command
  `preview_sound_cue`.
- `cargo run --example audition_cues -- --out DIR [--sequence]` renders every
  pack and cue to WAV so the sound can be judged by ear without building the
  app.
- WordScript now names itself in the system volume mixer on Linux
  (`application.name=WordScript` via `PIPEWIRE_ALSA`, `PIPEWIRE_PROPS` and
  `PULSE_PROP`) instead of appearing twice as "PipeWire ALSA [wordscript]" —
  once for the sound cues and once for the microphone. `PIPEWIRE_ALSA` names
  the client object, which is what the KDE applet shows; `PIPEWIRE_PROPS` names
  the stream node, which is what the remembered volume is keyed on. PipeWire keys the remembered per-application volume
  on that name, so the system-mixer setting is now both findable and durable.
  Windows already names packaged builds from `productName`, and macOS has no
  per-application mixer to name.
- Microphone input-level diagnosis. A capture whose loudest moment never
  crosses the speech threshold used to be discarded in silence, so a microphone
  set too quietly was indistinguishable from a broken app. The runtime now
  measures peak and clipping across every capture and reports the verdict
  (`ok`, `too_quiet`, `silent`, `clipping`) with the measurement in dBFS and
  the next concrete step. Settings gained a live input meter with the speech
  threshold drawn in, under the microphone selector. Read-only throughout:
  WordScript never writes the OS input volume, which is per device rather than
  per application and shared with every other app on that microphone.
- A single Rust-owned shortcut contract (`core::shortcut`, ADR 0006) covering
  the token vocabulary, canonical storage form, human display strings and every
  validity rule. The UI no longer carries a key table: it reads the vocabulary
  from the runtime, so every token it can produce is registerable by
  construction. New commands: `validate_shortcut`, `shortcut_vocabulary`,
  `shortcut_platform`.
- Permanent structured trigger observability. Every received shortcut event,
  the decision taken (`start`, `stop`, `debounced`, `ignored_*`, `hold_start`,
  …), every registration and unregistration outcome and every stranded hold
  ended by the watchdog are logged to the runtime log under `[trigger]`, plus
  press/release counters per binding in `native_trigger_status`.
- Per-shortcut runtime truth in Settings: registered versus configured with a
  persistent reason when registration failed, observed press/release evidence,
  and a platform line naming the session type, the backend and the keys the
  desktop swallows.
- A hold-to-talk watchdog (`hold_watchdog_seconds`, default 120, `0` disables).
  A hold whose key release never arrives is ended explicitly with reason
  `native_hold_watchdog` instead of drifting into the silence timeout, and the
  activation-mode selector states whether a key release has actually been
  observed for the configured shortcut in this session.
- A per-session shortcut capability matrix (`shortcut_capabilities`, ADR 0007).
  `core::shortcut::capability_matrix` derives a state (`available`,
  `conditional`, `unavailable`) and a user-facing reason for every activation
  mode and key class, from the session facts plus the press/release evidence the
  trigger lane measured — never from a per-OS assumption about hold to talk.
  Settings gates the activation selector on it: an option this session cannot
  honor is unselectable with the reason stated, and a stored mode that becomes
  unavailable stays selected rather than being silently swapped.
- Modifier-only shortcuts are observed instead of grabbed (ADR 0009). A grab
  delivers the key to WordScript instead of the focused window, which is right for
  `Ctrl+F9` and wrong for `Ctrl+Super`: the combination was taken from every other
  application. Modifier-only shortcuts now go through XInput2 raw key events on
  Linux, which do not consume the keystroke. `validate_shortcut` reports which of
  the two mechanisms applies in `delivery`. The vendored `global-hotkey` crate
  carries the new observation path; Windows and macOS still need the same routing.
- A **single modifier** can be the capture trigger where the session supports it —
  double-tap Shift, or push-to-talk on one key, the idiom the mainstream dictation
  tools use. It rests on an `interrupted` flag the observation path now reports
  with each key edge: tap and double tap discard an interrupted edge, so `Shift`
  pressed to type a capital and `Ctrl+Alt` on the way to `Ctrl+Alt+T` no longer
  count as taps, while hold to talk ignores it and still ends on release. The
  two-modifier minimum became a session property rather than a fixed rule; where a
  platform cannot report interruption it still applies, and the stated reason names
  the missing signal. Linux reports it today; Windows and macOS do not yet.
- A cross-platform verification record for the shortcut lane
  (`docs/known-issues/cross-platform-shortcut-verification.md`): executable run
  sheets for Windows and macOS, the per-platform release mechanisms read from the
  vendored `global-hotkey` source, and an assessment of which questions a VM or a
  CI runner can answer instead of owned hardware. It records that the
  modifier-only capture defaults are expected to fail registration on macOS,
  because that platform implementation maps no modifier as a main key.
- A development-only key probe in the shortcut recorder that logs `event.code`,
  `event.key`, the modifier state and whether the code mapped to a registerable
  token, for diagnosing which keys a desktop actually delivers.
- Test coverage for the shortcut recorder (`HotkeyRecorder.test.tsx`), which
  previously had none and was mocked out wherever it would have been exercised.
- Repository documentation now follows the SW labs template: canonical
  `AGENTS.md` with `CLAUDE.md` symlink, `.editorconfig`, `.claude` examples,
  `.agents` guidance, contribution and security policies, staging guidance,
  GitHub issue and pull-request templates, and `.githooks/pre-commit` with
  secret scanning and legacy build-artifact cleanup.
- A lean consolidated product specification at `docs/spec/SPEC.md`, five
  initial ADRs, reference templates, an indexed living known-issues area, and
  a fully English documentation set.
- Permanent development-only overlay diagnostics: native DevTools and
  diagnostic-log commands plus a development settings panel and frontend event
  traces.
- Cross-platform CI repairs: `cpal` 0.17 and `rodio` 0.22 updates for
  Send-safe macOS capture streams, and the vendored Windows global-hotkey
  pointer fix for `windows-sys` 0.59.
- One-shot native capture-stream rebuild after a transient stream error, with
  format matching, runtime logging, and regression coverage.
- Persistent runtime-log diagnostics for capture error classification and
  selected audio device details.
- A KDE Plasma 6 KWin overlay-layer script and the
  `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` hardware opt-out.
- Native provider capabilities, setup diagnostics, local `fast` and `quality`
  profiles, profile-bound decode and prompt-bias persistence, and a local
  runtime snapshot for Diagnostics and history.
- Profile work-mode contracts, typed insertion-recovery metadata, server-side
  history filters, JSON export, and a native capture/provider/transform/insert
  timeline.
- Text-profile STT hints, one-time persisted included profiles, a global active
  profile switcher, and a staged Text Rules workspace.
- Internal release build-up aggregation with platform archives, checksums,
  metadata, and optional maintainer draft releases.

### Changed

- Hold to talk is strictly momentary (ADR 0013). A press shorter than
  `hold_arm_ms` (300 ms, fixed) is now **discarded** — no session, no overlay, no
  cue, no history entry. The old `hold_min_ms` did not gate a hold, it extended
  one: a release below the threshold scheduled a deferred stop that fired once
  the recording had reached 300 ms, so every press produced a transcript and the
  hold duration changed nothing. The mode behaved like tap to toggle with a
  floor. The microphone still opens on the press edge and the audio is kept, so
  a hold that commits loses no word; what waits for the threshold is the
  session, not the stream. The listen cue therefore moves from the press to the
  commit, and the watchdog arms there too. No latch gesture was added, to hold
  or to tap: the two toggle modes already own latching, and a hybrid branch
  would make the three options overlap. The threshold gates all three
  capture-lane bindings — start/stop, pause and abort — the way the double-tap
  window already does. `NativeTriggerStatus.hold_min_ms` is renamed to
  `hold_arm_ms`; `TriggerEffect::DeferredStop` is removed and replaced by
  `StartCaptureProvisional`, `CommitHold`, `DiscardProvisional` and
  `DeferredHoldAction`. This also closes D11 in the known-issues record, which
  had hold to talk down as doing nothing at all: both edges arrive and both act,
  and the defect was in what they meant.

### Fixed

- The Windows and macOS builds were broken and had been for as long as the
  vendored `global-hotkey` patch has existed. Three `GlobalHotKeyEvent` literals
  were never updated when the patch added the `interrupted` field
  (`windows/mod.rs:165`, `macos/mod.rs:466` and `:519`), which is E0063 — a
  missing field in a struct literal. The patch had only ever been compiled on
  Linux. Fixed by supplying the contract-correct `false` at each site (press
  edge, grabbed real key, media key).
- Modifier-only shortcuts now exist on Windows. They previously registered and
  then never fired: the low-level hook returned early for every modifier virtual
  key, so a shortcut whose main key is itself a modifier never reached the
  matcher. The shared state machine behind it — held-modifier tracking, the
  exact-match rule, and what marks a held trigger interrupted — moved into a new
  platform-neutral `modifier_only` module with ten unit tests that compile and
  run on Linux, so the logic is checkable even though the target is not. Windows
  registers modifier main keys with the observer, feeds it every key event, and
  still passes modifier keys on rather than consuming them (ADR 0009). This also
  makes the release-edge pause/abort fix effective there, since `interrupted` is
  now computed rather than absent. The x11 backend is untouched: it is the
  reference implementation and the only one that has actually run.
  **Not compiled for Windows or macOS** — there is no cross toolchain on the
  development machine. `session_has_interruption_signal` therefore still returns
  false for Windows, so a single bare modifier stays rejected there until
  hardware confirms the signal. macOS remains unimplemented, with its
  requirements written into the known-issues record instead of guessed at in
  code, because `objc2-app-kit` could not be read to verify the API.
- Two ADRs filed on 2026-07-27 shared the number 0011 — the delivery-surface
  record and the mode-lane record. Both are accepted and neither could be
  withdrawn, so they gained a disambiguating suffix instead of a new number:
  `0011a-one-decision-surface-per-delivery-mode.md` and
  `0011b-the-mode-lane-sits-on-alt-not-on-ctrl.md`. Renumbering the second to
  the next free number was rejected because it breaks the "never renumber an
  existing ADR" rule and would silently send an older bare "ADR 0011" reference
  to the wrong record. Every citation across the docs now carries the letter;
  the reference audit was redone in the process and had been wrong about two of
  them. The next decision takes 0015.
- `cargo test` is reliably green again on a clean tree. Three tests mutated
  process-wide state and therefore raced their own siblings under the parallel
  default: two `core::runtime_log` tests cleared the shared ring buffer before
  recording into it, and the `core::workspace_context` pair set and removed the
  same `WORDSCRIPT_PROJECT_ROOT` variable. Measured at 2 failures in 22
  consecutive runs, load dependent, and always a false negative — the assertions
  and the code under test were correct. Both sites now assert through a seam
  rather than a lock: the ring-buffer tests compose `formatted_entry` and
  `push_bounded` against a local `VecDeque`, and the project-root tests call
  `resolve_configured_project_root` with the value they want instead of touching
  the environment. Serialising the suite was explicitly not the fix; the
  parallel default stays the normal case and `--test-threads=1` stays green.
  Two behaviours gained coverage on the way — ring-buffer eviction at the cap,
  and project-root resolution with no variable set — and `std::env::set_var` is
  gone from the test module ahead of the Rust 2024 edition bump.
- Reaching for `Ctrl+Alt+<key>` while dictating no longer discards the capture.
  The shipped abort default `Ctrl+Alt` is modifier-only, and pause and abort
  acted on its press edge — a moment at which the interruption signal cannot
  exist yet, because the third key has not been pressed. All three activation
  modes misfired: tap the instant both modifiers were down, double tap on the
  second such chord inside the window, hold once its arm timer passed
  `hold_arm_ms` underneath the still-held chord. Pause and abort now follow the
  rule start/stop already followed (ADR 0014): a modifier-only binding is decided
  at the release edge, and an interrupted chord acts on nothing and counts toward
  nothing. In hold mode the threshold is unchanged but measured at the release,
  because a timer that fires mid-hold fires before the interruption is knowable.
  A binding containing a real key — the shipped `Ctrl+Space` pause — is
  unaffected and still acts on the press. Fixing the default alone would not have
  helped: any modifier-only value a user assigns hits the same path.
- Holds taken in quick succession no longer strand the microphone. The
  provisional window is the one moment where a key is held without a session,
  and `sync_trigger_state_with_session` treated that as state to repair: it
  cleared `hotkey_active` on the next incoming event, the matching release was
  dropped as a release without a press, and the capture stayed open. The next
  press then failed with "A native audio capture is already active", the leftover
  stream produced "No speech detected", and an abort was needed to clear a
  session that already looked finished. The hold now carries an explicit
  `HoldPhase`, which the session sync leaves alone while it is provisional.
  Alongside it: a release is handled whenever a hold is in flight even if the
  held flag was lost, a failed provisional start cancels the hold so the arm
  timer cannot commit a session with no audio behind it, the capture monitor
  starts with the stream instead of with the session so no capture is ever
  unsupervised, and a monitor autostop that finds no session releases the device
  instead of returning and leaving it open.
- A hold pressed while the previous transcript is still processing is refused at
  the press edge (`ignored_processing`), the way tap mode already refused it,
  instead of opening a microphone for 300 ms and then failing the commit.
- The mode lane moved from `Ctrl` to `Alt` (ADR 0011b): mode select is `Alt+S`
  instead of `Ctrl+S`, and the six per-mode jumps are `Alt+1`-`Alt+6` instead of
  `Ctrl+1`-`Ctrl+6`. The old defaults were global grabs on **save** and on
  **browser tab switching** — the two reflexes a writing tool must not take
  away. One stored value covers every platform: macOS renders the lane as
  `Option+S` and `Option+1`-`Option+6`, Windows and Linux as `Alt+…`. Existing
  configs are migrated once (`SHORTCUT_SCHEMA_VERSION` 1 -> 2), per slot, and
  only where the slot still holds its untouched `Ctrl` default; an assigned
  shortcut, an empty (disabled) slot, and any slot whose new value is already
  taken are left alone.
- The overlay's dev-only per-render trace is now opt-in behind
  `VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1` and runs in an effect rather than in
  the render body, and `read_diag_log` returns only the tail of the diagnostic
  log instead of the whole file. The panel polls that command every 500 ms while
  it is open, so the previous behaviour put an unbounded, session-length-
  dependent payload on the main thread — load heavy enough to be a candidate
  cause of the very stall the log exists to diagnose.
- Sound cues no longer open a fresh output device per cue. One stream, owned by
  a dedicated thread, is opened at startup and primed with silence, so cues no
  longer contend with the microphone device and are rendered at the real device
  sample rate instead of being resampled at playback time.
- `SoundCue::Start`/`Stop` became `Listen`/`Handoff`. `Handoff` fires when
  capture stops and is deliberately unresolved: at that point the pipeline is
  still running, so the old conclusive-sounding tone asserted a completion that
  had not happened.
- Documentation was audited against the active Rust, React, Tauri, workflow
  and packaging code. The spec now names the registered session commands,
  distinguishes Tauri channels from payload discriminators and internal UI
  actions, documents profile-bound mode resolution and its legacy fallback,
  automatic settings persistence, the 232px settings sidebar, visible
  preview-only More areas, the accepted overlay residuals and the actual
  Node.js engine requirement.
- Rust package metadata now matches the accepted AGPL-3.0 license and current
  SW forge repository. Bootstrap scripts reject Node.js versions unsupported
  by Vite 8.
- Rust/Tauri remains the runtime owner; React consumes typed native truth.
  Provider configuration uses consistent provider terminology and legacy Groq
  secret migration runs natively before configuration is saved.
- The local runtime now passes transcription context through `whisper-cli`,
  distinguishes `fast` from `quality`, records local prompt/decode/cleanup
  metadata, and conservatively falls back when local cleanup is unavailable.
- Linux insertion uses explicit native driver chains and desktop-aware portal
  diagnostics. Pure Wayland avoids privileged auto-paste attempts and uses
  clipboard-only recovery; KDE Plasma 6 and GNOME can request a persisted
  RemoteDesktop grant.
- Settings now use a calmer native-decorated utility shell with grouped
  navigation, profile context, one dominant content surface, and the same
  Diagnostics pop-out language.
- The overlay uses a compact fixed stage, real processing-time
  `clipboard_only` preview, native result actions, movement-threshold dragging,
  remembered user placement, and clearer speech waveform behavior.
- Linux WebKitGTK performance work enables GPU compositing by default, removes
  card shadows and backdrop filters, adds contained scroll surfaces, uses a
  fixed background gradient, and changes history refresh to five seconds.
- Overlay host behavior uses fixed 440x60 and 460x164 surfaces, XWayland by
  default, per-reveal background color updates, and native hide/parking.
- The universal CSS reset now belongs to Tailwind's `@layer base`; shared
  wordmark, spacing, tokens, and content-visibility utilities support the
  current shell.
- Documentation and About copy accurately distinguish internal build-up from
  published releases and defer broad workspace, sync, MCP, and assistant scope.

### Removed

- The active Python sidecar path, including build scripts, legacy package files,
  and obsolete configuration examples.
- Deprecated isolated settings prototypes and obsolete general-area
  placeholders; the visible Chat, Upload, Notes and Account layouts remain
  explicitly labeled previews. The inactive `show_tray_icon` runtime field and
  obsolete `rebuild-lab.css` were also removed.
- The old `hooks/pre-commit` location and regenerated legacy `BUILD_ID` and
  `build_info.json` behavior.

### Added

- A third activation mode, **double tap to toggle**: two taps within
  `double_tap_window_ms` (default 400) start or stop the capture, a single tap
  does nothing. This is what the mainstream dictation tools do — Wispr Flow
  double-taps right Shift, macOS Dictation double-taps Fn — and it exists for a
  concrete reason: a modifier-only trigger in tap mode acts on every single
  press, so `Ctrl+Alt` as the trigger also fires when the user meant
  `Ctrl+Alt+T`. Requiring two taps leaves the single press to the rest of the
  desktop. The gate covers start/stop, pause and abort, each with its own
  window; mode hotkeys stay single-press. Settings names the trade-off on both
  modes.

### Changed

- The reason a single bare modifier is rejected changed with the mechanism. It is
  no longer "it would be grabbed from every application" — with observation that is
  no longer true. It is that nothing distinguishes a deliberate tap of Shift from
  the Shift pressed to type a capital, and two of those inside the double-tap
  window is ordinary text entry. The stated reason says so, so the restriction does
  not read as arbitrary.
- **`double_tap` is now the default `activation_mode`** (ADR 0008), because the
  default capture triggers are modifier-only and in tap mode every single press
  of `Ctrl+Super` or `Ctrl+Alt` would act — taking that combination away from
  every other application. The default applies to a config that does not record
  an `activation_mode`; existing installations keep the value they have and no
  migration rewrites the field.
- New default shortcut rotation, identical on Linux, Windows and macOS:
  `Ctrl+Super` start/stop, `Ctrl+Space` pause, `Ctrl+Alt` abort, `Ctrl+S` mode
  select and `Ctrl+1`-`Ctrl+6` for the six processing modes. The per-OS
  branching is gone — divergent defaults are what let the legacy migration
  rewrite the Windows default on every save — and the set is asserted in tests
  to parse, register, not collide and survive normalization unchanged.

### Known issues

- The pause/abort interrupted-chord fix below is unobserved: neither the defect
  nor the fix has been seen in a running app, and on Windows and macOS the defect
  is untouched because those backends report no interruption signal at all.
  `docs/known-issues/pause-abort-interrupted-chord.md`.
- `cargo test` is not reliably green on a clean tree: two `core::runtime_log`
  tests and the `core::workspace_context` env-var pair mutate process globals
  and fail at random under parallel execution — 2 of 22 consecutive runs when
  measured. False negatives, not regressions;
  `docs/known-issues/rust-test-global-state-isolation.md`.
- Hold to talk does not work, observed live on a session where double tap on the
  same trigger does. Since double tap counts release edges that only follow a
  counted press edge, key delivery is ruled out and the fault is in the hold path
  or in what it starts. Narrowed to four candidates in
  `docs/known-issues/capture-shortcut-recording.md`, each of which names itself in
  the `[trigger]` log.

### Fixed

- Switching processing modes in the idle mode picker left the previous mode's
  pill painted underneath the new one. It looked like the compositor artifact
  accepted on 2026-07-20, but it was not: `dragSessionActiveRef` stayed true for
  the rest of the process after the first overlay drag, because the position
  persist handler cancelled the only timeout that ever ends a drag session.
  Both overlay layout effects bail on that ref, so from the first drag onwards
  the per-surface size sync and the visual-epoch repaint were dead — and the
  visual-epoch repaint is the only native repaint trigger for a change that
  keeps the same pill kind, such as a mode cycle. The grace timeout is now
  re-armed instead of cancelled, which keeps the long-drag persistence fix (K1)
  intact. See `docs/known-issues/overlay-drag-session-never-ends.md`.
- In "Copy and insert at cursor", the final result overlay could appear stacked
  on top of the previous overlay, which never went away. The visibility of the
  result surface was set in a React effect one render after the session ended,
  so a six-condition bridge predicate — reachable only on this delivery path —
  had to carry the pill across that render. When it did not hold, the pill
  unmounted for a frame and orphaned the processing pill's WebKitGTK compositor
  layers. The surface is now decided in the same reducer commit that ends the
  session (`RuntimeState.resultSurfaceOpen`), so the gap render no longer
  exists; the bridge, the commit-suppression ref and the sticky suppressed-result
  marker are gone. The overlay also emits a single surface value now, so the
  runtime is never told a different surface than the one being painted — that
  had been harmless only because every flat surface happens to be 480x60.
  (ADR 0011a)
- The "finished" cue in "Copy and insert at cursor" sounded before the result
  overlay appeared, and could fire for a result the runtime then discarded as
  stale. `Done` and `Error` were played from inside the insert helper, which
  three flows call at three different moments and always before their staleness
  gate. Cues now come from the session lifecycle, next to the event that tells
  the UI the same thing, so both delivery modes fire the same cue at the same
  meaning. `Handoff` moved into the branch that actually hands audio to the
  pipeline, after the capture teardown — an empty capture no longer announces
  work in progress and then contradicts itself. The insert-error arm that
  previously played no cue at all now reports one. (ADR 0012)
- Sound cues were sometimes swallowed entirely, started chopped, or fired
  twice. The per-cue device open could fail silently, the device was played
  before it had warmed up, and rapid cue chains overlapped acoustically. A
  failed abort also played `Abort` and then `Error` for one action; it now
  reports only the error.
- A per-mode hotkey now confirms itself on screen. The direct jump set the mode
  in the runtime but revealed nothing, so `Ctrl+1`-`Ctrl+6` looked dead while
  the mode had in fact changed. The overlay opens on the mode-select surface
  showing the new mode and auto-dismisses; it never starts a capture.
- Mode hotkeys changed in Settings are now actually re-registered.
  `configure_native_trigger` preserved them from in-memory state, so a new value
  was written to disk and the OS grab kept firing on the value from the last
  startup: mode select appeared dead no matter what you assigned, and configured
  versus registered disagreed silently.
- Shortcut recording is an explicitly ended state. It no longer commits on the
  first key release, so tapping `Ctrl` no longer writes `ctrl_l` and closes the
  recorder — the reason no further key could be added. The recorder accumulates
  the largest chord seen and requires confirmation.
- A single bare modifier can no longer be registered. It used to be expanded
  into a grab with no modifier at all, which consumed every `Ctrl` press
  desktop-wide and broke `Ctrl` shortcuts in other applications. Modifier-only
  shortcuts now require at least two modifiers.
- Opening a shortcut recorder now really releases the OS grabs, in Capture and
  in Modes. The previous soft pause left every shortcut grabbed, so the
  combination you already use was invisible to the recorder and could never be
  re-recorded; in Modes, pressing a live mode shortcut fired the mode action
  instead.
- Manual shortcut entry edits a local draft and only reaches the runtime on
  commit. Saving on every keystroke walked through intermediate values such as
  `c`, which are themselves valid single-key shortcuts and were registered as
  bare global grabs that then swallowed the very letters being typed.
- Persist-time normalization no longer truncates `Ctrl+Alt+Space`,
  `Ctrl+Super+Space` and `Ctrl+Cmd+Space`. The Windows default hotkey was
  rewritten to a modifier-only shortcut on every save. Legacy rewrites are now
  gated on `shortcut_schema_version` and run once.
- Clearing a shortcut disables it. An empty capture or mode shortcut used to be
  silently rewritten to the platform default, so a shortcut could not be turned
  off.
- Collision validation runs after normalization, not before, so two spellings of
  the same combination can no longer both pass validation and then collide on
  disk.
- A shortcut value that cannot be parsed is stored unchanged and surfaced as
  "not registerable" instead of being lowercased into something that can never
  register, with the failure visible only in a transient toast.
- The recorder accepts the runtime's full key vocabulary — arrows, numpad,
  punctuation, `Insert`/`Delete`/`Home`/`End`/`PageUp`/`PageDown`, `F13`+ — and
  `Escape` held together with a modifier is a chord member, so the default abort
  shortcut `Ctrl+Alt+Escape` can finally be recorded with the recorder that
  manages it.
- Shortcuts render as human strings (`Ctrl + F9`) in pills and summaries;
  raw tokens appear only behind the per-row "Enter manually" affordance.
- Pipeline watchdog and one transient provider retry prevent indefinite
  processing states and make failures visible in persistent logs.
- Native audio handling no longer retains a long-lived `rodio` output stream;
  capture errors terminate safely and buffer growth is capped.
- Duplicate session completion and insertion ownership errors are eliminated.
- Local provider slots, cleanup configuration, retries, profile history, and
  release status now reflect the native runtime contract.
- Linux portal-prompt classification, clipboard fallback, hotkeys, timeout
  handling, and recovery diagnostics now report actionable native truth.
- Overlay ghosting is blocked by opaque pill surfaces; clipboard-only commits
  preserve a safe processing hold instead of briefly mounting invalid result UI.
- Overlay placement persists only actual user drags, resolves monitor changes
  from stored logical placement, reapplies placement after reveal, and suppresses
  action clicks until a drag ends.
- Settings preserve native decorations and usable window minima; sidebar,
  provider selects, utility links, key-validation status, and normalized hotkeys
  behave consistently across supported hosts.

### Security

- Groq keys remain in the OS secret store and are scrubbed from saved JSON.
- Legacy JSON Groq keys migrate to the secret store before sanitized config is
  persisted.

## [0.2.0-alpha]

### Removed

- Debug code from `SettingsWindow.tsx` and `lib.rs`.

### Fixed

- Linux/Wayland startup no longer fails with GDK Error 71; transparent and
  undecorated paths fall back to XWayland where required.
- Overlay `show`, `hide`, and always-on-top crashes on Linux/Wayland were
  removed by using safer visibility and positioning behavior.
- Settings window visibility handling no longer crashes on Linux/Wayland.
- All platforms now use the unified user configuration path, restoring Groq
  configuration and transcription behavior.
- The IPv4 transport path prevents IPv6 connection timeouts from blocking Groq.

## [0.1.6-alpha]

### Fixed

- Groq API calls use forced IPv4 transport to avoid 20- to 60-second IPv6
  connection timeouts on every platform.
- Linux development mode starts the Python sidecar through the project root and
  its `.venv` rather than an uncontrolled system Python.

## [0.1.5-alpha]

### Fixed

- Linux Groq API calls use forced IPv4 transport when IPv6 fallback fails.
