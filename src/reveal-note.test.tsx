import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Note, NoteChanges, NoteInput } from "./api/generated";
import { aNote, aNotebook, api, device, notesPage, problem } from "../test/api";
import { setViewportWidth } from "../test/viewport";
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
      cursors.push(new URL(request.url).searchParams.get("cursor"));
      return notesPage(request, notes, pageSize);
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

test("loads the pages of the note's period until the saved note shows up", async () => {
  const old = aNote("4", "2024", "Old note");
  const cursors = serveNotes(
    [
      aNote("1", "2026-11-20", "Newest"),
      aNote("2", "2024-12-05", "December"),
      aNote("3", "2024-11-05", "November"),
      old,
    ],
    1,
  );
  renderAppAt(`/notes/${old.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  await userEvent.type(dialog.getByLabelText("Content"), " edited");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await revealedNote("Old note edited");
  expect(cursors.filter(Boolean)).toEqual(["2", "3"]);
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

test("scrolls to a note added from the new note dialog", async () => {
  serveNotes([aNote("1", "2026-11-20", "Older")]);
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("button", { name: "New note" }));
  const dialog = within(await screen.findByRole("dialog", { name: "New note" }));
  await userEvent.type(dialog.getByLabelText("Content"), "From the dialog");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await revealedNote("From the dialog");
});

test("stops looking for the note when an older page fails", async () => {
  const old = aNote("3", "2024", "Old note");
  serveNotes([aNote("1", "2026-11-20", "Newest"), aNote("2", "2024-12-05", "December"), old], 1);
  let olderPageRequests = 0;
  renderAppAt(`/notes/${old.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  await screen.findByText("Newest");
  api.use(
    http.get("/api/notes", ({ request }) => {
      if (!new URL(request.url).searchParams.get("cursor")) return;
      olderPageRequests++;
      return problem(503, "Try later.");
    }),
  );
  await userEvent.type(dialog.getByLabelText("Content"), " edited");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(await screen.findByText("Try later.")).toBeDefined();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(olderPageRequests).toBe(1);
});

test("switches the mobile view to the notes to show the saved note", async () => {
  setViewportWidth(375);
  const note = aNote("1", "2026-11-20T08:00", "Opened from a link");
  serveNotes([note]);
  renderAppAt(`/notes/${note.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit note" }));
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await revealedNote("Opened from a link");
  expect(screen.getByRole("tab", { name: "Notes" }).getAttribute("aria-selected")).toBe("true");
});

test("keeps the search and does not scroll when the saved note does not match it", async () => {
  serveNotes([aNote("1", "2026-11-20", "Painted the quarto")]);
  const history = renderAppAt("/?q=quarto");

  const panel = within(await screen.findByRole("tabpanel", { name: "Diary" }));
  expect(await panel.findByText("Painted the quarto")).toBeDefined();
  await userEvent.type(screen.getByLabelText("Quick note"), "Watered the fern");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await waitFor(() =>
    expect(screen.getByLabelText<HTMLTextAreaElement>("Quick note").value).toBe(""),
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(scrolledTo.filter((row) => row.hasAttribute("data-note"))).toEqual([]);
  expect(panel.queryByText("Watered the fern")).toBeNull();
  expect(history.location.search).toBe("?q=quarto");
});

test("still scrolls to a saved note that matches the search", async () => {
  serveNotes([aNote("1", "2026-11-20", "Painted the quarto")]);
  renderAppAt("/?q=quarto");

  await userEvent.type(await screen.findByLabelText("Quick note"), "Cleaned the quarto");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await revealedNote("Cleaned the quarto");
});
