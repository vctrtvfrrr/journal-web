import { useStoredSet } from "../lib/stored-state";
import { MODULES } from "../modules/registry";
import { moduleSection, SectionHeader } from "./section-stack";

export function WidgetList() {
  const [collapsed, setMember] = useStoredSet("journal-collapsed:mobile-widgets");
  return (
    <div className="grid content-start gap-2">
      {MODULES.map((module) => {
        const isCollapsed = collapsed.has(module.id);
        return (
          <div key={module.id} className="border border-border">
            <SectionHeader
              section={moduleSection(module)}
              collapsed={isCollapsed}
              onToggle={() => setMember(module.id, !isCollapsed)}
            />
            {!isCollapsed && (
              <div className="px-[1ch] py-2">
                <module.Widget />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
