import { useQuery } from "@tanstack/react-query";
import { listNotebooksOptions } from "../api/generated/@tanstack/react-query.gen";

export function useNotebooks() {
  return useQuery({ ...listNotebooksOptions(), meta: { handledByRoute: true } });
}
