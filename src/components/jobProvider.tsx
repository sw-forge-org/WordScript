import {
  createContext,
  useCallback,
  useContext,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Button,
  Card,
  CardRows,
  Disclosure,
  Field,
  Icon,
  Row,
  Select,
  SelectMark,
  StatusBadge,
  Toggle,
} from "@/components/shell";
import { LANES, providerNames, type JobKey, type LaneName } from "@/screens/data";
import {
  buildProfileProvidersPatch,
  resolveActiveTextProfile,
  resolveConfigJobProvider,
  resolveProfileProviderSettings,
} from "@/lib/textProfiles";
import {
  credentialStateFor,
  drawnNameFor,
  NO_ANSWERS,
  resolveProviderAnswer,
  resolveUploadAnswer,
  roleForDrawnCapability,
  runtimeIdFor,
  SELF_HOSTED_PROVIDER_ID,
  type RuntimeAnswers,
} from "@/lib/providerSeam";
import { useProviderSeam } from "@/hooks/useProviderSeam";
import { useUploadCapacity } from "@/hooks/useUploadCapacity";
import { laneJobModels } from "@/lib/modelCatalogue";
import type { ProviderRole, UploadCapacity } from "@/types/providers";
import type { WorkspaceRuntime } from "@/screens/props";

/**
 * THE JOB-PROVIDER LADDER — lane, vendor, credential, model — and the two
 * contexts every drawn control on it reads.
 *
 * **It lived inside `Models.tsx` until B7 and it could, because one surface
 * rendered it.** ADR 0129 then moved the provider choice to the point of use:
 * the upload intake and `Translate.tsx` draw the same rows, so the rows became
 * a shared thing rather than a screen's internals. ADR 0055's rule is why this
 * is an extraction and not a second copy — a drawing rendered by two
 * implementations is two drawings that agree today.
 *
 * **What did NOT move is what is genuinely `AI Models`' own**: the lane
 * segment, the connection card, the model library, `ProviderPick`. Those
 * configure the connection; these state and change where one job runs.
 */

/**
 * THE PRODUCT SURFACE, AS EVERY DRAWN CONTROL ON A LADDER SEES IT.
 *
 * ADR 0065: Groq is the only lane WordScript integrates, the UI does not
 * change, and everything else is inert and SAYS SO. `AI Models` alone has ~40
 * drawn controls across eight job rows and two tabs, and passing a flag to each
 * one by hand is a list nobody keeps correct. So the surface declares itself
 * once and the drawn controls read it — in the gallery there is no provider and
 * every control is the drawing, live and writing nowhere in particular; on the
 * product they are disabled with the reason as their tooltip.
 *
 * The Connection card does NOT read it. Its rows are the ones that are really
 * wired, and they use the plain components.
 */
export const Wired = createContext<{
  on: boolean;
  open?: WorkspaceRuntime["open"];
  /* Carried so the Translate job row can read the profile it states and write
     the two settings that are the machine's. Every other control on this screen
     is a model choice, and a model choice has no config shape to write into yet
     (ADR 0042, plan §11.36). */
  runtime?: WorkspaceRuntime;
  /* What the runtime says about the vendors this lane draws (ADR 0106). The
     drawing is still `data.ts`; this is the other side of the seam, and the
     controls below read it for WHY they are inert rather than for what they
     are. */
  answers: RuntimeAnswers;
  refresh?: () => Promise<void>;
  /**
   * WHICH VENDOR THE CLOUD CONNECTION IS ON, by drawn name — the one piece of
   * state this screen now writes besides a credential (D1).
   *
   * It is on the context rather than inside `ProviderPick` because three
   * things need the same answer and they are siblings, not ancestors: the chip
   * row that sets it, the credential row directly beneath it, and every job row
   * that says *Follow the connection · X*. It was local state until the second
   * adapter landed, and it could be, because with one registered vendor the
   * three could not disagree.
   *
   * `undefined` where the surface is the gallery: there is no config to read
   * and `ProviderPick` keeps its own state, which is what makes the drawing
   * still work with nothing behind it.
   */
  connection?: string;
  setConnection?: (drawnName: string) => void;
  /**
   * WHICH VENDOR ONE JOB OVERRIDES TO, written per job (ADR 0128).
   *
   * `null` clears the override, which is the stored form of *follow the
   * connection* — the absence is the value (ADR 0094), so *Use the default*
   * deletes a key rather than writing the connection's id into it. Writing the
   * id would make the row stop following a connection the user later changes.
   *
   * `undefined` in the gallery, where the drawn literal keeps deciding the
   * shape and there is no config to write to.
   */
  setJobOverride?: (job: JobKey, drawnName: string | null) => void;
}>({ on: false, answers: NO_ANSWERS });

export function useWired() {
  return useContext(Wired).on;
}

export function useAnswers(): RuntimeAnswers {
  return useContext(Wired).answers;
}

/**
 * WHY THE CONTROL UNDER THIS SUBTREE CANNOT BE OPERATED — one sentence, or none.
 *
 * `null` is the gallery, where nothing is inert and every control is the
 * drawing. The default on the product is ADR 0065's blanket sentence, and a
 * subtree that knows better replaces it: a job row whose provider the runtime
 * has an answer about states THAT answer, because "not integrated yet" said
 * over a vendor that is integrated and merely missing its key is the
 * conflation ADR 0106 exists to end.
 */
export const InertBecause = createContext<string | null>(null);

export function useInertReason(): string | null {
  return useContext(InertBecause);
}

export function useRuntime(): WorkspaceRuntime | undefined {
  return useContext(Wired).runtime;
}

/** The `Per profile` tag's door. It is `runtime.open` and it is real now — a
 *  tag that names an owner and cannot reach it makes the reader search for what
 *  it just told them about. In the gallery there is nowhere to go, and
 *  `ScopeTag` renders a span rather than a button when `onOpen` is absent. */
export function useOpenProfiles(): (() => void) | undefined {
  const { open } = useContext(Wired);
  return useCallback(() => open?.({ view: "profiles" }), [open]);
}

export const NOT_INTEGRATED = "Not integrated yet — Groq is the lane WordScript runs (ADR 0065)";

/**
 * THE FILE THE PICKER IS ABOUT TO SEND, WHERE THERE IS ONE (B7, ADR 0129).
 *
 * A second context rather than four more props, and for the reason `Wired` is
 * one: the ladder renders up to four controls and a prop threaded through all
 * of them is the list this codebase already calls "a list nobody keeps
 * correct".
 *
 * **Its default is the whole compatibility story.** `AI Models` never provides
 * it, so `fileBytes` stays `null` there, `resolveUploadAnswer` returns the
 * vendor answer untouched, and the settings surface behaves exactly as it did
 * before this step — which is what keeps `port:diff` still on `models`.
 */
export const UploadConstraint = createContext<{
  fileBytes: number | null;
  capacities: Record<string, UploadCapacity>;
}>({ fileBytes: null, capacities: {} });

export function useUploadConstraint() {
  return useContext(UploadConstraint);
}

export function DrawnSelect(props: ComponentProps<typeof Select>) {
  const reason = useInertReason();
  return <Select {...props} disabled={Boolean(reason) || props.disabled} title={reason ?? props.title} />;
}

export function DrawnField(props: ComponentProps<typeof Field>) {
  const reason = useInertReason();
  return <Field {...props} disabled={Boolean(reason) || props.disabled} title={reason ?? props.title} />;
}

export function DrawnButton(props: ComponentProps<typeof Button>) {
  const reason = useInertReason();
  return <Button {...props} disabled={Boolean(reason) || props.disabled} title={reason ?? props.title} />;
}

export function DrawnToggle(props: ComponentProps<typeof Toggle>) {
  const reason = useInertReason();
  return <Toggle {...props} disabled={Boolean(reason) || props.disabled} />;
}

/**
 * THE RUNTIME BEHIND A LADDER, WHEREVER ONE IS DRAWN (ADR 0106, ADR 0124).
 *
 * The blanket reason is still ADR 0065's — most of this screen is inert because
 * WordScript integrates one lane, and that has not changed. What changed is
 * that a subtree the runtime has a better answer for now states THAT answer
 * instead, and the default is a default rather than the only sentence there is.
 */
export function JobProviderRuntime({
  lane,
  runtime,
  children,
}: {
  lane: LaneName;
  runtime: WorkspaceRuntime;
  children: ReactNode;
}) {
  const { answers, refresh } = useProviderSeam(lane, runtime.config.model);

  /* THE CONNECTION IS THE STORED ONE, not the drawn one. `LANES.Cloud.provider`
     is `"Groq"` because that is what the prototype drew; what the pipeline
     spends is `providers.default` on the active profile, which A4 made
     per-profile and per-job. A stored id with no drawn name falls back to the
     drawing rather than rendering a storage key into a chip. */
  const stored = resolveConfigJobProvider(runtime.config, "dictation").provider;
  const connection = drawnNameFor(stored) ?? LANES[lane].provider;

  const setConnection = useCallback(
    (drawnName: string) => {
      const id = runtimeIdFor(drawnName);
      /* A name with no id is this repo naming its vendors inconsistently, and
         `providerSeam.test.ts` fails on it long before a user gets here.
         Writing nothing is still the right answer at runtime: a config holding
         a name the registry cannot resolve is dropped on load, so the write
         would look like it worked and then vanish. */
      if (!id) return;
      runtime.patch(buildProfileProvidersPatch(runtime.config, { default: id }));
    },
    [runtime],
  );

  /* THE PER-JOB OVERRIDE, written through the same door as the connection
     (ADR 0128). The map is read back off the active profile rather than kept
     beside it, because two rows changed in one session must not each write a
     map built from what they saw when the screen opened. */
  const setJobOverride = useCallback(
    (job: JobKey, drawnName: string | null) => {
      const axis = resolveProfileProviderSettings(resolveActiveTextProfile(runtime.config));
      const overrides = { ...axis.overrides };

      if (drawnName === null) {
        delete overrides[job];
      } else {
        const id = runtimeIdFor(drawnName);
        if (!id) return;
        /* Overriding to the connection's own vendor is not an override. Storing
           it would freeze this job onto today's connection, so the row stops
           following one the user changes later — which is the opposite of what
           picking the connection's name means. */
        if (id === axis.default) {
          delete overrides[job];
        } else {
          overrides[job] = id;
        }
      }

      runtime.patch(buildProfileProvidersPatch(runtime.config, { overrides }));
    },
    [runtime],
  );

  return (
    <Wired.Provider
      value={{
        on: true,
        open: runtime.open,
        runtime,
        answers,
        refresh,
        connection,
        setConnection,
        setJobOverride,
      }}
    >
      <InertBecause.Provider value={NOT_INTEGRATED}>{children}</InertBecause.Provider>
    </Wired.Provider>
  );
}

/**
 * The drawn name of a job's STORED override, or `undefined` where it follows
 * the connection (ADR 0128).
 *
 * A stored id with no drawn name is treated as no override rather than rendered
 * as a storage key — the same call `WiredModels` makes for the connection, and
 * for the same reason (ADR 0127).
 */
function storedOverrideName(runtime: WorkspaceRuntime, job: JobKey): string | undefined {
  const resolved = resolveConfigJobProvider(runtime.config, job);
  if (!resolved.overridden) return undefined;
  return drawnNameFor(resolved.provider);
}

/**
 * THE OVERRIDE ROWS. Every job takes the same three, in the same order, and the
 * first one is the one that matters: this job either follows the connection or
 * it does not. Saying that explicitly is what lets the connection card above be
 * believed.
 */
export function Follows({
  lane,
  jobKey,
  cap = "llm",
  hint,
  model: fallbackModel,
  extra,
}: {
  lane: LaneName;
  jobKey?: JobKey;
  cap?: "stt" | "llm";
  hint?: ReactNode;
  model?: string;
  extra?: ReactNode;
}) {
  const wired = useWired();
  const answers = useAnswers();
  const { runtime: wiredRuntime, setJobOverride } = useContext(Wired);
  const lj = jobKey ? LANES[lane].jobs[jobKey] : {};
  const model = lj.model ?? fallbackModel ?? "";
  const models = lj.models ?? (model ? [model] : []);
  /* THE CONNECTION IS THE STORED ONE WHERE THERE IS ONE (D1). `Follow the
     connection · Groq` on a profile whose connection is OpenAI is a row stating
     a vendor the runtime is not using — and it is the sentence a user reads to
     find out where a job runs. At the default it is the drawn value, which is
     why `port:diff` does not move for this. */
  const conn = useContext(Wired).connection ?? LANES[lane].provider;

  /* WHETHER THIS JOB OVERRIDES, AND WHO ANSWERS THAT (ADR 0128).
     The drawn `override` literal decides the row's SHAPE — a provider mark, a
     *Use the default* button and an API-key row of its own. Three jobs carry
     one, and they carry it because the demo GUI drew a plausible product
     before there was a config axis to hold it. A4 then decided the runtime's
     answer: a fresh profile overrides nothing.

     So the config answers where there IS a config, and the drawing answers
     where there is not. That is ADR 0127's own arrangement for `ProviderPick`
     one axis over, and it is what keeps both true at once: the gallery still
     shows the shape the product intends to offer — the inventory of what is
     coming — while the product shows only what is stored. `port:diff` compares
     the prototype against the GALLERY, so it does not move for this. */
  const storedOverride =
    wired && wiredRuntime && jobKey && lane === "Cloud"
      ? storedOverrideName(wiredRuntime, jobKey)
      : undefined;
  const override = wired ? storedOverride : lj.override;

  /* WHICH VENDOR THIS JOB WOULD RUN ON, and therefore which answer applies:
     the override where the drawing gives one, the connection otherwise. The
     role comes from the job's own column — `stt` and `llm` are what the
     drawing calls its axes, `speech` and `chat` what a credential is keyed by
     (ADR 0105), and `roleForDrawnCapability` is the one translation. */
  const runsOn = override ?? conn;
  const followOption = `Follow the connection · ${conn}`;
  const answer = wired
    ? resolveProviderAnswer(runsOn, roleForDrawnCapability(cap), answers)
    : null;
  /* A row inert for a reason the runtime can name says THAT reason; one inert
     because this build integrates a single lane keeps ADR 0065's sentence.
     Never both, and never the wrong one — which is the whole of ADR 0106.

     `pending` keeps the blanket sentence rather than replacing it with "not
     read": the read being outstanding claims nothing, and ADR 0065's reason is
     true for this row whether or not the runtime has answered. The runtime can
     refine that sentence; it may not make the surface flicker through a second
     one on the way. */
  const reason =
    answer && !answer.operable && answer.reason.kind !== "pending"
      ? answer.reason.sentence
      : undefined;

  /* WHAT THE `Your server` LANE IS ACTUALLY POINTED AT (D1b, ADR 0165).
     `null` in the gallery, which is what keeps the two rows below drawn exactly
     as the prototype drew them; an object under a runtime, even before the
     status has arrived — the difference between *not read yet* and *not set* is
     one this screen already spells out elsewhere (ADR 0160). */
  const wiredServer =
    wired && lane === "Self-hosted"
      ? { endpoint: answers.statuses[SELF_HOSTED_PROVIDER_ID]?.self_hosted_endpoint ?? null }
      : null;

  /* The provider row only exists where there is a provider to pick. On
     Local the choice is a file and on Self-hosted it is a URL, so offering
     "which company" there would be furniture with nothing behind it. */
  const providerRow =
    lane === "Cloud" || lane === "Enterprise" ? (
        <Row
          label="Provider"
          hint={hint ?? "Follows the connection unless you change it here."}
          control={
            override ? (
              <span className="ws-rowflex">
                <SelectMark name={override} />
                <ProviderChoice
                  lane={lane}
                  cap={cap}
                  jobKey={jobKey}
                  value={override}
                  follow={followOption}
                />
                {/* CLEARS THE OVERRIDE, it does not write the connection's id
                    (ADR 0094 — the absence is the value). In the gallery there
                    is no override to clear and the button is the drawing. */}
                <DrawnButton
                  variant="ghost"
                  onClick={jobKey && setJobOverride ? () => setJobOverride(jobKey, null) : undefined}
                >
                  Use the default
                </DrawnButton>
              </span>
            ) : (
              <span className="ws-rowflex">
                <SelectMark name={conn} />
                <ProviderChoice
                  lane={lane}
                  cap={cap}
                  jobKey={jobKey}
                  value={followOption}
                  follow={followOption}
                />
              </span>
            )
          }
        />
      ) : lane === "Local" ? (
        <Row
          label="Runs on"
          hint="This machine. Which model is the only choice there is — there is no account behind it."
          control={
            <span className="ws-rowflex">
              <StatusBadge tone="success">Local runtime</StatusBadge>
              <DrawnButton variant="ghost" icon={<Icon name="arrow" />}>
                Installed models
              </DrawnButton>
            </span>
          }
        />
      ) : wiredServer ? (
        /* THE ENDPOINT THIS JOB WOULD ACTUALLY POST TO (D1b, ADR 0165). It was
           the literal `http://10.0.0.2:8080/v1` — harmless while the lane could
           not be selected, and a row stating somebody else's LAN address the
           moment it could. The drawn one stays below, because that is what
           `port:diff` measures. */
        <Row
          label="Endpoint"
          hint="The server set on the connection above. Every job on this lane posts to it."
          control={
            <span className="ws-mono ws-muted">
              {wiredServer.endpoint ? (wiredServer.endpoint.base_url ?? "Not set") : "Not read"}
            </span>
          }
        />
      ) : (
        <Row
          label="Endpoint"
          hint="The server set on the connection above. Every job uses the same one; only the model id differs."
          control={<span className="ws-mono ws-muted">http://10.0.0.2:8080/v1</span>}
        />
      );

  const modelAndKeyRows = (
    <>
      {lane === "Self-hosted" && wiredServer ? (
        /* ONE ID PER SERVER, AND THE ROW STATES IT RATHER THAN OFFERING TO TAKE
           A SECOND (D1b, ADR 0165). The drawn field promises a per-job model id
           and nothing stores one: the capture puts the connection's id on every
           request this lane makes. A field that accepts a value the runtime
           will not read is the false affordance ADR 0067 rule 1 is about, and
           the honest row is the value with the door to where it is set. */
        <Row
          label="Model id"
          hint="One per server, set on the connection above — your server publishes no list, so every job on this lane sends the same typed id."
          control={
            <span className="ws-mono ws-muted">
              {wiredServer.endpoint ? (wiredServer.endpoint.model ?? "Not set") : "Not read"}
            </span>
          }
        />
      ) : lane === "Self-hosted" ? (
        <Row
          label="Model id"
          hint="Not discoverable on every server, so it is typed rather than picked."
          control={<DrawnField placeholder="llama-3.3-70b" w="190px" aria-label="Model id" />}
        />
      ) : (
        <Row
          label="Model"
          control={
            <DrawnSelect defaultValue={model} aria-label="Model">
              {models.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </DrawnSelect>
          }
        />
      )}

      {override && (lane === "Cloud" || lane === "Enterprise") && (
        <Row
          label="API key"
          hint="Its own, because this job is not on the connection above. Held in the OS secret store like every other."
          control={
            <OverrideKeyBadge drawnName={override} role={roleForDrawnCapability(cap)} />
          }
        />
      )}

    </>
  );

  /* THE REASON GOVERNS THE VENDOR AND MODEL ROWS AND STOPS THERE.
     `extra` is the caller's own — on Translate those four rows are the mode's
     settings, not model choices, and two of them have had a config home since
     the commit that added the mode (ADR 0041). A job whose *model provider* has
     no adapter has not stopped having a target language, and disabling one for
     the other would be the same conflation this step exists to end, one axis
     over.

     Provided to the subtree rather than passed to each control: this renders up
     to four and a prop threaded through all of them is the list this screen's
     own header calls "a list nobody keeps correct". */
  const withReason = (children: ReactNode) =>
    reason ? <InertBecause.Provider value={reason}>{children}</InertBecause.Provider> : children;

  return (
    <CardRows>
      {/* THE PROVIDER ROW IS THE WAY OUT OF THE REASON, so the reason may not
          disable it (ADR 0128). A row inert because its vendor has no adapter
          or no key is a row whose fix is *pick a different vendor* — and until
          this step that control was disabled by the very sentence telling the
          user what to do about it. The reason still governs the model and the
          key below, which are choices ON the vendor rather than choices OF it.

          Only where there is something to pick: the gallery inherits `null`
          anyway, and the three unintegrated lanes keep ADR 0065's sentence. */}
      {wired && lane === "Cloud" ? (
        <InertBecause.Provider value={null}>{providerRow}</InertBecause.Provider>
      ) : (
        withReason(providerRow)
      )}
      {withReason(modelAndKeyRows)}
      {extra}
    </CardRows>
  );
}

/**
 * WHERE ONE JOB RUNS — the select, and the one control on a job row that writes.
 *
 * **A vendor with no adapter stays in the list, disabled, carrying its reason**
 * (ADR 0128). That is the rule this screen is built on: the drawing is the
 * inventory of what the product intends to offer, so removing an unbuilt vendor
 * would hide what is still owed, and enabling it would offer a routing that
 * cannot run. Greyed with a sentence is the honest third answer.
 *
 * A missing credential does NOT disable an option. That vendor is integrated,
 * correct about what it does and one action away from working — the row says so
 * once it is chosen, which is ADR 0106's whole distinction.
 */
function ProviderChoice({
  lane,
  cap,
  jobKey,
  value,
  follow,
}: {
  lane: LaneName;
  cap: "stt" | "llm";
  jobKey?: JobKey;
  value: string;
  follow: string;
}) {
  const wired = useWired();
  const answers = useAnswers();
  const { setJobOverride } = useContext(Wired);
  const { fileBytes, capacities } = useUploadConstraint();
  const names = providerNames(cap, lane);

  /* THE GALLERY RENDERS THE DRAWING, unchanged. `port:diff` compares the
     prototype against the gallery, so the option list there is the one Leg 6
     drew — the follow option only on a row that follows, and no reasons,
     because nothing is inert where there is no runtime to be inert about. */
  if (!wired) {
    return (
      <DrawnSelect defaultValue={value} aria-label="Provider">
        {value === follow && <option>{follow}</option>}
        {names.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </DrawnSelect>
    );
  }

  const role = roleForDrawnCapability(cap);

  return (
    <DrawnSelect
      value={value}
      aria-label="Provider"
      onChange={(event) => {
        if (!jobKey || !setJobOverride) return;
        const picked = event.target.value;
        setJobOverride(jobKey, picked === follow ? null : picked);
      }}
    >
      {/* Present on every row, including one that already overrides: the select
          is how a row goes back to following, beside the button that does it. */}
      <option>{follow}</option>
      {names.map((name) => {
        /* THE SIZE IS ASKED HERE AND NOWHERE ELSE (B7). Off the upload
           surfaces `fileBytes` is `null` and this is `resolveProviderAnswer`
           unchanged — which is why the settings screen did not move.

           A vendor too small for THIS file is disabled like one with no
           adapter, and unlike one with no credential: a key can be added, and
           the file will not get smaller. It is never rerouted around
           (ADR 0129) — the option greys, says why, and the user picks. */
        const answer = resolveUploadAnswer(
          name,
          role,
          answers,
          fileBytes,
          capacities[runtimeIdFor(name) ?? ""],
        );
        const blocked = !answer.operable && answer.reason.kind !== "no_credential";
        return (
          <option
            key={name}
            value={name}
            disabled={blocked}
            title={blocked ? answer.reason.sentence : undefined}
          >
            {name}
          </option>
        );
      })}
    </DrawnSelect>
  );
}

/**
 * WHETHER THE OVERRIDING JOB'S OWN KEY IS STORED (ADR 0128).
 *
 * This row read `<StatusBadge tone="success">Set</StatusBadge>` from Leg 6
 * until this step — a green badge asserting a stored credential that nothing
 * had been asked about, and on two of the three drawn override rows for a
 * vendor with no adapter and therefore no secret-store entry at all. A drawing
 * may show the shape a row will have; it may not claim what is stored.
 *
 * `unknown` is its own answer and reads *Not read*, the word this screen
 * already uses where a runtime did not answer (`WiredCeilingBadge`).
 */
function OverrideKeyBadge({ drawnName, role }: { drawnName: string; role: ProviderRole }) {
  const wired = useWired();
  const answers = useAnswers();
  const state = wired ? credentialStateFor(drawnName, role, answers) : "set";

  return (
    <span className="ws-rowflex">
      {state === "set" ? (
        <StatusBadge tone="success">Set</StatusBadge>
      ) : state === "missing" ? (
        <StatusBadge tone="warning">Not set</StatusBadge>
      ) : (
        <StatusBadge tone="plan">Not read</StatusBadge>
      )}
      <DrawnButton variant="ghost" icon={<Icon name="key" />}>
        {state === "missing" ? "Add key" : "Replace"}
      </DrawnButton>
    </span>
  );
}

/* ── The picker at the point of use (B7, ADR 0129, ADR 0131) ─────────────────
   Everything above is the ladder as `AI Models` has always rendered it. What
   follows is the second place it stands: a surface that STARTS a job, which
   states where the job is about to run and lets that be changed without going
   to a settings screen and back. */

/**
 * The models a lane offers a job, from the catalogue and never from a literal
 * (ADR 0115). An empty string where the lane has no row — the sentence a lane
 * that cannot run a job states is `Follows`' business, not this line's.
 */
function drawnModelFor(lane: LaneName, jobKey: JobKey): string {
  return laneJobModels(lane, jobKey)?.model ?? "";
}

/**
 * WHERE THIS JOB IS ABOUT TO RUN, AS ONE SENTENCE, WITH THE LADDER BEHIND IT.
 *
 * **The sentence is the point and the disclosure is the escape hatch**
 * (ADR 0129). Most uploads take the connection, so the full stack is collapsed;
 * the person who needs to change it needs the whole ladder — lane, vendor,
 * credential, model — rather than a bare dropdown naming a vendor whose key is
 * missing.
 *
 * **It states the runtime's answer, not the drawing's, wherever there is one.**
 * A surface that begins a long, expensive and irreversible operation without
 * naming where it is about to send the audio is the fake-state rule one level
 * up from a badge — and a surface that names the wrong place is worse than one
 * that names none.
 */
function JobProviderBody({
  jobKey,
  cap,
  lane,
  summary,
  hint,
}: {
  jobKey: JobKey;
  cap: "stt" | "llm";
  lane: LaneName;
  summary: string;
  hint?: ReactNode;
}) {
  const wired = useWired();
  const answers = useAnswers();
  const runtime = useRuntime();
  const { connection } = useContext(Wired);
  const { fileBytes, capacities } = useUploadConstraint();

  const conn = connection ?? LANES[lane].provider;
  /* The config answers in the product and the drawn literal answers in the
     gallery — ADR 0128's rule, applied here rather than re-derived. */
  const override =
    wired && runtime ? storedOverrideName(runtime, jobKey) : LANES[lane].jobs[jobKey].override;
  const runsOn = override ?? conn;
  const model = drawnModelFor(lane, jobKey);

  /* THE SENTENCE CARRIES ITS OWN REFUSAL. A resolved provider that cannot take
     this file is the one thing the reader most needs above a drop zone, and
     stating "Using Groq" over a vendor that will reject the upload is exactly
     the fake readiness this repo refuses everywhere else. */
  const answer = wired
    ? resolveUploadAnswer(
        runsOn,
        roleForDrawnCapability(cap),
        answers,
        fileBytes,
        capacities[runtimeIdFor(runsOn) ?? ""],
      )
    : null;
  const refusal = answer && !answer.operable && answer.reason.kind !== "pending"
    ? answer.reason.sentence
    : undefined;

  return (
    <Card>
      <CardRows>
        <Row
          label="Where this runs"
          hint={refusal ?? hint ?? "The connection, unless this job is set to something else below."}
          control={
            <span className="ws-rowflex">
              <SelectMark name={runsOn} />
              <span className="ws-muted">
                Using {runsOn}
                {model ? ` · ${model}` : ""}
              </span>
            </span>
          }
        />
      </CardRows>
      <Disclosure summary={summary}>
        <Follows lane={lane} jobKey={jobKey} cap={cap} />
      </Disclosure>
    </Card>
  );
}

/** Reads the runtime for the file in hand. Its own component so the gallery
 *  path never calls the hook — the split `ModelsScreen` already makes, for the
 *  reason it makes it: the gallery asserts no runtime state. */
function WithUploadCapacity({
  lane,
  fileBytes,
  model,
  children,
}: {
  lane: LaneName;
  fileBytes: number | null;
  model?: string | null;
  children: ReactNode;
}) {
  const { capacities } = useUploadCapacity(fileBytes, lane, model);
  return (
    <UploadConstraint.Provider value={{ fileBytes, capacities }}>
      {children}
    </UploadConstraint.Provider>
  );
}

/**
 * THE PICKER A SURFACE THAT STARTS A JOB RENDERS (ADR 0131).
 *
 * `runtime` absent is the gallery: the drawing stands, nothing is asked of the
 * runtime, and no capability is claimed. `fileBytes` absent is every surface
 * whose job has no file — `Translate.tsx` is the first of them — and the size
 * constraint then simply never applies, which is the honest answer rather than
 * a special case.
 *
 * **The rule is general and this component is not the whole of it.** Every
 * surface that starts a job names where it runs; four more exist only as
 * drawings today (the meeting HUD, the translation window, Live subtitles, the
 * agent overlay) and each carries the obligation into the step that builds it.
 */
export function JobProviderPicker({
  jobKey,
  cap = "stt",
  lane = "Cloud",
  runtime,
  fileBytes = null,
  summary = "Transcription settings",
  hint,
}: {
  jobKey: JobKey;
  cap?: "stt" | "llm";
  lane?: LaneName;
  runtime?: WorkspaceRuntime;
  fileBytes?: number | null;
  summary?: string;
  hint?: ReactNode;
}) {
  const body = <JobProviderBody jobKey={jobKey} cap={cap} lane={lane} summary={summary} hint={hint} />;

  if (!runtime) {
    return <Wired.Provider value={{ on: false, answers: NO_ANSWERS }}>{body}</Wired.Provider>;
  }

  return (
    <JobProviderRuntime lane={lane} runtime={runtime}>
      <WithUploadCapacity lane={lane} fileBytes={fileBytes} model={runtime.config.model}>
        {body}
      </WithUploadCapacity>
    </JobProviderRuntime>
  );
}
