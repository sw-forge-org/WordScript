/**
 * ASK, ACTIONS AND THE MEETING HUD ARE OS WINDOWS, NOT PANELS.
 *
 * They were drawn as boxes pinned inside the workspace, and a box inside a
 * window cannot answer the questions the drawing exists to settle: whether two
 * of them stand at once, what one covers, whether the thing behind stays
 * readable, and what happens when you drag one onto a second monitor. The
 * prototype could only ever draw them; the host can open them.
 *
 * ADR 0003: THE OS DRAWS THE FRAME, so `decorations: true` on every one of them
 * — the same rule the settings and diagnostics windows already follow, and the
 * reason none of the three carries the stand-in strip once it is real.
 *
 * THE OVERLAY IS NOT IN THIS FAMILY and must not be made to look like it. It is
 * 440 × 60, `decorations: false`, `focus: false`, because taking focus moves the
 * insert target away from the app being dictated into. Nothing here inserts, so
 * nothing here needs that exception.
 *
 * `alwaysOnTop` IS PER SURFACE. The meeting window floats over a call you are
 * looking at — that is what the drawn caption says, and it is the same reason it
 * has to stay out of a screen share. Ask and Actions sit beside the object they
 * are about and take their turn like any other window.
 *
 * WITHOUT A HOST THIS RETURNS FALSE and the caller draws the in-page pop-out
 * instead. That is not a fallback for its own sake: the gallery is a design-time
 * surface that runs in a browser (ADR 0055), and a button that did nothing there
 * would be the defect this whole pass came to remove.
 */

export type PopoutSurface = "ask" | "actions" | "meeting";

const GEOMETRY: Record<
  PopoutSurface,
  { title: string; width: number; height: number; alwaysOnTop: boolean }
> = {
  /* Every number here is the stylesheet's, read rather than chosen: `.ws-hud`
     is 330 × 560, `.ws-chatwin` 330 × 400, `.ws-actionswin` 520 × 440 because
     it holds a list beside an editor. A window that opened at a size the
     drawing does not have would be measuring something nobody drew. */
  meeting: { title: "WordScript – Meeting", width: 330, height: 560, alwaysOnTop: true },
  ask: { title: "WordScript – Ask", width: 330, height: 400, alwaysOnTop: false },
  actions: { title: "WordScript – Actions", width: 520, height: 440, alwaysOnTop: false },
};

export function hasNativeHost() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Opens the surface as its own window, or reports that it could not.
 *
 * One window per surface: a second call focuses the one that is already open
 * rather than stacking a duplicate, which is what a label does for free.
 */
export async function openPopout(surface: PopoutSurface): Promise<boolean> {
  if (!hasNativeHost()) return false;

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = `popout-${surface}`;

    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return true;
    }

    const { title, width, height, alwaysOnTop } = GEOMETRY[surface];
    const created = new WebviewWindow(label, {
      url: `index.html#/popout/${surface}`,
      title,
      width,
      height,
      resizable: true,
      decorations: true,
      alwaysOnTop,
      /* Not `skipTaskbar`. These are windows a person switches to. */
      visible: true,
    });

    return await new Promise<boolean>((resolve) => {
      created.once("tauri://created", () => resolve(true));
      created.once("tauri://error", () => resolve(false));
    });
  } catch {
    return false;
  }
}
