import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('environment validation', () => {
  it('rejects missing API key when authentication is required', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgresql://db', AUTH_REQUIRED: 'true' })).toThrow();
  });

  it('allows an explicitly unauthenticated local configuration', () => {
    const config = loadConfig({ DATABASE_URL: 'postgresql://db', AUTH_REQUIRED: 'false' });
    expect(config.authRequired).toBe(false);
  });
});
