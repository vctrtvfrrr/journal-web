import { useState } from "react";
import { currentMinute } from "../lib/partial-date";
import { useCreateNote } from "../lib/notes";
import { useRevealNote } from "../lib/reveal-note";
import { NoteForm } from "./note-form";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";

export function NewNoteDialog({
  notebookId,
  onCreated,
}: {
  notebookId: string | undefined;
  onCreated: (notebookId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const create = useCreateNote();
  const { reveal } = useRevealNote();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label="New note" title="New note">
          <span aria-hidden>+</span>
        </Button>
      </DialogTrigger>
      <DialogContent label="New note">
        <DialogTitle className="sr-only">New note</DialogTitle>
        <DialogDescription className="sr-only">
          Write a note and choose its notebook and date.
        </DialogDescription>
        <NoteForm
          notebookId={notebookId}
          defaultValues={{ content: "", date: currentMinute() }}
          onSave={async (note) => {
            const created = await create.mutateAsync({ body: note });
            setOpen(false);
            reveal(created);
          }}
          onNotebookCreated={onCreated}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
