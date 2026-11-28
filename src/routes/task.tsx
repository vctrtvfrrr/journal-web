import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { Task } from "../api/generated";
import {
  getTaskOptions,
  getTaskQueryKey,
  listTasksOptions,
  listTasksQueryKey,
  updateTaskMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { zTaskChanges } from "../api/generated/zod.gen";
import { ErrorText, Field } from "../components/field";
import { Markdown } from "../components/markdown";
import { TaskCheckbox } from "../components/task-checkbox";
import { TaskCreateForm } from "../components/task-create-form";
import { TaskDelete } from "../components/task-delete";
import { TaskSubtasks } from "../components/task-list";
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
import { activationHandlers } from "../lib/activation";
import { apiTrim } from "../lib/api-trim";
import { MAX_DEPTH, taskTree, type TaskTree } from "../lib/task-tree";
import { describeError, fieldErrors, isProblem, pointerField } from "../lib/problem";
import { cn } from "../lib/utils";

const taskText = zTaskChanges.pick({ title: true, description: true });
type TaskText = z.infer<typeof taskText>;
type TaskField = keyof TaskText;
const priorities = [1, 2, 3, 4, 5];

function isMissingTask(error: unknown) {
  return isProblem(error) && (error.status === 404 || error.status === 400);
}

function useUpdateTask(task: Task, ownsErrors: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateTaskMutation(),
    meta: { showsOwnError: ownsErrors },
    onSuccess: (saved) => {
      queryClient.setQueryData(getTaskQueryKey({ path: { id: task.id } }), saved);
      return queryClient.invalidateQueries({ queryKey: listTasksQueryKey() });
    },
  });
}

function TaskTextEditor({
  task,
  focus,
  onDone,
}: {
  task: Task;
  focus: TaskField;
  onDone: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const update = useUpdateTask(task, true);
  const form = useForm<TaskText>({
    resolver: zodResolver(taskText),
    defaultValues: { title: task.title, description: task.description ?? "" },
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
        if (field === "title" || field === "description") form.setError(field, { message: detail });
        else setFormError(`${field}: ${detail}`);
      }
    }
  });

  return (
    <form
      className="grid gap-3"
      onSubmit={submit}
      noValidate
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-1 border border-border-strong bg-background p-1 focus-within:border-accent">
        <Field
          label="Title"
          htmlFor="task-title"
          error={errors.title?.message}
          className="[&_label]:sr-only"
        >
          <Input
            id="task-title"
            autoFocus={focus === "title"}
            aria-invalid={!!errors.title}
            className="border-0 font-bold"
            {...form.register("title", { setValueAs: apiTrim })}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="task-description"
          error={errors.description?.message}
          className="[&_label]:sr-only"
        >
          <Textarea
            id="task-description"
            autoFocus={focus === "description"}
            placeholder="Description"
            aria-invalid={!!errors.description}
            className="max-h-[50dvh] min-h-[3lh] resize-none border-0 field-sizing-content"
            {...form.register("description", { setValueAs: apiTrim })}
          />
        </Field>
      </div>
      {formError && <ErrorText>{formError}</ErrorText>}
      <DialogFooter className="flex-row">
        <Button variant="default" size="sm" type="submit" disabled={isSubmitting}>
          save
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={onDone}
          disabled={isSubmitting}
        >
          cancel
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditableText({
  onEdit,
  className,
  children,
}: {
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      {...activationHandlers(onEdit)}
      className={cn("min-w-0 wrap-anywhere hover:bg-surface-2", className)}
    >
      {children}
    </div>
  );
}

function TaskPriority({ task }: { task: Task }) {
  const update = useUpdateTask(task, false);
  const priority = update.isPending ? update.variables.body.priority : task.priority;

  return (
    <Field label="Priority" htmlFor="task-priority">
      <RadioGroup
        id="task-priority"
        aria-label="Priority"
        className="flex gap-[2ch]"
        value={String(priority)}
        onValueChange={(value) =>
          update.mutate({ path: { id: task.id }, body: { priority: Number(value) } })
        }
      >
        {priorities.map((option) => (
          <label key={option} className="flex items-center gap-[0.5ch]">
            <RadioGroupItem value={String(option)} aria-label={`P${option}`} />
            <span aria-hidden>P{option}</span>
          </label>
        ))}
      </RadioGroup>
    </Field>
  );
}

function ParentTrail({ parents }: { parents: Task[] }) {
  if (parents.length === 0) return null;
  return (
    <nav aria-label="Parent tasks" className="flex min-w-0 flex-wrap gap-[1ch] text-sm">
      {parents.map((parent) => (
        <span key={parent.id} className="flex min-w-0 gap-[1ch]">
          <Link
            to="/tasks/$taskId"
            params={{ taskId: parent.id }}
            search={(previous) => previous}
            className="wrap-anywhere text-muted-foreground hover:text-accent-ink"
          >
            {parent.title}
          </Link>
          <span aria-hidden className="text-muted-foreground">
            ›
          </span>
        </span>
      ))}
    </nav>
  );
}

function TaskSubtaskSection({ task, tree }: { task: Task; tree: TaskTree }) {
  const node = tree.node(task.id);
  if (!node) return null;
  return (
    <section aria-label="Subtasks" className="grid gap-1">
      <TaskSubtasks node={node} />
      {node.depth < MAX_DEPTH && <TaskCreateForm parentId={task.id} />}
    </section>
  );
}

function TaskDetails({
  task,
  tree,
  editing,
  onEdit,
  onClose,
}: {
  task: Task;
  tree: TaskTree | undefined;
  editing: TaskField | undefined;
  onEdit: (field: TaskField | undefined) => void;
  onClose: () => void;
}) {
  return (
    <div className="grid gap-3">
      {tree && <ParentTrail parents={tree.ancestors(task.id)} />}
      <div className="flex items-start gap-[1ch]">
        <TaskCheckbox task={task} />
        <div className="grid min-w-0 flex-1 gap-1">
          {editing ? (
            <TaskTextEditor task={task} focus={editing} onDone={() => onEdit(undefined)} />
          ) : (
            <>
              <EditableText onEdit={() => onEdit("title")} className="text-lg font-bold">
                <Markdown level="inline">{task.title}</Markdown>
              </EditableText>
              <EditableText onEdit={() => onEdit("description")}>
                {task.description ? (
                  <Markdown level="description">{task.description}</Markdown>
                ) : (
                  <span className="text-muted-foreground">Description</span>
                )}
              </EditableText>
            </>
          )}
        </div>
      </div>
      <TaskPriority task={task} />
      {tree && !editing && <TaskSubtaskSection task={task} tree={tree} />}
      {!editing && (
        <DialogFooter className="flex-row">
          <TaskDelete task={task} onDeleted={onClose} className="ml-auto" />
        </DialogFooter>
      )}
    </div>
  );
}

export function TaskPage() {
  const { taskId } = useParams({ from: "/home/tasks/$taskId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TaskField>();
  const task = useQuery({
    ...getTaskOptions({ path: { id: taskId } }),
    meta: { handledByRoute: true },
    initialData: () =>
      queryClient.getQueryData<Task[]>(listTasksQueryKey())?.find(({ id }) => id === taskId),
  });
  const tasks = useQuery({ ...listTasksOptions(), meta: { handledByRoute: true } });
  const tree = useMemo(() => tasks.data && taskTree(tasks.data), [tasks.data]);
  const close = () => void navigate({ to: "/" });

  useEffect(() => {
    if (!isMissingTask(task.error)) return;
    toast.error("Task not found.");
    void navigate({ to: "/", replace: true });
  }, [task.error, navigate]);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        label="Task"
        onEscapeKeyDown={(event) => {
          if (!editing) return;
          event.preventDefault();
          setEditing(undefined);
        }}
      >
        <DialogTitle className="sr-only">Task</DialogTitle>
        <DialogDescription className="sr-only">
          The task title, description, and priority. Click the title or description to edit them.
        </DialogDescription>
        {task.isPending && <Skeleton className="h-40" />}
        {task.isError && !isMissingTask(task.error) && (
          <Alert variant="destructive">
            <AlertDescription>{describeError(task.error)}</AlertDescription>
          </Alert>
        )}
        {task.data && (
          <TaskDetails
            task={task.data}
            tree={tree}
            editing={editing}
            onEdit={setEditing}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
