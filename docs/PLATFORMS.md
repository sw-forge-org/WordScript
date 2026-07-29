# WordScript -- Platforms

Status: 2026-07-27

Platform support matrix and platform-specific insert/recovery diagnostics.
Source is `core::insertion` (`NativeInsertionPlatformStatus`); this file is
the human-readable mirror of the native contract.

## Support and platform matrix

| Platform | Status | Current reality |
|---|---|---|
| macOS | Tier 1 target | native hotkey, capture and insert path; dev-mode auto-paste needs privacy grants |
| Windows | Tier 1 target | native hotkey, capture and insert path; UAC limits apply to simulated paste |
| Linux X11 | Preview | usable product path with a smaller stability promise |
| Linux Wayland hybrid (X11+Wayland with xdotool) | Preview-lite | `xdotool type` (fake input over XWayland) directly, else clipboard + manual paste |
| Linux Wayland pure (no X11 display) | Experimental | auto-paste disabled, clipboard-only + manual paste; avoids the Wayland portal prompt "Control input devices" |
| KDE Plasma 6 (Wayland, with xdg-desktop-portal-kde) | Preview-lite | one-time RemoteDesktop portal grant over the session bus; then direct auto-paste without repeated dialog. Always-on-top for overlay via KWin script (`packaging/kwin-wordscript-overlay/`) |
| GNOME Mutter (Wayland) | Preview-lite | same path as KDE Plasma 6 via the `org.gnome.Shell` RemoteDesktop portal |
| Hyprland / Sway / KDE Plasma 5 | Experimental | no persistent RemoteDesktop portal grant available; auto-paste stays clipboard-only |

**Caveat on the two Tier 1 rows.** Development happens on Linux, and the shortcut
lane has never been executed on Windows or macOS. "Native hotkey path" describes
the implemented code, not a verified session. One consequence is already known
from the vendored crate's source: the modifier-only capture defaults are expected
to fail registration on macOS. Executable run sheets for both platforms, the
source-level findings, and which questions can be answered by a VM or a CI runner
rather than owned hardware are in
[known-issues/cross-platform-shortcut-verification.md](known-issues/cross-platform-shortcut-verification.md).

## Platform diagnostics for insert and recovery

The native platform diagnostics come from `core::insertion` and are shown in
the About area. They consist not only of a support tier but of: platform
label, insert strategy, support message, visible prerequisites and visible
honest limits.

### macOS dev mode

- direct Cmd+V auto-paste needs Accessibility in
  `System Settings -> Privacy & Security -> Accessibility` for the launching
  process.
- if macOS additionally requires Input Monitoring for synthetic input, the
  same launcher app must be granted.
- in dev mode this entry can appear under Terminal or VS Code instead of a
  packaged WordScript app name.
- individual sandboxes, remote-desktop sessions or apps with higher
  privileges can still reject simulated paste.

### Windows

- the active Tier 1 path uses simulated `Ctrl+V` or clipboard handoff.
- elevated target apps can block synthetic paste from a non-elevated
  WordScript process.
- scratchpad and last-transcript restore stay the official recovery path.

### Linux Wayland -- deliberate default choice

On pure Wayland sessions (no `DISPLAY`, only `WAYLAND_DISPLAY`) the paste
driver chain is empty. Reason: any attempt to launch `wtype`, `ydotool` or
`enigo` for input simulation triggers the KDE Plasma portal dialog "Remote
Control -- Control input devices". This deliberate default avoids the portal
dialog but limits auto-paste convenience to pure Wayland. Hybrid sessions
(X11+Wayland with xdotool) are not affected.

Overlay on Linux: XWayland default (`GDK_BACKEND=x11`) with
`WORDSCRIPT_NATIVE_WAYLAND=1` opt-in for native Wayland. Always-on-top on
KDE Plasma 6 via KWin script (`packaging/kwin-wordscript-overlay/`),
installed with
`kpackagetool6 --type=KWin/Script -i packaging/kwin-wordscript-overlay && qdbus org.kde.KWin /KWin reconfigure`.

Open observation: the overlay is reported to freeze mid-capture at irregular
intervals, pill and seconds timer and all input at once, while capture and
pipeline continue normally. Seen so far only under `npm run tauri dev` on
KDE Plasma 6 / XWayland with a hybrid Intel + NVIDIA GPU where
`__NV_PRIME_RENDER_OFFLOAD=1` is set globally, so the WebKitGTK compositor is
offloaded to the discrete GPU as a side effect. Diagnostics, the measurement
order and the hardware-level opt-outs to test against are in
[known-issues/overlay-recording-freeze.md](known-issues/overlay-recording-freeze.md).

### Linux Wayland -- runtime portal diagnosis

The native insert logic classifies stderr from `xdotool`, `xdotool type`,
`wtype`, `ydotool` and `enigo` against known portal signatures. When the
classifier detects a KDE Plasma or InputCapture portal prompt, the insert run
is switched to clipboard-only mode and the status carries:

- `last_portal_prompt.signal` (`kde_remote_desktop` | `input_capture` | `unknown`)
- `last_portal_prompt.driver` (which driver triggered it)
- `last_portal_prompt.stderr_excerpt` (short original message, up to 280 chars)
- `paste_disabled_reason` (statically derived from compositor + portal status)

This lets the UI show at every insert attempt **why** auto-paste is not
available and the next concrete step.

### Linux Wayland -- RemoteDesktop portal on KDE Plasma 6 / GNOME Mutter

On compositors with a stable RemoteDesktop portal interface (KDE Plasma 6
with `xdg-desktop-portal-kde`, GNOME Mutter), WordScript requests a
RemoteDesktop session over the session bus on the first
`native_insertion_status` call:

1. `org.freedesktop.portal.Desktop` / `org.freedesktop.portal.RemoteDesktop`
   `CreateSession`
2. `SelectDevices` for Keyboard + Pointer (device types `1` and `2`)
3. `Start` without URI

The restore token is persisted under `$XDG_RUNTIME_DIR/wordscript/remote-desktop.token`
(mode `0600`) and reused for the next session. The "Control input devices"
dialog then appears **only once per user** and subsequent auto-paste
attempts run without further prompt.

Prerequisites:

- `xdg-desktop-portal` as a daemon in the user session bus
- `xdg-desktop-portal-kde` (KDE Plasma 6) or `xdg-desktop-portal-gnome` (GNOME)
- `busctl` from `systemd` (called by Tauri via `Command::new`) as the IPC helper

If the portal daemon or interface is unreachable, the status reports
`PortalSessionUnavailable` with the concrete `PortalError::label()`.

### Linux Wayland -- Hyprland, Sway, KDE Plasma 5

| Compositor | Why auto-paste is restricted | Next concrete step |
|---|---|---|
| Hyprland | no stable RemoteDesktop portal grant; XTEST over XWayland does not trigger the KDE/KWin dialog, but wlroots `virtual-keyboard` needs admin rights or `wlr-virtual-input` with the `uinput` backend | set up `wlr-virtual-input` or permanently skip auto-paste |
| Sway | `xdg-desktop-portal-wlr` can only screen-capture, no keyboard input | switch to KDE Plasma 6 / GNOME Mutter if auto-paste is needed |
| KDE Plasma 5 | `org.kde.kwin.RemoteDesktop` is only available from Plasma 6 | distribution upgrade to KDE Plasma 6 or leave auto-paste disabled |

WordScript detects these compositor special cases and shows the respective
hint in `paste_disabled_reason`.

## Linux -- global shortcut reality

Global shortcuts on Linux are X11 passive grabs taken through the vendored
`global-hotkey` crate. Since WordScript runs on XWayland by default
(`GDK_BACKEND=x11`), that path also applies inside a Wayland session.

Consequences a user can hit:

- **Whether a grab is honored can depend on keyboard focus.** A shortcut may
  work while an X11 application is focused and do nothing while a native Wayland
  application is focused. If a shortcut feels intermittent, this is the first
  thing to check — the runtime log now records every event that arrives, so
  "the key never came" and "the key came and was ignored" are distinguishable.
- **KWin consumes `Meta`/`Super` before the focused window sees it.** The
  recorder therefore cannot capture it on KDE. Settings names this at the point
  of failure and offers manual entry as the deliberate alternative.
- **A native Wayland session has no unprivileged global-shortcut API.** Starting
  with `WORDSCRIPT_NATIVE_WAYLAND=1` gives up global shortcuts entirely;
  supporting them there needs the `org.freedesktop.portal.GlobalShortcuts`
  portal, which this build does not implement. Settings states this instead of
  offering shortcuts that cannot work.
- **Hold to talk depends on a key release event** that the three platform
  backends deliver by three different mechanisms. Nothing guarantees one
  arrives. The runtime counts presses and releases per binding, states what it
  has observed in this session, and ends a stranded hold with an explicit
  watchdog rather than letting it drift into the silence timeout. The release is
  what *ends* a hold; what *starts* one is the press plus `hold_arm_ms` of
  actually holding it (ADR
  [0013](decisions/0013-hold-to-talk-is-strictly-momentary.md)), so a platform
  that delivers presses but no releases strands a session rather than producing
  a stream of one-press recordings.

`shortcut_platform` reports the detected compositor, session type, backend and
the keys the desktop swallows; Settings -> Capture renders it above the shortcut
rows.

## Shortcut capability matrix

`shortcut_capabilities` reports, for the current session, which activation modes
and key classes can be honored. Settings -> Capture gates the activation selector
on it: an option the session cannot honor is unselectable and carries the reason.
The derivation lives in `core::shortcut::capability_matrix` and is the single
owner — the table below renders it for humans and is not a second source of
truth.

Two inputs, no assumptions (ADR
[0007](decisions/0007-capability-matrix-is-measured-not-assumed.md)):

1. **Session facts** from `shortcut_platform`, named as a `SessionKind`:
   `windows`, `mac_os`, `linux_x11`, `linux_x_wayland`, `linux_native_wayland`.
2. **Release evidence** measured by the trigger lane from its own press/release
   counters: `unobserved`, `release_observed` or `release_missing`.

### Activation modes

| Session | Tap | Double tap | Hold to talk |
| --- | --- | --- | --- |
| `windows` | available | available | follows the evidence |
| `mac_os` | available | available | follows the evidence, caveat: needs Accessibility and Input Monitoring |
| `linux_x11` | available | available | follows the evidence |
| `linux_x_wayland` | available | available | follows the evidence, caveat: focus-dependent X11 passive grab |
| `linux_native_wayland` | unavailable | unavailable | unavailable — no global-shortcut API in this session |

"Follows the evidence" means exactly this, on every platform including Windows
and macOS:

| Evidence for the configured capture shortcut | Hold state |
| --- | --- |
| No press observed yet | `conditional` — nothing is known yet, and that is stated rather than assumed to be fine |
| Presses and at least one release | `available` |
| Presses and no release at all | `unavailable` — a hold would start and never stop on release |

The caveats are appended to the reason as a *plausible cause*; they never set the
state on their own. No platform is assumed to deliver a release, and none is
assumed not to. The reason this is measured rather than tabulated is the S0
finding: under XTEST on KDE Plasma 6 / XWayland, release delivery was
nondeterministic, and the physical half of that measurement is still open (see
[known-issues/capture-shortcut-recording.md](known-issues/capture-shortcut-recording.md)).

### Key classes

| Session | Letters and digits | Function keys | Modifier-only | Super / Meta |
| --- | --- | --- | --- | --- |
| `windows` | available | conditional | available | available |
| `mac_os` | available | conditional | available | available |
| `linux_x11` / `linux_x_wayland` (KDE) | available | conditional | available | conditional — KWin swallows it, use manual entry |
| `linux_native_wayland` | unavailable | unavailable | unavailable | unavailable |

- **Letters and digits** need at least one modifier; a bare letter or digit is
  rejected outright.
- **Function keys** are `conditional` everywhere: a bare function key registers,
  but it is a desktop-wide grab and is accepted with a stated warning.
- **Modifier-only** is allowed from two modifiers upward. A single bare modifier
  is rejected, so no grab is ever created without a modifier (D2).
- **Super / Meta** is `conditional` wherever the desktop consumes it before the
  focused window can see it. It stays assignable through manual entry.

## Sound cue output and per-application volume

WordScript keeps one output stream open for the whole process (ADR 0010). That
is what makes it appear as a stable entry in the system volume mixer rather
than as a stream that flickers in and out for 300 ms per cue.

| Platform | Per-app volume in the OS mixer | Notes |
|---|---|---|
| Linux (PipeWire / PulseAudio) | Yes | Appears as its own playback stream in `pavucontrol` or the KDE volume applet; the level is remembered per application |
| Windows | Yes | Own entry in the Volume Mixer, remembered per application |
| macOS | **No** | macOS offers no per-application volume at all. The in-app slider is the only control there |

### How WordScript is named in the mixer

WordScript shows up with two streams: a playback stream for the sound cues and
a capture stream for the microphone. Both carry the application name; the
mixer distinguishes them by direction.

| Platform | Where the name comes from | State |
|---|---|---|
| Linux | `PIPEWIRE_PROPS` / `PULSE_PROP` with `application.name=WordScript`, set in `main()` before any audio device is opened | explicit, verified |
| Windows | the executable's version-info ProductName; `productName` in `tauri.conf.json` is already `WordScript`, so a packaged build names itself. A `cargo run` dev build shows the binary name | default is correct, no code |
| macOS | no per-application volume mixer exists | nothing to name |

On Linux the name is not cosmetic. Without the override the ALSA compatibility
layer names both streams after the binary ("PipeWire ALSA [wordscript]"), and
PipeWire keys the remembered per-application volume on that name
(`module-stream-restore.id = sink-input-by-application-name:...`) — so the name
is what makes the volume setting both findable and durable across restarts.

The name lives in **two different objects**, and mixers do not agree on which
one they show:

| Variable | Names | Read by |
|---|---|---|
| `PIPEWIRE_ALSA` | the **client** object | the ALSA plugin itself; this is what KDE's Audio Volume applet displays |
| `PIPEWIRE_PROPS` | the **stream** node | what `module-stream-restore` keys the remembered volume on |
| `PULSE_PROP` | both, on a real PulseAudio server | the pulse client library |

Setting only `PIPEWIRE_PROPS` renames the stream while the applet keeps showing
`PipeWire ALSA [wordscript]`, because the plugin hard-codes that client name
(`PipeWire ALSA [%s]` in `libasound_module_pcm_pipewire.so`) for the cue
playback and the microphone capture alike. Both variables are therefore
required.

Only `application.name` and `application.icon_name` are set. These variables
apply to the **whole process**, so a stream-specific property such as
`media.role=event` would also be stamped onto the microphone capture, where
PulseAudio would apply notification-sound routing and ducking rules to it.

Verified on PipeWire 1.6.6 through the ALSA compatibility layer — the path cpal
actually takes, which is not the same as a native PipeWire client. Checking the
stream properties alone is not enough: `pactl list sink-inputs` can read
`application.name = "WordScript"` while `pactl list clients` still reports
`PipeWire ALSA [wordscript]`, which is what the user sees.

### The two volumes are deliberately not synchronised

`sound_volume` and the OS per-application volume are independent gains that
multiply, and that is the intended design, not a gap:

- They answer different questions. `sound_volume` is how loud the cues are
  *within WordScript*. The OS per-app volume is how loud *WordScript* is
  against every other application — that one belongs to the user, and an app
  that writes it overwrites a deliberate user setting.
- No cross-platform API exists for it. Linux would need PulseAudio/PipeWire
  sink-input calls, Windows WASAPI `ISimpleAudioVolume`, and macOS offers no
  per-application volume at all, so a synchronised slider would behave
  differently on each of the three targets.
- It matches the field. None of the reference dictation apps in `donors/`
  synchronise: Handy (same Tauri/Rust stack) keeps `audio_feedback_volume` as
  an internal `Sink::set_volume` gain, VoiceInk hard-codes `player.volume`,
  vocalinux shells out to `paplay` per cue. The only OS-volume API usage
  anywhere in the donor set is for the *microphone input* device. It is also
  how Discord, Slack, Spotify and Zoom behave.

On a failure reported by the audio backend — device removal, server restart,
Bluetooth sleep — the stream is discarded and reopened, at most three times per
minute; after that cues stay silent until the sound settings change, and the
reason is in the runtime log.

## Microphone input level -- measured, never written

WordScript reads the microphone level and never sets it. The OS microphone
volume is a property of the **device**, not of the application, so writing it
would silently re-level every other app using the same microphone. This is a
stronger reason than the playback case, where the per-app volume at least only
affects WordScript. None of the reference apps in `donors/` writes it either --
OpenSuperWhisper implements `setInputVolume` and never calls it.

What is measured, per capture, in `core::capture`:

| Verdict | Condition | What the user is told |
|---|---|---|
| `silent` | peak < 0.001 (-60 dBFS) | no signal arrived; check device selection and mute |
| `too_quiet` | peak <= 0.02 (the speech threshold) | the measured peak in dBFS against the threshold it failed, and to raise the system input level |
| `clipping` | > 0.5% of samples at >= 0.99 | the clipped share, and to lower the system input level |
| `ok` | otherwise | nothing |

This matters because `stop_native_capture` discards a capture entirely when no
sample ever crossed the speech threshold. Before, that produced a bare "no
speech detected", so a microphone at a low input level and a user who said
nothing were indistinguishable. The verdict now travels with the `empty` event
(`message`, `input_level`) and, when it is actionable, reaches the overlay.

Settings shows a live meter under the microphone selector with the speech
threshold drawn in, fed by the existing `audio_level` event. It reads out while
a capture runs -- the runtime only measures during capture.

## Linux / PipeWire -- microphone keep-alive against auto-suspend

### Root cause

PipeWire/WirePlumber auto-suspends idle input sources (there is
`module-always-sink` for sinks but **no** `module-always-source` equivalent).
cpal must reactivate a suspended source on capture start -- exactly the most
likely trigger for transient `Native capture stream error` events during
active recordings (suspend/resume hiccup, WirePlumber rescan, source
reenumeration, config mismatch after resume).

WordScript has two defense lines:

1. **App-side (capture stream rebuild):** see `docs/STATUS.md` -- when the
   stream error fires during a recording, WordScript starts exactly one
   rebuild attempt with `cpal::default_host()`/`default_input_device()`
   before the recovery flow (error pill -> processing preview with copy)
   kicks in. This **heals** the abort when it happens.
2. **System-side (WirePlumber keep-alive, preventive):** prevents the
   suspend *proactively* so the transient error never occurs. This measure
   is **user ownership** -- WordScript does not write system settings.

### WirePlumber keep-alive setup (recommended)

Create `~/.config/wireplumber/main.lua.d/51-wordscript-keepalive.lua`:

```lua
-- WordScript: disable input-source auto-suspend
-- Prevents transient cpal stream-error events on capture start
-- after idle-suspend of an input source.
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

Then restart WirePlumber:

```bash
systemctl --user restart wireplumber
```

### Verification

After 5 minutes idle (no recording, no other stream referencing the source):

```bash
pactl list sources short
```

The default input source should still be `RUNNING` instead of `SUSPENDED`.
Over 2+ hours of normal use with WordScript there should be no
`[WordScript] Native capture stream error` entries in the persistent
runtime log.

### Alternative for pure PulseAudio systems (without WirePlumber)

On systems with classic PulseAudio (not PipeWire-Pulse) unload the auto-suspend
module:

```bash
pactl unload-module module-suspend-on-idle
```

Persistent: in `~/.config/pulse/default.pa` comment out or remove the line
`load-module module-suspend-on-idle` and restart PulseAudio
(`systemctl --user restart pulseaudio`).

### Controlled reproduction to verify the rebuild path

To verify the **app-side** rebuild path (independent of the keep-alive) the
stream error can be provoked in a controlled way:

```bash
pactl suspend-source <default-source> 1
```

`<default-source>` is the source name from `pactl list sources short` (with
`*` marker). Run during an active WordScript recording: the cpal
stream-error callback fires; the persistent runtime log should show
`[WordScript] Native capture stream rebuilt session_id=... new_device=... new_sample_rate=... rebuild_attempt=1`
and the recording should continue without an error pill.
