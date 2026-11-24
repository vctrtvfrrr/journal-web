import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createNoteMutation } from "../api/generated/@tanstack/react-query.gen";
import { zCreateNoteBody } from "../api/generated/zod.gen";
import { apiTrim } from "../lib/api-trim";
import { currentMinute } from "../lib/partial-date";
import { notesQueryKey } from "../lib/query-keys";
import { describeError, fieldErrors, isProblem } from "../lib/problem";
import { Field } from "./field";
import { Textarea } from "./ui/input";

const quickNote = zCreateNoteBody.pick({ content: true });

export function QuickNoteForm({ notebookId }: { notebookId: string }) {
  const id = useId();
  const queryClient = useQueryClient();
  const create = useMutation({
    ...createNoteMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesQueryKey }),
  });
  const form = useForm<z.infer<typeof quickNote>>({
    resolver: zodResolver(quickNote),
    defaultValues: { content: "" },
  });
  const error = form.formState.errors.content?.message;
  const busy = form.formState.isSubmitting;

  const submit = form.handleSubmit(async ({ content }) => {
    try {
      await create.mutateAsync({
        body: { notebook_id: notebookId, content, date: currentMinute() },
      });
      form.reset();
    } catch (failure) {
      const contentError = isProblem(failure)
        ? fieldErrors(failure).find(({ pointer }) => pointer === "#/content")
        : undefined;
      form.setError("content", { message: contentError?.detail ?? describeError(failure) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Quick note" htmlFor={id} error={error} className="[&_label]:sr-only">
        <Textarea
          id={id}
          rows={2}
          placeholder="Add a note... (Ctrl+Enter to save)"
          readOnly={busy}
          aria-invalid={!!error}
          className="max-h-[calc(10lh+0.5rem)] min-h-[calc(2lh+0.5rem)] resize-none"
          {...form.register("content", { setValueAs: apiTrim })}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            if (apiTrim(event.currentTarget.value)) void submit();
          }}
        />
      </Field>
    </form>
  );
}
