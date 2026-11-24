import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Note, NoteInput } from "./api/generated";
import { aNotebook, api, device, validationProblem } from "../test/api";
import { renderAppAt } from "../test/render";

const diary = aNotebook("201", "Diary");
const plants = aNotebook("202", "Plants");

function serveNoteCreation() {
  const created: NoteInput[] = [];
  api.use(
    http.post<never, NoteInput>("/api/notes", async ({ request }) => {
      const input = await request.json();
      created.push(input);
      const note: Note = {
        id: "0193b3a0-0000-7000-8000-000000000301",
        ...input,
        created_at: "2026-11-24T18:35:00Z",
        updated_at: "2026-11-24T18:35:00Z",
      };
      return HttpResponse.json(note, { status: 201 });
    }),
  );
  return created;
}

beforeEach(() => {
  setSystemTime(new Date(2026, 10, 24, 15, 35, 42));
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/notebooks", () => HttpResponse.json([diary, plants])),
  );
});

afterEach(() => setSystemTime());

function notes() {
  return within(screen.getByRole("region", { name: "Notes" }));
}

test("adds a note to the selected notebook at the current minute with Ctrl+Enter", async () => {
  const created = serveNoteCreation();
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("tab", { name: "Plants" }));
  const field = notes().getByRole("textbox", { name: "Quick note" });
  await userEvent.type(field, "  Repotted the **fern**.{Enter}Roots were fine.  ");
  expect(created).toEqual([]);
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(""));
  expect(created).toEqual([
    {
      notebook_id: plants.id,
      content: "Repotted the **fern**.\nRoots were fine.",
      date: "2026-11-24T15:35",
    },
  ]);
});

test("shows a rejected quick note under the field and keeps the draft", async () => {
  api.use(
    http.post("/api/notes", () =>
      validationProblem([{ pointer: "#/content", detail: "Must be at most 10000 characters." }]),
    ),
  );
  renderAppAt("/");

  const field = await screen.findByRole("textbox", { name: "Quick note" });
  await userEvent.type(field, "Too long{Control>}{Enter}{/Control}");

  expect(
    await notes().findByText("Must be at most 10000 characters.", { exact: false }),
  ).toBeDefined();
  expect((field as HTMLTextAreaElement).value).toBe("Too long");
});

test("does not send an empty quick note", async () => {
  const created = serveNoteCreation();
  renderAppAt("/");

  const field = await screen.findByRole("textbox", { name: "Quick note" });
  await userEvent.type(field, "   {Control>}{Enter}{/Control}");

  expect(created).toEqual([]);
});

test("hides the quick note when there are no notebooks", async () => {
  api.use(http.get("/api/notebooks", () => HttpResponse.json([])));
  renderAppAt("/");

  await screen.findByText("No notebooks yet. Use + to add a note.");
  expect(screen.queryByRole("textbox", { name: "Quick note" })).toBeNull();
});
