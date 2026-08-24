import { buildApp } from '../../src/create-app.js';
import type { AppConfig } from '../../src/config/env.js';
import { MemoryInteractionRepository } from './memory-repository.js';

export const testConfig: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 3000,
  databaseUrl: 'postgresql://unused',
  apiKey: 'test-api-key-with-24-characters',
  authRequired: true,
  adminApiKey: 'test-admin-key-with-24-characters',
  adminAuthRequired: true,
  requireEventId: false,
  bodyLimit: 32_768,
  rateLimitMax: 1_000,
  rateLimitWindow: '1 minute',
  corsOrigins: [],
  logLevel: 'silent',
};

export async function createTestContext(overrides: Partial<AppConfig> = {}) {
  const repository = new MemoryInteractionRepository();
  const app = buildApp({
    config: { ...testConfig, ...overrides },
    repository,
    logger: false,
  });
  return {
    app,
    repository,
    apiKey: testConfig.apiKey!,
    adminApiKey: testConfig.adminApiKey!,
  };
}
