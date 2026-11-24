import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createTaskMutation, listTasksQueryKey } from "../api/generated/@tanstack/react-query.gen";
import { zCreateTaskBody } from "../api/generated/zod.gen";
import { apiTrim } from "../lib/api-trim";
import { describeError, fieldErrors, isProblem } from "../lib/problem";
import { Field } from "./field";
import { Button } from "./ui/button";
import { PromptInput } from "./ui/input";

const titleForm = zCreateTaskBody.pick({ title: true });

export function TaskCreateForm() {
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
      await create.mutateAsync({ body: { title } });
      form.reset();
    } catch (failure) {
      const titleError = isProblem(failure)
        ? fieldErrors(failure).find(({ pointer }) => pointer === "#/title")
        : undefined;
      form.setError("title", { message: titleError?.detail ?? describeError(failure) });
    }
  });

  return (
    <form className="flex min-w-0 items-start gap-[1ch]" onSubmit={submit} noValidate>
      <Field
        label="Task title"
        htmlFor={id}
        error={error}
        className="min-w-0 flex-1 [&_label]:sr-only"
      >
        <PromptInput
          id={id}
          placeholder="Add a task..."
          readOnly={busy}
          aria-invalid={!!error}
          {...form.register("title", { setValueAs: apiTrim })}
        />
      </Field>
      <Button type="submit" aria-label="Add task" disabled={busy}>
        <span aria-hidden>+</span> Add
      </Button>
    </form>
  );
}
