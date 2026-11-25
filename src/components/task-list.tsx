import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import type { Task } from "../api/generated";
import { activationHandlers } from "../lib/activation";
import { cn } from "../lib/utils";
import { Markdown } from "./markdown";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { TaskCheckbox } from "./task-checkbox";

const priorityBadge = {
  1: "destructive",
  2: "warning",
  3: "info",
  4: "cyan",
  5: "secondary",
} as const;

const priorityDot = {
  1: "bg-red",
  2: "bg-yellow",
  3: "bg-blue",
  4: "bg-cyan",
  5: "bg-border-strong",
} as const;

type Priority = keyof typeof priorityBadge;

function PriorityBadge({ task, className }: { task: Task; className?: string }) {
  const done = task.status === "done";
  return (
    <Badge
      variant={done ? "outline" : priorityBadge[task.priority as Priority]}
      className={cn(done && "border-border text-muted-foreground", className)}
    >
      P{task.priority}
    </Badge>
  );
}

function PriorityDot({ task }: { task: Task }) {
  const done = task.status === "done";
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Priority P${task.priority}`}
        className="flex size-6 items-center justify-center lg:hidden"
      >
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            done ? "bg-muted-foreground/50" : priorityDot[task.priority as Priority],
          )}
        />
      </PopoverTrigger>
      <PopoverContent side="left" className="w-auto p-[1ch] py-1">
        <PriorityBadge task={task} />
      </PopoverContent>
    </Popover>
  );
}

function TaskRow({ task }: { task: Task }) {
  const done = task.status === "done";
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const navigate = useNavigate();
  const openOnActivate = activationHandlers(
    () => void navigate({ to: "/tasks/$taskId", params: { taskId: task.id } }),
  );

  return (
    <li
      className={cn(
        "grid min-h-6 grid-cols-[5ch_minmax(0,1fr)_3ch] items-start lg:grid-cols-[5ch_minmax(0,1fr)_5ch] border-b border-dashed border-border last:border-b-0 hover:bg-accent/8 focus-within:bg-accent/8",
        done && "text-muted-foreground",
      )}
    >
      <div className="flex min-h-6 items-start justify-center self-stretch border-r border-border py-0.5">
        <TaskCheckbox task={task} />
      </div>
      <div
        {...openOnActivate}
        role="button"
        tabIndex={0}
        aria-labelledby={titleId}
        aria-describedby={task.description ? descriptionId : undefined}
        className="group flex min-w-0 cursor-pointer flex-col justify-center self-stretch px-[1ch] py-0.5 focus-visible:outline-offset-[-1px]"
      >
        <span id={titleId} className="wrap-anywhere group-hover:text-accent-ink">
          <Markdown level="inline">{task.title}</Markdown>
        </span>
        {task.description && (
          <span
            id={descriptionId}
            className="hidden truncate text-xs text-muted-foreground sm:block"
          >
            <Markdown level="inline">{task.description}</Markdown>
          </span>
        )}
      </div>
      <div className="flex items-center justify-center self-stretch py-0.5">
        <PriorityDot task={task} />
        <PriorityBadge task={task} className="hidden lg:inline-flex" />
      </div>
    </li>
  );
}

const isDoing = (task: Task) => task.status === "doing";

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
  const pending = tasks
    .filter((task) => task.status !== "done")
    .toSorted((a, b) => a.priority - b.priority || Number(isDoing(b)) - Number(isDoing(a)));
  const completed = tasks
    .filter((task) => task.status === "done")
    .toSorted((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

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
              <span>completed</span>
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
