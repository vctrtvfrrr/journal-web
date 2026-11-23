# Journal Web

Interface web (PWA instalável) da [Journal API](https://git.codelab.tec.br/vctrtvfrrr/journal-api). Bun + TypeScript + React, com os componentes do [ScanLine](https://vctrtvfrrr.github.io/scanline).

## Rodar localmente

Suba a Journal API em `localhost:3000` (veja o README dela) e então:

```bash
bun install
bun run dev
```

O app abre em `http://localhost:4000`. O servidor de desenvolvimento repassa `/api/*` para `localhost:3000` sem reescrever o caminho, então o browser fala com o app e com a API na mesma origem, como em produção. Use `API_ORIGIN` para apontar para outra API e `PORT` para mudar a porta.

O login envia `token_delivery: "cookie"`, e a API grava o token no cookie `__Secure-journal_token` (`HttpOnly; Secure`). Chrome e Firefox aceitam esse cookie em `http://localhost`. O Safari não aceita, então use outro browser em desenvolvimento.

## Contrato da API

O app depende só do contrato publicado pela API. O arquivo `contract/openapi.json` é a cópia exata do `docs/openapi.json` de uma tag da API, e o `info.version` dele diz qual versão o app usa. Tudo em `src/api/generated/` (client, tipos, schemas Zod e hooks do TanStack Query) é gerado desse arquivo pelo `@hey-api/openapi-ts`. Não edite esses arquivos.

Para usar outra versão da API:

```bash
bun run contract:pull v0.6.0
```

O script baixa o contrato da tag no Gitea com o token de `API_CONTRACT_TOKEN` (um token read-only, no `.env`; veja `.env.example`), confere se o `info.version` bate com a tag e regenera o client. Depois, `bun run typecheck` mostra o que a mudança quebrou.

Para desenvolver contra uma mudança ainda não lançada, passe uma branch ou um commit no lugar da tag. O CI reprova esse contrato até a API publicar a tag correspondente.

As respostas da API são validadas em runtime com os schemas gerados. Uma resposta fora do contrato aparece como erro explícito ("The API answered in a format this app does not know"), não como tela quebrada.

## Scripts

| Script                | O que faz                                                              |
| --------------------- | ---------------------------------------------------------------------- |
| `dev`                 | Servidor de desenvolvimento com HMR e proxy de `/api`.                 |
| `build`               | Gera os arquivos estáticos de produção em `dist/public`.               |
| `start`               | Serve `dist/public` em modo produção, com CSP e headers de cache.      |
| `typecheck`           | Checa os tipos com o TypeScript 7.                                     |
| `lint`, `fmt`         | `oxlint` e `oxfmt`. `fmt:check` só verifica.                           |
| `gen`                 | Regenera `src/api/generated` a partir de `contract/openapi.json`.      |
| `contract:pull <ref>` | Baixa o contrato de uma tag, branch ou commit da API e regenera.       |
| `contract:check`      | Falha se `contract/openapi.json` diferir do contrato publicado na tag. |

O `bun test` roda os testes. Os testes de UI usam happy-dom, Testing Library e MSW.

O TypeScript aparece duas vezes nas dependências: o `typescript` (6) existe só porque o gerador usa a API JavaScript do compilador, que o TypeScript 7 não tem. O typecheck usa o `typescript-native` (7).

## ScanLine

Os arquivos de `src/components/ui/`, `src/lib/{menu-styles,theme,use-media-query,utils}.ts(x)` e `src/index.css` são copiados do ScanLine, no estilo shadcn. A única mudança é trocar os imports `@/...` por caminhos relativos. Para adicionar ou atualizar um componente, copie o arquivo do repositório do ScanLine e ajuste os imports.

## Produção

O `Dockerfile` gera a imagem com os arquivos estáticos e o `server.ts`, que escuta na porta 4000. Atrás do Traefik, roteie `/api` para o container da API e o resto para este container. O servidor manda os headers `Content-Security-Policy`, `X-Content-Type-Options` e `Referrer-Policy`. Arquivos com hash no nome ficam em cache por um ano, e o resto é revalidado a cada acesso.

## CI

O workflow do Gitea Actions roda typecheck, lint, formatação e testes, confere o contrato contra a tag publicada, confere se o client gerado está em dia e faz o build. Ele precisa do secret `API_CONTRACT_TOKEN`, um token pessoal read-only com acesso ao repositório `journal-api`. O token automático do Actions não serve, porque só enxerga o próprio repositório.
