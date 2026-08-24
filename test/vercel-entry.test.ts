import { afterAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

describe('Vercel entrypoint', () => {
  let app: FastifyInstance | undefined;

  afterAll(async () => app?.close());

  it('exports a ready Fastify instance from the root server file', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://unused');
    vi.stubEnv('CONNECTA_CX_API_KEY', 'test-ingestion-key-with-24-characters');
    vi.stubEnv('AUTH_REQUIRED', 'false');
    vi.stubEnv('ADMIN_API_KEY', 'test-admin-key-with-24-characters');
    vi.stubEnv('ADMIN_AUTH_REQUIRED', 'true');

    app = (await import('../server.js')).default;
    await app.ready();

    expect(typeof app.inject).toBe('function');
    expect(
      app.hasRoute({ method: 'POST', url: '/api/v1/integrations/connecta-cx/interactions' }),
    ).toBe(true);
  });
});
