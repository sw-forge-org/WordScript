import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SectionHeader } from "./SectionHeader";

afterEach(cleanup);

describe("SectionHeader", () => {
  it("renders the title and its one line", () => {
    render(<SectionHeader title="Recording" description="What a capture may cost." />);

    expect(screen.getByRole("heading", { name: "Recording" })).toBeInTheDocument();
    expect(screen.getByText("What a capture may cost.")).toBeInTheDocument();
  });

  /* The header sits OUTSIDE the card: a group of cards is headed on the window,
     and a single card heads itself. Plan §5.3. */
  it("renders no card surface of its own", () => {
    const { container } = render(<SectionHeader title="Recording" />);

    expect(container.querySelector(".ws-card")).toBeNull();
  });

  /* Given children it renders the section, so the head-to-body rhythm and the
     gap between blocks come from the system rather than from each screen. */
  it("renders the section body when it is given children", () => {
    const { container } = render(
      <SectionHeader title="Recording">
        <div data-testid="block" />
      </SectionHeader>,
    );

    expect(container.querySelector(".ws-sec")).not.toBeNull();
    expect(container.querySelector(".ws-sec-body")).not.toBeNull();
    expect(screen.getByTestId("block")).toBeInTheDocument();
  });

  it("renders the head alone when it is given none", () => {
    const { container } = render(<SectionHeader title="Recording" />);

    expect(container.querySelector(".ws-sec-body")).toBeNull();
  });

  it("carries a section action beside the title", () => {
    render(<SectionHeader title="History" action={<span>128 entries</span>} />);

    expect(screen.getByText("128 entries")).toBeInTheDocument();
  });

  it("carries no inline spacing value", () => {
    const { container } = render(
      <SectionHeader title="Recording" description="One line.">
        <div />
      </SectionHeader>,
    );

    for (const node of container.querySelectorAll<HTMLElement>("[style]")) {
      expect(node.getAttribute("style")).toBe("");
    }
  });
});
