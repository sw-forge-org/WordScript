import type { ReactElement } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { DeveloperModeProvider } from "@/lib/developerMode";

/**
 * RENDER AS A READER WHO ASKED TO SEE THE DRAWINGS.
 *
 * A case about a preview surface — a withheld lane, a drawn retention rule, the
 * calendar's unbuilt origins — is a case about what Developer Mode shows. With
 * the switch off those things are ABSENT rather than unmarked, which is the
 * whole point of the switch, so asserting on them from a default render would
 * be asserting the switch is broken.
 *
 * The default-off behaviour is held where it belongs: on the filter itself
 * (`previewSurfaces.test.ts`) and on the nav that spends it
 * (`WorkspaceWindow.test.tsx`), not once per screen.
 */
export function renderInDeveloperMode(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => <DeveloperModeProvider value={true}>{children}</DeveloperModeProvider>,
  });
}
