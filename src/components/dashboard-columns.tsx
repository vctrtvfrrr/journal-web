import { PanelLeft, PanelRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Group, Panel, useDefaultLayout, useGroupRef, usePanelRef } from "react-resizable-panels";
import {
  CENTER_MIN_WIDTH,
  defaultSidebarWidth,
  SIDEBAR_MIN_WIDTH,
  useFitColumns,
} from "../lib/fit-columns";
import { SIDES, type Sidebars } from "../lib/sidebars";
import { safeLocalStorage } from "../lib/stored-state";
import { usePanelCollapsed } from "../lib/use-panel-collapsed";
import { cn } from "../lib/utils";
import { modulesIn, type ModuleId, type SideColumn } from "../modules/registry";
import { moduleSection, SectionStack, StackSeparator } from "./section-stack";

const sideUi = {
  left: { name: "Left", shortcut: "Ctrl+B", Icon: PanelLeft },
  right: { name: "Right", shortcut: "Ctrl+Alt+B", Icon: PanelRight },
} satisfies Record<SideColumn, unknown>;

export function SidebarToggles({ sidebars }: { sidebars: Sidebars }) {
  return (
    <div className="flex items-center">
      {SIDES.map((side) => {
        const { Icon, shortcut } = sideUi[side];
        return (
          <button
            key={side}
            type="button"
            aria-label={`Toggle ${side} sidebar`}
            aria-pressed={sidebars.isOpen(side)}
            title={`Toggle ${side} sidebar (${shortcut})`}
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
  const group = useGroupRef();
  const element = useRef<HTMLDivElement>(null);
  const { fit, remember } = useFitColumns(group, element, sidebars);

  useEffect(() => {
    if (!element.current) return;
    const observer = new ResizeObserver(fit);
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Group
      className="h-full"
      groupRef={group}
      elementRef={element}
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={(next, meta) => {
        layout.onLayoutChanged(next, meta);
        if (!meta.isUserInteraction) return fit();
        remember();
        for (const side of SIDES) {
          const open = (next[side] ?? 0) > 0;
          if (open !== sidebars.isOpen(side)) sidebars.setOpen(side, open);
        }
      }}
    >
      <Sidebar side="left" sidebars={sidebars} activeModule={activeModule} />
      <StackSeparator between="columns" />
      <Panel id="center" minSize={CENTER_MIN_WIDTH}>
        {center}
      </Panel>
      <StackSeparator between="columns" />
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
  usePanelCollapsed(panel, !open);

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
        <aside aria-label={`${sideUi[side].name} sidebar`} className="h-full">
          <SectionStack
            id={`${side}-sidebar`}
            sections={modulesIn(side).map((module) => ({
              ...moduleSection(module, activeModule),
              id: module.id,
              content: <module.Widget />,
            }))}
          />
        </aside>
      )}
    </Panel>
  );
}
