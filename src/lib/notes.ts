import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { listNotes } from "../api/generated";
import { createNoteMutation, listNotesQueryKey } from "../api/generated/@tanstack/react-query.gen";
import { nextCursor } from "./timeline";
import type { TimelineFilters } from "./timeline-filters";

export function timelineQueryKey(notebook: string, filters: TimelineFilters = {}) {
  return listNotesQueryKey({ query: { notebook, ...filters } });
}

export function useTimeline(notebook: string, filters: TimelineFilters) {
  return useInfiniteQuery({
    queryKey: timelineQueryKey(notebook, filters),
    queryFn: async ({ pageParam, signal }) => {
      const { data, response } = await listNotes({
        query: { notebook, ...filters, cursor: pageParam },
        signal,
        throwOnError: true,
      });
      return { notes: data, next: nextCursor(response.headers.get("Link")) };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next,
    placeholderData: keepPreviousData,
    meta: { handledByRoute: true },
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createNoteMutation(),
    meta: { showsOwnError: true },
    onSuccess: (note) =>
      queryClient.invalidateQueries({ queryKey: timelineQueryKey(note.notebook_id) }),
  });
}
