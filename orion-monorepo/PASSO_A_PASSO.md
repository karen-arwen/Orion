# O.R.I.O.N — Guia mastigado do zero ao deploy

> Você não precisa saber nada de DevOps. Siga na ordem. Cada passo é um quadradinho pra marcar.
> Se travar em algum, me chama no chat com o número do passo e a mensagem de erro.

```
FASE 0 — Instalar programas no seu PC
FASE 1 — Criar contas (todas têm plano gratuito)
FASE 2 — Rodar o O.R.I.O.N no seu computador
FASE 3 — Ativar login com Google
FASE 4 — Conectar Gmail + Calendar + Drive de verdade
FASE 5 — Publicar online (deploy)
```

---

## FASE 0 — Instalar programas (uma vez só, ~15 min)

### [ ] 0.1 — Node.js (motor que roda o O.R.I.O.N)

1. Abra https://nodejs.org/en/download
2. Baixe o instalador da versão **LTS** para Windows (`.msi`)
3. Execute. **Next → Next → Install** (deixa tudo padrão)
4. Para confirmar: abra o **PowerShell** (tecla Windows → digite "powershell" → Enter) e cole:
   ```powershell
   node --version
   ```
   Tem que aparecer algo tipo `v20.18.0`. Se não aparecer, reinicia o PC.

### [ ] 0.2 — Docker Desktop (banco de dados local)

1. Vá em https://www.docker.com/products/docker-desktop/
2. Baixe **Docker Desktop for Windows**
3. Instale. Vai pedir pra reiniciar o PC — reinicia.
4. Depois do reboot, abra o **Docker Desktop**. Aceita os termos.
5. Vai pedir login (pode pular ou criar conta grátis).
6. Espera o ícone de baleia no canto inferior direito ficar **verde/branco fixo** (não pulando). Isso significa "Docker rodando".

> **Plano B se Docker travar:** instala Postgres e Redis direto no Windows. Me avisa que te passo o passo alternativo.

### [ ] 0.3 — Git (controle de versão, necessário pra deploy)

1. Vá em https://git-scm.com/download/win
2. Baixa e instala. **Next em tudo**, padrão funciona.
3. Confirma no PowerShell:
   ```powershell
   git --version
   ```

### [ ] 0.4 — VS Code (editor — opcional mas recomendado)

1. https://code.visualstudio.com/ → Download for Windows → instala.
2. Abre e arrasta a pasta `orion-monorepo` pra dentro dele.

---

## FASE 1 — Criar contas (uma vez só, ~20 min)

Você vai criar 4 contas. Anota tudo num bloco de notas — vai precisar copiar/colar várias chaves depois.

### [ ] 1.1 — Anthropic (a IA — Claude)

> **Custo:** créditos pré-pagos. **Começa com $5 e dura semanas no MVP.**

1. https://console.anthropic.com → **Sign up**
2. Confirma o email.
3. Menu lateral → **Plans & Billing** → adiciona um cartão e compra **$5** de créditos.
4. Menu lateral → **API Keys** → **Create Key**
5. Dá um nome (ex: `orion-dev`) → **Create**
6. **COPIA A CHAVE AGORA** (começa com `sk-ant-...`). Cola no seu bloco de notas como:
   ```
   ANTHROPIC_API_KEY = sk-ant-...
   ```
   > Ela só aparece uma vez. Se perder, cria outra.

### [ ] 1.2 — Clerk (login com Google)

> **Custo:** grátis até 10 000 usuários ativos/mês.

1. https://dashboard.clerk.com → **Sign up** (login com Google funciona)
2. **Create application** → Nome: `O.R.I.O.N` → escolhe **Google** como provider → **Create**
3. No painel da aplicação, menu lateral → **API Keys**
4. Copia os dois valores pro bloco de notas:
   ```
   CLERK_PUBLISHABLE_KEY = pk_test_...
   CLERK_SECRET_KEY      = sk_test_...
   ```

### [ ] 1.3 — Vercel (vai hospedar o frontend, daqui a pouco)

1. https://vercel.com → **Sign Up** com sua conta do GitHub.
2. Pronto, só isso por enquanto.

### [ ] 1.4 — Railway (vai hospedar o backend + Postgres + Redis)

> **Custo:** $5/mês de créditos grátis. Suficiente pro O.R.I.O.N dev.

1. https://railway.app → **Login** com GitHub.
2. Verifica o email se pedir.
3. Pronto por enquanto.

---

## FASE 2 — Rodar o O.R.I.O.N no seu PC (~10 min)

### [ ] 2.1 — Abrir o PowerShell na pasta certa

1. Abre o **Explorador de Arquivos**.
2. Navega até `Documentos\Claude\Projects\Orion\orion-monorepo`.
3. Clica na **barra de endereço** (em cima, onde mostra o caminho).
4. Apaga o que estiver lá, digita `powershell` e dá Enter.
5. Vai abrir um terminal **já dentro da pasta certa**. Confere que aparece `...\orion-monorepo>` no início.

### [ ] 2.2 — Instalar dependências

Cola no PowerShell e dá Enter:
```powershell
npm install
```
Demora uns 2-5 minutos. Vai aparecer um monte de texto. **Avisos amarelos é normal.** Erros vermelhos não — me chama se aparecer.

### [ ] 2.3 — Subir Postgres + Redis

```powershell
npm run docker:up
```
Espera 30 segundos. Pra confirmar que subiu, abre o **Docker Desktop** → aba **Containers** → você vai ver `orion_postgres` e `orion_redis` com bolinha verde.

### [ ] 2.4 — Criar o `.env` do backend

1. No VS Code (ou bloco de notas), abre a pasta `apps/api`.
2. Tem um arquivo `.env.example`. **Duplica ele** e renomeia a cópia pra `.env` (sem o `.example`).
3. Abre o `.env` e cola **suas chaves** do bloco de notas. Deve ficar assim:

```env
DATABASE_URL="postgresql://orion:orion_dev@localhost:5433/orion?schema=public"
REDIS_URL="redis://localhost:6379"

ANTHROPIC_API_KEY="sk-ant-COLA_A_SUA_AQUI"
ANTHROPIC_MODEL="claude-sonnet-4-6"

CLERK_SECRET_KEY="sk_test_COLA_A_SUA_AQUI"
CLERK_PUBLISHABLE_KEY="pk_test_COLA_A_SUA_AQUI"
CLERK_WEBHOOK_SECRET=""

STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

PORT=3001
NODE_ENV="development"
WEB_ORIGIN="http://localhost:5173"
```

### [ ] 2.5 — Criar o `.env.local` do frontend

1. Vai em `apps/web`.
2. Duplica `.env.example` → renomeia a cópia pra `.env.local`.
3. Abre e cola:

```env
VITE_API_URL="http://localhost:3001"
VITE_CLERK_PUBLISHABLE_KEY="pk_test_COLA_A_MESMA_DO_BACKEND"
VITE_STRIPE_PUBLIC_KEY=""
```

### [ ] 2.6 — Criar as tabelas no banco

No PowerShell (ainda em `orion-monorepo`):
```powershell
npm run db:push
```
Vai aparecer "Your database is now in sync with your Prisma schema". Pode dar **Y** se perguntar algo.

### [ ] 2.7 — (Opcional) Popular com dados de exemplo

```powershell
cd apps\api
npx tsx prisma/seed.ts
cd ..\..
```
> Cria o usuário Karen demo com 5 projetos + 4 alertas. Útil pra ver a UI cheia.

### [ ] 2.8 — Rodar tudo

```powershell
npm run dev
```

Vai aparecer:
```
◉ O.R.I.O.N · API ONLINE
   Porta: 3001
➜  Local:   http://localhost:5173/
```

**Abre no navegador:** http://localhost:5173

Se aparecer a tela de login com os anéis cyan girando, **VOCÊ ACABOU DE INICIALIZAR O ORION.**

> Pra parar tudo: aperta `Ctrl+C` no PowerShell.

---

## FASE 3 — Ativar login com Google (~10 min)

A tela de login já existe (Clerk). Vamos garantir que o "Sign in with Google" funciona de verdade.

### [ ] 3.1 — Ativar Google Strategy no Clerk

1. Volta no https://dashboard.clerk.com
2. Sua aplicação → menu lateral → **User & Authentication** → **Social Connections**
3. Procura **Google** na lista. Liga o toggle (vira azul).
4. Vai abrir um popup com **duas opções de Credentials**:
   - **Use Clerk's development OAuth credentials** ✅ (escolhe essa pra desenvolvimento)
   - Custom credentials (deixa pra depois, só pra produção)
5. Salva. Pronto, em **dev** já funciona.

### [ ] 3.2 — Testar

1. Volta no navegador em http://localhost:5173
2. Clica em **Continue with Google**
3. Escolhe sua conta `arwenkaren1207@gmail.com`
4. Autoriza
5. Vai cair direto no Painel Stark com seu nome no topo direito. **Funcionou.**

### [ ] 3.3 — (OPCIONAL — só pra produção) Credenciais Google próprias

**Em desenvolvimento você NÃO precisa fazer nada aqui.** O login já funciona com as credenciais de teste do Clerk (passo 3.1). Pode pular direto pra Fase 4.

Quando for pro deploy real, você troca pelas suas próprias:
1. https://console.cloud.google.com → cria um projeto (você já criou o "Orion")
2. Menu → **APIs e serviços → Tela de consentimento OAuth** → configura (tipo "Externo", nome do app, email)
3. Menu → **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth** → tipo "Aplicativo da Web"
4. Em **URIs de redirecionamento autorizados**, cola a URL que o Clerk mostra (Clerk → Social Connections → Google → "Use custom credentials")
5. Copia Client ID + Secret de volta pro Clerk

> Não existe "Google+ API" pra ativar — isso foi descontinuado pelo Google. Você só precisa da tela de consentimento + as credenciais OAuth. E de novo: **pula isso por enquanto.**

---

## FASE 4 — Conectar Gmail / Calendar / Drive (de verdade, produto real)

Você vai criar credenciais OAuth **uma vez** (5 min no Google Cloud Console), colar no `.env`, e depois é só clicar **"Conectar Google"** dentro do O.R.I.O.N. Token expira sozinho? O servidor renova sozinho. Você nunca mais precisa pensar nisso.

### [ ] 4.1 — Criar credenciais OAuth no Google Cloud (~5 min, uma vez só)

1. Abre https://console.cloud.google.com — entra com a mesma conta Google.
2. **Topo** → seletor de projeto → confirma que está no projeto **"Orion"** que você já criou.
3. Menu hambúrguer (☰) → **APIs e serviços** → **APIs e serviços ativadas** → **+ ATIVAR APIS E SERVIÇOS**.
4. Busca e ativa **uma de cada vez** (botão azul "Ativar"):
   - **Gmail API**
   - **Google Calendar API**
   - **Google Drive API**
5. Volta no menu → **APIs e serviços** → **Tela de consentimento OAuth**.
   - Tipo de usuário: **Externo** → CRIAR.
   - Nome do app: `O.R.I.O.N`
   - Email de suporte: seu email
   - Email de contato do desenvolvedor: seu email
   - **SALVAR E CONTINUAR** até chegar na etapa **"Usuários de teste"**.
   - ⚠ **NÃO PULA essa etapa.** Clica **+ ADICIONAR USUÁRIOS** → cola seu próprio email Google (`arwenkaren1207@gmail.com`) → **ADICIONAR** → **SALVAR**.

   > Sem isso, o Google bloqueia o login com erro `403: access_denied` porque o app está em modo "Testing" e só testers autorizados conseguem entrar. Você pode adicionar até 100 emails (útil pra amigas testarem antes do deploy real).

6. Menu → **APIs e serviços** → **Credenciais** → **+ CRIAR CREDENCIAIS** → **ID do cliente OAuth**.
   - Tipo: **Aplicativo da Web**
   - Nome: `O.R.I.O.N. local`
   - **URIs de redirecionamento autorizados** → **+ ADICIONAR URI** → cola exatamente:
     ```
     http://localhost:3001/v1/integrations/google/callback
     ```
   - **CRIAR**.
7. Aparece uma janela com **ID do cliente** e **Chave secreta do cliente**. **Copia os dois** pro seu bloco de notas.

### [ ] 4.2 — Colar no `.env` do backend

Abre `apps/api/.env` e preenche as duas linhas:

```env
GOOGLE_CLIENT_ID="<cola_o_ID_do_cliente_aqui>"
GOOGLE_CLIENT_SECRET="<cola_a_chave_secreta_aqui>"
```

> Essas linhas talvez ainda não existam no seu `.env` antigo — se for o caso, adiciona elas no final do arquivo.

Salva. **Reinicia o `npm run dev`** (Ctrl+C → `npm run dev`) — o servidor precisa reler o `.env`.

### [ ] 4.3 — Conectar no app

1. No O.R.I.O.N. (http://localhost:5173), clica no **status GMAIL** (ou CALENDAR / DRIVE) no topo da tela — ele te leva pra `/integrations`.
2. Clica em **+ CONECTAR GOOGLE**.
3. Você é mandada pro consent screen oficial do Google → escolhe sua conta → autoriza os 3 acessos.
4. Volta automaticamente pro O.R.I.O.N. com a mensagem **"Google conectado com sucesso"**.

Pronto. Os 3 chips no topo viram verdes. **Você não vai precisar fazer isso de novo.** Quando o token expirar (1h), o O.R.I.O.N. renova sozinho usando o refresh token.

### [ ] 4.4 — Testar

Volta no chat e digita:
> **Verifica meus emails urgentes**

- Se ele listar emails reais da sua caixa → **Jarvis modo on, fim de jogo, vai dormir feliz.**
- Se ele disser que não consegue acessar → o MCP do Google pode estar exigindo um formato de credencial diferente (provável: as URLs `gmailmcp.googleapis.com` ainda não são públicas). Aí me chama que eu implemento Gmail/Calendar/Drive como ferramentas customizadas que chamam a API REST direto — usando esse mesmo token que você acabou de conectar.

> **Importante:** o `refresh_token` do Google dura **~6 meses** (ou até você revogar manualmente em https://myaccount.google.com/permissions). Enquanto isso, tudo é automático.

---

## FASE 5 — Publicar online (deploy) (~30 min)

Você vai ter dois lugares:
- **Railway** = backend + Postgres + Redis (tudo num lugar só)
- **Vercel** = frontend

### [ ] 5.1 — Subir o código pro GitHub

1. https://github.com → **+** (canto superior direito) → **New repository**
2. Nome: `orion` → Private → **Create repository**
3. No PowerShell, dentro de `orion-monorepo`:
   ```powershell
   git init
   git add .
   git commit -m "O.R.I.O.N — Fase 1 MVP"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/orion.git
   git push -u origin main
   ```
   Vai pedir login no GitHub (abre uma janelinha). Aprova.

### [ ] 5.2 — Deploy do backend no Railway

1. https://railway.app → **New Project** → **Deploy from GitHub repo**
2. Autoriza Railway a ver seus repos.
3. Seleciona `orion`.
4. Railway detecta como Node mas vai falhar — **monorepo precisa de config**:
   - Clica no serviço criado → aba **Settings**
   - **Root Directory** → `apps/api`
   - **Build Command** → `npm install --workspaces && npm run build --workspace apps/api`
   - **Start Command** → `node dist/server.js`

5. Adiciona Postgres: dentro do projeto Railway, **+ New** → **Database** → **PostgreSQL**.
6. Adiciona Redis: **+ New** → **Database** → **Redis**.
7. Volta no serviço da API → aba **Variables** → **Add Variable** pra cada:
   ```
   DATABASE_URL       = (clica em "Reference" → Postgres → DATABASE_URL)
   REDIS_URL          = (clica em "Reference" → Redis → REDIS_URL)
   ANTHROPIC_API_KEY  = sk-ant-...
   ANTHROPIC_MODEL    = claude-sonnet-4-20250514
   CLERK_SECRET_KEY   = sk_test_...
   CLERK_PUBLISHABLE_KEY = pk_test_...
   NODE_ENV           = production
   PORT               = 3001
   WEB_ORIGIN         = (vamos preencher depois com a URL da Vercel)
   ```
8. Aba **Settings** → **Generate Domain** → copia a URL gerada (ex: `orion-api-production.up.railway.app`).

9. Rode a migração inicial: aba **Deployments** → clica nos `...` da última → **View Logs** → quando estiver ONLINE, abre uma aba **Shell** (no menu lateral do serviço) e roda:
   ```bash
   npx prisma db push
   ```

### [ ] 5.3 — Deploy do frontend na Vercel

1. https://vercel.com → **Add New** → **Project**
2. Importa o repo `orion`.
3. Configurações:
   - **Framework Preset** → `Vite`
   - **Root Directory** → clica **Edit** → seleciona `apps/web`
   - **Build Command** → `cd ../.. && npm install && npm run build --workspace apps/web`
   - **Output Directory** → `dist`
4. **Environment Variables**:
   ```
   VITE_API_URL = https://orion-api-production.up.railway.app  (URL do Railway)
   VITE_CLERK_PUBLISHABLE_KEY = pk_test_...  (a mesma do dev)
   ```
5. **Deploy**.
6. Espera 2-3 min. Vai te dar uma URL tipo `orion-eight.vercel.app`. **Anota.**

### [ ] 5.4 — Conectar os dois (CORS + Clerk)

1. Volta no Railway → serviço da API → **Variables** → edita `WEB_ORIGIN` → cola a URL da Vercel (sem `/` no final).
2. Railway vai re-deploy sozinho.
3. No Clerk Dashboard → sua app → **Domains** → **Add domain** → cola a URL da Vercel.
4. No Clerk → **Paths** → **Sign-in URL** → `/sign-in`.

### [ ] 5.5 — Testar online

Abre a URL da Vercel no navegador → faz login com Google → **bem-vinda ao O.R.I.O.N em produção.**

---

## Atalhos pro dia-a-dia (depois do setup)

```powershell
# Subir tudo:
cd C:\Users\arwen\OneDrive\Documentos\Claude\Projects\Orion\orion-monorepo
npm run docker:up
npm run dev

# Parar tudo:
# (Ctrl+C no terminal do npm run dev)
npm run docker:down

# Atualizar o schema do banco depois de editar prisma:
npm run db:push

# Ver o banco com GUI:
npm run db:studio
# → abre http://localhost:5555

# Publicar nova versão:
git add .
git commit -m "o que mudou"
git push
# Railway e Vercel re-deployam sozinhos.
```

---

## Onde travar é comum, e como sair

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `EACCES` / `permission denied` no `npm install` | Pasta protegida | Roda PowerShell como admin |
| `port 5432 already in use` | Já tem Postgres rodando | `npm run docker:down` e roda de novo |
| Página em branco no `localhost:5173` | Falta `VITE_CLERK_PUBLISHABLE_KEY` no `.env.local` | Preenche e reinicia `npm run dev` |
| Login do Google trava em loading | Domain não cadastrado no Clerk | Adiciona `localhost:5173` em **Domains** |
| Chat responde "Falha na comunicação" | API offline ou CORS errado | Confere `WEB_ORIGIN` no `.env` do backend |
| "Verifica email" não retorna nada | Integração Gmail não conectada ou token expirado | Refaz Fase 4 |
| Deploy Railway falha | Build command errado | Confere Root Directory = `apps/api` |

---

**Próximo da fila quando você terminar:** Fase 2 do roadmap — automações reais (Morning Brief, Rotina Noturna), memória persistente com embeddings, e onboarding flow das 3 perguntas. Me chama "começa a fase 2" quando estiver pronta.

Construído com cuidado pra você não travar. Karen Arwen, vai dar certo.
