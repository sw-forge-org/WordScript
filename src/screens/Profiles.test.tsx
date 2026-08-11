import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ProfilesScreen } from "./Profiles";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import type { AppConfig } from "@/types/ipc";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * WHAT A WIRED SCREEN'S TEST IS FOR. Profiles left the gallery in Leg 8
 * (ADR 0057), so nothing above measures it against the drawing any more: this
 * file is which facts come from the runtime, which controls write, and that
 * every control on the screen can act.
 *
 * THE FIVE FIDELITY CASES CAME DOWN FROM `screens.test.tsx` RATHER THAN BEING
 * DROPPED, re-expressed against a runtime — the pane's shape, the flag's place
 * in the head, the two headings Defaults splits into, the legend that sets
 * nothing, the word list as chips. A screen retiring from the gallery is the
 * one commit where those assertions could quietly disappear, so they are here
 * and they say the same things about a real config.
 *
 * It is also the first place `patchText` is called from a screen. The debounce
 * itself is `useConfigDraft.test.tsx`; what is asserted here is that the text
 * field reaches for it and every other control does not.
 */

const BUDGET = {
  provider: "groq",
  ceiling_seconds: 819,
  ceiling_reason: "upload_limit",
  ceiling_detail: "the 25 MiB upload size on your free plan",
  auto_stop_seconds: 600,
  configured_auto_stop_seconds: 600,
  auto_stop_clamped: false,
  safety_margin_seconds: 81,
  recommended_auto_stop_seconds: 738,
  auto_stop_in_margin: false,
};

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  const base = createAppConfig(overrides);
  return {
    ...base,
    text_profiles: [
      {
        ...base.text_profiles[0],
        id: "general",
        label: "General writing",
        prompt: "Tauri desktop runtime",
        dictionary_entries: [{ id: "d1", phrase: "KA", replace_with: "Kundenanfrage" }],
        snippet_entries: [
          { id: "s1", label: "standard closing", trigger: "closing", expansion: "Best regards,\nFelix" },
        ],
        vocabulary_hints: [
          {
            id: "v1",
            phrase: "WebKitGTK",
            use_as_prompt_hint: true,
            origin: "user",
            learned_at_ms: null,
            hit_count: 0,
            observation_count: 0,
          },
        ],
      },
    ],
    active_text_profile_id: "general",
    ...overrides,
  };
}

/* The runtime's answer, and the point of it is that `used_chars` is not the
   length of what was typed: the field below holds a repeated line and a lot of
   loose whitespace, and the budget keeps 22 characters of it. */
const STYLE_ANALYSIS = {
  register: "quick",
  length: "normal",
  instructions: {
    accepted: ["keep it short", "no emoji"],
    dropped: [],
    used_chars: 22,
    max_chars: 400,
  },
  sample: { accepted: [], dropped: [], used_chars: 0, max_chars: 400 },
};

/** THE ONE GESTURE EVERY ROW ACTION STARTS WITH (ADR 0082). Rows answer a
 *  right-click with a compact menu of verbs; the only icons left on a row are
 *  the reorder pair. */
async function rowMenu(rowName: RegExp | string) {
  /* A profile row is a `button`; a rule row is a `div`. Both are "the row",
     which is what the gesture targets, so this resolves the text to whichever
     box carries it. */
  const label = screen.getAllByText(rowName)[0];
  const row = label.closest(".ws-list-item, .ws-pane-row") ?? label;
  await userEvent.pointer({ keys: "[MouseRight]", target: row });
}

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "resolve_capture_budget") return BUDGET;
    if (command === "get_profile_health") {
      return {
        level: "yellow",
        flags: [{ kind: "form_conflict", hint: "The prompt asks for two different address forms." }],
      };
    }
    if (command === "analyze_communication_style") return STYLE_ANALYSIS;
    return undefined;
  });
});

afterEach(cleanup);

/**
 * THE FIVE THAT CAME DOWN FROM `screens.test.tsx` (ADR 0057).
 *
 * They were written against the drawn branch and they are not about the drawn
 * branch: every one of them holds a decision about how this screen is BUILT
 * that a computed-style diff would accept either way, because both sides would
 * have moved together. A pane rather than two cards, the flag in the head
 * rather than in a card on one tab, two headings rather than six equal rows, a
 * legend that sets nothing, a word list as chips. None of that stopped being
 * true when the screen got a runtime.
 */
describe("Profiles, as it is built", () => {
  it("is a pane — one surface, not two cards side by side", () => {
    const { container } = render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />,
    );
    expect(container.querySelector(".ws-pane")).not.toBeNull();
    expect(container.querySelector(".ws-pane-list")).not.toBeNull();
    expect(container.querySelector(".ws-pane-detail")).not.toBeNull();
    /* The list column is not a card. Two cards side by side read as two
       unrelated boxes, which is how the first build of this screen failed. */
    expect(container.querySelector(".ws-pane-list .ws-card")).toBeNull();
  });

  it("carries the health flag in the detail header, visible from all six tabs", async () => {
    const { container } = render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />,
    );
    await screen.findByRole("button", { name: /1 flag/ });
    const head = container.querySelector(".ws-pane-detail-head")!;
    expect(head.querySelector(".ws-flag")).not.toBeNull();
    /* It was a card on Defaults, which made a property of the profile look like
       a property of one tab. */
    expect(container.querySelector(".ws-card .ws-flag")).toBeNull();
  });

  it("splits Defaults into two decisions rather than six equal rows", () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);
    expect(screen.getByRole("heading", { name: "How this profile writes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "When a recording stops" })).toBeInTheDocument();
  });

  /* FIVE ROWS, NOT FOUR, SINCE ADR 0068. Four of them are the four content
     tabs; the fifth is Style, and it is there to state the one scope on this
     screen that is not "every mode" — Rewrite and the assistant. */
  it("draws the tabs as a legend, which sets nothing", () => {
    const { container } = render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />,
    );
    const legend = container.querySelector(".ws-legend")!;
    expect(legend.querySelectorAll(".ws-legend-row")).toHaveLength(5);
    expect(legend.querySelector("input, select, button")).toBeNull();
  });

  it("keeps a word list as chips rather than as rows with hover actions", async () => {
    const { container } = render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Words" }));
    /* Rows with hover actions imply a record with fields; a term has none. */
    expect(container.querySelectorAll(".ws-chip-x")).toHaveLength(1);
    expect(container.querySelector(".ws-list-item")).toBeNull();
  });
});

describe("Profiles, wired", () => {
  it("lists this machine's profiles rather than the drawing's three", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    expect(await screen.findAllByText("General writing")).not.toHaveLength(0);
    expect(screen.queryByText("Customer success replies")).not.toBeInTheDocument();
  });

  it("writes the context textarea through patchText and commits it on blur", async () => {
    const patch = vi.fn();
    const patchText = vi.fn();
    const flushText = vi.fn();
    render(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({ active: true, config: config(), patch, patchText, flushText })}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Context" }));
    const area = screen.getByLabelText("Profile context");
    await userEvent.type(area, "!");

    /* P1: a text field is the one control that must NOT take the instant-save
       path, and it is the only one on this screen that does not. */
    expect(patchText).toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(patchText.mock.calls[0][0].text_profiles[0].prompt).toBe("Tauri desktop runtime!");

    await userEvent.tab();
    expect(flushText).toHaveBeenCalled();
  });

  it("writes every discrete control instantly, including the one you type a word into", async () => {
    const patch = vi.fn();
    const patchText = vi.fn();
    render(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({ active: true, config: config(), patch, patchText })}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Processing mode"), "rewrite");
    expect(patch.mock.calls[0][0].text_profiles[0].work_mode.processing_mode).toBe("rewrite");

    await userEvent.click(screen.getByRole("tab", { name: "Words" }));
    await userEvent.type(screen.getByLabelText("Add a word or name"), "ydotool{Enter}");
    /* Adding a term is one word and one write — discrete, even though it was
       typed into a text field. */
    const last = patch.mock.calls[patch.mock.calls.length - 1][0];
    expect(last.text_profiles[0].vocabulary_hints.map((h: { phrase: string }) => h.phrase)).toEqual([
      "WebKitGTK",
      "ydotool",
    ]);
    expect(patchText).not.toHaveBeenCalled();
  });

  it("states the runtime's ceiling and headroom, not the drawing's 13:39", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("resolve_capture_budget"));
    expect(
      await screen.findByText("13:39 — the 25 MiB upload size on your free plan. Past it, nothing transcribes."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("At this length. Up to 12:18 keeps headroom under the ceiling."),
    ).toBeInTheDocument();
  });

  it("says nothing about a ceiling the runtime did not answer with", async () => {
    invoked.mockImplementation(async () => undefined);
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    expect(
      await screen.findByText("The runtime has not answered with a processing limit."),
    ).toBeInTheDocument();
    expect(screen.getByText("Not read")).toBeInTheDocument();
  });

  it("counts the runtime's health flags and carries their sentences on the control", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    const flag = await screen.findByRole("button", { name: /1 flag/ });
    expect(flag).toHaveAttribute("title", "The prompt asks for two different address forms.");
    /* ADR 0085, and the assertion is the opposite of the one it carried for
       four legs: the click has a destination now, so the control acts. */
    expect(flag).not.toBeDisabled();
  });

  /* ADR 0085. The click could not route because the four kinds point at three
     tabs, so it does not route: it opens the list, and each row carries the
     door to the tab that holds ITS cause. */
  it("opens the flags themselves, each with the door to the tab that holds its cause", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "resolve_capture_budget") return BUDGET;
      if (command === "analyze_communication_style") return STYLE_ANALYSIS;
      if (command === "get_profile_health") {
        return {
          level: "red",
          flags: [
            { kind: "form_conflict", hint: "“formal” vs “casual”." },
            { kind: "length_bias", direction: "inflating", entry_count: 3, hint: "3 of 4 expand." },
          ],
        };
      }
      return undefined;
    });
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await userEvent.click(await screen.findByRole("button", { name: /2 flags/ }));

    expect(screen.getByText("Contradictory style instructions")).toBeInTheDocument();
    expect(screen.getByText("“formal” vs “casual”.")).toBeInTheDocument();
    /* The runtime's extra detail on a length bias: the direction and how many
       entries, which is what says whether the heuristic caught the whole list. */
    expect(
      screen.getByText("Replacements that all pull one way — expanding, 3 entries"),
    ).toBeInTheDocument();

    /* Two flags, two different doors — the thing one click on a count could
       never have done. */
    expect(screen.getByRole("button", { name: "Open Context" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open Replacements" }));
    expect(screen.getByRole("tab", { name: "Replacements" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    /* The door closes the panel behind it, because the panel's own rows point
       away from where the reader now is. */
    expect(screen.queryByText("“formal” vs “casual”.")).not.toBeInTheDocument();
  });

  /* `bias_policy_weak` is the one the Leg 7 record got wrong. It reads
     `bias_mode` and `processing_mode`; `bias_mode` has no control anywhere in
     the product, and the processing mode is on Defaults. Words draws the
     effective bias as a READOUT and sets nothing, so a door to it would promise
     a repair it cannot perform. */
  it("sends the bias flag to the tab that can change it, not to the one that displays it", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "resolve_capture_budget") return BUDGET;
      if (command === "analyze_communication_style") return STYLE_ANALYSIS;
      if (command === "get_profile_health") {
        return {
          level: "red",
          flags: [{ kind: "bias_policy_weak", hint: "Bias Mode is Off under an agent mode." }],
        };
      }
      return undefined;
    });
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await userEvent.click(await screen.findByRole("button", { name: /1 flag/ }));
    expect(screen.getByRole("button", { name: "Open Defaults" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Words" })).not.toBeInTheDocument();
  });

  /* The runtime computes `level` from the acknowledged set and nothing drew it,
     so a red profile and an amber one looked identical (ADR 0085). */
  it("carries the runtime's level as the flag's tone rather than restating the count", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);
    expect(await screen.findByRole("button", { name: /1 flag/ })).toHaveAttribute(
      "data-tone",
      "yellow",
    );

    cleanup();
    invoked.mockImplementation(async (command: string) => {
      if (command === "resolve_capture_budget") return BUDGET;
      if (command === "analyze_communication_style") return STYLE_ANALYSIS;
      if (command === "get_profile_health") {
        return { level: "red", flags: [{ kind: "form_conflict", hint: "Two address forms." }] };
      }
      return undefined;
    });
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);
    expect(await screen.findByRole("button", { name: /1 flag/ })).toHaveAttribute("data-tone", "red");
  });

  /* THE WRITE HAS TO COME BACK, AND THIS IS THE CASE THAT PROVES IT. Nothing
     the detectors read changes when a flag is acknowledged — the prompt still
     contradicts itself — so the only thing that can move is `level`, and it
     only moves once the config write returns and the screen re-asks. A spy that
     swallows the patch would leave this test asserting the state before it
     (Leg 7's finding, one layer down). */
  it("acknowledges a flag through the config, and the level follows the write back", async () => {
    const patch = vi.fn();
    const current = config();
    const { rerender } = render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: current, patch })} />,
    );

    await userEvent.click(await screen.findByRole("button", { name: /1 flag/ }));
    await userEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(patch.mock.calls[0][0].profile_health_acknowledged_flags).toEqual({
      general: ["form_conflict"],
    });

    /* The runtime grades it green once it sees the set, and the flag stays in
       the list: it is still true, it just stops colouring the profile. */
    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "resolve_capture_budget") return BUDGET;
      if (command === "analyze_communication_style") return STYLE_ANALYSIS;
      if (command === "get_profile_health") {
        const request = (args as { request: { acknowledged_flags: string[] } }).request;
        return {
          level: request.acknowledged_flags.includes("form_conflict") ? "green" : "yellow",
          flags: [{ kind: "form_conflict", hint: "The prompt asks for two different address forms." }],
        };
      }
      return undefined;
    });
    rerender(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: { ...current, ...patch.mock.calls[0][0] },
          patch,
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 flag/ })).toHaveAttribute("data-tone", "green"),
    );
    expect(await screen.findByRole("button", { name: "Acknowledged" })).toBeInTheDocument();
  });

  /* ADR 0082. The five that could not act now open a panel, and the assertion
     is deliberately the OPPOSITE of the one this test carried through three
     legs: rule 7 runs in both directions, and a control that kept a reason
     after getting its command is the same defect as one that never had it. */
  it("opens a surface for each of the five controls that had none", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    expect(screen.getByRole("button", { name: /New profile/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^More/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Check against a sample/ })).not.toBeDisabled();

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    expect(screen.getByRole("button", { name: "New replacement" })).not.toBeDisabled();
    await rowMenu(/KA/);
    expect(screen.getByRole("menuitem", { name: /Edit/ })).not.toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /Delete/ })).not.toBeDisabled();
    /* And no control on the screen still says an editor is missing. */
    expect(screen.queryByTitle(/No editor is drawn/)).not.toBeInTheDocument();
  });

  it("commits one finished value on Save rather than a keystroke", async () => {
    const patch = vi.fn();
    const patchText = vi.fn();
    render(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({ active: true, config: config(), patch, patchText })}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await rowMenu(/KA/);
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));
    await userEvent.clear(screen.getByLabelText("What gets written"));
    await userEvent.type(screen.getByLabelText("What gets written"), "Kundenanfragen");

    /* The draft lives in the panel: nothing has reached the config yet, which
       is what makes Cancel able to throw it away. */
    expect(patch).not.toHaveBeenCalled();
    expect(patchText).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(patch.mock.calls[0][0].text_profiles[0].dictionary_entries).toEqual([
      { id: "d1", phrase: "KA", replace_with: "Kundenanfragen" },
    ]);
    expect(patchText).not.toHaveBeenCalled();
  });

  it("throws the draft away on Cancel and on Escape", async () => {
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config(), patch })} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await rowMenu(/KA/);
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));
    await userEvent.type(screen.getByLabelText("What you say"), "XX");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(patch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("What you say")).not.toBeInTheDocument();

    await rowMenu(/KA/);
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));
    await userEvent.type(screen.getByLabelText("What you say"), "{Escape}");
    expect(patch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("What you say")).not.toBeInTheDocument();
  });

  it("refuses to save a rule the runtime would skip, and says which half is missing", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await userEvent.click(screen.getByRole("button", { name: "New replacement" }));

    /* `apply_dictionary_entries` skips an entry with an empty half, so saving
       one writes a rule that is drawn in the list and never runs. */
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("title", expect.stringContaining("What you say"));

    await userEvent.type(screen.getByLabelText("What you say"), "hdb");
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "title",
      "What gets written needs a value",
    );
  });

  it("appends a new rule and gives it an id of its own", async () => {
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config(), patch })} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await userEvent.click(screen.getByRole("button", { name: "New replacement" }));
    await userEvent.type(screen.getByLabelText("What you say"), "hdb");
    await userEvent.type(screen.getByLabelText("What gets written"), "Herzliche Grüße");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    const entries = patch.mock.calls[0][0].text_profiles[0].dictionary_entries;
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({ phrase: "hdb", replace_with: "Herzliche Grüße" });
    expect(entries[1].id).not.toBe(entries[0].id);
  });

  /* The runtime folds one rule's output into the next (`transform.rs`), so the
     order is a value — and it was one the surface could neither show nor set. */
  it("moves a rule against the order the runtime applies, and stops at the ends", async () => {
    const patch = vi.fn();
    const two = config();
    two.text_profiles[0].dictionary_entries = [
      { id: "d1", phrase: "KA", replace_with: "Kundenanfrage" },
      { id: "d2", phrase: "WS", replace_with: "WordScript" },
    ];
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: two, patch })} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    const up = screen.getAllByRole("button", { name: "Move replacement up" });
    expect(up[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Move replacement down" })[1]).toBeDisabled();

    await userEvent.click(up[1]);
    expect(
      patch.mock.calls[0][0].text_profiles[0].dictionary_entries.map((e: { id: string }) => e.id),
    ).toEqual(["d2", "d1"]);
  });

  it("keeps Enter for the snippet body and commits it with the modifier", async () => {
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config(), patch })} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Snippets" }));
    await rowMenu(/standard closing/);
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));
    const body = screen.getByLabelText("Expands to");
    await userEvent.clear(body);
    await userEvent.type(body, "one{Enter}two");

    /* A snippet body is the one value here that legitimately holds newlines. */
    expect(patch).not.toHaveBeenCalled();
    expect(body).toHaveValue("one\ntwo");

    await userEvent.type(body, "{Control>}{Enter}{/Control}");
    expect(patch.mock.calls[0][0].text_profiles[0].snippet_entries[0].expansion).toBe("one\ntwo");
  });

  it("creates the profile the New profile control promises", async () => {
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config(), patch })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /New profile/ }));
    expect(patch.mock.calls[0][0].text_profiles).toHaveLength(2);
  });

  /* THE REGRESSION THE NATIVE HOST FOUND AND EVERY MOCK HID. `patch` is a spy
     that does not feed the config back, so `profile.id` never moved and an
     effect keyed on it never fired a second time. In the running app the write
     came back one render later and closed the rename that the same click had
     opened. The test has to return the write. */
  it("keeps the new profile's name field open once the write comes back", async () => {
    const current = config();
    const patch = vi.fn();
    const { rerender } = render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: current, patch })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /New profile/ }));
    const written = patch.mock.calls[0][0];
    rerender(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: { ...current, ...written },
          patch,
        })}
      />,
    );

    expect(screen.getByLabelText("Profile name")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile name")).toHaveValue("New profile");
  });

  it("drops an open draft when another profile is picked", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await rowMenu(/KA/);
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));
    expect(screen.getByLabelText("What you say")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Snippets" }));
    expect(screen.queryByLabelText("What you say")).not.toBeInTheDocument();
  });

  /* ADR 0082, after the owner saw the first build: the actions belong at the
     row, and the header menu was being clipped by the head's own overflow. */
  it("opens the row's actions on a right-click, on the row it was opened on", async () => {
    const two = config();
    two.text_profiles = [
      two.text_profiles[0],
      { ...two.text_profiles[0], id: "support", label: "Support reply" },
    ];
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: two })} />);

    await userEvent.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: /Support reply/ }),
    });

    expect(screen.getByRole("menu", { name: "Actions for Support reply" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Duplicate/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toBeInTheDocument();
  });

  it("asks before it deletes, and states what goes with it", async () => {
    const patch = vi.fn();
    const two = config();
    two.text_profiles = [
      two.text_profiles[0],
      { ...two.text_profiles[0], id: "support", label: "Support reply" },
    ];
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: two, patch })} />);

    await userEvent.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: /Support reply/ }),
    });
    await userEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    /* The menu entry opens the question and nothing else. */
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText("Delete Support reply?")).toBeInTheDocument();
    expect(
      screen.getByText("1 replacements, 1 snippets and 1 words go with it."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete profile" }));
    expect(patch.mock.calls[0][0].text_profiles.map((p: { id: string }) => p.id)).toEqual([
      "general",
    ]);
  });

  it("refuses to delete the last profile, with the reason in the entry", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await userEvent.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("button", { name: /General writing/ }),
    });

    /* Something has to be active, and a config with no profile is a state no
       screen can repair. */
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toBeDisabled();
    expect(screen.getByText("The last profile cannot be deleted")).toBeInTheDocument();
  });

  it("hands the session on when the active profile is the one deleted", async () => {
    const patch = vi.fn();
    const two = config();
    two.text_profiles = [
      two.text_profiles[0],
      { ...two.text_profiles[0], id: "support", label: "Support reply" },
    ];
    two.active_text_profile_id = "general";
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: two, patch })} />);

    await userEvent.pointer({
      keys: "[MouseRight]",
      target: screen.getAllByRole("button", { name: /General writing/ })[0],
    });
    await userEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete profile" }));

    expect(patch.mock.calls[0][0].active_text_profile_id).toBe("support");
  });

  it("puts an analysis warning under the rule that caused it", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "resolve_capture_budget") return BUDGET;
      if (command === "get_profile_health") return { level: "green", flags: [] };
      if (command === "analyze_communication_style") return STYLE_ANALYSIS;
      if (command === "analyze_text_rules") {
        return {
          blocking: false,
          issues: [
            {
              severity: "warning",
              code: "dictionary_snippet_overlap",
              message: "This phrase also triggers a snippet.",
              rule_ids: ["d1"],
            },
          ],
          preview: { input: "", output: "", applied_rules: [] },
          transcription_bias: {
            dictionary_terms: [],
            stt_hints: [],
            ignored_stt_hint_lines: [],
            over_limit_stt_hint_lines: [],
            manual_overrides_applied: [],
            effective_stt_hints_source: "profile terms",
          },
          profile_context: { accepted: [], dropped: [], used_chars: 0, max_chars: 400 },
          vocabulary_repair: { repairable: [], too_short: [], min_chars: 4 },
          dictionary_count: 1,
          snippet_count: 1,
        };
      }
      return undefined;
    });
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await rowMenu(/KA/);
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));

    /* The issue arrives with `rule_ids`, which is what lets it appear under the
       rule instead of in a list that tells you something is wrong elsewhere. */
    expect(await screen.findByText("This phrase also triggers a snippet.")).toBeInTheDocument();
  });

  /* Hidden rather than disabled under another mode, and that is the one place
     ADR 0065 does not apply: a target language under Cleanup is not inert, it
     is irrelevant, and a disabled control claims the first. */
  it("draws no target language under a mode that has none", () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    expect(screen.queryByLabelText("Into")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Keep this profile's words")).not.toBeInTheDocument();
  });

  it("writes the target language and the profile-words switch into the profile", async () => {
    const translating = config();
    translating.text_profiles[0].work_mode = {
      ...translating.text_profiles[0].work_mode!,
      processing_mode: "translate",
    };
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: translating, patch })} />,
    );

    await userEvent.selectOptions(await screen.findByLabelText("Into"), "de");
    expect(patch.mock.calls[0][0].text_profiles[0].modes.translate_target_language).toBe("de");

    await userEvent.click(screen.getByLabelText("Keep this profile's words"));
    const afterToggle = patch.mock.calls[patch.mock.calls.length - 1][0];
    expect(afterToggle.text_profiles[0].modes.translate_keep_profile_words).toBe(false);
  });

  it("shows what the prompt costs rather than what was typed into the field", async () => {
    /* The whole point of the command. What is in the field normalizes down —
       the whitespace collapses and the repeated line goes — and the runtime is
       the only thing that knows by how much. */
    const withStyle = config();
    withStyle.text_profiles[0].modes = {
      ...withStyle.text_profiles[0].modes!,
      communication_register: "quick",
      style_instructions: "  keep   it   short  \nkeep it short\nno emoji",
    };
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: withStyle })} />);

    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("analyze_communication_style", expect.anything()),
    );

    expect(await screen.findByText("22 / 400")).toBeInTheDocument();
    expect(screen.queryByText("42 / 400")).not.toBeInTheDocument();
  });

  /* A RULE USED TO GO ON ONE CLICK WHILE THE PROFILE CONTAINING IT ASKED TWICE.
     That was the sharpest inconsistency on the screen and the owner named it.
     Both are one press plus one confirmation now (ADR 0082). */
  it("asks before it deletes a rule, the same way it asks for a profile", async () => {
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config(), patch })} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await rowMenu(/KA/);
    await userEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText("Delete the replacement for “KA”?")).toBeInTheDocument();
    expect(screen.getByText("It writes “Kundenanfrage” today.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete replacement" }));
    expect(patch.mock.calls[0][0].text_profiles[0].dictionary_entries).toEqual([]);
  });

  it("writes Translate into the profile like any other mode", async () => {
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config(), patch })} />,
    );

    const select = screen.getByLabelText("Processing mode") as HTMLSelectElement;
    const translate = [...select.options].find((option) => option.textContent === "Translate")!;
    expect(translate.disabled).toBe(false);

    await userEvent.selectOptions(select, "translate");
    expect(patch.mock.calls[0][0].text_profiles[0].work_mode.processing_mode).toBe("translate");
  });

  it("marks only the active profile active", async () => {
    const twoProfiles = config();
    twoProfiles.text_profiles = [
      twoProfiles.text_profiles[0],
      { ...twoProfiles.text_profiles[0], id: "support", label: "Support reply" },
    ];
    const runtime = createWorkspaceRuntime({ active: true, config: twoProfiles });
    render(<ProfilesScreen runtime={runtime} />);

    expect(screen.getByText("Active in this session")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Support reply/ }));
    expect(screen.queryByText("Active in this session")).not.toBeInTheDocument();
  });
});

/**
 * THE SIXTH TAB — ADR 0068. The runtime contract was met the whole time and the
 * surface did not exist, so what is asserted here is the seam rather than the
 * feature: the register a profile already holds is READ, both selects take
 * `patch`, both textareas take `patchText`, and the three controls that cannot
 * reach a prompt while the register is Off are inert with the reason on screen.
 *
 * jsdom can see the `disabled` attribute and cannot see whether a reader can
 * tell — Leg 4c's finding 1. `.ws-sel[disabled]` and `.ws-field[disabled]` both
 * have rules in `shell.css`, and the native host is what confirmed it.
 */
describe("Profiles · Style", () => {
  const styled = (register: "off" | "quick") => {
    const base = config();
    base.text_profiles = [
      {
        ...base.text_profiles[0],
        modes: {
          ...base.text_profiles[0].modes!,
          communication_register: register,
          communication_length: "normal",
          style_instructions: register === "quick" ? "no emoji" : "",
          style_sample: "",
        },
      },
    ];
    return base;
  };

  it("shows the register the profile already carries, which nothing could see before", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: styled("quick") })} />);

    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.getByLabelText("Communication register")).toHaveValue("quick");
    expect(screen.getByLabelText("Style rules")).toHaveValue("no emoji");
  });

  it("writes the two selects instantly and the two textareas through patchText", async () => {
    const patch = vi.fn();
    const patchText = vi.fn();
    render(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({ active: true, config: styled("quick"), patch, patchText })}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    await userEvent.selectOptions(screen.getByLabelText("Communication length"), "terse");
    expect(patch.mock.calls[0][0].text_profiles[0].modes.communication_length).toBe("terse");
    expect(patchText).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Writing sample"), "x");
    expect(patchText.mock.calls[0][0].text_profiles[0].modes.style_sample).toBe("x");
  });

  it("keeps the length and both fields inert while the register is Off, with the reason on screen", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: styled("off") })} />);

    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    /* `is_active()` gates the whole block in `core::communication_style`, so
       these three genuinely cannot reach a prompt (ADR 0065). */
    expect(screen.getByLabelText("Communication length")).toBeDisabled();
    expect(screen.getByLabelText("Style rules")).toBeDisabled();
    expect(screen.getByLabelText("Writing sample")).toBeDisabled();
    expect(screen.getByLabelText("Communication register")).not.toBeDisabled();
    expect(screen.getByText(/nothing on this card reaches a prompt/i)).toBeInTheDocument();
  });

  it("states ADR 0023's scope once, on the Legend, rather than on the card", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: styled("off") })} />);

    expect(screen.getByText("Rewrite and the assistant")).toBeInTheDocument();
  });
});
