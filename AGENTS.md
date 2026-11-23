# AGENTS.md

Default to Bun: `bun <file>`, `bun test`, `bun install`, `bun run <script>`, `bunx`. Bun loads `.env` by itself.

## API contract

The app depends only on the contract the API publishes. `contract/openapi.json` is a byte-for-byte copy of the API's `docs/openapi.json` at a release tag; never edit it, and change it only with `bun run contract:pull <tag>`. Everything under `src/api/generated/` is generated from it with `bun run gen`; never edit it either, and never hand-write a type, schema, or request that the generated code already provides. Validate forms with the generated Zod request schemas.

## ScanLine

The app uses the ScanLine components exactly as they are. `src/components/ui/`, `src/index.css`, and the ScanLine files in `src/lib/` are copied from the ScanLine repository; the only allowed change is rewriting `@/` imports as relative paths. Do not restyle them. Build screens from ScanLine components and its tokens, and show field errors with `src/components/field.tsx`.

## Conventions

- No path aliases; use relative imports.
- UI text is in English (US).
- The session lives in an `HttpOnly` cookie. Never read, store, or send a token from JavaScript.

## Testing

`bun test` runs everything. UI tests render `<App history={createMemoryHistory(...)} />` and mock the API with MSW (`test/api.ts`), typed with the generated types.
