import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Notebook } from "../api/generated";
import {
  archiveNotebookMutation,
  listNotebooksQueryKey,
  updateNotebookMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { zUpdateNotebookBody } from "../api/generated/zod.gen";
import { describeError, fieldError } from "../lib/problem";
import { ConfirmDialog } from "./confirm-dialog";
import { NotebookNameInput } from "./notebook-name-input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { TabsTrigger } from "./ui/tabs";

function NotebookRename({ notebook, onDone }: { notebook: Notebook; onDone: () => void }) {
  const queryClient = useQueryClient();
  const rename = useMutation({
    ...updateNotebookMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listNotebooksQueryKey() }),
  });

  return (
    <NotebookNameInput
      label="Notebook name"
      defaultValue={notebook.name}
      onDone={onDone}
      onSave={async (name) => {
        if (name === notebook.name) return;
        const parsed = zUpdateNotebookBody.safeParse({ name });
        if (!parsed.success) return parsed.error.issues[0]?.message ?? parsed.error.message;
        try {
          await rename.mutateAsync({ path: { id: notebook.id }, body: { name } });
        } catch (failure) {
          return fieldError(failure, "name") ?? describeError(failure);
        }
      }}
    />
  );
}

function NotebookDelete({
  notebook,
  open,
  onOpenChange,
  onDeleted,
}: {
  notebook: Notebook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    ...archiveNotebookMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => {
      onDeleted();
      onOpenChange(false);
      return queryClient.invalidateQueries({ queryKey: listNotebooksQueryKey() });
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete notebook?"
      description={`Delete notebook ${notebook.name}? Its notes will disappear from the timeline.`}
      confirmLabel="delete notebook"
      status={remove}
      onConfirm={() => remove.mutate({ path: { id: notebook.id } })}
    />
  );
}

export function NotebookTab({
  notebook,
  selected,
  onDeleted,
}: {
  notebook: Notebook;
  selected: boolean;
  onDeleted: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const tab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selected) tab.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selected]);

  if (renaming) return <NotebookRename notebook={notebook} onDone={() => setRenaming(false)} />;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TabsTrigger
            ref={tab}
            value={notebook.id}
            onDoubleClick={() => setRenaming(true)}
            onKeyDown={(event) => {
              if (event.key === "F2") setRenaming(true);
            }}
          >
            {notebook.name}
          </TabsTrigger>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={(event) => event.preventDefault()}>
          <ContextMenuItem onSelect={() => setRenaming(true)}>Rename</ContextMenuItem>
          <ContextMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <NotebookDelete
        notebook={notebook}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onDeleted}
      />
    </>
  );
}
