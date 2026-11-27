import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { MODULES, type DashboardModule } from "../modules/registry";
import { usePanelFocus } from "./panel-focus";
import { panelAt, type PanelId } from "./panels";
import type { Sidebars } from "./sidebars";

export function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function panelDigit(event: KeyboardEvent) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const match = /^Digit(\d)$/.exec(event.code);
  return match ? Number(match[1]) : undefined;
}

function isSidebarToggle(event: KeyboardEvent) {
  return (
    event.key.toLowerCase() === "b" &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !isEditable(event.target)
  );
}

export function useDesktopShortcuts({
  sidebars,
  activeModule,
}: {
  sidebars: Sidebars;
  activeModule?: DashboardModule;
}) {
  const navigate = useNavigate();
  const panelFocus = usePanelFocus();

  const goToPanel = (panel: PanelId) => {
    panelFocus?.request(panel);
    const module = MODULES.find(({ id }) => id === panel);
    if (module && !sidebars.isOpen(module.column)) sidebars.setOpen(module.column, true);
    if (!module && activeModule) void navigate({ to: "/", search: (previous) => previous });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (isSidebarToggle(event)) {
      event.preventDefault();
      sidebars.toggle(event.altKey ? "right" : "left");
      return;
    }
    const digit = panelDigit(event);
    const panel = digit === undefined ? undefined : panelAt(digit);
    if (!panel || document.querySelector('[role="dialog"]')) return;
    event.preventDefault();
    goToPanel(panel);
  };

  const latest = useRef(onKeyDown);
  latest.current = onKeyDown;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => latest.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
