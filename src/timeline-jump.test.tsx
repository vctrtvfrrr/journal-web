import { afterEach, beforeEach, expect, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Note, NoteInput } from "./api/generated";
import { periodStart } from "./lib/partial-date";
import { aNote, aNotebook, api, device, notesPage, problem } from "../test/api";
import { renderAppAt } from "../test/render";

const diary = aNotebook("1", "Diary");
const originalScrollIntoView = Element.prototype.scrollIntoView;
let scrolledTo: Element[] = [];

const newestFirst = (notes: Note[]) =>
  notes.toSorted((a, b) => periodStart(b.date).localeCompare(periodStart(a.date)));

function serveNotes(initial: Note[], pageSize: number) {
  let notes = newestFirst(initial);
  const requests: URLSearchParams[] = [];
  api.use(
    http.get("/api/notes", ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return notesPage(request, notes, pageSize);
    }),
    http.post<never, NoteInput>("/api/notes", async ({ request }) => {
      const input = await request.json();
      const note: Note = { ...aNote("99", input.date, input.content), ...input };
      notes = newestFirst([...notes, note]);
      return HttpResponse.json(note, { status: 201 });
    }),
  );
  return requests;
}

const years = ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"].map((year, index) =>
  aNote(String(index + 1), `${year}-06-01`, `Note of ${year}`),
);

beforeEach(() => {
  scrolledTo = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledTo.push(this);
  };
  api.use(
    http.get("/api/devices/current", () => HttpResponse.json(device)),
    http.get("/api/notebooks", () => HttpResponse.json([diary])),
  );
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

async function timeline() {
  return within(await screen.findByRole("tabpanel", { name: "Diary" }));
}

test("jumps straight to a saved note older than every loaded page", async () => {
  const requests = serveNotes(years, 2);
  const history = renderAppAt("/");

  const panel = await timeline();
  expect(await panel.findByText("Note of 2025")).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "New note" }));
  const dialog = within(await screen.findByRole("dialog", { name: "New note" }));
  await userEvent.type(dialog.getByLabelText("Content"), "Found the old photo");
  const date = dialog.getByLabelText("Date");
  await userEvent.clear(date);
  await userEvent.type(date, "2018-05");
  await userEvent.click(dialog.getByRole("button", { name: "save" }));

  await waitFor(() => {
    const row = scrolledTo.findLast((element) => element.hasAttribute("data-note"));
    expect(row?.textContent).toContain("Found the old photo");
  });
  expect(history.location.search).toBe("?anchor=2018-05");
  expect(panel.getByRole("button", { name: "back to latest" })).toBeDefined();
  expect(panel.queryByText("Note of 2026")).toBeNull();
  expect(requests.filter((search) => search.has("cursor"))).toEqual([]);
  expect(requests.at(-1)?.get("to")).toBe("2018-05");
});

test("loads newer pages upward from the anchor and drops it at the newest note", async () => {
  serveNotes(years, 2);
  const history = renderAppAt("/?anchor=2022-06-01");

  const panel = await timeline();
  expect(await panel.findByText("Note of 2022")).toBeDefined();
  expect(panel.getByText("Note of 2021")).toBeDefined();
  expect(panel.queryByText("Note of 2023")).toBeNull();

  await userEvent.click(panel.getByRole("button", { name: "load newer" }));
  expect(await panel.findByText("Note of 2023")).toBeDefined();
  expect(panel.getByText("Note of 2024")).toBeDefined();
  expect(history.location.search).toBe("?anchor=2022-06-01");

  await userEvent.click(panel.getByRole("button", { name: "load newer" }));
  expect(await panel.findByText("Note of 2026")).toBeDefined();
  await waitFor(() => expect(history.location.search).toBe(""));
  expect(panel.queryByRole("button", { name: "back to latest" })).toBeNull();
  expect(panel.queryByRole("button", { name: "load newer" })).toBeNull();
});

test("goes back to the top of the latest notes", async () => {
  serveNotes(years, 2);
  const history = renderAppAt("/?anchor=2022-06-01");

  const panel = await timeline();
  await userEvent.click(await panel.findByRole("button", { name: "back to latest" }));

  expect(await panel.findByText("Note of 2026")).toBeDefined();
  expect(history.location.search).toBe("");
  expect(panel.queryByText("Note of 2022")).toBeNull();
  expect(scrolledTo.at(-1)?.textContent).toContain("Note of 2026");
});

test("shows a failed newer page without hiding the timeline", async () => {
  serveNotes(years, 2);
  renderAppAt("/?anchor=2022-06-01");

  const panel = await timeline();
  expect(await panel.findByText("Note of 2022")).toBeDefined();
  api.use(
    http.get("/api/notes", ({ request }) =>
      new URL(request.url).searchParams.get("cursor")?.startsWith("p")
        ? problem(503, "Try later.")
        : undefined,
    ),
  );
  await userEvent.click(panel.getByRole("button", { name: "load newer" }));

  expect(await panel.findByText("Try later.")).toBeDefined();
  expect(panel.getByText("Note of 2022")).toBeDefined();
});

test("drops the anchor when switching to another notebook", async () => {
  const plants = aNotebook("2", "Plants");
  api.use(http.get("/api/notebooks", () => HttpResponse.json([diary, plants])));
  serveNotes([...years, aNote("20", "2026-01-01", "Fern", "2")], 2);
  const history = renderAppAt("/?anchor=2022-06-01");

  expect(await (await timeline()).findByText("Note of 2022")).toBeDefined();
  await userEvent.click(screen.getByRole("tab", { name: "Plants" }));

  const panel = within(await screen.findByRole("tabpanel", { name: "Plants" }));
  expect(await panel.findByText("Fern")).toBeDefined();
  expect(history.location.search).toBe("");
});

test("loads newer notes only once the reader scrolls back up to them", async () => {
  const nativeObserver = globalThis.IntersectionObserver;
  const observers: { callback: IntersectionObserverCallback; element?: Element }[] = [];
  globalThis.IntersectionObserver = class {
    entry: { callback: IntersectionObserverCallback; element?: Element };
    constructor(callback: IntersectionObserverCallback) {
      this.entry = { callback };
      observers.push(this.entry);
    }
    observe(element: Element) {
      this.entry.element = element;
      this.report(true);
    }
    report(isIntersecting: boolean) {
      this.entry.callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    disconnect() {
      this.entry.element = undefined;
    }
  } as unknown as typeof IntersectionObserver;
  const topSentinel = () =>
    observers
      .filter(({ element }) => element?.isConnected)
      .sort((a, b) =>
        a.element!.compareDocumentPosition(b.element!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )[0]!;
  const report = (isIntersecting: boolean) =>
    topSentinel().callback([{ isIntersecting } as IntersectionObserverEntry], {} as never);
  const requests = serveNotes(years, 2);

  try {
    renderAppAt("/?anchor=2020-06-01");
    const panel = await timeline();
    expect(await panel.findByText("Note of 2020")).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const newerPages = () => requests.filter((search) => search.get("cursor")?.startsWith("p"));
    expect(newerPages()).toEqual([]);

    report(false);
    report(true);

    expect(await panel.findByText("Note of 2021")).toBeDefined();
    expect(newerPages()).toHaveLength(1);
  } finally {
    globalThis.IntersectionObserver = nativeObserver;
  }
});
