import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card, CardFooter, CardRows, Row } from "./Card";

afterEach(cleanup);

/**
 * These assertions are structural rather than visual, and deliberately so: the
 * card's inset rule is a CSS guard on the card's own children
 * (`.ws-card > :not(.ws-rows)…`), so what a component test can hold true is
 * that the structure the guard selects on is the structure the component
 * builds. A row stack must be a DIRECT child of the card, or the separator
 * never reaches the group's edge and the guard silently pads it instead.
 */
describe("Card", () => {
  it("renders the card surface with its head inside it", () => {
    const { container } = render(
      <Card title="Recording" description="What a capture may cost.">
        <CardRows>
          <Row label="Auto-stop" control={<button type="button">5 min</button>} />
        </CardRows>
      </Card>,
    );

    const card = container.querySelector(".ws-card") as HTMLElement;
    expect(card.querySelector(".ws-card-head h3")).toHaveTextContent("Recording");
    expect(card.querySelector(".ws-card-head p")).toHaveTextContent(
      "What a capture may cost.",
    );
  });

  /* ADR 0052: the stack spans the card so its hairlines reach both edges, and
     the ITEM pays the inset. The guard in shell.css exempts the stack by class
     and only reaches direct children, so the stack has to be one. */
  it("makes the row stack a direct child of the card", () => {
    const { container } = render(
      <Card>
        <CardRows>
          <Row label="Auto-stop" />
        </CardRows>
      </Card>,
    );

    const card = container.querySelector(".ws-card") as HTMLElement;
    expect(card.querySelector(":scope > .ws-rows")).not.toBeNull();
    expect(card.querySelector(":scope > .ws-rows > .ws-row")).not.toBeNull();
  });

  /* THE ACTION ON A CARD SITS AT ITS FOOT, AS A COMPONENT — not as a flex row
     with a padding guessed per screen (§11.17). */
  it("renders the action it is given as the card's foot", () => {
    const { container } = render(
      <Card footer={<button type="button">Add a profile</button>}>
        <CardRows>
          <Row label="General writing" />
        </CardRows>
      </Card>,
    );

    const card = container.querySelector(".ws-card") as HTMLElement;
    const foot = card.querySelector(":scope > .ws-card-foot");
    expect(foot).not.toBeNull();
    expect(foot).toContainElement(screen.getByRole("button", { name: "Add a profile" }));
    expect(card.lastElementChild).toBe(foot);
  });

  it("renders a footer used on its own", () => {
    const { container } = render(
      <Card>
        <CardRows>
          <Row label="General writing" />
        </CardRows>
        <CardFooter>
          <button type="button">Add a profile</button>
        </CardFooter>
      </Card>,
    );

    expect(container.querySelectorAll(".ws-card-foot")).toHaveLength(1);
  });

  /* A stack whose rows carry a ground of their own owns the vertical padding
     too, or the tint reads as a band floating inside the group (ADR 0052). */
  it("marks a tinted stack so the card can give up its vertical inset", () => {
    const { container } = render(
      <Card>
        <CardRows tinted>
          <Row label="A recording is waiting" />
        </CardRows>
      </Card>,
    );

    expect(container.querySelector(".ws-rows")).toHaveAttribute("data-tinted");
  });

  it("leaves an untinted stack unmarked", () => {
    const { container } = render(
      <Card>
        <CardRows>
          <Row label="Auto-stop" />
        </CardRows>
      </Card>,
    );

    expect(container.querySelector(".ws-rows")).not.toHaveAttribute("data-tinted");
  });

  /* Every inset the card draws comes from --pad-card, which the settings sheet
     redeclares at its own scale (§11.22). A hardcoded 20 px cannot be put in a
     sheet, so nothing here may carry one. */
  it("carries no inline spacing value", () => {
    const { container } = render(
      <Card
        title="Recording"
        description="One line."
        footer={<button type="button">Add</button>}
      >
        <CardRows>
          <Row label="Auto-stop" hint="One line." control={<span>5 min</span>} />
        </CardRows>
      </Card>,
    );

    for (const node of container.querySelectorAll<HTMLElement>("[style]")) {
      expect(node.getAttribute("style")).toBe("");
    }
  });
});

describe("Row", () => {
  it("puts the label and its hint in the text column and the control beside it", () => {
    const { container } = render(
      <Row
        label="Auto-stop"
        hint="Ends a capture that has run past its limit."
        control={<button type="button">5 min</button>}
      />,
    );

    expect(container.querySelector(".ws-row-text > b")).toHaveTextContent("Auto-stop");
    expect(container.querySelector(".ws-row-hint")).toHaveTextContent(
      "Ends a capture that has run past its limit.",
    );
    expect(container.querySelector(".ws-row-ctl")).toContainElement(
      screen.getByRole("button", { name: "5 min" }),
    );
  });

  it("stacks the control under the label when it is the row's own content", () => {
    const { container } = render(
      <Row label="Instruction" layout="stack" control={<textarea aria-label="Prompt" />} />,
    );

    expect(container.querySelector(".ws-row")).toHaveAttribute("data-layout", "stack");
  });

  it("renders a row that is only a control", () => {
    const { container } = render(<Row control={<button type="button">Retry</button>} />);

    expect(container.querySelector(".ws-row-text")).toBeNull();
    expect(container.querySelector(".ws-row-ctl")).not.toBeNull();
  });
});
