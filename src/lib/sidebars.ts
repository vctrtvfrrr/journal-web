import { useEffect, useRef } from "react";
import type { SideColumn } from "../modules/registry";
import { useStoredSet } from "./stored-state";

export const SIDES = ["left", "right"] as const satisfies readonly SideColumn[];

export function useSidebars() {
  const [hidden, setHidden] = useStoredSet("journal-collapsed:columns");
  const isOpen = (side: SideColumn) => !hidden.has(side);
  const setOpen = (side: SideColumn, open: boolean) => setHidden(side, !open);
  const toggle = (side: SideColumn) => setOpen(side, !isOpen(side));
  useSidebarShortcuts(toggle);
  return { isOpen, setOpen, toggle };
}

export type Sidebars = ReturnType<typeof useSidebars>;

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function useSidebarShortcuts(toggle: (side: SideColumn) => void) {
  const latest = useRef(toggle);
  latest.current = toggle;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || !(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey || isEditable(event.target)) return;
      event.preventDefault();
      latest.current(event.altKey ? "right" : "left");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
