# 0089: A registered command with no caller is triaged by why it lost one

Date: 2026-08-11
Status: Accepted

## Context

Leg 8 found two registered `#[tauri::command]`s writing a config field the
frontend never touched, and made a rule of it: *check whether the runtime
already ships it and nothing calls it.* Leg 9 ran that check as a sweep —
the whole `invoke_handler` list against every `invoke(` in `src/` — and found
**fourteen** registered commands with no frontend caller, not two.

Fourteen is too many to answer with one verdict. Leg 7's rule says a primitive
with no user is not part of the system; applied flatly here it would delete a
capability the product used to have and a lane an ADR explicitly defers. So the
question is not *does it have a caller* but **why it stopped having one**, and
the answers turn out to be four different things.

**One premise from Leg 8's record is corrected here.** That record states the
acknowledge commands lost their caller "since Leg 3 deleted `PromptsTab.tsx` in
`8f9077e`, which is the file that used to call them". `PromptsTab.tsx` did not
call them. It held acknowledgements in React `useState` and passed them to
`get_profile_health` as a request field, so they were never persisted at all.
`git log --all -S` finds **no commit in the repository's history** in which
either command was invoked from `src/`. They are not a deleted caller; they are
a surface that was never built. The rule Leg 8 drew from them still holds — it
is the example that was wrong, and this record is where the next reader finds
that out rather than repeating it.

## Decision

**A caller-less command is triaged into one of four classes, and only one of
them is deleted.**

### Superseded — the operation has a live path, this door is the old shape. Deleted.

| Command | What replaced it |
| --- | --- |
| `acknowledge_profile_health_flag` | the config seam (ADR 0085); and these two take no `AppHandle`, so they cannot emit `ready` — a second window would never learn of an acknowledgement made through them |
| `unacknowledge_profile_health_flag` | same |
| `resize_overlay_to_height` | fixed per-surface geometry (`OverlaySurface::dimensions`) |
| `resize_edit_overlay` | same |
| `get_workspace_context` | nothing needs it: `detect_active_app` runs from the pipeline, and the UI caller went with the process-global override ADR 0024 removed |
| `app_config_file_path` | nothing; caller went with Leg 3's overwrite and no surface wants it |

The two resize commands are the reason this class is deleted rather than
tolerated. They are not merely unused — they are **the path this codebase
deliberately abandoned**, and `OverlayWindow.tsx` records why: `set_size` is
asynchronous on WebKitGTK/GTK, so back-to-back resizes leave the window a tick
behind and clip the pill. Two registered commands that reintroduce
`docs/known-issues/overlay-ghosting.md` are a loaded gun in a drawer, not dead
weight. Their five `OVERLAY_EDIT_MODE_*` clamp constants went with them —
`cargo check` named all five the moment the commands left, which is the compiler
confirming they had exactly one user.

### Owed a surface — a decision defers it. Kept.

- **`preview_prompt_enhance`** — ADR 0065 names it explicitly as Phase 8 and
  "already stated as Phase 8 on the surface". Deleting it would delete a
  deferral, not a corpse.

### Lost capability — a caller was deleted and nothing replaced the function. Kept, and listed.

- **`export_text_rules` / `import_text_rules`** — full implementations with a
  schema version, conflict resolution, merge and analysis. Their caller went
  with Leg 3's shell overwrite (`8f9077e`) and **nothing took the capability
  over**: `export_full_backup` writes the whole config, which is a different
  artifact from a shareable rules document. `ARCHITECTURE.md` still claimed the
  UI does "import/export in Text Rules", which is how a regression stayed
  invisible for six legs — the doc asserted it, the runtime still compiled it,
  and only the caller was gone.

  **Deleting these would make a silent loss permanent.** They go on §2.5 as a
  capability the port dropped, for the owner to decide, and the doc claiming
  otherwise is corrected in the same commit.

### Command shell only — the function is alive, the door is not. Kept, and listed.

- **`transcribe_audio_file`** — called by `history.rs` on retry and by `lib.rs`
  on the pipeline. Only its `#[tauri::command]` registration is unreached.
- **`start_native_session`, `stop_native_session`, `native_session_status`,
  `complete_native_session`** — thin wrappers over `start_from_native`,
  `processing_from_native` and the session state machine, all of which the Rust
  trigger path drives. `abort_native_session` is the one of the five with a
  caller, because the overlay draws an abort and the rest come from hotkeys.

  These are **named in `docs/spec/SPEC.md` as contract** under "Tauri commands
  (UI -> Rust), key surface". Removing them is a contract change, not a drift
  correction, and a drift leg does not make one. What this leg does instead is
  fix the section that describes them: a list headed *UI -> Rust* may not
  contain four entries no UI calls and two (`reveal_overlay_window`,
  `park_overlay_window`) that are not commands at all.

## Consequences

- **Six commands and five constants are gone**; `cargo check` drops from 20
  warnings to 15 and `cargo test` is unchanged at 740. Every removal leaves a
  comment at the site saying what went, when, and what to call instead — a
  deleted command with no marker is how Leg 7's `PromptsTab.tsx` cost a whole
  leg to rediscover.
- **`profile_health_acknowledged_flags` is untouched.** It is a live config
  field with a live writer (ADR 0085) and a live reader (`derive_health_level`).
  What went is two ways to write it that nothing used.
- **The sweep is a check, not a one-off.** `invoke_handler` against `invoke(`
  is two greps, and it found seven times what the leg was sent to look at. It
  belongs in the drift pass every leg that touches `src-tauri/` runs.
- **A flat rule was the wrong tool and that is the transferable part.** "A
  primitive with no user is not part of the system" is true of a component prop
  added and abandoned in a day. Applied to a runtime it deletes deferred lanes
  and silent regressions along with the corpses. The question that separates
  them is *why did it lose its caller*, and it is answerable in one command:
  `git log -S'"the_command_name"' -- src/`.
