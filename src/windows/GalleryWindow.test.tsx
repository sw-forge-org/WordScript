import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GalleryWindow from "./GalleryWindow";

/**
 * The gallery uses NO Tauri API (ADR 0055), so `invoke` is mocked to throw
 * rather than to resolve: a stub that quietly returns would let a call slip in
 * and still pass. This is the assertion, not the setup.
 */
const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(() => {
    throw new Error("The gallery must not call the runtime.");
  }),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: () => {
    throw new Error("The gallery must not listen to runtime events.");
  },
}));

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  cleanup();
  invoke.mockClear();
});

describe("GalleryWindow", () => {
  it("carries the five sections of ADR 0055", () => {
    render(<GalleryWindow />);
    const nav = screen.getByRole("navigation", { name: "Gallery sections" });

    for (const label of ["Foundations", "Components", "Motion", "Overlay", "Screens"]) {
      expect(within(nav).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  /* The section list is the prototype's `SCREENS.ds`, split across three pages.
     A section named here and missing from `demo.js` is the defect Leg 2 exists
     to repair, so the sections are asserted by the prototype's own headings. */
  it("opens on Foundations and carries the Design System screen's sections", () => {
    render(<GalleryWindow />);

    expect(screen.getByRole("heading", { level: 1, name: "Foundations" })).toBeInTheDocument();
    for (const heading of [
      "Surfaces",
      "Text contrast",
      "Type",
      "Spacing",
      "Elevation",
      "Rules this pass added",
      "Radius",
      "Frost",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("switches to Components, which renders the real primitives", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    await user.click(screen.getByRole("button", { name: "Components" }));

    /* The prototype's five cards, by their own titles. */
    for (const card of ["Buttons", "Inputs", "Level", "Status", "New in this plan"]) {
      expect(screen.getByRole("heading", { name: card })).toBeInTheDocument();
    }
    expect(screen.getByRole("radiogroup", { name: "Provider lane" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Design system" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Filters" })).toBeInTheDocument();
  });

  /* Motion is the matrix section, not the old `/component-lab` swatch row. */
  it("switches to Motion, which draws the readout whole", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    await user.click(screen.getByRole("button", { name: "Motion" }));

    expect(screen.getByRole("heading", { name: "The matrix" })).toBeInTheDocument();
    for (const mode of ["Level meter", "Loader", "Wave", "Snake", "Pulse", "Digit zero"]) {
      expect(screen.getByRole("img", { name: mode })).toBeInTheDocument();
    }
  });

  it("reaches Screens, which is the frame Leg 2 fills", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    await user.click(screen.getByRole("button", { name: "Screens" }));

    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByText("Live preview & commit")).toBeInTheDocument();
  });

  /* The scheme switch belongs to the gallery so the three schemes are judged in
     one place. What lands on <html> is always the RESOLVED value (ADR 0048).
     It is a segmented control, which is a group of pressed buttons and not a
     tablist: a segment sets a value and reveals nothing (Leg 2). */
  it("writes the resolved scheme onto the document", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("resolves System rather than writing it", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    await user.click(screen.getByRole("button", { name: "System" }));

    expect(document.documentElement.getAttribute("data-theme")).toMatch(/^(dark|light)$/);
    expect(document.documentElement).not.toHaveAttribute("data-theme", "system");
  });

  it("calls no runtime command on any section", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    for (const label of ["Components", "Motion", "Overlay", "Screens", "Foundations"]) {
      await user.click(screen.getByRole("button", { name: label }));
    }

    expect(invoke).not.toHaveBeenCalled();
  });
});
