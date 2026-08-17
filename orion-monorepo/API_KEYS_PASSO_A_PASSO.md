# API Keys - Passo a Passo Mastigado

Este arquivo separa o que o codigo ja esta preparado para receber do que voce precisa criar manualmente nas plataformas. Nao coloque prints de secrets em chat publico.

## Estado atual das chaves

As chaves de desenvolvimento que voce enviou ja foram colocadas no arquivo local `apps/api/.env`.
Elas nao devem ser commitadas. Antes de subir para producao, rotacione todas as secrets que foram coladas em chat e troque por credenciais novas.

## Onde colocar as chaves

Arquivo local:

```text
apps/api/.env
```

Depois de editar, reinicie a API:

```bash
npm run dev:api
```

## Google Workspace - Gmail, Calendar, Drive

Ja existe fluxo OAuth no Orion.

Voce precisa:

1. Entrar em `https://console.cloud.google.com/`.
2. Criar ou selecionar um projeto.
3. Ir em `APIs & Services` -> `Library`.
4. Ativar:
   - Gmail API;
   - Google Calendar API;
   - Google Drive API.
5. Ir em `APIs & Services` -> `OAuth consent screen`.
6. Configurar app em modo External ou Testing.
7. Adicionar seu email como test user se estiver em Testing.
8. Ir em `Credentials` -> `Create Credentials` -> `OAuth client ID`.
9. Escolher `Web application`.
10. Em Authorized redirect URIs, adicionar:

```text
http://localhost:3001/v1/integrations/google/callback
```

11. Copiar `Client ID` e `Client Secret`.
12. Colocar no `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/v1/integrations/google/callback
```

No app:

1. Abrir `/integrations`.
2. Clicar `CONECTAR GOOGLE`.
3. Autorizar Gmail/Calendar/Drive.

## GitHub

Docs oficiais: `https://docs.github.com/en/rest`
Webhooks: `https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries`

Mais seguro para dev local: fine-grained personal access token.

Voce precisa:

1. Entrar em GitHub.
2. Ir em `Settings` -> `Developer settings`.
3. Abrir `Personal access tokens` -> `Fine-grained tokens`.
4. Clicar `Generate new token`.
5. Selecionar apenas os repositorios que o Orion pode ler.
6. Permissoes iniciais recomendadas:
   - Contents: Read-only;
   - Issues: Read and write se quiser criar issues;
   - Pull requests: Read-only;
   - Metadata: Read-only.
7. Gerar token.
8. Colocar no `.env`:

```env
GITHUB_TOKEN=github_pat_...
```

Regra do produto: criar issue/comentar/fechar PR deve passar pela Decision Inbox.

Webhook local:

```env
GITHUB_WEBHOOK_SECRET=crie_um_valor_longo_aleatorio
```

URL para configurar no GitHub quando estiver com tunnel:

```text
https://SEU_TUNEL/v1/webhooks/github
```

## Notion

Docs oficiais: `https://developers.notion.com/reference/intro`

Voce precisa:

1. Entrar em `https://www.notion.so/my-integrations`.
2. Clicar `New integration`.
3. Dar nome, ex: `ORION Local`.
4. Escolher o workspace.
5. Copiar o `Internal Integration Secret`.
6. Colocar no `.env`:

```env
NOTION_TOKEN=secret_...
```

7. No Notion, abrir a pagina/database que o Orion pode acessar.
8. Clicar em `...` -> `Connections`.
9. Adicionar a integracao `ORION Local`.

Regra do produto: criar pagina/alterar database deve passar pela Decision Inbox.

Importante para SaaS:

- `NOTION_TOKEN` e uma integracao interna. Ela serve para desenvolvimento local no seu workspace.
- Para produto real, cada usuario precisa conectar o proprio Notion via OAuth.
- O banco do Orion ja trabalha com `Integration` por `userId`, entao a arquitetura correta e multiusuario.
- O fluxo `/v1/integrations/notion/start` e `/v1/integrations/notion/callback` ja existe no backend.
- Em producao, o Orion nao deve operar so no seu Notion. Ele deve operar no Notion que cada pessoa autorizou.

Para ativar o OAuth do Notion:

1. Entrar em `https://www.notion.so/my-integrations`.
2. Criar/editar uma conexao publica usando OAuth, nao apenas token interno.
3. Adicionar o redirect URI:

```text
http://127.0.0.1:3001/v1/integrations/notion/callback
```

4. Copiar `OAuth client ID` e `OAuth client secret`.
5. Preencher no `.env`:

```env
NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
NOTION_REDIRECT_URI=http://127.0.0.1:3001/v1/integrations/notion/callback
```

6. Reiniciar a API.
7. Abrir `/integrations`.
8. No card Notion, clicar `CONECTAR`.

Observacao: quando o usuario autoriza, o Notion ainda respeita o acesso dado pelo workspace/paginas. Se ele nao compartilhar nenhuma pagina/database com o Orion, a conexao existe, mas o Orion nao tera conteudo para operar.

## Slack

Docs oficiais: `https://docs.slack.dev/apis/web-api`
OAuth: `https://api.slack.com/authentication/oauth-v2`
Assinatura de requests: `https://api.slack.com/docs/verifying-requests-from-slack`

Voce precisa:

1. Entrar em `https://api.slack.com/apps`.
2. Clicar `Create New App`.
3. Escolher `From scratch`.
4. Escolher workspace.
5. Ir em `OAuth & Permissions`.
6. Em `Bot Token Scopes`, adicionar inicialmente:
   - `channels:history`;
   - `channels:read`;
   - `chat:write`;
   - `users:read`.
7. Clicar `Install to Workspace`.
8. Copiar o `Bot User OAuth Token`.
9. Colocar no `.env`:

```env
SLACK_BOT_TOKEN=xoxb-...
```

Regra do produto: enviar mensagem deve passar pela Decision Inbox.

Webhook/Event Subscriptions local:

```env
SLACK_SIGNING_SECRET=...
```

URL para configurar no Slack quando estiver com tunnel:

```text
https://SEU_TUNEL/v1/webhooks/slack
```

## OpenWeather

Docs oficiais: `https://openweathermap.org/api`

Voce precisa:

1. Criar conta em `https://openweathermap.org/`.
2. Ir em `My API keys`.
3. Criar/copiar uma API key.
4. Colocar no `.env`:

```env
OPENWEATHER_API_KEY=...
```

Uso esperado: clima para Agenda, Travel, rotina e alertas.

## Spotify

Docs oficiais: `https://developer.spotify.com/documentation/web-api`

Voce precisa:

1. Entrar em `https://developer.spotify.com/dashboard`.
2. Clicar `Create app`.
3. Criar app `ORION Local`.
4. Em redirect URI, adicionar futuramente:

```text
http://localhost:3001/v1/integrations/spotify/callback
```

5. Copiar `Client ID` e `Client Secret`.
6. Colocar no `.env`:

```env
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

Observacao: o fluxo OAuth Spotify ainda precisa ser implementado antes de controlar playback real.

## Todoist

Docs oficiais: `https://developer.todoist.com/rest/v2/`

Voce precisa:

1. Entrar no Todoist.
2. Ir em `Settings` -> `Integrations` -> `Developer`.
3. Copiar API token.
4. Colocar no `.env`:

```env
TODOIST_API_TOKEN=...
```

Regra do produto: criar tarefa externa deve passar pela Decision Inbox para evitar duplicacao com Life OS.

## Linear

Docs oficiais: `https://developers.linear.app/docs/graphql/working-with-the-graphql-api`
Webhooks: `https://linear.app/developers/webhooks`

Voce precisa:

1. Entrar no Linear.
2. Ir em `Settings` -> `API`.
3. Criar/copiar uma Personal API key.
4. Colocar no `.env`:

```env
LINEAR_API_KEY=...
```

Regra do produto: criar issue deve passar pela Decision Inbox.

Webhook local:

```env
LINEAR_WEBHOOK_SECRET=crie_o_secret_no_webhook_do_linear
```

URL para configurar no Linear quando estiver com tunnel:

```text
https://SEU_TUNEL/v1/webhooks/linear
```

Sobre OAuth:

- Personal API key serve para dev e automacoes suas.
- OAuth e o caminho correto para SaaS, porque cada workspace/usuario autoriza o Orion.
- O app Linear que voce criou deve usar redirect URI futura como:

```text
http://127.0.0.1:3001/v1/integrations/linear/callback
```

O callback Linear ainda precisa ser implementado antes de virar conexao multiusuario completa.

## Como conferir no Orion

1. Reinicie a API.
2. Abra `http://127.0.0.1:5173/integrations`.
3. Veja o `Capability Registry`.
4. Status esperados:
   - `connected`: OAuth ativo no banco;
   - `configured`: env/key existe, mas ainda nao tem OAuth/conexao no banco;
   - `setup_required`: falta key/secret;
   - `planned`: planejado, nao implementado como conector completo ainda.

## Checklist antes de testar agora

1. Abra o Docker Desktop.
2. Na raiz do monorepo, rode:

```bash
npm run docker:up
npm run db:push
npm run dev:api
npm run dev:web
```

3. Confira:

```text
http://localhost:3001/health
http://127.0.0.1:5173
```

4. Se a API reclamar de env, confira `apps/api/.env`.
5. Se o chat responder `Falha na comunicacao com o nucleo`, verifique primeiro:
   - API rodando;
   - `ANTHROPIC_API_KEY`;
   - `CLERK_SECRET_KEY`;
   - login no frontend;
   - console do terminal da API.

## O que ainda depende de voce

### Obrigatorio para o Orion conversar

- Ter `ANTHROPIC_API_KEY` valida.
- Ter Clerk configurado:
  - `CLERK_SECRET_KEY`;
  - `CLERK_PUBLISHABLE_KEY`;
  - frontend com publishable key correta se existir `.env.local`.

### Obrigatorio para banco/cache

- Docker Desktop aberto.
- Postgres e Redis subidos via `npm run docker:up`.
- `DATABASE_URL` apontando para o Postgres local.
- `REDIS_URL` apontando para Redis local.

### Obrigatorio para Google real

- Ativar Gmail API, Calendar API e Drive API no Google Cloud.
- Configurar OAuth consent screen.
- Adicionar redirect:

```text
http://localhost:3001/v1/integrations/google/callback
```

- Reconectar pelo Orion em `/integrations`.

### Necessario se quiser testar conectores externos

- Slack: bot token e scopes corretos.
- Todoist: API token.
- Linear: API key ou OAuth token.
- Spotify: client id/secret para busca.
- Notion: token interno para dev simples.
- Brave: API key para radar/web search.
- TMDB/RAWG: chaves para midia/gaming.

### Webhooks

Voce so precisa mexer nisso quando quiser eventos externos entrando sozinhos no Orion.

1. Criar tunnel publico para sua API local, por exemplo ngrok/cloudflared.
2. Configurar provider com URLs:

```text
https://SEU_TUNEL/v1/webhooks/github
https://SEU_TUNEL/v1/webhooks/linear
https://SEU_TUNEL/v1/webhooks/slack
```

3. Criar secrets nos providers.
4. Colocar no `.env`:

```env
GITHUB_WEBHOOK_SECRET=...
LINEAR_WEBHOOK_SECRET=...
SLACK_SIGNING_SECRET=...
```

## Rotacao de secrets antes de producao

Como algumas chaves/tokens foram compartilhados em conversa durante o desenvolvimento, trate todas como comprometidas antes de publicar.

Antes de deploy real:

1. Revogue os tokens antigos.
2. Gere novos tokens/secrets.
3. Atualize os ambientes de deploy.
4. Nunca suba `.env` para o Git.
5. Prefira OAuth multiusuario para produto SaaS.

## Ordem recomendada de setup manual

1. Docker/Postgres/Redis.
2. Anthropic.
3. Clerk.
4. Google OAuth.
5. Brave Search.
6. Todoist/Linear/Slack em dev token.
7. Notion OAuth multiusuario.
8. Webhooks.
9. Stripe somente depois que o produto estiver funcional.
