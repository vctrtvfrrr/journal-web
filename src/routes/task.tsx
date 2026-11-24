import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import type { Task } from "../api/generated";
import {
  getTaskOptions,
  getTaskQueryKey,
  listTasksQueryKey,
  updateTaskMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { zTaskChanges } from "../api/generated/zod.gen";
import { ErrorText, Field } from "../components/field";
import { TaskCheckbox } from "../components/task-checkbox";
import { TaskDelete } from "../components/task-delete";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "../components/ui/dialog";
import { Input, Textarea } from "../components/ui/input";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "../components/ui/sonner";
import { apiTrim } from "../lib/api-trim";
import { describeError, fieldErrors, isProblem, pointerField } from "../lib/problem";

const taskForm = zTaskChanges.pick({ title: true, description: true, priority: true });
type TaskForm = z.infer<typeof taskForm>;
const priorities = [1, 2, 3, 4, 5];

function isMissingTask(error: unknown) {
  return isProblem(error) && (error.status === 404 || error.status === 400);
}

function TaskEditForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string>();
  const update = useMutation({
    ...updateTaskMutation(),
    meta: { showsOwnError: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(getTaskQueryKey({ path: { id: task.id } }), saved);
      return queryClient.invalidateQueries({ queryKey: listTasksQueryKey() });
    },
  });
  const form = useForm<TaskForm>({
    resolver: zodResolver(taskForm),
    defaultValues: {
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (changes) => {
    setFormError(undefined);
    try {
      await update.mutateAsync({ path: { id: task.id }, body: changes });
      onDone();
    } catch (failure) {
      if (!isProblem(failure)) return setFormError(describeError(failure));
      const invalidFields = fieldErrors(failure);
      if (invalidFields.length === 0) return setFormError(failure.detail);
      for (const { pointer, detail } of invalidFields) {
        const field = pointerField(pointer);
        if (field === "title" || field === "description" || field === "priority")
          form.setError(field, { message: detail });
        else setFormError(`${field}: ${detail}`);
      }
    }
  });

  return (
    <form className="grid gap-3" onSubmit={submit} noValidate>
      <Field label="Title" htmlFor="task-title" error={errors.title?.message}>
        <div className="flex items-center gap-[1ch]">
          <TaskCheckbox task={task} />
          <Input
            id="task-title"
            aria-invalid={!!errors.title}
            {...form.register("title", { setValueAs: apiTrim })}
          />
        </div>
      </Field>
      <Field label="Description" htmlFor="task-description" error={errors.description?.message}>
        <Textarea
          id="task-description"
          className="resize-y"
          aria-invalid={!!errors.description}
          {...form.register("description", { setValueAs: apiTrim })}
        />
      </Field>
      <Field label="Priority" htmlFor="task-priority" error={errors.priority?.message}>
        <Controller
          control={form.control}
          name="priority"
          render={({ field }) => (
            <RadioGroup
              id="task-priority"
              aria-label="Priority"
              className="flex gap-[2ch]"
              value={String(field.value)}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              {priorities.map((priority) => (
                <label key={priority} className="flex items-center gap-[0.5ch]">
                  <RadioGroupItem value={String(priority)} aria-label={`P${priority}`} />
                  <span aria-hidden>P{priority}</span>
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </Field>
      {formError && <ErrorText>{formError}</ErrorText>}
      <DialogFooter>
        <TaskDelete task={task} onDeleted={onDone} />
        <Button variant="outline" type="button" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TaskPage() {
  const { taskId } = useParams({ from: "/home/tasks/$taskId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const task = useQuery({
    ...getTaskOptions({ path: { id: taskId } }),
    meta: { handledByRoute: true },
    initialData: () =>
      queryClient.getQueryData<Task[]>(listTasksQueryKey())?.find(({ id }) => id === taskId),
  });
  const close = () => void navigate({ to: "/" });

  useEffect(() => {
    if (!isMissingTask(task.error)) return;
    toast.error("Task not found.");
    void navigate({ to: "/", replace: true });
  }, [task.error, navigate]);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent label="Edit task">
        <DialogTitle className="sr-only">Edit task</DialogTitle>
        <DialogDescription className="sr-only">
          Change the task title, description, or priority.
        </DialogDescription>
        {task.isPending && <Skeleton className="h-40" />}
        {task.isError && !isMissingTask(task.error) && (
          <Alert variant="destructive">
            <AlertDescription>{describeError(task.error)}</AlertDescription>
          </Alert>
        )}
        {task.data && <TaskEditForm task={task.data} onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}
