# 0161: A drawn row says so beside its own label, and the sketch is the deliverable

Date: 2026-08-15
Status: Accepted. Implements
[ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md)'s
badge rule on the one screen that never carried it, and gives
[ADR 0065](0065-a-drawn-control-is-inert-and-says-why.md)'s inert controls a
visible mark. Follows
[ADR 0160](0160-a-server-is-a-machine-that-is-not-this-one-and-the-runners-here-are-named-for-what-they-run.md)
on the same screen and in the same session.

## Context

**The owner read the corrected surface and found three sentences that were not
true about his machine.** The report named them, and the third is the one that
decides this record: *Acceleration: I have an Nvidia GPU, why is that not
detected? So it obviously does not work.*

It does not work, and it never did:

```
grep -rn "cuda\|CUDA\|rocm\|ROCm\|Metal\|acceleration" src-tauri/src/  →  no matches
```

`CPU only · no CUDA, ROCm or Metal device found` is a literal in `Models.tsx`.
There is no detection anywhere in the runtime. On any machine with a card in
it, the surface was making a **specific, checkable, false claim about the
reader's own hardware** — which is the sharpest form of the defect
`CLAUDE.md` forbids: *do not render fake states or fake readiness; show runtime
truth.*

Two more of the same kind stood beside it:

- **`Bundled` does not exist.** `tauri.conf.json` declares no `externalBin` and
  no `resources`, and nothing in the tree ships an Ollama. The segment's
  selected value was the option that is not real; `Yours` is the only mode.
- **`Keep it warm`** is a toggle nothing reads.

### The rule the owner stated, which is not "delete them"

The obvious fix — remove what is not built — was proposed and **rejected**, and
the reason is the method this repository is being built by: **the sketches that
are planned but not yet implemented get changed along with everything else and
stay unbuilt behind the surface on purpose, because that is how the shape of the
finished thing becomes knowable.**

**The drawing is a deliverable, not scaffolding.** It is how the shape of the
finished product is decided before it is expensive to change, and deleting the
unbuilt half would throw away the design work and leave nothing to build
against. ADR 0065 already said as much for controls — *no lane is deleted,
moved or reworded*.

**What was missing was not the deletion. It was the declaration.** A drawing
that does not say it is a drawing is indistinguishable from a reading, and the
reader finds out by owning an Nvidia card and being told he does not.

### And the screen that offers the lane never badged it

ADR 0067's rule is *preview badge everywhere it is offered*. The workspace
status strip honours it (`WorkspaceWindow.tsx:338` reads
`Local runtime · <model> · preview`). **AI Models — the screen where the lane
is actually chosen — carried nothing on the row itself**, only a general
banner at the top of the view. The one surface the rule was written for was the
one surface without it.

## Decision

**A drawn row says so beside its own label, with a `PreviewTag`.**
`PreviewBanner` answers for a screen and is the wrong instrument for a card
where four rows are read from the runtime and three are drawings — the state AI
Models reached the moment B5 and B8 wired half of it. A per-screen banner on a
half-wired screen is either a lie about the wired half or a caveat the reader
learns to skip.

**It sits at the label, not at the control.** A reader scans labels and then
looks right for the value. A marker at the value is read *after* the value,
so `CPU only` is believed first and corrected second. At the label it is read
first.

**It is not a `StatusBadge`.** A badge states what the runtime found; the tag
states that nothing looked. One shape for both would put *this is a drawing* on
the same axis as *this is what your machine says*, which is the single
distinction the marker exists to carry. Ground rather than a border is what
separates it from `ScopeTag` at a glance: a scope tag is pressable and carries
the outline that says so.

**The long sentence moves into the tag's tooltip.** What a row will do once it
is built is worth one hover and is not worth a permanent line on a surface the
owner already called too wordy. `Acceleration`'s tooltip names the grep.

**The badge goes on the lane row, per ADR 0067, and follows the selection.**
Three of four lanes are drawn, so tagging `Local` by name would imply the other
two are built.

**The claim comes off, the sketch stays.** `no CUDA, ROCm or Metal device
found` is deleted because it is a false statement of fact; `CPU only` remains,
as `tone="plan"` rather than `tone="warning"` — a drawing is not a warning.
This is the general form: **a sketch may show a shape; it may not assert a
measurement it did not take.**

## Consequences

- **The machine tab drops from 242 to 163 visible words** (−33%), counted over
  every `title`/`description`/`label`/`hint` on it. Six sentences were cut or
  halved; one — *Neither is a server you connect to* — disappeared entirely,
  because a negation is only needed while the word is ambiguous, and ADR 0160
  removed the ambiguity.
- **`port:diff` `models#1` is `262 | 30 | 16`**, from `261 | 30 | 16` before
  this record and `0 | 0 | 7` before ADR 0160. `models` is unchanged at
  `26 | 248 | 20`: the lane tag renders only off `Cloud`, and the port measures
  the default.
- **`Row` gains a `tag` slot**, so every other screen can carry the same marker
  without a second mechanism. **They do not carry it yet** — this record covers
  AI Models, and the rest of the settings surface is an open sweep.
- **Three tests hold it**, including one that asserts the GPU claim is gone by
  its own text and one that asserts the lane tag appears off Cloud and vanishes
  on it.
- **THE SAME THREE DEFECTS HAD A SECOND COPY, AND ONLY THE SCREENSHOT FOUND
  IT.** `LaneRows`' `Local` branch — the connection card on the *other* tab of
  the same screen — carried `The server that loads a language model` about a
  process on `127.0.0.1`, the `no CUDA, ROCm or Metal device` literal, and
  *Speech and language share one disk*, which ADR 0122 retired thirty records
  ago. The tab was edited, the tab was tested, the tab went green, and the lane
  went on saying all three. It was caught by looking at the rendered gallery,
  which is the check a test is supposed to make unnecessary.
- **Both regression cases were green for the wrong reason first, and the reason
  is worth keeping.** They rendered *with* a runtime, where every lane but
  Cloud is `disabled` (ADR 0065) — so `userEvent.click` on `Local` moved
  nothing and the assertion measured the Cloud lane four times under four
  names. They now render in the gallery, where all four lanes are reachable,
  and were re-proven by restoring the GPU literal and watching the failure name
  `Local`. **A test that drives a control has to check the control moved.**
- **The tag was verified in the gallery**, dark and light, at the second
  attempt: the three drawn rows on the runner card carry it, the two read rows
  do not, and the lane row carries it off `Cloud`.
- **Bundling an Ollama is now a recorded intent** rather than an implication of
  a segment control — see `docs/ROADMAP.md`, Phase 5.
