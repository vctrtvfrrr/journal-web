import { createContext, type ReactNode, useContext, useState } from "react";
import type { Note } from "../api/generated";

type NoteToReveal = Pick<Note, "id" | "notebook_id">;

const RevealNoteContext = createContext<{
  target: NoteToReveal | undefined;
  reveal: (note: NoteToReveal) => void;
  finishReveal: () => void;
} | null>(null);

export function RevealNoteProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<NoteToReveal>();
  const value = {
    target,
    reveal: (note: NoteToReveal) => setTarget({ id: note.id, notebook_id: note.notebook_id }),
    finishReveal: () => setTarget(undefined),
  };
  return <RevealNoteContext.Provider value={value}>{children}</RevealNoteContext.Provider>;
}

export function useRevealNote() {
  const context = useContext(RevealNoteContext);
  if (!context) throw new Error("useRevealNote must be used within RevealNoteProvider");
  return context;
}
