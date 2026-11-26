# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

The domain glossary, the API contract (`openapi.yaml`) and the cross-repo ADRs live in the `journal-spec` repository, checked out at `spec/` as a git submodule. Decisions that only concern this web app live here in `docs/adr/`.

## Before exploring, read these

- **`spec/GLOSSARY.md`**: the domain vocabulary.
- **`spec/docs/adr/`**: cross-repo ADRs that touch the area you're about to work in.
- **`docs/adr/`**: web-only ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## Where changes go

- **Glossary terms, the contract and cross-repo decisions**: change them in `journal-spec`, not by editing the `spec/` submodule from here.
- **Decisions that only affect this web app** (UI, build, runtime): record them as ADRs in `docs/adr/` in this repo.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `spec/GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (additive evolution and minimum contract version), but worth reopening because…_
