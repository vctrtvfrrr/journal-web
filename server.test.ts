import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiProxy, createProductionHandler } from "./server";

let root: string;
let handle: (request: Request) => Promise<Response>;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "journal-web-"));
  await mkdir(join(root, "assets"));
  await Bun.write(
    join(root, "index.html"),
    '<!doctype html><title>Journal</title><script>document.documentElement.dataset.x = "1";</script>',
  );
  await Bun.write(join(root, "chunk-a1b2c3d4.js"), "console.log(1)");
  await Bun.write(join(root, "manifest.webmanifest"), "{}");
  handle = await createProductionHandler(root);
});

afterAll(() => rm(root, { recursive: true }));

const get = (path: string) => handle(new Request(`http://journal.test${path}`));

describe("production server", () => {
  test("serves the app shell for any client route", async () => {
    const response = await get("/notebooks/123");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<title>Journal</title>");
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  test("lets browsers keep hashed assets forever", async () => {
    const response = await get("/chunk-a1b2c3d4.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  test("revalidates the manifest", async () => {
    const response = await get("/manifest.webmanifest");
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  test("never serves files outside the build directory", async () => {
    const response = await get("/..%2f..%2fetc%2fpasswd");
    expect(await response.text()).toContain("<title>Journal</title>");
  });

  test("sends the security headers", async () => {
    const response = await get("/");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'self'; script-src 'self' 'sha256-PyqdDJbZiMOnaPVUZdckDIEYE9FjYnLw6ic7lzTeXOs='; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});

describe("development proxy", () => {
  test("forwards /api requests to the API without the /api prefix, like the production router", async () => {
    const seen: {
      url: string;
      method: string;
      body: string;
      cookie: string | null;
      fetchSite: string | null;
    }[] = [];
    using api = Bun.serve({
      port: 0,
      async fetch(request) {
        seen.push({
          url: request.url.replace(/^http:\/\/[^/]+/, ""),
          method: request.method,
          body: await request.text(),
          cookie: request.headers.get("cookie"),
          fetchSite: request.headers.get("sec-fetch-site"),
        });
        return new Response('{"id":"1"}', {
          status: 201,
          headers: {
            "content-type": "application/json",
            "set-cookie": "__Host-journal_token=t; Path=/",
          },
        });
      },
    });
    const proxy = createApiProxy(api.url.origin);

    const response = await proxy(
      new Request("http://localhost:4000/api/devices?x=1", {
        method: "POST",
        body: '{"password":"p"}',
        headers: { cookie: "a=b", "sec-fetch-site": "same-origin" },
      }),
    );

    expect(seen).toEqual([
      {
        url: "/devices?x=1",
        method: "POST",
        body: '{"password":"p"}',
        cookie: "a=b",
        fetchSite: "same-origin",
      },
    ]);
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toBe("__Host-journal_token=t; Path=/");
    expect(await response.text()).toBe('{"id":"1"}');
  });
});
