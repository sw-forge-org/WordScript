# 0167: A plan belongs to a credential, so it is keyed by the vendor that sold it

Date: 2026-08-16
Status: Accepted. Closes the axis
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)
left open by name when it moved the provider per profile and left the plan
machine-wide, and spends the edge
[ADR 0126](0126-a-second-cloud-vendor-is-a-module-and-a-registry-line-and-the-response-format-is-the-one-thing-that-does-not-travel.md)
made visible. The surface half is
[ADR 0168](0168-a-plan-row-with-nothing-to-choose-is-a-statement-and-the-two-reasons-it-can-be-empty-are-not-one.md).

## Context

`AppConfig::provider_tier` was one string for the whole machine. It named an
account plan, and a plan is one thing only: **how much audio may go up in one
request**. Two readers spend it — `capture_budget::resolve`, which turns the
ceiling into the longest recording, and `resolve_upload_capacity`, which answers
whether a file fits a vendor a picker is about to offer.

ADR 0094 moved the provider onto a per-profile axis and deliberately did not
move this field, recording the reason in the struct: *a plan belongs to a
credential, a credential is keyed by provider, and two profiles on two providers
now share one plan field*. That record is right, and it was also right to wait —
at the time there was one registered vendor.

**What changed is not the argument but its cost.** Three vendors register a
speech role now. Groq sells two ceilings, OpenAI and OpenRouter publish one
each. So a config holding Groq's `dev` while a profile recognises with OpenAI
hands `dev` to a vendor that never sold it — and it is invisible, because
OpenAI's adapter ignores the argument and answers 25 MiB either way.

`resolve_upload_capacity` had written the defence down: *each provider
interprets the id itself and falls back to its own default for one it does not
know, which is what makes one stored plan safe to ask every vendor with.* That
sentence is true and it was never the point. The fallback makes a wrong id
**harmless**, not **right**. It holds exactly as long as no more than one
registered vendor sells more than one ceiling, and nothing in the code says so.

## Decision

**The plan is stored per vendor.** `provider_tier: String` becomes
`provider_plans: Option<BTreeMap<String, String>>`, vendor id to plan id, and
both readers look their own vendor up through one door, `AppConfig::plan_for`.

**A default plan is stored as absence.** A vendor with no entry is on its own
default, which is what every adapter already resolves an empty id to. Writing
the default's own id as well would be a second spelling of one answer, and the
two drift the day a vendor renames its free plan.

**The lift offers the old id to every registered vendor and lands it on the ones
that declare it.** That is a lookup, not a guess: a plan id names a plan *of* a
vendor, so the vendors it belongs to are exactly those whose `tiers()` carry it.
`dev` is Groq's, so it lands on Groq and nowhere else.

**An id no vendor declares lands nowhere.** Not a rescue path, and not a loss:
that is precisely what the old field already resolved to at every reader, so
dropping it changes no behaviour and states the same thing in the config that
the runtime was going to state anyway.

**`None` is the migration guard, not a version counter.** A written map is one
this build wrote. Re-deriving it from a key that is no longer written would
replace a user's choice with a migration — D6's defect, one axis over — and the
shape `TextProfile::providers` already uses answers this without a counter.

## Consequences

**`capture_budget::resolve` gets a fix it was not asked for.** It resolves the
recogniser's vendor eleven lines before it reads the plan, so a profile routing
dictation to OpenAI now asks about OpenAI's plan. It was asking about the
machine's.

**The old key leaves the file on the next save**, through
`#[serde(rename = "provider_tier", skip_serializing)]` — the same door
`ProfileSpeechSettings::migrated_provider` was for the provider axis, and it is
a migration rather than a reset for the same reason: this is the shape every
installation carries right now, one save old.

**The snapshot covers it.** `load_from_disk_impl` took a copy before the profile
migration; the plan lift is a rewrite of the same file and now joins the same
condition, under its own tag. A migration that ran without a copy behind it is
the one thing that path exists to prevent.

**The frontend writes the whole map or none of it.** `patch` is a shallow merge
over `AppConfig`, so `buildProviderPlanPatch` is not a convenience: a row that
rebuilt the map from its own vendor would drop every other vendor's plan, which
is the defect this record exists to prevent arriving through the door meant to
fix it. A test holds it.

**What this does not do:** move the plan per profile. It is per vendor because
it belongs to a credential, and a credential is machine-wide; two profiles on
one vendor share one account and therefore one ceiling. That is the same
argument ADR 0094 made, followed to the key it actually implies rather than
stopping at the scope it happened to have.
