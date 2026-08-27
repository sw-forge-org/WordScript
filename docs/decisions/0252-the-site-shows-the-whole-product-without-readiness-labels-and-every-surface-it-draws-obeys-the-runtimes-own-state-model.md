# 0252 - The site shows the whole product without readiness labels, and every surface it draws obeys the runtime's own state model

Date: 2026-08-26
Status: **Accepted.** Second decision covering `web/`, and the one that says
what wordscript.dev is allowed to claim. It supersedes nothing in ADR 0251; it
answers the question that ADR left open, which is what the ported page is for.

## Context

The port was accepted against a computed-style diff, which compares the built
page to the sketch it came from. That is the right test for a port and it is
blind to one whole class of defect: anything the sketch already had wrong, the
port reproduces exactly and the diff reports as a match.

A review of the built page against the runtime found that class, and it was
not small.

### The demo played a sequence that occurs in no delivery mode

Every mode scene, and the hero with them, ran `recording`, `processing`,
`preview`, `result`. ADR 0011a says each delivery mode has exactly one decision
surface: `auto_paste` delivers and then shows result-actions (Copy / Edit /
Dismiss); `clipboard_only` stops on a real processing preview (Copy / Edit /
Abort) and closes on the commit, with no result surface at all. Showing both in
one run describes neither, and it is the one combination the ADR exists to
forbid.

The state model underneath had the same shape of error. `OverlayPillState` in
`src/components/overlay/OverlayPill.tsx` is six cases -- `recording`,
`processing`, `result-actions`, `edit-mode`, `mode-picker`, `error` -- and
`preview` is not among them. A staged preview is a FIELD on processing. The
page had invented a fourth state and lost three real ones.

### The page listed seven modes and answered none of the questions a list raises

How a mode is reached was absent. The runtime answers three ways: a direct key
per mode (`default_mode_*_hotkey` in `src-tauri/src/core/config.rs`), the
picker on its own key, and the mode chip on the capsule, which is a button with
a "tap to cycle" title. The page showed seven names.

Two more absences of the same kind: the activity field shaded days and answered
a hover with nothing, where `ActivityCalendar` answers with the day, the count,
the words and two clocks; and the model story was a card reading "local or
cloud, per job" over a product that has an eight-job by three-lane matrix with a
named default in almost every cell.

### And the framing question underneath all of it

The obvious way to add the missing surfaces is to mark which of them ship
today, the way the app marks its own unbuilt surfaces with `PreviewTag`. That
was proposed and rejected, and the rejection is the more important half of this
record: **there is no release.** The page's honesty does not come from
per-feature readiness badges, it comes from the fact that there is nothing to
download, which the page already says in the hero, in the first FAQ answer and
in the second call to action. A page that additionally sorted its own contents
into shipped and unshipped would be answering a question nobody reading it can
act on, and it would read as a changelog rather than as an argument.

`web/REFERENCES.md` already recorded this as constraint 3: a vision, not a
shipped state, and it must still be concrete.

## Decision

### 1. The site is a vision page, and it carries no readiness labels

wordscript.dev shows the product whole. It does not divide its own contents
into what is wired and what is drawn, and it never carries `PreviewTag`,
`PreviewBanner` or any equivalent.

The honesty budget is spent in one place instead, and it is spent explicitly:
there is no download, the primary action is to follow the build, the source is
the second action at near-equal weight, and the first question in the FAQ is
whether you can install it yet. Those four are load-bearing and none of them
may be softened.

This is deliberately NOT the app's rule. Inside the product a drawn-but-unwired
surface must be marked, because a user is trying to do something with it today
and the mark is what stops them. On the site nobody can do anything with any of
it yet, so the mark carries no information and costs the argument its shape.

### 2. Concrete means the runtime's own values, read rather than typed

The freedom in decision 1 is paid for here. A page that shows the whole product
without saying which parts run is only honest if everything it shows is true of
the product as designed, so every value the page states is the runtime's:

- **States and sequences** come from `OverlayPillState` and ADR 0011a. The
  site's capsule carries the same six-case union minus `edit-mode`, which has
  no scene yet; a preview is an option on processing, never a state.
- **Keys** are the shipped defaults from `config.rs`, and the page says "out of
  the box" beside them because they are configurable.
- **Models, vendors, lanes and counts** are read out of
  `shared/model_catalogue.json` at build time. ADR 0115 says a model id lives
  in that file and nowhere else; the site is now its third reader and spells no
  id of its own. Nothing in that section can go stale without the file both
  runtimes load going stale with it.
- **Rule ids, mode names and presets** stay what they already were: the
  runtime's, from `core/config.rs` and `src/lib/transformRules.ts`.

What stays constructed is the content of an example -- a sentence someone
dictated, a day's counts -- under the disclaimer the page already prints. The
distinction is between the DATA in a demonstration, which is invented and
labeled, and the BEHAVIOR of the thing demonstrating it, which is not.

### 3. A surface that invites a press has to answer one

The hero played once and then stood still, which argues for a held key in the
third person. It now hands over: after the opening pass the stage parks in the
`mode-picker` state and a held pointer or space bar runs a capture whose length
is how long it was held.

Two consequences fell out of building it, and both are the rule doing its job:

- The result surface carries no mode chip, here or in the app. So the stage
  parks into the picker after a delivery rather than sitting on result-actions,
  because that is where the chip is. A cue naming a control that is not on
  screen was a real defect and it was found twice, once in normal motion and
  once under reduced motion.
- A press too short to capture anything produces the `error` state, not an
  empty transcript with a result surface behind it. The runtime has that case;
  a demonstration that cannot fail is demonstrating something else.

The page binds the space bar and names `Ctrl+Super` beside it, because a
browser cannot receive the real chord and teaching a key that does not work
here would be worse than teaching two.

### 4. An animation states a quantity or it is decoration

The wiring diagram's travelling dots slid the length of every wire at once,
forever, at constant speed. Nothing arrived, so nothing was being said.

Both states now share one 5.4-second beat and differ in how many arrivals fit
in it: five on the left, one on the right, each dot easing into a node that
takes a ring as it lands. That is the same quantity the count line under the
drawing prints, played as rhythm before it is read as a number.

## Consequences

### What the page now proves rather than asserts

The delivery mode is a control. A reader switches between `auto_paste` and
`clipboard_only` and watches the ending change: text at the cursor and a
surface that stays up, against a preview that has to be answered, an overlay
that closes on the commit, and a window that never received anything. That
comparison is the clearest statement of ADR 0011a anywhere in the project,
including the ADR.

### The payload

101.9 KB gzipped to 111.6. The HTML carries most of the growth, 15.3 to 21.4,
and roughly 6 KB of that is one reading per activity cell -- 364 short strings
in one attribute each, against 364 tooltip subtrees, which is what a node per
cell would have cost. Our own JavaScript went 15.4 to 18.1 and the CSS 12.2 to
13.1. The React runtime is unchanged at 59.0 and is still the largest single
item on the page; `preact/compat` remains named and unpulled for the reason
ADR 0251 gives.

### What this does not change

The site is still not publishable, for the reasons ADR 0251 lists and in the
same words: `web-launch-gate` has not run, there is no imprint and no privacy
notice, and the Zodiak licence text is not in `web/public/fonts/`. Decision 1
is about what the page may claim, not about whether it may be served.

### The check this leaves behind

A computed-style diff cannot find any of the defects above, because both sides
of it were equally wrong. The check that found them is different in kind and is
the one worth keeping: read the page's claims back against the file that owns
each one. Every claim in the sections this ADR touches now names its owner in a
comment beside it, so the next reader can do the same pass without first
working out where the truth lives.
