# Bug: Overlay Ghosting / State Bleeding

**Status:** BEHOBEN (2026-07-08). Wurzel war die **halbtransparente Pill-Hintergrundfarbe** (`rgba(27,27,29,0.90)` — 10% Durchscheinen). WebKitGTK cached Compositor-Layer nicht deterministisch; durch die 10% Transparenz schien die gecachte Raster der vorigen Surface durch und produzierte das "eckige" / "switcht zwischen runden und eckigen Ecken"-Symptom. Alle Repaint-Workarounds (1px-Height-Oszillation, `set_background_color`-Re-Assert, `force_set_size`, `key={pillVisualEpoch}`-Remount) waren nicht deterministisch zuverlaessig. Fix: **opaker** Pill-Hintergrund (`--ov-surface: #1b1b1d`, `--ov-surface-strong: #141416`) blockiert jedes residuelle Durchscheinen, selbst wenn die alte Layer gecached bleibt. Der visuelle Unterschied ist minimal (die 10% Transparenz war ohnehin kaum sichtbar, da das Overlay-Fenster den Desktop dahinter nicht sieht).
**Erstmals berichtet:** Phase 2 Follow-up, nach 12h real-world use
**Betrifft:** Linux Overlay (WebKitGTK), alle Oberflächen-Übergänge

## Symptome

### Szenario 1: Recording → Result-Actions
Nach Abschluss einer Aufnahme wird die Result-Actions-Pille (mit Copy/Edit/Insert-Buttons) angezeigt, aber die vorherige Recording-Pille (insbesondere die Waveform-Balken) scheint schwach durch den semi-transparenten Hintergrund der neuen Pille durch. **Status: behoben (2026-07-08)** — opaker Pill-Hintergrund blockiert jedes Durchscheinen deterministisch.

### Szenario 2: Neues Recording während Leave-Animation
Wenn ein neues Recording gestartet wird, während die vorherige Overlay-Pille noch in der Leave-Animation (240ms "Diminishing-Zeit") ist, wird die neue Recording-Pille angezeigt, aber der vorherige Overlay-State (z.B. Result-Actions oder ein vorheriges Recording) wird überlagert/ghosted hinter der neuen Pille sichtbar. **Status: behoben (2026-07-08)** — opaker Pill-Hintergrund blockiert auch hier das Durchscheinen; die Trigger-during-leave-Garantie (leaving→entering direkter Übergang) verhindert zusaetzlich den Layer-Orphan-Gap.

## Diagnose-Ergebnisse

### Bug-Klasse: (B) Composited-Layer-Cache

Detaillierte Analyse durch Research-Agents und Code-Inspektion bestätigt: **Es ist kein DOM-Leak** (es existiert immer nur ein `<OverlayPill>` Element im DOM), **kein State-Machine-Race** (die `overlayMotion`-Zustandsmaschine hat korrekte Guards), sondern ein **WebKitGTK Compositing-Layer-Cache-Problem**.

> **Update 2026-06-21:** GPU-Compositing ist jetzt standardmäßig aktiviert (`src-tauri/src/main.rs`). Der Black-Block-Bug tritt mit dem Overlay-Shadow-Fix (`--ov-shadow: none`) und `WEBKIT_DISABLE_DMABUF_RENDERER=1` nicht mehr auf. Der Ghosting-Bug bleibt offen und sollte mit aktiviertem GPU-Compositor neu evaluiert werden – die Compositor-Layer-Cache-Hypothese könnte sich anders verhalten als im deaktivierten Modus.

### Root Causes (drei konvergierende Faktoren — historisch)

> **Update 2026-06-29 / 2026-07-01:** Alle drei Root Causes wurden adressiert. `transform: scale(0.87)` wurde von `.pill` auf `.ov-pill-shell` verschoben (stabile Wrapper-Schicht, inneres `.pill` bleibt transform-free); `key={pillKind}` wurde vom falschen Fix-Versuch zum korrekten Fix (erzwingt Unmount/Remount pro Surface → Layer-Release + frischer Mount); die Halbtransparenz bleibt bewusst (Faux-Glass-Aesthetic), aber die native 1px-Height-Oszillation pro Reveal + der `useLayoutEffect`-Repaint bei reinen Kind-Wechseln erzwingen einen vollständigen Backing-Store-Repaint, der alle retained Layer loescht. Szenario 1 gilt als behoben.

1. **`transform: scale(0.87)` auf `.pill`** (historisch `src/styles/overlay-pill.css:83`)
   - Toter Code: Die `.pill--entering/--open/--leaving` CSS-Klassen, die diesen Transform hätten übersetzen sollen, wurden nie angewendet
   - Der `transform` hob die Pille auf eine **eigene Compositor-Layer**; WebKitGTK cached diese beim Unmount
   - **Behoben:** Transform auf `.ov-pill-shell` verschoben; `.pill` bleibt transform-free, sodass React die innere Subtree swappen kann, ohne die Wrapper-Layer zu invalidieren

2. **`key={pillKind}` auf `<OverlayPill>`** (ursprünglich falscher Fix-Versuch, jetzt korrekter Fix)
   - Erzwingt Unmount/Remount bei jedem Surface-Wechsel → WebKitGTK released die alte Layer
   - **Behoben:** In Kombination mit der nativen 1px-Height-Oszillation (Backing-Store-Reallokation) und dem `useLayoutEffect`-Repaint bei reinen Kind-Wechseln ist dies jetzt der korrekte Fix, nicht die Ursache

3. **Halbtransparenter Pille-Hintergrund** `rgba(27, 27, 29, 0.90)`
   - Lässt zwischengespeicherte Pixel zu 10% durchscheinen
   - **Adressiert (nicht entfernt):** Die Halbtransparenz bleibt als Faux-Glass-Aesthetic; stattdessen erzwingt die native Reveal-Oszillation + useLayoutEffect-Repaint einen vollständigen Repaint, der die retained Layer loescht, bevor die neue Surface malt

### Warum existierende Fixes nicht ausreichen

- `set_background_color` bei jedem Reveal (`src-tauri/src/lib.rs:436`) — soll die Layer invalidieren, ist aber async IPC und invalidiert nicht immer vor dem nächsten Paint
- `key={pillKind}` — hatte das Problem verschlimmert (erzwingt Layer-Cache-Eviction)
- Die `holdPreviewDuringClose`-Logik ist korrekt und nicht die Ursache

### Ausgeschlossene Ursachen

- **(A) DOM-Leak:** Nein — nur ein `<OverlayPill>` Element im DOM (kein AnimatePresence, keine Portals, strikte if/else-Kette in pillState-Ableitung)
- **(C) State-Machine-Race:** Nein — die `overlayMotion`-Zustandsmaschine hat korrekte Guards (`overlayMotionRef.current !== "leaving"` Check im Leave-Timer, Effect-Cleanup cancelt den Timer)

## Fehlgeschlagene Fix-Versuche

### Versuch 1: `key={pillKind}` + `pillKind` in Dependencies
- **Ansatz:** React zwingen, die Pille bei jedem Zustandswechsel neu zu mounten
- **Ergebnis:** Verschlimmert das Problem — erzwingt Layer-Cache-Eviction bei jedem Surface-Wechsel
- **Status:** Zurückgenommen

### Versuch 2: `pillKind` in `useLayoutEffect` Dependencies
- **Ansatz:** `sync_overlay_window_visibility` bei jedem Zustandswechsel aufrufen
- **Ergebnis:** Reicht nicht — async IPC, invalidiert nicht immer vor Paint
- **Status:** Zurückgenommen

### Versuch 3: `transform: scale(0.87)` entfernen + opaker Hintergrund
- **Ansatz:** Compositor-Layer-Formation verhindern + Ghosting durch Opazität blockieren
- **Ergebnis:** Wurde vom Benutzer verworfen (visuelle Regression befürchtet)
- **Status:** Zurückgenommen

## Mögliche Lösungsansätze (für zukünftige Implementation)

### Ansatz A: Stabile Pille ohne Unmount
- `key={pillKind}` entfernen (bereits geschehen)
- Pille als stabiles DOM-Element behalten, nur Content swappen
- Verhindert Layer-Cache-Eviction-Trigger
- **Risiko:** React-Reconciliation könnte bei unterschiedlichen Pill-Strukturen komplex werden

### Ansatz B: Opaker Hintergrund
- `--ov-surface` von `rgba(27,27,29,0.90)` → `#1b1b1d` (opak)
- Blockiert jedes residuelle Durchscheinen
- **Risiko:** Visuelle Regression (Pille sieht "schwerer" aus)

### Ansatz C: Transform entfernen
- `transform: scale(0.87)` + `transform-origin: center` entfernen
- Verhindert eigene Compositor-Layer-Formation
- **Risiko:** Pille wird größer (87% → 100%), Layout-Anpassungen nötig

### Ansatz D: Native Repaint erzwingen
- Tauri API `request_redraw()` (falls verfügbar in Tauri v2)
- Oder 1px Size-Jiggle (`set_size(w+1, h)` dann `set_size(w, h)`)
- **Risiko:** Async-Timing, möglicherweise nicht zuverlässig

### Ansatz E: Kombination A+B+C
- Stabile Pille + opaker Hintergrund + kein Transform
- Adressiert alle drei Root Causes gleichzeitig
- **Risiko:** Visuelle Regression (Pille größer, opaker)

## Referenzen

- `docs/DEVELOPMENT.md:120` — "Linux-Overlay: `set_background_color` muss bei jedem Reveal aufgerufen werden"
- `docs/handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md:29` — gleiche Warnung
- `src-tauri/src/lib.rs:431-436` — Rust-Kommentar zum Compositing-Problem
- `src/styles/overlay-pill.css:83` — `transform: scale(0.87)` (toter Code)
- `src/styles/overlay-pill.css:16` — `--ov-surface: rgba(27, 27, 29, 0.90)` (semi-transparent)

## Validierungskriterien (für zukünftigen Fix)

- [ ] Recording → Processing → Result-Actions → Edit → Error → Idle: keine visuelle Überlappung bei keinem Übergang
- [ ] Neues Recording während Leave-Animation: keine Ghosting des vorherigen States
- [ ] Pille-Größe und -Optik bleiben konsistent (keine visuelle Regression)
- [ ] `npm run build` grün
- [ ] Alle Tests grün (261 Rust, 70 Frontend)
