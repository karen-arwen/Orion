# PASSO A PASSO - TESTE DO ORION ATUAL

Este roteiro cobre o que foi implementado nesta leva: correcoes do chat/API, Gmail/Calendar, Radar, Gaming, Dashboard, Sleep pelo chat, feedback de mensagens e os modulos TRAVEL, COMPRAS, IDIOMAS, WHAT-IF, CHEF, MINDSET e SOCIAL.

Antes de comecar:

- Leia o handoff completo em `ORION_HANDOFF_DEV_ATUAL.md`.
- Confira chaves e tarefas manuais em `API_KEYS_PASSO_A_PASSO.md`.
- Nao exponha prints de `.env`, tokens ou secrets.

Checklist rapido:

1. Docker Desktop aberto.
2. `npm run docker:up`.
3. `npm run db:push`.
4. `npm run dev:api`.
5. `npm run dev:web`.
6. Abrir `http://127.0.0.1:5173`.
7. Conferir `http://localhost:3001/health`.

## 1. Subir o ambiente

Na raiz do projeto:

```bash
cd orion-monorepo
npm run docker:up
npm run dev:api
npm run dev:web
```

URLs esperadas:

- Web: `http://127.0.0.1:5173`
- API health: `http://localhost:3001/health`

Se a API nao subir, confira `apps/api/.env` sem expor chaves em prints.

## 1.1. Onboarding e perfil adaptativo

Se cair na tela de onboarding:

1. Escolha o modo `NORMAL` ou `STARK`.
2. Marque ate 4 frentes prioritarias, por exemplo `LIFE OS`, `CARREIRA`, `CFO` e `SAUDE`.
3. Escolha estilo de comunicacao e decisao.
4. Preencha area de trabalho e interesses.
5. Preencha objetivo do mes e limites de autonomia.
6. Finalize.

Resultado esperado:

- O app entra no painel principal.
- O backend ativa varios modulos relacionados ao perfil.
- O Orion cria memorias fixadas com trabalho, objetivo, estilo e limites.
- O painel `Perfil Adaptativo` passa a mostrar preferencias explicitas.
- O chat passa a receber essas preferencias no system prompt.

## 2. Teste rapido do nucleo

1. Abra o app e entre com Clerk.
2. Va para `NEXUS CHAT`.
3. Envie: `oi orion, me responde em uma frase`.
4. Resultado esperado: resposta normal da IA, sem `Falha na comunicacao com o nucleo`.
5. Clique nos botoes `+` e `-` em uma resposta do Orion.
6. Resultado esperado: o feedback e salvo e nao quebra a tela.

## 3. Gmail e Calendar

1. Abra `/integrations`.
2. Verifique se Gmail/Calendar aparecem com status claro.
3. Se algum estiver expirado/revogado, clique para reconectar.
4. Resultado esperado: o botao de reconectar aparece mesmo quando outra integracao Google ainda esta conectada.

## 4. Dashboard

1. Volte para a tela principal.
2. Clique em `PAINEL`.
3. Resultado esperado: painel com dados reais do usuario, alertas, provedores conectados, energia e projetos.
4. Clique em uma acao que mande algo para o chat.
5. Resultado esperado: muda para `NEXUS CHAT` com prompt contextual.

## 5. Command Palette

1. Na tela principal, pressione `Ctrl+K` no Windows/Linux ou `Cmd+K` no Mac.
2. Digite `radar`, `mindset`, `travel` ou `briefing`.
3. Use as setas e `Enter`.
4. Resultado esperado: navega para o modulo ou executa comando no chat.
5. Clique tambem no botao `K` no topo.
6. Resultado esperado: abre a mesma palette.

## 6. Notification Center

1. Clique no botao de notificacoes no topo, ao lado do `K`.
2. Resultado esperado: abre um painel lateral com resumo de alertas.
3. Clique em `SYNC`.
4. Resultado esperado: roda uma varredura proativa e mostra quantos sinais foram checados e quantos alertas novos surgiram.
5. Sinais que podem gerar alertas reais:
   - tarefas vencidas;
   - projeto parado;
   - sono recente ruim;
   - stress alto no Mindset;
   - item de Compras abaixo do preco alvo;
   - contato importante sem follow-up;
   - tarefa em andamento sem bloco de foco recente;
   - Gmail/Calendar quando conectados.
6. Se houver alerta, clique `ATIVAR`.
7. Resultado esperado: fecha o painel, aprova o alerta e manda a acao para o chat.

## 7. Autonomy Center

1. Na tela principal, abra a aba `AUTOMAÇÕES`.
2. Resultado esperado: o topo mostra:
   - score de autonomia;
   - automações ativas/total;
   - alertas pendentes;
   - execuções nas últimas 24h;
   - falhas recentes.
3. Clique em `SCAN PROATIVO`.
4. Resultado esperado: roda a mesma varredura inteligente de sinais e atualiza alertas.
5. Clique em `MORNING BRIEF AGORA`.
6. Resultado esperado: cria um alerta de briefing e ele aparece no Notification Center/Right Rail.
7. Se houver automações instaladas, teste `DISPARAR AGORA` em uma delas.
8. Resultado esperado: execução registrada e, se a automação gerar alerta, ele aparece na lista.
9. Em `DECISION INBOX`, clique `SYNC ALERTAS`.
10. Resultado esperado: alertas pendentes viram decisões estruturadas.
11. Clique `APROVAR` em uma decisão.
12. Resultado esperado: a decisão é aprovada, o alerta relacionado é marcado como resolvido e a ação vai para o chat.
13. Clique `DISPENSAR` em outra decisão.
14. Resultado esperado: ela sai da inbox sem executar nada.

## 8. Action Cards no chat

1. No chat, mande algo que gere contexto de sono, tarefa, viagem, vaga ou stress.
2. Exemplos:

```text
estou cansada e preciso decidir a proxima tarefa
```

```text
quero planejar uma viagem de 3 dias para Sao Paulo
```

3. Resultado esperado: algumas respostas do Orion mostram cards de acao abaixo da mensagem.
4. Clique em `EXECUTAR`.
5. Resultado esperado: o card envia um comando contextual de volta para o chat.

## 9. Radar

1. Abra o modulo `RADAR`.
2. Use a aba de vagas.
3. Teste com:
   - Cargo: `frontend developer`
   - Local: `remoto brasil`
   - Senioridade: `junior` ou `pleno`
4. Resultado esperado: resultados com score de fit e menos lixo generico.
5. Teste busca livre com uma query tech.
6. Salve um item e confira a aba de salvos.

## 10. Gaming

1. Abra `GAMING`.
2. Pesquise um jogo.
3. Adicione na biblioteca/wishlist.
4. Edite status, horas ou nota.
5. Resultado esperado: experiencia estilo biblioteca, com cards visuais e filtros.

## 11. Sleep pelo chat

No chat, envie algo como:

```text
dormi das 23:30 ate 07:10, qualidade 4, acordei bem
```

Resultado esperado: o Orion deve registrar o sono pela tool `sleep_log` e responder confirmando.

## 12. TRAVEL

1. Abra `TRAVEL`.
2. Preencha:
   - Destino: `Sao Paulo`
   - Dias: `3`
   - Interesses: `cafes, tecnologia, cultura geek`
3. Clique em gerar roteiro.
4. Resultado esperado: roteiro por dia com manha, tarde, noite e logistica.

## 13. COMPRAS

1. Abra `COMPRAS`.
2. Adicione um item com nome, URL, preco atual e preco alvo.
3. Edite o preco atual para ficar abaixo do alvo.
4. Resultado esperado: o card sinaliza alerta visual de oportunidade.

## 14. IDIOMAS

1. Abra `IDIOMAS`.
2. Escreva uma frase em ingles.
3. Rode a pratica.
4. Resultado esperado: resposta com correcao, explicacao e treino.

## 15. WHAT-IF

1. Abra `WHAT-IF`.
2. Teste:

```text
E se eu focar os proximos 90 dias em transformar o Orion em produto real?
```

3. Resultado esperado: resumo, provavel/melhor/pior caso, matriz de decisao e proximas acoes.

## 16. CHEF

1. Abra `CHEF`.
2. Use ingredientes como `frango, arroz, ovos, tomate`.
3. Escolha um objetivo.
4. Resultado esperado: receita, passos, substituicoes e lista de compras.

## 17. MINDSET

1. Abra `MINDSET`.
2. Ajuste humor, energia e stress.
3. Registre um check-in com uma nota curta.
4. Resultado esperado: o app retorna padrao, intervencao, reframe e proxima acao.
5. Persistencia esperada: cria linha em `MindsetCheckin` e tambem uma memoria de evento para o Orion aprender.

## 18. SOCIAL

1. Abra `SOCIAL`.
2. Adicione um contato:
   - Nome: `Pessoa Teste`
   - Contexto: `conheci em uma conversa sobre produto`
   - Proximo passo: `mandar follow-up`
3. Resultado esperado: contato aparece em `CONTATOS`.
4. Confira `NUDGES`.
5. Persistencia esperada: cria linha em `SocialContact` e tambem uma memoria de relacionamento.

## 19. SEGURANCA

1. Abra `SEGURANCA`.
2. Registre uma conta sensivel:
   - Servico: `GitHub`
   - Categoria: `dev`
   - Email/login: seu email de teste
   - Marque `2FA` e `vault`
3. Resultado esperado: o score, cobertura de 2FA e cobertura de senhas unicas sobem.
4. Clique nos chips `2FA` e `VAULT` do item criado.
5. Resultado esperado: os indicadores atualizam sem recarregar a tela.
6. Registre um achado:
   - Achado: `Senha reutilizada em conta antiga`
   - Detalhe: `Conta de teste sem 2FA`
   - Risco: `high`
7. Resultado esperado: o plano de hardening e os achados abertos refletem o risco.
8. Clique em `RESOLVER`.
9. Persistencia esperada: cria linhas em `SecurityAccount` e `SecurityFinding`.

## 20. MIDIA

1. Abra `MIDIA`.
2. Adicione um item:
   - Titulo: `Ghost in the Shell`
   - Tipo: `anime`
   - Generos: `sci-fi, filosofico, cyberpunk`
   - Mood: `denso`
   - Camada: `nostalgia`
3. Resultado esperado: o item aparece na biblioteca e o perfil de gosto muda.
4. Troque o status do item para `finished` e adicione nota `5`.
5. Resultado esperado: finalizados e nota media atualizam.
6. No recomendador, use o mood `inteligente e tecnologico`.
7. Clique em `GERAR 3 OPCOES`.
8. Resultado esperado: aparecem 3 recomendacoes com camada, score e motivo.
9. Clique em `ENVIAR PARA WATCHLIST`.
10. Persistencia esperada: cria linha em `MediaItem` e memoria de preferencia.

## 21. Validacao tecnica

Antes de considerar bom:

```bash
npm run typecheck
npm run build
```

Ambos devem passar.

## 22. Chat executor entre modulos

1. Abra o chat principal.
2. Abra `AUTOMACOES` e deixe:
   - `life`: nivel `confirm`, `exige aprovacao` ligado.
   - `media`: nivel `execute`, `exige aprovacao` desligado.
   - `security`: nivel `observe`.
3. Volte ao chat e envie:

```text
registra que gastei 42 reais com cafe hoje e cria uma tarefa para revisar meus gastos no domingo
```

4. Resultado esperado: o Orion usa `orion_action`; CFO tende a criar decisao conforme politica financeira, e Life OS cria decisao porque `life` esta em `confirm`.
5. Aprove as decisoes.
6. Resultado esperado: o CFO recebe o gasto e o Life OS recebe a tarefa.
7. Teste execucao direta:

```text
coloca Ghost in the Shell na minha watchlist de midia como nostalgia
```

8. Resultado esperado: como `media` esta em `execute` sem aprovacao, o item deve aparecer direto em `MIDIA`, sem passar pela Decision Inbox.
9. Teste bloqueio por politica:

```text
registra um risco alto: minha conta antiga sem 2FA precisa ser revisada
```

10. Resultado esperado: como `security` esta em `observe`, o Orion deve dizer que a acao foi bloqueada pelo Autonomy Core em vez de registrar.
11. Mude `security` para `confirm` e envie a frase de novo.
12. Resultado esperado: decisao `security.finding.create`; ao aprovar, aparece em `SEGURANCA`.

## 23. Autonomy Core

1. Abra a aba `AUTOMACOES`.
2. Confira o bloco `AUTONOMY CORE`.
3. Troque o nivel de um modulo, por exemplo:
   - `life` para `confirm`
   - `media` para `suggest`
   - `security` para `observe`
4. Ligue/desligue um modulo pelo botao `ON/OFF`.
5. Marque/desmarque `exige aprovacao`.
6. Resultado esperado: a mudanca persiste ao sair e voltar da aba.
7. Envie no chat:

```text
organiza minha semana com tarefas e alertas, mas respeita minhas politicas de autonomia
```

8. Resultado esperado: o Orion considera as politicas no contexto e usa `orion_action` para executar, criar decisao ou bloquear cada acao interna.
9. Confira o bloco `AUDITORIA DO CHAT EXECUTOR`.
10. Resultado esperado: cada comando do chat aparece como `executed`, `decision` ou `blocked`, com modulo e horario.
11. Para testar limite diario, coloque `limite/dia` de um modulo em `0` na propria tela e tente criar uma acao desse modulo.
12. Resultado esperado: o chat informa que o limite diario foi atingido e registra `blocked` na auditoria.

## 24. Proactive Pulse

1. Abra `AUTOMACOES`.
2. Clique em `SCAN PROATIVO`.
3. Resultado esperado: o scan agora roda duas camadas:
   - detector de alertas, que cria alertas contextuais;
   - Proactive Pulse, que transforma sinais em missoes executaveis pelo Autonomy Core.
4. Confira `AUDITORIA DO CHAT EXECUTOR`.
5. Resultado esperado: podem aparecer missoes como:
   - `Replanejar tarefas vencidas`
   - `Plano de energia reduzida`
   - `Criar bloco de foco de recuperacao`
   - `Priorizar risco de seguranca`
   - `Auditar assinaturas recorrentes`
6. Se o modulo estiver em `confirm`, a missao entra na Decision Inbox.
7. Se estiver em `execute` sem aprovacao, a missao executa direto.
8. Se estiver em `observe`, a missao aparece como `blocked`.
9. Abra o sino / Notification Center e clique em `SYNC`.
10. Resultado esperado: ele mostra quantos sinais foram checados, quantos alertas nasceram e quantas missoes foram roteadas.
11. O Proactive Pulse tambem roda sozinho a cada 3 horas via BullMQ, quando Redis/Docker estiver ativo.

## 25. Mission Control

1. Abra a nova aba `MISSION` no topo do Nexus.
2. Confira os quatro indicadores:
   - `Autonomia`
   - `Aguardando`
   - `Executadas`
   - `Bloqueadas`
3. Clique em `RODAR PROACTIVE PULSE`.
4. Resultado esperado: aparece uma faixa `SCAN` com sinais, alertas, missoes roteadas e dedupes.
5. Em `SINAIS DETECTADOS`, clique `ABRIR` em algum alerta.
6. Resultado esperado: o texto do alerta vai para o chat como comando contextual.
7. Em `DECISOES PENDENTES`, aprove uma decisao.
8. Resultado esperado: a acao executa ou vai para o chat, e a auditoria atualiza.
9. Confira `AUDITORIA DE AUTONOMIA`.
10. Resultado esperado: cada linha mostra titulo, modulo, status e motivo quando existir.
11. Clique em `PEDIR ANALISE AO ORION`.
12. Resultado esperado: o chat recebe um prompt com o estado atual do Mission Control.

## 26. O que observar e me mandar

## 27. Performance / code splitting

1. Abra `http://127.0.0.1:5173/`.
2. Entre no app normalmente.
3. Navegue entre alguns modulos: `Gaming`, `Finance`, `Security`, `Radar`, `Mission`.
4. Resultado esperado: a primeira abertura de cada modulo pode carregar um instante, mas depois fica em cache.
5. Resultado tecnico esperado no build: o bundle inicial fica menor e cada modulo vira um arquivo JS separado em `apps/web/dist/assets`.

## 28. Agent Executor preflight

1. Abra o Nexus Chat.
2. Envie:

```text
cria uma tarefa para revisar meu portfolio amanha
```

3. Resultado esperado: o Orion responde normalmente e adiciona um bloco `Execucao do nucleo`.
4. Se a politica do modulo `life` estiver em `confirm`, a tarefa entra na Action Queue.
5. Se a politica estiver em `execute` sem aprovacao, a tarefa aparece no modulo `Life OS`.
6. Envie:

```text
lembra que eu prefiro respostas diretas quando estou cansada
```

7. Resultado esperado: a memoria e salva direto ou fica pendente conforme politica do modulo `memory`.
8. Envie:

```text
me avisa de revisar as integracoes do Google
```

9. Resultado esperado: vira alerta interno ou decisao pendente, sem depender do Claude chamar ferramenta manualmente.

## 29. Action Queue no Notification Center

1. Clique no sino do topo.
2. Resultado esperado: o painel mostra alertas e tambem decisoes pendentes.
3. Clique `SYNC`.
4. Resultado esperado: alertas ativos viram decisoes executaveis quando aplicavel.
5. Clique `EXECUTAR` em uma decisao.
6. Resultado esperado: a decisao muda de estado e a acao e executada quando houver payload interno.
7. Clique `IGNORAR` em outra decisao.
8. Resultado esperado: ela sai da fila pendente.

## 30. Voice Mode e PWA

1. No chat, clique no icone de microfone.
2. Fale um comando curto, por exemplo:

```text
cria uma tarefa para estudar ingles hoje
```

3. Resultado esperado: o texto falado aparece no campo de comando.
4. Clique no icone de audio e envie a mensagem.
5. Resultado esperado: quando o Orion responder, o navegador fala a resposta.
6. Gere build de producao e abra o preview.
7. Resultado esperado: o navegador reconhece o app como instalavel por causa do `manifest.webmanifest` e do service worker.

## 31. Conectores externos via chat

Esses testes dependem das variaveis no `apps/api/.env`. Se alguma estiver vazia, o Orion deve simplesmente nao oferecer a tool daquele provider.

### Slack

1. Garanta `SLACK_BOT_TOKEN` no backend.
2. Envie no chat:

```text
resume as ultimas 10 mensagens do Slack no canal CXXXXXXXX
```

3. Resultado esperado: o Orion chama `slack_history` e resume as mensagens.
4. Para envio, use:

```text
prepara uma mensagem para o Slack no canal CXXXXXXXX dizendo que vou revisar isso hoje
```

5. Resultado esperado: o Orion deve mostrar o texto e pedir confirmacao antes de chamar `slack_post_message`.
6. Alternativa segura:

```text
prepare uma mensagem para o Slack no canal CXXXXXXXX dizendo que vou revisar isso hoje e deixe aguardando minha aprovacao
```

7. Resultado esperado: entra uma decisao `external` no sino / Action Queue com preview do destino e corpo.
8. Clique `EXECUTAR`.
9. Resultado esperado: so nesse momento a mensagem e enviada.

### Spotify

1. Garanta `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET`.
2. Envie:

```text
busca playlists no Spotify para foco cyberpunk instrumental
```

3. Resultado esperado: retorna playlists reais via `spotify_search`.

### Todoist

1. Garanta `TODOIST_API_TOKEN`.
2. Envie:

```text
lista minhas tarefas do Todoist para hoje
```

3. Resultado esperado: retorna tarefas reais via `todoist_list_tasks`.
4. Para criar:

```text
cria no Todoist uma tarefa chamada revisar modulo de conectores amanha
```

5. Resultado esperado: cria via `todoist_create_task` se o pedido estiver explicito; se o Orion achar ambiguo, deve pedir confirmacao.
6. Para testar a Action Queue:

```text
prepare uma tarefa no Todoist chamada revisar fluxo externo amanha e deixe aguardando aprovacao
```

7. Resultado esperado: aparece preview externo na Action Queue. Ao clicar `EXECUTAR`, cria a tarefa real.

### Linear

1. Garanta `LINEAR_API_KEY` ou `LINEAR_OAUTH_TOKEN`.
2. Envie:

```text
lista os times do Linear
```

3. Copie o `teamId` retornado.
4. Envie:

```text
cria uma issue no Linear no time TEAM_ID com titulo Melhorar Action Queue e descricao testar fluxo completo do Orion
```

5. Resultado esperado: o Orion deve confirmar antes de criar ou criar direto se o comando estiver explicito e seguro para voce testar.
6. Para forcar o fluxo seguro, peça:

```text
prepare uma issue no Linear no time TEAM_ID com titulo Testar executor externo e deixe na Action Queue
```

7. Resultado esperado: preview externo aparece no Notification Center; a issue so nasce apos `EXECUTAR`.

## 32. DEV / Workspace Executor

1. Abra `/m/dev`.
2. Resultado esperado: a tela mostra o indice do workspace, extensoes mais comuns e lista de arquivos.
3. Clique em um arquivo.
4. Resultado esperado: o conteudo aparece em modo preview, sem editar nada.
5. Em `PATCH PROPOSAL`, coloque:

```text
docs/teste-orion-dev.md
```

6. No conteudo, escreva:

```md
# Teste Orion Dev

Arquivo criado pela Action Queue.
```

7. Clique `ENVIAR PARA ACTION QUEUE`.
8. Abra o sino / Notification Center.
9. Resultado esperado: aparece uma decisao externa `workspace` com preview do arquivo.
10. Clique `EXECUTAR`.
11. Resultado esperado: o arquivo e criado/atualizado dentro do workspace.
12. Segurança esperada: caminhos fora do workspace devem ser bloqueados.

## 33. Chat como executor de workspace

Esse teste valida o Orion agindo mais perto de um Claude Code/Codex dentro do proprio app.

1. No chat, envie:

```text
escaneia o workspace e me diga onde ficam as rotas principais do frontend
```

2. Resultado esperado: o Orion usa `workspace_scan`, entende a estrutura do monorepo e responde com caminhos reais.
3. Envie:

```text
leia apps/web/src/App.tsx e me explique as rotas que existem
```

4. Resultado esperado: ele usa `workspace_read_file` e explica com base no arquivo real.
5. Envie:

```text
prepare um arquivo docs/teste-chat-dev.md com um resumo curto dizendo que o chat consegue propor arquivos, mas deixe aguardando minha aprovacao
```

6. Resultado esperado: ele usa `workspace_prepare_file` e cria uma decisao na Action Queue. Nada deve ser escrito ainda.
7. Abra o sino / Notification Center.
8. Resultado esperado: aparece uma acao externa `workspace` com preview do caminho e conteudo.
9. Clique `EXECUTAR`.
10. Resultado esperado: o arquivo e criado no workspace.
11. Teste de seguranca:

```text
prepare um arquivo ../fora-do-projeto.md com qualquer texto
```

12. Resultado esperado: o Orion deve bloquear com erro de caminho fora do workspace.

13. Teste de patch cirurgico:

```text
leia docs/teste-chat-dev.md, troque apenas a frase "propor arquivos" por "propor patches e arquivos", e deixe aguardando minha aprovacao
```

14. Resultado esperado: o Orion deve usar `workspace_prepare_patch`, mostrar um diff pequeno e criar uma acao `workspace.patch_file`.
15. Ao clicar `EXECUTAR`, apenas o trecho indicado deve mudar. Se o bloco buscado nao existir ou aparecer duplicado, o Orion deve falhar sem alterar o arquivo.

16. Teste de comando aprovado:

```text
prepare para rodar npm run typecheck --workspace apps/api e deixe aguardando minha aprovacao
```

17. Resultado esperado: entra uma acao `workspace.run_command` na Action Queue com preview do comando.
18. Clique `EXECUTAR`.
19. Resultado esperado: o comando roda e o Notification Center mostra o resultado/saida do comando. Comandos fora da lista permitida devem ser bloqueados.
20. Depois, no chat envie:

```text
o que aconteceu na ultima execucao?
```

21. Resultado esperado: o Orion deve usar `workspace_recent_executions` e resumir o resultado real mais recente.
22. Para auto-debug, envie:

```text
diagnostica a ultima execucao, leia o arquivo provavel do erro e me proponha um patch pequeno se fizer sentido
```

23. Resultado esperado: o Orion usa `workspace_diagnose_last_execution`, identifica erro principal, aponta arquivos provaveis e so prepara patch depois de ler o arquivo real.
24. Na tela `/m/dev`, confira o card `AUTO DEBUG`.
25. Resultado esperado: aparece status PASS/FAIL/IDLE, erro principal, arquivos provaveis clicaveis e proximos passos.
26. No chat, envie:

```text
cria um runbook de debug da ultima falha e vai seguindo passo a passo
```

27. Resultado esperado: o Orion usa `workspace_debug_runbook`, lista passos de inspecao/patch/validacao e nao executa nada sensivel sem Action Queue.
28. Na tela `/m/dev`, confira o card `DEBUG RUNBOOK`.
29. Resultado esperado: ele mostra passos operacionais, botao para abrir arquivo-alvo e botao para preparar comando sugerido.
30. No chat, envie:

```text
mostra o mapa tecnico do projeto e me diga onde eu mexeria para criar um modulo novo
```

31. Resultado esperado: o Orion usa `workspace_context_map`, lista rotas/services/pages/hooks/types e sugere a sequencia correta de arquivos.
32. Na tela `/m/dev`, confira `CODE CONTEXT MAP`.
33. Resultado esperado: aparecem contadores de rotas/services/pages/hooks/types e atalhos clicaveis para arquivos importantes.

Quando testar, anote:

- Qual tela quebrou, se quebrar.
- O texto exato do erro.
- Se foi erro visual, print da tela inteira.
- Se foi erro de IA, a frase que voce enviou.
- Se foi integracao, qual provider: Gmail, Calendar, Drive etc.

Prioridade de bugs:

1. Chat nao responde.
2. Login/onboarding bloqueia acesso.
3. Integracoes nao reconectam.
4. Modulo salva mas some ao recarregar.
5. UI desalinhada/mobile ruim.
