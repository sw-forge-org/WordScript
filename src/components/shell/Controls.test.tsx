import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionStrip,
  Button,
  CheckList,
  Chip,
  Disclosure,
  Field,
  HotkeyButton,
  IconButton,
  Keycaps,
  LevelMeter,
  Note,
  SegmentControl,
  Select,
  Slider,
  Sources,
  Stepper,
  TermChips,
  Toggle,
} from "./index";

/**
 * The controls of `demo.css` §6, ported by Leg 2 of the GUI port relay.
 *
 * Under ADR 0054 there is no coexisting old surface to fall back to, which
 * makes the test obligation stricter than the plan's rather than looser: a
 * control that ships wrong here ships wrong everywhere, because there is only
 * one of it.
 *
 * These assert the STATES the prototype's Components section draws, not the
 * pixels — the pixels live in `shell.css` and were diffed against the running
 * prototype. What a test can hold is that every state exists and is reachable.
 */

afterEach(cleanup);

describe("Button", () => {
  it("carries the prototype's four variants on one class", () => {
    render(
      <>
        <Button>Refresh</Button>
        <Button variant="primary">Capture</Button>
        <Button variant="ghost">Review</Button>
        <Button variant="danger">Reset all settings</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Refresh" })).not.toHaveAttribute("data-v");
    expect(screen.getByRole("button", { name: "Capture" })).toHaveAttribute("data-v", "primary");
    expect(screen.getByRole("button", { name: "Review" })).toHaveAttribute("data-v", "ghost");
    expect(screen.getByRole("button", { name: "Reset all settings" })).toHaveAttribute(
      "data-v",
      "danger",
    );
  });

  /* The label goes transparent and a spinner takes the box, so the button keeps
     its width and nothing beside it moves. The label stays in the accessibility
     tree because the button still says what it is doing. */
  it("keeps its label while busy", () => {
    render(<Button busy>Running check</Button>);
    const button = screen.getByRole("button", { name: "Running check" });
    expect(button).toHaveAttribute("data-busy");
  });

  it("is a button, not a submit — every one of them, everywhere", () => {
    render(<Button>Refresh</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  /* The label is not lost — it is the accessible name AND the tooltip. Only its
     drawing is dropped. */
  it("keeps an icon button's label as its name and its tooltip", () => {
    render(<IconButton label="Show in File Manager" icon={<svg />} />);
    const button = screen.getByRole("button", { name: "Show in File Manager" });
    expect(button).toHaveAttribute("title", "Show in File Manager");
  });
});

describe("Toggle", () => {
  it("is a switch that reports its state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onCheckedChange={onChange} aria-label="Play sounds" />);

    const toggle = screen.getByRole("switch", { name: "Play sounds" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  /* A DISABLED CONTROL MUST NOT WEAR THE ATTENTION COLOUR, and it must not be
     operable either — the accent is dropped in CSS, the click is dropped here. */
  it("does not fire while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked disabled onCheckedChange={onChange} aria-label="Startup sound" />);

    await user.click(screen.getByRole("switch", { name: "Startup sound" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("SegmentControl", () => {
  /* A segment SETS A VALUE and reveals nothing, so it is a group of pressed
     buttons. `.subtabs` is the tablist, because a sub-tab swaps the panel under
     it. The prototype draws the two differently on purpose. */
  it("is a group of pressed buttons, not a tablist", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentControl
        aria-label="Trigger"
        value="Tap"
        onChange={onChange}
        options={[
          { value: "Tap", label: "Tap" },
          { value: "Hold", label: "Hold" },
        ]}
      />,
    );

    expect(screen.getByRole("group", { name: "Trigger" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tap" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Hold" }));
    expect(onChange).toHaveBeenCalledWith("Hold");
  });
});

describe("Stepper", () => {
  /* THE READOUT IS A READOUT. A number with a unit and a small range is a
     stepper, never a text field: the two buttons are the whole affordance. */
  it("has no text field, and disables the button at the end of its range", () => {
    render(<Stepper value={0} min={0} max={60} suffix="Disabled" aria-label="Stop after silence" />);

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase" })).toBeEnabled();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("steps and clamps", async () => {
    const user = userEvent.setup();
    function Host() {
      const [value, setValue] = useState(12);
      return <Stepper value={value} onChange={setValue} min={0} max={13} suffix="s" aria-label="Timeout" />;
    }
    render(<Host />);

    await user.click(screen.getByRole("button", { name: "Increase" }));
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
  });
});

describe("Slider", () => {
  /* The read-out is not decoration: the cue volume multiplies with the OS
     volume, so without a number there is no telling an in-app change from a
     system one. */
  it("carries a native range and prints its value", () => {
    render(<Slider value={70} aria-label="Sound cue volume" />);
    expect(screen.getByRole("slider", { name: "Sound cue volume" })).toHaveValue("70");
    expect(screen.getByText("70%")).toBeInTheDocument();
  });
});

describe("LevelMeter", () => {
  /* THE THRESHOLD MARK IS THE COMPONENT: a capture whose peak never crosses it
     is discarded as empty, so the bar to clear has to be on screen. */
  it("draws the threshold in all three states", () => {
    const { container, rerender } = render(
      <LevelMeter peak={62} hold={74} threshold={34} state="ok" verdict="Good — peak −13 dBFS." />,
    );

    expect(container.querySelector(".ws-level")).toHaveAttribute("data-state", "ok");
    expect(container.querySelector(".ws-level-thr")).toHaveStyle({ left: "34%" });
    expect(screen.getByText("threshold")).toBeInTheDocument();

    for (const state of ["quiet", "hot"] as const) {
      rerender(
        <LevelMeter peak={18} hold={22} threshold={34} state={state} verdict="Too quiet." />,
      );
      expect(container.querySelector(".ws-level")).toHaveAttribute("data-state", state);
    }
  });
});

describe("Keycaps", () => {
  it("splits a combo into caps, and says Set when there is none", () => {
    const { rerender } = render(<HotkeyButton combo="Ctrl+Super" />);
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("Super")).toBeInTheDocument();
    expect(screen.getByText("Change")).toBeInTheDocument();

    rerender(<HotkeyButton combo={null} />);
    expect(screen.getByText("not set")).toBeInTheDocument();
    expect(screen.getByText("Set")).toBeInTheDocument();
  });

  it("renders caps on their own", () => {
    const { container } = render(<Keycaps combo="Ctrl+Shift+V" />);
    expect(container.querySelectorAll("kbd")).toHaveLength(3);
  });
});

describe("Disclosure", () => {
  /* The summary STATES WHAT IS INSIDE, never "Advanced", and the count is what
     is behind the fold. */
  it("is a details element carrying its count", () => {
    render(
      <Disclosure summary="Decoding" count={2}>
        <span>Beam size</span>
      </Disclosure>,
    );

    expect(screen.getByText("Decoding")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(document.querySelector("details.ws-disc")).toBeInTheDocument();
  });
});

describe("CheckList", () => {
  /* A CHECK REPORTS A PROBE. `todo` is a probe that has not run — an empty
     ring, never a tick, because a checkmark beside an argument claims a
     measurement nobody took. */
  it("draws a mark only for a probe that ran", () => {
    const { container } = render(
      <CheckList
        items={[
          { state: "ok", label: "ydotool found", code: "/usr/bin/ydotool" },
          { state: "fail", label: "Socket unreachable" },
          { state: "todo", label: "Not probed yet" },
        ]}
      />,
    );

    const checks = container.querySelectorAll(".ws-check");
    expect(checks).toHaveLength(3);
    expect(checks[0]).toHaveAttribute("data-state", "ok");
    expect(checks[2]).toHaveAttribute("data-state", "todo");
    expect(checks[2].querySelector(".ws-check-mark")?.children).toHaveLength(0);
    expect(screen.getByText("/usr/bin/ydotool")).toBeInTheDocument();
  });
});

describe("The small primitives", () => {
  it("removes a term from the chip list", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <TermChips items={[{ term: "ydotool", origin: "added" }]} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove ydotool" }));
    expect(onRemove).toHaveBeenCalledWith("ydotool");
  });

  /* The origin is a property of the WORD, marked by the chip's border — a chip
     carrying a chip is two objects for one fact. */
  it("marks a learned term on the chip itself", () => {
    const { container } = render(<TermChips items={[{ term: "WordScript", origin: "learned" }]} />);
    expect(container.querySelector(".ws-chip-x")).toHaveAttribute("data-origin", "learned");
  });

  it("draws a plain chip, a note, an action strip and a source list", () => {
    const { container } = render(
      <>
        <Chip>Cleanup</Chip>
        <Note tone="alert">Two cards side by side is not a pane.</Note>
        <ActionStrip icon={<svg />} title="Action strip" actions={<Button>Review</Button>}>
          Home only.
        </ActionStrip>
        <Sources items={["Support reply", "Words & names"]} />
      </>,
    );

    expect(container.querySelector(".ws-chip")).toBeInTheDocument();
    expect(container.querySelector(".ws-note")).toBeInTheDocument();
    /* NO COLOURED EDGE BAR — the strip is a ground plus an icon tile, and the
       tile is the only decoration it is allowed. */
    expect(container.querySelector(".ws-strip > .ws-strip-tile")).toBeInTheDocument();
    expect(container.querySelectorAll(".ws-sources .ws-sep")).toHaveLength(1);
  });

  it("marks an invalid field on the field, not with a ring", () => {
    render(<Field defaultValue="Ctrl+" invalid aria-label="Shortcut" />);
    expect(screen.getByLabelText("Shortcut")).toHaveAttribute("data-invalid");
  });

  /* The pop-up button is sized to its content, so it never spans unless a
     stacked row asks it to. */
  it("spans only when asked", () => {
    const { container, rerender } = render(
      <Select aria-label="Model">
        <option>whisper-large-v3-turbo</option>
      </Select>,
    );
    expect(container.querySelector(".ws-sel")).not.toHaveAttribute("data-wide");

    rerender(
      <Select aria-label="Model" wide>
        <option>whisper-large-v3-turbo</option>
      </Select>,
    );
    expect(container.querySelector(".ws-sel")).toHaveAttribute("data-wide");
  });
});
