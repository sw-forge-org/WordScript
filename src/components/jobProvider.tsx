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
import { LANE_LABEL, LANES, providerNames, type JobKey, type LaneName } from "@/screens/data";
import {
  buildProfileProvidersPatch,
  modelSlotForJob,
  resolveActiveTextProfile,
  resolveConfigJobProvider,
  resolveJobProvider,
  resolveProfileProviderSettings,
  roleDefaultModel,
} from "@/lib/textProfiles";
import {
  accountChoices,
  accountForLane,
  accountStatus,
  buildVendorConnectionPatch,
  connectionById,
  credentialStateFor,
  drawnNameFor,
  NO_ANSWERS,
  resolveProviderAnswer,
  resolveUploadAnswer,
  resolveConnections,
  roleForDrawnCapability,
  runtimeIdFor,
  LOCAL_PROVIDER_ID,
  type RuntimeAnswers,
} from "@/lib/providerSeam";
import { useProviderSeam } from "@/hooks/useProviderSeam";
import type { AppConfig } from "@/types/ipc";
import { useUploadCapacity } from "@/hooks/useUploadCapacity";
import { laneJobModels, vendorModels } from "@/lib/modelCatalogue";
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
   * WHICH ACCOUNT THE ACTIVE PROFILE DICTATES ON (ADR 0208).
   *
   * The vendor above answers *where does this run*; this answers *whose
   * credential pays for it*, and the two are different questions the moment a
   * reader holds an employer's account and a private one on one vendor.
   *
   * **IT IS THE PROFILE'S AND IT IS NOT THE CARD'S**, which is the distinction
   * that had gone missing. The connection card is grouped by lane since ADR 0212
   * and this value follows the profile, so on a machine whose profile dictates
   * through its own server the Cloud card's credential rows were scoped to the
   * server's account: the key field wrote a Groq key into the slot the
   * self-hosted adapter reads its bearer token from, and the reader's own server
   * received it on the next request. Every card row reads its own account now
   * (`accountForLane`); what is left here is what the name says — the account the
   * profile follows, for the job rows that state *Follow the profile · X*.
   *
   * `undefined` in the gallery, where there is no config and no account.
   */
  profileAccountId?: string;
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
  /**
   * WHICH ACCOUNT ONE JOB RUNS ON, written per job (ADR 0211).
   *
   * **A connection id rather than a vendor's drawn name**, which is what took the
   * lane filter off this control: an account carries its own vendor, so a job can
   * be pointed at any account on the machine and the lane it lands in is read
   * back off it. `setJobOverride` above named a VENDOR and had to create an
   * account to point at; the accounts are an inventory the reader keeps now, and
   * a job row picks from it rather than adding to it.
   *
   * `null` clears the override, which is the stored form of *follow the
   * profile's account* — the absence is the value (ADR 0094).
   */
  setJobAccount?: (job: JobKey, connectionId: string | null) => void;
  /**
   * WHICH MODEL ONE JOB RUNS ON (ADR 0211).
   *
   * `null` clears it, and the job falls back to the profile's slot for its
   * family (`modelSlotForJob`). Stored beside the account rather than in the
   * speech block, because a model id is only meaningful for a vendor.
   */
  setJobModel?: (job: JobKey, model: string | null) => void;
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

/** The tooltip a vendor without an adapter carries. It cited ADR 0065 to the
 *  reader, which is a document only this repository can open — the decision is
 *  still the reason, and the reason is the sentence, not the number. */
export const NOT_INTEGRATED = "Not integrated yet — Groq is the lane WordScript runs";

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
  /* NOT SCOPED TO THE LANE, AND THE LANE IS STILL THE PROP ABOVE (ADR 0211).
     A job runs on any account this machine holds, so what the surface KNOWS may
     not depend on which group the reader happens to be looking at — a cross-lane
     job row read *not read* about the very account it was pointed at. The lane
     decides what is drawn; the seam answers about everything. */
  const { answers, refresh } = useProviderSeam(runtime.config, runtime.config.model);

  /* THE CONNECTION IS THE STORED ONE, not the drawn one. `LANES.Cloud.provider`
     is `"Groq"` because that is what the prototype drew; what the pipeline
     spends is `providers.default` on the active profile, which A4 made
     per-profile and per-job. A stored id with no drawn name falls back to the
     drawing rather than rendering a storage key into a chip. */
  const resolvedDictation = resolveConfigJobProvider(runtime.config, "dictation");
  const profileAccountId = resolvedDictation.connection;
  const connection = drawnNameFor(resolvedDictation.provider) ?? LANES[lane].provider;

  const setConnection = useCallback(
    (drawnName: string) => {
      const id = runtimeIdFor(drawnName);
      /* A name with no id is this repo naming its vendors inconsistently, and
         `providerSeam.test.ts` fails on it long before a user gets here.
         Writing nothing is still the right answer at runtime: a config holding
         a name the registry cannot resolve is dropped on load, so the write
         would look like it worked and then vanish. */
      if (!id) return;
      /* THE PROFILE POINTS AT AN ACCOUNT, NOT AT A VENDOR (ADR 0208). Picking a
         vendor this machine holds no account for creates one, so the chip row
         keeps meaning what it always meant while the credential beneath it
         gains an owner. */
      const { patch, connectionId: target } = buildVendorConnectionPatch(runtime.config, id);
      runtime.patch({
        ...patch,
        ...buildProfileProvidersPatch(runtime.config, { default: target }),
      });
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
      let created: Partial<AppConfig> = {};

      if (drawnName === null) {
        delete overrides[job];
      } else {
        const id = runtimeIdFor(drawnName);
        if (!id) return;
        /* An override names an ACCOUNT too (ADR 0208), so a job pointed at a
           vendor this machine has no account for gets one — the same door the
           connection above uses, and the reason it is one function. */
        const target = buildVendorConnectionPatch(runtime.config, id);
        created = target.patch;
        /* Overriding to the connection's own account is not an override.
           Storing it would freeze this job onto today's connection, so the row
           stops following one the user changes later — which is the opposite of
           what picking the connection's name means. */
        if (target.connectionId === axis.default) {
          delete overrides[job];
        } else {
          overrides[job] = target.connectionId;
        }
      }

      runtime.patch({
        ...created,
        ...buildProfileProvidersPatch(runtime.config, { overrides }),
      });
    },
    [runtime],
  );

  /**
   * WHICH ACCOUNT ONE JOB RUNS ON — an id, and no account is created to hold it
   * (ADR 0211).
   *
   * `setJobOverride` above takes a vendor's drawn name and creates an account
   * where the machine holds none, which is what a lane-scoped chip row needed.
   * This one picks from the inventory: every account is offered, the lane is read
   * back off the one chosen, and *dictation on Cloud, cleanup on your own server*
   * stops being storable-but-unpickable.
   *
   * **THE MODEL GOES WITH THE ACCOUNT WHEN THE VENDOR CHANGES**, in the same
   * patch. A model chosen for Groq is not a choice about OpenAI — leaving it
   * would store a pair the resolver has to refuse (`JobProvider::named_model`)
   * and the row would name a model the request never carries. Moving between two
   * accounts of ONE vendor keeps it: the same vendor serves the same models.
   */
  const setJobAccount = useCallback(
    (job: JobKey, connectionId: string | null) => {
      const profile = resolveActiveTextProfile(runtime.config);
      const axis = resolveProfileProviderSettings(profile);
      const connections = resolveConnections(runtime.config);
      const overrides = { ...axis.overrides };
      const models = { ...axis.models };

      const before = resolveJobProvider(profile, job, connections).provider;
      /* Overriding to the profile's own account is not an override. Storing it
         would freeze this job onto today's account, so the row stops following
         one the reader changes later (ADR 0094). */
      if (connectionId === null || connectionId === axis.default) {
        delete overrides[job];
      } else {
        overrides[job] = connectionId;
      }
      const after = resolveJobProvider({ providers: { ...axis, overrides } }, job, connections)
        .provider;
      if (before !== after) delete models[job];

      runtime.patch(buildProfileProvidersPatch(runtime.config, { overrides, models }));
    },
    [runtime],
  );

  /** WHICH MODEL ONE JOB RUNS ON (ADR 0211). `null` clears it back to the
   *  profile's slot for the job's family, which is the absence rather than a
   *  copy of the default written into the map. */
  const setJobModel = useCallback(
    (job: JobKey, model: string | null) => {
      const axis = resolveProfileProviderSettings(resolveActiveTextProfile(runtime.config));
      const models = { ...axis.models };
      if (model === null || !model.trim()) delete models[job];
      else models[job] = model.trim();
      runtime.patch(buildProfileProvidersPatch(runtime.config, { models }));
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
        profileAccountId,
        setConnection,
        setJobOverride,
        setJobAccount,
        setJobModel,
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
      ? {
          /* THE ENDPOINT BELONGS TO AN ACCOUNT, so it is read off the one this
             lane holds rather than off a slot keyed by the vendor — two servers
             are two accounts (ADR 0208), and a vendor-keyed read printed
             whichever of them the surface had happened to ask about. */
          endpoint:
            accountStatus(
              answers,
              wiredRuntime ? accountForLane(wiredRuntime.config, "Self-hosted")?.id : undefined,
            )?.self_hosted_endpoint ?? null,
        }
      : null;

  /* WHERE THIS JOB RUNS, ON EVERY LANE AND OVER EVERY ACCOUNT (ADR 0211).
     Two rows replace four lane-shaped variants: the account the job runs on, and
     the model it runs there. What the lane used to decide — a picker on Cloud, a
     badge on Local, a URL on Your server — is decided by the chosen ACCOUNT now,
     which is what a lane demoted from mode to grouping means. */
  const accountRows =
    wired && wiredRuntime && jobKey ? (
      <JobAccountRows jobKey={jobKey} cap={cap} hint={hint} runtime={wiredRuntime} />
    ) : null;

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
            <OverrideKeyBadge
              connectionId={
                wiredRuntime && jobKey
                  ? resolveConfigJobProvider(wiredRuntime.config, jobKey).connection
                  : undefined
              }
              role={roleForDrawnCapability(cap)}
            />
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

  /* THE PRODUCT DRAWS THE TASK-FIRST PAIR; THE GALLERY KEEPS THE DRAWING
     (ADR 0211). `accountRows` needs a config — every account on the machine, the
     model each job names — and the gallery has none, so there it stays the four
     lane-shaped rows the prototype drew. That is the same arrangement ADR 0127
     made for the override literal: the drawing is the inventory of what the
     product intends to offer, the product shows only what is stored. */
  if (accountRows) {
    return (
      <CardRows>
        <InertBecause.Provider value={null}>{accountRows}</InertBecause.Provider>
        {extra}
      </CardRows>
    );
  }

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
 * WHERE ONE JOB RUNS AND WITH WHAT — the two cells of a task-first row, and one
 * decision between them (ADR 0211).
 *
 * **Not scoped to a lane, which is the whole point.** The account picker offers
 * every account on the machine grouped lane → provider → account, so a profile
 * that dictates on Cloud and cleans up on its own server is a state a reader can
 * *reach* rather than one the config merely accepts. The model then comes from
 * the chosen account's vendor — the catalogue's rows for that vendor and this
 * job's role, never the lane's list, because the lane's list is Groq's.
 *
 * **The model cell has three shapes and the account decides which**: a select
 * where the vendor publishes rows, a typed field where it publishes none (your
 * own server, ADR 0165), and a read-out with a door where the model is not a
 * served id at all but a file on this machine (ADR 0211's one exception).
 */
function JobAccountRows({
  jobKey,
  cap,
  hint,
  runtime,
}: {
  jobKey: JobKey;
  cap: "stt" | "llm";
  hint?: ReactNode;
  runtime: WorkspaceRuntime;
}) {
  const answers = useAnswers();
  const { setJobAccount, setJobModel, open } = useContext(Wired);
  /* THE FILE THIS ROW IS ABOUT TO SEND, WHERE THERE IS ONE (B7, ADR 0129). Off
     the upload surfaces `fileBytes` is `null` and every account answers exactly
     as the provider answer alone would — which is why AI Models did not move
     when the constraint arrived, and why the account picker must carry it rather
     than drop it: the intake renders THESE rows. */
  const constraint = useUploadConstraint();
  const role = roleForDrawnCapability(cap);
  const profile = resolveActiveTextProfile(runtime.config);
  const connections = resolveConnections(runtime.config);
  const resolved = resolveJobProvider(profile, jobKey, connections);
  const account = connectionById(runtime.config, resolved.connection);
  const groups = accountChoices(runtime.config, role, answers, constraint);
  const followed = connectionById(runtime.config, resolveProfileProviderSettings(profile).default);

  const local = resolved.provider === LOCAL_PROVIDER_ID;
  const drawn = drawnNameFor(resolved.provider) ?? resolved.provider;
  /* WHY THIS ROW CANNOT RUN, WHERE IT CANNOT (ADR 0106, ADR 0128). The account
     picker itself is never governed by it — a row inert because its vendor has no
     adapter is a row whose fix IS this select, and disabling the way out with the
     sentence explaining the problem is the trap that record exists for. The model
     below is a choice ON the vendor and stays inert. */
  /* ABOUT THE ACCOUNT THIS JOB RUNS ON, and it was about its vendor. Two accounts
     on one vendor gave both rows one answer, so the row on the keyless one read
     the other's key — the defect ADR 0209 removed from the connection card, still
     standing on every job row. */
  const answer = resolveProviderAnswer(drawn, role, answers, resolved.connection);
  const reason =
    !answer.operable && answer.reason.kind !== "pending" ? answer.reason.sentence : undefined;
  /* WHETHER THE ACCOUNT THIS JOB RUNS ON CAN PAY FOR IT — stated, not editable
     (ADR 0211). A key row of its own on a job row is a second credential editor
     scoped to a job, which is how *Account* came to look like the thing a job
     runs on; the credential belongs to the account, so the row says what is true
     and points at the inventory that owns it. */
  const credential = local ? "set" : credentialStateFor(resolved.connection, role, answers);
  const offered = vendorModels(resolved.provider, role === "speech" ? "speech" : "chat");
  const roleDefault = roleDefaultModel(profile, jobKey, local);
  /* WHAT THIS JOB WOULD RUN ON RIGHT NOW, and the two halves are not the same
     question: `resolved.model` is what the profile stored, `effective` is what
     the runtime would spend. They disagree exactly where a stored id belongs to
     another vendor — a leftover from an account change — and the row has to be
     able to say so rather than showing a value no request carries. */
  const stale =
    Boolean(resolved.model) && offered.length > 0 && !offered.includes(resolved.model);
  const followsModel = !resolved.model || stale;

  return (
    <>
      <Row
        label="Runs on"
        hint={
          hint ??
          "Any account on this machine. The lane is how they are grouped, not a mode this screen is in."
        }
        control={
          <span className="ws-rowflex">
            <SelectMark name={resolved.provider ? drawnNameFor(resolved.provider) ?? "" : ""} />
            <Select
              value={resolved.overridden ? resolved.connection : ""}
              aria-label="Runs on"
              onChange={(event) =>
                setJobAccount?.(jobKey, event.target.value || null)
              }
            >
              {/* THE ABSENCE IS THE VALUE (ADR 0094), so following is an option
                  rather than a second control, and it names the account it
                  follows — a row reading `Follow the profile's account` over a
                  profile the reader cannot see from here says nothing. */}
              <option value="">
                {`Follow the profile · ${followed?.label ?? "no account"}`}
              </option>
              {groups.map((group) => (
                <optgroup
                  key={`${group.lane}-${group.drawnName}`}
                  /* `Your server · Your server` was what the pair produced on the
                     one lane whose label IS its vendor's name — found by looking
                     at it. One word where they are one thing. */
                  label={
                    LANE_LABEL[group.lane] === group.drawnName
                      ? group.drawnName
                      : `${LANE_LABEL[group.lane]} · ${group.drawnName}`
                  }
                >
                  {group.accounts.map((choice) => (
                    <option
                      key={choice.id}
                      value={choice.id}
                      disabled={!choice.operable}
                      title={choice.reason}
                    >
                      {choice.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {!resolved.provider ? (
              <StatusBadge tone="warning">Account gone</StatusBadge>
            ) : credential === "set" ? (
              <StatusBadge tone="success">Key set</StatusBadge>
            ) : credential === "missing" ? (
              <StatusBadge tone="warning">No key</StatusBadge>
            ) : (
              <StatusBadge tone="plan">Not read</StatusBadge>
            )}
          </span>
        }
      />

      {/* THE REASON GOVERNS THE MODEL AND STOPS THERE (ADR 0128). A model is a
          choice ON the vendor, so a vendor with no adapter has no model to
          choose; the account picker above is the way out of that state and is
          never disabled by the sentence describing it. */}
      <InertBecause.Provider value={reason ?? null}>
      {local ? (
        /* THE ONE PLACE A MODEL IS NOT A CHOICE ON THIS ROW (ADR 0211). It is a
           file on this machine, and the row that installs it is the one that
           knows whether it is there. */
        <Row
          label="Model"
          hint="The file this machine has. It comes with its decode settings, so it is chosen where it is installed."
          control={
            <span className="ws-rowflex">
              <StatusBadge tone="plan">{roleDefault || "base"}</StatusBadge>
              {open && (
                <Button
                  variant="ghost"
                  icon={<Icon name="arrow" />}
                  onClick={() => open({ view: "settings", section: "models" })}
                >
                  On this machine
                </Button>
              )}
            </span>
          }
        />
      ) : offered.length === 0 ? (
        /* YOUR OWN SERVER PUBLISHES NO LIST (ADR 0165), so this is typed. Empty
           falls back to the id the server itself was given, which is half its
           address and set once in the inventory. */
        <TypedModelRow
          jobKey={jobKey}
          stored={resolved.model}
          placeholder={account?.model || "faster-whisper-medium"}
          onWrite={(next) => setJobModel?.(jobKey, next)}
        />
      ) : (
        <Row
          label="Model"
          hint={
            stale
              ? `The model this row named is not one ${drawnNameFor(resolved.provider) ?? resolved.provider} serves, so the profile's ${modelSlotForJob(jobKey)} model runs instead. Pick one to change that.`
              : `What this job runs on ${drawnNameFor(resolved.provider) ?? resolved.provider}. Following means the profile's ${modelSlotForJob(jobKey)} model.`
          }
          control={
            <DrawnSelect
              value={followsModel ? "" : resolved.model}
              aria-label="Model"
              onChange={(event) => setJobModel?.(jobKey, event.target.value || null)}
            >
              <option value="">{`Follow the profile · ${roleDefault}`}</option>
              {offered.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </DrawnSelect>
          }
        />
      )}
      </InertBecause.Provider>
    </>
  );
}

/** The model id a lane with no list to offer takes: typed, committed on blur or
 *  Enter, and empty means *the id the server itself was given* (ADR 0165). */
function TypedModelRow({
  jobKey,
  stored,
  placeholder,
  onWrite,
}: {
  jobKey: JobKey;
  stored: string;
  placeholder: string;
  onWrite: (next: string | null) => void;
}) {
  return (
    <Row
      /* `Model`, LIKE EVERY OTHER JOB ROW, and not `Model id` (ADR 0211). The
         inventory's field of that name is the id the SERVER answers to — half
         its address — and two controls sharing one label on one screen is how a
         reader comes to believe they are one setting. Same question here as in
         the select beside it: what does this job run on. */
      label="Model"
      hint="Your server publishes no list, so this is typed. Empty sends the id the server itself was given."
      control={
        <DrawnField
          key={`${jobKey}-${stored}`}
          w="190px"
          aria-label="Model"
          defaultValue={stored}
          placeholder={placeholder}
          onBlur={(event) => onWrite(event.target.value || null)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onWrite((event.target as HTMLInputElement).value || null);
          }}
        />
      }
    />
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
function OverrideKeyBadge({
  connectionId,
  role,
}: {
  /** The account whose key this is. **Absent under a runtime is `Not read`, and
   *  that is the only honest answer**: a key belongs to an account, and this row
   *  only renders where the OVERRIDE came from the drawing rather than from the
   *  config (`Follows` returns the account rows before reaching it whenever there
   *  is a stored one), so there is no account to be about. It used to take the
   *  vendor's drawn name and answer off whichever account that vendor's one
   *  status slot held. */
  connectionId?: string;
  role: ProviderRole;
}) {
  const wired = useWired();
  const answers = useAnswers();
  const state = wired ? credentialStateFor(connectionId, role, answers) : "set";

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
        /* The account this upload would actually be billed to, so *no key yet*
           is about it rather than about a sibling account on its vendor. */
        runtime ? resolveConfigJobProvider(runtime.config, jobKey).connection : undefined,
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
