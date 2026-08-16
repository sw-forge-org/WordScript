import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ActivityCalendar,
  Button,
  Card,
  HeroFacts,
  HeroInvoke,
  HomeDisplay,
  HomeOpen,
  HomeSwitch,
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
import {
  SAVED_WINDOW_DAYS,
  TYPING_BASELINE_WPM,
  ledgerBuckets,
  ledgerLanguages,
  ledgerPauseShare,
  ledgerTimeSaved,
  ledgerMedianTurnaround,
  ledgerMedianWpm,
  ledgerTotals,
} from "@/lib/activity";
import { TRANSLATE_LANGUAGES } from "@/types/ipc";
import { useActivityLedger } from "@/hooks/useActivityLedger";
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
 * THE OPENING BLOCK HAS TWO LIVES, AND THE SWITCH IS WHETHER THE RECORD HAS
 * ANYTHING TO SAY. An instruction is read exactly once, so the keycaps give the
 * position up as soon as the ledger holds a dictation, and the counters take it.
 *
 * The gate was `wordsPerMinute !== null` until ADR 0177 made that a SPEAKING
 * rate: every record written before the speech clock existed has none, so an
 * installation with months of dictation behind it was handed the instruction
 * again, as if it had never started. One tile's silence is not the record's. The
 * gate is now `ledgerTotals(ledger).dictations > 0`, and a tile with no reading
 * of its own draws a dark display — which is ADR 0161's rule and the reason four
 * zeroes never appear. The gallery falls out of it rather than being
 * special-cased: no runtime, no ledger, no dictations, so it draws the
 * instruction.
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

/** What the rate tile says on hover.
 *
 *  ONE SENTENCE, AND THE PAUSE SHARE IF IT IS KNOWN. A tooltip is read standing
 *  up: the reader wants to know what the number is, not how it is derived, and a
 *  paragraph in a hover card is a paragraph nobody finishes. The derivation
 *  lives in the ADR, where somebody who wants it will look. */
function rateTitle(measured: boolean, pauseShare: number | null): string {
  if (!measured) {
    return "Waiting for your next dictation.";
  }
  if (pauseShare === null) return "Words you spoke, over the time you spent speaking.";
  return `Words you spoke, over the time you spent speaking. ${Math.round(
    pauseShare * 100,
  )} % of your microphone time was pauses, and is left out.`;
}

/** The English name for a measured language code.
 *
 *  THE DETECTOR REACHES PAST WHAT THIS PRODUCT TRANSLATES BETWEEN — seventy
 *  languages against Translate's eight — so a table of the eight would leave a
 *  Swedish dictation labelled `SV`. `Intl.DisplayNames` already knows every code
 *  either side can produce and is in both engines this runs in, which is why
 *  there is no third language list in this repository.
 *
 *  A code it does not know comes back unchanged, and then the code itself is the
 *  label: naming a language wrongly is worse than showing its code. */
function languageLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) return name;
  } catch {
    /* An invalid tag throws rather than answering. Fall through. */
  }
  return (
    TRANSLATE_LANGUAGES.find((language) => language.code === code)?.label ?? code.toUpperCase()
  );
}

/** The line under the languages figure: the one you mostly dictate in, and how
 *  many others there are.
 *
 *  A LIST DOES NOT SCALE AND THE FIGURE ALREADY COUNTS. Three names fit and ten
 *  are a smear, so the foot answers the question the number cannot — which
 *  language you actually work in — and leaves the rest to the count. */
function languageFoot(languages: { code: string; count: number }[]): string {
  const [first, ...rest] = languages;
  if (rest.length === 0) return languageLabel(first.code);
  return `mostly ${languageLabel(first.code)} · +${rest.length}`;
}

/** The hover, capped at three. Beyond that a tooltip becomes a table. */
function languageTitle(languages: { code: string; count: number }[]): string {
  const named = languages
    .slice(0, 3)
    .map(({ code, count }) => `${languageLabel(code)} ${count}`)
    .join(", ");
  return languages.length > 3 ? `${named}, and ${languages.length - 3} more.` : `${named}.`;
}

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
  /* THE ALL-TIME FIGURES COME FROM THE LEDGER AND NEVER FROM `entries`. History
     is pruned by age and by count on every read, so a lifetime total summed from
     it grows, sticks at the limit and then runs backwards. The ledger keeps one
     row per day and does not forget. Re-read when a record lands, which is the
     only moment any of these numbers move. */
  const ledger = useActivityLedger(Boolean(runtime?.active), entries.length);

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
  const wpm = ledgerMedianWpm(ledger);
  const turnaround = ledgerMedianTurnaround(ledger);
  /* THE READER'S OWN BASELINE (ADR 0178), not a constant. It is the one input to
     this tile that was never measured, and it moves the answer threefold across
     the range a real writer types at — so the number that goes in comes from the
     config, and the tooltip names it. */
  const baseline = runtime?.config.typing_baseline_wpm ?? TYPING_BASELINE_WPM;
  const saved = ledgerTimeSaved(ledger, Date.now(), baseline);
  const pauseShare = ledgerPauseShare(ledger);
  const languages = ledgerLanguages(ledger);
  /* THE GATE IS THE RECORD, NOT ANY ONE TILE (ADR 0171, corrected by ADR 0177).
     It read `wpm !== null` until the rate became a speaking rate, and every
     record already on disk was written before the speech clock existed — so an
     installation with months of dictation behind it was shown the instruction
     again, as if it had never started. What decides between the two lives of
     this block is whether the RECORD has anything to say; a tile with no reading
     of its own draws a dark display, which is exactly what ADR 0161 asks for. */
  const display = ledgerTotals(ledger).dictations > 0;

  /* THE OTHER LIFE OF THE SAME BLOCK (decision 1). The calendar and the tiles
     are alternatives rather than companions — one is your rhythm, the other is
     your character — and which one stands is the reader's choice, kept in the
     config on the shape the sidebar's rail already uses. `runtime.config` IS the
     window's draft, so this is the same reader and the same writer `useNavRail`
     goes through and not a second opinion of one field.

     THE WINDOW IS DERIVED, NOT ASSUMED. An unlit cell asserts that nothing was
     dictated that day, and history is pruned by age AND by count on every read,
     so the display may only span what the file still reaches over. */
  const calendar = Boolean(runtime?.config.home_activity_calendar);
  const buckets = useMemo(() => ledgerBuckets(ledger), [ledger]);

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
          /* CLICKING THE BLOCK SWAPS IT (decision 9). No settings row is added
             for this and none is wanted: a preference about a display belongs on
             the display, and the two-dot indicator is what says there is a
             second view to find. The write goes through the same `patch` every
             other discrete control uses, so the choice is on disk the moment it
             is made and survives a restart. */
          <HomeSwitch
            calendar={calendar}
            onToggle={() => runtime?.patch({ home_activity_calendar: !calendar })}
          >
            {calendar ? (
              <ActivityCalendar buckets={buckets} />
            ) : (
              <HomeDisplay>
                {/* WORDS PER MINUTE — a SPEAKING rate since ADR 0177, and
                    three things had to change for it to deserve the name: the
                    median (already right), the spoken words rather than the
                    delivered ones, and the speech clock rather than the open
                    microphone. The foot names what it was computed over, because
                    a rate whose denominator silently skipped half the records is
                    a plausible wrong number, which is worse than a missing one. */}
                <StatTile
                  label="Words per minute"
                  value={wpm ? wpm.value : null}
                  ariaLabel={
                    wpm
                      ? `${Math.round(wpm.value)} words per minute`
                      : "No speaking rate measured yet"
                  }
                  foot={wpm ? `median · ${wpm.timed} dictations` : "from your next dictation"}
                  title={rateTitle(wpm !== null, pauseShare)}
                />
                {/* TIME SAVED. The one figure on this row derived from an
                    assumption rather than from a measurement, and the foot
                    carries the `≈` that says so. A rolling window rather than a
                    total: a lifetime figure stops being something a reader can
                    hold. Words and seconds come from the SAME runs (ADR 0178),
                    and generated text is not among them. */}
                <StatTile
                  label="Time saved"
                  value={saved ? saved.value : null}
                  ariaLabel={
                    saved
                      ? `About ${Math.round(saved.value)} minutes saved in the last four weeks`
                      : "No reading for the last four weeks"
                  }
                  foot={saved ? "≈ minutes · last 4 weeks" : "nothing yet · last 4 weeks"}
                  title={`Your words at ${baseline} wpm of typing, less the time you dictated them. The baseline is a guess — change it in Privacy & Data.`}
                />
                {/* THE ONE TILE THAT ANSWERS TO A SETTING. `Apps` stood here
                    and could not work: the target application is only resolved
                    where the text is pasted directly, and 49 of this machine's
                    last 50 dictations were clipboard deliveries, which have no
                    target to name. Anything downstream of the insert is outside
                    what this product can see — the same boundary that rules out
                    "time until the text is with you" and "how much you edited
                    afterwards". Turnaround is inside it at both ends, and since
                    ADR 0181 it starts where the wait does. */}
                <StatTile
                  label="Turnaround"
                  value={turnaround}
                  ariaLabel={
                    turnaround === null
                      ? "No reading yet"
                      : `${Math.round(turnaround)} milliseconds from speaking to text`
                  }
                  foot={turnaround === null ? "nothing timed yet" : "ms · median · all time"}
                  title="From you stopping to the text being ready. Moves with the model and the lane."
                />
                {/* LANGUAGES, MEASURED ON THE TEXT (ADR 0180). It carried a
                    `PreviewTag` and no figure while the plan was to pass the
                    provider's `response.language` through — which would never
                    have arrived: Groq treats language as a request hint and its
                    response names none, and the local lane has no field for it.
                    Reading the delivered text works on every lane and offline. */}
                <StatTile
                  label="Languages"
                  value={languages.length > 0 ? languages.length : null}
                  ariaLabel={
                    languages.length > 0
                      ? `${languages.length} languages dictated`
                      : "No language measured yet"
                  }
                  /* THE FOOT NAMES THE ONE YOU MOSTLY DICTATE IN AND COUNTS THE
                     REST. Every language on one line was fine at two and a smear
                     at ten, and the tile's own figure already says how many there
                     are — what it cannot say is which one you actually work in. */
                  foot={languages.length > 0 ? languageFoot(languages) : "from your next dictation"}
                  title={
                    languages.length > 0
                      ? `Measured on the text, not on your language setting. ${languageTitle(languages)}`
                      : "Measured on the text once a dictation is long enough to be sure of."
                  }
                />
              </HomeDisplay>
            )}
          </HomeSwitch>
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
