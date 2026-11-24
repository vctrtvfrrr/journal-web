import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createNoteMutation } from "../api/generated/@tanstack/react-query.gen";
import { currentMinute } from "../lib/partial-date";
import { notesQueryKey } from "../lib/query-keys";
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
  const queryClient = useQueryClient();
  const create = useMutation({
    ...createNoteMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesQueryKey }),
  });

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
            await create.mutateAsync({ body: note });
            onCreated(note.notebook_id);
            setOpen(false);
          }}
          onNotebookCreated={onCreated}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
