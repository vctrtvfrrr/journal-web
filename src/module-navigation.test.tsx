import { beforeEach, expect, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Task } from "./api/generated";
import { aNotebook, api, device } from "../test/api";
import { renderAppAt } from "../test/render";

const task: Task = {
  id: "0193b3a0-0000-7000-8000-000000000101",
  title: "Water the ferns",
  description: null,
  status: "todo",
  priority: 3,
  created_at: "2026-11-23T10:00:00Z",
  updated_at: "2026-11-23T10:00:00Z",
};

beforeEach(() => {
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/tasks", () => HttpResponse.json([task])),
    http.get("/api/tasks/:id", () => HttpResponse.json(task)),
    http.get("/api/notebooks", () => HttpResponse.json([aNotebook("201", "Diary")])),
  );
});

test("opens a module in the center and keeps the sidebars", async () => {
  const history = renderAppAt("/");

  await userEvent.click(await screen.findByRole("link", { name: "Open Finance" }));

  await waitFor(() => expect(history.location.pathname).toBe("/finance"));
  expect(await screen.findByRole("region", { name: "Finance" })).toBeDefined();
  expect(screen.queryByRole("region", { name: "Tasks" })).toBeNull();
  expect(screen.getByRole("complementary", { name: "Left sidebar" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Open Finance" }).getAttribute("aria-current")).toBe(
    "page",
  );
});

test("comes back to tasks and notes as they were", async () => {
  const history = renderAppAt("/?q=quarto");

  await userEvent.type(await screen.findByLabelText("Task title"), "Half typed");
  await userEvent.click(screen.getByRole("link", { name: "Open Finance" }));
  await screen.findByRole("region", { name: "Finance" });
  expect(history.location.search).toBe("?q=quarto");

  await userEvent.click(screen.getByRole("link", { name: "Back to Tasks & Notes" }));
  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(history.location.search).toBe("?q=quarto");
  expect((await screen.findByLabelText<HTMLInputElement>("Task title")).value).toBe("Half typed");
});

test("opens a module URL directly", async () => {
  renderAppAt("/agenda");

  expect(await screen.findByRole("region", { name: "Agenda" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Back to Tasks & Notes" })).toBeDefined();
});

test("still opens a task in a dialog over tasks and notes", async () => {
  renderAppAt(`/tasks/${task.id}`);

  expect(await screen.findByRole("dialog")).toBeDefined();
  expect(screen.queryByRole("link", { name: "Back to Tasks & Notes" })).toBeNull();
});
