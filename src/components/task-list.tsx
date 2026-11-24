import { Link } from "@tanstack/react-router";
import type { Task } from "../api/generated";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { TaskCheckbox } from "./task-checkbox";
import { TaskDelete } from "./task-delete";

const priorityBadge = {
  1: "destructive",
  2: "warning",
  3: "info",
  4: "cyan",
  5: "secondary",
} as const;

function PriorityBadge({ task }: { task: Task }) {
  const done = task.status === "done";
  return (
    <Badge
      variant={done ? "outline" : priorityBadge[task.priority as keyof typeof priorityBadge]}
      className={cn(done && "border-border text-muted-foreground")}
    >
      P{task.priority}
    </Badge>
  );
}

function TaskRow({ task }: { task: Task }) {
  const done = task.status === "done";

  return (
    <li
      className={cn(
        "grid min-h-6 grid-cols-[5ch_5ch_minmax(0,1fr)_auto] items-start border-b border-dashed border-border last:border-b-0 hover:bg-accent/8 focus-within:bg-accent/8",
        done && "text-muted-foreground",
      )}
    >
      <div className="flex min-h-6 items-start justify-center self-stretch border-r border-border py-0.5">
        <TaskCheckbox task={task} />
      </div>
      <div className="flex justify-center py-0.5">
        <PriorityBadge task={task} />
      </div>
      <div className="min-w-0 self-center px-[1ch] py-0.5">
        <Link
          to="/tasks/$taskId"
          params={{ taskId: task.id }}
          className="wrap-anywhere whitespace-pre-wrap hover:text-accent-ink hover:underline"
        >
          {task.title}
        </Link>
        {task.description && (
          <p className="truncate text-xs text-muted-foreground">{task.description}</p>
        )}
      </div>
      <div className="flex items-start self-stretch border-l border-border">
        <Button asChild variant="bracket" size="sm">
          <Link to="/tasks/$taskId" params={{ taskId: task.id }} aria-label={`Edit ${task.title}`}>
            <span aria-hidden className="sm:hidden">
              e
            </span>
            <span aria-hidden className="hidden sm:inline">
              edit
            </span>
          </Link>
        </Button>
        <TaskDelete task={task} />
      </div>
    </li>
  );
}

function TaskRows({ tasks, label }: { tasks: Task[]; label: string }) {
  return (
    <ul aria-label={label} className="min-w-0">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </ul>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const pending = tasks.filter((task) => task.status !== "done");
  const completed = tasks.filter((task) => task.status === "done");

  return (
    <>
      <Card
        role="region"
        aria-labelledby="pending-heading"
        label={
          <span id="pending-heading" role="heading" aria-level={2}>
            Pending
          </span>
        }
        labelEnd={
          <span aria-hidden className="text-sm">
            {pending.length}
          </span>
        }
      >
        {pending.length ? (
          <TaskRows tasks={pending} label="Pending tasks" />
        ) : (
          <CardContent className="text-muted-foreground">No pending tasks.</CardContent>
        )}
      </Card>
      <Collapsible className="min-w-0 border border-border-strong bg-surface">
        <div className="bg-surface-2">
          <CollapsibleTrigger asChild>
            <Button className="group w-full justify-start" type="button" variant="ghost" size="sm">
              <span
                aria-hidden
                className="before:content-['[+]'] group-data-[state=open]:before:content-['[-]']"
              />
              <span>Completed</span>
              <span className="ml-auto text-muted-foreground">{completed.length}</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="border-t border-border-strong">
          {completed.length ? (
            <TaskRows tasks={completed} label="Completed tasks" />
          ) : (
            <p className="px-[1ch] py-1 text-muted-foreground">No completed tasks.</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
