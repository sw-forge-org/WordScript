# Handoff: Overlay-Ghosting bei Mode-Wechsel — UNGELÖST

> Status (2026-07-19): **UNGELÖST.** Sechs Fix-Versuche (Commits `08a4ea6`–`720bfa6`) haben das Problem reduziert aber nicht eliminiert. Das Ghosting tritt weiterhin auf, besonders bei schnellem Mode-Cycling (~0,05–0,06 s Abstand). Zusätzlich gibt es einen **schwarzen Blitz** (Remount-Flash) beim Mode-Wechsel. Diese Datei dokumentiert den vollständigen Untersuchungsstand, alle Versuche mit Ergebnis, die verbleibende Symptomatik und die noch nicht evaluierten Ansätze.

## Symptom

Beim Wechseln des Processing-Mode (Tap auf ModeChip oder Per-Mode-Hotkey)
**während einer aktiven Recording-Session** überlagern intermittierend zwei
Overlay-States einander: für einen kurzen Moment (~1 Frame) sind zwei
Pill-Geometrien gleichzeitig sichtbar. Bei schnellem wiederholtem
Mode-Cycling (Abstand < 0,1 s) ist das zuverlässig reproduzierbar.

Zusätzliches Symptom (eingeführt durch Fix-Versuch 3, siehe unten): Beim
Mode-Wechsel gibt es einen **schwarzen Blitz** — für einen Frame ist das
Pill kurz leer/schwarz, bevor der neue Content malt. Das Overlay "reloaded"
sichtbar.

## Bisherige Annahme / Plan

Der Originalplan (`.kilo/plans/1784412908352-overlay-mode-switch-ghosting-fix.md`)
diagnostizierte drei konvergierende Ursachen:

- **RC1:** Drei konkurrierende `sync_overlay_window_visibility`-Quellen im
  Frontend (isActive-Effekt, Per-Surface-Size-layoutEffect,
  pillVisualEpoch-Repaint-layoutEffect) feuern jeweils eigene native Reveals
  mit unterschiedlichen `OVERLAY_FLAT_REVEAL_TICK`-Werten → 2–3 `set_size`
  mit Höhen 60 und 61 im selben Frame → WebKitGTK wendet sie in beliebiger
  Reihenfolge an.
- **RC2:** Asynchroner `fetchEffectiveMode`-Roundtrip lässt `pillMode` für
  1–3 Renders stale → `pillVisualEpoch` ändert sich nicht im Trigger-Frame →
  Repaint-layoutEffect feuert nicht → Ghosting.
- **RC3:** `reveal_overlay_window` hat keine Koadunations-Sperre → jeder
  Reveal-Call = ein `set_size`.

Die Fix-Designs D1–D5 setzten an diesen drei Ursachen an. **Alle wurden
implementiert, das Problem persistiert.** Die RC-Diagnose war unvollständig
oder falsch — siehe "Verbleibende Symptomatik" und "Neu identifizierte
Ursachen" unten.

## Versuchs-Chronologie (Commits `08a4ea6` bis `720bfa6`)

### Versuch 1 — `08a4ea6`: D1–D5 aus dem Originalplan

**Was gemacht wurde:**
- **D1 (Frontend):** `scheduleReveal`-Dispatcher mit `requestAnimationFrame`-
  Koadunierung. Alle drei `sync_overlay_window_visibility` `visible:true`-
  Quellen routen durch einen einzigen Dispatcher (latest surface + width/height
  wins per frame). `visible:false` (Park) bleibt direkt.
- **D2 (Frontend):** Eager `setEffectiveMode(next)` in `handleCycleMode` und
  dem `wordscript-mode-select`-Listener, sodass `pillMode`/`pillVisualEpoch`
  im selben Render wie der Click aktualisiert werden. `wordscript-mode-event`-
  Listener bleibt async.
- **D3 (Rust):** `OVERLAY_PENDING_REVEAL` (Mutex, last-write-wins) +
  `OVERLAY_REVEAL_SCHEDULED` (AtomicBool-Gate). `reveal_overlay_window` in
  `reveal_overlay_window` (direkt, für StartCapture) und
  `reveal_overlay_window_coalesced` (für `sync_overlay_window_visibility`,
  0-ms-Sleep-Yield) gespalten. Tick-Inkrement auf `!was_visible` beschränkt.
- **D4 (Frontend-Tests):** 4 neue Tests + bestehende Assertions angepasst.
- **D5 (Rust-Test):** Tick-Decision-Logic extrahiert als
  `should_oscillate_flat_reveal`, Test für Koadunations-State-Machine.

**Ergebnis: UNGELÖST.** Das Ghosting trat weiterhin auf. Der Versuch,
die Tick-Oszillation auf `!was_visible` zu beschränkt (nur erster Reveal
einer Session), war **falsch** — siehe Versuch 2.

### Versuch 2 — `ed2f22a`: Tick-Oszillation auf jedem flat-Reveal beibehalten

**Was gemacht wurde:**
- Revert der D3-Tick-Beschränkung: `OVERLAY_FLAT_REVEAL_TICK.fetch_add` auf
  **jedem** flat-Reveal (wie im Originalcode), nicht nur bei `!was_visible`.
- `should_oscillate_flat_reveal` gibt für alle flat-Surfaces `true` zurück
  (unabhängig von `was_visible`).
- Begründung: Bei Mode-Wechsel **während Recording** bleibt
  `pillState.kind === "recording"` → `key={pillState.kind}` ändert sich nicht
  → kein React-Remount → die Compositor-Layer wird nicht freigegeben. Die
  1px-Oszillation war der einzige native Repaint-Trigger.
- D5-Test aktualisiert.

**Ergebnis: UNGELÖST.** Das Ghosting trat weiterhin auf, wenn auch
möglicherweise seltener.

### Versuch 3 — `cd56a3b`: `key={state.mode}` auf die ganze Pill

**Was gemacht wurde:**
- `key={state.mode}` auf den `.pill`-Root-Div in `RecordingPill`,
  `ProcessingPill` (compact) und `ModePickerPill`.
- Begründung: Die `transform: scale(0.87)` auf `.ov-pill-shell` promoted die
  Pill auf eine eigene Compositor-Layer. Bei Mode-Wechsel malt WebKitGTK den
  neuen Content auf die **gecachte Layer mit alter Geometrie** → zwei
  Geometrien sichtbar. Ein React-Remount released die alte Layer synchron im
  selben Commit (vor dem Browser-Paint).

**Ergebnis: NEUE SYMPTOME.** Das Ghosting wurde teilweise gelöst, ABER es
gab einen **schwarzen Blitz** (Remount-Flash): React unmountet die ganze
Pill (Mic, Bars, Timer, Dividers) → ein Frame lang ist das DOM leer →
WebKitGTK malt den transparenten/leeren Zustand als schwarze Striche → dann
mountet die neue Pill. Der User berichtet: "jedes Mal reloaded und kurz
einen schwarzen Blitz".

### Versuch 4 — `c181a10`: `key={state.mode}` nur auf den ModeChip

**Was gemacht wurde:**
- `key` vom `.pill`-Root auf nur den `<ModeChip>` verschoben.
- Nur die ModeChip-Sub-Layer wird remounted; Mic/Bars/Timer/Dividers bleiben
  gemountet → kein leerer Frame, kein schwarzer Blitz.

**Ergebnis: UNGELÖST.** Der schwarze Blitz verschwand, aber das Ghosting
trat weiterhin auf — "man kann das Problem exploiten, indem man es oft genug
probiert". Der ModeChip-Remount allein released nicht die **Pill-Root-
Compositor-Layer**, die die alte Geometrie cached.

### Versuch 5 — `7b5b12b`: `min-width: 52px` auf dem Mode-Label (Workaround)

**Was gemacht wurde:**
- `min-width: 52px` + `text-align: center` auf `.pill__mode-label`.
- Begründung: Die Pill ist `width: max-content`, also ändert sich die
  Pill-Breite bei Mode-Wechsel (verschiedene Label-Breiten: "Auto"=4 chars
  vs "Verbatim"=8 chars). Feste min-width → keine Geometrie-Änderung → kein
  Compositor-Layer-Recache.

**Ergebnis: UNGELÖST, vom User als Workaround abgelehnt.** "Die Breite wird
immer noch minimal geändert. Keine Workarounds!" Der Fix reduzierte das
Ghosting (fast gleiche Breite), aber eliminierte es nicht. **Revertiert in
Versuch 6.**

### Versuch 6 — `720bfa6`: `fetchEffectiveMode`-Debounce (150ms)

**Was gemacht wurde:**
- `lastModeFetchRef` (Timestamp) in `fetchEffectiveMode`. Redundante
  `fetchEffectiveMode`-Calls innerhalb von 150ms werden geskipped.
- Begründung: Ein einzelner Mode-Tap löst bis zu vier redundante
  `fetchEffectiveMode`-Calls aus:
  1. `handleCycleMode` `.then(() => fetchEffectiveMode())`
  2. `set_active_profile_processing_mode` emittiert `ready` (wordscript-event)
     → `useRuntime` dispatcht READY → `state.config` ändert sich → der
     `[state.config]`-Effekt feuert `fetchEffectiveMode`
  3. `state.config`-Änderung → `configFallbackMode` recomputes (weiterer
     Render)
  4. (Per-Mode-Hotkey-Pfad) `wordscript-mode-event`-Listener feuert
     `fetchEffectiveMode`
  Jeder `fetchEffectiveMode → setEffectiveMode` ist ein separater React-
  Render-Commit. WebKitGTK cached die Compositor-Layer zwischen Commits und
  kann bei schnellem Commit-Folge zwei Pill-Geometrien gleichzeitig malen.
- `min-width`-Workaround aus Versuch 5 revertiert.
- Test für Per-Mode-Hotkey angepasst (Debounce-Fenster muss ablaufen).

**Ergebnis: UNGELÖST.** "Manche Overlay-States zum Beispiel nach 0,06 oder
0,05 überblenden einander immer noch. Das fuckt extrem ab, es ist noch nicht
gelöst, das heißt, das ist reloaded, also jedes Mal reloaded und kurz einen
schwarzen Blitz gibt beim Overlay."

## Verbleibende Symptomatik (Stand nach Versuch 6)

1. **Ghosting bei schnellem Mode-Cycling:** Bei Mode-Wechseln mit ~0,05–0,06 s
   Abstand überlagern sich zwei Pill-Geometrien für einen Frame.
2. **Schwarzer Blitz beim Mode-Wechsel:** Das Overlay "reloaded" sichtbar —
   für einen Frame ist das Pill kurz leer/schwarz. **Wahrscheinlich
   verursacht durch den `scheduleReveal`-Dispatcher (D1):** Der native
   Repaint (`set_size` + `set_background_color`) feuert via `requestAnimationFrame`
   bzw. `setTimeout(0)` **einen Frame nach** dem React-Commit. In diesem Frame
   hat React den neuen DOM bereits gepaintet, aber das native Window hat noch
   die alte Backing-Store-Geometrie → WebKitGTK malt den neuen Content auf
   einenBacking-Store, der gerade reallociert wird → schwarzer Blitz.
3. **Nicht smooth:** Der Mode-Wechsel ist visuell nicht flüssig; das
   Reload/Blitz-Verhalten macht ihn abgehackt.

## Neu identifizierte Ursachen (über RC1–RC3 hinaus)

### NI1 — Schwarzer Blitz durch async `scheduleReveal` vs. sync React-Commit

D1's `scheduleReveal`-Dispatcher deferred den nativen `sync_overlay_window_visibility`-
Call via `requestAnimationFrame` (oder `setTimeout(0)`). Das bedeutet:

1. React commitet den neuen DOM (neuer ModeChip-Label) **synchron**.
2. WebKitGTK paintet den neuen DOM auf den **aktuellen** Backing-Store.
3. **Ein Frame später:** `scheduleReveal`'s rAF-Callback feuert → native
   `set_size` (mit 1px-Oszillation) → Backing-Store-Reallokation → der
   gerade gepaintete Content wird verworfen → **schwarzer Frame** → dann
   repaint mit neuem Backing-Store.

Die Oszillation (`set_size` mit anderer Höhe) war ursprünglich synchron und
passierte **im selben Frame** wie der React-Commit. Durch D1's
rAF-Deferral ist sie jetzt einen Frame zu spät → der schwarze Blitz.

**Hinweis:** Das `scheduleReveal`-Debounce (D1) ist möglicherweise
kontraproduktiv für diesen Pfad — es verzögert den Repaint statt ihn zu
beschleunigen.

### NI2 — `configFallbackMode`-Recompute als zweite Geometrie-Quelle

Bei `state.config`-Änderung (durch das `ready`-Event von
`set_active_profile_processing_mode`) recomputet `configFallbackMode`:

```ts
const configFallbackMode = useMemo(
  () => (state.config ? resolveOverlayProcessingMode(state.config) : null),
  [state.config],
);
const pillMode = effectiveMode ?? configFallbackMode ?? "auto";
```

Wenn `effectiveMode` durch das 150ms-Debounce (Versuch 6) noch nicht
aktualisiert ist, aber `state.config` sich bereits geändert hat (neuer
`processing_mode` im Profil), springt `configFallbackMode` auf den neuen
Mode → `pillMode` springt → andere Geometrie → Ghosting. Das Debounce
verhindert `fetchEffectiveMode` aber **nicht** den `configFallbackMode`-
Recompute (der durch `useMemo` auf `[state.config]` getriggert wird, nicht
durch `fetchEffectiveMode`).

### NI3 — WebKitGTK Compositor-Layer-Caching bei `transform: scale(0.87)`

Die `transform: scale(0.87)` auf `.ov-pill-shell` (siehe
`overlay-pill.css:115`) promoted die gesamte Pill-Subtree auf eine eigene
Compositor-Layer. WebKitGTK cached diese Layer asynchron. Bei einem Mode-
Wechsel (gleicher `pillState.kind`, aber anderer `pillMode`) ändert sich der
DOM-Content (ModeChip-Label), aber die Compositor-Layer wird nicht sofort
invalidiert — WebKitGTK malt den neuen Content auf die gecachte Layer mit
alter Geometrie, bis die Layer revalidiert wird (typischerweise im nächsten
Compositor-Frame).

Dies ist die wahrscheinlichste **übrigbleibende** Ursache für das Ghosting
bei schnellem Cycling: bei Mode-Wechsel alle ~60ms (1 Frame) hat WebKitGTK
keine Zeit, die Layer zu revalidieren, und zwei Layer-Versionen überlagern
sich.

### NI4 — Mehrere Render-Commits trotz Debounce

Das 150ms-Debounce (Versuch 6) kollabiert redundante `fetchEffectiveMode`-
Calls, aber **nicht** alle Render-Commits:

- `setEffectiveMode(next)` (eager, D2) → **Render A**
- `ready`-Event → `state.config` ändert sich → `configFallbackMode` recomputes
  → **Render B** (potenziell anderer `pillMode`-Wert, siehe NI2)
- `[state.config]`-Effekt feuert `fetchEffectiveMode` → aber durch Debounce
  geskipped → **kein weiterer `setEffectiveMode`-Commit** (das ist die
  Verbesserung von Versuch 6)

Trotzdem bleiben **Render A + Render B** = zwei Commits mit potenziell
unterschiedlicher Geometrie. Das Debounce reduziert 4 Commits auf 2, aber 2
reichen immer noch für Ghosting.

## Was noch fehlt / Nicht evaluierte Ansätze

### A1 — `will-change: transform` auf `.ov-pill-shell` entfernen oder toggeln

Die `transform: scale(0.87)` promoted die Pill auf eine Compositor-Layer.
Ein `will-change: transform` (falls vorhanden) forciert das Caching.
Evaluiert werden sollte, ob das **Entfernen** der `transform` (stattdessen
skalieren via `zoom` oder Font-Size-Anpassung) das Compositor-Layer-Caching
eliminiert. Bisheriger Versuch mit `zoom` (2026-07-08, dokumentiert in
`overlay-pill.css` Kommentar) scheiterte an WebKitGTK's `max-content`-Bug,
aber das war vor den anderen Fixes — könnte mit fester Pill-Breite jetzt
funktionieren.

### A2 — Native `set_size` **synchron** im React-Commit (kein rAF-Deferral)

D1's `scheduleReveal` deferred den nativen Repaint via rAF. Das ist
möglicherweise die Ursache des schwarzen Blitzes (NI1). Evaluiert werden
sollte, ob ein **synchroner** `invoke("sync_overlay_window_visibility", ...)`
im `useLayoutEffect` (nicht `useEffect`, und nicht via rAF) den Repaint im
selben Frame wie den React-Commit erzwingt — kein schwarzer Frame, kein
Ghosting. Das würde D1 teilweise revertieren, aber die Koadunierung auf
Rust-Seite (D3) beibehalten.

### A3 — `configFallbackMode` vom `state.config`-Recompute entkoppeln

NI2 zeigt, dass `configFallbackMode` bei `state.config`-Änderung recomputet
und `pillMode` springen kann. Evaluiert werden sollte, ob `configFallbackMode`
**nur beim ersten Render** (before `effectiveMode` populated) verwendet wird
und danach ignoriert wird — sobald `effectiveMode !== null` einmal wahr war,
sollte `configFallbackMode` nicht mehr als Fallback dienen. Das eliminiert
Render B als zweite Geometrie-Quelle.

### A4 — `set_background_color` mit **abwechselndem** Alpha-Wert

Die 1px-Oszillation (`set_size` 60↔61) soll eine echte `set_size`-Änderung
erzwingen → Backing-Store-Reallokation → Repaint. Aber `set_background_color`
mit identischem RGBA ist ein No-op auf WebKitGTK (dokumentiert in
`OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md` Kommentar). Evaluiert werden sollte,
ob ein **abwechselndes Alpha** (z.B. `rgba(0,0,0,0.0)` ↔ `rgba(0,0,0,0.01)`)
eine echte Layer-Invalidierung erzwingt, die die gecachte Compositor-Layer
freigibt — ohne dass ein `set_size` nötig ist. Das wäre eine leichtere
Alternative zur 1px-Oszillation.

### A5 — `key` auf `.ov-pill-shell` statt auf `.pill` oder ModeChip

Versuch 3 (`key` auf `.pill`) verursachte den schwarzen Blitz, weil die
ganze Pill-Subtree unmountet wurde. Versuch 4 (`key` auf ModeChip) reichte
nicht, weil die Pill-Root-Layer gecacht blieb. Evaluiert werden sollte, ob
`key={mode}` auf dem `.ov-pill-shell`-Wrapper (der die `transform: scale`
trägt) die Compositor-Layer freigibt, **ohne** die `.pill`-Children zu
unmounten — der Wrapper ist ein `inline-flex`-Container ohne eigene visuelle
Children, sodass sein Remount keinen leeren Frame erzeugt.

### A6 — WebKitGTK Compositing-Flags evaluieren

In `src-tauri/src/main.rs` sind verschiedene WebKitGTK-Flags gesetzt
(`WEBKIT_DISABLE_DMABUF_RENDERER`, GPU-Compositing-Toggle). Evaluiert
werden sollte, ob das Deaktivieren von GPU-Compositing
(`WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1`) das Compositor-Layer-Caching
komplett eliminiert — dann gäbe es keine Layer zu ghosten. Performance-
Impact muss evaluiert werden, aber für ein transparentes Overlay-Pill ist
Software-Rendering möglicherweise ausreichend.

### A7 — Full Playwright/visuelle Verifikation

Bisher wurde das Ghosting nur manuell vom User visuell verifiziert. Eine
Playwright-MCP-Session mit `npm run tauri dev` könnte DevTools-Console-Logs
(`[ov-reveal]`, `[ov-dom]`) während schnellem Mode-Cycling erfassen und die
Anzahl `set_size`-Calls pro Mode-Wechsel messen. Der Plan erwartete "1
set_size pro Mode-Wechsel" — das sollte verifiziert werden.

## Aktueller Code-Stand (alle 6 Versuche aktiv)

Die folgenden Änderungen aus den 6 Versuchen sind **alle aktiv auf `master`**
und sollten vor der nächsten Fix-Iteration reviewt werden, ob sie
beibehalten oder revertiert werden:

### `src/windows/OverlayWindow.tsx`
- `scheduleReveal`-Dispatcher mit rAF/`setTimeout(0)`-Koadunierung (D1) —
  **möglicherweise kontraproduktiv (NI1), Kandidat für Revert/Redesign**
- Eager `setEffectiveMode(next)` in `handleCycleMode` und
  `wordscript-mode-select`-Listener (D2)
- `lastModeFetchRef`-Debounce (150ms) auf `fetchEffectiveMode` (Versuch 6)
- Alle drei `visible:true`-Invoke-Sites routen durch `scheduleReveal`

### `src-tauri/src/lib.rs`
- `OVERLAY_PENDING_REVEAL` (Mutex) + `OVERLAY_REVEAL_SCHEDULED` (AtomicBool)
  statics (D3)
- `reveal_overlay_window` → `reveal_overlay_window_impl` + direkter Wrapper
  + `reveal_overlay_window_coalesced` (0-ms-Sleep-Yield) (D3)
- `sync_overlay_window_visibility` nutzt den coalesced-Pfad (D3)
- `should_oscillate_flat_reveal` extrahiert (D5) — oszilliert auf jedem
  flat-Reveal (Versuch 2)
- `force_set_size = is_flat` (auf jedem flat-Reveal, Versuch 2)
- `PartialEq` zu `OverlaySurface` hinzugefügt

### `src/windows/OverlayWindow.test.tsx`
- `listen`-Mock erweitert um `wordscript-mode-event`-Capture
- 4 neue D4-Tests
- Bestehender Test "clears a visible result-actions surface" auf `waitFor`
  umgestellt
- Per-Mode-Hotkey-Test auf 150ms-Debounce-Wartezeit angepasst

### `src/components/overlay/OverlayPill.tsx`
- **Keine `key`-Remounts mehr** (Versuche 3+4 wurden in Versuch 5+6
  effektiv revertiert — `key={state.mode}` ist nicht mehr aktiv)

### `src/styles/overlay-pill.css`
- **`min-width: 52px` revertiert** (Versuch 5 wurde in Versuch 6 revertiert)
- Keine Änderungen mehr aktiv

## Validierung

- `npm run build`: clean (TypeScript + Vite)
- `npm test`: 73/73 passed (22 in `OverlayWindow.test.tsx`)
- `cargo test`: 292/292 passed
- **Live-Verifikation: NICHT bestanden** — Ghosting + schwarzer Blitz
  persistieren bei schnellem Mode-Cycling

## Empfehlung für nächste Iteration

1. **Zuerst NI1 adressieren:** D1's `scheduleReveal`-rAF-Deferral auf
   synchronen `useLayoutEffect`-Invoke umstellen (A2) oder komplett
   revertieren. Das sollte den **schwarzen Blitz** eliminieren.
2. **Dann NI2/NI4 adressieren:** `configFallbackMode` entkoppeln (A3), sodass
   nur noch **ein** Render-Commit pro Mode-Wechsel übrig bleibt.
3. **Dann NI3 verifizieren:** Wenn Ghosting danach noch auftritt, ist es
   reines WebKitGTK-Compositor-Layer-Caching → A1 (transform entfernen),
   A4 (Alpha-Toggle) oder A6 (Compositing-Flags) evaluieren.
4. **Jeder Schritt einzeln committen und live verifizieren** — nicht mehrere
   Fixes auf einmal, wie bei Versuch 1 (D1–D5 gleichzeitig), wo nicht klar
   war, welcher Fix half oder schadete.
