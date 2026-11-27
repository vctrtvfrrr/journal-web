import type { SideColumn } from "../modules/registry";
import { useStoredSet } from "./stored-state";

export const SIDES = ["left", "right"] as const satisfies readonly SideColumn[];

export function useSidebars() {
  const [hidden, setHidden] = useStoredSet("journal-collapsed:columns");
  const isOpen = (side: SideColumn) => !hidden.has(side);
  const setOpen = (side: SideColumn, open: boolean) => setHidden(side, !open);
  const toggle = (side: SideColumn) => setOpen(side, !isOpen(side));
  return { isOpen, setOpen, toggle };
}

export type Sidebars = ReturnType<typeof useSidebars>;
