# O.R.I.O.N — Plano de Implementação Completo

Data: 2026-06-02
Estado: TypeScript compilando limpo (0 erros API + Web)

---

## ESTADO ATUAL — O que já existe e funciona

### Core
- Monorepo (apps/api + apps/web + packages/types) — TypeScript limpo
- Auth: Clerk + Google OAuth
- Chat: Claude API com streaming SSE + tool use nativo
- Action Queue + Decision Core (aprovar/rejeitar ações)
- Notification Center + Command Palette (Ctrl+K)
- Voice Mode + PWA instalável
- Memory 3 camadas (short Redis / mid patterns / long embeddings)
- Cognitive Loop (micro 15min / pulse 1h / deep diário com Claude)
- Trigger Engine (6 triggers: morning brief, foco, sobrecarga, sono, review semanal, projeto parado)
- Morning Brief premium (gerado por Claude Haiku)
- Autonomia por nível com aprendizado de aprovações (streak de 5)
- Entity Graph (extrai pessoas/projetos/tópicos de cada conversa)
- Intent Capture (captura intenções implícitas: "preciso ligar pra minha mãe" → tarefa)
- Personalidade Adaptativa (BehavioralProfile no system prompt)
- DEV Executor (scan, read, patch, run aprovados + auto debug + runbook)
- Onboarding (4 passos, semeia memórias e preferências)

### Módulos (24 — todos com rota API + service + hook + página)
AGENDA, CAREER, CHEF, COMMS, CREATIVE, DEV, DOCS, FINANCE, FOCUS, GAMING, HABITS, HEALTH, KNOW, LANGUAGE, LIFE, MEDIA, MINDSET, RADAR, SECURITY, SHOP, SLEEP, SOCIAL, TRAVEL, WHAT-IF

### Integrações
- Google: Gmail, Calendar, Drive (OAuth completo)
- OAuth universal: Microsoft, GitHub, Notion, Slack, Atlassian, Discord, Figma, Strava, Mercado Livre
- GitHub handlers: repos, issues, PRs, notifications, CI, create issue
- Microsoft handlers: Outlook email/calendar, Teams, OneDrive
- External connectors: Slack, Spotify, Todoist, Linear, Notion
- Brave Search, TMDB, RAWG

### Frontend
- Design HUD sci-fi (#00D4FF + #030509)
- Tool indicators no chat (chips HUD em tempo real)
- Painel de Autonomia (/autonomy)
- Behavioral Profile Builder (/profile/behavioral)
- Integrations page com cards por provedor

---

## O QUE FALTA — Em ordem de prioridade

### SPRINT A — Experiência Premium (1–2 semanas)

1. **Streaming + BehavioralProfile no ai-stream.service.ts**
   - ✅ DONE — GitHub/Microsoft no activeTools do streaming
   - ✅ DONE — BehavioralProfile passado ao buildSystemPrompt no streaming

2. **Dashboard inteligente (refazer DashPanel)**
   - Atual: estático, mostra cards genéricos
   - Objetivo: dashboard que muda com o horário do dia
     - Manhã: Morning Brief + agenda do dia + tarefas prioritárias
     - Tarde: progresso do dia + foco + hábitos pendentes
     - Noite: resumo do dia + sugestão de sono + prep do amanhã
   - Widgets: RingGauge de "dia completado", streak de hábitos, mini-calendar
   - Arquivo: `apps/web/src/components/panels/DashPanel.tsx`

3. **Chat com contexto de módulo**
   - Quando o usuário está em /m/finance e fala no chat, o ORION deve saber que está no contexto de finanças
   - Já existe moduleId na conversa — falta enriquecer o system prompt com dados do módulo ativo
   - Arquivo: `apps/api/src/ai/system-prompt.ts` — adicionar bloco de contexto de módulo

4. **Typing indicator + reactions no chat**
   - Indicador visual de "ORION está pensando..."
   - Reações rápidas (👍 👎 ⭐ 📌) nas mensagens
   - Arquivo: `apps/web/src/components/panels/ChatPanel.tsx`

5. **Mobile responsive**
   - Sidebar colapsável em mobile
   - Chat fullscreen em mobile
   - Bottom nav para módulos principais
   - Testar todos os módulos em viewport 375px

### SPRINT B — Inteligência Profunda (2 semanas)

6. **Weekly Review automático**
   - Sábado de manhã: Claude gera relatório da semana
   - O que foi feito vs planejado
   - Padrões detectados (sono, foco, hábitos)
   - Sugestões para a próxima semana
   - Cria um ProactiveAlert especial com layout de relatório
   - Arquivo: criar `apps/api/src/proactive/weekly-review.service.ts`

7. **Smart Notifications (push real)**
   - Service Worker + Web Push API para notificações nativas
   - ORION pode notificar mesmo com o app fechado
   - "Reunião em 15min" / "Preço alvo atingido" / "Morning Brief pronto"
   - Arquivos: `apps/web/public/sw.js` + backend push endpoint

8. **Semantic Search no chat**
   - Quando o usuário pergunta "o que eu disse sobre X", buscar por embeddings
   - Já existe `searchRelevantMemories` — integrar como tool do chat
   - Nova tool: `memory_search` que busca por similaridade semântica
   - Arquivo: `apps/api/src/ai/tools.ts` — adicionar tool

9. **Pattern Detection avançado**
   - Detectar correlações: "quando você dorme <6h, sua produtividade no dia seguinte cai 40%"
   - Cross-module: sono × foco × humor × hábitos
   - Gerar insights personalizados no Deep Cycle
   - Arquivo: criar `apps/api/src/memory/pattern-detector.ts`

10. **Contextual File Upload**
    - Arrastar arquivo pro chat → Claude analisa
    - PDF, imagem, CSV, código
    - Útil para: "analisa meu extrato bancário" / "resume esse PDF"
    - Arquivos: endpoint de upload + tool `analyze_file`

### SPRINT C — Automações e Ações Reais (2 semanas)

11. **Email Drafting inteligente**
    - ORION lê email recebido e já sugere resposta
    - Rascunho vai pra Decision Inbox para aprovação
    - Personaliza o tom baseado no histórico de emails enviados
    - Arquivo: expandir `apps/api/src/integrations/google-api.ts`

12. **Calendar Intelligence**
    - Detectar conflitos automaticamente
    - Sugerir horários livres quando pedido
    - Prep automático para reuniões (quem é a pessoa, histórico, pontos de pauta)
    - Integrar com CalendarEvent no Prisma (já existe no schema)
    - Arquivo: criar `apps/api/src/modules/calendar-intelligence.service.ts`

13. **Financial Autopilot**
    - Categorização automática de transações
    - Alerta quando se aproxima do limite mensal de categoria
    - "Você gastou 80% do orçamento de lazer com 10 dias ainda no mês"
    - Conectar com Mercado Livre para tracking de compras
    - Arquivo: expandir `apps/api/src/modules/finance.service.ts`

14. **Habit Intelligence**
    - Se o usuário quebra streak de 3+ dias, ORION pergunta se está tudo bem
    - Sugere ajuste de metas baseado em padrão real
    - "Você marcou yoga 2/7 dias há 3 semanas seguidas — quer reduzir pra 2x/semana?"
    - Integrar no Trigger Engine
    - Arquivo: expandir trigger-engine.ts

15. **Multi-step Actions**
    - ORION propõe planos de múltiplos passos
    - "Vou: (1) ler seus emails não lidos, (2) resumir os importantes, (3) criar tarefas pros que precisam de ação, (4) rascunhar respostas pros urgentes"
    - Cada passo aparece como uma decisão que pode ser aprovada em batch
    - Arquivo: expandir `apps/api/src/ai/agent-planner.ts`

### SPRINT D — Social e Vida Real (1–2 semanas)

16. **CRM pessoal ativo**
    - Social module já existe mas é passivo
    - ORION detecta que você não fala com alguém importante há N dias
    - Sugere mensagem contextual: "Faz 3 semanas que você não fala com [mãe]. Quer que eu sugira uma mensagem?"
    - Integrar com contacts do Google/Microsoft
    - Arquivo: expandir `apps/api/src/modules/social.service.ts`

17. **Travel planning real**
    - Travel module já existe mas é genérico
    - ORION sugere roteiros baseados em preferências aprendidas
    - Integrar com Google Maps API para distâncias/tempos
    - Conectar com lista de desejos do módulo Shop
    - Arquivo: expandir `apps/api/src/modules/travel.service.ts`

18. **Content recommendations reais**
    - Media module + Cultural radar com dados reais
    - Integrar Spotify para sugerir música baseada no humor/atividade
    - TMDB + RAWG já conectados — fazer recomendações personalizadas
    - "Percebi que você curtiu thrillers psicológicos — saiu um novo no TMDB que pode gostar"

### SPRINT E — Polish e Production (1–2 semanas)

19. **Error recovery no Action Queue**
    - Retry inteligente com backoff exponencial
    - Se Slack falha, tenta novamente em 30s, 1min, 5min
    - Notifica o usuário se falha permanente
    - Arquivo: expandir `apps/api/src/decisions/external-action-executor.ts`

20. **Rate limiting nas rotas**
    - Limitar chat a N msgs/min por usuário
    - Limitar DEV Executor a N execuções/h
    - Previne abuso de custo com Claude API
    - Arquivo: criar middleware `apps/api/src/middleware/rate-limit.ts`

21. **Diff visual no Notification Center**
    - Ações workspace.patch_file mostram diff colorido (verde/vermelho)
    - Ações de email mostram preview formatado
    - Arquivo: `apps/web/src/components/notifications/NotificationCenter.tsx`

22. **Testes automatizados (críticos)**
    - Action Queue: testar roteamento, aprovação, execução
    - DEV Executor: testar sandboxing, limites de path
    - Cognitive Loop: testar rate limiting, ciclos
    - Auth: testar proteção de rotas
    - Arquivo: criar `apps/api/tests/`

---

## COISAS QUE NÃO SÃO PRIORIDADE AGORA

- **Deploy (Vercel + Railway)** — foco em funcionalidades primeiro
- **Billing/Stripe** — só depois de validar com usuários reais
- **CI/CD** — depois do deploy
- **i18n** — pt-BR é o foco, inglês depois
- **Multi-tenant avançado** — depois do billing

---

## COMO TRABALHAR COM ESTE PLANO

1. Cada sprint pode ser feita em paralelo por módulo
2. Sempre rodar `npx tsc --noEmit` antes de considerar algo "pronto"
3. Priorizar o que o USUÁRIO sente (dashboard, mobile, chat UX) sobre backend invisível
4. Cada feature nova: tipo compartilhado + service + rota + hook + UI — tudo junto
5. Testar no navegador real — o sandbox não roda o app
