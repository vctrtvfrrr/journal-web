import { useMatches } from "@tanstack/react-router";
import { MODULES } from "./registry";

export function useActiveModule() {
  const moduleId = useMatches({
    select: (matches) => matches.find((match) => match.staticData.moduleId)?.staticData.moduleId,
  });
  return MODULES.find((module) => module.id === moduleId);
}
