# 0201: A chord with a key is finished when the keys come up, and an empty slot is a value you can choose

Date: 2026-08-17
Status: Accepted. Owner report of 2026-08-17: assigning a hotkey takes two
presses, does not always register, and there is no way to remove one without
replacing it. Narrows T1 from
[`../known-issues/capture-shortcut-recording.md`](../known-issues/capture-shortcut-recording.md)
and gives T7 the affordance it never had. Does not touch
[ADR 0006](0006-rust-owns-the-shortcut-contract.md) — every rule below is still
the runtime's answer, read rather than re-derived.

## Context

Three things stood between a user and a shortcut, and only the first was ever
written down as a decision.

**The click that opened the recorder did not start it.** `Hotkeys.tsx` swapped
the row's `HotkeyButton` for a `HotkeyRecorder`, and the recorder mounted idle:
it began listening on a click of its own. The two states are a pill of key caps
in a bordered box either way, so nothing on screen said which one was in front
of you. The first click bought a widget that looks like it is listening, the
keys pressed into it went nowhere, and the second click started the recording
that the first one appeared to. Reported, accurately, as "I have to press twice
and it does not always register."

**Then it wanted a third gesture.** T1 made recording an explicitly ended state:
`Enter`, the check mark, `Escape` or a timeout, never a key release. That rule
was earned — D1 was a recorder that finalized as soon as the held set emptied,
so tapping `Ctrl` wrote `ctrl_l` and closed, which is why no further key could
be added. But T1 was written as one rule for every chord, and it charged every
assignment a keystroke to pay for a hazard only one shape of chord has.

**And nothing could be emptied.** T7 says an empty shortcut disables that
binding, `core::shortcut::parse` returns `Disabled` for it, `normalize_for_storage`
leaves it empty rather than reviving a default, and `validate_hotkey_collisions`
skips it. The whole contract was in place. The Hotkeys screen's own header
comment said "every row may be emptied". There was no control anywhere that did
it. The only way out of a shortcut was another shortcut.

## Decision

**The click that opens a recorder is the click that starts it.** `HotkeyRecorder`
takes `autoStart`, and a caller that has already spent the user's click getting
there must set it. The pill takes focus at the same moment, so `Escape` and the
blur-cancel behave the way they read.

**A chord that carries a non-modifier key is committed when the last key comes
up.** No confirmation, no second gesture. `Ctrl+Shift+D` is finished by
construction the moment the keys are released — there is nothing it could still
become.

**A modifier-only chord is not, and still waits.** This is where D1 actually
lives: `Ctrl` is a prefix of everything the user might still be reaching for, so
a release edge cannot tell a finished chord from an unfinished one. It stays on
screen for `Enter` or the check mark, and the hint says so in those words rather
than in general ones.

**Two more cases hold back, for the same reason and not by analogy:**

- **A shortcut the runtime attached a warning to.** A bare function key is a
  desktop-wide grab; the runtime accepts it and says so. A sentence worth
  printing is a sentence worth reading before the value is written, so the
  warning is shown and `Enter` keeps it.
- **A combination another slot already owns.** The collision is stated and the
  recorder stays open, because the user's next act is to press something else.

**`Backspace` and `Delete` clear the slot**, on the same footing as `Enter`
confirms and `Escape` cancels: only while no modifier is held, so `Ctrl+Backspace`
stays recordable — the rule D8 established for `Escape`, applied to the keys that
joined it.

**Every bound row carries a clear button.** It is offered for a value, never as
a permanent column: a slot with nothing in it has nothing to clear, and the mode
rows ship empty. Clearing writes `""`, which the runtime already reads as
`Disabled` and the badge column already renders as `Disabled`.

**A press with nothing else held starts a fresh chord.** "The largest chord
wins" is a rule about ONE grip. Across two grips the older one is a leftover,
and after a rejected chord it is a leftover the user is in the middle of
replacing — without this, a second attempt inherits the first attempt's key.

**The timeout is re-armed on every key event** instead of running from the
start. Ten seconds from the first click is a budget for deciding, not one for
pressing keys.

**A duplicated release commits once.** The S0 measurement recorded X11
delivering two and four release edges for a single hold, so the second one is
measured rather than hypothetical. Validation is asynchronous, so the guard is a
flag rather than the closed recorder.

**The config says whether a slot is bound; the binding only says how it is
spelled.** `patch` updates the config the moment it is called and
`native_trigger_status` lags it by a save and a re-registration, so a binding
read while drawing routinely describes the PREVIOUS value. The row preferred
that display over the stored value, which produced both halves of the second
report on the same day:

- **A saved shortcut was drawn as the old one.** Set `Alt+F8` over `Ctrl+Super`
  and the caps said `Ctrl+Super` until a refresh landed. Indistinguishable from
  a save that did not happen, so it gets done again — "I have to do it twice",
  a second time and for a different reason than the first.
- **A cleared shortcut was drawn as still bound.** The clear button vanished
  (the config was empty, correctly) and its caps stayed (the binding was not),
  so the slot read as bound and unclearable at once.

`ShortcutBindingInfo::configured` is the canonical value the runtime built that
binding FOR, so `configured === stored` is the whole test for whether an answer
is about this value. It gates the caps, the recorder's `display` and the badge —
which now says `Not checked` rather than reporting a registration of something
else. It does NOT gate `error`: that is a report about a registration attempt
rather than a claim about the current value, and hiding the runtime's only
explanation because the config moved first would lose the one sentence worth
reading. The refresh effect also watches all eleven fields instead of the three
capture ones, so a mode row is not left holding an answer about what it used to
be bound to.

**The recorder has no buttons.** A check mark and a cross beside a pill that
already commits on release are two controls for gestures the widget performs by
itself. The keys you are touching are the whole interaction — let go to set,
`Escape` to cancel, `Backspace` to clear, `Enter` for the one chord the release
edge cannot finish — and the hint under the pill is one short line instead of
two sentences of instructions.

**Setting a shortcut is ONE interaction, and the component boundary is drawn
around all of it.** `ShortcutField` owns the caps, the clear button, the
stored-value resolution and the recorder behind them; `HotkeyRecorder` stays
what it always was, the chord machine. The boundary moved because the recorder
was shared and the three things around it were not — and each of those three was
a defect the first time it was written. A second surface assembling them from
parts would get to rediscover all three, which is an argument about where the
boundary belongs rather than about how much code is duplicated.

**Recording is controlled where several slots sit together and uncontrolled
where one does.** Hotkeys holds the single open slot across eleven rows, because
the recorder's blur-cancel cannot guarantee exclusivity on its own: a pill that
never took focus never blurs. Onboarding has one and does not need it.

**The onboarding hotkey step uses that control, not a drawing of it.** It was
three dead `HotkeyButton`s with `Ctrl+Super` hardcoded into each. The step now
sets a real value and the two later steps that recite it — "press it" and the
summary — read the value that was set, including when it was deliberately
emptied. The value stays local, like every other answer in that flow, which is
what the screen's `PreviewBanner` already says about all of it. What is NOT
local is the workflow: pressing a key to bind one behaves identically in both
places, because it is the same control.

The registration row beside it gained a `PreviewTag`. It reads `Accepted` and
nothing has registered anything — tolerable while the whole step was a drawing,
a fresh false claim once the control above it became real.

## Consequences

- **T1 is narrowed, not withdrawn.** "Recording never ends on a key release"
  becomes "recording never ends on a key release the user could still be
  building on". The D1 regression test stays, testing the case D1 was about.
- **The hint text now depends on the chord.** It says "it is set when you let
  go" while a chord is buildable and "add a key, or press Enter to use these
  modifiers on their own" once the chord is modifiers only, because the one
  chord the release edge cannot finish is the one that needs the sentence.
- **`ariaLabel` no longer replaces the recorder's state.** A caller's label is
  the slot's name and the widget says what it is doing with it, so a recorder
  that is listening announces itself as one that is.
- **A user can now end up with no capture trigger at all.** That is the point of
  T7 and the badge already has the word for it. Nothing re-fills the slot.
- **The onboarding hotkey step now performs the same interaction**, rather than
  inheriting it whenever the flow is wired. The step is still a drawing in every
  other respect — `PreviewBanner`, "Planned for Phase 6", no config write, no
  registration — and that is the point of the split: the WORKFLOW is shared
  code, the plumbing behind it is the part that is unbuilt.
- **A third surface that offers a shortcut has one thing to reach for.** If it
  writes config it passes `binding` and a `patch`; if it does not, it passes a
  `useState`. Neither can reintroduce the double click, the stale display or the
  missing clear.

## Alternatives rejected

**Commit every valid chord on release, modifier-only included.** One rule, no
exceptions, and it reintroduces D1 exactly: a session that reports interruption
accepts a single `Shift`, so tapping `Ctrl` on the way to `Ctrl+Shift+D` would
write `Ctrl` and close the recorder before the rest of the chord existed.

**Keep the confirmation and fix only the double click.** Two gestures instead of
three. It leaves the confirmation charged on every assignment to insure against
a chord that cannot occur — and the owner's report was about the cost, not only
about the count.

**A short idle timer after the last release.** Commits when nothing has happened
for ~500 ms, which would cover modifier-only chords too. Rejected: it makes the
commit depend on how fast the user moves, which is unstateable in a hint and
unobservable in a test.

**A trash icon on the row instead of a clear button on the value.** Deleting is
the wrong verb — nothing is destroyed, a binding is switched off, and the state
it produces is one the badge column already names.

**Waiting for `native_trigger_status` to catch up instead of resolving the
binding against the stored value.** It would fix the two symptoms above by
making the row briefly show nothing rather than something wrong, and it makes
correctness depend on a round trip finishing before the user looks. The config
is already the authority on what is bound; the binding was never anything but
its spelling.
