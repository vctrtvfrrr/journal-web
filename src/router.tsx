import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  parseSearchWith,
  redirect,
  retainSearchParams,
  type RouterHistory,
  stringifySearchWith,
} from "@tanstack/react-router";
import { hasSession } from "./lib/session";
import { MODULES, type ModuleId } from "./modules/registry";
import { TIMELINE_SEARCH_KEYS, validateTimelineSearch } from "./lib/timeline-filters";
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
  validateSearch: validateTimelineSearch,
  search: { middlewares: [retainSearchParams([...TIMELINE_SEARCH_KEYS])] },
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

const moduleRoutes = MODULES.map((module) =>
  createRoute({
    getParentRoute: () => homeRoute,
    path: module.id,
    staticData: { moduleId: module.id },
    component: module.Page,
  }),
);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      loginRoute,
      homeRoute.addChildren([taskListRoute, taskRoute, noteRoute, ...moduleRoutes]),
    ]),
    context: { queryClient },
    history,
    parseSearch: parseSearchWith((value) => value),
    stringifySearch: stringifySearchWith(JSON.stringify),
  });
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    moduleId?: ModuleId;
  }
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
