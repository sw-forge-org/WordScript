# 0066: Help is a small modal with three links, which is what finally mounts the row

Date: 2026-08-10
Status: Accepted

## Context

The prototype's sidebar draws a `Help` row (`demo.js:1774`). It was ported with
the rest of the nav grammar and **three legs have deliberately refused to mount
it**, each recording the same reason: there is nothing behind it, and a nav row
that opens nothing is the fake affordance rule 7 forbids (Leg 2a finding 10,
Leg 3 finding 3). The sidebar's search field is unmounted for the same reason
one step over — it opens a command palette and the port carries none.

Leg 3 wrote the condition down rather than the answer: *"Mount each when there
is something to open."* This is that something.

Named by the owner on 2026-08-10, listing what he remembered from the demo:
Discord, GitHub, and the documentation.

## Decision

**The `Help` row opens a small modal carrying three links: Discord, GitHub and
the documentation.** The row is mounted in the commit that builds the modal, and
not before.

- **A modal, not a section and not a menu.** Help is a detour with nothing to
  configure and nothing to come back to, so it does not earn a settings section;
  and it is three destinations with names worth reading, which a bare menu
  renders as three anonymous strings.
- **It uses the sheet family the library already has.** `Sheet` and its seven
  parts are ported (Leg 3) and the settings sheet is the same material. Nothing
  new is drawn for the container.
- **Every link opens for real, through `openUrl`**, the way About & Updates'
  four project links already do.
- **The URLs live in `lib/appMeta.ts`** with the four that are already there.
  Two are new — the Discord invite and the documentation root — and a URL that
  does not resolve yet is a link that must not be drawn yet: a row that opens a
  404 is the same broken promise as a row that opens nothing.

**The search field stays unmounted.** It is not covered by this record. The
prototype does have a command palette behind it — `Cmd`/`Ctrl`+`K`,
`state.cmdkQuery`, `demo.js:8068–8366` — and the port never carried it, which is
a separate piece of work and a separate decision.

## Consequences

- **This is new UI, and it is the first of this port.** The prototype draws the
  row and not what it opens, so the modal's content has no 1:1 source and cannot
  be measured by `npm run port:diff`. It is built from the library's existing
  parts and judged by eye, which is why it is recorded here rather than decided
  at a call site.
- **`About & Updates` is untouched.** Its Project card already lists GitHub,
  SW labs, the release workflow and the runbook, and it is a drawn card the
  gallery still measures. Discord and the documentation do not get appended to
  it; if the two lists should ever be one, that is a gallery change and its own
  record.
- **The row is a door, so it belongs to the window rather than to a screen.**
  It sits in `NavFoot` beside Settings and the profile switcher, which means it
  is `WorkspaceWindow`'s and does not go through the screen seam.
- **Nothing about it is a runtime fact**, so it needs no `§2.5` entry and no
  banner: three links either resolve or they are not drawn.
