import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { listTasksOptions } from "../api/generated/@tanstack/react-query.gen";
import { ConnectedDevices } from "../components/connected-devices";
import { DaySummary } from "../components/day-summary";
import { DashboardColumns, SidebarToggles } from "../components/dashboard-columns";
import { JournalShell } from "../components/journal-shell";
import { LoadError } from "../components/load-error";
import { NotesPanel } from "../components/notes-panel";
import { SectionStack, type StackSection } from "../components/section-stack";
import { TaskCreateForm } from "../components/task-create-form";
import { TaskList } from "../components/task-list";
import { WidgetList } from "../components/widget-list";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useDesktopShortcuts } from "../lib/desktop-shortcuts";
import { useNotebooks } from "../lib/notebooks";
import { NotesSearchProvider, useNotesSearch } from "../lib/notes-search";
import { PanelFocusProvider } from "../lib/panel-focus";
import { RevealNoteProvider, useRevealNote } from "../lib/reveal-note";
import { useStoredState } from "../lib/stored-state";
import { useSidebars } from "../lib/sidebars";
import { useMediaQuery } from "../lib/use-media-query";
import { useActiveModule } from "../modules/use-active-module";

function useTasks() {
  return useQuery({ ...listTasksOptions(), meta: { handledByRoute: true } });
}

function TasksPanel() {
  const tasks = useTasks();

  return (
    <section
      aria-labelledby="tasks-heading"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3"
    >
      <h2 id="tasks-heading" className="sr-only">
        Tasks
      </h2>
      {tasks.isPending && (
        <div className="grid gap-2" aria-hidden>
          <Skeleton className="h-7" />
          <Skeleton className="h-24" />
        </div>
      )}
      {tasks.isError && <LoadError error={tasks.error} onRetry={() => void tasks.refetch()} />}
      {tasks.data && !tasks.isError && <TaskCreateForm />}
      {tasks.data && <TaskList tasks={tasks.data} />}
    </section>
  );
}

function SyncStatus() {
  const tasks = useTasks();
  const notebooks = useNotebooks();
  const saving = useIsMutating() > 0;
  const failed = tasks.isError || notebooks.isError;
  const status = saving
    ? "Saving..."
    : tasks.isFetching || notebooks.isFetching
      ? "Loading..."
      : failed
        ? "Couldn't load"
        : "Up to date";

  return <span className={failed ? "text-red-ink" : "text-green-ink"}>{status}</span>;
}

function ModuleBreadcrumb({ title, compact }: { title: string; compact: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-[1ch] px-[1ch]">
      <Link
        to="/"
        search={(previous) => previous}
        aria-label={compact ? "Back" : "Back to Tasks & Notes"}
      >
        {compact ? "←" : "← Tasks & Notes"}
      </Link>
      {!compact && <span aria-hidden>/</span>}
      <span>{title}</span>
    </nav>
  );
}

const mobileViews = ["widgets", "tasks", "notes"] as const;
type MobileView = (typeof mobileViews)[number];

function MobileHome() {
  const [storedView, setView] = useStoredState<MobileView>("journal-home-view", "tasks");
  const view = mobileViews.find((name) => name === storedView) ?? "tasks";
  const active = useActiveModule();
  const navigate = useNavigate();
  const revealPending = useRevealNote().target !== undefined;
  useEffect(() => {
    if (revealPending) setView("notes");
  }, [revealPending]);
  useEffect(() => {
    if (active) setView("widgets");
  }, [active]);

  const chooseView = (next: string) => {
    setView(mobileViews.find((name) => name === next) ?? "tasks");
    if (active) void navigate({ to: "/", search: (previous) => previous });
  };

  return (
    <Tabs value={view} onValueChange={chooseView} className="contents">
      <JournalShell
        status={<SyncStatus />}
        footerAction={<ConnectedDevices />}
        breadcrumb={active && <ModuleBreadcrumb title={active.title} compact />}
        tabBar={
          <TabsList aria-label="View" variant="group" className="px-[1ch]">
            <TabsTrigger value="widgets">Widgets</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        }
      >
        {active ? (
          <Outlet />
        ) : (
          <>
            <TabsContent value="widgets">
              <WidgetList />
            </TabsContent>
            <TabsContent value="tasks">
              <DaySummary onOpen={() => setView("widgets")} />
              <TasksPanel />
            </TabsContent>
            <TabsContent value="notes">
              <NotesPanel />
            </TabsContent>
            <Outlet />
          </>
        )}
      </JournalShell>
    </Tabs>
  );
}

function useCenterSections(): StackSection[] {
  const notesSearch = useNotesSearch();
  return [
    { id: "tasks", title: "Tasks", content: <TasksPanel />, defaultSize: "67%", panel: "tasks" },
    {
      id: "notes",
      title: "Notes",
      content: <NotesPanel />,
      defaultSize: "33%",
      panel: "notes",
      shortcuts: notesSearch.openOnSlash,
    },
  ];
}

function DesktopHome() {
  const sidebars = useSidebars();
  const active = useActiveModule();
  useDesktopShortcuts({ sidebars, activeModule: active });
  const centerSections = useCenterSections();
  return (
    <JournalShell
      status={<SyncStatus />}
      footerAction={<ConnectedDevices />}
      breadcrumb={active && <ModuleBreadcrumb title={active.title} compact={false} />}
      headerActions={<SidebarToggles sidebars={sidebars} />}
      scroll="panes"
    >
      <DashboardColumns
        sidebars={sidebars}
        activeModule={active?.id}
        center={
          <>
            <div hidden={!!active} className="h-full">
              <SectionStack id="center" sections={centerSections} />
            </div>
            {active && (
              <div className="h-full overflow-y-auto py-2">
                <Outlet />
              </div>
            )}
          </>
        }
      />
      {!active && <Outlet />}
    </JournalShell>
  );
}

export function HomePage() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <RevealNoteProvider>
      <NotesSearchProvider>
        {desktop ? (
          <PanelFocusProvider>
            <DesktopHome />
          </PanelFocusProvider>
        ) : (
          <MobileHome />
        )}
      </NotesSearchProvider>
    </RevealNoteProvider>
  );
}
