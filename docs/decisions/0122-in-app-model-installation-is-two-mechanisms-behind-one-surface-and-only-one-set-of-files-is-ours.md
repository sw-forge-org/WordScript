# 0122: In-app model installation is two mechanisms behind one surface, and only one set of files is ours

Date: 2026-08-12
Status: Accepted (planning direction; not implemented). Precises the reasoning
of [ADR 0042](0042-one-surface-owns-every-model-choice.md) without superseding
it — the one tab stands. Builds on
[ADR 0115](0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md)
as scoped by
[ADR 0120](0120-a-vendor-serves-its-model-ids-and-the-catalogue-keeps-the-columns-no-endpoint-answers.md).
Does not retract [ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md).

## Context

**The surface has been drawn and dead since Leg 6.** `Models.tsx`'s `MachineTab`
draws both kinds of local model with a size per row, a quantization, a
`downloading` state with a percentage, an installed total (`2 installed ·
284 MB`) and *Open the model folder*; `Onboarding.tsx` draws the same rows in
the first-run step. Nothing behind any of it exists.

**What the runtime actually does is scan.**
`discover_local_provider_profiles` reads `WORDSCRIPT_LOCAL_MODEL_PATH`, or scans
`WORDSCRIPT_LOCAL_MODEL_DIR` for files matching `ggml-*.bin`. There is no third
source. A user who has set neither variable gets
`fallback_provider_profiles`, which offers `base`, `small`, `medium` and
`large-v3` **whether or not a single one of them is on the disk** — four rows
naming four files that may not exist, which is the fake-readiness defect the
runtime rules forbid, sitting under the one lane whose whole difficulty is that
its dependencies are the user's problem.

ADR 0042 named this exactly and made it the gap it existed to close:

> What actually had no home was the *installation*: a server, a runner, model
> files, downloads, disk.

and set a gate that has been open ever since: *until in-app installation exists,
the local lane is expert configuration and the surface says so.* The runtime for
it sat in `docs/ROADMAP.md`'s Phase 5 and in no step of the speech track. The
owner moved it into the track on 2026-08-12, directly after B3.

### The finding: the two halves do not share a disk

ADR 0042 argues the single tab from a shared substrate:

> **The local installation is the second tab, and it is one tab for both kinds.**
> Speech models and language models sit on the same disk, under the same
> runtime, and compete for the same memory.

**Half of that is not true in this tree, and it decides the shape of the step.**
The local chat role does not run a model — it talks to one that something else
runs. `DEFAULT_LOCAL_CHAT_BASE_URL` is `http://127.0.0.1:11434`;
`fetch_local_chat_models_async` issues `GET {base}/api/tags`;
`create_chat_completion` posts `{base}/api/chat` and parses an
`OllamaChatCompletionResponse`; the guidance the user is shown when it fails
says *Start Ollama*. The catalogue row this build actually reaches is
`local-chat-ollama-llama32`, `llama3.2:latest`, and its own note already says
what the id is: *an Ollama tag rather than a vendor model id.*

**Ollama owns its store.** A `.gguf` WordScript downloads into a folder of its
own is a file Ollama cannot see, cannot load and will not list — so it would
appear in WordScript's installed total, consume the disk, and serve no job. The
same act that is correct for a speech model is inert for a language model.

So: **the same disk is wrong, the same runtime is wrong, and the same memory is
right.** The memory claim is the one that carries the argument — a 4 GB language
model and a 1.6 GB speech model do compete for the RAM of the machine that loads
them, and a total split across two screens is invisible exactly when it matters.
The tab stays whole for the reason that survives, and the two cards inside it
tell the truth about who owns the file.

### The second finding: the catalogue does not carry what the drawing spends

B3 landed `shared/model_catalogue.json` behind `core::model_catalogue`, and a
row carries `(id, provider, role, model_id, streaming, languages, source,
read_date, note)`. The drawn rows spend two more things beside the id — the size
(`466 MB`) and the quantization (`Q4_K_M`) — and both are still literals in
`Models.tsx` and `Onboarding.tsx`, which is one of the three places ADR 0115
listed in its own inventory of where a model id lives. Moving the id into the
catalogue and leaving the size behind would split one drawn row across two
files, which is the condition ADR 0115 was written to end.

## Decision

**One surface, two mechanisms, each named on its own card.** The tab is not
split. What differs is who owns the file, and the surface says which:

| Half | Owner | Mechanism |
| --- | --- | --- |
| Speech (`ggml-*.bin`) | WordScript | it downloads the file itself into a directory it manages |
| Language (Ollama tags) | the server the user runs | it asks that server to pull, and never places a file beside it |

**The catalogue grows an optional install block, additively.**
`CATALOGUE_VERSION` goes 1 → 2 and `ModelRow` gains
`#[serde(default)] install: Option<InstallSource>`, the shape `note` already
has. There is no migration, because there is no on-disk state: the file is
compiled in through `include_str!`. Two variants, because there are two
mechanisms: `Download { url, size_bytes, sha256 }` and
`ServerPull { runtime, tag, size_bytes, quantization }`. **The pull tag is
carried separately from `model_id` on purpose** — Ollama's `qwen2.5:7b-instruct`
and the drawn `qwen2.5-7b-instruct` are not the same string, and deriving one
from the other by rewriting punctuation would be a guess dressed as a lookup.

**A hosted lane carries no install block, and `None` is the answer rather than
an omission.** There is nothing to install for Groq or OpenAI, and a surface
asking the question about them is asking the wrong lane.

**A managed directory, and the environment still wins.** The directory hangs off
`core::paths::user_data_dir`, so it inherits `WORDSCRIPT_DATA_DIR` and the test
redirection that keeps `cargo test` out of the developer's real data — which is
why it belongs there and not in the installer. Discovery gains it as a **third**
source, after the two environment variables: an expert who has pointed
WordScript at their own whisper.cpp checkout is never overridden by what this
feature installed.

**Nothing is offered as available that is not on the disk.** `fallback_provider_profiles`
stops inventing four rows. A catalogued model with no file is offered as
*installable*, which is a different sentence from *available* — the same
distinction ADR 0106 draws one layer up between *no adapter*, *role denied* and
*credential missing*, and it gets its own sentence for the same reason.

**Progress travels on its own channel.** A new `wordscript-model-event`, not
`wordscript-event` and not `wordscript-native-event`. Those two are the session
channels, and ADR 0018 and ADR 0019 spent a leg each establishing that one
session ends in exactly one reducer commit and that the native channel must
never set session state. A download is not a session and must not be able to
reach the reducer at all — the cheapest way to guarantee that is not to give it
the door.

**A download is verified before it is named.** The bytes land in `<name>.bin.part`,
the SHA256 is checked against the catalogue row, and only then is the file
renamed into place. A cancel or a failure removes the part file. There is no
window in which half a model is spelled like a whole one, and the integrity
check is the reason the row carries a checksum rather than only a size.

**The size is known before the download, because the drawing promises it.** Free
space is checked against `size_bytes` before the first byte is requested. The
drawn note — *a model that does not fit does not fail at download time, it fails
at first use* — is about memory, and it stays true; disk is the one the runtime
can answer up front, and it does.

**A late download is discarded, not applied.** An install that completes after
its cancel is dropped and recorded in the runtime log only, guarded on an
install id. This is the rule the track already holds for provider, transform and
insert results against the active `processing` session, applied to the one other
place where a slow result can arrive after the thing that wanted it is gone.

**Removal is refused while a profile resolves to the model**, and the refusal
names the profile. Deleting the model your dictation runs on and discovering it
at the next capture is the fake-state defect with the user's own action as its
cause, which is the shape ADR 0105's credential adoption was written to avoid
one axis over.

## Consequences

- **ADR 0042's gate closes when this lands, and not before.** Until then the
  surface keeps saying the local lane is expert configuration. The record's
  substance — one section owning every model choice, one tab for the local
  installation — is unchanged; only its *same disk, same runtime* justification
  is narrowed to the memory argument that survives contact with the tree.
- **ADR 0067's preview badge is untouched.** This makes the lane installable, not
  published. Phase 5 still owns publishing it, and ADR 0121 renamed the
  identifier precisely so that nothing gets renamed when the badge comes off.
- **Two dependencies enter for it**: `reqwest`'s `stream` feature, which this
  build does not have (`default-features = false`, with `blocking`, `json`,
  `multipart`, `rustls-tls`), and `sha2`. Both are dependency changes and get
  the advisory sweep the runtime rules require.
- **B4's live fetch is already half-built for this lane**, and the overlap is a
  saving rather than a conflict: `fetch_local_chat_models_async` is the Ollama
  listing B4 would add, in the tree since before this record. What the language
  half adds on top of it is the pull, not the list.
- **The language half depends on a server this product has not decided about.**
  Whether WordScript ships an OpenAI-compatible server or talks only to the one
  the user runs is open, belongs to Phase 5, and is the same question F3 asks one
  level down (ADR 0096: take it once). This record commits only to the second
  answer being supported: WordScript asks whatever server is there to pull, and
  owns none of it.
- **`docs/PROVIDERS.md`'s local section gains a maintenance duty** it did not
  have: a `Download` row's URL, size and checksum are facts with a read-date like
  every other row, and a weights repository that moves a file breaks an install
  rather than a claim.
