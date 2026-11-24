import { GlobalRegistrator } from "@happy-dom/global-registrator";

const bunNetworking = { fetch, Request, Response, Headers, AbortController, AbortSignal };
GlobalRegistrator.register({
  url: "http://localhost:4000/",
  settings: {
    navigator: {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
    },
  },
});
// The server tests share this process and need Bun's networking, not happy-dom's.
Object.assign(globalThis, bunNetworking);

const { afterAll, afterEach } = await import("bun:test");
const { cleanup } = await import("@testing-library/react");
const { api } = await import("./api");
const { client } = await import("../src/api/generated/client.gen");
const { toast } = await import("sonner");
const { setViewportWidth } = await import("./viewport");

// Bun's Request needs an absolute URL, unlike the browser's.
client.setConfig({ baseUrl: `${location.origin}/api` });

api.listen({
  onUnhandledRequest: (request, print) => {
    if (new URL(request.url).origin === location.origin) print.error();
  },
});
afterEach(() => {
  localStorage.clear();
  setViewportWidth(1024);
  toast.dismiss();
  cleanup();
  api.resetHandlers();
});
afterAll(() => api.close());
