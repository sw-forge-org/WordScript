# 0045 -- Everything recorded is one object

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

WordScript produces recorded material by five routes and models it four ways.

| Route | Where it lands | What it is called |
| --- | --- | --- |
| A dictation | transcript history | a transcript, a Markdown file (§11.23) |
| A meeting | the notes directory | a note with three tabs |
| An uploaded file | the upload queue | a queue row that becomes a note |
| A pasted link | the upload queue | the same |
| A calendar entry | nowhere | nothing |

Every one of them ends as *text somebody said, with a time on it*. The four
models are an artefact of the order the features were built in, and the surface
paid for it twice:

**The user had to know the route before they could find the result.** Notes and
Upload were two workspace entries, so "where is the Acme call" depended on
whether it arrived as a recording or as a file.

**The same material was drawn differently depending on where it came from.** An
upload's transcript was a row in a queue with a Copy button; a meeting's
transcript was a tab in a note. Same transcript, two components, two vocabularies.

### The route that had no model at all

A meeting on a connected calendar exists before it happens. It has a name,
a time, attendees, an agenda, and the questions the last one in the series left
open. Nothing in the product could hold that, so the calendar integration
(§11.27) had a connection screen and no destination -- it could be connected and
then had nowhere to put what it read.

The obvious fix was a calendar view. It was rejected: a month grid competes with
the calendar the user already keeps, loses, and holds nothing that a row does not.

## Decision

**One type.** A meeting, a dictation, an uploaded file, a fetched link and a
scheduled calendar entry are one object with one detail view. How it got here is
a field on it.

```
origin   dictation | meeting | upload | link | calendar
state    scheduled | recording | transcribing | ready | failed
```

**`scheduled` is what earns the merge its keep.** An object exists from the
moment the calendar says it will, with everything known about it already filled
in. Recording it fills in the transcript; it does not create the object. That is
"before the meeting you already know everything" with no new screen, and the
list that will hold it afterwards is the list that shows it now.

**Four tabs: Transcript, Notes, Summary, Linked.** The first draft had seven --
Summary, Transcript, People, Decisions, Tasks, Linked -- and it was thrown away
on a rule worth keeping:

> **A tab is a view of the whole object, not a heading inside one of them.**

Decisions and Tasks are sections of the summary, where they are derived and
where they are read. On separate tabs, one page becomes three and the user has
to guess which of the three holds the sentence they remember. People are not a
view at all: they are chips on the transcript and in the object's header.

`Enhanced` is renamed `Summary` in the same pass. "Enhanced" describes how it
was made, which is interesting for ten seconds, and it means nothing on a
dictation.

**Upload stops being a place.** It is `intake`, a state of Context reached from
the list's add control, because an upload is a *way* an object comes into
existence and a way is not a place. **The queue is deleted rather than moved**:
it was this list filtered to the objects with no transcript yet, drawn a second
time with a second set of actions.

**Three ways in, and the default is the cheapest.** `Write` (an empty object,
typed or dictated into), `Record` (a meeting, in the HUD), `Import` (a file or a
link). `Write` is the default because it is the most frequent, and because
merging Notes into Context had otherwise quietly deleted the plainest thing the
old Notes could do.

**Relationships live on the object, as a list.** A graph view was proposed and
rejected: a graph shows *that* things connect, and the question a user arrives
with is *what* connects. The entry from the other direction -- everything
touching one person or one project -- is a filter on the list, not a second view.

**Links are computed locally.** Shared people, shared topics, the calendar
series, and objects produced from each other. Nothing is fetched from a service
to build the Linked tab; what a network connector could add belongs to the desk
(ADR 0046).

## Consequences

- **The workspace drops from 5 entries to 4**, and that is the test the
  abstraction had to pass. A real abstraction removes an entry; a false one adds
  a screen that explains the others.
- **`Write a note` disappears as a setting.** It was a batch decision on Upload
  asking whether a transcript should also become a note -- a question that only
  existed while a transcript and a note were two objects.
- **Retention now covers two things with different sizes.** A transcript is
  capped and pruned; a context object is a file in a folder the user chose and
  nothing prunes it. An hour of meeting audio is a different promise again and
  stays undecided (ADR 0039 covers a failed dictation's audio, not this).
- **The old ids stay as aliases.** `notes`, `noteactions` and `upload` all
  resolve, per §4.3's rule that a deep link survives a restructure. `upload`
  lands on the intake it became.
- **A calendar entry is a context object with no transcript, which means the
  list contains things that have not happened.** Sorting is by time and not by
  state, so a scheduled object sits above today's finished ones. If that proves
  confusing in use, the fix is a divider, not a second list -- a second list is
  what this record exists to remove.
- **Storage follows the existing promise and does not change it.** Notes are
  files under a real directory (§11.19) and transcripts are Markdown with
  frontmatter (§11.23). One type does not mean one database: it means one
  frontmatter shape, with `origin` and `state` in it, over files that stay
  readable in an editor and in git.
- The runtime shape this needs is in SETTINGS_REWORK_PLAN.md §11.52.
