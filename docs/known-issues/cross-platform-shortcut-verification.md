# Cross-Platform Shortcut Verification — Open

Status: **Open.** Development happens on Linux (KDE Plasma 6 / Wayland, app on
XWayland). The shortcut lane has never been executed on Windows or macOS.

This is the pickup document for the moment a Windows or macOS machine is
available. It exists so that session does not start by re-deriving what to test:
the run sheets below are executable as written, and the findings that could be
established from source without hardware are already recorded.

Companion documents:

- [capture-shortcut-recording.md](capture-shortcut-recording.md) — the problem
  record, the target contract, and the Linux S0 measurement including the
  prepared run 2.
- [decisions/0007](../decisions/0007-capability-matrix-is-measured-not-assumed.md)
  — why the capability matrix contains no per-OS verdict that has not been
  measured. This document is where such measurements go.

Every claim below is tagged:

- **[code]** — read from the vendored `global-hotkey` source in this repo.
  Certain about what the code does, not about how the OS behaves around it.
- **[measured]** — observed in a running session, with the evidence recorded.
- **[unverified]** — reasoning, not evidence. Must not drive a code branch.

## Why this cannot be answered from Linux

Global shortcuts go through three different mechanisms with three different sets
of edge cases, and the lane abstracts none of them **[code]**:

| Platform | Mechanism | Release event comes from |
| --- | --- | --- |
| Linux / X11 (incl. XWayland) | X11 passive grabs (`grab_key`) | `Event::KeyRelease` for the grabbed keycode, gated on a per-entry `pressed` flag (`platform_impl/x11/mod.rs:277`) |
| Windows | `WH_KEYBOARD_LL` low-level keyboard hook | The hook's own `WM_KEYUP` branch, matched against a single stored `ACTIVE_ID`/`ACTIVE_VK` pair (`platform_impl/windows/mod.rs:175`) |
| macOS | Carbon `RegisterEventHotKey`, with a `CGEventTap` as fallback | `kEventHotKeyReleased` from Carbon (`platform_impl/macos/mod.rs:409`), or `CGEventType::KeyUp` in the tap |

A result on one of these says nothing about the others. That is also why the
capability matrix follows measured evidence per session rather than tabulating a
platform verdict.

## Findings already established from source

These needed no hardware. They are the reason this document is worth reading
before booking machine time.

### macOS: the default modifier-only triggers cannot register — **[code]**

`key_to_scancode` in `platform_impl/macos/mod.rs:534` maps letters, digits,
function keys, navigation, numpad and media keys. It has **no entry for any
modifier key** — no `ControlLeft`, `AltLeft`, `ShiftLeft`, `MetaLeft`. The X11
and Windows implementations both do (`x11/mod.rs:376`, `windows/mod.rs:301`).

WordScript expands a modifier-only shortcut into one grab per part, each part
being the main key with the remaining parts as modifiers (`core::shortcut`,
required by D2 so no bare-modifier grab is ever created). On macOS every one of
those grabs therefore hits the `else` branch at `macos/mod.rs:160` and returns
`FailedToRegister("Unknown scancode for …")`.

The current defaults are `Ctrl+Super` (start/stop) and `Ctrl+Alt` (abort) — both
modifier-only. **On macOS both are expected to fail registration on first
launch**, with `Ctrl+Space` (pause) and the mode rotation unaffected because they
carry a real key.

What this needs is a decision, not a measurement:

1. Keep the defaults and let macOS show two rows as "not registerable" with the
   reason (the honest-state path from T8 already does this correctly).
2. Give macOS different capture defaults — which reintroduces per-OS default
   branching, the thing that let the legacy migration corrupt the Windows default
   (D6). If taken, the branch belongs in `core::config` only.
3. Add modifier scancodes to the vendored crate (`kVK_Control` `0x3B`,
   `kVK_Command` `0x37`, `kVK_Shift` `0x38`, `kVK_Option` `0x3A`). Note that
   Carbon `RegisterEventHotKey` with a modifier as the main key is not expected
   to work **[unverified]**, so this likely routes through the `CGEventTap`
   fallback — which requires Accessibility / Input Monitoring permission and
   makes the modifier-only path permission-gated on macOS.

Confirm the failure on a real macOS session before acting on it: the expectation
is code-level, and the surrounding OS behavior is not.

### Windows: modifier-only shortcuts register and then never fire — **[code]**

Worse than the macOS case, because it is invisible. Windows `register()` only
inserts into a software registry after checking `key_to_vk`
(`windows/mod.rs:44`), and `key_to_vk` does map `ControlLeft`, `AltLeft`,
`ShiftLeft` and `MetaLeft` (`windows/mod.rs:301`). So a modifier-only shortcut
**registers successfully** and Settings reports `registered=true`.

The hook then never matches it. `ll_keyboard_proc` handles every modifier virtual
key in an early branch that updates `MOD_STATE` and returns
`CallNextHookEx` (`windows/mod.rs:124`) — the `HOTKEY_REGISTRY` lookup below is
only reached for non-modifier keys. A hotkey whose main key is a modifier can
therefore never be found.

Consequence: **on Windows the default start/stop trigger `Ctrl+Super` and the
default abort `Ctrl+Alt` are expected to register and do nothing.** Combined with
the macOS finding above, the modifier-only defaults are expected to work on
Linux/X11 only.

This is the exact failure mode the rebuild was supposed to eliminate — the UI
claiming runtime truth it does not have. Note that the honest-state surface
cannot catch it: registration genuinely succeeded, so there is nothing for T8 to
report. The evidence path does catch it after the fact (presses stay at 0, so the
capability matrix reports `unobserved` forever), but nothing states it up front.

Options, all needing Felix's decision:

1. Patch the vendored crate so a modifier main key falls through to the registry
   lookup, and pass the event on rather than consuming it. See the
   single-modifier discussion below — same mechanism question.
2. Different capture defaults on Windows, which reintroduces per-OS default
   branching (D6).
3. Reconsider modifier-only defaults for all platforms, since they are currently
   the one class that works on exactly one of the three.

### macOS: the event tap is a fallback, not the primary path — **[code]**

`register()` tries Carbon `RegisterEventHotKey` first and only falls back to the
`CGEventTap` when that fails for a key that *does* have a scancode
(`macos/mod.rs:138`). Carbon needs no permission; the tap does. So the
Accessibility / Input Monitoring requirement applies to some shortcuts and not
others, depending on whether Carbon accepted the combination — which is why the
capability matrix states the permission as a caveat rather than a hard gate.

### Windows: injected keystrokes are ignored by design — **[code]**

The hook returns early on `kb.flags & LLKHF_INJECTED != 0`
(`windows/mod.rs:117`). Synthetic input therefore cannot trigger a WordScript
shortcut: not `SendInput`, not AutoHotkey, not most GUI automation tools. This is
deliberate (the crate's own `send_dummy_key` uses `SendInput` and must not
re-enter its own hook), and it decides how Windows can and cannot be tested — see
the alternatives section.

### Windows: overlapping holds lose the first release — **[code]**

A single `ACTIVE_ID`/`ACTIVE_VK` pair is stored (`windows/mod.rs:160`). Pressing
a second hold shortcut while the first is still down overwrites it, so the first
never receives its release. WordScript's watchdog ends that hold with a stated
reason rather than letting it strand, but the event is genuinely lost.

### Linux/X11: the release is tied to the main key only — **[code]**

The release fires when the grabbed keycode goes up, regardless of modifier order
(`x11/mod.rs:277`). Releasing the modifier first while still holding the main key
produces no release; releasing the main key does, even if the modifier is already
up.

## Why a single bare modifier is rejected, and what would change that

Raised while trying to test double tap on Linux: if the trigger is a *single*
Shift and the activation mode is double tap, then "a single modifier acts on every
press" no longer applies — that is what double tap is for. Wispr Flow
double-taps right Shift, macOS Dictation double-taps Fn. So why does the contract
still demand two modifiers?

Because the rule protects two different things and only one of them is about the
activation mode:

1. **Behavioral** — in tap mode every press acts. Double tap and hold do resolve
   this. The objection is correct on this half.
2. **Mechanical** — the shortcut is an OS-level **grab**, and a grabbed key is
   delivered to the grab owner instead of the focused window. A grab on a bare
   Shift means Shift no longer types capitals, in any activation mode. The
   activation mode decides *when WordScript acts*, never *whether the key still
   reaches anyone else*.

The tools that do double-tap-Shift do not grab. They *observe* — a non-consuming
system-wide key monitor — and let the keystroke through. That is the actual
prerequisite, and it exists to different degrees in the three implementations
**[code]**:

| Platform | Mechanism | Consumes the key? | What single-modifier would need |
| --- | --- | --- | --- |
| Linux X11 / XWayland | passive `grab_key` | Yes, whenever the grab matches | A different mechanism entirely: XInput2 raw key events or the XRecord extension, observing rather than grabbing |
| Windows | `WH_KEYBOARD_LL` hook with software matching, `return 1` only on a match (`windows/mod.rs:167`) | Selectively — the right shape already | Let modifier keys reach the registry lookup (see the finding above) **and** pass the event on instead of consuming it |
| macOS | Carbon grab, with a `CGEventTap` created `ListenOnly` returning the event unchanged (`macos/mod.rs:231`, `:525`) | Tap: no | Modifier scancodes in `key_to_scancode`, routing modifier-only through the tap rather than Carbon |

**The Linux half of this is now built** (ADR
[0009](../decisions/0009-modifier-only-shortcuts-are-observed-not-grabbed.md)):
modifier-only shortcuts are routed to XInput2 raw key events instead of a grab, so
`Ctrl+Super` no longer takes that combination from the desktop. `Grab` versus
`Observe` is derived in `core::shortcut::Delivery` from the shortcut itself, and
the platform layer applies the same rule, so the two cannot disagree. Windows and
macOS still need the same routing in their implementations; until then
modifier-only stays broken on both, in the two different ways recorded above.

### A single modifier is still rejected — for a different reason now

With observation in place, "a bare grab would take the key from the desktop" is no
longer true, so it is no longer the reason. What remains is that the trigger lane
cannot tell a deliberate tap of a modifier from the same modifier pressed while
typing. Typing "Hello World" presses Shift twice, and inside a 400 ms double-tap
window that is indistinguishable from a deliberate double tap. Two modifiers make
the combination rare enough to read as intentional.

Lifting it needs two things that are not in the contract yet:

1. **An interruption signal** — "was another key pressed while this modifier was
   held" — so `Ctrl+Alt` on the way to `Ctrl+Alt+T`, and Shift on the way to a
   capital, are distinguishable from a deliberate tap. The clean shape is to fire
   modifier-only triggers on the release edge (which the lane already does) and
   suppress that edge when the hold was interrupted. That means a third piece of
   state on `GlobalHotKeyEvent`, which every platform implementation constructs —
   so it is a coordinated change across all four backends, including `no-op`.
2. **Side-specific modifier tokens.** `MODIFIER_TOKENS` is side-agnostic
   (`Shift`, not `ShiftLeft`/`ShiftRight`) and both `event.code` values map to the
   same token. Right Shift works as a trigger for Wispr Flow precisely because it
   is rarely used in typing; the contract cannot currently express it. This
   touches the vocabulary, the recorder's chord serialization and the display
   strings.

Neither is blocked by hardware. Both are ordinary work, and (1) is the one that
actually makes the feature safe.

### Privacy

A non-consuming system-wide key monitor is structurally a keylogger-shaped
component — on macOS it is exactly what Input Monitoring gates, and on Windows the
low-level hook already is one. The mitigation is scope: the Linux path tracks the
eight modifier keycodes and discards every other keycode on arrival, without
recording, forwarding or logging it. That belongs in the privacy documentation and
not only in a code comment.

## Windows run sheet

Not started. Nothing has ever been executed on Windows.

**Prerequisite:** a Windows session with a keyboard whose events are not injected
(see the findings above). A virtual machine is acceptable; remote-desktop input
may not be — verify with item 0 before trusting anything else.

Setup: build and launch (`npm install`, `npm run tauri dev`), then watch the
runtime log for `[trigger]` lines. The log lives under
`%APPDATA%\WordScript\logs\wordscript-runtime.log`.

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| 0 | Press any registered shortcut once | `state=pressed` appears at all — if not, this input path is injected and unusable for the rest of the sheet | |
| 1 | All ten default bindings after first launch | `event=register … outcome=ok` for each; note every failure verbatim | |
| 2 | `Ctrl+Super` (default capture, modifier-only) | Registers, and a tap starts/stops a capture | |
| 3 | `Ctrl+S` and `Ctrl+1`–`Ctrl+6` | Register; confirm they are taken from other applications as documented, which is the accepted consequence of the chosen defaults | |
| 4 | Hold table: hold the mode-select shortcut 1 s / 3 s / 6 s | One `state=pressed` and one `state=released` per run, every run | |
| 5 | Two overlapping holds | Confirms the single-`ACTIVE_ID` finding: the first hold loses its release and the watchdog ends it with `event=hold_watchdog` | |
| 6 | Recorder: assign a new capture shortcut | Grabs are released while recording (`suspended=true`), the chord is captured, grabs return on close | |
| 7 | `Win`-based combination | Whether Windows reserves it, and whether the crate's `send_dummy_key` workaround behaves (it suppresses the Start menu) | |
| 8 | Capability matrix in Settings | Session reads `windows`; hold shows `conditional` before the first press and follows the counters after | |

Record the filled sheet in this file, dated, and then update the matrix only if a
result justifies a hard branch (invariant 10 in the
[hand-off](../handoffs/HANDOFF_shortcut-lane-rebuild.md)).

## macOS run sheet

Not started. Nothing has ever been executed on macOS.

Setup as above; the log lives under
`~/Library/Application Support/WordScript/logs/wordscript-runtime.log`.
Items 1–3 need **no keyboard input** and can be answered on any macOS instance
that can launch the app — including a CI runner or a rented Mac (see
alternatives).

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| 1 | Registration outcome of the default rotation | The modifier-only finding above predicts `FailedToRegister("Unknown scancode …")` for `Ctrl+Super` and `Ctrl+Alt`. Confirm or refute | |
| 2 | Whether a permission prompt appears at all, and when | Carbon needs none; the tap fallback does. Note which shortcut triggers it | |
| 3 | `Ctrl+Space` and the `Ctrl+1`–`Ctrl+6` rotation | Register — these carry a real key. Note that `Ctrl+Space` is the system input-source switcher on many configurations | |
| 4 | Display strings | `Super` renders as `Cmd`; the summary tile and pills show human form, never raw tokens | |
| 5 | Hold table: 1 s / 3 s / 6 s on a shortcut that registered | One `state=pressed` and one `state=released` per run, every run. **Needs physical keys** | |
| 6 | Without Accessibility / Input Monitoring granted | Which shortcuts still fire (Carbon path) and which go silent (tap path). This is the concrete content behind the matrix's macOS caveat | |
| 7 | After granting the permissions | Same list again, to establish what the grant actually buys | |
| 8 | Capability matrix in Settings | Session reads `mac_os`; the hold reason names Input Monitoring | |

## Alternatives to owning the hardware

Split the questions first — half of them need no keyboard at all.

### Answerable without physical input

Registration outcomes, default-rotation viability, display strings, permission
prompts, matrix rendering, build and unit tests. These need a process that
launches, not a person typing. Options:

- **GitHub Actions runners** (`windows-latest`, `macos-latest`): real hardware,
  real OS. Good for build, `cargo test`, `npm test`, and — with a headless-capable
  harness — the registration-outcome questions, because a registration failure is
  a return value, not a delivered keystroke. They cannot answer anything about
  key delivery: there is no interactive login session, and on macOS no TCC
  grants.
- **A rented Mac** (MacStadium, MacinCloud and similar): a real macOS desktop
  over VNC. Sufficient for macOS items 1–4, which is exactly the set that decides
  the default-rotation question.

The macOS modifier-only finding — the most consequential open item on this page —
falls entirely in this category. It does not need a Mac on your desk.

### Windows: a virtual machine is a legitimate test path

A Windows 11 VM under QEMU/KVM, VirtualBox or VMware answers **all** Windows
items including the hold table. The reason is the `LLKHF_INJECTED` finding: keys
typed into the VM's own console window are delivered by the guest's emulated
PS/2 or USB HID keyboard, so the guest's input stack sees ordinary hardware
events and the flag is not set **[unverified — item 0 of the run sheet exists to
confirm exactly this]**.

- Use the hypervisor's own display (QEMU/SPICE window, VirtualBox GUI), **not**
  RDP into the guest. Remote-desktop input arrives through a different path and
  may be flagged as injected.
- Windows 11 Enterprise evaluation ISOs (90 days) are the reliable source; the
  prepackaged "developer environment" VM images Microsoft used to publish are
  discontinued.
- Verify item 0 first. If `state=pressed` never appears, the input path is
  injected and every later row would be a false negative — the same trap XTEST
  set on Linux.

Verdict: **worth setting up.** It is the cheapest way to close a whole platform,
and it does not depend on acquiring anything.

### macOS: emulation is not a path for the input questions

- **A macOS VM on non-Apple hardware** violates the Apple software licence
  agreement, and more practically TCC (the Accessibility / Input Monitoring
  permission system) behaves differently in an unsupported VM than on real
  hardware. Since items 6 and 7 are *about* TCC, a result from there would be
  worthless even if it ran.
- **Darling** is not a virtual machine and does not run GUI applications; a Tauri
  app is out of scope for it.
- **A Mac VM on Apple hardware** (UTM/Virtualization.framework on an Apple
  Silicon Mac) is licensed and would work — but it presupposes the Mac.
- **VNC into a rented Mac** delivers synthetic events. Whether Carbon hotkeys
  fire for them is **[unverified]** and structurally the same uncertainty XTEST
  produced on Linux. Do not accept a negative result from that path as evidence.

Verdict: for macOS items 5–7, **wait for real hardware** — owned or borrowed for
an afternoon. Items 1–4 should be pulled forward onto a rented Mac or a CI runner
now, because they carry the decision that affects everyone's first launch.

## What is still open on the Linux development machine

- **S0 run 2, the physical measurement.** Hold durations with real keys, and
  press/release delivery with a native Wayland client focused. Procedure and
  empty tables are in
  [capture-shortcut-recording.md](capture-shortcut-recording.md). XTEST is
  exhausted and cannot answer either half.
- **Activation-mode behavior by hand in the native host:** tap start, tap stop,
  hold start, hold stop, a short tap below `hold_min_ms` in hold mode, and a
  deliberately missed release. The runtime paths are unit-tested; what is
  untested is the real grab delivering the real edges.
- **A `Super` combination assigned through manual entry**, confirming that the
  documented KWin workaround actually registers and fires.
