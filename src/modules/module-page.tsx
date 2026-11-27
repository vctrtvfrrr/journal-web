import type { ReactNode } from "react";
import { DemoBadge } from "./demo-badge";

export function ModulePage({
  title,
  demo,
  children,
}: {
  title: string;
  demo: boolean;
  children: ReactNode;
}) {
  const headingId = `module-${title.toLowerCase()}-heading`;
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 content-start gap-3 px-[1ch]">
      <header className="flex items-center gap-[1ch]">
        <h2 id={headingId} className="font-bold text-accent-ink uppercase">
          {title}
        </h2>
        {demo && <DemoBadge />}
      </header>
      {children}
    </section>
  );
}
