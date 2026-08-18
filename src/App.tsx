import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import EditingContextMenu from "./components/EditingContextMenu";
import RebuildLabWindow from "./windows/RebuildLabWindow";
import WorkspaceWindow from "./windows/WorkspaceWindow";

// Lazy so the legacy overlay shell CSS + Tauri-only overlay logic never load on
// the gallery/workspace routes. Keeps the gallery free of overlay-window leaks.
const OverlayWindow = lazy(() => import("./windows/OverlayWindow"));

// The gallery is the acceptance surface for the settings-rework port (ADR
// 0055): one design-time route, in the bundle, using no Tauri API and linked
// from no product surface — the terms `/component-lab` already shipped under.
// It folds in `/overlay-gallery` and `/component-lab`, which are retired rather
// than aliased: under ADR 0054 a replaced surface is deleted in the commit that
// replaces it. Lazy so its CSS, its canvas work and the overlay stylesheet it
// pulls in never load on a route that ships.
const GalleryWindow = lazy(() => import("./windows/GalleryWindow"));

// Ask, Actions and the meeting HUD as their own OS windows rather than boxes
// pinned inside the workspace. Created at runtime by `openPopout`, so this route
// is reached only by a window that already exists; lazy for the same reason the
// two above are.
const PopoutWindow = lazy(() => import("./windows/PopoutWindow"));

/**
 * `/settings` IS THE WORKSPACE NOW, and the path stays because `tauri.conf.json`
 * pins it and `src-tauri/` is out of scope until Leg 5 (rule 6). The window it
 * opens is no longer the settings window — settings is a sheet inside it. The
 * window's label and its title `WordScript – Settings` are owed to whichever leg
 * opens that file; both now name the wrong thing.
 */
export default function App() {
  return (
    <>
      <GalleryDoor />
      <EditingContextMenu />
      <Routes>
        <Route path="/overlay" element={<Suspense fallback={null}><OverlayWindow /></Suspense>} />
        <Route path="/rebuild-lab" element={<RebuildLabWindow />} />
        <Route path="/settings" element={<WorkspaceWindow />} />
        <Route path="/gallery" element={<Suspense fallback={null}><GalleryWindow /></Suspense>} />
        <Route path="/popout/:surface" element={<Suspense fallback={null}><PopoutWindow /></Suspense>} />
        <Route path="*" element={<Navigate to="/overlay" replace />} />
      </Routes>
    </>
  );
}

/**
 * THE GALLERY'S DOOR IN THE NATIVE HOST — ADR 0059.
 *
 * Four legs owed this and each paid the same way: hoist whatever you needed to
 * see to the top of a screen, point `/settings` at the gallery, run a full
 * `npm run tauri build`, look, revert. ADR 0055 assumed one build and a walk
 * would do it, which was wrong for a reason nobody had checked — every window's
 * URL is pinned in `tauri.conf.json`, no window opens `#/gallery`, and that file
 * is out of scope until Leg 5.
 *
 * A CHORD IS NOT A LINK. ADR 0055's terms hold: nothing on any surface names
 * this, nothing announces it, and no affordance leads to it. It is the hoist,
 * costing five lines instead of twenty minutes of cargo — and it goes when the
 * gallery gets a window of its own.
 */
function GalleryDoor() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyG" || !event.shiftKey || !event.altKey) return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      navigate("/gallery");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  return null;
}
