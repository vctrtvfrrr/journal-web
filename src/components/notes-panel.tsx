import { useNotebooks } from "../lib/notebooks";
import { describeError } from "../lib/problem";
import { useStoredState } from "../lib/stored-state";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { NewNoteDialog } from "./new-note-dialog";
import { NotebookTab } from "./notebook-tab";
import { QuickNoteForm } from "./quick-note-form";
import { Tabs, TabsList } from "./ui/tabs";

export function NotesPanel() {
  const notebooks = useNotebooks();
  const [storedId, setStoredId] = useStoredState<string>("journal-notebook", "");
  const selected = notebooks.data?.find(({ id }) => id === storedId) ?? notebooks.data?.[0];

  return (
    <section aria-labelledby="notes-heading" className="grid min-w-0 content-start gap-3">
      <h2 id="notes-heading" className="sr-only">
        Notes
      </h2>
      {notebooks.isPending && <Skeleton className="h-24" aria-hidden />}
      {notebooks.isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-[1ch]">
            {describeError(notebooks.error)}
            <Button
              type="button"
              variant="bracket"
              size="sm"
              onClick={() => void notebooks.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {selected && <QuickNoteForm notebookId={selected.id} />}
      {notebooks.data && (
        <Tabs
          value={selected?.id ?? ""}
          onValueChange={setStoredId}
          className="gap-0 border border-border-strong bg-surface"
        >
          <div className="flex min-w-0 items-end bg-surface-2 shadow-[inset_0_-1px_0_0_var(--border-strong)]">
            {selected ? (
              <TabsList aria-label="Notebooks" className="min-w-0 flex-1 shadow-none">
                {notebooks.data.map((notebook, index, all) => (
                  <NotebookTab
                    key={notebook.id}
                    notebook={notebook}
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
            <div className="shrink-0 border-l border-border px-[0.5ch]">
              <NewNoteDialog notebookId={selected?.id} onCreated={setStoredId} />
            </div>
          </div>
        </Tabs>
      )}
    </section>
  );
}
