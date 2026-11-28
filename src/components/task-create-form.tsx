import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createTaskMutation, listTasksQueryKey } from "../api/generated/@tanstack/react-query.gen";
import { zCreateTaskBody } from "../api/generated/zod.gen";
import { apiTrim } from "../lib/api-trim";
import { describeError, fieldError } from "../lib/problem";
import { Field } from "./field";
import { Button } from "./ui/button";
import { PromptInput } from "./ui/input";

const titleForm = zCreateTaskBody.pick({ title: true });

export function TaskCreateForm({ parentId }: { parentId?: string }) {
  const id = useId();
  const queryClient = useQueryClient();
  const create = useMutation({
    ...createTaskMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listTasksQueryKey() }),
  });
  const form = useForm<z.infer<typeof titleForm>>({
    resolver: zodResolver(titleForm),
    defaultValues: { title: "" },
  });
  const error = form.formState.errors.title?.message;
  const busy = form.formState.isSubmitting;

  const submit = form.handleSubmit(async ({ title }) => {
    try {
      await create.mutateAsync({ body: parentId ? { title, parent_id: parentId } : { title } });
      form.reset();
    } catch (failure) {
      const message =
        fieldError(failure, "title") ?? fieldError(failure, "parent_id") ?? describeError(failure);
      form.setError("title", { message });
    }
  });

  return (
    <form className="mb-2 flex min-w-0 items-start gap-[1ch]" onSubmit={submit} noValidate>
      <Field
        label={parentId ? "Subtask title" : "Task title"}
        htmlFor={id}
        error={error}
        className="min-w-0 flex-1 [&_label]:sr-only"
      >
        <PromptInput
          id={id}
          placeholder={parentId ? "Add a subtask..." : "Add a task..."}
          readOnly={busy}
          aria-invalid={!!error}
          {...form.register("title", { setValueAs: apiTrim })}
        />
      </Field>
      <Button type="submit" aria-label={parentId ? "Add subtask" : "Add task"} disabled={busy}>
        <span aria-hidden>+</span> add
      </Button>
    </form>
  );
}
