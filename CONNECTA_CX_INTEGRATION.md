# Integração Connecta CX

Este documento descreve o envio, pelo Connecta CX, do resultado final de uma trilha de bot para a API de métricas.

## Pendências antes da produção

Precisamos de confirmação do Connecta CX sobre dois pontos:

1. A chamada permite enviar um header HTTP personalizado, preferencialmente `X-API-Key`?
2. Qual identificador único e imutável da execução pode ser enviado (`eventId`, `interactionId`, `conversationId`, `protocolId`, `flowExecutionId` ou equivalente)?

O endpoint já suporta a solução preferida abaixo. O valor real da URL e a chave serão informados de modo seguro quando a hospedagem estiver definida.

## Endpoint

```http
POST <BASE_URL>/api/v1/integrations/connecta-cx/interactions
```

Não existe um endpoint por bot. Todos os bots usam o mesmo caminho e informam `botId` no JSON.

Essa é a única URL que precisa ser configurada. A cada conclusão de trilha, o Connecta CX realiza um novo `POST` para ela com os dados do contato atual.

## Headers

```http
Content-Type: application/json
X-API-Key: <API_KEY>
```

Não envie a API Key no body, na URL ou em parâmetros de consulta. A chamada deverá usar HTTPS em produção.

Se a plataforma não suportar headers personalizados, a operação poderá configurar a API com `AUTH_REQUIRED=false`. Nesse modo, o Connecta CX precisa apenas cadastrar a URL e o body JSON, mas o endpoint ficará sem autenticação própria; por isso essa decisão deve ser confirmada antes da produção e protegida na infraestrutura quando possível.

## Body

### Formato plano recomendado para configuração no Connecta CX

```json
{
  "eventId": "evt_123456",
  "contactId": "contact_789",
  "botId": "bot_001",
  "tour_visitacao": "sim",
  "menu_harmonizado": "nao",
  "hospedagem_hotel": "sim"
}
```

Os campos `eventId`, `contactId` e `botId` são reservados para identificação. Todos os outros pares são interpretados automaticamente como seleções. Novos pares podem ser adicionados sem alterar a URL, o banco de dados ou o código da API.

### Formato aninhado também aceito

```json
{
  "eventId": "evt_123456",
  "contactId": "contact_789",
  "botId": "bot_001",
  "selections": {
    "tour_visitacao": "sim",
    "menu_harmonizado": "nao",
    "hospedagem_hotel": "sim"
  }
}
```

### Significado dos campos

- `eventId`: identificador único e imutável desta execução/evento. Deve ser o mesmo em retries e diferente em interações distintas. É opcional apenas enquanto a capacidade do Connecta CX está pendente; será exigido em produção se disponível.
- `contactId`: identificador estável do contato dentro do Connecta CX. Não envie nome, telefone ou outros dados pessoais se o ID for suficiente.
- `botId`: identificador estável do bot que originou a interação.
- `selections`: no formato aninhado, objeto dinâmico contendo todas as escolhas feitas pelo contato na trilha concluída. No formato plano, esse objeto é omitido e as escolhas são enviadas diretamente como pares adicionais.

`contactId` e `botId` são sempre obrigatórios. Também é obrigatória pelo menos uma seleção, aninhada ou plana. `eventId` é fortemente recomendado.

## Regras de `selections`

- Deve ser um objeto JSON e conter de 1 a 50 chaves.
- Não envie array no lugar do objeto.
- Cada valor deve ser `string`, número finito, booleano ou `null`.
- Não envie objetos ou arrays aninhados.
- Chaves têm no máximo 100 caracteres; strings têm no máximo 500.
- Use identificadores técnicos estáveis em `snake_case`: letras minúsculas, números e `_`, iniciando por letra.
- Não misture seleções planas com o objeto `selections` na mesma chamada.

Correto:

```json
{
  "selections": {
    "tour_visitacao": "sim",
    "menu_harmonizado": "sim",
    "hospedagem_hotel": "nao"
  }
}
```

Não use `tour`, depois `tour_visitacao` e depois `Reservar Tour` para a mesma escolha. Isso geraria três métricas. O texto visível do botão pode mudar; o identificador técnico não deve mudar.

Novas chaves podem ser adicionadas sem aviso técnico ou migration, desde que respeitem essas regras.

## Resposta de sucesso

```http
HTTP/1.1 201 Created
Content-Type: application/json
```

```json
{
  "success": true,
  "data": {
    "interactionId": "8c597b72-d7de-478f-b71d-314376cf130c"
  }
}
```

Considere a entrega concluída somente após receber `201`.

## Retries e idempotência

Em timeout ou erro `5xx`, a chamada pode ser repetida com o **mesmo `eventId`**. Nunca gere um novo ID para o retry. A API impede dupla contagem por esse valor.

Se a primeira chamada tiver sido persistida mas a resposta se perder, o retry retorna:

```http
HTTP/1.1 409 Conflict
```

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_INTERACTION",
    "message": "An interaction with this eventId already exists.",
    "existingInteractionId": "8c597b72-d7de-478f-b71d-314376cf130c"
  }
}
```

Esse `409` significa que o evento já está registrado e deve ser tratado como entrega idempotente bem-sucedida pelo emissor. Não faça retry de erros `400`, `401`, `409`, `413` ou `422` sem corrigir a causa. Para `429`, respeite o tempo de espera; para `500/503` ou timeout, use backoff exponencial com jitter.

Sem um identificador único não é possível garantir idempotência corretamente. Não usamos hash de payload ou janela temporal, pois duas interações legítimas podem ser iguais. Se o Connecta CX não possuir ID de execução, precisamos combinar o envio de um `Idempotency-Key` único antes de ativar a integração em produção.

## Erros

Formato geral:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "The request data is invalid."
  }
}
```

| HTTP  | Código comum                            | Ação                           |
| ----- | --------------------------------------- | ------------------------------ |
| `400` | `BAD_REQUEST`                           | corrigir JSON/Content-Type     |
| `401` | `UNAUTHORIZED`                          | conferir `X-API-Key`           |
| `409` | `DUPLICATE_INTERACTION`                 | considerar já entregue         |
| `413` | `PAYLOAD_TOO_LARGE`                     | reduzir o body                 |
| `422` | `INVALID_PAYLOAD` / `EVENT_ID_REQUIRED` | corrigir campos e limites      |
| `429` | rate limit                              | aguardar e repetir com backoff |
| `500` | `INTERNAL_ERROR`                        | repetir com backoff            |
| `503` | `DATABASE_UNAVAILABLE`                  | repetir com backoff            |

## Checklist do Connecta CX

- Confirmar suporte ao header `X-API-Key`.
- Informar qual campo será usado como `eventId` e sua garantia de unicidade.
- Informar os `botId` reais.
- Definir e manter um catálogo de chaves `snake_case` estáveis.
- Enviar somente identificadores necessários, sem dados pessoais adicionais.
- Reutilizar o mesmo `eventId` em retries.
- Aceitar `409 DUPLICATE_INTERACTION` como evento já entregue.
- Usar HTTPS e `Content-Type: application/json`.
