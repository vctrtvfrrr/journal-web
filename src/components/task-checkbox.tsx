import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskStatus } from "../api/generated";
import {
  getTaskQueryKey,
  listTasksQueryKey,
  updateTaskMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { describeError, isUnauthorized } from "../lib/problem";
import { Checkbox } from "./ui/checkbox";
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

export function TaskCheckbox({ task }: { task: Task }) {
  const update = useTaskStatus(task);

  return (
    <Checkbox
      checked={checkedState[task.status]}
      aria-label={`${task.title}: ${task.status}`}
      onCheckedChange={() =>
        update.mutate({ path: { id: task.id }, body: { status: nextStatus[task.status] } })
      }
    />
  );
}
