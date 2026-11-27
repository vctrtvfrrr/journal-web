import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PanelId } from "./panels";

type PanelFocus = {
  pending: PanelId | undefined;
  request: (panel: PanelId) => void;
  settle: (panel: PanelId) => void;
};

const PanelFocusContext = createContext<PanelFocus | undefined>(undefined);

export function PanelFocusProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PanelId>();
  useEffect(() => {
    if (!pending) return;
    const cancel = () => setPending(undefined);
    window.addEventListener("keydown", cancel, { capture: true, once: true });
    window.addEventListener("pointerdown", cancel, { capture: true, once: true });
    return () => {
      window.removeEventListener("keydown", cancel, { capture: true });
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
