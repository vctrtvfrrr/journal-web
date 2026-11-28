import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
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
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Task } from "../api/generated";
import { updateTaskMutation } from "../api/generated/@tanstack/react-query.gen";
import { describeError, fieldError, isUnauthorized } from "../lib/problem";
import { refreshTasks } from "../lib/task-cache";
import type { TaskNode, TaskTree } from "../lib/task-tree";
import { cn } from "../lib/utils";
import { toast } from "./ui/sonner";

type ParentId = string | null;

const TOP_LEVEL_DROP_ID = "top-level";
const parentOfDropId = (dropId: string): ParentId => (dropId === TOP_LEVEL_DROP_ID ? null : dropId);

type KeyboardMove = { task: Task; row: HTMLElement; targets: ParentId[]; index: number };

type MoveState = {
  tree: TaskTree;
  dragging: Task | undefined;
  keyboardTarget: ParentId | undefined;
  movingId: string | undefined;
  canDrop: (target: ParentId) => boolean;
  startKeyboardMove: (task: Task, row: HTMLElement) => void;
  swallowClickAfterDrag: (event: MouseEvent) => void;
};

const MoveContext = createContext<MoveState | undefined>(undefined);

type IsCollapsed = (id: string) => boolean;

function visiblePendingInTreeOrder(nodes: TaskNode[], isCollapsed: IsCollapsed): Task[] {
  return nodes.flatMap((node) => [
    node.task,
    ...(isCollapsed(node.task.id) ? [] : visiblePendingInTreeOrder(node.pending, isCollapsed)),
  ]);
}

function describeParentId(tree: TaskTree, task: Task, target: ParentId) {
  const into = target === null ? undefined : tree.node(target)?.task.title;
  return into === undefined
    ? `Move "${task.title}" to the top level.`
    : `Move "${task.title}" into "${into}".`;
}

const keyboardHelp =
  "Use the arrow keys to choose where, Shift+Tab to go up a level, Enter to drop, and Escape to cancel.";

function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateTaskMutation(),
    meta: { showsOwnError: true },
    onError: (error) => {
      if (!isUnauthorized(error))
        toast.error("Couldn't move task.", {
          description: fieldError(error, "parent_id") ?? describeError(error),
        });
    },
    onSettled: (_data, _error, { path }) => refreshTasks(queryClient, [path.id]),
  });
}

function useKeyboardMove(
  tree: TaskTree,
  isCollapsed: IsCollapsed,
  drop: (task: Task, target: ParentId) => void,
  announce: (message: string) => void,
) {
  const [keyboardMove, setKeyboardMove] = useState<KeyboardMove>();

  const start = (task: Task, row: HTMLElement) => {
    const visible = visiblePendingInTreeOrder(tree.pending, isCollapsed).map(({ id }) => id);
    const targets = [null, ...visible].filter((target) => tree.canMove(task.id, target));
    const index = Math.max(0, targets.indexOf(task.parent_id));
    setKeyboardMove({ task, row, targets, index });
    announce(`${describeParentId(tree, task, targets[index] ?? null)} ${keyboardHelp}`);
  };

  useEffect(() => {
    if (!keyboardMove) return;
    const select = (index: number) => {
      const wrapped = (index + keyboardMove.targets.length) % keyboardMove.targets.length;
      setKeyboardMove({ ...keyboardMove, index: wrapped });
      announce(describeParentId(tree, keyboardMove.task, keyboardMove.targets[wrapped] ?? null));
    };
    const parent = keyboardMove.task.parent_id
      ? tree.node(keyboardMove.task.parent_id)?.task
      : undefined;
    const keys: Record<string, (event: globalThis.KeyboardEvent) => void> = {
      ArrowDown: () => select(keyboardMove.index + 1),
      ArrowUp: () => select(keyboardMove.index - 1),
      Tab: (event) => {
        const grandparent =
          event.shiftKey && parent ? keyboardMove.targets.indexOf(parent.parent_id) : -1;
        if (grandparent !== -1) select(grandparent);
      },
      Enter: () => {
        setKeyboardMove(undefined);
        drop(keyboardMove.task, keyboardMove.targets[keyboardMove.index] ?? null);
      },
      Escape: () => {
        setKeyboardMove(undefined);
        announce("Move cancelled.");
      },
    };
    const { row } = keyboardMove;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const handle = keys[event.key];
      if (!handle || !row.contains(document.activeElement)) return;
      event.preventDefault();
      event.stopPropagation();
      handle(event);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (row.contains(event.relatedTarget as Node | null)) return;
      setKeyboardMove(undefined);
      announce("Move cancelled.");
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    row.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      row.removeEventListener("focusout", onFocusOut);
    };
  }, [keyboardMove, tree, drop, announce]);

  return { keyboardMove, start };
}

export function TaskMoveProvider({
  tree,
  isCollapsed,
  children,
}: {
  tree: TaskTree;
  isCollapsed: IsCollapsed;
  children: ReactNode;
}) {
  const moveTask = useMoveTask();
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState<Task>();
  const justDragged = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
  );

  const { mutate } = moveTask;
  const drop = useCallback(
    (task: Task, parentId: ParentId) => {
      if (task.parent_id === parentId || !tree.canMove(task.id, parentId)) {
        setMessage("Move cancelled.");
        return;
      }
      setMessage(`Moved "${task.title}".`);
      mutate({ path: { id: task.id }, body: { parent_id: parentId } });
    },
    [tree, mutate],
  );
  const keyboard = useKeyboardMove(tree, isCollapsed, drop, setMessage);

  const moveState: MoveState = {
    tree,
    dragging,
    keyboardTarget: keyboard.keyboardMove
      ? (keyboard.keyboardMove.targets[keyboard.keyboardMove.index] ?? null)
      : undefined,
    movingId: dragging?.id ?? keyboard.keyboardMove?.task.id,
    canDrop: (target) => !!dragging && tree.canMove(dragging.id, target),
    startKeyboardMove: keyboard.start,
    swallowClickAfterDrag: (event) => {
      if (!justDragged.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return (
    <MoveContext value={moveState}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => setDragging(tree.node(String(active.id))?.task)}
        onDragCancel={() => setDragging(undefined)}
        onDragEnd={({ active, over }) => {
          setDragging(undefined);
          justDragged.current = true;
          setTimeout(() => (justDragged.current = false));
          const task = tree.node(String(active.id))?.task;
          if (task && over) drop(task, parentOfDropId(String(over.id)));
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
  const moveState = useContext(MoveContext);
  const active = !!moveState?.movingId;
  const droppable = useDroppable({ id: TOP_LEVEL_DROP_ID, disabled: !moveState?.canDrop(null) });
  if (!active) return null;
  const targeted = moveState.keyboardTarget === null || droppable.isOver;
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
  const moveState = useContext(MoveContext);
  const done = task.status === "done";
  const draggable = useDraggable({ id: task.id, disabled: !moveState });
  const droppable = useDroppable({
    id: task.id,
    disabled: !moveState || done || !moveState.canDrop(task.id),
  });
  if (!moveState) return undefined;

  return {
    setNodeRef: (element: HTMLElement | null) => {
      draggable.setNodeRef(element);
      droppable.setNodeRef(element);
    },
    listeners: draggable.listeners,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
      if (event.key !== "m" || !plain || moveState.movingId || isTyping(event.target)) return;
      event.preventDefault();
      moveState.startKeyboardMove(task, event.currentTarget);
    },
    onClickCapture: moveState.swallowClickAfterDrag,
    moving: moveState.movingId === task.id,
    targeted: moveState.keyboardTarget === task.id || (droppable.isOver && !!moveState.dragging),
    unavailable: !!moveState.dragging && (done || !moveState.canDrop(task.id)),
  };
}
