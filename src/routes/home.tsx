import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { listTasksOptions } from "../api/generated/@tanstack/react-query.gen";
import { ConnectedDevices } from "../components/connected-devices";
import { JournalShell } from "../components/journal-shell";
import { LoadError } from "../components/load-error";
import { NotesPanel } from "../components/notes-panel";
import { TaskCreateForm } from "../components/task-create-form";
import { TaskList } from "../components/task-list";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useNotebooks } from "../lib/notebooks";
import { RevealNoteProvider } from "../lib/reveal-note";
import { useStoredState } from "../lib/stored-state";
import { useMediaQuery } from "../lib/use-media-query";

function useTasks() {
  return useQuery({ ...listTasksOptions(), meta: { handledByRoute: true } });
}

function TasksPanel() {
  const tasks = useTasks();

  return (
    <section aria-labelledby="tasks-heading" className="grid min-w-0 content-start gap-3">
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

function MobileHome() {
  const [storedView, setView] = useStoredState<string>("journal-home-view", "tasks");
  const view = storedView === "notes" ? "notes" : "tasks";

  return (
    <Tabs value={view} onValueChange={setView} className="contents">
      <JournalShell
        status={<SyncStatus />}
        footerAction={<ConnectedDevices />}
        tabBar={
          <TabsList aria-label="View" variant="inverted" className="justify-center">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="tasks">
          <TasksPanel />
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel />
        </TabsContent>
        <Outlet />
      </JournalShell>
    </Tabs>
  );
}

function DesktopHome() {
  return (
    <JournalShell status={<SyncStatus />} footerAction={<ConnectedDevices />} scroll="panes">
      <div className="grid h-full grid-cols-2 gap-[2ch]">
        <div className="min-h-0 overflow-y-auto px-[1ch]">
          <TasksPanel />
        </div>
        <div className="min-h-0 overflow-y-auto px-[1ch]">
          <NotesPanel />
        </div>
      </div>
      <Outlet />
    </JournalShell>
  );
}

export function HomePage() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return <RevealNoteProvider>{desktop ? <DesktopHome /> : <MobileHome />}</RevealNoteProvider>;
}
