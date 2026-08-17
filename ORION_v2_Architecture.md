# O.R.I.O.N. v2 — AI Operating System Architecture

> "ORION is not an assistant. ORION is the operating system for your life."

## 1. System Layers

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  PWA · Mobile · Desktop Companion · Browser Extension   │
├─────────────────────────────────────────────────────────┤
│                   INTERFACE LAYER                       │
│  Command Center · Universal Search · Universal Inbox    │
│  Life Timeline · Notification Center · Dashboard        │
├─────────────────────────────────────────────────────────┤
│                  COGNITIVE LAYER                        │
│  Multi-LLM Router · Agent Swarm · Prediction Engine     │
│  Self-Reflection · Digital Twin · Context Engine        │
├─────────────────────────────────────────────────────────┤
│                   ENGINE LAYER                          │
│  Memory Engine · Knowledge Graph · Goal Engine          │
│  Quest Engine · Automation Engine · Workflow Engine      │
│  Decision Engine · Event Bus                            │
├─────────────────────────────────────────────────────────┤
│                   DOMAIN LAYER                          │
│  Finance · Health · Career · Education · Creator        │
│  Shopping · Travel · Social · Dev · Entertainment       │
│  Family · Pet · Legal · Business · Security             │
├─────────────────────────────────────────────────────────┤
│                 CONNECTOR LAYER                         │
│  OAuth · MCP · REST · WebSocket · Webhook               │
│  Google · Microsoft · GitHub · Slack · Discord · etc     │
├─────────────────────────────────────────────────────────┤
│                INFRASTRUCTURE LAYER                     │
│  PostgreSQL · Redis · S3 · Queue · Observability        │
│  Privacy · Billing · Auth · Admin · Multi-tenant        │
└─────────────────────────────────────────────────────────┘
```

## 2. Cognitive Core

### 2.1 Multi-LLM Router
Routes tasks to optimal model based on cost, latency, quality, privacy.

| Model | Best For | Cost | Latency |
|-------|----------|------|---------|
| Claude | Writing, reasoning, code, planning | $$ | Medium |
| GPT-4o | General, multimodal, tools | $$ | Medium |
| Gemini | Vision, video, large docs | $$ | Medium |
| DeepSeek | Code, math, technical reasoning | $ | Fast |
| Mistral | Quick summaries, low cost | $ | Fast |
| Local (Llama/Qwen) | Privacy, offline, fallback | Free | Varies |

Router considers: task_type, privacy_level, context_size, needs_vision, needs_tools, cost_budget, user_plan.

### 2.2 Agent Swarm
43 specialized agents, each with: objective, allowed_tools, autonomy_level, permissions, memory_access, cost_limit, timeout, confirmation_policy, logs, fallback.

Core agents: Orchestrator, Memory, Planning, Calendar, Email, Finance, Health, Learning, Career, Shopping, Travel, Research, Browser, Developer, Security, Social, Family, Creator, Business, Document, Meeting, Notification, Reflection, Risk, Opportunity, Coach.

### 2.3 Self-Reflection
Daily/Weekly/Monthly cycles:
- What did I learn about the user?
- Any preference changed?
- Any goal abandoned?
- Any habit at risk?
- Any spending anomaly?
- Any important person ignored?
- Any opportunity appeared?
- Any risk to alert?

Generates: DailyReflection, WeeklyReflection, MonthlyReflection, PatternInsight, RiskInsight, OpportunityInsight.

### 2.4 Self-Optimization
ORION suggests improvements to its own flows (new prompts, automations, shortcuts, workflows, reminders, routine changes, notification adjustments, response style changes). All pass through approval before becoming permanent rules.

## 3. Memory Engine 10x

15 memory types:
- Working Memory (current task context)
- Session Memory (current session)
- Conversation Memory (per conversation)
- Semantic Memory (facts, concepts)
- Episodic Memory (events, experiences)
- Pattern Memory (detected patterns)
- Preference Memory (user preferences)
- Relationship Memory (people connections)
- Entity Memory (things, places, orgs)
- Goal Memory (goals, milestones)
- Project Memory (project state)
- Life Memory (major life events)
- Archive Memory (old, low-relevance)
- Sensitive Memory (encrypted, restricted)
- Temporary Memory (TTL-based)

Each memory has: type, source, confidence, created_at, expires_at, permissions, sensitivity, embeddings, knowledge_graph_relations, user_editable.

Memory Center UI: view all, edit, delete, favorite, mark sensitive, export, trace origin.

## 4. Knowledge Graph

Entities: people, companies, projects, tasks, documents, emails, meetings, events, goals, habits, expenses, purchases, trips, courses, media, code, decisions, ideas.

Each entity connects to related entities. Visual graph explorer UI.

Example: "Project X" → connected to GitHub repo, Drive docs, Calendar meetings, Linear tasks, Slack conversations, Gmail threads, goals, decisions, responsible people.

## 5. Prediction Engine

Predicts risks: deadline miss, burnout, goal abandonment, budget overflow, missed commitment, productivity drop, bad sleep, impulse purchase, schedule conflict, unprepared exam, problematic trip, unnecessary subscription.

Predicts opportunities: best study time, best day for hard tasks, best purchase moment, best rest time, best job to apply, best person to contact, best content to review, optimal weekly routine.

## 6. Implementation Phases

### Phase 1 — Serious Foundation (Weeks 1-4)
- Real deploy (Vercel + Railway)
- CI/CD pipeline
- Test suite (unit + integration + e2e)
- Observability (Sentry + PostHog)
- Stripe billing complete
- PWA with real push notifications
- LGPD data export
- Mobile responsive
- Complete onboarding
- Fix embeddings (switch to Voyage AI or local)
- Audit logs
- Basic privacy center

### Phase 2 — Monster Brain (Weeks 5-10)
- Multi-LLM Router
- Agent Swarm foundation (10 core agents)
- Memory Center with 15 types
- Knowledge Graph (entities + relations)
- Universal Search
- Universal Inbox
- Prediction Engine
- Basic Digital Twin
- Morning Brief / Evening Review / Weekly Report
- "Ask My Life" feature
- Self-Reflection system
- Goal Engine with milestones

### Phase 3 — Autonomy (Weeks 11-16)
- Visual Automation Builder
- Browser Agent
- Meeting Agent (before/during/after)
- Document AI (PDF, DOCX, XLSX, images, OCR)
- Complete autonomy levels (7 levels)
- Workflow engine with logs + rollback
- Approval center
- Event bus
- Quest Engine / Gamification

### Phase 4 — Connector Ecosystem (Weeks 17-24)
- P0 connectors: Google, Microsoft, GitHub, Notion, Slack, Discord, Todoist, Stripe, Mercado Pago, Correios/17Track, OpenWeather, Maps, FlightAware, Spotify, YouTube, Figma, Canva
- P1 connectors: WhatsApp Business, Telegram, Linear, Jira, Open Finance, Amazon, Mercado Livre, Steam, Letterboxd, Instagram, TikTok, LinkedIn, Sentry
- P2 connectors: Health wearables, Smart Home, Car/Mobility

### Phase 5 — Marketplace & Scale (Weeks 25-32)
- Skill Marketplace
- Plugin Marketplace
- MCP Marketplace
- Public API + SDK
- Templates
- Community
- Multi-tenant / Enterprise features
- Family plan
- Team workspace

## 7. New Database Models (Phase 2 Priority)

```prisma
// === COGNITIVE CORE ===
model Agent {
  id            String   @id @default(cuid())
  name          String   @unique
  description   String
  objective     String
  allowedTools  String[]
  autonomyLevel Int      @default(3)
  costLimit     Float    @default(0.10)
  timeoutMs     Int      @default(30000)
  enabled       Boolean  @default(true)
  runs          AgentRun[]
}

model AgentRun {
  id          String   @id @default(cuid())
  agentId     String
  agent       Agent    @relation(fields: [agentId], references: [id])
  userId      String
  trigger     String
  input       Json
  output      Json?
  toolCalls   Json[]
  tokensUsed  Int      @default(0)
  costUsd     Float    @default(0)
  durationMs  Int      @default(0)
  status      String   @default("running")
  error       String?
  createdAt   DateTime @default(now())
}

model AiProvider {
  id        String    @id @default(cuid())
  name      String    @unique
  baseUrl   String
  apiKey    String
  enabled   Boolean   @default(true)
  models    AiModel[]
}

model AiModel {
  id           String     @id @default(cuid())
  providerId   String
  provider     AiProvider @relation(fields: [providerId], references: [id])
  name         String
  displayName  String
  maxTokens    Int
  costPer1kIn  Float
  costPer1kOut Float
  supportsVision  Boolean @default(false)
  supportsTools   Boolean @default(false)
  latencyMs       Int     @default(2000)
  qualityScore    Int     @default(7)
  bestFor      String[]
  enabled      Boolean  @default(true)
}

model AiRoutingRule {
  id          String @id @default(cuid())
  taskType    String
  modelId     String
  priority    Int    @default(0)
  conditions  Json?
  enabled     Boolean @default(true)
}

model AiUsageLog {
  id         String   @id @default(cuid())
  userId     String
  modelId    String
  tokensIn   Int
  tokensOut  Int
  costUsd    Float
  durationMs Int
  taskType   String
  createdAt  DateTime @default(now())
}

// === KNOWLEDGE GRAPH ===
model KGEntity {
  id         String   @id @default(cuid())
  userId     String
  type       String
  name       String
  metadata   Json?
  embedding  Float[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  edgesFrom  KGEdge[] @relation("from")
  edgesTo    KGEdge[] @relation("to")
}

model KGEdge {
  id         String   @id @default(cuid())
  fromId     String
  from       KGEntity @relation("from", fields: [fromId], references: [id])
  toId       String
  to         KGEntity @relation("to", fields: [toId], references: [id])
  relation   String
  weight     Float    @default(1.0)
  metadata   Json?
  createdAt  DateTime @default(now())
}

// === GOAL ENGINE ===
model Goal {
  id           String    @id @default(cuid())
  userId       String
  title        String
  reason       String?
  category     String
  priority     Int       @default(5)
  deadline     DateTime?
  metric       String?
  targetValue  Float?
  currentValue Float     @default(0)
  status       String    @default("active")
  progress     Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  milestones   GoalMilestone[]
}

model GoalMilestone {
  id         String   @id @default(cuid())
  goalId     String
  goal       Goal     @relation(fields: [goalId], references: [id])
  title      String
  completed  Boolean  @default(false)
  dueAt      DateTime?
  order      Int      @default(0)
}

// === PREDICTION ENGINE ===
model Prediction {
  id          String   @id @default(cuid())
  userId      String
  type        String
  title       String
  description String
  probability Float
  impact      String
  signals     Json[]
  suggestion  String?
  status      String   @default("active")
  outcome     String?
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
}

// === QUEST ENGINE ===
model Quest {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String
  category    String
  xpReward    Int      @default(100)
  steps       Json[]
  completed   Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Achievement {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String
  icon        String
  rarity      String   @default("common")
  unlockedAt  DateTime @default(now())
}

model XPEvent {
  id        String   @id @default(cuid())
  userId    String
  amount    Int
  source    String
  detail    String?
  createdAt DateTime @default(now())
}

// === UNIVERSAL INBOX ===
model UniversalInboxItem {
  id         String   @id @default(cuid())
  userId     String
  source     String
  sourceId   String?
  type       String
  title      String
  preview    String?
  sender     String?
  urgency    String   @default("normal")
  category   String   @default("uncategorized")
  status     String   @default("unread")
  actionable Boolean  @default(false)
  metadata   Json?
  createdAt  DateTime @default(now())
  readAt     DateTime?
  archivedAt DateTime?
}

// === WORKFLOW ENGINE ===
model Workflow {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  trigger     Json
  steps       Json[]
  enabled     Boolean  @default(true)
  runs        WorkflowRun[]
  createdAt   DateTime @default(now())
}

model WorkflowRun {
  id         String   @id @default(cuid())
  workflowId String
  workflow   Workflow  @relation(fields: [workflowId], references: [id])
  status     String   @default("running")
  steps      Json[]
  error      String?
  startedAt  DateTime @default(now())
  finishedAt DateTime?
}

// === SELF REFLECTION ===
model Reflection {
  id         String   @id @default(cuid())
  userId     String
  type       String
  period     String
  insights   Json[]
  risks      Json[]
  opportunities Json[]
  suggestions Json[]
  createdAt  DateTime @default(now())
}

// === NOTIFICATIONS ===
model Notification {
  id         String   @id @default(cuid())
  userId     String
  title      String
  body       String
  channel    String   @default("push")
  priority   String   @default("normal")
  groupKey   String?
  actionUrl  String?
  read       Boolean  @default(false)
  delivered  Boolean  @default(false)
  createdAt  DateTime @default(now())
  readAt     DateTime?
}

// === AUDIT & PRIVACY ===
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  resource  String
  detail    Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
}

model ConsentLog {
  id        String   @id @default(cuid())
  userId    String
  scope     String
  granted   Boolean
  createdAt DateTime @default(now())
}

// === LIFE TIMELINE ===
model LifeTimelineEvent {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  detail    String?
  date      DateTime
  module    String?
  entityId  String?
  metadata  Json?
  createdAt DateTime @default(now())
}

// === DIGITAL TWIN ===
model DigitalTwinProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  peakHours         Json?
  lowHours          Json?
  procrastination   Json?
  spendingPatterns  Json?
  sleepPatterns     Json?
  studyPatterns     Json?
  emotionalPatterns Json?
  communicationStyle Json?
  values            String[]
  limitations       String[]
  updatedAt         DateTime @updatedAt
}
```

## 8. Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Primary LLM | Claude | Best reasoning, tools, code |
| Fallback LLM | GPT-4o mini | Cost-effective, good quality |
| Embeddings | Voyage AI | Better than OpenAI, cheaper |
| Vector DB | pgvector | Already on PostgreSQL |
| Queue | BullMQ + Redis | Already have Redis |
| Real-time | SSE + Redis PubSub | Simple, proven |
| File storage | S3/R2 | Cheap, scalable |
| Search | PostgreSQL FTS + embeddings | Good enough, no extra infra |
| Auth | Clerk | Already integrated |
| Billing | Stripe | Industry standard |
| Monitoring | Sentry + PostHog | Errors + analytics |
| Deploy | Vercel + Railway | Already planned |

