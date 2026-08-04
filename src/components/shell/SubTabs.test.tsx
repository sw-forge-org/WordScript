import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubTabs, type SubTabItem } from "./SubTabs";

afterEach(cleanup);

const ITEMS: SubTabItem[] = [
  { id: "defaults", label: "Defaults" },
  { id: "context", label: "Context" },
  { id: "words", label: "Words" },
];

describe("SubTabs", () => {
  it("is a tablist whose selected tab is the only selected one", () => {
    render(<SubTabs items={ITEMS} value="context" onChange={vi.fn()} label="Profile" />);

    expect(screen.getByRole("tablist", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Context" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Defaults" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("switches on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SubTabs items={ITEMS} value="defaults" onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "Words" }));

    expect(onChange).toHaveBeenCalledWith("words");
  });

  it("moves along the row with the arrow keys and wraps", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SubTabs items={ITEMS} value="words" onChange={onChange} />);

    screen.getByRole("tab", { name: "Words" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("defaults");
  });

  /* §11.31: `"|"` renders the dividing rule of §11.30, and the divider is not a
     tab — a tab bar is a claim that its entries are the same kind of thing, and
     a rule that answered to the arrow keys would be one more entry. */
  it('renders "|" as a rule that is neither a tab nor navigable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <SubTabs
        items={[
          { id: "cleanup", label: "Cleanup" },
          { id: "rewrite", label: "Rewrite" },
          "|",
          { id: "notes", label: "Notes" },
        ]}
        value="rewrite"
        onChange={onChange}
      />,
    );

    expect(container.querySelectorAll(".ws-subtabs-rule")).toHaveLength(1);
    expect(screen.getAllByRole("tab")).toHaveLength(3);

    screen.getByRole("tab", { name: "Rewrite" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("notes");
  });

  it("puts the tab stop on the selected tab only", () => {
    render(<SubTabs items={ITEMS} value="context" onChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "Context" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Words" })).toHaveAttribute("tabindex", "-1");
  });

  it("carries no inline spacing value", () => {
    const { container } = render(
      <SubTabs items={ITEMS} value="context" onChange={vi.fn()} />,
    );

    for (const node of container.querySelectorAll<HTMLElement>("[style]")) {
      expect(node.getAttribute("style")).toBe("");
    }
  });
});
