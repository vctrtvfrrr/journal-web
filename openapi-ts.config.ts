import { defineConfig } from "@hey-api/openapi-ts";

const CONTRACT_VERSION_PARAMETER = "#/components/parameters/ContractVersion";

type WithParameters = { parameters?: { $ref?: string }[] };

export default defineConfig({
  input: "./spec/openapi.yaml",
  output: { path: "src/api/generated" },
  parser: {
    patch: {
      // The client sends Contract-Version on every request (src/api/contract.ts),
      // so the generated calls must not ask each caller for it.
      input: (spec) => {
        for (const pathItem of Object.values(spec.paths ?? {})) {
          for (const item of [pathItem, ...Object.values(pathItem ?? {})] as WithParameters[]) {
            if (Array.isArray(item?.parameters))
              item.parameters = item.parameters.filter(
                ({ $ref }) => $ref !== CONTRACT_VERSION_PARAMETER,
              );
          }
        }
      },
    },
  },
  plugins: [
    { name: "@hey-api/client-fetch", baseUrl: "/api" },
    "zod",
    { name: "@hey-api/sdk", validator: { response: "zod" } },
    "@tanstack/react-query",
  ],
});
