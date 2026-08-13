# Bug: The dev server reloads all three windows mid-session

Status: **Open — cause located 2026-08-13, not yet fixed. Dev-only by
construction: `vite` does not exist in a release build.**

First reported: 2026-08-13, as "sometimes the whole GUI window just goes white
and the overlay becomes invisible"
Affected area: `vite.config.ts` watcher scope; consequences reach every window
and every measurement taken under `npm run tauri dev`

## Symptom

At irregular intervals the settings window goes white and the overlay
disappears. The runtime keeps working: a capture that is running keeps
recording, and the transcript arrives complete.

## Cause

`vite.config.ts:21-24` restricts the dev server's watcher to one exclusion:

```ts
server: {
  watch: {
    // Don't trigger rebuilds when Rust files change
    ignored: ["**/src-tauri/**"]
  }
}
```

`donors/**` and `vendor/**` are excluded at `vite.config.ts:46-47`, but inside
`test.exclude` — a Vitest key. **The dev server never reads it.** So the
watcher covers the whole repository except `src-tauri/`:

| Tree | Files | Size |
|---|---|---|
| `donors/` | 32,576 | 3.4 GB |
| `vendor/` | 4,078 | 2.2 GB |
| `src/` (the actual frontend) | 246 | 3.0 MB |

`donors/` alone holds **577 `tsconfig.json` / `package.json` files**, and vite's
response to a change in any of them is not HMR:

```
[vite] changed tsconfig file detected: .../donors/app/meeting-notetakers/anarlog/
       examples/plugins/hello-world/tsconfig.json - Clearing cache and forcing
       full-reload to ensure TypeScript is compiled with updated config values.
```

A full reload tears down and rebuilds the webview of every open window. The
white settings window and the vanished overlay are that reload, seen from the
outside.

## The log signature

WordScript records the reload without knowing it does. Each window's frontend
calls the shortcut registration on mount, and `trigger.rs:874-895` skips the
re-grab when nothing changed:

```rust
// Idempotency guard: skip unregister/re-register when shortcuts haven't changed.
// This prevents a brief gap where the shortcut is unregistered (and a user press
// would be silently dropped) on every concurrent startup call from multiple windows.
```

So **a triple of `[trigger] event=register outcome=skipped_idempotent` is three
window frontends remounting**, which is one full reload. Count them:

```
grep -c "event=register outcome=skipped_idempotent" \
  ~/.config/WordScript/logs/wordscript-runtime.log
```

Over 2026-08-10 18:23 to 2026-08-13 00:55 that is **4,168 lines — about 1,389
full reloads in 2.5 days**, in 226 bursts. The worst burst is **53 reloads in
0.9 minutes**, roughly one per second.

## It happens during live captures

Joining the reload timestamps against the capture windows in the same log:
**33 captures had at least one full reload while they were recording.** The
longest is 2026-08-11 19:37:36, a 197.6 s capture with **22 reloads inside it**,
including a run of one per second from 19:38:21 to 19:38:36.

That capture's audio is perfect: `missing_ratio=0.0002`, `verdict=Intact`,
`signature=no_gaps`. The runtime never noticed.

This is the shape the owner described: the overlay dies, the recording does not.
The Rust session survives because it owns the capture; the overlay's React app
is destroyed and remounts with no session state, so it renders nothing while
Rust is still recording.

**The hotkeys are unaffected** — they are Rust-owned and the owner confirms
every shortcut works every time, so a session is always stoppable.

**What the missing surface costs is the transcript itself.** Every insert call
site is an `invoke` from `OverlayWindow.tsx`, and the clipboard write, the
history record and the transcript file are all created inside that insert. A
reload during the preview therefore does not hide the text — it stops it from
being written. The same 277-preview measurement that dates the reloads shows
the dependency: 1.12 s median preview→insert, **11.45 s to 115.11 s in the 13
sessions with a reload in that window**, and one preview that died with an app
restart and was never written anywhere.

That makes this record a data-loss contributor, not only a cosmetic one — until
[ADR 0134](../decisions/0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
lands and the runtime commits on its own deadline. See
[overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md), whose
2026-08-13 addendum tabulates this as the third mechanism to reach that damage.

## What this does NOT cause

**It does not cause the capture loss.** This was the obvious story and it does
not survive the join: of the 33 captures with a reload inside them, **all 33 are
`Intact` and none is `Short`**. None of the three `Short` captures in the log
had a reload in its window; the 2026-08-13 00:36 event had four in the 30 s
before it and none during. See
[capture-loses-half-the-recording.md](capture-loses-half-the-recording.md).

## Why it matters beyond the white window

Every capture measurement in the record was taken under `npm run tauri dev`,
i.e. inside a process that was periodically tearing down and rebuilding three
webviews, driven by a watcher on 36,000 files. The `capture-soak` binary
(ADR 0084) has none of that.

ADR 0084 named the soak-versus-app delta as "the `app.emit`". That
understates it. The real delta is **`app.emit` + contention on the capture
mutex from the app's command threads + this reload storm**. A soak night that
finds nothing is consistent with all three, not just the first.

## Fix

One edit, `vite.config.ts:23`:

```ts
ignored: [
  "**/src-tauri/**",
  "**/donors/**",
  "**/vendor/**",
  "**/target/**",
  "**/.kilo/**",
]
```

Then verify: restart `npm run tauri dev`, touch a file under `donors/` and
confirm no reload; touch `src/App.tsx` and confirm HMR still works; watch the
runtime log for the register triple disappearing outside of real restarts.

The duplication between `server.watch.ignored` and `test.exclude` is what let
this hide — the same list is meant twice and only one copy is honoured. Derive
both from one constant in the config so a future addition cannot land in only
one of them.

## Open

- Whether a release build can produce the white window by another route. No
  release build has been checked against it, which is the same gap
  [overlay-recording-freeze.md](overlay-recording-freeze.md) has carried since
  2026-07-27.
- Whether reloads explain a share of the reopened
  [overlay-stranded-off-screen.md](overlay-stranded-off-screen.md) sightings.
  They are distinguishable in the log; see that record's 2026-08-13 addendum.

## References

- [overlay-recording-freeze.md](overlay-recording-freeze.md) — the record this
  supplies a candidate cause for, and whose heartbeat cannot detect a reload
- [overlay-stranded-off-screen.md](overlay-stranded-off-screen.md) — the other
  record that owns "invisible mid-recording", by a different mechanism
- [capture-loses-half-the-recording.md](capture-loses-half-the-recording.md) —
  ruled out as a cause there, but it changes how that record's soak result reads
- [diag-log-write-surface.md](diag-log-write-surface.md) — the diagnostic log
  this investigation relies on
