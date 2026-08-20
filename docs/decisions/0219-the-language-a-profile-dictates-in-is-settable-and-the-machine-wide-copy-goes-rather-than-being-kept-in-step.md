# 0219 — The language a profile dictates in is settable, and the machine-wide copy goes rather than being kept in step

Date: 2026-08-18
Status: accepted. Applies
[ADR 0068](0068-the-communication-style-is-a-tab-in-the-profile-and-the-legend-states-its-scope.md)
to the last pair it had not reached, and
[ADR 0203](0203-the-model-a-record-names-is-the-one-the-profile-sent-and-a-lane-that-sent-none-names-none.md)'s
rule to its second field.
Track: Speech (B18)

## Context

The owner read the job list on AI Models and asked where the drawn `Language` row
is actually set. ADR 0216 answered that question for three other rows by removing
them; this is the one the owner kept, against a stated set: **the only rows
needed are `Into`, `Keep the profile's words`, `Language` and `Pin this
language`.**

**The runtime half was never the missing one.**
`ProfileSpeechSettings::language` and `language_locked` are carried into the
capture snapshot (`capture.rs`), read by the drift check
(`hallucination_detect`, through `transform.rs`), and sent as the language hint
by every cloud adapter. What did not exist was a control **anywhere in the
tree**: AI Models drew a `DrawnSelect` over three literal options and an
`InertToggle`, and Profiles had neither. That is ADR 0020's failure class from
the other end — not a control the runtime ignores, but a value the runtime reads
that nothing can set.

**And wiring it would have rebuilt ADR 0203's defect one axis over.**
`history.rs` writes `optional_non_empty(&app_config.language)` into the record at
four sites — the **machine-wide** field — while the capture sends the
**profile's**. Both are empty on every machine, so they agree by accident. The
step that gives the profile's field a control is the step that makes every record
name a language its request did not carry.

So the step owed a decision before it drew anything: either the record reads the
same resolver the capture does, or the machine-wide field goes.

## Decision

**The machine-wide field goes.** `AppConfig::language` had no writer in either
runtime — not in `core`, not in any command, not on any surface — and only two
readers, both of which wanted the profile's answer.
`AppConfig::active_text_profile_speech_language` is the one answer now, and
`history.rs`'s four sites read it.

Keeping the two in step was the alternative and it is the worse one for the
reason ADR 0123 gives: a second answer to one question is a second thing to
drift, and this pair had already drifted — invisibly, because both values were
empty. B22 is on the plan for exactly this shape one field over.

A stored `"language"` key is ignored on read and gone on the next save. Nothing
could ever have set it to anything but the empty string, so there is nothing to
migrate.

**The control goes on Profiles and the statement stays on AI Models.** That is
ADR 0068's ruling, and it is the shape `Into` and `Keep the profile's words`
already use — the one the owner named. Profiles gets a `Dictation language`
select and a `Pin this language` toggle, written through the same `write` seam
every other row on that screen uses, so they edit the profile the pane is
**showing** rather than the active one. AI Models states both with a `ScopeTag`
carrying the door.

**Two smaller rulings inside it.**

*Empty is a choice and not a blank.* The adapters drop an empty hint, so the
value is *let the model decide* — the state every profile is in until somebody
picks, and one a reader may want back. It is `Auto-detect` on both surfaces.

*Pinning nothing is not a state the runtime has.* `hallucination_detect` lowers
its corroboration threshold for the language the request **carried**, and an
auto-detected dictation carried none. So the toggle is refused until a language
is chosen (ADR 0067 rule 1: a control that is offered must act), and the AI
Models statement reads `Nothing to pin` rather than drawing an off toggle — which
would have to mean both *not pinned* and *nothing to pin*, and on this screen the
second is the ordinary case.

## Consequences

**`port:diff` did not move**, which the brief expected it to. `models` is
`65 | 281 | 33` before and after, because the statements render only under a
runtime and the gallery keeps the drawn select and toggle — the split ADR 0055
already requires. A step that converts a drawing into a reading costs the port
nothing as long as the drawing survives in the gallery branch, and that is worth
knowing before the next one is priced.

**+4 frontend cases (866 → 870), one of them a rewrite rather than an addition.**
The case that held *every job-row control is drawn and inert, with the reason on
it* was correct when written and wrong in its reason: `Not integrated yet` names
a lane with no adapter, and this lane has one. It now holds the opposite rule and
says why it turned over.

**The retry path still carries no language.**
`transform_config_from_app_config` builds its config with `..Default::default()`,
so a re-transform runs its drift check with no language hint — as it did before
this record, since the field it would have read was empty everywhere. This
changes nothing and is named rather than quietly inherited; it belongs with the
question `history.rs` already carries about what a retry's attribution should
say.

**The list of languages is `TRANSLATE_LANGUAGES`**, not a second copy of it
(ADR 0123). It is what the product offers rather than what a recogniser can do —
whisper takes far more — and the drawing this replaces offered three.
