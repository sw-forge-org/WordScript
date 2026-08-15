# 0159: The listing unions, the rank decides, and a control that appears late keeps the port its subject

Date: 2026-08-15
Status: Accepted. Speech-track step **B8**. Corrects a defect in
[ADR 0158](0158-a-model-is-installable-until-it-is-on-the-disk-and-the-instrument-only-knew-one-spelling.md)
and narrows one sentence of
[ADR 0122](0122-in-app-model-installation-is-two-mechanisms-behind-one-surface-and-only-one-set-of-files-is-ours.md)
without retracting its decision. Applies
[ADR 0128](0128-a-drawing-inherited-from-the-demo-gui-is-an-inventory-and-the-config-is-the-answer.md)'s
rule to a surface that has to grow, and keeps
[ADR 0057](0057-the-prototype-has-an-expiry-date-and-the-gallery-has-two-halves.md)'s
acceptance surface measurable while it does.

## Context

The owner's brief: more models are coming, and not only curated ones — people
will want to bring their own. That needs a surface that survives a list ten
times its drawn size, and a way in for a model this repo has never heard of.

Two donors were read and they answer complementary halves. **Neither answers
both**, and the gap between them is where the work is.

| Question | `openwhispr` (Electron) | `Handy` (Tauri/Rust) |
| --- | --- | --- |
| Many curated rows | provider tabs plus a plain list; **search only above `LIST_SEARCH_THRESHOLD = 12`** — then grouped headers with counts, virtualized rows, arrow-key navigation, the selected row pinned above the groups, and an empty state naming the query | one list split into *Your models* and *Available*, with a language filter |
| A model you brought | **no path at all.** Its "custom" is a typed model id on an enterprise provider (`allowCustomModelId`); every local model is a curated registry row | **the folder is the mechanism.** `discover_custom_whisper_models` walks the models directory, skips predefined filenames, and files what is left as `is_custom: true` with `url: None`, `sha256: None`, `"Not officially supported"`, and score bars hidden by a `0.0` sentinel |

**Handy is the closest donor for anything model-management** — Tauri, Rust,
`sha2`, a cancel flag, a `.partial` file — and this repo's donor routing does
not say so anywhere. It does now, in the speech track's plan.

**And a third finding, unlooked for.** openwhispr's whisper registry carries
`size: "142MB"` **and** `expectedSizeBytes: 148000000` for the same file, and
prints the first. That is exactly the duality ADR 0158 corrected here, in a
second codebase, unprompted — which retires any suspicion that the correction
was a misreading.

### The defect B5 left

`model_library` walked `installable_rows()` — the catalogue. A `ggml-*.bin` the
user put in the managed folder was discovered by
`core::providers::local`, resolved by the decode path, and would transcribe
happily; **the tab called *On this machine* did not list it.** The step that
existed to end a surface claiming what is not on the disk shipped a surface
that hid what is.

### And a second one, from misreading ADR 0122

That record says *an expert who has pointed WordScript at their own whisper.cpp
checkout is never overridden by what this feature installed*. B5 implemented
that as an early return: the first source that yielded won, and the rest were
not consulted. The consequence is a defect nobody would report as one — **with
`WORDSCRIPT_LOCAL_MODEL_DIR` set, a model installed through the app was on the
disk, resolvable, and never offered.** In-app installation quietly did nothing
for exactly the users most likely to have that variable set.

B5 also wrote a test asserting that behaviour was correct. It has been
rewritten, and the rewrite says why.

## Decision

### The listing unions; the rank decides

Two questions, and B5 answered them with one mechanism.

- **`local_model_sources()`** returns every place a recogniser may be, highest
  rank first: `WORDSCRIPT_LOCAL_MODEL_PATH`, `WORDSCRIPT_LOCAL_MODEL_DIR`, the
  folders the user added on `AI Models`, the managed directory.
- **Discovery unions them.** A name in two folders is one model on this machine
  as far as a picker is concerned, and the highest-ranked source wins the label.
- **Resolution walks them in order** and the first that can answer is the
  answer. ADR 0122's guarantee lives here rather than in the listing:
  overriding is a tie-break, not a reason to hide everything else.
- **The error belongs to the highest-ranked source that failed**, and never to
  the managed directory. Somebody who pointed WordScript at a checkout and
  mistyped a model name is still told about their checkout; a machine that has
  installed nothing still hears *nothing is configured* rather than *not found
  in a directory you have never seen*.

### Two ways in, because both cases are real

The owner asked for both and was right to.

| Way | What it does | Why not only the other |
| --- | --- | --- |
| **`import_model_file`** | copies a picked `.bin` into the managed directory, through a `.part` file, with progress on `wordscript-model-event` | somebody with one file in their downloads wants it *in*, and then removal, the installed total and discovery all keep one rule |
| **`add_model_folder`** | records a folder and **never writes into it**; the models in it are used where they lie | somebody with a library on a home server does not want a second copy of a 1.6 GB file |

*Open the model folder* stays as the third, and it is Handy's whole answer.

**An import is not checksummed and is not asked to be.** The catalogue's
checksum answers *did this download arrive intact*; a file somebody already has
needs no such answer, and demanding one would refuse exactly the models the
feature exists to accept. What it does check is that the name is one the
discovery can see (`ggml-<name>.bin` — a file landing under any other name is
copied, counted and never resolvable) and that no catalogue row already owns it.

**A folder is added even when it holds nothing today.** A share that is not
mounted is not an empty folder, and refusing it would make the feature work
only while the network does. The surface says `Not mounted` instead.

**Removing a folder removes no file.** It was never this build's to delete, and
somebody who added a path expects removing it to undo the adding and nothing
else. Removing a *model* is refused unless WordScript put it in the folder it
manages.

### The language half gets a typed tag, not a folder

`pull_model_tag` asks the local server to pull a tag the catalogue does not
carry. There is no folder to point at and no file to copy, because Ollama owns
that store — the asymmetry is the same one ADR 0122 built the tab around. It is
openwhispr's `allowCustomModelId` for the same reason: a vendor whose catalogue
can never be complete needs a field beside the curated list.

**Its `total_bytes` starts at zero and that is deliberate.** Nobody has asked
the server how big an uncatalogued tag is, and printing the catalogue's idea of
a size for a tag the catalogue does not carry would fabricate the one number
this surface promises to state truthfully. The percentage comes from the
server's own `completed` as the pull runs.

### A control that appears late keeps the port its subject

**This is the part that generalises past this screen.**

The prototype already answers the search question — *filters are a toolbar: they
belong above the thing they filter, on one line, and the count belongs to the
list they produce* — and `Toolbar`/`ToolbarSearch` have been ported and unused
since Leg 2. So the control is not invented; it is placed.

Placing it is the problem. A toolbar goes above its list, which is mid-screen,
and B7 measured what an addition costs there: it renumbers every section after
it. The answer is the threshold:

> **Below the threshold the surface is exactly the drawing, and the gallery
> keeps measuring it. Above it the list is no longer the drawing, and the
> control appears.**

Borrowed at 12, openwhispr's own number, because that donor has the scale to
have found out. The drawn tab has five speech rows and four language rows, so
today nothing renders and `port:diff` is unmoved — `models` at
`structural 26 | style 242 | text 19`, `models#1` at `0 | 0 | 7`, both exactly
where B5 left them.

**The cost is named rather than hidden**: a control that only exists above a
threshold is a control the gallery cannot reach, so it is held by tests and not
by the port. That is the same class of gap Leg 13b recorded when two row classes
turned out to need runtime state the owner's profile does not have. It is a
population fact, not a clean bill.

### A row the drawing has no sentence for still renders

`libraryModel` throws for anything outside the nine rows Leg 6 drew. That was
correct while the list *was* those nine and became **a crash** the moment the
tab started listing what is on the disk — the first test written against a
user's own model took the whole tab down. `drawnLibraryRow` now falls back to
what the runtime knows. Handy does the same thing for the same reason: nobody
wrote a description for a model nobody curated, so its rows read *Not officially
supported*.

### An empty card is not a filter that found nothing

The first draft told somebody who had typed nothing that their filter matched
nothing. A card with no rows is an empty list; only a card with rows and no
matches names the query.

## Consequences

- **`AppConfig` gains `local_model_dirs: Vec<String>`**, additive under
  `#[serde(default)]`, so a config written before this field needs no migration
  and no schema counter moves. It is machine-wide rather than per profile: where
  models live is a property of the installation, not of the writing style that
  uses them.
- **ADR 0122's *never overridden* is narrowed to a tie-break** and its decision
  stands. Nothing about the two mechanisms, the managed directory or the channel
  changes.
- **`config.rs` is now read by `core::providers::local`.** `local_model_sources`
  loads the config on every call rather than caching it, because a folder added
  on a settings screen has to be visible to the next read.
- **The suite grew a latent flake and it was removed in the same session.** The
  first draft of the user-folder test wrote the shared test config, asserted,
  and cleaned up afterwards — so a failing assertion left a folder list behind
  that made an unrelated test resolve a model it should not have found. It
  surfaced three tests away as a wrong `LocalProviderIssueCode`. Everything is
  read before anything is asserted now, and the config is restored in between.
- **+5 Rust and +8 frontend**, each made to fail first: four Rust mutations and
  seven frontend ones, in three batches. `cargo test` **838 passed / 6 ignored**
  — 844 counting the ignored, against B5's 839 — frontend **590 across 45
  files**, `cargo check` still 15. The Rust delta is four new cases in
  `model_install` and one in `local`, plus a rewrite that nets zero.
- **No dependency moved**, so the advisory sweep B5 ran still describes this
  tree.
- **What is still not verified is the same thing B5 left owed**: the
  click-through in the native host. It matters more now — a file picker, a
  folder picker and a copy with progress are three `invoke` round trips this
  session has only exercised in jsdom.
- **What this step deliberately does not build**: *add a model by URL*. It is
  the third way in and the one that scales to uncurated but downloadable
  weights, and it reopens the checksum question a user pasting a link cannot
  answer. Named here so the next reader knows it was considered.


## Correction, same day

**The test counts in this record's first version were wrong**, and so are the
ones in commit `5962c2f`'s message: it claims *+9 Rust and +7 frontend*. The
measured figures are **+5 Rust** (839 → 844 counting the ignored) and **+8
frontend** (582 → 590). The Rust number was inflated by counting a rewritten
test as a new one and by counting mutation targets as tests.

Recorded rather than silently edited, because
[`IMPLEMENTATION.md`](../IMPLEMENTATION.md) makes a test count a shared
measurement and a step that changes one owes the amount and the reason. The
commit message cannot be corrected without rewriting published history, so it is
corrected here instead.
