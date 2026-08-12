# WordScript -- Vision

Status: 2026-08-11 — the surface paragraph read against the shipped IA by Leg 9;
the direction itself is unchanged since 2026-08-03

> Architecture decisions that ground this vision live as append-only ADRs in
> `docs/decisions/`. This file is the living north star; the roadmap is the
> executable view (`docs/ROADMAP.md`), STATUS holds the current phase state.
> The consolidated spec is `docs/spec/SPEC.md`.

## North Star

WordScript is an open desktop dictation app that is faster and more honest
for heavy writers than generic voice tools.

Not a general AI assistant. Not a feature collection. A product for one
clear moment:

**Trigger. Speak. Usable text. Clean recovery. Keep working.**

## Community posture

WordScript is built under SW forge, the open-source brand of SW labs. The
product is meant to grow as a community build: open in the repo, traceable in
the runtime path, attractive to people who want to build a good dictation
product rather than ship another subscription model.

A later commercial release path is not excluded. But the direction is clear:
first a genuinely good product, no artificial paywall on basic productivity
like speaking, typing and continuing to work.

## What WordScript should become

Long term, a strong open dictation base for desktop workflows:

- fast enough for IDEs, chat, mail and documents
- flexible enough for different providers and later work profiles
- honest enough to not hide platform limits and recovery behind marketing
- open enough that users control their rules, data and workflows

## What V1 is

V1 is a narrow dictation product for desktop text fields:

- global trigger
- stable capture-to-insert loop
- cloud-first transcription as the default path
- personal dictionary and first snippets
- a clear recovery model
- honest support tiers
- one small, productive desktop surface instead of a tool collection

V1 is **not**:

- a general AI assistant
- a screen-context system
- a team or admin surface
- mobile parity
- an auto-updater sold as finished while half-done

## What V2 is

V2 only begins on top of a working dictation core. Only then do topics like
these make sense:

- later rewrite styles and more productive text modes
- team dictionaries or shared snippet sets
- deeper IDE integrations
- later assistant or command workflows
- a possible hosted mode with its own backend

V2 is expansion on top of a good core, not a shortcut past V1.

## Long-term platform direction

Long term WordScript may grow larger than a pure dictation product, toward an
open voice workstation for desktop work: dictation and text modes for
IDE/mail/chat/documents, later meeting transcription, speaker diarization
and history, notes, search, sync, API and MCP, local profiles, shared work
contexts and later team models, a later voice assistant that executes tools,
and later browser-use / computer-use workflows with clear permissions and
visible control.

This direction is real, but it is **not** the current V1 core and must not
blur the active dictation, recovery and support focus.

**Two items in that list have since been separated** (ADR 0029, ADR 0030).
"API and MCP" moved closer, and further than first recorded: WordScript exposes
itself as an MCP server so a coding agent can ask its user a question by voice
and receive the spoken answer -- and the same channel runs the other way, so work
can be started by speaking instead of by opening a repository. One configured
orchestrator is the only party WordScript talks to; it drives the coding agents
and reaches the user only for decisions it cannot make. This is scheduled work
(ROADMAP Phase 8). "A later voice assistant that executes tools" did not move,
and is not merely unscheduled -- side-effecting tools are
ruled out of the dictation path permanently, because a low-confidence speech
channel must not drive actions and because a session that ends in exactly one
commit has nowhere to put a tool loop. If such a surface is ever built it is an
explicitly invoked asynchronous one, beside the dictation path rather than
inside it. Browser use and computer use stay where they are: far, and
unscheduled.

Chat, Upload and Account are no longer on the surface at all: the pre-port
shell's previews of them were deleted with its fourteen flat areas in Leg 3
(ADR 0054). What remains drawn-and-not-wired is Context, Notes & Meetings,
Agents and Integrations, each carrying a banner naming the phase it belongs to.
A drawing is not evidence that the later platform behavior exists.

### One input, three outputs — the direction as of 2026-08-03

A planning pass on the settings prototype (ADR 0044--0047) moved the long-term
shape from a list of later features to one sentence:

> **The voice is the input. What stays is context. The output is the cursor, an
> object, or an agent.**

The pull behind it is real and is stated here rather than left implicit: speech
to text is becoming a commodity, so a product whose whole claim is "your words,
transcribed and inserted" is competing on something that will be everywhere. The
part that does not commoditize is what happens either side of the transcription
— **what accumulates from what you said**, and **what can act on it**.

Concretely, and all of it planning direction rather than built:

- **Everything recorded is one object** (ADR 0045). A dictation, a meeting, an
  uploaded file, a link and a calendar entry that has not happened yet share one
  type. What accumulates is a living record rather than a folder of transcripts.
- **The effect line is the product's central boundary** (ADR 0044). The
  assistant writes text and reaches nothing; `the desk` — the one orchestrator
  of ADR 0030 — acts and reaches whatever it is connected to. A dictation
  crosses that line only through a visible, keyed handoff.
- **We do not build the connector layer** (ADR 0046). The desk is an agent CLI
  with its own MCP client. WordScript reads what makes a context object exist
  and builds the door into that directory; it does not maintain a second
  integration surface.

**What this does not change.** V1 is unchanged and this direction does not pull
any of it forward: transcription reliability outside `General Writing` is still
the acute gap, none of the above is implemented, and the rule at the top of
"What must not happen now" still governs. What has changed is that the later
platform stage now has a decided shape rather than a list, so that when it is
built it is built once.

Even in that later platform stage the core stays the same: WordScript stays
usable without an account, while later sync and workspace features add on.

## Where we are

Current state: `0.2.2-alpha`.

The product core is real: native hotkeys, native capture, Groq BYOK, a local
runtime lane for STT plus cleanup, a native transform pipeline, local text
profiles for context/dictionary/snippets, native insertion with recovery,
native history with retry/filter/export, active settings and diagnostics
surfaces.

What is still missing is mostly product consolidation:

- transcription reliability outside `General Writing` or no profile still falls
  behind the baseline too often; profile-bound STT bias must not pull
  multilingual fragments, fantasy tokens or topic drift into raw transcripts
- today WordScript is effectively used as a dev build via
  `npm run tauri dev`
- a clean commercial release build-up without false release or update promises
- more sharpening on recovery, support communication, text rules and guided
  local setup

In parallel an internal cross-platform release build-up for Linux, macOS and
Windows is maintained. It is not the current launch release and does not
replace reliable dictation quality.

## Current decisions

- Active core stays Tauri/Rust plus React UI (ADR 0001).
- Cloud is the V1 default path; Groq is the first real provider; BYOK stays
  the credential strategy (ADR 0002).
- Dictionary and snippets live in the native transform path.
- Recovery with clipboard, scratchpad and last-transcript restore is part of
  the product promise.
- Distribution, signing and updater are active build-up paths, not finished
  user promises.
- If sync comes later, it is an optional WordScript-owned local-first layer,
  not a peer-to-peer primary model (ADR 0005).
- UI architecture: settings are a native-macOS-inspired WordScript shell with
  grouped sidebar and a system-settings grouped-form kit. Stack is shadcn/ui
  + Tailwind v4 on the existing v2 CSS-variable tokens. Window chrome stays
  **native on every OS** (`decorations: true`) -- no frameless window, no
  fake traffic lights, no `macOSPrivateApi` on the main window (ADR 0003).

## Platform target

- macOS: Tier 1 target
- Windows: Tier 1 target
- Linux X11: Preview
- Linux Wayland: Experimental

## What must not happen now

The current work must not drift back into:

- scope expansion into assistant, agent or account topics before a stable core
- confusing the internal release build-up with launch readiness while
  profile-dependent transcription errors still undermine everyday use
- rolling out aggressive profile or prompt bias that worsens raw transcripts
  versus `General Writing`
- new dead settings options without a real runtime path
- documentation that describes planned topics as implemented

## Immediate product priorities

1. Harden transcription reliability in the active dictation path. Active
   profiles must not make raw transcripts less reliable than `General
   Writing` or no profile. The next concrete steps are a fixed regression
   corpus from real failed transcripts, then visible profile health with an
   explicit profile-bound bias policy instead of only implicit conservative
   defaults.
2. Continue the settings tabs as a calmer, clearer, more native-feeling
   product surface -- closer to a small macOS utility app than a web config
   panel. The overlay is not the primary work site right now.
3. Densify profiles from static rule sets into visible local work modes for
   context, dictionary, snippets, processing mode, insert and recovery
   defaults, but keep them local and manual for now.
4. Grow the provider stack from Groq plus `local` into a real model
   system with at least one second production provider and clear modes
   `fast`, `quality`, `local` and later `self_hosted`; the `local` vs
   `self_hosted` semantics must be clear and honest first.
5. Move the local runtime lane from env-based expert config toward a
   first-class local product option with guided model management, pull
   checks, health diagnostics, bias prompting and setup help.
6. Keep the commercial release build-up honestly internal, without
   pretending published releases or working updates, until the product base
   actually supports that release.

The most acute product gap versus paid alternatives is not primarily
packaging or more platform scope, but the combination of profile-dependent
transcription reliability and UI guidance of the settings shell.

## Phase roadmap

The order, scope and current state of the V1 consolidation phases is in
[ROADMAP.md](./ROADMAP.md), and the phase list is not repeated anywhere else —
naming the phases in prose is how three copies of it drifted apart.

The division of labour between the four:

- **VISION** is the north star: why the product exists and where the V1/V2 line
  falls.
- **ROADMAP** is the executable view: the phases, their order and their gates.
- **STATUS** is what works today.
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** is what is being built right now,
  by which track, in what order.
