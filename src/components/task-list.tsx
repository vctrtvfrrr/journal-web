import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { createContext, useContext, useId, useMemo, useState } from "react";
import type { Task } from "../api/generated";
import { activationHandlers } from "../lib/activation";
import { taskTree, type TaskNode } from "../lib/task-tree";
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

type Collapsed = { isCollapsed: (id: string) => boolean; toggle: (id: string) => void };

const CollapsedContext = createContext<Collapsed>({ isCollapsed: () => false, toggle: () => {} });

function useCollapsedState(): Collapsed {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  return {
    isCollapsed: (id) => collapsed.has(id),
    toggle: (id) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
  };
}

function SubtasksToggle({
  task,
  expanded,
  controls,
  onToggle,
}: {
  task: Task;
  expanded: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Subtasks of ${task.title}`}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      className="flex size-6 items-center justify-center text-muted-foreground hover:text-accent-ink"
    >
      <ChevronRight
        aria-hidden
        className={cn("size-4 transition-transform", expanded && "rotate-90")}
      />
    </button>
  );
}

function TaskRow({ node }: { node: TaskNode }) {
  const { task, depth } = node;
  const done = task.status === "done";
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const subtasksId = `${id}-subtasks`;
  const navigate = useNavigate();
  const collapsed = useContext(CollapsedContext);
  const openOnActivate = activationHandlers(
    () => void navigate({ to: "/tasks/$taskId", params: { taskId: task.id } }),
  );
  const hasSubtasks = node.pending.length + node.completed.length > 0;
  const expanded = hasSubtasks && !collapsed.isCollapsed(task.id);

  return (
    <li className={cn("min-w-0", done && "text-muted-foreground")}>
      <div className="grid min-h-6 grid-cols-[auto_minmax(0,1fr)_3ch] items-start border-b border-dashed border-border hover:bg-accent/8 focus-within:bg-accent/8 lg:grid-cols-[auto_minmax(0,1fr)_5ch]">
        <div
          className="flex min-h-6 items-start self-stretch border-r border-border py-0.5"
          style={{ paddingLeft: `${(depth - 1) * 2}ch` }}
        >
          <span className="flex w-[2ch] justify-center">
            {hasSubtasks && (
              <SubtasksToggle
                task={task}
                expanded={expanded}
                controls={subtasksId}
                onToggle={() => collapsed.toggle(task.id)}
              />
            )}
          </span>
          <span className="flex w-[3ch] justify-center">
            <TaskCheckbox task={task} />
          </span>
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
      </div>
      {expanded && (
        <div id={subtasksId}>
          <TaskLevel level={node} parent={node} />
        </div>
      )}
    </li>
  );
}

function completedLabel(count: number, parent: Task) {
  return `Show ${count} completed ${count === 1 ? "subtask" : "subtasks"} of ${parent.title}`;
}

function CompletedGroup({ nodes, parent }: { nodes: TaskNode[]; parent?: TaskNode }) {
  const depth = parent ? parent.depth + 1 : 1;
  return (
    <Collapsible className="min-w-0 text-muted-foreground">
      <CollapsibleTrigger asChild>
        <Button
          className="group w-full justify-start border-b border-dashed border-border"
          style={{ paddingLeft: `${(depth - 1) * 2 + 1}ch` }}
          type="button"
          variant="ghost"
          size="sm"
          aria-label={parent ? completedLabel(nodes.length, parent.task) : undefined}
        >
          <span
            aria-hidden
            className="before:content-['[+]'] group-data-[state=open]:before:content-['[-]']"
          />
          <span>completed</span>
          <span className="ml-auto">{nodes.length}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul
          aria-label={parent ? `Completed subtasks of ${parent.task.title}` : "Completed tasks"}
          className="min-w-0"
        >
          {nodes.map((node) => (
            <TaskRow key={node.task.id} node={node} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TaskLevel({
  level,
  parent,
}: {
  level: Pick<TaskNode, "pending" | "completed">;
  parent?: TaskNode;
}) {
  return (
    <>
      {level.pending.length > 0 && (
        <ul
          aria-label={parent ? `Subtasks of ${parent.task.title}` : "Pending tasks"}
          className="min-w-0"
        >
          {level.pending.map((node) => (
            <TaskRow key={node.task.id} node={node} />
          ))}
        </ul>
      )}
      {level.completed.length > 0 && <CompletedGroup nodes={level.completed} parent={parent} />}
    </>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const tree = useMemo(() => taskTree(tasks), [tasks]);
  const collapsed = useCollapsedState();

  return (
    <CollapsedContext value={collapsed}>
      <Card
        role="region"
        aria-labelledby="tasks-list-heading"
        label={
          <span id="tasks-list-heading" role="heading" aria-level={2}>
            Tasks
          </span>
        }
        labelEnd={
          <span aria-hidden className="text-sm">
            {tree.pending.length}
          </span>
        }
      >
        {tree.pending.length === 0 && (
          <CardContent className="text-muted-foreground">No pending tasks.</CardContent>
        )}
        <TaskLevel level={tree} />
      </Card>
    </CollapsedContext>
  );
}

export function TaskSubtasks({ node }: { node: TaskNode }) {
  const collapsed = useCollapsedState();
  if (node.pending.length + node.completed.length === 0) return null;
  return (
    <CollapsedContext value={collapsed}>
      <div className="min-w-0 border border-border">
        <TaskLevel level={node} parent={node} />
      </div>
    </CollapsedContext>
  );
}
