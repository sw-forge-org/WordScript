import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaneCard, type LaneOption } from "./LaneCard";

afterEach(cleanup);

const OPTIONS: LaneOption[] = [
  { id: "cloud", name: "Groq cloud", description: "Bring your own key. Fastest lane." },
  { id: "local", name: "Local", description: "whisper-cli and Ollama on this machine." },
  { id: "hosted", name: "Self-hosted", description: "A server you run.", disabled: true },
];

describe("LaneCard", () => {
  it("is a radiogroup whose selected row is the only checked one", () => {
    render(<LaneCard options={OPTIONS} value="cloud" onChange={vi.fn()} label="Lane" />);

    expect(screen.getByRole("radiogroup", { name: "Lane" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Groq cloud/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Local/ })).not.toBeChecked();
  });

  it("selects a lane on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LaneCard options={OPTIONS} value="cloud" onChange={onChange} label="Lane" />);

    await user.click(screen.getByRole("radio", { name: /Local/ }));

    expect(onChange).toHaveBeenCalledWith("local");
  });

  /* A radiogroup is arrow-navigated and the arrows move the SELECTION, which is
     what distinguishes it from a list of buttons. */
  it("moves the selection with the arrow keys, skipping a disabled lane", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LaneCard options={OPTIONS} value="local" onChange={onChange} label="Lane" />);

    screen.getByRole("radio", { name: /Local/ }).focus();
    await user.keyboard("{ArrowDown}");

    expect(onChange).toHaveBeenCalledWith("cloud");
  });

  /* Roving tabindex: one stop for the whole group, not one per option. */
  it("puts the tab stop on the selected row only", () => {
    render(<LaneCard options={OPTIONS} value="local" onChange={vi.fn()} label="Lane" />);

    expect(screen.getByRole("radio", { name: /Local/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /Groq cloud/ })).toHaveAttribute("tabindex", "-1");
  });

  it("marks the selected lane and carries a plan badge on an option that has one", () => {
    render(
      <LaneCard
        options={[{ id: "cloud", name: "Groq cloud", badge: "Phase 4" }]}
        value="cloud"
        onChange={vi.fn()}
        label="Lane"
      />,
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Phase 4")).toBeInTheDocument();
  });

  /* A surface that already says which lane is running must be able to drop the
     second statement — a permanently present mark is furniture (§11.12). */
  it("drops the active mark when the surface already states it", () => {
    render(
      <LaneCard
        options={OPTIONS}
        value="cloud"
        onChange={vi.fn()}
        label="Lane"
        activeBadge={null}
      />,
    );

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("carries no inline spacing value", () => {
    const { container } = render(
      <LaneCard options={OPTIONS} value="cloud" onChange={vi.fn()} label="Lane" />,
    );

    for (const node of container.querySelectorAll<HTMLElement>("[style]")) {
      expect(node.getAttribute("style")).toBe("");
    }
  });
});
