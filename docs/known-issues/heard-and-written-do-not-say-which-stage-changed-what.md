# The Heard/Written panel reports a 16-byte prompt strip as "The AI stage rewrote it"

Status: **Fixed 2026-08-17 by
[ADR 0204](../decisions/0204-the-raw-panels-foot-names-the-rule-that-changed-the-text-and-claims-only-what-the-diff-proves.md).**
Found 2026-08-16. The panel reads `applied_rules` now and derives the rest from
the diff; what it still cannot do is attribute a word to a stage, and it no
longer pretends to. The report below is kept as written.

Found because it produced a wrong diagnosis in the field. The owner opened the
raw panel on `history-1786910918745-50`, read the foot, and reported that the AI
stage had run over the **Heard** column and destroyed the meaning of his
paragraph. It had not. The record's own `applied_rules` say what happened, and
the panel had them.

## What the panel said, and what the record says

The two texts differ by exactly sixteen bytes:

```text
Heard    …in die Neuronen verwendet wird. Likely phrases:" Commit.
Written  …in die Neuronen verwendet wird. Commit.
rules    prompt_echo_stripped, post_corrected
```

`Likely phrases: ` is WordScript's own initial prompt, echoed by the recogniser
and removed by `strip_prompt_echo` before the mode branch (ADR 0080, ADR 0081).
Everything else is byte-identical: `cleanup` ran, and the correction returned
the text it was given.

The foot read:

> The AI stage rewrote it.

Which is true, and useless, and in this case actively misleading — the owner
concluded from it that the German he was objecting to had been produced by the
AI stage, when it is the recogniser's output verbatim. **A defect was attributed
to the wrong stage because of a sentence on a panel.**

## Why the sentence is what it is

`RawPanel` (`src/components/shell/ListItem.tsx:234`) falls back to a two-way
default — *"Identical — no AI stage ran on this one."* against *"The AI stage
rewrote it."* — chosen purely on whether the two strings are equal.

Its own comment already anticipates the shape of this problem:

> THE CALLER'S SENTENCE WINS OVER BOTH DEFAULTS, and it has to: the panel can
> compare two strings and cannot know whether a stage RAN.

`rawOf` (`src/screens/History.tsx`) supplies that caller sentence for three
cases — a short capture, a transform warning, and *identical texts with a stage
that ran*. That third case is the mirror of this one, and it was found the same
way: on 2026-08-10, fifty of 142 records had identical texts with a stage that
ran, so the default would have been false on all fifty.

**The fourth case was never added.** Texts that differ, where the only
difference is a rule the runtime already named. `entry.applied_rules` is in
scope — `rawOf` reads it one line earlier for `stageRan` — and is not consulted
for the sentence.

## Why it belongs to the invisible-damage cluster

Every other record in this cluster is about a stage that changed something and
left no evidence. This one is the reverse: the evidence exists, is persisted,
crosses the IPC seam and reaches the component, and the screen replaces it with
a guess. The cost is the same either way — a reader cannot tell which stage did
what — and here it is strictly worse, because the panel is the instrument the
owner uses to report defects into these records in the first place.

`prompt_echo_stripped` on a record also does not mean the echo is gone; on this
very record one leaked term survived the strip
([stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md)).
So the sentence has to name what a rule did, not that a rule ran.

## What a fix has to answer, and what it must not do

- **Which rules deserve a sentence of their own.** `prompt_echo_stripped` is one:
  it says *WordScript removed its own text from this, and the words it displaced
  are gone*. `post_corrected` with a zero-length delta is another, and it is the
  case here — the AI stage ran and changed nothing, which the panel already has a
  sentence for when the texts were equal to begin with.
- **It must not become a rule dump.** The panel plane is the narrowest text
  column on the surface, 241–292 px measured in GUI-port Leg 13b, and the same
  leg's one finding was a foot printing rule ids across four lines. A sentence,
  not a list.
- **It must not claim more than the runtime knows.** "Nothing else changed" is a
  claim about a diff the screen can make; "the AI stage understood you" is not.

No fix is proposed here and none is written. The record exists so the next
reader of a **Heard**/**Written** pair does not repeat the diagnosis.

## What was written, 2026-08-17

ADR 0204 carries the reasoning; the shape in one place:

- **Two rules get a clause of their own** — `prompt_echo_stripped` and
  `singular_address_restored`, the two that are WordScript's own and run before
  the mode branch. They are the ones a reader mistakes for the AI stage.
- **The second sentence comes from the diff, not from a rule.** If every word of
  *Written* appears in *Heard* in the same order, nothing was added and no word
  was swapped: *Nothing else was added or reworded.* When that fails it steps
  back to *Anything else that differs is the AI stage's.*
- **`post_corrected` is not read as evidence of a rewrite**, because on the very
  record that produced this report its whole effect was one leading and one
  trailing space.
- **The record above is the first test case**, with its own two texts.

On this record the foot now reads *"WordScript removed its own prompt from this.
Nothing else was added or reworded."*

Left undone on purpose: every other rule id still lands in the panel's default,
and no word is ever attributed to a stage — the panel holds two texts and a rule
list, not the text between the stages.

## Related

- [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md)
  — the rule whose effect this panel mislabelled, and the term that survived it.
- [transcript-stops-before-the-audio-does.md](transcript-stops-before-the-audio-does.md)
  — where the content the owner was actually missing went.
- [the-record-names-the-connection-model-not-the-one-that-listened.md](the-record-names-the-connection-model-not-the-one-that-listened.md)
  — the second thing on the same record that says something the runtime did not do.
- ADR 0080, ADR 0081 — the strip and where it runs.
