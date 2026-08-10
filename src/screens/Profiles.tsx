import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Card,
  CardRows,
  DocLink,
  Field,
  Flag,
  Icon,
  IconButton,
  Legend,
  LegendRow,
  ListItem,
  ListRows,
  Note,
  Pane,
  PaneDetailHead,
  PaneDetailMain,
  PaneListFoot,
  PaneListHead,
  PaneRow,
  PaneScroll,
  Row,
  SegmentControl,
  Select,
  StatusBadge,
  Stepper,
  SubTabs,
  TermChips,
  TextArea,
  Toggle,
  ViewTop,
  type TermChip,
} from "@/components/shell";
import { formatBudgetDuration, useCaptureBudget } from "@/hooks/useCaptureBudget";
import { PROCESSING_MODE_LABELS } from "@/lib/transformRules";
import {
  buildTextProfilesPatch,
  clearTextProfileCuration,
  describeTextProfileWorkMode,
  resolveProfileCaptureSettings,
  resolveProfileModesSettings,
  resolveTextProfileWorkMode,
} from "@/lib/textProfiles";
import { SETTINGS_ANCHOR_AUTO_STOP, settingsAnchorElementId } from "@/lib/settingsAnchors";
import type {
  AppConfig,
  ProcessingMode,
  TextProfile,
  TextProfileInsertBehavior,
  VocabularyHintEntry,
} from "@/types/ipc";
import type { ProfileHealthStatus } from "@/types/textRules";
import type { PartlyWiredScreenProps } from "./props";

/**
 * PROFILES — `SCREENS.profiles`, a pane view, WIRED IN PART.
 *
 * DEFAULTS IS THE TAB THE IA IMPLIES AND THE FIRST BUILD DID NOT HAVE. ADR
 * 0024 puts "which mode this profile defaults to" in the profile and nowhere
 * else; ADR 0025 makes the session inherit it. The delivery target, the
 * workspace-context switch and the recording limits are per-profile in the
 * runtime as well, and were sitting in three different settings sections where
 * they read as machine-wide. Gathering them here is what lets Settings mean
 * "this machine" without exception.
 *
 * REBUILT FOR WEIGHT. Defaults was one card of six rows each carrying two or
 * three sentences, then a health card, then a four-row card with its own
 * two-sentence description — about 230 words to configure six values, on the
 * tab that opens first. Three faults:
 *
 *   1. SIX EQUAL ROWS WERE NOT SIX EQUAL DECISIONS. Three decide how this
 *      profile writes; three decide when a recording stops.
 *   2. THE HEALTH CARD WAS A CARD. One flag, one sentence, one button — for a
 *      status that belongs beside the profile's name, where it is visible from
 *      all five tabs instead of only from this one.
 *   3. THE HINTS EXPLAINED THE FEATURE, NOT THE CHOICE. The reader is deciding
 *      whether to leave a switch alone; what they need is what changes if they
 *      don't — one clause, not three sentences.
 *
 * THIS IS THE FIRST SCREEN IN THE PRODUCT WITH A TEXT FIELD, so it is the first
 * caller `patchText` has ever had. The Context tab's textarea writes
 * `profile.prompt` through it: the draft is in the form on the keystroke and
 * the disk write is debounced, which is the whole of plan P1. Everything else
 * here is discrete and takes `patch`, because there is no such thing as a
 * half-pressed toggle — and a discrete patch flushes a pending text commit
 * first, so the two cannot land out of order.
 *
 * WHAT CANNOT ACT, AND IT IS WHY THE BANNER STAYS. Each one is DISABLED with
 * the reason on it rather than deleted (ADR 0065):
 *
 *   - **Add / Edit on Replacements and Snippets.** The list rows are read from
 *     `dictionary_entries` and `snippet_entries` and Delete writes them back,
 *     but the drawing has no editor behind Add or Edit — no form, no dialog, no
 *     inline field. Building one is drawing, and the gallery is the source
 *     (ADR 0057), so it has to grow one first.
 *   - **New profile**, for the same reason one step earlier: `createTextProfile`
 *     produces a profile called "New profile" and nothing on this surface can
 *     rename it.
 *   - **More**, which opens a menu the drawing does not have.
 *   - **Check against a sample** and **Show the effective bias**, which are
 *     `analyze_text_rules` — a real command whose ANSWER has nowhere drawn to
 *     go.
 *   - **Translate** in the mode select, which is ADR 0041's seventh mode and
 *     not a `ProcessingMode` the runtime carries. Same hole as Hotkeys' seventh
 *     key.
 *
 * The health flag count IS read (`get_profile_health`) and its sentences are
 * the button's tooltip, because that is the only place on the drawing they fit.
 */

const TABS = ["Defaults", "Context", "Words", "Replacements", "Snippets"];

/** The drawn order, which is not `ProcessingMode`'s. `Translate` has no runtime
 *  value; `Draft` is the surface's name for `agent` (`PROCESSING_MODE_LABELS`). */
const MODE_OPTIONS: { value: ProcessingMode | "translate"; label: string }[] = [
  { value: "auto", label: PROCESSING_MODE_LABELS.auto },
  { value: "verbatim", label: PROCESSING_MODE_LABELS.verbatim },
  { value: "cleanup", label: PROCESSING_MODE_LABELS.cleanup },
  { value: "rewrite", label: PROCESSING_MODE_LABELS.rewrite },
  { value: "translate", label: "Translate" },
  { value: "agent", label: PROCESSING_MODE_LABELS.agent },
  { value: "prompt_enhance", label: PROCESSING_MODE_LABELS.prompt_enhance },
];

const NO_EDITOR_DRAWN = "No editor is drawn for this yet";
const NO_ANSWER_SURFACE = "Nothing on this surface can show the result yet";

/* The drawing's own lists, which is what the gallery is measured against. */
const DRAWN_PROFILES = [
  { id: "d1", title: "General writing", sub: "Auto · Insert at cursor", active: true },
  { id: "d2", title: "Support reply", sub: "Rewrite · Client register", active: false },
  { id: "d3", title: "Customer success replies", sub: "Rewrite · Clipboard only", active: false },
];

const DRAWN_TERMS: TermChip[] = [
  { term: "WordScript", origin: "learned" },
  { term: "Tauri", origin: "learned" },
  { term: "WebKitGTK", origin: "added" },
  { term: "ydotool", origin: "added" },
  { term: "Kundenanfrage", origin: "added" },
  { term: "Groq", origin: "learned" },
  { term: "whisper-cli", origin: "added" },
  { term: "Ollama", origin: "learned" },
];

const DRAWN_REPLACEMENTS: Array<[string, string]> = [
  ["KA", "Kundenanfrage"],
  ["WS", "WordScript"],
  ["asap", "as soon as possible"],
];

const DRAWN_SNIPPETS: Array<[string, string]> = [
  ["standard closing", "Best regards,\nFelix"],
  ["ticket header", "Ticket: \nStatus: \nNext step: "],
];

const DRAWN_CONTEXT =
  "Tauri desktop runtime\nWhisper speech-to-text\nRust native insert chain\nSettings information architecture";

function termsOf(profile: TextProfile): TermChip[] {
  return profile.vocabulary_hints.map((hint) => ({
    term: hint.phrase,
    origin: hint.origin === "learned" ? "learned" : "added",
  }));
}

function newVocabularyHint(phrase: string): VocabularyHintEntry {
  return {
    id: `hint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    phrase,
    use_as_prompt_hint: true,
    origin: "user",
    learned_at_ms: null,
    hit_count: 0,
    observation_count: 0,
  };
}

export function ProfilesScreen({ banner, runtime }: PartlyWiredScreenProps = {}) {
  const config = runtime?.config;
  const [tab, setTab] = useState(TABS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [health, setHealth] = useState<ProfileHealthStatus | null>(null);
  const [term, setTerm] = useState("");

  /* The drawn state, unchanged, for the gallery. */
  const [drawnSelected, setDrawnSelected] = useState(DRAWN_PROFILES[0].id);
  const [drawnDelivery, setDrawnDelivery] = useState("Insert at cursor");
  const [drawnWorkspace, setDrawnWorkspace] = useState(true);

  const profiles = config?.text_profiles ?? [];
  const profile =
    profiles.find((entry) => entry.id === selectedId) ??
    profiles.find((entry) => entry.id === config?.active_text_profile_id) ??
    profiles[0];

  const { budget } = useCaptureBudget(
    config ? `${config.provider}:${config.provider_tier}:${config.local_model}` : undefined,
  );

  /* The runtime grades the profile from what it holds — the prompt, the
     replacements, the mode. Re-read when any of those change, because a flag
     that survives an edit that fixed it is worse than no flag. */
  useEffect(() => {
    if (!runtime?.active || !profile) return;
    let cancelled = false;
    void invoke<ProfileHealthStatus>("get_profile_health", {
      request: {
        prompt: profile.prompt,
        dictionary_entries: profile.dictionary_entries,
        acknowledged_flags: [],
        bias_mode: profile.work_mode?.bias_mode ?? null,
        processing_mode: profile.work_mode?.processing_mode ?? null,
        profile_id: profile.id,
      },
    })
      .then((next) => {
        if (!cancelled) setHealth(next);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [runtime?.active, profile?.id, profile?.prompt, profile?.dictionary_entries, profile?.work_mode]);

  /** Every write on this screen targets the SELECTED profile, which is not
   *  necessarily the active one — `buildProfile*Patch` in `lib/textProfiles`
   *  all act on the active profile and are the wrong tool here. Editing a
   *  profile also drops its curated marking, exactly as the pre-port area did:
   *  a curated profile the user has changed is no longer the curated one. */
  const write = (
    update: (current: TextProfile) => TextProfile,
    kind: "discrete" | "text" = "discrete",
  ) => {
    if (!runtime || !config || !profile) return;
    const next = config.text_profiles.map((entry) =>
      entry.id === profile.id ? clearTextProfileCuration(update(entry)) : entry,
    );
    const partial: Partial<AppConfig> = buildTextProfilesPatch(
      config,
      next,
      config.active_text_profile_id,
    );
    if (kind === "text") runtime.patchText(partial);
    else runtime.patch(partial);
  };

  const work = profile ? resolveTextProfileWorkMode(profile) : null;
  const modes = profile ? resolveProfileModesSettings(profile) : null;
  const capture = profile ? resolveProfileCaptureSettings(profile) : null;
  const isActive = Boolean(profile && profile.id === config?.active_text_profile_id);
  const flagCount = health?.flags.length ?? 0;

  const listRows = useMemo(
    () =>
      runtime
        ? profiles.map((entry) => ({
            id: entry.id,
            title: entry.label,
            sub: describeTextProfileWorkMode(entry),
          }))
        : DRAWN_PROFILES.map((entry) => ({ id: entry.id, title: entry.title, sub: entry.sub })),
    [runtime, profiles],
  );
  const currentId = runtime ? profile?.id : drawnSelected;

  const ceilingLabel = budget ? formatBudgetDuration(budget.ceiling_seconds) : null;
  const autoStopMaxMinutes = budget ? Math.max(1, Math.floor(budget.ceiling_seconds / 60)) : 30;

  return (
    <>
      <ViewTop
        title="Profiles"
        lead="What a profile knows, and what it changes about how you are written."
        banner={banner}
      />

      <Pane
        list={
          <>
            <PaneListHead title="Profiles" count={String(listRows.length)} />
            <PaneScroll>
              {listRows.map((row) => (
                <PaneRow
                  key={row.id}
                  icon="profiles"
                  title={row.title}
                  sub={row.sub}
                  current={row.id === currentId}
                  onClick={() => (runtime ? setSelectedId(row.id) : setDrawnSelected(row.id))}
                />
              ))}
            </PaneScroll>
            <PaneListFoot>
              <Button
                variant="ghost"
                icon={<Icon name="plus" />}
                disabled={Boolean(runtime)}
                title={runtime ? `New profile — ${NO_EDITOR_DRAWN.toLowerCase()}` : undefined}
              >
                New profile
              </Button>
            </PaneListFoot>
          </>
        }
        detail={
          <>
            {/* The health flag lives in the detail header. It is a property of
                the profile, not of the Defaults tab, and from here it is
                visible on all five. Duplicate and Export went with it — they
                are things you do to a profile rarely and from the list. */}
            <PaneDetailHead
              title={runtime ? (profile?.label ?? "No profile") : "General writing"}
              description={
                runtime
                  ? isActive
                    ? "Active in this session"
                    : (profile && describeTextProfileWorkMode(profile)) || ""
                  : "Active in this session"
              }
              actions={
                <>
                  {(!runtime || isActive) && <StatusBadge tone="success">Active</StatusBadge>}
                  {(!runtime || flagCount > 0) && (
                    <Flag
                      disabled={Boolean(runtime)}
                      title={health?.flags.map((flag) => flag.hint).join(" ") || undefined}
                    >
                      {runtime ? `${flagCount} ${flagCount === 1 ? "flag" : "flags"}` : "1 flag"}
                    </Flag>
                  )}
                  <IconButton
                    label={runtime ? `More — ${NO_EDITOR_DRAWN.toLowerCase()}` : "More"}
                    icon={<Icon name="updown" />}
                    disabled={Boolean(runtime)}
                  />
                </>
              }
            />
            <PaneDetailMain>
              <SubTabs
                label="Profile"
                value={tab}
                onChange={setTab}
                items={TABS.map((id) => ({ id, label: id }))}
              />

              {tab === "Defaults" && (
                <>
                  <Card
                    title="How this profile writes"
                    description="Travels with the profile. A running session keeps what it started with."
                  >
                    <CardRows>
                      <Row
                        label="Processing mode"
                        hint="Auto never picks Verbatim or Rewrite — those stay your call."
                        control={
                          <Select
                            value={work?.processing_mode ?? "auto"}
                            onChange={(event) =>
                              write((current) => ({
                                ...current,
                                work_mode: {
                                  ...resolveTextProfileWorkMode(current),
                                  processing_mode: event.target.value as ProcessingMode,
                                },
                              }))
                            }
                            aria-label="Processing mode"
                          >
                            {MODE_OPTIONS.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                                /* ADR 0041 gave Translate the seventh slot and
                                   `ProcessingMode` still has six values. */
                                disabled={Boolean(runtime) && option.value === "translate"}
                              >
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        }
                      />
                      <Row
                        label="Delivery"
                        hint="Where a finished transcript goes."
                        control={
                          <SegmentControl
                            aria-label="Delivery"
                            value={
                              runtime
                                ? work?.insert_behavior === "clipboard_only"
                                  ? "Clipboard only"
                                  : "Insert at cursor"
                                : drawnDelivery
                            }
                            onChange={(next) => {
                              if (!runtime) {
                                setDrawnDelivery(next);
                                return;
                              }
                              const behavior: TextProfileInsertBehavior =
                                next === "Clipboard only" ? "clipboard_only" : "auto_paste";
                              write((current) => ({
                                ...current,
                                work_mode: {
                                  ...resolveTextProfileWorkMode(current),
                                  insert_behavior: behavior,
                                },
                              }));
                            }}
                            options={[
                              { value: "Insert at cursor", label: "Insert at cursor" },
                              { value: "Clipboard only", label: "Clipboard only" },
                            ]}
                          />
                        }
                      />
                      <Row
                        label="Workspace context"
                        hint="Tells the AI which app you are writing into. Never adds content."
                        control={
                          <Toggle
                            checked={runtime ? Boolean(modes?.collect_workspace_context) : drawnWorkspace}
                            onCheckedChange={(next) => {
                              if (!runtime) {
                                setDrawnWorkspace(next);
                                return;
                              }
                              write((current) => ({
                                ...current,
                                modes: {
                                  ...resolveProfileModesSettings(current),
                                  collect_workspace_context: next,
                                },
                              }));
                            }}
                            aria-label="Workspace context"
                          />
                        }
                      />
                    </CardRows>
                  </Card>

                  {/* Three things bound a recording, ordered by how hard each
                      one is: you stop talking, the recording gets long, the
                      provider cannot take any more. The ceiling is the
                      runtime's number, so it is stated, not offered. */}
                  <Card
                    title="When a recording stops"
                    description="Nothing here can pass the ceiling, and the ceiling is not yours to set."
                  >
                    <CardRows>
                      <Row
                        label="Stop after silence"
                        hint="When you stop talking. 0 disables it."
                        control={
                          <Stepper
                            value={runtime ? (capture?.silence_timeout_seconds ?? 0) : 3}
                            onChange={(next) =>
                              write((current) => ({
                                ...current,
                                capture: {
                                  ...resolveProfileCaptureSettings(current),
                                  silence_timeout_seconds: next,
                                },
                              }))
                            }
                            suffix="s"
                            min={0}
                            max={60}
                            aria-label="Stop after silence"
                          />
                        }
                      />
                      {/* THE ONE DEEP-LINK TARGET IN THE SURFACE. The overlay's
                          auto-stop tab states a number and then offers the
                          control that sets it; Rust emits the anchor and the
                          window scrolls this row into view. The id is on the
                          row rather than on a wrapper, because the highlight
                          has to say WHICH row was meant. */}
                      <Row
                        id={settingsAnchorElementId(SETTINGS_ANCHOR_AUTO_STOP)}
                        label="Auto-stop"
                        hint={
                          !runtime
                            ? "At this length. Up to 12:18 keeps headroom under the ceiling."
                            : budget
                              ? budget.auto_stop_clamped
                                ? `At this length. Your saved value is longer than this setup can process, so recordings stop at ${formatBudgetDuration(
                                    budget.auto_stop_seconds,
                                  )} instead.`
                                : `At this length. Up to ${formatBudgetDuration(
                                    budget.recommended_auto_stop_seconds,
                                  )} keeps headroom under the ceiling.`
                              : "At this length. Reading the current processing limit…"
                        }
                        control={
                          <Stepper
                            value={
                              runtime ? Math.round((capture?.max_recording_seconds ?? 720) / 60) : 10
                            }
                            onChange={(next) =>
                              write((current) => ({
                                ...current,
                                capture: {
                                  ...resolveProfileCaptureSettings(current),
                                  max_recording_seconds: next * 60,
                                },
                              }))
                            }
                            suffix="min"
                            min={1}
                            max={runtime ? autoStopMaxMinutes : 13}
                            aria-label="Auto-stop"
                          />
                        }
                      />
                      <Row
                        label="Ceiling"
                        hint={
                          !runtime
                            ? "13:39 — the 25 MiB upload size on your plan. Past it, nothing transcribes."
                            : budget
                              ? `${ceilingLabel} — ${budget.ceiling_detail}. Past it, nothing transcribes.`
                              : "The runtime has not answered with a processing limit."
                        }
                        control={
                          <StatusBadge>{runtime ? (ceilingLabel ?? "Not read") : "13:39"}</StatusBadge>
                        }
                      />
                    </CardRows>
                  </Card>

                  <Card
                    title="Where each list lands"
                    footer={
                      <Button
                        variant="ghost"
                        icon={<Icon name="play" />}
                        disabled={Boolean(runtime)}
                        title={runtime ? NO_ANSWER_SURFACE : undefined}
                      >
                        Check against a sample
                      </Button>
                    }
                  >
                    <Legend>
                      <LegendRow name="Context" what="steers which word the AI picks" where="AI modes" />
                      <LegendRow name="Words & names" what="repairs mangled terms" where="recognizer + AI" />
                      <LegendRow name="Replacements" what="exact swap, before the AI" where="every mode" />
                      <LegendRow name="Snippets" what="phrase expands to a block" where="every mode" />
                    </Legend>
                  </Card>
                </>
              )}

              {tab === "Context" && (
                <Card
                  title="Profile context"
                  description="Topics you talk about, one per line. Not spellings."
                >
                  <CardRows>
                    <Row layout="stack">
                      {/* THE FIRST `patchText` CALLER IN THE PRODUCT. Controlled
                          rather than defaulted, because the draft has to be the
                          form's value or what you typed lags the cursor; the
                          disk write is what is debounced. Blur commits. */}
                      <TextArea
                        rows={5}
                        placeholder="One topic per line"
                        aria-label="Profile context"
                        {...(runtime
                          ? {
                              value: profile?.prompt ?? "",
                              onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                                write((current) => ({ ...current, prompt: event.target.value }), "text"),
                              onBlur: () => runtime.flushText(),
                            }
                          : { defaultValue: DRAWN_CONTEXT })}
                      />
                    </Row>
                  </CardRows>
                  <Note icon="arrow" tail={<DocLink>How context reaches the model</DocLink>}>
                    For individual terms, use Words &amp; names.
                  </Note>
                </Card>
              )}

              {tab === "Words" && (
                <>
                  {/* A word list is an input and a set of chips. Rows with hover
                      actions imply a record with fields; a term has none. */}
                  <Card
                    title="Words & names"
                    description="Terms this profile knows. Repaired automatically when speech mangles them."
                  >
                    <CardRows>
                      <Row layout="stack">
                        <Field
                          placeholder="Add a word or name…"
                          aria-label="Add a word or name"
                          value={runtime ? term : undefined}
                          onChange={runtime ? (event) => setTerm(event.target.value) : undefined}
                          onKeyDown={
                            runtime
                              ? (event) => {
                                  if (event.key !== "Enter") return;
                                  event.preventDefault();
                                  const phrase = term.trim();
                                  if (!phrase) return;
                                  /* Adding a term is discrete — one word, one
                                     write — so it takes `patch` even though it
                                     was typed into a text field. */
                                  write((current) =>
                                    current.vocabulary_hints.some((hint) => hint.phrase === phrase)
                                      ? current
                                      : {
                                          ...current,
                                          vocabulary_hints: [
                                            ...current.vocabulary_hints,
                                            newVocabularyHint(phrase),
                                          ],
                                        },
                                  );
                                  setTerm("");
                                }
                              : undefined
                          }
                        />
                        <TermChips
                          items={runtime && profile ? termsOf(profile) : DRAWN_TERMS}
                          onRemove={
                            runtime
                              ? (phrase) =>
                                  write((current) => ({
                                    ...current,
                                    vocabulary_hints: current.vocabulary_hints.filter(
                                      (hint) => hint.phrase !== phrase,
                                    ),
                                  }))
                              : undefined
                          }
                        />
                        <p className="ws-muted">
                          Outlined chips were learned from repairs.{" "}
                          {runtime ? (profile?.vocabulary_hints.length ?? 0) : DRAWN_TERMS.length} terms.
                        </p>
                      </Row>
                    </CardRows>
                  </Card>
                  <Card>
                    <CardRows>
                      <Row
                        label="Effective transcription bias"
                        hint="Which of these the recognizer actually receives — it takes only a few."
                        control={
                          <Button
                            variant="ghost"
                            icon={<Icon name="eye" />}
                            disabled={Boolean(runtime)}
                            title={runtime ? NO_ANSWER_SURFACE : undefined}
                          >
                            Show
                          </Button>
                        }
                      />
                    </CardRows>
                  </Card>
                </>
              )}

              {tab === "Replacements" && (
                <>
                  <Card
                    title="Replacements"
                    description="Shorthand you say on purpose. Exact match, every mode."
                    footer={
                      <Button
                        icon={<Icon name="plus" />}
                        disabled={Boolean(runtime)}
                        title={runtime ? NO_EDITOR_DRAWN : undefined}
                      >
                        Add replacement
                      </Button>
                    }
                  >
                    <ListRows>
                      {(runtime && profile
                        ? profile.dictionary_entries.map(
                            (item) => [item.phrase, item.replace_with, item.id] as const,
                          )
                        : DRAWN_REPLACEMENTS.map(([from, to]) => [from, to, from] as const)
                      ).map(([from, to, id]) => (
                        <ListItem
                          key={id}
                          title={`${from}  →  ${to}`}
                          meta={["exact", "case-insensitive"]}
                          actions={
                            <>
                              <IconButton
                                label={runtime ? `Edit — ${NO_EDITOR_DRAWN.toLowerCase()}` : "Edit"}
                                icon={<Icon name="type" />}
                                disabled={Boolean(runtime)}
                              />
                              <IconButton
                                label="Delete"
                                icon={<Icon name="trash" />}
                                tone="danger"
                                onClick={
                                  runtime
                                    ? () =>
                                        write((current) => ({
                                          ...current,
                                          dictionary_entries: current.dictionary_entries.filter(
                                            (item) => item.id !== id,
                                          ),
                                        }))
                                    : undefined
                                }
                              />
                            </>
                          }
                        />
                      ))}
                    </ListRows>
                  </Card>
                  <Note icon="arrow" tail={<DocLink>Why</DocLink>}>
                    Misheard names belong in Words &amp; names instead.
                  </Note>
                </>
              )}

              {tab === "Snippets" && (
                <Card
                  title="Snippets"
                  description="A trigger phrase you say, and the block it expands to."
                  footer={
                    <Button
                      icon={<Icon name="plus" />}
                      disabled={Boolean(runtime)}
                      title={runtime ? NO_EDITOR_DRAWN : undefined}
                    >
                      Add snippet
                    </Button>
                  }
                >
                  <ListRows>
                    {(runtime && profile
                      ? profile.snippet_entries.map(
                          (item) => [item.label || item.trigger, item.expansion, item.id] as const,
                        )
                      : DRAWN_SNIPPETS.map(([name, body]) => [name, body, name] as const)
                    ).map(([name, body, id]) => (
                      <ListItem
                        key={id}
                        title={name}
                        meta={[`expands to ${body.split("\n").length} lines`]}
                        actions={
                          <>
                            <IconButton
                              label={runtime ? `Edit — ${NO_EDITOR_DRAWN.toLowerCase()}` : "Edit"}
                              icon={<Icon name="type" />}
                              disabled={Boolean(runtime)}
                            />
                            <IconButton
                              label="Delete"
                              icon={<Icon name="trash" />}
                              tone="danger"
                              onClick={
                                runtime
                                  ? () =>
                                      write((current) => ({
                                        ...current,
                                        snippet_entries: current.snippet_entries.filter(
                                          (item) => item.id !== id,
                                        ),
                                      }))
                                  : undefined
                              }
                            />
                          </>
                        }
                      />
                    ))}
                  </ListRows>
                </Card>
              )}
            </PaneDetailMain>
          </>
        }
      />
    </>
  );
}
