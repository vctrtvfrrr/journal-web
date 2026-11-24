import { Check } from "lucide-react";
import { useState } from "react";
import type { Notebook } from "../api/generated";
import { apiTrim } from "../lib/api-trim";
import { cn } from "../lib/utils";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type NotebookChoice = { id: string; name: string } | { id?: undefined; name: string };

export function NotebookPicker({
  id,
  notebooks,
  value,
  onChange,
  invalid,
}: {
  id: string;
  notebooks: Notebook[];
  value: NotebookChoice | undefined;
  onChange: (choice: NotebookChoice) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const newName = apiTrim(search);
  const offersCreate =
    newName !== "" && !notebooks.some(({ name }) => name.toLowerCase() === newName.toLowerCase());

  const choose = (choice: NotebookChoice) => {
    onChange(choice);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className="flex h-7 w-full items-center justify-between gap-[1ch] border border-border-strong bg-background px-[1ch] text-left outline-none focus-visible:border-accent aria-invalid:border-red-ink data-[state=open]:border-accent"
        >
          <span className={cn("truncate", !value && "text-muted-foreground/70")}>
            {value ? value.name : "Choose a notebook..."}
            {value && !value.id && <span className="text-muted-foreground"> (new)</span>}
          </span>
          <span aria-hidden className="text-xs text-muted-foreground">
            [▾]
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={2}
        className="w-(--radix-popover-trigger-width) min-w-56 p-0 py-0 shadow-tui"
      >
        <Command>
          <CommandInput
            placeholder="Find or create a notebook..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              {notebooks.map((notebook) => (
                <CommandItem
                  key={notebook.id}
                  value={notebook.name}
                  onSelect={() => choose({ id: notebook.id, name: notebook.name })}
                >
                  <Check className={cn(notebook.id === value?.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{notebook.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {offersCreate && (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`Create "${newName}"`}
                  onSelect={() => choose({ name: newName })}
                >
                  <span aria-hidden>+</span>
                  <span className="truncate">Create "{newName}"</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
