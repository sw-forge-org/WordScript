# 0154: The second insert channel is removed, because the first one already said it

Date: 2026-08-15
Status: Accepted

## Context

[ADR 0153](0153-the-seam-has-two-channels-and-the-sweep-only-knew-one-of-them.md)
swept the event channel for the first time and found that
`wordscript-native-insert` was emitted from three sites in `core::insertion` and
listened to by nothing in `src/` — not by the overlay, not by the workspace, not
by a test mock — while `spec/SPEC.md` carried it as part of the runtime→frontend
contract: *"carries `NativeInsertResult`, including insertion and recovery
truth."*

That ADR recorded the finding and deliberately did not act on it. It named the
two branches and the rule that decides between them, and left the disposition to
the owner, because the insert belongs to the Runtime ownership track and because
ADR 0093 forbids deleting anything on a grep. **The owner took the decision on
2026-08-15.**

What the measurement had already established, and what makes this the cheap
branch: every one of the three emitters sits beside a path that already delivers
the same `NativeInsertResult` by another route.

- `insert_text_native` emitted, then returned `result` to its `invoke` caller.
- `restore_last_transcript` emitted, then returned `Ok(result)`.
- `insert_transcription_from_legacy` — the runtime-driven path, called from
  `lib.rs`, `sessions.rs` and `history.rs` with no frontend caller to return to —
  emitted, and its result reaches the frontend folded into `wordscript-event` as
  the `insertion` field (`src/types/ipc.ts`).

So no surface was missing truth it needed, on any path. What existed was a second
channel carrying session truth that the authoritative one already carried.

## Decision

**`wordscript-native-insert` is removed, and the spec says so rather than going
quiet.**

1. `emit_insert_event` and its three call sites are gone from
   `core/insertion.rs`, along with the `Emitter` import that only it needed.
2. **The timing pair around the emit goes with it.** It measured the emit and
   reported `total_elapsed_ms` beside it; with the emit gone the two log lines
   would have measured the same instant, so the surviving line carries the total
   instead of the state-only elapsed.
3. `spec/SPEC.md` keeps a sentence where the contract line was, naming what
   replaced it. **A removed channel that leaves no trace in the spec is
   indistinguishable from one nobody ever wrote down**, and the next sweep would
   have to re-derive why it is absent.

**The rule this turns on is ADR 0018/0019**: a session ends in exactly one
reducer commit, together with the surface that reports it. A second channel
delivering the same result out of band is the shape `CLAUDE.md` already forbids
for `wordscript-native-event`, which must never set `status`, `pendingResult`,
`previewStaged` or `resultSurfaceOpen`. Keeping an unlistened emitter alive is
keeping that shape available for a future surface to bind to by mistake.

## Consequences

- **The sweep now reports zero in all four defect directions**, which is the
  first time both channels of the seam have been clean at once: `direction 1: 0 |
  direction 2: 5 | listener with no emitter: 0 | emitter with no listener: 0`.
  The five remain the orphans ADR 0089 and ADR 0093 triaged and are unchanged.
- **`npm run sweep:commands` is the standing check** and runs beside
  `npm run port:diff`. ADR 0153 built the instrument and left the alias unwired
  because a dev host was running and Vite can restart on a `package.json` write;
  the owner cleared the restart on 2026-08-15 and it landed.
- **The insert path got marginally shorter on every dictation.** A Tauri `emit`
  with no listeners still serialises its payload, so each insert serialised a
  `NativeInsertResult` for nobody. That is a side effect, not the reason — the
  reason is the one-commit rule.
- **This is the second finding this cluster produced that no compiler could
  see.** ADR 0103's was a caller naming a command that never existed; this one is
  an emitter naming a channel nobody hears. `cargo check` is happy with both — a
  string is a valid string, and a registered command needs no caller — which is
  what the sweep exists for.
- The disposition of the five `invoke` orphans is unchanged and still open. They
  are dead weight with substitutes of differing value (ADR 0093), and nothing
  here touches them.
