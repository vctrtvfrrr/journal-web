import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { zNoteInput } from "../api/generated/zod.gen";
import { apiTrim } from "../lib/api-trim";
import { currentMinute } from "../lib/partial-date";
import { useCreateNote } from "../lib/notes";
import { describeError, fieldError } from "../lib/problem";
import { useRevealNote } from "../lib/reveal-note";
import { Field } from "./field";
import { Textarea } from "./ui/input";

const quickNote = zNoteInput.pick({ content: true });

export function QuickNoteForm({ notebookId }: { notebookId: string }) {
  const id = useId();
  const create = useCreateNote();
  const { reveal } = useRevealNote();
  const form = useForm<z.infer<typeof quickNote>>({
    resolver: zodResolver(quickNote),
    defaultValues: { content: "" },
  });
  const error = form.formState.errors.content?.message;
  const busy = form.formState.isSubmitting;

  const submit = form.handleSubmit(async ({ content }) => {
    try {
      const note = await create.mutateAsync({
        body: { notebook_id: notebookId, content, date: currentMinute() },
      });
      form.reset();
      reveal(note);
    } catch (failure) {
      form.setError("content", {
        message: fieldError(failure, "content") ?? describeError(failure),
      });
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
