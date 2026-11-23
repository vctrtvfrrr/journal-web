import { describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/react-router";
import { http, HttpResponse } from "msw";
import { App } from "./app";
import { api, device, problem, validationProblem } from "../test/api";

function renderAppAt(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  render(<App history={history} />);
  return history;
}

describe("boot", () => {
  test("asks for the master password when the browser has no session", async () => {
    api.use(http.get("/api/devices/current", () => problem(401, "Missing token.")));

    renderAppAt("/");

    expect(await screen.findByLabelText("master password")).toBeDefined();
  });

  test("opens the home page when the browser has a session", async () => {
    api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));

    const history = renderAppAt("/login");

    await waitFor(() => expect(history.location.pathname).toBe("/"));
    expect(screen.queryByLabelText("master password")).toBeNull();
  });
});

describe("login", () => {
  test("logs the browser in with a cookie and opens the home page", async () => {
    let loggedIn = false;
    const logins: unknown[] = [];
    api.use(
      http.get("/api/devices/current", () =>
        loggedIn ? HttpResponse.json(device) : problem(401, "Missing token."),
      ),
      http.post("/api/devices", async ({ request }) => {
        logins.push(await request.json());
        loggedIn = true;
        return HttpResponse.json(device, { status: 201 });
      }),
    );
    const history = renderAppAt("/");

    await userEvent.type(await screen.findByLabelText("master password"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: "log in" }));

    await waitFor(() => expect(history.location.pathname).toBe("/"));
    expect(logins).toEqual([
      { password: "correct horse", name: "Firefox on Linux", token_delivery: "cookie" },
    ]);
  });

  async function submitPassword(password: string) {
    renderAppAt("/login");
    await userEvent.type(await screen.findByLabelText("master password"), password);
    await userEvent.click(screen.getByRole("button", { name: "log in" }));
  }

  test("shows a wrong password under the password field", async () => {
    api.use(
      http.get("/api/devices/current", () => problem(401, "Missing token.")),
      http.post("/api/devices", () => problem(401, "The password is incorrect.")),
    );

    await submitPassword("wrong");

    expect(await screen.findByText("✗ The password is incorrect.")).toBeDefined();
    expect(screen.getByLabelText("master password").getAttribute("aria-invalid")).toBe("true");
  });

  test("shows field errors from the API next to their fields, and the others below the form", async () => {
    api.use(
      http.get("/api/devices/current", () => problem(401, "Missing token.")),
      http.post("/api/devices", () =>
        validationProblem([
          { pointer: "#/password", detail: "Must not be blank." },
          { pointer: "#/name", detail: "Must have at most 50 characters." },
        ]),
      ),
    );

    await submitPassword(" ");

    expect(await screen.findByText("✗ Must not be blank.")).toBeDefined();
    expect(screen.getByText("✗ name: Must have at most 50 characters.")).toBeDefined();
  });

  test("tells how long to wait after too many wrong passwords", async () => {
    api.use(
      http.get("/api/devices/current", () => problem(401, "Missing token.")),
      http.post("/api/devices", () =>
        problem(429, "Too many failed logins. Try again later.", { "retry-after": "540" }),
      ),
    );

    await submitPassword("wrong");

    expect(
      await screen.findByText("✗ Too many failed logins. Try again in 9 minutes."),
    ).toBeDefined();
  });
});

describe("contract", () => {
  test("reports a response that breaks the API contract instead of failing silently", async () => {
    const { last_used_at: _, ...deviceWithoutLastUse } = device;
    api.use(http.get("/api/devices/current", () => HttpResponse.json(deviceWithoutLastUse)));

    renderAppAt("/");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "The API answered in a format this app does not know. Update the app.",
    );
  });

  test("reports a login response that breaks the API contract", async () => {
    api.use(
      http.get("/api/devices/current", () => problem(401, "Missing token.")),
      http.post("/api/devices", () => HttpResponse.json({ id: device.id }, { status: 201 })),
    );
    renderAppAt("/login");

    await userEvent.type(await screen.findByLabelText("master password"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: "log in" }));

    expect(
      await screen.findByText(
        "✗ The API answered in a format this app does not know. Update the app.",
      ),
    ).toBeDefined();
  });
});
