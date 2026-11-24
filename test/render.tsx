import { render } from "@testing-library/react";
import { createMemoryHistory } from "@tanstack/react-router";
import { App } from "../src/app";

export function renderAppAt(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  render(<App history={history} />);
  return history;
}
