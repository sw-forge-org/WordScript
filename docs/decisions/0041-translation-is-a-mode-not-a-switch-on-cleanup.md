# 0041 -- Translation is a mode, not a switch on cleanup

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

WordScript can turn speech into text and then transform that text five ways. It
cannot render it in another language, and for a product whose primary user
dictates in German and writes to an English-speaking audience that is the most
frequently missing thing on the list.

The donor has it. `src/config/inferenceScopes.ts` carries
`dictationTranslation` as a scope of its own, beside `dictationCleanup` and
`dictationAgent`, with its own provider, model and prompt
(`PROMPT_KINDS.translate`) and its own settings component
(`DictationTranslationSettings.tsx`). It is not a flag on anything.

The cheap alternative is real and has to be argued down rather than ignored:
translation *could* be a target-language field on Cleanup. Cleanup already
takes a transcript and returns prose; adding "and put it in English" to its
prompt is a two-line change and no new mode, no new hotkey, no enum variant, no
migration.

### Three reasons the cheap version is wrong

**A translation is not a tidied version of what was said.** ADR 0020 makes the
processing mode the only transform axis, and the modes on it are ordered by how
far they move from the transcript: Verbatim changes nothing, Cleanup fixes
errors, Rewrite rephrases. Translation replaces every word. A flag that turns
the smallest transform into the largest one is not a flag, it is a mode wearing
one -- and it makes `Cleanup` mean two different things depending on a setting
that is not on the mode indicator.

**It has a setting Cleanup must never have.** ADR 0032 and ADR 0033 put names,
products and technical terms in the profile, and a translator must leave those
alone while a model will happily localize them. Translation therefore needs to
know about the profile's words in a way Cleanup never had to, and the two
prompts diverge at the one point that matters most for output quality.

**The mode indicator would lie.** ADR 0024 exists because the effective mode had
more than one source once. A Cleanup that sometimes translates puts the same
failure back: the overlay says `Cleanup`, the text comes out in English, and
nothing on screen explains it. The mode axis has to be able to say what will
happen, which means the thing that changes what happens is a point on it.

## Decision

**`ProcessingMode` gains `Translate`.** It is a mode in the full sense: it
appears in the mode cycle, in the mode picker, in the profile default, and in
the overlay's mode chip, and it is selected the way every other mode is.

**Its settings are the three questions a translation raises and a cleanup does
not:**

| Setting | Why it exists |
| --- | --- |
| Target language, per profile | One fixed target. Reading it from the focused window is a guess, and a guess that silently changes the language you are writing in is worse than a wrong keystroke |
| What happens when the dictation is already in the target | Pass the text through, or run Cleanup on it. Stated, rather than left to the model to decide per dictation |
| Address form -- as dictated / formal / informal | German, French and Spanish force a choice English does not carry. `As dictated` keeps a formal sentence formal |
| Keep the profile's words | The names and terms a translator must leave alone |

**Auto never selects it.** ADR 0024's Auto picks Cleanup, Draft or Prompt
Enhance. Verbatim, Rewrite and Translate stay the user's call, on one rule:
**Auto may choose how text reads, never what language it is in.** Guessing that
a dictation was meant for another audience is not a recoverable error -- the
text is inserted, in a language the user did not ask for, into somebody else's
document.

**The communication style does not apply.** ADR 0023 scopes register and length
to Draft and Rewrite. Applying a register on top of a translation changes the
text twice and makes the result attributable to neither setting.

## Consequences

- `ProcessingMode` in `src-tauri/src/core/config.rs` gains a variant, and with
  it `as_str`, `from_str`, `is_cleanup_family` and every exhaustive match. The
  TypeScript union in `src/types/ipc.ts` follows. `from_str` keeps its
  permissive default, so an unknown token still lands on Cleanup rather than
  failing a config read.
- **It is the first mode with no default hotkey.** The shipped defaults occupy
  `Alt+1` through `Alt+6`; a seventh mode either takes `Alt+7` or takes none.
  It takes none, and the Hotkeys screen states that rather than hiding it --
  the number of digits a modifier row can carry is a real limit, and the eighth
  mode will hit it harder than the seventh. Whoever adds that eighth mode
  inherits the question, not a precedent for silently extending the row.
- The mode cycle grows to six entries before the rule that separates `Agent`
  from it. Six is not a comfortable cycle length and this record does not
  pretend otherwise; if the cycle becomes the wrong control, the mode-select
  overlay is the surface that replaces it, not a shorter cycle with modes
  removed from it.
- A profile written by a newer build carries `translate` where an older build
  will read Cleanup. That is the same forward-compatibility behaviour every
  other mode addition has had, and it is acceptable because the failure is a
  transform that is too small rather than one that is wrong.
- The target language is per profile and not per machine, which means a profile
  switch can change the output language. That is intended -- "English mail" and
  "German notes" are exactly what profiles are for -- and it is why the target
  is stated in the profile's defaults and not only on the model surface.
