import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PanelId } from "./panels";

type PanelFocus = {
  pending: PanelId | undefined;
  request: (panel: PanelId) => void;
  settle: (panel: PanelId) => void;
};

const MODIFIERS = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift"]);

const PanelFocusContext = createContext<PanelFocus | undefined>(undefined);

export function PanelFocusProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PanelId>();
  useEffect(() => {
    if (!pending) return;
    const cancel = () => setPending(undefined);
    const cancelUnlessModifier = (event: KeyboardEvent) => {
      if (!MODIFIERS.has(event.key)) cancel();
    };
    window.addEventListener("keydown", cancelUnlessModifier, { capture: true });
    window.addEventListener("pointerdown", cancel, { capture: true, once: true });
    return () => {
      window.removeEventListener("keydown", cancelUnlessModifier, { capture: true });
      window.removeEventListener("pointerdown", cancel, { capture: true });
    };
  }, [pending]);
  const focus: PanelFocus = {
    pending,
    request: setPending,
    settle: (panel) => setPending((current) => (current === panel ? undefined : current)),
  };
  return <PanelFocusContext value={focus}>{children}</PanelFocusContext>;
}

export function usePanelFocus() {
  return useContext(PanelFocusContext);
}
