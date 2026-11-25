import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type {
  Device,
  Note,
  Notebook,
  Problem,
  Task,
  ValidationProblem,
} from "../src/api/generated";

export const api = setupServer(
  http.get("/api/tasks", () => HttpResponse.json([] satisfies Task[])),
  http.get("/api/notebooks", () => HttpResponse.json([] satisfies Notebook[])),
);

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
