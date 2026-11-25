import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Note } from "../api/generated";
import { activationHandlers } from "../lib/activation";
import { useTimeline } from "../lib/notes";
import { useRevealNote } from "../lib/reveal-note";
import {
  type Connector,
  countNotes,
  flattenTimeline,
  formatTime,
  groupNotes,
  parsePartialDate,
  type TimelineRow,
} from "../lib/timeline";
import { cn } from "../lib/utils";
import { LoadError } from "./load-error";
import { Markdown } from "./markdown";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Spinner } from "./ui/spinner";

const line = "absolute left-[calc(1ch-0.5px)] w-px bg-border-strong";
const groupColor = { year: "text-yellow-ink", month: "text-cyan-ink", day: "text-blue-ink" };

function Lane({ connector }: { connector: Connector }) {
  return (
    <span aria-hidden className="relative w-[2ch] shrink-0 self-stretch">
      {connector !== "blank" && <span className={cn(line, "top-0 h-3")} />}
      {(connector === "pipe" || connector === "tee") && (
        <span className={cn(line, "top-3 bottom-0")} />
      )}
      {(connector === "tee" || connector === "elbow") && (
        <span className="absolute top-[calc(0.75rem-0.5px)] left-[1ch] h-px w-[1ch] bg-border-strong" />
      )}
    </span>
  );
}

function NodeMark({ row, collapsed }: { row: TimelineRow; collapsed: boolean }) {
  const glyph = row.kind === "group" ? (collapsed ? "◉" : "●") : row.date.hour ? "*" : "○";
  return (
    <span aria-hidden className="relative w-[2ch] shrink-0 self-stretch">
      <span
        className={cn(
          "absolute top-0 left-0 w-[2ch] text-center leading-6",
          row.kind === "group" ? groupColor[row.level] : "text-accent-ink",
        )}
      >
        {glyph}
      </span>
      {row.childLine && <span className={cn(line, "top-[1.1rem] bottom-0")} />}
    </span>
  );
}

function Toggle({
  expanded,
  onToggle,
  className,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className={cn("shrink-0 leading-6 hover:underline", className)}
    >
      {children}
    </button>
  );
}

function NoteBody({ note }: { note: Note }) {
  const navigate = useNavigate();
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = content.current;
    if (element) setOverflows(element.scrollHeight > element.clientHeight + 1);
  }, [note.content]);

  return (
    <div className="min-w-0 pb-1">
      <div
        role="button"
        tabIndex={0}
        {...activationHandlers(
          () => void navigate({ to: "/notes/$noteId", params: { noteId: note.id } }),
        )}
        className="group min-w-0 hover:bg-accent/8 focus-visible:outline-offset-[-1px]"
      >
        <div ref={content} className={cn("min-w-0", !expanded && "max-h-[4lh] overflow-hidden")}>
          <Markdown
            level="note"
            className="wrap-anywhere group-hover:text-accent-ink [&_table]:w-full [&_table]:table-fixed"
          >
            {note.content}
          </Markdown>
        </div>
      </div>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-xs text-muted-foreground hover:text-accent-ink"
        >
          {expanded ? "[-] less" : "[+] more"}
        </button>
      )}
    </div>
  );
}

function firstLine(content: string) {
  return content.split("\n").find((text) => text.trim() && !text.startsWith("```")) ?? "";
}

function TimelineRowView({
  row,
  collapsed,
  highlighted,
  onToggle,
}: {
  row: TimelineRow;
  collapsed: boolean;
  highlighted: boolean;
  onToggle: () => void;
}) {
  const time = row.kind === "note" ? formatTime(row.date) : null;

  return (
    <div
      data-note={row.kind === "note" ? row.key : undefined}
      data-highlighted={highlighted || undefined}
      className={cn("flex min-h-6 min-w-0", highlighted && "note-highlight")}
    >
      {row.lanes.map((connector, lane) => (
        <Lane key={lane} connector={connector} />
      ))}
      <NodeMark row={row} collapsed={collapsed} />
      <div className="min-w-0 flex-1">
        {row.kind === "group" ? (
          <div className="flex min-w-0 gap-[1ch]">
            <Toggle expanded={!collapsed} onToggle={onToggle} className={groupColor[row.level]}>
              ({row.key})
            </Toggle>
            {collapsed && (
              <span className="leading-6 text-muted-foreground">{countNotes(row)} notes</span>
            )}
          </div>
        ) : time ? (
          <>
            <div className="flex min-w-0 gap-[1ch]">
              <Toggle expanded={!collapsed} onToggle={onToggle} className="text-muted-foreground">
                {time}
              </Toggle>
              {collapsed && (
                <span className="min-w-0 truncate leading-6 text-muted-foreground">
                  <Markdown level="inline">{firstLine(row.note.content)}</Markdown>
                </span>
              )}
            </div>
            {!collapsed && <NoteBody note={row.note} />}
          </>
        ) : (
          <div className="pt-[calc((1.5rem-1lh)/2)]">
            <NoteBody note={row.note} />
          </div>
        )}
      </div>
    </div>
  );
}

function OlderNotesSentinel({ onVisible }: { onVisible: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const latest = useRef(onVisible);
  latest.current = onVisible;

  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && latest.current(),
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={sentinel} aria-hidden />;
}

function groupKeysAbove(note: Note) {
  const { year, month, day } = parsePartialDate(note.date);
  return [year, month && `${year}-${month}`, day && `${year}-${month}-${day}`].filter(
    (key) => key !== undefined,
  );
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const HIGHLIGHT_MS = 2000;

export function NotesTimeline({ notebook }: { notebook: string }) {
  const timeline = useTimeline(notebook);
  const container = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [highlighted, setHighlighted] = useState<string>();
  const { target, done } = useRevealNote();
  const revealing = target?.notebook_id === notebook ? target.id : undefined;
  const notes = useMemo(
    () => timeline.data?.pages.flatMap((page) => page.notes) ?? [],
    [timeline.data],
  );
  const rows = useMemo(
    () => flattenTimeline(groupNotes(notes), timeline.hasNextPage, collapsed),
    [notes, timeline.hasNextPage, collapsed],
  );

  useEffect(() => {
    if (!revealing) return;
    const note = notes.find(({ id }) => id === revealing);
    if (note) {
      setCollapsed((previous) => {
        const next = new Set(previous);
        for (const key of [...groupKeysAbove(note), note.id]) next.delete(key);
        return next;
      });
      setHighlighted(note.id);
      done();
    } else if (!timeline.isFetching) {
      if (timeline.hasNextPage) void timeline.fetchNextPage();
      else done();
    }
  }, [revealing, notes, timeline.isFetching, timeline.hasNextPage]);

  useEffect(() => {
    if (!highlighted) return;
    const row = container.current?.querySelector(`[data-note="${highlighted}"]`);
    row?.scrollIntoView?.({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    const timer = setTimeout(() => setHighlighted(undefined), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const toggle = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const loadOlder = () => {
    if (!timeline.isFetchingNextPage && !timeline.isFetchNextPageError)
      void timeline.fetchNextPage();
  };

  if (timeline.isPending)
    return (
      <div className="grid gap-2 p-[1ch]" aria-hidden>
        {["w-1/3", "w-2/3", "w-1/2", "w-3/4", "w-2/5"].map((width) => (
          <Skeleton key={width} className={cn("h-4", width)} />
        ))}
      </div>
    );

  if (timeline.isError && !timeline.isFetchNextPageError)
    return (
      <div className="p-[1ch]">
        <LoadError error={timeline.error} onRetry={() => void timeline.refetch()} />
      </div>
    );

  if (notes.length === 0)
    return (
      <p className="p-[1ch] text-muted-foreground">
        No notes in this notebook yet. Write one above or use +.
      </p>
    );

  return (
    <div ref={container} className="min-w-0 px-[1ch] py-2 text-sm">
      {rows.map((row) => (
        <TimelineRowView
          key={row.key}
          row={row}
          collapsed={collapsed.has(row.key)}
          highlighted={row.key === highlighted}
          onToggle={() => toggle(row.key)}
        />
      ))}
      <div className="flex min-h-6 items-center gap-[1ch] text-muted-foreground">
        {timeline.isFetchNextPageError ? (
          <LoadError error={timeline.error} onRetry={() => void timeline.fetchNextPage()} />
        ) : timeline.isFetchingNextPage ? (
          <>
            <Spinner /> loading older notes…
          </>
        ) : timeline.hasNextPage ? (
          <>
            <OlderNotesSentinel onVisible={loadOlder} />
            <Button type="button" variant="bracket" size="sm" onClick={loadOlder}>
              load older
            </Button>
          </>
        ) : (
          <span>(root) beginning of notebook · {notes.length} notes</span>
        )}
      </div>
    </div>
  );
}
