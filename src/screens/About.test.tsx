import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import userEvent from "@testing-library/user-event";
import { AboutScreen } from "./About";
import { createWorkspaceRuntime } from "@/test/factories";
import type { AppUpdateStatus } from "@/types/updates";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

const invoked = vi.mocked(invoke);
const opened = vi.mocked(openUrl);

/**
 * WHAT A WIRED SCREEN'S TEST IS FOR, and it is not the same job as
 * `screens.test.tsx`.
 *
 * A gallery screen's test holds that the drawing is the prototype's, because
 * the measurement would accept a copy change that moved on both sides. A wired
 * screen has left the gallery (ADR 0057) and there is no measurement any more,
 * so what its test holds instead is the thing the measurement never could:
 * WHICH facts come from the runtime, and that the ones that do not are visibly
 * absent rather than invented (rule 7).
 */

function status(overrides: Partial<AppUpdateStatus> = {}): AppUpdateStatus {
  return {
    current_version: "0.2.2-alpha",
    status: "release_path_building",
    /* `core::updates`'s own string for this state, verbatim. It is 43
       characters because the row that draws it holds about 57 beside a badge
       and a button — the clause it used to carry about the release path not
       being ready is on the section header now, where it is stated once and has
       the card's full width (ADR 0092). A mock that keeps the old string is a
       test asserting copy the runtime no longer produces. */
    summary: "No published WordScript release exists yet.",
    release_version: null,
    release_url: null,
    release_notes: null,
    checked_at_ms: 1_770_000_000_000,
    build_targets: [
      { platform: "macOS", artifact: "DMG packaging lane", state: "building", note: "" },
      { platform: "Windows", artifact: "NSIS installer lane", state: "building", note: "" },
      { platform: "Linux", artifact: "AppImage and DEB lane", state: "planned", note: "" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  invoked.mockReset();
  opened.mockReset();
  opened.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("About & Updates", () => {
  it("does not ask GitHub for a section nobody opened", () => {
    invoked.mockResolvedValue(status());
    render(<AboutScreen runtime={createWorkspaceRuntime({ active: false })} />);
    expect(invoked).not.toHaveBeenCalled();
    // And BOTH rows that would otherwise state a release fact say they have not
    // asked, rather than showing a state nobody read.
    expect(screen.getAllByText("Not checked")).toHaveLength(2);
    expect(screen.getByText("Not checked yet.")).toBeInTheDocument();
  });

  it("states the release path in the runtime's own words", async () => {
    invoked.mockResolvedValue(status());
    render(<AboutScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("check_app_update"));
    expect(await screen.findByText("In progress")).toBeInTheDocument();
    expect(screen.getByText(/No published WordScript release exists yet/)).toBeInTheDocument();
    /* And the standing half of what the summary used to say is on the section
       header, once, rather than repeated by all five summaries (ADR 0092). */
    expect(
      screen.getByText("Still being assembled, so a check is workflow diagnostics."),
    ).toBeInTheDocument();
    /* The drawing's own hint said the same thing as a literal. It is the
       runtime's sentence now, so a published release changes this row without
       anybody editing it. */
    expect(screen.queryByText(/the cross-platform release path is still being assembled/)).toBeNull();
  });

  it("says a failed check failed rather than falling back to the drawing", async () => {
    invoked.mockRejectedValue(new Error("no network"));
    render(<AboutScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("Check failed")).toBeInTheDocument();
    expect(screen.getByText(/The release check could not run: no network/)).toBeInTheDocument();
  });

  it("reports the least advanced build lane, because one published lane is not a release", async () => {
    invoked.mockResolvedValue(status());
    render(<AboutScreen runtime={createWorkspaceRuntime({ active: true })} />);
    // macOS and Windows are `building`, Linux is `planned`.
    expect(await screen.findByText("Planned")).toBeInTheDocument();
  });

  it("takes the version from the running binary once it has answered", async () => {
    invoked.mockResolvedValue(status({ current_version: "9.9.9-test" }));
    render(<AboutScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(await screen.findByText("9.9.9-test")).toBeInTheDocument();
  });

  it("separates not-yet from never", () => {
    invoked.mockResolvedValue(status());
    render(<AboutScreen runtime={createWorkspaceRuntime()} />);
    /* "not built yet" and "not going to be built" are not the same answer, and
       only the second belongs in a list read to decide whether to keep
       waiting. Neither is a runtime state: a row saying a thing does not exist
       cannot claim a readiness. */
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("carries no stat tile — a version string is not a metric", () => {
    invoked.mockResolvedValue(status());
    const { container } = render(<AboutScreen runtime={createWorkspaceRuntime()} />);
    expect(container.querySelector(".ws-stats")).toBeNull();
  });

  it("opens the four project links for real", async () => {
    invoked.mockResolvedValue(status());
    render(<AboutScreen runtime={createWorkspaceRuntime()} />);

    const opens = screen.getAllByRole("button", { name: "Open" });
    expect(opens).toHaveLength(4);
    await userEvent.click(opens[0]);
    expect(opened).toHaveBeenCalledWith("https://github.com/sw-forge-org/WordScript");
  });
});
