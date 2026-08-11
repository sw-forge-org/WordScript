# 0097: Speech gets a second output stream, on a device the user picks

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Extends
[ADR 0010](0010-audio-cues-are-a-synthesised-motif-on-one-persistent-stream.md).

## Context

[ADR 0010](0010-audio-cues-are-a-synthesised-motif-on-one-persistent-stream.md)
decided that audio cues are a synthesised motif on **one persistent output
stream, owned by one thread**, opened once at startup, primed with 40 ms of
silence and kept alive for the process. It did that for reasons that were
measured: a stream opened per cue lost the cue when the device was contended --
which is exactly when the Listen cue fires, while `capture` is opening the cpal
input device -- and a stream that exists for 300 ms cannot carry a remembered
per-application volume in the OS mixer.

`core::sound::engine` opens that stream with
`DeviceSinkBuilder::from_default_device()`, deliberately rather than
`open_default_sink()`, because the latter falls back to arbitrary non-default
devices.

**Two things the runtime does not have are needed by three drawn surfaces.**
The runtime enumerates input devices only -- `list_native_input_devices` has no
counterpart -- and there is one output stream, bound to whatever the OS calls
default. The translation window draws per-language routing to two devices and
says why: on a phone there is one speaker and one screen, so both people share
both; on this machine there are two output devices and two audiences, and they
do not want the same thing. The roadmap already flagged that this reopens
ADR 0010 and that it "needs the ADR rather than a patch."

## Decision

**A second, named output stream exists for speech, and it is not the cue
stream.**

Every rule ADR 0010 set for cues holds unchanged: one persistent cue stream, one
thread that owns it, the 40 ms warm-up, the cpal error callback that marks the
stream dead, discard-and-reopen at most three times a minute, pre-emption that
cuts the outgoing cue in its decay tail.

The speech stream is a second object with a different lifecycle, because a cue
and an utterance are different things:

| | Cue | Utterance |
| --- | --- | --- |
| Length | ~300 ms, never past 900 ms except `Startup` | seconds |
| On a new one arriving | pre-empts the running one | **must not be cut** |
| Device | the OS default | **chosen, and remembered** |

**Pre-emption is the rule that must not be copied.** A cue replaces the running
cue because a stale cue is a lie about state. An utterance replaced mid-sentence
is a sentence the listener did not receive, and on the translation surface it is
the other person's half of the conversation.

**Output devices are enumerated, and selection is by name.**
`list_native_output_devices` mirrors `list_native_input_devices`
(`core/capture.rs`) -- `cpal::default_host()`, `output_devices()`, dedupe by
name, mark the OS default, sort default-first then alphabetically. Selection
follows `select_input_device`: a case-insensitive substring match against the
stored name, falling back to the default when it does not resolve. **A device
name survives a restart and a cpal index does not**, which is the whole reason
the input side stores a name.

**Routing is per machine, not per conversation** (ADR 0064). Which speaker the
room hears and which earpiece you hear are properties of a desk, the same kind
of fact as the overlay's display anchor, so they persist globally and per
language.

**It is drawn inside the translation window, and several of those may stand at
once** (ADR 0064, ADR 0100) -- three webviews sharing no state, drawing one
machine value.
[ADR 0108](0108-a-machine-wide-setting-drawn-on-a-surface-that-stands-more-than-once-needs-an-echo-the-runtime-does-not-have.md)
takes that: the config is the only holder, a write is announced on a channel the
runtime does not have yet, and the card says the scope on itself. Drawing the
routing where the conversation happens stays right; owning it there does not.

**`Silent` is a real setting on that routing and not a broken one.** Reading is
faster than listening and quieter than both, and somebody translating a menu at
the next table wants no sound at all. A routing of `Silent` opens no stream; it
does not open one and mute it.

## Consequences

- **`sound_volume` does not govern the speech stream.** It answers *how loud are
  the cues inside WordScript*, and a spoken translation is not a cue. Whether
  speech gets its own gain or follows the OS per-application volume alone is
  open, and it lands on whichever surface configures speech rather than on
  General.
- **macOS still offers no per-application volume** (ADR 0010, and
  `PLATFORMS.md`). A second stream does not change that and must not be
  presented as if it did.
- **Two streams double the exposure to the failure ADR 0010 handled.** A device
  change or an audio-server restart can freeze or kill a long-lived cpal stream;
  that is currently handled by exclusive thread ownership plus a rate-limited
  reopen. The speech stream needs the same treatment, and its reopen budget is
  its own -- a reopen storm on one stream must not spend the other's.
- **The enumeration is small and the routing is not.** The mirrored command is
  roughly forty lines. Deciding which language plays where, remembering it, and
  surviving a device that disappears between sessions is the actual work.
- **A device that is gone needs a sentence and the drawing has no place for
  one.** `PLATFORMS.md` requires degrading to the default and saying so; the
  drawn selects list two fixed devices and repeat the selected value at the head
  of the list, which is a prototype artifact rather than an enumeration
  (`PROVIDERS.md`, open disagreement 9). That row is a drawing and goes through
  the gallery (ADR 0057, ADR 0108).
- **`docs/PLATFORMS.md` grows an output-device section**, because device naming
  and default-device behaviour differ per OS and this is the first time the
  runtime cares.
- **This record does not decide what speaks.** The voice is a model row on
  `AI Models` (ADR 0042, ADR 0064) and the candidates are surveyed in
  [PROVIDERS.md](../PROVIDERS.md). This is the path the audio takes after
  something has produced it.
