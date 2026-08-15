# 0157: The size outranks a missing key, and the ladder stops being one screen's internals

Date: 2026-08-15

Status: Accepted

## Context

ADR 0129 moved the provider choice to the point of use and ADR 0131 generalised
it: every surface that starts a job names where it runs. Speech-track step B7
built it for the two surfaces that exist — the import intake and the translation
window. Five questions came up in the building that neither record answers, and
they are here rather than in the plan because each is a rule rather than a
sequence.

## Decision

### The size outranks a missing credential and yields to everything else

`InertReason` had five kinds. B7 adds `upload_too_large`, and where it sits in
the order is the decision:

- **A missing adapter, a denied role, an unanswered runtime and a pending read
  all beat it.** Those vendors cannot take the file for reasons that have
  nothing to do with how big it is, and saying *too large* over them sends the
  fix in the wrong direction.
- **It beats a missing credential**, which is the one that is not obvious.
  ADR 0106 established that a vendor missing its key is one action away from
  working and must not be conflated with one that cannot work at all — so the
  credential is the more useful sentence in general. Not here: **a key can be
  added and the file will not get smaller.** Telling somebody to add a
  credential to a vendor that will reject the upload anyway is a fix that
  cannot succeed.

Both directions are held by tests that were made to fail before they were
believed.

### `Unbounded` and `Unknown` are two answers, and `capture_limits` folds them

`core::providers::capture_limits` returns `ProviderCaptureLimits::unbounded()`
both for a lane that declares no limit and for a vendor this build has never
heard of. **For its caller that is right**: the capture budget wants a number of
seconds and the configured maximum is the honest one either way.

Asked in the other direction it is wrong, and wrong in the direction this repo
already has a rule about: it would tell a user their file fits a vendor there is
no path to. So `capture_limits_if_known` returns `Option`, `capture_limits` is
defined in terms of it, and `UploadCapacity` carries four variants where a
`bool` would have carried one. This is ADR 0106's *a missing field is not a
false* one axis over.

**A lane bound by decode time answers `Unbounded` here and that is not a gap.**
`realtime_factor` bounds how long a recording may be, not how large a file may
be, and the local runtime decodes a file it never sends.

### The ladder is a shared component, not `AI Models`' internals

`Follows` and the two contexts under it — the runtime answers and the inert
reason — lived inside `Models.tsx`, and could, because one surface rendered
them. Three surfaces render them now.

**The line is what configures a lane against what states where one job runs.**
The connection card, the lane segment, the model library and `ProviderPick`
stayed; the job ladder, the `Drawn*` wrappers and the runtime provider moved to
`src/components/jobProvider.tsx`. ADR 0055's one-implementation rule is why this
is an extraction rather than a second copy: a drawing rendered by two
implementations is two drawings that agree today.

**The extraction moved `port:diff` by zero**, proven by putting the removed
override back and re-measuring: `structural 9 | style 217 | text 12`, the
baseline exactly. The movement `models` does show is the override and nothing
else.

### A constraint that cannot be observed is not a guard

The upload intake's drop zone was drawn, and a drawn drop zone has no file, and
without a file the size constraint can never fire. Built that way B7 would have
shipped a guard nobody could ever see work.

So `DropZone` gained `onFile`, and its only consumer reads `size` and nothing
else. **Reading the file, sending it and producing an object is the context
object track's C2** — this is the minimum that makes the guard observable, not
the beginning of an import path. The drawing does not change: the input is
hidden behind the same button.

### An addition to a drawn screen lands at the end of it

The translation window's picker was first placed where it belongs by
information architecture — after *The window*, before the audio routing. That
made it `section.sec[2]` and shifted the index of every section after it:
`port:diff` went from `structural 0 | style 0 | text 9` to
`187 | 80 | 33`, and **not one of those 187 was a fidelity loss.** They were
path renumberings, and their cost is that a real deviation would now be
invisible in the noise.

Moved to the end of the screen the same picker measures `63 | 0 | 9` — 63 being
exactly the 63 nodes it adds, with style and text back on the baseline.

**So a section added to a ported screen goes last unless the drawing itself is
being revised.** The instrument that compares this product to its prototype is
worth more than the ideal ordering of a screen nobody has wired yet, and the
ordering can be revisited when the translation window is built for real (G2).

## Consequences

**`port:diff` moves on two screens and both movements are accounted for:**

| Screen | Before | After | Cause |
| --- | --- | --- | --- |
| `models` | `9 \| 217 \| 12` | `26 \| 242 \| 19` | the `upload` override, removed by ADR 0129. Proven sole cause by reverting it |
| `translate` | `0 \| 0 \| 9` | `63 \| 0 \| 9` | the picker's own 63 nodes; nothing else shifted |
| `contextintake` | `0 \| 12 \| 0` | `0 \| 12 \| 0` | unmoved — the picker sits behind the `Import` way and the screen opens on `Write` |

**The fourth `InertReason` kind ADR 0131 predicted is still owed.** A lane that
cannot stream, under a control that needs streaming, is the sibling of this
one — same mechanism, different constraint. It must reuse `resolveUploadAnswer`'s
shape rather than invent a second, and that record says so already.

**`ProviderCapabilities` did not grow a field and nothing new is stored.**
`providers.overrides[job]` is A4's map, writable since B6; this is that value
drawn a second time, and `resolveConfigJobProvider` is still the one door.

**Four surfaces still owe the rule** — the meeting HUD, the translation window's
own picker, Live subtitles and the agent overlay. Each carries the obligation
into the step that builds it, which is ADR 0131's arrangement and not a gap
here.
