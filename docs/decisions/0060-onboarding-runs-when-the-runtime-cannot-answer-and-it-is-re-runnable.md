# 0060: Onboarding runs when the runtime cannot answer, and it is re-runnable

Date: 2026-08-05
Status: Accepted (planning direction; not implemented)

## Context

The onboarding flow is drawn in full — seven steps, the rail, the foot, the
preflights — and stands in `/gallery` → Screens. What was never decided is its
lifecycle: **when it runs, whether it can be left, what a quit at step 4 leaves
behind, and which window it is.**

That gap is the subject of relay Leg 4a and is why the screen is mounted
nowhere. A drawn flow with an undecided entry point is the one thing that looks
finished and is not, and it cannot be caught by measuring: the prototype is
static HTML and is equally silent about it.

Three facts constrain the answer and were established elsewhere:

- **The product is one window** (Leg 3, ADR 0054). A workspace with four views
  and settings as a sheet over it. There is no second window to open a flow in,
  and adding one would contradict the shape the shell overwrite just landed.
- **Every setting applies as it is made.** The prototype's own sheet foot says
  so, and the shipped behaviour is instant-save. A wizard that batches its
  writes to a final Finish button would be the only surface in the product that
  does not.
- **Every step of the flow states a runtime fact rather than a preference.**
  Microphone permission and device, the connection and its verified credential,
  the registered hotkey, the resolved insert driver — each is something the
  runtime either has or has not. Steps 1, 6 and 7 are the exceptions and are
  discussed below.

Phase 6 (Guided Setup and Packaging) is where this is built. Its success
measure is *"an installer-to-first-dictation path works without asking a new
user to discover Diagnostics first."*

## Decision

**Onboarding is a routing branch in this window, ahead of the workspace.** Not
its own window. `App.tsx` — or the workspace window's own first branch — renders
the flow instead of the workspace, at the workspace's scale, with the same
native decoration the window already has (ADR 0003). Nothing about the window is
different while the flow is on it.

**It runs automatically on launch when two things are true at once:** the
runtime cannot report a usable connection, **and** the flow has not previously
been completed or closed. The second condition is one timestamp in the config;
without it a user who deliberately runs unconfigured meets a wall on every
launch.

**It is re-runnable from `Settings → General`**, as one row. The Settings row
runs it regardless of both conditions above.

**It holds no state of its own, and the resume point is derived rather than
stored.** The flow opens on the first step whose precondition the runtime does
not yet satisfy:

| Step | Satisfied when |
| --- | --- |
| Welcome | always — it is a statement, not a check |
| Microphone | permission granted and a device resolves |
| AI Models | a lane is chosen and its credential verifies, or a local model is installed |
| Hotkey | a combination is registered and the OS accepted it |
| Insert | the session type and its driver resolve, including the clipboard-only answer |
| Try it | at least one transcription has completed on this machine |
| Done | always — it is a summary |

This is what makes the flow idempotent against a machine that is already half
configured, and it is the same rule the rest of the product follows: **show
runtime truth, and when the runtime is not ready, show the next action.** A
stored step index would be a second source for a fact the runtime already has,
which is ADR 0024's failure one surface over.

**There is no Skip control on steps 1–5, and this is not an oversight.**
Everything in those steps is a precondition for a first dictation; everything
with a working default was deliberately kept out of the flow and is listed on
the last step. The one skip that exists is the drawn `Skip the proof` on *Try
it*, because proving it is the only step that demonstrates rather than
configures.

**The window's own close is the exit, and it is always available.** Native
decorations are on every OS (ADR 0003), so the flow can always be left; it does
not need a button that repeats what the title bar already offers. Closing writes
the dismissal timestamp.

**A quit at step 4 leaves steps 1–3 applied**, because they applied when they
were made. The next launch shows the workspace. `Settings → General` resumes at
step 4, because step 4 is still the first unsatisfied one.

## Consequences

- **One config field is added:** the timestamp at which the flow was completed
  or closed. It is a `src-tauri/` contract and belongs to Leg 5; naming it here
  is the deliverable, writing it is not. Nothing else about the flow is
  persisted.
- **`OnboardingScreen` needs its step lifted.** It holds `useState(0)` today.
  The host has to seed the index from the first-unsatisfied step and be told
  when it moves, so `step` / `onStep` become props. This is written down for
  Leg 4 rather than built here.
- **Every step needs its precondition as a prop.** The drawn `Granted`,
  `Verified`, `Accepted` and `tier 1` badges are sample data, and a flow that
  states a permission the OS did not grant is the fake-readiness failure at the
  worst possible moment. Until a step reads the runtime it keeps the
  `PreviewBanner` the screen already carries.
- **Two steps are cheap and five are not.** Onboarding's `Registration:
  Accepted` and its insert check are the preflights the runtime already has
  (relay §2.5); the microphone, the connection, the local model install and the
  first-dictation proof are the expensive half.
- **Auto-run has a failure mode worth naming:** a user on the Local lane with a
  4 GB download unfinished has no usable connection and has not closed the
  flow, so it re-runs. That is correct — the product cannot dictate — and the
  flow resumes on AI Models, which is where the download is.
- **The Settings row is a door that opens something**, which is what makes it
  mountable at all (rule 7). It is the only new affordance this record adds, and
  it is one row in a section that exists.
- This record decides the lifecycle only. It changes no step, no copy and no
  layout: the drawing stands as ported.
