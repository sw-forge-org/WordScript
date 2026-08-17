import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  AddButton,
  AnswerPanel,
  BudgetMeter,
  Button,
  Card,
  CardRows,
  ConfirmPanel,
  DocLink,
  EditorPanel,
  Field,
  FieldWrap,
  Flag,
  FlagPanel,
  Icon,
  IconButton,
  Legend,
  LegendRow,
  ListItem,
  ListRows,
  RowMenu,
  type MenuEntry,
  Note,
  Pane,
  PaneDetailHead,
  PaneDetailMain,
  PaneListHead,
  PaneRow,
  PaneScroll,
  Reorder,
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
  type EditorFieldSpec,
  type EditorIssue,
  type TermChip,
} from "@/components/shell";
import { formatBudgetDuration, useCaptureBudget } from "@/hooks/useCaptureBudget";
import { PROCESSING_MODE_LABELS } from "@/lib/transformRules";
import {
  buildTextProfilesPatch,
  clearTextProfileCuration,
  createDictionaryEntry,
  createSnippetEntry,
  createTextProfile,
  describeTextProfileWorkMode,
  duplicateTextProfile,
  moveEntry,
  PROFILE_LOCKED_HINT,
  profileSwitchLocked,
  resolveConfigJobProvider,
  resolveProfileCaptureSettings,
  resolveProfileModesSettings,
  resolveTextProfileWorkMode,
  textRulesDocumentFromProfile,
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
import type { ProfileHealthFlag, ProfileHealthStatus, TextRulesAnalysis } from "@/types/textRules";
import type { WiredScreenProps } from "./props";

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
 * FIVE CONTROLS GOT THEIR SURFACE IN LEG 7 AND THE REASONS THEY CARRIED WENT
 * WITH THEM (ADR 0082). Add and Edit on both rule lists, New profile's rename,
 * More's menu, and the two calls to `analyze_text_rules` all open a panel that
 * unfolds where they stand — the same plane `RawPanel` opens on, because a
 * second dialog over a surface that is already a modal sheet is the weight
 * ADR 0069 took off Help. The rule lists grew reordering with them: the runtime
 * folds one entry's output into the next, so their order is a value the reader
 * could neither see nor set.
 *
 * THE FLAG'S CLICK WAS THE LAST INERT CONTROL AND LEG 8 GAVE IT THE ONLY
 * DESTINATION THAT FITS FOUR KINDS (ADR 0085). One click on an aggregate count
 * cannot route to three tabs, so it routes to none of them: it opens the panel
 * that LISTS them, one row per flag, each with the door to the tab that holds
 * its cause. `form_conflict` and `cleanup_interference` come from the prompt
 * and open Context; `length_bias` comes from the replacements and opens
 * Replacements; `bias_policy_weak` opens **Defaults**, where the processing
 * mode is — not Words, which only shows the effect and sets nothing.
 *
 * Each row also acknowledges. `profile_health_acknowledged_flags` has been on
 * the wire since before the port and had no reader here since Leg 3 deleted
 * `PromptsTab.tsx`, so `derive_health_level` was computing a level out of a set
 * nothing could write — a warning with no way to close it. The flag carries
 * that level as its tone, which is what makes acknowledging visible at all.
 *
 * THE SCREEN IS WIRED AND HAS LEFT THE GALLERY (ADR 0057). Every fact on it has
 * a source, so `runtime` is required, the drawn branch and its `DRAWN_*` rows
 * are gone, and `npm run port:diff` no longer measures it — the departures
 * ADR 0068 and ADR 0082 recorded are settled rather than carried.
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

/**
 * WHAT THE EDITOR ASKS FOR, PER KIND (ADR 0082).
 *
 * `required` is not a UI nicety here: `apply_dictionary_entries` and
 * `apply_snippet_entries` both `continue` past an entry whose halves are empty
 * after trimming, so saving one writes a rule that is drawn in the list and
 * never runs — the silent kind of wrong this whole surface exists against. A
 * snippet's NAME is the one field that may be blank, because the runtime falls
 * back to the trigger for it and the row already draws that fallback.
 */
const REPLACEMENT_FIELDS: EditorFieldSpec[] = [
  { key: "phrase", label: "What you say", placeholder: "e.g. hdb", required: true },
  {
    key: "replace_with",
    label: "What gets written",
    placeholder: "e.g. Herzliche Grüße",
    required: true,
  },
];

const SNIPPET_FIELDS: EditorFieldSpec[] = [
  { key: "trigger", label: "Trigger phrase", placeholder: "e.g. standard closing", required: true },
  { key: "label", label: "Name", placeholder: "Defaults to the trigger" },
  { key: "expansion", label: "Expands to", multiline: true, required: true },
];

/** One field, which is what makes the panel select its whole value on open —
 *  a rename is a replacement of the name, not an adjustment to it. */
const PROFILE_FIELDS: EditorFieldSpec[] = [
  { key: "label", label: "Profile name", placeholder: "e.g. Support reply", required: true },
];

/** The rule the runtime applies, stated where the rule is being written. Both
 *  lists fold one entry's output into the next (`transform.rs`), which is why
 *  the rows can be reordered at all. */
const ORDER_NOTE = "Runs in order. A later rule sees what an earlier one wrote.";

/** A profile's name as the SUGGESTED half of a save dialog's filename — the
 *  user still names the file. Only the characters a path separator or a shell
 *  would make ambiguous are folded away; the dialog is what writes the path. */
function slugForFile(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "profile"
  );
}

/**
 * WHAT YOU CAN DO TO A ROW — at the row, on every list, in one shape
 * (ADR 0082).
 *
 * The screen had grown three idioms for one job: a menu on the profile rows, a
 * run of four icons on the rule rows, and nothing at all on Context. The owner
 * named it as redundancy and it was. **A right-click answers on every row**,
 * with the same compact menu of verbs; the only thing that stays an ICON on a
 * row is what you repeat positionally, which is the reorder pair.
 *
 * The panel is `fixed` at a measured point, because the pane head hides its
 * overflow and a list scrolls: the first build shipped a menu cut off at its
 * second entry, found in the running app and by no test.
 *
 * VERBS, NOT DESCRIPTIONS. `.ws-menu` was built for destinations worth reading
 * and carries a hint per entry; three verbs with sentences under them make a
 * 230 px panel out of a list of three words, which the owner saw and said so.
 * An entry with no hint draws the menu narrow.
 */
/**
 * WHAT EACH FLAG IS CALLED, AND WHICH TAB CAN DO ANYTHING ABOUT IT (ADR 0085).
 *
 * The runtime answers with a `kind` and a sentence; neither is a name a reader
 * can scan a list by, and neither says where to go. The `where` column is the
 * tab holding the value the detector READ — not the tab that displays its
 * effect, which is the distinction that put `bias_policy_weak` on Defaults:
 * `detect_bias_policy_weak` fires on `bias_mode` together with
 * `processing_mode`, `bias_mode` has no control anywhere in the product, and
 * the processing mode is a select on Defaults. Words draws the effective bias
 * as a readout and sets nothing, so a door to it would promise a repair it
 * cannot perform.
 */
const FLAG_KINDS: Record<
  ProfileHealthFlag["kind"],
  { name: string; where: (typeof TABS)[number]; severe: boolean }
> = {
  form_conflict: { name: "Contradictory style instructions", where: "Context", severe: true },
  cleanup_interference: {
    name: "Instructions that suppress the cleanup",
    where: "Context",
    severe: false,
  },
  length_bias: { name: "Replacements that all pull one way", where: "Replacements", severe: false },
  bias_policy_weak: { name: "No transcription bias under this mode", where: "Defaults", severe: true },
};

/** The runtime's own name for the flag, with the one detail it carries beyond
 *  its sentence: a length bias has a direction and a count, and "3 of 4
 *  expanding" is what tells the reader whether the heuristic caught something
 *  real or caught their whole list. */
function flagName(flag: ProfileHealthFlag): string {
  const base = FLAG_KINDS[flag.kind].name;
  if (flag.kind !== "length_bias") return base;
  return `${base} — ${flag.direction === "inflating" ? "expanding" : "shrinking"}, ${flag.entry_count} ${
    flag.entry_count === 1 ? "entry" : "entries"
  }`;
}

function termsOf(profile: TextProfile): TermChip[] {
  return profile.vocabulary_hints.map((hint) => ({
    term: hint.phrase,
    origin: hint.origin === "learned" ? "learned" : "added",
  }));
}

/** A list on one line, or the sentence that says it is empty. A blank block in
 *  a readout reads as a surface that did not run rather than as an empty
 *  answer, which is the same defect the sample panel's foot avoids. */
function listOrNone(items?: string[]) {
  return items && items.length > 0 ? items.join(" · ") : "None.";
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

export function ProfilesScreen({ banner, runtime }: WiredScreenProps) {
  const config = runtime.config;
  const [tab, setTab] = useState(TABS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [health, setHealth] = useState<ProfileHealthStatus | null>(null);
  const [styleAnalysis, setStyleAnalysis] = useState<CommunicationStyleAnalysis | null>(null);
  const [term, setTerm] = useState("");

  const profiles = config.text_profiles;
  const profile =
    profiles.find((entry) => entry.id === selectedId) ??
    profiles.find((entry) => entry.id === config.active_text_profile_id) ??
    profiles[0];

  /* Keyed on the recogniser's vendor, because that is what the ceiling is
     bound by — a profile whose chat jobs sit elsewhere does not change what
     one recording may cost (ADR 0094).
     And on THAT VENDOR'S plan, not on the machine's (ADR 0167): the key used to
     read one global string, so changing the plan of a vendor this profile does
     not recognise with refreshed a ceiling that had not moved, while the axis it
     now reads makes the opposite mistake possible instead — a plan change on the
     vendor in the key must refresh, and nothing else may. */
  const dictationProvider = resolveConfigJobProvider(config, "dictation").provider;
  const { budget } = useCaptureBudget(
    `${dictationProvider}:${config.provider_plans?.[dictationProvider] ?? ""}:${config.local_model}`,
  );

  /** WHICH FLAGS THIS PROFILE HAS ALREADY READ AND ACCEPTED (ADR 0085).
   *
   *  Read straight off the config rather than kept beside it, because the
   *  runtime merges the same map off disk when it grades the profile — two
   *  copies of one set is how the flag and its level start disagreeing. */
  const acknowledged = useMemo(
    () => (profile ? (config.profile_health_acknowledged_flags?.[profile.id] ?? []) : []),
    [config.profile_health_acknowledged_flags, profile?.id],
  );

  /* The runtime grades the profile from what it holds — the prompt, the
     replacements, the mode. Re-read when any of those change, because a flag
     that survives an edit that fixed it is worse than no flag.

     THE ACKNOWLEDGED SET IS A DEPENDENCY AND IT IS THE ONE THAT ONLY BREAKS
     ONCE A WRITE COMES BACK. Acknowledging changes nothing the detectors look
     at, so without it in this list the level would keep the value it had before
     the write — a flag acknowledged and still amber until something unrelated
     re-ran the effect. The set is also PASSED rather than left to the disk read
     inside the command: the config write is in flight when this fires, and the
     copy in hand is the newer of the two. */
  useEffect(() => {
    if (!runtime.active || !profile) return;
    let cancelled = false;
    void invoke<ProfileHealthStatus>("get_profile_health", {
      request: {
        prompt: profile.prompt,
        dictionary_entries: profile.dictionary_entries,
        acknowledged_flags: acknowledged,
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
  }, [
    runtime.active,
    profile?.id,
    profile?.prompt,
    profile?.dictionary_entries,
    profile?.work_mode,
    acknowledged,
  ]);

  /** Every write on this screen targets the SELECTED profile, which is not
   *  necessarily the active one — `buildProfile*Patch` in `lib/textProfiles`
   *  all act on the active profile and are the wrong tool here. Editing a
   *  profile also drops its curated marking, exactly as the pre-port area did:
   *  a curated profile the user has changed is no longer the curated one. */
  const write = (
    update: (current: TextProfile) => TextProfile,
    kind: "discrete" | "text" = "discrete",
  ) => {
    if (!profile) return;
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

  /**
   * WHICH EDITOR IS OPEN, AND EXACTLY ONE IS (ADR 0082).
   *
   * Two open panels would make Escape ambiguous and would let two drafts of two
   * rules exist at once — a Cancel that has to be right about which one it
   * discards. `id: null` is the Add case, where the panel is drawn at the foot
   * of the list it will append to rather than under a row.
   *
   * A rule commits through `patch` and not `patchText`, which is the opposite
   * of the Context tab one tab over. The draft lives in the panel until Save
   * (that is what makes Cancel able to throw it away), so what reaches the
   * config is one finished value rather than a keystroke — which is the
   * discrete case plan P1 draws the line at.
   */
  const [editing, setEditing] = useState<{
    kind:
      | "replacement"
      | "snippet"
      | "profile"
      | "delete-profile"
      | "delete-replacement"
      | "delete-snippet";
    id: string | null;
  } | null>(null);

  /**
   * WHICH ANSWER IS UNFOLDED, AND EXACTLY ONE IS — the readout half of the same
   * rule `editing` holds for the commit half (ADR 0082).
   *
   * `health` joined the two `analyze_text_rules` answers in Leg 8 rather than
   * getting a flag of its own, because they are the same kind of thing: a panel
   * the runtime fills, opened from the control that asked, closed by Close. One
   * state is also what keeps the sample answer from standing open behind a
   * health panel two cards above it.
   */
  const [answer, setAnswer] = useState<"sample" | "bias" | "health" | "export" | null>(null);

  /**
   * WHAT THE LAST RULES EXPORT DID (ADR 0090), and it is a property of the
   * PROFILE rather than of a tab — so it opens where the health flag's panel
   * opens, above the sub-tabs, and not inside whichever tab happened to be
   * open when the menu was used.
   *
   * The analysis comes back with the path because `export_text_rules` returns
   * one, and a file you are about to send somebody is the last moment at which
   * knowing it carries a blocking issue is still cheap.
   */
  const [exported, setExported] = useState<
    { path: string; analysis: TextRulesAnalysis } | { error: string } | null
  >(null);
  const [exporting, setExporting] = useState(false);

  /** Where a row menu is open, on which row, and of which kind. One at a time,
   *  and the point is measured rather than derived: `.ws-menu` leaves the flow
   *  so no ancestor can clip it. */
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    kind: "profile" | "replacement" | "snippet";
    id: string;
  } | null>(null);

  /** What the runtime said when it declined a switch, in its own words
   *  (ADR 0197). Held in state rather than logged, because the log is not on
   *  screen; cleared on the next attempt, so a refusal cannot outlive the
   *  condition that caused it. */
  const [refused, setRefused] = useState<string | null>(null);


  /**
   * An open panel belongs to the row it was opened on, so leaving that row
   * drops the draft rather than letting it reappear over a different rule.
   *
   * IT WATCHES THE TAB AND NOT THE PROFILE, AND THE NATIVE HOST IS WHAT SAID
   * SO. The first version also cleared on `profile?.id`, which is a value
   * DERIVED from the config — so `New profile` opened the rename, the config
   * write landed one render later, the id changed, and the effect closed the
   * panel that the same click had just opened. The profile is cleared where the
   * user actually changes it (the list row below) instead, which is the same
   * rule without a race against a write.
   *
   * Every unit test passed through this: `patch` is a mock that does not feed
   * the config back, so `profile?.id` never moved and the effect never fired a
   * second time. A precondition that only breaks once a write comes back is
   * invisible to a test that never returns one — the class Leg 6 recorded one
   * layer up.
   */
  useEffect(() => {
    setEditing(null);
    setAnswer(null);
  }, [tab]);

  const saveReplacement = (id: string | null, values: Record<string, string>) => {
    write((current) => ({
      ...current,
      dictionary_entries:
        id === null
          ? [...current.dictionary_entries, createDictionaryEntry(values.phrase, values.replace_with)]
          : current.dictionary_entries.map((entry) =>
              entry.id === id
                ? { ...entry, phrase: values.phrase, replace_with: values.replace_with }
                : entry,
            ),
    }));
    setEditing(null);
  };

  const saveSnippet = (id: string | null, values: Record<string, string>) => {
    write((current) => ({
      ...current,
      snippet_entries:
        id === null
          ? [
              ...current.snippet_entries,
              createSnippetEntry(values.trigger, values.expansion, values.label),
            ]
          : current.snippet_entries.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    trigger: values.trigger,
                    expansion: values.expansion,
                    label: values.label,
                  }
                : entry,
            ),
    }));
    setEditing(null);
  };

  /* A NEW PROFILE ARRIVES ASKING FOR ITS NAME. `createTextProfile` produces one
     called "New profile", which was the whole reason the control was inert: a
     surface that can make a thing and not name it leaves the naming to whoever
     finds it later. Selecting it and opening the rename is one gesture. */
  const newProfile = () => {
    const created = createTextProfile();
    runtime.patch(
      buildTextProfilesPatch(
        config,
        [...config.text_profiles, created],
        config.active_text_profile_id,
      ),
    );
    setSelectedId(created.id);
    setTab(TABS[0]);
    setEditing({ kind: "profile", id: created.id });
  };

  /**
   * DELETING IS THE ONE ACTION HERE THAT CANNOT BE UNDONE, so two things guard
   * it: the menu entry only OPENS the question (`ConfirmPanel`), and the last
   * remaining profile refuses outright — `resolve_active_text_profile` has to
   * find one, and a config with an empty list is a state no screen can repair.
   *
   * Deleting the ACTIVE profile hands the session to the first one left rather
   * than leaving `active_text_profile_id` pointing at nothing. A running
   * capture is unaffected: it keeps what it started with (ADR 0025).
   */
  const deleteProfile = (id: string) => {
    const rest = config.text_profiles.filter((entry) => entry.id !== id);
    if (rest.length === 0) return;
    runtime.patch(
      buildTextProfilesPatch(
        config,
        rest,
        config.active_text_profile_id === id ? rest[0].id : config.active_text_profile_id,
      ),
    );
    if (selectedId === id) setSelectedId(rest[0].id);
    setEditing(null);
  };

  const duplicateProfile = () => {
    if (!profile) return;
    const copy = duplicateTextProfile(profile, `${profile.label} copy`);
    runtime.patch(
      buildTextProfilesPatch(
        config,
        [...config.text_profiles, copy],
        config.active_text_profile_id,
      ),
    );
    setSelectedId(copy.id);
    setEditing({ kind: "profile", id: copy.id });
  };

  /**
   * WRITE THIS PROFILE'S RULES AS A SHAREABLE FILE (ADR 0090).
   *
   * `export_text_rules` has been complete in the runtime since before the port
   * — schema version, analysis, and the merge and conflict resolution its
   * counterpart uses — and had no caller from Leg 3's shell overwrite until
   * this one. The capability was in `ARCHITECTURE.md` the whole time, which is
   * how it stayed lost.
   *
   * EXPORT IS THE HALF THAT BELONGS ON A ROW, and the asymmetry is the reason
   * the pair is split across two screens: this acts on the profile the menu
   * opened on, so its target is never in question. Import CREATES a profile and
   * has no row to act on, so it lives on Privacy & Data, where a thing arriving
   * from outside is already what the screen is about.
   */
  const exportRules = async (id: string) => {
    const target = config.text_profiles.find((entry) => entry.id === id);
    if (!target) return;

    const path = await saveFileDialog({
      title: `Export rules of ${target.label}`,
      defaultPath: `wordscript-rules-${slugForFile(target.label)}.json`,
      filters: [{ name: "WordScript text rules", extensions: ["json"] }],
    });
    if (!path) return;

    setExporting(true);
    setAnswer("export");
    // The previous answer goes before the next write starts, or the panel
    // spends the write reporting the path of the file before this one.
    setExported(null);
    try {
      const result = await invoke<{ path: string; analysis: TextRulesAnalysis }>(
        "export_text_rules",
        { request: { path, ...textRulesDocumentFromProfile(target) } },
      );
      setExported({ path: result.path, analysis: result.analysis });
    } catch (cause) {
      setExported({ error: String(cause) });
    } finally {
      setExporting(false);
    }
  };

  const moveReplacement = (index: number, direction: -1 | 1) =>
    write((current) => ({
      ...current,
      dictionary_entries: moveEntry(current.dictionary_entries, index, direction),
    }));

  const moveSnippet = (index: number, direction: -1 | 1) =>
    write((current) => ({
      ...current,
      snippet_entries: moveEntry(current.snippet_entries, index, direction),
    }));

  const snippetRows = useMemo(
    () =>
      (profile?.snippet_entries ?? []).map((item) => ({
        id: item.id,
        title: item.label || item.trigger,
        trigger: item.trigger,
        label: item.label,
        expansion: item.expansion,
      })),
    [profile?.snippet_entries],
  );

  /**
   * A FIRED RULE IS NAMED WITH THE READER'S OWN WORDS, NOT WITH ITS ID.
   *
   * `applied_rules` carries `dictionary:<entry id>` and `snippet:<entry id>`:
   * `transform.rs`'s `rule_label` returns the entry's id whenever it has one
   * and only slugifies the phrase when it does not. The foot below printed that
   * string verbatim under a comment that said *the rules that fired, BY NAME* —
   * a comment asserting a control (ADR 0090), one plane below where Leg 12
   * found the last one.
   *
   * MEASURED, BECAUSE THE WIDTH AND THE STRING HAVE ONE CAUSE (ADR 0092). One
   * fired rule drew `dictionary:curated-founder-ops-dict-wordscript` across
   * **four lines** of a 241 px foot at the 800 px window this plane is normally
   * read at, beside `Close`; the same panel at 992 px drew it on one. Naming
   * the rule is what fixes both, and shortening the id would have fixed
   * neither.
   *
   * AN UNKNOWN ID IS PRINTED AS IT CAME. A rule can fire from an entry that is
   * no longer in the profile being read — the analysis is a request over the
   * draft — and inventing a name for it would be this cluster's own defect:
   * plausible text that is wrong.
   */
  const namedRule = useCallback(
    (rule: string): string => {
      const [kind, ...rest] = rule.split(":");
      const id = rest.join(":");
      if (kind === "dictionary") {
        const entry = profile?.dictionary_entries.find((item) => item.id === id);
        return entry ? `“${entry.phrase}”` : rule;
      }
      if (kind === "snippet") {
        const entry = profile?.snippet_entries.find((item) => item.id === id);
        return entry ? `“${entry.label || entry.trigger}”` : rule;
      }
      return rule;
    },
    [profile?.dictionary_entries, profile?.snippet_entries],
  );

  /**
   * WHAT THE RULES ACTUALLY DO, ASKED OF THE RUNTIME RATHER THAN RECOMPUTED
   * HERE — and it is the command that had nowhere to put its answer.
   *
   * Asked on every edit rather than debounced, for the reason the style meter
   * gives one card over: `analyze_text_rules` is a pure function of its request
   * with no disk and no network in it, and an answer that lags the field it
   * describes is the defect it exists against. It is NOT `get_profile_health`,
   * which does read the config from disk and is asked far less often.
   *
   * The issues come back with `rule_ids`, which is what lets a warning appear
   * under the rule that caused it instead of in a list somewhere that tells you
   * something is wrong and leaves you to find it.
   */
  const [analysis, setAnalysis] = useState<TextRulesAnalysis | null>(null);
  const [sample, setSample] = useState("");

  useEffect(() => {
    if (!runtime.active || !profile) {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    void invoke<TextRulesAnalysis>("analyze_text_rules", {
      request: {
        prompt: profile.prompt,
        stt_hints: profile.stt_hints,
        vocabulary_hints: profile.vocabulary_hints,
        dictionary_entries: profile.dictionary_entries,
        snippet_entries: profile.snippet_entries,
        sample_text: sample.trim().length > 0 ? sample : null,
        bias_mode: profile.work_mode?.bias_mode ?? null,
        local_prompt_strength: config.local_prompt_strength ?? null,
        local_prompt_carry: config.local_prompt_carry ?? null,
        manual_bias: profile.work_mode?.manual_bias ?? null,
      },
    })
      .then((next) => {
        if (!cancelled) setAnalysis(next);
      })
      .catch(() => {
        if (!cancelled) setAnalysis(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    runtime.active,
    profile?.id,
    profile?.prompt,
    profile?.stt_hints,
    profile?.vocabulary_hints,
    profile?.dictionary_entries,
    profile?.snippet_entries,
    profile?.work_mode,
    config.local_prompt_strength,
    config.local_prompt_carry,
    sample,
  ]);

  const bias = analysis?.transcription_bias ?? null;
  const repair = analysis?.vocabulary_repair ?? null;

  const deleteRule = (kind: "replacement" | "snippet", id: string) => {
    write((current) =>
      kind === "replacement"
        ? {
            ...current,
            dictionary_entries: current.dictionary_entries.filter((item) => item.id !== id),
          }
        : { ...current, snippet_entries: current.snippet_entries.filter((item) => item.id !== id) },
    );
    setEditing(null);
  };

  /* WHETHER THE RUNTIME WOULD REFUSE A SWITCH RIGHT NOW (ADR 0197). Derived by
     the same predicate the sidebar picker is handed, so the two cannot disagree
     about what "a session is running" means. */
  const switchLocked = profileSwitchLocked(runtime.state);

  /**
   * MAKE A PROFILE THE ACTIVE ONE, asking the runtime before believing it.
   *
   * A REFUSAL IS SHOWN AND NOT SWALLOWED. `.catch(() => {})` on this call is the
   * whole of the "sometimes it just does not switch" the owner reported against
   * the sidebar picker: the runtime declines, the swallow eats it, and the
   * surface springs back with nothing said. This screen has a notice line under
   * its head, so the refusal goes there in the runtime's own words.
   */
  const activateProfile = (id: string) => {
    setRefused(null);
    void invoke("switch_active_text_profile", { profileId: id })
      .then(() =>
        runtime.patch(buildTextProfilesPatch(config, config.text_profiles, id)),
      )
      .catch((error) =>
        setRefused(typeof error === "string" ? error : "The runtime refused the switch."),
      );
  };

  /**
   * THE ROW'S VERBS, and the same three shapes on every list this screen has.
   *
   * Delete NEVER acts from here. It opens the question under the row, which is
   * the rule that used to hold only for a profile: a rule disappeared on one
   * click with no ask, while the profile that CONTAINS it asked twice. Both are
   * one press plus one confirmation now.
   */
  const menuItems = (): MenuEntry[] => {
    if (!menu) return [];
    if (menu.kind === "profile") {
      const lastOne = listRows.length <= 1;
      const alreadyActive = menu.id === config.active_text_profile_id;
      return [
        /**
         * MAKING A PROFILE ACTIVE IS A THING YOU DO TO A PROFILE, AND THIS IS
         * WHERE YOU DO THINGS TO A PROFILE (ADR 0197).
         *
         * It was reachable from exactly one control in the product — the picker
         * at the foot of the sidebar — which is a `<select>` of every profile by
         * name, on a surface that shows you none of them. The screen that lists
         * them, describes them, flags their health and lets you rename,
         * duplicate, export and delete them could not make one of them the
         * active one. So the row you have already selected in order to look at
         * it is the row that offers it.
         *
         * IT LEADS THE MENU because it is the only entry here that changes what
         * the NEXT dictation does; the other four change a stored object.
         *
         * THE RUNTIME IS STILL THE AUTHORITY AND IS ASKED FIRST, exactly as the
         * sidebar picker asks it: the config is patched only after the command
         * succeeds. Patching first and invoking after is what left that picker
         * showing a profile the runtime had refused to switch to.
         */
        {
          label: "Set as active",
          icon: "check",
          /* Two different reasons it cannot run, and they are not the same fact
             — one is about this profile, the other about right now. Drawn and
             inert with the reason either way (ADR 0065). */
          hint: alreadyActive
            ? "This is already the active profile"
            : switchLocked
              ? PROFILE_LOCKED_HINT
              : undefined,
          disabled: alreadyActive || switchLocked,
          onSelect:
            alreadyActive || switchLocked
              ? undefined
              : () => {
                  setMenu(null);
                  activateProfile(menu.id);
                },
        },
        {
          label: "Rename",
          icon: "type",
          onSelect: () => {
            setMenu(null);
            setEditing({ kind: "profile", id: menu.id });
          },
        },
        {
          label: "Duplicate",
          icon: "copy",
          onSelect: () => {
            setMenu(null);
            duplicateProfile();
          },
        },
        /* A VERB, LIKE ITS THREE NEIGHBOURS, AND IT ACTS ON THIS ROW — which is
           the whole reason only the export half is here (ADR 0090). An Import
           on a row menu would name a target it cannot have: importing makes a
           profile, and the row you opened the menu on is not it. */
        {
          label: "Export rules",
          icon: "download",
          onSelect: () => {
            setMenu(null);
            void exportRules(menu.id);
          },
        },
        {
          label: "Delete",
          icon: "trash",
          /* Something has to be active, and a config with an empty list is a
             state no screen can repair. The only hint in these menus, because
             it is the only entry whose absence needs explaining (ADR 0065). */
          hint: lastOne ? "The last profile cannot be deleted" : undefined,
          disabled: lastOne,
          onSelect: lastOne
            ? undefined
            : () => {
                setMenu(null);
                setEditing({ kind: "delete-profile", id: menu.id });
              },
        },
      ];
    }
    return [
      {
        label: "Edit",
        icon: "type",
        onSelect: () => {
          setMenu(null);
          setEditing({ kind: menu.kind, id: menu.id });
        },
      },
      {
        label: "Delete",
        icon: "trash",
        onSelect: () => {
          setMenu(null);
          setEditing({
            kind: menu.kind === "replacement" ? "delete-replacement" : "delete-snippet",
            id: menu.id,
          });
        },
      },
    ];
  };

  /** What the analysis says about ONE rule, for the panel that edits it. */
  const issuesFor = (id: string): EditorIssue[] =>
    (analysis?.issues ?? [])
      .filter((issue) => issue.rule_ids.includes(id))
      .map((issue) => ({ severity: issue.severity, message: issue.message }));

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
    if (!runtime.active || !modes) {
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
    runtime.active,
    modes?.communication_register,
    modes?.communication_length,
    modes?.style_instructions,
    modes?.style_sample,
  ]);
  const capture = profile ? resolveProfileCaptureSettings(profile) : null;
  const isActive = Boolean(profile && profile.id === config.active_text_profile_id);
  const flags = health?.flags ?? [];

  /**
   * READ AND ACCEPTED, OR READ AND ACCEPTED NO LONGER (ADR 0085).
   *
   * It writes through `patch` — the seam every other discrete control on this
   * screen uses — rather than through `acknowledge_profile_health_flag`, which
   * is the same operation as a targeted config edit and predates the seam. One
   * write, one path, and the config comes back through the channel the health
   * effect is already watching.
   */
  const acknowledge = (kind: string, next: boolean) => {
    if (!profile) return;
    const all = { ...(config.profile_health_acknowledged_flags ?? {}) };
    const mine = new Set(all[profile.id] ?? []);
    if (next) mine.add(kind);
    else mine.delete(kind);
    /* An empty entry is dropped rather than stored empty, which is what the
       runtime's own `unacknowledge_profile_health_flag` does with the last one
       out — a map full of empty sets is a config that grows with every flag
       anybody ever looked at. */
    if (mine.size === 0) delete all[profile.id];
    else all[profile.id] = [...mine];
    runtime.patch({ profile_health_acknowledged_flags: all });
  };

  const register = modes?.communication_register ?? "off";
  const length = modes?.communication_length ?? "normal";
  const styleRules = modes?.style_instructions ?? "";
  const styleSample = modes?.style_sample ?? "";
  const styleActive = register !== "off";
  const mode = work?.processing_mode ?? "auto";
  const targetLanguage = modes?.translate_target_language ?? "en";
  const keepProfileWords = modes?.translate_keep_profile_words ?? true;

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
      profiles.map((entry) => ({
        id: entry.id,
        title: entry.label,
        sub: describeTextProfileWorkMode(entry),
      })),
    [profiles],
  );
  const currentId = profile?.id;

  const ceilingLabel = budget ? formatBudgetDuration(budget.ceiling_seconds) : null;
  const autoStopMaxMinutes = budget ? Math.max(1, Math.floor(budget.ceiling_seconds / 60)) : 30;

  return (
    <>
      <ViewTop
        title="Profiles"
        lead="What a profile knows, and what it changes about how you are written."
        banner={banner}
      />

      {/* A REFUSAL THE READER CAN SEE (ADR 0197). The runtime declines a switch
          during a session and can decline for other reasons too; a screen that
          swallowed that would leave a menu entry which silently does nothing —
          the same defect the sidebar picker shipped with. It clears on the next
          attempt, so a refusal cannot outlive the condition that caused it. */}
      {refused && <Note icon="alert">{refused}</Note>}

      <Pane
        list={
          <>
            <PaneListHead
              title="Profiles"
              count={String(listRows.length)}
              addLabel="New profile"
              onAdd={newProfile}
            />
            <PaneScroll>
              {listRows.map((row) => (
                <PaneRow
                  key={row.id}
                  icon="profiles"
                  title={row.title}
                  sub={row.sub}
                  current={row.id === currentId}
                  onClick={() => {
                    setEditing(null);
                    setAnswer(null);
                    setSelectedId(row.id);
                  }}
                  /* The row is picked as well as targeted: a menu that acts on
                     something other than what the detail is showing is how you
                     rename the wrong profile. */
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setEditing(null);
                    setAnswer(null);
                    setSelectedId(row.id);
                    setMenu({ x: event.clientX, y: event.clientY, kind: "profile", id: row.id });
                  }}
                />
              ))}
            </PaneScroll>
          </>
        }
        detail={
          <>
            {/* The health flag lives in the detail header. It is a property of
                the profile, not of the Defaults tab, and from here it is
                visible on all six. Duplicate and Export went with it — they
                are things you do to a profile rarely and from the list.

                THAT SENTENCE WAS TRUE OF DUPLICATE AND NOT OF EXPORT UNTIL LEG
                10. The row menu shipped in Leg 7 with three verbs and this
                comment kept naming four, which is the same defect one layer
                down from `ARCHITECTURE.md` claiming the UI did text-rules
                import/export for six legs: a note asserting a control is
                indistinguishable from the control (ADR 0090). */}
            <PaneDetailHead
              title={profile?.label ?? "No profile"}
              description={
                isActive
                  ? "Active in this session"
                  : (profile && describeTextProfileWorkMode(profile)) || ""
              }
              actions={
                <>
                  {isActive && <StatusBadge tone="success">Active</StatusBadge>}
                  {/* THE COUNT IS EVERY FLAG AND THE TONE IS THE RUNTIME'S
                      LEVEL, WHICH ARE TWO DIFFERENT FACTS (ADR 0085). An
                      acknowledged flag is still true — the prompt still
                      contradicts itself — so it stays in the count and in the
                      list; what acknowledging changes is whether it colours the
                      profile. Dropping it from the count instead would leave
                      the panel that lists it unreachable at zero. */}
                  {flags.length > 0 && (
                    <Flag
                      tone={health?.level === "red" ? "red" : health?.level === "green" ? "green" : "yellow"}
                      title={flags.map((flag) => flag.hint).join(" ")}
                      onClick={() => {
                        setEditing(null);
                        setAnswer(answer === "health" ? null : "health");
                      }}
                    >
                      {`${flags.length} ${flags.length === 1 ? "flag" : "flags"}`}
                    </Flag>
                  )}
                  {/* The same menu, from the header, for a pointer that has
                      not been taught the row carries one. It opens under the
                      button rather than at the cursor, which is where a menu
                      opened by a CLICK belongs. */}
                  <IconButton
                    label="More"
                    icon={<Icon name="updown" />}
                    on={Boolean(menu)}
                    onClick={(event) => {
                      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenu(
                        menu
                          ? null
                          : {
                              x: box.right - 132,
                              y: box.bottom + 6,
                              kind: "profile",
                              id: currentId ?? "drawn",
                            },
                      );
                    }}
                  />
                </>
              }
            />
            <PaneDetailMain>
              {/* THE FLAG'S PANEL OPENS UNDER THE HEAD IT SITS IN (ADR 0085),
                  where the rename already opens — the head hides its overflow,
                  so a panel drawn INSIDE it would be clipped at its second row,
                  which is the defect the owner found in the running app in
                  Leg 7 and no test could see.

                  It is above the sub-tabs on purpose. A flag is a property of
                  the profile rather than of any one tab, and its rows send the
                  reader to three different tabs — a panel below the tab row
                  would look like it belonged to whichever tab was open. */}
              {answer === "health" && flags.length > 0 && (
                <FlagPanel
                  flags={flags.map((flag) => ({
                    kind: flag.kind,
                    name: flagName(flag),
                    hint: flag.hint,
                    where: FLAG_KINDS[flag.kind].where,
                    severe: FLAG_KINDS[flag.kind].severe,
                    acknowledged: acknowledged.includes(flag.kind),
                  }))}
                  onOpen={(where) => setTab(where)}
                  onAcknowledge={acknowledge}
                  onClose={() => setAnswer(null)}
                />
              )}

              {/* THE EXPORT ANSWERS WHERE THE PROFILE IS (ADR 0090), on the
                  flag panel's plane and for the flag panel's reason: the menu
                  that asked is reachable from all six tabs, so an answer drawn
                  inside one of them would be somewhere else half the time.

                  IT NAMES THE FILE AND WHAT IS IN IT. A path alone leaves the
                  reader to open the file to find out whether the words came
                  with it, and the counts are the cheapest possible answer to
                  the question the export was asked in order to settle. The
                  second column says where a rules file comes back IN, because
                  this menu deliberately has no Import and a door that exists
                  only on another screen is one the reader has to be told
                  about. */}
              {answer === "export" && (
                <AnswerPanel
                  onClose={() => {
                    setAnswer(null);
                    setExported(null);
                  }}
                  columns={[
                    {
                      label: exporting
                        ? "Writing"
                        : exported && "error" in exported
                          ? "Export failed"
                          : "Written",
                      body: (
                        <p>
                          {exporting
                            ? "Writing the file…"
                            : exported === null
                              ? "Nothing was written."
                              : "error" in exported
                                ? exported.error
                                : `${profile?.prompt.trim() ? "The prompt, " : ""}${
                                    profile?.vocabulary_hints.length ?? 0
                                  } words, ${profile?.dictionary_entries.length ?? 0} replacements and ${
                                    profile?.snippet_entries.length ?? 0
                                  } snippets went to ${exported.path}.`}
                        </p>
                      ),
                    },
                    {
                      label: "Coming back in",
                      body: (
                        <p>
                          A rules file is imported on Privacy &amp; Data, where it lands as a new
                          profile.
                          {exported !== null &&
                          !("error" in exported) &&
                          exported.analysis.blocking
                            ? " What was written still has a blocking issue — the file carries it too."
                            : ""}
                        </p>
                      ),
                    },
                  ]}
                />
              )}

              {/* THE RENAME OPENS UNDER THE TITLE IT CHANGES. It is the same
                  panel the rule lists use, in the one place on this screen
                  where the value being edited is the heading above it — which
                  is also where `New profile` leaves you standing, so a profile
                  called "New profile" is a name you have already been asked
                  for rather than one you have to go and find (ADR 0082). */}
              {/* IT WAITS FOR THE PROFILE IT NAMES. The panel seeds its draft
                  once, at mount, and `New profile` opens it one render before
                  the config write comes back — so mounting it immediately
                  seeded the field with the PREVIOUS profile's name and left it
                  there, because the key had not changed. Rendering it only when
                  the target is the current profile makes the mount and the
                  value arrive together. */}
              {/* The question opens where the profile is, with its name and
                  its lists still on screen behind it — which is the evidence a
                  centred confirm would cover up. */}
              {editing?.kind === "delete-profile" && (
                <ConfirmPanel
                  question={`Delete ${profile?.label ?? "this profile"}?`}
                  detail={
                    profile
                      ? `${profile.dictionary_entries.length} replacements, ${profile.snippet_entries.length} snippets and ${profile.vocabulary_hints.length} words go with it.`
                      : undefined
                  }
                  confirmLabel="Delete profile"
                  onConfirm={() => editing.id && deleteProfile(editing.id)}
                  onCancel={() => setEditing(null)}
                />
              )}

              {editing?.kind === "profile" && profile?.id === editing.id && (
                <EditorPanel
                  key={editing.id ?? "new"}
                  fields={PROFILE_FIELDS}
                  initial={{ label: profile?.label ?? "" }}
                  saveLabel="Rename"
                  onSave={(values) => {
                    write((current) => ({ ...current, label: values.label }));
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              )}
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
                                onChange={(event) =>
                                  writeModes({ translate_target_language: event.target.value })
                                }
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
                                onCheckedChange={(next) =>
                                  writeModes({ translate_keep_profile_words: next })
                                }
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
                              work?.insert_behavior === "clipboard_only"
                                ? "Clipboard only"
                                : "Insert at cursor"
                            }
                            onChange={(next) => {
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
                            checked={Boolean(modes?.collect_workspace_context)}
                            onCheckedChange={(next) => {
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
                            value={capture?.silence_timeout_seconds ?? 0}
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
                          budget
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
                            value={Math.round((capture?.max_recording_seconds ?? 720) / 60)}
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
                            max={autoStopMaxMinutes}
                            aria-label="Auto-stop"
                          />
                        }
                      />
                      <Row
                        label="Ceiling"
                        hint={
                          budget
                            ? `${ceilingLabel} — ${budget.ceiling_detail}. Past it, nothing transcribes.`
                            : "The runtime has not answered with a processing limit."
                        }
                        control={<StatusBadge>{ceilingLabel ?? "Not read"}</StatusBadge>}
                      />
                    </CardRows>
                  </Card>

                  <Card
                    title="Where each list lands"
                    footer={
                      <Button
                        variant="ghost"
                        icon={<Icon name="play" />}
                        on={answer === "sample"}
                        onClick={() => setAnswer(answer === "sample" ? null : "sample")}
                      >
                        Check against a sample
                      </Button>
                    }
                    body={
                      answer === "sample" && (
                        <AnswerPanel
                          onClose={() => setAnswer(null)}
                          head={
                            <FieldWrap>
                              <span className="ws-raw-label">Say something</span>
                              <TextArea
                                value={sample}
                                rows={2}
                                placeholder="Type a sentence the way you would dictate it."
                                onChange={(event) => setSample(event.target.value)}
                              />
                            </FieldWrap>
                          }
                          columns={[
                            {
                              label: "Heard",
                              body: <p>{analysis?.preview.input || sample || "Nothing yet."}</p>,
                            },
                            {
                              label: "Written",
                              body: <p>{analysis?.preview.output || "Nothing yet."}</p>,
                            },
                          ]}
                          /* THE RULES THAT FIRED, BY NAME — and `namedRule` is
                             what makes that sentence true rather than a claim
                             about the id the runtime hands over. An empty run is
                             stated rather than left blank: "nothing applied" is
                             the answer somebody checking a rule they just wrote
                             is most often looking for, and a blank foot reads
                             as a surface that did not run. */
                          foot={
                            analysis?.preview.applied_rules.length
                              ? analysis.preview.applied_rules.map(namedRule).join(" · ")
                              : "No rule applied to this sample."
                          }
                        />
                      )
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
                            onChange={(event) =>
                              writeModes({
                                communication_register: event.target.value as CommunicationRegister,
                              })
                            }
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
                            onChange={(event) =>
                              writeModes({
                                communication_length: event.target.value as CommunicationLength,
                              })
                            }
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
                            onChange={(event) =>
                              writeModes({ style_instructions: event.target.value }, "text")
                            }
                            onBlur={() => runtime.flushText()}
                          />
                          {/* THE BOUND IS THE RUNTIME'S OR THERE IS NO METER
                              (rule 7). `analyze_communication_style` answers
                              both numbers; until it has, a meter drawn against
                              a constant copied out of `core::communication_style`
                              would be a measurement this screen invented — and
                              it would keep reading right on the day the runtime
                              changed the budget. */}
                          {styleAnalysis && (
                            <BudgetMeter
                              used={styleAnalysis.instructions.used_chars}
                              max={styleAnalysis.instructions.max_chars}
                            />
                          )}
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
                            onChange={(event) =>
                              writeModes({ style_sample: event.target.value }, "text")
                            }
                            onBlur={() => runtime.flushText()}
                          />
                          {styleAnalysis && (
                            <BudgetMeter
                              used={styleAnalysis.sample.used_chars}
                              max={styleAnalysis.sample.max_chars}
                            />
                          )}
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
                        value={profile?.prompt ?? ""}
                        onChange={(event) =>
                          write((current) => ({ ...current, prompt: event.target.value }), "text")
                        }
                        onBlur={() => runtime.flushText()}
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
                          value={term}
                          onChange={(event) => setTerm(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            const phrase = term.trim();
                            if (!phrase) return;
                            /* Adding a term is discrete — one word, one write —
                               so it takes `patch` even though it was typed into
                               a text field. */
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
                          }}
                        />
                        <TermChips
                          items={profile ? termsOf(profile) : []}
                          onRemove={(phrase) =>
                            write((current) => ({
                              ...current,
                              vocabulary_hints: current.vocabulary_hints.filter(
                                (hint) => hint.phrase !== phrase,
                              ),
                            }))
                          }
                        />
                        <p className="ws-muted">
                          Outlined chips were learned from repairs.{" "}
                          {profile?.vocabulary_hints.length ?? 0} terms.
                        </p>
                      </Row>
                    </CardRows>
                  </Card>
                  <Card
                    body={
                      answer === "bias" && (
                        <AnswerPanel
                          onClose={() => setAnswer(null)}
                          columns={[
                            {
                              label: `Reaches the recognizer (${bias?.stt_hints.length ?? 0})`,
                              body: <p>{listOrNone(bias?.stt_hints)}</p>,
                            },
                            {
                              label: `Repaired afterwards (${repair?.repairable.length ?? 0})`,
                              body: <p>{listOrNone(repair?.repairable)}</p>,
                            },
                            /* A TERM BELOW THE FLOOR IS NOT A DEFECT TO FIX and
                               the column says which of its two effects it has
                               (ADR 0033). Drawn only when there is one, because
                               an empty column here would teach the reader that
                               something is missing. */
                            ...(repair?.too_short.length
                              ? [
                                  {
                                    label: `Too short to repair, under ${repair.min_chars} characters`,
                                    body: <p>{listOrNone(repair.too_short)}</p>,
                                  },
                                ]
                              : []),
                            ...(bias?.over_limit_stt_hint_lines.length
                              ? [
                                  {
                                    label: "Switched on, past the slot budget",
                                    body: <p>{listOrNone(bias.over_limit_stt_hint_lines)}</p>,
                                  },
                                ]
                              : []),
                          ]}
                          foot={
                            bias
                              ? `Source: ${bias.effective_stt_hints_source}.`
                              : "The runtime has not answered yet."
                          }
                        />
                      )
                    }
                  >
                    <CardRows>
                      <Row
                        label="Effective transcription bias"
                        hint="Which of these the recognizer actually receives — it takes only a few."
                        control={
                          <Button
                            variant="ghost"
                            icon={<Icon name="eye" />}
                            on={answer === "bias"}
                            onClick={() => setAnswer(answer === "bias" ? null : "bias")}
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
                    description="Shorthand you say on purpose. Exact match, every mode, in order."
                    action={
                      <AddButton
                        label="New replacement"
                        on={editing?.kind === "replacement" && editing.id === null}
                        onClick={() => setEditing({ kind: "replacement", id: null })}
                      />
                    }
                  >
                    <ListRows>
                      {(profile?.dictionary_entries ?? [])
                        .map((item) => [item.phrase, item.replace_with, item.id] as const)
                        .map(([from, to, id], index, all) => (
                        <Fragment key={id}>
                          <ListItem
                            title={`${from}  →  ${to}`}
                            meta={["exact", "case-insensitive"]}
                            open={
                              (editing?.kind === "replacement" ||
                                editing?.kind === "delete-replacement") &&
                              editing.id === id
                            }
                            /* Only the reorder pair stays an icon: it is the
                               one action you repeat, and it is positional —
                               reaching it through a menu would mean opening the
                               menu once per step. */
                            actions={
                              <Reorder
                                what="replacement"
                                atTop={index === 0}
                                atBottom={index === all.length - 1}
                                onUp={() => moveReplacement(index, -1)}
                                onDown={() => moveReplacement(index, 1)}
                              />
                            }
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setMenu({
                                x: event.clientX,
                                y: event.clientY,
                                kind: "replacement",
                                id,
                              });
                            }}
                          />
                          {editing?.kind === "delete-replacement" && editing.id === id && (
                            <ConfirmPanel
                              question={`Delete the replacement for “${from}”?`}
                              detail={`It writes “${to}” today.`}
                              confirmLabel="Delete replacement"
                              onConfirm={() => deleteRule("replacement", id)}
                              onCancel={() => setEditing(null)}
                            />
                          )}
                          {editing?.kind === "replacement" && editing.id === id && (
                            <EditorPanel
                              fields={REPLACEMENT_FIELDS}
                              initial={{ phrase: from, replace_with: to }}
                              note={ORDER_NOTE}
                              issues={issuesFor(id)}
                              onSave={(values) => saveReplacement(id, values)}
                              onCancel={() => setEditing(null)}
                            />
                          )}
                        </Fragment>
                      ))}
                      {editing?.kind === "replacement" && editing.id === null && (
                        <EditorPanel
                          fields={REPLACEMENT_FIELDS}
                          note={ORDER_NOTE}
                          saveLabel="Add"
                          onSave={(values) => saveReplacement(null, values)}
                          onCancel={() => setEditing(null)}
                        />
                      )}
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
                  description="A trigger phrase you say, and the block it expands to. In order, after replacements."
                  action={
                    <AddButton
                      label="New snippet"
                      on={editing?.kind === "snippet" && editing.id === null}
                      onClick={() => setEditing({ kind: "snippet", id: null })}
                    />
                  }
                >
                  <ListRows>
                    {snippetRows.map((row, index) => (
                      <Fragment key={row.id}>
                        <ListItem
                          title={row.title}
                          meta={[`expands to ${row.expansion.split("\n").length} lines`]}
                          open={
                            (editing?.kind === "snippet" || editing?.kind === "delete-snippet") &&
                            editing.id === row.id
                          }
                          actions={
                            <Reorder
                              what="snippet"
                              atTop={index === 0}
                              atBottom={index === snippetRows.length - 1}
                              onUp={() => moveSnippet(index, -1)}
                              onDown={() => moveSnippet(index, 1)}
                            />
                          }
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setMenu({
                              x: event.clientX,
                              y: event.clientY,
                              kind: "snippet",
                              id: row.id,
                            });
                          }}
                        />
                        {editing?.kind === "delete-snippet" && editing.id === row.id && (
                          <ConfirmPanel
                            question={`Delete “${row.title}”?`}
                            detail={`It expands to ${row.expansion.split("\n").length} lines today.`}
                            confirmLabel="Delete snippet"
                            onConfirm={() => deleteRule("snippet", row.id)}
                            onCancel={() => setEditing(null)}
                          />
                        )}
                        {editing?.kind === "snippet" && editing.id === row.id && (
                          <EditorPanel
                            fields={SNIPPET_FIELDS}
                            initial={{
                              trigger: row.trigger,
                              label: row.label,
                              expansion: row.expansion,
                            }}
                            note={ORDER_NOTE}
                            issues={issuesFor(row.id)}
                            onSave={(values) => saveSnippet(row.id, values)}
                            onCancel={() => setEditing(null)}
                          />
                        )}
                      </Fragment>
                    ))}
                    {editing?.kind === "snippet" && editing.id === null && (
                      <EditorPanel
                        fields={SNIPPET_FIELDS}
                        note={ORDER_NOTE}
                        saveLabel="Add"
                        onSave={(values) => saveSnippet(null, values)}
                        onCancel={() => setEditing(null)}
                      />
                    )}
                  </ListRows>
                </Card>
              )}
            </PaneDetailMain>
          </>
        }
      />

      {/* OUTSIDE THE PANE ON PURPOSE. The panel is `fixed` at a measured point,
          so its place in the tree decides nothing about where it draws — and
          keeping it out of the pane is what keeps it out of every ancestor that
          scrolls or hides overflow. That clipping is the defect the owner found
          in the running app. */}
      {menu && (
        <RowMenu
          at={menu}
          label={
            menu.kind === "profile"
              ? `Actions for ${listRows.find((row) => row.id === menu.id)?.title ?? "this profile"}`
              : `Actions for this ${menu.kind}`
          }
          items={menuItems()}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
