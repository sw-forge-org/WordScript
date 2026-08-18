import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

/*
 * THE NATIVE CONTEXT MENU IS A KEYBOARD GRAB, AND THAT IS WHY IT IS GONE.
 *
 * WebKitGTK opens its own GTK popup on right-click. That popup is an X client
 * window that takes a keyboard grab for as long as it is open, and WordScript
 * hides its overlay rather than closing it — so the popup outlives the surface
 * that spawned it and keeps the grab over an invisible window. Measured
 * behaviour, reported by the owner 2026-08-18: right-clicking a WordScript
 * window ends the running dictation, and no new capture can start until the
 * menu is dismissed, while right-clicking any FOREIGN window does neither.
 *
 * Keeping the native menu "only in text fields" keeps the defect in text
 * fields, so the menu is suppressed in every window and this DOM menu replaces
 * it where there is room for one. A div inside the webview holds no grab and
 * cannot outlive its window.
 *
 * The overlay gets suppression WITHOUT a replacement: its window is pinned to
 * the pill's size (min == max), so a menu drawn inside it would be clipped by
 * the window bounds. Ctrl+V still works there — the keyboard path never went
 * through this menu.
 *
 * In a dev build `Ctrl`+right-click passes through to the native menu, so
 * Inspect Element stays reachable. Release builds have no such door, and no
 * inspector to reach either: `wry` only sets `enable_developer_extras` when
 * Tauri asks for devtools, which it does under `debug_assertions`.
 */

/** Input types that carry editable text. `number`, `date` and the button-like
 *  types have their own native editing and no useful selection. */
const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
]);

/** The overlay is the one window that gets suppression and no menu. */
const SUPPRESS_ONLY_ROUTES = ["/overlay"];

type MenuAction = "cut" | "copy" | "paste" | "selectAll";

type MenuItem = {
  action: MenuAction;
  label: string;
  shortcut: string;
  enabled: boolean;
};

type MenuState = {
  x: number;
  y: number;
  target: HTMLElement;
  editable: boolean;
  items: MenuItem[];
};

function clipboardCanRead(): boolean {
  return typeof navigator.clipboard?.readText === "function";
}

function clipboardCanWrite(): boolean {
  return typeof navigator.clipboard?.writeText === "function";
}

/** The editable element the click landed in, or null when there is none. A
 *  disabled or read-only field is not editable: offering Cut and Paste on one
 *  would be offering an action that cannot happen. */
export function editableElementFrom(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const found = node.closest(
    "input, textarea, [contenteditable=''], [contenteditable='true']"
  );
  if (!(found instanceof HTMLElement)) return null;
  if (found instanceof HTMLInputElement) {
    if (found.disabled || found.readOnly) return null;
    if (!TEXT_INPUT_TYPES.has(found.type)) return null;
    return found;
  }
  if (found instanceof HTMLTextAreaElement) {
    return found.disabled || found.readOnly ? null : found;
  }
  return found;
}

/** The selected text, read from the field itself for form controls — a
 *  `window.getSelection()` inside an `<input>` reports nothing useful. */
export function selectionTextIn(element: HTMLElement | null): string {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const { selectionStart, selectionEnd, value } = element;
    if (selectionStart === null || selectionEnd === null) return "";
    return value.slice(selectionStart, selectionEnd);
  }
  return window.getSelection()?.toString() ?? "";
}

/** What the menu offers for one right-click. An empty list means no menu:
 *  a right-click on ordinary chrome with nothing selected has nothing to say. */
export function itemsFor(editable: boolean, selection: string): MenuItem[] {
  const hasSelection = selection.length > 0;
  if (!editable) {
    if (!hasSelection) return [];
    return [
      { action: "copy", label: "Copy", shortcut: "Ctrl+C", enabled: clipboardCanWrite() },
    ];
  }
  return [
    { action: "cut", label: "Cut", shortcut: "Ctrl+X", enabled: hasSelection && clipboardCanWrite() },
    { action: "copy", label: "Copy", shortcut: "Ctrl+C", enabled: hasSelection && clipboardCanWrite() },
    { action: "paste", label: "Paste", shortcut: "Ctrl+V", enabled: clipboardCanRead() },
    { action: "selectAll", label: "Select all", shortcut: "Ctrl+A", enabled: true },
  ];
}

/*
 * `execCommand` rather than assigning `.value`: it drives the browser's own
 * editing pipeline, so a controlled React input receives a real `input` event
 * and the change lands in undo history. Writing `.value` directly does neither
 * — React would not see it and the next render would overwrite it.
 */
async function runAction(action: MenuAction, target: HTMLElement): Promise<void> {
  target.focus();
  switch (action) {
    case "copy": {
      const text = selectionTextIn(target);
      if (text) await navigator.clipboard.writeText(text);
      return;
    }
    case "cut": {
      const text = selectionTextIn(target);
      if (!text) return;
      await navigator.clipboard.writeText(text);
      document.execCommand("delete");
      return;
    }
    case "paste": {
      const text = await navigator.clipboard.readText();
      if (text) document.execCommand("insertText", false, text);
      return;
    }
    case "selectAll": {
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        target.select();
      } else {
        document.execCommand("selectAll");
      }
    }
  }
}

/**
 * Suppresses the native context menu in every WordScript window and draws the
 * editing menu in the windows that have room for one. Mounted once per window,
 * from `App`.
 */
export default function EditingContextMenu() {
  const { pathname } = useLocation();
  const suppressOnly = SUPPRESS_ONLY_ROUTES.includes(pathname);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      // A dev build keeps one door to the inspector.
      if (import.meta.env.DEV && event.ctrlKey) return;
      // Something closer to the click already owns this menu; it has suppressed
      // the native one itself and a second menu would fight it.
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (suppressOnly) return;

      const editableTarget = editableElementFrom(event.target);
      const target =
        editableTarget ??
        (event.target instanceof HTMLElement ? event.target : null);
      if (!target) return;

      const items = itemsFor(editableTarget !== null, selectionTextIn(editableTarget));
      if (items.length === 0) {
        close();
        return;
      }
      setMenu({
        x: event.clientX,
        y: event.clientY,
        target,
        editable: editableTarget !== null,
        items,
      });
    };

    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [close, suppressOnly]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [close, menu]);

  // Keep the panel inside the window. Measured after mount because the width
  // depends on the longest label, which depends on which items are offered.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!menu || !panel) return;
    const rect = panel.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    const x = Math.max(8, Math.min(menu.x, maxX));
    const y = Math.max(8, Math.min(menu.y, maxY));
    if (x !== menu.x || y !== menu.y) setMenu({ ...menu, x, y });
  }, [menu]);

  if (!menu) return null;

  /*
   * Portalled to `document.body` and above every other layer. Both halves were
   * paid for: mounted in the tree it inherits whatever stacking context an
   * ancestor happened to build, and at `z-50` it lost to the command palette's
   * scrim (`.ws-cmdk-scrim`, `z-index: 60`) — the menu rendered correctly and
   * was simply veiled by it. A context menu answers a click the user just made,
   * so it belongs above the toast layer (`z-[100]`) as well.
   */
  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label="Editing actions"
      data-slot="editing-context-menu"
      className={cn(
        "fixed z-[120] min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1",
        "text-popover-foreground shadow-md"
      )}
      style={{ left: menu.x, top: menu.y }}
      // Never let the click that opens an item take focus off the field: the
      // action needs the field's selection, and blurring it would drop it.
      onMouseDown={(event) => event.preventDefault()}
    >
      {menu.items.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          disabled={!item.enabled}
          className={cn(
            "relative flex w-full cursor-default items-center justify-between gap-4",
            "rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
          onClick={() => {
            const { target } = menu;
            close();
            void runAction(item.action, target).catch((error) => {
              // The clipboard can refuse; saying nothing happened is the truth,
              // and inventing a success state would not be.
              console.warn(`[wordscript] context menu ${item.action} failed`, error);
            });
          }}
        >
          <span>{item.label}</span>
          <span className="text-muted-foreground text-xs">{item.shortcut}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}
