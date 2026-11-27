import type { ReactNode } from "react";
import * as agenda from "./demo/agenda";
import * as finance from "./demo/finance";
import * as rhythms from "./demo/rhythms";
import * as weather from "./demo/weather";

export type ModuleId = "weather" | "agenda" | "finance" | "rhythms";
export type SideColumn = "left" | "right";

export type DashboardModule = {
  id: ModuleId;
  title: string;
  column: SideColumn;
  demo: boolean;
  Widget: () => ReactNode;
  Page: () => ReactNode;
};

export const MODULES: readonly DashboardModule[] = [
  { id: "weather", title: "Weather", column: "left", demo: true, ...weather },
  { id: "agenda", title: "Agenda", column: "left", demo: true, ...agenda },
  { id: "finance", title: "Finance", column: "right", demo: true, ...finance },
  { id: "rhythms", title: "Rhythms", column: "right", demo: true, ...rhythms },
];

export function modulesIn(column: SideColumn) {
  return MODULES.filter((module) => module.column === column);
}
