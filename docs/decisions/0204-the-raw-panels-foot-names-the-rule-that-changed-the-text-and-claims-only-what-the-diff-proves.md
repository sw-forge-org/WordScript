# 0204: The raw panel's foot names the rule that changed the text, and claims only what the diff proves

Date: 2026-08-17
Status: Accepted. Extends
[ADR 0070](0070-history-switches-which-of-a-records-two-texts-its-rows-carry.md)'s
panel and reads the rules
[ADR 0080](0080-wordscript-removes-its-own-prompt-from-the-transcript-and-never-restores-what-it-displaced.md)
and
[ADR 0081](0081-the-recogniser-output-is-repaired-before-any-mode-sees-it.md)
write. Fixes
[`known-issues/heard-and-written-do-not-say-which-stage-changed-what.md`](../known-issues/heard-and-written-do-not-say-which-stage-changed-what.md).

## Context

On 2026-08-16 the owner opened the raw panel on `history-1786910918745-50`,
read the foot, and reported that the AI stage had destroyed the meaning of his
paragraph. It had not. The whole difference between the two texts was:

```text
delete " "                    the recogniser's leading space
delete "Likely phrases:\" "   WordScript's own prompt, echoed and then stripped
insert " "                    a trailing space
```

and the record named it: `applied_rules` reads
`prompt_echo_stripped, post_corrected`. **A defect was attributed to the wrong
stage because of a sentence on a panel.**

The sentence came from `RawPanel`'s two-way default, chosen on whether the two
strings are equal — *"Identical — no AI stage ran on this one."* against *"The
AI stage rewrote it."* Its own comment already said the caller has to supply
anything better, and `rawOf` did supply three: a short capture, a transform
warning, and identical texts with a stage that ran. The fourth case — **texts
that differ, where a rule the runtime named is the reason** — was never added,
though `entry.applied_rules` is read one line above for `stageRan`.

Two things this record teaches about how the sentence may be built:

- **`post_corrected` is not evidence of a rewrite.** On the very record that
  produced the report it fired for one leading and one trailing space.
- **`prompt_echo_stripped` is not evidence the echo is gone.** One leaked term
  survived the strip on the same record
  ([`stt-prompt-leaks-into-the-transcript.md`](../known-issues/stt-prompt-leaks-into-the-transcript.md)).

So a foot that names the rules that ran is no better than the one that guessed.
It has to say what a rule *did*.

## Decision

The foot's sentence is built from two things, and neither is a rule list.

**The rules WordScript ran itself get a clause each.** `prompt_echo_stripped`
and `singular_address_restored` are deterministic, run before the mode branch,
and are the two a reader keeps mistaking for the AI stage:

> WordScript removed its own prompt from this.

**The shape of the difference supplies the second sentence**, and it is the only
claim about the AI stage this screen can prove: if every word of *Written*
appears in *Heard* in the same order, nothing was added and no word was swapped
for another.

> Nothing else was added or reworded.

When the subsequence test fails, the second sentence steps back to what remains
true — *Anything else that differs is the AI stage's.* — and when no rule of
WordScript's own ran, the panel keeps its own default, with one addition for the
case this cluster spends its time telling apart from a rewrite: *The AI stage
removed words and added none.*

**A word is never attributed to a stage.** The panel holds two texts and a rule
list, not the text between the stages. A sentence claiming which stage produced
which word would be a fluent, plausible statement the runtime never made — this
cluster's failure class, committed by its own instrument.

## Consequences

**The record that produced the report now reads its own evidence.** Five cases
in `History.test.tsx` hold the shape, the first of them built from that
record's own two texts.

**The claim degrades where the evidence does.** One word swapped and the
exoneration disappears; that is the point of deriving it from the diff rather
than from the presence of a rule id.

**It stays one sentence and a half.** The panel plane is the narrowest text
column on the surface, 241–292 px measured in GUI-port Leg 13b, and that leg's
one finding was a foot printing rule ids across four lines.

**Two rules are named and the rest are not.** `hallucination_filtered`,
`spelled_letter_merge_reverted`, the dictionary and snippet rules and the
guardrail fallbacks all still land in the default. Each is a candidate for a
clause of its own the day a reader misreads one; adding all of them now would
be the rule dump the record ruled out.
