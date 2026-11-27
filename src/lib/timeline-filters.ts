import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ListNotesData, PartialDateBound } from "../api/generated";
import { zListNotesQuery, zPartialDateBound } from "../api/generated/zod.gen";

export type TimelineFilters = Pick<ListNotesData["query"], "q" | "from" | "to">;
type TimelineSearch = TimelineFilters & { anchor?: PartialDateBound };

const FILTER_KEYS = ["q", "from", "to"] as const;
export const NO_FILTERS: TimelineFilters = { q: undefined, from: undefined, to: undefined };
export const TIMELINE_SEARCH_KEYS = [...FILTER_KEYS, "anchor"] as const;

const searchSchemas = { ...zListNotesQuery.shape, anchor: zPartialDateBound.optional() };

export function validateTimelineSearch(search: Record<string, unknown>): TimelineSearch {
  const valid: TimelineSearch = {};
  for (const key of TIMELINE_SEARCH_KEYS) {
    // The router turns `from=2025` into the number 2025, so every value goes back to a string.
    const parsed = searchSchemas[key].safeParse(
      search[key] === undefined ? undefined : String(search[key]),
    );
    if (parsed.success && parsed.data !== undefined) valid[key] = parsed.data;
  }
  return valid;
}

export function isFiltering(filters: TimelineFilters) {
  return FILTER_KEYS.some((key) => filters[key] !== undefined);
}

function useTimelineSearch() {
  const search = useSearch({ from: "/home" });
  const navigate = useNavigate();
  const changeSearch = (changes: TimelineSearch) =>
    void navigate({
      to: ".",
      search: (current) => ({ ...current, ...changes }),
      replace: true,
    });
  return [search, changeSearch] as const;
}

export function useTimelineFilters() {
  const [{ anchor: _, ...filters }, changeSearch] = useTimelineSearch();
  const applyFilters = (changes: TimelineFilters) =>
    changeSearch({ ...changes, anchor: undefined });
  return [filters, applyFilters] as const;
}

export function useTimelineAnchor() {
  const [{ anchor }, changeSearch] = useTimelineSearch();
  const moveAnchor = (date: PartialDateBound | undefined) => changeSearch({ anchor: date });
  return [anchor, moveAnchor] as const;
}
