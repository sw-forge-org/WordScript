import { Fragment, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Card,
  HeroFacts,
  HeroInvoke,
  HomeOpen,
  Icon,
  IconButton,
  KeyCap,
  ListRows,
  Owed,
  OwedList,
  SectionHeader,
  TranscriptRow,
} from "@/components/shell";
import { useTranscriptionHistory } from "@/hooks/useTranscriptionHistory";
import { PROCESSING_MODE_LABELS } from "@/lib/transformRules";
import { relativeTime } from "@/lib/format";
import { readTriggerStatus } from "@/lib/shortcuts";
import {
  displayTextProfileLabel,
  resolveActiveTextProfile,
  resolveTextProfileWorkMode,
} from "@/lib/textProfiles";
import type { ProcessingMode } from "@/types/ipc";
import { badgesFor } from "./History";
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
 * THE HERO'S SENTENCE IS THE ACTIVATION MODE'S, not the drawing's. "Hold in any
 * app to dictate / Release to stop" is true of exactly one of the three modes
 * `activation_mode` takes, and the shipped default is `tap`. So the drawing is
 * kept verbatim as the `hold` member and the other two are their own sentences
 * — the same shape as General's device hint. The keys are the runtime's
 * resolved display of `config.hotkey`, never the raw token (T9).
 *
 * THE DECISION INBOX IS ABSENT ON THE PRODUCT, AND THAT IS THE DRAWING'S OWN
 * RULE. ADR 0044's inbox has three sources and no receiver — the desk does not
 * exist (Phase 8), no meeting produces an open question (V2), and the insert
 * fallback has no queue. Rendering three invented pending decisions would be
 * the worst instance of rule 7 on the whole surface: an invented QUESTION, not
 * an invented label. The drawing already says what to do when nothing is owed —
 * *"Nothing is drawn here when nothing is owed; a standing all-clear is
 * furniture"* — so nothing is drawn. It is why this screen keeps its banner,
 * and the three sources stay on the relay's §2.5 list.
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

/** The drawn caps, and the runtime's when there is one. `Ctrl + Super` is the
 *  runtime's display; `wide` is the drawing's own treatment of the long cap. */
function keyCaps(display: string) {
  const parts = display.split(" + ").filter(Boolean);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 && <span className="ws-plus">+</span>}
          <KeyCap wide={part.length > 4}>{part}</KeyCap>
        </Fragment>
      ))}
    </>
  );
}

export function HomeScreen({ banner, runtime }: PartlyWiredScreenProps = {}) {
  const [openRaw, setOpenRaw] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<string | null>(null);
  const [effectiveMode, setEffectiveMode] = useState<ProcessingMode | null>(null);
  const { entries, remove, retry } = useTranscriptionHistory(Boolean(runtime?.active));

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
  const copy = heroCopy(runtime?.config.activation_mode ?? "hold");

  const rows = runtime
    ? entries.slice(0, RECENT_LIMIT).map((entry) => {
        const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
        return {
          id: entry.id,
          title: text.trim() || (entry.error ?? "Nothing was heard in this capture."),
          meta: [
            relativeTime(entry.created_at_ms),
            PROCESSING_MODE_LABELS[entry.work_mode?.processing_mode ?? "auto"],
            entry.active_profile ?? "No profile recorded",
          ],
          badges: badgesFor(entry),
          raw: {
            heard: entry.raw_transcript ?? "",
            written: text,
            same: (entry.raw_transcript ?? "") === text,
            note: entry.transform_warning ?? undefined,
          },
          audioKept: Boolean(entry.audio_path),
          restorable:
            entry.insert_mode === "clipboard_only" ||
            entry.insert_mode === "clipboard_fallback" ||
            entry.insert_mode === "scratchpad_fallback",
          /* The same five commands History's rows call. Home lists the same
             record on the same builder, so it acts the same way — one builder
             was the point of `TranscriptRow` existing. */
          copy: () => void navigator.clipboard.writeText(text),
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
        audioKept: entry.audio !== false,
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
        <HeroInvoke
          keys={
            runtime ? (
              keyCaps(trigger ?? runtime.config.hotkey)
            ) : (
              <>
                <KeyCap>Ctrl</KeyCap>
                <span className="ws-plus">+</span>
                <KeyCap wide>Super</KeyCap>
              </>
            )
          }
          title={runtime ? copy.title : "Hold in any app to dictate"}
          description={
            runtime ? copy.description : "Release to stop. What it produces goes to the cursor you left."
          }
        />
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
          <span>
            Next dictation runs as{" "}
            <b>{runtime ? (effectiveMode ? PROCESSING_MODE_LABELS[effectiveMode] : "—") : "Cleanup"}</b>
          </span>
          <span className="ws-sep">·</span>
          <span>
            <b>{runtime ? displayTextProfileLabel(profile!) : "General writing"}</b> on{" "}
            {runtime ? PROCESSING_MODE_LABELS[profileMode ?? "auto"] : "Auto"}
          </span>
        </HeroFacts>
      </HomeOpen>

      {/* THE DECISION INBOX — ADR 0044. Three sources, one list, and the reason
          they can share a list is not that they are alike: it is that all three
          are the same question to the user, something is stopped until you say
          something. Nothing is drawn here when nothing is owed; a standing
          "all clear" is furniture — which is exactly why the product draws none
          of it: there is no receiver for any of the three (see the header). */}
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
                audioKept={row.audioKept}
                restorable={row.restorable}
                open={openRaw === row.id}
                onToggleRaw={() => setOpenRaw((id) => (id === row.id ? null : row.id))}
                /* The same hole History states, stated the same way — one
                   `history.json`, no per-transcript file, no reveal command. */
                revealDisabledReason={
                  runtime
                    ? "Show in file manager — the runtime keeps one history file, not one per transcript"
                    : undefined
                }
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
