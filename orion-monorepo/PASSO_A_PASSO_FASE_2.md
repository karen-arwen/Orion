# O.R.I.O.N — Fase 2 (parte 1) · Guia de ativação

> Esta leva entregou: **date awareness** reforçado, **professor 2.0** com material estruturado + histórico persistente, **trends culturais** (TMDB + RAWG), e a **Tarefa 1 da Fase 2 completa** (memória persistente em 3 camadas com busca semântica).
>
> Tarefas 2 a 8 (automações Bull MQ, alertas inteligentes, Drive completo, 10 módulos novos, onboarding, streaming, módulos extras) ficam pras próximas sessões na ordem que você definiu.

---

## O que mudou no produto

| Pedido seu | Status | Como testar |
| --- | --- | --- |
| Não confundir o ano em eventos | ✅ | Pede "marca reunião amanhã 14h" — vai criar no ano correto. Se mesmo assim mandar passado, o backend rejeita com erro claro pro Claude corrigir. |
| Professor que monta aula com material | ✅ | Vai em **CONHECIMENTO**, digita `"monta uma aula sobre cálculo diferencial nível iniciante"`. Material estruturado (objetivos, tópicos, exemplos, exercícios). Salvo no banco. |
| Histórico das aulas | ✅ | Aba **MINHAS AULAS** lista tudo. Clica → abre material + área pra perguntar dúvidas que ficam gravadas. |
| Tendências (filmes/séries/jogos/lançamentos) | ✅ | Pergunta `"o que tá bombando hoje em filmes?"`, `"jogos que vão lançar nesse mês"`, `"séries pra maratonar"`. |
| Memória persistente | ✅ | Em conversas separadas: fala "minha cachorra se chama Cindy". Depois pergunta em sessão nova "lembra do nome da minha cachorra?" |

---

## FASE 0 — Atualizar o ambiente (1 vez, ~3 min)

### [ ] 0.1 — Instalar deps novas + aplicar migrations

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo

# Resolve o erro do node-cron que tá te bloqueando + traz tudo da Fase 2
npm install

# Cria os novos models: LessonSession, LessonMessage, UserPattern, Task (se ainda não criou)
npm run db:push
```

Se o `db:push` perguntar algo, dá **Y**.

### [ ] 0.2 — Reinicia o dev

```powershell
# Ctrl+C no terminal do npm run dev (se estiver rodando)
npm run dev
```

---

## FASE 1 — Tendências culturais (opcional, ~5 min)

> **Sem essas chaves**, o O.R.I.O.N. continua funcionando — só não responde sobre filmes/jogos atuais. Com elas, ele vira um Letterboxd+RAWG+Jarvis fundido.

### [ ] 1.1 — TMDB (filmes e séries) — FREE

1. https://www.themoviedb.org → cria conta gratuita
2. Login → ícone do perfil → **Settings** → **API**
3. Clica em **Request an API Key** → escolhe **Developer** → preenche o formulário (qualquer descrição honesta serve: "personal life assistant project")
4. Aprovação **automática** em segundos
5. Copia a **API Key (v3 auth)** — começa com algo tipo `8a7bc...`

### [ ] 1.2 — RAWG (jogos) — FREE

1. https://rawg.io/apidocs → cria conta gratuita
2. Vai em https://rawg.io/apikey → copia a chave

### [ ] 1.3 — Cola no `.env`

Abre `apps/api/.env` e adiciona no final:

```env
TMDB_API_KEY="cola_a_tmdb_aqui"
RAWG_API_KEY="cola_a_rawg_aqui"
```

Restart o `npm run dev`. Pronto. Agora pergunta no chat:
- `"filmes em alta esta semana"`
- `"o que tá bombando em séries hoje?"`
- `"jogos lançando nos próximos 2 meses"`
- `"busca o jogo Hollow Knight Silksong"`

---

## FASE 2 — Memória semântica (opcional mas RECOMENDADO, ~5 min)

> O sistema funciona sem isso (cai pra ranking por importância — ainda lembra das memórias mais marcantes). Com OpenAI ativado, a busca de memória vira **semântica** — ele acha memórias *relacionadas* mesmo quando você fala com palavras diferentes.
>
> Custo real: ~**$0.02 por 1M tokens** = praticamente nada. Você gastaria centavos por mês de uso normal.

### [ ] 2.1 — OpenAI API key

1. https://platform.openai.com → Sign up (pode usar Google)
2. Adiciona **$5 de crédito** (Billing → Add payment method)
3. https://platform.openai.com/api-keys → **Create new secret key**
4. Copia (começa com `sk-proj-...` ou `sk-...`)

### [ ] 2.2 — Cola no `.env`

Em `apps/api/.env`:

```env
OPENAI_API_KEY="sk-...cola_aqui"
```

Restart. Pronto. Agora cada memória nova é vetorizada e a busca fica relacionada por significado.

---

## FASE 3 — Confiar que tá funcionando (~3 min)

Roteiro de teste rápido pra validar tudo:

### [ ] 3.1 — Date awareness
No chat: `"marca uma reunião amanhã às 15h chamada teste de data"`.
- Deve criar evento amanhã no ano correto. Se o ano sair errado, o backend rejeita e o Claude corrige.

### [ ] 3.2 — Professor 2.0
Vai em **CONHECIMENTO** → aba **PERGUNTAR** → digita:
`"monta uma aula sobre tarot pra iniciantes"`
- Vai aparecer um material estruturado com objetivos, tópicos, exemplos, exercícios (com gabarito clicável).
- Vai em **MINHAS AULAS** — a aula está lá.
- Abre ela → faz uma pergunta de aprofundamento → fica gravada no histórico.

### [ ] 3.3 — Trends
No chat: `"o que tá bombando em filmes esta semana?"`
- Lista top 10 com sinopse e nota. Se a chave TMDB não estiver configurada, ele te diz isso (não inventa).

### [ ] 3.4 — Memória semântica
Sessão 1: `"tenho duas cachorras, Cindy e Galadriel"`
Sessão 2 (nova): `"você lembra dos meus pets?"`
- Ele deve responder com os nomes. A extração roda em background depois da primeira mensagem.

---

---

## FASE 4 — Motor de Automações + Alertas Proativos (Tarefas 2 e 3)

Esta segunda leva implementou **TUDO** da Tarefa 2 e Tarefa 3 do roadmap.

### O que ganhou

**Backend — Motor de Automações (Tarefa 2):**
- Schema estendido: `Automation` (description, conditions, requiresConfirmation, confirmationTimeout, templateKey) + `AutomationLog` (userResponse, executionMs) + `ProactiveAlert` (priority, approved, expiresAt, dedupKey)
- **BullMQ** rodando em 3 queues (automation, alert, memory) com retry exponencial + dead-letter
- **Engine** que aplica `conditions` (modo, hora, cooldown), executa actions (`generate_brief`, `send_alert`, `chat_message`), cria alerta de confirmação quando exigido
- **7 automações pré-configuradas** plantadas automaticamente no primeiro login:
  - Morning Brief (cron 8h seg-sex)
  - Rotina Noturna (cron 22:30 diário)
  - Content Planner (cron 10h seg/qua/sex)
  - GitHub Nudge (behavioral — precisa GITHUB_TOKEN futuro)
  - Energy Check (cron 16h seg-sex)
  - Modo Foco (manual, com confirmação)
  - Deal Watch (event, com confirmação — depende de módulo COMPRAS futuro)
- Re-hidratação no boot: se o servidor reinicia, todos os repeating jobs voltam pro Redis

**Backend — Alertas Proativos (Tarefa 3):**
- **Detector horário** (BullMQ cron `0 * * * *`) que escaneia todos usuários:
  - Emails não respondidos >48h (Gmail real)
  - Eventos amanhã com convidados (Calendar real)
  - Tasks vencidas (Life OS)
  - Projetos parados >7 dias
- **Expiração automática** a cada 15min (cron BullMQ `*/15 * * * *`)
- **Regras de exibição por modo**: SILENCIOSO=só high+critical, NORMAL=med+, STARK=tudo
- **Cap em 5 alertas visíveis** por usuário, ordenados por prioridade
- **Dedup** via `dedupKey` — não cria o mesmo alerta repetido

**Frontend:**
- `AutoPanel` reescrito: lista automations reais do banco, toggle on/off, dispara agora, deleta, mostra última execução, badge de tipo de trigger
- Botão "INSTALAR 7 PRÉ-CONFIG" pra usuários antigos que não pegaram o seed automático
- `AlertCard` reformulado com badge de prioridade (LOW/MED/HIGH/CRIT) e glow visual em alta prioridade
- Right Rail respeita filtragem por modo

### Como rodar

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo
npm install     # traz bullmq
npm run db:push # adiciona campos novos em Automation, AutomationLog, ProactiveAlert
# Ctrl+C no npm run dev e roda npm run dev
```

No log do boot vai aparecer:
```
◉ O.R.I.O.N · API ONLINE
◉ Redis conectado
◉ Scheduler ativo · Morning Brief 8:00 seg-sex (BRT)
◉ BullMQ workers ativos: automation, alert, memory
◉ BullMQ repeating jobs registrados: detect_alerts (1h), expire_alerts (15min)
◉ Re-hidratados N repeating jobs de automations
```

### Como testar

**Automações:**
1. Vai em `localhost:5173`, abre a aba **AUTOMAÇÕES**
2. Se aparecer "Você ainda não tem automações" → clica em **+ INSTALAR 7 PRÉ-CONFIG** (só pra usuários que existiam antes; novos usuários já recebem automaticamente no primeiro login)
3. Pra cada automação você pode:
   - **✓ ATIVA / ○ DESATIVADA** — toggle no banco + atualiza repeating job
   - **▷ DISPARAR AGORA** — executa imediatamente, ignora conditions
   - **×** — apaga + remove o repeating job

**Alertas proativos:**
- O detector roda toda hora cheia. Pra forçar agora, no PowerShell:
  ```powershell
  cd apps\api
  npx tsx -e "import('./src/alerts/detector.js').then(m => m.detectForAllUsers()).then(console.log)"
  ```
- Os alertas aparecem na sidebar direita do painel principal, ordenados por prioridade (CRIT no topo)
- **Modo SILENCIOSO** filtra pra mostrar só HIGH/CRIT — testa trocando no top bar
- Cada alerta tem **ATIVAR** (dispara a `action` no chat) ou **×** (descarta — feedback negativo implícito)

### APIs adicionais que podem destravar mais coisa

Sem essas, o sistema funciona mas algumas automações ficam mudas:

- **GitHub Personal Access Token** — destrava GitHub Nudge real (3 dias sem commit dispara alerta)
  1. https://github.com/settings/tokens → **Generate new token (classic)**
  2. Scopes: `repo` + `read:user`
  3. Cola em `apps/api/.env`: `GITHUB_TOKEN="ghp_..."`
- **Spotify** — pra Rotina Noturna sugerir playlist real (Fase 3+)
- **OpenWeather** (free) — clima no Morning Brief (Fase 3+)
- **News API ou GDELT** — pro módulo RADAR (Tarefa 5 ainda não implementada)

---

## Mapa do que ainda vem na Fase 2 (próximas sessões)

**Status oficial Fase 2:**

| # | Tarefa | Status |
| - | --- | --- |
| 1 | Memória persistente 3 camadas | ✅ |
| 2 | Motor de automações Bull MQ + 7 pré-config | ✅ |
| 3 | Sistema de alertas proativos com detecção horária | ✅ |
| 4 | Google Drive + módulo DOCS (análise estruturada) | ✅ |
| 5 | 10 módulos novos — **3 de 10 entregues** (SAÚDE, FOCO, HÁBITOS) | ⏳ 6-7 restantes |
| 6 | Onboarding 4 passos + multi-user com rate limit | ⏳ |
| 7 | UX avançado (streaming SSE, action cards, command palette, atalhos) | ⏳ |
| 8 | Módulos extras (What-If, Mindset, Chef, Social) | ⏳ |

## FASE 5 — DOCS + Saúde + Foco + Hábitos (esta leva)

### Tarefa 4 — Módulo DOCS

**Backend:**
- `docs.service.ts` com `analyzeText`, `analyzeDriveDoc`, `listRecentDriveFiles`
- Saída JSON estruturada: `summary` + `risks[level]` + `actions[]` + `questions[]` + `category`
- 3 rotas: `POST /m/docs/analyze` (texto colado), `POST /m/docs/analyze-drive` (fileId), `GET /m/docs/recent`

**Frontend:**
- Página `DocsPage` com 2 abas: **COLAR TEXTO** | **DRIVE**
- `DocAnalysisCard` visual com 4 blocos coloridos (resumo, riscos, ações, perguntas)
- Risks com badge LOW/MED/ALTO colorido

**Teste:** vai em `/m/docs`, cola um contrato/email/relatório longo, clica ANALISAR. Resultado em ~5s com análise estruturada.

### Tarefa 5 [parcial] — 3 dos 10 módulos novos

**SAÚDE (♡):**
- Prisma `EnergyLog`. Service + 3 rotas: log, today, heatmap
- UI: registrador 1-10 + lista do dia + **heatmap 7×24** (dias × horas) com detecção automática de horário de energia baixa
- Tenta em `/m/health` — registra alguns pontos ao longo do dia e o heatmap se preenche

**FOCO (◐):**
- Prisma `FocusSession`. Service: start/complete/interrupt + today + weekly stats
- UI: timer SVG circular animado de 220px com glow + presets (15/25/45/60/90min) + histórico do dia + gráfico semanal
- Em `/m/focus`: escolhe duração → INICIAR → ring preenche → ✓ COMPLETEI ou × INTERROMPER

**HÁBITOS (✓):**
- Prisma `Habit` + `HabitLog`. Service com cálculo de streak automático ao marcar/desmarcar
- UI: criação com seletor de cor e ícone + **heatmap 30 dias estilo GitHub** por hábito + streak counter + recorde pessoal
- Em `/m/habit`: cria hábito → MARCAR HOJE → bolinha colorida acende no heatmap

### Como rodar essa leva

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo
npm run db:push  # cria EnergyLog, FocusSession, Habit, HabitLog
# Ctrl+C no npm run dev, depois:
npm run dev
```

Clica nos módulos da sidebar esquerda: **DOCUMENTOS**, **SAÚDE**, **FOCO**, **HÁBITOS** — todos navegam pra suas páginas dedicadas agora.

> **Sobre Instagram:** intencionalmente fora do escopo desta leva. A Instagram Graph API exige criar Meta Developer App e processo de aprovação (alguns dias). Quando você quiser ir nessa, abre sessão dedicada — vou implementar OAuth do Meta + tools de leitura/publicação.

---

## Saída do log que vai mostrar tudo certo

Depois do `npm run dev`, você deve ver:

```
◉ O.R.I.O.N · API ONLINE
◉ Redis conectado
◉ Scheduler ativo · Morning Brief 8:00 seg-sex (BRT)
```

Quando mandar uma mensagem, o log mostra coisas tipo:
```
[orion] 1 tool call(s): trends_movies✓
[memory] +2 pra cmp7... : [fact] tem duas cachorras, Cindy e Galadriel... | [preference] gosta de tarot...
POST /v1/chat 200 4827ms
```

Se aparecer warning `[memory:long] falhou` ou `[embeddings] OpenAI 401`, é a chave que tá errada ou faltando — sistema continua funcionando, só sem busca semântica.

---

## Conta de novo o que mudou (resumo executivo)

**Backend:** novos arquivos em `apps/api/src/`:
- `ai/system-prompt.ts` — bloco DATA ATUAL bordado no topo
- `ai/tools.ts` — calendar_create valida ano + tools de trends adicionadas
- `embeddings/openai.ts` — cliente embeddings com fallback gracioso
- `integrations/trends.ts` — TMDB + RAWG
- `memory/long-term.service.ts` — busca semântica por cosine
- `memory/mid-term.service.ts` — patterns de uso
- `memory/memory-extractor.ts` — agora gera embeddings ao salvar
- `modules/know.service.ts` — modo PROFESSOR estruturado
- `routes/m/know.routes.ts` — endpoints de lições

**Frontend:** página `CONHECIMENTO` reescrita com tabs PERGUNTAR / MINHAS AULAS, material estruturado visual e detalhe de aula com perguntas de aprofundamento.

**Schema:** 3 modelos novos — `LessonSession`, `LessonMessage`, `UserPattern`.

**Dependências novas:** nenhuma além das já listadas (OpenAI/TMDB/RAWG via fetch nativo).

Karen, é isso. Quando estiver pronta pra próxima leva, me chama: **"Fase 2 tarefa 2 — motor de automações"**.
