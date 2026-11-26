# Issue tracker: Gitea

Issues for this repo live as Gitea issues in `vctrtvfrrr/journal-web` on `$GITEA_URL` (`https://git.codelab.tec.br`). The PRD and the contract issues live in `vctrtvfrrr/journal-spec`; API issues live in `vctrtvfrrr/journal-api`. Reference an issue in another repo as `vctrtvfrrr/<repo>#<n>`. Call the Gitea REST API with `curl`, authenticated by `$GITEA_TOKEN` from the environment. Do not use the `tea` CLI: it is unreliable.

## Setup

Shell state does not persist between commands, so start every command that talks to Gitea with these definitions:

```bash
API="$GITEA_URL/api/v1/repos/vctrtvfrrr/journal-web"
gitea() { curl -sSf -H "Authorization: token $GITEA_TOKEN" -H "Content-Type: application/json" "$@"; }
```

Build JSON bodies with `jq -n --arg ...` so titles and multi-line bodies are escaped correctly. Never echo `$GITEA_TOKEN`.

## Conventions

- **Create an issue**: `gitea -X POST "$API/issues" -d "$(jq -n --arg t "..." --arg b "..." '{title:$t, body:$b}')" | jq '{number, html_url}'`. The create endpoint only takes label IDs, so apply labels in a second call (see **Apply / remove labels**).
- **Read an issue**: `gitea "$API/issues/<n>" | jq '{number, title, state, body, labels: [.labels[].name], assignees: [.assignees[]?.login]}'`, plus comments with `gitea "$API/issues/<n>/comments" | jq '[.[] | {user: .user.login, body}]'`.
- **List issues**: `gitea "$API/issues?type=issues&state=open&limit=50" | jq '[.[] | {number, title, labels: [.labels[].name], assignees: [.assignees[]?.login]}]'`. Filter with `&labels=a,b`, `&state=closed|all`, `&q=<keyword>`; page with `&page=N`.
- **Make an issue a child of a parent**: Gitea has no native sub-issues. Put `Part of #<parent>` at the top of the child body and add the child to a task list (`- [ ] #<child>`) in the parent body (`PATCH "$API/issues/<parent>"` with `{body}`).
- **Comment on an issue**: `gitea -X POST "$API/issues/<n>/comments" -d "$(jq -n --arg b "..." '{body:$b}')"`
- **Apply labels**: `gitea -X POST "$API/issues/<n>/labels" -d '{"labels":["needs-triage"]}'` (names are accepted here).
- **Remove a label**: removal needs the label ID. `id=$(gitea "$API/labels" | jq '.[] | select(.name=="needs-triage") | .id')`, then `gitea -X DELETE "$API/issues/<n>/labels/$id"`.
- **Close**: comment first, then `gitea -X PATCH "$API/issues/<n>" -d '{"state":"closed"}'`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues:

- **Read a PR**: `gitea "$API/pulls/<n>"` and `gitea "$API/pulls/<n>.diff"` for the diff.
- **List PRs for triage**: `gitea "$API/pulls?state=open" | jq '[.[] | {number, title, author: .user.login, labels: [.labels[].name]}]'`; drop those authored by repo collaborators (`gitea "$API/collaborators"`).
- **Comment / label / close**: the issue endpoints above work with a PR number; close with `gitea -X PATCH "$API/pulls/<n>" -d '{"state":"closed"}'`.

Gitea shares one number space across issues and PRs, so a bare `#42` may be either: `gitea "$API/issues/42" | jq '.pull_request != null'` tells them apart.

## When a skill says "publish to the issue tracker"

Create a Gitea issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. Create the label first if it is missing (`gitea -X POST "$API/labels" -d '{"name":"wayfinder:map","color":"#5319e7"}'`).
- **Child ticket**: an issue linked to the map as in **Make an issue a child of a parent**. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: Gitea's native issue dependencies. Add an edge with `gitea -X POST "$API/issues/<child>/dependencies" -d '{"owner":"vctrtvfrrr","repo":"<repo>","index":<blocker>}'`, where `<repo>` is the blocker's repository (dependencies may cross repositories); list blockers with `gitea "$API/issues/<child>/dependencies" | jq '[.[] | {number, state}]'`. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (from its task list), drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gitea -X POST "$API/issues/<n>/assignees" -d '{"assignees":["vctrtvfrrr"]}'`, the session's first write.
- **Resolve**: comment with the answer, close the issue, then append a context pointer (gist + link) to the map's Decisions-so-far.
