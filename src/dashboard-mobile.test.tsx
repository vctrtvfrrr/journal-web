import { beforeEach, expect, test } from "bun:test";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { aNotebook, api, device } from "../test/api";
import { renderAppAt } from "../test/render";
import { setViewportWidth } from "../test/viewport";

beforeEach(() => {
  setViewportWidth(390);
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/notebooks", () => HttpResponse.json([aNotebook("201", "Diary")])),
  );
});

function viewTab(name: string) {
  return within(screen.getByRole("tablist", { name: "View" })).getByRole("tab", { name });
}

test("has Widgets, Tasks and Notes tabs and opens on Tasks", async () => {
  renderAppAt("/");

  const view = within(await screen.findByRole("tablist", { name: "View" }));
  expect(view.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Widgets",
    "Tasks",
    "Notes",
  ]);
  expect(viewTab("Tasks").getAttribute("aria-selected")).toBe("true");
});

test("the day summary on Tasks opens the Widgets tab with every widget in order", async () => {
  renderAppAt("/");

  await userEvent.click(await screen.findByRole("button", { name: /^Today at a glance/ }));

  expect(viewTab("Widgets").getAttribute("aria-selected")).toBe("true");
  const headers = screen.getAllByRole("button", { expanded: true });
  expect(headers.map((header) => header.textContent)).toEqual([
    expect.stringMatching(/Weather/),
    expect.stringMatching(/Agenda/),
    expect.stringMatching(/Finance/),
    expect.stringMatching(/Rhythms/),
  ]);
  expect(screen.getAllByLabelText("Demo content")).toHaveLength(4);
});

test("does not number the widgets on mobile", async () => {
  renderAppAt("/");
  await userEvent.click(await screen.findByRole("tab", { name: "Widgets" }));

  expect(screen.getByRole("button", { name: /^Weather/ })).toBeDefined();
  expect(screen.queryByText(/\[\d\]/)).toBeNull();
});

test("collapsing a widget on mobile leaves the desktop layout alone", async () => {
  renderAppAt("/");
  await userEvent.click(await screen.findByRole("tab", { name: "Widgets" }));
  const weather = screen.getByRole("button", { name: /^Weather/ });

  await userEvent.click(weather);
  expect(weather.getAttribute("aria-expanded")).toBe("false");

  cleanup();
  setViewportWidth(1280);
  renderAppAt("/");
  expect(
    (await screen.findByRole("button", { name: /^Weather/ })).getAttribute("aria-expanded"),
  ).toBe("true");
});

test("a module opens full screen with Widgets selected, and back returns to Widgets", async () => {
  const history = renderAppAt("/");
  await userEvent.click(await screen.findByRole("tab", { name: "Widgets" }));

  await userEvent.click(screen.getByRole("link", { name: "Open Rhythms" }));
  expect(await screen.findByRole("region", { name: "Rhythms" })).toBeDefined();
  expect(viewTab("Widgets").getAttribute("aria-selected")).toBe("true");

  await userEvent.click(screen.getByRole("link", { name: "Back" }));
  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(viewTab("Widgets").getAttribute("aria-selected")).toBe("true");
});

test("choosing Tasks while a module is open goes home", async () => {
  const history = renderAppAt("/finance");
  await screen.findByRole("region", { name: "Finance" });

  await userEvent.click(viewTab("Tasks"));

  await waitFor(() => expect(history.location.pathname).toBe("/"));
  expect(viewTab("Tasks").getAttribute("aria-selected")).toBe("true");
});
