import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Note, NoteChanges, NoteInput, Notebook, NotebookInput } from "./api/generated";
import { aNotebook, api, device, problem, validationProblem } from "../test/api";
import { renderAppAt } from "../test/render";

const diary = aNotebook("201", "Diary");
const plants = aNotebook("202", "Plants");
const recipes = aNotebook("203", "Recipes");

const lunch: Note = {
  id: "0193b3a0-0000-7000-8000-000000000301",
  notebook_id: diary.id,
  content: "Lunch with **Ana**.",
  date: "2025-07-18T12",
  created_at: "2026-11-22T14:00:00Z",
  updated_at: "2026-11-22T14:00:00Z",
};

function serveNotes(initialNotebooks: Notebook[]) {
  let notebooks = initialNotebooks;
  const requests: { method: string; path: string; body?: unknown }[] = [];
  api.use(
    http.get("/api/notebooks", () => HttpResponse.json(notebooks)),
    http.post<never, NotebookInput>("/api/notebooks", async ({ request }) => {
      const body = await request.json();
      requests.push({ method: "POST", path: "/notebooks", body });
      const created = { ...recipes, name: body.name };
      notebooks = [...notebooks, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.post<never, NoteInput>("/api/notes", async ({ request }) => {
      const body = await request.json();
      requests.push({ method: "POST", path: "/notes", body });
      return HttpResponse.json({ ...lunch, ...body }, { status: 201 });
    }),
    http.get("/api/notes/:id", () => HttpResponse.json(lunch)),
    http.patch<{ id: string }, NoteChanges>("/api/notes/:id", async ({ params, request }) => {
      const body = await request.json();
      requests.push({ method: "PATCH", path: `/notes/${params.id}`, body });
      return HttpResponse.json({ ...lunch, ...body });
    }),
    http.delete<{ id: string }>("/api/notes/:id", ({ params }) => {
      requests.push({ method: "DELETE", path: `/notes/${params.id}` });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return requests;
}

beforeEach(() => {
  setSystemTime(new Date(2026, 10, 24, 15, 35, 42));
  api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));
});

afterEach(() => setSystemTime());

async function openNewNote() {
  await userEvent.click(await screen.findByRole("button", { name: "New note" }));
  return within(await screen.findByRole("dialog", { name: "New note" }));
}

test("adds a note from the + button to the selected notebook at the current minute by default", async () => {
  const requests = serveNotes([diary, plants]);
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("tab", { name: "Plants" }));
  const dialog = await openNewNote();
  expect(dialog.getByRole("combobox", { name: "Notebook" }).textContent).toContain("Plants");
  expect((dialog.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-11-24T15:35");
  await userEvent.type(dialog.getByLabelText("Content"), "  Repotted the fern.  ");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(requests).toEqual([
    {
      method: "POST",
      path: "/notes",
      body: { notebook_id: plants.id, content: "Repotted the fern.", date: "2026-11-24T15:35" },
    },
  ]);
});

test("adds a note with a partial date to another notebook and opens that notebook", async () => {
  const requests = serveNotes([diary, plants]);
  renderAppAt("/");

  const dialog = await openNewNote();
  await userEvent.click(dialog.getByRole("combobox", { name: "Notebook" }));
  await userEvent.click(await screen.findByRole("option", { name: "Plants" }));
  await userEvent.type(dialog.getByLabelText("Content"), "Bought a fern.");
  const date = dialog.getByLabelText("Date");
  await userEvent.clear(date);
  await userEvent.type(date, "2025-07");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(requests.map(({ body }) => body)).toEqual([
    { notebook_id: plants.id, content: "Bought a fern.", date: "2025-07" },
  ]);
  expect(screen.getByRole("tab", { name: "Plants" }).getAttribute("aria-selected")).toBe("true");
});

test("creates a notebook from the picker when saving the note", async () => {
  const requests = serveNotes([diary]);
  renderAppAt("/");

  const dialog = await openNewNote();
  await userEvent.click(dialog.getByRole("combobox", { name: "Notebook" }));
  await userEvent.type(
    await screen.findByPlaceholderText("Find or create a notebook..."),
    "Recipes",
  );
  await userEvent.click(await screen.findByRole("option", { name: 'Create "Recipes"' }));
  expect(dialog.getByRole("combobox", { name: "Notebook" }).textContent).toContain("Recipes");
  await userEvent.type(dialog.getByLabelText("Content"), "Pão de queijo.");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(await screen.findByRole("tab", { name: "Recipes", selected: true })).toBeDefined();
  expect(requests).toEqual([
    { method: "POST", path: "/notebooks", body: { name: "Recipes" } },
    {
      method: "POST",
      path: "/notes",
      body: { notebook_id: recipes.id, content: "Pão de queijo.", date: "2026-11-24T15:35" },
    },
  ]);
});

test("asks for a notebook when there are none yet", async () => {
  const requests = serveNotes([]);
  renderAppAt("/");

  const dialog = await openNewNote();
  await userEvent.type(dialog.getByLabelText("Content"), "First note.");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(await dialog.findByText("Choose or create a notebook.", { exact: false })).toBeDefined();
  expect(requests).toEqual([]);
});

test("shows a date the API rejects under the date field", async () => {
  serveNotes([diary]);
  api.use(
    http.post("/api/notes", () =>
      validationProblem([{ pointer: "#/date", detail: "Must not be in the future." }]),
    ),
  );
  renderAppAt("/");

  const dialog = await openNewNote();
  await userEvent.type(dialog.getByLabelText("Content"), "From the future.");
  const date = dialog.getByLabelText("Date");
  await userEvent.clear(date);
  await userEvent.type(date, "2099");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(await dialog.findByText("Must not be in the future.", { exact: false })).toBeDefined();
  expect(screen.getByRole("dialog", { name: "New note" })).toBeDefined();
});

test("edits a note from its address, moving it to another notebook", async () => {
  const requests = serveNotes([diary, plants]);
  const history = renderAppAt(`/notes/${lunch.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  const content = (await dialog.findByLabelText("Content")) as HTMLTextAreaElement;
  expect(content.value).toBe("Lunch with **Ana**.");
  expect((dialog.getByLabelText("Date") as HTMLInputElement).value).toBe("2025-07-18T12");
  expect(dialog.getByRole("combobox", { name: "Notebook" }).textContent).toContain("Diary");
  await userEvent.type(content, " Then a walk.");
  await userEvent.click(dialog.getByRole("combobox", { name: "Notebook" }));
  await userEvent.click(await screen.findByRole("option", { name: "Plants" }));
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(requests).toEqual([
    {
      method: "PATCH",
      path: `/notes/${lunch.id}`,
      body: {
        notebook_id: plants.id,
        content: "Lunch with **Ana**. Then a walk.",
        date: "2025-07-18T12",
      },
    },
  ]);
});

test("deletes a note from its dialog after confirming", async () => {
  const requests = serveNotes([diary]);
  const history = renderAppAt(`/notes/${lunch.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  await userEvent.click(await dialog.findByRole("button", { name: "Delete note" }));
  const confirm = within(await screen.findByRole("dialog", { name: "Delete note?" }));
  await userEvent.click(confirm.getByRole("button", { name: "delete note" }));

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(requests).toEqual([{ method: "DELETE", path: `/notes/${lunch.id}` }]);
});

test("goes back to the dashboard when the note in the address does not exist", async () => {
  serveNotes([diary]);
  api.use(http.get("/api/notes/:id", () => problem(404, "Note not found.")));
  const history = renderAppAt(`/notes/${lunch.id}`);

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(await screen.findByText("Note not found.")).toBeDefined();
});

test("selects a notebook created from the picker even when the note is rejected", async () => {
  const requests = serveNotes([diary]);
  api.use(
    http.post("/api/notes", () =>
      validationProblem([{ pointer: "#/content", detail: "Must be at most 10000 characters." }]),
    ),
  );
  renderAppAt("/");

  const dialog = await openNewNote();
  await userEvent.click(dialog.getByRole("combobox", { name: "Notebook" }));
  await userEvent.type(
    await screen.findByPlaceholderText("Find or create a notebook..."),
    "Recipes",
  );
  await userEvent.click(await screen.findByRole("option", { name: 'Create "Recipes"' }));
  await userEvent.type(dialog.getByLabelText("Content"), "Too long.");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(
    await dialog.findByText("Must be at most 10000 characters.", { exact: false }),
  ).toBeDefined();
  const behindTheDialog = { hidden: true };
  expect(
    await screen.findByRole("tab", { name: "Recipes", selected: true, ...behindTheDialog }),
  ).toBeDefined();
  expect(requests).toEqual([{ method: "POST", path: "/notebooks", body: { name: "Recipes" } }]);
});
