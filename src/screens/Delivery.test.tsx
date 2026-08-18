import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { DeliveryScreen } from "./Delivery";
import { createWorkspaceRuntime } from "@/test/factories";
import type { NativeInsertionStatus } from "@/types/nativeInsertion";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invoked = vi.mocked(invoke);

/**
 * WHAT A WIRED SCREEN'S TEST IS FOR. This screen's drawing turned out to be a
 * screenshot of `native_insertion_status`, so what is worth holding is that
 * every row is that command's field and that a driver's mark is the runtime's
 * `available` rather than a literal — including the distinction the screen's
 * own header is about: excluded by decision is not the same as not installed.
 */

function insertionStatus(overrides: Partial<NativeInsertionStatus> = {}): NativeInsertionStatus {
  return {
    config: { auto_paste: true, paste_delay_ms: 40 },
    last_transcript: null,
    scratchpad_entries: [],
    scratchpad_path: "/home/x/.local/state/wordscript/scratchpad.jsonl",
    platform: {
      platform_label: "Linux · X11",
      support_tier: "tier1",
      readiness: "ready",
      readiness_message: "Direct paste available. The previous clipboard is restored after every insert.",
      insert_strategy: "direct_paste",
      active_driver: "xdotool",
      support_message: "",
      driver_chain: [
        {
          driver: "wl_copy",
          label: "wl-copy",
          role: "clipboard",
          available: false,
          active: false,
          detail: "Wayland clipboard. This session is X11, so it is not a candidate.",
        },
        {
          driver: "arboard",
          label: "arboard clipboard",
          role: "clipboard",
          available: true,
          active: true,
          detail: "Cross-platform, always last, always available.",
        },
        {
          driver: "xdotool",
          label: "xdotool",
          role: "paste",
          available: true,
          active: true,
          detail: "Sends ctrl+v. The previous clipboard is restored afterwards.",
        },
        {
          driver: "wtype",
          label: "wtype",
          role: "paste",
          available: false,
          active: false,
          detail: "Excluded by design, not missing.",
        },
        {
          driver: "scratchpad",
          label: "Recovery scratchpad",
          role: "recovery",
          available: true,
          active: false,
          detail: "Where a transcript waits when nothing could place it.",
        },
      ],
      prerequisites: [],
      caveats: ["Wayland: the portal does not grant synthetic input to every compositor."],
      portal_capabilities: null,
      paste_disabled_reason: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "native_insertion_status") return insertionStatus();
    if (command === "clear_native_scratchpad") return insertionStatus();
    return undefined;
  });
});

afterEach(cleanup);

describe("Delivery & Insert", () => {
  it("draws two stages and a fallback, not one chain", async () => {
    const { container } = render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await waitFor(() => expect(invoked).toHaveBeenCalledWith("native_insertion_status"));

    const groups = container.querySelectorAll(".ws-grp");
    expect(groups).toHaveLength(3);
    expect(screen.getByText("1 · Put it on the clipboard")).toBeInTheDocument();
    expect(screen.getByText("2 · Make the target take it")).toBeInTheDocument();
    expect(screen.getByText("When none of it works")).toBeInTheDocument();
  });

  it("states the platform, readiness and strategy the runtime reported", async () => {
    render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(await screen.findByText("Linux · X11")).toBeInTheDocument();
    expect(screen.getByText("tier 1")).toBeInTheDocument();
    expect(screen.getByText("direct_paste · xdotool")).toBeInTheDocument();
    expect(screen.getByText(/Direct paste available/)).toBeInTheDocument();
  });

  it("marks a driver from the runtime's own availability, not from a literal", async () => {
    const { container } = render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Linux · X11");

    const states = new Map(
      [...container.querySelectorAll(".ws-check")].map((check) => [
        check.querySelector(".ws-check-text b")?.textContent,
        check.getAttribute("data-state"),
      ]),
    );
    expect(states.get("arboard clipboard")).toBe("ok");
    expect(states.get("xdotool")).toBe("ok");
    // Unavailable with no reason from the runtime: a package away, not a wall.
    expect(states.get("wl-copy")).toBe("todo");
    expect(states.get("wtype")).toBe("todo");
  });

  it("crosses out a paste driver the runtime ruled out by decision", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command !== "native_insertion_status") return undefined;
      const status = insertionStatus();
      status.platform.paste_disabled_reason =
        "Both trigger a compositor privilege prompt per paste.";
      return status;
    });

    const { container } = render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Linux · X11");

    const wtype = [...container.querySelectorAll(".ws-check")].find(
      (check) => check.querySelector(".ws-check-text b")?.textContent === "wtype",
    )!;
    expect(wtype.getAttribute("data-state")).toBe("fail");
  });

  it("reads the scratchpad's real path and clears it for real", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command !== "native_insertion_status" && command !== "clear_native_scratchpad") return undefined;
      const status = insertionStatus();
      if (command === "native_insertion_status") {
        status.scratchpad_entries = [
          {
            id: "1",
            text: "waiting",
            source: "dictation",
            created_at_ms: 0,
            corrected: false,
            insert_mode: "scratchpad_fallback",
            active_driver: "scratchpad",
            clipboard_written: false,
            paste_attempted: true,
            pasted: false,
            fallback_reason: null,
            error: null,
            recovery_action: "use_scratchpad",
            recovery_message: null,
            clipboard_restore: "not_attempted",
          },
        ];
      }
      return status;
    });

    render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(
      await screen.findByText("/home/x/.local/state/wordscript/scratchpad.jsonl"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 entry")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(invoked).toHaveBeenCalledWith("clear_native_scratchpad");
  });

  it("does not tell the clipboard incident a third time", async () => {
    render(
      <DeliveryScreen runtime={createWorkspaceRuntime({ active: true, open: () => undefined })} />,
    );
    await screen.findByText("Linux · X11");
    /* §11.51: the event is a row on Home and a record in History. A settings
       screen offering the button that clears it is the same fault one screen
       over. */
    expect(screen.queryByText(/Kundenanfrage/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Home" })).toBeInTheDocument();
  });

  it("draws no door when there is nowhere for it to go", async () => {
    // The Diagnostics pop-out is its own window and passes no `open`.
    render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Linux · X11");
    expect(screen.queryByRole("button", { name: "Open Home" })).not.toBeInTheDocument();
    expect(screen.queryByText("Change in profile")).not.toBeInTheDocument();
  });

  it("says which profile the delivery choice belongs to, and what it is", async () => {
    render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(await screen.findByText("General writing delivers")).toBeInTheDocument();
    expect(screen.getByText("Insert at cursor")).toBeInTheDocument();
  });

  /* THE PERMISSION SECTION. It is drawn from `portal_grant`, which is null on
     every machine that has nothing to grant — an X11 session, macOS, Windows, a
     compositor with no RemoteDesktop portal. A row offering a permission that
     does not exist would be the fake affordance rule 7 forbids. */
  it("offers no permission where there is none to give", async () => {
    render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Linux · X11");
    expect(screen.queryByText("Input permission")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grant access" })).not.toBeInTheDocument();
  });

  it("asks for the permission only when the button is pressed", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "native_insertion_status") {
        return insertionStatus({
          portal_grant: {
            phase: "not_granted",
            session_active: false,
            can_request: true,
            compositor: "KDE Plasma 6",
            detail: "Grant it once in Delivery & Insert.",
            refused_at_ms: null,
          },
        });
      }
      if (command === "request_portal_input_grant") {
        return insertionStatus({
          portal_grant: {
            phase: "granted",
            session_active: true,
            can_request: false,
            compositor: "KDE Plasma 6",
            detail: "Insert at cursor can reach native Wayland windows on this desktop.",
            refused_at_ms: null,
          },
        });
      }
      return undefined;
    });

    render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    const button = await screen.findByRole("button", { name: "Grant access" });
    /* Mounting the screen must not have asked for anything: the whole point of
       putting the request here is that it happens on a press. */
    expect(invoked).not.toHaveBeenCalledWith("request_portal_input_grant");

    await userEvent.click(button);
    await waitFor(() => expect(invoked).toHaveBeenCalledWith("request_portal_input_grant"));
    expect(await screen.findByText("Granted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grant access" })).not.toBeInTheDocument();
  });

  /* A refusal is remembered rather than re-asked (ADR 0228, answer 2), so the
     row stays and its label becomes the way back in. A row that disappeared
     would leave somebody who changed their mind with no route at all. */
  it("keeps a way back after a refusal instead of asking again by itself", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "native_insertion_status") {
        return insertionStatus({
          portal_grant: {
            phase: "refused",
            session_active: false,
            can_request: true,
            compositor: "KDE Plasma 6",
            detail: "The desktop refused the input-device permission.",
            refused_at_ms: 1_787_000_000_000,
          },
        });
      }
      return undefined;
    });

    render(<DeliveryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(await screen.findByText("Refused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask again" })).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalledWith("request_portal_input_grant");
  });
});
