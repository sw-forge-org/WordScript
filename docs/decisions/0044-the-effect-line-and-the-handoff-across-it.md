# 0044 -- The effect line, and the handoff across it

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

ADR 0040 made the assistant one thing with three doors. ADR 0030 made the
orchestrator one process that speaks for every coding agent. Both records are
about the same user, and neither says where one ends and the other begins.

That gap is now load-bearing, because the product is being asked to hold both
in one surface. The question put to this pass was whether the two should be
merged.

### Two sentences, one word apart

> "Write the mail from Tuesday's meeting."
> "Send the mail from Tuesday's meeting."

The first is ADR 0040's sentence and the assistant answers it. The second
differs by one verb and cannot be answered by the same thing at all.

The user does not classify their sentence before saying it. Today they must:
`draft` reaches the assistant and `delivery = agent` reaches the orchestrator,
and the choice is made with a hotkey **before the sentence exists**. Standing in
the wrong door costs a whole dictation -- the same failure ADR 0040 fixed one
level down, still standing one level up.

### Why merging is not available

Three answers were on the table.

**One thing that does both.** Not buildable, and not for reasons of taste.

- The assistant runs *inside* the dictation path, and that path ends in exactly
  one reducer commit (ADR 0018, ADR 0019). The orchestrator has no end -- it
  runs for days and filters while it runs. A thing that is both has either no
  end point, which breaks ADR 0018, or no long run, in which case it is not an
  orchestrator.
- **The assistant is ours and the orchestrator is not.** The assistant is an
  API call WordScript owns completely: model, prompt, stage count, latency
  budget. The orchestrator is a foreign process with its own context window, its
  own model, its own sandbox and its own MCP client (ADR 0046). Two ownerships
  cannot be merged, only hidden -- and hiding runtime truth is what this product
  does not do.

**Two things, two surfaces.** The status quo, and the failure above.

**Two things, one surface, one visible crossing.** This record.

### The line is not where the surface had drawn it

The surface separated by *who it is*. The separation that holds is *what may
happen*, and four properties fall on the same side of it:

| | The assistant | The desk |
| --- | --- | --- |
| Time | seconds, inside the dictation | minutes to days |
| Effects | none -- text, and only text | whatever its connectors reach |
| Reads | what is on this disk | what is reachable over the network |
| Owned by | WordScript | the harness the user chose |
| Ends in | one reducer commit | a thread that stays open |

Four independent axes agreeing is the evidence that the boundary is real rather
than drawn to sort a list. It is also, not coincidentally, the privacy boundary:

> **The assistant reads what is on this disk. The desk reaches what comes over
> the network.**

## Decision

**There are two, the line between them is effects, and the crossing is
visible.**

**The orchestrator is called `the desk` on every surface.** `Orchestrator` names
it correctly and nobody says it out loud, which is what the copy budget exists
to catch. Rejected: `lead` (collides with the CRM sense, and this product now
models a customer as a context object), `foreman` (gendered, and an established
piece of infrastructure software), `handler` (accurate -- "agent handler" is the
exact relationship -- but reads as tradecraft). `Desk` carries help desk, news
desk and trading desk: it takes things in, decides what goes up, and acts on
your behalf. It is also the only candidate that is not a person, which matters
because ADR 0043 deliberately gave this thing a sphere rather than a face.

**The assistant hands over; it does not act.** When a dictation asks for an
effect, the assistant does not fail and does not attempt it. It returns a
**handoff offer**: what it understood, verbatim; which target and role would run
it; what it collected to hand over; and what that target can reach.

**The offer is refused by doing nothing.** Enter hands over. Escape treats the
dictation as the dictation it always was -- the text goes to the cursor in the
mode on the pill. Ten seconds of silence does what Escape does. **The safe
answer is the default answer**, everywhere, and a card that expired into the
irreversible option would be a trap.

**The card does not take focus.** The dictation overlay must keep
`focus: false` or the insert target moves out of the application being dictated
into, and this card stands in exactly that moment. It grabs `Enter` and `Escape`
for as long as it is visible and releases them when it closes -- Rust-owned,
like every other shortcut (ADR 0006).

**Auto never routes here.** ADR 0041 established the shape of this rule for
language; this is the same sentence one word further:

> **Auto may choose how text reads, never whether something happens.**

The mode picker reaches the assistant. Nothing reaches the desk without a key
being pressed by a person.

**An action declares who runs it.** Actions (§11.26) gain a `kind`: an assistant
action is a prompt over this object, seconds, no effects; a desk action is an
assembled brief handed over, minutes, with effects. They stay in one list,
because the user's intent is one intent -- "do this with what I have here" --
and splitting the list would make them classify their own idea before acting on
it. What is not shared is the button: a desk action goes through the same keyed
confirmation a dictated handoff does.

**A desk action begins at the assistant.** Gathering material out of context
objects is a read, which is what the assistant is permitted to do (ADR 0040).
The desk receives an assembled prompt and never has to search for anything.
That division of labour falls straight out of the effect line.

### What this does not reopen

ADR 0029 prohibits side-effecting tools in the dictation path, permanently, on
four reasons. This record does not weaken any of them:

- **No tool with an effect is called from the dictation path.** The assistant
  recognises and offers. A person presses a key. Starting a process on a
  keypress is not an MCP client call inside a dictation -- ADR 0030 already
  made that distinction for the dictated `work` prompt and it is the same one.
- **The confidence of the channel.** ADR 0029's strongest reason, and the
  handoff answers it rather than dodging it: a misheard dictation produces a
  card you read before anything happens, and the dictated text is shown
  verbatim because that is the thing that would be acted on.
- **The session model.** The handoff offer is produced in the same single
  commit the dictation already ends in. Handing over starts a *new* thing with
  its own lifetime; it does not extend the session that offered it.

## Consequences

- **The inference is new and it is visible.** Deciding "this sentence asks for
  an effect" is a judgement the product did not previously make. It is
  acceptable only because it is drawn on screen, attached to a key and free to
  refuse. If it is ever made silent -- auto-handoff on high confidence -- this
  record is being violated.
- **A wrong offer costs one keystroke.** That is the budget the feature has.
  If refusals are frequent enough to be annoying, the recogniser for effect
  verbs is wrong and the fix is fewer offers, never a faster path through one.
- **The decision inbox is where a filtered question lands.** ADR 0030 builds
  the design on a filter and a filter has an output; what the desk cannot answer
  had nowhere to go but a thread in a window that is usually closed. Home
  carries it now, and the column that makes it a decision inbox rather than a
  to-do list is **what happens if you do nothing** -- a desk question expires
  and takes a blocked run with it, a question raised in a meeting expires never.
  Sorting is by that column.
- **`the desk` has to be applied everywhere at once.** A surface that says
  "orchestrator" in one place and "the desk" in another has two things again.
  In the prototype it is one constant.
- **Two spoken paths still do not exist.** The desk speaks (ADR 0030, ADR 0043).
  The assistant does not, the copilot does not (ADR 0047), and the handoff card
  does not -- it is keyed, not spoken, which ADR 0030 already required for
  anything that starts a run.
- **What the runtime has to grow** is stated in SETTINGS_REWORK_PLAN.md §11.52
  rather than here: an effect-intent classifier on the dictation result, a
  handoff surface that grabs two keys without focus, and `kind` on an action
  record.
