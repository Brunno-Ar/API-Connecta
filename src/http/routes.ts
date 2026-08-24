import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { InteractionRepository } from '../application/interaction-repository.js';
import { InteractionService, MetricsService } from '../application/services.js';
import type { InteractionFilters } from '../domain/interaction.js';
import {
  errorJsonSchema,
  filtersSchema,
  idParamsSchema,
  interactionBodyJsonSchema,
  interactionBodySchema,
  listQuerySchema,
} from './schemas.js';
import { parseWith } from './validation.js';

const filterQueryJsonSchema = {
  type: 'object',
  properties: {
    botId: { type: 'string', maxLength: 200 },
    contactId: { type: 'string', maxLength: 200 },
    selectionKey: { type: 'string', maxLength: 100 },
    selectionValue: { type: 'string', maxLength: 500 },
    from: { type: 'string', format: 'date-time' },
    to: { type: 'string', format: 'date-time' },
  },
} as const;

export function registerRoutes(
  app: FastifyInstance,
  repository: InteractionRepository,
  ingestionGuard: preHandlerHookHandler,
  adminGuard: preHandlerHookHandler,
  requireEventId: boolean,
) {
  const interactions = new InteractionService(repository, requireEventId);
  const metrics = new MetricsService(repository);

  app.get(
    '/api/v1/health',
    { schema: { tags: ['System'], summary: 'Health check' } },
    async (_request, reply) => {
      const healthy = await repository.isHealthy();
      return reply.code(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'unavailable' });
    },
  );

  app.post(
    '/api/v1/integrations/connecta-cx/interactions',
    {
      preHandler: ingestionGuard,
      schema: {
        tags: ['Connecta CX'],
        summary: 'Receive a completed bot interaction',
        security: [{ apiKey: [] }],
        body: interactionBodyJsonSchema,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: { interactionId: { type: 'string', format: 'uuid' } },
              },
            },
          },
          401: errorJsonSchema,
          409: errorJsonSchema,
          422: errorJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const input = parseWith(interactionBodySchema, request.body);
      request.log.info({
        event: 'interaction_received',
        eventId: input.eventId,
        botId: input.botId,
        contactId: input.contactId,
      });
      const result = await interactions.create(input, request.body);
      request.log.info({
        event: 'interaction_created',
        interactionId: result.id,
        eventId: input.eventId,
        botId: input.botId,
      });
      return reply.code(201).send({ success: true, data: { interactionId: result.id } });
    },
  );

  app.get(
    '/api/v1/interactions',
    {
      preHandler: adminGuard,
      schema: {
        tags: ['Interactions'],
        summary: 'List received interactions',
        security: [{ apiKey: [] }],
        querystring: {
          ...filterQueryJsonSchema,
          properties: {
            ...filterQueryJsonSchema.properties,
            page: {
              anyOf: [
                { type: 'integer', minimum: 1 },
                { type: 'string', pattern: '^[1-9][0-9]*$' },
              ],
              default: 1,
            },
            limit: {
              anyOf: [
                { type: 'integer', minimum: 1, maximum: 100 },
                { type: 'string', pattern: '^(?:[1-9]|[1-9][0-9]|100)$' },
              ],
              default: 20,
            },
          },
        },
      },
    },
    async (request) => {
      const query = parseWith(listQuerySchema, request.query);
      const { page, limit, ...filters } = query;
      const result = await interactions.list(filters, { page, limit });
      return {
        success: true,
        data: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    },
  );

  app.get(
    '/api/v1/interactions/:id',
    {
      preHandler: adminGuard,
      schema: {
        tags: ['Interactions'],
        summary: 'Get interaction details',
        security: [{ apiKey: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request) => ({
      success: true,
      data: await interactions.findById(parseWith(idParamsSchema, request.params).id),
    }),
  );

  const metricRoute = (
    path: string,
    summary: string,
    handler: (filters: InteractionFilters) => Promise<unknown>,
  ) => {
    app.get(
      path,
      {
        preHandler: adminGuard,
        schema: {
          tags: ['Metrics'],
          summary,
          security: [{ apiKey: [] }],
          querystring: filterQueryJsonSchema,
        },
      },
      async (request) => {
        request.log.info({ event: 'metrics_query', path });
        return { success: true, data: await handler(parseWith(filtersSchema, request.query)) };
      },
    );
  };

  metricRoute('/api/v1/metrics', 'Metrics overview', (filters) => metrics.getOverview(filters));
  metricRoute('/api/v1/metrics/summary', 'Metrics summary', (filters) =>
    metrics.getSummary(filters),
  );
  metricRoute('/api/v1/metrics/selections', 'Metrics grouped by selection', (filters) =>
    metrics.getSelections(filters),
  );
  metricRoute('/api/v1/metrics/bots', 'Metrics grouped by bot', (filters) =>
    metrics.getBots(filters),
  );
}
