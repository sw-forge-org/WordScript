# 0100: The window family is a class with user-owned geometry

Date: 2026-08-11
Status: Accepted (planning direction; not implemented)

## Context

`DESIGN_SYSTEM.md` already states the rule the drawings follow:

> **THE WINDOW FAMILY IS FIVE MEMBERS AND ONE CHROME.** Ask, Actions, the
> meeting HUD, the agent window and the translation window all take
> `ChatWinDeco` [...] and the same corner resize grip. [...] A sixth window that
> reaches for its own header is the defect this family exists to prevent.

**None of those five windows exists.** `src-tauri/tauri.conf.json` declares
three windows statically -- `overlay`, `settings`, `rebuild-lab` -- and there is
**no `WebviewWindowBuilder` anywhere in the Rust tree**. Windows are fetched
with `get_webview_window(label)`, revealed with `.show()`, and hidden rather
than destroyed by `install_hide_on_close`, which intercepts `CloseRequested`,
calls `prevent_close()` and hides. The gallery route `/gallery` has no window at
all; it opens inside one that is already there.

So a whole family of drawn surfaces waits on one capability the runtime does not
have, and the record that names them names them as a chrome rather than as a
class of window.

**There is a path here the codebase deliberately abandoned, and it is adjacent
enough to be reached for by accident.** `resize_overlay_to_height` and
`resize_edit_overlay` were removed by ADR 0089, and `lib.rs` carries the reason
at the site:

> They are the dynamic overlay sizing path, and it is not merely unused -- it is
> the path this codebase deliberately abandoned. [...] `set_size` is applied
> asynchronously on WebKitGTK/GTK, so back-to-back resizes leave the window a
> tick behind and clip the pill [...] Leaving two registered commands that
> reintroduce the ghosting [...] is a loaded gun in a drawer, not dead weight.

## Decision

**A second window class exists, and what distinguishes it is who owns the
geometry.**

| | The overlay | The window class |
| --- | --- | --- |
| Size | fixed per surface, `OverlaySurface::dimensions` | the user's, and remembered |
| Moved by | placement grammar, per display, global | the user, by dragging |
| Focus | `focus: false` -- taking it moves the insert target | takes focus freely |
| Why | it inserts at a cursor in somebody else's app | it inserts nothing |

**The distinction is not "fixed versus dynamic". It is "runtime-driven versus
user-driven".** ADR 0089 abandoned a path where *content height drove a
`set_size` call*, repeatedly, mid-interaction, on a compositor that applies it
asynchronously. A user dragging a corner is a different mechanism with a
different failure surface: one geometry change per gesture, initiated outside
the webview, with no content-measurement loop behind it.

**The abandoned path does not come back, and this record does not license it.**

- The overlay keeps `OverlaySurface::dimensions` and its flat surfaces keep
  sharing one width so a surface swap triggers no native resize at all.
- **There is no generic resize command.** Not for the overlay, and not for this
  class either -- a window in this class is resized by its user through the OS,
  not by React through an `invoke`.
- Geometry is **read and persisted**, never pushed from content.

**Members declare their obligations, and they are not uniform.** What they share
is the chrome and the grip; what differs is per member and is not inherited by
being in the family:

- **Content protection** -- the meeting HUD and ADR 0043's notification float
  over calls that are being screen-shared and must not appear in the share. The
  translation pop-out is a conversation at a table and has no such obligation
  stated.
- **Always on top** -- the notification is, by ADR 0043, because a question
  nobody sees is the one failure that surface may not have.
- **Closing** -- the translation pop-out returns its session to the view and
  does not end it (ADR 0064). `install_hide_on_close` is the existing pattern
  and the right one, but *what closing means* is per member.

**Placement is the overlay's grammar where a member is placed rather than
opened.** The caption strip is placed once per display, globally -- placement
mode, display, anchor, exactly as `Settings → General` carries for the dictation
overlay -- because a strip you place once is a property of your desk. A pop-out
you drag is not, and remembers where you dragged it.

## Consequences

- **Declaring windows statically stops scaling.** Three fixed entries in
  `tauri.conf.json` cannot express *several translation pop-outs may stand at
  once* (ADR 0064). Whether that means `WebviewWindowBuilder` or a fixed pool of
  declared labels is an implementation choice this record leaves open, and it is
  the first real one.
- **Multiple pop-outs, exactly one live conversation** is arithmetic about the
  microphone, not about windows (ADR 0064), and the window layer must not
  enforce it -- a window limit would be the right rule expressed in the wrong
  place. ADR 0107 is where that arithmetic becomes concrete: one held-open input
  stream per session, and `start_native_capture`'s existing refusal of a second
  concurrent capture is what enforces it.
- **Several members of this class drawing one machine-wide value is new and has
  no mechanism.** Two windows share no state and the runtime announces no
  setting change; ADR 0108 takes that, and it is a general consequence of this
  class rather than a translation-window detail.
- **`ChatWinDeco` and the grip already exist** in `components/shell/`, reachable
  only through screens the product mounts nowhere. This class is what gives that
  family its first real host, and it is why deleting an unmounted screen for
  tidiness orphans a family (`registry.tsx`).
- **Native decorations stay off for this class and on everywhere else.** ADR
  0003 puts native decorations on every OS; `ChatWinDeco` is a decoration strip
  *standing in* for the one the OS draws, which is a deliberate exception the
  drawings already make and this record inherits rather than reopens.
- **The native host is the only instrument.** A second window class is exactly
  the kind of change that behaves in jsdom and fails on WebKitGTK, and four
  consecutive legs have found a defect that way.
- **Nothing here mounts anything.** The six undecided surfaces stay unmounted,
  `ia.test.tsx`'s last case still asserts that, and a window class with no
  member is not a fake affordance -- it is a capability with no door yet.
