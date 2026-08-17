# ORION — Guia de Setup OAuth (Copy-Paste Ready)

> Cada conector tem o passo a passo com URLs exatas e os valores para colar no `.env`.
> Substitua `SEU_DOMINIO` pelo domínio em produção (ou `localhost:3001` para dev).

---

## CONECTORES IMPLEMENTADOS (Google já está pronto)

### ✅ GOOGLE (Gmail + Calendar + Drive)
Já configurado. Ver `API_KEYS_PASSO_A_PASSO.md`.

---

## TIER 1 — Alta prioridade (cobre a maioria dos usuários)

### 🔷 MICROSOFT (Outlook + Teams + OneDrive)
**Cobre:** usuários corporativos, quem usa Office 365, Teams ao invés de Slack.

**1. Criar app:**
→ Acesse: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
→ Clique "New registration"
→ Nome: `ORION`
→ Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
→ Redirect URI: `Web` → `http://localhost:3001/v1/integrations/microsoft/callback`
→ Clique "Register"

**2. Copiar credenciais:**
→ Na página do app: copie **Application (client) ID**
→ Certificates & secrets → New client secret → Descrição: `orion-prod` → 24 months → copie o **Value**

**3. Permissões (API permissions → Add a permission → Microsoft Graph → Delegated):**
```
Mail.ReadWrite
Mail.Send
Calendars.ReadWrite
Files.ReadWrite
Chat.Read
User.Read
offline_access
```
→ Clique "Grant admin consent for..." (se disponível) ou o usuário aprova no primeiro login

**4. Colar no `.env`:**
```env
MICROSOFT_CLIENT_ID=cole_o_application_id_aqui
MICROSOFT_CLIENT_SECRET=cole_o_secret_value_aqui
MICROSOFT_REDIRECT_URI=http://localhost:3001/v1/integrations/microsoft/callback
```

---

### 🐙 GITHUB
**Cobre:** devs, open source, projetos pessoais e profissionais.

**1. Criar app:**
→ Acesse: https://github.com/settings/developers
→ "OAuth Apps" → "New OAuth App"
→ Application name: `ORION`
→ Homepage URL: `http://localhost:5173`
→ Authorization callback URL: `http://localhost:3001/v1/integrations/github/callback`
→ Clique "Register application"

**2. Copiar credenciais:**
→ Copie **Client ID**
→ "Generate a new client secret" → copie o secret

**3. Colar no `.env`:**
```env
GITHUB_CLIENT_ID=cole_aqui
GITHUB_CLIENT_SECRET=cole_aqui
GITHUB_REDIRECT_URI=http://localhost:3001/v1/integrations/github/callback
```

**Scopes usados:** `repo user read:org`

---

### 🔵 NOTION
**Cobre:** segundo cérebro, notas, wikis, documentação pessoal.

**1. Criar integration:**
→ Acesse: https://www.notion.so/my-integrations
→ "+ New integration"
→ Name: `ORION`
→ Associated workspace: sua workspace
→ Type: **Public** (para OAuth multi-usuário)
→ Redirect URIs: `http://localhost:3001/v1/integrations/notion/callback`
→ Copie **OAuth client ID** e **OAuth client secret**

**2. Colar no `.env`:**
```env
NOTION_CLIENT_ID=cole_aqui
NOTION_CLIENT_SECRET=cole_aqui
NOTION_REDIRECT_URI=http://localhost:3001/v1/integrations/notion/callback
```

---

### 💬 SLACK
**Cobre:** times de empresa, comunidades, canais de trabalho.

**1. Criar app:**
→ Acesse: https://api.slack.com/apps
→ "Create New App" → "From scratch"
→ App Name: `ORION` | Workspace: sua workspace de dev
→ OAuth & Permissions → Redirect URLs → Add: `http://localhost:3001/v1/integrations/slack/callback`

**2. Bot Token Scopes (OAuth & Permissions → Scopes → Bot Token Scopes):**
```
channels:history
channels:read
chat:write
groups:history
groups:read
im:history
im:read
im:write
users:read
users:read.email
```

**3. Copiar credenciais (Basic Information → App Credentials):**
```env
SLACK_CLIENT_ID=cole_aqui
SLACK_CLIENT_SECRET=cole_aqui
SLACK_REDIRECT_URI=http://localhost:3001/v1/integrations/slack/callback
SLACK_SIGNING_SECRET=cole_aqui
```

---

### 📋 ATLASSIAN (Jira + Trello + Confluence)
**Cobre:** devs e times que usam Jira, boards Trello, wikis Confluence.

**1. Criar app:**
→ Acesse: https://developer.atlassian.com/console/myapps/
→ "Create" → "OAuth 2.0 integration"
→ Name: `ORION`
→ Callback URL: `http://localhost:3001/v1/integrations/atlassian/callback`

**2. Permissions (na aba Permissions do app):**
```
Jira: read:jira-work, write:jira-work, read:jira-user
Confluence: read:confluence-content.all, write:confluence-content
Trello: read, write (via separate Trello API abaixo)
```

**3. Copiar credenciais (Settings → Authentication details):**
```env
ATLASSIAN_CLIENT_ID=cole_aqui
ATLASSIAN_CLIENT_SECRET=cole_aqui
ATLASSIAN_REDIRECT_URI=http://localhost:3001/v1/integrations/atlassian/callback
```

---

## TIER 2 — Médio impacto (nichos importantes)

### 🟢 WHATSAPP BUSINESS
**Cobre:** comunicação no Brasil e mundo. Muito relevante para freelancers e pequenas empresas.

**1. Criar app:**
→ Acesse: https://developers.facebook.com/apps/
→ "Create App" → Type: **Business**
→ Name: `ORION`

**2. Adicionar WhatsApp:**
→ Dashboard → Add Product → WhatsApp → Set up
→ Getting Started → copie **Phone number ID** e **WhatsApp Business Account ID**
→ API Setup → Generate token temporário (para testes)

**3. Para produção (System User Token):**
→ Business Settings → System Users → Add
→ Generate token com permissões: `whatsapp_business_messaging`, `whatsapp_business_management`

```env
WHATSAPP_PHONE_ID=cole_aqui
WHATSAPP_ACCESS_TOKEN=cole_aqui
WHATSAPP_WEBHOOK_VERIFY_TOKEN=qualquer_string_secreta_aqui
```

> ⚠️ WhatsApp Business não usa OAuth padrão — usa tokens de longa duração + webhooks.

---

### 🎮 DISCORD
**Cobre:** gamers, comunidades, estudantes, grupos de tech.

**1. Criar app:**
→ Acesse: https://discord.com/developers/applications
→ "New Application" → Name: `ORION`
→ OAuth2 → Redirects → Add: `http://localhost:3001/v1/integrations/discord/callback`

**2. Copiar credenciais (OAuth2 → General):**
```env
DISCORD_CLIENT_ID=cole_aqui
DISCORD_CLIENT_SECRET=cole_aqui
DISCORD_REDIRECT_URI=http://localhost:3001/v1/integrations/discord/callback
```

**Scopes:** `identify email guilds messages.read`

---

### 🎨 FIGMA
**Cobre:** designers, product designers, time de design.

**1. Criar app:**
→ Acesse: https://www.figma.com/developers/apps
→ "Create a new app"
→ Name: `ORION`
→ Callback URL: `http://localhost:3001/v1/integrations/figma/callback`
→ Copie **Client ID** e **Client Secret**

**2. Scopes necessários:**
```
file_content:read
file_metadata:read
org:read
```

```env
FIGMA_CLIENT_ID=cole_aqui
FIGMA_CLIENT_SECRET=cole_aqui
FIGMA_REDIRECT_URI=http://localhost:3001/v1/integrations/figma/callback
```

---

### 🏃 STRAVA
**Cobre:** runners, ciclistas, qualquer usuário fitness ativo.

> ⚠️ Requer conta Strava para criar o app.

**1. Criar app:**
→ Acesse: https://www.strava.com/settings/api
→ Preencha:
  - Application Name: `ORION`
  - Category: `Data Importer`
  - Club: (deixe vazio)
  - Website: `http://localhost:5173`
  - Authorization Callback Domain: `localhost`
→ Copie **Client ID** e **Client Secret**

```env
STRAVA_CLIENT_ID=cole_aqui
STRAVA_CLIENT_SECRET=cole_aqui
STRAVA_REDIRECT_URI=http://localhost:3001/v1/integrations/strava/callback
```

**Scopes:** `read,activity:read_all,profile:read_all`

---

### 🛍️ MERCADO LIVRE
**Cobre:** vendedores, compradores frequentes, empreendedores no Brasil/LATAM.

**1. Criar app:**
→ Acesse: https://developers.mercadolivre.com.br/devcenter
→ "Criar aplicação"
→ Nome: `ORION`
→ Modelo de negócios: **MP** (Marketplace)
→ URI de redirecionamento: `http://localhost:3001/v1/integrations/mercadolivre/callback`
→ Copie **App ID** (= Client ID) e **Secret Key**

> ⚠️ Requer validação de identidade na conta ML antes de criar o app no Brasil.

```env
ML_CLIENT_ID=cole_aqui
ML_CLIENT_SECRET=cole_aqui
ML_REDIRECT_URI=http://localhost:3001/v1/integrations/mercadolivre/callback
```

---

## TIER 3 — Nichos específicos (futura expansão)

| Conector | URL para criar app | Público-alvo |
|----------|-------------------|--------------|
| **LinkedIn** | https://www.linkedin.com/developers/apps/new | Profissionais, busca de emprego |
| **Dropbox** | https://www.dropbox.com/developers/apps | Usuários Dropbox |
| **Box** | https://developer.box.com/ | Enterprise storage |
| **Asana** | https://app.asana.com/0/developer-console | Times de projeto |
| **Monday.com** | https://developer.monday.com/ | Times de projeto |
| **ClickUp** | https://app.clickup.com/settings/apps | Times de projeto |
| **Stripe** | https://dashboard.stripe.com/apikeys | Empreendedores/SaaS |
| **Shopify** | https://partners.shopify.com/ | E-commerce |
| **Fitbit** | https://dev.fitbit.com/apps/new | Saúde/fitness |
| **Garmin** | https://developer.garmin.com/gc-developer-program/overview/ | Fitness avançado |
| **YouTube** | https://console.cloud.google.com | Criadores de conteúdo |
| **Instagram** | https://developers.facebook.com/apps/ | Criadores de conteúdo |
| **Twitter/X** | https://developer.x.com/en/portal/dashboard | Criadores de conteúdo |

---

## Para produção: atualizar URLs de callback

Todos os `http://localhost:3001` devem ser trocados para `https://SEU_DOMINIO` quando você fizer deploy no Railway.

No Railway, vá em Settings → Domains → copie a URL gerada → cole como `https://sua-url.railway.app` em cada provedor.
