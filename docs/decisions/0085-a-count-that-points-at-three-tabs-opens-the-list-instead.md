# 0085: A count that points at three tabs opens the list instead

Date: 2026-08-11
Status: Accepted

## Context

The profile health flag has been the last inert control on `Profiles` since
Leg 4c, and it is the last thing between that screen and `WiredScreenProps`.
Everything about it except the click already works: `get_profile_health` is a
real command, the count is read, and the sentences are the button's `title`.

**The click had no destination because the four kinds do not share one.**

| Kind | Computed from | Where that value is set |
| --- | --- | --- |
| `form_conflict` | `profile.prompt` | Profiles → Context |
| `cleanup_interference` | `profile.prompt` | Profiles → Context |
| `length_bias` | `dictionary_entries` | Profiles → Replacements |
| `bias_policy_weak` | `work_mode.bias_mode` + `processing_mode` | Profiles → **Defaults** |

**The last row corrects the record.** Leg 7 wrote `bias_policy_weak` down as
pointing at Words, and both the leg log and the screen's own docstring repeated
it. It is wrong. `detect_bias_policy_weak` fires on `bias_mode == off` together
with a processing mode that amplifies it, `bias_mode` has **no control anywhere
in the product** — AI Models draws it as an `InertSegment` — and the processing
mode is a select on Defaults. Words has a row called *Effective transcription
bias*, which is a readout that sets nothing. A door to Words would have been a
door to a description of the problem.

Three shapes were available and the brief named all three.

1. **One flag routes to its own tab, several route to the first.** Rejected. It
   is a guess presented as a route: the reader clicks a count of three, lands on
   one of them, and is never told what the other two were. The rule this
   product is built on is that a surface may not imply something the runtime did
   not say, and "this is where your problem is" is exactly such an implication
   when the answer was picked by list order.
2. **A panel listing them with a door each.** Taken.
3. A screen of its own. Not seriously available — ADR 0082 settled eight days
   ago that an answer opens where it was asked for, because a separate surface
   would have to restate which profile it was computed from.

**The runtime had already built half of the answer and nothing could reach it.**
`acknowledge_profile_health_flag` and `unacknowledge_profile_health_flag` are
registered commands (`lib.rs`), they write `profile_health_acknowledged_flags`
per profile, and `get_profile_health` merges that map off disk and derives
`level` from the union. The frontend passed `acknowledged_flags: []` and had no
writer, so **`derive_health_level` was computing a level out of a set nothing
could write** — a heuristic warning with no way to close it, which is the
standing nag ADR 0044 exists against. The pre-port surface DID have it:
`PromptsTab.tsx` drew every flag as a row with an Acknowledge checkbox, and Leg
3's shell overwrite deleted that file in `8f9077e`. This is Leg 7's rule
applied a second time — check whether the product already shipped the thing and
something deleted it.

## Decision

**The flag opens the flags.** One row per flag on the panel plane
`ConfirmPanel` and `EditorPanel` already share, above the sub-tabs and below the
detail head — where the rename opens, and for the same reason: the head hides
its overflow, so a panel drawn inside it is clipped at its second row, which is
the defect the owner found in the running app in Leg 7.

- **`FlagPanel` is a third member of that grammar, not a fourth grammar.**
  Rows rather than `AnswerPanel`'s two-column grid, because that grid is for a
  COMPARISON — heard against written — and these are independent records. With
  one flag, a column would sit in half a panel beside nothing.
- **Each row carries the door to the tab that holds its cause**, labelled with
  that tab's own name. Never "Fix": the panel cannot repair anything, it can
  only put the reader in front of the control that can.
- **The door closes the panel behind it**, because a panel whose other rows
  point elsewhere is furniture once the reader has arrived.
- **Each row acknowledges**, through `runtime.patch` rather than through the two
  dedicated commands. Acknowledging is a discrete write, `patch` is the seam
  every other discrete control on this screen uses, and the config comes back
  through the channel the health effect is already watching. The two commands
  predate that seam and now have no caller — recorded below rather than deleted
  here.
- **An acknowledged flag stays in the list and in the count.** It is still true;
  the prompt still contradicts itself. What acknowledging changes is whether it
  colours the profile, which is the runtime's own distinction — `derive_health_level`
  skips acknowledged flags and keeps them in `flags`. Removing the row would
  leave a reader unable to find what they had accepted, which is a setting with
  no way back.
- **The flag carries `level` as its tone.** Red for a conflict the model will
  act on, amber for the ordinary case, green for every flag read and accepted.
  Without it acknowledging would change nothing visible and building it would be
  theatre; with it, a red profile and an amber one stop looking identical.

**`Profiles` leaves the gallery in the commit that closes this** (ADR 0057).
Its banner, its drawn branch, its `DRAWN_*` rows and its registry entry go
together, `runtime` becomes required, and the five fidelity cases move into
`Profiles.test.tsx` re-expressed against a config rather than being dropped.
`registry.test.tsx` needed no edit: it derives the retired set from which
screens the product mounts without a banner.

**The style meters lost their fallback rather than keeping it.** They read
`analyze_communication_style`; the drawn branch fell back to a `400` copied out
of `core::communication_style`. A wired screen draws no meter until the runtime
has answered with the bound, because a meter against a constant the UI holds
its own copy of would keep reading right on the day the runtime changed it.

## Consequences

- **`Profiles` is out of `npm run port:diff`.** 26 measurements become 25, and
  all 25 are **structural 0 | style 0**. The two departures the screen carried —
  ADR 0068's sixth sub-tab and fifth legend row, ADR 0082's create control — are
  settled rather than carried, because there is no longer a drawn branch to
  measure.
- **Nothing here is measured against the prototype**, which draws no such panel.
  It is judged by eye against `DESIGN_SYSTEM.md` and in the native host, the
  position ADR 0069 recorded and ADR 0082 repeated.
- **The native host found one defect and no test could have.** The acknowledged
  row dims, and its button was a filled `primary` — the loudest thing in the
  panel, on the one row that had deliberately receded, arguing for the action
  the reader had already taken. It is `ghost` with `on`, which is what every
  other engaged toggle in this library is.
- **Two registered commands now have no caller**:
  `acknowledge_profile_health_flag` and `unacknowledge_profile_health_flag`.
  They are the pre-port shape of an operation the config seam performs, and by
  Leg 7's rule a primitive with no user is not part of the system. Deleting them
  is a runtime edit in a leg that had no runtime mandate and in a tree the
  core-hardening track is working in, so it is written down here and left.
- **`profile_health_acknowledged_flags` gains a TypeScript type.** It has been
  on the wire the whole time and round-tripping through every config write with
  nothing declaring it, which is why nothing noticed it had lost its reader.
- **The acknowledged set is a dependency of the health effect**, and it is the
  one that only breaks once a write comes back: acknowledging changes nothing
  the detectors read, so `level` is the only thing that can move, and it moves
  only after the config returns. The test returns the write — Leg 7's finding,
  one layer down.
- **`FlagPanel` and `AnswerPanel` are displayed in Gallery → Components**, in
  the states a screen cannot show at once: a severe flag, an ordinary one, and
  one already acknowledged. `AnswerPanel` was claimed as displayed by ADR 0082
  and was not; that is corrected here.
