# Reference map - wordscript.dev

Six references, each with what to borrow, what to avoid, and why it is on the
list at all. A reference is a live site and this map is a reading of it on a
date, not a permanent fact.

R1 to R4 and the study were read 2026-08-25. R5 was read 2026-08-26 and is the
one the built page borrowed the most from. The competitor reading at the end
was rewritten on 2026-08-26, because the positioning it used to argue was
rejected; `PRODUCT.md` carries the one that replaced it.

Principles get borrowed. Layout and copy do not.

## The problem these references were picked against

Four constraints make this site unusual, and a reference earns its place by
answering at least one of them:

1. **There is no download.** The primary action is to follow the build.
2. **The product surface is very large** - dictation, the record and what was
   done to it, statistics and history, profiles and context, audio and link
   import, meetings, translation, and agents that speak. A feature grid would
   be unreadable and would also be the wrong argument.
3. **It is a vision, not a shipped state**, and it must still be concrete.
4. **The value only exists in motion**, which makes the demo the hardest and
   most expensive decision on the project.

Constraint 4 is answered and the answer was to build rather than to film. The
capsule on the page is the app's own overlay as live DOM, driven through the
runtime's own level curve, and since the first review it is also **held**: the
hero's capture runs for as long as the reader holds the pointer or the space
bar, because the product's argument is a key you hold and a recording of one is
that argument made in the third person. Constraint 2 is answered by the
triangle: three destinations, and inside two of them a second axis, rather than
a list.

**Constraint 3 was answered by deciding what it does not mean.** A vision page
that is still concrete does not achieve it by labelling which parts ship, which
is what the app does internally and what was proposed here. It achieves it by
being right about behaviour: the capsule's states, the two delivery paths, the
keys and the model grid are all read back to the files that own them, and what
stays invented is only the content of an example. ADR 0252 carries the
derivation.

## R1 - Char (formerly Hyprnote), char.com

The closest structural analogue that exists: a peer in the same audio-and-notes
space with **no download**, whose entire conversion is `Join private beta`,
placed in the hero and again in the footer with nothing competing against it.

**Borrow**
- The single-action page. One CTA, stated twice, no secondary button fighting
  it. *Taken, with one change*: the built page pairs Discord with the source at
  near-equal weight, because for an AGPL product the repository is the second
  half of the argument rather than a courtesy link.
- Privacy as a sentence someone would say rather than a bullet in a security
  grid.
- Integration and model logos embedded inside the section that uses them,
  instead of a *trusted by* strip. *Taken, and inverted*: the built page has a
  row of application marks under the hero with a note attached saying they are
  not integrations, because a logo row reads as an integration list by default
  and that is the exact claim the wiring diagram disproves.
- UI cards that transition between workflow states rather than sitting still.

**Avoid**
- The register. Lowercase hype is not the voice here.
- The rebrand itself, as a cautionary reading: `hyprnote.com` now 301s to
  `char.com`, and the open-source local-first identity was traded for a generic
  *AI notepad* one. That is exactly the drift WordScript must not perform.

**Reason** - the only reference that solves our precise conversion problem in
our precise category, which makes it worth more than a prettier page solving a
problem we do not have.

## R2 - Zed, zed.dev

An open-source desktop application with a product surface as broad as ours,
which does not become a feature table.

**Borrow**
- **Per-feature cards with an expand-to-play affordance.** Nothing autoplays;
  the reader chooses which capability to watch. *Taken as a discipline rather
  than as a component*: the built demo plays one scene at a time, the reader
  picks which, and a Replay control sits outside the window because it controls
  the demo rather than being part of the surface demonstrated.
- The second CTA is the source, at equal visual weight to the first. **Taken.**
- Thematic clustering rather than a flat list. **Taken**, as the triangle.

**Avoid**
- The testimonial carousel with recognisable names. We have no users, and
  inventing them is the UWG line in `PRODUCT.md`.
- A headline clever enough to say nothing. Ours has one job: name what this is.

**Reason** - proof that breadth and open-source can be presented as craft
rather than as a specification, and the strongest available answer to
constraint 2.

## R3 - Granola, granola.ai

The clarity benchmark in the adjacent category, and the one with a structural
idea worth stealing outright.

**Borrow**
- **Organise by the shape of the work, not by the shape of the product.**
  Granola runs *before the meeting / during / after* and its features stop
  looking bolted on because each one sits where the work happens. *Taken, with
  a different spine*: ours is not the life of one dictation but the three
  places a dictation can end up, because that is what the positioning claims
  and it is also the product's real architecture.
- Real output as the hero visual - actual notes with actual formatting, not a
  mockup with placeholder text. **Taken further than Granola takes it**: not
  real output but the real surface, running.
- The two-tier headline: benefit line, then the differentiator line.

**Avoid**
- `Download for free` repeated down the page. We have nothing to download.
- The customer-logo wall and testimonial density.
- The earth-tone illustration warmth. Different brand, and it would fight the
  product's own design system.

**Reason** - our surface is large enough that only a spine keeps it from
collapsing into a list, and this is the proof that a spine works in a category
adjacent to ours.

## R4 - Screen Studio, screen.studio

The demo-craft reference, and the closest analogue to our hardest problem: a
desktop tool whose value is invisible in a screenshot.

**Borrow**
- **The demo is a specimen, not an explainer.** Screen Studio's hero video is
  not a tour of the app, it is a piece of output the app produced, and it
  argues by being good. **Taken, and it is the page's largest asset.**
- Two to three sentences of copy per section, beside a visual that proves the
  sentence. No section carries text alone. **Taken.**

**Avoid**
- Autoplay in the hero. *Partly taken*: nothing has sound and nothing demands
  attention, but the hero capsule does play itself once on first sight, because
  a still capsule on a surface claiming to be listening is a fake state.
- The logo wall and the mid-page pricing block.

**Reason** - it answered constraint 4, and answered it in a way cheaper than a
produced film.

## R5 - Voicely, voicely.de/en, read 2026-08-26

Read live at 1440x900: 12,014 px over nine sections, against 3,974 px over
eight here at the time. It is on this list for one idea.

**Borrow, and it is one idea above all others.** Their privacy section is a
single inline SVG: three peripheral nodes around a hub, wires with travelling
dots, and a switch that severs them. Wires go dashed and faint, nodes dim, the
hub takes a ring. One picture, one systems claim, one click that proves it.
That is the strongest thing on their page.

**The theme did not transfer, only the technique.** Their subject is privacy,
which is a tie against openwhispr and therefore not a position we can hold.
Ours is ADR 0046, which is the claim the page is actually built on. The built
diagram differs in two states by one countable quantity, and prints that
quantity under the drawing so nobody has to count wires: five connections the
product has to own, or one.

Also taken: the fact strip closing the hero visual, the band directly under the
hero, and the pattern of citing third-party research with a named source
instead of inventing product numbers.

**Avoid, deliberately:**
- Green-on-black with glow on everything. That is the category's palette and
  theirs. Ours is warm amber on near-black, and light is placed on three
  objects rather than on everything.
- *Write 5x faster*, *Save 20+ hours*, the pricing block. Unprovable speed
  claims are the exact positioning `PRODUCT.md` forbids.
- A small-caps coloured eyebrow label above every section. All five of ours
  were removed as a generated-copy tell. Do not reintroduce them because a
  reference has them.
- An icon in a rounded square on every card.
- Length as a goal. Their 12,000 px is not a target.

**What we have that they do not.** Their demo is a mock email window with a
fake paste. Ours drives the shipped overlay geometry through the runtime's own
curve.

## The evidence base - Evil Martians, 100 devtool landing pages

Not a visual reference. A study, and it is the sanity check against the failure
mode the owner named: pages that read as generated.

What it found, and what we took from it:

- **No salesy language. Clever and simple wins.** Successful pages avoid flashy
  interaction and spend their budget on typography, layout and whitespace.
- **Centred hero with the visual below it** dominates; side-by-side heroes are
  the rare exception. *Not taken, and the exception was chosen deliberately*:
  the right half of the hero was empty, and the live capsule is the page's
  strongest asset, so it sits beside the heading above 1080 px and stacks
  below it.
- **Specific CTA language beats generic.** Ours names the actual act, joining
  the room or reading the source, rather than "learning more".
- **Feature narratives rank: problem-oriented > action-oriented > mission >
  bold statement > function list.** A function list is the weakest form and is
  what a large product surface decays into by default.
- **One good testimonial is enough at early stage.** We have zero and ship with
  zero rather than manufacture one.
- **For an early-stage product, an FAQ alone is enough** supporting structure.
  Everything else is padding. **Taken:** one FAQ, six questions, and the first
  one is whether you can download it yet.

## The category convention, and where we stand against it

Read against `wisprflow.ai` and `superwhisper.com` on 2026-08-25, and against
`openwhispr.com` on 2026-08-26.

**Both paid competitors open with the same sentence.** A variation on *do not
type, just speak*. The imperative-speech-verb hero is the category cliche, and
any version of it puts WordScript in a line-up it cannot win on spend.

**Both sell speed and polish, with figures.** Those are numbers we cannot
produce and a positioning we do not want. Speed is table stakes here; every
entrant claims it.

**Both use the same signature visual: raw speech beside polished text.**

**And openwhispr is the reading that changed the positioning.** MIT,
local-first, and already shipping meeting notes, folders, semantic search and
cross-meeting chat. Privacy is a tie. Speed is a tie. Being open is a tie. Any
pitch built on those three argues against a peer who has already shipped them.

So the differentiator is not that WordScript can tell you what happened to your
sentence. That is true, and it is a property of the dictation half, which is
the half `docs/VISION.md` says is commoditising. It survives on the page as one
of six items under *The dictation half, done properly*, which is the weight it
deserves.

**The differentiator is where what you said ends up, and who has to build the
road to get it there.** Everyone else's context lives inside their product, and
reaching it means a connector they own, authenticate and maintain. WordScript
writes one plain file into a directory your own tools already open, and
maintains no second integration surface to get it back out. That is ADR 0046,
it is the page's largest claim, and it is drawn rather than asserted.

That is the positioning, and it came out of the reference pass rather than out
of a brainstorm: **the voice is the input, what stays is context, and the
output is the cursor, an object, or an agent.**
