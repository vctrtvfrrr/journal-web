import { Link } from "@tanstack/react-router";
import { Fragment, useEffect, type ReactNode } from "react";
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { safeLocalStorage, useStoredSet } from "../lib/stored-state";
import { cn } from "../lib/utils";
import { DemoBadge } from "../modules/demo-badge";
import type { ModuleId } from "../modules/registry";

export type StackSection = {
  id: string;
  title: string;
  content: ReactNode;
  defaultSize?: string;
  demo?: boolean;
  moduleHref?: `/${ModuleId}`;
  active?: boolean;
};

const HEADER_HEIGHT = "1.5rem";

export function SectionStack({ id, sections }: { id: string; sections: StackSection[] }) {
  const [collapsed, setCollapsed] = useStoredSet(`journal-collapsed:${id}`);
  const layout = useDefaultLayout({ id: `journal-layout:${id}`, storage: safeLocalStorage });

  return (
    <Group
      orientation="vertical"
      className="h-full"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      {sections.map((section, index) => (
        <Fragment key={section.id}>
          {index > 0 && <StackSeparator />}
          <StackPanel
            section={section}
            collapsed={collapsed.has(section.id)}
            onCollapsedChange={(value) => setCollapsed(section.id, value)}
          />
        </Fragment>
      ))}
    </Group>
  );
}

export function StackSeparator({
  orientation = "vertical",
}: {
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <Separator
      className={cn(
        "bg-border-strong outline-none data-[separator=hover]:bg-accent data-[separator=active]:bg-accent focus-visible:bg-accent",
        orientation === "vertical" ? "h-px" : "w-px",
      )}
    />
  );
}

function StackPanel({
  section,
  collapsed,
  onCollapsedChange,
}: {
  section: StackSection;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const panel = usePanelRef();

  useEffect(() => {
    if (collapsed) panel.current?.collapse();
    else panel.current?.expand();
  }, [collapsed]);

  return (
    <Panel
      id={section.id}
      panelRef={panel}
      collapsible
      collapsedSize={HEADER_HEIGHT}
      minSize="5rem"
      defaultSize={section.defaultSize}
      onResize={({ inPixels }) => {
        if (inPixels === 0) return;
        const isCollapsed = panel.current?.isCollapsed() ?? false;
        if (isCollapsed !== collapsed) onCollapsedChange(isCollapsed);
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            "flex h-6 shrink-0 items-center gap-[1ch] border-b border-border bg-surface-2 px-[1ch] text-xs font-bold text-accent-ink uppercase",
            section.active && "bg-accent text-accent-foreground",
          )}
        >
          <button
            type="button"
            aria-expanded={!collapsed}
            className="flex min-w-0 flex-1 items-center gap-[1ch] text-left uppercase"
            onClick={() => onCollapsedChange(!collapsed)}
          >
            <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
            <span className="truncate">{section.title}</span>
          </button>
          {section.demo && <DemoBadge />}
          {section.moduleHref && (
            <Link
              to={section.moduleHref}
              search={(previous) => previous}
              aria-label={`Open ${section.title}`}
              aria-current={section.active ? "page" : undefined}
              className="font-normal"
            >
              ↗
            </Link>
          )}
        </div>
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto px-[1ch] py-2">{section.content}</div>
        )}
      </div>
    </Panel>
  );
}
