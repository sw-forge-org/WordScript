# Bug: "Copy to clipboard only" does not put anything on the OS clipboard until the preview commits

Status: **Resolved 2026-08-18 (Leg 1), [ADR 0231](../decisions/0231-each-delivery-mode-gets-one-switch-and-off-is-what-that-mode-always-did.md).**
Built as the owner proposed it — one switch per delivery mode, both defaulting to
today's behaviour. The three decisions below were settled by the owner before any
of it was written: the switches live per profile in `work_mode`; the commit
writes the clipboard again, so an edit replaces the early text; and the restore
does not run when the transcript is kept.**

> **Both switches shipped inoperable and were repaired the same day (Leg 1
> part 2).** The owner reported that neither could be used. The runtime half was
> correct throughout; `cloneTextProfileWorkMode` in `src/lib/textProfiles.ts`
> enumerated six of the ten fields `TextProfileWorkMode` carries and dropped both
> switches — and that resolver is the read behind each control's `checked` as
> well as the base of every `work_mode` write. So the controlled value read
> `false` forever, and any unrelated edit to the block erased whatever was
> stored, which is exactly the round trip the ADR guarantees. `Profiles.test`
> stayed green because it asserts on the patch, where the write literal supplies
> the field being toggled. Recorded in
> [`../tracks/open-fixes-leg1-part2.md`](../tracks/open-fixes-leg1-part2.md); held
> by the resolver case in `textProfiles.test.ts`, which reads the field list out
> of `core/config.rs` instead of restating it.

First reported: 2026-08-18, by the owner ("it is wrongly only stored in
WordScript's own clipboard until I press the Copy button in the result overlay")
Affected area: `lib.rs` pipeline tail, `core/sessions.rs` preview commit,
`core/insertion.rs`

## Symptom

With delivery `clipboard_only`, a finished dictation is **not on the system
clipboard**. `Ctrl+V` in another application pastes whatever was there before.
The transcript only reaches the clipboard when the user presses Copy in the
result overlay — or, unnoticed, ten seconds later.

The owner's reading of this was "it goes into WordScript's own clipboard". There
is no such thing in the code, and the observation is nonetheless exactly right:
the transcript is held in the session's pending preview and nowhere the rest of
the desktop can see.

## Mechanism

`clipboard_only` takes the preview branch. It emits `preview_ready` and **writes
no clipboard at all**:

```
+122.695  Native pipeline preview ready session_id=native-2 elapsed_ms=781 delivery=clipboard_only
+132.696  Native preview deadline expired session_id=native-2 deadline_ms=10000 outcome=committing
+132.718  Clipboard chain entry is_wayland=true has_wl_copy=true chain=[WlCopy, Arboard]
+132.718  wl-copy write start display=wayland-0 text_len=7
+132.760  wl-copy clipboard verified via wl-paste (8 bytes)
```

Ten seconds between the transcript being ready and it being reachable. Pressing
Copy commits early; doing nothing commits at `PREVIEW_COMMIT_DEADLINE_MS`
(`core/sessions.rs`, 10 000 ms).

This is by design — the preview is a decision surface, so the text can be edited
before it is delivered (ADR 0011a) — but the design has no way to say "stage it
*and* make it available", and the two are not actually in conflict.

## The asymmetry that makes it feel like a bug

`auto_paste` writes the clipboard immediately, because it needs the clipboard as
the transport for `Ctrl+V`, and then **puts the previous contents back**
(`schedule_clipboard_restore`, `CLIPBOARD_RESTORE_DELAY_MS`). The Delivery screen
states this: *"Pastes at the cursor, then restores your clipboard."*

So across the two modes:

| Delivery | On the OS clipboard | When | Afterwards |
| --- | --- | --- | --- |
| `auto_paste` | yes | immediately | **replaced again** by the previous contents |
| `clipboard_only` | yes | **only on commit** (click, or 10 s) | stays |

Neither mode does the plain thing — "the transcript is on the clipboard, now,
and stays there" — and the mode named after the clipboard is the one that takes
longer to get there.

## The owner's proposed shape (2026-08-18)

One switch per delivery mode, each choosing between the two reasonable
behaviours rather than adding a third:

- **Copy and insert at cursor** → *also keep it on the clipboard?* Off is
  today's behaviour (paste, then restore); on leaves the transcript on the
  clipboard afterwards.
- **Copy to clipboard only** → *put it on the system clipboard immediately?* Off
  is today's behaviour (staged, delivered on commit); on writes it as soon as the
  transcript is ready, with the preview still offering the edit.

## What has to be decided before building it

1. **Where the switches live.** The delivery mode is a profile setting
   (`work_mode.insert_behavior`); the Delivery screen only reports it and links
   to Profiles. Two per-mode switches would be new `work_mode` fields.
2. **What an edit does when the immediate write is on.** Writing on
   `preview_ready` and then committing an edited text means the clipboard holds
   the unedited version for the length of the edit. Acceptable and probably
   expected, but it must be deliberate: the commit has to write again.
3. **Whether the restore delay stays.** With "keep it on the clipboard" on,
   `schedule_clipboard_restore` must not run for that mode — which is a change to
   the one behaviour the Delivery screen currently advertises in words.

## What was built (2026-08-18)

- `work_mode.keep_on_clipboard` — `auto_paste` only. On, the transcript stays on
  the clipboard and `schedule_clipboard_restore` does not run; the record says
  `SkippedKeptOnClipboard`, which is deliberately not the same value as
  `SkippedDeliveryUnverified`.
- `work_mode.clipboard_immediately` — `clipboard_only` only. On, the clipboard is
  written as soon as the transcript exists, on `spawn_blocking` so the 800 ms
  `wl-copy` verify does not sit on the async runtime. The preview still offers
  the edit, and committing writes again.
- Both drawn on Profiles beside the Delivery row, each only under the mode it
  belongs to. The Delivery screen's sentence follows the switch instead of
  promising "then restores your clipboard" in both cases.
- Both default off, and a config written before they existed deserialises to off.

## Related

- [ADR 0011a](../decisions/0011a-one-decision-surface-per-delivery-mode.md): why the preview exists
- [auto-paste-reports-success-without-inserting.md](auto-paste-reports-success-without-inserting.md): the other half of what the owner reported that day
- [REFERENCE.md](../REFERENCE.md): delivery mode semantics
