import { beforeEach, expect, test } from "bun:test";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Task } from "./api/generated";
import { aTask, api, device } from "../test/api";
import { renderAppAt } from "../test/render";

const move = aTask({ id: "0193b3a0-0000-7000-8000-000000000201", title: "Move out", priority: 1 });
const freight = aTask({
  id: "0193b3a0-0000-7000-8000-000000000202",
  title: "Hire freight",
  parent_id: move.id,
  priority: 1,
});
const pack = aTask({
  id: "0193b3a0-0000-7000-8000-000000000203",
  title: "Pack",
  parent_id: move.id,
  priority: 2,
});
const kitchen = aTask({
  id: "0193b3a0-0000-7000-8000-000000000204",
  title: "Kitchen",
  parent_id: pack.id,
});
const inspect = aTask({
  id: "0193b3a0-0000-7000-8000-000000000205",
  title: "Inspect",
  parent_id: move.id,
  status: "done",
});
const passport = aTask({ id: "0193b3a0-0000-7000-8000-000000000206", title: "Renew passport" });

function serveTasks(tasks: Task[]) {
  api.use(http.get("/api/tasks", () => HttpResponse.json(tasks)));
}

beforeEach(() => {
  api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));
});

test("nests subtasks under their parent, with completed ones collapsed at the end of their level", async () => {
  serveTasks([move, freight, pack, kitchen, inspect, passport]);
  renderAppAt("/");

  const subtasks = within(await screen.findByRole("list", { name: "Subtasks of Move out" }));
  expect(subtasks.getByRole("button", { name: "Hire freight" })).toBeDefined();
  expect(
    within(screen.getByRole("list", { name: "Subtasks of Pack" })).getByRole("button", {
      name: "Kitchen",
    }),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "Inspect" })).toBeNull();

  await userEvent.click(
    screen.getByRole("button", { name: "Show 1 completed subtask of Move out" }),
  );

  expect(
    within(screen.getByRole("list", { name: "Completed subtasks of Move out" })).getByRole(
      "button",
      { name: "Inspect" },
    ),
  ).toBeDefined();
});

test("collapses and expands the subtasks of a task", async () => {
  serveTasks([move, freight, pack, kitchen, passport]);
  renderAppAt("/");

  const toggle = await screen.findByRole("button", { name: "Subtasks of Move out" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");

  await userEvent.click(toggle);

  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Hire freight" })).toBeNull();
  expect(screen.getByRole("button", { name: "Renew passport" })).toBeDefined();

  await userEvent.click(toggle);

  expect(screen.getByRole("button", { name: "Kitchen" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Subtasks of Renew passport" })).toBeNull();
});

function serveTree(tasks: Task[]) {
  serveTasks(tasks);
  api.use(
    http.get("/api/tasks/:id", ({ params }) =>
      HttpResponse.json(tasks.find((task) => task.id === params.id)),
    ),
  );
}

test("lists the subtasks in the dialog, opens one, and shows its parents", async () => {
  serveTree([move, freight, pack, kitchen, passport]);
  const history = renderAppAt(`/tasks/${move.id}`);

  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.click(
    within(await dialog.findByRole("list", { name: "Subtasks of Move out" })).getByRole("button", {
      name: "Kitchen",
    }),
  );

  expect(history.location.pathname).toBe(`/tasks/${kitchen.id}`);
  const parents = within(await screen.findByRole("navigation", { name: "Parent tasks" }));
  expect(parents.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Move out",
    "Pack",
  ]);

  await userEvent.click(parents.getByRole("link", { name: "Pack" }));

  expect(history.location.pathname).toBe(`/tasks/${pack.id}`);
  history.back();
  await screen.findByRole("navigation", { name: "Parent tasks" });
  expect(history.location.pathname).toBe(`/tasks/${kitchen.id}`);
});

test("adds a subtask from the dialog of its parent", async () => {
  const tasks = [move, passport];
  let sent: unknown;
  serveTree(tasks);
  api.use(
    http.post("/api/tasks", async ({ request }) => {
      sent = await request.json();
      const created = aTask({
        id: "0193b3a0-0000-7000-8000-000000000299",
        title: "Book truck",
        parent_id: move.id,
      });
      tasks.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
  );
  renderAppAt(`/tasks/${move.id}`);

  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.type(
    await dialog.findByRole("textbox", { name: "Subtask title" }),
    " Book truck {Enter}",
  );

  expect(sent).toEqual({ title: "Book truck", parent_id: move.id });
  expect(
    await within(await dialog.findByRole("list", { name: "Subtasks of Move out" })).findByRole(
      "button",
      { name: "Book truck" },
    ),
  ).toBeDefined();
});

test("does not offer a subtask on the fourth level", async () => {
  const fourth = aTask({
    id: "0193b3a0-0000-7000-8000-000000000207",
    title: "Plates",
    parent_id: kitchen.id,
  });
  serveTree([move, pack, kitchen, fourth]);
  renderAppAt(`/tasks/${fourth.id}`);

  await screen.findByRole("navigation", { name: "Parent tasks" });
  expect(screen.queryByRole("textbox", { name: "Subtask title" })).toBeNull();
});

test("shows why the API refused a new subtask", async () => {
  serveTree([move]);
  api.use(
    http.post("/api/tasks", () =>
      HttpResponse.json(
        {
          type: "about:blank",
          title: "Unprocessable Content",
          status: 422,
          detail: "The parent Task cannot be used.",
          errors: [{ pointer: "#/parent_id", detail: "Tasks nest up to four levels deep." }],
        },
        { status: 422, headers: { "content-type": "application/problem+json" } },
      ),
    ),
  );
  renderAppAt(`/tasks/${move.id}`);

  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.type(
    await dialog.findByRole("textbox", { name: "Subtask title" }),
    "Deep{Enter}",
  );

  expect(await dialog.findByText(/Tasks nest up to four levels deep/)).toBeDefined();
});
