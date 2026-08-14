# 0137: Ask, Actions and the meeting HUD are OS windows, and a drawn box was never going to answer that

Date: 2026-08-14

Status: Accepted

## Context

The three surfaces were drawn as boxes pinned inside the workspace, ported that
way, and judged that way. `ChatWindow`'s own comment has said the opposite since
the port — *"So it is a window. Always on top, movable, resizable — it can sit
beside the main window so the note and the answer are readable at once, which is
the entire point of asking"* — and `HudDeco` renders the sentence *native window
decoration — drawn by the OS* as a **stand-in** for a frame that was never
going to be drawn by anything.

`.ws-chatwin-deco` has carried `cursor: grab` since the port. Nothing moved.
That is [ADR 0020](0020-the-processing-mode-is-the-only-transform-axis.md)'s defect written
in CSS.

**A box cannot answer what the drawing is for.** Whether two of them stand at
once, what one covers, whether the object behind stays readable at 330 px, what
happens when one is dragged onto a second monitor — none of it is visible in a
preview where the surface is a `position: absolute` child of the thing it is
supposed to float over. The owner's instruction on 2026-08-14 was to stop
describing them and open them.

## Decision

**The three are OS windows, created at runtime, with `decorations: true`.**

`src/windows/popout.ts` opens one per surface at `index.html#/popout/<surface>`,
labelled `popout-<surface>`; `src/windows/PopoutWindow.tsx` is the route they
land on. A second press focuses the window that is already open rather than
stacking a duplicate, which a label gives for free.

**[ADR 0003](0003-native-fensterdekorationen.md) decides the frame, so the stand-in
strip is dropped in a real window.** `MeetingHud`, `AskPopout` and
`ActionsPopout` take a `bare` prop, and the route sets it. Drawing the stand-in
inside a decorated window would be two title bars — the fake-traffic-lights
defect `CLAUDE.md` forbids, reached from the other direction.

**Every size is the stylesheet's, read rather than chosen.** `.ws-hud` is
330 × 560, `.ws-chatwin` 330 × 400, `.ws-actionswin` 520 × 440 because it holds
a list beside an editor. A window that opened at a size the drawing does not
have would be measuring something nobody drew.

**`alwaysOnTop` is per surface and is not a family trait.** The meeting window
floats over a call you are looking at — that is what its drawn caption says and
it is the same reason it must stay out of a screen share. Ask and Actions sit
beside the object they are about and take their turn like any other window.

**The overlay is not in this family.** It is 440 × 60, `decorations: false`,
`focus: false`, because taking focus moves the insert target away from the
application being dictated into. Nothing in this family inserts, so nothing in
it needs that exception, and none of it relaxes the pill's rules.

**Without a host, the button draws the box instead.** The gallery is a
design-time surface that runs in a browser
([ADR 0055](0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md)),
where no window can be created; a button that did nothing there would be the
defect this pass came to remove. `hasNativeHost()` is checked **synchronously**,
so the browser path costs no frame, and `usePopout` makes the drawn box
draggable — which is what the CSS had been promising.

**Nothing behind them is wired, and the windows do not pretend otherwise.** They
carry the same drawn specimens the gallery carries. What is new is that they can
be put beside a real call.

## Consequences

**`src-tauri/capabilities/default.json` gains `popout-*` and two permissions**
(`core:webview:allow-create-webview-window`, `core:window:allow-close`). The
glob is deliberate: three windows named individually would be three lines to
forget when a fourth surface joins the family.

**A fourth route exists in `App.tsx` and is reachable from no product surface**,
the same terms the gallery route already ships under. It is lazy, so its
stylesheet never loads on a route that ships.

**`ENTRY_POINT_HOLES` is stale and this record does not fix it.**
`src/windows/workspace/ia.tsx` still says the meeting surface's undecided part
is *how a capture starts and what ends it* — closed by
[ADR 0063](0063-a-meeting-has-four-ways-in-one-of-them-watches-the-microphone-and-only-a-press-ends-it.md)
on 2026-08-05 — and the translation window's is *how the window is opened*,
closed by [ADR 0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md)
the same day. Two of six have been answered for nine days. Correcting the list
is Leg 4a's subject; this record names the drift so the next reader does not
take the list as current.

**Verification is owed in the native host.** `npm test` and `npm run build` pass
and `cargo check` is unchanged, but a window that opens is not something jsdom
can observe — `CLAUDE.md` requires the host for anything window-bound, and this
is the most window-bound change the port has made.

## Related

- [ADR 0003](0003-native-fensterdekorationen.md) — the frame is the compositor's.
  This is the first place in the port where that is literally true rather than
  stood in for.
- [ADR 0020](0020-the-processing-mode-is-the-only-transform-axis.md) — the defect this
  removes, in five instances on one screen.
- [ADR 0055](0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md)
  — the gallery runs in a browser, which is why the fallback exists.
- [ADR 0063](0063-a-meeting-has-four-ways-in-one-of-them-watches-the-microphone-and-only-a-press-ends-it.md)
  — `Record meeting` is the fourth way in, so it raises the window rather than
  describing one.
