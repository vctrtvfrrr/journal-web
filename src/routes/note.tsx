import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Note } from "../api/generated";
import {
  deleteNoteMutation,
  getNoteOptions,
  getNoteQueryKey,
  updateNoteMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { ConfirmDialog } from "../components/confirm-dialog";
import { NoteForm } from "../components/note-form";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "../components/ui/sonner";
import { describeError, isProblem } from "../lib/problem";
import { timelineQueryKey } from "../lib/notes";

function isMissingNote(error: unknown) {
  return isProblem(error) && (error.status === 404 || error.status === 400);
}

function NoteDelete({ note, onDeleted }: { note: Note; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const remove = useMutation({
    ...deleteNoteMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: timelineQueryKey(note.notebook_id) });
      setOpen(false);
      onDeleted();
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="ml-auto"
          aria-label="Delete note"
        >
          <span aria-hidden>delete</span>
        </Button>
      }
      title="Delete note?"
      description="Remove this note from its timeline?"
      confirmLabel="delete note"
      status={remove}
      onConfirm={() => remove.mutate({ path: { id: note.id } })}
    />
  );
}

function NoteEditForm({ note, onDone }: { note: Note; onDone: () => void }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    ...updateNoteMutation(),
    meta: { showsOwnError: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(getNoteQueryKey({ path: { id: note.id } }), saved);
      return Promise.all(
        [note.notebook_id, saved.notebook_id].map((notebook) =>
          queryClient.invalidateQueries({ queryKey: timelineQueryKey(notebook) }),
        ),
      );
    },
  });

  return (
    <NoteForm
      notebookId={note.notebook_id}
      defaultValues={{ content: note.content, date: note.date }}
      onSave={async (changes) => {
        await update.mutateAsync({ path: { id: note.id }, body: changes });
        onDone();
      }}
      onCancel={onDone}
      extraAction={<NoteDelete note={note} onDeleted={onDone} />}
    />
  );
}

export function NotePage() {
  const { noteId } = useParams({ from: "/home/notes/$noteId" });
  const navigate = useNavigate();
  const note = useQuery({
    ...getNoteOptions({ path: { id: noteId } }),
    meta: { handledByRoute: true },
  });
  const close = () => void navigate({ to: "/" });

  useEffect(() => {
    if (!isMissingNote(note.error)) return;
    toast.error("Note not found.");
    void navigate({ to: "/", replace: true });
  }, [note.error, navigate]);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent label="Edit note">
        <DialogTitle className="sr-only">Edit note</DialogTitle>
        <DialogDescription className="sr-only">
          Change the note content, notebook, or date.
        </DialogDescription>
        {note.isPending && <Skeleton className="h-40" />}
        {note.isError && !isMissingNote(note.error) && (
          <Alert variant="destructive">
            <AlertDescription>{describeError(note.error)}</AlertDescription>
          </Alert>
        )}
        {note.data && <NoteEditForm note={note.data} onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}
