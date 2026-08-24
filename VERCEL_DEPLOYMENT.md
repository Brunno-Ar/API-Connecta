# Deploy na Vercel

Este guia publica a API Fastify como uma Vercel Function e utiliza um PostgreSQL externo persistente.

## 1. Banco de dados

Crie um PostgreSQL gerenciado com connection pooling. Prisma Postgres, Neon e Supabase são opções compatíveis. Prefira uma região próxima da Function e nunca utilize a URL do PostgreSQL local definida no `docker-compose.yml`.

Guarde a URL de conexão com pooling como `DATABASE_URL`.

## 2. Projeto na Vercel

Há duas formas de publicar:

- enviar este projeto para GitHub, GitLab ou Bitbucket e importá-lo no dashboard da Vercel;
- executar `npx vercel` nesta pasta e seguir o login interativo.

A Vercel reconhece o `server.ts` da raiz como entrada Fastify. Ele exporta diretamente a aplicação criada em `src/app.ts`, evitando que a fábrica interna seja confundida com o entrypoint. Não é necessário criar `vercel.json`, pasta `api` ou projeto Next.js. Não configure Build Command nem Output Directory manualmente.

## 3. Variáveis de ambiente

Cadastre em Settings → Environment Variables:

```env
DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require
CONNECTA_CX_API_KEY=<chave-aleatoria-de-ingestao-com-24-ou-mais-caracteres>
AUTH_REQUIRED=true
ADMIN_API_KEY=<outra-chave-aleatoria-com-24-ou-mais-caracteres>
ADMIN_AUTH_REQUIRED=true
REQUIRE_EVENT_ID=false
REQUEST_BODY_LIMIT_BYTES=32768
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
CORS_ORIGINS=
LOG_LEVEL=info
NODE_ENV=production
```

Não é necessário cadastrar `HOST` ou `PORT` na Vercel.

Se o Connecta CX não aceitar `X-API-Key`, altere somente:

```env
AUTH_REQUIRED=false
```

Mantenha `ADMIN_AUTH_REQUIRED=true`. Assim, somente a entrada do webhook fica sem header; métricas e payloads continuam protegidos por `ADMIN_API_KEY`.

## 4. Migration inicial

Aplique as migrations exatamente uma vez antes de liberar a API. Em uma máquina ou job de CI que possua acesso seguro ao banco:

```bash
npm ci
npm run db:migrate
```

O comando usa `prisma migrate deploy` e não apaga dados. Não execute migrations dentro dos handlers HTTP nem em cada inicialização da Function.

## 5. Deploy

Por CLI:

```bash
npx vercel
npx vercel --prod
```

Por Git, faça push e importe o repositório no dashboard. Cada push na branch configurada gera um novo deploy.

O `postinstall` executa `prisma generate` automaticamente durante o build.

## 6. Validação

Substitua `<BASE_URL>` pelo domínio fornecido pela Vercel.

```http
GET <BASE_URL>/api/v1/health
```

Resultado esperado:

```json
{ "status": "ok" }
```

Envie então um evento de teste:

```bash
curl -X POST "<BASE_URL>/api/v1/integrations/connecta-cx/interactions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <CONNECTA_CX_API_KEY>" \
  -d '{
    "eventId": "deploy_test_001",
    "contactId": "contact_test",
    "botId": "bot_test",
    "tour_visitacao": "sim"
  }'
```

Se `AUTH_REQUIRED=false`, omita somente o header `X-API-Key` desse POST.

Consulte o resultado usando a chave administrativa:

```bash
curl "<BASE_URL>/api/v1/metrics" \
  -H "X-API-Key: <ADMIN_API_KEY>"
```

## 7. URL para o Connecta CX

Envie apenas esta URL de ingestão:

```text
<BASE_URL>/api/v1/integrations/connecta-cx/interactions
```

Todos os bots utilizam a mesma URL e informam `botId` no body.

## Observações operacionais

- O `Dockerfile` e o `docker-compose.yml` não são usados pela Vercel.
- Utilize a URL pooled do banco para evitar esgotamento de conexões em serverless.
- O rate limit em memória é aplicado por instância da Function, não globalmente.
- Preview deployments não devem aplicar migrations automaticamente no banco de produção.
- Ative `REQUIRE_EVENT_ID=true` quando o Connecta confirmar um identificador único de execução.
