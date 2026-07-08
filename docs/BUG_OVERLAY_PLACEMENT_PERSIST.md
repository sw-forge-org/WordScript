# Bug: Overlay Placement Mode wird nicht immer gespeichert

**Status:** OFFEN (2026-07-08). Symptom gemeldet, noch nicht reproduziert.
Nur Dokumentation; keine Recherche / kein Fix in diesem Durchgang.
**Erstmals berichtet:** 2026-07-08 (Nutzer-Beobachtung, kein Repro)
**Betrifft:** Overlay-Placement-Mode (`overlay_position_mode`: `preset` | `manual`) und/oder die gemerkte Manual-Position (`overlay_manual_x/y`, `overlay_monitor`)

## Symptom

Der Placement Mode des Overlays (Remember-last-drag vs. Preset-Display-Anchor) wird vom Nutzer in den Settings gesetzt, taucht aber gelegentlich nicht dauerhaft auf — der Mode bzw. die gemerkte Position revertiert scheinbar auf einen frueheren Zustand. Konkretes Repro-Szenario steht aus; die Nennung war ohne Angabe, ob Mode, Koordinaten oder Monitor-ID betroffen sind und ob das Settings-Fenster waehrend des Drags geoeffnet war.

## Was feststeht (Fakten aus Code + Doku)

- Es existiert ein realer Runtime-Contract fuer Placement. In `docs/ARCHITECTURE.md:39` und `CHANGELOG.md:246,251` ist dokumentiert: Drag persistiert eine gemerkte Manual-Position, Settings kann zwischen Remembered-Placement und Preset-Display-Anchorn wechseln, der Zielmonitor fuer Manual-Placement wird aus der gespeicherten logischen Drag-Referenz statt aus `current_monitor()` abgeleitet.
- `overlay_position_mode` ist ein first-class Feld in `AppConfig` (`src-tauri/src/core/config.rs:492`, `src/types/ipc.ts:209`), Typ `OverlayPositionMode = "preset" | "manual"` (`ipc.ts:174`, `config.rs:443`), Default `Preset` (`config.rs:594`).
- Es gibt **drei** Persistenz-Pfade, die an diesem Feld beteiligt sind:
  1. Settings-Mode-Select: `OverlayTab.tsx:75` feuert `onChange({ overlay_position_mode })` → `patch` (`SettingsWindow.tsx:166`) → `saveConfig` → Rust `save_config` (`config.rs:1149`), unter `with_config_file_lock`.
  2. Settings-Display/Anchor-Select im Preset-Subtree: `OverlayTab.tsx:91,114` aendert `overlay_monitor` / `overlay_anchor` (nicht den Mode), derselbe `patch`-Pfad.
  3. Drag-Persistenz: `OverlayWindow.tsx:331` ruft nach 180ms Debounce `remember_overlay_manual_position` (`lib.rs:1790`) auf. Dieser Befehl laedt die Config _selbst_ neu (`AppConfig::load_from_disk()`, Z.1798), **erzwingt** `overlay_position_mode = Manual` (Z.1802), leitet `overlay_monitor` neu ab und schreibt dann ueber `core::config::save_config` (Z.1816), der wieder in den File-Lock geht.
- Der Settings-Form-Sync ist explizit gegen Drag-vs-Settings-Race abgesichert: `SettingsWindow.tsx:108-118` zaehlt in-flight Saves (`inFlightSaveCountRef`) und unterdrueckt das `setForm({...state.config})`-Resync, solange ein Settings-Patch noch nicht settled ist. Das Schutz-ziel ist explizit das Verhindern eines A→B→A-Flackerns durch ein veraltetes `ready`-Event.
- Der File-Lock in `save_config` (`config.rs:1149-1165`) koordiniert _nur_ Befehle, die ebenfalls `with_config_file_lock` nutzen. `remember_overlay_manual_position` geht am Ende ueber `core::config::save_config` in den Lock, aber sein eigener `AppConfig::load_from_disk()` (Z.1798) _vor_ dem Lock ist eine ungeschuetzte Read-Modify-Write-Vorstufe.

## Hypothesen (nicht verifiziert, keine Recherche in diesem Durchgang)

- **H.1 — Drag ueberschreibt Settings-Mode-Switch.** Der Nutzer setzt in Settings den Mode auf `Preset`, zieht danach (bewusst oder versehentlich) das Overlay. `remember_overlay_manual_position` erzwingt `Manual` (Z.1802) und ueberschreibt damit den expliziten Preset-Wunsch des Nutzers. _Verhalten_, kein Bug im strengen Sinn — aber aus Nutzersicht "nicht gespeichert", weil ein Drag den Mode revertiert. Wahrscheinlichster Kandidat.
- **H.2 — Settings-vs-Drag Race beim `ready`-Event.** Ein Drag-feuert `ready` (via `remember_overlay_manual_position` → `save_config` → `emit_ready_event`). Das Settings-Fenster ist offen und hat einen _aelteren_ Patch noch in flight. Der Sync-Schutz (`inFlightSaveCountRef`) sollte das abfangen, aber nur fuer _Settings_-seitige Saves, nicht gegen ein Drag-seitiges `ready`. Faellt der Settings-Mode-Switch genau in das Fenster zwischen Drag-`ready` und Settings-Settle, koennte das Settings-Form den Drag-Snapshot uebernehmen und beim naechsten Resync den Mode revertieren.
- **H.3 — Preset-Subtree-Aenderung ohne Mode-Touch.** Wechselt der Nutzer im Preset-Modus nur Display/Anchor (`OverlayTab.tsx:91,114`), wird der Mode _nicht_ mitgeschrieben. Das ist korrekt, aber falls ein vorheriger Drag den Mode auf `Manual` gesetzt hatte und das Settings-Form noch nicht resynced war, zeigt der Select ggf. den falschen Mode an — ein Anzeigefehler, kein Persistenzfehler.

## Was noch fehlt (offen fuer spaeter)

- [ ] Repro-Szenario: Drag → Settings Mode switch? Nur Mode oder auch Koordinaten? Settings-Fenster offen oder geschlossen beim Drag?
- [ ] Trace: pruefen, ob `remember_overlay_manual_position` einen kurz zuvor gesetzten `Preset`-Mode tatsächlich ueberschreibt und ob das `ready`-Event dabei das Settings-Form clobbert.
- [ ] Entscheidung: soll ein Drag im Preset-Mode (a) den Mode automatisch auf `Manual` setzen (aktuelles Verhalten), (b) den Mode ignorieren und nur im Manual-Mode persistieren, oder (c) den Nutzer fragen?
- [ ] Testfall, der den Drag-+Settings-Race konstruiert (Frontend-Test gegen `OverlayWindow` + `SettingsWindow`, oder Rust-Test gegen `remember_overlay_manual_position` + `save_config` unter File-Lock).
- [ ] Ggf. Eintrag in `docs/STATUS.md` "Bekannte offene Produktluecken" nachholen, falls sich das als realer Bug bestaetigt.

## Referenzen

- `src/components/settings/OverlayTab.tsx:46,75,91,114` — Settings-UI fuer Placement Mode / Display / Anchor
- `src/windows/SettingsWindow.tsx:108-118,155-243` — in-flight-Save-Schutz und `patch`-Persistenz
- `src/windows/OverlayWindow.tsx:310-346` — Drag-Persistenz-Debounce (180ms), `remember_overlay_manual_position`-Aufruf
- `src-tauri/src/lib.rs:1790-1817` — `remember_overlay_manual_position`: erzwungener `Manual`-Mode, Reload ausserhalb des Locks, Save in den Lock
- `src-tauri/src/lib.rs:270-344,406-440` — `resolve_overlay_monitor(_id)`, `overlay_target_position`: Manual-vs-Preset-Entscheidung beim Reveal
- `src-tauri/src/core/config.rs:443,492,594,1149-1169` — `OverlayPositionMode`, Feld in `AppConfig`, Default `Preset`, `save_config` unter File-Lock
- `src/types/ipc.ts:174,209` — TS-Typ und AppConfig-Feld
- `docs/ARCHITECTURE.md:39` — dokumentierter Manual-vs-Preset-Contract
- `docs/STATUS.md:131,133` — Monitor-Restore bei Identity-Miss (andere Luecke), "keine feineren Placement-Regeln jenseits Manual-vs-Preset"
- `CHANGELOG.md:246,251,252` — Drag-Persistenz, Monitor-Ableitung, Drag-vs-Button-Suppression