# 0061: The tab is a state, the notification is the question, and neither replaces the other

Date: 2026-08-05
Status: Accepted (planning direction; not implemented)

## Context

Phase 8's overlay is three surfaces: the shipped pill with a tab out of its left
edge, the 620 × 340 agent window the tab opens, and the always-on-top
notification that arrives uninvited. Each is drawn — the pill at its real
geometry (§11.29), the window as the fourth member of the window family, the
notification as ADR 0043's own record — and the transitions between them are
not.

What the existing records already settle:

- **`await` blocks the calling agent** until the answer budget expires, so a
  question nobody sees is the one failure this surface may not have (ADR 0030,
  ADR 0043).
- **One spoken question is open at a time**; further questions wait with their
  position visible (ADR 0030).
- **The tab stays out.** A learned word is news and retracts after 1.9 s; "an
  agent is waiting for you" is a state, and a state that retracts has to be
  remembered (§11.29).
- **The notification never times out on its own** — it dismisses when answered
  or when the budget expires, because an unanswered question is still blocking
  somebody (ADR 0043, and the drawn row in `Settings → Agents`).

What was read off the drawn surface during Leg 4a and had been missed in the
framing of this question: **`Settings → Agents` already states where the
notification goes when a dictation is running** — *"Remembered per monitor. It
never covers the dictation overlay — it offsets above it while one is on
screen."* The gallery is the source (ADR 0057), so the notification and the pill
coexist by decision. An earlier draft of this record had the notification
retract to the tab when a dictation starts; that would have contradicted a
drawn setting, and the only reason it did not is that the screen was looked at.

## Decision

**The two surfaces carry different things and are therefore not alternatives.**

> **The tab is a state: *something is waiting*. The notification is the
> question itself.**

That is the whole rule, and every transition below follows from it.

**The tab appears whenever a pill exists and at least one question is open**,
and it counts them — the drawn label is `n needs you`. It cannot appear
otherwise, because it is a tab on the pill and the pill exists only during a
capture. Within a session it never retracts on a timer. It retracts when the
state it states goes false — every question answered, expired or cancelled — and
with the pill when the session ends. §11.29 forbids a *timed* retraction, not a
state-driven one.

**The notification appears when the question is not already on a focused
surface.** Concretely: the agent window is closed, or it is open and not
focused. A window behind three others is exactly as unseen as a closed one, and
`await` is blocking either way. It offsets above the dictation overlay while one
is on screen, per the drawn setting, and is remembered per monitor.

**Both can stand at once, and that is not double-signalling.** During a
dictation with the window closed the tab says one is waiting and the
notification carries the sentence and its options. The tab is 22 px and the
notification is answerable without opening anything, which is what keeps the
pair cheap.

**The agent window, when focused, is the only surface.** The thread carries the
question, the dash at the foot carries what is being said, and no notification
fires. Opening or focusing the window while a notification stands closes the
notification without answering it.

**Dismissing the notification is *not now*, never *no*.** The drawn `x` closes
the window for that question. Nothing is sent to the agent: no `answer`, no
`cancelled`. The question stays open until it is answered or the budget expires,
which is the same construction ADR 0030 uses for a gate failure — WordScript does
not fabricate an event the user did not produce.

**A dismissed question falls to the next surface down, and with no pill and no
window that surface is the tray/dock state.** ADR 0030 already decided it —
*"a tray/menubar state with three levels: nothing happening / runs in progress /
someone is waiting for you, the third with a counter"* — and nothing has ever
drawn it. It is named here as the resting place because otherwise dismissal
makes an open question invisible, which is the failure this whole surface exists
to prevent.

**The cue is not the surface.** It queues while a capture runs and fires when
the session ends (ADR 0010, ADR 0043), independently of which surface is
showing the question. A cue during a capture is picked up by the microphone.

**A dictation starting while an agent waits changes nothing about the
dictation.** It records, transcribes and inserts as always. The microphone
belongs to the user (ADR 0030): a bridge request during a capture gets the busy
answer, and answering out loud is unavailable for the length of the session —
which is a reason the tab exists, not a reason to suppress it.

### The state machine, as one table

| Question open, and… | Tab | Notification | Window |
| --- | --- | --- | --- |
| window focused | — (no pill) | no | the thread and the dash |
| window open, not focused, no capture | — | yes | unread counter on the target |
| window closed, no capture | — | yes | — |
| capture running, window closed | yes, counting | yes, offset above the pill | — |
| capture running, window focused | yes, counting | no | the thread |
| dismissed by the user | yes while the pill lasts | no | unread counter |
| answered / expired / cancelled | retracts | closes | the thread keeps the record |

## Consequences

- **The tray/dock state is owed and undrawn.** It is decided (ADR 0030), it is
  the resting place a dismissal falls to, and it is a 26th screen nobody has
  drawn. Added to the relay's §2.5 list as a Leg 5 contract plus a drawing.
- **`Settings → Agents`'s `Show it` toggle turns off a surface that ADR 0043
  exists to guarantee.** Off leaves the tab and the window as the only signals,
  which means a question raised while nothing is on screen is invisible until
  the budget expires. The row is drawn as a neutral toggle and it is not one.
  Leg 4 must not wire it without stating that consequence on the row; changing
  the copy on a drawn row is a design change and needs its own record.
- **"Focused" is the checkable proxy for "seen", and it is deliberately
  crude.** Occlusion and virtual-desktop membership are not reliably knowable;
  focus is. The failure mode is a notification the user did not need, which
  costs a glance, against a question nobody sees, which costs the agent its
  budget.
- **Nothing here changes the pill.** No token, size or rule in `overlay-pill.css`
  moves (relay rule 5). The tab occupies the learned-word tab's left slot, which
  is structurally free for exactly as long as this tab can exist, because bridge
  output runs no finalization (§11.29).
- **What the runtime has to grow:** a question record with an open/answered/
  expired state and a queue depth; the surface selector above, which needs to
  know whether the agent window is focused; and the tray state. All Leg 5, all
  downstream of ADR 0030's bridge, none of which exists.
- Leg 4 wires none of this. The screen stays in the gallery and mounted nowhere
  until Phase 8 has a runtime behind it.
