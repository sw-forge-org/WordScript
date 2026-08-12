# 0130: A long recording is a sequence of turns, and the ceiling that binds it is not the upload size

Date: 2026-08-13

Status: Accepted

## Context

The owner asked, on 2026-08-13, how a two-hour meeting is actually transcribed:
live or after the fact, on which provider, chunked or not — and proposed a
concrete scheme, ten-minute recordings started shortly before the previous one
ends, with the overlaps consolidated into one transcript.

**The repository has no answer, and that is a gap rather than a decision nobody
looked up.** `docs/ROADMAP.md`'s *Meeting capture* is a candidate, not
scheduled. Its scope names system-audio capture, echo cancellation, content
protection on the window, a dedicated hotkey and the note states. Two of its
three gates are open. **Transcribing long audio is not mentioned anywhere in
it.** ADR 0107 cut the stream from the recording for conversations and said, in
its own words, that *a conversation has no total-length ceiling from this
constant, and if it needs one it is a different setting with a different name* —
without anyone since saying whether a meeting is that conversation or something
else.

`donors/app/desktop-shells/openwhispr` was read for this, in both directions,
and the two halves point opposite ways.

## Decision

**The donor is not a reference implementation for the file half, because its
answer is a server.** `UploadAudioView.tsx` refuses anything over 25 MB on a
third-party key outright, and its own copy says why: *for files over 25 MB,
OpenWhispr Cloud handles splitting, parallel processing, and reassembly*. The
splitting lives on their backend. WordScript is local-first and
`docs/ROADMAP.md` rules out having one at all, so this path is closed to us and
copying its user-facing shape without its infrastructure would promise something
nothing implements.

**The donor IS the reference for the live half, and its constants are the
decision: segment on silence, not on a clock.**
`src/constants/whisperVad.json` runs Silero VAD at `minSilenceDurationMs: 200`,
`speechPadMs: 100`, `samplesOverlap: 0.5` — half a second — with
`maxSpeechDurationS: 30` as a backstop, and
`whisperVadConfig.js:resolveContextSileroEnabled` carries `dictation`,
`noteRecording` and **`meeting`** as three separate contexts.

**So the proposed ten-minute windows are refused, and the reason is this repo's
own failure history.** A fixed window cuts mid-word and needs a stitcher to
reconcile the overlap; a stitcher duplicates or drops words at every seam. That
is *fluent, grammatical, plausible and wrong* — the exact class
`docs/known-issues/` collects and the core-hardening track exists to
instrument. A seam-stitcher is a machine for manufacturing that defect once per
seam, hundreds of times in a two-hour meeting. **Cutting on silence leaves
nothing to stitch.** The clock survives only as a ceiling for a speaker who
never pauses, which is what `max_samples` already is once C1 makes it a turn
ceiling.

**A meeting is therefore C1, not a second capture path.** ADR 0107 already
decided the shape — *a turn is a recording, the stream is not* — and every
instrument keeps applying per turn: `transcribe_audio_file` unchanged,
`CaptureIntegrity` one verdict per turn, `capture_budget` one ceiling per turn,
`sessions::is_processing_session_current` guarding late results. The note is the
concatenation of the turns. **A meeting needs C1 and system audio; it does not
need a chunker.**

**And the ceiling that actually binds a two-hour meeting is not the upload
size.** Three limits were found, and the upload size is the least of them:

1. **The lane must stream, and the default one does not.**
   `shared/model_catalogue.json` records Groq speech as `streaming:
   "unsupported"` with the note *batch only: one file in, one result out, no
   websocket and no `stream=true`*. Live transcription during a meeting is
   impossible on the connection this product ships with. It needs D2 and a lane
   that streams. **Nothing on any surface or in the roadmap says this.**
2. **The notes pass over the finished transcript hits a context window.** Two
   hours of speech is roughly twenty thousand words. That is a ceiling on the
   *chat* job, expressed in tokens, and it is the one genuinely new limit a
   meeting introduces — `capture_budget` bounds audio and has nothing to say
   about it. No structure in this repo records a model's context window today;
   `ModelCapabilities` does not carry one and the catalogue has no column for
   it.
3. **The per-turn request count.** ADR 0107 already priced this from the donor's
   `cloudChunkPolicy.js` — *an hour at a table is hundreds [of requests], on the
   same uplink as whatever else* — and adopted the global in-flight ceiling that
   answers it. That one is decided; it is named here so it is not rediscovered.

## Consequences

**Two steps, and they are not the same step.** The capture half is C1, already
sequenced. The two ceilings above are new: the streaming requirement is D2's
consequence and needs saying on a surface, and the context-window ceiling has no
home at all and is filed as its own plan entry (C4).

**A model's context window becomes a catalogue question.** It is the same shape
as `streaming` — something a vendor documents, per model, with a source and a
read-date — so it belongs in `shared/model_catalogue.json` beside it rather than
in `ModelCapabilities`, which records what an adapter asserts (ADR 0115's
distinction, restated here because this is the second time it decides where a
field lives). That is a `CATALOGUE_VERSION` bump when it lands.

**`docs/ROADMAP.md`'s meeting chapter gains what it never had**: a sentence that
transcription of the recording is C1's turns rather than a chunker, and the two
ceilings as open items beside its existing gates. The phase list stays there and
is not copied here (ADR 0123).

**What this does not decide:** whether a meeting is live-transcribed at all.
That is a product question with a real cost — it forces a streaming lane and
therefore a second credential for anyone on Groq — and it is the owner's. This
record only establishes that the current default cannot do it and that no
surface says so.

**Nor does it decide retention.** ROADMAP gate 2 — *what happens to the audio of
a meeting nobody keeps* — stays open and is untouched; ADR 0038 and ADR 0039
bound a dictation's audio and an hour of meeting is a different promise.
