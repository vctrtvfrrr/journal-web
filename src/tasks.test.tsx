import { beforeEach, expect, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Task, TaskChanges, TaskInput } from "./api/generated";
import { api, device, problem, validationProblem } from "../test/api";
import { renderAppAt } from "../test/render";

function aTask(overrides: Partial<Task>): Task {
  return {
    id: "0193b3a0-0000-7000-8000-000000000101",
    title: "Read the journal",
    description: null,
    status: "todo",
    priority: 3,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
    ...overrides,
  };
}

const urgent = aTask({
  id: "0193b3a0-0000-7000-8000-000000000102",
  title: "Pay rent",
  description: "Transfer before the 5th",
  priority: 1,
  status: "doing",
});
const reading = aTask({ id: "0193b3a0-0000-7000-8000-000000000103", title: "Read a chapter" });
const finished = aTask({
  id: "0193b3a0-0000-7000-8000-000000000104",
  title: "Buy milk",
  status: "done",
  priority: 2,
});

function serveTasks(tasks: Task[]) {
  api.use(http.get("/api/tasks", () => HttpResponse.json(tasks)));
}

beforeEach(() => {
  api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));
});

async function pendingListFound(title: string) {
  return within(await screen.findByRole("list", { name: "Pending tasks" })).findByText(title);
}

function pendingList() {
  return within(screen.getByRole("list", { name: "Pending tasks" }));
}

test("lists pending tasks with priority, status and description, and hides completed ones", async () => {
  serveTasks([urgent, reading, finished]);
  renderAppAt("/");

  await screen.findByRole("list", { name: "Pending tasks" });
  const rows = pendingList().getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  const rent = within(rows[0]!);
  expect(rent.getByText("P1")).toBeDefined();
  expect(
    rent.getByRole("button", { name: "Pay rent", description: "Transfer before the 5th" }),
  ).toBeDefined();
  expect(within(rows[1]!).getByRole("button", { name: "Read a chapter" })).toBeDefined();
  expect(rent.getByRole("checkbox", { name: "Pay rent: doing" }).getAttribute("aria-checked")).toBe(
    "mixed",
  );
  expect(screen.queryByText("Buy milk")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: /^completed/ }));
  const completed = within(screen.getByRole("list", { name: "Completed tasks" }));
  expect(completed.getByRole("checkbox", { name: "Buy milk: done" })).toBeDefined();
});

test("lists tasks in progress first within each priority, keeping the API order otherwise", async () => {
  serveTasks([
    aTask({ id: "0193b3a0-0000-7000-8000-000000000111", title: "Call the bank", priority: 1 }),
    aTask({
      id: "0193b3a0-0000-7000-8000-000000000112",
      title: "File taxes",
      priority: 1,
      status: "doing",
    }),
    aTask({ id: "0193b3a0-0000-7000-8000-000000000113", title: "Water plants" }),
    aTask({ id: "0193b3a0-0000-7000-8000-000000000114", title: "Clean desk" }),
    aTask({
      id: "0193b3a0-0000-7000-8000-000000000115",
      title: "Write notes",
      status: "doing",
    }),
  ]);
  renderAppAt("/");

  await screen.findByRole("list", { name: "Pending tasks" });
  expect(
    pendingList()
      .getAllByRole("button")
      .map((row) => row.textContent),
  ).toEqual(["File taxes", "Call the bank", "Write notes", "Water plants", "Clean desk"]);
});

test("lists completed tasks by most recently updated first", async () => {
  serveTasks([
    aTask({
      id: "0193b3a0-0000-7000-8000-000000000121",
      title: "Renew passport",
      status: "done",
      priority: 1,
      updated_at: "2026-11-20T09:00:00Z",
    }),
    aTask({
      id: "0193b3a0-0000-7000-8000-000000000122",
      title: "Return books",
      status: "done",
      updated_at: "2026-11-23T18:30:00.5Z",
    }),
    aTask({
      id: "0193b3a0-0000-7000-8000-000000000123",
      title: "Fix the bike",
      status: "done",
      priority: 5,
      updated_at: "2026-11-22T12:00:00Z",
    }),
  ]);
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("button", { name: /^completed/ }));
  const completed = within(screen.getByRole("list", { name: "Completed tasks" }));
  expect(completed.getAllByRole("button").map((row) => row.textContent)).toEqual([
    "Return books",
    "Fix the bike",
    "Renew passport",
  ]);
});

test("says when there are no tasks yet", async () => {
  renderAppAt("/");

  expect(await screen.findByText("No pending tasks.")).toBeDefined();
  expect(screen.getByLabelText("Task title")).toBeDefined();
});

test("shows a failed load with a retry, without the create field", async () => {
  let failing = true;
  api.use(
    http.get("/api/tasks", () =>
      failing ? problem(500, "The server failed.") : HttpResponse.json([reading]),
    ),
  );
  renderAppAt("/");

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The server failed.");
  expect(screen.queryByLabelText("Task title")).toBeNull();

  failing = false;
  await userEvent.click(within(alert).getByRole("button", { name: "retry" }));
  expect(await screen.findByText("Read a chapter")).toBeDefined();
  expect(screen.getByLabelText("Task title")).toBeDefined();
});

test("creates a task from the trimmed title and clears the field", async () => {
  const created: TaskInput[] = [];
  let tasks: Task[] = [];
  api.use(
    http.get("/api/tasks", () => HttpResponse.json(tasks)),
    http.post("/api/tasks", async ({ request }) => {
      const body = (await request.json()) as TaskInput;
      created.push(body);
      tasks = [aTask({ title: body.title })];
      return HttpResponse.json(tasks[0], { status: 201 });
    }),
  );
  renderAppAt("/");

  const input = (await screen.findByLabelText("Task title")) as HTMLInputElement;
  await userEvent.type(input, "  Read the journal  {Enter}");

  expect(await pendingListFound("Read the journal")).toBeDefined();
  expect(created).toEqual([{ title: "Read the journal" }]);
  await waitFor(() => expect(input.value).toBe(""));
});

test("shows a rejected title under the field and keeps the draft", async () => {
  api.use(
    http.post("/api/tasks", () =>
      validationProblem([{ pointer: "#/title", detail: "That title is invalid." }]),
    ),
  );
  renderAppAt("/");

  const input = (await screen.findByLabelText("Task title")) as HTMLInputElement;
  await userEvent.type(input, "Keep this draft");
  await userEvent.click(screen.getByRole("button", { name: "Add task" }));

  expect(await screen.findByText("✗ That title is invalid.")).toBeDefined();
  expect(input.value).toBe("Keep this draft");
});

test("cycles the status from todo to doing to done before the API answers", async () => {
  const patches: TaskChanges[] = [];
  let answer = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  let tasks = [reading];
  api.use(
    http.get("/api/tasks", () => HttpResponse.json(tasks)),
    http.patch("/api/tasks/:id", async ({ request }) => {
      const body = (await request.json()) as TaskChanges;
      patches.push(body);
      await answered;
      tasks = [{ ...reading, status: body.status ?? reading.status }];
      return HttpResponse.json(tasks[0]);
    }),
  );
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("checkbox", { name: "Read a chapter: todo" }));
  expect(pendingList().getByRole("checkbox", { name: "Read a chapter: doing" })).toBeDefined();
  await userEvent.click(pendingList().getByRole("checkbox", { name: "Read a chapter: doing" }));
  expect(screen.queryByRole("list", { name: "Pending tasks" })).toBeNull();

  answer();
  await waitFor(() => expect(patches).toEqual([{ status: "doing" }, { status: "done" }]));
  await userEvent.click(screen.getByRole("button", { name: /^completed/ }));
  const completed = within(screen.getByRole("list", { name: "Completed tasks" }));
  await userEvent.click(completed.getByRole("checkbox", { name: "Read a chapter: done" }));
  expect(await pendingListFound("Read a chapter")).toBeDefined();
  await waitFor(() => expect(patches.at(-1)).toEqual({ status: "todo" }));
});

test("puts a task completed just now at the top of the completed list before the API answers", async () => {
  const writing = aTask({
    id: "0193b3a0-0000-7000-8000-000000000131",
    title: "Write a letter",
    status: "doing",
    updated_at: "2026-11-01T10:00:00Z",
  });
  serveTasks([writing, finished]);
  api.use(http.patch("/api/tasks/:id", () => new Promise<never>(() => {})));
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("checkbox", { name: "Write a letter: doing" }));
  await userEvent.click(screen.getByRole("button", { name: /^completed/ }));

  const completed = within(screen.getByRole("list", { name: "Completed tasks" }));
  expect(completed.getAllByRole("button").map((row) => row.textContent)).toEqual([
    "Write a letter",
    "Buy milk",
  ]);
});

test("restores the status and warns when the API refuses the change", async () => {
  serveTasks([reading]);
  api.use(http.patch("/api/tasks/:id", () => problem(500, "The server failed.")));
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("checkbox", { name: "Read a chapter: todo" }));

  expect(await screen.findByText("Couldn't update task.")).toBeDefined();
  expect(pendingList().getByRole("checkbox", { name: "Read a chapter: todo" })).toBeDefined();
});

function serveEditableTasks(initial: Task[]) {
  const patches: TaskChanges[] = [];
  let tasks = initial;
  const find = (id: unknown) => tasks.find((task) => task.id === id);
  api.use(
    http.get("/api/tasks", () => HttpResponse.json(tasks)),
    http.get("/api/tasks/:id", ({ params }) => {
      const task = find(params.id);
      return task ? HttpResponse.json(task) : problem(404, "Task not found.");
    }),
    http.patch("/api/tasks/:id", async ({ request, params }) => {
      const body = (await request.json()) as TaskChanges;
      patches.push(body);
      tasks = tasks.map((task) =>
        task.id === params.id
          ? {
              ...task,
              title: body.title ?? task.title,
              description: body.description === undefined ? task.description : body.description,
              priority: body.priority ?? task.priority,
              status: body.status ?? task.status,
            }
          : task,
      );
      return HttpResponse.json(find(params.id));
    }),
    http.delete("/api/tasks/:id", ({ params }) => {
      tasks = tasks.filter((task) => task.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return patches;
}

test("shows the task rendered in a dialog opened from the title", async () => {
  serveEditableTasks([
    aTask({ title: "Read **Dune**", description: "## Plan\n\n- one chapter a day" }),
  ]);
  const history = renderAppAt("/");

  await userEvent.click(await screen.findByRole("button", { name: "Read Dune" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  expect(history.location.pathname).toBe("/tasks/0193b3a0-0000-7000-8000-000000000101");
  expect(dialog.getByText("Dune").tagName).toBe("STRONG");
  expect(dialog.getByRole("heading", { name: "Plan" })).toBeDefined();
  expect(dialog.getByRole("listitem").textContent).toBe("one chapter a day");
  expect(dialog.queryByRole("textbox")).toBeNull();
});

test("edits the title in place and stays on the task after saving", async () => {
  const patches = serveEditableTasks([urgent]);
  const history = renderAppAt(`/tasks/${urgent.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  await userEvent.click(dialog.getByRole("button", { name: "Pay rent" }));
  const title = dialog.getByLabelText("Title");
  expect(document.activeElement).toBe(title);
  await userEvent.clear(title);
  await userEvent.type(title, "Pay the rent");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(await dialog.findByRole("button", { name: "Pay the rent" })).toBeDefined();
  expect(dialog.queryByRole("textbox")).toBeNull();
  expect(history.location.pathname).toBe(`/tasks/${urgent.id}`);
  const list = await screen.findByRole("list", { name: "Pending tasks", hidden: true });
  expect(within(list).getByText("Pay the rent")).toBeDefined();
  expect(patches).toEqual([{ title: "Pay the rent", description: "Transfer before the 5th" }]);
});

test("edits the description from the rendered description", async () => {
  const patches = serveEditableTasks([urgent]);
  renderAppAt(`/tasks/${urgent.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  await userEvent.click(dialog.getByRole("button", { name: "Transfer before the 5th" }));
  const description = dialog.getByLabelText("Description");
  expect(document.activeElement).toBe(description);
  await userEvent.clear(description);
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(await dialog.findByRole("button", { name: "Description" })).toBeDefined();
  expect(patches).toEqual([{ title: "Pay rent", description: "" }]);
});

test("cancels the edit with Escape and keeps the dialog open", async () => {
  const patches = serveEditableTasks([urgent]);
  renderAppAt(`/tasks/${urgent.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  await userEvent.click(dialog.getByRole("button", { name: "Pay rent" }));
  await userEvent.type(dialog.getByLabelText("Title"), " now");
  await userEvent.keyboard("{Escape}");

  expect(dialog.getByRole("button", { name: "Pay rent" })).toBeDefined();
  expect(screen.getByRole("dialog", { name: "Task" })).toBeDefined();
  expect(patches).toEqual([]);
});

test("changes the priority right away", async () => {
  const patches = serveEditableTasks([urgent]);
  renderAppAt(`/tasks/${urgent.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  await userEvent.click(dialog.getByRole("radio", { name: "P2" }));

  await waitFor(() => expect(patches).toEqual([{ priority: 2 }]));
  const list = await screen.findByRole("list", { name: "Pending tasks", hidden: true });
  await waitFor(() => expect(within(list).getByText("P2")).toBeDefined());
  expect(dialog.getByRole("radio", { name: "P2" }).getAttribute("aria-checked")).toBe("true");
});

test("opens links in the description in a new tab without starting to edit", async () => {
  serveEditableTasks([aTask({ description: "See [the docs](https://example.com/docs)" })]);
  renderAppAt("/tasks/0193b3a0-0000-7000-8000-000000000101");

  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  const link = dialog.getByRole("link", { name: "the docs" });
  expect(link.getAttribute("target")).toBe("_blank");
  link.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(link);

  expect(dialog.queryByRole("textbox")).toBeNull();
});

test("edits a completed task from its title", async () => {
  const patches = serveEditableTasks([finished]);
  const history = renderAppAt("/");

  await userEvent.click(await screen.findByRole("button", { name: /^completed/ }));
  await userEvent.click(screen.getByRole("button", { name: "Buy milk" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  expect(history.location.pathname).toBe(`/tasks/${finished.id}`);
  await userEvent.click(dialog.getByRole("button", { name: "Buy milk" }));
  await userEvent.type(dialog.getByLabelText("Title"), " and eggs");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  expect(await dialog.findByRole("button", { name: "Buy milk and eggs" })).toBeDefined();
  expect(patches).toEqual([{ title: "Buy milk and eggs", description: "" }]);
});

test("opens a task from its address and changes its status in the dialog", async () => {
  const patches = serveEditableTasks([reading]);
  renderAppAt(`/tasks/${reading.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  expect(dialog.getByRole("button", { name: "Read a chapter" })).toBeDefined();
  await userEvent.click(dialog.getByRole("checkbox", { name: "Read a chapter: todo" }));

  expect(dialog.getByRole("checkbox", { name: "Read a chapter: doing" })).toBeDefined();
  await waitFor(() => expect(patches).toEqual([{ status: "doing" }]));
});

test("goes back to the list when the task in the address does not exist", async () => {
  serveEditableTasks([]);
  const history = renderAppAt("/tasks/0193b3a0-0000-7000-8000-0000000009ff");

  expect(await screen.findByText("Task not found.")).toBeDefined();
  expect(history.location.pathname).toBe("/");
  expect(screen.queryByRole("dialog", { name: "Task" })).toBeNull();
});

test("deletes a task from its dialog and goes back to the list", async () => {
  serveEditableTasks([urgent, reading]);
  const history = renderAppAt(`/tasks/${urgent.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Task" }));
  await userEvent.click(dialog.getByRole("button", { name: "Delete Pay rent" }));
  const confirm = within(await screen.findByRole("dialog", { name: "Delete task?" }));
  await userEvent.click(confirm.getByRole("button", { name: "delete task" }));

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  await waitFor(() => expect(screen.queryByText("Pay rent")).toBeNull());
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("sends status changes for one task one at a time", async () => {
  const started: TaskChanges[] = [];
  let answerFirst = () => {};
  const firstAnswered = new Promise<void>((resolve) => (answerFirst = resolve));
  serveTasks([reading]);
  api.use(
    http.patch("/api/tasks/:id", async ({ request }) => {
      const body = (await request.json()) as TaskChanges;
      started.push(body);
      if (started.length === 1) await firstAnswered;
      return HttpResponse.json({ ...reading, status: body.status ?? reading.status });
    }),
  );
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("checkbox", { name: "Read a chapter: todo" }));
  await userEvent.click(pendingList().getByRole("checkbox", { name: "Read a chapter: doing" }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(started).toEqual([{ status: "doing" }]);

  answerFirst();
  await waitFor(() => expect(started).toEqual([{ status: "doing" }, { status: "done" }]));
});

test("a failed status change rolls back only its own task", async () => {
  serveTasks([urgent, reading]);
  api.use(
    http.patch("/api/tasks/:id", async ({ params, request }) => {
      const body = (await request.json()) as TaskChanges;
      if (params.id === reading.id) return problem(500, "The server failed.");
      await new Promise((resolve) => setTimeout(resolve, 100));
      return HttpResponse.json({ ...urgent, status: body.status ?? urgent.status });
    }),
  );
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("checkbox", { name: "Pay rent: doing" }));
  await userEvent.click(pendingList().getByRole("checkbox", { name: "Read a chapter: todo" }));

  expect(await screen.findByText("Couldn't update task.")).toBeDefined();
  expect(pendingList().getByRole("checkbox", { name: "Read a chapter: todo" })).toBeDefined();
  expect(screen.queryByRole("checkbox", { name: "Pay rent: doing" })).toBeNull();
});

test("opens a task from the keyboard", async () => {
  serveEditableTasks([reading]);
  const history = renderAppAt("/");

  (await screen.findByRole("button", { name: "Read a chapter" })).focus();
  await userEvent.keyboard("{Enter}");

  expect(await screen.findByRole("dialog", { name: "Task" })).toBeDefined();
  expect(history.location.pathname).toBe(`/tasks/${reading.id}`);
});

test("renders inline Markdown in the title and description, and only that", async () => {
  serveTasks([
    aTask({
      title: "Read **Dune** and ~~Emma~~",
      description: "# Chapter `one`\n\n| a | b |\n| - | - |\n| 1 | 2 |",
    }),
  ]);
  renderAppAt("/");

  const row = within(await pendingListFound("Dune").then((title) => title.closest("li")!));
  expect(row.getByText("Dune").tagName).toBe("STRONG");
  expect(row.getByText("Emma").tagName).toBe("DEL");
  expect(row.getByText("one").tagName).toBe("CODE");
  expect(row.queryByRole("heading")).toBeNull();
  expect(row.queryByRole("table")).toBeNull();
  expect(row.getByRole("button", { name: "Read Dune and Emma" })).toBeDefined();
});

test("opens links in the title in a new tab without opening the task", async () => {
  serveTasks([aTask({ title: "Read [the docs](https://example.com/docs)" })]);
  const history = renderAppAt("/");

  const link = await screen.findByRole("link", { name: "the docs" });
  expect(link.getAttribute("href")).toBe("https://example.com/docs");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  link.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(link);

  expect(history.location.pathname).toBe("/");
  expect(screen.queryByRole("dialog")).toBeNull();
});
