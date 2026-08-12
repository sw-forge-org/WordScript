# 0127: The connection is a stored value, and every row that names a vendor reads it

Date: 2026-08-12

Status: Accepted

## Context

A4 landed the provider axis in the config — a per-profile `providers` block
holding a resolved `default` plus a sparse override per job — and closed with a
sentence it was right to write down: *`Models.tsx` still writes no provider, so
the axis is a shape the runtime honours and the surface cannot yet set.* B1 then
built the seam and repeated it in its own account of what it deliberately did
not do: **give a job row a config target — that is A4's shape and D1's use of
it.**

So D1 arrived owing that, and the plan's own *done when* said so in four words:
**a second lane can be operated.**

It was not operable. `AI Models` drew the whole matrix and wrote three things:
an API key, the account plan, and two Translate settings. Everything else was a
`DrawnSelect` with a `defaultValue`. Specifically:

- The Cloud connection was `<ProviderPick lane="Cloud" selected="Groq" />` — a
  literal, with the chosen chip held in the component's own `useState` and
  written nowhere.
- `CloudCredentialRows` spelled `"groq"` five times: the status it read, the
  plans it resolved, the key it saved, the key it validated, the key it cleared.
- Every job row read its connection from `LANES[lane].provider`, the drawn
  string `"Groq"`.

With one registered vendor none of that was wrong, and that is why it survived
six legs. With two it is three components stating a vendor the runtime is not
using — and one of them would have written an OpenAI key into Groq's
secret-store entry.

## Decision

**The Cloud connection is read from the active profile and written back to it,
and the three places that name a vendor read the same answer.**

`providers.default` on the active profile is the connection.
`resolveConfigJobProvider` reads it, `drawnNameFor` turns the stored id into the
drawn name, and `buildProfileProvidersPatch` writes it — the fourth of the
per-profile patch helpers, beside speech, modes and capture.

**The answer lives on the screen's `Wired` context, not inside `ProviderPick`.**
Three things need it and they are siblings rather than ancestors: the chip row
that sets it, the credential row directly beneath it, and every job row that
says *Follow the connection · X*. Local state was correct while one vendor was
registered, because with one the three could not disagree.

**The runtime id is what is stored, never the drawn name.** `providers.default`
is read by `resolve_entry`, which knows `openai` and has never heard of
`OpenAI`. A drawn name with no id writes nothing at all: a config holding a
value the registry cannot resolve is dropped on load (A4), so the write would
appear to work and then vanish.

**The gallery keeps its own state and reads no config.** `ProviderPick` falls
back to local state wherever there is no connection on the context, which is
what lets the same component be rendered by a registry that passes nothing
(ADR 0055). `GalleryWindow`'s *calls no runtime command on any section* still
passes, and it is the guard.

**The per-job override stays unwritable, and that is a refusal rather than an
omission.** See below.

## Consequences

**A second lane is operable end to end.** Pick OpenAI, add its key, and every
job on that profile resolves to it — the runtime path A4 built and nothing could
reach.

**`npm run port:diff` did not move**, and for this step that is the deliverable
rather than a side effect. The screen reads `structural 6 | style 213 | text 12`
on `models`, exactly where B3 left it. Nothing was drawn: the controls that came
alive are the ones Leg 6 drew and that have been inert since, which is the shape
B5 is named for in the plan and the same one B1 had. **A moved count here would
have been the warning.**

**The credential row clears its draft when the connection changes.** A
half-typed key in the field when the chip row moves would otherwise be offered
for saving to the new vendor, which is how a key reaches an account it was never
issued for.

**The per-job override needs a drawing decision this step refused to take, and
it is recorded rather than settled** (`docs/PROVIDERS.md`, open disagreement 13).
The drawing branches on `data.ts`'s `override` literal: three rows — `upload` to
OpenAI, `translate` and `assistant` to Anthropic — render a provider mark, a
*Use the default* button and an API-key row, and the other five render a *Follow
the connection* select. Making the config drive that branch means one of two
things, and both are decisions:

- If a stored override drives it, a fresh profile has `overrides: {}` and those
  three rows lose the shape the prototype gives them. Three rows change
  structurally at the default state, and `port:diff` says so.
- If the drawn literal keeps driving it, a row whose config carries no override
  displays the drawn vendor while the runtime follows the connection. That is
  the surface claiming a routing that is not stored.

The honest reading is that `override: "OpenAI"` on `upload` is a **drawn product
default** the runtime has no equivalent for — A4 decided a fresh profile
overrides nothing, and the drawing decided three jobs do. Neither is wrong and
they disagree, which is precisely what `docs/PROVIDERS.md`'s open-disagreement
list is for. **An implementation must not settle one quietly**, and wiring the
select was the quiet way to settle this one.

**What this does not touch:** the model axis. A model choice still writes
nowhere (ADR 0042), and the adapter reconciles a foreign vendor's model id onto
its own default (ADR 0126) so that a connection change does not send one lane's
model to another. That reconcile is what makes the connection safe to switch
while the model row is still a drawing.
