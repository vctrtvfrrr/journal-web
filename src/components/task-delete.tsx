import { useMutation, useQueryClient } from "@tanstack/react-query";
import { plural } from "../lib/plural";
import { taskTree } from "../lib/task-tree";
import { useState } from "react";
import type { Task } from "../api/generated";
import { deleteTaskMutation, listTasksQueryKey } from "../api/generated/@tanstack/react-query.gen";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "./ui/button";

export function TaskDelete({
  task,
  onDeleted,
  className,
}: {
  task: Task;
  onDeleted?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const tasks = queryClient.getQueryData<Task[]>(listTasksQueryKey());
  const subtasks = tasks ? taskTree(tasks).subtasks(task.id).length : 0;
  const remove = useMutation({
    ...deleteTaskMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listTasksQueryKey() });
      setOpen(false);
      onDeleted?.();
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className={className}
          aria-label={`Delete ${task.title}`}
          title="Delete task"
        >
          <span aria-hidden>delete</span>
        </Button>
      }
      title="Delete task?"
      description={
        subtasks === 0
          ? "Remove this task from your list?"
          : `Delete this task and its ${plural(subtasks, "subtask")}?`
      }
      confirmLabel="delete task"
      status={remove}
      onConfirm={() => remove.mutate({ path: { id: task.id } })}
    >
      <p className="max-h-[35dvh] overflow-y-auto wrap-anywhere whitespace-pre-wrap">
        {task.title}
      </p>
    </ConfirmDialog>
  );
}
