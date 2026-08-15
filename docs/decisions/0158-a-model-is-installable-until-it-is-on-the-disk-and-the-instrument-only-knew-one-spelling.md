# 0158: A model is installable until it is on the disk, and the instrument only knew one spelling

Date: 2026-08-15
Status: Accepted. Implements
[ADR 0122](0122-in-app-model-installation-is-two-mechanisms-behind-one-surface-and-only-one-set-of-files-is-ours.md)
as speech-track step **B5**, and closes
[ADR 0042](0042-one-surface-owns-every-model-choice.md)'s gate. Bumps
[ADR 0115](0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md)'s
catalogue to version 2 and takes the last two entries on that record's own
inventory. Applies
[ADR 0128](0128-a-drawing-inherited-from-the-demo-gui-is-an-inventory-and-the-config-is-the-answer.md)'s
rule to six drawn numbers. Does not retract
[ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md).

## Context

ADR 0122 planned the step in full and left four things for the build to decide,
plus one it could not have known about. This record is what landed, what the
plan estimated wrongly, and the one finding that is not about models at all.

**ADR 0042's gate has been open since 2026-08-03**: *until in-app installation
exists, the local lane is expert configuration and the surface says so.* It
closes here.

## Decision

### What was built

`core::model_install`, five commands, one channel, and a catalogue at version 2.

| Piece | What it is |
| --- | --- |
| `shared/model_catalogue.json` v2 | nine local rows gain `install`, additively — five `Download`, four `ServerPull` |
| `core::model_install` | the managed directory, the transfer, the register of running installs, the removal refusal |
| `model_library` | one read for the whole tab: a directory listing plus one question to the local server |
| `install_model` / `cancel_model_install` / `remove_model` / `open_model_folder` | the four the surface's drawn controls needed |
| `wordscript-model-event` | progress, on its own channel and never on either session channel |
| `useModelLibrary` | one read plus one listener, and the rows a running install moves |

**The plan said three commands and it is five.** `cancel_model_install` is one
ADR 0122 requires by name — *a cancel or a failure removes the part file* — and
was simply not counted; `open_model_folder` is a drawn control that would
otherwise have had the frontend assemble a path the runtime resolves. Saying so
is cheaper than pretending the estimate held.

### The four rules a transfer obeys, and where each one lives

- **Verified before it is named.** The bytes land in `<file>.bin.part`, the
  SHA256 is checked against the catalogue row, and the rename happens only then.
  The cancel flag is read again *after* the hash and *before* the rename, which
  the plan did not spell out and which is the only ordering with no window in it.
- **The size is known before the first byte.** Free space is checked against
  `size_bytes` plus a fixed 512 MB floor. The floor is fixed rather than
  proportional because what a machine needs to keep working is not proportional
  to what is being downloaded onto it.
- **A late install is discarded.** One that completes after its cancel is
  dropped, logged, and reported as cancelled — the rule this track already holds
  for provider, transform and insert results against the active session.
- **Its own channel.** `wordscript-model-event`. A download is not a session and
  must not be able to reach the reducer at all; the cheapest guarantee is not to
  give it the door (ADR 0018, ADR 0019).

### Four choices this record takes that ADR 0122 left open

- **The install block carries its own `source` and `read_date`.** ADR 0122's
  consequence section gives `docs/PROVIDERS.md` a maintenance duty over a
  `Download` row's URL, size and checksum; a duty over facts with no date on
  them is a duty nobody can discharge. So they are dated like every other row
  here, and the schema requires both.
- **`file_name` is carried, not derived from the URL.** `core::providers::local`
  resolves a recogniser by the `ggml-{stem}.bin` shape, and a URL is free to be
  spelled any way at all — a redirect, a query string, a mirror. Deriving the
  name from it would land a file the discovery cannot see, which is the
  fake-installed state one step past the fake-available one this step removes.
- **The pull tags are the explicitly quantized ones.** `qwen2.5:7b-instruct-q4_K_M`
  rather than `qwen2.5:7b-instruct`. Identical bytes today, and the tag then
  states the quantization the drawing spends beside it — so that column and the
  tag cannot drift apart, which is the same argument that put the tag beside
  `model_id` instead of deriving it.
- **A cancelled server pull abandons rather than stops.** Ollama owns the
  transfer; dropping the response ends WordScript's interest in it and a pull
  that finishes anyway leaves a model on a disk this build does not manage. The
  surface says the *install* was cancelled, which is true, and does not claim the
  file is gone. Logged at the abandon.

### Nothing is offered as available that is not on the disk

`fallback_provider_profiles` used to offer `base`, `small`, `medium` and
`large-v3` whether or not one of them existed. It now returns nothing, and
discovery gains the managed directory as a **third** source after both
environment variables — an expert who has pointed WordScript at their own
whisper.cpp checkout is never overridden by what this feature installed.

**`resolve_local_model_path` gained the same third source, and that half is not
in ADR 0122's `Touches` line.** Discovery finding a model the decode path cannot
resolve would be a profile that is offered, chosen and dead at first capture. An
install is worth something only when both halves see the file.

### Six drawn numbers were wrong and are corrected

ADR 0128: a drawing inherited from the demo GUI is an inventory of intent, and a
false sentence in it is corrected. Six were.

| Row | Drawn | Catalogued |
| --- | --- | --- |
| `ggml-base`, `ggml-base.en` | 142 MB | 148 MB |
| `ggml-small` | 466 MB | 488 MB |
| `qwen2.5-7b-instruct` | 4.4 GB | 4.7 GB |
| `qwen2.5-14b-instruct` | 8.4 GB | 9.0 GB |
| `gemma-3-4b-it` | 2.5 GB | 3.3 GB |

**Five of the six are one mistake and the sixth is a different one.** The five
were binary units printed under decimal names — 142 MiB is what whisper.cpp's
own README table says, and 148 MB is what the Hugging Face file listing says
about the same file. The number on this surface was never the number on the page
the file comes from. `gemma-3-4b-it` is not that: 2.5 GB was a plausible figure
for a 4B model and the pull is 3.34 GB, because Gemma 3's 4B ships a vision
tower.

Decimal wins because both sources publish decimal. `formatUploadSize` keeps
saying MiB one axis over for the mirror-image reason: every vendor that
documents an upload ceiling documents it in MiB, and the runtime's own refusal
prints MiB.

### Free space is answered on unix and unanswered elsewhere

`available_bytes` is `statvfs` through `libc` on unix and `None` on Windows.
**`None` is not zero and is not "plenty"** — it is the shape
`capture_limits_if_known` already uses one axis over, and the caller proceeds
rather than refusing an install because of this build's own blindness.

The Windows equivalent (`GetDiskFreeSpaceExW`) is deliberately not written here:
it cannot be compiled or run on the reporting machine, and an unverified FFI
call in the one path that writes to a user's disk is a worse answer than an
honest absence. **It is the one clause of ADR 0122 this step does not fully
discharge**, and it is written down rather than left to be discovered.

### The finding that is not about models

**The command sweep resolved channel constants on the frontend side and only
string literals on the Rust side**, so the same channel was visible when spelled
one way and invisible when spelled the other. `wordscript-model-event` is a
`pub const` on both sides, and the sweep reported its listener as *waiting for
nothing* while five emit sites stood beside it.

This is ADR 0153's shape exactly — an instrument that knew one form of the thing
it was measuring — and the fix is symmetry rather than a second spelling of the
string in Rust. `scripts/command-sweep.mjs` now builds the same constant table
from `const NAME: &str = "…"` and resolves a bare identifier or a path
(`model_install::MODEL_EVENT_CHANNEL`) through it. All four defect directions
report zero again.

**It belongs to the GUI port's instrument and was changed by this step**, which
is worth stating out loud on a tree three tracks share.

## Consequences

- **ADR 0042's gate is closed.** In-app installation exists. The local lane is
  still unpublished — ADR 0067's preview badge stays until Phase 5, and ADR 0121
  renamed the identifier precisely so that nothing gets renamed when it comes
  off.
- **`docs/PROVIDERS.md` § Local carries the maintenance duty ADR 0122 named.**
  A `Download` row's URL, size and checksum are dated facts, and a weights
  repository that moves a file breaks an install rather than a claim. The
  ignored acceptance test below is what turns that break into a red test.
- **Two dependencies entered and the advisory sweep is clean.** `reqwest` gains
  `stream`, `sha2` is new; the lock also gained `tokio-util` and a second
  `wasm-streams` (wasm-only, not compiled on any target this build ships).
  All 661 crates in `Cargo.lock` were checked against the RustSec advisory
  database: none of the four appears, and every finding in the tree is
  pre-existing. `npm audit` is unchanged at five `undici` advisories, none of
  them this step's — no npm dependency moved.
- **The onboarding surface reads the corrected numbers and is still a drawing.**
  `OnboardingScreen` is rendered by the gallery and by nothing in the product,
  so its rows resolve their sizes from the catalogue and their controls stay
  inert. Wiring it belongs to whichever step gives onboarding a runtime.
- **`port:diff` moved on the machine tab and nowhere else.** `models` is
  unmoved at `structural 26 | style 242 | text 19`; `models#1` goes
  `0 | 0 | 1` → `0 | 0 | 7`, and the six are exactly the six corrections above.
  The pre-existing single difference predates this step. **The onboarding
  library is not measured at all** — `port:diff`'s onboarding walk clicks
  *next* and never selects the Local lane, so the step that draws those rows is
  outside the instrument's reach. That is a gap in the measurement, not a
  fidelity result.
- **One acceptance runs against the network and is ignored by default.**
  `a_real_download_verifies_installs_and_is_then_found_with_no_environment_variable`
  fetches the real 148 MB `ggml-base.bin`, verifies its checksum, proves no part
  file survives, and then proves both discovery and the decode path find it with
  neither environment variable set. It passed in 19.3 s on 2026-08-15. Run it
  with `--ignored` whenever the catalogue's `install` block changes.
- **The download path takes a reporter closure rather than an `AppHandle`.**
  Otherwise the one path that writes to a user's disk would be the one path no
  test could run.
- **What was not verified: the click-through in the native host.** The plan
  asks for it by name, because progress is `invoke()` plus an event bridge and
  four legs have found a defect exactly there. The app builds and runs with this
  code; the runtime chain is proven end to end by the acceptance test above and
  the surface by jsdom. The seam between them — a real click on *Download* in
  the real webview — is owed and is the first thing to do with this step.
