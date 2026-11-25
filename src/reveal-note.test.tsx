import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Note, NoteChanges, NoteInput } from "./api/generated";
import { aNote, aNotebook, api, device } from "../test/api";
import { renderAppAt } from "../test/render";

const diary = aNotebook("1", "Diary");
const plants = aNotebook("2", "Plants");
const originalScrollIntoView = Element.prototype.scrollIntoView;
let scrolledTo: Element[] = [];

function serveNotes(initial: Note[], pageSize = 50) {
  let notes = [...initial];
  const cursors: (string | null)[] = [];
  api.use(
    http.get("/api/notes", ({ request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get("cursor");
      cursors.push(cursor);
      const inNotebook = notes.filter(
        (note) => note.notebook_id === url.searchParams.get("notebook"),
      );
      const start = Number(cursor ?? 0);
      const end = start + pageSize;
      const headers: HeadersInit =
        end < inNotebook.length ? { Link: `</api/notes?cursor=${end}>; rel="next"` } : {};
      return HttpResponse.json(inNotebook.slice(start, end), { headers });
    }),
    http.get("/api/notes/:id", ({ params }) =>
      HttpResponse.json(notes.find((note) => note.id === params.id)),
    ),
    http.post<never, NoteInput>("/api/notes", async ({ request }) => {
      const input = await request.json();
      const note: Note = { ...aNote("99", input.date, input.content), ...input };
      notes = [note, ...notes];
      return HttpResponse.json(note, { status: 201 });
    }),
    http.patch<{ id: string }, NoteChanges>("/api/notes/:id", async ({ params, request }) => {
      const changes = await request.json();
      notes = notes.map((note) =>
        note.id === params.id
          ? {
              ...note,
              content: changes.content ?? note.content,
              date: changes.date ?? note.date,
              notebook_id: changes.notebook_id ?? note.notebook_id,
            }
          : note,
      );
      return HttpResponse.json(notes.find((note) => note.id === params.id));
    }),
  );
  return cursors;
}

beforeEach(() => {
  setSystemTime(new Date(2026, 10, 24, 15, 35, 42));
  scrolledTo = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledTo.push(this);
  };
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/notebooks", () => HttpResponse.json([diary, plants])),
  );
});

afterEach(() => {
  setSystemTime();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

async function revealedNote(text: string) {
  await waitFor(() => {
    const row = scrolledTo.at(-1);
    expect(row?.textContent).toContain(text);
    expect(row?.getAttribute("data-highlighted")).toBe("true");
  });
  return scrolledTo.at(-1)!;
}

test("scrolls to a quick note and highlights it after saving", async () => {
  serveNotes([aNote("1", "2026-11-20", "Older")]);
  renderAppAt("/");

  await userEvent.type(await screen.findByLabelText("Quick note"), "Watered the fern");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  const row = await revealedNote("Watered the fern");
  expect(within(screen.getByRole("tabpanel", { name: "Diary" })).getByText("Watered the fern"));
  expect(row.closest("[role=tabpanel]")).not.toBeNull();
});

test("opens the collapsed groups that hold the saved note", async () => {
  serveNotes([aNote("1", "2026-11-20", "Older")]);
  renderAppAt("/");

  const panel = within(await screen.findByRole("tabpanel", { name: "Diary" }));
  await userEvent.click(await panel.findByRole("button", { name: "(2026-11)" }));
  await userEvent.type(screen.getByLabelText("Quick note"), "Inside a collapsed month");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await revealedNote("Inside a collapsed month");
  expect(panel.getByRole("button", { name: "(2026-11)" }).getAttribute("aria-expanded")).toBe(
    "true",
  );
});

test("follows an edited note into its new notebook", async () => {
  const note = aNote("1", "2026-11-20T08:00", "Moved note");
  serveNotes([note]);
  renderAppAt(`/notes/${note.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  await userEvent.click(dialog.getByRole("combobox", { name: "Notebook" }));
  await userEvent.click(await screen.findByRole("option", { name: "Plants" }));
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await revealedNote("Moved note");
  expect(screen.getByRole("tab", { name: "Plants" }).getAttribute("aria-selected")).toBe("true");
});

test("loads older pages until the saved note shows up", async () => {
  const old = aNote("3", "2024-01-01", "Old note");
  const cursors = serveNotes(
    [aNote("1", "2026-11-20", "Newest"), aNote("2", "2025-06-01", "Middle"), old],
    1,
  );
  renderAppAt(`/notes/${old.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  await userEvent.type(dialog.getByLabelText("Content"), " edited");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await revealedNote("Old note edited");
  expect(cursors.filter(Boolean)).toContain("2");
});

test("does not scroll when the edit is cancelled", async () => {
  const note = aNote("1", "2026-11-20T08:00", "Untouched");
  serveNotes([note]);
  renderAppAt(`/notes/${note.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  await userEvent.click(dialog.getByRole("button", { name: "cancel" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(await screen.findByText("Untouched")).toBeDefined();
  expect(scrolledTo.filter((element) => element.hasAttribute("data-highlighted"))).toEqual([]);
});
