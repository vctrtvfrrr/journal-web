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
import { isFiltering, NO_FILTERS, useTimelineFilters } from "./timeline-filters";

type NotesSearch = {
  visible: boolean;
  open: () => void;
  close: () => void;
  openOnSlash: (event: KeyboardEvent<HTMLElement>) => void;
  searchFieldRef: (element: HTMLInputElement | null) => void;
};

const NotesSearchContext = createContext<NotesSearch | undefined>(undefined);

export function NotesSearchProvider({ children }: { children: ReactNode }) {
  const [filters, applyFilters] = useTimelineFilters();
  const [opened, setOpened] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);
  const focusOnMount = useRef(false);

  const searchFieldRef = useCallback((element: HTMLInputElement | null) => {
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
    applyFilters(NO_FILTERS);
  };

  const openOnSlash = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "/" || event.defaultPrevented) return;
    // AltGr reaches the browser as Ctrl+Alt, and some layouts type "/" with it.
    if (event.metaKey || event.ctrlKey !== event.altKey) return;
    if (isEditable(event.target) || !event.currentTarget.contains(event.target as Node)) return;
    event.preventDefault();
    open();
  };

  return (
    <NotesSearchContext
      value={{ visible: opened || isFiltering(filters), open, close, openOnSlash, searchFieldRef }}
    >
      {children}
    </NotesSearchContext>
  );
}

export function useNotesSearch() {
  const search = useContext(NotesSearchContext);
  if (!search) throw new Error("useNotesSearch must be used within NotesSearchProvider");
  return search;
}
