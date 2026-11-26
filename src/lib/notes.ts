import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { listNotes } from "../api/generated";
import { createNoteMutation, listNotesQueryKey } from "../api/generated/@tanstack/react-query.gen";
import { linkCursor } from "./timeline";
import type { TimelineFilters } from "./timeline-filters";

export function timelineQueryKey(notebook: string, filters: TimelineFilters = {}) {
  return listNotesQueryKey({ query: { notebook, ...filters } });
}

export function useTimeline(notebook: string, filters: TimelineFilters, anchor?: string) {
  const query = anchor ? { ...filters, to: anchor } : filters;
  return useInfiniteQuery({
    queryKey: timelineQueryKey(notebook, query),
    queryFn: async ({ pageParam, signal }) => {
      const { data, response } = await listNotes({
        query: { notebook, ...query, cursor: pageParam },
        signal,
        throwOnError: true,
      });
      const link = response.headers.get("Link");
      return { notes: data, next: linkCursor(link, "next"), prev: linkCursor(link, "prev") };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next,
    getPreviousPageParam: (page) => (anchor ? page.prev : undefined),
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
