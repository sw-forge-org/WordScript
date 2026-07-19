# Overlay Mode-Cycling Ghosting — Residual (Folge-Plan)

> **Status:** Schwarzer Blitz ELIMINIERT (A2). Mode-Cycling-Ghosting REDUZIERT
> (27px → ~1px residual) aber NICHT ELIMINIERT. Dieser Handoff dokumentiert
> die 7+ Versuche aus Plan `1784429726777`, die empirischen Live-Diagnose-
> Ergebnisse, und die offene Compositor-Ebene-Diagnose die ein Folge-Plan
> angehen muss.
>
> **Vorgänger-Handoff:** `OVERLAY_MODE_SWITCH_GHOSTING_UNRESOLVED.md` (6
> Versuche, 4 neu identifizierte Ursachen NI1–NI4, 7 nicht evaluierte Ansätze
> A1–A7). Dieser Plan hat A2, A1.i, A3(skip), A4(skip), A5(variant) evaluiert.

## Symptom-Status nach diesem Plan

| Symptom | Vor Plan | Nach Plan | Status |
|---------|---------|----------|--------|
| Schwarzer Blitz beim Mode-Wechsel (Symptom 2) | Da | **Weg** | ✅ Eliminiert (A2, commit d902790) |
| Ghosting bei schnellem Mode-Cycling (Symptom 1) | 27px Variation | ~1px residual am Rand | ⚠️ Reduziert, nicht eliminiert |
| Nicht smooth (Reload/Blitz) | Da | **Weg** | ✅ Eliminiert (A2) |

## Commits in diesem Plan (chronologisch)

1. **`d902790`** — A2: `scheduleReveal` via `queueMicrotask` statt
   `requestAnimationFrame`. Microtask läuft nach React-Commit + Layout-Effects
   aber VOR Browser-Paint → nativer `set_size` im selben Frame → kein
   Backing-Store-Verwurf → kein schwarzer Blitz. **Live bestätigt: eliminiert.**
2. **`200829f`** — A1.i: `transform: scale(0.87)` → `zoom: 0.87` auf
   `.ov-pill-shell`. `zoom` skaliert Layout (nicht visuell) → keine
   Compositor-Layer-Promotion → kein Layer-Caching auf dem Wrapper.
   **Live bestätigt: Ghosting reduziert** (manchmal weg, manchmal da).
3. **`796ad59`** — `min-width: 80px` + `justify-content: center` + `text-align:
   center` auf `.pill__mode` (ModeChip-Button). Stabilisiert die ModeChip-
   Geometrie über Mode-Wechsel. **Live bestätigt: Ghosting reduziert von
   27px auf ~1px**, aber optisch als Workaround erkennbar (Slot zu breit).
4. **`89471c4`** — `key={state.mode}` auf alle 3 ModeChip-Verwendungen +
   `.pill--open { transform: translateZ(0) scale(1); }` entfernt. Zwingt React
   zum Remount des ModeChip pro Mode-Wechsel → Compositor-Layer-Release.
   **Live bestätigt: Ghosting reduziert** aber residual am Rand bleibt.

## Phase 0 — Diagnose-Subagent-Ergebnisse (statisch, Plan-Only)

Drei Subagents validierten isoliert die NI1/NI2/NI3/NI4-Hypothesen.

### Subagent A — NI1 (schwarzer Blitz): **HOCH Konfidenz, BESTÄTIGT**

`scheduleReveal`'s `requestAnimationFrame`-Deferral verschob den nativen
`set_size` auf Frame N+1. React commitete den neuen DOM in Frame N, WebKitGTK
paintete auf den alten Backing-Store, dann rAF in Frame N+1 → `set_size` mit
oszillierter Höhe → Backing-Store-Reallokation → gerade gepainteter Content
verworfen → schwarzer Frame → Repaint.

**Q3 geklärt:** Der 0ms-sleep in `reveal_overlay_window_coalesced`
(`lib.rs:715`) ist ein Tokio-Yield (Mikrosekunden), kein Frame-Delay. A2
braucht keine Rust-Änderung.

**Fix A2:** `queueMicrotask` statt `rAF`. **Live eliminiert.**

### Subagent B — NI3 (Compositor-Layer-Caching): **MITTEL-HOCH, UNVOLLSTÄNDIG**

`transform: scale(0.87)` auf `.ov-pill-shell` promoted diese Box auf eine
eigene Compositor-Layer. Bei Mode-Cycling (kind bleibt "recording",
`key={pillState.kind}` remountet nicht) cached diese Layer.

**Q1 geklärt:** `will-change` ist NICHT in `overlay-pill.css` (nur in
Storybook-Legacy `overlay.css`). Drift auflöst sich zugunsten des Handoffs.

**A5 evaluiert:** `key={mode}` auf `.ov-pill-shell`-Wrapper würde ganzen Subtree
remounten (inkl. Children) → reproduziert Versuch 3's schwarzen Blitz.
**A5 auf Wrapper verworfen.**

**A4 evaluiert:** `set_background_color` mit Alpha-Delta tangiert promoted
Child-Layer nicht (gleicher Fehler wie 2026-06-24). **A4 ausgeschieden.**

**Fix A1.i:** `zoom: 0.87` statt `transform: scale(0.87)`. **Live: Ghosting
reduziert, nicht eliminiert.** Subagent B's Hypothese war unvollständig —
`.ov-pill-shell` war nicht die einzige Layer-Quelle.

### Subagent C — NI2/NI4 (Render-Kaskade): **HOCH Konfidenz, NI2 NICHT REAL**

**Q2 definitiv geklärt:** React's `??`-short-circuit schützt `pillMode` in
Render B. `pillMode = effectiveMode ?? configFallbackMode ?? "auto"`. Sobald
`effectiveMode !== null` (nach `setEffectiveMode(next)` in `handleCycleMode`),
wird `configFallbackMode` NIE ausgewertet. `configFallbackMode` springt 2
Commits später (useMemo-Recompute via `state.config`-Änderung), aber
`pillMode` bleibt `next`. **KEIN Geometrie-Sprung aus dem Render-Pfad.**

**A3 überflüssig — Schritt 2 übersprungen.** Der 150ms-Debounce (Versuch 6)
reduzierte Ghosting weil er `fetchEffectiveMode`-Calls blockte, nicht weil er
NI2 löste. Versuch 6's Diagnose ("multi-render cascade") war falsch.

## Phase 0 — Live-Diagnose (R4, empirisch)

Nachdem die statischen Subagent-Hypothesen unvollständig waren, wurde eine
Live-Diagnose via `/tmp/kilo/overlay-diag.log` durchgeführt (temporäre
`append_diag_log` Tauri-Command, Frontend-Logs via `invoke`).

### Messung 1: Render-Kaskade (32 Taps, ~170ms Abstand)

- **pillMode-Jumps pro Tap: GENAU 1.** Jeder Tap erzeugt exakt einen
  pillMode-Wechsel. KEIN Doppelsprung. Subagent C bestätigt: NI2 nicht real.
- **scheduleReveal pro Tap: GENAU 1 schedule + 1 flush.** D1+A2 koaleszieren
  perfekt. Keine überlappenden Reveals.
- **configFallback springt 2 Commits später, pillMode bleibt stabil.**
  `??`-short-circuit schützt pillMode in jedem Render.

**Fazit:** React rendert korrekt. Das Ghosting kommt NICHT aus dem
Render-Pfad.

### Messung 2: Pill-Breite pro Mode (ohne Fix)

| Mode | shellW (recording, px) |
|------|---------|
| auto | 224 |
| verbatim | 251 |
| cleanup | 245 |
| rewrite | 242 |
| agent | 232 |
| prompt_enhance | 246 |

**27px Breitenvariation** zwischen Modes. Die Pill ist `inline-flex` +
`width: max-content`, passt sich dem ModeChip-Label an. WebKitGTK malt beim
Mode-Wechsel kurz beide Pill-Breiten gleichzeitig → **das ist die Root Cause
des 27px-Ghosting**.

### Messung 3: Nach A1.i (zoom) + ModeChip-Slot-Fix

Pill-Breite konstant (alle Modes gleich breit durch `min-width: 80px` auf
ModeChip). Ghosting reduziert auf ~1px residual am Rand. Das 1px ist
wahrscheinlich Subpixel-Rundung durch `zoom: 0.87` (0.87 × 80 = 69.6px →
WebKitGTK rundet inkonsistent) oder eine Timer-Text-Breitenvariation.

## Was funktioniert hat (echte Fixes)

1. **A2 (queueMicrotask):** Schwarzer Blitz eliminiert. rAF verschob `set_size`
   auf Frame N+1 → Backing-Store-Verwurf nach Paint → schwarzer Frame.
   Microtask läuft vor Paint → `set_size` im selben Frame → kein Verwurf.

2. **A1.i (zoom statt transform):** `.ov-pill-shell` nicht mehr promoted.
   Reduziert Ghosting weil eine Layer-Quelle entfernt ist.

3. **ModeChip-Slot-Fix (min-width:80px + justify-content:center):** Stabilisiert
   ModeChip-Geometrie über Mode-Wechsel. Reduziert Ghosting von 27px auf ~1px.

4. **key={mode} auf ModeChip:** Zwingt Layer-Release pro Mode-Wechsel.
   Reduziert weiter, aber nicht eliminiert.

5. **.pill--open transform entfernt:** `.pill` nicht mehr permanent promoted
   während overlayMotion==="open".

## Was NICHT funktioniert hat

1. **A3 (configFallbackMode entkoppeln):** Überflüssig — NI2 nicht real.
2. **A4 (Alpha-Toggle):** `set_background_color` tangiert promoted Child-Layer
   nicht (gleicher Fehler wie 2026-06-24).
3. **A5 (key auf .ov-pill-shell-Wrapper):** Remountet ganzen Subtree →
   reproduziert Versuch 3's schwarzen Blitz.
4. **A1.iii (will-change entfernen):** No-op — `will-change` bereits entfernt.
5. **min-width auf ganze Pill:** Workaround, sieht scheiße aus (leerer Raum
   rechts, zentrierte Elemente unpassend).
6. **key auf inneren ModeChip-Wrapper:** Ghosting kam zurück — inner-Key
   reicht nicht für Layer-Release.

## Offene Verzweigung: Compositor-Ebene Live-Diagnose

Das ~1px residual am Rand persistiert trotz:
- Geometry-Stabilisierung (min-width:80px auf ModeChip)
- Layer-Release (key={mode} auf ModeChip)
- Layer-Promotion-Vermeidung (zoom statt transform, .pill--open transform weg)

Das deutet darauf hin dass die Ursache **tiefer als CSS/React** liegt — in
WebKitGTK's Compositor selbst. Mögliche Quellen die nicht adressiert sind:

1. **`set_size`-Oszillation (1px):** `OVERLAY_FLAT_REVEAL_TICK` oszilliert die
   Window-Höhe 60↔61px auf jedem flat-Reveal (`lib.rs:569-573`). Das ist ein
   **Backing-Store-Reallokation-Trigger**, kein Compositor-Layer-Invalidierer.
   Bei Mode-Cycling könnte die Oszillation selbst das Ghosting verursachen:
   WebKitGTK malt den neuen DOM auf den alten Backing-Store, dann `set_size`
   oszilliert → Backing-Store realloc → der gerade gepaintete Content wird
   verworfen → für einen Frame ist der Backing-Store leer/transparent → das
   alte Pill-Ghost scheint durch → dann Repaint. Die 1px-Höhenänderung
   verschiebt den Pill vertikal um 0.5px → sichtbar als 1px-Rand-Ghost.

   **Folge-Plan muss prüfen:** Deaktiviere die 1px-Oszillation für same-kind
   Mode-Wechsel (nur bei echten Surface-Wechseln ausführen) und prüfe ob das
   1px-Residual verschwindet.

2. **`zoom: 0.87` Subpixel-Rundung:** `zoom` ist nicht-standardisiert in
   WebKitGTK. 0.87 × 80px = 69.6px → WebKitGTK könnte auf 69px oder 70px runden,
   inkonsistent zwischen Modes → 1px-Variation → Ghosting.

   **Folge-Plan muss prüfen:** Ersetze `zoom: 0.87` durch eine ganzzahlige
   Skalierung (z.B. Font-Size-Anpassung, oder `zoom: 0.875` = 7/8 was
   ganzzahlige Pixel ergibt bei 80px → 70px).

3. **Compositor-Layer-Tree-Inspektion:** DevTools "Layers"-Panel im
   Overlay-Window würde zeigen welche Layer während Mode-Cycling persistieren
   und welche released werden. Ohne diese Inspektion ist jede Hypothese
   spekulativ. Der Overlay ist `decorations: false` + `transparent: true` +
   `focus: false` → DevTools-Zugang schwierig (kein Rechtsklick-Menü).

   **Folge-Plan muss lösen:** DevTools-Zugang zum Overlay-Window. Optionen:
   - `webview.open_devtools()` via Rust-Command (einmalig für Diagnose).
   - Temporär `decorations: true` + `focus: true` in `tauri.conf.json` für
     Diagnose-Sessions.
   - Tauri v2's `WebviewWindow::open_devtools()` API.

## Folge-Plan: Compositor-Ebene Live-Diagnose

### Voraussetzungen
- DevTools-Zugang zum Overlay-Window (siehe oben).
- Playwright-Frame-Trace oder DevTools-Performance-Trace während Mode-Cycling.
- DevTools "Layers"-Panel-Aufzeichnung während Mode-Cycling.

### Schritte
1. DevTools im Overlay öffnen (via `open_devtools()` Rust-Command oder
   temporäre `decorations: true`).
2. "Layers"-Panel aufzeichnen: 10× ModeChip klicken, Layer-Tree beobachten.
   - Welche Layer persistieren? Welche werden released/neu erstellt?
   - Gibt es eine Layer die pro Mode-Wechsel NICHT invalidiert wird?
3. "Performance"-Trace aufzeichnen: 10× ModeChip klicken, Frame-Trace
   analysieren.
   - Wo liegt der 1px-Ghost? Zwischen React-Commit und Paint? Zwischen Paint
     und `set_size`? Zwischen `set_size` und Repaint?
4. Hypothese 1 (set_size-Oszillation) testen: `OVERLAY_FLAT_REVEAL_TICK`
   deaktivieren für same-kind Mode-Wechsel. Prüfen ob 1px-Residual verschwindet.
5. Hypothese 2 (zoom Subpixel) testen: `zoom: 0.87` → `zoom: 0.875` (7/8,
   ganzzahlige Pixel bei 80px). Prüfen ob 1px-Residual verschwindet.
6. Falls beide Hypothesen falsch: Layer-Tree-Inspektion zeigt eine Layer die
   nicht invalidiert wird → gezielter Fix für diese Layer.

### Out of Scope für den Folge-Plan
- Surface-Wechsel-Ghosting (recording→processing-preview) — separate Ursache
  (orphante Child-Layer der Keyframe-Animationen), eigener Folge-Plan.
- A6 (Compositing-Off als Default) — betrifft alle Fenster, nur als letzter
  Ausweg.

## Geänderte Dateien (dieser Plan)

- `src/windows/OverlayWindow.tsx` — `scheduleReveal` via `queueMicrotask`
  (A2), D4-Test-Kommentare aktualisiert.
- `src/styles/overlay-pill.css` — `transform: scale(0.87)` → `zoom: 0.87`
  (A1.i), `.pill--open` transform entfernt, `min-width: 80px` +
  `justify-content: center` + `text-align: center` auf `.pill__mode`.
- `src/components/overlay/OverlayPill.tsx` — `key={state.mode}` auf alle 3
  ModeChip-Verwendungen.
- `src/windows/OverlayWindow.test.tsx` — D4-Test-Kommentare aktualisiert.

## Kontext-Erhalt (für Komprimierung)

- **Task-Ziel:** Mode-Cycling-Ghosting (Symptom 1) + schwarzer Blitz (Symptom 2)
  eliminieren.
- **Erreicht:** Schwarzer Blitz eliminiert (A2). Ghosting reduziert (27px →
  ~1px), nicht eliminiert.
- **Commits:** d902790 (A2), 200829f (A1.i zoom), 796ad59 (ModeChip min-width),
  89471c4 (key+transform).
- **Erkenntnis:** React rendert korrekt (Live-Diagnose: 1 pillMode pro Tap,
  1 scheduleReveal pro Tap). Ghosting ist WebKitGTK-Compositor-Problem
  (Geometry-Change + Layer-Caching), keine React-Render-Kaskade.
- **Offen:** 1px-Residual am Rand. Folge-Plan braucht Compositor-Ebene-
  Live-Diagnose (DevTools Layers-Panel, set_size-Oszillation-Test, zoom-
  Subpixel-Test).