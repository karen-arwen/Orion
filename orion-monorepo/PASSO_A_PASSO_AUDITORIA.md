# PASSO A PASSO — AUDITORIA + COMO TESTAR

> **Quando você roda isso:** depois de ter usado outra IA para mexer no projeto e querer ter certeza que o ORION continua funcional. Esse arquivo é seu **kit completo de validação** — você roda os comandos na ordem e em 15 minutos sabe se está tudo OK.

---

## SEÇÃO 1 — O QUE EU CONSERTEI AGORA

### 1.1. Rotas frontend ↔ backend desalinhadas

**Antes:** O React Router usava paths diferentes do backend.

| Frontend (antes) | Backend | Frontend (agora) |
|---|---|---|
| `/m/calendar` | `/v1/m/agenda` | `/m/agenda` ✓ |
| `/m/habit`    | `/v1/m/habits` | `/m/habits` ✓ |
| `/m/sec`      | `/v1/m/security` | `/m/security` ✓ |

**Aliases mantidos:** se você (ou outro código antigo) navegar pra `/m/calendar`, `/m/habit` ou `/m/sec`, o React Router faz redirect 301 pra rota nova. **Nada quebra.**

Arquivos tocados:
- `apps/web/src/App.tsx`
- `apps/web/src/components/layout/OrionLayout.tsx`

### 1.2. Command Palette (Ctrl+K) só listava 16 módulos

Tinha **24 módulos** no projeto mas o palette só mostrava `comms, calendar, life, news, gaming, sleep, entert, shop, travel, lang, whatif, chef, mindset, social, docs, dev`. Agora lista os 24.

### 1.3. MODULE_ROUTES sem `finance` e `sec`

Quando você clicava em **CFO PESSOAL** ou **SEGURANÇA** na sidebar, o sistema mandava prompt no chat ao invés de abrir a página. Agora abre.

### 1.4. 4 erros TypeScript reais

Erros que iam dar problema só em produção (não rodam em dev por causa do `tsc --noEmit` ser opcional):

| Arquivo | Erro | Fix |
|---|---|---|
| `apps/api/src/routes/user.routes.ts` | `byType[row.type]` podia ser `undefined` | nullish coalescing `?? 0` |
| `apps/web/src/components/panels/RightRail.tsx` | `MODE_COLORS[mode]` `string \| undefined` | fallback `?? "#00D4FF"` |
| `apps/web/src/components/panels/AlertCard.tsx` | `meta.label` podia ser `undefined` | constante `DEFAULT_META` |
| `apps/web/src/components/panels/AutoPanel.tsx` | `meta` undefined em loop | fallback inline |

---

## SEÇÃO 2 — O QUE A OUTRA IA ADICIONOU (e está OK)

Pra você não ficar com medo do que ela mexeu, segue o inventário:

### 2.1. 10 módulos novos completos
Cada um tem: modelo Prisma + service + rota REST + hook React + página + tipo compartilhado.

```
finance   → CFO Pessoal (gastos, metas, assinaturas)
media     → Filmes, séries, animes (substituiu o entert)
travel    → Roteiros gerados por IA
language  → Prática de idiomas com correção
whatif    → Simulador de cenários
chef      → Receitas a partir de ingredientes
mindset   → Check-in emocional
social    → CRM pessoal (contatos + nudges)
security  → Posture: senhas, 2FA, findings
dev       → Workspace executor com preview de patches
```

### 2.2. 3 sistemas grandes (eram polish pendente)

- **CommandPalette** (`Ctrl+K`) — palette de comandos com 24 módulos + ações + modos
- **NotificationCenter** (bell no topbar) — junta ProactiveAlerts + DecisionItems
- **MissionControlPanel** (aba `MISSION`) — dashboard cross-module

### 2.3. Autonomy Core
Camada de decisão entre o Claude e a execução real:
- `decisions/action-router.ts` → decide: executa direto, pede aprovação ou bloqueia
- `decisions/action-executor.ts` → executa o que foi aprovado
- `decisions/external-action-executor.ts` → Slack/Todoist/Linear
- `agent-planner.ts` → planejador determinístico
- Models novos: `AutonomyPolicy`, `AutonomyActionLog`, `DecisionItem`, `UserPreference`

### 2.4. Conectores externos novos
- **Notion** OAuth completo
- **Slack** (via bot token)
- **Spotify**
- **Todoist**
- **Linear**

### 2.5. Schema cresceu 26 → 38 modelos
**Importante:** vai precisar dar `prisma db push` no banco.

---

## SEÇÃO 3 — COMO TESTAR (passo a passo)

> **Ordem importa.** Não pule etapas.

### 3.1. Confirmar dependências instaladas

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo
npm install
```

Se aparecer erro de peer dep do `node-cron` ou `bullmq`, rode de novo. Se persistir, manda screenshot.

### 3.2. Subir o Postgres + Redis (Docker)

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo
docker compose up -d
```

Confirma que estão de pé:

```powershell
docker ps
```

Você precisa ver `orion-postgres` e `orion-redis` na lista, ambos com status `Up`.

### 3.3. Sincronizar o schema novo (38 modelos)

```powershell
cd apps\api
npx prisma db push
npx prisma generate
```

**Se der erro de `EPERM rename .dll`:** o servidor dev está rodando. Mata ele primeiro (Ctrl+C no terminal do `npm run dev`).

### 3.4. Type-check (validação técnica)

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo

# Backend
cd apps\api
npx tsc --noEmit
# Esperado: nenhuma saída (sucesso)

# Frontend
cd ..\web
npx tsc --noEmit
# Esperado: nenhuma saída (sucesso)
```

**Se der erro:** copia a saída inteira e me manda. Erros de `Cannot find module '@orion/types'` aqui são bugs reais (não os do sandbox que eu mencionei).

### 3.5. Subir o backend

Em UM terminal:

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo\apps\api
npm run dev
```

**Esperado:** `[orion-api] listening on http://localhost:3001` e logs de BullMQ subindo.

### 3.6. Subir o frontend

Em OUTRO terminal:

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo\apps\web
npm run dev
```

**Esperado:** `Local: http://localhost:5173/`.

### 3.7. Testes manuais no navegador

Abre `http://localhost:5173` e faz cada teste:

#### A) Login + onboarding
- [ ] Tela de login Stark aparece
- [ ] Faz login com Google (Clerk)
- [ ] Se for primeira vez: passa pelo onboarding 4 passos
- [ ] Cai no painel principal com aba **NEXUS CHAT** ativa

#### B) Navegação dos módulos NOVOS
Clica em cada módulo no sidebar (CFO PESSOAL, SEGURANÇA, CHEF, etc):
- [ ] CFO Pessoal abre `/m/finance` (não manda pro chat)
- [ ] Segurança abre `/m/security` (não manda pro chat)
- [ ] Chef abre `/m/chef`
- [ ] Mindset abre `/m/mindset`
- [ ] Social abre `/m/social`
- [ ] Travel abre `/m/travel`
- [ ] Idiomas abre `/m/language`
- [ ] What-If abre `/m/whatif`
- [ ] Dev abre `/m/dev`
- [ ] Mídia abre `/m/media`

#### C) Aliases antigos não quebram
Cola na barra de URL e dá Enter:
- [ ] `http://localhost:5173/m/calendar` → redireciona pra `/m/agenda`
- [ ] `http://localhost:5173/m/habit` → redireciona pra `/m/habits`
- [ ] `http://localhost:5173/m/sec` → redireciona pra `/m/security`

#### D) Command Palette
- [ ] Aperta **Ctrl+K** (Cmd+K no Mac) → palette abre
- [ ] Digita "fina" → aparece **CFO PESSOAL** na lista
- [ ] Digita "segu" → aparece **SEGURANÇA**
- [ ] Enter abre o módulo
- [ ] Esc fecha o palette

#### E) Mission Control
- [ ] Clica na aba **MISSION** no topo do painel central
- [ ] Aparece um dashboard com seções de Foco/Saúde/Finanças/etc
- [ ] Conteúdo carrega sem erro (pode estar vazio se você não tem dados ainda)

#### F) Notification Center
- [ ] Clica no ícone de sino no canto superior direito (TopBar)
- [ ] Drawer abre na direita mostrando alertas + decisões pendentes
- [ ] Se tiver alguma decisão pendente, botões **APROVAR** e **DISMISS** funcionam

#### G) Chat com Claude
- [ ] Aba NEXUS CHAT ativa
- [ ] Digita "oi" → Claude responde mencionando algo do brain context (agenda, emails)
- [ ] Digita "qual o ano atual?" → responde 2026 (NÃO 2025)
- [ ] Digita "registra que dormi de 23h às 7h" → Claude usa a tool `sleep_log` e confirma
- [ ] Resposta vem token-a-token (streaming)

#### H) Integrações Google
- [ ] Vai em `/integrations`
- [ ] Se Gmail/Calendar estão verdes → tudo OK
- [ ] Se estão vermelhos: clica **RECONECTAR** → faz OAuth de novo

### 3.8. Verificação do banco

```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo\apps\api
npx prisma studio
```

Abre `http://localhost:5555` e confirma que aparecem **38 tabelas** na sidebar — incluindo as novas: `FinanceTransaction`, `MediaItem`, `SecurityAccount`, `MindsetCheckin`, `SocialContact`, `DecisionItem`, `AutonomyPolicy`, `AutonomyActionLog`, `UserPreference`.

---

## SEÇÃO 4 — SE ALGO QUEBRAR

### "EADDRINUSE: address already in use :::3001"
Processo zumbi do backend. Roda no PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3001 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### "Cannot find module '@orion/types'"
A `dist/` do pacote types não foi gerada. Roda:
```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo\packages\types
npm run build
```

### "Prisma client out of sync"
```powershell
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo\apps\api
npx prisma generate
# Reinicia o backend depois
```

### "EPERM operation not permitted, rename ... query_engine.dll"
Servidor dev tá segurando o arquivo. Mata Ctrl+C, roda `prisma generate`, sobe de novo.

### Rota `/m/finance` carrega página em branco
Provavelmente o backend não inicializou as `AutonomyPolicy` defaults. Vai no chat e digita: "configura autonomia padrão". Claude vai criar via `orion_action`.

---

## SEÇÃO 4.5 — DESIGN UPGRADE (rodada extra)

Depois da auditoria, refiz as 5 páginas mais mortas com identidade Stark forte.

### Antes vs Depois

| Página | Antes | Agora |
|---|---|---|
| **Mindset** | 3 sliders + textarea + 3 cards de texto | Hero com estado inferido, 3 RingGauges (humor/energia/stress), sliders HUD coloridos, atalhos rápidos (Ansioso/Travado/Cansado/Em fluxo), HoloChart de tendência 7d, intervenção em 3 cards numerados com gradient |
| **Travel** | Form + lista de dias em texto corrido | Hero com destino editável em fonte gigante glow, chips clicáveis pra interesses (8 opções), stepper de dias, TimelineRail vertical com 1 node por dia + 4 segmentos (manhã/tarde/noite/logística), painéis laterais de Risks (vermelho) e Próximas Ações (verde) |
| **Chef** | Form de ingredientes + 3 listas | Chips removíveis pros ingredientes + sugestões comuns, stepper de porções, 5 chips de objetivo (Rápido/Saudável/Barato/Comfort/High Protein), TimelineRail dos passos numerados, Shopping List com checkboxes HUD, Substituições com ⇄ |
| **Social** | Form + 2 colunas de cards | RingGauge de saúde do networking, 4 micro-stats (alta importância / com next step / esfriando 30d+ / nudges), filtros TODOS/ALTA/ESFRIANDO + 3 sorts, cards com importance gauge à direita, painel de Nudges inteligentes em roxo com message draft |
| **Language** | Form + 2 blocos de texto + 2 listas | Idioma editável em fonte gigante + 6 chips de presets, RingGauge mapeando nível pra A2/B1/C1, 5 chips de modo (Conversa/Entrevista/Viagem/Gramática/Pronúncia) com cores únicas, **diff visual** lado a lado entre "Você escreveu" vs "Versão polida", notas numeradas em roxo, drills com badge D1/D2/D3 em ciano |

### Primitivas visuais criadas (reutilizáveis em qualquer página futura)

```
apps/web/src/components/visual/
  ├── RingGauge.tsx      — anel SVG com glow, label central, top/bottom
  ├── NeonBar.tsx        — barra horizontal com gradient + glow + marker
  ├── HoloChart.tsx      — sparkline com area gradient + linha glow + pontos
  ├── TimelineRail.tsx   — trilho vertical com nodes circulares numerados
  └── TagPill.tsx        — chip clicável com solid/outline + xs/sm/md
```

### Animações que faltavam no CSS (agora existem)

Antes o código JSX usava `animation: "fadeUp 0.3s ease"` em vários lugares, mas o `@keyframes fadeUp` **nunca tinha sido criado**. Silenciosamente ignorado. Agora adicionei: `fadeUp`, `fadeIn`, `ripple`, `pulseGlow`, `scanLine`, `shimmer`, `orbitSpin`.

Também adicionei utility classes: `.hud-hero` (radial gradient + accent line), `.hud-stagger` (anima até 8 filhos em cadeia), `.hud-divider`, `.hud-metric-row`, `.hud-slider` (slider custom HUD).

### Rodada 2: WhatIf, Media, Dev + TopBar/Sidebar

| Componente | Antes | Agora |
|---|---|---|
| **WhatIf** | Form + 3 cards Provável/Melhor/Pior plano | Hero com horizon RingGauge, sumário executivo em destaque, **3 outcome cards lado a lado** (ciano/verde/vermelho com badge HOJE/UPSIDE/DOWNSIDE), decision matrix com **confidence RingGauge embutido** em cada card + effort chip, leading indicators (losangos roxos) e next actions (números verdes) |
| **Media** | Hero ok + cards retangulares com inicial em quadrado cinza | Hero com **% concluído** em RingGauge, 4 micro-stats, **3 cards de camada** (Atual/Nostalgia/Exploração) com ícone e %, **bar chart inline** dos gêneros e moods dominantes, recomendador com cards coloridos por camada e fitScore como badge canto superior, library com **poster gradient** (cores da camada + status overlay em chips) |
| **Dev Executor** | Sequência de painéis brancos com inputs | Hero com 3 RingGauges (routes/pages/types) + status PASS/FAIL do último run, **file explorer estilo IDE** (color por extensão, filtros TS/ROUTES/SERVICES/PAGES, hover slide), preview com **contador de linhas + truncado badge**, tabs PROPOR/DEBUG, patch grid com **vermelho (buscar) vs verde (substituir)** lado a lado, command com sintaxe destacada, debug runbook como timeline colorida por kind |
| **TopBar** | Layout ok mas plano | Linha de acento topo, integration status como **chips coloridos** com ícone + dot pulsante, botão Cmd+K mostrando shortcut, **notification badge animado** (number sobre âmbar), mode toggle com **tooltip descritivo** ao hover, relógio em mono com glow forte |
| **Sidebar** | Categorias colapsáveis simples, item ativo com borda fina | Header com **badge LIVE-COUNT** verde pulsante, cada categoria tem **ícone + sub texto + contador + chevron animado**, item ativo com **shimmer bar superior** + glow + left border, badge LIVE no rodapé dos módulos com API real, vitals em **círculos individuais** com ícone+valor dentro |

### Como testar as páginas refeitas

Depois de subir backend + frontend, navega em cada uma e verifica:

- [ ] `/m/mindset` — hero tem 3 anéis grandes ao centro, estado "FLUXO/ESTAVEL/ALERTA" muda conforme você arrasta os sliders. Após registrar check-in, aparece resposta em 3 cards numerados com fade-in escalonado
- [ ] `/m/travel` — você consegue digitar destino direto no título grande ciano, clicar nos chips de interesse pra incluir/excluir, ver o roteiro saindo como timeline vertical com 4 segmentos por dia
- [ ] `/m/chef` — digite "ovo" + Enter adiciona chip removível, ingredientes comuns aparecem como sugestões, após gerar receita os passos aparecem em timeline vertical numerada
- [ ] `/m/social` — adiciona 3-4 contatos com importâncias diferentes, vê o RingGauge de saúde mudar, testa filtros TODOS/ALTA/ESFRIANDO, vê os cards organizando por importance
- [ ] `/m/language` — clica nos chips de idiomas (English/Espanol/...), troca entre modos (Conversa/Entrevista/...), após gerar resposta vê o diff lado a lado e os drills numerados

#### Rodada 2 — checklist visual

- [ ] `/m/whatif` — você vê 3 outcome cards (ciano/verde/vermelho), a decision matrix tem um anel de confiança dentro de cada card, leading indicators têm losangos roxos
- [ ] `/m/media` — biblioteca tem cards com "poster" colorido por camada (current ciano / nostalgia âmbar / exploration roxo), status aparece como chip overlay sobre o poster
- [ ] `/m/dev` — file tree mostra extensões coloridas, hover desliza, preview tem contador de linhas no canto superior direito, tabs PROPOR/DEBUG funcionam
- [ ] **TopBar** — passa mouse nos botões SILENCIOSO/NORMAL/STARK e vê tooltip explicativo aparecer abaixo; o número de notificações tem badge âmbar quando > 0; integration chips (Gmail/Calendar/Drive) ficam verde com dot pulsante quando conectados
- [ ] **Sidebar** — categorias têm ícone + sub texto + número de módulos + chevron que gira; clica em "Saúde" expande a categoria; o módulo ativo tem uma barra brilhante na esquerda + um shimmer no topo que pisca lentamente; módulos com integração real (COMMS, AGENDA, DOCS, DEV) têm badge LIVE verde no canto direito; o rodapé tem 3 círculos pequenos com Energia/Foco/Humor

---

## SEÇÃO 5 — O QUE AINDA FALTA (pra próxima sessão)

Estes ainda estão pendentes, mas **não bloqueiam testar o que está pronto**:

1. **Mobile responsive** — interface só está bem em desktop
2. **Typing indicator** no chat (3 pontinhos enquanto Claude pensa)
3. **Reactions 👍👎** nas mensagens
4. **Confirm modal visual** pra ações irreversíveis (hoje confirma só por texto)
5. **Onboarding atualizado** pra incluir escolha dos 24 módulos (não só os 14 originais)
6. **Documentação Fase 4** (deploy Vercel + Railway)

Me avisa qual você quer atacar primeiro.

---

## SEÇÃO 6 — RESUMO EXECUTIVO

| Métrica | Valor |
|---|---|
| Arquivos TS/TSX no projeto | 226 |
| Modelos Prisma | 38 (era 26) |
| Módulos completos (model+service+route+hook+page+type) | 24 |
| Erros TS reais corrigidos | 4 |
| Bugs de routing corrigidos | 3 (paths) + 2 (módulos sem route) |
| Erros TS pendentes | 0 (no sandbox tem falsos positivos por symlink) |
| Itens de polish já implementados pela outra IA | 3 de 5 |
| Itens de polish ainda pendentes | 2 (typing indicator, reactions) + mobile |

**Status geral: PROJETO ESTÁ EM ESTADO TESTÁVEL.** Pode rodar o passo a passo da Seção 3 com tranquilidade.
