import type { ReactNode } from "react";

export function JournalShell({
  children,
  status,
  footerAction,
}: {
  children: ReactNode;
  status: ReactNode;
  footerAction?: ReactNode;
}) {
  return (
    <div className="grid h-dvh min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <header className="flex min-h-6 border-b border-border-strong bg-surface pt-[env(safe-area-inset-top)] text-xs">
        <span className="content-center bg-accent px-[1ch] font-bold text-accent-foreground">
          Journal
        </span>
      </header>
      <main className="min-w-0 overflow-y-auto px-[1ch] py-2 sm:px-[2ch]">{children}</main>
      <footer className="flex min-h-6 flex-wrap items-center border-t border-border-strong bg-surface pb-[env(safe-area-inset-bottom)] text-xs">
        <div className="ml-auto flex min-w-0 items-center gap-[1ch] px-[1ch]">{status}</div>
        {footerAction && <div className="border-l border-border px-[1ch]">{footerAction}</div>}
      </footer>
    </div>
  );
}
