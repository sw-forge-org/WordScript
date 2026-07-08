# WordScript — Design System

Stand: 2026-06-20

## Zweck

Das Design System beschreibt die aktive Produktsprache von WordScript. Es ist keine Wunschliste, sondern die Regelbasis fuer Overlay, Settings und Diagnostics im aktuellen App-Pfad.

## Produktprinzipien

- utility-first statt dashboard-first
- klarer Runtime-Zustand statt dekorativer Bewegung
- kleine Flaechen mit hoher Lesbarkeit
- Fehler und Recovery muessen fuehren, nicht nur anzeigen
- Plattformgrenzen duerfen nicht von der UI versteckt werden

## Aktuelles UI-Zielbild

- Das aktuelle Problem ist nicht mehr fehlende Flaeche, sondern fehlende Ruhe, Hierarchie und Produktklarheit.
- Die Settings-Tabs werden zur **WordScript Shell** — einer Sidebar-navigierten Hauptflaeche mit Card-basiertem Layout.
- Das Overlay bleibt fokussiert, bekommt aber echte Glassmorphism ueber Tauri-transparente Fenster.
- Das Zielbild ist eine native, polished Voice-Workstation mit SW-labs-Orange-Identitaet, nicht ein generisches Web-UI im Dark Mode.
- macOS-HIG ist die primaere Referenz: Elevation durch Background, nicht Shadow; minimale Borders; knappe Motion.
- **Keine fake Traffic-Lights, keine generischen OS-Mockups.** Native Fensterkontrollen ueber Tauri `titleBarStyle: "Overlay"` (macOS) oder Host-Dekoration (Windows/Linux).
- Der aktive UI-Pass fuehrt diese Richtung ueber eine Utility-Sidebar (200px), Card-Layout, Segment-Controls, Toggle-Switches und Preview-Tabs fuer zukuenftigen Scope.
- Siehe `docs/UI_UX_OVERHAUL_PLAN.md` fuer den vollstaendigen Plan.

### Umsetzungsstand v2 (`feat/ui-overhaul-v2`)

Die Shell-Ueberarbeitung ist umgesetzt. Verbindliche Entscheidungen, die aeltere Notizen in diesem Dokument ueberschreiben:

- **Stack:** Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn/ui (new-york), auf den bestehenden v2-Tokens in `src/styles/globals.css` ueber `@theme inline`. Tokens bleiben Single Source of Truth.
- **Chrome:** **Native Titelleiste auf jedem OS** (`decorations: true`). Kein frameless Fenster, kein `titleBarStyle: "Overlay"`, kein `macOSPrivateApi`, keine fake Traffic-Lights. Das "macOS-Gefuehl" entsteht ausschliesslich aus dem Content-Design (Sidebar-Rhythmus, gruppierte Form-Cards, Controls, Typo, Motion).
- **Motion:** React bleibt 18 → Tab-/Area-Wechsel ueber `useTransition` ohne CSS-Crossfade-Animation (die fruhere `animate-in fade-in` wurde entfernt, weil sie auf WebKitGTK Scroll-Ruckeln verursachte). Tab-Wechsel sind jetzt sofort.
- **Form-Kit (`src/components/shell/`):** `Sidebar`, `FormCard`/`FormRow`, `DisclosureRow`, `Inspector`, `SegmentControl`, `Stepper`, `StatusBadge`, `Toggle`, `Select`, `ProfileSwitcher` — das System-Settings-Grouped-Form-Idiom als wiederverwendbare Bausteine. FormCards verwenden `contain: layout paint` fuer unabhaengiges Compositing und keine Drop-Shadows mehr (Elevation nur durch Background + Border).
- **Overlay:** Faux-Glass (solid semi-transparent fill + hairline top highlight, **kein** `backdrop-filter`/Blur) — transparente Overlay-Fenster koennen den Desktop dahinter nicht sehen und native Vibrancy ist auf Linux ununterstuetzt. Plus orangefarbener Recording-Glow. Siehe `docs/handoffs/OVERLAY_PHASE1_HANDOFF.md` (Phase-1-Regel: NIEMALS `backdrop-filter`).
- **Storybook v2** (`2026-06-10`): Overlay + Tokens + Components als visuelle Regression-Basis; Liquid Glass Polish fuer Overlay und Settings.
- **Home-Screen v2.1** (`2026-06-15`): 3 explizite Background-Layer (`--bg-base` / `--bg-surface` / `--bg-elevated`), 5-Stufen-Type-Scale (12/14/16/20/28px), 4-Point-Spacing (20px card padding, 32px between sections), einzelne `StatusDot`-Primitive. SW-labs orange nur fuer den Capture-Button.
- **CSS @layer base** (`2026-06-17`): universeller Reset (`*, *::before, *::after`) in `@layer base` gewrappt, damit Tailwind-Utilities nicht ueberschrieben werden.
- **Content-Visibility** (`2026-06-18`): `content-visibility: auto` und `contain-intrinsic-size` fuer lange Listen (Diagnostics-History, Text-Rules-Karten) via `@utility ws-list-item-*` in `src/styles/globals.css`.
- **Scroll-Performance** (`2026-06-21`): GPU-Compositing standardmaessig aktiviert (`WEBKIT_DISABLE_COMPOSITING_MODE` entfernt). `shadow-card` von allen Settings-Karten entfernt, `backdrop-filter` von der `.material`-Klasse entfernt, `body` background-gradient auf `background-attachment: fixed`, `contain: layout paint` auf FormCard und Scroll-Container, `transition-colors` auf Scroll-Containern entfernt, `will-change: scroll-position` auf Scroll-Container, `contain: content` auf Content-Wrapper. History-Refresh-Interval von 1.5s auf 5s erhoeht. Opt-out via `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1`.

## UI-Donoren und Stilreferenzen

- Primaere Produktdonoren fuer diesen UI-Pass bleiben `VoiceInk`, `FluidVoice` und `OpenSuperWhisper`.
- **Neu hinzugekommen: `OpenWhispr`** (nicht OpenWhisper) als primaere Informationsarchitektur-Referenz fuer die neue WordScript Shell. OpenWhispr liefert die Sidebar-Navigation, Settings-Karten-Struktur, Onboarding-Steps und die Aufteilung in Dictate/Notes/Upload/Dictionary/Chat/Settings.
- Diese Repos liefern nicht nur Look, sondern produktrelevante Patterns fuer Overlay-Ruhe, Live-Preview, Mode-Denken, Dictionary-Naehe und macOS-native Utility-Fuehrung.
- Sekundaere Stil- und UX-Referenzen werden jetzt in drei Lanes gelesen: `menu bar utilities` mit `Ice`, `MonitorControl` und `Clipy`; `keyboard-first command surfaces` mit `raycast/extensions`, `massCode`, `Zed` und `AeroSpace`; sowie `desktop productivity shells` mit `Spacedrive`, `Mullvad VPN`, `Beekeeper Studio`, `Standard Notes` und `UTM`.
- Zusaetzliche React-/TypeScript-Stilreferenzen fuer Shell und Komponenten bleiben [surajmandalcell/darwin-ui](https://github.com/surajmandalcell/darwin-ui), [andrejilderda/desktop-ui](https://github.com/andrejilderda/desktop-ui) und [kitlib/tauri-app-template](https://github.com/kitlib/tauri-app-template).
- **UI-UX-Pro-Max Skill** liefert die strukturelle Design-Datenbank: "Operation orange on dark" Calculator-Palette (Background `#1C1917`, Card `#262321`, Muted `#2C1E16`, Border `rgba(255,255,255,0.08)`), Typography-Scale, Motion-Tokens und Accessibility-Checklisten.
- **Context7 (Tauri v2 + React 18)** liefert die technische Umsetzung. Hinweis (ueberschrieben durch v2-Umsetzung): WordScript nutzt **native Dekoration auf jedem OS** statt `titleBarStyle: "Overlay"` und `macOSPrivateApi`; das Overlay bleibt `transparent: true`; Tab-Wechsel laufen ueber React-18-`useTransition` + CSS-Crossfade statt React-19-ViewTransitions.
- Diese Stilreferenzen duerfen Window-Chrome, Sidebar-Rhythmus, Control-Sprache, Secondary-Surfaces, Action-Naming und Tauri-App-Shell-Ideen liefern, aber nicht den aktiven Produktpfad in ein generisches Web-OS, eine IDE, einen File Manager oder eine VPN-App verwandeln.
- **Siehe auch `docs/UI_UX_OVERHAUL_PLAN.md`** fuer den vollstaendigen v2-Umsetzungsplan.

## Aktive Oberflaechen

### Overlay

Das Overlay ist ein Statusinstrument. Es zeigt:

- bereit
- aufnehmend
- pausiert
- verarbeitend
- Fehler oder Recovery-Bedarf
- nach erfolgreichem Lauf kompakte In-Pill-Action-Buttons statt einer zweiten vergroesserten Preview-Flaeche
- fuer `clipboard_only`-Profile im Processing-Zustand denselben festen In-Pill-Commit-Stop vor dem Commit
- im Idle keine sichtbare Restflaeche ausserhalb der Pill; der Host muss das Overlay dafuer nativ aus dem sichtbaren Bereich parken statt nur CSS-Unsichtbarkeit vorzutaeuschen
- Overlay-Placement bleibt Teil derselben Utility-Sprache: Drag verschiebt dieselbe feste Surface, nicht eine zweite Host-Schicht, und darf als gemerkte Manual-Position oder als Preset-Anchor pro Display auftreten

Es darf keine eigenen Schaetzungen ueber Audio oder Sessionzustand erfinden. Waveform, Mute und Aufnahmezustand kommen aus nativen Events.
Spaete Runtime-Ergebnisse, die nicht mehr zur aktiven `processing`-Session gehoeren, duerfen im Overlay keinen neuen Erfolgs- oder Fehlerzustand erzeugen; die UI folgt nur dem guardierten nativen Sessionstatus.

Die aktuelle Overlay-Ausbaustufe besteht aus zwei echten Runtime-Zustaenden innerhalb derselben Pill und einer kompakten Host-Buehne ohne separaten Backdrop-Layer: einem Action-Zustand nach erfolgreichem Lauf und einem Processing-Commit-Stop fuer `clipboard_only`-Profile vor dem Commit. Beide duerfen nur echte Runtime-Daten und echte Native-Aktionen zeigen. Die Live-Buehne bleibt klein; Preview- und Result-States duerfen nur so weit horizontal wachsen, dass alle Action-Labels lesbar bleiben. Im Action-Zustand gehoert keine passive Mic-Zone mehr in die Flaeche; der gesamte Nutzraum ist fuer produktive Folgeaktionen reserviert. Die naechste geplante Ausbaustufe bleibt trotzdem ein vollstaendiger Live-Preview-/Controlled-Commit-Pfad mit tieferem Textkontext und spaeter auch `scratchpad` fuer weitere Delivery-Modi. Solange dieser Pfad nicht real gebaut ist, darf die UI ihn nicht andeuten oder simulieren.

Zusaetzlich ein dritter echter Zustand: der **mode-picker** (`kind: "mode-picker"`, idle-Silhouette + ModeChip, tap-to-cycle). Er ist KEIN `recording`-Kind — der Surface-Wechsel Picker -> echtes Recording erzwingt einen `key`-Remount, damit keine stale Animations-/Layer-State der RecordingPill vom Picker herueberblutet. Die Processing Preview (Commit/Abort) ist an `insert_behavior="clipboard_only"` gekoppelt (Backend emittiert `preview_ready` nur dort und wartet auf Commit); bei `auto_paste` erscheint sie nie. Der Processing-Preview -> Result-Uebergang beim Stopp/Commit wird durch eine `bridgeResultFromProcessing`-Hold-Logik ohne `pillState=null`-Zwischenrender gefuehrt, damit auf WebKitGTK keine Compositor-Layer orphanen (Stopp-Ghosting). Plan 1782836201272. Zusaetzlich haelt fuer den **unterdrueckten** clipboard_only-Commit (der bewusst KEIN Result zeigt, Plan 2644f9b) ein `lastProcessingPreviewSnapshotRef` einen STATISchen Processing-Preview waehrend `overlayMotion!=="leaving"` bis zum sauberen idle-Unmount, sodass die Surface nie via `pillState=null` unmountet (sonst eckige Pill / Kanten). Plan 1782892412000 (P2).

### Settings

Die Settings sind die eigentliche Produktoberflaeche. Sie fuehren durch:

- Provider & Models
- Input
- Modes
- Text Rules
- About
- Diagnostics

Jeder Tab braucht einen klaren owning purpose. Globale Banner oder doppelte Erklaerflaechen ueber mehrere Tabs hinweg sind zu vermeiden.

Die aktive Shell nutzt jetzt eine klare Utility-Orientierung: gruppierte Sidebar links fuer Navigation und Profilstatus, ein kompakter Tab-Header mit Runtime- und Save-Zustand oben und darunter genau eine dominante Content-Surface. Diese Flaechen sind erlaubt, solange sie nur den aktiven Tab erklaeren und keine zweite App in der App erzeugen.

Fuer scrollende Utility-Flaechen gilt zusaetzlich: lange Kartenlisten muessen ruhig bleiben. Wiederholte Diagnostics- oder Text-Rules-Karten duerfen nicht ueber per-render Deep-Clones oder unnötige Parent-Renders permanent neu aufgebaut werden.

Profile sind jetzt sichtbare manuelle Arbeitsmodi mit Defaults fuer Processing-Modus, Insert und Recovery. Die Shell darf diese Werte anzeigen und zwischen Profilen umschalten, muss aber weiterhin aus dem aktiven Profilvertrag lesen; automatische App-/Kontextaktivierung und Overlay-Commit-Entscheidungen duerfen nicht vorweggenommen werden.
Solange profilabhaengige Transkription ausserhalb von `General Writing` noch unzuverlaessig ist, darf die UI diese Profile nicht wie fertige Produktmodi inszenieren. Die Shell muss Fuehrung und Erwartungsmanagement leisten, nicht falsche Sicherheit.
Modes ist der dedizierte Tab fuer den `ProcessingMode`-Vertrag. Er zeigt den aktiven Modus als Radio-Group (Auto, Verbatim, Cleanup, Rewrite, Agent, Prompt Enhance), den Sub-Mode (`enhance` / `expand`, nur sichtbar bei `prompt_enhance`), den `PromptTarget`, eine immer sichtbare Cleanup-Settings-Karte (AI cleanup, Remove fillers, Rewrite phrasing) und den `auto_detect_mode`-Schalter (Workspace-Kontext als Wahrscheinlichkeitssignal fuer Auto-Mode). Die acht per-Mode-Hotkeys (`mode_picker_hotkey`, `mode_cycle_hotkey`, `mode_auto_hotkey`, `mode_verbatim_hotkey`, `mode_cleanup_hotkey`, `mode_rewrite_hotkey`, `mode_agent_hotkey`, `mode_prompt_enhance_hotkey`) liegen im selben Tab mit plattformspezifischen Defaults; die Shell darf sie als Hotkey-Chips mit Reset-Button anzeigen, muss aber die effektive Mode selbst aus `resolve_current_processing_mode` lesen und nicht aus dem letzten UI-Klick.
Provider & Models muss Provider-Faehigkeiten, lokale Runtime-Grenzen und Recovery-Aktionen aus dem nativen Provider-Status anzeigen. Der Tab darf nicht aus Modellnamen raten, ob Cleanup, Prompt-Bias, Segments oder Local-Setup verfuegbar sind.
Fuer `local_preview` muessen Runner-, Modell-, Cleanup-Endpoint- und Cleanup-Modell-Probleme ueber den nativen `local_setup`-Vertrag sichtbar werden. Labels wie `Runner path invalid`, `Runner probe failed`, `Cleanup backend unavailable` oder `Cleanup model not found` sind Produkttext, keine UI-Erfindungen.
Provider & Models soll diesen Vertrag als kompakte Preflight-Checkliste zeigen: vier Schritte fuer Speech Runner, STT-Modell, Cleanup-Endpoint und Cleanup-Modell, jeweils mit Status, konkretem aufgeloestem Wert oder naechster lokaler Voraussetzung.
Der lokale Profilpicker muss auf nativen Provider-Profilen basieren. Wenn ein Nutzer ein anderes lokales Profil waehlt, muss dieselbe Selektion sofort die angezeigte Readiness, Warnungen, Modellauflosung und Fast-vs-Quality-Semantik steuern.
Wenn `local_preview` Prompt-Bias meldet, muss der Tab das als echte Runtime-Faehigkeit zeigen: der aktive Text-Profile-Context geht lokal als initialer `whisper-cli`-Prompt hinein, und die Regler fuer `off`, `profile`, `profile + terms` sowie `carry initial prompt` muessen sichtbar als echte Config-Zustaende auftreten.
Diese lokalen Prompt-Regler muessen profilgebunden arbeiten wie die Decode-Regler. Wechselt der Nutzer das lokale Profil, muss dieselbe Auswahl die fuer dieses Profil gespeicherte Bias-Staerke und Carry-Entscheidung laden statt einen globalen Restwert zu spiegeln.
Der lokale Mode-Label darf nicht generisch `local` bleiben, wenn das native Profil bereits `fast` oder `quality` liefert. Die Shell muss dieselbe Preset-Semantik auch fuer lokale Modelle spiegeln und darf den ausgewaehlten Profilmodus nicht aus dem Modellnamen neu ableiten.
Diagnostics braucht fuer `local_preview` eine sichtbare Local-Runtime-Kontraktflaeche, die Provider-Profil, Prompt-Bias-Staerke, Carry-Flag, Beam Size, Best Of, Cleanup-Endpoint und Cleanup-Modell zusammen zeigt. Diese Werte duerfen nicht nur im Provider-Tab existieren.
Diese Diagnostics-Flaeche muss jetzt ausserdem echte Live-Setup-Wahrheit zeigen: Provider-Readiness, aufgeloester Runnerpfad, aufgeloester Modellpfad, aufgeloester Cleanup-Endpoint, aufgeloestes Cleanup-Modell und aktueller nativer Capture-State gehoeren in denselben Snapshot statt in getrennte UI-Heuristiken.
Transcription-History-Karten muessen dieselben Local-Metadaten in der Karten-Chip-Reihe zeigen, damit ein lokaler Run nicht nur als `local_preview` plus Modell sichtbar bleibt, sondern als vollstaendiger Decode-, Prompt- und Cleanup-Zustand gelesen werden kann.
Wenn das Settings-Fenster unsaved lokale Aenderungen traegt, darf die Shell das bereits in ihrer Window-State-Flaeche markieren, aber Diagnostics muss die Abweichung zwischen Draft und nativer Runtime weiterhin explizit als Warning zeigen.
Der Provider-Tab muss lokale Decode-Regler profilgebunden behandeln. Wechselt der Nutzer zwischen `...-fast` und `...-quality`, muessen die fuer dieses Profil gespeicherten Decoderwerte erscheinen statt eines zuletzt global geaenderten lokalen Werts.

### Diagnostics

Diagnostics ist eine technische Flaeche innerhalb der Settings-Shell. Sie darf direkter und roher sein, muss aber dieselben Zustandsbegriffe verwenden wie der Rest der App.
Durable History und fluechtige Runtime-Logs muessen dort sichtbar getrennt sein, auch wenn beide aus demselben nativen Pfad gelesen werden. History braucht dort echte Filter-, Export- und Policy-Oberflaechen statt statischer Log-Karten.
Recovery-Scratchpad aus Input, diagnostische Preview-Transkripte und durable History duerfen sprachlich und visuell nicht mehr ineinanderlaufen.
Recovery-Copy soll die native Recovery-Aktion und den Clipboard-Restore-Status erklaeren. Freitext-Fehler wie `fallback_reason` duerfen Details liefern, aber nicht die primaere Nutzerfuehrung ersetzen.
History-Karten in Diagnostics sollen dieselbe Recovery-Semantik als Chips und Copy zeigen, damit Retry-, Export- und Recovery-Pfade ueber denselben Wortschatz erklaert werden.
Pipeline-Karten in Diagnostics sollen pro Schritt denselben nativen Wortschatz zeigen: `capture`, `provider`, `transform`, `insert` plus klarer `state`, sichtbare `duration_ms` und ein stabiler `error_code`, falls ein Schritt scheitert.
Provider-Labels in Diagnostics und Preview muessen aus dem nativen `provider_profile`-Vertrag kommen; Modellnamen-Heuristiken oder Fenster-Draft-Ableitungen sind fuer Cloud- wie Local-Runs ein UI-Fehler.
Wenn Diagnostics als eigenes Fenster geoeffnet wird, bleibt dieselbe native Fensterdekoration aktiv wie im Settings-Fenster. Auch dieses Pop-out ist eine Utility-Flaeche und darf keine zweite Custom-Chrome-Sprache einfuehren.
Die eigentliche Diagnostics Preview bleibt eine zusammenhaengende Vorschau: aktueller Transkriptzustand, Insert-Plan und Preview-Editor gehoeren sichtbar zusammen statt als voneinander geloeste Einzelkarten.
Diagnostische History- und Hint-Listen sollen als isolierte, stabile Teilbaeume implementiert werden. UI-Polish auf diesen Flaechen darf keine sekundaeren Blink- oder Rebuild-Muster beim Scrollen einfuehren.

## Layout-Regeln

- Overlay-Fenster: Tauri `transparent: true`, `alwaysOnTop: true`, `decorations: false`. Pill mit Faux-Glass (solid semi-transparent `--ov-surface` + hairline `--ov-highlight`, kein `backdrop-filter`). Idle wird nativ unsichtbar geparkt.
- Main Window (Shell): `980x720`, Mindestgroesse `760x540`. Tauri `titleBarStyle: "Overlay"` (macOS) oder Host-Dekoration (Win/Linux). `decorations: false` fuer Custom Chrome.
- Diagnostics-Pop-out: `1040x780`, Mindestgroesse `900x680`
- Sidebar: `200px` breit, nicht scrollbar. Preview-Tabs unten mit `opacity: 0.35`.
- Content: Card-basiertes Layout, `border-radius: 12px`, `padding: 20px`, `gap: 16px`.
- Elevation durch Background (`--surface`, `--surface-elevated`), nicht durch Shadow.

### Hintergrund-Layer (v2.1)

Seit dem Home-Screen-Refactor gibt es drei explizite Layer-Aliase in
`src/styles/globals.css`, die auf dem bestehenden Brand-Palette aufsetzen:

| Token              | Alias-Ziel               | Verwendung                        |
|--------------------|--------------------------|-----------------------------------|
| `--bg-base`        | `var(--bg)`              | tiefster Layer (Fenster)          |
| `--bg-surface`     | `var(--surface-elevated)`| Cards, Listen, Dialoge            |
| `--bg-elevated`    | `var(--surface-strong)`  | Hover/Active, Hero-Prominenz      |

Zusaetzlich wurde `--surface-elevated` von `#1e2730` auf `#1c2127` retuned,
 damit Cards sich klarer vom Fensterhintergrund abheben.

Cards verwenden `--bg-surface`, Status-/Hero-Betonung `--bg-elevated`.
Sichtbarkeit der drei Layer wird im Home-Bereich gezielt ueber staerkere
Hairline-Borders (`border-border-strong` auf `--bg-surface`-Cards) erreicht,
ohne die globalen Surface-Tokens weiter aufzuhellen.
Neue UI-Komponenten sollten diese Layer-Namen statt roher `--bg` / `--surface-*`
-Werte nutzen, damit die Hierarchie im Code greifbar bleibt.

### Gotcha: CSS-Reset muss in `@layer base` liegen

`src/styles/globals.css` nutzt Tailwind v4 (`@import "tailwindcss"`), das
intern `@layer theme, base, components, utilities;` deklariert. Der
universelle Reset (`*, *::before, *::after { box-sizing; margin: 0; padding: 0; }`)
muss deshalb explizit in `@layer base { ... }` gewrappt sein.

Ungelayerte CSS-Regeln gewinnen in der Cascade-Layers-Spec **immer** gegen
gelayerte Regeln, unabhaengig von Selektor-Spezifitaet oder Reihenfolge im
File. Stand vor diesem Fix lag der Reset als plain CSS ausserhalb jedes
`@layer`-Blocks — dadurch hat `padding: 0` jede Tailwind-Padding-Utility
(`px-*`, `py-*`, `pt-*`, ...) und jede Margin-Utility app-weit überschrieben,
ohne dass das im JSX/TSX sichtbar war. Sidebar-`pl-4`, Nav-`px-3` und
Content-`px-8` standen korrekt im Code, sind aber visuell wirkungslos
geblieben, bis der Reset gelayert wurde (siehe `src/styles/globals.css`,
Abschnitt "Reset").

Regel fuer neue globale Resets/Overrides in `globals.css`: immer in
`@layer base` (oder `components`) schreiben, nie als unlayered Top-Level-CSS,
sonst sticht es lautlos jede Tailwind-Utility.

## Typografie

Font-Tokens in `src/styles/globals.css`:

- `--font-display`: Aptos Display, SF Pro Display, Segoe UI Variable Display, Noto Sans
- `--font`: Aptos, SF Pro Text, Segoe UI Variable, Noto Sans
- `--font-mono`: IBM Plex Mono, Cascadia Code, SF Mono, Consolas

Type Scale:

| Token | Groesse | Weight | Verwendung |
|-------|---------|--------|------------|
| `--text-display-lg` | 28px | 600 | Bereichs-Titel, Hero-Headline |
| `--text-display` | 24px | 600 | Modale Titel |
| `--text-title` | 18px | 600 | Card-Ueberschriften (gross) |
| `--text-body-lg` | 15px | 400 | Wichtiger Body-Text |
| `--text-body` | 13px | 400 | Standard-Body |
| `--text-body-sm` | 12px | 400 | Sekundaere Info |
| `--text-label` | 11px | 500 | uppercase, tracking 0.05em | Card-Sektions-Titel, Sidebar-Labels |
| `--text-caption` | 10px | 500 | uppercase, tracking 0.08em | Status-Badges |

**Home-Screen Type-Scale (5-Stufen-Ausfuehrung):**
Fuer den Home-Bereich wird auf eine reduzierte 5-Stufen-Skala gemappt, statt
jede freie Groesse zu erfinden:

| Stufe | Groesse | Tailwind | Verwendung |
|-------|---------|----------|------------|
| Hero | 28px | `text-[28px]` | "Ready to dictate" |
| Section header | 20px | `text-xl` | "Recent dictations" |
| Label / upper | 12px | `text-xs` uppercase | Eyebrows, Badges, Time |
| Body | 14px | `text-sm` | Beschreibungen, Listen-Text |
| Large body | 16px | `text-base` | Wichtige Unterzeilen (optional) |

Regeln:

- Display-Schrift nur fuer starke Oberflaechenmomente wie Titel und markante Statuslabels
- Body-Schrift fuer Formulare, Copy und Hilfetexte
- Monospace nur fuer Logs, Pfade und technisches Debugging
- Body-Text niemals unter 12px
- Sidebar-Labels: 11px, weight 500, uppercase, tracking 0.01em

## Farb- und Statussprache

Aktive Farb-Tokens in `src/styles/globals.css` (v2):

| Token | Wert | Verwendung |
|-------|------|------------|
| `--bg` | `#0f1418` | Haupt-Hintergrund |
| `--surface` | `rgba(22, 29, 35, 0.92)` | Cards, Modals |
| `--surface-elevated` | `#1b242c` | Erhoehte Cards |
| `--surface-strong` | `#202a33` | Inputs, Buttons |
| `--fg` | `#f3efe4` | Primaerer Text |
| `--fg-dim` | `#92a0ad` | Sekundaerer Text |
| `--fg-muted` | `#667380` | Deaktiviert, Placeholder |
| `--accent` | `#e68900` | **SW-labs Orange** — Primary Actions, Active States |
| `--accent-hover` | `#ff9800` | Hover auf Accent |
| `--accent-strong` | `#f5a623` | Glows, Highlights |
| `--accent-soft` | `rgba(230, 137, 0, 0.15)` | Subtile Hintergruende, Focus-Rings |
| `--accent-muted` | `#2c1e16` | Orange-tinted muted |
| `--border` | `rgba(255, 255, 255, 0.08)` | Trennlinien |
| `--border-strong` | `rgba(255, 255, 255, 0.14)` | Hover-Borders |
| `--green` | `#81d6ae` | Erfolg, positive Runtime |
| `--red` | `#ff7a6b` | Fehler, blockierende Probleme |
| `--orange` | `#e68900` | Warn-/Recovery-Status (z.B. Fallback-Bereitschaft) |

### Status-Dot System

Der `StatusDot` in `src/components/shell/StatusDot.tsx` ist die einzige
Quelle fuer kleine Statuspunkte. Er verwendet exakt die obigen Semantik-Farben
und kommt ohne eigenen Hintergrund-Tint aus:

| Tone    | Farbe              | Verwendung                   |
|---------|--------------------|------------------------------|
| success | `var(--green)`     | Bereit, abgeschlossen, aktiv |
| warning | `var(--orange)`    | Fallback, Setup nötig, Pause |
| error   | `var(--red)`       | Fehler, blockierend          |
| neutral | `var(--fg-muted)`  | Inaktiv, leer, abwarten      |

Keine inline `size-1.5 rounded-full`-Punkte in Listen, Karten oder Hero.

Regeln:

- **SW-labs Orange** (`--accent`, `#e68900`) ist das zentrale Markenzeichen fuer alle interaktiven Primary-States.
- Elevation durch Background-Variation (`--bg` > `--surface` > `--surface-elevated` > `--surface-strong`), nicht durch Box-Shadow.
- Borders extrem subtil (`rgba(255,255,255,0.08)`).
- Text in drei Stufen: `fg` > `fg-dim` > `fg-muted`.
- Gruen nur fuer echten positiven Status, nicht als generische Primaerfarbe.
- Rot fuer Fehler und blockierende Probleme.
- Neue Farben sollen ueber bestehende CSS-Variablen eingefuehrt werden, nicht ueber isolierte Ad-hoc-Hexwerte.

## Overlay-Regeln

- Tauri-Fenster: `transparent: true`, `alwaysOnTop: true` (Linux/KDE Plasma 6 via KWin-Script `packaging/kwin-wordscript-overlay/`, andere Plattformen via Tauri `always_on_top`), `decorations: false`, `skipTaskbar: true`.
- Linux-Overlay: fixe Fenstergroessen 440×60 (flat) / 460×164 (edit), `resizable: true` in `tauri.conf.json` (GTK ignorierte `set_size` bei `resizable: false`). Kein dynamisches pill-basiertes Resize (ResizeObserver + offsetWidth-Measuring entfernt, da nicht zuverlaessig auf GTK).
- `set_background_color` wird bei jedem Reveal aufgerufen (nicht nur bei `size_changed`), um WebKitGTK-Compositing-Layer-Probleme zu vermeiden (States ueberlagern sich sonst beim Wechsel).
- `park_overlay_window` ruft `window.hide()` auf, damit Reveal den Hidden→Visible-Zweig durchlaeuft (Drag-Schutz via `set_position` nur bei Hidden→Visible funktioniert).
- XWayland-Default (`GDK_BACKEND=x11`) mit `WORDSCRIPT_NATIVE_WAYLAND=1` opt-in fuer nativ Wayland.
- Pill: Faux-Glass (opak) — `background: var(--ov-surface)` (`#1b1b1d`, seit 2026-07-08 opak um das WebKitGTK-Compositor-Layer-Ghosting deterministisch zu blockieren), `border: 1px solid var(--ov-border)`, `border-radius: var(--ov-radius-compact)` (999px compact / 14px edit). **Kein** `backdrop-filter`, **kein** Alpha-Transparenz auf der Surface (Phase-1-Regel + Ghosting-Fix).
- Recording-Glow: `box-shadow: inset 0 0 0 1px var(--ov-accent-soft)` (inner ring, kein outer shadow).
- Processing/clipboard_only: `border-color: var(--ov-accent-border-soft)` (Accent-Soft-Border, gilt fuer State 05 und 06b).
- Mode-picker (State 05b): eigener `kind: "mode-picker"` + `ModePickerPill`-Komponente, idle-Silhouette mit ModeChip, `pill--mode-picker`-Klasse mit Accent-Soft-Border + inner ring.
- `--ov-shadow: none` und `--ov-shadow-recording: none` in `overlay-pill.css` (WebKitGTK malt outer `box-shadow` opak).
- `pointer-events: auto` auf `.ov-scope` (WebKitGTK macht `pointer-events: none` auf overlay-roots die Pill taub).
- `will-change: opacity` entfernt (reduziert Layer-Cache, verhindert States-Ueberlagerung).
- linke Mic-Aktion fuer Mute nur im Aufnahme-/Processing-Zustand ohne Action-Strip
- zentrale Waveform ohne erklaerenden Hilfetext im Normalfall
- rechte Timerzone fuer Zeit und Kontextaktion
- Fehlerhinweise so knapp wie moeglich, aber handlungsorientiert
- keine Sweep- oder Blur-Layer ausserhalb der sichtbaren Pill
- nach dem Lauf darf das Overlay seinen Inhalt innerhalb derselben festen Pill auf Action-Buttons umschalten, aber keine zweite vergroesserte Preview-Surface mit eigenem Hintergrund aufmachen
- Nachlauf-Quick-Actions bleiben knapp und produktiv: nur Aktionen mit echter nativer Bindung (`copy`, `retry`, `restore`, `done`) duerfen als Buttons erscheinen
- Processing-Preview-Aktionen bleiben ebenso knapp: fuer den ersten Pass duerfen nur echte Session-Aktionen wie Commit entlang des nativen Insert-Pfads oder expliziter Abort sichtbar sein
- die sichtbare Hostflaeche muss auf die Pill-Form geclippt sein; schwarze oder stale Restflaechen ausserhalb der Pill gelten weiterhin als Defekt
- derselbe Overlay-Pfad muss gemerkte Manual-Positionen respektieren; ein Statuswechsel von Recording zu Processing oder Action darf die vom Nutzer gezogene Position nicht wieder auf Bottom-Center zuruecksetzen
- derselbe Overlay-Pfad darf eine gemerkte Manual-Position nur aus echter Drag-Interaktion aktualisieren; Host-Repositions fuer Reveal, Hide, Surface-Wechsel oder Offscreen-Parking gelten nicht als neue Placement-Quelle
- wenn dieselbe Manual-Position auf Compact-, Preview- oder Result-Surface angewendet wird, muss dieselbe gemerkte Top-Left-Position wiederverwendet werden; ein Oberflaechenwechsel darf die Position nicht auf einen anderen internen Drag-Anker umrechnen
- Recording-, `working`- und Action-State brauchen eigene Seitenzonen-Breiten und Paddingwerte, wenn sonst der rechte Rand optisch schwerer wird als die Mic-Seite; Gleichgewicht pro Zustand ist wichtiger als ein einziger statischer Grid-Wert fuer alle Overlay-Situationen
- derselbe Overlay-Pfad muss in jedem Zustand dragbar bleiben, ohne Single-Click-Aktionen auf Buttons zu verlieren; die Drag-Geste beginnt deshalb erst nach echter Pointer-Bewegung
- die Waveform soll Sprache sichtbar aussteuern; near-idle Raumrauschen soll wieder in eine ruhige Idle-Silhouette zurueckfallen, waehrend echte Sprache klar hoeher und lebendiger aussteuern darf als im Idle-Zustand

## Settings-Regeln (Shell)

- Main Window (Shell): `titleBarStyle: "Overlay"` (macOS) mit nativen Traffic Lights; auf Win/Linux Host-Dekoration oder custom Titlebar. Keine Fake-Controls im Content.
- dieselbe native Dekorationsregel gilt fuer das Diagnostics-Pop-out
- Sidebar (200px) fuer Orientierung, Main-Panel fuer Inhalt
- gruppierte Sidebar-Navigation: aktive Bereiche oben, Preview-Tabs unten
- der kompakte Tab-Header darf genau einen Snapshot aus Runtime-Status und Save-Zustand zeigen; er ist Orientierung, nicht Marketing
- der aktuelle Polish-Pass priorisiert Provider & Models, Text Rules, About und Diagnostics als Utility-Flaechen. Overlay-only Restyling ist nachgeordnet, solange Transkriptionsvertrauen und Setup-Fuehrung noch die groesseren Produktluecken sind
- Fenster-Minima muessen gross genug bleiben, damit Sidebar, Footer und Hauptinhalte beim nativen Resize nicht visuell verschwinden oder in mobileartige Notlayouts kippen
- Section-Blurb nur dort, wo er echte Entscheidungsunterstuetzung liefert
- Formkarten muessen die Runtime-Wahrheit abbilden, nicht Platzhalter simulieren
- Save-Bar bleibt ruhig und funktional
- About-/Trust-Flaechen muessen Plattformvoraussetzungen und ehrliche Grenzen sichtbar getrennt zeigen, nicht in einen neutralen Absatz verstecken
- Release-Aufbauflaechen im About-Tab sind erlaubt, wenn sie klar `in progress` markieren und keine live Downloads oder funktionierende In-App-Updates vortaeuschen
- Release-Aufbauflaechen duerfen workflow-interne Draft-Handoffs benennen, aber Statusfelder wie `Latest published tag` muessen sich weiterhin nur auf oeffentlich sichtbare Releases beziehen
- Provider & Models muss Groq-Authentifizierung sichtbar von Local-Runtime-Voraussetzungen trennen; API-Key-UI darf fuer `local_preview` nicht erscheinen, dafuer aber eine native Preflight-Checkliste mit Runner-, Modell-, Cleanup-Endpoint- und Cleanup-Modell-Status
- Input darf den ersten Diktierpfad als kompakte Preflight-Checkliste zeigen: Trigger, Mikrofon, Insert-Pfad und Recovery. Diese Flaeche muss bestehende native Statuswerte verdichten und darf keine neue Readiness-Semantik einfuehren.

## Text Rules UX

Die Text-Rules-Flaeche muss die reale Laufzeitsemantik exakt spiegeln:

- lokale Textprofile kapseln `Transcription Context`, optionale `STT hints`, Dictionary, Snippets sowie Rewrite-, Insert- und Recovery-Defaults als konkreten Arbeitsmodus
- `Transcription Context` bleibt innerhalb des aktiven Profils primaer STT-Hilfe; wenn AI cleanup laeuft, darf derselbe Context nur als konservativer Preserve-Hinweis fuer Termini und Sprachmix dienen, nie als semantische Regelmaschine
- `STT hints` sind ein eigenes explizites Feld fuer wenige kurze gesprochene Cues oder Alternativphrasen, die wirklich in den STT-Bias sollen; Snippet-Trigger duerfen nicht stillschweigend denselben Zweck uebernehmen
- eingeschlossene Profile sollen deshalb mit konservativen Wortschatz-Baselines starten. Vorgefuellte snippetartige STT-Hinweise oder breite Kategorienlisten, die jede Diktation in einen Szenariomodus ziehen, gehoeren nicht in den Default-Zustand
- die Text-Rules-Flaeche soll diese Grenze auch sichtbar fuehren: der Context-Workspace zeigt deshalb den effektiven automatischen Bias und Warnings fuer ignorierte breite Kontext- oder Hint-Zeilen, statt Profilinhalt stillschweigend als aktive Runtime-Wahrheit zu inszenieren
- Dictionary und Snippets arbeiten literal und case-insensitive
- Dictionary laeuft vor Snippets
- Preview und Validation muessen gegen denselben nativen Analysepfad laufen
- UI-Copy fuer AI cleanup muss klar machen, dass gemischte Sprache, Umgangssprache und Produktterme eher geschuetzt als umgeschrieben werden; die Flaeche darf keine semantische Fuzzy-Automation versprechen
- die Settings-Sidebar muss den aktiven Profilzustand global sichtbar machen; schneller Wechsel lebt dort, tiefes Profil-Editing bleibt in Text Rules
- Text Rules soll als gefuehrter Ablauf organisiert sein: zuerst eine kompakte Profilbibliothek fuer aktive, eigene und eingeschlossene Profile; danach sitzt die Schritt-Navigation oben ueber der aktiven Arbeitsflaeche; darunter bleibt immer genau eine dominante Bearbeitungsstufe statt mehrerer gleichgewichtiger Hauptflaechen
- oberhalb der Setup-Zone darf nur eine knappe Prozesszusammenfassung stehen; Import/Export und Diagnose-Hilfen bleiben Utility-Ebene und duerfen die aktive Bearbeitungsstufe nicht optisch ueberholen
- die Schritt-Navigation darf im Scroll-Kontext praesent bleiben, solange sie nicht mobilen oder kleinen Settings-Fenstern den Arbeitsraum nimmt
- eingeschlossene Profile muessen als normale persistierte User-Profile erscheinen, nur mit sichtbarem `Included`-Status bis zur ersten echten Bearbeitung; sie duerfen keine versteckte zweite Ownership-Flaeche oder Assistant-Persona erzeugen
- Profilwechsel muss sichtbar denselben aktiven Regelbestand fuer Preview, Import/Export und Runtime umschalten
- Diagnostics-Hinweise sollen auf konkrete Regelkarten zurueckfuehren

## Credential- und Privacy-UI

- Groq bleibt BYOK
- die aktive UI bleibt cloud-first, zeigt aber die `local_preview`-Lane als vollwertige lokale Runtime-Lane mit externem STT-Helper, lokalem Cleanup-Modell, nativer Modell-Discovery und ehrlicher Runner-/Cleanup-Gesundheit explizit daneben
- UI-Copy sagt `Save locally` und `OS secret store`, nicht implizit Cloud-Speicherung
- der volle API-Key wird nach dem Speichern nicht zurueck in den Renderer geholt
- Key-Praesenz ist neutral; gruene Signale gibt es erst nach echter Validierung
- die lokale Runtime zeigt Runner-/Model-/Cleanup-Status statt Auth-Sprache, muss die noetigen lokalen Voraussetzungen in der Preflight-Checkliste erklaeren und darf weder Runner- noch Cleanup-Gesundheit aus blossen Pfaden oder UI-Fallbacks ableiten

## Motion und Plattformgrenzen

Motion-Tokens (aus UI-UX-Pro-Max Skill und macOS HIG):

| Animation | Dauer | Easing |
|-----------|-------|--------|
| Tab-Wechsel | 150ms | `cubic-bezier(0.25, 0.1, 0.25, 1.0)` |
| Sidebar-Hover | 100ms | `ease-out` |
| Toggle-Switch | 150ms | `ease-out` |
| Button-Press | 50ms | `ease-out` (`scale(0.97)`) |
| Overlay-Glow-Puls | 2000ms | `ease-in-out` (infinite) |

Regeln:
- Nur `transform` und `opacity` animieren; kein `width`, `height`, `top`, `left`.
- `prefers-reduced-motion: reduce` = alle Animationen instant.
- Keine dekorativen Animationen — jede Bewegung muss einen Zweck haben.

Plattformgrenzen:
- **macOS**: `macOSPrivateApi: true` fuer transparente Overlay-Fenster. Verhindert App Store, aber WordScript ist ein Dev-Tool.
- **Linux/WebKitGTK**: Kein `backdrop-filter` (Faux-Glass seit Phase 1). Overlay-Pill nutzt solid `--ov-surface`. `--ov-shadow: none` (WebKitGTK malt outer `box-shadow` opak).
- **Windows**: Transparente Fenster verfuegbar; Blur je nach WebView2-Version.
- Schwarze Fensterflaechen ausserhalb der Shell gelten als Defekt.

## Was das Design System bewusst nicht ist

Es ist nicht:

- eine Marketing-CI-Datei
- eine Sammlung spekulativer V2-Mockups
- ein separater Komponenten-Katalog ohne Produktkontext

Wenn eine visuelle Entscheidung den aktiven Produktpfad nicht verbessert oder klaert, gehoert sie hier nicht hinein.