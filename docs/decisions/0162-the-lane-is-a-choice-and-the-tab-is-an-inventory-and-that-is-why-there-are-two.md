# 0162: The lane is a choice and the tab is an inventory, and that is why there are two

Date: 2026-08-15
Status: Accepted. Precises the reasoning of
[ADR 0042](0042-one-surface-owns-every-model-choice.md) — the two tabs stand,
on a different argument than that record gives. Completes
[ADR 0160](0160-a-server-is-a-machine-that-is-not-this-one-and-the-runners-here-are-named-for-what-they-run.md)
and [ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md)
by removing the surface that forced both of them to be applied twice.

## Context

**The owner asked why the screen has two tabs at all**, and whether *On this
machine* could not simply live under the `Local` lane, with the rest under
`Your server`. He said he thought the split made sense but was not sure.

The question deserved a real answer because **the reason ADR 0042 gives is half
dead**. That record justifies the single second tab like this:

> Speech models and language models sit on the same disk, under the same
> runtime, and compete for the same memory.

ADR 0122 retired the first clause thirty records ago: the local chat role does
not run a model, it talks to one Ollama runs, and Ollama owns its store. What
survives is the memory argument — real, but thin on its own, and not an answer
to *why is this a tab rather than part of a lane*.

### The argument that actually holds, and it was written down nowhere

**A lane is a stored value. An inventory is not.**

`AppConfig.provider` holds the lane; it is a decision that can change tomorrow
without a single file moving. What is installed on the disk survives every one
of those changes. Putting the model library behind `Local` would mean **editing
your configuration in order to look at your own disk** — and hoping nothing
stuck on the way back. A picker is not a view filter, and the moment it is used
as one, reading becomes writing.

So the cut is not *configuration versus installation*, which is how the surface
had been reading. It is **which one do we use, against what is on the machine**.

### What was actually wrong: the lane restated the tab

Four of the `Local` lane's five rows were a second full copy of the tab rather
than a summary of it:

| `Local` lane row | Already owned by the tab |
| --- | --- |
| Runtime — `Bundled \| Yours` | *Who runs Ollama* |
| State — `Running · 127.0.0.1` | *Language runner* |
| Installed models — `4 · 6.7 GB` | the two model lists |
| Acceleration — `CPU only` | *Acceleration* |
| Credential — `Not needed` | — the one row that is the lane's own |

**The cost is measured, not argued.** ADR 0160 and ADR 0161 each had to be
applied to this branch a second time — the *server* wording for `127.0.0.1`,
the GPU claim, and the disk sentence ADR 0122 had already retired all survived
their own fix, because the tab was edited, the tab was tested, and the tab went
green while the lane went on saying all three. The second copy was found by
looking at the rendered screen. **A structure that requires the same sentence to
be corrected in two places will eventually have two different sentences.**

**And the drawing knew.** `Manage →` has sat in the *Installed models* row
since Leg 6 with no handler on it. The intent was always that the lane points
and the tab holds; the summary grew into a second full view and nobody noticed,
because both copies were maintained separately.

## Decision

**The two tabs stand, on the inventory argument rather than the disk one.** The
tab answers *what is on this machine*; the lane answers *which of it this
configuration uses, and whether it can be reached*.

**The `Local` lane keeps three rows**: the language runner with its reachability
and endpoint, the credential, and the installed total as a pointer. Everything
else moves to the tab that owns it.

- **`Acceleration` is gone from the lane.** A GPU is a property of the machine.
  This also deletes the copy that survived ADR 0161.
- **`State` folds into the runner row.** A runner and whether it answers are one
  fact.
- **`Bundled | Yours` is gone from the lane.** *Which program runs* is a machine
  fact and belongs beside the runners. **This was left standing by the first
  pass at this record** and caught the same way its three predecessors were —
  by looking at the screen after the tests were green.
- **`Installed models` becomes a number and a door.**

**`Manage →` is wired, and it is the one non-drawn control on a drawn lane.**
Everything else in `LaneRows` stays inert per ADR 0065. Navigation is the
exception: a door that does not open costs the reader exactly the thing it
names. `onManage` is a prop through one level — `ModelsScreen` owns the tab
state — rather than a context, because `Wired` exists for a ladder four
controls deep and this is one row on one card.

## Consequences

- **`port:diff` is unmoved on both ids** — `models` at `26 | 248 | 20` and
  `models#1` at `262 | 30 | 16`. The lane renders only off `Cloud` and the port
  measures the Cloud default, which was predicted before the run and is the
  reason the prediction was written down.
- **Two cases hold the shape**: one counts the lane's rows by label, one clicks
  `Manage` and asserts the tab changed. The row count exists because deleting
  `Acceleration` made ADR 0161's GPU case pass for free on this lane — an
  assertion that is satisfied by absence stops being a test. Both were proven by
  restoring what they forbid.
- **The `Language runner` row carries four elements and its hint wraps to three
  lines.** `.ws-row-ctl` is `flex: none`, so the hint gets what is left. It is
  the densest row on the card and it is the trade for folding `State` in;
  if it needs to give something up later, the endpoint is the candidate, since
  the tab states it too.
- **ADR 0042's disk clause should be read as superseded by ADR 0122**, and its
  single-tab conclusion as re-derived here. Neither record is edited — this one
  carries the correction, which is what append-only means.
- **The question that produced this record was a good one and the answer was
  not the obvious one.** Moving the tab under the lane would have been
  defensible on every ground except the one that matters, and the surface would
  have shipped a picker that has to be operated to be read.
