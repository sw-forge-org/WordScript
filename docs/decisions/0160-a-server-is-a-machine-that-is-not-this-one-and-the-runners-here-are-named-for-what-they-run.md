# 0160: A server is a machine that is not this one, and the runners here are named for what they run

Date: 2026-08-15
Status: Accepted. Precises the presentation of
[ADR 0042](0042-one-surface-owns-every-model-choice.md) and
[ADR 0122](0122-in-app-model-installation-is-two-mechanisms-behind-one-surface-and-only-one-set-of-files-is-ours.md)
without superseding either — the one section and the one tab both stand.
Applies [ADR 0121](0121-the-local-lane-is-named-for-what-it-does-and-its-release-status-stays-on-the-badge.md)'s
rule to a second identifier, and spends part of the port fidelity
[ADR 0159](0159-the-listing-unions-and-the-rank-decides-and-a-control-that-appears-late-keeps-the-port-its-subject.md)
had bought.

## Context

**The owner read the finished B5/B8 surface and could not tell four words
apart.** The report was specific and it is the whole of this record's context:
the Speech models card says *local*, the Language models card says the models
come from a server, the section about where models come from is Speech and not
Language and there is a server, and the Models tab offers *Local* and
*Self-hosted* above all of it.

Counted off the tree, four words carried three concepts and no two of them
lined up:

| Word | Where | What it meant |
| --- | --- | --- |
| `Local` | lane segment | the work happens on **this** machine |
| `On this machine` | tab | the model files are on **this** machine |
| `Self-hosted` | lane segment | an OpenAI-compatible server on **another** machine |
| `The server` | section inside *On this machine* | Ollama at `127.0.0.1` — **this** machine |

Three defects follow from that table and only the first two are addressed here.

**1. *Server* meant a different machine in each of the two places it appeared.**
`LaneRows` spends its `Self-hosted` branch establishing the word: *An
OpenAI-compatible server you operate, on another machine.* One tab over, a
section titled *The server* carries the endpoint `http://127.0.0.1:11434/v1`.
A reader who learned the word from the lane row met its opposite under the same
spelling, and nothing on either surface acknowledged the collision.

**2. *Where models come from* answered for the card it was not about.** The
folder list is `local_model_sources()` — speech only, because the language half
has no directory this build reads (ADR 0122: Ollama owns its store). It sat at
the foot of the tab, which by reading order made it the answer for the Language
models card directly above it. The section that existed to explain provenance
was the section that misattributed it.

**3. `Local` and `On this machine` are one machine under two names.** Named
here because it is the same class of defect, **and deliberately left standing**:
the lane values are keys in `shared/model_catalogue.json`, the tab is a fixed
label in two test suites, and the owner's instruction on being shown the cost
was to take the two collisions that mislead and leave the one that merely
duplicates.

### What the surface could already have said and was not asking

`provider_status` has carried `local_setup` since before B5:
`resolved_runner`, `runner_ready`, `resolved_chat_base_url` and `chat_ready`
are all in `LocalProviderSetupStatus`, mirrored in `src/types/providers.ts`.
The machine tab drew `/usr/bin/whisper-cli` as a literal in a card footer and
`Running · 1 job` as a badge with nothing behind it, while the answer sat one
command away. `useProviderSeam` did not supply it and could not: that hook asks
about the vendors **the selected lane draws**, and with the connection on Cloud
— where it opens — `local` is not among them.

## Decision

**A server is a machine that is not this one, and nothing on *On this machine*
is called one.** The section titled *The server* becomes **Runners on this
machine** and lists the two programs that actually run models here: the speech
runner (`whisper-cli`) and the language runner (Ollama). One test holds the
rule as a measurement — every sentence on that tab containing the word *server*
must be the one pointing at the lane that is another machine.

**The `Self-hosted` lane is read as *Your server* and stored as
`Self-hosted`.** `LANE_LABEL` in `src/screens/data.ts` is the surface name;
the union member does not move. This is ADR 0121's rule applied to a second
identifier: `Cloud`, `Local` and `Enterprise` are catalogue keys both runtimes
read (ADR 0115), so renaming the value would be a rename across the seam to fix
a wording. What a lane is *called* belongs on the surface.

**The two runner rows are read, and the three below them stay drawn.** A new
`useLocalSetup` asks `provider_status` for `local` on the tab's own behalf.
*Who runs Ollama*, *Keep it warm* and *Acceleration* remain the drawing's,
because nothing in this build answers them — ADR 0065's rule, not an oversight.
**A failed probe reads `Not read`, not `Not found`**: the runtime not answering
and a binary being absent are different sentences, and conflating them is the
defect ADR 0106 recorded one layer up.

**Provenance is stated inside the card it belongs to.** The folder list moves
under Speech models with the label *Where these come from*, and Language models
gains one row under the same label naming Ollama's store and the endpoint that
owns it. Two halves, one question, each answered where its subject is.

**The runners go first.** A model list above the thing that loads it asks the
reader to carry two unexplained nouns to the bottom of the tab.

## Consequences

- **`models#1` loses the port as its subject, and this is the cost the owner
  accepted.** Measured: `structural 0 | style 0 | text 7` before, `structural
  261 | style 30 | text 16` after. **Almost all of it is renumbering** — the
  same tree with the runner card moved last measures `structural 15 | style 41
  | text 18`, so ~246 of the structural differences are the section index
  shifting and not a drawing that changed. This is the B7 finding arriving as a
  bill: an addition placed mid-screen on a ported drawing renumbers everything
  after it. **The grown state is held by tests instead**, which is the gap
  Leg 13b named and B8 named again.
- **`models` moves `26 | 242 | 19` → `26 | 248 | 20`, structurally unmoved.**
  The lane label is a segment button's text, so it is one text difference plus
  the six widths that follow from a shorter word in a segment that sizes to its
  content. This paragraph first read *unmoved*, which was an assumption stated
  before the second measurement rather than after it.
- **One more command on opening the tab**, and it is a local-runtime probe.
  Asked once per mount, not per row — the same rule `model_library` follows.
- **ADR 0042's one section and ADR 0122's one tab both stand.** What changed is
  what the cards inside them are called and which question each answers. The
  memory argument that carries the single tab — speech and language compete for
  the same RAM — is untouched, and the disk argument ADR 0122 already retired
  is now visible on the surface rather than only in a record.
- **`Local` and `On this machine` still name one machine twice.** Recorded as
  open, not as fixed. Whoever closes it pays a catalogue-key rename or a
  second label map, and should read this record first.
- **Six frontend cases were added and one was made to fail first by restoring
  the old wording** — the *server* rule regressed to `Pulled once by the server
  below` and the case caught it by sentence.
