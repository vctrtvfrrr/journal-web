import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Notebook } from "../api/generated";
import {
  archiveNotebookMutation,
  listNotebooksQueryKey,
  updateNotebookMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { zUpdateNotebookBody } from "../api/generated/zod.gen";
import { apiTrim } from "../lib/api-trim";
import { describeError, fieldError } from "../lib/problem";
import { ConfirmDialog } from "./confirm-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { Input } from "./ui/input";
import { TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function NotebookRename({ notebook, onDone }: { notebook: Notebook; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const finished = useRef(false);
  const rename = useMutation({
    ...updateNotebookMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listNotebooksQueryKey() }),
  });

  const finish = () => {
    finished.current = true;
    onDone();
  };

  const save = async (value: string) => {
    if (finished.current || rename.isPending) return;
    const name = apiTrim(value);
    if (name === notebook.name) return finish();
    const parsed = zUpdateNotebookBody.safeParse({ name });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    try {
      await rename.mutateAsync({ path: { id: notebook.id }, body: { name } });
      finish();
    } catch (failure) {
      setError(fieldError(failure, "name") ?? describeError(failure));
    }
  };

  return (
    <Tooltip open={!!error}>
      <TooltipTrigger asChild>
        <Input
          aria-label="Notebook name"
          aria-invalid={!!error}
          defaultValue={notebook.name}
          readOnly={rename.isPending}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          className="h-7 w-[22ch]"
          onChange={() => setError(undefined)}
          onBlur={(event) => void save(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save(event.currentTarget.value);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              finish();
            }
          }}
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">{error}</TooltipContent>
    </Tooltip>
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
