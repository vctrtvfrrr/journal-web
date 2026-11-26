import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onUnsupportedContract } from "./api/contract";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { UnsupportedContract } from "./components/unsupported-contract";
import { createQueryClient } from "./lib/query-client";
import { ThemeProvider } from "./lib/theme";
import { createAppRouter } from "./router";

function createApp(history?: RouterHistory) {
  const queryClient = createQueryClient(() => {
    queryClient.clear();
    void router.navigate({ to: "/login" });
  });
  const router = createAppRouter(queryClient, history);
  return { queryClient, router };
}

export function App({ history }: { history?: RouterHistory }) {
  const [{ queryClient, router }] = useState(() => createApp(history));
  const [minimumVersion, setMinimumVersion] = useState<string>();
  useEffect(() => onUnsupportedContract(setMinimumVersion), []);

  return (
    <ThemeProvider>
      {minimumVersion ? (
        <UnsupportedContract minimumVersion={minimumVersion} />
      ) : (
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      )}
    </ThemeProvider>
  );
}
