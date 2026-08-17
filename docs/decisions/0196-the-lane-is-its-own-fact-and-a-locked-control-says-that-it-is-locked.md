# 0196: The lane is its own fact, and a locked control says THAT it is locked

Date: 2026-08-17
Status: Accepted. Owner brief of 2026-08-17, carried by the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Two readings on the
window shell; neither is a Home question, both came from the same look at the
running app.

## Context

**The status strip welded two answers into one token.** It read
`Groq cloud · llama-3.3-70b-versatile`, produced by one expression with three
arms:

```
local        → `Local runtime · {model} · preview`
self_hosted  → `Your server · {model}`
cloud        → `{vendor} cloud · {model}`
```

WHERE the work runs and WHO does it are independent facts — the same vendor
exists on more than one lane, and Cloud holds several vendors — so a reader
scanning for *am I on the machine or on the network* had to parse a vendor name
to find out. On the two lanes where the vendor IS the lane, the word `cloud` was
not there to look for at all.

**And a locked profile recited its own reason for the length of every
recording.** `ProfileSwitcher` printed thirty words under the sidebar row, in a
200 px column, wrapped over four lines:

> Locked while recording — the profile sets the recognizer, which is fixed once a
> recording starts. The processing mode can still be changed.

Standing under a control nobody is trying to press, at the exact moment the
reader is talking and not reading.

## Decision

**The lane is its own entry in the strip, and its name comes from
`LANE_LABEL`.** That map is the one list of what a lane is called on a surface
([ADR 0160](0160-a-lane-is-a-place-so-self-hosted-reads-as-your-server-and-the-local-runner-is-not-a-server.md)),
and a fourth spelling of `Your server` along the one edge of the window that is
never scrolled away is exactly the drift ADR 0123 forbids. The strip writes its
own `·` between facts, so the lane and the vendor are two entries rather than one
string with a separator in it:

> ● Ready · **Cloud** · Groq · llama-3.3-70b-versatile · Clipboard only

**What follows the lane is what is ANSWERING on it**, and on Local and Your
server that is nothing new: the lane already named the vendor, so restating it
would print the same word twice with a dot between. `preview` stays on the local
row — the product does not offer that lane and says so wherever it comes up
(ADR 0067).

**A locked control says THAT it is locked, in three words, and offers the reason
on the hover.** `Locked while recording` on the line; the sentence in the
`title`. Same rule the counters' tooltips were cut to (ADR 0186) and the same one
that took the recited foot off History (ADR 0184): **a surface states the fact
and offers the reason. It does not recite the reason at somebody who did not
ask.**

## Consequences

`Clipboard only` / `Insert at cursor` is unchanged. It was already one fact in
one entry and the owner said so.

Both strings moved to `lib/textProfiles` in
[ADR 0197](0197-a-profile-is-made-active-where-profiles-are-managed.md), which
gave the refusal a third caller.

Three strip cases were rewritten against the new shape rather than the old
string, and one was added that pins the lane's name to `LANE_LABEL` instead of
to a literal — so the next rename of a lane cannot leave this edge behind.
