import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listNotes } from "../api/generated";
import { createNoteMutation, listNotesQueryKey } from "../api/generated/@tanstack/react-query.gen";
import { nextCursor } from "./timeline";

export function timelineQueryKey(notebook: string) {
  return listNotesQueryKey({ query: { notebook } });
}

export function useTimeline(notebook: string) {
  return useInfiniteQuery({
    queryKey: timelineQueryKey(notebook),
    queryFn: async ({ pageParam, signal }) => {
      const { data, response } = await listNotes({
        query: { notebook, cursor: pageParam },
        signal,
        throwOnError: true,
      });
      return { notes: data, next: nextCursor(response.headers.get("Link")) };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next,
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
