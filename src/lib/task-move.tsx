import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Task } from "../api/generated";
import {
  getTaskQueryKey,
  listTasksQueryKey,
  updateTaskMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { toast } from "../components/ui/sonner";
import { describeError, fieldError, isUnauthorized } from "./problem";
import type { TaskNode, TaskTree } from "./task-tree";
import { cn } from "./utils";

type Target = string | null;

const TOP_LEVEL = "top-level";

type KeyboardMove = { task: Task; targets: Target[]; index: number };

type Move = {
  tree: TaskTree;
  dragging: Task | undefined;
  keyboardTarget: Target | undefined;
  movingId: string | undefined;
  canDrop: (target: Target) => boolean;
  startKeyboardMove: (task: Task) => void;
  swallowClickAfterDrag: (event: MouseEvent) => void;
};

const MoveContext = createContext<Move | undefined>(undefined);

function pendingInTreeOrder(nodes: TaskNode[]): Task[] {
  return nodes.flatMap((node) => [node.task, ...pendingInTreeOrder(node.pending)]);
}

function describeTarget(tree: TaskTree, task: Task, target: Target) {
  const into = target === null ? undefined : tree.node(target)?.task.title;
  return into === undefined
    ? `Move "${task.title}" to the top level.`
    : `Move "${task.title}" into "${into}".`;
}

const keyboardHelp =
  "Use the arrow keys to choose where, Shift+Tab to go up a level, Enter to drop, and Escape to cancel.";

function useMoveTask() {
  const queryClient = useQueryClient();
  const listKey = listTasksQueryKey();
  const setParent = (id: string, parentId: Target) =>
    queryClient.setQueryData<Task[]>(listKey, (tasks) =>
      tasks?.map((task) => (task.id === id ? { ...task, parent_id: parentId } : task)),
    );

  return useMutation({
    ...updateTaskMutation(),
    meta: { showsOwnError: true },
    onMutate: async ({ path, body }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient
        .getQueryData<Task[]>(listKey)
        ?.find((task) => task.id === path.id)?.parent_id;
      setParent(path.id, body.parent_id ?? null);
      return previous;
    },
    onError: (error, { path }, previous) => {
      if (previous !== undefined) setParent(path.id, previous);
      if (!isUnauthorized(error))
        toast.error("Couldn't move task.", {
          description: fieldError(error, "parent_id") ?? describeError(error),
        });
    },
    onSettled: (_data, _error, { path }) => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: getTaskQueryKey({ path }) });
    },
  });
}

function useKeyboardMove(
  tree: TaskTree,
  drop: (task: Task, target: Target) => void,
  announce: (message: string) => void,
) {
  const [move, setMove] = useState<KeyboardMove>();

  const start = (task: Task) => {
    const targets = [null, ...pendingInTreeOrder(tree.pending).map(({ id }) => id)].filter(
      (target) => tree.canMove(task.id, target),
    );
    const index = Math.max(0, targets.indexOf(task.parent_id));
    setMove({ task, targets, index });
    announce(`${describeTarget(tree, task, targets[index] ?? null)} ${keyboardHelp}`);
  };

  useEffect(() => {
    if (!move) return;
    const select = (index: number) => {
      const wrapped = (index + move.targets.length) % move.targets.length;
      setMove({ ...move, index: wrapped });
      announce(describeTarget(tree, move.task, move.targets[wrapped] ?? null));
    };
    const parent = move.task.parent_id ? tree.node(move.task.parent_id)?.task : undefined;
    const keys: Record<string, (event: globalThis.KeyboardEvent) => void> = {
      ArrowDown: () => select(move.index + 1),
      ArrowUp: () => select(move.index - 1),
      Tab: (event) => {
        if (event.shiftKey && parent) select(move.targets.indexOf(parent.parent_id));
      },
      Enter: () => {
        setMove(undefined);
        drop(move.task, move.targets[move.index] ?? null);
      },
      Escape: () => {
        setMove(undefined);
        announce("Move cancelled.");
      },
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const handle = keys[event.key];
      if (!handle) return;
      event.preventDefault();
      event.stopPropagation();
      handle(event);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [move, tree, drop, announce]);

  return { move, start };
}

export function TaskMoveProvider({ tree, children }: { tree: TaskTree; children: ReactNode }) {
  const moveTask = useMoveTask();
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState<Task>();
  const justDragged = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
  );

  const drop = useMemo(
    () => (task: Task, target: Target) => {
      if (task.parent_id === target || !tree.canMove(task.id, target)) {
        setMessage("Move cancelled.");
        return;
      }
      setMessage(`Moved "${task.title}".`);
      moveTask.mutate({ path: { id: task.id }, body: { parent_id: target } });
    },
    [tree, moveTask],
  );
  const keyboard = useKeyboardMove(tree, drop, setMessage);

  const context: Move = {
    tree,
    dragging,
    keyboardTarget: keyboard.move
      ? (keyboard.move.targets[keyboard.move.index] ?? null)
      : undefined,
    movingId: dragging?.id ?? keyboard.move?.task.id,
    canDrop: (target) => !!dragging && tree.canMove(dragging.id, target),
    startKeyboardMove: keyboard.start,
    swallowClickAfterDrag: (event) => {
      if (!justDragged.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return (
    <MoveContext value={context}>
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setDragging(tree.node(String(active.id))?.task)}
        onDragCancel={() => setDragging(undefined)}
        onDragEnd={({ active, over }) => {
          setDragging(undefined);
          justDragged.current = true;
          setTimeout(() => (justDragged.current = false));
          const task = tree.node(String(active.id))?.task;
          if (task && over) drop(task, over.id === TOP_LEVEL ? null : String(over.id));
        }}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="border border-accent bg-surface px-[1ch] py-0.5 shadow-md">
              {dragging.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <div role="status" aria-label="Move task" className="sr-only">
        {message}
      </div>
    </MoveContext>
  );
}

export function TopLevelDropZone() {
  const move = useContext(MoveContext);
  const active = !!move?.movingId;
  const droppable = useDroppable({ id: TOP_LEVEL, disabled: !move?.canDrop(null) });
  if (!active) return null;
  const targeted = move.keyboardTarget === null || droppable.isOver;
  return (
    <div
      ref={droppable.setNodeRef}
      aria-hidden
      className={cn(
        "absolute inset-x-0 -top-3 z-10 flex h-6 items-center justify-center border text-xs",
        targeted
          ? "border-accent bg-accent/25 text-accent-ink"
          : "border-dashed border-border-strong bg-surface text-muted-foreground",
      )}
    >
      ↑ top level
    </div>
  );
}

function isTyping(target: EventTarget) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function useRowMove(task: Task) {
  const move = useContext(MoveContext);
  const done = task.status === "done";
  const draggable = useDraggable({ id: task.id, disabled: !move });
  const droppable = useDroppable({
    id: task.id,
    disabled: !move || done || !move.canDrop(task.id),
  });
  if (!move) return undefined;

  return {
    setNodeRef: (element: HTMLElement | null) => {
      draggable.setNodeRef(element);
      droppable.setNodeRef(element);
    },
    listeners: draggable.listeners,
    onKeyDown: (event: KeyboardEvent) => {
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
      if (event.key !== "m" || !plain || move.movingId || isTyping(event.target)) return;
      event.preventDefault();
      move.startKeyboardMove(task);
    },
    onClickCapture: move.swallowClickAfterDrag,
    moving: move.movingId === task.id,
    targeted: move.keyboardTarget === task.id || (droppable.isOver && !!move.dragging),
    unavailable: !!move.dragging && (done || !move.canDrop(task.id)),
  };
}
