import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PreviewBanner } from "./PreviewBanner";

afterEach(cleanup);

describe("PreviewBanner", () => {
  it("is a chip and one line", () => {
    const { container } = render(<PreviewBanner>Planned: Phase 8.</PreviewBanner>);

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Planned: Phase 8.")).toBeInTheDocument();
    expect(container.querySelectorAll(".ws-banner-text")).toHaveLength(1);
  });

  /* §11.47: the strip carries no box and no border. The chip already says the
     status, and a dashed rule around a single line reads as an unfinished
     control rather than as a caveat. */
  it("carries no box in the preview tone", () => {
    const { container } = render(<PreviewBanner>Planned: Phase 8.</PreviewBanner>);

    expect(container.querySelector(".ws-banner")).not.toHaveAttribute("data-tone");
  });

  /* A withdrawn screen is not a preview of anything. It keeps its box and its
     border, because a stop is exactly the case that has to interrupt (§11.15). */
  it("keeps its box and names itself a stop when withdrawn", () => {
    const { container } = render(
      <PreviewBanner tone="withdrawn">
        Withdrawn 2026-08-03. It duplicates Diagnostics. Do not build Phase 3 from it.
      </PreviewBanner>,
    );

    expect(container.querySelector(".ws-banner")).toHaveAttribute(
      "data-tone",
      "withdrawn",
    );
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
  });

  it("takes a lead of its own where the default word is not the one meant", () => {
    render(<PreviewBanner lead="Sample">Nothing here is measured.</PreviewBanner>);

    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  it("carries no inline spacing value", () => {
    const { container } = render(<PreviewBanner>Planned: Phase 8.</PreviewBanner>);

    for (const node of container.querySelectorAll<HTMLElement>("[style]")) {
      expect(node.getAttribute("style")).toBe("");
    }
  });
});
