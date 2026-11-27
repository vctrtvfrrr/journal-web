import { DemoBadge } from "../modules/demo-badge";
import { todayAtAGlance } from "../modules/demo/today";

export function DaySummary({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Today at a glance: ${todayAtAGlance.label}`}
      className="mb-2 flex w-full min-w-0 items-center gap-[1ch] border-b border-border pb-1 text-left text-xs"
      onClick={onOpen}
    >
      <span className="truncate">{todayAtAGlance.text}</span>
      <span className="ml-auto">
        <DemoBadge />
      </span>
    </button>
  );
}
