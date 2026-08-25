import { createContext, useContext, type ReactNode } from "react";
import { previewVisible, type PreviewId } from "./previewSurfaces";

/**
 * WHETHER THIS WINDOW SHOWS WHAT IS DRAWN AND NOT BUILT.
 *
 * A context rather than a prop, because the alternative is threading one
 * boolean through every screen to reach a chip four levels down — and a prop
 * that fifteen components pass and two read is a prop somebody forgets on the
 * sixteenth. The default is FALSE, so a surface mounted somewhere nobody
 * thought about shows the honest thing rather than the drawing.
 *
 * THE GALLERY PROVIDES TRUE AND ALWAYS WILL. It is the acceptance surface for
 * drawn screens (ADR 0055) and must keep seeing every one of them whatever the
 * config says. That is one line at its root rather than a special case in each
 * marker, which is the whole reason this is a context.
 */
const DeveloperMode = createContext(false);

export function DeveloperModeProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return <DeveloperMode.Provider value={value}>{children}</DeveloperMode.Provider>;
}

export function useDeveloperMode(): boolean {
  return useContext(DeveloperMode);
}

/**
 * Whether to render the thing this id marks at all.
 *
 * The `remove` kind is unmounted with Developer Mode off — a control that does
 * nothing is worse than one that says so — and the `unmark` kind stays, because
 * it works and only its chip was ever the preview.
 */
export function usePreviewVisible(id: PreviewId): boolean {
  return previewVisible(id, useDeveloperMode());
}
