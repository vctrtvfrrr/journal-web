import type { KeyboardEvent, MouseEvent } from "react";

function clickedLink(event: MouseEvent<HTMLElement>) {
  return (event.target as Element).closest("a") !== null;
}

export function activationHandlers(activate: () => void) {
  return {
    onClick(event: MouseEvent<HTMLElement>) {
      if (clickedLink(event)) return;
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
