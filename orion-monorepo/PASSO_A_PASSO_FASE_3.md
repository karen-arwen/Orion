# O.R.I.O.N — Fase 2 (leva 3) · Guia da rodada

> Esta leva implementou: **streaming token-a-token no chat** (Tarefa 7 parcial),
> **4 módulos novos** (CRIAÇÃO, GAMING, RADAR, SLEEP COACH — total agora: 13/26),
> e o **onboarding completo de 4 passos** (Tarefa 6).

---

## Resumo do que ficou pronto

### Streaming SSE no chat (Tarefa 7 parcial)
- Backend: `POST /v1/chat/stream` usa `anthropic.messages.stream()` e emite eventos SSE token-a-token.
- Se Claude precisar de **ferramenta** (gmail, calendar, etc), o stream aborta e emite `fallback_to_tools`.
- Frontend: o store de chat (`chat.store.ts`) tenta primeiro o stream; se cair fallback, refaz via `POST /v1/chat` normal (que tem tool loop).
- Você vê o texto chegando **letra a letra**, igual ChatGPT. Sensação de "vivo".

### Módulo CRIAÇÃO (✦)
- **Kanban de ideias** com 4 colunas (Ideia / Rascunho / Agendado / Publicado).
- **Gerador IA**: escolhe nicho + audiência → 5 ideias variadas geradas e salvas como "Ideia".
- Criação manual + edição inline + mover entre colunas.
- Rotas: `GET/POST/PATCH/DELETE /v1/m/creative` + `POST /v1/m/creative/generate`.

### Módulo GAMING (▣)
- Busca no **RAWG** (já tinha tool, agora tem UI dedicada com capa).
- Shelf com 4 status (Quer Jogar / Jogando / Zerou / Dropped) — move entre eles com select.
- Rotas: `GET/POST/PATCH/DELETE /v1/m/gaming` + `GET /v1/m/gaming/search`.

### Módulo RADAR (◌)
- Busca via **Brave Search** com filtro de recência (24h / semana / mês).
- 6 quick-topics pré-prontos (tech, vagas dev, jogos, anime, design, IA).
- Salvar item pra ler depois, marcar como lido, remover.
- Rotas: `POST /v1/m/news/search`, `POST /v1/m/news/save`, `GET /v1/m/news/saved`, etc.

### Módulo SLEEP COACH (☽)
- Log de sono com **hora de dormir + hora de acordar + qualidade 1-5 + notas**.
- 3 cards de stats: **Duração média** · **Qualidade** · **Consistência** (calculada como inverso do stddev do horário de dormir).
- Histórico dos últimos 14 dias com badge ★ por qualidade.
- Rotas: `POST /v1/m/sleep/log`, `GET /v1/m/sleep/recent`, `GET /v1/m/sleep/stats`.

### Onboarding (Tarefa 6)
- Página `/onboarding` com 4 passos:
  1. **Modo operacional** — SILENCIOSO / NORMAL / STARK
  2. **Área foco** — 6 cards de módulo principal
  3. **Perfil** — área de trabalho + chips de hobbies (15 pré-prontos)
  4. **Objetivo do mês** — texto livre
- Salva `mode`, ativa módulo principal, escreve `bio` rica no `UserProfile`, semeia memórias de longo prazo (workArea, hobbies, goal — tudo com `embedding`).
- `App.tsx` tem `OnboardingGate` que verifica `/v1/onboarding/status` e redireciona quem não completou.

---

## Como rodar essa leva

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo
npm run db:push  # cria ContentIdea, GameEntry, NewsItem, SleepLog, WishlistItem
# Ctrl+C no npm run dev, depois:
npm run dev
```

**Vai aparecer no log do boot:**
```
◉ O.R.I.O.N · API ONLINE
◉ Redis conectado
◉ Scheduler ativo · Morning Brief 8:00 seg-sex (BRT)
◉ BullMQ workers ativos: automation, alert, memory
◉ BullMQ repeating jobs registrados: detect_alerts (1h), expire_alerts (15min)
◉ Re-hidratados N repeating jobs de automations
```

---

## Como testar

### Streaming
1. Vai no chat principal e manda algo simples: `"me explica o conceito de débito técnico"`.
2. A resposta deve aparecer **token-a-token** (palavra por palavra), não em bloco único depois de 5 segundos.

### Onboarding
- Se você é o usuário antigo e já tem `onboardedAt` no banco, **não vai aparecer**.
- Pra testar: cria nova conta Clerk (com outro Google), faz login → cai direto no `/onboarding`.
- Ou no Prisma Studio (`npm run db:studio`), abre tabela `UserProfile`, apaga o `onboardedAt` do seu usuário, recarrega o app.

### CRIAÇÃO
- Sidebar → **CRIAÇÃO** → seleciona nicho → **+ GERAR 5 IDEIAS**.
- Tenta movimentar pelo kanban: clica em "→ RASCUNHO" no card.

### GAMING
- Sidebar → **GAMING** → busca "hollow knight silksong" (ou qualquer jogo) → adiciona à wishlist com **+ WISHLIST**.
- Muda status pelo select.

### RADAR
- Sidebar → **RADAR** → clica num quick-topic ("vagas dev brasil") ou digita algo.
- Salva 2 items, vai pra aba **SALVOS**, abre eles.

### SLEEP
- Sidebar → **SLEEP COACH** → registra 2-3 noites com horários e qualidade.
- Stats aparecem no topo: duração, qualidade, consistência.

---

## Status oficial Fase 2

| # | Tarefa | Status |
| - | --- | --- |
| 1 | Memória 3 camadas | ✅ |
| 2 | Motor Automações + BullMQ | ✅ |
| 3 | Alertas Proativos | ✅ |
| 4 | Drive + DOCS | ✅ |
| 5 | 10 módulos novos — **7/10** (Saúde, Foco, Hábitos, Criação, Gaming, Radar, Sleep) | ⏳ faltam Travel, Compras, Idiomas |
| 6 | Onboarding 4 passos | ✅ |
| 7 | UX avançado — **streaming ✅**, falta Command Palette + Action Cards + Notification Center | ⏳ parcial |
| 8 | Módulos extras (What-If, Mindset, Chef, Social) | ⏳ |

---

## Próxima leva sugerida (na ordem que faz mais sentido)

**Opção A — "Polish UX"** (entrega visível imediata):
- Command Palette (Cmd+K)
- Action Cards (cards de confirmação no chat)
- Notification Center (sino com histórico de alertas)
- Mobile responsive
- Message reactions (👍👎)

**Opção B — "Fechar Tarefa 5"** (mais 3 módulos pra completar os 10):
- TRAVEL (planejador de viagem com IA — sem Booking, só geração de roteiro)
- COMPRAS (wishlist com preço target manual + alerta quando você editar)
- IDIOMAS (prática diária com Claude em inglês)

**Opção C — "Tarefa 8 inteira"** (módulos extras):
- WHAT-IF (simulador de cenários)
- MINDSET COACH (check-in diário de humor)
- CHEF (receitas com IA)
- SOCIAL (CRM pessoal)

Me chama com a letra: **"vai pela A"**, **"vai pela B"**, **"vai pela C"**.

---

## APIs adicionais que destravariam mais (opcionais)

| API | Pra quê | Free? |
| --- | --- | --- |
| **GitHub Personal Access Token** | GitHub Nudge real (3d sem commit) + auto-import de projetos | ✅ |
| **Spotify Web API** | Rotina Noturna sugerir playlist real + módulo MÚSICA | ✅ (com OAuth) |
| **OpenWeather** | Clima no Morning Brief | ✅ 1000/dia |
| **Notion API** | Sync de tasks/projetos com Notion | ✅ |
| **Discord webhook** | Notificações fora do app | ✅ |
| **Twilio (SMS)** | Alertas críticos por SMS | 💸 ~$0.0075/sms |

Me manda qualquer chave que conseguir e eu plugo.
