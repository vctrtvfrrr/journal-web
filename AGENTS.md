# AGENTS.md

Default to Bun: `bun <file>`, `bun test`, `bun install`, `bun run <script>`, `bunx`. Bun loads `.env` by itself.

## API contract

The contract lives in the `spec/` submodule (`journal-spec`), checked out at a release tag: `spec/openapi.yaml` is the source of truth. Never edit files under `spec/` from this repo; change the contract in `journal-spec`. To move to another contract version, run `git -C spec checkout <tag>` and then `bun run gen`. CI fails unless the submodule commit carries the tag `v<info.version>` (`bun run check:contract-tag`).

Everything under `src/api/generated/` is generated from it with `bun run gen` and is not committed. `bun install` generates it once; after switching the submodule, or when a command fails on a missing or stale generated import, run `bun run gen`. Never edit it, and never hand-write a type, schema, or request that the generated code already provides. Validate forms with the generated Zod request schemas.

The client sends the `Contract-Version` header on every request (`src/api/contract.ts`), so the generator drops that parameter from the generated calls (`openapi-ts.config.ts`).

## Domain docs

Glossary, contract and cross-repo ADRs live in `spec/`. See `docs/agents/domain.md`.

## Conventions

- No path aliases; use relative imports.
- UI text is in English (US).
- The session lives in an `HttpOnly` cookie. Never read, store, or send a token from JavaScript.

## Testing

`bun test` runs everything. UI tests render `<App history={createMemoryHistory(...)} />` and mock the API with MSW (`test/api.ts`), typed with the generated types. Like the API, the mock rejects any `/api` request without `Contract-Version`.
