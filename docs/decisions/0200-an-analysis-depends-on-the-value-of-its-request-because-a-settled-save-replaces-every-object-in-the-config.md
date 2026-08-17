# 0200: An analysis depends on the value of its request, because a settled save replaces every object in the config

Date: 2026-08-17
Status: Accepted. Follows
[ADR 0198](0198-the-toggle-outranks-the-breakpoint-until-the-window-crosses-it-and-the-column-beside-the-sidebar-is-laid-out-once.md),
which fixed the layout half of the same report.

## Context

ADR 0198 took the per-frame relayout out of the sidebar's rail transition, and
the owner confirmed the same hour that every view was smooth **except one**:

> the Profiles tab still judders extremely. Oddly it is the only one where it
> does.

So whatever was left was not the sidebar. It was Profiles.

**Two commands on that screen are analyses**, and both were keyed on object
identity:

```js
}, [runtime.active, profile?.id, profile?.prompt, profile?.dictionary_entries,
    profile?.work_mode, acknowledged]);                       // get_profile_health
}, [runtime.active, profile?.id, profile?.prompt, profile?.stt_hints,
    profile?.vocabulary_hints, profile?.dictionary_entries,
    profile?.snippet_entries, profile?.work_mode, …]);         // analyze_text_rules
```

**A settled save replaces every object in the config.** `useConfigDraft` adopts
the config `save_config` answers with — deliberately, and ADR 0125 gives the
reason — and that answer arrives over the IPC as JSON. What comes back is a
fresh parse: `dictionary_entries` is a new array holding equal entries, not the
array that went out. Every one of those dependencies therefore changed on every
discrete write on the window, whether or not any value did.

**The sidebar's rail toggle is such a write.** Measured with the save mocked as
what the IPC actually is — a JSON round trip — one toggle costs:

| Active view | Analysis round trips per rail toggle |
| --- | --- |
| Home | 0 |
| Profiles | 2 (`get_profile_health`, `analyze_text_rules`) |

Two Rust analyses, their answers, and the two React commits that follow them —
`setHealth` and `setAnalysis` each re-render a 2 100-line screen — all landing
inside the 180 ms the column is sliding. The count is a floor rather than a
figure: the runtime also emits a `ready` carrying the same config on its own
channel, and that is a second full replacement of the graph.

That is why Profiles was the only view. Home and History ask the runtime
nothing on a config write; Context and the settings sheet hold no analysis.
`analyze_communication_style`, two cards further down the same screen, was
already keyed on four strings and never re-fired — it is the shape the other
two should have had.

The screen also already carried the right pattern one block up, for the same
reason, in `useCaptureBudget`:

```js
`${dictationProvider}:${config.provider_plans?.[dictationProvider] ?? ""}:${config.local_model}`
```

with the comment *"the vendor in the key must refresh, and nothing else may."*

## Decision

**Both analyses take the serialized request as their dependency**, and send it
back parsed:

```js
const healthRequest = profile ? JSON.stringify({ …the request… }) : null;
useEffect(() => {
  …
  void invoke("get_profile_health", { request: JSON.parse(healthRequest) });
}, [runtime.active, healthRequest]);
```

The request is built on every render, which is a `JSON.stringify` of a few
kilobytes — microseconds, against an IPC round trip and a Rust analysis it
prevents. An edit that changes what is graded still re-grades on the keystroke,
because the analyses are deliberately not debounced (`analyze_text_rules` is a
pure function of its request and a meter that lags the field it describes is the
defect it exists against).

**The identity is not the fact. The request is.** A dependency array states what
an effect is a function of, and for a command that costs a round trip the honest
statement is the value it will send — not the reference that happens to hold it
this render.

## Consequences

**A rail toggle in Profiles now costs zero round trips**, measured the same way
it was measured before the change.

**Two cases in `Profiles.test.tsx` hold it**, and the simulation matters: the
rerender passes a *deep clone* of the same config, because that is the only
shape in which the defect exists. A rerender with the same object passed before
the fix and proves nothing.

**What this does not change** is that Profiles still re-renders on every config
write — three commits per toggle, from `setRailed`, the draft's patch and the
save's settle. That is React reconciliation of one tree rather than two Rust
analyses and four commits, and it is left alone: collapsing it would mean
teaching `useConfigDraft` to skip an adoption whose config is deep-equal to the
form, which is the seam ADR 0125 tuned and not a place to go without a
measurement that asks for it.

**The pattern is general and this file is the second to need it.** Any effect
that reaches the runtime and watches a config object is the same defect waiting;
the config graph is replaced wholesale on every save, so identity says nothing
about value there.
