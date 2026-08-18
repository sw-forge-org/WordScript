# 0239 — A registered binding is not a delivering one, so the loop beats and the screen stops saying *Registered*

Date: 2026-08-19
Status: accepted
Area: `core/trigger.rs`, `vendor/global-hotkey`, Hotkeys screen

## Context

Every counter the app keeps counts events that **arrived**. Zero of them proves
nothing: an untouched keyboard and a dead backend produce the same zero. That is
why the 2026-08-18 report could only be reconstructed backwards from an absence
of lines, and why `register_standing` — which states what the standing
registration has delivered — closes only half the gap. It speaks when a
registration decision happens, and the failure itself makes no noise at all.

`registered` is a claim about the OS having accepted a grab. It stays true after
the backend can no longer deliver anything, and the recorded failure is exactly
that session: every slot reading `Registered`, no key event able to arrive
again.

## Decision

The backend reports its own liveness, and the app treats that as outranking
every per-binding answer.

- The X11 event loop beats once per iteration (`event_loop_heartbeat_ms`), names
  its own death where a caller can read it (`event_loop_stop_reason`, not only
  stderr), and counts the releases it had to emit itself
  (`event_loop_stranded_releases`).
- `DeliveryHealth` joins those to what this registration delivered, split by the
  path each event arrived on — `grab` against `raw`. The two fail
  independently, and which one went quiet is the difference between a competing
  grab and XWayland losing the keyboard entirely. On the reporting machine the
  split is 376 raw to 8 grab, which is what ruled out the record's first
  suspect.
- A delivery watch states it every five minutes, whether or not anyone touches a
  setting.
- On Hotkeys, a stopped loop replaces the per-slot badge with **Not delivering**
  and the hint states the only action that helps: restart. Nothing in the
  process can rebuild the grabs — they lived on the connection that died.

`quiet` — a registration standing past 30 minutes with nothing arriving — is
reported as a fact and never as a verdict. A quiet hour at the keyboard looks
identical. Its worth is that it is read next to the heartbeat, which says
whether anything was listening at all.

## Consequences

The next occurrence is self-reporting rather than reconstructed, which is what
the known-issue record asked for and could not have.

`Registered` becomes a narrower claim than it reads as, and the screen no longer
makes it when it is not the operative truth. That is the runtime rule the
product already holds — show runtime truth, and where the runtime is not ready
show the next action — applied to the one badge that had been exempt from it.

The watch adds one runtime-log line every five minutes. That is deliberate: the
bug it exists for is intermittent and its whole difficulty was that the interval
in which the grabs were already dead had no bound.

## Pinned by

`the_delivery_watch_states_liveness_before_it_states_counts`,
`a_stopped_event_loop_is_stated_instead_of_a_beat`,
`quiet_needs_both_a_long_standing_registration_and_nothing_arriving`, and
`stops calling a binding registered once nothing can be delivered` on the
Hotkeys screen.
