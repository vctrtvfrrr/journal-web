# Journal Web

Interface web (PWA instalável) da [Journal API](https://git.codelab.tec.br/vctrtvfrrr/journal-api). Bun + TypeScript + React.

## Rodar localmente

Suba a Journal API em `localhost:3000` (veja o README dela) e então:

```bash
bun install
bun run dev
```

O app abre em `http://localhost:4000`. O servidor de desenvolvimento repassa `/api/*` para `localhost:3000` sem reescrever o caminho, então o browser fala com o app e com a API na mesma origem, como em produção. Use `API_ORIGIN` para apontar para outra API e `PORT` para mudar a porta.

O login envia `token_delivery: "cookie"`, e a API grava o token no cookie `__Secure-journal_token` (`HttpOnly; Secure`). Chrome e Firefox aceitam esse cookie em `http://localhost`. O Safari não aceita, então use outro browser em desenvolvimento.

## Contrato da API

O contrato fica no submódulo `spec/` (repositório `journal-spec`), fixo numa tag de release. O `spec/openapi.yaml` é a fonte da verdade, e o `info.version` dele diz qual versão o app usa. Clone com `git clone --recurse-submodules`, ou rode `git submodule update --init` num clone existente.

Tudo em `src/api/generated/` (client, tipos, schemas Zod e hooks do TanStack Query) é gerado do contrato pelo `@hey-api/openapi-ts` e não vai para o Git. O `bun install` gera esses arquivos uma vez. Se um comando falhar por um import gerado ausente ou desatualizado, rode `bun run gen`.

Para usar outra versão do contrato:

```bash
git -C spec fetch --tags
git -C spec checkout v0.5.0
bun run gen
```

Depois, `bun run typecheck` mostra o que a mudança quebrou. Para desenvolver contra uma mudança ainda não lançada, faça checkout de uma branch ou de um commit do `journal-spec`. O CI reprova esse contrato até sair a tag correspondente.

O app envia o header `Contract-Version` em toda requisição. Se a API recusar a versão do app, ele troca tudo por uma tela que pede para recarregar a página. As respostas da API são validadas em runtime com os schemas gerados. Uma resposta fora do contrato aparece como erro explícito ("The API answered in a format this app does not know"), não como tela quebrada.

## Scripts

| Script               | O que faz                                                                               |
| -------------------- | --------------------------------------------------------------------------------------- |
| `dev`                | Servidor de desenvolvimento com proxy de `/api`. Recarregue a página para ver mudanças. |
| `build`              | Gera os arquivos estáticos de produção em `dist/public`.                                |
| `start`              | Serve `dist/public` em modo produção, com CSP e headers de cache.                       |
| `typecheck`          | Checa os tipos com o TypeScript 7.                                                      |
| `lint`, `fmt`        | `oxlint` e `oxfmt`. `fmt:check` só verifica.                                            |
| `gen`                | Regenera `src/api/generated` a partir de `spec/openapi.yaml`.                           |
| `check:contract-tag` | Falha se o commit do `spec/` não tiver a tag `v<info.version>`.                         |

O `bun test` roda os testes. Os testes de UI usam happy-dom, Testing Library e MSW.

O TypeScript aparece duas vezes nas dependências: o `typescript` (6) existe só porque o gerador usa a API JavaScript do compilador, que o TypeScript 7 não tem. O typecheck usa o `typescript-native` (7).

## Produção

O `Dockerfile` gera a imagem com os arquivos estáticos e o `server.ts`, que escuta na porta 4000. Atrás do Traefik, roteie `/api` para o container da API e o resto para este container. O servidor manda os headers `Content-Security-Policy`, `X-Content-Type-Options` e `Referrer-Policy`. Arquivos com hash no nome ficam em cache por um ano, e o resto é revalidado a cada acesso.

## CI

O workflow do Gitea Actions faz checkout com o submódulo, confere a tag do `spec/` e roda typecheck, lint, formatação, testes e build. Ele precisa do secret `SPEC_TOKEN`, um token pessoal read-only com acesso ao repositório `journal-spec`. O token automático do Actions não serve, porque só enxerga o próprio repositório.
