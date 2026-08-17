# Webhooks Strategy - O.R.I.O.N

Webhooks sao importantes para o Orion virar produto autonomo de verdade, porque evitam polling cego e permitem reagir a eventos externos em tempo real.

## Onde webhooks fazem sentido

### GitHub

Fonte oficial: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

Eventos úteis:
- push;
- pull_request;
- issues;
- workflow_run;
- check_run.

Uso no Orion:
- detectar PR quebrado;
- avisar quando CI falhar;
- criar Decision Inbox para comentar/criar issue;
- atualizar progresso de projeto automaticamente.

Seguranca:
- usar `GITHUB_WEBHOOK_SECRET`;
- validar `X-Hub-Signature-256`;
- nunca confiar em payload sem assinatura.

### Linear

Fonte oficial: https://linear.app/developers/webhooks

Eventos úteis:
- Issue criada/atualizada;
- Comment criado;
- Project update;
- Cycle update.

Uso no Orion:
- sincronizar tarefas de produto;
- detectar bloqueios;
- criar briefing de issues;
- abrir Decision Inbox para criar/comentar/alterar issue.

Seguranca:
- usar `LINEAR_WEBHOOK_SECRET`;
- validar header `Linear-Signature` com HMAC-SHA256 sobre raw body;
- checar `webhookTimestamp` para evitar replay.

### Slack

Fonte oficial: https://api.slack.com/docs/verifying-requests-from-slack

Eventos úteis:
- app_mention;
- message.channels;
- message.groups;
- reaction_added.

Uso no Orion:
- responder menções;
- resumir threads;
- criar decisões a partir de pedidos;
- transformar mensagens em tarefas.

Seguranca:
- usar `SLACK_SIGNING_SECRET`;
- validar assinatura Slack;
- envio de mensagem sempre passa pela Decision Inbox.

### Stripe

Uso futuro para SaaS:
- checkout.session.completed;
- customer.subscription.updated;
- invoice.payment_failed.

Seguranca:
- usar webhook secret do Stripe;
- atualizar plano do usuario apenas depois da assinatura validada.

## Dev local

Webhooks precisam de URL publica. Em desenvolvimento, usar um tunel:

```bash
ngrok http 3001
```

ou:

```bash
cloudflared tunnel --url http://localhost:3001
```

Exemplo de URL:

```text
https://seu-tunel.ngrok-free.app/v1/webhooks/linear
```

## Endpoints implementados agora

```text
POST /v1/webhooks/github
POST /v1/webhooks/linear
POST /v1/webhooks/slack
```

Comportamento atual:
- valida assinatura antes de processar;
- registra o evento em `WebhookEvent`;
- tenta mapear para usuario quando houver uma unica integracao compativel no banco;
- cria Decision Inbox para eventos acionaveis, sem executar a acao externa automaticamente.

Ainda pendente:
- configurar `GITHUB_WEBHOOK_SECRET` e `LINEAR_WEBHOOK_SECRET` no `.env`;
- ligar Docker/Postgres e rodar `npm run db:push --workspace apps/api`;
- criar mapeamento robusto `externalAccountId -> userId` quando OAuth multiusuario de GitHub/Linear/Slack estiver pronto;
- adicionar Stripe em uma fase de billing.

## URLs de desenvolvimento com tunnel

Quando o tunnel estiver ativo, use:

```text
https://SEU_TUNEL/v1/webhooks/github
https://SEU_TUNEL/v1/webhooks/linear
https://SEU_TUNEL/v1/webhooks/slack
```

## Regra de produto

Webhook pode:
- criar alerta;
- criar Decision Inbox;
- atualizar estado interno;
- registrar memoria/evento.

Webhook nao pode sem aprovacao:
- enviar mensagem;
- criar issue externa;
- comentar em nome do usuario;
- comprar;
- deletar/arquivar dados externos.
