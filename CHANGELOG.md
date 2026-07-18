# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Template for new releases:

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or capabilities

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features removed in this release

### Fixed
- Bug fixes

### Security
- Security patches and vulnerability fixes

-->

## [Unreleased] — 2026-06-21

### Added

- **Capture-Stream-Error-Diagnose (2026-07-18):** Der cpal-StreamError-Callback (`src-tauri/src/core/capture.rs` `build_stream`) protokolliert jetzt den rohen cpal/PulseAudio/PipeWire-Error-String via `runtime_log::record` ins persistente Runtime-Log (`~/.config/WordScript/logs/wordscript-runtime.log`), sodass der asynchrone Capture-Abbruch beim Naechschauen nicht mehr aus dem 400-Einträge-Ringpuffer herausgefallen ist. Zusaetzlich protokolliert `start_native_capture` beim Capture-Start den gewaehlten cpal-Host (`pulse`/`alsa`/…), Device-Namen, Sample-Rate, Channels und Sample-Format. Neue Helper-Funktion `classify_capture_stream_error` uebersetzt den rohen Error-String in eine benutzerfreundliche, klassifizierte Meldung fuer den Frontend-Error-Pill (Permission revoked / Device lost / Timeout / unverarbeitet); der rohe String bleibt im Log. 6 Unit-Tests decken die Klassifikation ab. Die Recovery-UX (Error-Pill → Processing-Preview mit Copy) bleibt unangetastet. Branch `fix/capture-stream-error-diagnosis`. Plan `.kilo/plans/1784377955445-capture-stream-error-diagnosis.md`.
- KWin-Script für Always-on-Top auf KDE Plasma 6 / Wayland (`packaging/kwin-wordscript-overlay/`) — setzt `client.layer = 4` (OverlayLayer) für das WordScript-Overlay-Fenster. Install: `kpackagetool6 --type=KWin/Script -i packaging/kwin-wordscript-overlay && qdbus org.kde.KWin /KWin reconfigure`
- `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` Opt-out Environment-Variable — stellt den Cairo-Software-Rendering-Pfad wieder her für Hardware, auf der das Overlay mit GPU-Compositing Black-Blocks zeigt.
- **ClipboardFallback→06b-Wiring (2026-07-08):** Der auto_paste-Pfad, der zur Laufzeit auf Clipboard zurueckfaellt (`NativeInsertMode::ClipboardFallback`), zeigt jetzt dieselbe 06b-Darstellung (Insert-Affordance + Accent-Soft-Border) wie das explizite `clipboard_only`-Setting. Backend emittiert im `transcription`-Event ein neues `delivery`-Feld (`"inserted" | "clipboard"`), abgeleitet aus `result.insert_mode`. Frontend propagiert es ueber `RuntimeResultEvent` / `RuntimeTranscriptionResult`; `previewClipboardOnly`-Ableitung erweitert: `insert_behavior === "clipboard_only" || delivery === "clipboard"`. Der 06b-Insert-Button ist damit automatisch die Retry-Affordance fuer den Fallback-Fall (Recovery-Semantik aus `docs/PLATFORMS.md`).

### Changed

- **Overlay-Placement — Remember Last Drag Position behoben (2026-07-08):** Drei plattformunabhaengige Wurzeln behoben. (1) **K1 — Persist-Debounce beendete Drag-Session zu frueh:** Der 180ms-Debounce in `OverlayWindow.tsx` setzte `dragSessionActiveRef` nach dem ersten Persist auf `false`, sodass alle weiteren `onMoved`-Events waehrend desselben Drags verworfen wurden — bei jedem Drag >180ms wurde eine Zwischenposition gespeichert, nicht die Endposition. Fix: `dragSessionActiveRef` wird nur noch durch `clearDragIntent` + 2000ms-Grace-Timeout beendet. (2) **K2 — Reveal-Grace-Suppression verwarf schnelle Drags:** Die 420ms-Suppression nach Reveal verwarf `onMoved`-Events auch bei gesetztem `dragIntentRef`. Fix: Suppression greift nur bei `!dragIntentRef.current`. (3) **K3 — `set_position` vor `show()` von GTK/XWayland verworfen + Reveal-Race:** `window.set_position()` auf einem hidden-Fenster wurde von `gtk_widget_show` restauriert. Zusaetzlich lasen der Rust-Trigger und der Frontend-Sync beide `was_visible=false` (Race) und riefen beide `set_position`+`show()` auf. Fix: `set_position` nach `show()` auf allen Plattformen (nicht nur Windows); `OVERLAY_WINDOW_SHOWN` wird sofort zu Beginn des hidden→visible-Blocks gesetzt, damit konkurrierende Aufrufe skippen. Bestaetigt auf CachyOS KDE Plasma XWayland. Siehe `docs/BUG_OVERLAY_PLACEMENT_PERSIST.md`.

- **Overlay – 06b-Fix: Accent-Soft-Border (2026-07-08):** `ResultActionsPill` setzt bei `clipboardOnly` die Modifier-Klasse `pill--clipboard` auf den Container, die dieselbe `border-color: var(--ov-accent-border-soft)` wie `.pill--processing` appliziert. Die "clipboard_only-heit" wird jetzt auch am 06b-Container signalisiert, nicht nur am Insert-Button — visuell konsistent mit State 05. Kein `backdrop-filter`, keine neuen Farben (Phase-1-Regel unangetastet).
- **Overlay – Gallery-Karte 05 korrigiert (2026-07-08):** `clipboardOnly: false → true` auf der Processing-preview-Karte, damit die Gallery die Runtime-Wahrheit zeigt (State 05 ist nur mit `insert_behavior="clipboard_only"` erreichbar).
- **Doku-Drift behoben (2026-07-08):** `docs/DESIGN_SYSTEM.md` — `backdrop-filter: blur(20px)`-Stellen auf Faux-Glass-Stand gesynct (Phase-1-Regel: NIEMALS `backdrop-filter`); `mode-picker`-State (05b) ergaenzt. `docs/BUG_OVERLAY_GHOSTING.md` — Status je Szenario abgeglichen (Szenario 1 behoben 2026-06-29, Processing-Preview→Result 2026-07-01, Szenario 2 verengt). `docs/REFERENCE.md` — `max_retries = 0 → 1` (Pipeline-Hardening 2026-07-03).

- **GPU-Compositing standardmäßig aktiviert.** `WEBKIT_DISABLE_COMPOSITING_MODE=1` wurde aus `src-tauri/src/main.rs` entfernt. Die Variable zwang WebKitGTK in den Cairo-Software-Rendering-Pfad, was das Overlay vor Black-Blocks schützte, aber jedes Scrollen im Settings-Fenster CPU-gebunden und ruckelig machte — besonders bei Fenster-Skalierung auf 27-Zoll-Monitoren. Der Overlay-Shadow-Fix (`--ov-shadow: none`) und `WEBKIT_DISABLE_DMABUF_RENDERER=1` halten das Overlay auch mit GPU-Compositor korrekt. Alte `WORDSCRIPT_ENABLE_WEBKIT_COMPOSITING`-Variable entfernt (invertiert und verwirrend).
- Linux Overlay-Größe auf fixe 440×60 (flat) / 460×164 (edit) — dynamisches pill-basiertes Resize ist auf WebKitGTK/GTK nicht zuverlässig (`set_size` ist asynchron, Fenster hinkt einen Tick hinterher). Beide invoke-Pfade (base surface sync + useLayoutEffect) nutzen jetzt dieselbe Größe → kein Konflikt mehr.
- `resizable: true` in `tauri.conf.json` (GTK ignorierte `set_size` bei `resizable: false`).
- `park_overlay_window` ruft jetzt `window.hide()` auf → Reveal läuft durch den Hidden→Visible-Zweig (Drag-Schutz `set_position` nur bei Hidden→Visible funktioniert wieder).
- `set_background_color` wird bei jedem Reveal aufgerufen (nicht nur bei `size_changed`) → erzwingt Repaint, verhindert dass WebKitGTK die alte compositing-Layer behält (States überlagern sich sonst beim Wechsel).
- XWayland-default (`GDK_BACKEND=x11`) mit `WORDSCRIPT_NATIVE_WAYLAND=1` opt-in für nativ Wayland.
- **Settings-Karten ohne Drop-Shadows.** `shadow-card` wurde von FormCard, StatTile, Rule-Cards und Workspace-Tabs entfernt. Elevation kommt jetzt nur durch `bg-card` (heller als body) + `border`. Drop-Shadows waren der dominante per-Frame-Compositing-Cost bei fullscreen.
- **`.material`-Klasse ohne `backdrop-filter`.** `backdrop-filter: blur(12px) saturate(140%)` wurde entfernt und durch solid `background: var(--surface-2)` + inset shadows ersetzt. `backdrop-filter` ist eine der teuersten CSS-Operationen auf WebKitGTK.
- **`body` background-gradient auf `background-attachment: fixed`.** Verhindert dass der Gradient bei jedem Scroll-Frame neu compositet wird.
- **Scroll-Container-Optimierungen.** `contain: layout paint` + `overscroll-contain` + `scrollbar-gutter: stable` + `will-change: scroll-position` auf dem Scroll-Container, `contain: content` auf dem Content-Wrapper, `contain: layout paint` auf FormCard.
- **`transition-colors` auf Scroll-Containern entfernt.** Rule-Cards, Profile-Buttons, Tab-Buttons und Recent-Dictations haben jetzt sofortiges Hover-Feedback statt animiert.
- **History-Refresh-Interval von 1.5s auf 5s erhöht.** Reduziert Re-Renders während des Scrollens. Manueller Refresh über den Refresh-Button bleibt verfügbar.
- **Tab-Wechsel-Animation entfernt.** `animate-in fade-in-50 duration-150` wurde aus `SettingsWindow.tsx` entfernt. Tab-Wechsel sind jetzt sofort.

### Fixed

- **Pipeline-Hardening gegen Backend-Abbrueche (P1):** Drei Massnahmen gegen das intermittierende "alle paar Sessions bricht die Transkription ab"-Symptom. (1) **Pipeline-Watchdog** (`src-tauri/src/lib.rs`): Ein Hard-Deadline-Spawn (`PIPELINE_HARD_DEADLINE_SECS=120`) prueft nach Ablauf, ob die native Session noch im `Processing`-Stage klebt, und failt sie dann mit Error-Event + Sound-Cue. Das deckt Panic, Task-Drop und Stillstand der Pipeline-Task ab, bei denen bisher *kein* Error-Event emittiert wurde → Overlay blieb in Processing/Recording haengen. (2) **Transkriptions-Retry** (`lib.rs:938` `max_retries: 0 → 1`): Ein einzelner transienter Groq-Fehler (429 Rate-Limit, 5xx, Netzwerk, Timeout) fuehrte bisher zum sofortigen, nicht-rettbaren Abbruch mit sichtbarem Error-State; jetzt wird genau einmal retried (nur fuer `should_retry_status` = 429/5xx sowie Timeout/Network, respektiert `Retry-After`). (3) **Persistente Runtime-Log-Datei** (`src-tauri/src/core/runtime_log.rs`): Logs werden zusaetzlich zum 400-Einträge-Ringpuffer nach `~/.config/WordScript/logs/wordscript-runtime.log` geschrieben (Append + 4 MiB-Rotation auf `.log.1`). Der Ringpuffer war bei vielen Sessions so schnell ueberschrieben, dass der Abbruch-Fehler beim Nachschauen schon fehlte.
- **Eckige Pill / Kanten bei `clipboard_only`-Commit (P2):** Der unterdrückte clipboard_only-Commit zeigt bewusst kein Result (Regression-Schutz von `2644f9b`), deshalb griff die `bridgeResultFromStop`-Hold-Logik dort nicht. Der Commit konsumiert `pendingResult`, der Hold fiel aus → `pillState=null`-Unmount → auf WebKitGTK orphanierten die Compositor-Layer → eckige Pill/Kanten. Fix: `lastProcessingPreviewSnapshotRef` hält den letzten Live Processing-Preview-Inhalt und speist während `overlayMotion!=="idle"` einen statischen Processing-Hold bis zum sauberen idle-Unmount. Zeigt kein Result, regressiert `2644f9b` nicht. (Plan `1782892412000`, P2)
- **Overlay-Ghosting deterministisch behoben — opaker Pill-Hintergrund (2026-07-08):** Das WebKitGTK-Compositor-Layer-Ghosting ("eckige Kanten", "switcht zwischen runden und eckigen Ecken", besonders beim zweiten clipboard_only-Lauf) war nach drei Repaint-Runden (1px-Height-Oszillation, `set_background_color`-Re-Assert, `force_set_size`, `key={pillVisualEpoch}`-Remount) nicht deterministisch zuverlaessig. Wurzel: die **halbtransparente Pill-Hintergrundfarbe** `rgba(27,27,29,0.90)` liess 10% der gecachten Raster der vorigen Surface durchscheinen — WebKitGTK invalidiert Compositor-Layer nicht deterministisch, deshalb switchte es zwischen rund und eckig. Fix: `--ov-surface` von `rgba(27,27,29,0.90)` → `#1b1b1d` (opak) und `--ov-surface-strong` von `rgba(20,20,22,0.94)` → `#141416` (opak) in `overlay-pill.css`. Ein opaker Hintergrund blockiert jedes residuelle Durchscheinen, selbst wenn die alte Layer gecached bleibt. Visueller Unterschied minimal (das Overlay-Fenster ist transparent/decorationless und sieht den Desktop dahinter ohnehin nicht). Die Repaint-Beltings (1px-Oszillation, force_set_size, key-Remount) bleiben als Defense-in-Depth, sind aber nicht mehr die einzige Loesung.
- **Inkonsistenter 06b-State nach clipboard_only-Commit (2026-07-08):** Bei `clipboard_only` erschien nach dem Commit (besonders beim zweiten Lauf) ein inkonsistenter, eckiger 06b-State (Result-Actions-Pill blitzte kurz auf trotz Commit-Suppression). Wurzel: der Commit-Pfad (`commit_pending_transcription_preview`, `sessions.rs:439-466`) emittiert `transcription` auf **zwei Channels** — `wordscript-native-event` (via `complete_processing_session_from_transcription`, reiner Status-Sync) und `wordscript-event` (autoritativ, mit `insertion`/`delivery`). Beide dispatchten bisher `TRANSCRIPTION` und setzten `lastResult` mit frischem `occurred_at_ms`. Das one-shot `suppressNextResultActionsRef` konsumierte das erste Event, das zweite durchlief → Result-Actions-Pill erschien. Fix: der native-event `transcription`/`transcription_corrected`-Pfad dispatcht jetzt `NATIVE_TRANSCRIPTION_SYNC` (neue Action), die nur `status`, `lastTranscription` und `pendingResult` aktualisiert, aber **nicht** `lastResult` setzt — `lastResult` und die Surface-Entscheidung gehoeren ausschliesslich dem autoritativen `wordscript-event`-Transcription. Dadurch feuert der `lastResult`-Effect bei einem Commit nur noch einmal und die Suppression greift konsistent ueber alle Laefe.
- **`insert_behavior`-Revert in Settings (P1):** Zwei Wurzeln zusätzlich zum `CONFIG_FILE_LOCK`. (C1 Frontend) Der `setForm({ ...state.config })`-Effect überschrieb die Form bei jedem `ready`-Event; überlappende Saves revertierten die Form A→B→A→B. Ein `inFlightSaveCountRef`-Guard unterdrückt den externen Form-Sync während eines in-flight Saves und re-synct aus dem autoritativen Runtime-Config beim Settle. (C2) `resolve_current_processing_mode` rief `load_from_disk()` ohne Lock auf; dessen bedingter Re-save raste mit `save_config`. `load_from_disk` nimmt jetzt den Lock für ungelockte Caller; gelockte Caller nutzen `load_from_disk_within_lock()` (reentrancy-sicher). `reconcile_legacy_secret_before_save` läuft innerhalb von `save_config`'s Lock. Zusaetzlich ein geräuschfreier Diagnostic-Log, der nur feuert, wenn Normalization `insert_behavior` tatsaechlich umschreibt. (Plan `1782892412000`, P1)
- **Text kommt nicht ins Clipboard bei `clipboard_only`/Wayland (P3):** `write_wayland_clipboard` returned auf dem 400ms-Timeout-Zweig optimistisch `Ok(())` und maskierte einen wl-copy ohne serving Daemon als `clipboard_written=true`; die Chain fiel nicht auf arboard durch. Fix: geboundeder `wl-paste`-Read-back verifiziert, dass das Clipboard den Text haelt; bei Mismatch/Leerlauf → `Err` → arboard-Fallthrough. Zusaetzlich gezielte Insert-Driver-/Clipboard-Diagnostics in der Diagnostics-Ansicht. (Plan `1782892412000`, P3)
- **Scroll-Ruckeln in Settings (alle Tabs, besonders History und Profiles):** `WEBKIT_DISABLE_COMPOSITING_MODE=1` zwang WebKitGTK in den Cairo-Software-Rendering-Pfad. Fix: GPU-Compositing standardmäßig aktiviert + CSS-Kostenreduktion (shadows, backdrop-filter, background-attachment, contain, transition-colors). Siehe `docs/handoffs/SETTINGS_SCROLL_PERFORMANCE_HANDOFF.md`.
- **Schwarzer Block:** WebKitGTK malt outer `box-shadow` opak → `--ov-shadow: none` + `--ov-shadow-recording: none` in `overlay-pill.css`.
- **Drag + Button-Click (Input-taub):** `pointer-events: none` auf overlay-roots macht Pill auf WebKitGTK taub → `pointer-events: auto` auf `.ov-scope`.
- **Clipping (Pill-Enden abgeschnitten):** Zwei konkurrierende invoke-Pfade + GTK-async `set_size` → Fenster bleibt bei 256/388. Fix: Rust `OverlaySurface::dimensions()` auf fixe 440×60 (flat) / 460×164 (edit), beide Pfade konsistent.
- **Overlay verschwindet nach 1. Transkription:** `park_overlay_window` ohne `hide()` → Reveal überspringt Positionierung. Fix: `park→hide`.
- **Audio-Regression:** Poller-Thread destabilisierte Audio-Init → entfernt.
- **States überlagern sich beim Wechsel:** flat→flat Wechsel → kein `set_background_color` → WebKitGTK behält compositing-Layer. Fix: `set_background_color` immer + `will-change: opacity` entfernt.

### Removed

- `WORDSCRIPT_ENABLE_WEBKIT_COMPOSITING` Environment-Variable — ersetzt durch `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING` (invertierte Semantik, intuitiver).
- `shadow-card` von allen Settings-Karten (FormCard, StatTile, Rule-Cards, Workspace-Tabs).
- `backdrop-filter: blur(12px) saturate(140%)` von der `.material`-Klasse.
- `animate-in fade-in-50 duration-150` Tab-Wechsel-Animation aus `SettingsWindow.tsx`.
- `transition-colors` von Scroll-Containern (PromptsTab Rule-Cards/Profile-Buttons/Tab-Buttons, HomeRecentList).
- Dynamisches pill-basiertes Resize (ResizeObserver + offsetWidth-Measuring) — nicht zuverlässig auf GTK.
- `transform: scale(0.87)` bleibt, aber `will-change: opacity` entfernt (reduziert Layer-Cache).
- Unused Konstanten `OVERLAY_COMPACT_WINDOW_WIDTH`, `OVERLAY_PROCESSING_PREVIEW_WINDOW_WIDTH`, `OVERLAY_RESULT_ACTIONS_WINDOW_WIDTH`, `OVERLAY_EDIT_MODE_WINDOW_WIDTH`, `OVERLAY_EDIT_MODE_WINDOW_HEIGHT`, `OVERLAY_WINDOW_HEIGHT`.

## [Unreleased] — 2026-06-10

### Added

- native dictation runtime with trigger, capture, Groq transcription, transform, insertion and recovery in Rust
- active settings surface for Provider & Models, Input, Text Rules, About and Diagnostics
- manual cross-platform release build matrix and release runbook for the current commercial release build-up
- benchmark matrix for donor repositories, feature fit and staged WordScript expansion
- core execution plan that maps donor files to the next WordScript kernel slices
- native transcription history with persistence, retention, delete/clear commands and retry-based re-processing from stored raw transcripts
- local text profiles that bundle transcription context, dictionary and snippets into native runtime config and active Text Rules UI
- curated local profiles for core ICPs with Customer Success, Sales, Founder/Ops, Recruiting and Product/Engineering baselines, seeded directly into the app config on first run
- a full local runtime lane behind the existing `local_preview` compatibility id, combining `whisper-cli` STT with local Ollama cleanup, typed runner/model/chat setup truth and a separate `local_correction_model`
- agent mode with hybrid intent detection: a heuristic O(n) word scan (scores agent-name position and imperative-verb presence) decides directly for high-certainty texts; the uncertain zone (score 0.20–0.74) routes to a lightweight LLM classifier that distinguishes direct agent addressing from incidental name mention or standalone imperatives; `apply_agent_transform` executes confirmed instructions while unconfirmed dictation falls through to the normal correction pipeline
- correction guardrail diagnosis logging: every guardrail rejection in `normalize_correction` now emits a structured runtime log entry with the rejection reason and active mode flags, so Rebuild Lab and log exports can surface which guard fired
- explicit `ProcessingMode` contract (auto / cleanup / rewrite / agent / prompt_enhance / verbatim) with per-mode `EnhanceSubMode` (enhance / expand) and `PromptTarget` lives in `AppConfig`; the Modes tab, ProfileDock label, OverlayWindow side label and `useProcessingMode` hook all read the resolved mode end-to-end
- `mode_router` resolves the effective processing mode per session from manual override and active profile work mode; when the effective mode is `auto`, `resolve_auto_mode` resolves it per transcription into a concrete mode (agent / prompt_enhance / cleanup) using transcript text, agent name and optional workspace context; the renderer queries the effective mode through the `resolve_current_processing_mode` tauri command
- `workspace_context` detects the active foreground app on macOS, Windows and Linux through `run_with_timeout` with dedicated pipe-drain threads (fixes empty captured stdout/stderr on all platforms), and feeds the result into `resolve_auto_mode` as a probability signal (not a deterministic mapping)
- `prompt_enhance` module structures and expands dictated prompts through the active LLM lane, runs them through a guardrail chain covering empty input, prompt-execution, language mismatch, length budget and semantic drift, and is now wired into the native pipeline when the effective mode resolves to `prompt_enhance`
- a dedicated Modes tab in Settings exposes the mode radio (Auto first), sub-mode and target pickers, an always-visible cleanup settings card, the `auto_detect_mode` switch (workspace context as probability signal for Auto mode) and a mode picker / cycle surface; per-mode hotkeys (`mode_picker_hotkey`, `mode_cycle_hotkey`, `mode_auto_hotkey`, `mode_verbatim_hotkey`, `mode_cleanup_hotkey`, `mode_rewrite_hotkey`, `mode_agent_hotkey`, `mode_prompt_enhance_hotkey`) are persisted in `AppConfig` with platform-specific defaults
- Dev-Build-Cache-Strategie: `[profile.dev]` mit `debug=1` haelt `target/` kleiner; optionale `sccache`-Integration (via `RUSTC_WRAPPER`) vermeidet 27 GB Verlust nach `cargo clean`; `npm run clean:dev` als manueller Reset; `src-tauri/.cargo/config.toml` und `setup-tauri.sh` Schritt 3/6 dokumentieren den Pfad

### Changed

- Home screen refactored to enforce the active design system: 3 explicit background layers (`--bg-base` / `--bg-surface` / `--bg-elevated`), 5-step type scale (12 / 14 / 16 / 20 / 28 px), 4-point spacing (20 px card padding, 32 px between sections), and a single `StatusDot` primitive. "Ready to dictate" is now a real hero, "Recent dictations" is a clean list, and "Quick actions" are distinct action rows. SW-labs orange is reserved for the primary Capture button.
- `--surface-elevated` retuned from `#1e2730` to `#1c2127` so cards visibly separate from the window background across the whole shell.
- Shell-Layout-Overflow behoben: Header, Content-Wrapper und Footer in `SettingsWindow` erhalten `min-w-0`, sodass Status-Pills und Cancel/Save-Buttons bei schmalen Fenstern nicht mehr am rechten Rand abgeschnitten werden.
- Home-Cards nutzen jetzt `border-border-strong`, damit die drei Background-Layer (Base / Surface / Elevated) im Home-Bereich klar lesbar sind.
- HomeHero: redundantes "Overview"-Eyebrow-Kicker entfernt.
- Home-Recent-Dictation-Rows enger gesetzt (44 px Mindesthoehe, 12 px vertikales Padding).

- replaced Windows `RegisterHotKey` with `WH_KEYBOARD_LL` low-level keyboard hook so system-reserved key combos including `Win+*` and `Ctrl+Win+*` work reliably; the hook runs on a dedicated thread with injected-event filtering, modifier tracking and `VK_F24` dummy injection to prevent the Start menu from opening after Win-key combos
- reduced Linux X11 hotkey polling interval from 50 ms to 1 ms for noticeably lower latency
- added a macOS CGEventTap fallback path for regular hotkeys that `RegisterEventHotKey` cannot grab (system-reserved combos like `Cmd+Space`); the tap requires macOS Accessibility permission
- Linux X11 auto-paste now prefers direct XTEST keystroke injection (`xdotool type`) for texts up to 800 characters, bypassing the clipboard entirely and avoiding the recurring "This client would like to access the clipboard" permission prompt from KDE Klipper; longer texts still fall through to the existing clipboard-then-Ctrl+V path
- dismissing the result-action overlay now keeps that same action-state pill rendered through the leave transition instead of briefly swapping back to the compact waveform overlay, so `Done` and successful action closes no longer create a stacked overlay flash
- the live recording waveform now rises faster and with more speech gain in the standard compact overlay, so normal dictation no longer looks overly defensive or sluggish before the bars respond
- the native overlay host now re-syncs immediately when an already visible overlay switches between `compact`, `processing_preview` and `result_actions`, so wider action or preview states no longer render inside stale compact-window geometry and visually overlap
- AI cleanup now receives the active profile context and preferred dictionary spellings as conservative preserve hints, so mixed German/English dictation, colloquial borrowings and product terms are less likely to be flattened or mistranslated during cleanup
- new and fallback cleanup defaults now use `llama-3.3-70b-versatile` instead of the older `llama-3.1-8b-instant` path when no explicit correction model is configured
- Groq transcription now uses the same bounded profile, dictionary and explicit STT-hint prompt path as the local CLI lane, so STT quality no longer depends on `local_preview` being the only provider with term-aware prompt bias
- Diagnostics history and decoded runtime-log hints now render through isolated memoized subtrees, so filter edits and background refreshes no longer rebuild every visible diagnostics card on each parent render
- Text Rules now preserves structural sharing for profile patches and isolates dictionary and snippet cards behind memoized components, so editing one rule no longer forces every unchanged rule card to rerender
- the V1 runtime slice now carries an explicit `provider_profile` through its native contract and uses hermetic default-config test helpers, so diagnostics and transcript previews no longer depend on disk-config drift or cloud-model name heuristics for the active provider label
- profile-dependent STT bias now drops generic profile categories from both the cloud/local transcription prompt and cleanup context, forwards only concrete lexical hints plus preferred spellings, and ships curated starter profiles without prefilled snippet-like STT hints that could pull dictation off-topic
- Text Rules analysis now exposes the exact automatic STT bias that will be forwarded plus warnings when profile context or STT hints are too broad for the conservative bias path, so profile quality problems are visible before dictation instead of only after bad transcripts
- the correction LLM system prompt now explicitly calls out Aufforderungen, Befehle and Anweisungen in the input as dictated user text — the model must not execute, confirm or react to them, only clean them and preserve their imperative form; previously only questions were covered by this guardrail instruction
- polished mode now runs a dedicated `has_new_first_person_action_start` guard because `has_suspicious_start` is disabled when `professionalize = true` to allow legitimate reformulation; the new guard catches newly introduced first-person action starts such as "Ich schicke/schreibe/erstelle/führe…" or "I'll send/create/help…" that signal the model is acting as an assistant rather than cleaning the dictated text
- `has_suspicious_start` now also blocks corrections that introduce `"gerne "`, `"klar,"` and `"klar "` as new sentence starts, covering common LLM acknowledgment patterns that were previously not detected in non-polished modes
- `contains_new_assistant_phrase` now additionally catches `"gerne erledige"`, `"ich führe das aus"`, `"ich erledige das"`, `"wurde ausgeführt"`, `"aufgabe erledigt"`, `"i'll take care"`, `"i've done that"` and `"task completed"` as newly introduced execution-response phrases
- the agent mode intent classifier prompt now explicitly distinguishes direct agent addressing with a task from incidental agent-name mention: "yes" only when the user addresses the agent by name AND assigns a task; standalone imperatives without agent-name addressing are classified as dictation even if an imperative verb is detected
- the active profile work-mode contract is now primarily expressed as `ProcessingMode` (cleanup / rewrite / agent / prompt_enhance / verbatim); legacy `rewrite_style` is now only a migration input, mapped by `migrate_legacy_processing_mode` (`polished` → rewrite, `verbatim` → verbatim, fallback → cleanup)
- text profiles persist `processing_mode`, `enhance_sub_mode` and `prompt_target` alongside the existing rewrite/insert/recovery defaults, and the renderer reads the resolved mode through `resolve_current_processing_mode` instead of inferring it from `rewrite_style` alone
- the documentation set was consolidated into README, VISION, ARCHITECTURE, DEVELOPMENT, DESIGN_SYSTEM and REFERENCE
- planning docs now explicitly capture the two remaining transcription-reliability follow-ups: a regression corpus from real failed dictation samples and a profile-owned bias-health / bias-policy layer on top of the new conservative preview and warning contract
- product scope and wording now consistently describe WordScript as a dictation-first desktop app on `0.2.2-alpha`
- future planning docs now describe sync as an optional WordScript-owned local-first layer instead of leaving peer-to-peer or external hub ownership ambiguous
- native session transitions now run through shared session helpers, so trigger, commands and pipeline completion no longer finalize the same lifecycle edges independently
- native pipeline completion, empty results and provider/insert failures are now guarded by the active processing session id, so stale async results after aborts or newer captures are ignored instead of overwriting runtime state
- provider status, credential and transcription dispatch now run through shared provider commands and types, while Groq remains the only wired production provider
- provider status now exposes typed capabilities and provider modes, while provider errors include retryability and a user recovery action instead of only free-text failure messages
- provider selection now exposes a second `local_preview` compatibility lane that uses an external `whisper-cli` runner, local ggml models and local Ollama cleanup without changing the capture, transform, insertion or recovery pipeline shape
- `local_preview` now strips timestamped `whisper-cli` segment output more cleanly and resolves common model variants from model directories instead of only exact `ggml-<model>.bin` names
- `local_preview` provider status now validates the configured runner path instead of treating every non-empty env value as ready, and Settings exposes a typed local setup contract with stable issue codes for runner/model/chat gaps
- `local_preview` setup truth now follows the currently selected local model instead of always checking `base`, so Settings and provider gating no longer report false readiness for a different configured model
- Provider & Models now turns the native `local_setup` contract into a local runtime preflight checklist for the speech runner, STT model, cleanup endpoint and cleanup model, so first-run local setup no longer depends on reading raw diagnostics copy first
- Input now surfaces a first-dictation preflight checklist for trigger, microphone, native insert and recovery readiness, using existing config, audio status and native insertion truth instead of adding a separate setup state
- `local_preview` now performs an active runner probe and surfaces stable `runner_probe_failed` and `runner_probe_timed_out` issue codes instead of treating filesystem presence alone as executable health
- `local_preview` model profiles are now discovered natively from the configured local model path or model directory, and quantized names such as `large-v3-q5_0` survive discovery without being normalized into unusable lookup keys
- `local_preview` now forwards the active transcription context prompt to `whisper-cli --prompt` and exposes prompt-bias support through the shared provider capability contract instead of silently dropping local bias input
- `local_preview` profiles now classify discovered and fallback local models into `fast` or `quality` presets, so the Settings shell can describe local latency-vs-accuracy tradeoffs without a fake generic `local` mode
- local runtime config now persists the selected local provider profile id, separate local cleanup model and explicit prompt-bias controls, so Settings can save `fast` vs `quality`, `off` vs `profile` vs `profile + terms`, `carry initial prompt` and local cleanup choice as native runtime truth instead of transient UI state
- `local_preview` now materializes two real profiles per local model (`fast` and `quality`) and maps them to distinct whisper-cli decode arguments, instead of inferring latency-vs-quality only from the model family name
- local preview now persists explicit `beam_size` and `best_of` decode controls on top of the selected `fast` or `quality` profile, so local latency-vs-search depth is no longer locked behind preset-only behavior
- transcription history and Diagnostics now surface the local provider profile, prompt-bias strength, prompt carry flag, beam size, best-of values and resolved cleanup endpoint/model for local runtime runs, so runtime triage can separate setup errors from decode, cleanup or prompt drift
- local decode tuning is now stored per local provider profile, so `base-fast`, `base-quality`, `large-quality` and other profile ids retain their own saved `beam_size` and `best_of` values instead of overwriting one global local decoder state
- local prompt-bias tuning is now stored per local provider profile as well, so `off` vs `profile` vs `profile + terms` plus `carry initial prompt` now switch with the selected local `fast` or `quality` profile instead of leaking one global local prompt state across profiles
- Rebuild Lab now reads the active local runtime contract from the native `v1_slice_status` snapshot and warns when the unsaved Settings draft differs from the persisted runtime provider/profile/prompt/decode/cleanup contract
- Rebuild Lab runtime snapshots now also pull live provider readiness and native capture status, so Diagnostics can show resolved `whisper-cli`, model, cleanup endpoint and cleanup model paths plus current capture device/state instead of only replaying persisted config values
- text profiles now persist a first explicit work-mode contract for rewrite, delivery and recovery defaults, with normalization and clone/template safety in both Rust and TypeScript instead of leaving the next slice as plan-only vocabulary
- active text-profile work modes now drive native transform cleanup defaults, legacy insert auto-paste behavior, durable history metadata and the V1 diagnostics runtime contract instead of remaining a Settings-only summary
- backend transcription events now carry raw transcript, active profile and work-mode metadata alongside insert results, so overlay and other runtime surfaces can read the same post-run truth without rebuilding it from separate heuristics
- native insertion results now expose a typed recovery action, user-facing recovery message and clipboard-restore status, so UI and diagnostics no longer infer recovery state from fallback text alone
- native history now supports server-side provider/status/profile filters, JSON export, persisted limit/retention policy and typed insert-recovery metadata instead of only a fixed in-memory diagnostics slice
- active config and settings terminology now use `provider` consistently, while the old JSON `groq_api_key` survives only as an explicit legacy migration field
- legacy Groq-secret migration now happens in the native config/provider path before save, so the frontend no longer owns or receives the legacy secret field
- Linux insertion now uses an explicit native driver chain with visible helper diagnostics for `wl-copy`, `xdotool`, `wtype`, `ydotool`, `enigo` and scratchpad recovery instead of implicit paste fallbacks
- pure Linux Wayland sessions no longer attempt `wtype`, `ydotool` or `enigo` auto-paste to avoid the compositor "Remote Control / Control input devices" privilege prompt; clipboard-only with manual paste is now the safe default on pure Wayland, while hybrid X11/Wayland sessions with xdotool remain unchanged
- Linux insert runtime now classifies stderr from `xdotool`, `xdotool type`, `wtype`, `ydotool` and `enigo` for known portal-prompt signatures (KDE Plasma "Control input devices", xdg-desktop-portal InputCapture) and falls back to clipboard-only with a precise `PasteDisableReason` and recorded `last_portal_prompt` on the native status, so the UI can show the user the actual reason instead of a generic failure
- native insert status now exposes a real xdg-desktop-portal RemoteDesktop grant request for KDE Plasma 6 and GNOME Mutter via the session bus, with a persisted restore token under `$XDG_RUNTIME_DIR/wordscript/remote-desktop.token` so the "Control input devices" prompt only needs to be accepted once per user
- Linux paste status now distinguishes CachyOS / KDE Plasma 6 / GNOME Mutter / Hyprland / Sway / KDE Plasma 5 instead of one generic Wayland block, with composited `paste_disabled_reason` messages that name the next concrete setup step (port-kde install, wlr-virtual-input, Plasma 6 upgrade, etc.)
- Settings `About` and `Input` panels now render the detected compositor, the xdg-desktop-portal daemon + RemoteDesktop interface status, the active portal session, and the last recorded portal-prompt signal (driver + stderr excerpt) so the Linux insert limit is visible at a glance instead of being hidden behind a generic "recovery only" status
- Rebuild Lab now separates durable transcription history from transient runtime logs while reading both from the same native runtime truth
- Rebuild Lab runtime snapshots now expose a machine-readable capture/provider/transform/insert timeline with per-step state, duration and stable error codes instead of a single coarse stage plus free-text failure only
- Text Rules now scopes transcription context, dictionary and snippets to the selected local text profile while keeping preview, import/export and diagnostics tied to that active profile
- Text Rules profiles now also carry explicit optional `stt_hints`, and import/export preserves those hints alongside context, dictionary and snippets
- Settings now exposes the active text profile globally in the sidebar with a manual switcher, avatar badge and quick path into the Text Rules editor, while shared helper logic keeps shell and editor profile patches aligned
- curated ICP baselines are now seeded once into the persisted app config and shown as normal profiles with a temporary `Curated` status instead of living as a separate hardcoded starter catalog
- Text Rules now uses a sequenced workspace layout with a compact setup deck for profile editing and curated-profile picks, top stage navigation and one dominant editing surface at a time instead of stacking profile, starter and rule-editing surfaces together
- snippet triggers no longer leak into automatic STT bias; the Text Rules context workspace now exposes a separate explicit field for short spoken cues that should actually be forwarded to the transcription request
- Input and Diagnostics now name scratchpad recovery, diagnostic preview transcript and persistent transcription history as separate native data surfaces, and Diagnostics exposes the native history store path directly in the UI
- VISION, DEVELOPMENT and README now describe long-term assistant / computer-use expansion as a later platform stage without widening the active V1 scope
- Text Rules documentation now reflects the real native order `active profile -> transcription context -> dictionary -> snippets`
- planning and design docs now name Settings/Overlay UI polish as the current product bottleneck, with a native-feeling macOS utility-app target plus concrete donor and style-reference repos for the next UI pass
- planning docs now also describe the next post-core product phase explicitly: work-mode profiles, live preview plus controlled commit, a product-ready provider stack, a first-class local lane and guided setup/permissions/packaging, while deferring broader openwhispr platform scope like notes, search, sync, MCP and assistant features
- planning docs now explicitly treat profile-dependent transcription reliability as the current launch blocker, keep release build-up as an internal path, prioritize Settings-tab polish over another broad overlay redesign, and clarify that `local` and `self_hosted` are not the same user-facing mode
- the core execution plan now treats the macOS-utility UI target and user-facing usability as hard product gates for slices 7 to 11 instead of leaving them implicit in the design docs
- donor catalogs and benchmark docs now track menu bar utilities, keyboard-first tools and desktop productivity shells as secondary UI/UX references for the macOS-native polish pass
- Settings now uses a calmer utility-style shell with grouped navigation, a persistent profile dock, a compact tab header and one dominant content surface instead of the denser intro-band and context-rail experiment
- the profile dock now surfaces profile defaults for rewrite, delivery and recovery as an honest summary of the new work-mode contract, without pretending that later runtime adoption steps are already complete
- included ICP profiles now stay visible in the normal Text Rules profile library, can be selected, edited, duplicated or deleted like user-created profiles, and untouched included profiles refresh their bundled work-mode metadata from the current seed data without being re-added after deletion
- Diagnostics now uses the same calmer panel language inside its dedicated pop-out preview window, instead of a separate decorless shell with a disconnected preview layout
- the overlay now reads states more clearly through calmer material treatment and a dedicated side-state label for live, paused and processing moments
- the overlay now expands into a short post-run preview that shows active profile, work mode, raw vs final transcript and insert outcome from the guarded runtime payload, while full live-preview and controlled-commit actions remain a later slice
- the overlay post-run snapshot now carries native history metadata and routes `insert`, `retry` and `restore` quick actions through the existing native commands, so controlled-commit preparation stays on the same runtime and recovery truth instead of inventing an overlay-only action path
- `clipboard_only` work modes now stop on a real processing-time preview before delivery, and the overlay commits that preview through the same native insert, history and session-completion path instead of faking a second frontend-only commit layer
- the manual release build-up workflow now aggregates per-platform bundle artifacts into checksummed handoff archives and can create or refresh an internal draft GitHub release without implying a public installer or updater channel
- the overlay no longer expands into a second preview surface after transcription; it now uses a smaller fixed stage without a separate shell-backdrop layer, keeps the same in-place `copy`, `retry`, `restore` and `done` actions, starts dragging only after real pointer movement so buttons remain single-clickable, and drives fewer wider waveform bars with a stronger visual gain while `clipboard_only` profiles still stop on the same real processing-time preview before commit
- Text Rules now opens with a compact process summary, calmer utility controls and a pinned stage rail so profile setup and starter selection stay secondary to the active editing workspace
- pull request CI now runs frontend tests and Rust tests on macOS and Windows in addition to Ubuntu
- the manual release build-up workflow now runs frontend tests and Rust tests before bundling
- platform support copy now exposes native prerequisites and honest limits for insertion, including macOS development-mode privacy requirements
- About, docs and backend surface now describe the release path as in progress, with no published releases yet
- release docs now explicitly describe Linux AppImage packaging as an in-progress `linuxdeploy` lane instead of implying a stable public release track
- the About release card and native update check now stay strict about published GitHub releases; internal draft handoffs remain workflow-only and no longer pretend to be visible through the public latest-release endpoint
- README, VISION and REFERENCE now explain SW labs, SW-Bench and the community-build posture more directly
- repo setup and pre-commit behavior no longer regenerate legacy `BUILD_ID` and `build_info.json` files
- Diagnostics can now open either inside Settings or as a dedicated pop-out utility window while reusing the same active Rebuild Lab panel

### Deprecated

### Removed

- `build-sidecar.sh` und `build-sidecar.ps1` aus dem aktiven Repo-Pfad entfernt
- alter Python-Sidecar-Bestand inklusive `wordscript/`, `speech_to_text.py`, `WordScript.spec`, `requirements.txt` und `config.example.json` entfernt
- sichtbare AI-Assistant-, Account/Sync- und General-Placeholder aus der aktiven Settings-Oberflaeche entfernt
- totes `show_tray_icon`-Config-Feld aus dem aktiven Runtime-Vertrag entfernt
- veraltete `rebuild-lab.css` entfernt; das aktive Diagnostics-Pop-out nutzt jetzt dieselbe Settings-Shell wie das eingebettete Panel

### Fixed

- Linux dev crash after a while: the native audio path no longer keeps a persistent `rodio` output stream for the whole session; every sound cue opens a fresh short-lived stream and drops it after playback. The cpal capture stream now sets a `stream_error` flag on its error callback, the monitor stops the capture cleanly with a new `StreamError` reason, and `stop`/`abort` skip `pause()` on a dead stream. A hard `max_samples` cap was added to the capture buffer as a safety net. This removes the previous crash surface when ALSA/PulseAudio/PipeWire/JACK state changes during a long dev run.
- Linux hotkeys, overlay behavior, timeout handling, clipboard restore and diagnostics reflect the current native runtime path
- the native pipeline no longer completes the same session twice when insertion succeeds, and failed insertion now finishes the session on the pipeline owner instead of inside the insert adapter
- provider config values now normalize to a supported runtime provider, and post-correction uses the same provider dispatch layer as transcription
- history entries now keep the active text profile name through success, empty, retry and failure paths instead of dropping profile context in diagnostics
- the settings UI now keeps cloud and local model slots separate, stores local cleanup in its own lane-specific slot, shows honest helper prerequisites for the local runtime and hides API-key actions when the local lane is selected
- retry in diagnostics is now a real re-process path through transform and insertion, not only a clipboard restore shortcut
- the client now exposes release build-up honestly without implying published installers or working in-place updates
- README, DEVELOPMENT and REFERENCE now include explicit macOS and Windows bootstrap paths instead of a Linux-only quick start
- das Settings-Fenster nutzt wieder native Fensterdekorationen statt plattformfremder Fake-Controls im Inhalt; die Shell scrollt dadurch auf Linux wieder ruhiger und bleibt bei einer einzigen dominanten Content-Flaeche
- das Settings-Fenster startet jetzt etwas groesser und hat strengere Mindestgroessen; Sidebar, Footer und Hauptinhalte bleiben dadurch beim Verkleinern sichtbar statt links oder vertikal wegzuclippen
- die linke Sidebar haelt Profil- und Projektbereich jetzt auch bei kleineren Hoehen sichtbar; nur der Navigationsblock scrollt noch intern, statt den unteren Bereich aus dem Fenster zu schieben
- About- und Utility-Links zeigen jetzt auf die aktiven SW-Bench-/SW labs-Ziele und werden nativ über den Opener-Plugin geöffnet statt über tote oder falsche Webview-Links
- Provider-Selects erzwingen jetzt dunkles Native-Styling statt weißer, unleserlicher Browser-Defaults
- der Groq-Key-Status ist jetzt neutral, solange ein Key nur im Secret Store liegt; grün wird erst nach expliziter erfolgreicher Validierung verwendet
- der native Trigger-Vertrag deckt jetzt Start/Stop, Pause/Resume und Abort mit registrierten Hotkeys ab; Settings speichern dabei die tatsächlich normalisierten nativen Shortcut-Werte zurück
- README public-project copy no longer contains the old `pay -wall` typo
- the overlay now syncs idle visibility back through the native host and parks the transparent window offscreen instead of relying only on CSS idle state, reducing stale black or frozen overlay surfaces on Linux/XWayland and KDE-style compositor paths
- overlay placement now has a real runtime contract: dragging the overlay persists a remembered manual position across later runs, and Settings can switch between remembered placement and preset display anchors per monitor
- the overlay now uses a smaller symmetric live stage, widens only for preview and result actions so button labels stay fully visible, removes the extra outer black shadow feel, and maps low speech levels into a much more legible waveform instead of barely moving bars
- the Input placement card now hides display and anchor controls while `Remember last drag position` is active and replaces them with a dedicated remembered-position summary
- overlay manual placement now only updates from real user drag movement instead of every host-side window move, and the remembered position is normalized against the compact overlay footprint so processing/result states no longer overwrite secondary-monitor placement when the surface widens
- the overlay waveform bars now use a more conservative low-level gain curve, so speech stays visible without the previous overreactive near-constant peak behavior
- overlay manual placement now derives the remembered target monitor from the saved logical drag reference instead of trusting `current_monitor()`, so cross-monitor drags on left or vertical displays no longer get reclamped against the wrong work area on the next reveal
- long overlay drags now suppress button activation until the drag actually ends, so dropping the window after a longer move no longer triggers `copy`, `retry`, `restore` or other overlay actions by accident
- compact and action-state overlays now share the same remembered top-left drag position, so dragging either surface updates the single location used the next time any overlay state appears
- the standard live overlay now uses state-specific right-side sizing and padding, so recording, `working`, and action states no longer inherit the same cramped timer/status spacing
- the live waveform now falls back to a calmer idle silhouette for near-room-noise input and drives much taller bars once actual speech is present, instead of overreacting while quiet and underreacting while speaking
- the universal CSS reset in `src/styles/globals.css` now lives inside `@layer base` instead of as unlayered top-level CSS; unlayered rules always beat Tailwind's layered utilities regardless of specificity, so `padding: 0` on `*` was silently nulling every Tailwind padding/margin utility app-wide (sidebar outer padding, nav item padding, content-card horizontal padding) even though the correct classes were present in JSX
- the Settings sidebar header now renders the combined wordmark+logo asset as a single image at `h-10` instead of a separate icon glyph plus "WordScript" text label

### Security

- Groq API keys stay in the OS secret store and are scrubbed from the JSON config on save
- legacy Groq keys from old JSON configs are migrated natively into the OS secret store before the sanitized config is persisted again

## [0.2.0-alpha]

### Added

### Changed

### Deprecated

### Removed
- Debug-Code aus `SettingsWindow.tsx` und `lib.rs` entfernt

### Fixed
- Linux/Wayland: fataler `Gdk Error 71` beim App-Start behoben; der App-Start faellt fuer transparente/dekorationslose Fenster auf XWayland zurueck
- Linux/Wayland: Overlay-Crashs bei `show()`/`hide()`/`set_always_on_top()` behoben; die Sichtbarkeit wird stattdessen ueber Positionierung gesteuert
- Linux/Wayland: Crashs des Settings-Fensters bei `hide()`/`show()` behoben; `minimize()`/`unminimize()` und ein dauerhaft sichtbares Window-Setup stabilisieren den Pfad
- alle Plattformen: Dev-Config-Pfad von `./config.json` auf den einheitlichen User-Config-Pfad korrigiert, sodass Groq-Konfiguration und Transkription wieder funktionieren
- alle Plattformen: IPv6-bedingte Groq-Timeouts wirken im neuen Pfad nicht mehr blockierend, weil der IPv4-Transport-Fix mit dem korrigierten Config-Path wirksam wird

### Security

## [0.1.6-alpha]

### Added

### Changed

### Deprecated

### Removed

### Fixed
- alle Plattformen: Groq API-Calls mit 20 bis 60 Sekunden IPv6-Connect-Timeout durch erzwungenen IPv4-Transport stabilisiert
- Linux Dev-Mode: Python-Sidecar startet ueber das Projekt-Root jetzt verlaesslich mit der `.venv`, statt unkontrolliert das System-Python zu verwenden

### Security

## [0.1.5-alpha]

### Added

### Changed

### Deprecated

### Removed

### Fixed
- Linux: Groq API-Calls mit fehlgeschlagenem IPv6-Fallback durch erzwungenen IPv4-Transport stabilisiert

### Security
