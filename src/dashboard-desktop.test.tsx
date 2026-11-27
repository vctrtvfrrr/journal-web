import { beforeEach, expect, test } from "bun:test";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { aNotebook, aTask, api, device } from "../test/api";
import { renderAppAt } from "../test/render";

const task = aTask({ title: "Water the ferns" });

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

test("numbers each section by importance before its title", async () => {
  renderAppAt("/");
  await sectionHeader("Weather");

  const order = ["Tasks", "Notes", "Rhythms", "Finance", "Agenda", "Weather"];
  for (const [index, name] of order.entries()) {
    const header = await sectionHeader(name);
    expect(header.textContent).toContain(`[${index + 1}]`);
    expect(header.closest("[data-panel]")?.getAttribute("aria-keyshortcuts")).toBe(
      `Alt+${index + 1}`,
    );
  }
});

function focusedPanel() {
  return document.activeElement?.closest("[data-panel]")?.getAttribute("data-panel");
}

test("Alt+number focuses the numbered panel", async () => {
  renderAppAt("/");
  await sectionHeader("Weather");

  await userEvent.keyboard("{Alt>}2{/Alt}");
  await waitFor(() => expect(focusedPanel()).toBe("notes"));
  await userEvent.keyboard("{Alt>}6{/Alt}");
  await waitFor(() => expect(focusedPanel()).toBe("weather"));
  await userEvent.keyboard("{Alt>}1{/Alt}");
  await waitFor(() => expect(focusedPanel()).toBe("tasks"));
});

test("Alt+number works while typing", async () => {
  renderAppAt("/");

  await userEvent.click(await screen.findByLabelText("Task title"));
  await userEvent.keyboard("{Alt>}2{/Alt}");
  await waitFor(() => expect(focusedPanel()).toBe("notes"));
});

test("Alt+number from a field in the same panel focuses the panel itself", async () => {
  renderAppAt("/");

  await userEvent.click(await screen.findByLabelText("Task title"));
  await userEvent.keyboard("{Alt>}1{/Alt}");
  await waitFor(() => expect(document.activeElement?.getAttribute("data-panel")).toBe("tasks"));
});

test("Alt+number opens a closed sidebar to reach its panel", async () => {
  renderAppAt("/");
  await userEvent.click(await sidebarToggle("left"));
  expect(screen.queryByRole("button", { name: /^Weather/i })).toBeNull();

  await userEvent.keyboard("{Alt>}6{/Alt}");
  await waitFor(() => expect(focusedPanel()).toBe("weather"));
  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("true");
});

test("Alt+number expands a collapsed section", async () => {
  renderAppAt("/");
  const notes = await sectionHeader("Notes");
  await userEvent.click(notes);
  expect(notes.getAttribute("aria-expanded")).toBe("false");

  await userEvent.keyboard("{Alt>}2{/Alt}");
  await waitFor(() => expect(focusedPanel()).toBe("notes"));
  expect(notes.getAttribute("aria-expanded")).toBe("true");
});

test("Alt+1 leaves an open module for the tasks panel, Alt+3 keeps it open", async () => {
  const history = renderAppAt("/weather");
  await screen.findByRole("region", { name: "Weather" });

  await userEvent.keyboard("{Alt>}3{/Alt}");
  await waitFor(() => expect(focusedPanel()).toBe("rhythms"));
  expect(history.location.pathname).toBe("/weather");

  await userEvent.keyboard("{Alt>}1{/Alt}");
  await waitFor(() => expect(history.location.pathname).toBe("/"));
  await waitFor(() => expect(focusedPanel()).toBe("tasks"));
});

test("Alt+number does nothing while a dialog is open", async () => {
  renderAppAt("/");
  const newNote = await screen.findByRole("button", { name: "New note" });
  await userEvent.click(newNote);
  const dialog = await screen.findByRole("dialog", { name: "New note" });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

  await userEvent.keyboard("{Alt>}1{/Alt}");
  expect(dialog.contains(document.activeElement)).toBe(true);

  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await userEvent.keyboard("{Control>}b{/Control}");
  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("false");
  expect(focusedPanel()).not.toBe("tasks");
});

test("Escape in a field returns focus to its panel and keeps what was typed", async () => {
  renderAppAt("/");
  const title = (await screen.findByLabelText("Task title")) as HTMLInputElement;
  await userEvent.type(title, "Buy milk");

  await userEvent.keyboard("{Escape}");
  expect(document.activeElement?.getAttribute("data-panel")).toBe("tasks");
  expect(title.value).toBe("Buy milk");
});

test("Escape in a dialog field closes only the dialog", async () => {
  renderAppAt("/");
  await userEvent.click(await screen.findByRole("button", { name: "New note" }));
  const dialog = await screen.findByRole("dialog", { name: "New note" });
  await userEvent.click(within(dialog).getByLabelText("Content"));

  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement?.getAttribute("data-panel")).toBeNull();
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
  localStorage.setItem("react-resizable-panels:journal-layout:columns", "{not json");
  localStorage.setItem("react-resizable-panels:journal-layout:center", "[1,2");
  renderAppAt("/");

  expect((await sidebarToggle("left")).getAttribute("aria-pressed")).toBe("true");
  expect(await screen.findByText("Water the ferns")).toBeDefined();
});
