import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useId, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { NoteInput } from "../api/generated";
import { zNoteInput } from "../api/generated/zod.gen";
import { apiTrim } from "../lib/api-trim";
import { useCreateNotebook, useNotebooks } from "../lib/notebooks";
import { describeError, fieldErrors, isProblem, pointerField } from "../lib/problem";
import { ErrorText, Field } from "./field";
import { type NotebookChoice, NotebookPicker } from "./notebook-picker";
import { Button } from "./ui/button";
import { DialogFooter } from "./ui/dialog";
import { Input, Textarea } from "./ui/input";

const noteForm = zNoteInput.pick({ content: true, date: true });
type NoteForm = z.infer<typeof noteForm>;

const DATE_HINT = "YYYY, YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH, or YYYY-MM-DDTHH:MM";

export function NoteForm({
  notebookId,
  defaultValues,
  onSave,
  onNotebookCreated,
  onCancel,
  extraAction,
}: {
  notebookId: string | undefined;
  defaultValues: NoteForm;
  onSave: (note: NoteInput) => Promise<unknown>;
  onNotebookCreated?: (notebookId: string) => void;
  onCancel: () => void;
  extraAction?: ReactNode;
}) {
  const id = useId();
  const notebooks = useNotebooks();
  const current = notebooks.data?.find((notebook) => notebook.id === notebookId);
  const [picked, setChoice] = useState<NotebookChoice>();
  const choice = picked ?? current;
  const [notebookError, setNotebookError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const createNotebook = useCreateNotebook();
  const form = useForm<NoteForm>({ resolver: zodResolver(noteForm), defaultValues });
  const { errors, isSubmitting } = form.formState;

  const showFailure = (failure: unknown) => {
    if (!isProblem(failure)) return setFormError(describeError(failure));
    const invalidFields = fieldErrors(failure);
    if (invalidFields.length === 0) return setFormError(failure.detail);
    for (const { pointer, detail } of invalidFields) {
      const field = pointerField(pointer);
      if (field === "content" || field === "date") form.setError(field, { message: detail });
      else if (field === "notebook_id" || field === "name") setNotebookError(detail);
      else setFormError(`${field}: ${detail}`);
    }
  };

  const submit = form.handleSubmit(async ({ content, date }) => {
    setFormError(undefined);
    setNotebookError(undefined);
    if (!choice) return setNotebookError("Choose or create a notebook.");
    try {
      let notebook_id = choice.id;
      if (!notebook_id) {
        const created = await createNotebook.mutateAsync({ body: { name: choice.name } });
        notebook_id = created.id;
        setChoice(created);
        onNotebookCreated?.(created.id);
      }
      await onSave({ notebook_id, content, date });
    } catch (failure) {
      showFailure(failure);
    }
  });

  return (
    <form className="grid gap-3" onSubmit={submit} noValidate>
      <Field label="Notebook" htmlFor={`${id}-notebook`} error={notebookError}>
        <NotebookPicker
          id={`${id}-notebook`}
          notebooks={notebooks.data ?? []}
          value={choice}
          onChange={(next) => {
            setNotebookError(undefined);
            setChoice(next);
          }}
          invalid={!!notebookError}
        />
      </Field>
      <Field label="Content" htmlFor={`${id}-content`} error={errors.content?.message}>
        <Textarea
          id={`${id}-content`}
          className="h-[12lh] resize-none field-sizing-fixed"
          aria-invalid={!!errors.content}
          {...form.register("content", { setValueAs: apiTrim })}
        />
      </Field>
      <Field label="Date" htmlFor={`${id}-date`} error={errors.date?.message} hint={DATE_HINT}>
        <Input
          id={`${id}-date`}
          aria-invalid={!!errors.date}
          autoComplete="off"
          {...form.register("date", { setValueAs: apiTrim })}
        />
      </Field>
      {formError && <ErrorText>{formError}</ErrorText>}
      <DialogFooter className="flex-row">
        <Button variant="default" size="sm" type="submit" disabled={isSubmitting}>
          save
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          cancel
        </Button>
        {extraAction}
      </DialogFooter>
    </form>
  );
}
