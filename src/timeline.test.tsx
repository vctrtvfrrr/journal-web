import { beforeEach, expect, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Note } from "./api/generated";
import { aNote, aNotebook, api, device, notesPage, problem } from "../test/api";
import { renderAppAt } from "../test/render";

const diary = aNotebook("1", "Diary");

beforeEach(() => {
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/notebooks", () => HttpResponse.json([diary])),
  );
});

function serveTimeline(notes: Note[], pageSize?: number) {
  const requested: (string | null)[] = [];
  api.use(
    http.get("/api/notes", ({ request }) => {
      requested.push(new URL(request.url).searchParams.get("cursor"));
      return notesPage(request, notes, pageSize);
    }),
  );
  return requested;
}

async function timeline() {
  return within(await screen.findByRole("tabpanel", { name: "Diary" }));
}

test("shows the notebook notes grouped by year, month and day with their times", async () => {
  serveTimeline([
    aNote("1", "2026-11-24T15:35", "Coffee with **Ana**"),
    aNote("2", "2026-11-24T09", "Run"),
    aNote("3", "2026-11", "Month note"),
  ]);
  renderAppAt("/");

  const panel = await timeline();
  expect(await panel.findByText("(2026)")).toBeDefined();
  expect(panel.getByText("(2026-11)")).toBeDefined();
  expect(panel.getByText("(2026-11-24)")).toBeDefined();
  expect(panel.getByText("15:35")).toBeDefined();
  expect(panel.getByText("09:--")).toBeDefined();
  expect(panel.getByText("Ana").tagName).toBe("STRONG");
  expect(panel.getByText("Month note")).toBeDefined();
  expect(panel.getByText("(root) beginning of notebook · 3 notes")).toBeDefined();
});

test("opens a note from its body", async () => {
  const note = aNote("1", "2026-11-24T15:35", "Coffee with Ana");
  serveTimeline([note]);
  api.use(http.get("/api/notes/:id", () => HttpResponse.json(note)));
  const history = renderAppAt("/");

  await userEvent.click(await (await timeline()).findByRole("button", { name: "Coffee with Ana" }));

  expect(await screen.findByRole("dialog", { name: "Edit note" })).toBeDefined();
  expect(history.location.pathname).toBe(`/notes/${note.id}`);
});

test("loads older pages from the Link header until the beginning of the notebook", async () => {
  const requested = serveTimeline(
    [aNote("1", "2026-11-24T15:35", "Newest"), aNote("2", "2025-01-02T08:00", "Oldest")],
    1,
  );
  renderAppAt("/");

  const panel = await timeline();
  await userEvent.click(await panel.findByRole("button", { name: "load older" }));

  expect(await panel.findByText("Oldest")).toBeDefined();
  expect(panel.getByText("(root) beginning of notebook · 2 notes")).toBeDefined();
  expect(panel.queryByRole("button", { name: "load older" })).toBeNull();
  expect(requested).toEqual([null, "1"]);
});

test("says when the notebook has no notes yet", async () => {
  serveTimeline([]);
  renderAppAt("/");

  expect(
    await (await timeline()).findByText("No notes in this notebook yet. Write one above or use +."),
  ).toBeDefined();
});

test("shows the whole body of a timed note under its time", async () => {
  serveTimeline([
    aNote("1", "2026-11-24T15:35", "First line\n\nSecond paragraph"),
    aNote("2", "2026-11-23", "Yesterday"),
  ]);
  renderAppAt("/");

  const panel = await timeline();
  expect(await panel.findByText("Second paragraph")).toBeDefined();
  expect(panel.getByText("Yesterday")).toBeDefined();
  expect(panel.queryByRole("button", { name: "(2026-11)" })).toBeNull();
  expect(panel.queryByRole("button", { name: "15:35" })).toBeNull();
});

test("shows a failed timeline load with a retry", async () => {
  let fail = true;
  api.use(
    http.get("/api/notes", () =>
      fail ? problem(503, "Try later.") : HttpResponse.json([aNote("1", "2026", "Back")]),
    ),
  );
  renderAppAt("/");

  const panel = await timeline();
  expect(await panel.findByText("Try later.")).toBeDefined();
  fail = false;
  await userEvent.click(panel.getByRole("button", { name: "retry" }));
  await waitFor(() => expect(panel.getByText("Back")).toBeDefined());
});
