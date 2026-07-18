# WordScript — Platforms

Stand: 2026-07-18

Plattform-Supportmatrix und plattformspezifische Insert- und Recovery-Diagnostik. Quelle ist `core::insertion` (`NativeInsertionPlatformStatus`); diese Datei ist die menschenlesbare Spiegelung des nativen Vertrags.

## Support- und Plattformmatrix

| Plattform | Status | Aktuelle Realitaet |
|---|---|---|
| macOS | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; Dev-Mode-Auto-Paste braucht Privacy-Freigaben |
| Windows | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; UAC-Grenzen gelten fuer simuliertes Paste |
| Linux X11 | Preview | nutzbarer Produktpfad mit kleinerem Stabilitaetsversprechen |
| Linux Wayland hybrid (X11+Wayland mit xdotool) | Preview-lite | `xdotool type` (Fake-Input ueber XWayland) direkt, sonst Clipboard + manuelles Paste |
| Linux Wayland rein (kein X11-Display) | Experimental | Auto-Paste deaktiviert, Clipboard-only + manuelles Paste; verhindert Wayland-Portal-Prompt "Control input devices" |
| KDE Plasma 6 (Wayland, mit xdg-desktop-portal-kde) | Preview-lite | einmaliger RemoteDesktop-Portal-Grant ueber den Session-Bus; danach direkter Auto-Paste ohne wiederholten Dialog. Always-on-Top fuer Overlay via KWin-Script (`packaging/kwin-wordscript-overlay/`) |
| GNOME Mutter (Wayland) | Preview-lite | gleicher Pfad wie KDE Plasma 6 via `org.gnome.Shell` RemoteDesktop-Portal |
| Hyprland / Sway / KDE Plasma 5 | Experimental | kein persistenter RemoteDesktop-Portal-Grant verfuegbar; Auto-Paste bleibt Clipboard-only |

## Plattformdiagnostik fuer Insert und Recovery

Die native Plattformdiagnostik kommt aus `core::insertion` und wird sichtbar in der About-Flaeche ausgespielt. Sie besteht nicht nur aus einem Support-Tier, sondern aus:

- Plattformlabel
- Insert-Strategie
- Support-Message
- sichtbaren Voraussetzungen
- sichtbaren ehrlichen Grenzen

### macOS Dev-Mode

- fuer direktes Cmd+V-Auto-Paste braucht der ausfuehrende Prozess Accessibility in `System Settings -> Privacy & Security -> Accessibility`
- wenn macOS fuer synthetische Eingaben zusaetzlich `Input Monitoring` verlangt, muss dieselbe Launcher-App freigegeben werden
- im Dev-Mode kann dieser Eintrag unter Terminal oder VS Code erscheinen statt unter einem paketierten WordScript-App-Namen
- einzelne sandboxes, Remote-Desktop-Sitzungen oder Apps mit hoeheren Rechten koennen simuliertes Paste trotzdem ablehnen

### Windows

- der aktive Tier-1-Pfad nutzt simuliertes `Ctrl+V` oder Clipboard-Handoff
- elevated Ziel-Apps koennen synthetisches Paste von einem nicht-elevated WordScript-Prozess blockieren
- Scratchpad und Last-Transcript-Restore bleiben der offizielle Recovery-Pfad

### Linux Wayland — bewusste Default-Wahl

Auf reinen Wayland-Sessions (kein `DISPLAY`, nur `WAYLAND_DISPLAY`) ist die Paste-Driver-Chette leer. Begruendung: jeder Versuch, `wtype`, `ydotool` oder `enigo` fuer Input-Simulation zu starten, loest den KDE-Plasma-Portal-Dialog "Remote Control – Control input devices" aus. Diese bewusste Default-Wahl vermeidet den Portal-Dialog, schraenkt aber die Auto-Paste-Bequemlichkeit auf pure Wayland ein. Hybrid-Sessions (X11+Wayland mit xdotool) sind davon nicht betroffen.

Overlay auf Linux: XWayland-Default (`GDK_BACKEND=x11`) mit `WORDSCRIPT_NATIVE_WAYLAND=1` opt-in fuer nativ Wayland. Always-on-Top auf KDE Plasma 6 via KWin-Script (`packaging/kwin-wordscript-overlay/`), installiert mit `kpackagetool6 --type=KWin/Script -i packaging/kwin-wordscript-overlay && qdbus org.kde.KWin /KWin reconfigure`.

### Linux Wayland — Portal-Diagnose zur Laufzeit

Die native Insert-Logik klassifiziert stderr-Ausgaben von `xdotool`, `xdotool type`, `wtype`, `ydotool` und `enigo` anhand bekannter Portal-Signaturen. Erkennt der Klassifizierer einen KDE-Plasma- oder InputCapture-Portal-Prompt, wird der Insert-Lauf in den Clipboard-only-Modus geschaltet und der Status enthaelt:

- `last_portal_prompt.signal` (`kde_remote_desktop` | `input_capture` | `unknown`)
- `last_portal_prompt.driver` (welcher Treiber den Trigger ausgeloest hat)
- `last_portal_prompt.stderr_excerpt` (gekuerzte Originalmeldung, bis 280 Zeichen)
- `paste_disabled_reason` (statisch abgeleitet aus Compositor + Portal-Status)

Damit weiss die UI bei jedem Insert-Versuch, **warum** Auto-Paste nicht verfuegbar ist, und kann den naechsten konkreten Schritt anzeigen.

### Linux Wayland — RemoteDesktop-Portal auf KDE Plasma 6 / GNOME Mutter

Auf Compositor mit stabiler RemoteDesktop-Portal-Schnittstelle (KDE Plasma 6 mit `xdg-desktop-portal-kde`, GNOME Mutter) versucht WordScript beim ersten `native_insertion_status`-Aufruf eine RemoteDesktop-Session ueber den Session-Bus anzufordern:

1. `org.freedesktop.portal.Desktop` / `org.freedesktop.portal.RemoteDesktop` `CreateSession`
2. `SelectDevices` fuer Keyboard + Pointer (Gerateetypen `1` und `2`)
3. `Start` ohne URI

Das Restore-Token wird persistent unter `$XDG_RUNTIME_DIR/wordscript/remote-desktop.token` abgelegt (mode `0600`) und bei der naechsten Session wiederverwendet. Damit erscheint der Dialog "Control input devices" **nur einmal pro User** und nachfolgende Auto-Paste-Versuche laufen ohne weitere Rueckfrage.

Voraussetzungen:

- `xdg-desktop-portal` als Daemon im User-Session-Bus
- `xdg-desktop-portal-kde` (KDE Plasma 6) bzw. `xdg-desktop-portal-gnome` (GNOME)
- `busctl` aus `systemd` (von Tauri ueber `Command::new` aufgerufen) als IPC-Helfer

Sind Portal-Daemon oder Interface nicht erreichbar, meldet der Status `PortalSessionUnavailable` mit konkretem `PortalError::label()`.

### Linux Wayland — Hyprland, Sway, KDE Plasma 5

| Compositor | Warum Auto-Paste eingeschraenkt ist | Konkreter naechster Schritt |
|---|---|---|
| Hyprland | Kein stabiler RemoteDesktop-Portal-Grant; XTEST ueber XWayland triggert weiterhin den KDE-/KWin-Dialog nicht, aber wlroots-`virtual-keyboard` braucht Admin-Rechte oder `wlr-virtual-input` mit `uinput`-Backend | `wlr-virtual-input` einrichten oder Auto-Paste dauerhaft auslassen |
| Sway | `xdg-desktop-portal-wlr` kann nur Screen-Capture, keinen Keyboard-Input | Auf KDE Plasma 6 / GNOME Mutter wechseln, falls Auto-Paste benoetigt wird |
| KDE Plasma 5 | `org.kde.kwin.RemoteDesktop` ist erst ab Plasma 6 verfuegbar | Distribution-Upgrade auf KDE Plasma 6 oder Auto-Paste deaktiviert lassen |

WordScript erkennt diese Compositor-Spezialfaelle und blendet in `paste_disabled_reason` den jeweiligen Hint ein.

## Linux / PipeWire — Mikrofon-Keep-Alive gegen Auto-Suspend

### Wurzel

PipeWire/WirePlumber suspendiert idle Input-Sources automatisch (es gibt `module-always-sink` fuer Sinks, aber **kein** `module-always-source`-Äquivalent). cpal muss beim Capture-Start eine suspendierte Source reaktivieren — genau das ist der wahrscheinlichste Trigger fuer transiente `Native capture stream error`-Events waehrend aktiver Aufnahmen (Suspend/Resume-Hickup, WirePlumber-Rescan, Source-Reenumerate, Config-Mismatch nach resume).

WordScript hat zwei Verteidigungslinien dagegen:

1. **App-seitig (Capture-Stream-Rebuild):** Siehe `docs/STATUS.md` — wenn der StreamError waehrend einer Aufnahme feuert, startet WordScript genau einen Rebuild-Versuch mit `cpal::default_host()`/`default_input_device()`, bevor der Recovery-Flow (Error-Pill → Processing-Preview mit Copy) greift. Das **heilt** den Abbruch, wenn er passiert.
2. **System-seitig (WirePlumber-Keep-Alive, praeventiv):** Verhindert das Suspend *proaktiv*, sodass der transiente Error gar nicht erst entsteht. Diese Massnahme ist **User-Ownership** — WordScript schreibt System-Settings nicht automatisch.

### WirePlumber-Keep-Alive einrichten (empfohlener Weg)

Datei `~/.config/wireplumber/main.lua.d/51-wordscript-keepalive.lua` anlegen mit folgendem Inhalt:

```lua
-- WordScript: Input-Source-Auto-Suspend deaktivieren
-- Verhindert transiente cpal-StreamError-Events beim Capture-Start
-- nach idle-Suspend einer Input-Source.
rule = {
  matches = {
    {
      { "node.name", "matches", "alsa_input.*" },
    },
    {
      { "node.name", "matches", "alsa_card.*" },
      { "media.class", "matches", "Audio/Source" },
    },
  },
  apply_properties = {
    ["suspend.idle-timeout"] = 0,
  },
}
table.insert(alsa_monitor.rules, rule)
```

Anschliessend WirePlumber neu starten:

```bash
systemctl --user restart wireplumber
```

### Verifikation

Nach 5 Minuten Idle (keine Aufnahme, kein anderer Stream, der die Source referenziert):

```bash
pactl list sources short
```

Die Default-Input-Source sollte weiterhin auf `RUNNING` stehen statt `SUSPENDED`. Bei 2+ Stunden Normalbetrieb mit WordScript sollten keine `[WordScript] Native capture stream error`-Eintraege mehr im persistenten Runtime-Log auftauchen.

### Alternative fuer reine PulseAudio-Systeme (ohne WirePlumber)

Auf Systemen mit klassischem PulseAudio (nicht PipeWire-Pulse) das Auto-Suspend-Modul entladen:

```bash
pactl unload-module module-suspend-on-idle
```

Persistenter: in `~/.config/pulse/default.pa` die Zeile `load-module module-suspend-on-idle` auskommentieren oder entfernen und PulseAudio neu starten (`systemctl --user restart pulseaudio`).

### Kontrollierte Reproduktion fuer Verifikation des Rebuild-Pfads

Fuer die Verifikation des **app-seitigen** Rebuild-Pfads (unabhaengig vom Keep-Alive) laesst sich der StreamError kontrolliert provozieren:

```bash
pactl suspend-source <default-source> 1
```

`<default-source>` ist der Source-Name aus `pactl list sources short` (mit `*`-Marker). Waehrend einer aktiven WordScript-Aufnahme ausgefuehrt, feuert der cpal-StreamError-Callback; das persistente Runtime-Log sollte `[WordScript] Native capture stream rebuilt session_id=… new_device=… new_sample_rate=… rebuild_attempt=1` zeigen und die Aufnahme sollte ohne Error-Pill weiterlaufen.
