import type { KeyboardEvent, MouseEvent } from "react";

// Lets a whole row act as a button while the links rendered inside it keep working.
export function activationHandlers(activate: () => void) {
  return {
    onClick(event: MouseEvent<HTMLElement>) {
      if ((event.target as Element).closest("a")) return;
      activate();
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    },
  };
}
