import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "../components/ui/sonner";
import { describeError, isProblem, isUnauthorized } from "./problem";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { handledByRoute?: boolean };
    mutationMeta: { showsOwnError?: boolean };
  }
}

export function createQueryClient(onUnauthorized: () => void) {
  const onError = (error: unknown) => {
    if (isUnauthorized(error)) onUnauthorized();
    else
      toast.error(isProblem(error) ? error.title : "error", { description: describeError(error) });
  };

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!query.meta?.handledByRoute) onError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (!mutation.meta?.showsOwnError || isUnauthorized(error)) onError(error);
      },
    }),
    defaultOptions: { queries: { retry: false } },
  });
}
