import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function JournalShell({
  children,
  status,
  footerAction,
  tabBar,
  breadcrumb,
  headerActions,
  scroll = "page",
}: {
  children: ReactNode;
  status: ReactNode;
  footerAction?: ReactNode;
  tabBar?: ReactNode;
  breadcrumb?: ReactNode;
  headerActions?: ReactNode;
  scroll?: "page" | "panes";
}) {
  return (
    <div
      className={cn(
        "grid h-dvh min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]",
        tabBar && "grid-rows-[auto_minmax(0,1fr)_auto_auto]",
      )}
    >
      <header className="flex min-h-6 border-b border-border-strong bg-surface pt-[env(safe-area-inset-top)] text-xs">
        <span className="content-center bg-accent px-[1ch] font-bold text-accent-foreground">
          Journal
        </span>
        {breadcrumb}
        {headerActions && <div className="ml-auto flex items-center px-[1ch]">{headerActions}</div>}
      </header>
      <main
        className={
          scroll === "page" ? "min-w-0 overflow-y-auto px-[1ch] py-2" : "min-w-0 overflow-hidden"
        }
      >
        {children}
      </main>
      {tabBar && <nav className="border-t border-border-strong bg-surface py-1">{tabBar}</nav>}
      <footer className="flex min-h-6 flex-wrap items-center border-t border-border-strong bg-surface pb-[env(safe-area-inset-bottom)] text-xs">
        <div className="ml-auto flex min-w-0 items-center gap-[1ch] px-[1ch]">{status}</div>
        {footerAction && <div className="border-l border-border px-[1ch]">{footerAction}</div>}
      </footer>
    </div>
  );
}
