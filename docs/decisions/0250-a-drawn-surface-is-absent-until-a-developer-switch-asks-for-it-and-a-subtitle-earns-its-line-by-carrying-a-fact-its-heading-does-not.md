# 0250 - A drawn surface is absent until a developer switch asks for it, and a subtitle earns its line by carrying a fact its heading does not

Date: 2026-08-25
Status: **Accepted.** Extends
[ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md),
which said a drawing marks itself and is never deleted, with the question that
record left open: who the marker is drawn *for*. It is drawn for whoever is
building the thing, and until this decision every installation was that person.

## Context

### Three markers said "this is a drawing" and none of them said "to whom"

The product had grown three ways to mark unbuilt work — a banner over a screen,
a chip beside a row label, and a boolean on a navigation entry — and all three
rendered unconditionally. ADR 0161 established that the sketch is the
deliverable and must not be removed. Nothing established that a person who
merely wants to dictate should have to walk past it.

The result is measurable: of the ten sections in the settings sheet, **three are
drawings end to end** (Notes & Meetings, Agents, Integrations), as is one of the
four workspace views (Context). A reader opening settings met ten doors, three
of which opened onto a description of software that does not exist, and the
command palette indexed those three as places to go.

### The secondary line under a heading, counted

A walker over `src/` collected every `description`, `hint` and `lead` — the
small text that sits above or below a heading — and measured it:

| | sites | characters |
|---|---|---|
| Before | 460 | 43,997 |
| After the sweep | 458 | 33,980 |

The longest single one ran to **268 characters** under a five-word label. Read
in place, the pattern was consistent and is worth naming precisely, because it
is not verbosity in general:

- **The heading already carried the fact, and the line under it argued for the
  fact.** A row labeled *A name you set is never overwritten* was followed by
  three sentences explaining why overwriting it would be worse than offering no
  names. The reader has already been told the rule by the label; what follows is
  the derivation, and a derivation belongs in `docs/`.
- **The line restated its neighbors.** A section header read *Microphone, sound
  and where the overlay appears* directly above three section headings reading
  Microphone, Sound, and Overlay.
- **The line printed the value of the control beside it.** A hint on the overlay
  anchor row rendered the current monitor and the current anchor — both of which
  the two selects on that same row already displayed. This is the defect
  [ADR 0092](0092-a-copy-budget-belongs-to-a-row-and-a-row-does-not-know-its-own-width.md)
  names, committed twice in one row.

### Hiding a surface breaks the doors that point at it

Removing a screen is not a rendering change. The sweep surfaced a class of
defect the registry had to answer for: the command palette indexed Context and
Agents as destinations, AI Models carried a link reading *Open Agents*, and
Privacy carried two doors into surfaces that would no longer mount. A count in
Privacy's copy (*four collections*) was a third form of the same thing — a
sentence whose truth depended on a card that had become conditional.

## Decision

### One registry, and it holds two kinds

`src/lib/previewSurfaces.ts` is the single list of every drawn-and-not-built
surface. Each entry states the sentence its marker says, and one field decides
what *off* means for it:

- **`remove`** — the surface is inert, and with the switch off it does not exist:
  no navigation row, no route, no palette entry, no door anywhere else.
- **`unmark`** — the surface is partly wired and does real work. With the switch
  off it keeps its screen and loses only its chip. Home and AI Models are the
  only two.

A surface is never half-present. `WorkspaceRuntime.canOpen` answers whether a
target can be reached, and every link that crosses to another surface asks it
first, so a door and its room are decided by one fact.

### The switch is machine-wide and defaults to off

`developer_mode` is an additive `#[serde(default)]` boolean on `AppConfig`,
following `workspace_nav_rail`. It belongs to the machine and not to a profile:
what it governs is which drawings this installation renders, which is a property
of who is sitting at it. It is off by default, which means a release build and
a build from source are the same build with one setting between them, rather
than two artifacts that have to be kept in step.

The gallery is exempt and always renders markers. It is the acceptance surface
for drawn screens under
[ADR 0055](0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md),
and a gallery that hides them measures nothing.

### What a subtitle has to do to earn its line

A `description`, `hint` or `lead` is kept only when it carries **a fact its
heading does not**. Applied in order:

1. If the heading already says it, delete the line.
2. If the line is the derivation of the rule the heading states, delete it. The
   record that carries the derivation is the ADR.
3. If the line names the value of a control on its own row, delete it — that is
   ADR 0092's defect.
4. If what is left is the operative detail, keep it, in one sentence.

A wizard is the documented exception. Onboarding explains as its purpose, and
the sweep left it nearly intact: seven of its forty-two lines changed.

## Consequences

- Default navigation is **three views and seven of ten settings sections**. The
  three group headings all survive, so the shape of the sheet does not change
  when the switch is thrown — sections appear within groups that were already
  there.
- A `PreviewTag` or `PreviewBanner` written without an `id` renders
  unconditionally and escapes the filter. A walker test over `src/` fails on
  one, which is the same enforcement shape ADR 0115 uses for model ids.
- The screens that are drawings are now the least-read text in the product,
  since a default reader never reaches them. They were swept anyway: their
  copy was the densest in the tree, and the person who does see them is the
  person building them.
- The remaining longest line in a product screen is 173 characters, on Agents.
  It survives because it states which region of a file WordScript rewrites,
  which nothing else on that screen says.

### The gallery now diverges from the prototype on copy, deliberately

`npm run port:diff` compares the gallery against the frozen prototype, which
still carries the long copy. Measured across the fourteen gallery screens,
before and after the sweep:

| | differences | structural |
|---|---|---|
| At `HEAD` before the sweep | 1,001 | 453 |
| After | 1,474 | 455 |

**The structural delta is two**, and both are nodes this decision deleted on
purpose: Notes & Meetings' engine-row hint, which restated its own section
heading, and Live Subtitles' section description, which restated the lead
directly above it. Everything else in the +473 is a height or a text
difference — a hint cut from three wrapped lines to one measures 18 px where
the prototype measures 54.

So the number this check reports is no longer a defect count for these
screens, and the 1,001 it reported beforehand was never zero either. The
prototype remains the authority on **layout and grammar**, which is what
[ADR 0055](0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md)
built it to judge; it is no longer the authority on **what a line says**. A
future run should read the structural column, compare against 455, and treat
style-and-text drift on a swept screen as expected.
