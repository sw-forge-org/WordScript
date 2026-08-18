import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import EditingContextMenu, {
  editableElementFrom,
  itemsFor,
  selectionTextIn,
} from "./EditingContextMenu";

const hosts: HTMLElement[] = [];

afterEach(() => {
  cleanup();
  while (hosts.length) hosts.pop()!.remove();
});

function mountAt(route: string, markup: string) {
  const host = document.createElement("div");
  host.innerHTML = markup;
  document.body.appendChild(host);
  hosts.push(host);
  render(
    <MemoryRouter initialEntries={[route]}>
      <EditingContextMenu />
    </MemoryRouter>
  );
  return host;
}

/** Right-click the way the DOM does, so `defaultPrevented` is observable. */
function rightClick(target: Element): MouseEvent {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 40,
    clientY: 40,
  });
  // React state settles inside `act`, so the menu the handler opens is on the
  // screen by the time the assertion runs.
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("the native context menu", () => {
  it("is suppressed on ordinary chrome, where no menu of our own opens either", () => {
    const host = mountAt("/settings", "<div data-testid='plain'>text</div>");
    const event = rightClick(host.querySelector("[data-testid='plain']")!);

    // Both halves matter: the GTK popup is what holds the keyboard grab, so it
    // has to be refused even where we offer nothing in its place.
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("is suppressed in the overlay WITHOUT a replacement menu", () => {
    // The overlay window is pinned to the pill's size, so a menu drawn inside
    // it would be clipped by the window bounds.
    const host = mountAt("/overlay", "<textarea></textarea>");
    const event = rightClick(host.querySelector("textarea")!);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves a menu that a closer handler already claimed alone", () => {
    const host = mountAt("/settings", "<textarea></textarea>");
    const field = host.querySelector("textarea")!;
    field.addEventListener("contextmenu", (event) => event.preventDefault());

    rightClick(field);

    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("the editing menu", () => {
  it("offers the four editing actions inside a text field", () => {
    const host = mountAt("/settings", "<textarea></textarea>");
    rightClick(host.querySelector("textarea")!);

    expect(screen.getByRole("menu")).toBeTruthy();
    const labels = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(labels).toEqual([
      "CutCtrl+X",
      "CopyCtrl+C",
      "PasteCtrl+V",
      "Select allCtrl+A",
    ]);
  });

  it("does not open on a read-only field, where cut and paste cannot happen", () => {
    const host = mountAt("/settings", "<textarea readonly></textarea>");
    const event = rightClick(host.querySelector("textarea")!);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("what counts as an editable target", () => {
  it("accepts text fields and content-editable regions", () => {
    const host = document.createElement("div");
    host.innerHTML =
      "<input type='text'><textarea></textarea><div contenteditable='true'></div>";
    for (const child of Array.from(host.children)) {
      expect(editableElementFrom(child)).toBe(child);
    }
  });

  it("rejects disabled, read-only and non-text inputs", () => {
    const host = document.createElement("div");
    host.innerHTML =
      "<input type='text' disabled><input type='text' readonly><input type='checkbox'><input type='number'>";
    for (const child of Array.from(host.children)) {
      expect(editableElementFrom(child)).toBeNull();
    }
  });

  it("finds the field from a node inside it", () => {
    const host = document.createElement("div");
    host.innerHTML = "<div contenteditable='true'><span>inner</span></div>";
    const span = host.querySelector("span")!;
    expect(editableElementFrom(span)).toBe(host.firstElementChild);
  });
});

describe("what the menu offers", () => {
  it("gives a plain selection Copy alone", () => {
    expect(itemsFor(false, "picked").map((item) => item.action)).toEqual(["copy"]);
  });

  it("offers nothing for a plain right-click with no selection", () => {
    expect(itemsFor(false, "")).toEqual([]);
  });

  it("disables Cut and Copy in an empty field but keeps Paste reachable", () => {
    const items = itemsFor(true, "");
    const byAction = Object.fromEntries(items.map((item) => [item.action, item.enabled]));
    expect(byAction.cut).toBe(false);
    expect(byAction.copy).toBe(false);
    expect(byAction.selectAll).toBe(true);
  });
});

describe("reading the selection", () => {
  it("reads a form control's own selection rather than the document's", () => {
    // `window.getSelection()` reports nothing useful inside an `<input>`, which
    // is why the field is asked directly.
    const field = document.createElement("textarea");
    field.value = "hold shift";
    document.body.appendChild(field);
    field.setSelectionRange(5, 10);

    expect(selectionTextIn(field)).toBe("shift");
    field.remove();
  });
});
