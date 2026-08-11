# 0101: The translation window runs the Translate mode and gains no mode of its own

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Closes the second of the
two open points in
[ADR 0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md).

## Context

[ADR 0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md)
decided the translation window's lifecycle and left two things open, both named
by the owner and both marked as things an implementation must not settle
quietly:

1. whether a view plus a pop-out is enough interaction for a conversation held
   at a table;
2. **whether the window needs a processing mode of its own beyond ADR 0041's.**

[ADR 0099](0099-the-direction-of-a-turn-is-read-off-the-recogniser-never-off-a-button.md)
declined to settle the second on the ground that detecting a turn's direction is
not the same question as which prompt renders it. That was the right line to
hold and it left the question where it was.

**The owner answered it on 2026-08-11:** no. `ProcessingMode::Translate` already
exists; a second one would be redundant.

## Decision

**The window runs `ProcessingMode::Translate`. There is no eighth mode.**

The mode is already the thing this window needs: it renders a dictation in
another language through `translate::apply_translate` and its own prompt rather
than the correction prompt, which forbids translating (ADR 0041). A turn in a
conversation is a dictation rendered into the other language. That is the same
transform, invoked from a surface with no insert target.

**What the surface changes is its inputs, not its transform.** ADR 0064 already
established one capability with two surfaces, and this record is what makes that
sentence load-bearing rather than descriptive:

| | The mode, dictating | The mode, in the window |
| --- | --- | --- |
| Target language | the profile's `target_language` | the *other* member of the session's pair, chosen per turn (ADR 0099) |
| Where the text goes | the cursor | a turn in the conversation, and the speech path |
| What ends it | one utterance, one result | the same, per turn |

**The mode cycle, the picker, the profile default and the overlay chip are
untouched.** `MODE_CYCLE_ORDER` keeps seven entries. A window is not a mode, and
a mode that only one surface can reach would appear in a cycle where it cannot
be used.

**ADR 0041's rule is unchanged and is the reason this holds.** *Auto may choose
how text reads, never what language it is in.* A conversation names both
languages up front; nothing about it asks Auto to make a language decision.

## Two rules the donor's chain already carries

`donors/app/desktop-shells/openwhispr`'s `translationChain.js` runs the same
cleanup-then-translate shape and states two rules this record should not have to
learn twice.

**An empty result preserves the input.** Their `resolveTranslatedText` keeps the
previous text when the chain returns nothing, *"so a dictation is never
overwritten with nothing"*, and their cleanup step soft-fails to its own input.
**In a conversation that rule is louder, not quieter**: a dictation losing its
text is a retry, a turn losing its text is a sentence the other person said and
nobody has. A turn whose translation comes back empty keeps the recognised text
and says the translation failed; it is never rendered as an empty turn.

**A turn whose recognised language is already the target skips the translate
step.** Their `shouldRunTranslateStep` skips only when an explicit source equals
the target, and always translates on `auto`. A conversation is never `auto` --
ADR 0099 gives it two named languages and a detected one per turn -- so the case
is reachable and ordinary: somebody at the table answers in the other person's
language. The turn is shown as spoken, in the column its detected language puts
it in, and no model is called.

## Consequences

- **ADR 0064's second open point is closed.** Its first — whether a view plus a
  pop-out is enough interaction at a table — **stays open** and still belongs to
  whoever builds the surface.
- **The address form and the terminology come free**, which was already ADR
  0064's strongest argument: `translate_address_form` is machine-wide and
  `keep_profile_words` plus the profile's `Words & names` are the glossary a
  translator would charge for. A new mode would have had to re-derive both or
  reach across to the old one.
- **The prompt is the mode's, so improving one improves both.** A second mode
  would have made a translation-quality fix a two-site change and a drift
  candidate from the day it landed.
- **`TranslateSettings` still has to grow a pair.** It holds one
  `target_language` today, which is what a dictation needs; a conversation needs
  two languages held for the session. That is a config shape, not a mode.
- **This does not decide whether the window needs its own prompt *variant*.** A
  turn spoken across a table and a sentence dictated into a document may want
  different register handling, and that is a prompt question inside one mode.
  If it turns out to need one, it is a parameter on the transform, and it is not
  an eighth entry in the cycle.
