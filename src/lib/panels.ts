import type { ModuleId } from "../modules/registry";

export const PANELS = [
  "tasks",
  "notes",
  "rhythms",
  "finance",
  "agenda",
  "weather",
] as const satisfies readonly (ModuleId | "tasks" | "notes")[];

export type PanelId = (typeof PANELS)[number];

export function panelNumber(panel: PanelId) {
  return PANELS.indexOf(panel) + 1;
}

export function panelAt(digit: number): PanelId | undefined {
  return PANELS[digit - 1];
}
