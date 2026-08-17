# Kick-off — a profile carries its whole connection (speech track, B14)

Paste this into a fresh session. It is orientation only: **the brief is
[`speech-track-plan.md`](speech-track-plan.md) § B14** and this page does not
restate it (ADR 0123).

Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. Other tracks run concurrently — read
**Sharing `main`** in [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) before your
first commit, stage your own paths by name, and grep the tree for the next free
ADR number rather than trusting any line that names one.

## What you are finishing

WordScript's profiles are how one person keeps two working lives apart — an
employer's and a private one. Since ADR 0094 a profile decides **which vendor**
each job runs on, and since ADR 0203, 0206 and 0207 it decides **which model**
each of those jobs uses. The owner confirmed on 2026-08-17 that the rest belongs
there too, and said why:

> Ja, das muss wirklich pro Profil sein. Das ist ja auch ein großer Nutzen der
> Profile dann letztendlich, wenn das gut umgesetzt ist.

What is still machine-wide is the part that makes a lane *usable*: the server
you type a URL into, and the credential that pays for the call. So a profile can
switch from Cloud to Your Server today and cannot bring its own server or its own
account with it. **That is the step.**

## Read before you touch anything

1. **[`speech-track-plan.md`](speech-track-plan.md) § B14** — the brief: the
   inventory of what is machine-wide, **what must not move and why**, the two
   candidate shapes, and what validates the step.
2. **ADR 0094** (the axis and its argument), **ADR 0207** (the same decision one
   layer up, and the reason the controls did not move), **ADR 0167** (a plan
   belongs to the credential that bought it), **ADR 0165** (why the self-hosted
   lane has a model field of its own), **ADR 0067** (a lane that is offered must
   be operable), **ADR 0112** (this machine's stored state is disposable, so a
   migration may drop rather than rescue).
3. `src-tauri/src/core/providers/credential_store.rs` — the entry-user shape
   `{provider}.{role}.{kind}`, and the doc comment explaining why the vendor is
   in the user half and not the service half. Your change lands there.
4. `docs/PROVIDERS.md` and `docs/ARCHITECTURE.md` for where the seam is drawn.

## The one thing that is not yours to decide alone

**A or B** — the profile carries the connection, or a connection is an object
profiles point at. B14 states both and their trade-off. Work it out, come back
with a **recommendation and the two-line reason**, and get the owner's answer
before building. The rest of the step is yours.

Everything else in this repo says the same thing about that habit: measure or
read before you change, and write the derivation down where the next reader
finds it rather than in a commit message.

## How you are measured

- **Nothing may become fake-operable.** A per-profile endpoint over a
  machine-wide credential is worse than today, because the surface would claim a
  switch the runtime cannot make (ADR 0067).
- **A profile switch must move the credential**, and a test must say so. That
  sentence is the step; nothing checks it today.
- **The edge holds.** The hardware, the disk, the keyboard and the window belong
  to the machine. If your diff moves the audio device or the model folders into a
  profile, the edge was not read.
- **The migration may drop, not rescue** (ADR 0112), and it says in the ADR what
  it drops.
- **An ADR records the shape**, and `PROVIDERS.md`, `ARCHITECTURE.md` and
  `spec/SPEC.md` are checked for drift when the seam moves (`spec-sync`).

## Checks

```text
cd src-tauri && cargo test     # 927 passing, 6 ignored, at 04e87ba
npm test                       # 836 passing across 52 files at 04e87ba
npm run build
npx tsc --noEmit
```

Both totals move under you because other tracks add tests; check the number
against `git log` rather than reading a mismatch as damage. Run the suites
serially — running two at once has reported a green tree as broken in this repo
before. For anything shell-, window- or Tauri-bound, check in the native host
rather than browser preview; a `npm run tauri dev` host is usually already
running.

## Not this step

The Models surface's other open work (the lane lock, Onboarding's hardware
claims), anything in the core-hardening cluster, and the chat-model resolution
that ADR 0207 just landed. If you find a defect in that resolution, it is a
record and a fix of its own, not a fold-in.
