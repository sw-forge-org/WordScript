# 0103: The sweep only ever asked which command has no caller, and the other direction is the one that breaks

Date: 2026-08-11
Status: Accepted

## Context

ADR 0089 made the caller sweep a standing check: the `invoke_handler` list
against every `invoke(` in `src/`. ADR 0093 gave it a third question, because a
command whose name survives in a test mock looks called to a name-grep and
uncalled to a call-grep.

Both are the same question — **which registered command has no caller** — and its
answers are all dead weight. Leg 12 ran the sweep in the other direction, which
had never been run, and its answer is not dead weight at all.

**`load_transcription_history` is invoked by `OverlayWindow.tsx` and registered
nowhere.** It is not a command that lost its surface; it is a name that never
existed. `git log --all -S` puts it in exactly one commit — `1fda91d`, the
commit that introduced the caller — and none in `src-tauri/`. The registered
command is `transcription_history_entries`, and the caller's payload is already
the right shape for it: `{ query: { limit, include_errors_only } }`,
deserialized by `TranscriptionHistoryQuery`.

**What that broke.** `handleRetryFromRecording` is the overlay's *Retry from the
recording* control, offered when `errorAudioRetained` says the runtime kept the
audio of a failed dictation. `invoke` rejects an unknown command name, the
function's own `.catch` logged `retry from recording failed` to a console
nobody reads, and `setRetryPending(false)` cleared the spinner. The button has
looked like it works and done nothing since 2026-08-03 — **in the commit whose
entire subject was that a 679-second dictation was lost and the audio must
survive the failure so it can be retried.** `useTranscriptionHistory` has always
used the right name, which is why the same retry works from the History list.

**Why eight legs of checks did not find it.** Every sweep asked about commands.
This is a caller. `cargo check` cannot see it — the Rust side is complete and
compiles. `npm run build` cannot see it — the string is a valid string. The
test suite could not see it: `OverlayWindow.test.tsx` asserted the retry button
*appears* when the audio was kept and never pressed it, so the invoke mock's
`default` arm — which throws on an unknown command — was never reached.

**A second finding about the sweep itself, and it manufactures the opposite
error.** The first pass this leg ran was a line-based `grep -E "invoke(<…>)?\(\s*\"name\""`,
and it reported **five false orphans**: `export_full_backup`,
`import_full_backup`, `export_text_rules`, `import_text_rules` and
`reset_all_settings`. All five are called from `Privacy.tsx`, and all five are
called like this:

```ts
const answer = await invoke<{ history_count: number; transcript_count: number }>(
  "export_full_backup",
  { request: { path } },
);
```

The command name is on the line after the `invoke(`. A line-based grep cannot
see it. Had this leg trusted the first pass, both halves of the backup path
would have been triaged as dead weight — inside the leg running the sweep, which
is the failure mode ADR 0092 recorded for a copy fix and ADR 0093 for a mock.

## Decision

**The sweep is two directions and one shape requirement, and the second
direction is checked first, because only its answer is a defect.**

1. **Caller with no command** — every `invoke("name")` in `src/` against the
   `invoke_handler` list. A miss here is a control that rejects at runtime. It
   is a bug, not a triage question, and it is fixed rather than recorded.
2. **Command with no caller** — the ADR 0089 sweep, with ADR 0093's third
   question. A miss here is dead weight and is triaged by *why it lost its
   caller*.
3. **The scan must span lines.** A name may be one argument on its own line.
   Line-based `grep` produces false orphans in the second direction and false
   passes in the first; the check reads whole files.

**`load_transcription_history` becomes `transcription_history_entries` and the
control is pressed by a test.** The new case in `OverlayWindow.test.tsx` clicks
the retry button and asserts both invokes, and it was verified to FAIL against
the old name before it was kept — the mock's `default` arm throws
`Unexpected invoke command`, so a wrong name now fails loudly instead of
silently.

## Consequences

- **A registered command's absence is louder than a caller's mistake, and the
  quieter one is the one that reaches a user.** Every check in this repository
  was built around the loud half. The overlay is the surface where that matters
  most: it has no console anybody reads and no second path to the same action.
- **A control that is only asserted to EXIST is not tested.** The retry test
  passed for eight legs while the retry did nothing. Where a control's whole
  purpose is the call it makes, the test presses it.
- **The five false orphans stand as the reason a sweep is not a one-liner.**
  The three ADR 0093 recorded are unchanged and still undecided:
  `read_diag_log`, `clear_diag_log`, `overlay_open_devtools` appear only as
  `case` arms in `OverlayWindow.test.tsx`'s mock. `preview_prompt_enhance`
  (ADR 0089, owed a surface) and `transcribe_audio_file` (ADR 0089, command
  shell only) appear nowhere in `src/` and are unchanged. Nothing was deleted.
- Leg 10's extension found nothing further: no `pub` type in `src-tauri/` is
  reachable only through a command that no longer exists.
