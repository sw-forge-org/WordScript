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
  ConfirmPanel,
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
  ProviderMark,
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
/* `vendorModels` left with the second copy of the model guard (ADR 0215): this
   file asked the catalogue directly to decide what a job row may name, and that
   question belongs to `namedModel`. */
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
  type Connection,
  type ProviderTier,
  type TranslateAddressForm,
  type TranslateSameLanguage,
} from "@/types/ipc";
import {
  buildProfileModesPatch,
  buildProfileProvidersPatch,
  namedModel,
  resolveActiveTextProfile,
  resolveConfigJobProvider,
  resolveJobProvider,
  roleDefaultModel,
  resolveProfileModesSettings,
  resolveProfileSpeechSettings,
  resolveProfileProviderSettings,
} from "@/lib/textProfiles";
import {
  accountChoices,
  accountForLane,
  accountsOnLane,
  accountStatus,
  activeConnectionOf,
  laneWithheld,
  LOCAL_PROVIDER_ID,
  buildConnectionPlanPatch,
  connectionById,
  buildConnectionsPatch,
  buildConnectionRemovalPatch,
  buildNewConnectionPatch,
  buildVendorConnectionPatch,
  profileLabelsUsing,
  profilesUsingConnection,
  resolveConnections,
  connectionCapabilitySentence,
  credentialForAccount,
  credentialStateFor,
  drawnNameFor,
  roleCredentialForAccount,
  LANE_PROVIDER_IDS,
  laneForProviderId,
  NO_ANSWERS,
  resolveProviderAnswer,
  runtimeIdFor,
  roleForDrawnCapability,
  selectableProviderNames,
  SELF_HOSTED_PROVIDER_ID,
  type RuntimeAnswers,
} from "@/lib/providerSeam";
import type {
  LocalProviderSetupStatus,
  ProviderRole,
  RoleCredentialStatus,
  SelfHostedEndpointStatus,
} from "@/types/providers";
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
 * THE LONGEST RECORDING THIS LANE ACCEPTS. Drawn as `~13 min`, which is what
 * Groq's 25 MiB attachment limit buys at 16 kHz mono i16; `resolve_capture_budget`
 * has the real one and it moves with the provider and the model (ADR 0034,
 * corrected by ADR 0246 — it does not move with the plan). Reading it here is
 * also what makes this row agree with the identical statement on
 * Profiles → Defaults, which reads the same command — a second derivation in
 * TypeScript is how the two would drift.
 */
function CeilingBadge() {
  const wired = useWired();
  /* Two components rather than one with a conditional hook, and the split is
     load-bearing: the gallery asserts NO runtime state, so it must not reach
     for `resolve_capture_budget` at all. */
  return wired ? <WiredCeilingBadge /> : <StatusBadge tone="plan">~13 min</StatusBadge>;
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
     with different names.

     **AND UNDER A RUNTIME IT IS NOT STATE AT ALL, IT IS THE CONFIG** (D1b,
     ADR 0165). The lane is the connection's vendor read backwards, so a machine
     dictating through its own server that opened this screen on `Cloud` would
     be describing a connection the runtime is not using — and every row under
     it would belong to a lane nothing runs on. Picking a lane writes the
     provider axis; the screen then follows what is stored, which is the same
     direction `ProviderPick` has read since D1. The gallery has no config, so
     there the segment keeps its own state and the drawings switch. */
  /* THE LANE THE READER IS LOOKING AT — AND IT IS NOT A MODE ANY MORE
     (ADR 0212).
     A profile runs its jobs on whatever accounts they name, on several lanes at
     once if that is what it says, so *which lane is this screen in* stopped
     being a question about the config. The segment groups: it decides which
     lane's accounts the card below configures, and it opens on the lane the
     profile's own account is on so the screen still starts where the reader
     dictates from.

     **AND IT WRITES NOTHING.** It used to write `buildVendorConnectionPatch` plus
     `buildProfileProvidersPatch`, so the screen's topmost control silently
     repointed a profile the reader was never shown — the defect at the centre of
     this step. Assigning an account to a profile is the `Account` row's job now,
     which names the profile it writes (ADR 0209). */
  /* **AND THE SEGMENT IS GONE, SO THE LANE FOLLOWS THE ACCOUNT** (ADR 0223).
     It was state seeded from the profile's account and changed by a segment in
     the Accounts card. That card lists every account now, on every lane, so the
     segment had nothing left to group and was two dead options out of four. The
     lane is still what the job rows read, and the honest value for it is the one
     the profile actually bills to — derived, so switching the profile's account
     moves it instead of leaving the rows on a lane nothing runs. */
  const storedAccount = runtime ? activeConnectionOf(runtime.config) : undefined;
  const storedProvider = storedAccount?.provider;
  const lane: LaneName = storedProvider ? laneForProviderId(storedProvider) : "Cloud";
  /* ONE `local_setup` READ FOR THE WHOLE SCREEN, AND IT MOVED UP HERE IN B12
     (ADR 0163). Both tabs state where this machine stands now — the connection
     card says whether the withheld lane is withheld by the product or by the
     disk, and the machine tab lists the two runners — and `inspect_local_setup`
     spawns `whisper-cli --help` and probes the Ollama endpoint to answer. Two
     hooks would be two probes for one fact, which is the cost ADR 0124 already
     refused once at ten.

     **`enabled` is what keeps the gallery clean.** This component renders in
     both states, so the hook is unconditional and its call is not: with no
     runtime nothing is invoked, and `Models.test.tsx` asserts exactly that. */
  const { setup, asked } = useLocalSetup(Boolean(runtime));
  /* WHOSE JOB LIST THIS IS, FOR THE LEAD (ADR 0226). `undefined` in the gallery,
     where there is no profile to name and the sentence says *the open profile*
     rather than inventing one. */
  const activeProfile = runtime ? resolveActiveTextProfile(runtime.config).label : undefined;

  const surface = (
    <>
      <ViewTop
        title="AI Models"
        /* **THE SCREEN HAS TWO OWNERS AND THE LEAD NAMES BOTH** (ADR 0226). It
           said *what each job runs on, and the accounts it can be billed to* —
           true, and silent about the one thing a reader cannot work out by
           looking: that the accounts are the MACHINE's and the job list is the
           PROFILE's. A `Note` under it used to claim both were the profile's,
           which is false for the accounts and was two lines of prose besides.
           The lead is where a reader already looks, so the sentence goes here
           and the note goes away. */
        lead={
          activeProfile ? (
            <>
              Accounts belong to this machine. What each job runs on belongs to{" "}
              <b>{activeProfile}</b>.
            </>
          ) : (
            "Accounts belong to this machine. What each job runs on belongs to the open profile."
          )
        }
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
          runtime={runtime}
          setup={setup}
          asked={asked}
          onManage={() => setTab("On this machine")}
        />
      ) : (
        <MachineTab setup={setup} asked={asked} />
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
/* **`ProfileScope` STOOD HERE AND IS GONE** (ADR 0226). ADR 0212 added it to
   answer *in welchem Profil wähle ich gerade was aus* with a sentence before the
   first card, and it got the answer half wrong: `connections` is an `AppConfig`
   field, so the accounts, their keys, their plans and their endpoints are the
   MACHINE's and every profile sees the same ones. Exactly one control on that
   card belongs to the profile — the radio — and it was the one thing the note
   did not point at.

   Explaining a screen in a paragraph above it is also the wrong instrument for
   the complaint that produced it. Three things say it now, each where it is
   true: the lead names both owners, each section head names its own, and the
   picked card carries the profile whose pick it is. */

/**
 * WHICH ACCOUNT THE ACTIVE PROFILE BILLS TO (speech track B17, ADR 0209).
 *
 * **The one control that decides who pays, moved out of the inventory.** It was
 * a `Select` inside the `Account` row on the Accounts card, which is the card
 * headed *what this machine can bill jobs to* — so the inventory both listed the
 * machine's accounts and repointed the profile, and ADR 0212's own split between
 * those two acts survived at the lane level and not at the row level. Worse, the
 * `New` button beside it did both on one press.
 *
 * **It offers every account and not one lane's**, because that is what the value
 * is: `providers.default` is a connection id, a connection carries its own
 * vendor, and *dictation on Cloud with the assistant on your own server* is a
 * state the config has accepted since ADR 0094's axis met ADR 0208's object. The
 * grouping is `accountChoices`', so an account the product cannot operate is
 * offered with the reason attached rather than silently dropped.
 *
 * **And it names the profile it writes** (ADR 0209). An unlabelled control that
 * repoints who pays is the defect B14a closed one card over.
 */
function ProfileAccountRow({ runtime }: { runtime: WorkspaceRuntime }) {
  const profile = resolveActiveTextProfile(runtime.config);
  const stored = resolveProfileProviderSettings(profile).default;
  const named = connectionById(runtime.config, stored);

  return (
    <Row
      label="This profile bills to"
      /* **A STATEMENT AND NOT A SECOND PICKER** (ADR 0223). This was a `Select`
         over every account on the machine, and the Accounts card above now has a
         radio per card writing the same field — two controls over one fact,
         which is what ADR 0123 is about. The row stays because the rows below it
         say *follow the profile* and a reader has to be able to see what that
         resolves to; it states, and the card decides. */
      hint={
        named
          ? "Every job below follows this account unless it names one of its own. Change it on a card above."
          : /* A POINTER THAT RESOLVES TO NOTHING KEEPS ITS NAME (ADR 0209).
               Dropping it would be repointing by deletion. */
            `${profile.label} bills to an account this machine no longer holds. Pick one above.`
      }
      /* **AND NO `ScopeTag`** (ADR 0226). It carried one because ADR 0209 required
         a control that WRITES the profile to name it — and ADR 0223 turned this
         into a statement, so the tag was naming the owner of a value the row no
         longer sets. With the profile in the sheet header, in the lead and on the
         picked card, it was the fourth copy of one word on one screen: the
         owner's own reading of the shipped surface, and ADR 0123's rule about a
         fact having one home applied to a name instead of a list. */
      control={
        <span className="ws-rowflex">
          {named ? (
            <span className="ws-rowflex">
              <ProviderMark name={drawnNameFor(named.provider) ?? named.provider} className="ws-acct-mark" />
              <b>{named.label}</b>
            </span>
          ) : (
            <StatusBadge tone="warning">No account</StatusBadge>
          )}
        </span>
      }
    />
  );
}

/**
 * THE ACCOUNTS CARD AS THE GALLERY DRAWS IT — one account, with the rows a real
 * one carries (ADR 0223).
 *
 * **The gallery had the lane segment, the chip row and the credential rows, and
 * all three moved or went**, so a drawing that kept them would be showing a
 * screen this build no longer has. `port:diff` moves with it; that is the point
 * of measuring it rather than a reason not to change the screen (ADR 0216 made
 * the first such divergence here and recorded it the same way).
 */
function DrawnAccountCard() {
  return (
    <>
      {/* THE SHAPE THE PRODUCT DRAWS, INCLUDING THE FOLD (ADR 0223, ADR 0224).
          The header is a strip carrying a pick and a caret since the accounts
          became foldable; a drawing that kept the old single-element header lost
          the strip's padding to a class it does not have — measured as 18 style
          differences on `port:diff models`, which is what that check is for. */}
      <div className="ws-card ws-acct" data-current="" data-open="">
        <span className="ws-acct-head">
          <span className="ws-acct-pick">
            <span className="ws-radio" aria-hidden />
            <ProviderMark name="Groq" className="ws-acct-mark" fallback={<Icon name="cloud" />} />
            <span className="ws-acct-name">
              <b>Groq</b>
            </span>
          </span>
          <StatusBadge tone="success">Key set</StatusBadge>
          <span className="ws-ibtn ws-acct-fold" aria-hidden>
            <Icon name="chevron" />
          </span>
        </span>
        <CardRows>
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
            label="Plan"
            hint="Sets the rate limit. Every plan shares the same upload limit."
            control={
              <DrawnSelect defaultValue="Free — 25 MiB per request" aria-label="Plan">
                <option>Free — 25 MiB per request</option>
                <option>Developer — 25 MiB per request, higher rate limits</option>
              </DrawnSelect>
            }
          />
          <Row layout="stack">
            <span className="ws-rowflex">
              <span className="ws-grow ws-row-hint">Billed by General writing.</span>
            </span>
          </Row>
        </CardRows>
      </div>
      <Card>
        <CardRows>
          <Row
            layout="stack"
            label="Add an account"
            hint="Pick who it is with, then name it. The key goes on its card."
          >
            <span className="ws-rowflex">
              <DrawnButton variant="ghost" icon={<Icon name="plus" />}>
                Add account
              </DrawnButton>
            </span>
          </Row>
        </CardRows>
      </Card>
    </>
  );
}

/* ── Your server ────────────────────────────────────────────────────────────
   D1b, ADR 0165. **The lane D1a built an adapter for and left a drawing.**

   Four rows, and each one is a different kind of thing, which is why the lane
   needed a step rather than a field:

     URL         a machine setting, in `AppConfig`, typed here
     Reachability  a probe, run on demand, never on open
     Credential    an OPTIONAL bearer token, in the OS secret store
     Model id      a machine setting, typed here, with no list behind it

   **The URL outranks `WORDSCRIPT_SELF_HOSTED_BASE_URL` and the row says when
   the variable is the one answering.** Precedence is the runtime's — the
   `self_hosted_endpoint` block reports the winner and this file never derives
   it — because a second implementation of that rule here would print a URL that
   is not the one in force the first time the order changed.

   **Nothing here is a `DrawnField`.** The gallery keeps the drawing below, and
   the product keeps the rule ADR 0067 rule 1 states: a lane that is offered
   must be operable. Offering it is this step; that is why the lock comes off
   for this lane and stays on for the other two. */
function SelfHostedRows({
  runtime,
  account,
  onSelect,
}: {
  runtime?: WorkspaceRuntime;
  account?: Connection;
  onSelect: (id: string) => void;
}) {
  const wired = useWired();
  /* Two components rather than one with a conditional hook — the split
     `CeilingBadge` already makes, and for the same reason: the gallery asserts
     NO runtime state, so it must not reach for `provider_status` at all. */
  return wired && runtime ? (
    <WiredSelfHostedRows runtime={runtime} account={account} onSelect={onSelect} />
  ) : (
    <DrawnSelfHostedRows />
  );
}

/** The drawing, unchanged since Leg 6 — what `port:diff` measures. */
function DrawnSelfHostedRows() {
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

function WiredSelfHostedRows({
  runtime,
  account,
  onSelect,
}: {
  runtime: WorkspaceRuntime;
  /* THE ACCOUNT THIS CARD IS ABOUT IS THIS LANE'S, AND IT USED TO BE THE
     PROFILE'S. The lane groups rather than following the profile (ADR 0212), so
     a machine dictating on Groq that opened `Your server` filled these rows from
     the Groq account: the token field wrote into Groq's slot, and the reachability
     row asked about a server that account has never named.

     **AND IT IS A CHOICE NOW RATHER THAN A DERIVATION** (B17): two servers are
     two accounts, and which one these rows configure is the reader's to say. */
  account?: Connection;
  onSelect: (id: string) => void;
}) {
  const { answers, refresh } = useContext(Wired);
  const status = accountStatus(answers, account?.id);
  const endpoint = status?.self_hosted_endpoint ?? null;
  /* TWO SERVERS ARE TWO ACCOUNTS, and the token belongs to the one that names
     the server (ADR 0208). So the same rule the cloud key row follows applies
     here and matters more: a bearer token reported from the other account's
     entry would put a *Set* badge over the URL it was never issued for, which is
     the pair ADR 0094 exists to keep apart (ADR 0209). */
  const credential = roleCredentialForAccount(answers, account?.id, "speech");

  /* THE STATUS IS RE-READ ON THE CONFIG OBJECT, NOT ON THE TYPED STRING.
     `patch` is fire-and-forget: it updates this window optimistically and the
     disk write lands afterwards, so a refresh keyed on the value alone can read
     the config that was there before it. `useConfigDraft` replaces the form
     once the runtime has settled the save — a new object — so this runs twice
     and the second run is the one that cannot be stale. */
  useEffect(() => {
    void refresh?.();
  }, [runtime.config, refresh]);

  return (
    <>
      {/* NO INVENTORY ROW HERE ANY MORE (ADR 0223). These rows sit INSIDE the
          card of the account they configure, so *which of two servers is this*
          is answered by the card's own header rather than by a picker one row
          above them. */}
      <ServerUrlRow runtime={runtime} account={account} endpoint={endpoint} />
      <ReachabilityRow connectionId={account?.id} ready={credential?.configured ?? false} />
      <ServerTokenRow connectionId={account?.id} credential={credential} refresh={refresh} />
      <ServerModelRow runtime={runtime} endpoint={endpoint} />
    </>
  );
}

/** What a runtime refusal actually said.
 *
 *  A `ProviderCommandError` crosses the seam as an object, and `String(cause)`
 *  on one prints `[object Object]` — a sentence that tells the reader nothing
 *  about a server they have to go and fix. */
function sentenceFor(cause: unknown): string {
  if (cause && typeof cause === "object" && "message" in cause) {
    return String((cause as { message: unknown }).message);
  }
  return String(cause);
}

/** A committed text setting: a draft while typing, the config on blur.
 *
 *  **`patch` rather than `patchText`, and the draft is why.** The debounced
 *  door exists so a keystroke is not an IPC round trip; a local draft answers
 *  the same question and leaves the write a single discrete event, which is
 *  what the status read below has to be able to follow. */
function useCommittedSetting(stored: string, write: (next: string) => void) {
  const [draft, setDraft] = useState(stored);

  /* The runtime's value wins whenever it changes — a save settling, another
     window, or a config reload. What is being typed is not clobbered, because
     `stored` only moves when a write has landed. */
  useEffect(() => setDraft(stored), [stored]);

  const commit = useCallback(() => {
    const next = draft.trim();
    if (next === stored) return;
    write(next);
  }, [draft, stored, write]);

  return { draft, setDraft, commit };
}
/**
 * EVERY ACCOUNT THIS MACHINE HOLDS, EACH ONE A CARD THAT CARRIES ITS OWN
 * SETTINGS (ADR 0223).
 *
 * **ADR 0208 made an account an object and this surface kept it in four
 * pieces.** Its vendor was stated by a chip row at the top of the screen, its
 * name sat in a list, its key and plan sat in rows BELOW that list, and which
 * profile billed to it lived in a different section entirely. The owner read the
 * shipped screen and reported all four as one complaint: *es ist sehr sehr
 * verwirrend, es wird einem nicht klar gemacht, was was ist.*
 *
 * Three things follow from putting the object back together:
 *
 * 1. **The key is inside the account it belongs to.** It was a `Row` beside the
 *    list rather than under an entry, so it read as one key for the machine —
 *    the reader's own words: *als würde die für alle Accounts gelten*. The plan
 *    is the same fact one row down, and the self-hosted URL and token are that
 *    fact on the other lane.
 * 2. **The lane is gone from this card.** It grouped the list, so a card headed
 *    *what this machine holds* showed a quarter of it and the reader had to know
 *    which quarter to look in. Every account is here; its lane is legible from
 *    its mark and from the rows it carries. What CANNOT hold an account yet —
 *    Local, Enterprise — is a note under the list rather than two dead segments
 *    inside it.
 * 3. **The pick is the assignment, and there is only one pick now.** There were
 *    two selections on this screen: which account the key rows were open on, and
 *    which account the profile bills to. The first exists only because the key
 *    rows were outside the accounts; with every card carrying its own, it has
 *    nothing left to answer. The radio writes `providers.default`, which is what
 *    `ProfileAccountRow` did two sections away.
 *
 * **This reverses half of ADR 0220 and says so.** That record moved the
 * assignment OUT of this card on the argument that *which account a profile
 * bills to is the head of what runs what, not a select inside the card that
 * lists what the machine holds*. The argument is sound and the drawing it
 * produced was not: a reader cannot see what an account is FOR without it, and
 * the job rows below still state what they follow.
 */
function AccountList({
  runtime,
  setup,
  asked,
  onManage,
  onOpenProfiles,
}: {
  runtime: WorkspaceRuntime;
  setup: LocalProviderSetupStatus | null;
  asked: boolean;
  onManage?: () => void;
  onOpenProfiles?: () => void;
}) {
  const answers = useAnswers();
  const accounts = resolveConnections(runtime.config);
  const profile = resolveActiveTextProfile(runtime.config);
  const billsTo = resolveProfileProviderSettings(profile).default;
  const [adding, setAdding] = useState(false);
  /* WHICH CARDS ARE OPEN, AND WHY THE ANSWER STARTS AS ONE OF THEM (ADR 0224).
     An account card carries its own key, plan, endpoint and used-by line, so a
     machine with four accounts opened onto four expanded cards and the reader's
     own report was that the inventory had stopped being one — *irgendwann hat
     man viele Accounts und man hat den Überblick nicht mehr*.

     A SET RATHER THAN ONE ID, deliberately: an accordion would close the account
     a reader is comparing against while they open the second one, and comparing
     two keys is the whole reason to have two accounts on one vendor.

     IT IS SCREEN STATE AND NOT A SETTING. Which card somebody left open is not a
     fact about the machine, and writing it into the config would put a
     disclosure into the file two runtimes read. Coming back to *the one you bill
     to* is the honest resting state and it is the same one every time. */
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set([billsTo]));
  const toggle = (id: string) =>
    setOpenIds((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /* THE POINTER THAT RESOLVES TO NOTHING STILL HAS A HOME (ADR 0209). A profile
     can name an account this machine no longer holds, and nothing repairs it on
     load. The way out is to pick one of the cards below, so the sentence sits
     above them. */
  const orphaned = !accounts.some((entry) => entry.id === billsTo);

  /* BILLING HERE OPENS THIS CARD, and closes none. The press means *this profile
     pays through this account*, and the rows that say what that account is are
     the ones the reader is about to want. Closing its neighbour on the same
     press would be an accordion, which is the behaviour the set above refuses. */
  const bill = (id: string) => {
    setOpenIds((open) => (open.has(id) ? open : new Set(open).add(id)));
    runtime.patch(buildProfileProvidersPatch(runtime.config, { default: id }));
  };

  return (
    <>
      {orphaned && (
        <Note icon="alert">
          {profile.label} bills to an account this machine no longer holds. Pick one below.
        </Note>
      )}
      {/* A RADIOGROUP, BECAUSE THE PICK IS ONE OF N AND WRITES A SETTING. That is
          what separates it from the disclosure `ListItem`'s pick answers: this
          one changes where jobs are billed, so it takes the grammar `LaneCard`
          uses for a choice and not the one a list uses for *show me this one*. */}
      <div role="radiogroup" aria-label={`${profile.label} bills to`} className="ws-stack ws-gap3">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            runtime={runtime}
            answers={answers}
            profileLabel={profile.label}
            current={account.id === billsTo}
            open={openIds.has(account.id)}
            onBill={() => bill(account.id)}
            onToggle={() => toggle(account.id)}
          />
        ))}
      </div>

      <Card>
        <CardRows>
          <Row
            layout="stack"
            label="Add an account"
            hint="Pick who it is with, then name it. The key goes on its card."
          >
            {adding ? (
              <AddAccountPanel
                runtime={runtime}
                answers={answers}
                onDone={() => setAdding(false)}
              />
            ) : (
              <span className="ws-rowflex">
                <Button variant="ghost" icon={<Icon name="plus" />} onClick={() => setAdding(true)}>
                  Add account
                </Button>
              </span>
            )}
          </Row>
          {/* WHAT CANNOT HOLD AN ACCOUNT YET, under the list rather than inside
              it. Two dead segments in a picker say *these are four of a kind*;
              two rows under the accounts say what they are and why. */}
          <LockedLanes setup={setup} asked={asked} onManage={onManage} />
        </CardRows>
      </Card>

      {onOpenProfiles && (
        <span className="ws-row-hint">
          Each profile bills to its own account. <b>{profile.label}</b> is the one open.
        </span>
      )}
    </>
  );
}

/**
 * ONE ACCOUNT — who it is with, its key, what it costs, and who bills to it.
 *
 * **The header is the radio.** The strip that names the account is the control,
 * the way `.ws-lane-row` is, because the account IS the thing being chosen.
 * Rename and Remove live in the foot rather than the header for the reason
 * `ListItem`'s pick does: a row-wide button cannot hold the buttons that act on
 * the row.
 *
 * **AND THE HEADER IS ALSO WHERE THE CARD FOLDS** (ADR 0224). Two controls sit
 * on it and they answer different questions — *bill here* and *show me this
 * one* — so they are two buttons side by side rather than one press meaning
 * both. The pick is the whole name strip; the fold is a caret at the end of it,
 * the same glyph `.ws-disc` uses, rotated the same way. A collapsed card still
 * states the three facts that make an inventory an inventory: whose it is, what
 * vendor it is with, and whether it holds a key.
 *
 * **The rows in the middle are the ones that were under the list.**
 * `CloudCredentialRows` and `SelfHostedRows` both already took the account they
 * configure — that was ADR 0209's fix — so putting them inside it is a move and
 * not a rewrite. What changes is that a reader can see whose key it is.
 */
function AccountCard({
  account,
  runtime,
  answers,
  profileLabel,
  current,
  open,
  onBill,
  onToggle,
}: {
  account: Connection;
  runtime: WorkspaceRuntime;
  answers: RuntimeAnswers;
  profileLabel: string;
  current: boolean;
  /** Its rows are drawn. Collapsed, the header alone stands (ADR 0224). */
  open: boolean;
  onBill: () => void;
  onToggle: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const { draft, setDraft, commit } = useCommittedSetting(account.label, (next) => {
    if (!next) return;
    runtime.patch(buildConnectionsPatch(runtime.config, { ...account, label: next }));
  });

  const lane = laneForProviderId(account.provider);
  const vendor = drawnNameFor(account.provider) ?? account.provider;
  const credential = credentialStateFor(account.id, "speech", answers);
  const usedBy = profileLabelsUsing(runtime.config, account.id);
  const others = Math.max(0, usedBy.length - (current ? 1 : 0));
  /* A LIMIT ONLY. `connectionCapabilitySentence` answers for every state; the two
     that say the vendor does everything are the ones a card does not need to
     print, because the job rows below already run on it. */
  const spoken = connectionCapabilitySentence(vendor, answers);
  const capability = spoken && spoken !== "Speech and language." ? spoken : null;

  const removeAccount = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    /* THE CREDENTIAL GOES FIRST AND THE CONFIG SECOND (ADR 0210). A config write
       that landed while the keyring call failed would orphan the key with nothing
       left naming it — the account id is the only handle onto its entries. */
    try {
      await invoke("clear_connection_credentials", {
        request: { provider: account.provider, connection: account.id },
      });
    } catch (cause) {
      setProblem(sentenceFor(cause));
      setBusy(false);
      return;
    }
    runtime.patch(buildConnectionRemovalPatch(runtime.config, account.id));
    setBusy(false);
    setAsking(false);
  };

  return (
    /* THE RAW CARD ELEMENT, because `Card` forwards no `data-*` to the DOM and
       TypeScript does not check a hyphenated JSX attribute against a component's
       props — so passing them there compiles and reaches nothing. This is the
       markup `Card` renders when it carries no title, description or footer. */
    <div
      className="ws-card ws-acct"
      data-account={account.id}
      data-current={current ? "" : undefined}
      data-open={open ? "" : undefined}
    >
      {/* THE HEADER CARRIES BOTH CONTROLS AND IS NEITHER OF THEM (ADR 0224). It
          was the radio itself; a `<button>` cannot hold the fold that acts on
          the same card, which is the rule `ListItem`'s pick states one component
          over. The badge left the pick with it: whether a key is stored is a
          status the card reports and not part of the choice being made. */}
      <div className="ws-acct-head">
        {/* THE PICK — one press says *bill this profile here*. It carries the
            mark, because recognising a vendor is what a logo is for and the only
            place this screen showed one was a chip row that could not be pressed
            (ADR 0223). */}
        <button
          type="button"
          role="radio"
          aria-checked={current}
          className="ws-acct-pick"
          onClick={onBill}
          title={current ? `${profileLabel} already bills here` : `Bill ${profileLabel} to ${account.label}`}
        >
          <span className="ws-radio" aria-hidden />
          <ProviderMark name={vendor} className="ws-acct-mark" fallback={<Icon name="cloud" />} />
          <span className="ws-acct-name">
            <b>{account.label}</b>
            {/* **THE SECOND LINE, AND ON THE PICKED CARD IT ALSO CARRIES THE
                PROFILE** (ADR 0226). Seven of the eight facts on an account card
                are the machine's — name, vendor, key, plan, endpoint, rename,
                remove. The eighth is the radio, and its owner was written
                nowhere a reader looks: the profile's name lived in the button's
                `title`, which is a tooltip.

                **IT IS NOT IN THE HEADER STRIP, AND THAT WAS MEASURED.** The
                first build put it beside the name and the real host reported
                `nameClipped: true` — at the 345 px this strip runs to, six
                things share one line and the name is the one that loses, so
                `Groq` drew as a sliver next to an intact chip. The line under
                the name is already a column that stacks and already holds the
                other fact that qualifies this account.

                **On the picked card only.** An unpicked card's radio says it in
                its own tooltip — *Bill General writing to Employer* — and the
                same word on four cards is furniture, not information. */}
            {(vendor !== account.label || current) && (
              <span className="ws-acct-vendor">
                {vendor !== account.label && <span className="ws-acct-of">{vendor}</span>}
                {current && (
                  <span className="ws-acct-bills">
                    <Icon name="profiles" />
                    {profileLabel}
                  </span>
                )}
              </span>
            )}
          </span>
        </button>
        <StatusBadge tone={credential === "set" ? "success" : credential === "missing" ? "warning" : "plan"}>
          {credential === "set" ? "Key set" : credential === "missing" ? "No key yet" : "Key not read"}
        </StatusBadge>
        {/* THE FOLD, NAMED AFTER THE ACCOUNT IT FOLDS. Four cards on a screen
            give four buttons called *Expand*, which is the ambiguity ADR 0222
            rewrote five cases to remove one component over. */}
        <IconButton
          className="ws-acct-fold"
          label={open ? `Collapse ${account.label}` : `Expand ${account.label}`}
          icon={<Icon name="chevron" />}
          aria-expanded={open}
          aria-controls={`${account.id}-rows`}
          onClick={onToggle}
        />
      </div>

      {open && (
      <CardRows id={`${account.id}-rows`}>
        {/* **WHAT THIS ACCOUNT CAN RUN, ON THE ACCOUNT** (ADR 0223). The sentence
            was the chip row's hint, so it described whichever vendor the row was
            marking and vanished with it. It is a fact about one account's vendor,
            and this is that account — stated only where the answer is a LIMIT,
            because *speech and language* on the card of a vendor that does both
            is furniture on a screen the reader already called too wordy. */}
        {capability && (
          <Row layout="stack">
            <span className="ws-row-hint">{capability}</span>
          </Row>
        )}
        {lane === "Self-hosted" ? (
          <SelfHostedRows runtime={runtime} account={account} onSelect={() => undefined} />
        ) : (
          <CloudCredentialRows runtime={runtime} account={account} />
        )}

        <Row layout="stack">
          <span className="ws-rowflex">
            {renaming ? (
              <Field
                w="170px"
                aria-label={`Rename ${account.label}`}
                value={draft}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  commit();
                  setRenaming(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commit();
                    setRenaming(false);
                  }
                  if (event.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <>
                <span className="ws-grow ws-row-hint">
                  {problem ??
                    (usedBy.length
                      ? `Billed by ${namedFew(usedBy)}.`
                      : "No profile bills here yet.")}
                </span>
                <IconButton
                  label={`Rename ${account.label}`}
                  icon={<Icon name="type" />}
                  onClick={() => setRenaming(true)}
                />
                <IconButton
                  label={`Remove ${account.label}`}
                  icon={<Icon name="trash" />}
                  tone="danger"
                  disabled={busy}
                  /* WHAT THE DELETION COSTS, BEFORE IT HAPPENS (ADR 0209).
                     `buildConnectionRemovalPatch` repoints THIS profile onto
                     another account of the same vendor and leaves every other
                     profile naming the one that is going, which then goes inert.
                     The count says so by naming the others. */
                  title={
                    others > 0
                      ? `${profileLabel} moves to another account. ${others} other ${others === 1 ? "profile keeps billing here and its jobs stop" : "profiles keep billing here and their jobs stop"}.`
                      : `${profileLabel} moves to another account.`
                  }
                  onClick={() => {
                    setProblem(null);
                    setAsking(true);
                  }}
                />
              </>
            )}
          </span>
        </Row>
      </CardRows>
      )}

      {asking && (
        <ConfirmPanel
          /* THE OBJECT IS NAMED, because the label collides with the vendor's own
             by default: `Remove Groq?` reads as removing the vendor. */
          question={`Remove the account “${account.label}”?`}
          detail={
            others > 0
              ? `Its key is deleted from the OS secret store and cannot be put back. ${others} other ${others === 1 ? "profile bills here and its jobs stop" : "profiles bill here and their jobs stop"}.`
              : "Its key is deleted from the OS secret store and cannot be put back."
          }
          confirmLabel="Remove account"
          onConfirm={() => void removeAccount()}
          onCancel={() => {
            setAsking(false);
            setProblem(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * AN ACCOUNT IS AN ACCOUNT **WITH SOMEBODY**, SO CREATING ONE ASKS WHO (B17).
 *
 * **Both ways of creating one picked the vendor for you.** `+ New` on the old
 * row used the shown account's vendor and `AddAccountRow` used a fixed
 * `runtimeIdFor(LANES.Cloud.provider)` — so on Cloud the button always made a
 * Groq account whatever the reader wanted, and the chip row above was the only
 * route onto a second vendor. That is the duty ADR 0212 wanted the chip row to
 * lose and could not give to anything else, because nothing else asked.
 *
 * **And it does not assign.** Adding an account is inventory work; deciding that
 * a writing style should start billing through it is not, and doing both on one
 * press is the conflation ADR 0212 closed at the lane level and left at the row
 * level — `+ New` created an account AND repointed the active profile, while the
 * row three components up already carried a docblock saying it must not.
 *
 * The vendor list is `selectableProviderNames`, which is the registry's answer
 * rather than the drawing's: a vendor with no adapter cannot hold an account
 * that could ever run a job, and offering it would be the false affordance
 * ADR 0067 rule 1 is about.
 */
function AddAccountPanel({
  runtime,
  answers,
  onDone,
}: {
  runtime: WorkspaceRuntime;
  answers: RuntimeAnswers;
  onDone: (created?: string) => void;
}) {
  /* **EVERY VENDOR THIS BUILD CAN OPERATE, ON EVERY LANE** (ADR 0223). It asked
     per lane, because the card was grouped by one; with the grouping gone the
     question is *who is this account with*, and the answer is not shorter on one
     lane than another. `Your server` is in the list for the first time: it is a
     lane that IS its own vendor, which is a reason to offer one option rather
     than a reason to offer none — the reader still has to say that is what they
     are making. */
  const lanes = ["Cloud", "Self-hosted", "Local", "Enterprise"] as LaneName[];

  /* **EVERY VENDOR THE DRAWING NAMES, NOT ONLY THE ONES THAT WORK** (ADR 0124).
     A first draft of this panel listed the selectable ones alone, which hides the
     answer to *why can I not make an Anthropic account* instead of giving it —
     the chip row it replaced had this right, and losing it here would have made
     the panel quieter and less honest at once. `ProviderChips` takes the full
     list plus what may be picked plus a reason for each that may not. */
  const drawn: { id: string; label: string }[] = lanes.flatMap((entry) => {
    const here = PROVIDERS.filter((row) => row.lane === entry).map((row) => row.name);
    if (here.length) {
      return here.flatMap((name) => {
        const id = runtimeIdFor(name);
        return id ? [{ id, label: name }] : [];
      });
    }
    /* A LANE THAT *IS* ITS OWN VENDOR carries no `PROVIDERS` row — `Your server`
       and `Local` are a place rather than a company — so the lane stands in for
       one, which is what makes them reachable here at all. */
    const laneVendor = LANE_PROVIDER_IDS[entry];
    return laneVendor
      ? [{ id: laneVendor, label: drawnNameFor(laneVendor) ?? LANE_LABEL[entry] }]
      : [];
  });

  const pickable = new Set(
    lanes.flatMap((entry) => {
      if (laneWithheld(entry)) return [];
      const named = selectableProviderNames(entry, answers);
      if (named.length) return named;
      const laneVendor = LANE_PROVIDER_IDS[entry];
      const registered =
        Boolean(laneVendor) &&
        Boolean(answers.registered?.some((row) => row.provider === laneVendor));
      return registered ? [drawnNameFor(laneVendor as string) ?? LANE_LABEL[entry]] : [];
    }),
  );
  const offered = drawn.filter((entry) => pickable.has(entry.label));

  const [vendor, setVendor] = useState(offered[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const chosen = offered.find((entry) => entry.id === vendor) ?? offered[0];
  /* THE RUNTIME HAS NOT ANSWERED YET is not *this lane has no vendors*. Until it
     has, the panel says so rather than offering an empty picker — the same split
     `accountChoices` makes between a pending read and a measured absence. */
  const pending = answers.registered === null;

  return (
    <div className="ws-stack ws-gap2">
      {pending ? (
        <span className="ws-row-hint">Reading which vendors this build can operate…</span>
      ) : !chosen ? (
        <span className="ws-row-hint">
          This build has no adapter for any vendor yet, so there is nothing an account could run.
        </span>
      ) : (
        <>
          {/* **THE LOGOS ARE HERE, WHICH IS THE ONE PLACE A VENDOR IS CHOSEN**
              (ADR 0223). They used to be on a chip row at the top of the screen
              that set nothing, while the control that actually decides the
              vendor was a text select — recognition on the inert thing and prose
              on the live one, exactly backwards. */}
          <ProviderChips
            label="Who is this account with"
            providers={drawn.map((entry) => entry.label)}
            value={chosen.label}
            onChange={(name) => {
              const picked = offered.find((entry) => entry.label === name);
              if (picked) setVendor(picked.id);
            }}
            custom={false}
            fallbackIcon={<Icon name="cloud" />}
            selectable={[...pickable]}
            reasonFor={(name) => {
              const row = PROVIDERS.find((entry) => entry.name === name);
              const withheld = row ? laneWithheld(row.lane) : undefined;
              return withheld ?? inertReasonFor(name, answers) ?? "This build has no adapter for it.";
            }}
          />
          <span className="ws-rowflex">
            <Field
              w="170px"
              aria-label="Account name"
              placeholder={chosen.label}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </span>
          <span className="ws-row-hint">
            Name it so you can tell two apart — Work and Personal on one vendor are two logins.
            Empty takes {chosen.label}.
          </span>
          <span className="ws-rowflex">
            <Button
              variant="primary"
              onClick={() => {
                const { patch, connectionId } = buildNewConnectionPatch(runtime.config, chosen.id);
                /* THE NAME RIDES WITH THE CREATION rather than being a second
                   write after it. `patch` is a shallow merge over `connections`,
                   so a rename posted separately would race the create it is
                   renaming. */
                const named = label.trim();
                runtime.patch(
                  named
                    ? {
                        ...patch,
                        connections: (patch.connections ?? []).map((entry) =>
                          entry.id === connectionId ? { ...entry, label: named } : entry,
                        ),
                      }
                    : patch,
                );
                onDone(connectionId);
              }}
            >
              Create account
            </Button>
            <Button variant="ghost" onClick={() => onDone()}>
              Cancel
            </Button>
          </span>
        </>
      )}
    </div>
  );
}

function ServerUrlRow({
  runtime,
  account,
  endpoint,
}: {
  runtime: WorkspaceRuntime;
  /* THE URL BELONGS TO THE ACCOUNT, NOT TO THE MACHINE (ADR 0208). ADR 0165 put
     it on `AppConfig` and said why: there was nowhere else for it to live. There
     is now, and it is the object that also owns the token — which is what makes
     *this server with that key* unrepresentable rather than merely discouraged.
     **The account is the one the inventory is open on** (B17): it was derived
     per lane, which was the same account for as long as the card could show only
     one, and a machine with two servers would have edited the first one's URL
     under the second one's name. */
  account?: Connection;
  endpoint: SelfHostedEndpointStatus | null;
}) {
  const stored = account?.base_url ?? "";
  const { draft, setDraft, commit } = useCommittedSetting(stored, (next) => {
    if (!account) return;
    runtime.patch(buildConnectionsPatch(runtime.config, { ...account, base_url: next }));
  });

  const fromEnvironment = endpoint?.base_url_source === "environment";

  return (
    <Row
      label="URL"
      /* THE REFUSAL OUTRANKS EVERYTHING ELSE THIS ROW COULD SAY. A URL WordScript
         will not send audio to is the one fact a reader needs, and it is the
         runtime's sentence rather than a second copy of the rule here. */
      hint={
        endpoint?.base_url_problem ??
        (fromEnvironment ? (
          <>
            This endpoint comes from{" "}
            <span className="ws-mono">{SELF_HOSTED_BASE_URL_ENV}</span>. What you
            type here is used instead of it.
          </>
        ) : (
          "An OpenAI-compatible server you operate, on another machine. Not the Local lane, which runs here."
        ))
      }
      control={
        <Field
          w="230px"
          aria-label="URL"
          /* The environment's value stands in the field's empty state rather
             than in a sentence: it is what a request would go to right now, and
             a row that named the variable without its value would leave the
             reader to go and look it up. */
          placeholder={
            fromEnvironment ? (endpoint?.base_url ?? "") : "http://10.0.0.2:8080/v1"
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      }
    />
  );
}

/**
 * **A probe, and it runs when it is asked to.**
 *
 * Never on open: this is a request to somebody's machine, and a settings screen
 * that pings a private server every time it is looked at is a settings screen
 * making network decisions on the reader's behalf. `Answering` therefore means
 * *it answered when you asked*, and the resting state says nothing rather than
 * claiming a reachability nobody measured.
 */
function ReachabilityRow({
  connectionId,
  ready,
}: {
  /* The probe asks about THIS account's server (ADR 0208) — two accounts on
     this lane are two machines, and a reachability answer that did not say
     which one it reached would be the fake readiness ADR 0067 forbids. It came
     off the context and therefore off the PROFILE's account, which on a machine
     whose profile is on another lane meant probing a server that account has
     never named. The card passes its own now. */
  connectionId?: string;
  ready: boolean;
}) {
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const test = async () => {
    setBusy(true);
    setProblem(null);
    setAnswered(false);
    try {
      const answer = await invoke<{ ok: boolean }>("validate_provider_api_key", {
        request: {
          provider: SELF_HOSTED_PROVIDER_ID,
          connection: connectionId ?? "",
          api_key: null,
        },
      });
      if (answer?.ok) setAnswered(true);
      else setProblem("The server replied and did not accept the request.");
    } catch (cause) {
      setProblem(sentenceFor(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row
      label="Reachability"
      hint={problem ?? undefined}
      control={
        <span className="ws-rowflex">
          <StatusBadge tone={answered ? "success" : problem ? "warning" : "plan"}>
            {answered ? "Answering" : problem ? "No answer" : "Not tested"}
          </StatusBadge>
          <Button variant="ghost" busy={busy} disabled={busy || !ready} onClick={() => void test()}>
            Test
          </Button>
        </span>
      }
    />
  );
}

/**
 * **The optional token, and optional is the whole design of this row.**
 *
 * `whisper-server` issues no bearer token at all; speaches and LocalAI may. So
 * an absent token is not a missing credential and does not make the lane
 * unready — `requires_api_key` stays false for this lane and
 * `credential_kinds` accepts one anyway, which is ADR 0165's split. What is
 * stored goes to the OS secret store under `self_hosted.speech.api_key`, the
 * same door and the same entry scheme as every other credential in this build.
 */
function ServerTokenRow({
  connectionId,
  credential,
  refresh,
}: {
  /* The token belongs to the account that names the server, and this is the
     line that keeps the pair together (ADR 0208). It came off the context, which
     names the PROFILE's account — so on a machine dictating through the cloud
     this row saved a bearer token into the cloud account's slot. */
  connectionId?: string;
  credential: RoleCredentialStatus | null;
  refresh?: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const preview = credential?.key_preview ?? null;

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      await invoke("save_provider_api_key", {
        request: {
          provider: SELF_HOSTED_PROVIDER_ID,
          connection: connectionId ?? "",
          api_key: draft.trim(),
        },
      });
      setDraft("");
      setEditing(false);
      await refresh?.();
    } catch (cause) {
      setProblem(sentenceFor(cause));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await invoke("clear_provider_api_key", {
        request: { provider: SELF_HOSTED_PROVIDER_ID, connection: connectionId ?? "" },
      });
      await refresh?.();
    } catch (cause) {
      setProblem(sentenceFor(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row
      label="Credential"
      hint={
        problem ?? "Optional. Some servers take a bearer token, most take none. Stored in the OS secret store, never in the config file."
      }
      control={
        editing ? (
          <span className="ws-rowflex">
            <Field
              autoFocus
              type="password"
              w="190px"
              aria-label="Bearer token"
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
            {/* THREE ANSWERS, BECAUSE *NONE* IS A STATEMENT ABOUT THIS ACCOUNT
                AND THIS ROW MAY NOT HOLD ONE FOR ANOTHER (ADR 0209). A token is
                optional, so `None` is a resting state a reader is meant to
                believe — which is exactly why it must not be printed for an
                account nothing has been read about. */}
            <StatusBadge tone={preview ? "success" : "plan"}>
              {preview ?? (credential ? "None" : "Not read")}
            </StatusBadge>
            <Button variant="ghost" icon={<Icon name="key" />} onClick={() => setEditing(true)}>
              {preview ? "Replace" : "Add"}
            </Button>
            {preview && (
              <Button variant="ghost" disabled={busy} onClick={() => void clear()}>
                Remove
              </Button>
            )}
          </span>
        )
      }
    />
  );
}

/**
 * **The id every job on this lane sends, and there is no list to pick it from.**
 *
 * The drawn row said `Per job`, which was the intent when nothing was stored
 * anywhere. What the runtime does is narrower and truer: the capture puts this
 * id on every request, the adapter substitutes nothing, and a job that names no
 * model is refused rather than sent with a guess attached (ADR 0115).
 */
function ServerModelRow({
  runtime,
  endpoint,
}: {
  runtime: WorkspaceRuntime;
  endpoint: SelfHostedEndpointStatus | null;
}) {
  /* The id belongs to whoever runs the server, so it belongs to the account that
     names the server (ADR 0208) — this lane's account (ADR 0212). */
  const account = accountForLane(runtime.config, "Self-hosted");
  const stored = account?.model ?? "";
  const { draft, setDraft, commit } = useCommittedSetting(stored, (next) => {
    if (!account) return;
    runtime.patch(buildConnectionsPatch(runtime.config, { ...account, model: next }));
  });

  const fromEnvironment = endpoint?.model_source === "environment";

  return (
    <Row
      /* THE ONE MODEL FIELD LEFT IN THE INVENTORY, AND IT IS NOT A MODEL CHOICE
         (ADR 0211). A vendor that publishes a list makes choosing from it a
         choice, and choices belong to the task axis — this server publishes
         none, so its id identifies WHAT ANSWERS at that URL. It is the second
         half of the address, like the port, and it sits here for the same reason
         the URL does: one typing serves every job on the server. A job row that
         names its own model outranks it. */
      label="Model id"
      hint={
        fromEnvironment ? (
          <>
            This id comes from{" "}
            <span className="ws-mono">{SELF_HOSTED_MODEL_ENV}</span>. What you
            type here is used instead of it.
          </>
        ) : (
          "The id this server answers to — half its address, not a choice from a list. Every job on it sends this unless the job names its own."
        )
      }
      control={
        <Field
          w="230px"
          aria-label="Model id"
          /* AN EXAMPLE FROM OUTSIDE THE CATALOGUE, ON PURPOSE — and the
             catalogue's own guard is what says so: a first draft used
             `ggml-large-v3-turbo`, which is a row in
             `shared/model_catalogue.json`, and the test that walks `src/` for
             ids spelled outside it failed (ADR 0115). It was right to. This
             lane catalogues nothing, and a placeholder naming a model
             WordScript ships would suggest the field picks from a list. */
          placeholder={fromEnvironment ? (endpoint?.model ?? "") : "faster-whisper-medium"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      }
    />
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
function CloudCredentialRows({
  runtime,
  account,
}: {
  runtime?: WorkspaceRuntime;
  /** The account the inventory is open on (B17). It was derived per lane, which
   *  answered *which of two Groq accounts is this key for* with a rule the
   *  reader could not see and could not change. */
  account?: Connection;
}) {
  const { answers, refresh, connection } = useContext(Wired);
  /* THE ACCOUNT THIS CARD CONFIGURES, WHICH IS THE LANE'S AND NOT THE PROFILE'S.
     It read `connectionId` off the context — the account the profile dictates on
     — while the card has been grouped by lane since ADR 0212. On a machine whose
     profile is on its own server the pair went apart in the worst possible way:
     this row's vendor resolved to `self_hosted` and its account to the server's,
     so a key typed under a heading that says `gsk_…` was written into the slot
     the self-hosted adapter reads its bearer token from — sent to the reader's
     own server on the next request, and the token that had been there was gone.
     Measured, not theorised. The runtime refuses the crossing now as well
     (`refuse_foreign_account`); this is the half that stops asking for it. */
  const laneAccount = account;
  const connectionId = laneAccount?.id;
  /* NULL IS *NOT READ YET* AND AN EMPTY ARRAY IS *THIS LANE HAS NO PLANS*, and
     the two were one value until ADR 0167. `resolve_provider_tiers` answers `[]`
     for both a lane with nothing to sell and a vendor with no adapter, which is
     the conflation `capture_limits_if_known` was split for one axis over — so
     the third sentence comes from `registered` and the read's own state stays
     here rather than being inferred from a length. */
  const [tiers, setTiers] = useState<ProviderTier[] | null>(null);
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
  /* THE VENDOR IS THE ACCOUNT'S OWN. It was read back off the context's drawn
     name, which is the PROFILE's vendor — the other half of the crossing above,
     and the half that decided which adapter the key was handed to. The registry
     default is still the fallback for a screen that opened before the config was
     read. */
  const providerId =
    laneAccount?.provider ?? (connection ? runtimeIdFor(connection) : undefined) ?? "groq";

  /* THE STATUS IS THE SEAM'S, NOT THIS ROW'S (ADR 0124). It used to run its own
     `provider_status`, and once the seam started asking for the same provider
     that was two reads of one OS secret store on one screen open — and two
     components with two opinions of one credential, which is the drift this
     step exists to remove one layer up. The plans stay here: they are a speech
     question this row is the only reader of. */
  const status = accountStatus(answers, connectionId);

  const read = useCallback(async () => {
    if (!runtime) return;
    const tierResult = await invoke<ProviderTier[]>("resolve_provider_tiers", {
      provider: providerId,
    }).catch(() => null);
    /* Not an array is a runtime that did not answer, not a provider with no
       plans — the row then states the stored value rather than an empty list. */
    if (Array.isArray(tierResult)) setTiers(tierResult);
  }, [runtime, providerId]);

  /* A VENDOR'S PLANS BELONG TO THAT VENDOR, so the answer is discarded when the
     connection moves rather than lingering under the next one. Without this the
     row would state Groq's two plans over an OpenAI connection for as long as
     the next read takes, which is the same fault the draft reset below prevents
     one row up — and the one this axis exists to make impossible (ADR 0167). */
  useEffect(() => {
    setTiers(null);
  }, [providerId]);

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

  /* THE ANSWER HAS TO BE ABOUT THE ACCOUNT THIS ROW IS RENDERING (ADR 0209).
     The status is keyed by VENDOR and the field below writes to `connectionId`,
     so a vendor with two accounts had one status and two rows: the badge read
     one account and the field wrote the other. `credentialForConnection`
     returns `null` where they disagree, and `null` is *not read for this
     account* rather than *no key* — the word this screen already uses for a
     runtime that did not answer. */
  const credential = credentialForAccount(answers, connectionId);
  const answeredForThisAccount = credential !== null;
  const configured = credential?.configured ?? false;
  const preview = credential?.key_preview;
  const storage = credential?.storage;

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      await invoke("save_provider_api_key", {
        request: {
          provider: providerId,
          connection: connectionId ?? "",
          api_key: draft.trim(),
        },
      });
      const validation = await invoke<{ ok: boolean }>("validate_provider_api_key", {
        request: { provider: providerId, connection: connectionId ?? "", api_key: null },
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
      await invoke("clear_provider_api_key", {
        request: { provider: providerId, connection: connectionId ?? "" },
      });
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
          hint="Sets the rate limit. Every plan shares the same upload limit."
          control={
            <DrawnSelect defaultValue="Free — 25 MiB per request" aria-label="Account plan">
              <option>Free — 25 MiB per request</option>
              <option>Developer — 25 MiB per request, higher rate limits</option>
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
              {answeredForThisAccount ? (
                <StatusBadge tone={configured ? "success" : "warning"}>
                  {configured ? (preview ?? "Set") : "Not set"}
                </StatusBadge>
              ) : (
                <StatusBadge tone="plan">Not read</StatusBadge>
              )}
              <Button variant="ghost" icon={<Icon name="key" />} onClick={() => setEditing(true)}>
                {answeredForThisAccount && !configured ? "Add" : "Replace"}
              </Button>
              {/* NOT OFFERED FOR AN ACCOUNT NOBODY HAS ANSWERED ABOUT. Clearing
                  reaches the right entry either way, but a button that removes
                  something the row declines to claim exists is asking the reader
                  to guess what it will do. */}
              {configured && (
                <Button variant="ghost" disabled={busy} onClick={() => void clear()}>
                  Remove
                </Button>
              )}
            </span>
          )
        }
      />
      <AccountPlanRow runtime={runtime} providerId={providerId} tiers={tiers} />
    </>
  );
}

/**
 * WHAT THIS MACHINE'S PLAN IS WITH THE VENDOR THE CONNECTION NAMES — or why
 * there is nothing here to set (ADR 0167).
 *
 * **A plan buys rate limit, and on Groq it does not buy request size** —
 * measured 2026-08-21, both plans refuse the attachment at the same byte
 * (ADR 0246). The row is a control where a vendor sells more than one ceiling,
 * which is what ADR 0038 decided when it declared the plans and which this row
 * did not do: it drew a select with one option for OpenAI, and a permanently disabled
 * *Reading the provider plans…* for a vendor with none. The second is the worse
 * of the two — a sentence claiming a read is in flight when the runtime has
 * already answered, on a screen whose own rule is that a state it cannot
 * establish is stated rather than drawn.
 *
 * **The statement is not a new element.** The Enterprise branch of this file
 * already replaces an empty picker with a badge and the reason
 * (`Speech · Azure only`), for the same argument in the same words.
 *
 * **Three vendors and two reads, kept apart.** `resolve_provider_tiers` answers
 * `[]` both for a lane with no plans and for a vendor with no adapter, so the
 * registry answers the second — absence from `registered` is how *no adapter*
 * is stated (ADR 0124), and it is a different sentence from *this lane is not
 * billed by request size*. Neither is *not read yet*, which claims nothing.
 *
 * **The two vendor sentences are `resolveProviderAnswer`'s, not this row's.**
 * *Anthropic is not integrated yet* and *this vendor does not serve speech* are
 * already written once, for the chip row and the job rows, and a second copy
 * here is the drift ADR 0123 forbids — this row asks the seam the same question
 * with `speech` in hand and shows what it answers.
 */
function AccountPlanRow({
  runtime,
  providerId,
  tiers,
}: {
  runtime: WorkspaceRuntime;
  providerId: string;
  tiers: ProviderTier[] | null;
}) {
  const { answers } = useContext(Wired);
  const registered = answers.registered;

  const spent = "Sets the largest upload, and with it the longest recording. Stated again where it is spent.";

  /* Nothing read yet claims nothing, so the row keeps the shape it had. A
     `pending` that replaced the control would make every screen open flicker
     through a sentence on its way to the truth. */
  if (registered === null || tiers === null) {
    return (
      <Row
        label="Account plan"
        hint={spent}
        control={
          <Select aria-label="Account plan" value="" disabled onChange={() => {}}>
            <option value="">Reading the provider plans…</option>
          </Select>
        }
      />
    );
  }

  const answer = resolveProviderAnswer(drawnNameFor(providerId) ?? providerId, "speech", answers);

  /* ONE BRANCH FOR THREE SENTENCES, because the row asks one question. The seam
     separates *this vendor has no adapter at all*, *the vendor serves speech and
     this build does not* and *the vendor does not do speech* — three different
     facts, correctly kept apart for the chip row and the job rows, and all three
     the same answer to `which plan am I on`: there is no speech here to bound.
     The distinction rides on the hint, where the seam already wrote it.
     Collapsing them in the BADGE is not the conflation ADR 0106 is about; a
     fourth spelling of them here would be.
     And the badge is deliberately not `Enterprise`'s `No adapter`: that one is
     about a LANE nothing stands behind, this is about one vendor on a lane that
     works, and both are visible on this screen at once.

     THE REASON IS NOT REPEATED HERE, and that was found rather than designed:
     the connection card two rows up already carries the seam's sentence, so
     printing it again put one fact on the screen twice a few pixels apart —
     the furniture rule this file states about the credential badge, arriving
     through a row that had every right to know the answer. What this row owns
     is why the ANSWER MATTERS HERE, which nothing else says. */
  if (
    !answer.operable &&
    (answer.reason.kind === "no_adapter" || answer.reason.kind === "role_denied")
  ) {
    return (
      <Row
        label="Account plan"
        hint="A plan bounds an upload, so it is a speech question. This connection does not transcribe — the reason is on the connection above."
        control={<StatusBadge tone="warning">No speech</StatusBadge>}
      />
    );
  }

  if (tiers.length === 0) {
    return (
      <Row
        label="Account plan"
        hint="This lane is not bound by request size, so there is no plan to be on. What one recording may cost is the ceiling below."
        control={<StatusBadge>No plans</StatusBadge>}
      />
    );
  }

  /* ONE CEILING IS A FACT, NOT A CHOICE. The vendor publishes it for every
     account, so a select here would be a control that decides nothing — and the
     number itself is not lost: `Longest recording this lane accepts` states it
     one card down, resolved, which is where it is spent. */
  if (tiers.length === 1) {
    return (
      <Row label="Account plan" hint={spent} control={<StatusBadge>{tiers[0].label}</StatusBadge>} />
    );
  }

  /* THE PLAN IS THE ACCOUNT'S (ADR 0167, rescoped by ADR 0208). It was keyed by
     vendor on the argument that a plan belongs to a credential — which is true,
     and the credential is an account's: a paid work account and a free private
     one on one vendor do not share a ceiling. This row renders on the Cloud lane,
     so it reads that lane's account (ADR 0212). */
  const account = accountForLane(runtime.config, "Cloud");
  const stored = account?.plan ?? "";
  return (
    <Row
      label="Account plan"
      hint={spent}
      control={
        <Select
          /* A PLAN ID THIS VENDOR NEVER SOLD READS AS ITS DEFAULT, which is what
             the runtime already does: `capture_limits` falls back to the default
             tier for an id it does not recognise, on the argument that being
             wrong towards "you may record less" costs a retry. After ADR 0167 a
             foreign id can only reach here through a hand-edited config — the
             map is keyed by vendor and the migration drops what no vendor sold —
             but the fallback stays, because a config file is a thing people
             edit. */
          value={tiers.some((tier) => (tier.default ? "" : tier.id) === stored) ? stored : ""}
          onChange={(event) =>
            account &&
            runtime.patch(
              buildConnectionPlanPatch(runtime.config, account.id, event.target.value),
            )
          }
          aria-label="Account plan"
        >
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.default ? "" : tier.id}>
              {tier.label}
            </option>
          ))}
        </Select>
      }
    />
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
  account,
}: {
  lane: LaneName;
  selected: string;
  /** Enterprise calls this an Account, because there it is one: a tenant, a
   *  region and a credential chain rather than a company you buy tokens from. */
  label?: string;
  hint?: ReactNode;
  custom?: boolean;
  /** The account the inventory is open on, under a runtime. Its vendor is what
   *  this row marks (B17). */
  account?: Connection;
}) {
  const wired = useWired();
  const answers = useAnswers();
  const here = PROVIDERS.filter((p) => p.lane === lane);
  const cur = here.find((p) => p.name === selected) ?? here[0];
  const [drawnValue, setDrawnValue] = useState(cur.name);
  /* THE PRODUCT READS THE CONFIG AND THE GALLERY READS ITSELF. Two sources for
     one control, and the alternative was worse in both directions: local state
     on the product is a chip that springs back on the next render, and a config
     read in the gallery is a screen that cannot be rendered without a runtime
     (ADR 0055). The Enterprise pick has no config home yet, so it keeps the
     drawing on both surfaces. */
  /* THE VENDOR OF THE ACCOUNT THIS CARD CONFIGURES, AND IT WAS THE PROFILE'S.
     This read `Wired.connection` — the vendor the active profile dictates on —
     while every row beneath it has read `accountForLane` since ADR 0213. On a
     profile pointed at `Your server` the two came apart in the way that says
     nothing true: the chip row's value was `Your server`, which the Cloud list
     does not contain, so NO chip drew as chosen and the capability sentence
     described Groq, over an Account row and a key row showing the first Cloud
     account. Same defect ADR 0209 removed one row down, still standing on the
     row above it. */
  const laneVendor = account ? drawnNameFor(account.provider) : undefined;
  const wiredHere = wired && lane === "Cloud" && Boolean(laneVendor);
  const value = wiredHere ? (laneVendor as string) : drawnValue;
  const chosen = here.find((p) => p.name === value) ?? cur;
  /* **AND IT NO LONGER WRITES ANYTHING** (speech track B17).
     Picking a chip used to point the ACTIVE PROFILE at an account with that
     vendor, creating one where the machine held none — an assignment and a
     creation on one press of a control that named neither, which is the
     conflation ADR 0212 closed at the lane level and left here. Both halves have
     somewhere honest to be now: [`AddAccountPanel`] creates an account and asks
     for its vendor, and `ProfileAccountRow` at the head of *What runs what*
     assigns one with the profile named.

     So this row states rather than sets, under a runtime: it marks the vendor of
     the account the inventory is open on, which is the fact its capability
     sentence has always been about. The gallery keeps the picker, because there
     the drawing is the whole point (ADR 0055) and `port:diff` measures it. */

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
        /* A CHIP THAT SETS NOTHING IS NOT PRESSED, under a runtime. The vendor
           of an account is decided when the account is created and never after:
           re-pointing an existing account at another vendor would leave its
           stored key addressed to a company that never issued it. */
        onChange={wiredHere ? undefined : setDrawnValue}
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
 * The two that carry no tag are the machine's, and they are live.
 *
 * **This sentence used to cite `enhance_sub_mode` and `enhance_target` as the
 * shape these two follow, and that comparison was false in the direction that
 * matters.** Those fields exist in `AppConfig` AND in the profile's work mode,
 * and nothing ever wrote either; the two controls over them were an
 * `InertSegment` and a `DrawnSelect` on the Prompt Enhance row, and Profiles had
 * none. A comment naming an unwired pair as the precedent for a wired one is how
 * the next reader concludes the pair is fine.
 *
 * **Those two controls are gone as of 2026-08-17** — the owner's ruling that a
 * fixed setting nobody needs an opinion about should work rather than be
 * offered. So these four rows are now the only per-job settings on this screen,
 * and the language pair joining them is speech-track B18.
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

/**
 * THE NAME THE ASSISTANT ANSWERS TO — a control that writes, and it was one that
 * did not.
 *
 * **It shipped as a live `Field` with a drawn default and no writer anywhere in
 * the tree.** Not a `DrawnField`: nothing disabled it, nothing carried a reason,
 * and a reader could type into it and watch the value survive until the next
 * render. `modes.agent_name` is read by the runtime on every dictation —
 * `active_text_profile_agent_name`, which is also what decides when Auto routes
 * one here — so this is ADR 0067 rule 1 broken on the row that looked most like
 * it worked, and ADR 0020's failure class from the other end: a stored value with
 * no way to set it.
 *
 * **It writes the active profile and says which**, the way every other
 * per-profile control on this screen does (ADR 0209). The value is per profile
 * already; what was missing was the door, not the storage.
 *
 * The gallery keeps the drawn literal, so `port:diff` does not move.
 */
function AgentNameRow() {
  const runtime = useRuntime();
  const openProfiles = useOpenProfiles();

  return runtime ? <WiredAgentNameRow runtime={runtime} onOpen={openProfiles} /> : (
    <Row
      label="Name you address it by"
      hint="Also decides when Auto routes a dictation here, in every mode."
      control={
        <Field defaultValue="WordScript" w="150px" aria-label="Name you address it by" />
      }
    />
  );
}

function WiredAgentNameRow({
  runtime,
  onOpen,
}: {
  runtime: WorkspaceRuntime;
  onOpen?: () => void;
}) {
  const profile = resolveActiveTextProfile(runtime.config);
  const modes = resolveProfileModesSettings(profile);
  /* Committed on blur and Enter rather than per keystroke, which is the idiom the
     account name and the server URL on this screen already use: a name is typed in
     one go and a write per character is an IPC round trip per character. */
  const { draft, setDraft, commit } = useCommittedSetting(modes.agent_name, (next) => {
    /* An empty name is not a name. The runtime falls back to the machine-wide
       value when the profile's is blank, so clearing this reads as *use the
       default* rather than as *the assistant has no name* — and writing the empty
       string would be the reader's clear, which is a value they may want. */
    runtime.patch(buildProfileModesPatch(runtime.config, { agent_name: next }));
  });

  return (
    <Row
      label="Name you address it by"
      hint="Also decides when Auto routes a dictation here, in every mode."
      control={
        <span className="ws-rowflex">
          <ScopeTag profile={profile.label} onOpen={onOpen} />
          <Field
            w="150px"
            aria-label="Name you address it by"
            value={draft}
            placeholder="WordScript"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
            }}
          />
        </span>
      }
    />
  );
}

/**
 * THE LANGUAGE A PROFILE IS HEARD IN, STATED (speech track B18, ADR 0068).
 *
 * Two rows that were a `DrawnSelect` over three literal options and an
 * `InertToggle` — drawn on this screen, settable on none, over two fields the
 * runtime has read all along. ADR 0068 decides which way that is repaired: a
 * per-profile value is edited on Profiles and stated here with the tag that is
 * the door to it, exactly as `Into` and `Keep the profile's words` are.
 *
 * The gallery keeps the drawing, because a screen with no runtime has no
 * profile to state — which is also what keeps `port:diff`'s two other states
 * measuring the same tree they did before.
 */
function LanguageRows({ onOpen }: { onOpen?: () => void }) {
  const runtime = useRuntime();
  if (!runtime) {
    return (
      <>
        <Row
          label="Language"
          hint="Auto-detect reads it from the audio, per dictation."
          control={
            <span className="ws-rowflex">
              <ScopeTag onOpen={onOpen} />
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
      </>
    );
  }

  const profile = resolveActiveTextProfile(runtime.config);
  const speech = resolveProfileSpeechSettings(profile);
  const named = TRANSLATE_LANGUAGES.find((language) => language.code === speech.language);
  /* AN ID THIS BUILD HAS NO NAME FOR IS PRINTED RATHER THAN HIDDEN — the same
     rule the model row follows (ADR 0215). The stored value is what the request
     carries, so a surface that showed `Auto-detect` over a config holding `sv`
     would be naming one language while the recogniser was told another. */
  const language = speech.language ? (named?.label ?? speech.language) : "Auto-detect";

  return (
    <>
      <Row
        label="Language"
        hint="Sent to the recognizer as a hint. Auto-detect reads it from the audio, per dictation."
        control={
          <span className="ws-rowflex">
            <ScopeTag profile={profile.label} onOpen={onOpen} />
            <StatusBadge tone="plan">{language}</StatusBadge>
          </span>
        }
      />
      <Row
        label="Pin this language"
        hint="Only affects whole passages in another script. Mixed sentences stay untouched, and it never discards text on its own — it lowers the corroboration the drift check needs from two signals to one."
        control={
          <span className="ws-rowflex">
            <ScopeTag profile={profile.label} onOpen={onOpen} />
            {/* THREE STATES AND NOT TWO. A toggle here would have to draw *off*
                for both *not pinned* and *there is nothing to pin*, and on this
                screen the second is what almost every profile is in. */}
            <StatusBadge tone={speech.language_locked ? "success" : "plan"}>
              {speech.language ? (speech.language_locked ? "Pinned" : "Not pinned") : "Nothing to pin"}
            </StatusBadge>
          </span>
        }
      />
    </>
  );
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
      /* THE COLLAPSED ROW HAS TO BE TRUE AT A GLANCE (ADR 0212). It carried
         `jobBadge`, which reads the LANE's drawn catalogue entry — so a cleanup
         routed to OpenAI with a model of its own summarised itself as Groq's
         `llama-3.1-8b-instant`, which is the exact *surface names one model, the
         request carries another* defect this step exists to end, on the one line
         a reader takes in without opening anything. Found by rendering it, not by
         a test. The drawing keeps `jobBadge`, because that is what `port:diff`
         measures. */
      control={<JobBadge lane={lane} jobKey={jobKey} cap={cap} />}
      rows={<Follows lane={lane} jobKey={jobKey} cap={cap} hint={hint} extra={children} />}
      extra={extra}
    />
  );
}

/**
 * WHAT ONE JOB RUNS ON, IN THE ONE LINE THE COLLAPSED ROW SHOWS (ADR 0212).
 *
 * Under a runtime: the account's vendor mark and the model the resolution would
 * actually spend — the job's own where it named one its vendor serves, the
 * profile's slot for its family otherwise, and `default` said out loud in that
 * case. In the gallery: `jobBadge`, unchanged, because the drawing is what
 * `port:diff` compares against the prototype.
 */
function JobBadge({
  lane,
  jobKey,
  cap = "llm",
}: {
  lane: LaneName;
  jobKey: JobKey;
  cap?: "stt" | "llm";
}) {
  const runtime = useRuntime();
  if (!runtime) return jobBadge(lane, jobKey);

  const profile = resolveActiveTextProfile(runtime.config);
  const resolved = resolveJobProvider(profile, jobKey, resolveConnections(runtime.config));
  const local = resolved.provider === LOCAL_PROVIDER_ID;
  const role = cap === "stt" ? "speech" : "chat";
  /* THE RUNTIME'S OWN RULE, ASKED THROUGH THE ONE FUNCTION THAT SPELLS IT
     (ADR 0211). This line held a second, stricter copy — *is the id in the
     vendor's catalogue rows* — which refuses a typed override the request
     actually carries (ADR 0115), so the collapsed row named the profile's default
     over a job running on something else. Same defect the model select below had,
     and the reason both now ask `namedModel`. */
  const named = namedModel(resolved, role) ?? "";
  const model = named || roleDefaultModel(profile, jobKey, local) || connectionById(runtime.config, resolved.connection)?.model || "";

  return (
    <JobModel
      mark={drawnNameFor(resolved.provider) ?? null}
      model={model}
      override={named ? undefined : "default"}
    />
  );
}

/* ── The three lanes that cannot be picked ──────────────────────────────────
   WHY THEY ARE GREY, AND WHERE THIS MACHINE STANDS (B12, ADR 0163).

   **The lock is right and its silence was not.** ADR 0067 rule 1 says a
   surface that OFFERS a lane makes it inoperable, because a control that
   accepts a click and then asks for a credential is the worst false affordance
   there is. So the segment above stays disabled. What was missing is that it
   said nothing: three greyed words, no reason, and — since B5 — an *On this
   machine* tab busily installing models for a lane the reader cannot select.

   **TWO REASONS, NOT ONE, AND THE STEP EXISTS TO KEEP THEM APART.** *Not
   published* is a decision about the product; *not ready* is a fact about this
   disk. `Local` is the row where they come apart: the runtime runs it, B5
   installs for it, and a machine with
   `whisper-cli`, a ggml model and Ollama answering is READY and still not
   offered. Saying that plainly is the deliverable — the alternative is a
   surface that withholds without reporting, which is `CLAUDE.md`'s rule broken
   in both directions at once.

   **IT WAS THREE ROWS FOR ONE EVENING** (ADR 0164, then ADR 0165). B12 could
   put `Your server` and `Enterprise` on one row because *neither has an
   adapter* was true of both; D1a built the self-hosted adapter and left the
   configuration a drawing, which made that lane withheld for a reason neither
   of the other two had — *built, and with nowhere to type the endpoint*. D1b
   is the somewhere, so that reason is spent and its row is gone rather than
   reworded. **The row count follows the reasons, and a reason that is no longer
   true does not get a softer sentence — it gets its lane back.**

   **WIRED ONLY, AND THAT IS WHY `port:diff` DOES NOT MOVE.** There is nothing
   to draw here: the gallery has no runtime, so it has no lock and no disk to
   report on. The known cost is B8's — what appears only in the product is held
   by tests rather than by the port (ADR 0159) — and the cases are in
   `Models.test.tsx`.

   **AND IT IS NOT A SECOND COPY OF THE `Local` LANE ROWS** (ADR 0162). Those
   render only when `lane === "Local"`, which with a runtime never happens,
   because this very lock forbids it. The two never appear together. */
function LockedLanes({
  setup,
  asked,
  onManage,
}: {
  setup: LocalProviderSetupStatus | null;
  asked: boolean;
  onManage?: () => void;
}) {
  const standing = localStanding(setup, asked);
  return (
    <>
      <Row
        label="Local"
        tag={
          <PreviewTag title="Built and withheld, not drawn. The runtime carries this lane and On this machine installs for it; what is withheld is OFFERING it, until ROADMAP Phase 5 has finished it — the acceleration probe, whether Ollama ships with WordScript, and streaming." />
        }
        hint={`${LOCAL_WITHHELD} ${standing.sentence}`}
        control={
          <span className="ws-rowflex">
            <StatusBadge tone={standing.tone}>{standing.badge}</StatusBadge>
            {/* THE SAME DOOR THE DRAWN LANE ROW HAS, for the same reason: the
                detail behind this sentence — which runner, which files, how
                large — is one tab away and a row that names a state without
                reaching it makes the reader hunt for what it just told them. */}
            <Button variant="ghost" icon={<Icon name="arrow" />} onClick={onManage}>
              Manage
            </Button>
          </span>
        }
      />
      {/* AND `Your server` IS NOT HERE ANY MORE (D1b, ADR 0165).
          **It had a row for one evening and the row named its own expiry.**
          D1a said *adapter built, nowhere to type the endpoint*; this step is
          the somewhere, so the reason is spent and the row goes with it rather
          than being reworded into a lock that no longer has a cause. That is
          ADR 0067 rule 1 running forwards: a lane is withheld while it cannot
          be operated and offered when it can, and the commit that finishes it
          is the commit that reverses the lock.

          **Two rows, and they are withheld for different reasons**, which is
          why they are still two: `Local` is built and held back by the product
          (ROADMAP Phase 5), `Enterprise` has no adapter at all. Folding them
          would be B12's one-sentence-two-subjects mistake, which went half
          false overnight the first time. */}
      <Row
        label={LANE_LABEL.Enterprise}
        tag={<PreviewTag title="Drawn, not built. The rows show the shape this lane will have; nothing behind it runs a job yet." />}
        hint="This lane has no adapter yet, so there is nothing behind it to run a job. Its rows show what it will ask for once there is."
        control={<StatusBadge tone="plan">No adapter</StatusBadge>}
      />
    </>
  );
}

/** THE SECOND DOOR INTO THE `Your server` LANE, named where it is now relevant.
 *
 *  **These moved from `LockedLanes` to the rows themselves** (D1b). Until this
 *  step the variables were the ONLY way in, and the withheld row named them
 *  because a row that says *not configurable* without saying what the expert
 *  door is withholds the next action. Now the field is the next action and the
 *  variable is the fallback, so the name belongs beside the field it is
 *  outranked by — and only when it is the one actually answering.
 *
 *  **AND THE NAME IS SET IN `ws-mono`, WHICH IS NOT DECORATION.** Every machine
 *  token on this screen already is — `127.0.0.1:11434` on the Local lane, the
 *  masked key on the credential row, every model id in the job list — and this
 *  one is the single thing in the sentence a reader has to reproduce exactly.
 *  In the body font it read as prose and wrapped mid-identifier. **That is only
 *  visible in the host**: it renders under a runtime, so the gallery never draws
 *  it and `port:diff` cannot reach it, and it was found by opening the app after
 *  the suite was green — the same way ADR 0160, 0161 and 0162 each were. */
const SELF_HOSTED_BASE_URL_ENV = "WORDSCRIPT_SELF_HOSTED_BASE_URL";
const SELF_HOSTED_MODEL_ENV = "WORDSCRIPT_SELF_HOSTED_MODEL";

/** WHY THE LANE IS WITHHELD — the product's half, and it is stated once.
 *
 *  Three surfaces on this screen have already carried one fact in two places
 *  and drifted (ADR 0160, ADR 0161, ADR 0162, all applied twice). The machine's
 *  half varies per disk and is composed below; this half does not vary at all,
 *  so it is a constant and the roadmap is its owner. */
/** Read from the seam rather than spelled here (ADR 0123): the job rows refuse
 *  an account on this lane with the same sentence. */
const LOCAL_WITHHELD = laneWithheld("Local") ?? "";

/** The three things the lane needs on this disk, in the order they are used. */
const LOCAL_PARTS: { ready: (setup: LocalProviderSetupStatus) => boolean; name: string }[] = [
  { ready: (setup) => setup.runner_ready, name: "whisper-cli" },
  { ready: (setup) => setup.model_ready, name: "a speech model" },
  { ready: (setup) => setup.chat_ready, name: "Ollama with a language model" },
];

/**
 * WHERE THIS MACHINE STANDS, IN ONE BADGE AND ONE SENTENCE.
 *
 * **`Not read` is a third answer and it is the one that must not be guessed**
 * (ADR 0160). `local_setup` comes back `null` when the probe failed or has not
 * run, and reading that as *nothing is installed* would tell somebody their
 * `whisper-cli` is missing because a command errored.
 *
 * **The count is on the badge because it is the question the reader has.** A
 * lane greyed out over a machine that has all three is a different situation
 * from one greyed out over a machine that has none, and `Needs setup` says the
 * same words about both.
 */
function localStanding(
  setup: LocalProviderSetupStatus | null,
  asked: boolean,
): { tone: "success" | "warning" | "plan"; badge: string; sentence: string } {
  if (!asked || !setup) {
    return {
      tone: "plan",
      badge: "Not read",
      sentence: "What this machine already has was not read — On this machine lists it.",
    };
  }

  const has = LOCAL_PARTS.filter((part) => part.ready(setup)).map((part) => part.name);
  const needs = LOCAL_PARTS.filter((part) => !part.ready(setup)).map((part) => part.name);

  if (needs.length === 0) {
    return {
      tone: "success",
      badge: "Ready",
      sentence: `This machine already has every piece the lane needs — ${listWords(has)} — so what is missing here is the product, not the setup.`,
    };
  }

  return {
    tone: "warning",
    badge: `${has.length} of ${LOCAL_PARTS.length} ready`,
    sentence:
      has.length === 0
        ? `This machine has none of the three yet: it would need ${listWords(needs)}.`
        : `This machine has ${listWords(has)}; it would still need ${listWords(needs)}.`,
  };
}

/** `a, b and c`. Written here rather than reached for, because the one thing it
 *  is used on is a list of at most three known strings. */
/** Three names and a count, because the read-out is a sentence and a machine with
 *  seven profiles made it three lines of one (measured at the real 569 px column,
 *  which is the width this card is actually read at). The names are the ones a
 *  reader recognises; the number is what makes the rest countable. */
function namedFew(names: string[]): string {
  if (names.length <= 3) return listWords(names);
  const rest = names.length - 3;
  return `${names.slice(0, 3).join(", ")} and ${rest} other ${rest === 1 ? "profile" : "profiles"}`;
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function ModelsTab({
  lane,
  runtime,
  setup,
  asked,
  onManage,
}: {
  lane: LaneName;
  runtime?: WorkspaceRuntime;
  /** What the runtime found on this disk, read once for the whole screen
   *  (B12). `null` after `asked` is the probe failing, not a runner missing. */
  setup: LocalProviderSetupStatus | null;
  asked: boolean;
  /** Threaded from `ModelsScreen`, which owns the tab state (ADR 0162). A prop
   *  through one level rather than a context: `Wired` exists because the job
   *  ladder renders four controls deep, and this is one row on one card. */
  onManage?: () => void;
}) {
  /* THE TWO DOORS THIS TAB DRAWS, and neither of them opened before. `Open the
     profile` and `Open Agents` were link text with no handler under it — the
     fake affordance rule 7 forbids, worn as prose instead of as a button. In
     the gallery there is no runtime and therefore nowhere to go, so both are
     drawn only when a workspace handed one over. */
  const open = runtime?.open;
  /* CALLED ONCE, HERE, AND IT WAS CALLED THREE TIMES INSIDE THE JSX BELOW. Three
     `useOpenProfiles()` in the returned tree is legal only for as long as none of
     them ever sits behind a condition — the rows they are on are already
     conditional in every other respect, and the first `&&` placed in front of one
     would change the hook order mid-render. One call at the top costs nothing and
     removes the trap. */
  const openProfiles = useOpenProfiles();
  return (
    <>
      {/* THE ACCOUNTS. This was `Connection`, singular, and it was the spine of
          the screen — which is what made a credential look like the thing a job
          runs on. It is an inventory now: what this machine holds, per lane, with
          the keys and the plans that belong to them. What runs where is the list
          below (ADR 0212).

          THE LANE IS FOUR AND NOT TWO. Cloud and Local were the two the surface
          had, which left self-hosted and enterprise with nowhere to live — and
          that homelessness is what produced the third screen. */}
      {/* **AND THE HEAD SAYS WHOSE THEY ARE** (ADR 0226). It said *each one is a
          separate login with its own key* — true and about the wrong axis. The
          fact a reader needs before typing a key into one of these is that the
          key is the machine's: every profile on it reads the same list, the same
          keys and the same plans. */}
      <SectionHeader
        title="Accounts"
        description="On this machine. Every profile sees the same list."
      >
        {runtime ? (
          <AccountList
            runtime={runtime}
            setup={setup}
            asked={asked}
            onManage={onManage}
            onOpenProfiles={openProfiles}
          />
        ) : (
          /* THE DRAWING, WHICH IS NOW THE SAME SHAPE AS THE PRODUCT (ADR 0223).
             The gallery had the lane segment, the chip row and the credential
             rows; all three moved or went, so a gallery that kept them would be
             showing a screen this build no longer has. `port:diff` moves with
             it, deliberately and measured — the second such divergence on this
             screen after ADR 0216's. */
          <DrawnAccountCard />
        )}
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
      {/* **AND THIS HALF IS THE PROFILE'S, SAID ONCE AND NOT HERE** (ADR 0226).
          A `ScopeTag` stood here for one build. The lead already says *what each
          job runs on belongs to `<profile>`* two blocks up, the sheet header
          carries the switcher, and the picked card wears the name — so a tag on
          this head was the fourth copy of one word, which is the noise the step
          set out to remove rather than more of the answer. */}
      <SectionHeader title="What runs what" description="One row per job. Open one to change it.">
        <Card>
          <div className="ws-stack ws-gap4">
            {/* WHICH ACCOUNT THIS PROFILE BILLS TO, AT THE HEAD OF THE LIST IT
                GOVERNS (speech track B17, ADR 0212). It was a select inside the
                Accounts card — the inventory of what the MACHINE holds — so the
                one control that decides who pays lived in the one card that is
                not about the profile. ADR 0212 split adding an account from
                assigning one and the two were still drawn in the same row.

                It leads the job list because that is what it is: every row below
                follows it unless it carries an override of its own, which is
                exactly the sentence a default owes. */}
            {runtime && <ProfileAccountRow runtime={runtime} />}
            <div className="ws-grp">
              <label>Listening</label>
              <JobList>
                <LaneJobRow
                  lane={lane}
                  jobKey="dictation"
                  cap="stt"
                  name="Dictation"
                  what="Seconds of one voice, on the fastest path there is."
                  hint="Follows the account above. Speed decides this row — you are waiting on it."
                >
                  {/* STATED HERE, EDITED ON PROFILES (ADR 0068, speech track
                      B18) — the pattern `Into` and `Keep the profile's words`
                      have used since ADR 0068 ruled it, and the answer to a
                      pair that was drawn on this screen and settable on none.

                      **The runtime half was never the missing one.**
                      `speech.language` and `speech.language_locked` reach the
                      capture snapshot, the drift check and both cloud adapters
                      as the language hint; what did not exist was any control
                      at all, which is ADR 0020's failure class from the other
                      end — not a control the runtime ignores, but a value the
                      runtime reads that nothing can set.

                      **`Pin this language` states rather than mirrors a
                      disabled toggle**, because a toggle that is off can mean
                      *not pinned* or *nothing to pin*, and on this screen the
                      second is the ordinary case. */}
                  <LanguageRows onOpen={openProfiles} />
                  <Row
                    label="Longest recording this lane accepts"
                    hint="Set by the account's plan. Profiles → Defaults can hold you to less."
                    control={
                      <span className="ws-rowflex">
                        <CeilingBadge />
                        <ScopeTag profile="Limit in profile" onOpen={openProfiles} />
                      </span>
                    }
                  />
                  {/* NO BIAS SEGMENT (ADR 0216). The prototype draws
                      `Off | Light | Standard` here and the owner removed it on
                      2026-08-17, on the rule that a fixed setting nobody needs
                      an opinion about should work rather than be offered.

                      **`bias_mode` is a live switch and not a decided
                      question**, which is the opposite of what a first pass at
                      this comment claimed: `core::transcription_hints` reads it
                      for three behaviours — `Off` suppresses the cloud and local
                      prompts entirely, `Conservative` sends the profile's hints,
                      `Manual` substitutes a typed override. What is true is that
                      **nothing has ever written it**, so every installation runs
                      the `Conservative` default and this segment drew a three-way
                      choice over a switch pinned to the middle. Removing it is a
                      deletion rather than a `PreviewTag` because the owner ruled
                      the choice unwanted, not merely unbuilt.

                      The pin itself — an unwritten switch with two unreachable
                      arms, and a health flag that guards one of them and can
                      therefore never fire — is speech-track B21. */}
                </LaneJobRow>

                <LaneJobRow
                  lane={lane}
                  jobKey="meetings"
                  cap="stt"
                  name="Meetings"
                  what="An hour of several voices, with nothing waiting on the result."
                  hint="Long and many voices, so it can run somewhere else than a dictation does."
                >
                  <Row
                    label="Speakers"
                    hint="Who said what, re-clustered when the meeting ends. Costs a pass over the recording."
                    control={<InertToggle label="Speakers" on />}
                  />
                  <Row
                    label="Live transcript"
                    hint="Text arrives while you are still talking."
                    control={<InertToggle label="Live transcript" on />}
                  />
                  <Row
                    label="What a meeting records"
                    hint="Microphone, system audio and echo cancellation are set in Notes & Meetings."
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
                  hint="Runs inside the dictation, so speed decides the model here."
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
                    <Note
                      icon="profiles"
                      tail={
                        open && (
                          <DocLink onClick={() => open({ view: "profiles" })}>
                            Open Profiles
                          </DocLink>
                        )
                      }
                    >
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
                  hint="Overridden: a better model shows here first, and nothing is waiting on it."
                >
                  <TranslateJobSettings />
                </LaneJobRow>

                <LaneJobRow
                  lane={lane}
                  jobKey="enhance"
                  name="Prompt Enhance"
                  what="Structures raw dictation into a well-formed prompt for an external AI tool."
                />
                {/* NO SUB-MODE AND NO PROMPT TARGET. Both are drawn by the
                    prototype and both were removed on 2026-08-17, on the owner's
                    rule that a fixed setting the reader has no reason to hold an
                    opinion about should work rather than be offered.

                    `enhance_sub_mode` and `enhance_target` keep their defaults
                    and their readers; what goes is the pair of controls over
                    them, which nothing wrote — they were stored in TWO places
                    (`AppConfig` and the profile's work mode) with no writer for
                    either, and this file used to cite them as the precedent its
                    two live Translate controls follow. The row now opens onto
                    the account and model rows alone, like Cleanup and Rewrite. */}

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
                  hint="Overridden: it writes from scratch and reads your material, and nothing is waiting on it."
                  extra={
                    <Note
                      icon="agents"
                      tail={
                        open && (
                          <DocLink onClick={() => open({ section: "agents" })}>Open Agents</DocLink>
                        )
                      }
                    >
                      Not the coding agents. Those are started by {DESK}, they write code, and they
                      speak to you through the agent overlay — a different thing that only shares a
                      word.
                    </Note>
                  }
                >
                  <AgentNameRow />
                  <Row
                    label="May read your notes and transcripts"
                    hint="Read-only, inside the notes directory, and it cites what it used."
                    control={<InertToggle label="May read your notes and transcripts" on />}
                  />
                  <Row
                    label="When it looks"
                    hint="Looks only when the dictation points at something. Always is right for Ask, wrong in a dictation."
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
                  what="How a coding agent asks you out loud, and how your answer gets back."
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
                        hint="Targets, the answer budget and the notification live on the Agents screen."
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
                  why="No model runs over the text. WordScript's own repairs and the profile's text rules still do, as on every mode."
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
function MachineTab({
  setup,
  asked,
}: {
  /** Read by `ModelsScreen` for the whole screen since B12, because the
   *  connection card states the same thing one tab over and the probe spawns a
   *  process. Passed in rather than read here — a second `useLocalSetup` would
   *  be a second probe of one disk. */
  setup: LocalProviderSetupStatus | null;
  asked: boolean;
}) {
  const wired = useWired();
  return wired ? <WiredMachineTab setup={setup} asked={asked} /> : <DrawnMachineTab />;
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
 *
 * **And `local_setup` arrives the same way now, from one level further up**
 * (B12). It used to be read here; the connection card on the other tab states
 * the same disk, so the read moved to `ModelsScreen` and both tabs share it.
 */
function WiredMachineTab({
  setup,
  asked,
}: {
  setup: LocalProviderSetupStatus | null;
  asked: boolean;
}) {
  const library = useModelLibrary();

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
     drawn `Use` button was always for. A gallery render never reaches here.

     A LANGUAGE MODEL IS BOTH CHAT JOBS, and writing only one of them was a
     silent hole (ADR 0207): the correction moved to the model you picked and
     the agent — the transcript title, the Auto classifier, Agent mode — stayed
     on the catalogue's `llama3.2:latest`. On a machine that pulled something
     else the title call then asked for a model that is not there, and its
     fallback is the same first-words filename a model that simply declined
     would produce, so nothing on the screen ever said so. One button, one
     lane's chat work; the two fields stay separate for the day a surface
     offers them separately. */
  const useModel = (row: ManagedModelRow) => {
    if (!runtime) return;
    const tag = pullTagOf(row) ?? row.model_id;
    runtime.patch(
      buildProfileSpeechPatch(
        runtime.config,
        row.role === "speech"
          ? { local_model: localStemOf(row) }
          : { local_correction_model: tag, local_agent_model: tag },
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
