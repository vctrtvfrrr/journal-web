import { PanelLeft, PanelRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Group, Panel, useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { safeLocalStorage, useStoredSet } from "../lib/stored-state";
import { cn } from "../lib/utils";
import { modulesIn, type ModuleId, type SideColumn } from "../modules/registry";
import { SectionStack, StackSeparator } from "./section-stack";

const SIDEBAR_MIN_WIDTH = 200;
const CENTER_MIN_WIDTH = 600;

function defaultSidebarWidth() {
  const width = window.innerWidth;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(width / 4, (width - CENTER_MIN_WIDTH) / 2));
}

export function useSidebars() {
  const [hidden, setHidden] = useStoredSet("journal-collapsed:columns");
  const isOpen = (side: SideColumn) => !hidden.has(side);
  const setOpen = (side: SideColumn, open: boolean) => setHidden(side, !open);
  const toggle = (side: SideColumn) => setOpen(side, !isOpen(side));
  useSidebarShortcuts(toggle);
  return { isOpen, setOpen, toggle };
}

export type Sidebars = ReturnType<typeof useSidebars>;

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function useSidebarShortcuts(toggle: (side: SideColumn) => void) {
  const latest = useRef(toggle);
  latest.current = toggle;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || !(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey || isEditable(event.target)) return;
      event.preventDefault();
      latest.current(event.altKey ? "right" : "left");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function SidebarToggles({ sidebars }: { sidebars: Sidebars }) {
  return (
    <div className="flex items-center">
      {(["left", "right"] as const).map((side) => {
        const Icon = side === "left" ? PanelLeft : PanelRight;
        return (
          <button
            key={side}
            type="button"
            aria-label={`Toggle ${side} sidebar`}
            aria-pressed={sidebars.isOpen(side)}
            title={`Toggle ${side} sidebar (${side === "left" ? "Ctrl+B" : "Ctrl+Alt+B"})`}
            className={cn(
              "px-[0.5ch] text-muted-foreground hover:text-foreground",
              sidebars.isOpen(side) && "text-foreground",
            )}
            onClick={() => sidebars.toggle(side)}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

export function DashboardColumns({
  sidebars,
  center,
  activeModule,
}: {
  sidebars: Sidebars;
  center: ReactNode;
  activeModule?: ModuleId;
}) {
  const layout = useDefaultLayout({ id: "journal-layout:columns", storage: safeLocalStorage });

  return (
    <Group
      className="h-full"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={(next, meta) => {
        layout.onLayoutChanged(next, meta);
        if (!meta.isUserInteraction) return;
        for (const side of ["left", "right"] as const) {
          const open = (next[side] ?? 0) > 0;
          if (open !== sidebars.isOpen(side)) sidebars.setOpen(side, open);
        }
      }}
    >
      <Sidebar side="left" sidebars={sidebars} activeModule={activeModule} />
      <StackSeparator orientation="horizontal" />
      <Panel id="center" minSize={CENTER_MIN_WIDTH}>
        {center}
      </Panel>
      <StackSeparator orientation="horizontal" />
      <Sidebar side="right" sidebars={sidebars} activeModule={activeModule} />
    </Group>
  );
}

function Sidebar({
  side,
  sidebars,
  activeModule,
}: {
  side: SideColumn;
  sidebars: Sidebars;
  activeModule?: ModuleId;
}) {
  const panel = usePanelRef();
  const open = sidebars.isOpen(side);

  useEffect(() => {
    if (open) panel.current?.expand();
    else panel.current?.collapse();
  }, [open]);

  return (
    <Panel
      id={side}
      panelRef={panel}
      collapsible
      collapsedSize={0}
      minSize={SIDEBAR_MIN_WIDTH}
      defaultSize={defaultSidebarWidth()}
      groupResizeBehavior="preserve-pixel-size"
    >
      {open && (
        <aside aria-label={`${side === "left" ? "Left" : "Right"} sidebar`} className="h-full">
          <SectionStack
            id={`${side}-sidebar`}
            sections={modulesIn(side).map((module) => ({
              id: module.id,
              title: module.title,
              content: <module.Widget />,
              demo: module.demo,
              moduleHref: `/${module.id}`,
              active: module.id === activeModule,
            }))}
          />
        </aside>
      )}
    </Panel>
  );
}
