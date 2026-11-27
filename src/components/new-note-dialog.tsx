import { currentMinute } from "../lib/partial-date";
import { useCreateNote } from "../lib/notes";
import { useRevealOnClose } from "../lib/reveal-note";
import { NoteForm } from "./note-form";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

export function NewNoteDialog({
  open,
  onOpenChange,
  notebookId,
  content,
  onCreated,
  onNotebookCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebookId: string;
  content: string;
  onCreated: () => void;
  onNotebookCreated: (notebookId: string) => void;
}) {
  const create = useCreateNote();
  const { revealOnClose, onCloseAutoFocus } = useRevealOnClose();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent label="New note" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle className="sr-only">New note</DialogTitle>
        <DialogDescription className="sr-only">
          Write a note and choose its notebook and date.
        </DialogDescription>
        <NoteForm
          notebookId={notebookId}
          defaultValues={{ content, date: currentMinute() }}
          onSave={async (note) => {
            const created = await create.mutateAsync({ body: note });
            revealOnClose(created);
            onCreated();
            onOpenChange(false);
          }}
          onNotebookCreated={onNotebookCreated}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
