import { Search } from "lucide-react";
import { useNotesSearch } from "../lib/notes-search";
import { Button } from "./ui/button";

export function NotesSearchToggle() {
  const search = useNotesSearch();
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label="Search notes"
      title="Search notes (/)"
      aria-keyshortcuts="/"
      aria-expanded={search.visible}
      className="ml-auto h-7 shrink-0 px-[1.5ch] text-muted-foreground hover:bg-transparent hover:text-foreground aria-expanded:text-accent-ink"
      onClick={search.visible ? search.close : search.open}
    >
      <Search className="size-3.5" aria-hidden />
    </Button>
  );
}
