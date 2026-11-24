import type { Window as HappyWindow } from "happy-dom";

export function setViewportWidth(width: number) {
  (window as unknown as HappyWindow).happyDOM.setViewport({ width, height: 800 });
}
