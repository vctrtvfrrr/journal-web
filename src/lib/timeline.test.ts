import { expect, test } from "bun:test";
import { aNote } from "../../test/api";
import {
  flattenTimeline,
  formatTime,
  groupNotes,
  nextCursor,
  parsePartialDate,
  type TimelineNode,
  type TimelineRow,
} from "./timeline";

function shape(nodes: TimelineNode[]): unknown[] {
  return nodes.map((node) =>
    node.kind === "group" ? { [node.key]: shape(node.children) } : node.note.content,
  );
}

const apiOrder = [
  aNote("1", "2026-08-04", "a"),
  aNote("2", "2026-08", "b"),
  aNote("3", "2026-05-10T10:30", "c"),
  aNote("4", "2026-05-10T09", "d"),
  aNote("5", "2026-05-10", "e"),
  aNote("6", "2026-05", "f"),
  aNote("7", "2026", "g"),
  aNote("8", "2025-12-31T23:59", "h"),
];

test("parses each partial date precision", () => {
  expect(parsePartialDate("2026")).toEqual({ precision: "year", year: "2026" });
  expect(parsePartialDate("2026-11")).toEqual({ precision: "month", year: "2026", month: "11" });
  expect(parsePartialDate("2026-11-24")).toEqual({
    precision: "day",
    year: "2026",
    month: "11",
    day: "24",
  });
  expect(parsePartialDate("2026-11-24T15")).toEqual({
    precision: "hour",
    year: "2026",
    month: "11",
    day: "24",
    hour: "15",
  });
  expect(parsePartialDate("2026-11-24T15:35")).toEqual({
    precision: "minute",
    year: "2026",
    month: "11",
    day: "24",
    hour: "15",
    minute: "35",
  });
});

test("rejects malformed partial dates", () => {
  expect(() => parsePartialDate("2026-1")).toThrow();
  expect(() => parsePartialDate("2026-11-24T9")).toThrow();
  expect(() => parsePartialDate("")).toThrow();
});

test("formats the time with dashes for an unknown minute and nothing without an hour", () => {
  expect(formatTime(parsePartialDate("2026-11-24T15:35"))).toBe("15:35");
  expect(formatTime(parsePartialDate("2026-11-24T15"))).toBe("15:--");
  expect(formatTime(parsePartialDate("2026-11-24"))).toBeNull();
  expect(formatTime(parsePartialDate("2026"))).toBeNull();
});

test("groups notes by year, month and day in the order the API sent them", () => {
  expect(shape(groupNotes(apiOrder))).toEqual([
    {
      "2026": [
        { "2026-08": [{ "2026-08-04": ["a"] }, "b"] },
        { "2026-05": [{ "2026-05-10": ["c", "d", "e"] }, "f"] },
        "g",
      ],
    },
    { "2025": [{ "2025-12": [{ "2025-12-31": ["h"] }] }] },
  ]);
});

test("leaves a group open at the end of a page so the next page joins it", () => {
  expect(shape(groupNotes(apiOrder.slice(0, 3)))).toEqual([
    {
      "2026": [
        { "2026-08": [{ "2026-08-04": ["a"] }, "b"] },
        { "2026-05": [{ "2026-05-10": ["c"] }] },
      ],
    },
  ]);
});

test("groups no notes into nothing", () => {
  expect(groupNotes([])).toEqual([]);
});

const glyphs = { pipe: "│ ", tee: "├─", elbow: "└─", blank: "  " };

function draw(rows: TimelineRow[]) {
  return rows.map(
    (row) =>
      row.lanes.map((lane) => glyphs[lane]).join("") +
      (row.kind === "group" ? row.key : row.note.content),
  );
}

test("draws the graph lanes for each row", () => {
  expect(draw(flattenTimeline(groupNotes(apiOrder), false))).toEqual([
    "2026",
    "├─2026-08",
    "│ ├─2026-08-04",
    "│ │ └─a",
    "│ └─b",
    "├─2026-05",
    "│ ├─2026-05-10",
    "│ │ ├─c",
    "│ │ ├─d",
    "│ │ └─e",
    "│ └─f",
    "└─g",
    "2025",
    "└─2025-12",
    "  └─2025-12-31",
    "    └─h",
  ]);
});

test("keeps the last lanes open while older pages remain", () => {
  expect(draw(flattenTimeline(groupNotes(apiOrder), true)).slice(-3)).toEqual([
    "├─2025-12",
    "│ ├─2025-12-31",
    "│ │ ├─h",
  ]);
});

test("closes a finished subtree even when older pages remain", () => {
  const notes = [aNote("1", "2026-11-24T10", "a"), aNote("2", "2026", "g")];
  expect(draw(flattenTimeline(groupNotes(notes), true))).toEqual([
    "2026",
    "├─2026-11",
    "│ └─2026-11-24",
    "│   └─a",
    "├─g",
  ]);
});

test("reads the next page cursor from the Link header", () => {
  expect(nextCursor('</api/notes?notebook=n1&cursor=WyIy%3D>; rel="next"')).toBe("WyIy=");
  expect(nextCursor('</a?cursor=x>; rel="prev", </a?cursor=y>; rel="next"')).toBe("y");
  expect(nextCursor('</a?cursor=x>; rel="prev"')).toBeUndefined();
  expect(nextCursor(null)).toBeUndefined();
});
