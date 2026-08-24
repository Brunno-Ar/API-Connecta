import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/env.js';
import type { InteractionRepository } from './application/interaction-repository.js';
import { AppError, DuplicateInteractionError } from './domain/errors.js';
import { createApiKeyGuard } from './http/auth.js';
import { registerRoutes } from './http/routes.js';
import { createPrismaClient } from './infrastructure/prisma.js';
import { PrismaInteractionRepository } from './infrastructure/prisma-interaction-repository.js';

export interface BuildAppOptions {
  config: AppConfig;
  repository?: InteractionRepository;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logger === false ? false : { level: options.config.logLevel },
    bodyLimit: options.config.bodyLimit,
    requestIdHeader: 'x-request-id',
    ajv: { customOptions: { coerceTypes: false } },
  });

  let repository = options.repository;
  if (!repository) {
    const prisma = createPrismaClient(options.config.databaseUrl);
    repository = new PrismaInteractionRepository(prisma);
    app.addHook('onClose', async () => prisma.$disconnect());
  }

  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: options.config.corsOrigins.length === 0 ? false : options.config.corsOrigins,
  });
  app.register(rateLimit, {
    max: options.config.rateLimitMax,
    timeWindow: options.config.rateLimitWindow,
  });
  app.register(swagger, {
    openapi: {
      info: {
        title: 'Connecta CX Metrics API',
        description: 'Receives bot interaction selections and exposes aggregate metrics.',
        version: '1.0.0',
      },
      servers: [{ url: '/api/v1', description: 'Current server' }],
      components: {
        securitySchemes: {
          apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        },
      },
    },
  });
  app.register(swaggerUi, { routePrefix: '/docs' });

  registerRoutes(
    app,
    repository,
    createApiKeyGuard(options.config.authRequired, options.config.apiKey),
    createApiKeyGuard(options.config.adminAuthRequired, options.config.adminApiKey),
    options.config.requireEventId,
  );

  app.setNotFoundHandler((_request, reply) => {
    void reply
      .code(404)
      .send({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DuplicateInteractionError) {
      request.log.info({
        event: 'duplicate_interaction',
        existingInteractionId: error.existingInteractionId,
      });
    } else if (error instanceof AppError && error.code === 'INVALID_PAYLOAD') {
      request.log.warn({ event: 'invalid_payload', details: error.details });
    } else if (!(error instanceof AppError) || error.statusCode >= 500) {
      request.log.error({ event: 'database_error', error });
    }

    if (error instanceof AppError) {
      const payload = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
          ...(error instanceof DuplicateInteractionError
            ? { existingInteractionId: error.existingInteractionId }
            : {}),
        },
      };
      return reply.code(error.statusCode).send(payload);
    }

    const fastifyError = error as Error & {
      code?: string;
      statusCode?: number;
      validation?: Array<{ instancePath?: string; message?: string }>;
    };
    if (fastifyError.validation) {
      request.log.warn({ event: 'invalid_payload', details: fastifyError.validation });
      return reply.code(422).send({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'The request data is invalid.',
          details: fastifyError.validation.map((issue) => ({
            path: issue.instancePath ?? '',
            message: issue.message ?? 'Invalid value',
          })),
        },
      });
    }
    if (fastifyError.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The request body exceeds the configured limit.',
        },
      });
    }
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'The request could not be parsed.' },
      });
    }
    return reply.code(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  return app;
}
