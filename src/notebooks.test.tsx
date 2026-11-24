import { beforeEach, expect, test } from "bun:test";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Notebook, NotebookChanges } from "./api/generated";
import { aNotebook, api, device, problem } from "../test/api";
import { renderAppAt } from "../test/render";

const diary = aNotebook("201", "Diary");
const plants = aNotebook("202", "Plants");
const college = aNotebook("203", "College");

function serveEditableNotebooks(initial: Notebook[]) {
  let notebooks = initial;
  const renames: NotebookChanges[] = [];
  const deleted: string[] = [];
  api.use(
    http.get("/api/notebooks", () => HttpResponse.json(notebooks)),
    http.patch<{ id: string }, NotebookChanges>(
      "/api/notebooks/:id",
      async ({ params, request }) => {
        const changes = await request.json();
        renames.push(changes);
        notebooks = notebooks.map((notebook) =>
          notebook.id === params.id
            ? { ...notebook, name: changes.name ?? notebook.name }
            : notebook,
        );
        return HttpResponse.json(notebooks.find(({ id }) => id === params.id));
      },
    ),
    http.delete<{ id: string }>("/api/notebooks/:id", ({ params }) => {
      deleted.push(params.id);
      notebooks = notebooks.filter(({ id }) => id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { renames, deleted };
}

beforeEach(() => {
  api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));
});

function notebookTabs() {
  return within(screen.getByRole("tablist", { name: "Notebooks" }));
}

test("renames a notebook by double-clicking its tab", async () => {
  const { renames } = serveEditableNotebooks([diary, plants]);
  renderAppAt("/");

  await userEvent.dblClick(await screen.findByRole("tab", { name: "Plants" }));
  const name = screen.getByRole("textbox", { name: "Notebook name" });
  expect((name as HTMLInputElement).value).toBe("Plants");
  await userEvent.clear(name);
  await userEvent.type(name, "  Garden {Enter}");

  expect(await notebookTabs().findByRole("tab", { name: "Garden" })).toBeDefined();
  expect(screen.queryByRole("textbox", { name: "Notebook name" })).toBeNull();
  expect(renames).toEqual([{ name: "Garden" }]);
});

test("renames the focused tab with F2 and cancels with Escape", async () => {
  const { renames } = serveEditableNotebooks([diary]);
  renderAppAt("/");

  (await screen.findByRole("tab", { name: "Diary" })).focus();
  await userEvent.keyboard("{F2}");
  await userEvent.type(screen.getByRole("textbox", { name: "Notebook name" }), "Journal{Escape}");

  expect(screen.queryByRole("textbox", { name: "Notebook name" })).toBeNull();
  expect(notebookTabs().getByRole("tab", { name: "Diary" })).toBeDefined();
  expect(renames).toEqual([]);
});

test("keeps the name field open with the reason when the rename is rejected", async () => {
  serveEditableNotebooks([diary, plants]);
  api.use(
    http.patch("/api/notebooks/:id", () => problem(409, "A notebook named Diary already exists.")),
  );
  renderAppAt("/");

  await userEvent.dblClick(await screen.findByRole("tab", { name: "Plants" }));
  const name = screen.getByRole("textbox", { name: "Notebook name" });
  await userEvent.clear(name);
  await userEvent.type(name, "Diary{Enter}");

  expect(
    (await screen.findAllByText("A notebook named Diary already exists.")).length,
  ).toBeGreaterThan(0);
  expect(name.getAttribute("aria-invalid")).toBe("true");
  expect((name as HTMLInputElement).value).toBe("Diary");
});

test("deletes a notebook from its tab menu and selects the one to its left", async () => {
  const { deleted } = serveEditableNotebooks([diary, plants, college]);
  renderAppAt("/");

  const tab = await screen.findByRole("tab", { name: "Plants" });
  await userEvent.click(tab);
  fireEvent.contextMenu(tab);
  await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
  const confirm = within(await screen.findByRole("dialog", { name: "Delete notebook?" }));
  expect(
    confirm.getByText("Delete notebook Plants? Its notes will disappear from the timeline."),
  ).toBeDefined();
  await userEvent.click(confirm.getByRole("button", { name: "Delete notebook" }));

  await waitFor(() => expect(notebookTabs().queryByRole("tab", { name: "Plants" })).toBeNull());
  expect(notebookTabs().getByRole("tab", { name: "Diary" }).getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(deleted).toEqual([plants.id]);
});

test("offers rename from the tab menu too", async () => {
  serveEditableNotebooks([diary]);
  renderAppAt("/");

  fireEvent.contextMenu(await screen.findByRole("tab", { name: "Diary" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

  expect(screen.getByRole("textbox", { name: "Notebook name" })).toBeDefined();
});
