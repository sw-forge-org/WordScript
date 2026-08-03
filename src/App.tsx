import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import OverlayGallery from "./windows/OverlayGallery";
import RebuildLabWindow from "./windows/RebuildLabWindow";
import SettingsWindow from "./windows/SettingsWindow";

// Lazy so the legacy overlay shell CSS + Tauri-only overlay logic never load on
// the gallery/settings routes. Keeps the gallery free of overlay-window leaks.
const OverlayWindow = lazy(() => import("./windows/OverlayWindow"));

// The component lab is design-time only: it is not linked from any product
// surface, uses no Tauri API, and exists so the settings-rework primitives can
// be built and judged once rather than twice. Lazy so its CSS and canvas work
// never load on a route that ships.
const ComponentLabWindow = lazy(() => import("./windows/ComponentLabWindow"));

export default function App() {
  return (
    <Routes>
      <Route path="/overlay" element={<Suspense fallback={null}><OverlayWindow /></Suspense>} />
      <Route path="/overlay-gallery" element={<OverlayGallery />} />
      <Route path="/rebuild-lab" element={<RebuildLabWindow />} />
      <Route path="/settings" element={<SettingsWindow />} />
      <Route path="/component-lab" element={<Suspense fallback={null}><ComponentLabWindow /></Suspense>} />
      <Route path="*" element={<Navigate to="/overlay" replace />} />
    </Routes>
  );
}
