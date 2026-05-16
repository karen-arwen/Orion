# O.R.I.O.N

**Omni-Responsive Intelligent Operating Nexus** — Sistema operacional de vida com IA.
Jarvis + Ultron: poder, sofisticação, elegância. SaaS-ready.

```
┌─────────────────────────────────────────────────────────────────┐
│   O.R.I.O.N  ◉  Núcleo Claude Sonnet 4  ◉  MCP-native           │
│   React 18 · TypeScript · Express · Prisma · Postgres · Redis   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack

| Camada      | Tech                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| Frontend    | React 18 + TypeScript + Vite + Tailwind + Zustand + Framer Motion + Clerk  |
| Backend     | Node 20 + Express + TypeScript + Prisma + PostgreSQL + Redis               |
| IA          | Claude API (`claude-sonnet-4-6`) + MCP servers (Gmail, Calendar...)        |
| Auth        | Clerk (Google OAuth)                                                       |
| Deploy      | Vercel (web) + Railway (api + db + redis)                                  |

## Estrutura

```
orion-monorepo/
├── apps/
│   ├── web/                    # React + Vite (Painel Stark)
│   └── api/                    # Express + Prisma (núcleo + MCP)
├── packages/
│   └── types/                  # Tipos TS compartilhados
├── docker-compose.yml          # Postgres + Redis local
├── .env.example                # Template de variáveis
└── package.json                # npm workspaces
```

## Setup rápido

```bash
# 1. Instalar dependências
npm install

# 2. Subir Postgres + Redis local
npm run docker:up

# 3. Copiar .env e preencher
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
#   → Coloque suas chaves: ANTHROPIC_API_KEY, CLERK_*, etc.

# 4. Aplicar schema no banco
npm run db:push

# 5. Rodar tudo em dev
npm run dev
#   → web:  http://localhost:5173
#   → api:  http://localhost:3001
```

## Scripts úteis

```bash
npm run dev              # web + api em paralelo
npm run build            # build de tudo
npm run typecheck        # tsc --noEmit em todos os workspaces
npm run db:push          # aplicar schema no banco
npm run db:studio        # GUI do Prisma
npm run docker:up        # subir Postgres + Redis
npm run docker:down      # parar containers
```

## Personalidade

> Tom: sofisticado, preciso, levemente dramático. Nunca genérico.
> Confirma ações irreversíveis. Aprende padrões. 3 camadas de gosto: atual (70%) + nostalgia (20%) + exploração (10%).
> Modos: SILENCIOSO · NORMAL · STARK.

## Roadmap

- **Fase 1 — MVP (atual)**: monorepo · auth · chat Claude + MCP · módulos core · deploy
- **Fase 2 — Produto**: automações · memória persistente · 10 módulos a mais
- **Fase 3 — SaaS**: Stripe · plugin ecosystem · mobile · voz

Construído com 🩵 por Karen Arwen.
