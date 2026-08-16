import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Card,
  HeroFacts,
  HeroInvoke,
  HomeDisplay,
  HomeOpen,
  Icon,
  IconButton,
  Keycaps,
  ListRows,
  Owed,
  OwedList,
  PreviewTag,
  SectionHeader,
  StatTile,
  TranscriptRow,
} from "@/components/shell";
import { useTranscriptionHistory } from "@/hooks/useTranscriptionHistory";
import { PROCESSING_MODE_LABELS } from "@/lib/transformRules";
import { TYPING_BASELINE_WPM, timeSavedMinutes, wordsPerMinute } from "@/lib/activity";
import { relativeTime } from "@/lib/format";
import { readTriggerStatus } from "@/lib/shortcuts";
import {
  displayTextProfileLabel,
  resolveActiveTextProfile,
  resolveTextProfileWorkMode,
} from "@/lib/textProfiles";
import type { ProcessingMode } from "@/types/ipc";
import { badgesFor, rawOf as rawOfEntry, retryDisabledReason, titleOf } from "./History";
import { DESK_CAP, RECENT, rawOf } from "./data";
import type { PartlyWiredScreenProps } from "./props";

/**
 * HOME — `SCREENS.home`, WIRED IN PART.
 *
 * Home is the dictation record, not a dashboard. The first build opened on a
 * "Ready to dictate" hero with a Capture button, and nothing can press that
 * button into a recording: dictation starts with the global hotkey, in whatever
 * app has focus, and this window is usually not that app.
 *
 * Three blocks: the hero, the decision inbox, the record. The mode row and the
 * lane/model/target row that stood between them are gone — the first moved into
 * the hero's foot, the second to the window's bottom edge, where it is readable
 * from every view instead of only from this one.
 *
 * THE OPENING BLOCK HAS TWO LIVES, AND THE SWITCH IS WHETHER IT HAS ANYTHING TO
 * SAY. An instruction is read exactly once, so the keycaps give the position up
 * as soon as the runtime has measured a dictation, and the counters take it. The
 * gate is `wordsPerMinute` rather than a count of records, and that is deliberate
 * in both directions: a fresh profile sees the instruction rather than four
 * zeroes, and a profile whose records all predate the capture measurement sees it
 * too, because a display with nothing to display is the same defect wearing a
 * different face. One rule — the display appears when it has a reading — and the
 * gallery falls out of it rather than being special-cased: no runtime, no
 * records, no readings, so the gallery draws the instruction.
 *
 * THE HERO'S SENTENCE IS THE ACTIVATION MODE'S, not the drawing's. "Hold in any
 * app to dictate / Release to stop" is true of exactly one of the three modes
 * `activation_mode` takes, and the shipped default is `tap`. So the drawing is
 * kept verbatim as the `hold` member and the other two are their own sentences
 * — the same shape as General's device hint. The keys are the runtime's
 * resolved display of `config.hotkey`, never the raw token (T9).
 *
 * THE DECISION INBOX HAS ONE OF ITS THREE SOURCES (ADR 0076). A delivery that
 * fell back to the clipboard or to the scratchpad is a question the record
 * already answers every part of — what was said, when, why the paste did not
 * land, and whether the text can still be placed — so the product draws it, and
 * draws NOTHING when no such record is standing. That is the drawing's own
 * rule: *"Nothing is drawn here when nothing is owed; a standing all-clear is
 * furniture."* On a machine that has not had a failed insert this section is
 * simply not there, which is the rule working rather than a screen half-built.
 *
 * The other two sources have no receiver and cannot get one here: the desk does
 * not exist (Phase 8) and no meeting produces an open question (V2). That is
 * what this screen's banner still states, and why it keeps its gallery entry.
 * Inventing either would be the worst instance of rule 7 on the whole surface —
 * an invented QUESTION rather than an invented label.
 */

const RECENT_LIMIT = 5;

function heroCopy(mode: string): { title: string; description: string } {
  if (mode === "hold") {
    return {
      title: "Hold in any app to dictate",
      description: "Release to stop. What it produces goes to the cursor you left.",
    };
  }
  if (mode === "double_tap") {
    return {
      title: "Double tap in any app to dictate",
      description: "Double tap again to stop. What it produces goes to the cursor you left.",
    };
  }
  return {
    title: "Press in any app to dictate",
    description: "Press again to stop. What it produces goes to the cursor you left.",
  };
}

/** The gesture, as one word for the fact line. `heroCopy` writes the same three
 *  modes as a sentence; this is the verb out of it. */
function invokeVerb(mode: string): string {
  if (mode === "hold") return "Hold";
  if (mode === "double_tap") return "Double tap";
  return "Press";
}

/**
 * The runtime's resolved display, normalised for `Keycaps`.
 *
 * The trigger status spells a chord `Ctrl + Super` and `config.hotkey` spells the
 * same chord `Ctrl+Super`; `Keycaps` splits on `+` and would otherwise draw a cap
 * with a space inside it. Splitting and trimming reads both spellings and keeps
 * no key table of its own — the runtime remains the authority on what a chord is
 * called (T9).
 */
function keycapCombo(display: string): string {
  return display
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("+");
}

export function HomeScreen({ banner, runtime }: PartlyWiredScreenProps = {}) {
  const [openRaw, setOpenRaw] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<string | null>(null);
  const [effectiveMode, setEffectiveMode] = useState<ProcessingMode | null>(null);
  const { entries, remove, retry, reveal, acknowledgeFallback } = useTranscriptionHistory(
    Boolean(runtime?.active),
  );

  useEffect(() => {
    if (!runtime?.active) return;
    let cancelled = false;
    void readTriggerStatus()
      .then((status) => {
        if (cancelled) return;
        const capture = status.bindings.find((binding) => binding.label === "capture");
        setTrigger(capture?.display ?? null);
      })
      .catch(() => {
        if (!cancelled) setTrigger(null);
      });
    /* Which mode is effective RIGHT NOW is runtime truth, and this screen is
       where the product says so (AI Models' closing note points here). The
       router resolves it from the active profile, so it is not the same read as
       "which mode this profile defaults to". */
    void invoke<{ mode: ProcessingMode }>("resolve_current_processing_mode")
      .then((context) => {
        if (!cancelled) setEffectiveMode(context?.mode ?? null);
      })
      .catch(() => {
        if (!cancelled) setEffectiveMode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [runtime?.active, runtime?.config.hotkey, runtime?.config.active_text_profile_id]);

  const profile = runtime ? resolveActiveTextProfile(runtime.config) : null;
  const profileMode = profile ? resolveTextProfileWorkMode(profile).processing_mode : undefined;
  const activation = runtime?.config.activation_mode ?? "hold";
  const copy = heroCopy(activation);

  /* THE TWO READINGS THE RECORD CAN ALREADY GIVE, derived in `lib/activity` and
     never here — a rate is the thing this screen is most able to get quietly
     wrong, so it is computed in one tested place and this file only renders it.
     Both are `null` when nothing was measured, which is what the display gates
     on and what the counter draws as a dark box rather than as a zero. */
  const wpm = runtime ? wordsPerMinute(entries) : null;
  const saved = runtime ? timeSavedMinutes(entries) : null;
  const display = wpm !== null;

  /* THE ONE SOURCE OF ADR 0044'S THREE THAT HAS A RECEIVER (ADR 0076). A
     delivery that fell back to the clipboard or to the scratchpad is a
     question — the text did not go where it was meant to and something has to
     be done about it — and the record already carries every fact the card
     needs. The other two sources are the desk (Phase 8) and a meeting's open
     questions (V2), and neither exists to be received.

     Ordered newest first, which is also ADR 0044's own order: the cost column
     is "what happens if you do nothing", and for this source that cost grows
     with every clipboard write, so the most recent is the most recoverable. */
  const owed = runtime
    ? entries.filter(
        (entry) =>
          !entry.fallback_acknowledged &&
          (entry.insert_mode === "clipboard_fallback" ||
            entry.insert_mode === "scratchpad_fallback"),
      )
    : [];

  const rows = runtime
    ? entries.slice(0, RECENT_LIMIT).map((entry) => {
        const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
        return {
          id: entry.id,
          /* HISTORY'S DERIVATION, NOT A SECOND ONE (ADR 0078). Home lists the
             same records on the same builder, so a row here opens with what the
             record is CALLED, exactly as it does one screen over — a recent
             list whose five rows each start mid-sentence is the same unscannable
             thing as a long one, at a size where it is more obvious.

             No segment, and that is the difference rather than an omission:
             History's `Written` / `Heard` exists for scanning many records to
             judge transcription accuracy, and five rows of the last few minutes
             is not that surface. What Home shows is the one reading a record
             answers to. */
          title: titleOf(entry, "title"),
          meta: [
            relativeTime(entry.created_at_ms),
            PROCESSING_MODE_LABELS[entry.work_mode?.processing_mode ?? "auto"],
            entry.active_profile ?? "No profile recorded",
          ],
          badges: badgesFor(entry),
          /* History's builder, not a second one. Home lists the same record and
             the foot has to make the same claim about it. */
          raw: rawOfEntry(entry),
          /* History's rule, not a second one: a record with a raw transcript
             re-runs its transform and needs no capture (ADR 0075). */
          retryDisabledReason: retryDisabledReason(entry),
          restorable:
            entry.insert_mode === "clipboard_only" ||
            entry.insert_mode === "clipboard_fallback" ||
            entry.insert_mode === "scratchpad_fallback",
          /* The record's own file (ADR 0074), so the sixth control acts here
             for the same reason the other five do. */
          transcriptPath: entry.transcript_path,
          /* The same six commands History's rows call. Home lists the same
             record on the same builder, so it acts the same way — one builder
             was the point of `TranscriptRow` existing. */
          copy: () => void navigator.clipboard.writeText(text),
          revealFile: () => void reveal(entry.transcript_path),
          retry: () => void retry(entry.id),
          remove: () => void remove(entry.id),
          restore: () =>
            void invoke("insert_text_native", {
              request: { text, source: "history_restore", corrected: entry.corrected },
            }),
        };
      })
    : RECENT.map((entry) => ({
        id: entry.id,
        title: entry.text,
        meta: [entry.at, entry.mode, entry.profile],
        badges: entry.badges,
        raw: rawOf(entry),
        retryDisabledReason: entry.audio === false ? "Retry — no transcript and no recording left to re-run" : undefined,
        restorable: Boolean(entry.restore),
        copy: undefined,
        retry: undefined,
        remove: undefined,
        restore: undefined,
      }));

  return (
    <>
      {/* Home is the one view with no `ViewTop` — what it owes you on landing
          is not its own name — so the banner sits above the hero rather than
          inside a masthead it does not have. */}
      {banner}
      <HomeOpen>
        {display ? (
          <HomeDisplay>
            {/* WORDS PER MINUTE. Words from the record, seconds from the
                capture's own clock — and the foot names the two counts, because
                `capture_integrity` is null on a retry and on every record older
                than the measurement. A rate over a denominator that silently
                skipped half the records is a plausible wrong number, which is a
                worse failure than a missing one. */}
            <StatTile
              label="Words per minute"
              value={wpm!.value}
              ariaLabel={`${Math.round(wpm!.value)} words per minute`}
              foot={`${wpm!.timed} of ${wpm!.total} runs measured`}
              title="Words from the record, seconds from the capture's own clock. A retry has no capture of its own and records written before that measurement carry no clock, so neither is in this average."
            />
            {/* TIME SAVED. The one figure on this row derived from an
                assumption rather than from a measurement, and the foot carries
                the `≈` that says so. A rolling window rather than a total: a
                lifetime figure built from a pruned history grows, sticks at the
                limit and then runs backwards. */}
            <StatTile
              label="Time saved"
              value={saved ? saved.value : null}
              ariaLabel={
                saved
                  ? `About ${Math.round(saved.value)} minutes saved in the last 7 days`
                  : "No reading for the last 7 days"
              }
              foot={saved ? "≈ minutes, last 7 days" : "nothing measured in 7 days"}
              title={`The same words and seconds, against a ${TYPING_BASELINE_WPM} words-per-minute typing baseline. The baseline is an assumption and not a measurement — nothing here has watched you type — which is what the ≈ is for.`}
            />
            {/* DRAWN, AND SHOWING NO FIGURE AT ALL (ADR 0161). The tag sits at
                the label, where it is read before the value rather than after
                it, and the counter draws a dark display: inventing a 3 here
                would be worse than a visible gap. */}
            <StatTile
              label="Apps"
              tag={
                <PreviewTag title="No history field stores the target application. `core::workspace_context` resolves it for the transform context and never writes it down; recording where a person dictates is a new collection, and the retention rule has to name it before the tile can count anything." />
              }
              value={null}
              ariaLabel="No reading yet"
              foot="no field on the record"
            />
            <StatTile
              label="Languages"
              tag={
                <PreviewTag title="The record stores the configured language, not the recognised one. The provider returns one and it is spent on recogniser repair rather than written to the record, so a count today would count how often the setting was changed." />
              }
              value={null}
              ariaLabel="No reading yet"
              foot="the setting, not the reading"
            />
          </HomeDisplay>
        ) : (
          <HeroInvoke
            title={runtime ? copy.title : "Hold in any app to dictate"}
            description={
              runtime ? copy.description : "Release to stop. What it produces goes to the cursor you left."
            }
          />
        )}
        <HeroFacts
          action={
            <Button
              variant="ghost"
              icon={<Icon name="arrow" />}
              onClick={runtime ? () => runtime.open?.({ view: "profiles" }) : undefined}
            >
              Change in profile
            </Button>
          }
        >
          {/* THE SHORTCUT'S PERMANENT HOME. It left the top of the screen with
              the 42 px caps and it did not leave the screen: the reader who has
              forgotten which keys to press has to find them somewhere, and the
              standing facts are where the facts that do not change with the next
              dictation live. The keys are the runtime's resolved display, never
              the raw token (T9). */}
          <span>
            {`${invokeVerb(activation)} `}
            <Keycaps combo={keycapCombo(trigger ?? runtime?.config.hotkey ?? "Ctrl+Super")} />
            {" in any app"}
          </span>
          <span className="ws-sep">·</span>
          {/* ONE TEXT NODE EITHER SIDE OF THE `<b>`, exactly as the prototype
              writes it. A JSX `{" "}` is a SECOND text node, and three of this
              row's spans measured 0.015px wide of the prototype because of it —
              the only style divergence this leg introduced, and it took a
              `port:diff` run to see. */}
          <span>
            {"Next dictation runs as "}
            <b>{runtime ? (effectiveMode ? PROCESSING_MODE_LABELS[effectiveMode] : "—") : "Cleanup"}</b>
          </span>
          <span className="ws-sep">·</span>
          <span>
            <b>{runtime ? displayTextProfileLabel(profile!) : "General writing"}</b>
            {` on ${runtime ? PROCESSING_MODE_LABELS[profileMode ?? "auto"] : "Auto"}`}
          </span>
        </HeroFacts>
      </HomeOpen>

      {/* THE DECISION INBOX — ADR 0044. Three sources, one list, and the reason
          they can share a list is not that they are alike: it is that all three
          are the same question to the user, something is stopped until you say
          something. Nothing is drawn when nothing is owed; a standing "all
          clear" is furniture. The product draws the ONE source it can receive
          (ADR 0076) and nothing when that source is quiet, which is most of
          the time and is the rule working rather than a screen half-built. */}
      {runtime && owed.length > 0 && (
        <SectionHeader title={`Waiting for you · ${owed.length}`}>
          <Card>
            <OwedList>
              {owed.map((entry) => {
                const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
                const scratchpad = entry.insert_mode === "scratchpad_fallback";
                return (
                  <Owed
                    key={entry.id}
                    icon="alert"
                    title={
                      scratchpad
                        ? "One insert reached neither the cursor nor the clipboard"
                        : "One insert fell back to the clipboard"
                    }
                    from={[
                      relativeTime(entry.created_at_ms),
                      entry.active_profile ?? "No profile recorded",
                      entry.fallback_reason ?? "the target app did not take the paste",
                    ].join(" · ")}
                    /* The cost column, and the two fallbacks do not have the
                       same one. Clipboard text survives until the next copy;
                       scratchpad text survives until the runtime is restarted,
                       and saying "lost when you copy" about it would be wrong
                       in the direction that makes somebody act too late. */
                    cost={
                      scratchpad
                        ? "It is in the scratchpad and goes when the runtime restarts."
                        : "The text is lost the next time you copy anything."
                    }
                    actions={
                      <>
                        <Button
                          icon={<Icon name="restore" />}
                          onClick={() => {
                            void invoke("insert_text_native", {
                              request: { text, source: "home_owed", corrected: entry.corrected },
                            });
                            void acknowledgeFallback(entry.id);
                          }}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => void acknowledgeFallback(entry.id)}
                        >
                          Dismiss
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </OwedList>
          </Card>
        </SectionHeader>
      )}

      {!runtime && (
        <SectionHeader title="Waiting for you · 3">
          <Card>
            <OwedList>
              <Owed
                icon="agents"
                urgent
                title="“Should I update the overlay test or the host?”"
                from={`${DESK_CAP} · WordScript · asked 6 min ago, out loud`}
                cost="The run stays blocked and stops in 24 min without an answer."
                actions={
                  <>
                    <Button variant="ghost">the test</Button>
                    <Button variant="ghost">the host</Button>
                    <IconButton label="Answer out loud" icon={<Icon name="mic" />} />
                  </>
                }
              />
              <Owed
                icon="users"
                title="Budget for Q2 headcount — unanswered since Monday"
                from="Product Sync · raised twice, in two meetings"
                cost="Nothing. It stays an open question on both notes."
                actions={
                  <>
                    <Button variant="ghost" icon={<Icon name="arrow" />}>
                      Open note
                    </Button>
                    <Button variant="ghost">Dismiss</Button>
                  </>
                }
              />
              <Owed
                icon="alert"
                title="One insert fell back to the clipboard"
                from="Yesterday 17:03 · Support reply · the target app ignored the paste"
                cost="The text is lost the next time you copy anything."
                actions={
                  <>
                    <Button icon={<Icon name="restore" />}>Restore</Button>
                    <Button variant="ghost">Dismiss</Button>
                  </>
                }
              />
            </OwedList>
          </Card>
        </SectionHeader>
      )}

      {/* The count is in the header for the same reason History's is: a count is
          the result of a list, not a label on it. "Open History" is the action
          of this card and sits at its foot, not loose on the page under it. */}
      <SectionHeader title={`Recent · ${rows.length}`}>
        <Card
          footer={
            <Button
              variant="ghost"
              icon={<Icon name="arrow" />}
              onClick={runtime ? () => runtime.open?.({ view: "history" }) : undefined}
            >
              Open History
            </Button>
          }
        >
          <ListRows>
            {rows.map((row) => (
              <TranscriptRow
                key={row.id}
                title={row.title}
                meta={row.meta}
                badges={row.badges}
                raw={row.raw}
                retryDisabledReason={
                  "retryDisabledReason" in row ? row.retryDisabledReason : undefined
                }
                restorable={row.restorable}
                open={openRaw === row.id}
                onToggleRaw={() => setOpenRaw((id) => (id === row.id ? null : row.id))}
                /* The same rule History follows: the file exists wherever the
                   record names one, and the one record without text says so. */
                revealDisabledReason={
                  runtime && !("transcriptPath" in row && row.transcriptPath)
                    ? "Show in file manager — this run produced no text, so no file was written"
                    : undefined
                }
                onReveal={"revealFile" in row ? row.revealFile : undefined}
                onCopy={row.copy}
                onRetry={row.retry}
                onDelete={row.remove}
                onRestore={row.restore}
              />
            ))}
          </ListRows>
        </Card>
      </SectionHeader>
    </>
  );
}
