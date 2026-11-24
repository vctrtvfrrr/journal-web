import { beforeEach, expect, test } from "bun:test";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Notebook, Task } from "./api/generated";
import { aNotebook, api, device, problem } from "../test/api";
import { renderAppAt } from "../test/render";
import { setViewportWidth } from "../test/viewport";

const diary = aNotebook("201", "Diary");
const plants = aNotebook("202", "Plants");
const task: Task = {
  id: "0193b3a0-0000-7000-8000-000000000101",
  title: "Water the ferns",
  description: null,
  status: "todo",
  priority: 3,
  created_at: "2026-11-23T10:00:00Z",
  updated_at: "2026-11-23T10:00:00Z",
};

function serveNotebooks(notebooks: Notebook[]) {
  api.use(http.get("/api/notebooks", () => HttpResponse.json(notebooks)));
}

function useMobileViewport() {
  setViewportWidth(390);
}

beforeEach(() => {
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/tasks", () => HttpResponse.json([task])),
  );
});

test("shows tasks and notes side by side on desktop", async () => {
  serveNotebooks([diary]);
  renderAppAt("/");

  const tasks = within(await screen.findByRole("region", { name: "Tasks" }));
  expect(await tasks.findByText("Water the ferns")).toBeDefined();
  const notes = within(screen.getByRole("region", { name: "Notes" }));
  expect(await notes.findByRole("tab", { name: "Diary" })).toBeDefined();
  expect(screen.queryByRole("tablist", { name: "View" })).toBeNull();
});

test("switches between tasks and notes from the bottom bar on mobile, and remembers the choice", async () => {
  useMobileViewport();
  serveNotebooks([diary]);
  renderAppAt("/");

  const view = within(await screen.findByRole("tablist", { name: "View" }));
  expect(await screen.findByText("Water the ferns")).toBeDefined();
  expect(screen.queryByRole("region", { name: "Notes" })).toBeNull();

  await userEvent.click(view.getByRole("tab", { name: "Notes" }));
  expect(await screen.findByRole("tab", { name: "Diary" })).toBeDefined();
  expect(screen.queryByText("Water the ferns")).toBeNull();

  cleanup();
  renderAppAt("/");
  expect(await screen.findByRole("tab", { name: "Diary" })).toBeDefined();
  expect(screen.queryByText("Water the ferns")).toBeNull();
});

test("shows one tab per notebook in API order and opens the first one", async () => {
  serveNotebooks([diary, plants]);
  renderAppAt("/");

  const notes = within(await screen.findByRole("region", { name: "Notes" }));
  const tabs = await notes.findAllByRole("tab");
  expect(tabs.map((tab) => tab.textContent)).toEqual(["Diary", "Plants"]);
  expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
});

test("remembers the selected notebook and falls back to the first when it is gone", async () => {
  serveNotebooks([diary, plants]);
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("tab", { name: "Plants" }));
  cleanup();
  renderAppAt("/");
  const remembered = await screen.findByRole("tab", { name: "Plants" });
  expect(remembered.getAttribute("aria-selected")).toBe("true");

  cleanup();
  serveNotebooks([diary]);
  renderAppAt("/");
  const fallback = await screen.findByRole("tab", { name: "Diary" });
  expect(fallback.getAttribute("aria-selected")).toBe("true");
});

test("says when there are no notebooks yet", async () => {
  renderAppAt("/");

  const notes = within(await screen.findByRole("region", { name: "Notes" }));
  expect(await notes.findByText("No notebooks yet. Use + to add a note.")).toBeDefined();
  expect(notes.queryByRole("tab")).toBeNull();
});

test("shows a failed notebook load with a retry inside the notes column", async () => {
  let failing = true;
  api.use(
    http.get("/api/notebooks", () =>
      failing ? problem(500, "Database is down.") : HttpResponse.json([diary]),
    ),
  );
  renderAppAt("/");

  const notes = within(await screen.findByRole("region", { name: "Notes" }));
  expect(await notes.findByText("Database is down.")).toBeDefined();
  expect(screen.getByText("Couldn't load")).toBeDefined();
  expect(await screen.findByText("Water the ferns")).toBeDefined();

  failing = false;
  await userEvent.click(notes.getByRole("button", { name: "Retry" }));
  expect(await notes.findByRole("tab", { name: "Diary" })).toBeDefined();
});
