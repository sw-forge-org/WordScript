# 0193: A delivery mode is a fact and not a warning

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), Stage C row C9.
Narrows the badge derivation Leg 4c set, on §11.20's own rule.

## Context

`badgesFor()` gave `Clipboard only` and `Clipboard` the `warning` tone, which
paints them in `--accent` — the product's orange, the same colour as its primary
button.

`clipboard_only` is the profile's own setting. On a machine whose profile is
clipboard-only that is **every row in the list glowing amber about a choice the
reader made**, on two screens. Measured earlier in this track: 49 of the owner's
last 50 dictations were `clipboard_only`.

That is §11.20's defect stated in colour rather than in count. The rule there is
*a badge is for a status that is NOT expected*, and it was written against an
upload queue where two thirds of the rows reported that things had gone as
expected — which left the one row needing a decision nothing to stand out from.
A tone does the same thing one step quieter: **when the healthy case is loud, the
failing one has nothing to be loud against.**

## Decision

**`Clipboard only` and `Clipboard` take the `neutral` tone.** The badge stays —
it is still a fact worth stating, because where the text went is not something
the row otherwise says — and it stops claiming something went wrong.

**Unchanged, and deliberately:** `Failed`, `Empty`, `Insert failed` and
`Audio missing` keep `danger`. Those four say something went wrong, and one of
them says the text itself is incomplete
([ADR 0079](0079-a-short-capture-is-a-finding-about-the-text-not-a-note-about-the-audio.md)).
`Retried once` and `Audio swept` keep `plan`, which was never a warning.

`clipboard_fallback` is the interesting case and it goes grey too. A paste that
was meant and did not happen IS a failure — but the row it produces already
carries the whole story on Home's decision inbox (ADR 0076), where it is a
standing question with a Restore button, and duplicating that as a colour on a
history row is the second statement of one fact.

## Consequences

A healthy clipboard-only record is grey on both screens, and nothing that failed
is. The case that grades this asserts both halves, because a change that greyed
all four would pass a case that only graded the first two.
