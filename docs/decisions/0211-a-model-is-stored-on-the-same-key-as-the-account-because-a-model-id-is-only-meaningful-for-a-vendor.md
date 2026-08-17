# 0211: A model is stored on the same key as the account, because a model id is only meaningful for a vendor

Date: 2026-08-17
Status: Accepted. Speech track
([`../tracks/speech-track-plan.md`](../tracks/speech-track-plan.md)), Stage B row
B15, first half. Widens
[ADR 0207](0207-a-model-belongs-to-the-profile-for-the-same-reason-its-vendor-does-and-the-controls-do-not-move.md)'s
axis by one key and keeps
[ADR 0165](0165-may-and-must-are-two-questions-and-the-lane-that-answers-them-differently-is-the-one-you-type-a-url-into.md)'s
field where it is. Reads
[`shared/model_catalogue.json`](../../shared/model_catalogue.json) and never
edits it (ADR 0115).

## Context

The owner asked for a lane, a provider **and a model** per task. The first two
were already storable (ADR 0094, ADR 0208). The third was not, and the shape of
the gap is what this record is about.

**The account axis is per `JobKey`. The model axis was three slots.**
`speech.model`, `speech.correction_model` and `speech.agent_model`, each with a
`local_*` mirror. `chat_model_for_job` branched on local-versus-cloud and not on
the job, so cleanup, rewrite, translate, enhance and the assistant all read
`agent_model`: moving translate's model moved four other jobs.

**And the coarseness was not only per job — it was per vendor.** One cloud slot
stands behind every cloud vendor. Since B14 put the connection per job, a profile
can run cleanup on Groq and the assistant on OpenAI, and both read one
`agent_model`. **One of the two is then always naming a model its vendor does not
serve**, and what happens next is worse than a failure: `openai::resolve_model`
and OpenRouter's equivalent look the id up in the catalogue, see it belongs to
another vendor, substitute their own default and record the swap in the runtime
log. The surface names one model, the request carries another, and only the log
knows. Groq has no such guard and sends the id into a refusal. A quiet lie and a
loud failure from the same stored value.

The owner was offered two answers — widen the slots to one per `JobKey`, or draw
the coarse truth honestly — and handed the decision back with two constraints:
migrations do not matter (this machine's config is disposable, ADR 0112), and the
result should be the most sustainable shape rather than the most literal one.

## Decision

**The model is stored on the same key as the account, and that key is the job.**
`ProfileProviderSettings` grows `models: Map<JobKey, String>` beside
`overrides`, and `resolve` carries the value out on `JobProvider::model`.

Three properties follow, and they are the reasons:

1. **A stored model is only ever read next to the vendor it was chosen for.**
   Flat slots per job — even doubled into cloud and local mirrors — cannot have
   that property: the mirror exists so that a lane switch does not destroy the
   other lane's choice, and the same argument applies between Groq and OpenAI,
   which would take a slot per job **per vendor**. That is a store of invisible
   state no surface explains. One choice per job, cleared when the job's account
   moves, is the version a reader can see.

2. **The two cells of a job row are one decision**, so they live on one object.
   Everything that already snapshots the axis — the capture, the transform
   config, the history retry — carries the model with it and needed no new field:
   the mismatch ADR 0207 found, where the lane came off the snapshot and the
   model off the live config, cannot recur here because there is one object.

3. **Absence is the value**, which is ADR 0094's shape one field over. A job
   with no entry runs on the profile's default for its role, and the role
   defaults stay exactly where they are. Nothing is migrated, nothing is
   removed, and a config written before this reads as *no models named*.

**A named model is checked against the job's vendor at resolution, not on load.**
`JobProvider::named_model` answers `None` for an id the catalogue attributes to
somebody else, and the caller falls back to the role default. On load the name
stays: deciding on load would drop what a reader typed for a vendor whose newest
model this build has never read about, and **an id the catalogue has never seen
passes** for exactly that reason (ADR 0115).

**Two things do not take a per-job model, and the exceptions are the interesting
part.**

- **The local recogniser.** Every other model on this axis is an id a vendor
  serves. The local speech model is a *file on this machine*, chosen on `On this
  machine` with its decode settings attached (`local_profile`), and `normalize`
  derives the field from that choice. A job row offering a second place to name
  it would be two controls over one fact, and the one on the row is the one that
  cannot tell whether the file is installed. Local **chat** takes an override
  normally: an Ollama tag is a served id.
- **`Connection.model` stays on the connection** — the second decision this step
  owed an answer to. A server behind a URL publishes no list (ADR 0165), so the
  typed id is not a choice between offers: it is the second half of the server's
  address, like the port. One typing serves every job on it, and requiring the id
  per row would mean typing it eight times for a server that serves one model.
  The job's own model then outranks it, because that is the one case where a
  reader did make a choice. The credential inventory therefore keeps this field
  and states what it is — the id this server answers to, beside the URL — rather
  than presenting it as a model chooser.

## Consequences

- *A model per task* is now true where it can be true, and the two places it
  cannot are stated on the surface rather than implied away.
- The stale-pair state is reachable in one way that has to be handled by the
  surface rather than by the resolver: repointing a row's account leaves a model
  chosen for the old vendor. **The surface clears the row's model in the same
  patch that moves its account**, so the store never holds the pair; the
  resolver's guard is the second line, for a hand-edited config.
- **The long-text escalation is still per lane, not per vendor.**
  `lane_default_correction_model` deliberately overrides the reader's choice above
  300 words (ADR 0206) and names the lane's default — which on a cloud lane is a
  Groq id. A correction job on OpenAI therefore escalates into the substitution
  described above. That is the same defect one level down, it predates this
  record, and it is not fixed here: fixing it needs a default per vendor per role,
  which the catalogue does not carry today.
- `runtime_defaults` in the catalogue stays the machine-wide fallback and is
  still not per vendor. A job with no model whose vendor is not the default one
  therefore falls back to an id that vendor may not serve — the adapters'
  substitution covers it, and the surface can name the vendor's own default
  because `models[]` in the catalogue is keyed by provider and role.
