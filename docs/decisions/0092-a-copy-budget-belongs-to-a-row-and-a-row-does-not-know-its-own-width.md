# 0092: A copy budget belongs to a row, and a row does not know its own width

Date: 2026-08-11
Status: Accepted

## Context

Leg 10 shipped two Privacy & Data rows at 79 and 71 characters — both inside
the `≤ 90` one-line budget every other row on the surface is written to — and
WebKitGTK drew them at three lines and two beside neighbours that drew one. Its
finding was that **a copy budget is a function of the control beside it**, and
that nothing in the toolchain knows that: `.ws-row-ctl` is `flex: none`, so
every pixel the control takes comes off the text column, and jsdom reports the
string while being structurally unable to report the wrap.

Leg 11 was sent to pass over every row whose control is more than one button.
It built the measurement the toolchain was missing — a temporary mount effect
in the workspace that walks the four views and the ten sections, and for every
`.ws-row` reports the control's width, the text column's width and the line
count the hint actually **draws**, cloning the hint node in place to price the
conditional states a default render never shows. 123 rows and 51 alternates
were measured in the shipped engine.

**The rule as written is not the rule the product is built to.** Of 74
measurements over one line, **62 carry the prototype's copy verbatim**. Two
lines is the drawing's norm, on Models, Agents, Integrations, Notes & Meetings,
Privacy and About alike; three is where a row starts to look wrong beside its
neighbours. "A row gets at most one line" describes Leg 10's card, not the
design.

**What one line actually holds is a range, and the range is wide.** Measured on
the shipped surfaces:

| Control | Text column | One line holds |
| --- | --- | --- |
| `Select` + `Button`, runtime-filled | 80–165 px | **12–26 characters** |
| `Select`, runtime-filled | ~250 px | ~34 |
| `Select`, fixed options | ~300–350 px | ~45–57 |
| badge, or a single `Button` | ~400–470 px | ~62–73 |
| stacked row, no control slot | 436 px (`62ch` cap) | ~60–74 |

`≤ 90` is not conservative for any of them and is wrong for all of them.

**Three defects were port-authored rather than drawn, and all three are the
same mistake.** `General`'s `Input device`, `General`'s `Anchor` and `About`'s
`Latest published release` each put **the control's own runtime text into the
hint beside it** — a device name, a monitor label, a release summary. Because
`.ws-sel` is `width: auto`, that text is also what sets the control's width, so
each row spent its text column on the string and then tried to print the string
in what was left. `Input device` drew four lines in its default state and five
in the state where a saved device is missing, beside an `Input level` row
drawing one. The drawing had none of it: the prototype gives `Input device` a
46-character static hint, names the monitor `DP-1` where its own Select holds
`DP-1 (2560×1440) — primary`, and gives the release row 68 characters where the
port grew it to 172.

**The `About` summary is written in Rust**, three files and one language away
from the row that draws it, and all five of its variants carried the same
second clause about the release path not being ready.

## Decision

**A copy budget is quoted with the control it is for, and where the control's
width is runtime data the row is given no sentence at all.**

### The three port-authored rows are fixed at the level the fact belongs to

- `Input device` keeps **no hint**. A shorter sentence was tried first and
  measured: at 24 characters it still drew two lines, because the row had 80 px.
  The standing fact — a change lands on the next capture — is the card's
  description; a running capture and a missing device are exceptional and get a
  `Note` under the card, which spans it at about seventy characters a line; an
  error stays on the row and wraps, because truncating a runtime error would be
  a lie about the runtime. The `<option>` already reads `<name> — not
  available`, so in the state that mattered most the row was repeating its own
  control.
- `Anchor` names the monitor the way the drawing does, without the `(Primary)`
  suffix its Select carries.
- The five `check_app_update` summaries state their result only. The clause they
  shared is one fact about the project and is stated once, on About's **This
  build** section header.

### The two primitives now carry the measured number, not the inherited one

`Card.description` says one line is about **66 characters** at its 436 px.
`SectionHeader.description` says its own width **depends on the `action` beside
it** — measured between 131 px (23 characters) and 444 px (about 70) on the
shipped surfaces. Both said `at most 90` and neither had been measured;
`Card`'s was carried over from `SectionHeader`, whose paragraph is not even the
same width.

### The prototype's two-line rows are left alone

They are the drawing, they are consistent with each other, and this leg was
sent to fix a port defect rather than to redesign the donor. They are recorded
here so the next reader does not read Leg 10's sentence as a licence to rewrite
sixty rows.

## Consequences

- **The defect class is now nameable: a row must not print the runtime text its
  own control displays.** It is not a length mistake, which is why every length
  rule missed it — the string and the width have the same cause, so making the
  string shorter moves the width too.
- **`native_capture_status` keeps its only caller.** Dropping the recording
  sentence would have left it with none — this leg's own copy fix manufacturing
  exactly the drift ADR 0089 sweeps for. The fact moved to the `Note` instead.
- **A conditional state is priced by cloning its node, not by opening a
  screen.** `General` sits in manual placement on the machine this was measured
  on, so `Display` and `Anchor` are not rendered at all and no screenshot of
  that screen could have shown the second defect.
- **The instrument is removed with the leg that built it**, per the brief, and
  described in the relay so the next leg can rebuild it: measure
  `.ws-row-hint`'s `getBoundingClientRect().height` against its computed
  line-height, walk the surfaces with a mount effect, and post to a loopback
  collector — `csp` is `null`, so a `fetch` needs no permission and is visible
  from the shell the moment it lands.
