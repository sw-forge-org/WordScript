# 0071 -- Translate ships ahead of its phase, on the lane the product already runs

Date: 2026-08-10
Status: Accepted

## Context

[ADR 0041](0041-translation-is-a-mode-not-a-switch-on-cleanup.md) decided that
translation is a mode rather than a switch on cleanup, and decided its four
settings, its exclusion from Auto and its exclusion from the communication
style. It has stood since 2026-08-03 as `Accepted (planning direction; not
implemented)`.

`ROADMAP.md` files the mode under **Phase 4**, provider expansion, and gives a
reason that is not scheduling convenience: translation is the scope where model
quality shows first, so the same argument that motivates a stronger chat lane
motivates this mode being able to reach one. Phase 4 is not started.

Meanwhile the surface has drawn the mode in three places since the port, and two
of them shipped a control that could not act:

- the mode select on Profiles drew `Translate` and disabled it
- the Hotkeys mode lane drew a seventh row and disabled it, with the reason on it
- the AI Models job list drew all four of ADR 0041's settings as inert controls

Leg 5's order puts this first, as the cheapest entry on the runtime-contract
list. So the question this record answers is not *whether* translation is a mode
-- ADR 0041 settled that and argued the cheap alternative down -- but whether it
may be built before the phase it is filed under.

## Decision

**It ships now, on the connection the product already has.** The mode runs on
the chat model, which today is `llama-3.3-70b-versatile` through Groq, the same
model the assistant and Prompt Enhance use. It is not the correction model:
`ProcessingMode::Translate` is not a member of the cleanup family, and the drawn
job row already marks this job as overridden off the connection's default,
because translation is explicitly not on the fastest path.

**A mode with a mediocre model beats a control that cannot act.** Rule 7 forbids
a surface that implies a state the runtime did not reach; two screens were
carrying that defect in its honest form -- named and disabled -- and the honest
form is still a product that cannot translate. The quality argument in ROADMAP
Phase 4 is an argument for a *better* model, not for *no* mode, and it stays
true after this: when the chat lane grows, translation is one of the jobs that
gets better without anything here changing.

**The four settings take the scope the drawing gives them.** The AI Models job
row marks two with a `Per profile` tag and two with none, and that split is
followed literally rather than reasoned about again:

| Setting | Lives in | Why |
| --- | --- | --- |
| Target language | `ProfileModesSettings.translate_target_language` | ADR 0041 states it per profile: "English mail" and "German notes" are what profiles are for |
| Keep the profile's words | `ProfileModesSettings.translate_keep_profile_words` | It is about the profile's own vocabulary, so it cannot be anywhere else |
| When you already dictated in that language | `AppConfig.translate_same_language` | No scope tag on the drawing. Same shape as `enhance_sub_mode` |
| Address form | `AppConfig.translate_address_form` | No scope tag on the drawing. Same shape as `enhance_target` |

The four are resolved once by `AppConfig::active_text_profile_translate_settings`
and snapshotted into the capture config, so a mid-recording edit lands on the
next session rather than half of the current one (ADR 0025) -- the same rule the
communication style already follows.

**The stored value is a language code, and the prompt gets a name.** Storing
`English` would put a piece of user-facing English in the config file, where a
later translation of the surface would silently change what the prompt asks for.
An unrecognised code resolves to English rather than failing, which is the same
permissive rule `ProcessingMode::from_str` follows: the failure is a translation
into the wrong language, which is visible and undoable, rather than a config
that will not load.

**The model decides whether the languages match; it never decides what follows.**
ADR 0041 says the same-language behaviour is stated rather than left to the model
per dictation. What is stated is the *consequence* -- pass through, or run
cleanup -- written into the prompt as a fixed instruction. The detection itself
stays with the model, because it is the thing reading the text, and the
alternative in this repo is `detect_primary_language`, which separates German
from English and nothing else.

**`As dictated` emits no instruction at all.** An instruction telling the model
to use its own judgement changes behaviour without adding information, which is
the failure the register levels in `core::communication_style` are written
against.

## Consequences

- `ProcessingMode` has seven variants and the mode cycle has seven entries.
  ADR 0041 already says seven is not a comfortable cycle length; the answer to
  that stays the mode-select overlay rather than a shorter cycle with modes left
  out of it.
- `mode_translate_hotkey` is the only mode slot whose shipped default is empty.
  It is settable like every other slot, and empty means "nothing is bound", the
  same as any mode the user cleared. The eighth mode inherits the question of
  what a modifier row can carry, not a precedent for extending it silently.
- **A retried Translate record comes back cleaned up rather than translated.**
  `retry_transcription_history_entry` runs the correction transform for every
  mode, which is pre-existing behaviour that Agent and Prompt Enhance records
  already have; Translate joins them rather than introducing it. Routing the
  retry by mode is one job for all three and is not this one.
- The translation runs on the chat model's quality. This record is the place
  that says so, so that a complaint about translation quality is read as the
  known consequence of shipping ahead of Phase 4 rather than as a defect in the
  prompt.
- Four controls on AI Models are live while roughly thirty-six around them are
  not. That is not an inconsistency to be tidied: the others are model choices
  and wait on the connection shape ADR 0042 describes, these four are the mode's
  own settings and have a config home.
