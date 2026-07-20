# Hand-Off Documents — Archiv

Hier landen abgeschlossene Implementation-Specs und Hand-Offs, die nicht mehr der aktive Vertrag sind, aber als historische Referenz fuer Code, Tests und Folge-Slices erhalten bleiben.

Naming: `HANDOFF_<branch-or-slug>.md`

## Inhalt

- [Overlay Mode-Cycling Ghosting — Accepted Stand (Plan 1784433288646)](OVERLAY_MODE_CYCLING_GHOSTING_ACCEPTED.md) — Revertiert den Vorgänger-Workaround (min-width/key={mode}), baut permanente DEV-only Diagnose-Infrastruktur auf (`overlay_open_devtools` + `append_diag_log`/`read_diag_log`/`clear_diag_log` Rust-Commands + `OverlayDiagPanel` in Settings + `[ov-*]` Frontend-Logs). Stand in der Praxis ohne State-Überlagerung, 2 akzeptierte Rest-Artefakte. Auf unbestimmte Zeit so belassen.
- [Overlay Mode-Cycling Ghosting — Residual (Plan 1784429726777)](OVERLAY_MODE_CYCLING_GHOSTING_RESIDUAL.md) — Vorgänger. Reduzierte 27px-Ghosting auf ~1px residual via Workaround, eliminierte schwarzen Blitz (A2 queueMicrotask).
- [Hotkey Cross-Platform Fix (easy-wins-hotkey-hygiene)](HOTKEY_HANDOFF_easy-wins-hotkey-hygiene.md) — `RegisterHotKey` -> low-level Hooks fuer Start/Stop/Pause/Abort. Implementiert am 2026-06-10, superseded fuer per-Mode-Hotkeys (siehe `src-tauri/src/core/config.rs:328-341`).

## Konvention

- Neue Specs werden in diesen Ordner verschoben, sobald der zugehoerige Branch gemergt ist.
- Superseded-Hinweise stehen oben in der Datei, nicht in Changelog-Eintraegen.
- Aktive Folge-Specs (z. B. ein neuer Hand-Off fuer per-Mode-Hotkeys) bekommen einen eigenen Dateinamen, nicht einen Versions-Suffix.
