import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RebuildLabWindow from "./windows/RebuildLabWindow";
import SettingsWindow from "./windows/SettingsWindow";

// Lazy so the legacy overlay shell CSS + Tauri-only overlay logic never load on
// the gallery/settings routes. Keeps the gallery free of overlay-window leaks.
const OverlayWindow = lazy(() => import("./windows/OverlayWindow"));

// The gallery is the acceptance surface for the settings-rework port (ADR
// 0055): one design-time route, in the bundle, using no Tauri API and linked
// from no product surface — the terms `/component-lab` already shipped under.
// It folds in `/overlay-gallery` and `/component-lab`, which are retired rather
// than aliased: under ADR 0054 a replaced surface is deleted in the commit that
// replaces it. Lazy so its CSS, its canvas work and the overlay stylesheet it
// pulls in never load on a route that ships.
const GalleryWindow = lazy(() => import("./windows/GalleryWindow"));

export default function App() {
  return (
    <Routes>
      <Route path="/overlay" element={<Suspense fallback={null}><OverlayWindow /></Suspense>} />
      <Route path="/rebuild-lab" element={<RebuildLabWindow />} />
      <Route path="/settings" element={<SettingsWindow />} />
      <Route path="/gallery" element={<Suspense fallback={null}><GalleryWindow /></Suspense>} />
      <Route path="*" element={<Navigate to="/overlay" replace />} />
    </Routes>
  );
}
