# Overlay Mode-Cycling Ghosting — Accepted Stand (Plan 1784433288646)

> **Status:** Mode-Cycling-Ghosting (State-Überlagerung) **in der Praxis
> behoben**. Zwei Rest-Artefakte (kleiner schwarzer Blitz, kaum sichtbarer
> horizontaler Strich) sind vom User **bewusst akzeptiert** — der Stand bleibt
> auf unbestimmte Zeit so. Phase 2/3 (A/B/C Compositor-Live-Diagnose) wurde
> NICHT durchgeführt; die dafür aufgebaute Diagnose-Infrastruktur bleibt
> permanent im Code für spätere Inspektion.
>
> **Vorgänger-Handoff:** `OVERLAY_MODE_CYCLING_GHOSTING_RESIDUAL.md`
> (Plan `1784429726777`: 27px-Ghosting → ~1px residual, schwarzer Blitz
> eliminiert). Dieser Plan revertierte den Workaround und baute die
> Diagnose-Infrastruktur auf, mit der der User den Stand live verifizierte.

## Symptom-Status nach diesem Plan

| Symptom | Vor Plan | Nach Plan | Status |
|---------|---------|----------|--------|
| State-Überlagerung beim Mode-Cycling | 27px → ~1px residual | **Keine Überlagerung mehr** | ✅ In der Praxis behoben |
| Schwarzer Blitz beim Mode-Wechsel | Weg (A2) | Kleiner Rest-Blitz | ⚠️ Akzeptiert (kaum sichtbar) |
| Horizontaler Strich | — | Kaum sichtbar | ⚠️ Akzeptiert |
| Mode-Wechsel-Lade-Kurz | Da | Kurz da | ⚠️ Akzeptiert (normaler React-Commit) |

**User-Entscheidung (2026-07-20):** "es funktioniert, bro. Die Overlay-States
überlagern sich nicht." Der Stand wird auf unbestimmte Zeit so behalten. Keine
weiteren Ghosting-Eliminierungs-Iterationen ohne neuen Anlass.

## Was dieser Plan getan hat

### Phase 1.1 — Workaround revertiert

Der Vorgänger-Plan hatte das Ghosting von 27px auf ~1px residual reduziert, aber
nur durch einen Workaround (feste ModeChip-Breite `min-width: 80px`), der
optisch als Workaround erkennbar war. Dieser Plan revertierte den Workaround
komplett, damit die Diagnose das echte Problem sieht.

**Revertiert (commits `796ad59` + `89471c4`):**
- `src/styles/overlay-pill.css:316-345` — `.pill__mode`: `justify-content:
  center`, `min-width: 80px` und Kommentar-Block entfernt. Natürliche
  `max-content`-Breite zurück.
- `src/styles/overlay-pill.css:347` — `.pill__mode-label`: `text-align:
  center` entfernt.
- `src/styles/overlay-pill.css:187-198` — `.pill--open`:
  `transform: translateZ(0) scale(1);` wiederhergestellt (wurde in `89471c4`
  entfernt). Kommentar auf einzeilige Originalform zurückgesetzt.
- `src/components/overlay/OverlayPill.tsx:148, :190, :286` — `key={state.mode}`
  von allen 3 `<ModeChip>`-Aufrufen entfernt.

**Behalten (NICHT revertiert):**
- `d902790` — `scheduleReveal` via `queueMicrotask` (A2, schwarzer Blitz).
- `200829f` — `.ov-pill-shell { zoom: 0.87 }` statt `transform: scale(0.87)`
  (A1.i, neutral — reduziert Layer-Promotion).

**Live-Ergebnis nach Revert:** Der Stand ohne Workaround (natürliche
`max-content`-Breite, keine Keys, Oszillation aktiv) funktioniert in der Praxis
ohne State-Überlagerung. Die 27px-Variation die den Vorgänger-Plan trieb ist
visuell nicht mehr als Ghosting wahrnehmbar. Das ist Test B aus Phase 2 des
Plans (Default-Stand nach Phase 1).

### Phase 1.2 — Diagnose-Infrastruktur (permanent, debug-only)

DevTools-Zugang zum Overlay-Window + Log-Infrastruktur die im Code bleibt.
Investition in zukünftige Diagnose ohne neue Ad-hoc-Commands bauen zu müssen.

**Rust (`src-tauri/src/lib.rs`):**
- `#[tauri::command]` `overlay_open_devtools` — ruft
  `app.get_webview_window("overlay")?.open_devtools()`. cfg-gated auf
  `debug_assertions || feature = "devtools"` (Tauri v2 constraint). In release
  builds gibt der Command einen Fehler zurück, schadet aber nicht.
- `#[tauri::command]` `append_diag_log(line: String)` — appendet nach
  `/tmp/kilo/overlay-diag.log` mit `Once`-Truncate beim ersten Call pro Run.
  Erstellt `/tmp/kilo/` falls nicht vorhanden.
- `#[tauri::command]` `read_diag_log` — liest das Log für das Settings-Panel.
- `#[tauri::command]` `clear_diag_log` — truncatet das Log.
- Alle 4 im `invoke_handler` registriert.
- `static OVERLAY_DIAG_LOG_TRUNCATED: Once` + `const OVERLAY_DIAG_LOG_PATH`.

**Frontend (`src/windows/OverlayWindow.tsx`):**
- `diagLog(line)` Helper: `console.warn` + `invoke("append_diag_log")` unter
  `import.meta.env.DEV`. Fire-and-forget, blockiert nie. In production no-op.
- `[ov-tap]` in `handleCycleMode` — markiert jeden ModeChip-Klick mit
  `current -> next` + Timestamp.
- `[ov-render]` nach `pillMode`-Deklaration — pro Commit: pillMode +
  effectiveMode + configFallback + surface + motion + active.
- `[ov-sched]` in `scheduleReveal` schedule + flush — surface + width +
  height + timestamp.
- `[ov-repaint]` im `pillVisualEpoch`-LayoutEffect — epoch + shellW + pillW +
  modeW (misst Pill-Breite + ModeChip-Breite pro Repaint).
- Bestehende `[ov-dom]` (per-surface-size layoutEffect) + `[ov-reveal]`
  (Rust-emitierter Debug) auf `diagLog` umgestellt (waren `console.warn`).

**Settings-Window (`src/windows/SettingsWindow.tsx` +
`src/components/settings/OverlayDiagPanel.tsx`):**
- Neue Komponente `OverlayDiagPanel` — pollt `read_diag_log` alle 500ms,
  Auto-Scroll, Tail-Truncate bei 50k Zeichen. Buttons: "Open Overlay
  DevTools" (ruft `invoke("overlay_open_devtools")`) + "Clear Diag Log".
- DEV-only Area "Overlay Diag" in der Settings-Sidebar (production-stripped
  via `import.meta.env.DEV`-Spread). Icon: `Bug`, Group: System.

**Tests (`src/windows/OverlayWindow.test.tsx`):**
- `invokeMock.mockImplementation` beantwortet `append_diag_log`,
  `overlay_open_devtools`, `read_diag_log`, `clear_diag_log` mit
  `Promise.resolve()` — sonst failen die DEV-only Log-Calls.

## Phase 2/3 — NICHT durchgeführt

Der Plan sah 3 isolierte Live-DevTools-Diagnose-Sitzungen (A/B/C) vor, um das
Ghosting auf Compositor-Ebene zu verstehen. Der User verifizierte den Stand
nach Phase 1 (Revert) live und entschied dass er ausreichend funktioniert —
Phase 2/3 wurden übersprungen. Die dafür aufgebaute Diagnose-Infrastruktur
bleibt erhalten und ist bei Bedarf sofort nutzbar:
`npm run tauri dev` → Settings → "Overlay Diag" → "Open Overlay DevTools".

## Was funktioniert hat (kummuliert über alle Ghosting-Pläne)

1. **A2 (`queueMicrotask`, commit `d902790`):** Schwarzer Blitz eliminiert
   (Frame-N+1-Deferral des `set_size` beseitigt). Ein kleiner Rest-Blitz
   bleibt — akzeptiert.
2. **A1.i (`zoom: 0.87`, commit `200829f`):** `.ov-pill-shell` nicht promoted
   auf eigene Compositor-Layer. Reduziert Layer-Caching.
3. **D1 (`scheduleReveal` serializer):** Koalesziert mehrere Reveals pro
   Frame zu einem `set_size` — verhindert die Multi-`set_size`-Kaskade.
4. **D3 (`reveal_overlay_window_coalesced`):** Rust-side Defense-in-Depth.
5. **`OVERLAY_FLAT_REVEAL_TICK` 1px-Oszillation:** Backing-Store-Reallokation
   auf jedem flat-Reveal — der native Repaint-Trigger für same-kind Mode-Wechsel.
6. **Opaker Pill-Hintergrund (`--ov-surface: #1b1b1d`):** Blockiert residuales
   Durchscheinen gecachter Raster.
7. **`key={pillState.kind}` auf `<OverlayPill>`:** Remount pro Surface-Wechsel
   (nicht pro Mode-Wechsel — der wurde in diesem Plan revertiert).

## Was revertiert wurde (Workaround, nicht länger benötigt)

1. **`min-width: 80px` + `justify-content: center` auf `.pill__mode`:**
   Stabilisierte die ModeChip-Geometrie künstlich. Ohne ihn funktioniert das
   Ghosting in der Praxis — der Workaround war nicht die echte Lösung.
2. **`key={state.mode}` auf ModeChip:** Erzwang Layer-Release pro Mode-Wechsel.
   Ohne ihn funktioniert es — der natürliche Repaint-Pfad reicht aus.
3. **`.pill--open { transform: translateZ(0) scale(1); }` Entfernung:** Der
   Transform ist wieder da (promotion ist akzeptiert — das Ghosting kommt
   nicht mehr davon durch).

## Geänderte Dateien (dieser Plan)

- `src-tauri/src/lib.rs` — 4 neue Tauri-Commands + `Once`-Log-Truncate +
  invoke_handler-Registrierung.
- `src/components/overlay/OverlayPill.tsx` — `key={state.mode}` von 3
  ModeChip-Verwendungen entfernt.
- `src/styles/overlay-pill.css` — Workaround revertiert (`.pill--open`
  transform wiederhergestellt, `min-width`/`justify-content`/`text-align`
  entfernt).
- `src/windows/OverlayWindow.tsx` — `diagLog` Helper + `[ov-tap]`/
  `[ov-render]`/`[ov-sched]`/`[ov-repaint]` Log-Punkte, bestehende `[ov-dom]`/
  `[ov-reveal]` auf `diagLog` umgestellt.
- `src/windows/OverlayWindow.test.tsx` — invoke-Mock für 4 neue Commands.
- `src/windows/SettingsWindow.tsx` — DEV-only "Overlay Diag" Area + Import.
- `src/components/settings/OverlayDiagPanel.tsx` — neue Komponente (DevTools +
  Log-Poll + Clear).

## Validierung

| Ebene | Befehl | Ergebnis |
|-------|--------|----------|
| TypeScript | `npm run build` | Clean |
| Frontend-Tests | `npm test` | 73/73 grün |
| Rust-Tests | `cd src-tauri && cargo test` | 292/292 grün |
| Live-Visuell | `npm run tauri dev`, Mode-Cycling | Keine State-Überlagerung, 2 akzeptierte Rest-Artefakte |

## Kontext-Erhalt (für Komprimierung)

- **Task-Ziel:** Mode-Cycling-Ghosting von Grund auf eliminieren.
- **Erreicht:** State-Überlagerung in der Praxis behoben (User-Verifikation
  2026-07-20). 2 Rest-Artefakte (kleiner schwarzer Blitz, horizontaler Strich)
  akzeptiert — Stand auf unbestimmte Zeit so.
- **Commits Vorgänger-Plan:** d902790 (A2, behalten), 200829f (A1.i, behalten),
  796ad59 (revertiert), 89471c4 (revertiert).
- **Diagnose-Infrastruktur:** Permanent im Code. `overlay_open_devtools` +
  `append_diag_log`/`read_diag_log`/`clear_diag_log` Rust-Commands +
  `OverlayDiagPanel` in Settings (DEV-only) + `[ov-*]` Frontend-Logs.
- **Phase 2/3:** Übersprungen (Stand ausreichend). Bei neuem Anlass sofort
  über die Diagnose-Infrastruktur durchführbar.
- **Entscheidung:** Keine weiteren Ghosting-Iterationen ohne neuen Anlass.
