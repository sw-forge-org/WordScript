import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BudgetMeter,
  Button,
  Card,
  CardRows,
  DocLink,
  Field,
  FieldWrap,
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
import { TRANSLATE_LANGUAGES } from "@/types/ipc";
import type {
  AppConfig,
  CommunicationLength,
  CommunicationRegister,
  CommunicationStyleAnalysis,
  ProcessingMode,
  ProfileModesSettings,
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
 *      all six tabs instead of only from this one.
 *   3. THE HINTS EXPLAINED THE FEATURE, NOT THE CHOICE. The reader is deciding
 *      whether to leave a switch alone; what they need is what changes if they
 *      don't — one clause, not three sentences.
 *
 * STYLE IS THE SIXTH TAB AND THE ONE THING ON THIS SCREEN THE PROTOTYPE NEVER
 * DREW (ADR 0068). `core::communication_style` has been running the whole time
 * — register, length, rules, sample, with ADR 0023's precedence between them —
 * and `transform`, `agent` and `capture` all consume it, while the prototype
 * pointed at this profile for it three times and gave it no tab. One profile on
 * the owner's machine carries a non-default register set in the pre-port UI,
 * applied to every Rewrite under it, invisible and unchangeable. That is the
 * defect ADR 0023 exists against, and this tab is the whole of the fix: no
 * Rust, no migration, no new field.
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
 *
 * The health flag count IS read (`get_profile_health`) and its sentences are
 * the button's tooltip, because that is the only place on the drawing they fit.
 */

/**
 * SIX TABS, AND THE SECOND ONE IS THE DEPARTURE — ADR 0068.
 *
 * The prototype draws five and points at a sixth three times without ever
 * drawing it, so `npm run port:diff -- profiles` stops measuring this screen
 * 1:1 from the commit that adds `Style`. That is the recorded cost of the ADR
 * rather than a regression, and it is the only one of the 28 measurements that
 * moves.
 *
 * The order is semantic, not chronological: Defaults and Style are settings,
 * Context, Words, Replacements and Snippets are content ordered broad →
 * literal. Appending Style at the end would split the settings half around
 * four content tabs.
 */
const TABS = ["Defaults", "Style", "Context", "Words", "Replacements", "Snippets"];

/** Named after the addressee, or — for the lowest step — the medium. A ladder
 *  of formality adjectives reads as near-synonyms in a select; "who am I
 *  writing to" is something the speaker already knows (ADR 0023). */
const REGISTER_OPTIONS: { value: CommunicationRegister; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "authority", label: "Authority" },
  { value: "client", label: "Client" },
  { value: "colleague", label: "Colleague" },
  { value: "friend", label: "Friend" },
  { value: "quick", label: "Quick message" },
];

/** The area's own words, carried over from the pre-port `ModesTab.tsx`
 *  unchanged. Each level is defined by properties you can COUNT in the output —
 *  address form, contractions, salutation, punctuation — never by an adjective,
 *  because an adjective is neither verifiable nor enforceable. */
const REGISTER_DESCRIPTIONS: Record<CommunicationRegister, string> = {
  off: "No style instruction. The result takes its tone from the dictation, exactly as before.",
  authority:
    "Authorities, contracts, legal text. Fixed formulas, formal address, no contractions, full salutation and sign-off.",
  client:
    "Applications, external customer mail, leadership. Complete sentences, formal address, full salutation and sign-off.",
  colleague:
    "Internal mail to the team. Complete sentences, address form follows your dictation, short salutation.",
  friend:
    "Private mail, team chat, friends. Familiar address, contractions, short sentences, salutation optional.",
  quick:
    "Short messages and group chat. No salutation, fragments, minimal punctuation, lowercase starts allowed.",
};

/** `full` is drawn as Expansive: "Full" beside a length reads as a quantity of
 *  text rather than as the third step of a scale. The runtime value is `full`. */
const LENGTH_OPTIONS: { value: CommunicationLength; label: string }[] = [
  { value: "terse", label: "Terse" },
  { value: "normal", label: "Normal" },
  { value: "full", label: "Expansive" },
];

/**
 * The gallery's number, and only the gallery's.
 *
 * With a runtime the meters read `analyze_communication_style`, which answers
 * what the prompt will actually cost rather than what was typed. Without one
 * there is nothing to ask, and a gallery screen may carry sample data and
 * assert nothing (ADR 0055), so the drawn meter counts characters against the
 * bound it is drawn with. The two agree on any input that needs no normalizing,
 * which is every input the gallery has.
 */
const DRAWN_STYLE_BUDGET = 400;

/** Rules and a sample stay inert while the register is Off — `is_active()` in
 *  `core::communication_style` gates the whole block, so a profile that has
 *  switched the style off does not keep leaking the fields it happens to hold.
 *  Three controls that cannot reach a prompt, disabled with the reason under
 *  them rather than deleted (ADR 0065). The reason cannot be a `title`: a
 *  disabled control takes `pointer-events: none`, so nothing hovers it. */
const STYLE_IS_OFF =
  "The register is Off, so nothing on this card reaches a prompt. Pick a register to use them.";

/** The drawn order, which is not `ProcessingMode`'s declaration order. `Draft`
 *  is the surface's name for `agent` (`PROCESSING_MODE_LABELS`). */
const MODE_OPTIONS: { value: ProcessingMode; label: string }[] = [
  { value: "auto", label: PROCESSING_MODE_LABELS.auto },
  { value: "verbatim", label: PROCESSING_MODE_LABELS.verbatim },
  { value: "cleanup", label: PROCESSING_MODE_LABELS.cleanup },
  { value: "rewrite", label: PROCESSING_MODE_LABELS.rewrite },
  { value: "translate", label: PROCESSING_MODE_LABELS.translate },
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
  const [styleAnalysis, setStyleAnalysis] = useState<CommunicationStyleAnalysis | null>(null);
  const [term, setTerm] = useState("");

  /* The drawn state, unchanged, for the gallery. */
  const [drawnSelected, setDrawnSelected] = useState(DRAWN_PROFILES[0].id);
  const [drawnDelivery, setDrawnDelivery] = useState("Insert at cursor");
  const [drawnWorkspace, setDrawnWorkspace] = useState(true);
  /* The Style tab's drawn state starts OFF, and that is not an empty default:
     the drawn profile's own subline is `Auto · Insert at cursor`, which under
     `describeTextProfileWorkMode` is exactly what "no register" produces. A
     gallery that drew a register here would contradict the list beside it.
     Switching it in the gallery brings the other three controls alive, which
     is how both halves of the card are reachable without a runtime. */
  const [drawnRegister, setDrawnRegister] = useState<CommunicationRegister>("off");
  const [drawnLength, setDrawnLength] = useState<CommunicationLength>("normal");
  const [drawnRules, setDrawnRules] = useState("");
  const [drawnSample, setDrawnSample] = useState("");
  /* The two Translate rows are drawn on their runtime defaults, which is what
     the AI Models drawing shows for the same pair. They are only reachable in
     the gallery by switching the mode select to Translate, which is how both
     halves of the card stay measurable. */
  const [drawnTargetLanguage, setDrawnTargetLanguage] = useState("en");
  const [drawnKeepWords, setDrawnKeepWords] = useState(true);
  const [drawnMode, setDrawnMode] = useState<ProcessingMode>("auto");

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

  /* What the two bounded style fields will actually cost the prompt. The two
     numbers the meters used to show were the field's own character count
     against a constant copied out of `core::communication_style`, and the
     runtime's count is lower whenever whitespace collapses, a rule repeats or a
     rule runs past 120 characters. Asked on every edit rather than debounced:
     it is a pure function of its argument with no disk and no network in it,
     and a meter that lags the field it measures is the defect it exists
     against. */
  useEffect(() => {
    if (!runtime?.active || !modes) {
      setStyleAnalysis(null);
      return;
    }
    let cancelled = false;
    void invoke<CommunicationStyleAnalysis>("analyze_communication_style", {
      request: {
        style: {
          register: modes.communication_register,
          length: modes.communication_length,
          instructions: modes.style_instructions,
          sample: modes.style_sample,
        },
      },
    })
      .then((next) => {
        if (!cancelled) setStyleAnalysis(next);
      })
      .catch(() => {
        if (!cancelled) setStyleAnalysis(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    runtime?.active,
    modes?.communication_register,
    modes?.communication_length,
    modes?.style_instructions,
    modes?.style_sample,
  ]);
  const capture = profile ? resolveProfileCaptureSettings(profile) : null;
  const isActive = Boolean(profile && profile.id === config?.active_text_profile_id);
  const flagCount = health?.flags.length ?? 0;

  /* ONE READ AND ONE WRITE PER VALUE, and the branch is where the value comes
     FROM rather than how the card is drawn — the discipline `PartlyWiredScreenProps`
     exists for. The two selects are discrete and take `patch`; the two
     textareas are prose and take `patchText` (plan P1). */
  const register = runtime ? (modes?.communication_register ?? "off") : drawnRegister;
  const length = runtime ? (modes?.communication_length ?? "normal") : drawnLength;
  const styleRules = runtime ? (modes?.style_instructions ?? "") : drawnRules;
  const styleSample = runtime ? (modes?.style_sample ?? "") : drawnSample;
  const styleActive = register !== "off";
  const mode = runtime ? (work?.processing_mode ?? "auto") : drawnMode;
  const targetLanguage = runtime
    ? (modes?.translate_target_language ?? "en")
    : drawnTargetLanguage;
  const keepProfileWords = runtime
    ? (modes?.translate_keep_profile_words ?? true)
    : drawnKeepWords;

  const writeModes = (next: Partial<ProfileModesSettings>, kind: "discrete" | "text" = "discrete") =>
    write(
      (current) => ({
        ...current,
        modes: { ...resolveProfileModesSettings(current), ...next },
      }),
      kind,
    );

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
                visible on all six. Duplicate and Export went with it — they
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
                            value={mode}
                            onChange={(event) => {
                              const next = event.target.value as ProcessingMode;
                              if (!runtime) {
                                setDrawnMode(next);
                                return;
                              }
                              write((current) => ({
                                ...current,
                                work_mode: {
                                  ...resolveTextProfileWorkMode(current),
                                  processing_mode: next,
                                },
                              }));
                            }}
                            aria-label="Processing mode"
                          >
                            {MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        }
                      />
                      {/* The two rows that only exist for one mode, and only
                          while that mode is chosen. They are the profile's own
                          values — ADR 0068 already ruled that a per-profile
                          value does not belong on the machine-scope AI Models
                          screen, and these two were the last ones sitting
                          there. AI Models keeps them drawn with the `Per
                          profile` tag that points here, which is what a scope
                          tag is for.

                          Hidden rather than disabled when the mode is something
                          else, and that is the one place ADR 0065 does not
                          apply: a disabled control states "this cannot act
                          right now", and a target language under Cleanup is not
                          inert, it is irrelevant. */}
                      {mode === "translate" && (
                        <>
                          <Row
                            label="Into"
                            hint="One target, fixed. Reading it from the focused window is a guess, and a guess that silently changes the language you are writing in is worse than a wrong keystroke."
                            control={
                              <Select
                                value={targetLanguage}
                                onChange={(event) => {
                                  if (!runtime) {
                                    setDrawnTargetLanguage(event.target.value);
                                    return;
                                  }
                                  writeModes({ translate_target_language: event.target.value });
                                }}
                                aria-label="Into"
                              >
                                {TRANSLATE_LANGUAGES.map((language) => (
                                  <option key={language.code} value={language.code}>
                                    {language.label}
                                  </option>
                                ))}
                              </Select>
                            }
                          />
                          <Row
                            label="Keep this profile's words"
                            hint="The names, products and terms on Words &amp; names stay in their own spelling. They are what a translator must leave alone and a model will localize."
                            control={
                              <Toggle
                                checked={keepProfileWords}
                                onCheckedChange={(next) => {
                                  if (!runtime) {
                                    setDrawnKeepWords(next);
                                    return;
                                  }
                                  writeModes({ translate_keep_profile_words: next });
                                }}
                                aria-label="Keep this profile's words"
                              />
                            }
                          />
                        </>
                      )}
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
                    {/* THE FIFTH ROW IS HOW ADR 0023'S SCOPE GETS SAID ONCE
                        (ADR 0068). The other four rows are the four content
                        tabs and the third column already names a scope per row;
                        Style is the one setting on this screen that does not
                        apply to every mode, and stating that here is what
                        §11.4's "its scope named on each" was protecting —
                        by a mechanism the profile already has, in one place
                        instead of two cards that can disagree.

                        It goes FIRST rather than appended, because the rows
                        read in the order of the tabs they name and Style is
                        tab two. A legend whose order disagrees with the tab
                        row above it makes the reader match by name. */}
                    <Legend>
                      <LegendRow name="Style" what="sets how a sentence is built" where="Rewrite and the assistant" />
                      <LegendRow name="Context" what="steers which word the AI picks" where="AI modes" />
                      <LegendRow name="Words & names" what="repairs mangled terms" where="recognizer + AI" />
                      <LegendRow name="Replacements" what="exact swap, before the AI" where="every mode" />
                      <LegendRow name="Snippets" what="phrase expands to a block" where="every mode" />
                    </Legend>
                  </Card>
                </>
              )}

              {tab === "Style" && (
                <>
                  <Card
                    title="Communication style"
                    description="How this profile writes. Rewrite and the assistant only — Cleanup, Verbatim and Prompt Enhance are untouched."
                  >
                    <CardRows>
                      {/* The hint IS the register's definition and it changes
                          with the value, because six levels described in one
                          static sentence is six levels nobody can tell apart. */}
                      <Row
                        label="Writes to"
                        hint={REGISTER_DESCRIPTIONS[register]}
                        control={
                          <Select
                            value={register}
                            onChange={(event) => {
                              const next = event.target.value as CommunicationRegister;
                              if (!runtime) {
                                setDrawnRegister(next);
                                return;
                              }
                              writeModes({ communication_register: next });
                            }}
                            aria-label="Communication register"
                          >
                            {REGISTER_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        }
                      />
                      <Row
                        label="Length"
                        hint="Independent of the register above: formal and terse is as valid as formal and expansive."
                        control={
                          <Select
                            value={length}
                            disabled={!styleActive}
                            onChange={(event) => {
                              const next = event.target.value as CommunicationLength;
                              if (!runtime) {
                                setDrawnLength(next);
                                return;
                              }
                              writeModes({ communication_length: next });
                            }}
                            aria-label="Communication length"
                          >
                            {LENGTH_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        }
                      />
                      <Row
                        layout="stack"
                        label="Your rules"
                        hint="One rule per line. They outrank the register where the two touch, and they describe how to write, never what to write. The meter counts what the prompt gets: repeated lines and anything past 120 characters in one line are dropped before it is counted."
                      >
                        <FieldWrap>
                          <TextArea
                            rows={4}
                            value={styleRules}
                            disabled={!styleActive}
                            placeholder={"no emoji\nkeep it under five sentences"}
                            aria-label="Style rules"
                            onChange={(event) => {
                              if (!runtime) {
                                setDrawnRules(event.target.value);
                                return;
                              }
                              writeModes({ style_instructions: event.target.value }, "text");
                            }}
                            onBlur={runtime ? () => runtime.flushText() : undefined}
                          />
                          <BudgetMeter
                            used={styleAnalysis?.instructions.used_chars ?? styleRules.trim().length}
                            max={styleAnalysis?.instructions.max_chars ?? DRAWN_STYLE_BUDGET}
                          />
                        </FieldWrap>
                      </Row>
                      <Row
                        layout="stack"
                        label="Writing sample"
                        hint="A few lines you actually wrote. Tone, sentence shape and your expressions come from it — never its content."
                      >
                        <FieldWrap>
                          <TextArea
                            rows={4}
                            value={styleSample}
                            disabled={!styleActive}
                            placeholder="morning, pushing the call to monday, hope that works"
                            aria-label="Writing sample"
                            onChange={(event) => {
                              if (!runtime) {
                                setDrawnSample(event.target.value);
                                return;
                              }
                              writeModes({ style_sample: event.target.value }, "text");
                            }}
                            onBlur={runtime ? () => runtime.flushText() : undefined}
                          />
                          <BudgetMeter
                            used={styleAnalysis?.sample.used_chars ?? styleSample.trim().length}
                            max={styleAnalysis?.sample.max_chars ?? DRAWN_STYLE_BUDGET}
                          />
                        </FieldWrap>
                      </Row>
                    </CardRows>
                  </Card>

                  {/* Off is not "nothing set": the fields keep whatever they
                      hold and the prompt sees none of it. Said under the card
                      rather than on each of the three controls — one reason,
                      one sentence — because a disabled control cannot carry a
                      tooltip and three copies of it would be furniture. */}
                  {styleActive ? (
                    <Note icon="wand">
                      Slang and the expressions you use come from your rules and your sample. The
                      model is forbidden from supplying either on its own, because misplaced slang
                      reads worse than none.
                    </Note>
                  ) : (
                    <Note icon="alert">{STYLE_IS_OFF}</Note>
                  )}
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
