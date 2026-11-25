import type { Note } from "../api/generated";

export type Precision = "year" | "month" | "day" | "hour" | "minute";

export type PartialDateParts = {
  precision: Precision;
  year: string;
  month?: string;
  day?: string;
  hour?: string;
  minute?: string;
};

const PARTIAL_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2})(?::(\d{2}))?)?)?)?$/;
const PRECISIONS: Precision[] = ["year", "month", "day", "hour", "minute"];

export function parsePartialDate(date: string): PartialDateParts {
  const match = PARTIAL_DATE.exec(date);
  if (!match) throw new Error(`Invalid partial date: ${date}`);
  const [year, month, day, hour, minute] = match.slice(1);
  const known = match.slice(1).filter((part) => part !== undefined).length;
  return {
    precision: PRECISIONS[known - 1]!,
    year: year!,
    ...(month && { month }),
    ...(day && { day }),
    ...(hour && { hour }),
    ...(minute && { minute }),
  };
}

export function formatTime(date: PartialDateParts): string | null {
  if (!date.hour) return null;
  return `${date.hour}:${date.minute ?? "--"}`;
}

export type GroupLevel = "year" | "month" | "day";

export type TimelineNote = { kind: "note"; key: string; note: Note; date: PartialDateParts };
export type TimelineGroup = {
  kind: "group";
  key: string;
  level: GroupLevel;
  children: TimelineNode[];
};
export type TimelineNode = TimelineNote | TimelineGroup;

const LEVELS: GroupLevel[] = ["year", "month", "day"];

export function groupNotes(notes: Note[]): TimelineGroup[] {
  const root: TimelineGroup[] = [];
  for (const note of notes) {
    const date = parsePartialDate(note.date);
    const path = [date.year, date.month, date.day].filter((part) => part !== undefined);
    let siblings: TimelineNode[] = root;
    path.forEach((_, depth) => {
      const key = path.slice(0, depth + 1).join("-");
      const last = siblings.at(-1);
      let group = last?.kind === "group" && last.key === key ? last : undefined;
      if (!group) {
        group = { kind: "group", key, level: LEVELS[depth]!, children: [] };
        siblings.push(group);
      }
      siblings = group.children;
    });
    siblings.push({ kind: "note", key: note.id, note, date });
  }
  return root;
}

export function countNotes(group: TimelineGroup): number {
  return group.children.reduce(
    (total, child) => total + (child.kind === "note" ? 1 : countNotes(child)),
    0,
  );
}

export type Connector = "pipe" | "tee" | "elbow" | "blank";

export type TimelineRow = TimelineNode & {
  depth: number;
  lanes: Connector[];
  childLine: boolean;
};

export function flattenTimeline(
  groups: TimelineGroup[],
  hasMore: boolean,
  collapsed: ReadonlySet<string>,
): TimelineRow[] {
  const visible: { node: TimelineNode; depth: number }[] = [];
  const walk = (nodes: TimelineNode[], depth: number) => {
    for (const node of nodes) {
      visible.push({ node, depth });
      if (node.kind === "group" && !collapsed.has(node.key)) walk(node.children, depth + 1);
    }
  };
  walk(groups, 0);

  const deepest = Math.max(0, ...visible.map(({ depth }) => depth));
  // Scanning backwards, laneContinues[lane] tells whether a later row still hangs from that lane.
  const laneContinues = Array.from({ length: deepest + 1 }, () => hasMore);
  const rows: TimelineRow[] = [];
  for (let index = visible.length - 1; index >= 0; index--) {
    const { node, depth } = visible[index]!;
    const lanes = Array.from({ length: depth }, (_, lane): Connector => {
      if (lane === depth - 1) return laneContinues[lane] ? "tee" : "elbow";
      return laneContinues[lane] ? "pipe" : "blank";
    });
    const childLine = visible[index + 1]?.depth === depth + 1;
    rows.push({ ...node, depth, lanes, childLine });
    if (depth > 0) laneContinues[depth - 1] = true;
    laneContinues.fill(false, depth);
  }
  return rows.reverse();
}

export function nextCursor(link: string | null): string | undefined {
  const next = link?.split(",").find((entry) => /;\s*rel="?next"?/.test(entry));
  const target = next?.match(/<([^>]*)>/)?.[1];
  if (!target) return undefined;
  return new URL(target, "http://link.invalid").searchParams.get("cursor") ?? undefined;
}
