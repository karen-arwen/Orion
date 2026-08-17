# ORION - Roadmap de Conectores e APIs

Objetivo: expandir o Orion com conectores realmente úteis, atuais e seguros, priorizando APIs oficiais e casos onde o usuário ganha poder com um comando.

## Princípios

- Preferir APIs oficiais, OAuth e escopos mínimos.
- Toda ação destrutiva ou externa precisa passar pela Decision Inbox.
- Leitura pode ser proativa; escrita/envio/compra/publicação precisa de aprovação.
- Cada conector deve declarar capacidades, riscos, escopos e exemplos de comando.

## Já na base

- Google Gmail: leitura/classificação de emails e sinais proativos.
- Google Calendar: agenda, conflitos e briefing.
- Google Drive: documentos recentes e análise.
- Brave Search: Radar/news/vagas.
- Anthropic Claude: núcleo de raciocínio.

## Próximos conectores priorizados

### 1. GitHub

Fonte oficial: https://docs.github.com/en/rest

Uso no Orion:
- ler issues, PRs, commits e actions;
- detectar projeto parado;
- criar issue/tarefa técnica;
- resumir PR;
- montar changelog.

Comandos:
- `orion, olha meus PRs pendentes e prioriza`
- `cria uma issue para esse bug`
- `resume o status do projeto no GitHub`

Risco: escrita em repositório. Usar Decision Inbox antes de criar issue, comentar ou fechar PR.

### 2. Notion

Fonte oficial: https://developers.notion.com/reference/intro

Uso no Orion:
- segundo cérebro persistente;
- salvar decisões, notas, ideias e planos;
- sincronizar projetos;
- gerar página de reunião/briefing.

Comandos:
- `salva isso no meu Notion como plano do Orion`
- `cria uma página com o roadmap da semana`

Risco: bagunçar workspace. Usar banco/página raiz configurável.

### 3. Slack

Fonte oficial: https://docs.slack.dev/apis/web-api

Uso no Orion:
- ler menções importantes;
- resumir canais;
- preparar resposta;
- enviar mensagem com aprovação.

Comandos:
- `resume o que eu perdi no Slack`
- `prepara uma resposta para essa thread`

Risco: envio de mensagem. Sempre aprovar pela Decision Inbox.

### 4. OpenWeather

Fonte oficial: https://openweathermap.org/api

Uso no Orion:
- ajustar rotina por clima;
- alertar chuva/calor antes de compromisso;
- melhorar Travel e Agenda.

Comandos:
- `ajusta meu dia considerando o clima`
- `vou sair às 18h, preciso levar algo?`

Risco baixo: leitura.

### 5. Spotify

Fonte oficial: https://developer.spotify.com/documentation/web-api

Uso no Orion:
- playlists de foco/sono;
- contexto de humor;
- automação de ambiente.

Comandos:
- `toca uma playlist para foco profundo`
- `cria uma rotina de desaceleração`

Risco médio: controlar playback. Confirmar ações se mudar dispositivo/playlist.

### 6. Todoist ou Linear

Fontes oficiais:
- Todoist: https://developer.todoist.com/rest/v2/
- Linear: https://developers.linear.app/docs/graphql/working-with-the-graphql-api

Uso no Orion:
- sincronizar tarefas externas;
- transformar decisões em tickets;
- puxar prioridades reais de trabalho.

Comandos:
- `transforma isso em tarefa no Todoist`
- `cria uma issue no Linear com contexto`

Risco: duplicar tarefas. Deduplicação obrigatória.

## Implementação sugerida

1. Criar `CapabilityRegistry` no backend. Status: implementado em `/v1/integrations/capabilities`.
2. Cada conector declara:
   - provider;
   - scopes;
   - read capabilities;
   - write capabilities;
   - exemplos de comandos;
   - se exige Decision Inbox.
3. O chat consulta o registry antes de responder “posso fazer”. Status: pendente.
4. A Command Palette mostra capacidades disponíveis conforme integrações conectadas. Status: pendente.
5. A Decision Inbox vira o gate padrão para escrita externa. Status: base implementada.

## Passo a passo de keys

Arquivo detalhado: `API_KEYS_PASSO_A_PASSO.md`.

## Ordem recomendada

1. GitHub: alto valor para projeto/produto.
2. Notion: segundo cérebro real.
3. OpenWeather: fácil e melhora Agenda/Travel.
4. Slack: comunicação profissional.
5. Todoist/Linear: produtividade externa.
6. Spotify: experiência e ambient intelligence.
