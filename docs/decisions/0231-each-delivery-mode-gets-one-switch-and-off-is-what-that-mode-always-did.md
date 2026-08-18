# 0231 - Each delivery mode gets one switch, and off is what that mode always did

Date: 2026-08-18
Status: Accepted. Extends
[ADR 0011a](0011a-one-decision-surface-per-delivery-mode.md) without changing it.

## Context

Neither delivery mode did the plain thing — *the transcript is on the clipboard,
now, and stays there* — and the mode named after the clipboard was the slower of
the two to reach it:

| Delivery | On the OS clipboard | When | Afterwards |
| --- | --- | --- | --- |
| `auto_paste` | yes | immediately | **replaced again** by the previous contents |
| `clipboard_only` | yes | **only on commit** (click, or 10 s) | stays |

`auto_paste` needs the clipboard as the transport for `Ctrl+V` and then restores
it, which the Delivery screen advertised in words. `clipboard_only` stages the
text in the session's pending preview, because the preview is a decision surface
(ADR 0011a) and the write waited for the decision — so a finished dictation was
reachable nowhere on the desktop for up to ten seconds.

Both are deliberate. What neither had was a way to say *stage it **and** make it
available*, and the two are not in conflict.

## Decision

**One switch per delivery mode, each choosing between the two reasonable
behaviours rather than adding a third**, both stored per profile in `work_mode`
beside `insert_behavior`:

- **`keep_on_clipboard`** — `auto_paste` only. On, the transcript stays on the
  clipboard and `schedule_clipboard_restore` does not run.
- **`clipboard_immediately`** — `clipboard_only` only. On, the clipboard is
  written as soon as the transcript exists, with the preview still offering the
  edit.

**Both default off, so every existing profile keeps exactly the behaviour it
had** and a config written before the switches existed deserialises to it.

Three decisions the record asked for, as the owner settled them:

1. **Where they live: per profile, in `work_mode`.** A profile describes its
   delivery completely in one place, which is the same rule ADR 0123 states.
   Profiles is already the sole *editing* surface for delivery — `General.tsx`
   excludes it by name and `Delivery.tsx` shows a read-only badge that links
   back — so this adds no second home.
2. **An edit under an immediate write: the commit writes again.** For the length
   of the edit the clipboard holds the unedited text. That is the price of it
   being there at all, and it is deliberate rather than tolerated.
3. **The restore does not run when the transcript is kept.** The switch does what
   it says, and the Delivery screen's sentence follows the switch instead of
   promising one behaviour for both.

**Each switch is answered only under the mode that offers it.**
`effective_keep_on_clipboard()` is false under `clipboard_only` and
`effective_clipboard_immediately()` is false under `auto_paste`, so a profile
that changes mode cannot report a switch that mode never applies. The stored
value survives the round trip, so changing back restores the answer.

## Consequences

- `NativeClipboardRestoreStatus` gains `SkippedKeptOnClipboard`, distinct from
  `SkippedDeliveryUnverified`. One is a setting and the other is a doubt; a
  record that conflated them would make the setting read as a failed delivery.
- The early write runs on `spawn_blocking` — `wl-copy` plus its verify can take
  800 ms and the pipeline is on the async runtime. A failure is logged and
  dropped: the preview still commits, so the transcript is late, never lost.
- The Delivery screen's hint is now four sentences chosen by mode and switch,
  because it is the one place the product states this behaviour in words.

## References

- [`known-issues/clipboard-only-does-not-reach-the-os-clipboard-until-committed.md`](../known-issues/clipboard-only-does-not-reach-the-os-clipboard-until-committed.md)
- [ADR 0123](0123-a-fact-has-one-list-and-a-track-is-a-directory-not-a-naming-convention.md)
