import { beforeEach, expect, test } from "bun:test";
import { cleanup, screen, within } from "@testing-library/react";
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
    http.get("/api/notebooks", () => HttpResponse.json([aNotebook("201", "Diary")])),
  );
});

function sectionHeader(name: string) {
  return screen.findByRole("button", { name: new RegExp(`^${name}`, "i") });
}

test("collapses and expands a section from its header, and remembers it", async () => {
  renderAppAt("/");

  const header = await sectionHeader("Tasks");
  expect(header.getAttribute("aria-expanded")).toBe("true");
  expect(await screen.findByText("Water the ferns")).toBeDefined();

  await userEvent.click(header);
  expect(header.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Water the ferns")).toBeNull();

  cleanup();
  renderAppAt("/");
  expect((await sectionHeader("Tasks")).getAttribute("aria-expanded")).toBe("false");
  await userEvent.click(await sectionHeader("Tasks"));
  expect(await screen.findByText("Water the ferns")).toBeDefined();
});

test("puts a resizable separator between tasks and notes", async () => {
  renderAppAt("/");

  const tasks = await screen.findByRole("region", { name: "Tasks" });
  const center = tasks.closest("[data-group]") as HTMLElement;
  expect(within(center).getAllByRole("separator")).toHaveLength(1);
});
