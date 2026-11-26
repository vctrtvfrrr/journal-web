import { describe, expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import contract from "../spec/openapi.yaml";
import { api, device } from "../test/api";
import { renderAppAt } from "../test/render";

describe("contract version", () => {
  test("every request carries the version of the contract in spec/", async () => {
    const versions: (string | null)[] = [];
    api.events.on("request:start", ({ request }) => {
      versions.push(request.headers.get("contract-version"));
    });
    api.use(http.get("/api/devices/current", () => HttpResponse.json(device)));

    renderAppAt("/");

    await waitFor(() => expect(versions.length).toBeGreaterThan(1));
    expect(new Set(versions)).toEqual(new Set([contract.info.version]));
    api.events.removeAllListeners();
  });
});
