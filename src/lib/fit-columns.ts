import { useRef, type RefObject } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";
import type { SideColumn } from "../modules/registry";
import { SIDES, type Sidebars } from "./sidebars";

export const SIDEBAR_MIN_WIDTH = 200;
export const CENTER_MIN_WIDTH = 600;

export function defaultSidebarWidth() {
  const width = window.innerWidth;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(width / 4, (width - CENTER_MIN_WIDTH) / 2));
}

// The library shrinks the sidebars one after the other and may collapse one when the window
// narrows. The spec wants them to shrink in proportion, down to their minimum, never close on
// their own, and keep the widths the owner chose for when there is room again.
export function useFitColumns(
  group: RefObject<GroupImperativeHandle | null>,
  element: RefObject<HTMLDivElement | null>,
  sidebars: Sidebars,
) {
  const latest = useRef(sidebars);
  latest.current = sidebars;
  const chosen = useRef<Partial<Record<SideColumn, number>>>({});

  const measure = () => {
    const root = element.current;
    if (!group.current || !root || root.clientWidth === 0) return undefined;
    const separators = [...root.querySelectorAll<HTMLElement>(":scope > [data-separator]")];
    const total = root.clientWidth - separators.reduce((sum, el) => sum + el.offsetWidth, 0);
    const layout = group.current.getLayout();
    const px = (side: SideColumn) => ((layout[side] ?? 0) / 100) * total;
    return { group: group.current, total, layout, px };
  };

  const remember = () => {
    const now = measure();
    if (!now) return;
    for (const side of SIDES) if (now.px(side) > 0) chosen.current[side] = now.px(side);
  };

  const fit = () => {
    const now = measure();
    if (!now) return;
    const width = { left: 0, right: 0 };
    for (const side of SIDES) {
      if (!latest.current.isOpen(side)) continue;
      chosen.current[side] ??= now.px(side) || defaultSidebarWidth();
      width[side] = Math.max(SIDEBAR_MIN_WIDTH, chosen.current[side]);
    }
    const room = now.total - CENTER_MIN_WIDTH;
    const wanted = width.left + width.right;
    if (wanted > room) {
      for (const side of SIDES) {
        if (width[side] > 0)
          width[side] = Math.max(SIDEBAR_MIN_WIDTH, (width[side] * room) / wanted);
      }
    }
    const percent = (px: number) => (px / now.total) * 100;
    const next = {
      left: percent(width.left),
      right: percent(width.right),
      center: 100 - percent(width.left + width.right),
    };
    const changed = (["left", "right", "center"] as const).some(
      (id) => Math.abs((now.layout[id] ?? 0) - next[id]) > 0.1,
    );
    if (changed) now.group.setLayout(next);
  };

  return { fit, remember };
}
