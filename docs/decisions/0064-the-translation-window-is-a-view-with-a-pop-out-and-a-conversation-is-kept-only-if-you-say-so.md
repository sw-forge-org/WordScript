# 0064: The translation window is a view with a pop-out, and a conversation is kept only if you say so

Date: 2026-08-05
Status: Accepted (planning direction; **not scheduled — a roadmap candidate**)

## Context

[ADR 0041](0041-translation-is-a-mode-not-a-switch-on-cleanup.md) settled that
translation is a **mode**: you dictate, translated text lands at your cursor,
Auto never selects it. That is one person writing into somebody else's document,
and it ships with Phase 4.

The drawn `Translation` screen is the other half — two people at a table who do
not share a language — and the screen says in as many words why it cannot be the
mode: no insert target, no end, and it has to be heard. It draws the window,
both tabs, the per-language output routing and the terminology the profile
already carries.

**No entry point for it exists anywhere in the 25 screens.** That is the gap
this record closes, and it is the only one of the six undecided surfaces where
the question was not "which of the drawn answers" but "there is no door at all".

The lifecycle below was decided by the owner on 2026-08-05, in answer to a
direct question, and is recorded here with the parts that were derived marked as
derived.

## Decision

**It is a workspace view, and the drawn window is its pop-out.** Not a standalone
window with no door. The view carries the session's settings and its content,
the way Home and Context carry theirs; the pop-out is the same session in the
compact form the screen already draws, over whatever application you are
actually looking at.

That is consistent with the rule the information architecture is built on
(§4.3.1): **if a user does it, it is a view; if a user sets it, it is a section
in the sheet.** Translating a conversation is something you do.

**A conversation is a context object, and it is opt-in per session.** ADR 0045
made everything recorded one object; this is one more `origin`. What is new is
that the object is not written unless the session says so — a conversation at a
table is exactly the recording somebody may not want kept, and the two people
in it are not both users of this product.

**Opt-in and consent are one field, not two.** Leg 2d recorded that consent is a
field on a conversation with nowhere to put it — *whether it was recorded,
written, and under which answer*. That field is this decision's storage. It is
set on the session, it can be set at any point while the session runs, and it is
the thing somebody reads two years later.

**Opting out means nothing is left behind.** No object, no transcript file, no
audio. An opt-in that still writes a file is not an opt-in, and the surface may
not promise one it does not keep.

**Multiple pop-outs may stand at once; exactly one live conversation may run.**
The limit is not a policy, it is arithmetic: there is one microphone, and the
rule that the machine never speaks over the microphone it is recording means the
recogniser is muted for the length of each spoken utterance. Two live
conversations would contend for both. *(Derived — the owner set the limit, this
is the reason it holds.)*

**Closing the pop-out does not end the session.** It returns the session to the
view, where it is still running. Ending is explicit, like the meeting's stop and
for the same reason: nothing infers that two people have stopped talking.
*(Derived, from ADR 0063's stop rule.)*

**A swapped language pair takes effect from the next utterance.** Lines already
produced keep the languages they were produced in; nothing is retranslated
retroactively. A record of what was said is a record. *(Derived.)*

**The two output routings are per machine, not per conversation, and they are
edited in the view.** Which speaker the room hears and which earpiece you hear
are properties of your desk — the same kind of fact as the overlay's display
anchor — so they persist globally and per language. They are not a new settings
section: the eleventh section was removed once already and this does not bring
it back. The voice itself is a model row in AI Models, where every model choice
lives (ADR 0042), which is what the drawn *Open AI Models* button already says.
*(Derived.)*

### The lifecycle, as the four questions

| | |
| --- | --- |
| **Entered** | the workspace view, from the nav. A session starts in the view; the pop-out is opened from it when you stop looking at the workspace |
| **Held by** | the session, and — only if opted in — a context object with `origin: conversation`. The pop-out holds nothing |
| **Dismissed by** | closing the pop-out returns it to the view; an explicit stop ends the session |
| **When the conversation ends** | opted in, the object is in Context and readable like every other; opted out, nothing was written and nothing is |

## Consequences

- **The workspace grows a fifth view when this is built.** It has four today
  (Home · History · Profiles · Context) and §4.2 says four. That count is
  correct until this ships and wrong the day it does; it is not changed now,
  because nothing is mounted and a nav row that opens nothing is the fake
  affordance rule 7 forbids.
- **Two things are open and the owner named both.** Whether a view plus a
  pop-out is enough interaction for a conversation at a table, and whether the
  window needs a processing mode of its own beyond ADR 0041's. Neither blocks
  the roadmap entry, both belong to whoever builds it, and neither should be
  quietly settled by an implementation.
- **This is not scheduled.** It needs speech recognition per direction and
  text-to-speech, and neither exists in the runtime. It gets a roadmap candidate
  entry with a gate, not a phase. Leg 4 wires nothing and mounts nothing; the
  screen stays in the gallery.
- **The mode is untouched.** ADR 0041 stands exactly as written, including *Auto
  may choose how text reads, never what language it is in*. One capability, two
  surfaces, one name — the same shape ADR 0040 gave the assistant.
- **The profile already pays for the two hard parts.** Terminology is the
  profile's `Words & names` (ADR 0033, ADR 0035) and the address form is ADR
  0041's own setting. A translator charges for both; this product decided them
  for other reasons years earlier, which is the strongest argument the drawn
  screen makes.
- **What the runtime has to grow**, added to the relay's §2.5 list: streaming
  recognition in two languages at once with a detected switch between them,
  text-to-speech with per-language output-device routing, a mute of the
  recogniser for the length of each spoken utterance, and the consent field on a
  conversation object.
