import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { hasSession } from "./lib/session";
import { ErrorPage } from "./routes/error";
import { HomePage } from "./routes/home";
import { LoginPage } from "./routes/login";
import { NotePage } from "./routes/note";
import { TaskPage } from "./routes/task";

type RouterContext = { queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  errorComponent: ErrorPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async ({ context }) => {
    if (await hasSession(context.queryClient)) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "home",
  beforeLoad: async ({ context }) => {
    if (!(await hasSession(context.queryClient))) throw redirect({ to: "/login" });
  },
  component: HomePage,
});

const taskListRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "/",
});

const taskRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "tasks/$taskId",
  component: TaskPage,
});

const noteRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "notes/$noteId",
  component: NotePage,
});

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      loginRoute,
      homeRoute.addChildren([taskListRoute, taskRoute, noteRoute]),
    ]),
    context: { queryClient },
    history,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
