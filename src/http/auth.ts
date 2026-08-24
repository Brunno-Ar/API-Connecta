import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../domain/errors.js';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function createApiKeyGuard(required: boolean, configuredKey?: string) {
  return function apiKeyGuard(request: FastifyRequest) {
    if (!required) return Promise.resolve();
    const supplied = request.headers['x-api-key'];
    if (typeof supplied !== 'string') {
      request.log.warn({ event: 'invalid_authentication', reason: 'missing_api_key' });
      throw new AppError('UNAUTHORIZED', 'A valid X-API-Key header is required.', 401);
    }
    if (!configuredKey || !timingSafeEqual(digest(supplied), digest(configuredKey))) {
      request.log.warn({ event: 'invalid_authentication', reason: 'invalid_api_key' });
      throw new AppError('UNAUTHORIZED', 'A valid X-API-Key header is required.', 401);
    }
    return Promise.resolve();
  };
}
