import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createNoteMutation, listNotesQueryKey } from "../api/generated/@tanstack/react-query.gen";

export function timelineQueryKey(notebook: string) {
  return listNotesQueryKey({ query: { notebook } });
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
