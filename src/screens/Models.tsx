import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Card,
  CardRows,
  DocLink,
  Field,
  Icon,
  IconButton,
  Job,
  JobList,
  JobModel,
  JobNone,
  ModelList,
  ModelRow,
  Note,
  PreviewTag,
  Toolbar,
  ToolbarSearch,
  ProviderChips,
  Row,
  ScopeTag,
  SectionHeader,
  Select,
  SegmentControl,
  SelectMark,
  StatusBadge,
  SubTabs,
  Toggle,
  ViewTop,
} from "@/components/shell";
import {
  DESK,
  DESK_VOICE_PRESET,
  LANE_LABEL,
  LANES,
  LOCAL_VOICE_PRESET,
  libraryModel,
  LIBRARY_LANGUAGE_ROWS,
  LIBRARY_SPEECH_ROWS,
  PROVIDERS,
  providerNames,
  type JobKey,
  type LaneName,
} from "./data";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { formatModelSize, modelInstall } from "@/lib/modelCatalogue";
import { useLocalSetup } from "@/hooks/useLocalSetup";
import { useModelLibrary } from "@/hooks/useModelLibrary";
import { buildProfileSpeechPatch } from "@/lib/textProfiles";
import type { LocalServerAnswer, ManagedModelRow } from "@/types/models";
import type { ModelState } from "@/components/shell";
import { formatBudgetDuration, useCaptureBudget } from "@/hooks/useCaptureBudget";
import { useProviderSeam } from "@/hooks/useProviderSeam";
import {
  TRANSLATE_LANGUAGES,
  type ProviderTier,
  type TranslateAddressForm,
  type TranslateSameLanguage,
} from "@/types/ipc";
import {
  buildProfileProvidersPatch,
  resolveActiveTextProfile,
  resolveConfigJobProvider,
  resolveProfileModesSettings,
  resolveProfileProviderSettings,
} from "@/lib/textProfiles";
import {
  connectionCapabilitySentence,
  credentialStateFor,
  drawnNameFor,
  NO_ANSWERS,
  resolveProviderAnswer,
  runtimeIdFor,
  roleForDrawnCapability,
  selectableProviderNames,
  type RuntimeAnswers,
} from "@/lib/providerSeam";
import type { LocalProviderSetupStatus, ProviderRole } from "@/types/providers";
/* THE LADDER MOVED OUT IN B7 (ADR 0129) and this screen is now one of its two
   callers rather than its owner. What stayed here is the connection, the lane
   segment and the model library — what configures a lane, as opposed to what
   states and changes where one job runs. */
import {
  DrawnButton,
  DrawnField,
  DrawnSelect,
  DrawnToggle,
  Follows,
  InertBecause,
  JobProviderRuntime,
  NOT_INTEGRATED,
  useAnswers,
  useOpenProfiles,
  useRuntime,
  useWired,
  Wired,
} from "@/components/jobProvider";
import type { PartlyWiredScreenProps, WorkspaceRuntime } from "./props";

/**
 * AI MODELS — `SCREENS.models`, and `SCREENS.stt` / `SCREENS.llm` are the same
 * place under the two names it replaced.
 *
 * WHAT IT IS: one section, one connection stated once and used by everything,
 * one list of every job that runs a model — each row showing what it uses and
 * opening to its own settings — and one tab for what is installed on this
 * machine, because an installation is shared and is not a credential.
 *
 * WHY NOT THE DONOR'S TWO SECTIONS. OpenWhispr divides speech from language at
 * the top level, and that is right at OpenWhispr's size: its speech section
 * carries a local-model manager, a VAD panel, GPU selection and three consumer
 * tabs. Split the same way here, the speech side would be one engine row and a
 * language picker and the language side five near-identical rows — two screens
 * whose combined content is one screen's worth. The division is by JOB instead,
 * grouped by what each does to sound and text: listening, writing, speaking.
 */

/**
 * THE LONGEST RECORDING THIS LANE ACCEPTS. Drawn as `~26 min`, which was a
 * plausible number; `resolve_capture_budget` has the real one and it moves with
 * the provider, the account plan and the model (ADR 0034). Reading it here is
 * also what makes this row agree with the identical statement on
 * Profiles → Defaults, which reads the same command — a second derivation in
 * TypeScript is how the two would drift.
 */
function CeilingBadge() {
  const wired = useWired();
  /* Two components rather than one with a conditional hook, and the split is
     load-bearing: the gallery asserts NO runtime state, so it must not reach
     for `resolve_capture_budget` at all. */
  return wired ? <WiredCeilingBadge /> : <StatusBadge tone="plan">~26 min</StatusBadge>;
}

function WiredCeilingBadge() {
  const { budget } = useCaptureBudget();
  return (
    <StatusBadge tone="plan">
      {budget ? formatBudgetDuration(budget.ceiling_seconds) : "Not read"}
    </StatusBadge>
  );
}


export function ModelsScreen({ banner, runtime }: PartlyWiredScreenProps = {}) {
  const [tab, setTab] = useState("Models");
  /* THE ONE SEGMENT IN THIS SCREEN THAT IS NOT INERT. A lane decides what a
     provider even IS, so a lane switch that leaves the card identical is not an
     inert control, it is a false one: it says the four lanes are the same thing
     with different names. */
  const [lane, setLane] = useState<LaneName>("Cloud");

  const surface = (
    <>
      <ViewTop
        title="AI Models"
        lead="One connection, and what each job runs on it."
        banner={banner}
        tabs={
          <SubTabs
            items={[
              { id: "Models", label: "Models" },
              { id: "On this machine", label: "On this machine" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      {tab === "Models" ? (
        <ModelsTab
          lane={lane}
          onLane={setLane}
          runtime={runtime}
          onManage={() => setTab("On this machine")}
        />
      ) : (
        <MachineTab />
      )}

      <Note>
        Which mode is effective right now is runtime truth and lives on Home. Which mode a
        profile defaults to lives in that profile. Neither is set here.
      </Note>
    </>
  );

  /* TWO COMPONENTS RATHER THAN ONE WITH A CONDITIONAL HOOK, and the split is
     the one `CeilingBadge` already makes for the same reason: the gallery
     asserts NO runtime state, so it must not reach for `registered_providers`
     at all. `screens.test.tsx` measures this screen with no runtime and
     `Models.test.tsx` asserts nothing was invoked there. */
  return runtime ? (
    <JobProviderRuntime lane={lane} runtime={runtime}>
      {surface}
    </JobProviderRuntime>
  ) : (
    <Wired.Provider value={{ on: false, answers: NO_ANSWERS }}>{surface}</Wired.Provider>
  );
}


/* ── The connection, per lane ───────────────────────────────────────────────
   The first build drew one card and switched a thumb above it, so all four
   lanes showed a cloud provider grid, a cloud API key and a cloud account plan.
   That is not a lane selector, it is a label. Each lane brings the credential
   shape it actually has:

     Cloud        a provider, from a chip row, and one key
     Local        a runtime, installed models, and no credential at all
     Self-hosted  a URL you operate, a typed model id, an optional token
     Enterprise   an account and a region, with three credential shapes

   AND THE THIRD ONE IS READ AS *Your server* (ADR 0160). The identifier is
   unchanged; only what a reader sees is, because *server* now names exactly one
   thing on this screen — a machine that is not this one. */
function LaneRows({
  lane,
  runtime,
  onManage,
}: {
  lane: LaneName;
  runtime?: WorkspaceRuntime;
  /** Opens *On this machine*. The lane summarises the installation; the tab
   *  owns it, and a summary that names a total has to be able to reach it. */
  onManage?: () => void;
}) {
  if (lane === "Local") {
    return (
      <>
        {/* THREE ROWS, AND IT WAS FIVE (ADR 0162).
            **This branch was a second copy of the machine tab, not a summary of
            it.** Four of its five rows restated what that tab already owns —
            the runner, its endpoint, the installed total and the acceleration
            — and the cost was measured rather than argued: ADR 0160 and
            ADR 0161 each had to be applied twice, and the second application
            was found by a screenshot after the first was tested and green.

            THE CUT IS *WHICH ONE DO WE USE* AGAINST *WHAT IS ON THE DISK*.
            A lane is a stored choice; an installation belongs to the machine
            and outlives every lane switch. So the connection card keeps the
            reachability and the credential — the two facts that are about
            talking to the runner — and everything about the files is one
            number and a door.

            AND THE DRAWING ALREADY HAD THE DOOR. `Manage` has been in this row
            since Leg 6 with no handler on it; the intent was always that the
            lane points and the tab holds. */}
        {/* **AND `Bundled | Yours` IS NOT HERE EITHER**, which the first pass at
            this record left standing. Which program runs is a fact about the
            machine and belongs to the tab that lists the runners; whether this
            lane can reach it is the connection question and belongs here. The
            duplicate was caught the same way its three predecessors were — by
            looking at the rendered screen after the tests were green. */}
        <Row
          label="Language runner"
          hint="Ollama or LM Studio, on this machine. Started on demand by whichever job needs it."
          control={
            <span className="ws-rowflex">
              <SelectMark name="ollama" />
              <StatusBadge tone="success">Running</StatusBadge>
              <span className="ws-mono ws-muted">127.0.0.1:11434</span>
            </span>
          }
        />
        <Row
          label="Credential"
          hint="None, and there is nothing to add. This is the one lane where “no request leaves this machine” is true by construction rather than by promise."
          control={<StatusBadge tone="success">Not needed</StatusBadge>}
        />
        <Row
          label="Installed models"
          hint="Managed on the other tab, because a model stays on the disk whichever lane you pick."
          control={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">4 models · 6.7 GB</StatusBadge>
              {/* A REAL BUTTON, NOT A `DrawnButton`. Everything else on this
                  lane is a drawing and stays one; navigation is the exception,
                  because a door that does not open is the one inert control
                  that costs the reader the thing it names. */}
              <Button variant="ghost" icon={<Icon name="arrow" />} onClick={onManage}>
                Manage
              </Button>
            </span>
          }
        />
      </>
    );
  }

  if (lane === "Self-hosted") {
    return (
      <>
        <Row
          label="URL"
          hint="An OpenAI-compatible server you operate, on another machine. Not the Local lane, which runs here."
          control={<DrawnField defaultValue="http://10.0.0.2:8080/v1" w="230px" aria-label="URL" />}
        />
        <Row
          label="Reachability"
          control={
            <span className="ws-rowflex">
              <StatusBadge tone="success">Answering</StatusBadge>
              <DrawnButton variant="ghost">Test</DrawnButton>
            </span>
          }
        />
        <Row
          label="Credential"
          hint="Optional. Some servers take a bearer token, most take none."
          control={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">None</StatusBadge>
              <DrawnButton variant="ghost" icon={<Icon name="key" />}>
                Add
              </DrawnButton>
            </span>
          }
        />
        <Row
          label="Model ids are typed"
          hint="A server behind a URL does not have to publish a model list, so each job carries the id you give it rather than picking from one."
          control={<StatusBadge tone="plan">Per job</StatusBadge>}
        />
      </>
    );
  }

  if (lane === "Enterprise") {
    return (
      <>
        <ProviderPick
          lane="Enterprise"
          selected="AWS Bedrock"
          label="Account"
          hint="Each of the three authenticates differently, so picking one changes which fields exist below it."
        />
        <Row
          label="Credentials"
          hint="Access key, secret and region — or the ambient AWS credential chain when one is present on this machine."
          control={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">Not configured</StatusBadge>
              <DrawnButton variant="ghost" icon={<Icon name="key" />}>
                Configure
              </DrawnButton>
            </span>
          }
        />
        <Row
          label="Region"
          control={
            <DrawnSelect defaultValue="eu-central-1" aria-label="Region">
              <option>eu-central-1</option>
              <option>us-east-1</option>
              <option>us-west-2</option>
            </DrawnSelect>
          }
        />
        <Row
          label="Speech"
          hint="Only Azure OpenAI transcribes among the three, so the listening jobs say so instead of offering an empty picker."
          control={<StatusBadge tone="warning">Azure only</StatusBadge>}
        />
      </>
    );
  }

  /* Cloud. The provider was a grid of tiles here, on the argument that picking
     one is a recognition task — you know the mark before you have read the
     word. That much held; the tiles were not what delivered it. The mark
     travels with the row's control now, so recognition survives at a twelfth of
     the surface, and capability moved from a caption under every option to a
     sentence about the one that is actually selected. */
  return (
    <>
      <ProviderPick lane="Cloud" selected="Groq" />
      <CloudCredentialRows runtime={runtime} />
    </>
  );
}

/**
 * THE TWO ROWS THAT ARE REALLY WIRED (ADR 0065, part 2). Everything else on
 * this screen is drawn; these read `provider_status` and write the OS secret
 * store and the account plan.
 *
 * THE KEY FIELD IS A PORT, NOT A DESIGN. The drawing gives this row a badge and
 * a Replace button and no field, so where the key is TYPED had to come from
 * somewhere — and it already exists in the prototype: Onboarding draws exactly
 * this fact as `field("gsk_••••…", { w: "190px" })`. Replace swaps the badge
 * pair for that field, which is the same decision Hotkeys took for its
 * recording state: the resting state is the drawing, and the state the drawing
 * does not have is the one the prototype draws elsewhere for the same fact.
 *
 * A KEY IS NEVER PUT BACK IN THE FIELD. `key_preview` is what the runtime will
 * show and it is a preview; the field opens empty, because a masked value that
 * looks editable invites somebody to append to a secret they cannot see.
 */
function CloudCredentialRows({ runtime }: { runtime?: WorkspaceRuntime }) {
  const { answers, refresh, connection } = useContext(Wired);
  const [tiers, setTiers] = useState<ProviderTier[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /* THE VENDOR IS THE CONNECTION'S, AND IT USED TO BE THE LITERAL `"groq"` —
     in the status read, in both writes, in the validation and in the plans, five
     times (D1). With one registered lane that literal was correct; with two it
     is a row that shows one vendor's credential while the chip above it names
     another, and it would have written an OpenAI key into Groq's secret-store
     entry. The fallback is the registry default rather than nothing: a screen
     opening before the config has been read still has a credential to state. */
  const providerId = (connection ? runtimeIdFor(connection) : undefined) ?? "groq";

  /* THE STATUS IS THE SEAM'S, NOT THIS ROW'S (ADR 0124). It used to run its own
     `provider_status`, and once the seam started asking for the same provider
     that was two reads of one OS secret store on one screen open — and two
     components with two opinions of one credential, which is the drift this
     step exists to remove one layer up. The plans stay here: they are a speech
     question this row is the only reader of. */
  const status = answers.statuses[providerId] ?? null;

  const read = useCallback(async () => {
    if (!runtime) return;
    const tierResult = await invoke<ProviderTier[]>("resolve_provider_tiers", {
      provider: providerId,
    }).catch(() => null);
    /* Not an array is a runtime that did not answer, not a provider with no
       plans — the row then states the stored value rather than an empty list. */
    if (Array.isArray(tierResult)) setTiers(tierResult);
  }, [runtime, providerId]);

  useEffect(() => {
    if (!runtime?.active) return;
    void read();
  }, [runtime?.active, read]);

  /* A DRAFT BELONGS TO THE VENDOR IT WAS TYPED FOR. Switching the connection
     mid-edit with a half-typed key in the field would offer to save it to the
     new vendor, which is how a key reaches an account it was never issued for. */
  useEffect(() => {
    setDraft("");
    setEditing(false);
    setProblem(null);
  }, [providerId]);

  const configured = status?.credential.configured ?? false;
  const preview = status?.credential.key_preview;
  const storage = status?.credential.storage;

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      await invoke("save_provider_api_key", {
        request: { provider: providerId, api_key: draft.trim() },
      });
      const validation = await invoke<{ ok: boolean }>("validate_provider_api_key", {
        request: { provider: providerId, api_key: null },
      });
      if (!validation?.ok) setProblem("The key was saved and the provider did not accept it.");
      setDraft("");
      setEditing(false);
      await refresh?.();
    } catch (cause) {
      setProblem(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await invoke("clear_provider_api_key", { request: { provider: providerId } });
      await refresh?.();
    } catch (cause) {
      setProblem(String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!runtime) {
    return (
      <>
        <Row
          label="API key"
          hint="In the OS secret store. Never written to the config file."
          control={
            <span className="ws-rowflex">
              <StatusBadge tone="success">Set</StatusBadge>
              <DrawnButton variant="ghost" icon={<Icon name="key" />}>
                Replace
              </DrawnButton>
            </span>
          }
        />
        <Row
          label="Account plan"
          hint="Sets the largest upload, and with it the longest recording. Stated again where it is spent."
          control={
            <DrawnSelect defaultValue="Free — 25 MiB per request" aria-label="Account plan">
              <option>Free — 25 MiB per request</option>
              <option>Developer — 100 MiB per request</option>
            </DrawnSelect>
          }
        />
      </>
    );
  }

  return (
    <>
      <Row
        label="API key"
        hint={
          problem ??
          (storage
            ? `In ${storage}. Never written to the config file.`
            : "In the OS secret store. Never written to the config file.")
        }
        control={
          editing ? (
            <span className="ws-rowflex">
              <Field
                autoFocus
                type="password"
                w="190px"
                aria-label="API key"
                placeholder="gsk_…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void save();
                  if (event.key === "Escape") {
                    setDraft("");
                    setEditing(false);
                  }
                }}
              />
              <Button busy={busy} disabled={busy || !draft.trim()} onClick={() => void save()}>
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft("");
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </span>
          ) : (
            <span className="ws-rowflex">
              <StatusBadge tone={configured ? "success" : "warning"}>
                {configured ? (preview ?? "Set") : "Not set"}
              </StatusBadge>
              <Button variant="ghost" icon={<Icon name="key" />} onClick={() => setEditing(true)}>
                {configured ? "Replace" : "Add"}
              </Button>
              {configured && (
                <Button variant="ghost" disabled={busy} onClick={() => void clear()}>
                  Remove
                </Button>
              )}
            </span>
          )
        }
      />
      <Row
        label="Account plan"
        hint="Sets the largest upload, and with it the longest recording. Stated again where it is spent."
        control={
          <Select
            /* A PLAN ID THIS VENDOR NEVER HAD READS AS ITS DEFAULT, which is
               what the runtime already does: `capture_limits` falls back to the
               default tier for an id it does not recognise, on the argument
               that being wrong towards "you may record less" costs a retry.
               `provider_tier` is machine-wide — A4 left it so deliberately —
               so switching the connection can leave Groq's `dev` selected on a
               vendor with one plan, and a select whose value matches no option
               renders blank. Blank reads as a setting nobody has made rather
               than one that does not apply here. */
            value={
              tiers.some((tier) => (tier.default ? "" : tier.id) === runtime.config.provider_tier)
                ? runtime.config.provider_tier
                : ""
            }
            onChange={(event) => runtime.patch({ provider_tier: event.target.value })}
            aria-label="Account plan"
            disabled={tiers.length === 0}
          >
            {tiers.length === 0 && (
              <option value={runtime.config.provider_tier}>Reading the provider plans…</option>
            )}
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.default ? "" : tier.id}>
                {tier.label}
              </option>
            ))}
          </Select>
        }
      />
    </>
  );
}

/**
 * THE PROVIDER PICKER, shared with onboarding. The donor does the same — its
 * onboarding renders the very component the settings page uses rather than a
 * simplified twin. A setup flow that draws its own version of a control teaches
 * the wrong surface: the user learns a screen they will never see again, and
 * the two drift the first time one is edited.
 *
 * THE CAPABILITY LINE BELONGS TO THE CHOSEN ONE. It is the row's hint and is
 * not repeated per chip — a caption under every chip is the tile caption again,
 * and it would say "speech and language" nine times to tell you one thing about
 * the one you picked.
 */
export function ProviderPick({
  lane,
  selected,
  label,
  hint,
  custom = true,
}: {
  lane: LaneName;
  selected: string;
  /** Enterprise calls this an Account, because there it is one: a tenant, a
   *  region and a credential chain rather than a company you buy tokens from. */
  label?: string;
  hint?: ReactNode;
  custom?: boolean;
}) {
  const wired = useWired();
  const answers = useAnswers();
  const { connection, setConnection } = useContext(Wired);
  const here = PROVIDERS.filter((p) => p.lane === lane);
  const cur = here.find((p) => p.name === selected) ?? here[0];
  const [drawnValue, setDrawnValue] = useState(cur.name);
  /* THE PRODUCT READS THE CONFIG AND THE GALLERY READS ITSELF. Two sources for
     one control, and the alternative was worse in both directions: local state
     on the product is a chip that springs back on the next render, and a config
     read in the gallery is a screen that cannot be rendered without a runtime
     (ADR 0055). The Enterprise pick has no config home yet, so it keeps the
     drawing on both surfaces. */
  const wiredHere = wired && lane === "Cloud" && Boolean(connection);
  const value = wiredHere ? (connection as string) : drawnValue;
  const setValue = wiredHere && setConnection ? setConnection : setDrawnValue;
  const chosen = here.find((p) => p.name === value) ?? cur;

  /* THE LINE ADR 0106 NAMES. Drawn, this reads `chosen.stt && chosen.llm` — the
     hand-maintained table answering *what can this vendor do here*, which is a
     runtime question and the subject of three of `docs/PROVIDERS.md`'s open
     disagreements. On the product the runtime answers it; in the gallery the
     drawing still does, because there the drawing is the whole point. */
  const drawnCaps =
    chosen.stt && chosen.llm
      ? "Speech and language."
      : chosen.llm
        ? "Language only — the listening jobs stay on whichever provider can hear."
        : "Speech only — the writing jobs stay on whichever provider can write.";
  const caps = wired ? (connectionCapabilitySentence(chosen.name, answers) ?? drawnCaps) : drawnCaps;

  return (
    <Row layout="stack" label={label ?? "Provider"} hint={hint ?? caps}>
      {/* NO CREDENTIAL BADGE ON THE CHIP. The old tile carried a small check
          when a key was stored. The credential has its own row directly below
          saying `Set`, and one fact stated twice six pixels apart is the
          furniture rule exactly. */}
      <ProviderChips
        providers={here.map((p) => p.name)}
        value={value}
        onChange={setValue}
        custom={custom}
        customIcon={<Icon name="settings" />}
        fallbackIcon={<Icon name="cloud" />}
        /* The chip row is the single worst place on the surface to imply a
           provider works: the next thing it asks for is an API key. Which ones
           can be picked was a literal `["Groq"]` until ADR 0124 — the registry
           answers it now, so the first adapter that lands is offered here
           without this line being edited.

           A CHIP IS NOT A JOB. A vendor that listens but does not write is
           still a connection worth having, so the chip asks whether the
           registry carries it at all; which of its jobs can run is the job
           rows' question and they answer it one row at a time. */
        selectable={wired ? selectableProviderNames(lane, answers) : undefined}
        reasonFor={
          wired ? (name) => inertReasonFor(name, answers) : undefined
        }
      />
    </Row>
  );
}

/** The sentence a chip carries when it cannot be picked. */
function inertReasonFor(drawnName: string, answers: RuntimeAnswers): string | undefined {
  const speech = resolveProviderAnswer(drawnName, "speech", answers);
  if (!speech.operable && speech.reason.kind !== "role_denied") return speech.reason.sentence;

  const chat = resolveProviderAnswer(drawnName, "chat", answers);
  if (!chat.operable && chat.reason.kind !== "role_denied") return chat.reason.sentence;

  return undefined;
}


/** The model badge a job row carries, resolved against the lane. */
function jobBadge(lane: LaneName, jobKey?: JobKey, fallback?: { model: string; mark: string | null }) {
  const lj = jobKey ? LANES[lane].jobs[jobKey] : {};
  const model = lj.model ?? fallback?.model ?? "";
  const override = lj.override;
  const mark = "mark" in lj ? (lj.mark ?? null) : (fallback?.mark ?? undefined);
  const offAxis = mark === null;
  return (
    <JobModel
      mark={offAxis ? null : (mark ?? override ?? LANES[lane].provider)}
      model={model}
      override={override}
    />
  );
}

/** A job the lane cannot run says so in place of a model and names the lane
 *  that can — an empty picker would be worse than the sentence. */
/**
 * The four rows that make Translate a mode rather than a flag (ADR 0041), and
 * the two of them that are the only live controls in this job list.
 *
 * The split follows the scope tags the drawing puts on them, and it is the split
 * ADR 0068 already ruled on: a per-profile value does not belong on a
 * machine-scope surface. `Into` and `Keep the profile's words` carry a `Per
 * profile` tag, so they are EDITED on Profiles → Defaults and only STATED here,
 * disabled, showing what the active profile holds. The tag beside each one is
 * the door to where it is set, which is what a scope tag is for — a disabled
 * control cannot carry a tooltip, and this one does not need to.
 *
 * The two that carry no tag are the machine's, in the same shape
 * `enhance_sub_mode` and `enhance_target` already have, and they are live.
 *
 * They are live while roughly thirty-six controls around them are not, and that
 * is not an inconsistency: every other row here picks a model, which needs the
 * connection shape ADR 0042 describes and the config does not have yet. These
 * are the mode's own settings.
 *
 * With no runtime this is the gallery: every control keeps the drawn default and
 * changes nothing outside itself, which is what keeps the screen measurable.
 */
function TranslateJobSettings() {
  const runtime = useRuntime();
  const openProfiles = useOpenProfiles();
  const config = runtime?.config;
  const modes = config ? resolveProfileModesSettings(resolveActiveTextProfile(config)) : null;

  return (
    <>
      <Row
        label="Into"
        hint="One target, fixed. Reading it from the focused window is a guess, and a guess that silently changes the language you are writing in is worse than a wrong keystroke."
        control={
          <span className="ws-rowflex">
            <ScopeTag onOpen={openProfiles} />
            <Select
              value={modes?.translate_target_language ?? "en"}
              onChange={() => undefined}
              disabled={Boolean(runtime)}
              aria-label="Into"
            >
              {TRANSLATE_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </Select>
          </span>
        }
      />
      <Row
        label="When you already dictated in that language"
        hint="Nothing to translate. Say which happens rather than letting the model decide per dictation."
        control={
          <InertSegment
            options={["Pass through", "Run Cleanup"]}
            active={
              config?.translate_same_language === "pass_through" ? "Pass through" : "Run Cleanup"
            }
            label="When you already dictated in that language"
            onChange={
              runtime
                ? (value) =>
                    runtime.patch({
                      translate_same_language: (value === "Pass through"
                        ? "pass_through"
                        : "cleanup") satisfies TranslateSameLanguage,
                    })
                : undefined
            }
          />
        }
      />
      <Row
        label="Address form"
        hint="German, French and Spanish force a choice English does not carry. As dictated keeps a formal sentence formal."
        control={
          <InertSegment
            options={["As dictated", "Formal", "Informal"]}
            active={ADDRESS_FORM_LABELS[config?.translate_address_form ?? "as_dictated"]}
            label="Address form"
            onChange={
              runtime
                ? (value) =>
                    runtime.patch({ translate_address_form: addressFormValue(value) })
                : undefined
            }
          />
        }
      />
      <Row
        label="Keep the profile's words"
        hint="Names, products and technical terms are what a translator must leave alone and a model will localize."
        control={
          <span className="ws-rowflex">
            <Toggle
              checked={modes?.translate_keep_profile_words ?? true}
              onCheckedChange={() => undefined}
              disabled={Boolean(runtime)}
              aria-label="Keep the profile's words"
            />
            <ScopeTag onOpen={openProfiles} />
          </span>
        }
      />
    </>
  );
}

const ADDRESS_FORM_LABELS: Record<TranslateAddressForm, string> = {
  as_dictated: "As dictated",
  formal: "Formal",
  informal: "Informal",
};

function addressFormValue(label: string): TranslateAddressForm {
  const match = (Object.entries(ADDRESS_FORM_LABELS) as [TranslateAddressForm, string][]).find(
    ([, drawn]) => drawn === label,
  );
  return match?.[0] ?? "as_dictated";
}

function LaneJobRow({
  lane,
  jobKey,
  name,
  what,
  children,
  extra,
  cap,
  hint,
}: {
  lane: LaneName;
  jobKey: JobKey;
  name: string;
  what: ReactNode;
  children?: ReactNode;
  extra?: ReactNode;
  cap?: "stt" | "llm";
  hint?: ReactNode;
}) {
  const lj = LANES[lane].jobs[jobKey];
  if (lj.none) {
    return (
      <JobNone
        name={name}
        why={lj.none}
        control={<StatusBadge tone="warning">Not on this lane</StatusBadge>}
      />
    );
  }
  return (
    <Job
      name={name}
      what={what}
      control={jobBadge(lane, jobKey)}
      rows={<Follows lane={lane} jobKey={jobKey} cap={cap} hint={hint} extra={children} />}
      extra={extra}
    />
  );
}

function ModelsTab({
  lane,
  onLane,
  runtime,
  onManage,
}: {
  lane: LaneName;
  onLane: (lane: LaneName) => void;
  runtime?: WorkspaceRuntime;
  /** Threaded from `ModelsScreen`, which owns the tab state (ADR 0162). A prop
   *  through one level rather than a context: `Wired` exists because the job
   *  ladder renders four controls deep, and this is one row on one card. */
  onManage?: () => void;
}) {
  return (
    <>
      {/* ONE CONNECTION. This is the card that makes the rest of the screen
          short: a lane, a provider, a key, and a sentence saying that everything
          below follows it. Most people set this once and never open a job row.

          THE LANE IS FOUR AND NOT TWO. Cloud and Local were the two the surface
          had, which left self-hosted and enterprise with nowhere to live — and
          that homelessness is what produced the third screen. */}
      <SectionHeader
        title="Connection"
        description="Set once. Every job below follows it unless you say otherwise."
      >
        <Card>
          <CardRows>
            <Row
              label="Lane"
              /* ADR 0067 ASKED FOR THIS BADGE AND THIS SCREEN NEVER CARRIED IT
                 (ADR 0161). The record's rule is *preview badge everywhere it
                 is offered*, and the only surface that honoured it was the
                 workspace status strip — while the screen that actually offers
                 the lane said nothing on the row itself. Three of the four are
                 drawn, so the tag follows the selection rather than naming one
                 lane: what is true of `Local` here is true of the other two. */
              tag={
                lane === "Cloud" ? undefined : (
                  <PreviewTag
                    title={`${LANE_LABEL[lane]} is drawn, not built. The rows below show the shape it will have; nothing on this lane runs a job yet.`}
                  />
                )
              }
              hint="Where this runs. Everything below follows from it."
              control={
                <SegmentControl
                  options={(["Cloud", "Local", "Self-hosted", "Enterprise"] as LaneName[]).map(
                    (value) => ({
                      value,
                      /* THE LABEL IS NOT THE IDENTIFIER (ADR 0160). `Self-hosted`
                         is stored and `Your server` is read, because the word
                         *server* had to mean one thing on this screen and the
                         local runner had taken it. */
                      label: LANE_LABEL[value],
                      /* ADR 0065 and ADR 0067. Three lanes are drawn in full
                         and none of them is integrated — including Local,
                         which the runtime DOES carry as `local` and
                         which the owner ruled is treated like the other two
                         everywhere it comes up, because it is not finished. */
                      disabled: Boolean(runtime) && value !== "Cloud",
                    }),
                  )}
                  value={lane}
                  onChange={onLane}
                  aria-label="Lane"
                />
              }
            />
            <LaneRows lane={lane} runtime={runtime} onManage={onManage} />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* THE LIST. Every job that runs a model, in the order sound moves through
          the product: heard, written, spoken. Three groups, and a fourth for the
          modes that run no model at all — which have to be on this screen
          because "why can I not set a model for Verbatim" is answered by seeing
          it stated, not by its absence.

          The rule is one row per job that RUNS a model, not per job that SETS
          one. Titles is the case that separates the two (ADR 0087): it runs the
          assistant's model on every dictation and configures nothing, and a cost
          paid on every dictation and named on no surface is exactly what this
          list exists to prevent. */}
      <SectionHeader title="What runs what" description="One row per job. Open one to change it.">
        <Card>
          <div className="ws-stack ws-gap4">
            <div className="ws-grp">
              <label>Listening</label>
              <JobList>
                <LaneJobRow
                  lane={lane}
                  jobKey="dictation"
                  cap="stt"
                  name="Dictation"
                  what="Seconds of one voice, on the fastest path there is."
                  hint="Follows the connection. A dictation is latency-bound, which is the one argument that decides this row."
                >
                  <Row
                    label="Language"
                    hint="Auto-detect reads it from the audio, per dictation."
                    control={
                      <span className="ws-rowflex">
                        <ScopeTag onOpen={useOpenProfiles()} />
                        <DrawnSelect defaultValue="Auto-detect" aria-label="Language">
                          <option>Auto-detect</option>
                          <option>German</option>
                          <option>English</option>
                        </DrawnSelect>
                      </span>
                    }
                  />
                  <Row
                    label="Pin this language"
                    hint="Only affects whole passages in another script. Mixed sentences stay untouched."
                    control={<InertToggle label="Pin this language" />}
                  />
                  <Row
                    label="Longest recording this lane accepts"
                    hint="Follows from the account plan on the connection. The ceiling Profiles → Defaults sets a recording limit under."
                    control={
                      <span className="ws-rowflex">
                        <CeilingBadge />
                        <ScopeTag profile="Limit in profile" onOpen={useOpenProfiles()} />
                      </span>
                    }
                  />
                  <Row
                    label="Bias from the profile's words"
                    hint="The active profile's terms steer the recognizer before the AI sees anything. The terms themselves live in the profile."
                    control={
                      <span className="ws-rowflex">
                        <ScopeTag onOpen={useOpenProfiles()} />
                        <InertSegment
                          options={["Off", "Light", "Standard"]}
                          active="Standard"
                          label="Bias from the profile's words"
                        />
                      </span>
                    }
                  />
                </LaneJobRow>

                <LaneJobRow
                  lane={lane}
                  jobKey="meetings"
                  cap="stt"
                  name="Meetings"
                  what="An hour of several voices, with nothing waiting on the result."
                  hint="A different workload from a dictation, so it is its own row rather than its own screen."
                >
                  <Row
                    label="Speakers"
                    hint="Who said what, re-clustered when the meeting ends. Costs a pass over the recording."
                    control={<InertToggle label="Speakers" on />}
                  />
                  <Row
                    label="Live transcript"
                    hint="Text arrives while you are still talking, which is what makes the meeting HUD worth looking at during a call."
                    control={<InertToggle label="Live transcript" on />}
                  />
                  <Row
                    label="What a meeting records"
                    hint="Microphone, system audio and echo cancellation are a capture question, not a model one."
                    control={
                      <DrawnButton variant="ghost" icon={<Icon name="arrow" />}>
                        Notes & Meetings
                      </DrawnButton>
                    }
                  />
                </LaneJobRow>

                <LaneJobRow
                  lane={lane}
                  jobKey="upload"
                  cap="stt"
                  name="Upload"
                  what="A file you hand it, with no clock running at all."
                  hint="Nothing is waiting, so accuracy is the only argument on this row."
                >
                  <Row
                    label="Speakers"
                    hint="The same pass the meeting engine runs, on a file instead of a call."
                    control={<InertToggle label="Speakers" />}
                  />
                </LaneJobRow>
              </JobList>
            </div>

            <div className="ws-grp">
              <label>Writing</label>
              <JobList>
                <LaneJobRow
                  lane={lane}
                  jobKey="cleanup"
                  name="Cleanup"
                  what="Removes filler sounds and fixes typos, grammar and punctuation. Stays close to your phrasing."
                  hint="Cleanup runs inside the dictation, so this is the one job where latency decides the model."
                  extra={
                    <>
                      <Note>
                        Auto routes with this model too. Deciding which mode applies is the same size
                        of job as a cleanup, and a router with its own model would be a sixth thing
                        to configure for no gain.
                      </Note>
                      <Note>
                        No communication style here. It applies to Rewrite and the assistant only.
                      </Note>
                    </>
                  }
                />

                <LaneJobRow
                  lane={lane}
                  jobKey="rewrite"
                  name="Rewrite"
                  what="Cleanup plus rephrasing for clearer, more professional language. Manual only — never auto-selected."
                  extra={
                    <Note icon="profiles" tail={<DocLink>Open the profile</DocLink>}>
                      How this writes — register, length, style rules, writing sample — is the
                      profile's communication style, shared with the assistant.
                    </Note>
                  }
                />

                {/* NEW MODE — ADR 0041. The three settings here are the three
                    questions a translation raises that a cleanup does not: into
                    what, what happens when you already speak it, and what must
                    survive untranslated. The last is why this is not a Cleanup
                    with a flag — the profile's words are names and products, the
                    one part of a sentence a translator must leave alone. */}
                <LaneJobRow
                  lane={lane}
                  jobKey="translate"
                  name="Translate"
                  what="Renders the dictation in another language instead of tidying it."
                  hint="Overridden: translation is where model quality shows first, and it is not on the fastest path."
                >
                  <TranslateJobSettings />
                </LaneJobRow>

                <LaneJobRow
                  lane={lane}
                  jobKey="enhance"
                  name="Prompt Enhance"
                  what="Structures raw dictation into a well-formed prompt for an external AI tool."
                >
                  <Row
                    label="Sub-mode"
                    hint="Enhance polishes without bloat; Expand restructures fully."
                    control={
                      <InertSegment
                        options={["Enhance", "Expand"]}
                        active="Enhance"
                        label="Sub-mode"
                      />
                    }
                  />
                  <Row
                    label="Prompt target"
                    hint="Optimizes prompt syntax for the chosen AI tool."
                    control={
                      <DrawnSelect defaultValue="Claude Code" aria-label="Prompt target">
                        <option>General</option>
                        <option>Claude Code</option>
                        <option>Cursor</option>
                        <option>ChatGPT</option>
                        <option>Copilot</option>
                      </DrawnSelect>
                    }
                  />
                </LaneJobRow>

                {/* DRAFT AND ASK ARE ONE THING — ADR 0040. They were two: a
                    Draft mode with a model, and a notes/meetings/Ask model beside
                    it behind a rule. The rule was honest about the surfaces being
                    different and wrong about the thing being different, and the
                    cost of the split was the sentence the product exists to
                    serve: "write the mail from Tuesday's meeting". */}
                <LaneJobRow
                  lane={lane}
                  jobKey="assistant"
                  name="The assistant"
                  what="Draft in a dictation, the Ask window, and the actions on a note and in the meeting HUD. One model for all four."
                  hint="Overridden: it is the one job that both writes from scratch and reads your material, and it is not latency-bound the way a cleanup is."
                  extra={
                    <Note icon="agents" tail={<DocLink>Open Agents</DocLink>}>
                      Not the coding agents. Those are started by {DESK}, they write code, and they
                      speak to you through the agent overlay — a different thing that only shares a
                      word.
                    </Note>
                  }
                >
                  <Row
                    label="Name you address it by"
                    hint="Also decides when Auto routes a dictation here, in every mode."
                    control={
                      <Field
                        defaultValue="WordScript"
                        w="150px"
                        aria-label="Name you address it by"
                      />
                    }
                  />
                  <Row
                    label="May read your notes and transcripts"
                    hint="Read-only, bounded to the notes directory, and it cites what it used. This is what lets an instruction point at material instead of repeating it."
                    control={<InertToggle label="May read your notes and transcripts" on />}
                  />
                  <Row
                    label="When it looks"
                    hint="On reference searches only when the dictation points at something. Always is right for Ask, wrong in a dictation."
                    control={
                      <InertSegment
                        options={["Never", "On reference", "Always"]}
                        active="On reference"
                        label="When it looks"
                      />
                    }
                  />
                </LaneJobRow>

                {/* TITLES — ADR 0087, and it is the one row here that states
                    without setting. ADR 0077 spends a model call per dictation
                    to name the transcript file and resolves it through
                    `chat_model_for_provider`, which is the assistant's model;
                    there is no per-job override to offer, so the row does not
                    open. A `<details>` onto an empty body is the affordance that
                    opens nothing, which is rule 7 applied to navigation.

                    It sits last in Writing rather than in `Runs no model`,
                    because it runs one — and the cost it owes the reader is that
                    the call is EXTRA, not that it exists.

                    THE SENTENCE IS 78 CHARACTERS BECAUSE THE NATIVE HOST SAID
                    SO. It first shipped at 228 — the Verbatim ruling and the
                    fallback both in the row — which jsdom sees as a correct
                    string and WebKitGTK draws as four lines against neighbours
                    that take one. It was cut to a number the host approved of
                    rather than to a budget — the `≤ 90` this comment used to
                    quote was never measured and ADR 0092 retired it; what
                    actually fits is whatever the control leaves. The two facts
                    that went are in ADR 0087 and ADR 0077, which is where a
                    fact that does not fit belongs. */}
                <JobNone
                  name="Titles"
                  why="Names the transcript file — one extra model call per dictation, in every mode."
                  control={<StatusBadge tone="plan">Runs the assistant's model</StatusBadge>}
                />
              </JobList>
            </div>

            <div className="ws-grp">
              <label>Speaking</label>
              <JobList>
                {/* No mark: speech synthesis providers are not in the brand set
                    and inventing a glyph for one is worse than leaving the slot
                    empty. `mark: null` is explicit so the default does not
                    quietly attribute this row to Groq. */}
                <Job
                  name="The desk's voice"
                  what="How a coding agent's question reaches you out loud, and how your answer returns."
                  control={<JobModel mark={null} model={DESK_VOICE_PRESET} />}
                  rows={
                    <CardRows>
                      <Row
                        label="Preset"
                        hint="Chosen by time to first byte, not by price."
                        control={
                          <DrawnSelect defaultValue={DESK_VOICE_PRESET} aria-label="Preset">
                            <option>{DESK_VOICE_PRESET}</option>
                            <option>{LOCAL_VOICE_PRESET}</option>
                          </DrawnSelect>
                        }
                      />
                      <Row
                        label="Measured TTFB"
                        hint="Measured on this machine, not quoted from a datasheet."
                        control={<StatusBadge tone="plan">Not measured</StatusBadge>}
                      />
                      <Row
                        label="Everything else about agents"
                        hint="Targets, the answer budget, the notification and its sound are the agent surface, not a model setting."
                        control={
                          <DrawnButton variant="ghost" icon={<Icon name="arrow" />}>
                            Agents
                          </DrawnButton>
                        }
                      />
                    </CardRows>
                  }
                />
              </JobList>
            </div>

            {/* THE MODES THAT RUN NOTHING. They belong on this screen for one
                reason: "why can I not set a model for Verbatim" is answered by
                seeing it stated. An absence answers nothing. */}
            <div className="ws-grp">
              <label>Runs no model</label>
              <JobList>
                <JobNone
                  name="Verbatim"
                  why="What the recognizer heard, with nothing after it. Nothing to set — that is the point of it."
                  control={<StatusBadge tone="plan">No model</StatusBadge>}
                />
                <JobNone
                  name="Auto"
                  why="Picks Cleanup, Draft or Prompt Enhance per dictation. Routes with Cleanup's model."
                  control={<StatusBadge tone="plan">Routes with Cleanup's model</StatusBadge>}
                />
                <JobNone
                  name="Agent"
                  why="Hands the transcript to a waiting coding agent. No transform runs — a delivery target, not a mode."
                  control={
                    <span className="ws-rowflex">
                      <StatusBadge tone="plan">delivery axis</StatusBadge>
                      <DrawnButton variant="ghost" icon={<Icon name="arrow" />}>
                        Delivery
                      </DrawnButton>
                    </span>
                  }
                />
              </JobList>
            </div>
          </div>
        </Card>
      </SectionHeader>
    </>
  );
}

/* ── On this machine ────────────────────────────────────────────────────────
   THE GAP THE THIRD SCREEN DID NOT FILL. The local lane could be selected and
   then not populated: Speech-to-Text listed four native checks with no way to
   act on any of them, and Language Models offered a lane whose models did not
   exist. Both were telling the user to leave the application and come back.

   ONE TAB FOR BOTH KINDS, because it is one installation: speech models and
   language models sit on the same disk, under the same runtime, and compete for
   the same memory. Split across the two things that consume them, the total —
   the number that matters when a model is 4 GB — would be invisible.

   **AND THE TWO HALVES DO NOT SHARE A DISK** (B5, ADR 0122). Half of ADR 0042's
   argument for one tab did not survive contact with the tree: the local chat
   role does not run a model, it talks to one Ollama runs, and Ollama owns its
   store. So WordScript downloads the speech weights into a directory it manages
   and asks the server to pull the language ones, and each card says which. The
   memory claim is the half that carries the tab, and it is still true.

   TWO COMPONENTS RATHER THAN ONE WITH A CONDITIONAL HOOK — the split
   `CeilingBadge` and `ModelsScreen` already make, for the same reason: the
   gallery asserts NO runtime state, so it must not reach for `model_library`
   at all.

   **AND THE TAB WAS SAYING *SERVER* ABOUT THIS MACHINE** (ADR 0160). It closed
   on a section called *The server* whose endpoint is `127.0.0.1` — while the
   lane row one tab over spends four lines establishing that a server is a
   machine that is NOT this one. One word, two places, opposite meanings. What
   is actually here is two programs that run models, so that is what the card
   is now called and what it lists: `whisper-cli` for speech, Ollama for
   language, each stated from what the runtime resolved rather than drawn.

   **AND THE ORDER PUTS THEM FIRST.** A model list above the thing that loads it
   asks the reader to hold two unexplained nouns until the bottom of the tab;
   the runners are the subject the two libraries are about. */
function MachineTab() {
  const wired = useWired();
  return wired ? <WiredMachineTab /> : <DrawnMachineTab />;
}

/** The tab with nothing read: the runners as the drawing has them, then the
 *  sample library. This is the tree `port:diff` measures. */
function DrawnMachineTab() {
  return (
    <>
      <DrawnRunners />
      <DrawnLibrary />
      <MachinePrivacyNote />
    </>
  );
}

/**
 * The tab with every number read.
 *
 * **One `model_library` read for the whole tab, passed down.** The runner card
 * needs the language half's answer and the libraries need the rows, and both
 * come out of the same call — a second `useModelLibrary` here would be a second
 * command probing the same network endpoint for one card.
 */
function WiredMachineTab() {
  const library = useModelLibrary();
  const { setup, asked } = useLocalSetup();

  return (
    <>
      <WiredRunners setup={setup} asked={asked} server={library.library?.server ?? null} />
      <WiredLibrary library={library} />
      <MachinePrivacyNote />
    </>
  );
}

function MachinePrivacyNote() {
  return (
    <Note icon="privacy">
      Nothing on this tab sends anything anywhere. It is the one lane where that is true by
      construction rather than by promise.
    </Note>
  );
}

/* ── The two runners ────────────────────────────────────────────────────────
   THE ROWS THAT ARE READ ARE THE FIRST TWO, and the three below them are the
   drawing's, because nothing in this build answers them yet: which Ollama runs,
   whether it is kept warm, and what acceleration exists are all real questions
   with no reader.

   **AND EACH OF THE THREE NOW SAYS SO** (ADR 0161). Leaving them drawn is
   ADR 0065's rule; leaving them SILENT was the defect. `no CUDA, ROCm or Metal
   device found` is a literal — `grep -rn "cuda\|rocm\|Metal" src-tauri/src`
   returns nothing — so on a machine with an Nvidia card the surface was making
   a specific false claim about the reader's own hardware. The owner's rule is
   that the sketch stays and the sketch declares itself, which is what the tag
   is for. **The long sentence moves into the tag's tooltip**: what a row will
   do once it is built is worth one hover and is not worth a permanent line. */
function RunnerCard({ children }: { children: ReactNode }) {
  return (
    <SectionHeader title="Runners on this machine" description="The two programs that run models here.">
      <Card>
        <CardRows>
          {children}
          <Row
            label="Who runs Ollama"
            tag={
              <PreviewTag title="Not built. WordScript ships no Ollama today — tauri.conf.json bundles no binary — so only Yours is real." />
            }
            hint="Ship one with WordScript, or use the Ollama you already run."
            control={
              <InertSegment options={["Bundled", "Yours"]} active="Bundled" label="Who runs Ollama" />
            }
          />
          <Row
            label="Keep it warm"
            tag={<PreviewTag title="Not built. Nothing reads this toggle and no model is held loaded between dictations." />}
            hint="Trades memory for a faster first dictation after idle."
            control={<InertToggle label="Keep it warm" />}
          />
          <Row
            label="Acceleration"
            tag={<PreviewTag title="Not built. Nothing in the runtime detects CUDA, ROCm or Metal yet, so this badge is a drawing and not a reading of your hardware." />}
            hint="A CPU-only machine struggles above 7B."
            control={<StatusBadge tone="plan">CPU only</StatusBadge>}
          />
        </CardRows>
      </Card>
    </SectionHeader>
  );
}

function DrawnRunners() {
  return (
    <RunnerCard>
      <Row
        label="Speech runner"
        hint="One file in, one transcript back."
        control={
          <span className="ws-rowflex">
            <StatusBadge tone="success">Ready</StatusBadge>
            <span className="ws-mono ws-muted">/usr/bin/whisper-cli</span>
          </span>
        }
      />
      <Row
        label="Language runner"
        hint="Started on demand by whichever job is on the Local lane."
        control={
          <span className="ws-rowflex">
            <StatusBadge tone="success">Answering</StatusBadge>
            <span className="ws-mono ws-muted">http://127.0.0.1:11434</span>
          </span>
        }
      />
    </RunnerCard>
  );
}

/**
 * The same two rows, from `local_setup` and `model_library` (ADR 0160).
 *
 * **`Not read` is a third state and both rows can be in it.** A probe that
 * failed and a runner that is absent are different facts, and the badge that
 * conflates them would tell somebody `whisper-cli` is missing because a command
 * errored.
 */
function WiredRunners({
  setup,
  asked,
  server,
}: {
  setup: LocalProviderSetupStatus | null;
  asked: boolean;
  server: LocalServerAnswer | null;
}) {
  return (
    <RunnerCard>
      <Row
        label="Speech runner"
        hint={
          setup && !setup.runner_ready
            ? setup.guidance
            : "whisper-cli. WordScript hands it a file and reads one transcript back."
        }
        control={
          <span className="ws-rowflex">
            {!asked || !setup ? (
              <StatusBadge tone="plan">Not read</StatusBadge>
            ) : setup.runner_ready ? (
              <StatusBadge tone="success">Ready</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Not found</StatusBadge>
            )}
            {setup?.resolved_runner && (
              <span className="ws-mono ws-muted">{setup.resolved_runner}</span>
            )}
          </span>
        }
      />
      <Row
        label="Language runner"
        hint={
          server && !server.reachable
            ? server.detail
            : "Ollama, on this machine. Started on demand by whichever job is on the Local lane."
        }
        control={
          <span className="ws-rowflex">
            {!server ? (
              <StatusBadge tone="plan">Not read</StatusBadge>
            ) : server.reachable ? (
              <StatusBadge tone="success">Answering</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Not running</StatusBadge>
            )}
            {server && <span className="ws-mono ws-muted">{server.base_url}</span>}
          </span>
        }
      />
    </RunnerCard>
  );
}

/* ── The library, as the gallery draws it ───────────────────────────────────
   The sample state Leg 6 ported, unchanged in shape and now stating its sizes
   from the catalogue rather than from a literal beside them (ADR 0115's last
   inventory entry, taken by B5). A drawn row has no handler and no reason, so
   it renders exactly the tree `port:diff` measures. */
function DrawnLibrary() {
  return (
    <>
      <SectionHeader
        title="Speech models"
        description="WordScript manages these files. Larger is more accurate and slower."
      >
        <Card
          footer={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">2 installed · 284 MB</StatusBadge>
              <span className="ws-muted">
                In <span className="ws-mono">~/.local/share/wordscript/models</span>
              </span>
            </span>
          }
        >
          <ModelList>
            <ModelRow {...libraryModel("local-speech-base")} state="installed" active />
            <ModelRow {...libraryModel("local-speech-base-en")} state="installed" />
            <ModelRow {...libraryModel("local-speech-small")} state="downloading" pct={38} />
            <ModelRow {...libraryModel("local-speech-medium")} />
            <ModelRow {...libraryModel("local-speech-large-v3-turbo")} />
          </ModelList>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Language models"
        description="Ollama owns these files. WordScript asks it to pull one."
      >
        <Card
          footer={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">2 installed · 6.4 GB</StatusBadge>
              <DrawnButton variant="ghost" icon={<Icon name="folder" />}>
                Open the model folder
              </DrawnButton>
            </span>
          }
        >
          <ModelList>
            <ModelRow {...libraryModel("local-chat-qwen-7b")} state="installed" active />
            <ModelRow {...libraryModel("local-chat-llama-3b")} state="installed" />
            <ModelRow {...libraryModel("local-chat-gemma-4b")} />
            <ModelRow {...libraryModel("local-chat-qwen-14b")} />
          </ModelList>
        </Card>
        <Note>
          The sizes are on disk. Loading one costs roughly the same again in memory, and a model
          that does not fit does not fail at download time — it fails at first use.
        </Note>
      </SectionHeader>
    </>
  );
}

/* ── The library, as this machine actually has it (B5, ADR 0122) ────────────
   Same two cards, same rows, and every number read rather than drawn. The
   footers are the one place the difference is loudest: `2 installed · 284 MB`
   was a sample, and what stands here is a count of files that exist plus the
   bytes they occupy. A machine with nothing installed reads `0 installed`,
   which is the sentence four invented profile rows used to prevent anyone from
   ever seeing. */
function WiredLibrary({ library: source }: { library: ReturnType<typeof useModelLibrary> }) {
  const runtime = useRuntime();
  const {
    library,
    rows,
    folders,
    error,
    failures,
    install,
    cancel,
    remove,
    openFolder,
    importFile,
    addFolder,
    removeFolder,
    pullTag,
  } = source;

  /* One query and one origin filter, shared by both cards. Two of each would
     be two states that disagree about what the user is looking for, and the
     toolbar the prototype draws is one line above one list. */
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<"All models" | "Installed" | "Yours">("All models");

  const speech = rows.filter((row) => row.mechanism === "download");
  const language = rows.filter((row) => row.mechanism === "server_pull");

  /* The active profile decides what `In use` means, and writing it is what the
     drawn `Use` button was always for. A gallery render never reaches here. */
  const useModel = (row: ManagedModelRow) => {
    if (!runtime) return;
    runtime.patch(
      buildProfileSpeechPatch(
        runtime.config,
        row.role === "speech"
          ? { local_model: localStemOf(row) }
          : { local_correction_model: pullTagOf(row) ?? row.model_id },
      ),
    );
  };

  const card = (rowsForCard: ManagedModelRow[]) => {
    const shown = filterRows(rowsForCard, query, origin);

    /* **The toolbar appears only when the list outgrows the drawing**, and that
       is what lets this surface grow without the port losing its subject. Nine
       rows is what Leg 6 drew and what `port:diff` measures; past the threshold
       the list is no longer the drawing and a search is the honest control.
       The number is openwhispr's `LIST_SEARCH_THRESHOLD`, borrowed rather than
       invented — it is the count at which that donor switches a plain list for
       a searchable one. */
    const searchable = rowsForCard.length > LIST_SEARCH_THRESHOLD;

    return (
      <>
        {searchable && (
          <Toolbar label="Filter models">
            <ToolbarSearch>
              <Field
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models…"
                aria-label="Search models"
              />
            </ToolbarSearch>
            <Select
              value={origin}
              onChange={(event) => setOrigin(event.target.value as typeof origin)}
              aria-label="Show"
            >
              {(["All models", "Installed", "Yours"] as const).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Toolbar>
        )}
        {shown.length === 0 && rowsForCard.length > 0 ? (
          /* **Naming the query rather than saying "nothing here"**, and only
             where there IS something here: a card with no rows at all is an
             empty list, not a filter that found nothing, and telling somebody
             their filter is too narrow when they have not typed one is a false
             sentence about their own machine. */
          <Note icon="search">
            {query.trim()
              ? `No model here matches “${query.trim()}”.`
              : "Nothing here matches that filter."}
          </Note>
        ) : (
          <ModelList>
            {shown.map((row) => (
              <ModelRow
                key={row.row}
                {...drawnLibraryRow(row)}
                state={stateOf(row)}
                active={Boolean(row.in_use_by)}
                pct={percentOf(row)}
                reason={failures[row.row] ?? unreachableReason(row)}
                onDownload={() => void install(row.row)}
                onCancel={() =>
                  row.state.kind === "installing" ? void cancel(row.state.install_id) : undefined
                }
                onRemove={() => void remove(row.row)}
                onUse={() => useModel(row)}
              />
            ))}
          </ModelList>
        )}
      </>
    );
  };

  return (
    <>
      <SectionHeader
        title="Speech models"
        description="WordScript manages these files. Larger is more accurate and slower."
      >
        <Card
          footer={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">{installedSummary(speech)}</StatusBadge>
              {/* THE FIRST OF TWO WAYS IN (ADR 0159): the file is copied into
                  the folder WordScript manages, so removal, the total and the
                  discovery all keep one rule. The second — a folder used where
                  it lies — is the folder list directly below. */}
              <Button
                variant="ghost"
                icon={<Icon name="upload" />}
                onClick={() => void pickModelFile(importFile)}
              >
                Add a model…
              </Button>
              <Button variant="ghost" icon={<Icon name="folder" />} onClick={() => void openFolder()}>
                Open the model folder
              </Button>
            </span>
          }
        >
          {card(speech)}
        </Card>

        {/* **THE FOLDER LIST BELONGS TO THE SPEECH CARD** (ADR 0160). It stood
            at the foot of the tab under the title *Where models come from*,
            which by reading order answered for the card directly above it — the
            language one, whose files are in a store this list has never
            described. `folders` is `local_model_sources()`, speech only, and it
            is now stated where its subject is. */}
        <Card
          footer={
            <span className="ws-rowflex">
              <Button
                variant="ghost"
                icon={<Icon name="folder" />}
                onClick={() => void pickModelFolder(addFolder)}
              >
                Add a folder…
              </Button>
              <span className="ws-muted">
                A folder you add is read and never written to — the models in it stay where they
                are.
              </span>
            </span>
          }
        >
          <CardRows>
            <Row
              label="Where these come from"
              hint="Highest first — when two hold the same model, the higher one runs."
              control={<StatusBadge tone="plan">{folders.length} searched</StatusBadge>}
            />
            {folders.map((folder) => (
              <Row
                key={folder.path}
                label={folder.kind}
                hint={folder.exists ? undefined : "This folder is not there right now — a share that is not mounted is not an empty folder."}
                control={
                  <span className="ws-rowflex">
                    <span className="ws-mono ws-muted">{folder.path}</span>
                    {!folder.exists && <StatusBadge tone="warning">Not mounted</StatusBadge>}
                    {folder.removable && (
                      <IconButton
                        label={`Stop looking in ${folder.path}`}
                        icon={<Icon name="trash" />}
                        tone="danger"
                        onClick={() => void removeFolder(folder.path)}
                      />
                    )}
                  </span>
                }
              />
            ))}
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Language models"
        description="Ollama owns these files. WordScript asks it to pull one."
      >
        <Card
          footer={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">{installedSummary(language)}</StatusBadge>
              {/* THE LANGUAGE HALF'S WAY IN, and it is a typed tag rather than
                  a file because Ollama owns that store: there is no folder to
                  point at and no file to copy. The donor draws the same control
                  for the same reason (openwhispr's `allowCustomModelId`). */}
              <PullTagField onPull={pullTag} />
            </span>
          }
        >
          {card(language)}
        </Card>
        {/* THE LANGUAGE HALF'S ANSWER TO THE SAME QUESTION (ADR 0160), and it
            is one row rather than a list because there is one store and it is
            not WordScript's. Stating the endpoint here rather than a directory
            is the honest form: the runtime knows which server it asks, and it
            does not know where that server keeps its files. */}
        <Card>
          <CardRows>
            <Row
              label="Where these come from"
              hint="Ollama's own store, which is why a pull is a tag rather than a file."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Ollama's store</StatusBadge>
                  {library && <span className="ws-mono ws-muted">{library.server.base_url}</span>}
                </span>
              }
            />
          </CardRows>
        </Card>
        <Note>
          The sizes are on disk. Loading one costs roughly the same again in memory, and a model
          that does not fit does not fail at download time — it fails at first use.
        </Note>
        {/* The runner's own answer, stated where its models are listed. A card
            that showed four rows as "not installed" because nothing asked it
            would be claiming about a disk nobody looked at. */}
        {library && !library.server.reachable && (
          <Note icon="alert">{library.server.detail}</Note>
        )}
        {error && <Note icon="alert">{error}</Note>}
      </SectionHeader>
    </>
  );
}

/**
 * THE COUNT AT WHICH A LIST STOPS BEING A LIST (ADR 0159).
 *
 * Borrowed rather than invented: openwhispr's `LIST_SEARCH_THRESHOLD` is the
 * number that donor switches a plain model list for a searchable, grouped one
 * at, and it has the scale to have found out. Below it this surface is exactly
 * the drawing Leg 6 ported and `port:diff` still has its subject; above it the
 * list is no longer the drawing and a search is the honest control.
 */
const LIST_SEARCH_THRESHOLD = 12;

/** The nine rows the drawing carries a sentence for. Everything else renders
 *  from the runtime's own facts — see `drawnLibraryRow`. */
const LIBRARY_ROW_IDS = new Set<string>([...LIBRARY_SPEECH_ROWS, ...LIBRARY_LANGUAGE_ROWS]);

/** The rows a query and an origin filter leave standing. */
function filterRows(
  rows: ManagedModelRow[],
  query: string,
  origin: "All models" | "Installed" | "Yours",
): ManagedModelRow[] {
  const needle = query.trim().toLowerCase();

  return rows.filter((row) => {
    if (origin === "Installed" && row.state.kind !== "installed") return false;
    if (origin === "Yours" && row.origin !== "yours") return false;
    if (!needle) return true;

    /* The name, the slug and the drawn sentence. Not the path: a person
       searching for a model is not searching for a directory, and matching one
       would make `/home/felix` return every row they own. */
    const drawn = drawnLibraryRow(row);
    return (
      row.model_id.toLowerCase().includes(needle) ||
      row.row.toLowerCase().includes(needle) ||
      drawn.detail.toLowerCase().includes(needle)
    );
  });
}

/**
 * Ask for the model file, then hand the path to the runtime.
 *
 * The picker is the frontend's because that is where the dialog plugin lives;
 * everything after the path — the name check, the free-space check, the copy
 * and its progress — is the runtime's. A frontend that read the bytes itself
 * would be a second copy of a 1.6 GB file in the webview's memory.
 */
async function pickModelFile(importFile: (path: string) => Promise<void>) {
  const picked = await openFileDialog({
    multiple: false,
    directory: false,
    filters: [{ name: "whisper.cpp model", extensions: ["bin"] }],
  });
  if (typeof picked === "string") await importFile(picked);
}

async function pickModelFolder(addFolder: (path: string) => Promise<void>) {
  const picked = await openFileDialog({ multiple: false, directory: true });
  if (typeof picked === "string") await addFolder(picked);
}

/**
 * A tag the catalogue does not carry, typed and pulled.
 *
 * Its own component because it holds a draft: the field has to keep what is
 * being typed, and lifting that into `WiredLibrary` would re-render both model
 * lists on every keystroke.
 */
function PullTagField({ onPull }: { onPull: (tag: string) => Promise<void> }) {
  const [tag, setTag] = useState("");

  return (
    <span className="ws-rowflex">
      <Field
        value={tag}
        onChange={(event) => setTag(event.target.value)}
        placeholder="qwen2.5:7b-instruct-q4_K_M"
        w="230px"
        aria-label="Pull a tag"
      />
      <Button
        variant="ghost"
        icon={<Icon name="download" />}
        disabled={!tag.trim()}
        onClick={() => {
          void onPull(tag.trim());
          setTag("");
        }}
      >
        Pull
      </Button>
    </span>
  );
}

/** The drawn half of a live row: the mark and the sentence, with the size read
 *  from the runtime rather than from the catalogue, because after an install
 *  the file's own length is the honest number. */
function drawnLibraryRow(row: ManagedModelRow) {
  const size = formatModelSize(
    row.state.kind === "installed" ? row.state.bytes : row.size_bytes,
  );

  /* **A row the drawing has no sentence for still renders** (B8, ADR 0159), and
     it has to: `libraryModel` throws for anything outside the nine rows Leg 6
     drew, which was correct while the list WAS those nine and became a crash
     the moment the tab started listing what is actually on the disk. The
     drawing keeps its sentence where it has one; everything else is composed
     from what the runtime knows, which is exactly what the donors do for a
     model they did not curate — Handy's custom rows read "Not officially
     supported" because nobody wrote them a description either. */
  const drawn = LIBRARY_ROW_IDS.has(row.row) ? libraryModel(row.row) : undefined;
  if (drawn) return { ...drawn, size };

  return {
    brand: undefined,
    name: row.model_id,
    size,
    detail:
      row.origin === "yours"
        ? `yours · ${row.folder ?? "on this machine"}`
        : [row.quantization, "not described here"].filter(Boolean).join(" · "),
  };
}

function stateOf(row: ManagedModelRow): ModelState {
  switch (row.state.kind) {
    case "installed":
      return "installed";
    case "installing":
      return "downloading";
    /* An unknown row draws as available with the server's sentence on it.
       Inventing a fourth appearance for "nobody asked the disk" would put a
       state on this surface that the runtime does not have. */
    default:
      return "available";
  }
}

function percentOf(row: ManagedModelRow): number {
  if (row.state.kind !== "installing" || row.size_bytes <= 0) return 0;
  return Math.min(100, Math.round((row.state.received_bytes / row.size_bytes) * 100));
}

function unreachableReason(row: ManagedModelRow): string | undefined {
  if (row.in_use_by && row.state.kind === "installed") {
    return `${row.in_use_by} runs on this model — change that profile first.`;
  }
  return row.state.kind === "unknown" ? row.state.detail : undefined;
}

/** `2 installed · 284 MB`, counted rather than drawn. */
function installedSummary(rows: ManagedModelRow[]): string {
  const installed = rows.filter((row) => row.state.kind === "installed");
  const bytes = installed.reduce(
    (total, row) => total + (row.state.kind === "installed" ? row.state.bytes : 0),
    0,
  );
  return installed.length === 0
    ? "0 installed"
    : `${installed.length} installed · ${formatModelSize(bytes)}`;
}

/** What the config calls a local recogniser: the stem, never the file name. */
function localStemOf(row: ManagedModelRow): string {
  const install = modelInstall(row.row);
  if (install?.kind !== "download") return row.model_id;
  return install.file_name.replace(/^ggml-/, "").replace(/\.bin$/, "");
}

/** What the config calls a local language model: the server's tag. */
function pullTagOf(row: ManagedModelRow): string | undefined {
  const install = modelInstall(row.row);
  return install?.kind === "server_pull" ? install.tag : undefined;
}

/* The prototype's `seg()` and `toggle()`: a demo control that moves its own
   thumb and changes nothing, which is honest for a surface that asserts
   nothing. Only the connection lane governs anything, and it is `segState()`
   there for exactly that reason. */
export function InertSegment({
  options,
  active,
  label,
  onChange,
}: {
  options: string[];
  active: string;
  label: string;
  /** Given, the segment governs something and is `segState()` rather than
   *  `seg()` — the prototype's one non-inert case. */
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(active);
  return (
    <SegmentControl
      options={options.map((v) => ({ value: v, label: v }))}
      value={onChange ? active : value}
      onChange={onChange ?? setValue}
      aria-label={label}
    />
  );
}

export function InertToggle({ label, on = false }: { label: string; on?: boolean }) {
  const [checked, setChecked] = useState(on);
  return <DrawnToggle checked={checked} onCheckedChange={setChecked} aria-label={label} />;
}
