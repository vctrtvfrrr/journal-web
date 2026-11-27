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

function sidebarToggle(side: "left" | "right") {
  return screen.findByRole("button", { name: `Toggle ${side} sidebar` });
}

test("shows the module sections in the side columns around tasks and notes", async () => {
  renderAppAt("/");

  const left = within(await screen.findByRole("complementary", { name: "Left sidebar" }));
  expect(left.getByRole("button", { name: /^Weather/i })).toBeDefined();
  expect(left.getByRole("button", { name: /^Agenda/i })).toBeDefined();
  const right = within(screen.getByRole("complementary", { name: "Right sidebar" }));
  expect(right.getByRole("button", { name: /^Finance/i })).toBeDefined();
  expect(right.getByRole("button", { name: /^Rhythms/i })).toBeDefined();
  expect(right.getAllByLabelText("Demo content")).toHaveLength(2);
  expect(await screen.findByText("Water the ferns")).toBeDefined();
});

test("hides and shows each sidebar from the header, and remembers it", async () => {
  renderAppAt("/");

  const toggle = await sidebarToggle("left");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  await userEvent.click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("button", { name: /^Weather/i })).toBeNull();
  expect((await sidebarToggle("right")).getAttribute("aria-pressed")).toBe("true");

  cleanup();
  renderAppAt("/");
  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("false");
  await userEvent.click(await sidebarToggle("left"));
  expect(await sectionHeader("Weather")).toBeDefined();
});

test("Ctrl+B toggles the left sidebar and Ctrl+Alt+B the right one", async () => {
  renderAppAt("/");
  await sidebarToggle("left");

  await userEvent.keyboard("{Control>}b{/Control}");
  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("false");
  expect((await sidebarToggle("right")).getAttribute("aria-pressed")).toBe("true");

  await userEvent.keyboard("{Control>}{Alt>}b{/Alt}{/Control}");
  expect((await sidebarToggle("right")).getAttribute("aria-pressed")).toBe("false");

  await userEvent.keyboard("{Meta>}b{/Meta}");
  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("true");
});

test("ignores the sidebar shortcuts while typing", async () => {
  renderAppAt("/");

  await userEvent.click(await screen.findByLabelText("Task title"));
  await userEvent.keyboard("{Control>}b{/Control}");
  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("true");
});

test("falls back to the default layout when the stored one is broken", async () => {
  localStorage.setItem("journal-layout:columns", "{not json");
  localStorage.setItem("journal-layout:center", "[1,2");
  renderAppAt("/");

  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("true");
  expect(await screen.findByText("Water the ferns")).toBeDefined();
});
