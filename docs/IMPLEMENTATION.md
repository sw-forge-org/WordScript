# WordScript — the implementation board

Status: 2026-08-17

**This page answers one question: what is being built right now, by whom, and
where does its sequence live.** It is the entry point for a session that is
about to write code. Nothing here is a contract — the contract is
[`spec/SPEC.md`](spec/SPEC.md) — and nothing here is a product state report,
which is [`STATUS.md`](STATUS.md). This is the order of work.

## What a track is

A track is one line of implementation that runs across many sessions, carries
its own sequence document, and files its own ADRs. Tracks run **concurrently on
`main`**, in the same working tree, with no feature branches. That is a
deliberate choice and it has a cost, stated under *Sharing `main`* below.

A track has three kinds of document and they are not interchangeable:

| Kind | What it is | Who writes it |
| --- | --- | --- |
| **Sequence** | The ordered steps, what each requires, what validates it, and what *done* observably means | The track, updated as steps land |
| **Kick-off** | The page pasted into a fresh session to start the next unit of work | The session before it |
| **Record** | What a closed unit actually did, found, and deliberately did not do | The session that closed it |

Only the sequence is a living document. A record is written once and not
updated; a kick-off is spent when its unit closes.

## The live tracks

| Track | Opened | State | Sequence | Start a session with |
| --- | --- | --- | --- | --- |
| **GUI port** | 2026-08-04 | **Leg 14 open**; Legs 0–13b closed. Leg 13 split 2026-08-14 and both halves closed | [`tracks/gui-port-relay.md`](tracks/gui-port-relay.md) | [`tracks/gui-port-relay-kickoff.md`](tracks/gui-port-relay-kickoff.md) |
| **Core hardening** | 2026-08-10 | **Third pass open**; two passes closed. Two steps added 2026-08-13 with a sixth record. **2026-08-16 added three steps (8–10) and three records** from one annotated screenshot: a leaked prompt term reached the delivery, the English-drift record's *not prompt bias* exclusion was withdrawn, and two instruments — the raw panel's stage sentence and the record's model field — were found reporting things the runtime did not do | [`tracks/core-hardening.md`](tracks/core-hardening.md) | the same file — it is both |
| **Speech** | 2026-08-11 | **Stage A closed, Stage B running, Stage D opened**; 33 of ~41 steps done. **B27 closed 2026-08-18 (ADR 0226)**: `connections` is an `AppConfig` field, so seven of the eight facts on an account card are the MACHINE's — and the note above them claimed they were the open profile's. It is deleted; the lead names both owners, each section head names its own, and the picked card wears the profile whose pick it is. **The chip's first placement was measured wrong in the host** and clipped the account name, which is the third defect on this surface found by rendering rather than reasoning. **B24, B25 and B26 closed 2026-08-18 (ADR 0221–0225)**, all three out of owner reports on the shipped screen. B24: a reasoning model spends the caller's whole `max_tokens` thinking, so History had named nothing since the Groq retirement — and the same edge had silently stopped Auto routing to the assistant. B25: an account was one object in the runtime and four pieces on screen. **B26 is the one worth knowing outside this track** — a naming call that fails now says so in the runtime log, because it had no evidence anywhere and the same symptom was diagnosed three times; and ADR 0215's rule was missing one field over, so a profile whose account moved kept sending the first vendor's speech model and **five records name a model the request never carried**. It also folds the account cards (1217 px → 434 px on a three-account machine) and closes both items B25's handover left open. **B17, B18 and B20 all closed 2026-08-18 (ADR 0220, ADR 0219, ADR 0218), and reading their brief against the code opened and closed a fourth, B23 (ADR 0217).** The Accounts card is a list of every account the lane holds rather than one derived row of five controls; the language a profile dictates in is settable on Profiles and stated on AI Models, with the machine-wide `AppConfig::language` removed rather than kept in step; a vendor-scoped credential is adopted onto its account by a sweep that runs on every launch, because the one-shot migration enumerated who was SELECTED rather than what was HELD — evidenced from this machine's own pre-migration backup. **B23 is the one worth knowing outside this track**: the workspace status strip has read `Needs key` on every machine on every launch since ADR 0208 moved the keys onto accounts, because it omitted the account from `useProvider` and the runtime read a scope nothing writes — and the suite could not have caught it, because the seam double took one argument and ignored the rest. **The brief itself needed correcting before any of it**: five of its claims about the code did not survive reading the file, four of them the same habit of writing from an adjacent fact. It is archived with that list attached. **B16 and B19 closed 2026-08-17 (ADR 0215, ADR 0216) and opened B17, B18 and B20**, out of a review of the twenty-five commits behind AI Models. B16: the model guard was spelled twice on the frontend and neither copy was the runtime's rule, which ADR 0214's retirement turned from latent into general the same day. **B19 asked where four drawn settings are set, found *nowhere*, and was answered by removing three of them** — the owner ruled a fixed setting nobody needs an opinion about should work rather than be offered, which is ADR 0161's limit written down: that rule governs *unbuilt*, ADR 0216 governs *withdrawn*. **Three of the open ones share one brief**, [`archive/speech-track-b17-kickoff.md`](archive/speech-track-b17-kickoff.md): the account card is unreadable at the 625 px it is read at, the language a profile dictates in can be set nowhere, and the ADR 0208 migration leaves a vendor-scoped credential behind. **B19 also left two Rust cleanups that are deliberately not in that brief** — B21, where `bias_mode` is a live three-way switch nothing writes, two of its arms are reachable only from tests, and the health flag guarding one of them can never fire; and B22, where `enhance_sub_mode` and `enhance_target` live in two homes with no writer for either. **B13, B14 and B14a all landed 2026-08-17 (ADR 0207, ADR 0208, ADR 0209)**: every model is per profile, and so is the whole connection — a stored account object carrying the vendor, the endpoint, the plan and the credential's scope, which a profile points at per job. **B14a was the owner operating that row within the hour** and finding four surface faults, of which the load-bearing one was a status keyed by vendor reporting one account's key under another. **Both steps that opened out of it closed the same day**: B14b, so a removed account takes its credential with it and asks before it does (ADR 0210); and **B15, the restructure** — *Account* named a credential while the reader heard a bundle, so the card is organised by task now, a job row picks any account on the machine with a model from that account's vendor, and the lane groups instead of being a mode (ADR 0211, ADR 0212) | [`tracks/speech-track-plan.md`](tracks/speech-track-plan.md) | the plan is where a session starts. B15's own brief is spent and archived: [`archive/speech-track-b15-kickoff.md`](archive/speech-track-b15-kickoff.md). [`tracks/speech-track.md`](tracks/speech-track.md) is stage one's record: background, not a brief |
| **Runtime ownership** | 2026-08-13 | **Six of the original seven done 2026-08-14; an eighth step added 2026-08-16.** Steps 6 and 8 are open and both wait on an event nobody can schedule — a natural `Short` capture, and a learned word — each with its instrument already in place | [`tracks/runtime-ownership.md`](tracks/runtime-ownership.md) | the same file — it is both |
| **Context objects** | 2026-08-14 | **Open, five stages, none started**; A–D are unblocked, E waits on one roadmap gate | [`tracks/context-objects.md`](tracks/context-objects.md) | the same file — it is both |
| **Home activity** | 2026-08-16 | **Stage A closed, A1–A11**, four of them owner-driven correction passes. Stage B is three things other tracks owe. **Stage C closed 2026-08-17** — twelve rows from an owner brief, eleven landed and one withdrawn, two of them reversing a standing ADR. **Stage D closed 2026-08-18** — one owner reading of the running block, four rows, all frontend: the time-saved foot was claiming a four-week window on a three-day record, and the same tile had no unit ceiling, so the span now ramps and the figure climbs minutes to hours to days (ADR 0233); each metric opens its own view of the block, day to year, with a grain offered only once the ledger reaches three buckets of it (ADR 0235); the week starts on Monday everywhere. **Stage E closed 2026-08-18** — the same evening, five rows from reading Stage D's views against 447 real dictations: turnaround is five bands rather than a 25 ms histogram with eleven empty columns, and under them a list of which model and vendor the wait belongs to; the record now stores the language it was counted as, because the naming call answered for 74 of 75 runs and nothing wrote the answer down, so every ledger rebuild re-measured with the offline detector and dropped the short ones; the decimal point stopped touching the digit before it; the view dots leave the screen inside a metric instead of merely going inert (ADR 0236). **The finding worth knowing outside this track**: five of Stage D's defects were green in Vitest and visible only on a rendered page, one of them a chart drawn at 16 px because `.ws-win svg` is an unlayered presentation hint that beats the stylesheet — the trap the calendar's own file documents and solves with an inline style — and Stage E is the same rule again with the REAL config, ledger and history behind a stubbed `__TAURI_INTERNALS__`, which is the only way one recogniser showing up under two vendors was ever going to be visible. **Stage F closed 2026-08-19** — privacy work that came out of Stage E's cause list: that list reads `history.json`, the index holds a thousand records, and at 196 dictations a day that is about five days — which was also, until this stage, the lifetime of every Markdown transcript the reader owns, because the retention sweep deleted the file with the entry. The sweep no longer does; deleting a record, clearing the history and a new purge still do. The archive became the fourth collection on Privacy & Data with a count, a size and a `Delete now` that walks the store's own layout and leaves a file the reader put in that folder alone (ADR 0237). **What it does not fix, and the owner was told before it was built**: the cause list still reaches five days, because the ceiling is unchanged and the index is what it reads. **Stage G closed 2026-08-19** — the owner declined that repair and asked for the cause instead: *at a thousand records this stops making sense, so optimise it*, widened to *every function gets only what it really needs*. Five rows. The index is read when a record-writing event says so rather than every five seconds — the poll was moving 14.1 MB a minute of an index that changes 196 times a day, and it is the worse of the three findings; a list row became a `TranscriptionHistorySummary` with the transcripts cut to 160 characters and the whole record fetched by id, dropping fifteen fields no screen reads; the write is compact and lands through a rename; and the turnaround causes moved into the activity ledger as a bounded per-`provider/model` histogram, so the one reading on Home that was not all-time now is. Measured on the reader's real index: 2,453 bytes a row became 1,113, a 54.6% cut. `HISTORY_CEILING` went 1,000 → 5,000 on a release-build measurement (24.9 ms to serialise and write 5,000 records against a 1,210 ms median turnaround), with the note that past it the answer is an append-only journal (ADR 0240). **What it does not fix**: every term is still O(records) per dictation. **A second finding worth knowing outside this track**: the brief's premise was half wrong — the index is parsed once per process, not per dictation — and checking that is what located the cost on the write and read sides instead of the parse. **Stage B is what is left and it is three things other tracks owe** | [`tracks/home-activity.md`](tracks/home-activity.md) | the same file — it is both |
| **Activation gestures** | 2026-07-29 | **Open, nothing built** — blocked on three capability gaps and the decisions they owe | [`tracks/activation-gestures.md`](tracks/activation-gestures.md) | the same file |
| **V1 release** | 2026-08-17 | **Open — a measurement, not a build queue.** Thirteen delivery gates with a state and a re-reading command; three measured *not started*, one is the owner's. Stage A (Developer Mode) is the one gate it builds itself | [`tracks/v1-release.md`](tracks/v1-release.md) | the same file — it is both |

### GUI port

Moves the settings rework from prototype to product as a **relay**: one leg per
session, each leg reading the chain document, doing its leg completely, and
writing the next leg's brief into it before it stops. Rests on ADR 0054 (the
port overwrites, it does not migrate) and ADR 0055 (the gallery is the
acceptance surface).

Owns ADR 0054–0064, 0074–0077, 0082, 0085–0093, 0103, 0104, 0111, 0153, 0156.

**Leg 13 split on 2026-08-14 and both halves are closed.** Its first item — the
caller sweep in both directions over the whole tree — closed as **Leg 13a**; the
second closed as **Leg 13b** on 2026-08-15: the row classes no instrument had
reached, the panel plane where the port designs rather than carries.

**13b measured the plane and found one defect, and its shape is the interest.**
55 samples at 800 × 608 CSS px: everything draws one or two lines except the
sample answer's foot, which printed `dictionary:<entry id>` across **four lines
of a 241 px foot** under a comment reading *the rules that fired, BY NAME*. The
ids are the runtime's correct answer — `rule_label` returns an entry's id
whenever it has one — so the join to the reader's words is the screen's
(ADR 0156), and an id with no entry behind it is printed unchanged rather than
given an invented name. **The panel plane also turned out to carry the narrowest
text column on the surface**, 241–292 px against ADR 0092's 436 px for a stacked
row, which is a budget nobody had written down. **Two classes are still
unmeasured** — `.ws-edit-issues p` and `.ws-flag-what p` need runtime state the
owner's profile does not have, and that is a population fact rather than a clean
bill. **13b also adopted the two commits with no leg behind them**, `b330815`
and `f1b2497`, after three legs had been asked about them.

**13a swept a channel no ADR had asked about and it is the reason it owns 0153.**
ADR 0089, 0093 and 0103 are all about `invoke`, the frontend calling the runtime;
an event is the runtime calling the frontend, the same seam turned around. The
`invoke` half came back clean — 72 registered, 72 defined, the lists identical,
zero callers with no command, and the same five orphans already on record. The
event half found `wordscript-native-insert`: emitted from three sites, listened
to by nothing, and carried in `spec/SPEC.md` as contract. **Dead weight rather
than a gap** — every emitter sat beside a path already delivering the same
result — and the disposition went to the Runtime ownership track because the
insert is its. **It was taken on 2026-08-15 and the channel is removed** (ADR
0154), so all four defect directions of the sweep now report zero. The sweep is
`npm run sweep:commands`.

**The two commits with no leg behind them were adopted by Leg 13b** on
2026-08-15 — `b330815` (the sidebar's second width, ADR 0111) and `f1b2497` (the
2026-08-14 `Context.tsx` wiring). Neither gets a retroactive leg row, because a
row is a session. `f1b2497`'s decision half stays the context objects track's:
the relay owns the surface, that track owns ADR 0137.

### Core hardening

Follows the cluster in [`known-issues/`](known-issues/) where the damage is
invisible — output that is fluent, grammatical, plausible and wrong, with
nothing downstream carrying evidence that a substitution happened. **Nine
records** are one failure class as of 2026-08-16 — the two newest being about the
evidence itself rather than the pipeline, where the record carries the fact and
the readout says something else. **None of them is closed and two never will be
in the ordinary sense**, because the rule is that lost content is reported, never
replaced.

Owns ADR 0079–0081, 0083, 0084, 0100.

What two passes bought is that the cluster went from invisible to instrumented.
The third pass's own page carries where each of the six records stands.

**The sixth landed 2026-08-13 and it is the first one on the cleanup lane that
damages a correct transcript**: the AI stage rewrote a question dictated to an
addressee into a question about the speaker
([`known-issues/cleanup-flips-the-grammatical-person.md`](known-issues/cleanup-flips-the-grammatical-person.md)).
Every guardrail declines, the two prompt lines that forbid answering and acting
were obeyed, and the one guard that reads grammatical person is gated on a mode
this did not run in. **No rule was written**, on this track's own evidence
standard — the corpus carries the case and the same construction handled
correctly two days earlier, which is one flip and one non-flip. Steps 6 and 7 of
the sequence carry it and the closing-phrase artifact found beside it.

**2026-08-16: one screenshot produced three steps, three records and one
withdrawn exclusion**, and the pattern in it is that the instruments failed
before the pipeline did. A leaked prompt term was **delivered** — the strip
removes the marker and a one-term echo cannot clear the two-distinctive-word
floor that exists to protect what the speaker actually said. The English-drift
record's *not prompt bias* bullet was withdrawn: it rested on
`use_as_prompt_hint`, a field nothing has read since ADR 0035, and the request
carried a 65-byte **entirely English** prompt ahead of German speech. And two
readouts were found lying — the raw panel called a sixteen-byte prompt strip *"The
AI stage rewrote it"*, which is how the defect arrived filed against the wrong
stage, and **all 50 history records name `whisper-large-v3` while every request
went to `whisper-large-v3-turbo`**, which misattributes every per-model rate this
track has published. Steps 8, 9 and 10; step 9 is a measurement that needs no
code.

**The owner restated the standing requirement the same day, for all processing
modes**: improve the grammar, never change the meaning. The track page carries
it and what it does and does not license.

### Speech

The capability layer four drawn surfaces wait on: providers, streaming
recognition, the spoken output path, and the windows that carry them.

Owns ADR 0094–0102, 0105–0110, 0113–0122, 0124, 0126–0132, **0157**–**0166**.

**Its first stage was documentation only** — [`PROVIDERS.md`](PROVIDERS.md) and
fifteen records, no code — and the plan exists because those records order the
*adapters* and not the work in front of them. The plan is the page a session
starts on; [`tracks/speech-track.md`](tracks/speech-track.md) is stage one's
account and is not updated by later work.

Done: A1–A6 (the runtime contract), B1 (the capability seam), B3 (the model
catalogue), C3 (the soak night, which returned zero), **D1 (OpenAI — the first
adapter, and the connection that can now be chosen)**, **B6 (what it means to
wire a drawing inherited from the demo GUI)**, **B7 (the provider choice at
the point of use)**, **B5 (in-app model installation)**, **B8 (that library at
scale, and the model the catalogue does not know)**, **B9 (what that
surface is allowed to call a server)**, **B10 (the drawn rows on it saying
so)**, **B11 (why it has two tabs, and the lane that was restating one of
them)**, **B12 (why the lane it installs for still cannot be chosen)**,
**D1a (OpenRouter and Your server, on the shape D1 extracted)**, **D1b (the
somewhere to type that server's endpoint, and the lock coming off it)**, and
**D1c (the credential chip asking about the connection the strip names)**.

Next unblocked: **B2**, **B4**, **E1**, and
**D3** — whose `Requires` line
has read D1 and A3 since it was written, both now done. **B4 is cheaper than it
was**: the Ollama listing it would have added for the local lane is now a
`pub(crate)` reader B5 put there.

**B8 landed the same evening and it is mostly a correction of B5.** The tab was
called *On this machine* and listed the catalogue, so a `ggml-*.bin` somebody
put in the folder was discovered, resolvable, transcribable and **invisible**;
and *an expert's checkout is never overridden* (ADR 0122) had been implemented
as an early return, so with `WORDSCRIPT_LOCAL_MODEL_DIR` set an in-app install
was never offered at all. **The listing unions every source; the rank decides
which file runs** (ADR 0159). It also adds the two ways in the owner asked for —
a picker that copies into the managed folder, and a folder used where it lies —
plus a typed tag for the language half, which is the only shape available there
because Ollama owns that store.

**One finding from it is for any track.** A surface that has to grow past its
drawn size can keep the port its subject by making the new control appear only
above a threshold: below it the gallery renders exactly the drawing and
`port:diff` still measures something real. B8's search appears above twelve
rows — openwhispr's own number — and the drawn nine keep `models#1` at
`0 | 0 | 7`. **The cost is that the grown state is unmeasured by the port** and
held by tests instead, which is the same class of gap Leg 13b named.

**B9, B10 and B11 are one evening and they are all corrections of the surface
B5 and B8 finished** (ADR 0160, 0161, 0162, 2026-08-15). The owner read it and
could not tell `Local`, `Self-hosted`, *On this machine* and *The server* apart;
the last of those named `127.0.0.1` while the lane row one tab over spent four
lines saying a server is another machine. **The finding for any track is not the
wording, it is where the wording was found.** Four separate defects survived a
green suite and were caught by looking at the rendered gallery — twice because
the same sentence lived in two places, and twice because a test drove a control
that was `disabled` and measured the default four times under four names. **A
test that drives a control has to check the control moved**, and a screen with
two copies of one fact will eventually have two different facts.

**And the evening produced the next step rather than a conclusion.** Asked what
to do next, the honest answer turned out to be a question about what was already
there: the tab installs models for a lane that cannot be selected. That is
**B12**, and writing it up narrowed it — ADR 0067 makes the lock deliberate and
names its own expiry, so the step is *the lock explains itself* and the release
is a gate behind Phase 5. **The first draft of that recommendation was too
coarse and the record is where it got cut down**, which is the argument for
writing steps before starting them.

**B12 landed 2026-08-16 and it is the smallest step on this track with the
widest finding** (ADR 0163). What it built is two rows: a withheld lane states
what the *product* still owes and, separately, what *this disk* already has —
because a machine with `whisper-cli`, a ggml model and Ollama answering is
READY and still not offered, and one dimmed control said the same nothing about
that machine as about an empty one. The lock itself is untouched; ADR 0067 rule
1 is right and reversing it is Phase 5's gate.

**D1a landed 2026-08-16 and it is the first step in Stage D since D1** (ADR
0164). OpenRouter and `Your server` get speech on the helper D1 extracted, and
both are a base URL plus four vendor answers — ADR 0113's price, paid and
correct. **The interest is what a half-built vendor did to the screen.**

**The finding is for any surface that reports why something is unavailable.** A
capability block says which roles this build can operate; it cannot say whether
the *vendor* offers them, and until an entry registered fewer roles than its
drawn row claims, nothing could tell the difference. OpenRouter serves
`/chat/completions` and this build has no adapter for it, so the seam would have
printed *"OpenRouter does not do chat completion"* — a false statement about a
third party, on a settings screen. **Both halves of the true answer were already
in the tree**: the drawn `stt`/`llm` booleans are the vendor's claim, the block
is this build's, and `no_adapter` is the name of the gap between them. It was
simply only ever askable about a whole vendor. G3's remaining nine adapters are
mostly chat-only or speech-only and inherit the corrected sentence for free.

**Two smaller ones travel too.** A test looping a literal `[Speech, Chat]` under
the name *every role it serves* passed for as long as those were the same list,
and would have demanded a catalogue row for a role nothing can dispatch — **a
test whose name is more correct than its body is a test that will one day be
satisfied by fabricating data**. And B12's *"neither has an adapter yet"* was
true the evening it was written and half false the next morning: **a sentence
naming two subjects because one reason covered both is a sentence that breaks
when either subject moves.**

**D1b landed the same evening and it is D1a's own last paragraph made a step**
(ADR 0165). That record left the lane expert configuration and named what it
left open — *where a base URL and an optional token get stored* — and this is
the answer: the URL and the model id are `AppConfig` fields typed on the
connection card, the optional token is in the OS secret store, and the three
environment variables become the fallback for a machine nobody has typed on.
**What is typed outranks them**, which is the reverse of `WORDSCRIPT_LOCAL_MODEL_DIR`'s
precedence and is deliberate: a field that stores a value the runtime ignores is
the false affordance ADR 0067 rule 1 exists to prevent. The lane is then offered,
because that rule says an offered lane must be operable and it is — and
`LockedLanes` drops the row whose reason is spent rather than rewording it.

**The finding is for any registry, not just this one.** `requires_api_key` and
`credential_kinds` were held EQUAL by a test, on the reading that they are one
claim from two directions. They are two questions — *must* and *may* — and this
lane is the first to answer them differently: `whisper-server` issues no token,
speaches and LocalAI may. **An equality that has never met a counterexample is a
coincidence with a test around it**, and the counterexample arrives as a lane
that has to choose which of two true things to state falsely.

**And two sentences elsewhere in the product went false the moment the lane
became reachable.** The screen's banner still counted *three* drawn lanes; the
status strip along the bottom edge of every view said `Groq cloud · {model}` for
any connection that is not `local` — wrong for OpenAI since D1 made that
connection selectable, and now wrong over a model field this lane is not even
sent. **Both were found by rendering the workspace and reading it**, which is
the sixth defect on this surface found that way after a green suite. The
technique had to change: `import -window` refuses on this machine, so what
replaced it is the real component tree over the dev server with
`__TAURI_INTERNALS__` stubbed, driven headless through CDP.

**The finding is for any track that marks a state.** ADR 0161 put a `Preview`
tag on the lane row conditioned on the selected lane not being `Cloud` — and
with a runtime present, the lock makes that state unreachable, so **the marker
renders only in the gallery**. The expression is correct; what is wrong is that
a marker whose only reachable state is one the product never enters is a marker
the product does not have. **The mechanical half generalises too**: a disabled
`<button>` fires no mouse events, so it can carry neither tooltip nor hint, and
any reason attached to one is invisible by construction.

**B5 landed 2026-08-15 and it closes a gate that had been open for twelve
days.** ADR 0042 said *until in-app installation exists, the local lane is
expert configuration and the surface says so*; it exists (ADR 0158). The part
worth knowing outside this track is what it removed rather than what it added:
`fallback_provider_profiles` used to offer `base`, `small`, `medium` and
`large-v3` **whether or not one of them was on the disk**, and it now offers
nothing — a machine with nothing installed says so, and the catalogue's rows are
offered as *installable*, which is a different sentence. Six drawn sizes were
corrected under ADR 0128's rule, five of them because the drawing printed binary
units under decimal names. **And the step changed the GUI port's
`command-sweep.mjs`**: that instrument resolved a channel constant on the
frontend side and only a string literal on the Rust side, so
`wordscript-model-event` read as a listener waiting for nothing while five emit
sites stood beside it. Same shape as ADR 0153, fixed by symmetry.

**B7 landed 2026-08-15 and the reusable half is the part to know about.** The
job ladder — lane, vendor, credential, model — was `Models.tsx`' internals and
is now `src/components/jobProvider.tsx`, because three surfaces render it rather
than one. **The extraction measured zero on `port:diff`**, proven by putting the
removed `upload` override back and landing on `structural 9 | style 217 | text
12` exactly; the movement that screen does show is that override and nothing
else (ADR 0129). The runtime gained `resolve_upload_capacity` — *which
`(provider, model, tier)` accepts N bytes*, the capture ceiling asked backwards
— and a sixth `InertReason` kind that **outranks a missing credential**, because
a key can be added and a file will not get smaller (ADR 0157). Whoever draws a
control a non-streaming lane cannot operate reuses that mechanism rather than
inventing a second, which ADR 0131 already required.

**One finding is for any track, not just this one.** An addition placed
mid-screen on a ported drawing renumbers every section after it: the translation
window's picker measured `187 | 80 | 33` where the information architecture
wants it, with **not one of the 187 a fidelity loss**. At the end of the screen
the same component measures `63 | 0 | 9`. An addition goes last unless the
drawing itself is being revised.

**C1 was on that list until 2026-08-14 and came off it, on a measurement rather
than on a dependency.** It rewrites `core::capture`, which the Runtime ownership
track is measuring until its step 6 has read one natural `Short` capture — and a
rewrite of the file under measurement makes that event unattributable, which is
the same rule that already defers the realtime-violation fixes. C2 requires C1
and inherits the wait. The reason and its cost are on C1 in the plan; closing
step 6 releases both.

**Two steps were added on 2026-08-13 from a donor reading, and neither needs
code to have been useful.** **B7** (ADR 0129, widened by ADR 0131) moves the
provider choice to the point of use — the file's size is the fact that decides
it, and it is not known in a settings table. **C4** (ADR 0130) answers how a
two-hour meeting is transcribed, which no document in this repo did: it is C1's
turns cut on silence rather than a chunker, and **the ceiling that binds it is
neither the audio nor the upload size** — the default lane cannot stream at all,
and nothing here records a model's context window.

**And the same day's third record is mostly a correction, which is why it is
worth reading.** ADR 0131 generalises B7's rule — *every surface that starts a
job names where it runs*, on **all four lanes** rather than Cloud with three
fallbacks — and then withdraws two questions C4 had filed as the owner's,
because **the prototype had already answered both**: live transcription is a
`toggle(true)` on the `Meetings` row and retention is `Keep the audio` with a
lifecycle default. Reading `docs/prototypes/` rather than reasoning about it
would have found them. It also corrects the donor survey — `voxtype` carries a
complete Rust meeting stack that the first pass missed.

**Then two candidates were cloned and correcting that record twice is the
lesson.** `donors/app/meeting-notetakers/` now holds **anarlog** (MIT, Rust,
formerly Hyprnote) and **meetily** (MIT, Rust). Reading them showed that
anarlog is **not GPL-3.0** as a web summary had said, and that the
topic-boundary chunking the same paragraph called *published practice* is not
what anybody implements — meetily cuts on a **sentence** boundary inside a token
window. **Anarlog is the primary reference for all meeting work** and carries
`aec`, diarization, `audio-chunking`, `segmentation`, `live_transcript` and
`overlay-kit` as crates. Read for mechanism, not structure.

**And a third surface for running text turned up that neither step knew**
(ADR 0132). `Live subtitles` is **two** features that share only the word:
captions over somebody else's audio, and the **echo** of your own voice under
the dictation pill. The echo renders partials, and no partial may reach the
session reducer — so **D2 now owes a display path beside its result path**, and
validates two things instead of one.

**What D1 left for somebody to decide was decided the next morning.** The drawn
per-job override and A4's runtime resolution disagreed about what a fresh
profile overrides; ADR 0128 answers it with a rule rather than with either
option — the config answers in the product, the drawn literal answers in the
gallery — and closes `PROVIDERS.md` disagreements 10, 11 and 13 with it. The
rule generalises past this screen: **an inherited drawing is an inventory of
intent, and what is unbuilt stays visible and inert rather than tidied away.**

### Runtime ownership

Opened 2026-08-13 as *measurement integrity*, **renamed and re-scoped the same
day** when the last finding turned out not to be a measurement problem at all.

`CLAUDE.md` gives the runtime trigger, capture, provider, transform, **insert**
and recovery. It does not own the insert, and the instruments cannot see where
it does not.

Owns ADR 0133, 0134, 0150–0152 for its five records, **0154** for the insert
channel the GUI port's sweep handed it, and **0155** for the overlay that stops
being unmapped (`be74233`, 2026-08-15) — 0135–0149
went to Context objects as a range the same week, which is why step 7's decision
is 0150 and not 0138, and **0153 went to the GUI port on 2026-08-14** because
that leg filed first, as **0156 did on 2026-08-15**. "Onward as they come" is a
direction of travel, not a reservation, and the number line is corrected here by
whoever notices — 0155 landed in `be74233` and stood on neither this board nor
its own track's page until the owner asked for it on 2026-08-15; **the seventh
record is on the track page now**. 0157 went to the speech track on
2026-08-15 with B7, **0158 with B5 and 0159 with B8 the same day**, and **0160
with B9** — the naming correction the owner asked for after reading the finished
B5/B8 surface — plus **0161 with B10**, the marker that lets a half-wired screen
say which of its rows are drawings, and **0162 with B11**, which answers why AI
Models has two tabs and removes the duplication that made 0160 and 0161 each
land twice, plus **0163 with B12** — the withheld lane stating what the
product owes apart from what the disk already has — and **0164 with D1a**, the
first entry to register fewer roles than its drawn row claims, plus **0165 with
D1b**, the lane that accepts a credential and requires none, and **0166 with
D1c** — the two-valued `ProviderId` deleted, so a surface asks about the
connection it is on. **0167 is already claimed** by the plan-axis work in this
tree — `provider_tier` lifted to a per-vendor `provider_plans`, cited in
`core/config.rs` before its file has landed, which is this section's own rule
about grepping rather than reading a line — so **0168 is the next free number**.

**A sixth record closed on 2026-08-15 without ever being a step.** The GUI port
swept the event channel and found `wordscript-native-insert` emitted from three
sites in `core::insertion` and heard by nothing, while `spec/SPEC.md` carried it
as contract (ADR 0153). It was dead weight rather than a gap — every emitter sat
beside a path already delivering the same `NativeInsertResult` — and the owner
removed it the next day (ADR 0154), on ADR 0018/0019's rule that a session ends
in exactly one reducer commit.

**A seventh closed the same day and was missing from every page for a day**
(ADR 0155). The overlay flashed the full rectangle black at every recording
start, because each reveal ended in `show()` — an X11 map under XWayland, which
KWin composites before WebKitGTK has delivered a frame with alpha. On Linux the
window is now mapped once at setup, offscreen at opacity 0, and parking is
opacity plus click-through; Windows and macOS keep `hide()`. **What it hands the
track is an open risk**: the park move became effective for the first time, and
`overlay-stranded-off-screen.md` had measured all 482 parks landing somewhere
other than requested precisely because GTK does not move a hidden window.

**Step 1 was silent data loss and its code landed 2026-08-14.** Every insert
call site is an `invoke` from `OverlayWindow.tsx`; after `preview ready` the
runtime did nothing on its own. The clipboard write, the history record and the
transcript file are all created inside that insert, so a window that never
returned discarded a finished dictation and nothing reported it. Measured across
277 previews: 1.12 s median, but 11–115 s in the 13 whose webview was destroyed
mid-preview, and one transcript lost outright to an app restart. ADR 0134 gives
the runtime a 10 s deadline; the overlay keeps commit and abort. **The
acceptance run passed the same evening in the native host, in a run where the
overlay rendered no frames at all** — two dictations reached all three artifacts
10.0 s after their preview. **Its second half was paid by ordinary use the same
day**: eight healthy sessions logged `path=frontend`, so the deadline is
demonstrably not the path a working window takes. **Step 2 is done**: one
constant for the watcher and the test exclude, 20,393 inotify watches down to
576.

**Step 4 landed the same day, and so did the decision step 1 had left to the
owner.** The overlay asks the runtime what is running when it mounts (ADR 0151)
and repaints a live capture or a staged preview — and deliberately re-reports
nothing about a session that ended while it was away, because the path that
ended it already owed the surface that reported it. **The deadline then fired
under a window that was demonstrably alive**, which the step's own run sheet had
pre-registered as proof of a mis-sized deadline. It was not: the log shows a
window alive and idle, i.e. a user who did not answer in ten seconds, which is a
third reading the sheet did not have. The answer built is ADR 0152 — an open
edit surface renews the deadline every 3 s, with no release, so a window that
dies mid-edit is still finished for on the ordinary schedule. **It ran in the
product the same afternoon**: a session logged `Native preview deadline
deferred` at the exact instant the old code would have committed, and committed
10.0 s after the surface stopped asking.

The rest is why it stayed invisible. The capture cadence timestamps itself
after taking the app's own mutex, so a suspended stream and a self-blocked
callback are one number. The overlay heartbeat reports a *late* interval, so a
reload — which destroys the interval rather than delaying it — reads as silence.
And `npm run tauri dev` issued about 1,389 full reloads in 2.5 days because the
watcher covered 36,000 files it had no reason to watch.

Step 1 outranked the watcher fix even though the watcher is cheaper: the watcher
makes the window die less often, step 1 makes it not matter when it does. Both
landed the same day, in that order.

**Steps 5 and 3 landed the same day too, and the mutex sentence above is now
false in the code and kept here because it is what the record was measured
under.** The cadence is fed the callback's arrival time, the lock wait is its
own field, and `signature()` no longer prints `stream_suspended` over a
self-inflicted stall. **Step 3's new field fabricated a loss before it measured
one** — 0.292 s reported on a soak segment that had recorded more audio than its
own clock ran, because clamping counts the late half of ALSA's burst jitter and
discards the early half. Found by reading a twelve-second run against real
hardware; every synthetic test was green while it did. That is the second time
this cluster's failure class has come out of the instrument built to detect it.

**Step 7 landed the same day and its interest is the refutation, not the fix.**
ADR 0010 had registered the idle-close fallback in 2026-07 and named the
evidence that would trigger it; 283 stream errors in 2.5 days is that evidence,
so the decision was one somebody else had already made. A cold open measures
14–20 ms against 40 ms of warm-up silence the engine already pays, and the app
verified it live — `closed after idle` at +60.043, the monitor's sink
`SUSPENDED`, WordScript's stream gone. **What the record was wrong about is why
it mattered**: it said a per-cue stream would follow the user's default device.
WirePlumber pins a target by application name, so it does not — proven with a
control, and confirmed when the reopened stream came back on the wrong device
anyway. The routing half was never this stream's lifecycle question; it is the
Speech track's F2.

**Step 6 is now the whole track's front line and it cannot be hurried.** It
waits on one natural `Short` capture, at about 1.5 % of captures, and every
earlier event in the record is unreadable by construction: they were measured by
the instrument that could not tell the two hypotheses apart.
`scripts/read-capture-event.sh` applies ADR 0133's pre-registered reading to
whatever the log holds, and refuses the three events already in the record for
exactly that reason — the wait is now one command rather than a procedure
somebody has to remember.

**It shares `capture-loses-half-the-recording.md` with Core hardening.** That
track holds the capture *loss* as one of its five invisible-damage records;
this one holds the capture *instrument*. Re-read the record before appending —
both tracks write to it.

### Context objects

Opened 2026-08-14 out of the meeting-donor reading (ADR 0135, ADR 0136), which
found a gap rather than a feature: **ADR 0045 declared one object with five
states and five origins on 2026-08-03, and no track ever built it.** What exists
is a ported drawing over a fixture, and every route into that object was filed
either as a roadmap candidate or as a step in somebody else's sequence.

Owns ADR 0135–0149. The first two were written before the track existed, out of
the speech track's donor reading, and are filed here because they are about this
subject rather than about a lane.

**It is named for the object and not for meetings on purpose.** The meeting is
one origin of five and the only one behind a capability gate; a track called
*meetings* would file four unblocked origins behind the blocked one.

The seam with the **Speech** track is the one to keep straight: that track
answers *where a job runs and what it can do*, this one answers *what the job
produced*. Speech-track C1, C4 and B7 are requirements here, not duplicates.

Stage E is blocked on roadmap gate 3 (system audio without a per-session
prompt). A through D are not blocked by anything.

### Home activity

Opened 2026-08-16 out of the owner reading Home and asking why it still says
*Preview*. It did, over a screen that is wired — the banner's chip was a fixed
word while its sentence said *wired in part* — and the answer turned into a
larger one: **the most prominent surface in the product is spent on an
instruction, and an instruction is read exactly once.**

Owns ADR 0171–0184 and 0186–0188 — 0185 went to the privacy work — claims
0189–0196 for Stage C, and holds **0233**, **0235**, **0236**, **0237** and
**0240** for Stages D to G; 0234 and then 0238 were both lost to the
insert-delivery track mid-session and renumbered.
[ADR 0171](decisions/0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md)
covers what A1 and A2 built; the rest are on the track page, in order, against
the step each one closed.

Home's opening block becomes **either an activity calendar or four counter
tiles**, the reader's choice. They are alternatives because they answer
different questions — the calendar is a rhythm, the tiles are a character — and
because the calendar carrying all the movement is what lets the tiles be slow.
The calendar renders as circles on the matrix palette, which makes it the same
display as the dot-matrix readout rather than a borrowed GitHub graphic.

**Its seam with the GUI port is why it is its own track.** That relay is scored
by `port:diff` against `demo.js`, and the prototype has neither surface; filing
this as a leg would either corrupt that measure or hide behind it.

**Stage A is closed** — A1 to A11, landed between 2026-08-16 and 2026-08-17,
including four correction passes driven by the owner using the finished block and
reporting what it got wrong.

Stage B is four things other tracks owe — recognized language (speech /
core-hardening), the target application plus the privacy rule that would name
that collection, lifetime counters that survive pruning, and meetings and uploads
as calendar origins (context objects). **B3 closed with Stage A**; the other
three are drawn and declare themselves, per ADR 0161.

**Stage C opened 2026-08-17 from an owner brief and is unblocked in full.**
Twelve rows in three independent groups: the calendar's left arrow — whose root
cause is located, the reach test is taken against a raw zero while the scroller
rests at `GRID_LEFT_PAD` — plus a class of day the track never had, a **marker**,
which is a day with a name rather than a count and therefore never joins the
ramp; Home's turnaround unit, which needs a decimal point on a counter documented
as having no separator; and the dictation list Home and History share through one
`TranscriptRow`. **Two rows depart from a standing ADR and must say so by
number** — the standing facts move back to the top against ADR 0171, and delete
gets an undo window instead of ADR 0082's *deleting always asks*. One row is
withdrawn on the page rather than deleted, so the decision is findable.

**Developer Mode is not here.** The same brief asked for it; it is a release gate
rather than a Home question and lives in the V1 release track.

### Activation gestures

The only forward-looking document that is not a running track: why one set of
shortcut defaults cannot serve three activation modes, the three capability gaps
that block a per-mode gesture, and the decisions still owed. Nothing is built.
It is listed here so it stops being invisible, not because it is scheduled.

### V1 release

Opened 2026-08-17. **It is a measuring instrument and not a build queue.** One
question: can somebody who did not build WordScript get it, install it and
dictate with it. Today the answer is no and the shipped artifact is
`npm run tauri dev`, so the page exists to turn that into a reading somebody can
take — gate by gate, with a date and a piece of evidence — instead of a feeling
about how close it is.

Owns ADR 0197–0202.

**The gate list moved here** from [`RELEASE_RUNBOOK.md`](RELEASE_RUNBOOK.md),
which carried it as seven unstated bullets — a list with no state per row is a
list you cannot take a reading off. The runbook keeps the build procedure and
links to the board (ADR 0123). Thirteen gates, each with a state, a last-measured
date and the command that re-reads it. **Three read *not started* by measurement
rather than by assumption** — no signing identity, no updater plugin, no licence
notices in the artifact — and one is the owner's decision rather than work.

Three gates are on the board that the runbook's list did not carry:

- **The compatibility window closes exactly once.** ADR 0112's ballast is
  removable today only because no published versioned release exists. The first
  install makes every one of those shapes a real obligation and every deletion a
  migration.
- **An AGPL artifact owes what a private build does not** — the source offer,
  and notices for the two vendored trees (`heat-map` MIT, `global-hotkey`
  Apache-2.0 OR MIT). A notice in the repository is not a notice in the bundle.
- **One cloud lane, no streaming**, so the board is not read as *four packaging
  items and we ship*.

**One gate it closes with its own hands**: Developer Mode, a Settings switch
that hides every preview surface at runtime, behind **one flag registry** rather
than the 33 inline marker literals in the tree, with a walker test so the next
one cannot be spelled outside it. Off by default — the build a stranger installs
must open on what is real.

**It carries no phase table and no product-state report**, by ADR 0123. Those
are [`ROADMAP.md`](ROADMAP.md) and [`STATUS.md`](STATUS.md).

## Sharing `main`

Eight tracks work in one tree with no branches. The rules that come from that,
learned the expensive way:

- **Run `git status` and `git log --oneline -5` before you start.** Another
  track's uncommitted prose may be sitting in a document you are about to write
  to. Leg 12 committed only `src/` for exactly this reason, and its
  documentation then sat in the tree for a leg.
- **Stage your own paths. Never `git add -A`.** Whoever commits a file next
  carries whatever else is in it.
- **Never trust a "next free ADR number" written on a page.** Grep the whole
  tree, not just [`decisions/`](decisions/) — a number gets cited in source and
  in a commit message before its file lands. The relay's rule 3 carried a stale
  `0060` for sixty-three records.
- **A test count is a shared measurement.** A step that changes one says by how
  much and why. A count that moved because another track landed is that track's,
  and saying so is the difference between a baseline and a guess.
- **A documentation stage that moves a test count has done something it did not
  say it would.** Prove the suite did not move rather than that it passes.

## Where the sequence for a whole release lives

The tracks are how work is done; they are not what the product owes. That is:

- [`ROADMAP.md`](ROADMAP.md) — the V1 phases, in order, with their gates. The
  canonical phase detail.
- [`STATUS.md`](STATUS.md) — what works today and what is open.
- [`spec/SPEC.md`](spec/SPEC.md) — the authoritative contract. When an overview
  document disagrees with it, the overview is the one that drifted.

A track is not a phase. The speech track spans ROADMAP Phases 4 and 5; the GUI
port is the second half of Phase 7; core hardening serves Phase 1's promise
after Phase 1 closed.

## Closed tracks

Their sequence documents, records and spent briefs are in
[`archive/`](archive/README.md):

| Track | Ran | Outcome |
| --- | --- | --- |
| Settings surface rework (as a plan) | 2026-07 → 2026-08-04 | Spent as an instruction; kept as the derivation of why the surface is shaped the way it is. Superseded by the GUI port relay |
| UI/UX overhaul | → 2026-07-25 | The implemented UI direction and its enduring rationale. Current rules moved to [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) |
| GUI rework, third pass | → 2026-08-04 | Superseded by the GUI port relay |
| Capture shortcut lane rebuild | merged 2026-07-25 | The shortcut contract (S0–S8) and the invariants it established |
| Documentation realignment | 2026-07-24 | Established the current documentation set and American English throughout |
| Insert delivery | 2026-08-18 | Opened and closed the same day. The last step of a dictation was the only one with no way to tell whether it worked: XTEST exits 0 whether or not the keystroke arrives, and nine consecutive runs recorded `pasted: true` while inserting nothing. Steps 1-7 done, 8 (`ConnectToEIS`) deferred with its reason. The lane that was missing is the RemoteDesktop portal, whose paste is a D-Bus call with a result (ADR 0228, ADR 0234), and both lanes are measured from real dictations. **Two findings travel**: a probe answering "no" for a reason unrelated to the question closed this path twice over and in silence, and the ADR 0231 delivery switches shipped inoperable while their tests stayed green, because the tests asserted on the write and the defect was on the read |
