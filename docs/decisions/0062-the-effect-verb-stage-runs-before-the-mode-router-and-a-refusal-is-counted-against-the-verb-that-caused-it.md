# 0062: The effect-verb stage runs before the mode router, and a refusal is counted against the verb that caused it

Date: 2026-08-05
Status: Accepted (planning direction; not implemented)

## Context

[ADR 0044](0044-the-effect-line-and-the-handoff-across-it.md) decided the
handoff: the assistant recognises that a dictation asks for an *effect*, offers
to pass it to the desk, and does not pass it. Enter hands over, Escape inserts
the text as the dictation it always was, ten seconds of silence does what Escape
does, and the card does not take focus.

The card is the most complete of the six undecided surfaces — both keys, the
timeout and what crosses are all drawn. What is undecided is **the stage that
produces the offer at all**: what detects the effect verb, where that runs, and
how its refusal rate is measured.

The last of those is not a nice-to-have. ADR 0044 sets the feature's entire
budget in one sentence:

> A wrong offer costs one keystroke. That is the budget the feature has. If
> refusals are frequent enough to be annoying, the recogniser for effect verbs
> is wrong and the fix is fewer offers, never a faster path through one.

A budget nobody measures is not a budget. Leg 2d recorded the same thing from
the other side: *"Leg 5 owes a way to measure the refusal rate, not just the
feature."*

§11.52 already describes the classifier as a thing that has to exist —
*"it runs after transcription and before the mode router, it must be cheap
enough not to move the latency budget, and it must fail towards no offer;
whether it is lexical or a model call is open"*. This record closes what that
left open and adds the measurement.

## Decision

**The stage is in Rust, on the transcript, after transcription and before the
mode router.** It never sees audio. It is one function on the dictation result,
in the same process that owns the rest of the path (CLAUDE.md: Rust owns
trigger, capture, provider, transform, insert).

**It starts lexical, not as a model call.** A verb list per language, matched
against the transcript's leading clause. The reasons are ordered:

1. A model call in the dictation path spends the latency budget on the one
   thing the user is waiting for, and this product's reason to exist is speed.
2. A lexical list is inspectable and editable. "The fix is fewer offers" means
   removing an entry, which is only possible if entries exist.
3. It fails towards no offer by construction: an unlisted verb produces nothing.

A model classifier is not forbidden forever; it is forbidden as the starting
point, and whoever proposes it owes a measured latency figure and a comparison
against the list it replaces.

**No desk configured means no offer, ever.** An offer that cannot be accepted is
the fake affordance rule 7 forbids, and it is worse here than elsewhere because
it advertises a capability the machine does not have. The stage is skipped
entirely when no desk is configured or no target with a `work` role resolves.

**Auto never routes here** — restated from ADR 0044 because it constrains this
stage rather than the card: the classifier decides whether to *offer*, and a
person decides whether anything happens. There is no confidence level at which
the offer becomes an action.

**The card's lifecycle, completed:**

| | |
| --- | --- |
| **Entered** | the stage fires on a completed transcript, a desk and a `work` target resolve, and the card is drawn near the overlay without taking focus. Rust grabs `Enter` and `Escape` for as long as it is visible and releases them when it closes (ADR 0006) |
| **Held by** | the session that produced it. The card carries no state the session does not already have — the transcript verbatim, the assembled brief, the target and role |
| **Dismissed by** | `Enter` (hand over), `Escape` (insert), ten seconds of silence (insert), **or a new capture starting** |
| **When the thing it is about ends** | the offering session ends in its one reducer commit either way (ADR 0018, ADR 0019). On `Enter` a new thing starts with its own lifetime; the card outlives nothing |

**The dictation hotkey pressed while the card stands is Escape.** Not "ignored"
and not "hand over": the safe answer is the default answer everywhere, and the
user who presses the trigger has moved on. The result is inserted, the card
closes, and the new capture begins. The existing guard — discard a late result
that does not match the active `processing` session id — already covers the race
and needs no new mechanism.

**Refusals are counted, locally, keyed by the trigger that fired.** Three
counters per language and per matched verb: **offered**, **accepted**,
**refused** (Escape and timeout are the same outcome and are counted together,
because both mean *this was not what I meant*).

**Keyed by the verb is the load-bearing part.** A single ratio says the
recogniser is wrong; it does not say which entry to remove, and removing the
wrong one costs the offers that were working. `send` and `schedule` may behave
very differently in one language and identically in another.

**It is shown on Diagnostics and it leaves this machine never.** Diagnostics is
where the runtime states what it is doing; Privacy & Data states that nothing is
sent anywhere, and this product has no telemetry. A counter that would be useful
to a developer and is invisible to the user is not available here, so it is made
visible to the user instead.

**The judgement threshold is stated and is not automatic.** Once a verb has been
offered at least 20 times, refusals above acceptances mean that entry is wrong.
Nothing in the product acts on that by itself: **the product counts, a person
cuts the list.** Auto-muting a verb would be inference layered on inference,
which is what this whole record exists to avoid.

## Consequences

- **The counters are the feature's grade, so they ship with it or it does not
  ship.** A handoff released without them cannot be judged, and ADR 0044's
  budget becomes a sentence nobody can check.
- **Diagnostics grows a block it does not have**, and the drawn Diagnostics
  screen has no room reserved for it. That is a drawing owed, and it is small: a
  table of verb, offered, accepted, refused.
- **What the runtime has to grow**, on top of §11.52's list: the verb lists per
  language as data rather than code, so cutting one is not a release; the three
  counters, persisted like history is persisted; and the desk-configured
  precondition, which is a read of state ADR 0030's bridge owns and which does
  not exist yet.
- **A false negative is invisible by design.** The stage fails towards no offer,
  so a missed handoff looks like an ordinary dictation and is not counted. That
  asymmetry is intended — the cost is one wasted dictation against a card the
  user did not want — and it means the counters grade precision, never recall.
  Nobody should read them as the whole picture.
- **The card is the sixth window in the family and the second nobody opened**
  (§11.52), after ADR 0043's notification. It is `transparent`,
  `alwaysOnTop`, and it does not take focus.
- Leg 4 wires none of this. Phase 8 owns it, ADR 0044 is the decision it
  implements, and this record is what makes that implementation checkable.
