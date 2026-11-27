import type { ReactNode } from "react";
import { Badge } from "../components/ui/badge";

export function DemoBadge() {
  return (
    <Badge variant="warning" aria-label="Demo content">
      DEMO
    </Badge>
  );
}

export function ModulePage({ title, children }: { title: string; children: ReactNode }) {
  const headingId = `module-${title.toLowerCase()}-heading`;
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 content-start gap-3 px-[1ch]">
      <header className="flex items-center gap-[1ch]">
        <h2 id={headingId} className="font-bold text-accent-ink uppercase">
          {title}
        </h2>
        <DemoBadge />
      </header>
      {children}
    </section>
  );
}

export function DemoRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-[1ch] border-b border-dashed border-border py-0.5">
      {children}
    </li>
  );
}
