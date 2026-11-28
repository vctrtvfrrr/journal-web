import type { Task } from "../api/generated";

export type TaskNode = {
  task: Task;
  depth: number;
  pending: TaskNode[];
  completed: TaskNode[];
};

type Level = Pick<TaskNode, "pending" | "completed">;

export type TaskTree = Level & {
  node: (id: string) => TaskNode | undefined;
  canMove: (id: string, parentId: string | null) => boolean;
  ancestors: (id: string) => Task[];
  subtasks: (id: string) => Task[];
};

export const MAX_DEPTH = 4;

const childrenOfNode = (node: TaskNode) => [...node.pending, ...node.completed];

function height(node: TaskNode): number {
  return 1 + Math.max(0, ...childrenOfNode(node).map(height));
}

function descendants(node: TaskNode): Task[] {
  return childrenOfNode(node).flatMap((child) => [child.task, ...descendants(child)]);
}

function contains(node: TaskNode, id: string): boolean {
  return node.task.id === id || childrenOfNode(node).some((child) => contains(child, id));
}

const isDone = (task: Task) => task.status === "done";
const isDoing = (task: Task) => task.status === "doing";

function byListOrder(a: TaskNode, b: TaskNode) {
  return a.task.priority - b.task.priority || Number(isDoing(b.task)) - Number(isDoing(a.task));
}

function byLatestUpdate(a: TaskNode, b: TaskNode) {
  return Date.parse(b.task.updated_at) - Date.parse(a.task.updated_at);
}

function level(children: TaskNode[]): Level {
  return {
    pending: children.filter((child) => !isDone(child.task)).toSorted(byListOrder),
    completed: children.filter((child) => isDone(child.task)).toSorted(byLatestUpdate),
  };
}

export function taskTree(tasks: Task[]): TaskTree {
  const ids = new Set(tasks.map((task) => task.id));
  const childrenOf = Map.groupBy(tasks, (task) =>
    task.parent_id && ids.has(task.parent_id) ? task.parent_id : null,
  );
  const nodes = new Map<string, TaskNode>();

  const build = (task: Task, depth: number): TaskNode => {
    const node: TaskNode = { task, depth, pending: [], completed: [] };
    nodes.set(task.id, node);
    const children = (childrenOf.get(task.id) ?? []).map((child) => build(child, depth + 1));
    return Object.assign(node, level(children));
  };

  const roots = (childrenOf.get(null) ?? []).map((task) => build(task, 1));
  const canMove = (id: string, parentId: string | null) => {
    const moved = nodes.get(id);
    if (!moved) return false;
    if (parentId === null) return true;
    const parent = nodes.get(parentId);
    if (!parent || contains(moved, parentId)) return false;
    return parent.depth + height(moved) <= MAX_DEPTH;
  };

  const ancestors = (id: string): Task[] => {
    const parentId = nodes.get(id)?.task.parent_id;
    const parent = parentId ? nodes.get(parentId) : undefined;
    return parent ? [...ancestors(parent.task.id), parent.task] : [];
  };

  const subtasks = (id: string) => {
    const node = nodes.get(id);
    return node ? descendants(node) : [];
  };

  return { ...level(roots), node: (id) => nodes.get(id), canMove, ancestors, subtasks };
}
