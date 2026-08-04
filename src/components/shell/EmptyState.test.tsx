import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders one line", () => {
    const { container } = render(<EmptyState>No transcriptions yet.</EmptyState>);

    expect(screen.getByText("No transcriptions yet.")).toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders the one action it is given", () => {
    render(
      <EmptyState action={<button type="button">Press Ctrl+Super to start</button>}>
        No transcriptions yet.
      </EmptyState>,
    );

    expect(
      screen.getByRole("button", { name: "Press Ctrl+Super to start" }),
    ).toBeInTheDocument();
  });

  it("renders without an action", () => {
    render(<EmptyState>No transcriptions yet.</EmptyState>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("carries no inline spacing value", () => {
    const { container } = render(
      <EmptyState action={<button type="button">Start</button>}>Nothing yet.</EmptyState>,
    );

    for (const node of container.querySelectorAll<HTMLElement>("[style]")) {
      expect(node.getAttribute("style")).toBe("");
    }
  });
});
