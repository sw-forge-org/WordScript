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

  it("opens on Foundations and measures the ladder", () => {
    render(<GalleryWindow />);

    expect(screen.getByRole("heading", { level: 1, name: "Foundations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Surfaces" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Text contrast" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frost" })).toBeInTheDocument();
  });

  it("switches to Components, which renders the real primitives", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    await user.click(screen.getByRole("button", { name: "Components" }));

    expect(screen.getByRole("radiogroup", { name: "Speech lane" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "History filters" })).toBeInTheDocument();
  });

  it("reaches Screens, which is the frame Leg 2 fills", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    await user.click(screen.getByRole("button", { name: "Screens" }));

    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByText("Live preview & commit")).toBeInTheDocument();
  });

  /* The scheme switch belongs to the gallery so the three schemes are judged in
     one place. What lands on <html> is always the RESOLVED value (ADR 0048). */
  it("writes the resolved scheme onto the document", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("tab", { name: "Light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    await user.click(screen.getByRole("tab", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("resolves System rather than writing it", async () => {
    const user = userEvent.setup();
    render(<GalleryWindow />);

    await user.click(screen.getByRole("tab", { name: "System" }));

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
