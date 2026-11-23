import { resolve, sep } from "node:path";

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map(
    ([, script]) =>
      `'sha256-${new Bun.CryptoHasher("sha256").update(script ?? "").digest("base64")}'`,
  );
}

function securityHeaders(shellHtml: string) {
  const scriptSources = ["'self'", ...inlineScriptHashes(shellHtml)].join(" ");
  return {
    "content-security-policy": `default-src 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

const HASHED_FILE = /-[a-z0-9]{8}\.\w+$/;

function cacheControl(path: string): string {
  return HASHED_FILE.test(path) ? "public, max-age=31536000, immutable" : "no-cache";
}

function fileInside(root: string, pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const path = resolve(root, `.${decoded}`);
  return path.startsWith(root + sep) ? path : undefined;
}

export async function createProductionHandler(directory: string) {
  const root = resolve(directory);
  const shell = resolve(root, "index.html");
  const headers = securityHeaders(await Bun.file(shell).text());

  return async (request: Request): Promise<Response> => {
    const requested = fileInside(root, new URL(request.url).pathname);
    const file = requested && (await Bun.file(requested).exists()) ? requested : shell;

    return new Response(Bun.file(file), {
      headers: { ...headers, "cache-control": cacheControl(file) },
    });
  };
}

export function createApiProxy(apiOrigin: string) {
  return (request: Request): Promise<Response> => {
    const { pathname, search } = new URL(request.url);
    return fetch(`${apiOrigin}${pathname}${search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
      decompress: false,
    });
  };
}

async function serveDevelopment(port: number) {
  const { default: shell } = await import("./src/index.html");
  const proxy = createApiProxy(Bun.env.API_ORIGIN ?? "http://localhost:3000");
  return Bun.serve({
    port,
    development: { hmr: true, console: true },
    routes: {
      "/api/*": proxy,
      "/icons/:file": (request) => new Response(Bun.file(`public/icons/${request.params.file}`)),
      "/*": shell,
    },
  });
}

async function serveProduction(port: number) {
  return Bun.serve({
    port,
    fetch: await createProductionHandler(Bun.env.STATIC_DIR ?? "dist/public"),
  });
}

if (import.meta.main) {
  const port = Number(Bun.env.PORT ?? 4000);
  const server =
    Bun.env.NODE_ENV === "production" ? await serveProduction(port) : await serveDevelopment(port);
  console.log(`Journal web listening on ${server.url}`);
}
