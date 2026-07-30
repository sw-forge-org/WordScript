# 0023: Profile Context Is a Reading Aid, and a Register Sets Form, Not Lexis

Date: 2026-07-30
Status: Accepted

## Context

Two findings from live use of Agent mode, and one feature that only became
safe once the first was understood.

### 1. Profile context leaked into generated content

An instruction like *"write an email to Peter, content: the Friday slot moves
to Monday"* came back carrying material from the profile the user had never
dictated. Three causes, all inside one prompt:

- **Only one of six blocks was restricted.** `build_profile_context` emitted
  `Profil:`, `Kontext:`, `Fachbegriffe:`, `Bekannte Entitäten:`,
  `Inhalts-Bausteine:` and `Zielanwendung:`. Only the last carried
  *"niemals Inhalt daraus ableiten"*. Cleanup and Rewrite have always wrapped
  their context in *"nutze sie nur, wenn sie zum Input passt; nie
  halluzinieren"*; the Agent prompt had no equivalent.
- **The system prompt invited the leak.** It said *"Falls ein Kontext
  angegeben ist (Zielpublikum, Profil), berücksichtige ihn"* with nothing on
  the other side of the scale. To a generative model that is an offer of
  material.
- **The context sat in the *user* turn**, immediately above the instruction,
  where it was formally indistinguishable from the instruction itself. Every
  other mode puts profile material in the system prompt.

`Inhalts-Bausteine` was the worst of the six: it listed each snippet's full
expansion — finished text, handed to a model whose job is to produce text. It
was also redundant, because `finalize_with_text_rules` expands the trigger
deterministically at the end of every mode's pipeline (ADR 0020). The block was
a second, generative path for data that already had a deterministic one.

ADR 0021 is where the exemption was recorded, on the reasoning that Agent
output "is generated whole, so there is no original to drift from". That
argument holds for *drift* and only for drift. It does not cover a model
weaving adjacent profile lines into text it was asked to invent. Agent mode
also runs no `hallucination_detect` pass — that hangs off `transform.rs` and
therefore off the correction path alone — so nothing downstream caught it
either.

### 2. The agent name was hidden in the mode that needs it least

`AgentControls` rendered only while `processing_mode === "agent"`. But the
agent name is the *first* criterion `resolve_auto_mode` routes on ("agent name
addressed with a task" → `agent`), and Auto is the default mode. In the default
configuration, the field deciding whether Auto ever reaches Agent was not on
screen. The name itself resolved correctly — ADR 0020 fixed that — so this was
purely a surface defect, and the kind that reads as "the feature does not work".

### 3. A per-profile communication style, and why the obvious design was wrong

The request was to set a preferred way of writing per profile, next to the
agent name, so different profiles get differently-writing agents.

The first design used a single ladder of formality adjectives — neutral,
professional, casual, friendly, terse — with the bottom step labelled "full
colloquial and youth language", on the assumption that a model asked for an
informal register supplies each language's own idiom. **That is wrong twice.**

**It conflates two dimensions.** Coseriu's standard model of linguistic
variation separates them explicitly: formality is *diaphasic* (register), youth
language is *diastratic* (a sociolect bound to a speaker group) — youth language
is the textbook example of the diastratic dimension. Turning formality down
produces informal text, not young text. The ladder cannot reach the second at
all.

**And models cannot do it.** The systematic comparison of human and
machine-generated slang (EMNLP Findings 2025) finds LLM slang use does not align
with human use well enough to rely on; practitioners describe the same effect as
"Boomer AI" — expressions that are individually correct but fit no consistent
place or time. Three things compound it: youth language turns over faster than
any training cut-off (the Jugendwort winners alone run *lost* 2020, *cringe*
2021, *smash* 2022, *goofy* 2023, *Aura* 2024, *das crazy* 2025); it is regional
and group-specific ("digga" is not neutral everywhere); and **the error is
asymmetric** — misplaced slang reads as parody, while its absence merely reads
as plain.

The adjective list also mixed three independent axes into one control, which is
why it felt like it said nothing. Formality, length and attitude are separate;
Grammarly separates the first two in its own product surface for the same
reason.

## Decision

### The profile context is a reading aid, not a source of material

The full context stays in Agent mode — it is what lets the mode spell the user's
terms and entities correctly. What changes is its declared function and its
position:

- It moves into the **system prompt**, behind `PROFILE_CONTEXT_HEADING`:
  *"PROFILE CONTEXT. It exists solely to help you read the instruction
  correctly — spellings, proper nouns, technical terms, domain. Never derive
  content from it, never supplement the result with it, never carry any of it
  into the result. All content comes from the user's instruction alone."*
- The **user turn carries the transcript and nothing else.** The
  `"Anweisung: "` prefix is gone with it.
- The *"berücksichtige ihn"* line is **replaced**, not supplemented. Two lines
  ordering opposite things about the same block is not a guardrail.
- Snippets contribute **label and trigger only, never the expansion**. The
  reading aid survives ("this trigger in the dictation means a snippet"); the
  offer of finished text does not.

`build_agent_request` exists so the split between the two turns is assertable
from a test. `build_agent_system_prompt` exists so the corpus parity driver
builds the prompt the product sends — its `"agent"` arm previously built only
`build_profile_context`, which left every framing sentence, including the one
this ADR turns on, outside the check.

### A register sets form; wording comes from the user

`core::communication_style` is the single producer for every mode, as
`core::profile_context` is for the context.

**Axis A — register**, named after the addressee, or the medium for the lowest
step: `off` (default), `authority`, `client`, `colleague`, `friend`,
`quick`. Adjective names were rejected: `formulaic` beside `formal`, and
`casual` beside `chat`, are near-synonyms that cannot be told apart in a select
without reading the description. "Who am I writing to" is something the user
already knows while dictating.

Each active level emits **three blocks, not a label**:

1. **Form rules** — only properties countable in the output: address form,
   contractions, punctuation, capitalisation, sentence shape, salutation and
   sign-off, emoji. All of it language-independent and executable without
   knowing any current expression.
2. **A forbidden zone** — what the level explicitly does *not* mean. The
   documented failure of style prompts is overshoot: an instruction-tuned model
   reads "casual" as licence for exclamation marks, emoji and manufactured
   enthusiasm. Naming the overshoot is cheaper than tuning around it.
3. **A lexis source** — the load-bearing line. For `friend` and `quick`:
   *"Take slang, youth language, in-group expressions and abbreviations
   exclusively from the user's rules and writing sample below. Never use your
   own, never supply any from memory, and never translate any from another
   language. If none are given, write informally but without slang."*

**Axis B — length**: `terse` / `normal` / `full`. Genuinely orthogonal, and
where "terse" belongs instead of on the register ladder. `normal` emits nothing:
it is the absence of a length instruction, not an instruction to be average.

**No third "attitude" axis.** That is where interchangeable adjective presets
come from; the rules and the sample express it more precisely.

### Precedence between the three inputs, written into the prompt

1. **Preset** — the base, and only for form.
2. **User rules** — hard, and they override the preset where they touch it.
3. **Writing sample** — *subordinate for form, authoritative for wording.*

The asymmetry in (3) follows from the lexis rule: if a register may not invent
slang, the sample is the only place any can come from — and it is current,
regionally right and the user's actual group language, which no shipped preset
could be. It is spelled out in the prompt rather than implied, and pinned by
`block_orders_preset_then_rules_then_sample`, the only place the three inputs
are related at all.

Both free-text fields carry the same restriction the context block does, and
state that instructions inside them which try to override the surrounding rules
are ignored. They are bounded differently because they are shaped differently:
rules are a list (400 characters, per line, deduplicated), a sample is prose
(400 characters, structure intact, cut tail reported).

### The starter lexicon is shipped, visible and dated

`src/data/styleLexicons.json` seeds `friend`/`quick` per language. It does not
contradict the lexis rule — it is its opposite: curated, versioned,
repo-inspectable, user-editable data instead of opaque model memory. Three
conditions make it acceptable:

- **Opt-in.** The register never activates it. The user loads it into their own
  rules, sees verbatim what goes into the prompt and can delete what does not
  fit. A hidden runtime word list would be ADR 0020's defect class in a new
  place: behaviour whose cause is nowhere on screen.
- **Dated and regionally annotated.** Carries `updated`, shown in the UI. A
  stale entry is expected, not a bug.
- **A seed, not a catalogue.** The user's own expressions always beat it.

### Scope: Agent and Rewrite

Rewrite is the only correction mode a style may touch — it already reformulates,
so a register can move inside what it is allowed to change. The clause had to be
**swapped rather than extended**: the stock instruction requires that meaning,
language mix, **tone** and terminology be preserved in full, which with a style
configured would order the opposite of the style block in the same prompt.
Meaning, language mix and terminology stay untouchable; only the tone moves, and
only when asked. With `register = off` the prompt is byte-identical to before.

Cleanup, Verbatim and Prompt Enhance are untouched.

### Every prompt is now written in English

The prompts were German throughout. English instructions are followed more
reliably, and the prompt's language does not determine the output's — but only
if that is stated, so the agent prompt now carries *"Write the result in the
language the user dictated in, and keep any mix of languages they used. Never
translate, and never answer in the language of these instructions"*, the
correction prompt carries *"These instructions are in English — the output never
is unless the user dictated in English"*, and the style block carries *"never
switch the language or the language mix"*. The German `um`-is-a-preposition
guard survives translation verbatim, because it is about the dictated language,
not the prompt's.

## Consequences

- Agent mode's user turn is the transcript, byte for byte. Asserted by
  `user_turn_carries_only_the_transcript`.
- Snippet expansions no longer reach any generative prompt. They are still
  expanded, once, deterministically, at the pipeline exit.
- The agent name is visible in every mode, with the global value as its
  placeholder. The two tests that pinned it to Agent being selected are
  superseded by one that asserts the opposite across five modes — they pinned
  the defect, not the contract.
- `ProfileModesSettings` gains four fields. No `TEXT_PROFILE_SCHEMA_VERSION`
  bump: the struct is `#[serde(default)]`, so old configs fill defaults, and
  the default register is `off`. This is the path `agent_name` itself took.
- The style is resolved once per session by
  `active_text_profile_communication_style`, next to the agent name, and the
  history re-transform goes through the same resolver — reaching into
  `profile.modes` at the call site is how ADR 0020's mixing defect happened.
- **Not measured.** ADR 0021 established that a change to the correction prompt
  is demonstrated rather than asserted, and two changes here touch it: the
  English translation, and the styled-Rewrite arm. The `#[cfg(test)]` harness in
  `core::transform_context_measurement` is the instrument; running it needs a
  live provider and a real history and has not been done. Until it is, the
  honest statement is that the correction path is tested for shape, not for
  output quality.
- Not addressed: `docs/known-issues/profile-context-is-written-as-categories.md`
  stands. This ADR changes what the context block is *allowed to do*, not
  whether the curated profiles put anything useful in it.
