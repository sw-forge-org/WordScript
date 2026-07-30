# 0024: The Processing Mode Has One Source, and Every Writer Announces It

Date: 2026-07-30
Status: Accepted

## Context

Reported as: *"switching processing mode in the UI is not always 1:1 in sync
with the overlay — if I change the mode in Settings while recording, the overlay
does not update."* The "not always" was the useful part: the same action worked
sometimes and not others.

Two independent defects produced it.

### 1. A second source of truth that nothing ever cleared

`mode_router` held a process-global `MODE_OVERRIDE`. `resolve_processing_mode`
gave it absolute priority over the active profile's
`work_mode.processing_mode`.

It was set by `set_active_profile_processing_mode` — the overlay tap cycler and
every per-mode hotkey — and **never cleared in production**.
`clear_processing_mode_override` existed as a Tauri command but had no caller:
its only consumer, `src/hooks/useProcessingMode.ts`, was imported by nothing
except its own test file.

So the first overlay tap or mode hotkey after a start pinned the mode for the
rest of the process. Every later change in Settings was written to the profile
correctly, resolved away here, and the overlay went on showing the old value.
That is exactly the "sometimes": with no tap since launch the override is
`None` and the sync works; after one tap it never works again.

**It was not cosmetic.** `lib.rs` resolves the pipeline's mode through the same
function, so a stale override also decided how the audio was actually
processed — a setting the user could see, silently outranked by a value they
could not.

The Settings "Effective mode" card even rendered the collision as a feature:
*"Runtime override: X (wins over profile default)"* — announcing that an
invisible value beat the control directly above it, with no way to clear it.

**The override bought nothing.** Its stated purpose was immediacy for an
in-flight session. But `set_active_profile_processing_mode` persists to disk
*before* it returns, and `pipeline_app_config` is loaded in `lib.rs` after the
recording ends and just before the transcription request. A mode changed
mid-recording — the reported scenario — is therefore already on disk by the time
the mode is resolved. The override was a second, invisible copy of a value that
was already correct, and the copy outranked the original.

### 2. The settings-save path emitted no mode signal

`wordscript-mode-event` is the channel the overlay listens on. Only the hotkey
paths emitted it. `save_config` and `switch_active_text_profile` emitted just
`wordscript-event: ready`.

The overlay did have a `[state.config]` effect that refetched on a config
change, so the sync hung on a *side effect* — a new object identity — rather
than on a named signal. And that effect ran into the second half of the bug:
`fetchEffectiveMode` guarded itself with

```ts
if (now - lastModeFetchRef.current < 150) return;
```

a leading-edge debounce that **discards** the call instead of deferring it. A
save landing within 150 ms of any other fetch was dropped and never retried;
nothing refetched again until some unrelated trigger came along. The debounce
exists for a real reason — collapsing a burst of refetches into one commit is
what fixed the pill ghosting — but "collapse a burst" and "drop the last
request" are not the same thing.

A comment in `OverlayWindow.tsx` claimed the settings save arrived via
`wordscript-mode-event`. It never did.

## Decision

**The active profile's `work_mode.processing_mode` is the only source of the
effective mode.**

`MODE_OVERRIDE`, `set_processing_mode_override`, `clear_processing_mode_override`
and `current_mode_override` are removed, along with the dead
`useProcessingMode.ts` and its test. `resolve_processing_mode` takes one
argument. `ProcessingContext.is_override` and the `is_override` field on
`ProcessingModeEvent` go with them: a field that is now always false is a
question the product has stopped asking, and keeping it would invite a future
reader to re-introduce the layer.

Every path that writes the mode persists it to the profile — the overlay
cycler, the mode-select hotkey and the six per-mode hotkeys already did. So
there is nothing left for an override layer to hold.

**Every writer of the effective mode owes both signals.** `ready` carries the
whole config for the Settings form; `wordscript-mode-event` is the named signal
the overlay listens on. `config::emit_effective_mode_event` is the one producer,
called from `save_config`, `switch_active_text_profile` and
`set_active_profile_processing_mode`. Switching profile counts as a mode change,
because the mode lives on the profile.

**The debounce coalesces to the last request instead of dropping it.** Inside
the window the call is deferred to the end of it, replacing any already-pending
trailing fetch. The burst still collapses into one commit; what changes is which
request survives.

## Consequences

- The Settings precedence line has two states instead of three: `Auto mode: …`
  or `Profile default: …`. The removed third one described a mechanism that no
  longer exists.
- `set_mode_override_and_emit` is renamed `set_mode_and_emit` and no longer
  emits by hand — `set_active_profile_processing_mode` emits both signals, so
  the helper only resolves and returns.
- Five mode_router tests are superseded by three. The removed ones asserted the
  override's lifecycle and its priority over the profile; keeping them would
  have pinned the defect.
- A regression test covers the reported symptom directly: a mode event landing
  inside the debounce window must still reach the overlay. It was verified to
  fail against the old leading-edge guard before the fix was restored.
- Behaviour change worth naming: a mode change made *after* the pipeline has
  loaded its config — i.e. while the transcription request is already in
  flight — no longer applies retroactively to that recording. It applies from
  the next one. The override used to reach back into it, which was never a
  decided behaviour, only a side effect of where the value was read.
- Not addressed: `resolve_current_processing_mode` still loads the whole config
  from disk on every call, and the overlay calls it on every mode event. That is
  unchanged from before and has not been measured as a problem.
