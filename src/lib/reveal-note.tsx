import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import type { Note } from "../api/generated";

type NoteToReveal = Pick<Note, "id" | "notebook_id" | "date">;

const RevealNoteContext = createContext<{
  target: NoteToReveal | undefined;
  reveal: (note: NoteToReveal) => void;
  finishReveal: () => void;
} | null>(null);

export function RevealNoteProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<NoteToReveal>();
  const value = {
    target,
    reveal: (note: NoteToReveal) =>
      setTarget({ id: note.id, notebook_id: note.notebook_id, date: note.date }),
    finishReveal: () => setTarget(undefined),
  };
  return <RevealNoteContext.Provider value={value}>{children}</RevealNoteContext.Provider>;
}

export function useRevealNote() {
  const context = useContext(RevealNoteContext);
  if (!context) throw new Error("useRevealNote must be used within RevealNoteProvider");
  return context;
}

// Chrome ignores a smooth scrollIntoView while a modal locks the page scroll,
// so a dialog reveals its note only once it has fully closed.
export function useRevealOnClose() {
  const { reveal } = useRevealNote();
  const pending = useRef<NoteToReveal>(undefined);
  return {
    revealOnClose: (note: NoteToReveal) => {
      pending.current = note;
    },
    onCloseAutoFocus: () => {
      if (pending.current) reveal(pending.current);
      pending.current = undefined;
    },
  };
}
