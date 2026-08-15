# 0163: A withheld lane states what the product owes, and separately what this disk already has

Date: 2026-08-16
Status: Accepted. Implements the reporting half of
[ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md)
without touching its withholding half, and spends the reader
[ADR 0160](0160-a-server-is-a-machine-that-is-not-this-one-and-the-runners-here-are-named-for-what-they-run.md)
built. Follows
[ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md)
and [ADR 0162](0162-the-lane-is-a-choice-and-the-tab-is-an-inventory-and-that-is-why-there-are-two.md)
on the same screen.

## Context

**The finding is one sentence: the tab installs models for a lane that cannot
be selected.**

[ADR 0042](0042-one-surface-owns-every-model-choice.md) said *until in-app
installation exists, the local lane is expert configuration and the surface
says so*. B5 built the installation (ADR 0158), B8 made the listing union every
source on the disk (ADR 0159), and `docs/STATUS.md` now carries `local` under
**Implemented core features** as a full lane over `whisper-cli`, ggml models
and Ollama. `Models.tsx` still disables it.

**That lock is correct and this record does not touch it.** ADR 0067 rule 1 is
explicit — *a surface that OFFERS a lane makes it inoperable* — because a
control that accepts a click and then asks for a credential is the worst false
affordance there is. The lane is not finished: ROADMAP Phase 5 still owes the
acceleration probe, the bundling decision and streaming (F3), and two of those
became recorded intents only the day before this record (ADR 0161).

What is wrong is narrower, and it is the whole subject here: **the lock is
silent about itself.** Three of the four segment options grey out and the card
says nothing — not why, not for how long, and not that the machine reading it
may already have every piece the lane needs.

### The two facts that were folded into one greyed control

- **Not published** is a decision about the product. It is the same for every
  machine, it changes when Phase 5 closes, and no amount of installing moves
  it.
- **Not ready** is a fact about this disk. It differs per machine, `local_setup`
  on `provider_status` has answered it since before B5, and B9 already built
  the reader (`useLocalSetup`).

A machine with `whisper-cli`, a ggml model and Ollama answering is **READY and
still not offered**. One dimmed control says the same nothing about that
machine as about a machine with none of the three, and `CLAUDE.md`'s rule —
*do not render fake states; show runtime truth, and when the runtime is not
ready, show the next action instead* — was being broken in the one direction
nobody checks for: the surface withheld without reporting.

### And the marker that was already there could not reach the product

ADR 0161 put a `Preview` tag on the lane row, conditioned on the selected lane
not being `Cloud`. With a runtime present, every other option is `disabled`, so
the selection can never leave `Cloud` and **the tag renders only in the
gallery**. It is not a wrong expression — with `Cloud` selected the tag would
be a false claim — but a marker whose only reachable state is one the product
never enters is a marker the product does not have.

## Decision

**The segment keeps its behaviour exactly and the card gains the reason,
as text, in rows of its own.**

1. **`disabled` does not move.** Removing it is ADR 0067's reversal and belongs
   to the commit that finishes the lane, exactly as that record asks. A
   disabled `<button>` fires no mouse events, so it can carry neither a tooltip
   nor a hint — which is *why* the reason has to be a row rather than an
   attribute, and is the mechanical reason the lock stayed silent for so long.

2. **Two rows, because there are two reasons, and folding them would repeat the
   defect one level up.** `Local` is built, installable and withheld;
   `Your server` and `Enterprise` have no adapter at all. One row apiece:

   | Row | Badge | What it answers |
   | --- | --- | --- |
   | `Local` | `Ready` / `2 of 3 ready` / `Not read` | why it is withheld, what this disk has, what is left |
   | `Your server` and `Enterprise` | `No adapter` | nothing is behind either one yet |

3. **The product's half is a constant and the disk's half is composed.** *Not
   offered yet: Phase 5 still owes the acceleration probe, the bundling
   decision and streaming* is one string with one owner — three surfaces on
   this screen have already carried one fact in two places and drifted
   (ADR 0160, 0161 and 0162 each had to be applied twice). The rest is built
   from `runner_ready`, `model_ready` and `chat_ready`, forwards and backwards:
   what is there, and what would still be needed.

4. **`Not read` is a third answer and it is never guessed.** `local_setup`
   comes back `null` when the probe failed or has not run. Reading that as
   *nothing is installed* would tell somebody to install what they already
   have — the same conflation ADR 0160 refused one tab over.

5. **The rows are wired-only.** The gallery has no runtime, therefore no lock
   and no disk to report on, so there is nothing here to draw. `port:diff` is
   unmoved on both states of `models` by construction rather than by luck, and
   the known cost is B8's (ADR 0159): what appears only in the product is held
   by tests instead of by the port.

6. **`local_setup` is read once for the whole screen.** Both tabs state the
   same disk now, and `inspect_local_setup` spawns `whisper-cli --help` and
   probes the Ollama endpoint to answer. Two hooks would be two probes for one
   fact, which is the cost ADR 0124 already refused once at ten.

**No Rust.** Everything this states was already on the wire.

## Consequences

- **ADR 0067's expiry clause is now readable from the product.** *It expires by
  being reversed, not by drifting* — and the row that says so is where the
  reversal will be visible when Phase 5 closes and `disabled` comes off.
- **The gate is unchanged and stays a gate.** Making the lane selectable
  requires the acceleration probe, the bundling decision, guided remediation
  and F3's streaming shape. Whoever closes it writes the ADR that reverses
  0067, in the commit that finishes the lane.
- **The rule generalises past this screen.** Any capability that is built and
  withheld owes two sentences, not one: what the product still owes, and where
  this machine stands. Merging them produces a surface that either blames the
  user for a product decision or takes credit for a machine it never looked at.
- **`Onboarding.tsx` is deliberately not reached**, and this is the record of
  that choice. It renders the same `LANES` table and the same lane segment, but
  it is an entry-point hole (`ia.tsx`'s `ENTRY_POINT_HOLES`) — never mounted
  outside the gallery, wired to no runtime, and therefore with no lock to
  explain and no disk to report on. **It carries the defect ADR 0161 fixed
  here**: its `Local` branch states `Bundled`, `CPU only` and `32 GB RAM` as
  facts about the reader's hardware, and its lane row carries no `Preview` tag
  at all. That is one unit of work for whoever wires the flow, not a silent
  addition to this one.
- **The `Preview` tag on the lane row stays gallery-only** and is now
  redundantly covered: the two new rows are the product's version of the same
  statement, and they render in the state the product is actually in.
