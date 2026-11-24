import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { listTasksOptions } from "../api/generated/@tanstack/react-query.gen";
import { ConnectedDevices } from "../components/connected-devices";
import { JournalShell } from "../components/journal-shell";
import { NotesPanel } from "../components/notes-panel";
import { TaskCreateForm } from "../components/task-create-form";
import { TaskList } from "../components/task-list";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useNotebooks } from "../lib/notebooks";
import { describeError } from "../lib/problem";
import { useStoredState } from "../lib/stored-state";
import { useMediaQuery } from "../lib/use-media-query";

function TasksPanel() {
  const tasks = useQuery({ ...listTasksOptions(), meta: { handledByRoute: true } });

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
      {tasks.isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-[1ch]">
            {describeError(tasks.error)}
            <Button type="button" variant="bracket" size="sm" onClick={() => void tasks.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {tasks.data && !tasks.isError && <TaskCreateForm />}
      {tasks.data && <TaskList tasks={tasks.data} />}
    </section>
  );
}

function SyncStatus() {
  const tasks = useQuery({ ...listTasksOptions(), meta: { handledByRoute: true } });
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

type View = "tasks" | "notes";

function MobileHome() {
  const [view, setView] = useStoredState<View>("journal-home-view", "tasks");

  return (
    <Tabs value={view} onValueChange={(next) => setView(next as View)} className="contents">
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
    <JournalShell
      status={<SyncStatus />}
      footerAction={<ConnectedDevices />}
      className="[&>main]:overflow-hidden"
    >
      <div className="grid h-full grid-cols-2 gap-[2ch]">
        <div className="min-h-0 overflow-y-auto">
          <TasksPanel />
        </div>
        <div className="min-h-0 overflow-y-auto">
          <NotesPanel />
        </div>
      </div>
      <Outlet />
    </JournalShell>
  );
}

export function HomePage() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return desktop ? <DesktopHome /> : <MobileHome />;
}
