# Bug: a style rule past 120 characters is truncated and the meter stays black

Status: **Open.** Found 2026-08-10 (Leg 6) by reading the owner's own profile in
the native host. Not fixed — the Style card was not on that leg's list — and
recorded here so the next reader does not have to rediscover it.

First reported: Leg 6's native-host check
Affected area: `Profiles → Style`, `core::communication_style`

## Symptom

The budget meter under **Your rules** reads black — well inside its 400
characters — while rules are silently losing their tails.

On the owner's `Product and engineering` profile:

| | |
| --- | --- |
| What the field holds | **256** characters, two lines of 124 and 131 |
| What the meter says | **247 / 400** |
| What actually reaches the prompt | both lines cut at 120, each with `...` appended |

Two of two rules are truncated. Nothing on screen says so.

## Why the meter is not lying, and why that is not enough

The meter is correct and was made correct on purpose. Before Leg 5 it counted
the characters in the textarea against a constant copied out of the runtime;
ADR-less and wrong in one direction. `analyze_communication_style` now returns
`core::communication_style`'s own `StyleFieldBudget`, and 247 is genuinely what
the prompt spends.

The gap is in what a black meter is taken to MEAN. Leg 5's record states it as:

> a meter in the black is a guarantee that nothing was dropped

That is true, and *dropped* is a narrower word than it reads. `style_rules_budget`
has three reducing steps and only one of them is a drop:

- whitespace is collapsed — lossless
- a line repeating one already accepted is **dropped** — reported in `dropped`
- a line past `MAX_STYLE_RULE_LINE_CHARS` (120) is **truncated** — `truncate_to`
  cuts it and appends `...`, and the result goes into `accepted`

So truncation is a loss that never appears in `dropped`, never turns the meter
red, and is invisible on the surface. The hint under the field does say *"anything
past 120 characters in one line are dropped before it is counted"* — which is
the only warning, is worded as a drop, and is a sentence rather than a state.

## What a fix has to decide

Not decided here. The choices are visible, and each is a product decision rather
than a repair:

1. **Report truncation like a drop.** `StyleFieldBudget` grows a `truncated`
   list beside `dropped`, and the meter turns amber on it. Cheapest, and it
   makes the meter mean one thing again.
2. **Mark it per line.** The field is a textarea and cannot show per-line state
   without becoming an editor; this is the expensive answer.
3. **Refuse the write.** A 121-character rule is rejected at save time with a
   reason. Honest, and it makes a paste of existing rules fail in a way people
   hate.
4. **Raise or remove the per-line limit.** It exists so one rule cannot eat the
   whole budget; that reason still holds.

Leg 5 decided that the `dropped` list is not drawn, on the owner's call, because
a card enumerating declined lines would be a second place for style rules to
live. Whatever is chosen here has to stay inside that decision.

## Regression Checks

- A profile with a 121-character rule shows something other than a plain black
  meter.
- A profile whose rules are all under 120 characters is unchanged.

## References

- `src-tauri/src/core/communication_style.rs` — `style_rules_budget`,
  `truncate_to`, `MAX_STYLE_RULE_LINE_CHARS`
- [ADR 0068](../decisions/0068-the-communication-style-is-a-tab-in-the-profile-and-the-legend-states-its-scope.md)
- `docs/tracks/gui-port-relay.md` — Leg 5's record (the meter's
  derivation), Leg 6's finding 5 (this measurement)
