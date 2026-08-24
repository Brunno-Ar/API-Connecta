# Connecta CX Metrics API

API standalone para receber o resultado de trilhas de bots do Connecta CX, preservar cada payload e disponibilizar métricas consultáveis. Todo o código usa nomes em inglês; esta documentação está em português do Brasil.

## Visão geral

```text
Connecta CX → HTTP/Fastify → autenticação e validação → serviços → repositório → PostgreSQL
                                                                    ├─ interactions (JSON original)
                                                                    └─ interaction_selections (pares normalizados)
```

A API não consulta o Connecta CX. O Connecta CX envia uma chamada para uma única URL ao final de cada trilha. O contrato mantém `eventId`, `contactId` e `botId` como metadados estruturais e aceita opções futuras dentro de `selections` ou como pares no nível principal, sem migration por opção.

## Arquitetura e decisões

- **Node.js 22 + TypeScript strict + Fastify:** baixo overhead, schemas HTTP e bom suporte a logs estruturados.
- **Zod:** validação centralizada do contrato e das variáveis de ambiente.
- **PostgreSQL 17:** `jsonb`, constraints, índices, transações e agregações maduras.
- **Prisma:** client tipado e migrations. Consultas agregadas usam SQL parametrizado pelo Prisma.
- **Vitest:** testes unitários/HTTP e end-to-end com PostgreSQL isolado via Testcontainers.
- **Documentação pública + OpenAPI 3:** guia em português em `/doc` e Swagger técnico em `/docs`.

Responsabilidades:

```text
src/http              rotas, autenticação, schemas e apresentação de erros
src/application       casos de uso e contrato do repositório
src/domain            tipos e erros de negócio
src/infrastructure    Prisma e implementação PostgreSQL
prisma                schema e migrations versionadas
test                  testes HTTP, métricas e end-to-end PostgreSQL
```

O controller não contém consultas. A criação de `Interaction` e de todas as `InteractionSelection` ocorre em uma única transação do Prisma. O payload validado completo é salvo em `interactions.raw_payload` (`jsonb`). Cada par de `selections` gera uma linha normalizada com o valor em JSON e uma representação indexável em texto.

## Instalação local

Pré-requisitos: Node.js 22+, Docker e Docker Compose.

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run prisma:generate
npm run db:migrate
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`.

Documentação: `http://localhost:3000/doc`. Swagger UI: `http://localhost:3000/docs`. Saúde: `http://localhost:3000/api/v1/health`.

## Variáveis de ambiente

| Variável                   | Obrigatória/padrão                       | Função                                                                    |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`             | obrigatória                              | URL PostgreSQL; use conexão com pooling em ambiente serverless            |
| `CONNECTA_CX_API_KEY`      | obrigatória se `AUTH_REQUIRED=true`      | chave de ingestão com no mínimo 24 caracteres                             |
| `AUTH_REQUIRED`            | `true`                                   | exige a chave de ingestão no POST do Connecta                             |
| `ADMIN_API_KEY`            | recomendada; fallback para a chave acima | chave separada para métricas e consulta de payloads                       |
| `ADMIN_AUTH_REQUIRED`      | `true`                                   | protege os endpoints de métricas e interações, mesmo com ingestão pública |
| `REQUIRE_EVENT_ID`         | `false`                                  | rejeita ingestões sem `eventId` quando `true`                             |
| `REQUEST_BODY_LIMIT_BYTES` | `32768`                                  | limite total do body                                                      |
| `RATE_LIMIT_MAX`           | `100`                                    | máximo de requisições por janela e instância                              |
| `RATE_LIMIT_WINDOW`        | `1 minute`                               | janela do rate limit                                                      |
| `CORS_ORIGINS`             | vazio                                    | origens permitidas, separadas por vírgula; vazio desabilita CORS          |
| `HOST` / `PORT`            | `0.0.0.0` / `3000`                       | bind HTTP local; a Vercel gerencia isso em produção                       |
| `LOG_LEVEL`                | `info`                                   | nível Pino                                                                |
| `NODE_ENV`                 | `development`                            | ambiente                                                                  |

Nunca publique `.env`. Gere uma chave aleatória longa, armazene-a no secret manager da hospedagem e rotacione-a quando necessário.

## Contrato de ingestão

`POST /api/v1/integrations/connecta-cx/interactions`

Todos os bots e contatos utilizam essa mesma URL. O `botId` presente no body identifica a origem.

```http
Content-Type: application/json
X-API-Key: <secret>
```

```json
{
  "eventId": "evt_123456",
  "contactId": "contact_789",
  "botId": "bot_001",
  "selections": {
    "tour_visitacao": "sim",
    "hospedagem_hotel": true,
    "numero_convidados": 2
  }
}
```

O mesmo endpoint também aceita o formato plano para facilitar a configuração nativa do webhook do Connecta CX:

```json
{
  "eventId": "evt_123456",
  "contactId": "contact_789",
  "botId": "bot_001",
  "tour_visitacao": "sim",
  "hospedagem_hotel": true,
  "numero_convidados": 2
}
```

No formato plano, `eventId`, `contactId` e `botId` são campos reservados. Todos os demais pares são convertidos automaticamente em seleções normalizadas. O payload plano original continua preservado em `raw_payload`.

Resposta `201 Created`:

```json
{
  "success": true,
  "data": { "interactionId": "8c597b72-d7de-478f-b71d-314376cf130c" }
}
```

### Limites e regras

- `contactId` e `botId`: obrigatórios, 1–200 caracteres.
- `eventId`: opcional no schema, 1–200 caracteres quando enviado.
- Deve existir de 1 a 50 seleções, dentro de `selections` ou como pares adicionais no formato plano.
- Chaves: 1–100 caracteres e identificador estável `snake_case` (`^[a-z][a-z0-9_]*$`).
- Valores: somente `string` (até 500 caracteres), número finito, booleano ou `null`.
- Objetos e arrays aninhados não são aceitos: não há necessidade atual e aumentariam profundidade, ambiguidade e superfície de abuso.
- Chaves perigosas de prototype pollution são rejeitadas.
- Body: 32 KiB por padrão, configurável até 1 MiB.
- Não misture os dois formatos na mesma chamada. No formato aninhado, campos estruturais desconhecidos são rejeitados; no formato plano, pares adicionais válidos são tratados como seleções.

Não use o texto visual do botão como chave. O rótulo pode mudar; o identificador técnico deve permanecer estável.

## Idempotência

Quando `eventId` é enviado, `external_event_id` possui constraint `UNIQUE`. A verificação na aplicação melhora a resposta e a constraint do PostgreSQL protege inclusive contra concorrência. Uma repetição retorna `409 DUPLICATE_INTERACTION` com o ID existente e não altera métricas.

Ainda depende do Connecta CX confirmar um identificador único real. Enquanto isso:

- `REQUIRE_EVENT_ID=false`: aceita payload sem `eventId`, de forma **explicitamente não idempotente**. Cada retry será uma nova interação.
- `REQUIRE_EVENT_ID=true`: opção recomendada para produção assim que o identificador for confirmado; payload sem ID retorna `422 EVENT_ID_REQUIRED`.
- Se o Connecta CX não possuir ID de execução, alternativas a negociar são um header `Idempotency-Key` único gerado na origem ou um identificador composto garantido pelo provedor. Hash de conteúdo/janela temporal não foi implementado porque pode colidir com interações legítimas ou deixar passar retries.

## Endpoints

| Método | Caminho                                         | Uso                              |
| ------ | ----------------------------------------------- | -------------------------------- |
| `GET`  | `/api/v1/health`                                | saúde da API e do banco; público |
| `POST` | `/api/v1/integrations/connecta-cx/interactions` | ingestão                         |
| `GET`  | `/api/v1/interactions`                          | lista paginada                   |
| `GET`  | `/api/v1/interactions/{id}`                     | payload e seleções da interação  |
| `GET`  | `/api/v1/metrics`                               | resumo + agrupamento por seleção |
| `GET`  | `/api/v1/metrics/summary`                       | totais gerais                    |
| `GET`  | `/api/v1/metrics/selections`                    | agrupamento por chave e valor    |
| `GET`  | `/api/v1/metrics/bots`                          | agrupamento por bot              |

Com `AUTH_REQUIRED=true`, o endpoint de ingestão exige `CONNECTA_CX_API_KEY`. Caso o Connecta CX não consiga enviar headers, `AUTH_REQUIRED=false` permite chamar essa URL somente com o body. Os endpoints de métricas e interações continuam protegidos por `ADMIN_API_KEY` enquanto `ADMIN_AUTH_REQUIRED=true`. Se `ADMIN_API_KEY` não for informada, a chave do Connecta é usada como fallback. Listas aceitam `page` (padrão 1) e `limit` (padrão 20, máximo 100). Os filtros disponíveis são `botId`, `contactId`, `selectionKey`, `selectionValue`, `from` e `to`. Datas devem ser ISO 8601 com offset, por exemplo `2026-08-20T15:30:00Z`; limites são inclusivos.

Filtros de seleção definem o conjunto de interações que contém o par informado. As agregações então descrevem todas as escolhas desse conjunto, permitindo analisar combinações. Para obter só uma chave no resultado, filtre o array retornado no consumidor ou consulte o par exato.

### Semântica das métricas

- `totalInteractions`: execuções recebidas, deduplicadas quando `eventId` existe.
- `totalSelections`: soma dos pares normalizados nas interações filtradas.
- `uniqueContacts`: `contactId` distintos nas interações filtradas.
- `selectionCount`: quantidade de interações que registraram aquele par chave/valor. Uma chave só pode ocorrer uma vez por interação.
- `uniqueContacts` em uma seleção: contatos distintos que registraram aquele par, mesmo que o mesmo contato interaja várias vezes.

Exemplo: um contato faz duas interações e escolhe `tour=sim` nas duas. O par terá `selectionCount=2` e `uniqueContacts=1`.

## Erros

Formato uniforme:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "The request data is invalid.",
    "details": [{ "path": "selections", "message": "At least one selection is required" }]
  }
}
```

| HTTP  | Situação típica                                       |
| ----- | ----------------------------------------------------- |
| `400` | JSON malformado                                       |
| `401` | API Key ausente/inválida                              |
| `404` | rota ou interação inexistente                         |
| `409` | `eventId` duplicado                                   |
| `413` | body acima do limite                                  |
| `422` | contrato semanticamente inválido ou `eventId` exigido |
| `429` | rate limit                                            |
| `500` | erro inesperado, sem detalhe interno                  |
| `503` | banco indisponível/health degradado                   |

`403` deve ser usado futuramente apenas se houver autorização por escopo; hoje a API possui autenticação de secret compartilhado e não inventa papéis. Erros automáticos de rate limit seguem o payload do plugin Fastify; os erros de aplicação seguem o envelope acima.

## Logs e segurança

Logs são JSON estruturados e incluem request ID, bot/contact/event/interaction IDs quando úteis. Eventos de aplicação incluem `interaction_received`, `interaction_created`, `duplicate_interaction`, `invalid_payload`, `invalid_authentication`, `database_error` e `metrics_query`. API Keys e tokens nunca são registrados; o payload completo também não é logado.

Controles implementados: chaves separáveis para ingestão e administração, comparação constante de hashes, limite de body, rate limit, Helmet, CORS fechado por padrão, Zod/Ajv, tipos primitivos, chaves seguras, SQL parametrizado, transação, constraint de idempotência e respostas sem stack trace. Em produção, HTTPS deve terminar no load balancer/proxy e o PostgreSQL deve usar TLS/rede privada, backup, menor privilégio e observabilidade. Na Vercel, o rate limit atual vale por instância; para um limite global, use storage compartilhado ou o Vercel Firewall.

Armazene somente identificadores necessários. `rawPayload` preserva o JSON recebido e pode conter dados adicionados futuramente; mantenha o contrato restrito, defina retenção e controle o acesso ao endpoint de detalhes.

## Migrations e testes

```bash
npm run db:migrate       # aplica migrations versionadas
npm run db:migrate:dev   # cria migration durante desenvolvimento
npm test                 # testes rápidos, sem banco externo
npm run test:coverage
npm run test:e2e         # PostgreSQL efêmero isolado; requer Docker
npm run typecheck
npm run lint
npm run format:check
npm run build
```

O E2E inicia um container PostgreSQL exclusivo, aplica a migration e valida `HTTP → validação → serviço → PostgreSQL → JSON original + seleções → métricas`. Ele nunca usa nem limpa um banco configurado pelo usuário ou de produção.

## Deploy

### Vercel

A Vercel detecta o `server.ts` da raiz e o executa como uma Function. Esse entrypoint exporta um handler Node explícito que encaminha a requisição para a instância Fastify, evitando dependência da inferência estática da plataforma e ambiguidade com a fábrica interna `src/create-app.ts`. Não configure Build Command ou Output Directory manualmente. O script `postinstall` gera o Prisma Client durante cada build. O script `vercel-build` aplica migrations pendentes de forma idempotente antes da compilação.

Use um PostgreSQL gerenciado com connection pooling, como Prisma Postgres, Neon ou Supabase. O PostgreSQL do `docker-compose.yml` é somente local.

Fluxo recomendado:

```bash
# depois de criar o banco e obter DATABASE_URL
npm run db:migrate

# deploy por CLI; alternativamente importe o repositório no dashboard
npx vercel
npx vercel --prod
```

Cadastre todas as variáveis da seção anterior para Production. Não coloque `prisma migrate deploy` no início da Function nem execute migrations a cada requisição. Neste projeto, ele roda uma vez na etapa `vercel-build`, antes da liberação da Function.

Depois do deploy, valide:

```text
GET  https://<projeto>.vercel.app/api/v1/health
POST https://<projeto>.vercel.app/api/v1/integrations/connecta-cx/interactions
GET  https://<projeto>.vercel.app/docs
```

O procedimento completo está em [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

### Docker

O `Dockerfile` usa multi-stage build e executa `prisma migrate deploy` antes do servidor. Exemplo:

```bash
docker build -t connecta-cx-metrics-api .
docker run --rm -p 3000:3000 --env-file .env connecta-cx-metrics-api
```

Em produção: use um PostgreSQL gerenciado, injete secrets pelo provedor, configure HTTPS, health check em `/api/v1/health`, réplicas conforme carga e alertas para 5xx/latência. Para deploys concorrentes, prefira executar migrations como job único antes de liberar as réplicas.

## Integração Connecta CX

O material que pode ser encaminhado ao fornecedor está em [CONNECTA_CX_INTEGRATION.md](./CONNECTA_CX_INTEGRATION.md). Antes da produção, confirme:

1. capacidade de enviar `X-API-Key` (ou outro header customizado);
2. nome e garantia de unicidade do ID de execução que será mapeado para `eventId`.

## Troubleshooting

- **Servidor não inicia:** valide `DATABASE_URL`, `CONNECTA_CX_API_KEY` e `ADMIN_API_KEY` conforme as flags de autenticação.
- **Health 503:** confirme conectividade, credenciais, migrations e TLS do PostgreSQL.
- **401:** confirme o header exato `X-API-Key`; não use query string.
- **409:** o evento já foi recebido; use `existingInteractionId` para rastrear.
- **422 em uma chave:** use `snake_case`, mantenha-a estável e respeite os limites.
- **Prisma Client desatualizado:** rode `npm run prisma:generate`.
