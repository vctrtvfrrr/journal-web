import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "./components/ui/sonner";
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

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
