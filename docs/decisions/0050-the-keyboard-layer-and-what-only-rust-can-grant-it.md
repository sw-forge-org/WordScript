# 0050 -- The keyboard layer, and what only Rust can grant it

Date: 2026-08-03
Status: Accepted (assignment settled; native implementation outstanding)

## Context

The settings surface has 4 workspace views and 11 settings sections, and §4 of
`SETTINGS_REWORK_PLAN.md` spent considerable effort deciding which of them each
control belongs to. Every one of those placements is defensible and every one
is still a thing the user has to know.

Separately, the app is asked to feel native on macOS while keeping the square
chrome and the SW forge accent. Materiality answers part of that
([ADR 0048](0048-a-light-mode-is-not-the-dark-one-inverted.md) covers the
palette half), but the larger part of "native" on macOS is not visual at all.
It is that `Cmd+,` opens settings, `Cmd+W` closes the window without quitting,
`Cmd+Q` quits, there is a real menu bar, scrolling has the platform's own
inertia, and dragging a file onto the window works.

None of that had been assigned, and several parts of it cannot be done in a
document at all.

## Decision

**The assignment, settled here so the native work implements rather than
invents:**

| Keys | Does |
| --- | --- |
| `Cmd/Ctrl + K` | Open the search palette |
| `Cmd/Ctrl + ,` | Open settings |
| `Cmd/Ctrl + W` | Close the window — not quit the app |
| `Cmd/Ctrl + Q` | Quit (macOS; `Alt+F4` elsewhere) |
| `Esc` | Dismiss the topmost transient surface |

**`Esc` is a stack, not a switch, and the order is palette before sheet.**
Escape closing the settings sheet out from under an open palette is the bug the
ordering exists to prevent.

**The palette searches settings, not only places.** "Where do I turn off the
sound cues" is the query people actually have, and a palette that answers it
with "General" has made them navigate anyway. Rows carry the path they live at,
so the palette also teaches the structure it is bypassing — using it twice for
the same control is how someone learns where that control lives.

**It is not a modal.** It takes focus and dismisses on `Esc` or an outside
click, but nothing behind it is disabled. It is opened mid-task and abandoned
constantly, and modal semantics would promise protected focus it does not need
and cannot keep.

**Ranking is prefix, then word-start, then substring.** A plain substring match
puts "Sound pack" above "Play sound cues" for the query "sound cue", and a
palette whose first row is wrong is one people stop trusting after two tries.

**Momentum scrolling is the OS's, not ours.** `-webkit-overflow-scrolling:
touch` hands a scroller to the platform's inertial physics.
Reimplementing that curve in JS is the single most common way an app announces
it is not native, because the curve comes out subtly wrong and the user has a
lifetime of the correct one. `overscroll-behavior: contain` stops a scroll
reaching the end of a sheet from moving the workspace behind it.
`scroll-behavior: smooth` is deliberately NOT set: it would animate the
programmatic jump on every screen change, and a new screen scrolling itself
into place from the previous screen's offset reads as lag.

## What the prototype cannot have, and who owes it

A document cannot quit an application, own a menu bar, or accept an OS drag. A
page that appears to is lying, and the prototype does not. These are owed by
`src-tauri/`, and they are listed here so the boundary is a record rather than
an omission:

| Owed | Where it lives |
| --- | --- |
| Real menu bar (App / File / Edit / View / Window / Help) | `tauri::menu::MenuBuilder` |
| `Cmd+Q`, `Cmd+W` as OS commands | Menu accelerators, not `keydown` |
| Native drag and drop of audio and text files | Tauri drag-drop event on the window |
| System theme following | `window.theme()` plus the theme-changed event |
| Global dictation shortcut | Already native and unchanged by this ADR |

`Cmd+K` and `Cmd+,` are the two that legitimately live in the renderer, because
both act on renderer state. They are also the two the menu bar must mirror,
since a shortcut that exists only as a `keydown` handler is invisible in the
place macOS users look to discover shortcuts.

## Consequences

- The palette index is currently a literal list in the prototype. In the
  product it must be generated from the same source the navigation is built
  from, or it will drift the first time a setting moves — which is exactly what
  the rework is doing to most of them.
- Rows that cannot act in a static mock do nothing rather than pretending.
  Fake success in a design prototype is the same defect as fake readiness in
  the product.
- A menu bar built later has to match this table. If it does not, the app has
  two shortcut vocabularies and the one the user finds first will be wrong.
