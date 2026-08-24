import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('environment validation', () => {
  it('rejects missing API key when authentication is required', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://db',
        AUTH_REQUIRED: 'true',
        ADMIN_AUTH_REQUIRED: 'false',
      }),
    ).toThrow();
  });

  it('allows unauthenticated ingestion while keeping admin endpoints protected', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://db',
      CONNECTA_CX_API_KEY: 'shared-api-key-with-24-characters',
      AUTH_REQUIRED: 'false',
    });
    expect(config.authRequired).toBe(false);
    expect(config.adminAuthRequired).toBe(true);
    expect(config.adminApiKey).toBe('shared-api-key-with-24-characters');
  });

  it('requires an admin key by default even when ingestion authentication is disabled', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgresql://db', AUTH_REQUIRED: 'false' })).toThrow();
  });
});
