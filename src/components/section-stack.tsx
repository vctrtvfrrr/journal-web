import { Link } from "@tanstack/react-router";
import {
  Fragment,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from "react-resizable-panels";
import { isEditable } from "../lib/desktop-shortcuts";
import { usePanelFocus } from "../lib/panel-focus";
import { panelNumber, type PanelId } from "../lib/panels";
import { safeLocalStorage, useStoredSet } from "../lib/stored-state";
import { usePanelCollapsed } from "../lib/use-panel-collapsed";
import { cn } from "../lib/utils";
import { DemoBadge } from "../modules/demo-badge";
import type { DashboardModule, ModuleId } from "../modules/registry";

export type StackSection = {
  id: string;
  title: string;
  content: ReactNode;
  defaultSize?: string;
  demo?: boolean;
  moduleHref?: `/${ModuleId}`;
  active?: boolean;
  panel?: PanelId;
  onExpandedKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

const HEADER_HEIGHT = "1.5rem";

export function moduleSection(module: DashboardModule, activeModule?: ModuleId) {
  return {
    title: module.title,
    demo: module.demo,
    moduleHref: `/${module.id}`,
    active: module.id === activeModule,
  } satisfies Omit<StackSection, "id" | "content">;
}

export function SectionStack({ id, sections }: { id: string; sections: StackSection[] }) {
  const [collapsed, setMember] = useStoredSet(`journal-collapsed:${id}`);
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
          {index > 0 && <StackSeparator between="sections" />}
          <StackPanel
            section={section}
            collapsed={collapsed.has(section.id)}
            onCollapsedChange={(value) => setMember(section.id, value)}
          />
        </Fragment>
      ))}
    </Group>
  );
}

export function StackSeparator({ between }: { between: "sections" | "columns" }) {
  return (
    <Separator
      className={cn(
        "bg-border-strong outline-none data-[separator=hover]:bg-accent data-[separator=active]:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent",
        between === "sections" ? "h-px" : "w-px",
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
  usePanelCollapsed(panel, collapsed);
  const container = useRef<HTMLDivElement>(null);
  useFocusRequest(section.panel, container, collapsed, () => onCollapsedChange(false));

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
      <div
        ref={container}
        className="group/panel flex h-full min-h-0 flex-col outline-none"
        {...(section.panel && {
          tabIndex: -1,
          "data-panel": section.panel,
          "aria-keyshortcuts": `Alt+${panelNumber(section.panel)}`,
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            if (!collapsed) section.onExpandedKeyDown?.(event);
            leaveFieldOnEscape(event);
          },
        })}
      >
        <SectionHeader
          section={section}
          collapsed={collapsed}
          onToggle={() => onCollapsedChange(!collapsed)}
        />
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto px-[1ch] py-2">{section.content}</div>
        )}
      </div>
    </Panel>
  );
}

function leaveFieldOnEscape(event: KeyboardEvent<HTMLDivElement>) {
  const panel = event.currentTarget;
  if (event.key !== "Escape" || event.defaultPrevented || !isEditable(event.target)) return;
  if (!panel.contains(event.target as Node)) return;
  panel.focus();
}

function useFocusRequest(
  panel: PanelId | undefined,
  container: RefObject<HTMLDivElement | null>,
  collapsed: boolean,
  expand: () => void,
) {
  const focus = usePanelFocus();
  const requested = panel !== undefined && focus?.pending === panel;
  useEffect(() => {
    if (!requested) return;
    if (collapsed) return expand();
    const element = container.current;
    if (!element) return;
    element.focus();
    if (document.activeElement === element) focus.settle(panel);
  });
}

export function SectionHeader({
  section,
  collapsed,
  onToggle,
}: {
  section: Omit<StackSection, "id" | "content">;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-6 shrink-0 items-center gap-[1ch] border-b border-border bg-surface-2 px-[1ch] text-xs font-bold text-accent-ink uppercase",
        section.panel &&
          "group-focus-within/panel:border-b-accent group-focus-within/panel:shadow-[inset_0_-1px_0_var(--color-accent)]",
        section.active &&
          "bg-accent text-accent-foreground group-focus-within/panel:border-b-accent-foreground group-focus-within/panel:shadow-[inset_0_-2px_0_var(--color-accent-foreground)]",
      )}
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        className="flex min-w-0 flex-1 items-center gap-[1ch] text-left uppercase"
        onClick={onToggle}
      >
        <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
        {section.panel && <span aria-hidden>[{panelNumber(section.panel)}]</span>}
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
  );
}
