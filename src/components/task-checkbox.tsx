import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Task, type TaskStatus, updateTask } from "../api/generated";
import {
  getTaskQueryKey,
  listTasksQueryKey,
  updateTaskMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { describeError, isUnauthorized } from "../lib/problem";
import { taskTree } from "../lib/task-tree";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./ui/dialog";
import { toast } from "./ui/sonner";

const checkedState = { todo: false, doing: "indeterminate", done: true } as const;
const nextStatus: Record<TaskStatus, TaskStatus> = { todo: "doing", doing: "done", done: "todo" };
const statusMutationKey = ["taskStatus"];

function useTaskStatus(task: Task) {
  const queryClient = useQueryClient();
  const listKey = listTasksQueryKey();
  const taskKey = getTaskQueryKey({ path: { id: task.id } });
  const setStatus = (status: TaskStatus, updatedAt: string) => {
    const withStatus = (t: Task) =>
      t.id === task.id ? { ...t, status, updated_at: updatedAt } : t;
    queryClient.setQueryData<Task[]>(listKey, (tasks) => tasks?.map(withStatus));
    queryClient.setQueryData<Task>(taskKey, (current) => current && withStatus(current));
  };

  return useMutation({
    ...updateTaskMutation(),
    mutationKey: statusMutationKey,
    meta: { showsOwnError: true },
    scope: { id: `task-status-${task.id}` },
    onMutate: async ({ body }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: taskKey });
      const previous = { status: task.status, updatedAt: task.updated_at };
      setStatus(body?.status ?? previous.status, new Date().toISOString());
      return previous;
    },
    onError: (error, _variables, previous) => {
      if (previous) setStatus(previous.status, previous.updatedAt);
      if (!isUnauthorized(error))
        toast.error("Couldn't update task.", { description: describeError(error) });
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: statusMutationKey }) > 1) return;
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: taskKey });
    },
  });
}

function useCompleteTasks() {
  const queryClient = useQueryClient();
  const listKey = listTasksQueryKey();
  const complete = (ids: string[], updatedAt: string) =>
    queryClient.setQueryData<Task[]>(listKey, (tasks) =>
      tasks?.map((t) => (ids.includes(t.id) ? { ...t, status: "done", updated_at: updatedAt } : t)),
    );

  return useMutation({
    mutationKey: statusMutationKey,
    meta: { showsOwnError: true },
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => updateTask({ path: { id }, body: { status: "done" }, throwOnError: true })),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      complete(ids, new Date().toISOString());
    },
    onError: (error) => {
      if (!isUnauthorized(error))
        toast.error("Couldn't complete every task.", { description: describeError(error) });
    },
    onSettled: (_data, _error, ids) => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      for (const id of ids)
        void queryClient.invalidateQueries({ queryKey: getTaskQueryKey({ path: { id } }) });
    },
  });
}

function pendingSubtasks(tasks: Task[] | undefined, task: Task) {
  if (!tasks) return [];
  return taskTree(tasks)
    .subtasks(task.id)
    .filter((subtask) => subtask.status !== "done");
}

function CompleteSubtasksPrompt({
  pending,
  onOnlyThis,
  onAll,
  onCancel,
}: {
  pending: number;
  onOnlyThis: () => void;
  onAll: () => void;
  onCancel: () => void;
}) {
  const question = `Complete its ${pending} pending ${pending === 1 ? "subtask" : "subtasks"} too?`;
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent label="Complete task" showCloseButton={false}>
        <DialogTitle className="sr-only">Complete task</DialogTitle>
        <DialogDescription>{question}</DialogDescription>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onOnlyThis}>
            Only this task
          </Button>
          <Button type="button" variant="default" onClick={onAll}>
            All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskCheckbox({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const update = useTaskStatus(task);
  const completeAll = useCompleteTasks();
  const [asking, setAsking] = useState<Task[]>();
  const next = nextStatus[task.status];
  const setNext = () => update.mutate({ path: { id: task.id }, body: { status: next } });

  const change = () => {
    const pending =
      next === "done"
        ? pendingSubtasks(queryClient.getQueryData<Task[]>(listTasksQueryKey()), task)
        : [];
    if (pending.length > 0) setAsking(pending);
    else setNext();
  };

  return (
    <>
      <Checkbox
        checked={checkedState[task.status]}
        aria-label={`${task.title}: ${task.status}`}
        onCheckedChange={change}
      />
      {asking && (
        <CompleteSubtasksPrompt
          pending={asking.length}
          onCancel={() => setAsking(undefined)}
          onOnlyThis={() => {
            setAsking(undefined);
            setNext();
          }}
          onAll={() => {
            setAsking(undefined);
            completeAll.mutate([task.id, ...asking.map((subtask) => subtask.id)]);
          }}
        />
      )}
    </>
  );
}
