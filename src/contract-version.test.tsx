import { describe, expect, spyOn, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import contract from "../spec/openapi.yaml";
import { api, contractVersionProblem, device, problem } from "../test/api";
import { renderAppAt } from "../test/render";

describe("contract version", () => {
  test("every request carries the version of the contract in spec/", async () => {
    const versions: (string | null)[] = [];
    api.events.on("request:start", ({ request }) => {
      versions.push(request.headers.get("contract-version"));
    });
    api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));

    try {
      renderAppAt("/");

      await waitFor(() => expect(versions.length).toBeGreaterThan(1));
      expect(new Set(versions)).toEqual(new Set([contract.info.version]));
    } finally {
      api.events.removeAllListeners();
    }
  });

  test("an unsupported contract blocks the app until the page reloads", async () => {
    const reload = spyOn(location, "reload").mockImplementation(() => {});
    api.use(http.get("/api/devices/current", () => contractVersionProblem("1.0.0")));

    try {
      renderAppAt("/");

      expect(await screen.findByText("This version of the app is out of date.")).toBeDefined();
      expect(
        screen.getByText(`App contract ${contract.info.version} · API requires ≥ 1.0.0`),
      ).toBeDefined();
      await userEvent.click(screen.getByRole("button", { name: "reload" }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      reload.mockRestore();
    }
  });

  test("an unsupported contract on login blocks the app", async () => {
    api.use(
      http.get("/api/devices/current", () => problem(401, "Missing token.")),
      http.post("/api/devices", () => contractVersionProblem("1.0.0")),
    );
    renderAppAt("/login");

    await userEvent.type(await screen.findByLabelText("master password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "log in" }));

    expect(await screen.findByText("This version of the app is out of date.")).toBeDefined();
  });
});
