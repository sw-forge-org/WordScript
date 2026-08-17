# 0197: A profile is made active where profiles are managed

Date: 2026-08-17
Status: Accepted. Owner brief of 2026-08-17, carried by the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Adds a verb to the
row menu [ADR 0082](0082-a-rows-actions-belong-at-the-row-and-deleting-always-asks.md)
built.

## Context

Switching the active profile was reachable from exactly one control in the
product: the picker at the foot of the sidebar. That is a `<select>` of every
profile by name, on a surface that shows you none of them — no description, no
mode, no health flag, nothing to choose BY.

Meanwhile the screen that lists profiles, describes them, flags their health and
lets you rename, duplicate, export and delete them could not make one of them the
active one. **The screen that manages the objects could not perform the one
operation that matters most about them.**

## Decision

**`Set as active` is the first entry in the profile row menu**, reachable by
right-click on the row and from the `…` in the detail header — which is the same
menu, as it already was for the other four verbs.

**It leads the menu** because it is the only entry there that changes what the
NEXT dictation does; the other four change a stored object.

**The runtime is the authority and is asked first**, exactly as the sidebar
picker asks it: `switch_active_text_profile`, and the config is patched only
after the command succeeds. Patching first and invoking after is what left that
picker showing a profile the runtime had refused to switch to — the whole of the
"sometimes it just does not switch" the owner reported on 2026-08-11.

**A refusal is shown and not swallowed.** It goes to a `Note` under the screen's
head, in the runtime's own words, and clears on the next attempt so it cannot
outlive the condition that caused it.

**Two different reasons the entry cannot run, and they are not the same fact:**
*this is already the active profile*, which is about this profile, and *locked
while recording*, which is about right now. Drawn and inert with the reason as
its hint either way (ADR 0065), which is the shape the `Delete` entry below it
already has for the last profile.

**The lock predicate and both its strings live in `lib/textProfiles`.** Three
surfaces now have to agree with `sessions::PROFILE_LOCKED_DURING_SESSION` — the
sidebar switcher, the settings header's, and this menu — and each of them had or
would have grown its own spelling of "recording or processing" and its own
sentence about why. **Three copies of one refusal is how two of them end up
disagreeing with the runtime and with each other** (ADR 0123). It lives with the
profile helpers because the question is about a PROFILE — can this one be made
active right now — and the session is only the reason the answer is no.

## Consequences

The sidebar picker is unchanged and stays. It is the fast path for somebody who
already knows the name; this is the path for somebody choosing.

`WorkspaceWindow` derives `sessionActive` through the shared predicate now rather
than spelling the two statuses inline, so the strip, the switcher and this menu
cannot disagree about when a session is running.
