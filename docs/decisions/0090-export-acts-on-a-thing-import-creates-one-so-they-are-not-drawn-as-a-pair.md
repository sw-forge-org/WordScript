# 0090: Export acts on a thing, import creates one, so they are not drawn as a pair

Date: 2026-08-11
Status: Accepted

## Context

`export_text_rules` and `import_text_rules` are complete in the runtime —
schema version, conflict resolution, merge, analysis — and have had **no
caller** since Leg 3's shell overwrite (`8f9077e`) deleted `PromptsTab.tsx`,
the surface that called them. Nothing replaced the capability: `export_full_backup`
writes the whole config, the history index and the transcript files as one
archive, which is what you keep, not what you send somebody.

ADR 0089 classified the pair as a **lost capability** and deliberately did not
decide where it goes, because that is a product decision rather than a cleanup.
Three placements were open and each was defensible: Profiles (it is that
screen's data, and ADR 0082 already provides the panel plane), Privacy & Data
(both are import/export of user data), or deleting the runtime and recording
that WordScript does not share rule sets.

**The drawn design had already answered half of it, in a sentence nobody had
read as a specification.** The prototype's Profiles section says: *"Duplicate
and Export are things you do to a profile rarely and from the list, not from
the header of the one you are editing — they are on the row's own menu."* Leg 7
built that menu (ADR 0082) with Rename, Duplicate and Delete, and
`Profiles.tsx`'s own docblock carried the sentence forward — *"Duplicate and
Export went with it"* — while the menu had three entries. The same defect as
`ARCHITECTURE.md`'s, one layer down and in a code comment.

**The owner named the fault in the other half.** Asked to confirm the placement,
they rejected an Import on the row menu: *"if I right-click on a profile, it
makes no sense to show the import function — what am I supposed to do with it
then?"* That is the whole problem stated in one question, and it is not about
taste.

## Decision

**Export and import are not a pair, and drawing them as one is what makes a row
menu read wrong. Export ACTS ON a thing. Import CREATES one.** Where each door
goes follows from that and from nothing else.

### Export is on the profile's row menu, because a row menu acts on its row

`Export rules` sits between Duplicate and Delete on Profiles, as the fourth
verb. It writes the profile the menu was opened on — never the selected one,
never the active one — so its target is never in question and it needs no
picker, which is also why it costs no width. This is the prototype's placement,
restored rather than invented.

Its answer opens on the flag panel's plane, above the sub-tabs, for the flag
panel's reason: the menu is reachable from all six tabs, so an answer drawn
inside one of them would be somewhere else half the time. The answer names the
file, what went into it, and **where a rules file comes back in** — because this
menu deliberately has no Import, and a door that exists only on another screen
is one the reader has to be told about.

### Import is on Privacy & Data, and it lands as a NEW profile

The profile an import produces does not exist yet, so there is no row for it to
act on. It goes where a thing arriving from outside is already what the screen
is about, next to `import_full_backup`. **It appends and never replaces**, which
is what removes the ambiguity the owner named: there is no target to choose
because the import brings its own.

Export is on that screen too, with a `Select` naming the profile — the same act
from the machine-wide side, for a reader who is there to move data rather than
to edit a profile. Two doors to one act on two screens is not the redundancy
ADR 0082 removed: that was three idioms for one job *on one screen*.

### Nothing here snapshots, and that is a decision rather than an omission

`import_full_backup` and `reset_all_settings` snapshot because they REPLACE what
is on this machine, and the row states where the snapshot went because it is the
way back. An imported rules file reads no existing profile, changes none and
removes none, so there is no previous state for a snapshot to hold. The way back
is deleting the profile the import just made — one confirmed click on the screen
the row points at. **A snapshot here would be ceremony that answers a question
nobody asked**, and ceremony is how a real backup path stops being read.

### Two conversions the import must perform, and both are silent if skipped

- **The words move from the legacy string to `vocabulary_hints`.** The document
  schema is v1 and predates the per-entry model, so its only home for terms is
  the newline `stt_hints` string — a field the current surface never writes and
  the recognizer no longer reads (ADR 0035). Imported without conversion, every
  word in the file would be drawn in the profile and reach nothing. The import
  runs `migrateLegacyBiasPolicyToVocabularyHints`, which is the function that
  already mirrors `TextProfile::migrate_vocabulary_hints`, rather than a second
  copy of the recognizer's limits — the copy that drifts is the one that decides
  a word reaches the recognizer when the runtime says it does not.
- **The rule ids are re-minted**, for `duplicateTextProfile`'s reason and one
  more. A file's ids were created in somebody else's profile, so importing them
  verbatim is the `duplicate_rule_id` collision that function exists against —
  except here the two profiles are not related, so nothing about the collision
  would look like a copy to whoever reads the runtime's applied-rules line.

The export has the mirror obligation: it takes its words from
`vocabulary_hints`, never from `profile.stt_hints`, or it ships whatever string
a profile happened to carry from before its migration and drops every word added
since.

## Consequences

- **A capability the product had since before the port is reachable again**, and
  `ARCHITECTURE.md`'s claim about it is true for the first time since Leg 3.
- **One implementation, two callers.** `textRulesDocumentFromProfile` and
  `textProfileFromRulesDocument` are in `lib/textProfiles.ts` because both
  screens need them; a copy per screen is how the two doors would come to
  disagree about what a rules file contains.
- **The import does not switch the active profile.** An import is a thing
  arriving, not a decision to be written by it — switching would change how the
  next dictation comes out on the strength of a file the reader has not looked
  at yet.
- **The one-line copy budget is a function of the control's width, and this is
  the transferable part.** The first build of the Privacy & Data rows ran 79 and
  71 characters, both inside the ≤ 90 budget every other row is written to, and
  WebKitGTK drew them at **three lines and two** against neighbours that drew
  one. `.ws-row-ctl` is `flex: none`, so every pixel the control takes comes off
  the text column: a row whose control is a `Select` plus a button has roughly
  thirty characters per line where a row with one button has fifty. jsdom
  reports the string and cannot report the wrap. The sentence explaining what a
  rules file is moved to the section header, which is where the donor rule put
  it in the first place — *a section header is a descriptive line, a row is at
  most one*.
- **`Profiles.tsx`'s docblock is corrected in the same commit as the menu
  entry.** A comment asserting a control is indistinguishable from the control,
  which is ADR 0089's finding at the scale of a source file.
