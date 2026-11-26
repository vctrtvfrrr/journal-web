import type { Note } from "../api/generated";
import { zPartialDate } from "../api/generated/zod.gen";

export type Precision = "year" | "month" | "day" | "hour" | "minute";

export type PartialDateParts = {
  precision: Precision;
  year: string;
  month?: string;
  day?: string;
  hour?: string;
  minute?: string;
};

const PRECISIONS: Precision[] = ["year", "month", "day", "hour", "minute"];

export function parsePartialDate(date: string): PartialDateParts {
  const parts = zPartialDate.parse(date).split(/[-T:]/);
  const [year, month, day, hour, minute] = parts;
  const known = parts.length;
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

function groupKeys({ year, month, day }: PartialDateParts): string[] {
  const path = [year, month, day].filter((part) => part !== undefined);
  return path.map((_, depth) => path.slice(0, depth + 1).join("-"));
}

export function groupNotes(notes: Note[]): TimelineGroup[] {
  const root: TimelineGroup[] = [];
  for (const note of notes) {
    const date = parsePartialDate(note.date);
    let siblings: TimelineNode[] = root;
    groupKeys(date).forEach((key, depth) => {
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

export type Connector = "pipe" | "tee" | "elbow" | "blank";

export type TimelineRow = TimelineNode & {
  depth: number;
  lanes: Connector[];
};

export function flattenTimeline(groups: TimelineGroup[], hasMore: boolean): TimelineRow[] {
  const ordered: { node: TimelineNode; depth: number }[] = [];
  const walk = (nodes: TimelineNode[], depth: number) => {
    for (const node of nodes) {
      ordered.push({ node, depth });
      if (node.kind === "group") walk(node.children, depth + 1);
    }
  };
  walk(groups, 0);

  const deepest = Math.max(0, ...ordered.map(({ depth }) => depth));
  const laneHasLaterRow = Array.from({ length: deepest + 1 }, () => hasMore);
  const rows: TimelineRow[] = [];
  for (let index = ordered.length - 1; index >= 0; index--) {
    const { node, depth } = ordered[index]!;
    const lanes = Array.from({ length: depth }, (_, lane): Connector => {
      if (lane === depth - 1) return laneHasLaterRow[lane] ? "tee" : "elbow";
      return laneHasLaterRow[lane] ? "pipe" : "blank";
    });
    rows.push({ ...node, depth, lanes });
    if (depth > 0) laneHasLaterRow[depth - 1] = true;
    laneHasLaterRow.fill(false, depth);
  }
  return rows.reverse();
}

export function nextCursor(link: string | null): string | undefined {
  const next = link?.split(",").find((entry) => /;\s*rel="?next"?/.test(entry));
  const target = next?.match(/<([^>]*)>/)?.[1];
  if (!target) return undefined;
  return new URL(target, "http://link.invalid").searchParams.get("cursor") ?? undefined;
}
