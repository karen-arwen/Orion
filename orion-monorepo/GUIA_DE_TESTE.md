# O.R.I.O.N — Guia Completo de Setup, Teste e Instalacao como App

## 1. Setup inicial (fazer 1 vez)

```bash
cd orion-monorepo

# Subir banco + Redis
docker compose up -d

# Instalar dependencias
npm install
cd apps/web && npm install react-markdown remark-gfm && cd ../..
cd apps/api && npm install web-push && cd ../..

# Prisma (gerar client + criar tabelas)
cd apps/api
npx prisma generate
npx prisma db push
cd ../..
```

## 2. (Opcional) Push Notifications

```bash
cd apps/api
npx web-push generate-vapid-keys
```

Copie o output e adicione no `apps/api/.env`:
```
VAPID_PUBLIC_KEY=<sua_public_key>
VAPID_PRIVATE_KEY=<sua_private_key>
```

## 3. Rodar o projeto

Abra 2 terminais:

```bash
# Terminal 1 — API
cd orion-monorepo/apps/api && npm run dev

# Terminal 2 — Frontend
cd orion-monorepo/apps/web && npm run dev
```

Abra http://localhost:5173

## 4. Instalar como App (PWA)

### No Chrome (PC):
1. Abra http://localhost:5173
2. Clique no icone de instalacao na barra de endereco (ou menu > "Instalar O.R.I.O.N")
3. O app abre em janela propria, sem barra de navegacao

### No Android:
1. Abra http://localhost:5173 no Chrome mobile
2. Toque em "Adicionar a tela inicial" (ou banner automatico)
3. O app aparece como icone na home screen
4. Abre em modo standalone (parece app nativo)

### No iPhone/iPad:
1. Abra no Safari
2. Toque em Compartilhar > "Adicionar a Tela de Inicio"
3. O app abre em fullscreen

### Pra produção (Play Store):
- Use PWABuilder (https://www.pwabuilder.com) pra gerar APK
- Ou Capacitor (`npx cap init` + `npx cap add android`)

---

## 5. Primeiro acesso

1. Login com Google (via Clerk)
2. Complete o Onboarding (4 passos: modo, foco, comunicacao, decisao)
3. Tour interativo aparece automaticamente — mostra cada area do app
4. O ORION esta pronto!

---

## 6. O que testar

### Auth + Onboarding
- [ ] Login com Google funciona
- [ ] Onboarding 4 passos
- [ ] Tour interativo aparece apos onboarding (spotlight + tooltips)
- [ ] Tour pode ser pulado ou completado

### Dashboard
- [ ] Momentum Score (ring gauge 0-100 com 5 dimensoes)
- [ ] Streaks Heatmap (grid 365 dias verde)
- [ ] Mini-calendar com hoje highlightado
- [ ] Greeting contextual (manha/tarde/noite)
- [ ] Vitals cards com animacao staggered
- [ ] Botao contextual (PLANEJAR MEU DIA / CHECK / PREPARAR AMANHA)

### Chat
- [ ] Markdown renderizado (bold, listas, code blocks, tabelas)
- [ ] Slide-in animation (user da direita, ORION da esquerda)
- [ ] Typing indicator (3 dots pulsantes + "PROCESSANDO")
- [ ] Reactions hover-only (thumbs, star, pin)
- [ ] Inline actions (APROVAR/REJEITAR) quando menciona Decision Inbox
- [ ] Voice input e output
- [ ] Action cards contextuais

### Tools do Chat (testar via conversa)
- [ ] "Quais meus emails?" → gmail_list
- [ ] "Analisa meus habitos" → habit_analysis
- [ ] "Como estao minhas financas?" → financial_analysis (5 acoes)
- [ ] "Detecta conflitos na agenda" → calendar_intelligence
- [ ] "Me sugere um filme" → content_recommend
- [ ] "Musica pra focar" → music_for_activity
- [ ] "Planeja viagem pra Gramado, 4 dias" → travel_plan
- [ ] "Com quem eu deveria reconectar?" → social_nudges
- [ ] "Le meus emails e cria tarefas" → plan_multi_step
- [ ] "Responde esse email" → smart_email_draft → Decision Inbox

### Integracoes OAuth
- [ ] Google (Gmail + Calendar + Drive)
- [ ] Microsoft (Outlook + Teams + OneDrive)
- [ ] GitHub, Discord, Atlassian, Slack, Spotify

### Mobile (testar no DevTools em 375px)
- [ ] Bottom nav (CHAT / PAINEL / MODULOS / ALERTAS)
- [ ] Sidebar drawer
- [ ] Chat fullscreen

### Proatividade
- [ ] Morning Brief com previsao do dia (Predictive Engine)
- [ ] Weekly Review (sabado)
- [ ] Habit alerts (20h diario)
- [ ] Budget alerts (segunda 9h)
- [ ] Social nudges (ter/qui 10h)

---

## 7. Portas

| Servico    | Porta |
|------------|-------|
| Frontend   | 5173  |
| API        | 3001  |
| PostgreSQL | 5433  |
| Redis      | 6379  |
| Prisma Studio | 5555 (npx prisma studio) |

## 8. Comandos uteis

```bash
# TypeScript check
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit

# Prisma Studio (visual do banco)
cd apps/api && npx prisma studio

# Reset do banco
cd apps/api && npx prisma db push --force-reset

# Rodar testes
cd apps/api && npm test
```

## 9. Credenciais configuradas

| Provedor | Status |
|----------|--------|
| Google | OK |
| Microsoft | OK |
| GitHub OAuth | OK |
| Atlassian | OK |
| Discord | OK |
| Slack | OK |
| Spotify | OK |
| Linear | OK |
| Todoist | OK |
| Notion | Client ID/Secret VAZIO |
| Figma | Sem credenciais |
| Strava | Sem credenciais |
| Mercado Livre | Sem credenciais |

---

## 10. Features futuras (ideias pra proximas versoes)

### Alto impacto
- **WhatsApp Gateway** — falar com ORION pelo WhatsApp (Business API)
- **Telegram Bot** — bot com /agenda, /tarefas, /foco + notificacoes
- **Context Handoff** — continuidade entre dispositivos (salvar sessao no Redis)
- **Stripe Billing** — FREE/PRO/ENTERPRISE com paywall
- **Deploy Vercel + Railway** — colocar no ar com CI/CD
- **Landing Page** — pagina de marketing com demo e waitlist
- **Voice Assistant** — modo voz continua (wake word "Hey ORION")
- **Widget Desktop** — mini-widget always-on-top com momentum score

### Medio impacto
- **Google Fit / Apple Health** — importar sono, passos, frequencia cardiaca
- **Smart Home** — integrar com Home Assistant / Google Home
- **Focus Mode** — bloquear apps/sites durante sessao de foco
- **Kanban Board** — visualizacao de tarefas estilo Trello
- **Themes** — temas visuais alem do HUD (minimal, warm, matrix)
- **Multi-idioma** — i18n completo (ingles, espanhol)
- **Collaboration** — compartilhar projetos com outras pessoas
- **Export PDF** — exportar weekly review e relatorios como PDF

### Nice-to-have
- **Gamification avancada** — XP, levels, achievements, leaderboard
- **AI Image Generation** — gerar imagens com DALL-E/Midjourney via chat
- **Screen Time Tracker** — monitorar uso de apps e sugerir limites
- **Meal Planner** — plano alimentar semanal integrado com Chef
- **Workout Tracker** — log de treinos com progressao
- **Reading List** — importar de Kindle/Goodreads, tracking de leitura
- **Plugin System** — usuarios criam modulos customizados
- **API publica** — terceiros integram com o ORION
