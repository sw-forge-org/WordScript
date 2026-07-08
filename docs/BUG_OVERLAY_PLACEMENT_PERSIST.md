# Bug: Overlay Placement — Remember Last Drag Position funktioniert nicht

**Status:** BEHOBEN (2026-07-08). Drei Wurzeln, alle plattformunabhaengig (auf CachyOS KDE Plasma XWayland bestaetigt, muss auf Windows/macOS identisch sein):
1. **K1 — Persist-Debounce beendete Drag-Session zu frueh** (`OverlayWindow.tsx`): Der 180ms-Persist-Debounce setzte `dragSessionActiveRef` nach dem ersten Persist auf `false` → alle weiteren `onMoved`-Events waehrend desselben Drags wurden verworfen → nur eine Zwischenposition wurde gespeichert.
2. **K2 — Reveal-Grace-Suppression verwarf schnelle Drags** (`OverlayWindow.tsx`): Die 420ms-Suppression nach Reveal verwarf `onMoved`-Events auch bei gesetztem `dragIntentRef` → schnelle Drags nach Reveal wurden nie persistiert.
3. **K3 — `set_position` vor `show()` wurde von GTK/XWayland verworfen** (`lib.rs`): `window.set_position()` auf einem hidden-Fenster wurde von `gtk_widget_show` restauriert → das Overlay erschien an der alten/offscreen-Park-Position statt an der gespeicherten Drag-Position. Zusaetzlich ein Race zwischen dem Rust-Trigger (`apply_trigger_effect` → `reveal_overlay_window`) und dem Frontend-Sync (`sync_overlay_window_visibility`), bei dem beide `was_visible=false` lasen und beide `set_position`+`show()` aufriefen.

**Erstmals berichtet:** 2026-07-08 (Nutzer-Beobachtung auf CachyOS KDE Plasma Wayland/X11)
**Behoben in:** `src/windows/OverlayWindow.tsx` (K1+K2), `src-tauri/src/lib.rs` (K3)

## Symptom

Der Nutzer zieht das Overlay an eine neue Position, startet eine neue Diktation, aber das Overlay erscheint nicht an der gezogenen Position — sondern inkonsistent mal an der alten Position, mal "unten rechts" (Default-Anker), mal gar nicht.

## Wurzeln

### K1 — Persist-Debounce beendete Drag-Session zu frueh

`OverlayWindow.tsx` `onMoved`-Handler: Der 180ms-Debounce persistierte die Position und setzte dann `dragSessionActiveRef.current = false`. Der Guard am Anfang des Handlers verwirft alle Events, wenn die Session inaktiv ist. Konsequenz: nach dem ersten 180ms-Debounce waehrend eines laengeren Drags wurden alle weiteren `onMoved`-Events verworfen — nur eine fruehe Zwischenposition wurde gespeichert.

**Fix:** Der Persist-Debounce setzt `dragSessionActiveRef` nicht mehr auf `false`. Die Drag-Session wird ausschliesslich durch `clearDragIntent` (pointerup/pointercancel/blur) plus den 2000ms-Grace-Timeout beendet.

### K2 — Reveal-Grace-Suppression verwarf schnelle Drags

`OverlayWindow.tsx`: Bei jedem `isActive`-Wechsel zu true wird `suppressMovedPersistenceUntilRef = Date.now() + 420` gesetzt. Der `onMoved`-Handler verwarf Events innerhalb dieser 420ms — auch wenn bereits ein Drag-Intent (`dragIntentRef`) gesetzt war.

**Fix:** Die 420ms-Check greift nur, wenn `!dragIntentRef.current` (kein aktiver Drag-Intent). Ein aktiver Nutzer-Drag hat Vorrang vor der Reveal-Suppression.

### K3 — `set_position` vor `show()` verworfen + Reveal-Race

`lib.rs` `reveal_overlay_window`: `window.set_position(position)` wurde auf dem hidden-Fenster aufgerufen, dann `window.show()`. Auf XWayland/GTK restauriert `gtk_widget_show` das Fenster an seine pre-hide Position (die offscreen Park-Position) und verwirft das `set_position`. Der Windows-Fix (`#[cfg(target_os = "windows")] let _ = window.set_position(position);` nach `show()`) galt nicht fuer Linux.

Zusaetzlich: der Rust-Trigger (`apply_trigger_effect` → `reveal_overlay_window`, sync) und der Frontend-Sync (`sync_overlay_window_visibility` → `reveal_overlay_window`, async) konkurrierten. Beide lasen `was_visible=false` (Race), beide rufen `set_position`+`show()` auf, der zweite `show()` verwirft die Position des ersten.

**Fix (1):** `set_position` wird auf **allen** Plattformen nach `show()` erneut aufgerufen (nicht nur Windows). **Fix (2):** `OVERLAY_WINDOW_SHOWN` wird sofort nach dem `was_visible`-Load auf `true` gesetzt (am Anfang des `if !was_visible`-Blocks), bevor `set_position`/`show()` ausgefuehrt werden — so sieht ein konkurrierender Aufruf `was_visible=true` und skippt.

## Ausschluss durch Doku + Code-Walk

- **A1 — Lock-Race in `remember_overlay_manual_position`:** Die Luecke zwischen `load_from_disk` und `save_config` ist real, betrifft aber nur gleichzeitige Schreiber. Nebenkandidat, nicht die Hauptwurzel. Die config.json zeigte korrekt gespeicherte Positionen — die Persistenz funktionierte, die Anwendung beim Reveal (K3) war das Problem.
- **A2 — `OVERLAY_WINDOW_SHOWN` out-of-sync:** Behoben (`park_overlay_window` ruft `hide()` auf). Kein Out-of-sync-Pfad gefunden.
- **A3 — Manual-Reveal-Pfad:** `overlay_target_position` liest `overlay_manual_x/y` korrekt und clamppt. Korrekt — das Problem war nicht die Berechnung, sondern die Anwendung (`set_position` wurde von `show()` verworfen).
- **A4 — Settings-Mode-Persistenz:** `save_config` unter File-Lock. Korrekt.
- **A5 — Preset-Subtree-Anzeige:** Nur Anzeigefehler, kein Persistenzfehler.
- **A6 — Ghosting:** Visuelle Render-Luecke (`BUG_OVERLAY_GHOSTING.md`), unabhaengig, bereits behoben.

## Tests

- `persists the final position after multiple onMoved events during one drag, not an intermediate one (K1)` — Drag mit zwei `onMoved`-Events, zweite Position wird persistiert.
- `persists onMoved events during a drag started within the reveal grace window (K2)` — Drag innerhalb 420ms nach Reveal.
- Beide in `src/windows/OverlayWindow.test.tsx`. 69 Frontend-Tests gesamt gruen, 284 Rust-Tests gruen, `npm run build` ok.
- K3 (Rust-Reveal-Logik) wurde manuell auf CachyOS KDE Plasma XWayland verifiziert.

## Referenzen

- `src/windows/OverlayWindow.tsx:310-355` — `onMoved`-Handler, K1-Fix
- `src/windows/OverlayWindow.tsx:312-328` — K2-Fix (`!dragIntentRef.current`)
- `src/windows/OverlayWindow.tsx:391-418` — `clearDragIntent`, 2000ms-Grace-Timeout
- `src-tauri/src/lib.rs:566-582` — K3-Fix: `OVERLAY_WINDOW_SHOWN` sofort setzen + `set_position` nach `show()` auf allen Plattformen
- `src-tauri/src/lib.rs:586-602` — `park_overlay_window`, `hide()` + `OVERLAY_WINDOW_SHOWN=false`
- `src-tauri/src/lib.rs:729` — Rust-Trigger `reveal_overlay_window` (Race-Partner)
- `src-tauri/src/lib.rs:1790-1817` — `remember_overlay_manual_position`
- `docs/handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md` — geloester "Overlay verschwindet"-Bug
- `docs/BUG_OVERLAY_GHOSTING.md` — visuelle Ghosting-Luecke (unabhaengig)
- `CHANGELOG.md:246,249,251,252,253` — Drag-Persistenz-Contract