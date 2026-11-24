import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { listTasksOptions } from "../api/generated/@tanstack/react-query.gen";
import { ConnectedDevices } from "../components/connected-devices";
import { JournalShell } from "../components/journal-shell";
import { TaskCreateForm } from "../components/task-create-form";
import { TaskList } from "../components/task-list";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { describeError } from "../lib/problem";

export function HomePage() {
  const tasks = useQuery({ ...listTasksOptions(), meta: { handledByRoute: true } });
  const saving = useIsMutating() > 0;
  const status = saving
    ? "Saving..."
    : tasks.isFetching
      ? "Loading..."
      : tasks.isError
        ? "Couldn't load tasks"
        : "Up to date";

  return (
    <JournalShell
      status={<span className={tasks.isError ? "text-red-ink" : "text-green-ink"}>{status}</span>}
      footerAction={<ConnectedDevices />}
    >
      <section className="grid min-w-0 gap-3">
        <h1 className="sr-only">Tasks</h1>
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
              <Button
                type="button"
                variant="bracket"
                size="sm"
                onClick={() => void tasks.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {tasks.data && (
          <>
            <TaskCreateForm />
            <TaskList tasks={tasks.data} />
          </>
        )}
      </section>
      <Outlet />
    </JournalShell>
  );
}
