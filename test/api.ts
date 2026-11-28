import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type {
  ContractVersionProblem,
  Device,
  Note,
  Notebook,
  Problem,
  Task,
  ValidationProblem,
} from "../src/api/generated";
import { periodEnd, periodStart } from "../src/lib/partial-date";

// Like the API, reject any request without Contract-Version before every other handler.
const requireContractVersion = http.all("/api/*", ({ request }) =>
  request.headers.has("contract-version") ? undefined : contractVersionProblem("0.0.0"),
);

export const api = setupServer(
  requireContractVersion,
  http.get("/api/tasks", () => HttpResponse.json([] satisfies Task[])),
  http.get("/api/notes", () => HttpResponse.json([] satisfies Note[])),
  http.get("/api/notebooks", () => HttpResponse.json([] satisfies Notebook[])),
);
const useHandlers = api.use.bind(api);
api.use = (...handlers) => useHandlers(requireContractVersion, ...handlers);

export const device: Device = {
  id: "0193b3a0-0000-7000-8000-000000000001",
  name: "Firefox on Linux",
  user_agent: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
  created_at: "2026-11-23T10:00:00Z",
  last_used_at: "2026-11-23T10:00:00Z",
};

export function problem(status: number, detail: string, headers?: HeadersInit) {
  const body: Problem = { type: "about:blank", title: "Error", status, detail };
  return HttpResponse.json(body, {
    status,
    headers: { "content-type": "application/problem+json", ...headers },
  });
}

export function contractVersionProblem(minimumVersion: string) {
  const body: ContractVersionProblem = {
    type: "tag:journal,2026:contract-version-unsupported",
    title: "Bad Request",
    status: 400,
    detail: `Contract-Version is below the minimum supported version ${minimumVersion}.`,
    minimum_version: minimumVersion,
  };
  return HttpResponse.json(body, {
    status: 400,
    headers: { "content-type": "application/problem+json" },
  });
}

export function validationProblem(errors: ValidationProblem["errors"]) {
  const body: ValidationProblem = {
    type: "about:blank",
    title: "Bad Request",
    status: 400,
    detail: "The request has invalid fields.",
    errors,
  };
  return HttpResponse.json(body, {
    status: 400,
    headers: { "content-type": "application/problem+json" },
  });
}

export function aTask(overrides: Partial<Task>): Task {
  return {
    id: "0193b3a0-0000-7000-8000-000000000101",
    parent_id: null,
    title: "Read the journal",
    description: null,
    status: "todo",
    priority: 3,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
    ...overrides,
  };
}

export function aNotebook(id: string, name: string): Notebook {
  return {
    id: `0193b3a0-0000-7000-8000-${id.padStart(12, "0")}`,
    name,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
  };
}

export function aNote(id: string, date: string, content = `Note ${id}`, notebookId = "1"): Note {
  return {
    id: `0193b3a0-0000-7000-8000-${id.padStart(12, "0")}`,
    notebook_id: aNotebook(notebookId, "").id,
    content,
    date,
    created_at: "2026-11-23T10:00:00Z",
    updated_at: "2026-11-23T10:00:00Z",
  };
}

const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function matchesFilters(note: Note, search: URLSearchParams) {
  const q = search.get("q")?.trim();
  const from = search.get("from");
  if (q && !searchable(note.content).includes(searchable(q))) return false;
  if (from && periodEnd(note.date) < periodStart(from)) return false;
  return true;
}

// Like the API, `to` only sets where the first page starts; cursors page both ways from there.
function pageBounds(search: URLSearchParams, matching: Note[], pageSize: number) {
  const cursor = search.get("cursor");
  if (cursor?.startsWith("p")) {
    const end = Number(cursor.slice(1));
    return { start: Math.max(0, end - pageSize), end };
  }
  const to = search.get("to");
  const firstInRange = to
    ? matching.findIndex((note) => periodStart(note.date) <= periodEnd(to))
    : 0;
  const start = cursor ? Number(cursor) : firstInRange === -1 ? matching.length : firstInRange;
  return { start, end: start + pageSize };
}

export function notesPage(request: Request, notes: Note[], pageSize = 50) {
  const url = new URL(request.url);
  const matching = notes.filter(
    (note) =>
      note.notebook_id === url.searchParams.get("notebook") &&
      matchesFilters(note, url.searchParams),
  );
  const { start, end } = pageBounds(url.searchParams, matching, pageSize);
  const links = [
    end < matching.length && `</api/notes?cursor=${end}>; rel="next"`,
    start > 0 && `</api/notes?cursor=p${start}>; rel="prev"`,
  ].filter(Boolean);
  const headers: HeadersInit = links.length > 0 ? { Link: links.join(", ") } : {};
  return HttpResponse.json(matching.slice(start, end), { headers });
}
