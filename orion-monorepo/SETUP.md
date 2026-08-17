# ORION — Guia de Setup Local

Stack: React 18 + TypeScript + Node.js + PostgreSQL + Redis + Clerk + Claude API

---

## Pré-requisitos

- Node.js 20+  (`node -v`)
- npm 10+      (`npm -v`)
- Docker Desktop (`docker -v`)

---

## 1. Instale dependências

```bash
cd orion-monorepo
npm install
```

---

## 2. Variáveis de ambiente

### apps/api/.env

```env
DATABASE_URL="postgresql://orion:orion_dev@localhost:5433/orion?schema=public"
REDIS_URL="redis://localhost:6379"

CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."

ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-sonnet-4-6"

NODE_ENV="development"
PORT=3001
WEB_ORIGIN="http://localhost:5173"
FRONTEND_URL="http://localhost:5173"
```

Clerk grátis em https://clerk.com · Anthropic em https://console.anthropic.com
Stripe e integrações externas são opcionais para dev local.

### apps/web/.env

```env
VITE_API_URL="http://localhost:3001"
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
```

---

## 3. Suba banco + Redis

```bash
npm run docker:up
```

Isso sobe PostgreSQL na porta 5433 e Redis na 6379.
Confira: `docker ps` — deve aparecer orion_postgres e orion_redis.

---

## 4. Migrations + seed

```bash
npm run db:push
npm run db:seed --workspace apps/api
```

O seed cria usuário demo (karen@orion.local), projetos, hábitos, rotinas, journal e quests para testar tudo sem precisar preencher nada.

---

## 5. Inicie em dev

```bash
npm run dev
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |
| Prisma Studio | `npm run db:studio` → http://localhost:5555 |

---

## 6. Primeiro acesso

1. Acesse http://localhost:5173
2. Faça login com Google (Clerk)
3. ORION redireciona para /onboarding no primeiro acesso
4. Complete o onboarding — cria seu perfil no banco

---

## Testando os módulos

### Interface

| Módulo | URL | O que testar |
|---|---|---|
| Dashboard | / | Widgets do dia, Daily Brief |
| Life OS | /m/life | Criar tarefa, recorrência, sub-tarefas |
| Agenda | /m/agenda | Eventos, conectar Google Calendar |
| Hábitos | /m/habits | Criar, dar check, ver streak |
| Rotinas | /m/routines | Builder + timer de execução |
| Diário | /m/journal | Entrada guiada 6-steps + análise IA |
| Projetos | /m/projects | Milestones, timeline, stall detection |
| Finanças | /m/finance | Transações, donut chart, budget |
| Quest/XP | /m/quest | XP, conquistas, nível |
| Chat ORION | ícone chat | @módulo, /slash, salvar como tarefa |
| Inbox | /inbox | Alertas centralizados |

### API (Insomnia / Postman)

Base: `http://localhost:3001/v1`
Auth: header `Authorization: Bearer <jwt>`

Para pegar o JWT em dev: abra o DevTools no frontend e rode no console:
```js
await window.Clerk.session.getToken()
```

Rotas úteis:
```
GET  /v1/user/profile
GET  /v1/brief                         ← Daily Brief gerado por IA
GET  /v1/m/habits
POST /v1/m/habits/:id/check
GET  /v1/m/journal/today
POST /v1/m/journal
POST /v1/m/journal/2026-06-16/insight  ← Análise ORION via Claude
GET  /v1/m/projects
GET  /v1/m/projects/stalled            ← Projetos parados + sugestão IA
POST /v1/m/routines/:id/start
POST /v1/chat
```

### Banco visual

```bash
npm run db:studio
```

Abre interface visual em http://localhost:5555 para ver e editar qualquer tabela.

---

## Troubleshooting

**ECONNREFUSED 5433** → Docker não está rodando. Execute `npm run docker:up`.

**Invalid Clerk token** → CLERK_SECRET_KEY da API e CLERK_PUBLISHABLE_KEY do web devem ser do mesmo projeto Clerk.

**Cannot find module '@orion/types'** → Compile os types: `npm run build:types`

**Tabela não encontrada** → Execute `npm run db:push`

**Frontend em branco / CORS** → Verifique WEB_ORIGIN=http://localhost:5173 na API.

**Erros de IA** → Chat e análises falham sem ANTHROPIC_API_KEY válida, mas o resto funciona normalmente.

---

## Comandos

```bash
npm run dev              # Sobe tudo
npm run docker:up        # Banco + Redis
npm run docker:down      # Para containers
npm run db:push          # Aplica schema
npm run db:studio        # Interface visual do banco
npm run build            # Build produção
npm run typecheck        # Checa TypeScript
```

---

## Estrutura

```
orion-monorepo/
├── apps/
│   ├── api/
│   │   ├── src/routes/       # Rotas HTTP /v1/...
│   │   ├── src/modules/      # Services de cada módulo
│   │   ├── src/middleware/   # Auth, error, rate limit
│   │   ├── src/integrations/ # Google, Notion, etc.
│   │   ├── src/ai/           # Claude API, agent system
│   │   └── prisma/           # Schema + seed
│   └── web/
│       ├── src/pages/        # Uma página por módulo
│       ├── src/hooks/        # React Query hooks
│       ├── src/components/   # Layout, UI, widgets
│       ├── src/stores/       # Zustand
│       └── src/lib/api.ts    # Client HTTP central
└── packages/types/           # Tipos compartilhados
```

Padrão de cada módulo: route.ts → service.ts → hook.ts → Page.tsx
