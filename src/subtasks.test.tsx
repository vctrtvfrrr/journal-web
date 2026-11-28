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
