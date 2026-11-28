import { expect, test } from "bun:test";
import type { Task } from "../api/generated";
import { aTask } from "../../test/api";
import { taskTree, type TaskNode } from "./task-tree";

let nextId = 0;
function task(title: string, fields: Partial<Task> = {}): Task {
  nextId += 1;
  return aTask({
    id: `0193b3a0-0000-7000-8000-${String(nextId).padStart(12, "0")}`,
    title,
    ...fields,
  });
}

const titles = (nodes: TaskNode[]) => nodes.map((node) => node.task.title);

test("nests subtasks under their parent, pending in list order and completed by latest update", () => {
  const move = task("Move out", { priority: 1 });
  const freight = task("Hire freight", { parent_id: move.id, priority: 2 });
  const pack = task("Pack", { parent_id: move.id, priority: 2, status: "doing" });
  const inspect = task("Inspect", {
    parent_id: move.id,
    status: "done",
    updated_at: "2026-11-20T10:00:00Z",
  });
  const keys = task("Return keys", {
    parent_id: move.id,
    status: "done",
    updated_at: "2026-11-22T10:00:00Z",
  });
  const passport = task("Renew passport");

  const tree = taskTree([move, freight, pack, inspect, keys, passport]);

  expect(titles(tree.pending)).toEqual(["Move out", "Renew passport"]);
  expect(tree.completed).toEqual([]);
  const root = tree.pending[0]!;
  expect(root.depth).toBe(1);
  expect(titles(root.pending)).toEqual(["Pack", "Hire freight"]);
  expect(titles(root.completed)).toEqual(["Return keys", "Inspect"]);
  expect(root.pending[0]!.depth).toBe(2);
});

function chain(length: number) {
  const tasks: Task[] = [];
  for (let index = 0; index < length; index += 1)
    tasks.push(task(`Level ${index + 1}`, { parent_id: tasks.at(-1)?.id ?? null }));
  return tasks;
}

test("allows a move only within four levels and never under the task itself or its subtasks", () => {
  const [one, two, three, four] = chain(4) as [Task, Task, Task, Task];
  const loose = task("Loose");
  const pair = task("Pair");
  const pairChild = task("Pair child", { parent_id: pair.id });
  const tree = taskTree([one, two, three, four, loose, pair, pairChild]);

  expect(tree.canMove(loose.id, four.id)).toBe(false);
  expect(tree.canMove(loose.id, three.id)).toBe(true);
  expect(tree.canMove(pair.id, three.id)).toBe(false);
  expect(tree.canMove(pair.id, two.id)).toBe(true);
  expect(tree.canMove(two.id, four.id)).toBe(false);
  expect(tree.canMove(two.id, two.id)).toBe(false);
  expect(tree.canMove(four.id, null)).toBe(true);
});

test("walks up to the ancestors and down to every subtask", () => {
  const [one, two, three] = chain(3) as [Task, Task, Task];
  const doneChild = task("Done child", { parent_id: one.id, status: "done" });
  const underDone = task("Under done", { parent_id: doneChild.id, status: "doing" });
  const tree = taskTree([one, two, three, doneChild, underDone]);

  expect(tree.ancestors(three.id).map((ancestor) => ancestor.title)).toEqual([
    "Level 1",
    "Level 2",
  ]);
  expect(tree.ancestors(one.id)).toEqual([]);
  expect(
    tree
      .subtasks(one.id)
      .map((subtask) => subtask.title)
      .toSorted(),
  ).toEqual(["Done child", "Level 2", "Level 3", "Under done"]);
  expect(tree.subtasks(three.id)).toEqual([]);
});
