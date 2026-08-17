# O.R.I.O.N - Handoff de Desenvolvimento Atual

Data: 2026-05-22  
Objetivo desta leva: tornar o Orion mais funcional, autonomo, tecnologico e menos "telas jogadas", priorizando utilidade real antes de monetizacao.

## 1. Estado geral

O Orion evoluiu de um painel com modulos para um sistema com:

- chat com ferramentas reais;
- Action Queue para acoes sensiveis;
- Notification Center com alertas, decisoes e historico;
- modulos funcionais com API, service, hook e tela;
- conectores externos em modo API direta/dev;
- DEV Executor para ler workspace, propor arquivos, aplicar patches aprovados e rodar comandos aprovados;
- Auto Debug e Debug Runbook para diagnosticar falhas de build/typecheck;
- Code Context Map para o chat entender a estrutura do monorepo antes de sugerir mudancas.

Billing/Stripe ficou propositalmente fora desta rodada.

## 2. Como rodar

Na raiz do monorepo:

```bash
npm install
npm run docker:up
npm run db:push
npm run dev:api
npm run dev:web
```

URLs:

- Web: `http://127.0.0.1:5173`
- API: `http://localhost:3001`
- Health: `http://localhost:3001/health`

Se Docker ja estiver aberto mas Postgres/Redis nao subirem:

```bash
npm run docker:down
npm run docker:up
```

## 3. Validacao ja executada

Os comandos abaixo passaram nesta leva:

```bash
npm run typecheck --workspace apps/api
npm run typecheck --workspace apps/web
npm run typecheck --workspace packages/types
npm run build --workspace apps/api
npm run build --workspace apps/web
npm run build --workspace packages/types
```

## 4. Principais funcionalidades implementadas

### 4.1 Chat como agente executor

Arquivos principais:

- `apps/api/src/ai/ai.service.ts`
- `apps/api/src/ai/ai-stream.service.ts`
- `apps/api/src/ai/system-prompt.ts`
- `apps/api/src/ai/tools.ts`
- `apps/api/src/ai/agent-planner.ts`

O chat agora:

- recebe contexto de memorias, preferencias, politicas de autonomia, padroes e brain snapshot;
- planeja algumas intencoes antes da chamada principal;
- roteia acoes internas pelo Autonomy Core;
- usa tools para criar tarefas, memorias, alertas, habitos, wishlist, contatos, registros financeiros, midia e seguranca;
- prepara acoes externas para aprovacao;
- consegue usar ferramentas de DEV para ler codigo, propor patch, preparar comando e diagnosticar execucoes.

### 4.2 Action Queue e Decision Core

Arquivos principais:

- `apps/api/src/decisions/decision.service.ts`
- `apps/api/src/decisions/action-router.ts`
- `apps/api/src/decisions/action-executor.ts`
- `apps/api/src/decisions/external-action-executor.ts`
- `apps/api/src/routes/decisions.routes.ts`
- `packages/types/src/decision.ts`
- `apps/web/src/hooks/useDecisions.ts`
- `apps/web/src/components/notifications/NotificationCenter.tsx`

Funcionalidades:

- fila de decisoes pendentes;
- aprovar/rejeitar decisoes;
- executar acoes internas;
- executar acoes externas aprovadas;
- historico de execucoes recentes;
- resumo da fila;
- Notification Center mostra preview, risco, destino, corpo e resultado da execucao.

Acoes externas suportadas:

- `slack.post_message`
- `todoist.create_task`
- `linear.create_issue`
- `workspace.write_file`
- `workspace.patch_file`
- `workspace.run_command`

### 4.3 Notification Center

Arquivo principal:

- `apps/web/src/components/notifications/NotificationCenter.tsx`

Agora mostra:

- alertas proativos;
- Action Queue;
- preview de acoes externas;
- botoes `EXECUTAR` e `IGNORAR`;
- resultado da execucao;
- historico de execucoes.

### 4.4 Command Palette

Arquivos principais:

- `apps/web/src/components/command/CommandPalette.tsx`
- `apps/web/src/components/layout/OrionLayout.tsx`

Funcionalidades:

- `Ctrl+K` / `Cmd+K`;
- navegar para modulos;
- executar prompts rapidos no chat;
- trocar modo;
- abrir rotas principais.

### 4.5 Voice Mode e PWA

Arquivos principais:

- `apps/web/src/components/panels/ChatPanel.tsx`
- `apps/web/public/manifest.webmanifest`
- `apps/web/public/sw.js`
- `apps/web/src/main.tsx`
- `apps/web/index.html`

Funcionalidades:

- ditado por voz via Web Speech API quando o navegador suporta;
- resposta falada opcional via speech synthesis;
- PWA instalavel em build de producao;
- service worker registrado em producao.

### 4.6 Onboarding e perfil adaptativo

Arquivos principais:

- `apps/web/src/pages/OnboardingScreen.tsx`
- `apps/api/src/routes/onboarding.routes.ts`
- `apps/api/src/routes/user.routes.ts`
- `apps/web/src/stores/user.store.ts`

Agora o onboarding coleta:

- modo inicial;
- foco principal;
- estilo de comunicacao;
- estilo de decisao;
- areas de interesse;
- objetivo;
- limites de autonomia.

Essas informacoes viram preferencias/memorias usadas pelo prompt.

### 4.7 Autonomy Core

Arquivos principais:

- `apps/api/src/proactive/`
- `apps/api/src/decisions/action-router.ts`
- `apps/api/src/alerts/detector.ts`
- `apps/api/src/automations/templates.ts`
- `apps/web/src/components/panels/MissionControlPanel.tsx`

Funcionalidades:

- politicas de autonomia por modulo;
- alertas proativos;
- rotas para aprovar ou rejeitar acoes;
- mission control com acoes e contexto.

### 4.8 Conectores externos

Arquivos principais:

- `apps/api/src/integrations/external-connectors.ts`
- `apps/api/src/integrations/capability-registry.ts`
- `apps/api/src/integrations/notion-oauth.ts`
- `apps/api/src/integrations/notion-handlers.ts`
- `apps/api/src/routes/integrations.routes.ts`
- `apps/api/src/routes/webhooks.routes.ts`
- `apps/api/src/webhooks/`
- `WEBHOOKS_STRATEGY.md`
- `API_CONNECTORS_ROADMAP.md`
- `API_KEYS_PASSO_A_PASSO.md`

Suporte atual:

- Google Gmail/Calendar/Drive via OAuth/API existente;
- Notion token interno e base de OAuth;
- Slack leitura/envio com bot token;
- Spotify busca;
- Todoist listar/criar tarefa;
- Linear listar teams/issues e criar issue;
- GitHub planejado via token e webhooks;
- webhooks para eventos externos entrarem no Orion.

Escrita externa deve passar por Action Queue.

### 4.9 Modulos adicionados/fortalecidos

Padrao criado: tipos compartilhados + service API + route + hook React + page.

Modulos/telas adicionados ou expandidos:

- Finance/CFO;
- Media;
- Security;
- Social;
- Shop/Compras;
- Chef;
- Travel;
- What-if;
- Mindset;
- Idiomas;
- DEV;
- Gaming reformulado;
- Radar melhorado;
- Sleep pelo chat;
- Habits/Focus/Health com fluxos mais concretos.

Arquivos principais seguem o padrao:

- `packages/types/src/<modulo>.ts`
- `apps/api/src/modules/<modulo>.service.ts`
- `apps/api/src/routes/m/<modulo>.routes.ts`
- `apps/web/src/hooks/modules/use<Modulo>.ts`
- `apps/web/src/pages/modules/<Modulo>Page.tsx`

### 4.10 DEV Executor

Arquivos principais:

- `packages/types/src/dev.ts`
- `apps/api/src/modules/dev.service.ts`
- `apps/api/src/modules/workspace-root.ts`
- `apps/api/src/modules/workspace-edit.ts`
- `apps/api/src/routes/m/dev.routes.ts`
- `apps/web/src/pages/modules/DevPage.tsx`
- `apps/web/src/hooks/modules/useDev.ts`

Capacidades:

- escanear workspace;
- ler arquivo dentro do monorepo;
- criar arquivo aprovado;
- substituir arquivo aprovado;
- aplicar patch `search/replace` aprovado;
- preparar comandos aprovados;
- rodar somente comandos permitidos:
  - `npm run <script> ...`
  - `git status`
  - `git diff`
  - `git log`
  - `git show`
  - `git branch`
- bloquear caminhos fora do workspace;
- bloquear comandos com metacaracteres perigosos.

Tools do chat:

- `workspace_scan`
- `workspace_context_map`
- `workspace_read_file`
- `workspace_prepare_file`
- `workspace_prepare_patch`
- `workspace_prepare_command`
- `workspace_recent_executions`
- `workspace_diagnose_last_execution`
- `workspace_debug_runbook`

### 4.11 Auto Debug

Arquivos principais:

- `apps/api/src/modules/dev.service.ts`
- `apps/web/src/pages/modules/DevPage.tsx`

Funcionalidades:

- diagnostica ultima execucao;
- extrai exit code;
- detecta arquivos provaveis;
- detecta linhas/colunas/codigos TS quando aparecem;
- sugere proximos passos;
- mostra card `AUTO DEBUG` na tela DEV.

### 4.12 Debug Runbook

Funcionalidades:

- gera roteiro de debug baseado na ultima falha;
- sugere abrir arquivo alvo;
- sugere patch pequeno;
- sugere comando de revalidacao;
- quando validacao passa, sugere revisar diff e rodar build relevante;
- mostra card `DEBUG RUNBOOK` na tela DEV;
- chat usa `workspace_debug_runbook`.

### 4.13 Code Context Map

Funcionalidades:

- mapeia rotas API;
- services API;
- AI core;
- integracoes;
- paginas;
- module pages;
- hooks;
- components;
- stores;
- tipos compartilhados;
- recomenda onde mexer por tipo de tarefa.

Arquivos:

- `packages/types/src/dev.ts`
- `apps/api/src/modules/dev.service.ts`
- `apps/api/src/routes/m/dev.routes.ts`
- `apps/web/src/pages/modules/DevPage.tsx`

Tool do chat:

- `workspace_context_map`

## 5. Teste completo recomendado

Use o roteiro principal:

- `PASSO_A_PASSO_TESTE_ORION_ATUAL.md`

Ordem recomendada para testar sem se perder:

1. Ambiente e login.
2. Chat basico.
3. Onboarding.
4. Dashboard.
5. Command Palette.
6. Notification Center.
7. Action Queue.
8. Memoria/preferencias.
9. Modulos principais.
10. Conectores que ja tiverem chave.
11. DEV Executor.
12. Auto Debug.
13. Debug Runbook.
14. Code Context Map.
15. Mobile/PWA/voz.

## 6. Chaves e configuracoes que voce ainda precisa conferir

Nao cole secrets em chat. Confira localmente em `apps/api/.env`.

Obrigatorias para nucleo:

- `DATABASE_URL`
- `REDIS_URL`
- `ANTHROPIC_API_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`

Importantes para IA/memoria/radar:

- `OPENAI_API_KEY` para embeddings semanticos;
- `BRAVE_SEARCH_API_KEY` para web search/radar;
- `TMDB_API_KEY` para midia;
- `RAWG_API_KEY` para jogos.

Google:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=http://localhost:3001/v1/integrations/google/callback`

Notion:

- Dev simples: `NOTION_TOKEN`
- Produto SaaS/OAuth: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`

Slack:

- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`

Spotify:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/v1/integrations/spotify/callback`

Todoist:

- `TODOIST_API_TOKEN`

Linear:

- Dev simples: `LINEAR_API_KEY` ou `LINEAR_OAUTH_TOKEN`
- OAuth/produto: `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`

GitHub:

- `GITHUB_TOKEN`
- `GITHUB_WEBHOOK_SECRET` quando usar webhook.

Webhooks com tunnel:

- Configure uma URL publica temporaria, por exemplo com ngrok/cloudflared.
- Aponte providers para:
  - GitHub: `https://SEU_TUNEL/v1/webhooks/github`
  - Linear: `https://SEU_TUNEL/v1/webhooks/linear`

## 7. Credenciais sensiveis

Algumas secrets foram coladas em chat durante o desenvolvimento. Antes de producao:

1. Rotacione todas.
2. Gere novas credenciais.
3. Atualize `.env` local e ambiente de deploy.
4. Revogue as antigas nas plataformas.
5. Nunca commite `apps/api/.env`.

## 8. Riscos conhecidos

- Ainda ha muitas mudancas nao commitadas e arquivos novos.
- O DEV Executor escreve arquivos apenas apos aprovacao, mas ainda deve ser usado com cuidado.
- `workspace.patch_file` exige `search` exato; se o trecho mudar, o patch falha com seguranca.
- Comandos permitidos sao limitados de proposito.
- OAuth completo de Notion/Slack/Linear ainda precisa acabamento para SaaS multiusuario.
- Alguns conectores funcionam melhor em modo dev token antes de OAuth completo.
- Teste visual real ainda precisa ser feito no navegador por voce.

## 9. Proximos passos tecnicos sugeridos

1. Testar tudo pelo `PASSO_A_PASSO_TESTE_ORION_ATUAL.md`.
2. Corrigir bugs encontrados.
3. Fechar OAuth multiusuario de Notion/Slack/Linear.
4. Melhorar diffs visuais no Notification Center.
5. Adicionar testes automatizados para Action Queue e DEV Executor.
6. Criar Module Builder Plan automatico.
7. Melhorar mobile com rodada visual real.
8. Depois disso, pensar em billing/Stripe.
