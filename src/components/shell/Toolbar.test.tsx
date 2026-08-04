import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toolbar, ToolbarSearch } from "./Toolbar";

afterEach(cleanup);

describe("Toolbar", () => {
  it("is a toolbar and puts its filters on one line", () => {
    render(
      <Toolbar label="History filters">
        <ToolbarSearch>
          <input aria-label="Search transcripts" />
        </ToolbarSearch>
        <select aria-label="Status">
          <option>All statuses</option>
        </select>
      </Toolbar>,
    );

    expect(screen.getByRole("toolbar", { name: "History filters" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search transcripts")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  /* Filters are not settings: no card, no labelled rows. The shipped History
     spends a card of three labelled FormRows on what is one line. */
  it("renders no card and no row stack", () => {
    const { container } = render(
      <Toolbar>
        <select aria-label="Status">
          <option>All statuses</option>
        </select>
      </Toolbar>,
    );

    expect(container.querySelector(".ws-card")).toBeNull();
    expect(container.querySelector(".ws-rows")).toBeNull();
  });

  it("pushes the trailing control to the far edge", () => {
    const { container } = render(
      <Toolbar right={<button type="button">Refresh</button>}>
        <input aria-label="Search" />
      </Toolbar>,
    );

    expect(container.querySelector(".ws-toolbar-right")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("carries no inline spacing value", () => {
    const { container } = render(
      <Toolbar right={<button type="button">Refresh</button>}>
        <ToolbarSearch>
          <input aria-label="Search" />
        </ToolbarSearch>
      </Toolbar>,
    );

    for (const node of container.querySelectorAll<HTMLElement>("[style]")) {
      expect(node.getAttribute("style")).toBe("");
    }
  });
});
