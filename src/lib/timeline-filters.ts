import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ListNotesData } from "../api/generated";
import { zListNotesQuery } from "../api/generated/zod.gen";

export type TimelineFilters = Pick<ListNotesData["query"], "q" | "from" | "to">;

export const FILTER_KEYS = ["q", "from", "to"] as const;

export function validateTimelineFilters(search: Record<string, unknown>): TimelineFilters {
  const filters: TimelineFilters = {};
  for (const key of FILTER_KEYS) {
    // The router turns `from=2025` into the number 2025, so every value goes back to a string.
    const parsed = zListNotesQuery.shape[key].safeParse(
      search[key] === undefined ? undefined : String(search[key]),
    );
    if (parsed.success && parsed.data !== undefined) filters[key] = parsed.data;
  }
  return filters;
}

export function isFiltering(filters: TimelineFilters) {
  return FILTER_KEYS.some((key) => filters[key] !== undefined);
}

export function useTimelineFilters() {
  const filters = useSearch({ from: "/home" });
  const navigate = useNavigate();
  const applyFilters = (changes: TimelineFilters) =>
    void navigate({
      to: ".",
      search: (current) => ({ ...current, ...changes }),
      replace: true,
    });
  return [filters, applyFilters] as const;
}
