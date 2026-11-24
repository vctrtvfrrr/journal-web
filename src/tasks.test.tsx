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
  expect(rows.map((row) => within(row).getAllByRole("link")[0]!.textContent)).toEqual([
    "Pay rent",
    "Read a chapter",
  ]);
  const rent = within(rows[0]!);
  expect(rent.getByText("P1")).toBeDefined();
  expect(rent.getByText("Transfer before the 5th")).toBeDefined();
  expect(rent.getByRole("checkbox", { name: "Pay rent: doing" }).getAttribute("aria-checked")).toBe(
    "mixed",
  );
  expect(screen.queryByText("Buy milk")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: /^Completed/ }));
  const completed = within(screen.getByRole("list", { name: "Completed tasks" }));
  expect(completed.getByRole("checkbox", { name: "Buy milk: done" })).toBeDefined();
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
  await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
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
  await userEvent.click(screen.getByRole("button", { name: /^Completed/ }));
  const completed = within(screen.getByRole("list", { name: "Completed tasks" }));
  await userEvent.click(completed.getByRole("checkbox", { name: "Read a chapter: done" }));
  expect(await pendingListFound("Read a chapter")).toBeDefined();
  await waitFor(() => expect(patches.at(-1)).toEqual({ status: "todo" }));
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

test("edits title, description and priority in the dialog opened from the title", async () => {
  const patches = serveEditableTasks([urgent]);
  const history = renderAppAt("/");

  await userEvent.click(await screen.findByRole("link", { name: "Pay rent" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Edit task" }));
  expect(history.location.pathname).toBe(`/tasks/${urgent.id}`);
  const title = dialog.getByLabelText("Title");
  await userEvent.clear(title);
  await userEvent.type(title, "Pay the rent");
  await userEvent.clear(dialog.getByLabelText("Description"));
  await userEvent.click(dialog.getByRole("radio", { name: "P2" }));
  await userEvent.click(dialog.getByRole("button", { name: "Save" }));

  expect(await pendingListFound("Pay the rent")).toBeDefined();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(history.location.pathname).toBe("/");
  expect(pendingList().getByText("P2")).toBeDefined();
  expect(patches).toEqual([{ title: "Pay the rent", description: "", priority: 2 }]);
});

test("deletes a task from the list after confirming", async () => {
  serveEditableTasks([urgent, reading]);
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("button", { name: "Delete Pay rent" }));
  const confirm = within(await screen.findByRole("dialog", { name: "Delete task?" }));
  await userEvent.click(confirm.getByRole("button", { name: "Delete task" }));

  await waitFor(() => expect(screen.queryByText("Pay rent")).toBeNull());
  expect(pendingList().getByText("Read a chapter")).toBeDefined();
});

test("edits a completed task from its edit button", async () => {
  const patches = serveEditableTasks([finished]);
  const history = renderAppAt("/");

  await userEvent.click(await screen.findByRole("button", { name: /^Completed/ }));
  await userEvent.click(screen.getByRole("link", { name: "Edit Buy milk" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Edit task" }));
  expect(history.location.pathname).toBe(`/tasks/${finished.id}`);
  await userEvent.type(dialog.getByLabelText("Title"), " and eggs");
  await userEvent.click(dialog.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(patches).toEqual([{ title: "Buy milk and eggs", description: "", priority: 2 }]);
});

test("opens a task from its address and changes its status in the dialog", async () => {
  const patches = serveEditableTasks([reading]);
  renderAppAt(`/tasks/${reading.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit task" }));
  expect((dialog.getByLabelText("Title") as HTMLInputElement).value).toBe("Read a chapter");
  await userEvent.click(dialog.getByRole("checkbox", { name: "Read a chapter: todo" }));

  expect(dialog.getByRole("checkbox", { name: "Read a chapter: doing" })).toBeDefined();
  await waitFor(() => expect(patches).toEqual([{ status: "doing" }]));
});

test("goes back to the list when the task in the address does not exist", async () => {
  serveEditableTasks([]);
  const history = renderAppAt("/tasks/0193b3a0-0000-7000-8000-0000000009ff");

  expect(await screen.findByText("Task not found.")).toBeDefined();
  expect(history.location.pathname).toBe("/");
  expect(screen.queryByRole("dialog", { name: "Edit task" })).toBeNull();
});

test("deletes a task from its dialog and goes back to the list", async () => {
  serveEditableTasks([urgent, reading]);
  const history = renderAppAt(`/tasks/${urgent.id}`);

  const dialog = within(await screen.findByRole("dialog", { name: "Edit task" }));
  await userEvent.click(dialog.getByRole("button", { name: "Delete Pay rent" }));
  const confirm = within(await screen.findByRole("dialog", { name: "Delete task?" }));
  await userEvent.click(confirm.getByRole("button", { name: "Delete task" }));

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
