import { useEffect } from "react";
import { useNotebooks } from "../lib/notebooks";
import { useRevealNote } from "../lib/reveal-note";
import { useStoredState } from "../lib/stored-state";
import { LoadError } from "./load-error";
import { Skeleton } from "./ui/skeleton";
import { NewNoteDialog } from "./new-note-dialog";
import { NotebookTab } from "./notebook-tab";
import { QuickNoteForm } from "./quick-note-form";
import { NotesTimeline } from "./notes-timeline";
import { Tabs, TabsContent, TabsList } from "./ui/tabs";

export function NotesPanel() {
  const notebooks = useNotebooks();
  const [storedId, setStoredId] = useStoredState<string>("journal-notebook", "");
  const revealedNotebook = useRevealNote().target?.notebook_id;
  useEffect(() => {
    if (revealedNotebook) setStoredId(revealedNotebook);
  }, [revealedNotebook]);
  const selected = notebooks.data?.find(({ id }) => id === storedId) ?? notebooks.data?.[0];

  return (
    <section
      aria-labelledby="notes-heading"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3"
    >
      <h2 id="notes-heading" className="sr-only">
        Notes
      </h2>
      {notebooks.isPending && <Skeleton className="h-24" aria-hidden />}
      {notebooks.isError && (
        <LoadError error={notebooks.error} onRetry={() => void notebooks.refetch()} />
      )}
      {selected && <QuickNoteForm notebookId={selected.id} />}
      {notebooks.data && (
        <Tabs value={selected?.id ?? ""} onValueChange={setStoredId} className="gap-0">
          <div className="flex min-w-0 items-end shadow-[inset_0_-1px_0_0_var(--border-strong)]">
            {selected ? (
              <TabsList aria-label="Notebooks" className="w-auto min-w-0 shadow-none">
                {notebooks.data.map((notebook, index, all) => (
                  <NotebookTab
                    key={notebook.id}
                    notebook={notebook}
                    selected={notebook.id === selected.id}
                    onDeleted={() => {
                      if (notebook.id !== selected.id) return;
                      setStoredId((all[index - 1] ?? all[index + 1])?.id ?? "");
                    }}
                  />
                ))}
              </TabsList>
            ) : (
              <p className="flex-1 self-center px-[1ch] text-muted-foreground">
                No notebooks yet. Use + to add a note.
              </p>
            )}
            <NewNoteDialog notebookId={selected?.id} onCreated={setStoredId} />
          </div>
          {selected && (
            <TabsContent value={selected.id} className="min-w-0">
              <NotesTimeline key={selected.id} notebook={selected.id} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </section>
  );
}
