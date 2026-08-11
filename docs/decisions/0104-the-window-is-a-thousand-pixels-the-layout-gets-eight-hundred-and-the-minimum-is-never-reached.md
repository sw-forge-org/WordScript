# 0104: The window is a thousand pixels, the layout gets eight hundred, and the declared minimum is never reached

Date: 2026-08-11
Status: Accepted

## Context

ADR 0092 measured what one line of a row hint holds and found it is a range
rather than a number, because `.ws-row-ctl` is `flex: none` and every pixel the
control takes comes off the text column. Its closing warning is that **every
figure in its table is a figure at a window size**, and Leg 11 watched the same
rows measure 542 px of row width in one pass and 457 in the next.

Leg 12 rebuilt the instrument and recorded the window with the numbers, which
nobody had done. The workspace reports **800 × 608 CSS px at
`devicePixelRatio` 1.25**. `xdotool getwindowgeometry` reports the same window
as **1000 × 760**, which is exactly what `tauri.conf.json` declares, and
`Xft.dpi: 120` is where the 1.25 comes from.

So the window is at its configured size and untouched, and the layout is laid
out at `1000 / 1.25 = 800`.

**The declared minimum is the part that cannot be satisfied.** `tauri.conf.json`
sets `"minWidth": 880` for the `settings` window. At that width the CSS viewport
is `880 / 1.25 = 704 px`. The layout never sees 880 on this machine and cannot:
the two numbers are in different units, and the gap is the display scale. On an
unscaled display they agree; on a 1.5× display the same config gives the layout
667 px.

**What that does to a copy budget.** Every number ADR 0092 published, every
number Leg 11 published and every number in this leg's own record is a number at
800 CSS px. On Profiles the pane leaves a row's text column **79 px**, where one
line holds **10 characters** — below the 12 ADR 0092 recorded as the floor, at
the same window, two hours apart. Rows drawing five and seven lines there carry
the prototype's own copy, so the line count is a property of the width and not
of the sentence.

## Decision

**The display scale is recorded as the frame around every measurement, and
nothing about the window is changed here.**

- **A measurement is quoted with its CSS viewport**, not with the window size
  the config declares. `window.innerWidth` and `devicePixelRatio` are what an
  instrument reports; `tauri.conf.json` is not evidence about the layout.
- **`minWidth` and the layout's floor are not the same quantity** and must not
  be reasoned about as if they were. The config constrains the window in
  physical pixels; the stylesheet constrains the layout in CSS pixels; the
  display scale is between them and is the user's.
- **The geometry itself is not touched by this leg.** ADR 0100 is the open
  decision about the window family and its geometry, it is explicitly a planning
  direction rather than an implementation, and it belongs to the track that
  wrote it. A leg measuring copy does not get to move a window.

## Consequences

- **The workspace has no width breakpoint at all.** `shell.css` carries two
  `@media (max-width: …)` rules and neither is the workspace's; the four
  `@container` rules are at 560 and 640 px, inside components. Below the width
  the design assumes, the layout does not rearrange — it compresses, and the
  text column is what pays, because it is the only flexible thing in the row.
- **A three-line row is a departure only against its neighbours at the same
  width**, which is how ADR 0092 phrased it and why that phrasing survives this
  finding. An absolute line count is as unusable as an absolute character count.
- **The rows this leg did not touch are recorded with their widths** so the next
  reader can tell a copy problem from a width problem: Profiles → Style is
  port-authored copy (`Writes to`, `Length`, `Your rules`, `Writing sample` and
  the `Communication style` card description appear nowhere in `demo.js`) and
  draws 7, 5, 7 and 3 lines at 86, 114, 226 and 226 px. It is the one card in
  the product where the port wrote the copy AND the width is smallest, and it is
  the first place to re-measure once the window question is decided.
- **The prototype prints a control's own text in the row beside it, on purpose.**
  Profiles → Defaults draws `Ceiling` as `hint: "13:39 — the 25 MiB upload size
  on your plan…"` beside `ctl: badge("13:39")`. ADR 0092's defect class is
  narrower than its sentence reads: it is a hint reprinting the runtime text of
  a **width-auto, runtime-filled** control, where the string and the width have
  one cause. A badge quoting five characters is not that, and a leg that reads
  the rule without reading the drawing will rewrite the donor's copy.
