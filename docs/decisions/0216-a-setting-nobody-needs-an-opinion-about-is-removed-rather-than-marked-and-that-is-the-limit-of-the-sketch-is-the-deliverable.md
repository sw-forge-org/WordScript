# 0216 — A setting nobody needs an opinion about is removed rather than marked, and that is the limit of *the sketch is the deliverable*

Date: 2026-08-17
Status: accepted. Bounds
[ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md)
and, through it, [ADR 0127](0127-an-inherited-drawing-is-an-inventory-of-intent.md)'s
*an inherited drawing is an inventory of intent*.
Track: Speech (B19)

## Context

ADR 0161 established that an unbuilt row on a ported screen **declares itself and
stays**: the drawing is the inventory of what the product intends to offer, so
deleting an inert control would hide what is still owed. That rule has been
applied repeatedly and correctly — the withheld lane, the acceleration row, the
Enterprise credential shapes.

It was applied to a class of row it does not fit.

The owner read the finished job list on 2026-08-17 and asked where four drawn
settings are actually set. The answer, measured rather than assumed, was
*nowhere*:

| Row | On AI Models | On Profiles |
| --- | --- | --- |
| `Into`, `Keep the profile's words` | stated, with a `ScopeTag` | **edited** |
| Language, `Pin this language` | drawn select and toggle | absent |
| `Bias from the profile's words` | `InertSegment`, fixed on *Standard* | a readout only |
| Prompt Enhance `Sub-mode` | `InertSegment` | absent |
| Prompt Enhance `Prompt target` | `DrawnSelect` | absent |

Two further facts sharpen it. `bias_mode` has no control anywhere in the product
and `Profiles.tsx`'s own `FLAG_KINDS` comment already said so — the profile
health detector fires `bias_policy_weak` on a field the reader cannot change.
And `enhance_sub_mode` and `enhance_target` are stored in **two** places,
`AppConfig` and the profile's work mode, with no writer for either; `Models.tsx`
cited that pair as the precedent its two live Translate controls follow, which is
a false citation that would have kept the pair looking finished.

**The owner's ruling was not to wire them.** In his words: *"Das einzige was wir
davon brauchen ist Into, Keep the profile's words und Language sowie Pin this
language. Alles andere braucht man gar nicht erst zu sehen, weil das feste
Einstellungen sind, die den User gar nicht interessieren, sondern einfach
funktionieren sollen."*

That is a product decision about the settings, not a judgement about the
drawing — and ADR 0161 has no arm for it. Its rule assumes an unbuilt control is
*owed*. These are not owed; they are withdrawn.

## Decision

**Where the intent behind a drawn control is withdrawn, the control is removed
rather than marked.** ADR 0161 governs *unbuilt*; this governs *unwanted*. The
test is what a `PreviewTag` on the row would promise: if it would promise
something the product intends to deliver, 0161 applies and the row stays. If it
would promise something nobody has decided to build **and nobody wants**, the tag
is a lie with a badge on it and the row goes.

Removed from the job list on AI Models:

- `Bias from the profile's words` — **and the reason is not that the choice was
  already made.** A first draft of this record said so, citing ADR 0033 and
  ADR 0035; reading `core::transcription_hints` afterwards showed it was wrong.
  `bias_mode` switches three real behaviours: `Off` suppresses the cloud prompt
  and the local prompt entirely, `Conservative` sends the profile's hints, and
  `Manual` substitutes a typed override. It is a live switch, not a decided
  question — it is simply one **nothing has ever written**, so every installation
  runs on the `Conservative` default and the other two arms are unreachable. The
  segment drew a three-way choice over a switch permanently pinned to the middle
  value. The owner's ruling is that the pin is correct and the choice is not
  wanted; what follows from that is B21, not this record.
- Prompt Enhance `Sub-mode` and `Prompt target` — a fixed shape the reader has no
  reason to hold an opinion about. Their config fields keep their defaults and
  their readers.

Kept, and they are the pattern: `Into` and `Keep the profile's words` are edited
on Profiles and stated here with a `ScopeTag`; the language pair joins them
(speech-track B18).

## Consequences

**`port:diff` on `models` moves and the movement is the decision.**
`29 | 287 | 33` → `65 | 281 | 33`, 736 nodes to 700. The prototype draws all
three rows, so every subsequent measurement of this screen carries a structural
gap that is deliberate. **This is the first structural divergence from the
prototype on this screen that is neither a port defect nor an addition** — which
is why it is a record and not a commit message. A future leg reading `65` must
find this ADR rather than a regression.

**No test moved**, and that is a finding rather than a reassurance. Three drawn
controls were removed from a screen with 95 cases against it and the suite did
not notice — 866 before and after. Inert controls are held by `port:diff` alone,
so the port is the only instrument that can see them, and it measures the gallery
rather than the product. The same gap ADR 0159 named for grown state applies to
removed state.

**Two things this record deliberately leaves open, and each is a step of its
own** — written down as B21 and B22 rather than left in this paragraph, because a
consequence noted in a closed record is a consequence nobody reads.

**`bias_policy_weak` cannot fire, and removing the segment does not change
that.** The detector returns early unless `bias_mode == Off`; `bias_mode` is
`Conservative` on every installation because nothing writes it. So the flag was
already unreachable, its hint already told the reader to *"re-enable Conservative
or Manual bias"* through a control that does not exist, and this record neither
improved nor worsened it. **The first draft of this paragraph claimed the removal
made it one step worse**; that was a guess about a detector nobody had read.
B21 owns the whole of it — the unwritten switch, its two unreachable arms, and
the flag that guards one of them.

**The duplicate `enhance_*` storage survives the controls that never wrote it.**
Two fields in two places with no writer is now two fields in two places with no
writer and no drawing either. B22.
