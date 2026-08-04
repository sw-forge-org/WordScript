import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Row } from "./Card";
import { ScopeTag } from "./ScopeTag";

afterEach(cleanup);

describe("ScopeTag", () => {
  it("names the profile the value belongs to", () => {
    render(<ScopeTag profile="Support reply" onOpen={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Support reply/ })).toBeInTheDocument();
  });

  /* A surface that does not know which profile is active still has to state
     that the value is not the window's. */
  it("falls back to the general statement", () => {
    render(<ScopeTag />);

    expect(screen.getByText("Per profile")).toBeInTheDocument();
  });

  /* A tag that names an owner and cannot reach it makes the reader go looking
     for what it just told them about (§11.7). */
  it("opens the profile it names", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ScopeTag profile="Support reply" onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: /Support reply/ }));

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("is not a control when there is nothing to open", () => {
    render(<ScopeTag profile="Support reply" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Support reply")).toBeInTheDocument();
  });

  it("sits in a row's control column, between the text and the control", () => {
    const { container } = render(
      <Row
        label="Language"
        hint="What the recognizer expects to hear."
        scope={<ScopeTag profile="Support reply" />}
        control={<button type="button">English</button>}
      />,
    );

    const ctl = container.querySelector(".ws-row-ctl");
    expect(ctl?.firstElementChild).toHaveClass("ws-scope");
  });
});
