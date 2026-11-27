import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { isEditable } from "./desktop-shortcuts";
import { isFiltering, useTimelineFilters } from "./timeline-filters";

type NotesSearch = {
  visible: boolean;
  open: () => void;
  close: () => void;
  openOnSlash: (event: KeyboardEvent<HTMLElement>) => void;
  searchField: (element: HTMLInputElement | null) => void;
};

const NotesSearchContext = createContext<NotesSearch | undefined>(undefined);

export function NotesSearchProvider({ children }: { children: ReactNode }) {
  const [filters, applyFilters] = useTimelineFilters();
  const [opened, setOpened] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);
  const focusOnMount = useRef(false);

  const searchField = useCallback((element: HTMLInputElement | null) => {
    field.current = element;
    if (!element || !focusOnMount.current) return;
    focusOnMount.current = false;
    element.focus();
  }, []);

  const open = () => {
    setOpened(true);
    if (field.current) field.current.focus();
    else focusOnMount.current = true;
  };

  const close = () => {
    setOpened(false);
    applyFilters({ q: undefined, from: undefined, to: undefined });
  };

  const openOnSlash = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "/" || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target) || !event.currentTarget.contains(event.target as Node)) return;
    event.preventDefault();
    open();
  };

  return (
    <NotesSearchContext
      value={{ visible: opened || isFiltering(filters), open, close, openOnSlash, searchField }}
    >
      {children}
    </NotesSearchContext>
  );
}

export function useNotesSearch() {
  const search = useContext(NotesSearchContext);
  if (!search) throw new Error("useNotesSearch needs a NotesSearchProvider");
  return search;
}
