import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./contract/openapi.json",
  output: { path: "src/api/generated" },
  plugins: [
    { name: "@hey-api/client-fetch", baseUrl: "/api" },
    "zod",
    { name: "@hey-api/sdk", validator: { response: "zod" } },
    "@tanstack/react-query",
  ],
});
