import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestContext } from './support/app.js';

describe('public documentation', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => app?.close());

  it('serves the Portuguese documentation interface at /doc', async () => {
    const context = await createTestContext();
    app = context.app;

    const response = await app.inject({ method: 'GET', url: '/doc' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('URL para enviar ao Connecta');
    expect(response.body).toContain('/api/v1/integrations/connecta-cx/interactions');
    expect(response.body).not.toContain(context.adminApiKey);
  });

  it('includes the application endpoints in the generated OpenAPI document', async () => {
    const context = await createTestContext();
    app = context.app;

    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const document = response.json<{ paths: Record<string, unknown> }>();

    expect(response.statusCode).toBe(200);
    expect(document.paths).toHaveProperty('/integrations/connecta-cx/interactions');
    expect(document.paths).toHaveProperty('/metrics');
    expect(document.paths).not.toHaveProperty('/doc');
  });
});
