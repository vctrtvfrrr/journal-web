import { useQuery } from "@tanstack/react-query";
import { listNotebooksOptions } from "../api/generated/@tanstack/react-query.gen";
import { describeError } from "../lib/problem";
import { useStoredState } from "../lib/stored-state";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { NotebookTab } from "./notebook-tab";
import { QuickNoteForm } from "./quick-note-form";
import { Tabs, TabsList } from "./ui/tabs";

export function useNotebooks() {
  return useQuery({ ...listNotebooksOptions(), meta: { handledByRoute: true } });
}

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
      {notebooks.data?.length === 0 && (
        <p className="text-muted-foreground">No notebooks yet. Use + to add a note.</p>
      )}
      {selected && <QuickNoteForm notebookId={selected.id} />}
      {selected && (
        <Tabs
          value={selected.id}
          onValueChange={setStoredId}
          className="gap-0 border border-border-strong bg-surface"
        >
          <TabsList aria-label="Notebooks" className="bg-surface-2">
            {notebooks.data?.map((notebook, index, all) => (
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
        </Tabs>
      )}
    </section>
  );
}
