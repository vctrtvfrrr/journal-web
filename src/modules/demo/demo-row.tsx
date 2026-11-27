import type { ReactNode } from "react";

export function DemoRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-[1ch] border-b border-dashed border-border py-0.5">
      {children}
    </li>
  );
}
