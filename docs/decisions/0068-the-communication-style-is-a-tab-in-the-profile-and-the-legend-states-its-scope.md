# 0068: The communication style is a tab in the profile, and the Legend states its scope

Date: 2026-08-10
Status: Accepted

## Context

[ADR 0023](0023-profile-context-is-a-reading-aid-and-a-register-sets-form-not-lexis.md)
introduced a per-profile communication style — a register (`off`, `authority`,
`client`, `colleague`, `friend`, `quick`), a length (`terse`, `normal`, `full`),
a bounded list of style rules and a bounded writing sample, with a fixed
precedence between the three. Its scope is deliberately narrow: **Rewrite and
the assistant only**. Cleanup, Verbatim and Prompt Enhance are untouched.

`core::communication_style` is intact and running. `transform`, `agent` and
`capture` all read `AppConfig::active_text_profile_communication_style`. The
pre-port `ModesTab.tsx` rendered every control with a budget meter on each
free-text field.

**The port has no surface for any of it, and the prototype is where the surface
was lost.** The prototype points at the profile three times — AI Models' Rewrite
row (*"How this writes … is the profile's communication style, shared with the
assistant"*, with an `Open the profile` link), AI Models' Cleanup row (*"No
communication style here. It applies to Rewrite and the assistant only."*) and
Onboarding's *"Communication style — Register, length and writing sample … In
the profile"* — and the profile's five tabs are Defaults, Context, Words,
Replacements, Snippets. There is no sixth. The profile list even displays a
register in its subline (`Rewrite · Client register`) for a value nothing on the
surface can set.

So the port carried a faithful absence, and Leg 4c had nothing to wire.

**It is a live setting nobody can see**, which is what makes this urgent rather
than tidy. On the owner's machine one of six profiles carries `register: quick`
with 256 characters of style rules and an 88-character writing sample, set in
the old UI, applied to every Rewrite and every assistant run under that profile,
and invisible and unchangeable in the product. That is the exact defect ADR 0023
was written against, and `../archive/plans/settings-rework.md` §11.4 quotes it: *a setting
whose cause is nowhere on screen.*

Raised by the owner on 2026-08-10 against Leg 4c's report, and decided with him
the same day.

## Decision

**A sixth tab in the profile, `Style`, in second position — after Defaults and
before Context — carrying one card titled `Communication style`.**

Four parts, and the third is the one that does the real work:

1. **Its own tab, not a card on an existing one.**
   - *Not on Defaults.* That tab was explicitly rebuilt for weight: roughly 230
     words to configure six values, on the tab that opens first. A register
     select, a length select and two bounded textareas with budget meters would
     approximately double it and undo the rebuild.
   - *Not merged into Context.* Context is subject matter — *what* you talk
     about, `profile.prompt`, "topics, not spellings". The style is manner —
     *how* the result reads. The Legend on Defaults already codifies that axis
     ("Context steers which word the AI picks"), and merging the two blurs the
     one distinction the whole tab set is built on.
   - The five tabs are sorted by what kind of thing you author: settings
     (Defaults), subject matter (Context), and three lists (Words,
     Replacements, Snippets). The communication style is a fifth kind — how the
     result reads — and it is not a list, which is why none of the list tabs
     fits it.

2. **Second position, because the order is semantic rather than chronological.**
   Defaults and Style are settings; Context, Words, Replacements and Snippets
   are content, ordered broad → literal. Appending Style at the end would split
   the settings half around four content tabs.

3. **The Legend states its scope, and that is how ADR 0023's narrow scope gets
   said once.** The `Where each list lands` card on Defaults has exactly four
   rows for the four content tabs, and its third column already names a scope
   per row — `AI modes`, `recognizer + AI`, `every mode`, `every mode`. A fifth
   row is added: **Style · sets how a sentence is built · Rewrite and the
   assistant.**

   This supersedes the *placement* half of `../archive/plans/settings-rework.md` §11.4,
   which required the same card on two mode tabs "with its scope named on each".
   That was right under the old IA and is wrong under this one: one tab plus one
   Legend row says the same thing in one place, and two copies of a card are two
   chances to disagree. **The requirement §11.4 was protecting — that the scope
   is never silently inherited — is met, and by a mechanism the profile already
   has.**

4. **The tab is `Style` and the card is `Communication style`.** That is the
   existing pattern: the tab reads `Words`, the card inside it reads
   `Words & names`. The card must keep the full phrase, because the runtime,
   ADR 0023 and all three prototype pointers name it that way and a different
   word on the card breaks the pointers. `Style` is one word, which is what the
   other five labels are.

### Rejected: beside the Rewrite job on AI Models

This is where §11.4's "two mode tabs" leads under the new IA, and it is wrong.
AI Models is machine-scope — *"one connection, and what each job runs on it"* —
and the communication style is profile-scope. Putting a per-profile value on a
machine-scope screen is precisely the ADR 0024 failure the whole restructure
exists to remove, and AI Models' own Rewrite note already points away from
itself and at the profile.

## Consequences

- **The gallery grows a sixth tab, and that is a deliberate departure from the
  prototype.** ADR 0057 already turned the prototype into provenance and made
  the gallery the source, so the gallery is allowed to grow — but a measured
  screen gaining a tab has to be a recorded decision rather than a quiet
  addition, which is why this ADR exists. `npm run port:diff -- profiles` stops
  measuring 1:1 against the prototype's five-tab screen from that commit; the
  other 27 measurements are unaffected.
- **It is a drawing job before it is a wiring job.** The gallery grows the tab
  first and the product follows (ADR 0057). The runtime contract is already met,
  so the wiring afterwards is one card: two selects on `patch`, two textareas on
  `patchText`, and `MAX_STYLE_RULE_CHARS` / `MAX_STYLE_SAMPLE_CHARS` as the
  budget meters the pre-port surface drew.
- **Three dangling pointers become real links.** AI Models' Rewrite row,
  its Cleanup row and Onboarding's list all name a destination that will exist.
- **The profile list's subline is the same piece of work.** It already displays
  a register, and `describeTextProfileWorkMode` currently returns an identical
  string for every profile (relay §2.5, Leg 4c finding 3). The value the
  subline wants to show is the one this tab sets, so the subline derivation is
  decided in the same commit.
- **Six sub-tabs will not fit as drawn.** `.ws-subtabs` has neither `flex-wrap`
  nor `overflow`, and at the current window width the five already clip inside
  the profile pane — measured in WebKitGTK during Leg 4c, where the row read
  `Replacemen…`. Either every label stays one word, which `Style` does, or the
  sub-tab row gains an overflow rule. Decided in the same commit as the tab.
- **Nothing about the runtime changes.** No Rust, no config migration, no new
  field. A profile that already carries a non-default register simply becomes
  visible.
