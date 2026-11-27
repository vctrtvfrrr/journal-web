import { DemoBadge } from "../modules/demo-badge";

export function DaySummary({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Today at a glance: 24°, rain from 18:00, Dentist at 14:30"
      className="mb-2 flex w-full min-w-0 items-center gap-[1ch] border-b border-border pb-1 text-left text-xs"
      onClick={onOpen}
    >
      <span className="truncate">☀ 24° → ☂ 18h · 14:30 Dentist</span>
      <span className="ml-auto">
        <DemoBadge />
      </span>
    </button>
  );
}
