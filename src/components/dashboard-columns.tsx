import { PanelLeft, PanelRight } from "lucide-react";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  Group,
  Panel,
  useDefaultLayout,
  useGroupRef,
  usePanelRef,
  type GroupImperativeHandle,
} from "react-resizable-panels";
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

const SIDES = ["left", "right"] as const;

// The library shrinks the sidebars one after the other and may collapse one when the window
// narrows. The spec wants them to shrink in proportion, down to their minimum, never close on
// their own, and keep the widths the owner chose for when there is room again.
function useFitColumns(
  group: RefObject<GroupImperativeHandle | null>,
  element: RefObject<HTMLDivElement | null>,
  sidebars: Sidebars,
) {
  const latest = useRef(sidebars);
  latest.current = sidebars;
  const chosen = useRef<Partial<Record<SideColumn, number>>>({});

  const measure = () => {
    const root = element.current;
    if (!group.current || !root || root.clientWidth === 0) return undefined;
    const separators = [...root.querySelectorAll<HTMLElement>(":scope > [data-separator]")];
    const total = root.clientWidth - separators.reduce((sum, el) => sum + el.offsetWidth, 0);
    const layout = group.current.getLayout();
    const px = (side: SideColumn) => ((layout[side] ?? 0) / 100) * total;
    return { group: group.current, total, layout, px };
  };

  const remember = () => {
    const now = measure();
    if (!now) return;
    for (const side of SIDES) if (now.px(side) > 0) chosen.current[side] = now.px(side);
  };

  const fit = () => {
    const now = measure();
    if (!now) return;
    const width = { left: 0, right: 0 };
    for (const side of SIDES) {
      if (!latest.current.isOpen(side)) continue;
      chosen.current[side] ??= now.px(side) || defaultSidebarWidth();
      width[side] = Math.max(SIDEBAR_MIN_WIDTH, chosen.current[side]);
    }
    const room = now.total - CENTER_MIN_WIDTH;
    const wanted = width.left + width.right;
    if (wanted > room) {
      for (const side of SIDES) {
        if (width[side] > 0)
          width[side] = Math.max(SIDEBAR_MIN_WIDTH, (width[side] * room) / wanted);
      }
    }
    const percent = (px: number) => (px / now.total) * 100;
    const next = {
      left: percent(width.left),
      right: percent(width.right),
      center: 100 - percent(width.left + width.right),
    };
    const changed = (["left", "right", "center"] as const).some(
      (id) => Math.abs((now.layout[id] ?? 0) - next[id]) > 0.1,
    );
    if (changed) now.group.setLayout(next);
  };

  return { fit, remember };
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
