# O.R.I.O.N - Passo a Passo Fase 2

Este arquivo cobre apenas o que mudou agora na Fase 2.

## 1. Atualizar variaveis do backend

Abra `apps/api/.env` e adicione ou confira:

```env
OPENAI_API_KEY=""
BRAVE_SEARCH_API_KEY=""

TMDB_API_KEY=""
RAWG_API_KEY=""

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3001/v1/integrations/google/callback"
```

`OPENAI_API_KEY` ativa embeddings semanticos da memoria. Se ficar vazio, a memoria ainda funciona, mas usa ranking por importancia.

`BRAVE_SEARCH_API_KEY` ativa pesquisa web em tempo real para noticias, vagas, eventos, lancamentos, docs atuais e tendencias fora de filmes/jogos.

`TMDB_API_KEY` ativa tendencias de filmes/series.

`RAWG_API_KEY` ativa tendencias e busca de jogos.

## 2. Sincronizar banco

Como o Prisma ganhou campos novos em memoria, automacoes e alertas, rode:

```powershell
npm run db:push
```

Se o Prisma perguntar para confirmar alteracoes, responda `y`.

## 3. Reiniciar servidores

Se `npm run dev` ja estava aberto, pare com `Ctrl+C` e suba de novo:

```powershell
npm run dev
```

Isso recarrega `.env`, BullMQ workers e agendamentos cron.

## 4. Testes rapidos

No chat:

```text
Que dia e horario e agora?
```

Ele deve usar o horario local e o ano atual.

```text
Monta uma aula sobre Spring Boot do zero
```

Ele deve criar material estruturado e salvar historico no modulo Conhecimento.

```text
Quais filmes, series e jogos estao em alta?
```

Com `TMDB_API_KEY` e `RAWG_API_KEY`, ele deve consultar as APIs atuais.

```text
Pesquisa na internet os eventos geek em Sao Paulo neste mes
```

Com `BRAVE_SEARCH_API_KEY`, ele deve consultar a web em tempo real e responder com links/fonte.

Na aba de automacoes, clique em Morning Brief agora. Deve criar um alerta novo.

Abra o modulo FOCO no menu lateral:

```text
FOCO > ATIVAR MODO FOCO
```

Enquanto a sessao estiver ativa, alertas baixos/medios ficam ocultos. Use CONCLUIR para registrar minutos no relatorio semanal.

Abra o modulo HABITOS:

```text
HABITOS > criar habito > clicar nos quadradinhos do calendario
```

Ele deve atualizar streak, recorde e progresso do dia.

Abra o modulo SLEEP:

```text
SLEEP > registrar horario de dormir/acordar
```

Ele deve mostrar media, consistencia, risco de sono insuficiente e janelas horizontais.

Automacao de sono:

- Apple Health nao tem API web direta. Precisa de um app iOS/WatchOS com HealthKit lendo sono no aparelho e enviando para `/v1/m/sleep/import`.
- Samsung/Galaxy deve usar Health Connect ou Samsung Health Data SDK em um app Android ponte, tambem enviando para `/v1/m/sleep/import`.
- O backend ja esta pronto para receber `apple_health`, `samsung_health` e `health_connect`; falta criar o app mobile/ponte.

Abra o modulo CRIACAO:

```text
CRIACAO > gerar 3 ideias
```

Ele deve criar cards no banco de ideias e permitir mover entre IDEIA, RASCUNHO, AGENDADO e PUBLICADO.

Abra o modulo GAMING:

```text
GAMING > TRENDING ou buscar um jogo > ADD
```

Com `RAWG_API_KEY`, ele busca catalogo atual, salva jogos na shelf, move entre QUER JOGAR/JOGANDO/ZEROU/DROPPED e gera recomendacoes pelo seu backlog.

## 5. Chaves gratuitas

TMDB: crie em `https://www.themoviedb.org/settings/api`.

RAWG: crie em `https://rawg.io/apidocs`.

Brave Search: crie em `https://api-dashboard.search.brave.com/app/keys`. Copie a subscription token/API key e cole em `BRAVE_SEARCH_API_KEY`.

OpenAI embeddings: use uma chave de API OpenAI com acesso a `text-embedding-3-small`.

## 5.1. Proximas APIs por prioridade

Nao precisa pegar tudo agora. Pegue conforme a feature entrar no codigo:

1. Google OAuth: ja cobre Gmail, Calendar e Drive. Necessario agora.
2. OpenAI: embeddings de memoria semantica. Recomendado agora.
3. TMDB + RAWG: filmes, series e jogos. Recomendado agora.
4. Brave Search ou Serper: busca web em tempo real para noticias, tendencias e vagas. Brave Search ja esta integrado; falta apenas preencher `BRAVE_SEARCH_API_KEY`.
5. Spotify Developer: playlists, historico musical e contexto de humor. Entra em Saude/Foco/Relax.
6. GitHub OAuth/App: commits, PRs e projetos parados. Entra em Carreira/GitHub Nudge.
7. Weather API: clima nas sugestoes de rotina e viagem. Entra em Travel/Saude.
8. ElevenLabs: voz do O.R.I.O.N. Entra na fase de UX/voz.

Instagram/LinkedIn oficiais sao mais restritos. Para produto real, comece com cadastro manual de perfis/interesses e APIs publicas/RSS. Automatizar scraping agressivo dessas redes aumenta risco de bloqueio e termos de uso.

## 6. Observacao importante

Se `prisma generate` falhar no Windows com `EPERM` em `query_engine-windows.dll.node`, algum servidor Node esta segurando o arquivo. Pare `npm run dev` e rode:

```powershell
npm run db:generate --workspace apps/api
```

Depois suba o dev server novamente.
