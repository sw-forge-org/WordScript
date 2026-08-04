import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card, CardRows, Row } from "./Card";
import { DangerRow } from "./DangerRow";

afterEach(cleanup);

describe("DangerRow", () => {
  it("renders the label, the line and the destructive control", () => {
    render(
      <DangerRow
        label="Reset all settings"
        hint="Restores every setting to its default. History and profiles are untouched."
        action={<button type="button">Reset</button>}
      />,
    );

    expect(screen.getByText("Reset all settings")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Restores every setting to its default. History and profiles are untouched.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("marks itself destructive so the tone lands on the label", () => {
    const { container } = render(
      <DangerRow label="Reset all settings" action={<button type="button">Reset</button>} />,
    );

    expect(container.querySelector(".ws-row")).toHaveAttribute("data-danger");
  });

  /* NO COLOURED EDGE BAR, EVER (§11.17). A vertical accent rule down the side
     of a notice reads as a rendering defect at this scale, and this is the
     component most likely to want one. It must also not tint its own ground:
     the row is fine, and it is pressing the button that cannot be undone. */
  it("draws no edge rule and no ground of its own", () => {
    const { container } = render(
      <DangerRow label="Reset all settings" action={<button type="button">Reset</button>} />,
    );
    const row = container.querySelector(".ws-row") as HTMLElement;

    expect(row.className).not.toMatch(/border-l|border-s-|bg-/);
    expect(row.getAttribute("style") ?? "").toBe("");
  });

  /* Last in its card, and the row stack drops the hairline under the last row —
     a line against the group's bottom edge draws a second border a pixel inside
     the first one. */
  it("sits last in its card as the stack's final row", () => {
    const { container } = render(
      <Card title="Danger zone">
        <CardRows>
          <Row label="Export everything" control={<button type="button">Export</button>} />
          <DangerRow
            label="Reset all settings"
            action={<button type="button">Reset</button>}
          />
        </CardRows>
      </Card>,
    );

    const rows = container.querySelectorAll(".ws-rows > .ws-row");
    expect(rows).toHaveLength(2);
    expect(rows[rows.length - 1]).toHaveAttribute("data-danger");
  });
});
