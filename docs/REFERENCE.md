# WordScript — Reference

Stand: 2026-06-20

## Zweck

Dieses Dokument buendelt projektweite Konstanten, die nicht in eine einzelne Architektur-, Status- oder Plattform-Datei gehoeren: Marken- und Produktkontext, Provider- und Runtime-Grenzen, Modus-Semantik, externe API-Limits und spaetere Sync-Planung.

Wenn README, Vision oder Architektur eine aktuelle Produktaussage brauchen, soll sie von hier aus belegbar sein.

## Lizenz

- AGPL-3.0 (seit 2026-06-17)

## Overlay-Konstanten (Linux)

- Fixe Fenstergroessen: 440×60 (flat) / 460×164 (edit)
- `resizable: true` in `tauri.conf.json` (GTK ignorierte `set_size` bei `resizable: false`)
- XWayland-Default: `GDK_BACKEND=x11`, opt-in nativ Wayland: `WORDSCRIPT_NATIVE_WAYLAND=1`
- KDE Plasma 6 Always-on-Top: `packaging/kwin-wordscript-overlay/`
- CSS-Variablen: `--ov-shadow: none`, `--ov-shadow-recording: none` in `overlay-pill.css`
- `pointer-events: auto` auf `.ov-scope` (nicht `none` auf overlay-roots)

## Projektkontext

- SW bench: Open-Source-brand von SW labs
- WordScript: der aktive Desktop-Diktierpfad innerhalb von SW bench
- Produktziel: eine offene, ernstzunehmende Alternative zu bezahlten AI-Voice-Dictation-Angeboten

## Provider- und Runtime-Grenzen

### Provider-Lanes heute

- `groq` ist der cloud-first Produktionspfad
- `local_preview` ist die interne Kompatibilitaets-ID fuer die lokale Runtime-Lane mit `whisper-cli` fuer STT und Ollama fuer Cleanup
- der Nutzer speichert den eigenen Groq-API-Key lokal im OS secret store
- die JSON-Konfiguration wird beim Speichern gescrubbt und alte JSON-Groq-Secrets werden nativ in den Secret Store migriert
- Provider-Status enthaelt typisierte Modi (`fast`, `quality`, `local`, spaeter `self_hosted`) und Capabilities fuer Transcription, Chat-Cleanup, Local, API-Key-Pflicht, Prompt-Bias, Language, Segments und Modellmanagement
- Provider-Fehler enthalten neben Text auch `kind`, HTTP-Status, Retry-After, `retryable` und eine `user_action`; Settings und Runtime-Events sollen diese Semantik weiterreichen statt eigene Fehlerkategorien zu bauen
- ein WordScript-Proxy oder Hosted Mode existiert nicht

### Modus-Semantik heute

- `fast` und `quality` beschreiben heute Qualitaets-/Latenz-Presets innerhalb derselben Provider-Lane
- `local` bedeutet einen lokalen oder on-device Laufzeitpfad ohne WordScript-Backend; bei WordScript ist das aktuell die `local_preview`-Lane mit lokalem Runner, lokalem Modellpfad und lokalem Cleanup-Endpoint
- `self_hosted` ist noch keine aktive Produktlane; der Begriff bleibt fuer spaetere nutzerbetriebene Remote- oder LAN-Dienste reserviert, die nicht WordScripts eigener Hosted Mode waeren
- diese Begriffe duerfen in UI und Doku nicht zusammengeschoben werden, solange die zweite Produktionslane und der gefuehrte Setup-Pfad noch fehlen

### Processing-Modi (Verarbeitungsvertrag)

Diese Modi sind **orthogonal** zu den Provider-Modi oben und beschreiben, was mit dem diktierten Text passiert:

- `auto`: Meta-Modus; pro Transkription entscheidet ein LLM-basiertes Routing zwischen Cleanup, Prompt Enhance und Agent (basierend auf Transkript-Text, Agent-Name und optionalem Workspace-Kontext)
- `cleanup`: Standard-Korrektur ueber den aktiven Provider; Standard fuer die meisten Diktate
- `rewrite`: polishing-Stil mit staerkerer Umformulierung; verhaelt sich zur Legacy-Option `polished`; nur manuell waehlbar (nicht auto-detektiert)
- `agent`: Diktat wird als Befehl an den Agenten interpretiert; Intent-Klassifizierung bestaetigt vor Ausfuehrung
- `prompt_enhance`: Diktat wird als Prompt verstanden, ueber `prompt_enhance` strukturiert oder expandiert und mit `PromptTarget` an den Provider gegeben
- `verbatim`: Rohtext ohne Cleanup, mit `clipboard_only`-Preview vor Commit

Der effektive Modus wird pro Session durch `mode_router::resolve_processing_mode` aufgeloest:
1. manueller Override (Mode-Picker / Mode-Cycle / per-Mode-Hotkey)
2. aktiver Profil-Work-Mode (`processing_mode` aus `AppConfig`)
3. Fallback: `auto`

Wenn der effektive Modus `auto` ist, wird er pro Transkription durch `mode_router::resolve_auto_mode` in einen konkreten Modus aufgeloest, sobald der Transkript-Text verfuegbar ist. Signale:
- Agent-Name + imperativer Verb → `agent`
- Imperativ + IDE-Workspace-Kontext → `prompt_enhance`
- sonst → `cleanup`

Der Workspace-Kontext ist nur ein Wahrscheinlichkeitssignal, kein deterministisches Mapping (`workspace_app_map` wurde entfernt).

### Lokale Runtime-Voraussetzungen

- `whisper-cli` in `PATH` oder `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` fuer eine ggml-Datei oder `WORDSCRIPT_LOCAL_MODEL_DIR` fuer `ggml-<model>.bin` sowie gaengige Varianten wie quantisierte oder `.en`-Dateien
- Ollama lokal unter `http://127.0.0.1:11434` oder `WORDSCRIPT_LOCAL_CHAT_BASE_URL`
- ein installiertes lokales Cleanup-Modell, ausgewaehlt ueber `local_correction_model` oder `WORDSCRIPT_LOCAL_CHAT_MODEL`
- Provider & Models zeigt diese Voraussetzungen jetzt als native Preflight-Checkliste statt nur als Env-Text; die Checkliste liest `local_setup` und nicht eigene UI-Heuristiken
- die Lane ist nicht mehr STT-only; AI cleanup laeuft lokal ueber das separate Cleanup-Modell und faellt nur bei Nichtverfuegbarkeit oder Guardrail-Rejects auf das rohe lokale Transkript zurueck

### Audio- und Upload-Relevanz

- Capture-Dateien werden fuer Groq auf 16 kHz Mono-WAV normalisiert
- der Runtime-Pfad nutzt ein kurzes interaktives Timeout von `18_000` bis `35_000` Millisekunden
- die aktive Transkriptionsanfrage hat genau einen Retry (`max_retries = 1`, seit Pipeline-Hardening 2026-07-03; nur fuer retryable Status 429/5xx/Timeout/Network, respektiert `Retry-After`)
- async Provider-, Transform- und Insert-Ergebnisse werden an die aktive `processing`-Session-ID gebunden; stale Ergebnisse nach Abort, neuer Aufnahme oder bereits finalisierter Session werden verworfen und nur im Runtime-Log notiert

Relevante externe Groq-Grenze fuer den Produktpfad:

- `413 request_too_large` bezieht sich auf Upload-Groesse, nicht nur auf Dauer
- dokumentierte Richtwerte aus der aktuellen Integration: Free `25 MiB`, Dev `100 MiB` pro Upload

Diese Werte sind nur insofern Teil der Produktreferenz, wie sie den aktiven Desktop-Flow beeinflussen.

## Planungsstand fuer spaetere Sync-Themen

Diese Punkte beschreiben keine aktive Funktion, sondern die aktuelle Zielrichtung fuer spaeteren Ausbau:

- WordScript bleibt local-first; ein Konto waere additiv und nicht Voraussetzung fuer den Produktkern
- wenn spaeter Sync kommt, dann als WordScript-eigener Dienst fuer WordScript-Daten statt als Pflicht-Abhaengigkeit von einem externen Produkt-Hub
- der primaere Ausbaupfad ist kein Peer-to-Peer- oder Client-to-Client-Primarmodell
- fruehe Sync-Kandidaten sind Profile, Dictionary, Snippets, ausgewaehlte Settings und spaeter optional Verlauf oder Workspaces
- Provider-Credentials wie der Groq-API-Key bleiben lokal im OS secret store und sind kein impliziter Sync-Bestandteil

## Verbleibender Dokumentensatz

Das absichtlich kleine Doku-Set ist:

- `README.md` fuer Projektueberblick
- `docs/VISION.md` fuer Produktziel und V1/V2-Einordnung
- `docs/ARCHITECTURE.md` fuer Systemwahrheit und Ownership
- `docs/DEVELOPMENT.md` fuer Arbeitsmodus und Validation
- `docs/DESIGN_SYSTEM.md` fuer UI-Regeln
- `docs/STATUS.md` fuer aktuellen Produktstand, implementierte Kernfunktionen, Insertion-/Recovery-Modell, offene Luecken, Release-Status
- `docs/PLATFORMS.md` fuer plattformspezifische Support-Matrix und Insert-/Recovery-Diagnostik
- `docs/REFERENCE.md` fuer projektweite Konstanten, Provider-/Runtime-Grenzen, Modus-Semantik
- `docs/RELEASE_RUNBOOK.md` fuer den aktuellen Release-Aufbaupfad
- `docs/handoffs/` fuer abgeschlossene Implementation-Specs und historische Hand-Offs
- `docs/donors/` fuer eingefrorene Donor-Referenzen und Slice-Planung

Weitere Dateien brauchen einen engeren Zweck als diese elf Einstiegspunkte.
