import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Task } from "../api/generated";
import { deleteTaskMutation, listTasksQueryKey } from "../api/generated/@tanstack/react-query.gen";
import { describeError } from "../lib/problem";
import { ErrorText } from "./field";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        if (next) remove.reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
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
      </DialogTrigger>
      <DialogContent label="Delete task?" showCloseButton={false}>
        <DialogTitle className="sr-only">Delete task?</DialogTitle>
        <DialogDescription>Remove this task from your list?</DialogDescription>
        <p className="max-h-[35dvh] overflow-y-auto wrap-anywhere whitespace-pre-wrap">
          {task.title}
        </p>
        {remove.isError && <ErrorText>{describeError(remove.error)}</ErrorText>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={remove.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ path: { id: task.id } })}
          >
            Delete task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
