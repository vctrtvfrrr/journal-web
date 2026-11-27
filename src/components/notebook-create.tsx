import { useState } from "react";
import { zCreateNotebookBody } from "../api/generated/zod.gen";
import { useCreateNotebook } from "../lib/notebooks";
import { describeError, fieldError } from "../lib/problem";
import { NotebookNameInput } from "./notebook-name-input";
import { Button } from "./ui/button";

export function NotebookCreate({ onCreated }: { onCreated: (notebookId: string) => void }) {
  const [naming, setNaming] = useState(false);
  const create = useCreateNotebook();

  if (naming)
    return (
      <NotebookNameInput
        label="New notebook name"
        placeholder="Notebook name"
        onDone={() => setNaming(false)}
        onSave={async (name) => {
          if (!name) return;
          const parsed = zCreateNotebookBody.safeParse({ name });
          if (!parsed.success) return parsed.error.issues[0]?.message ?? parsed.error.message;
          try {
            const notebook = await create.mutateAsync({ body: { name } });
            onCreated(notebook.id);
          } catch (failure) {
            return fieldError(failure, "name") ?? describeError(failure);
          }
        }}
      />
    );

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label="New notebook"
      title="New notebook"
      className="h-7 shrink-0 px-[1.5ch] text-muted-foreground hover:bg-transparent hover:text-foreground"
      onClick={() => setNaming(true)}
    >
      <span aria-hidden>+</span>
    </Button>
  );
}
