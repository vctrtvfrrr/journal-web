import { beforeEach, expect, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Note, Task } from "./api/generated";
import { aNote, aNotebook, api, device, notesPage, problem } from "../test/api";
import { renderAppAt } from "../test/render";

const diary = aNotebook("1", "Diary");
const plants = aNotebook("2", "Plants");

beforeEach(() => {
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/notebooks", () => HttpResponse.json([diary, plants])),
  );
});

function serveNotes(notes: Note[]) {
  const searches: URLSearchParams[] = [];
  api.use(
    http.get("/api/notes", ({ request }) => {
      searches.push(new URL(request.url).searchParams);
      return notesPage(request, notes);
    }),
    http.get("/api/notes/:id", ({ params }) =>
      HttpResponse.json(notes.find((note) => note.id === params.id)),
    ),
  );
  return searches;
}

async function timeline(name = "Diary") {
  return within(await screen.findByRole("tabpanel", { name }));
}

test("finds the notes that mention a text, ignoring case and accents", async () => {
  serveNotes([
    aNote("1", "2026-11-24", "Painted the Quarto"),
    aNote("2", "2026-11-23", "Bought plants"),
    aNote("3", "2025-03", "Café no quárto novo"),
  ]);
  const history = renderAppAt("/");

  const panel = await timeline();
  expect(await panel.findByText("Bought plants")).toBeDefined();
  await userEvent.type(panel.getByRole("searchbox", { name: "Search notes" }), "quarto");

  await waitFor(() => expect(history.location.search).toBe("?q=quarto"));
  await waitFor(() => expect(panel.queryByText("Bought plants")).toBeNull());
  expect(panel.getByText("Painted the Quarto")).toBeDefined();
  expect(panel.getByText("Café no quárto novo")).toBeDefined();
  expect(panel.getByText("(root) end of results · 2 notes")).toBeDefined();
});

test("keeps a coarse note in every range that overlaps its period", async () => {
  serveNotes([
    aNote("1", "2025-06-30T23:59", "Last minute of June"),
    aNote("2", "2025-05", "Sometime in May"),
    aNote("3", "2025", "Sometime in 2025"),
    aNote("4", "2025-05-09", "Before the range"),
    aNote("5", "2024-12-31", "Last year"),
  ]);
  const history = renderAppAt("/");

  const panel = await timeline();
  await userEvent.type(await panel.findByRole("textbox", { name: "From" }), "2025-05-10");
  await userEvent.type(panel.getByRole("textbox", { name: "To" }), "2025-06-30");

  await waitFor(() => expect(panel.queryByText("Before the range")).toBeNull());
  expect(panel.getByText("Last minute of June")).toBeDefined();
  expect(panel.getByText("Sometime in May")).toBeDefined();
  expect(panel.getByText("Sometime in 2025")).toBeDefined();
  expect(panel.queryByText("Last year")).toBeNull();
  expect(history.location.search).toBe("?from=2025-05-10&to=2025-06-30");
});

test("combines the text with the period and says when nothing matches", async () => {
  const searches = serveNotes([
    aNote("1", "2025-03-02", "Painted the quarto"),
    aNote("2", "2024-08", "Moved into the quarto"),
  ]);
  renderAppAt("/?q=quarto&from=2025&to=2025");

  const panel = await timeline();
  expect(await panel.findByText("Painted the quarto")).toBeDefined();
  expect(panel.queryByText("Moved into the quarto")).toBeNull();
  const search = searches.at(-1)!;
  expect([search.get("q"), search.get("from"), search.get("to")]).toEqual([
    "quarto",
    "2025",
    "2025",
  ]);

  await userEvent.type(panel.getByRole("searchbox", { name: "Search notes" }), "s");

  expect(await panel.findByText("No notes match these filters.")).toBeDefined();
});

test("shows a malformed date and an inverted range in the filter bar without applying them", async () => {
  serveNotes([aNote("1", "2025-03-02", "Painted the quarto")]);
  const history = renderAppAt("/");

  const panel = await timeline();
  const from = await panel.findByRole("textbox", { name: "From" });
  const to = panel.getByRole("textbox", { name: "To" });
  await userEvent.type(from, "25-03");
  expect(panel.getByText("✗ Use a Partial Date such as 2025-03.")).toBeDefined();
  expect(from.getAttribute("aria-invalid")).toBe("true");

  await userEvent.clear(from);
  await userEvent.type(from, "2025-03");
  await userEvent.click(to);
  await userEvent.paste("2025-02");

  expect(panel.getByText("✗ The range ends before it starts.")).toBeDefined();
  await waitFor(() => expect(history.location.search).toBe("?from=2025-03"));
  expect(panel.getByText("Painted the quarto")).toBeDefined();
});

test("shows a search the API rejects in the filter bar and keeps the timeline", async () => {
  api.use(
    http.get("/api/notes", ({ request }) =>
      new URL(request.url).searchParams.has("from")
        ? problem(
            400,
            "The from query parameter must be a Partial Date that exists, such as 2025-03.",
          )
        : notesPage(request, [aNote("1", "2025-03-02", "Painted the quarto")]),
    ),
  );
  renderAppAt("/");

  const panel = await timeline();
  expect(await panel.findByText("Painted the quarto")).toBeDefined();
  await userEvent.type(panel.getByRole("textbox", { name: "From" }), "2025-02-30");

  const search = within(panel.getByRole("search"));
  expect(
    await search.findByText(
      "✗ The from query parameter must be a Partial Date that exists, such as 2025-03.",
    ),
  ).toBeDefined();
  expect(panel.getByText("Painted the quarto")).toBeDefined();
  expect(panel.queryByRole("button", { name: "retry" })).toBeNull();
});

test("keeps the filters across a note dialog, the back button, a reload and a notebook switch", async () => {
  const quarto = aNote("1", "2025-03-02", "Painted the quarto");
  serveNotes([
    quarto,
    aNote("2", "2025-03-01", "Bought paint"),
    aNote("3", "2025-04-01", "Repotted the quarto fern", "2"),
  ]);
  const history = renderAppAt("/?q=quarto");

  let panel = await timeline();
  expect(panel.getByRole<HTMLInputElement>("searchbox", { name: "Search notes" }).value).toBe(
    "quarto",
  );
  await userEvent.click(await panel.findByRole("button", { name: "Painted the quarto" }));
  expect(history.location.search).toBe("?q=quarto");
  await userEvent.click(await screen.findByRole("button", { name: "cancel" }));
  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(history.location.search).toBe("?q=quarto");

  history.back();
  await waitFor(() => expect(history.location.pathname).toBe(`/notes/${quarto.id}`));
  history.back();
  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(history.location.search).toBe("?q=quarto");
  expect(await panel.findByText("Painted the quarto")).toBeDefined();
  expect(panel.queryByText("Bought paint")).toBeNull();

  await userEvent.click(screen.getByRole("tab", { name: "Plants" }));
  panel = await timeline("Plants");
  expect(await panel.findByText("Repotted the quarto fern")).toBeDefined();
  expect(history.location.search).toBe("?q=quarto");
});

test("keeps the filters across a task dialog", async () => {
  serveNotes([aNote("1", "2025-03-02", "Painted the quarto")]);
  const task = {
    id: "0193b3a0-0000-7000-8000-000000000101",
    title: "Pay rent",
    description: null,
    status: "todo",
    priority: 3,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
  } satisfies Task;
  api.use(
    http.get("/api/tasks", () => HttpResponse.json([task])),
    http.get("/api/tasks/:id", () => HttpResponse.json(task)),
  );
  const history = renderAppAt("/?q=quarto");

  await userEvent.click(await screen.findByText("Pay rent"));
  await screen.findByRole("dialog", { name: "Task" });
  expect(history.location.search).toBe("?q=quarto");
  await userEvent.keyboard("{Escape}");

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(history.location.search).toBe("?q=quarto");
});

test("clears every filter at once", async () => {
  serveNotes([aNote("1", "2025-03-02", "Painted the quarto"), aNote("2", "2024-01", "Old")]);
  const history = renderAppAt("/?q=quarto&from=2025");

  const panel = await timeline();
  expect(await panel.findByText("Painted the quarto")).toBeDefined();
  await userEvent.click(panel.getByRole("button", { name: "clear filters" }));

  expect(await panel.findByText("Old")).toBeDefined();
  expect(history.location.search).toBe("");
  expect(panel.getByRole<HTMLInputElement>("searchbox", { name: "Search notes" }).value).toBe("");
  expect(panel.getByRole<HTMLInputElement>("textbox", { name: "From" }).value).toBe("");
  expect(panel.getByText("(root) beginning of notebook · 2 notes")).toBeDefined();
});
