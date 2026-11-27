import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createNotebookMutation,
  listNotebooksOptions,
  listNotebooksQueryKey,
} from "../api/generated/@tanstack/react-query.gen";

export function useNotebooks() {
  return useQuery({ ...listNotebooksOptions(), meta: { handledByRoute: true } });
}

export function useCreateNotebook() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createNotebookMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listNotebooksQueryKey() }),
  });
}
