import { useState } from "react";
import { currentMinute } from "../lib/partial-date";
import { useCreateNote } from "../lib/notes";
import { useRevealOnClose } from "../lib/reveal-note";
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
  const { revealOnClose, onCloseAutoFocus } = useRevealOnClose();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="New note"
          title="New note"
          className="h-7 shrink-0 px-[1.5ch] text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <span aria-hidden>+</span>
        </Button>
      </DialogTrigger>
      <DialogContent label="New note" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle className="sr-only">New note</DialogTitle>
        <DialogDescription className="sr-only">
          Write a note and choose its notebook and date.
        </DialogDescription>
        <NoteForm
          notebookId={notebookId}
          defaultValues={{ content: "", date: currentMinute() }}
          onSave={async (note) => {
            const created = await create.mutateAsync({ body: note });
            revealOnClose(created);
            setOpen(false);
          }}
          onNotebookCreated={onCreated}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
