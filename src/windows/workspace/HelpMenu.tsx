import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Icon, Menu, NavRow, useNavCollapsed, type MenuEntry } from "@/components/shell";
import {
  APP_DISCORD_URL,
  APP_DOCS_URL,
  APP_PRODUCT_URL,
  APP_REPOSITORY_URL,
} from "@/lib/appMeta";

/**
 * HELP — ADR 0069, which replaced ADR 0066's centred modal with the popover the
 * sidebar already had vocabulary for, and its three links with four.
 *
 * IT OPENS OVER THE ROW THAT OPENS IT rather than in the middle of the window.
 * Help is four addresses; a centred sheet behind a scrim is the weight of a
 * detour you come back from, and reading four link names is not one. `.ws-menu`
 * opens upward from its anchor and was built for exactly this shape — the float
 * bar's menu is the same component under the same rules, which is why this file
 * draws nothing of its own.
 *
 * THE ROW AND THE PANEL ARE ONE COMPONENT, and that is what makes the anchor
 * work: a popover positions against the nearest positioned ancestor, so the
 * thing it opens over has to be inside it. It also puts the outside-press check
 * on the right box — a press on the row is not "outside", so the row toggles
 * instead of closing and reopening in the same gesture.
 *
 * THE FOURTH LINK IS THE PRODUCT SITE. ADR 0066 listed three from memory;
 * `wordscript.dev` was named the same day and is the first address a person
 * looking for help would try.
 *
 * THE DOCUMENTATION IS DRAWN AND INERT, with the reason in its hint (ADR 0065).
 * Leaving it out would teach the reader that WordScript has no documentation;
 * drawing it live would open a 404, which is the broken promise the Help row
 * itself stayed unmounted for three legs to avoid.
 */

const HELP_LINKS: { label: string; hint: string; icon: MenuEntry["icon"]; url: string | null }[] = [
  { label: "Website", hint: "wordscript.dev", icon: "external", url: APP_PRODUCT_URL },
  { label: "Discord", hint: "Ask, report, follow along", icon: "chat", url: APP_DISCORD_URL },
  { label: "GitHub", hint: "Source, issues and releases", icon: "terminal", url: APP_REPOSITORY_URL },
  { label: "Documentation", hint: "No address yet", icon: "file", url: APP_DOCS_URL },
];

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const collapsed = useNavCollapsed();
  /* THE RAIL IS 56 PX AND THE PANEL IS 190, so in that state the panel cannot
     be a box inside the sidebar: `.ws-nav` scrolls, a scrolling box clips both
     axes whatever the other one is declared as, and the reader gets a menu with
     its right half sliced off. Reported against the rail, 2026-08-11.

     It takes the same way out `RowMenu` already takes for the pane's head, and
     for the identical reason the note on `Menu`'s `at` gives: the caller
     measures, the panel places itself at viewport coordinates, and no ancestor
     can clip it. It flies out beside the rail rather than above the row,
     because to the right is where the width is.

     ONLY IN THE RAIL. Expanded, the sidebar is wider than the panel and nothing
     clips it, and an anchored panel is the better one — it moves with its row
     when the sidebar scrolls, which a measured coordinate does not. */
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !collapsed || !anchor.current) {
      setAt(null);
      return;
    }
    const box = anchor.current.getBoundingClientRect();
    setAt({ x: box.right + 8, y: box.bottom });
  }, [open, collapsed]);

  /* A popover closes on the next thing you do, and there are two of those: a
     press somewhere else, and Escape. Both listen in the BUBBLE phase, which is
     what puts them under the command palette's capture listener — while the
     palette is up, the key belongs to the palette and this never sees it. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: MenuEntry[] = HELP_LINKS.map((link) => ({
    label: link.label,
    hint: link.hint,
    icon: link.icon,
    disabled: !link.url,
    onSelect: link.url
      ? () => {
          setOpen(false);
          void openUrl(link.url!).catch((error) =>
            console.error(`opening ${link.url} failed:`, error),
          );
        }
      : undefined,
  }));

  return (
    <div ref={anchor} className="ws-menu-anchor">
      <NavRow
        icon={<Icon name="help" />}
        label="Help"
        current={open}
        onClick={() => setOpen((shown) => !shown)}
      />
      {open && (
        <Menu items={items} align="start" label="Help" at={at ?? undefined} />
      )}
    </div>
  );
}
