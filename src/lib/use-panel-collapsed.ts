import { useEffect, type RefObject } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

export function usePanelCollapsed(
  panel: RefObject<PanelImperativeHandle | null>,
  collapsed: boolean,
) {
  useEffect(() => {
    if (collapsed) panel.current?.collapse();
    else panel.current?.expand();
  }, [collapsed]);
}
