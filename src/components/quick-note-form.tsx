import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { zNoteInput } from "../api/generated/zod.gen";
import { apiTrim } from "../lib/api-trim";
import { currentMinute } from "../lib/partial-date";
import { useCreateNote } from "../lib/notes";
import { describeError, fieldError } from "../lib/problem";
import { useRevealNote } from "../lib/reveal-note";
import { Field } from "./field";
import { NewNoteDialog } from "./new-note-dialog";
import { Button } from "./ui/button";
import { PromptInput } from "./ui/input";

const quickNote = zNoteInput.pick({ content: true });

export function QuickNoteForm({
  notebookId,
  onNotebookCreated,
}: {
  notebookId: string;
  onNotebookCreated: (notebookId: string) => void;
}) {
  const id = useId();
  const create = useCreateNote();
  const { reveal } = useRevealNote();
  const [fullFormOpen, setFullFormOpen] = useState(false);
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
    <>
      <form className="flex min-w-0 items-start gap-[1ch] py-2" onSubmit={submit} noValidate>
        <Field
          label="Quick note"
          htmlFor={id}
          error={error}
          className="min-w-0 flex-1 [&_label]:sr-only"
        >
          <PromptInput
            id={id}
            placeholder="Add a note..."
            autoComplete="off"
            readOnly={busy}
            aria-invalid={!!error}
            {...form.register("content", { setValueAs: apiTrim })}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
              event.preventDefault();
              void submit();
            }}
          />
        </Field>
        <Button
          type="button"
          aria-label="New note"
          title="Open the full note form"
          disabled={busy}
          onClick={() => setFullFormOpen(true)}
        >
          <span aria-hidden>+</span> note
        </Button>
      </form>
      <NewNoteDialog
        open={fullFormOpen}
        onOpenChange={setFullFormOpen}
        notebookId={notebookId}
        content={form.getValues("content")}
        onCreated={() => form.reset()}
        onNotebookCreated={onNotebookCreated}
      />
    </>
  );
}
