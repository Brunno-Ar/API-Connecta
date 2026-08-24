import { spawnSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/create-app.js';
import type { AppConfig } from '../../src/config/env.js';

describe('PostgreSQL end-to-end flow', () => {
  let container: StartedPostgreSqlContainer;
  let app: FastifyInstance;
  const apiKey = 'e2e-api-key-with-24-characters';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    const databaseUrl = container.getConnectionUri();
    const migration = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
      },
    );
    if (migration.status !== 0) {
      throw new Error(
        migration.error?.message || migration.stderr || migration.stdout || 'Migration failed',
      );
    }

    const config: AppConfig = {
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 3000,
      databaseUrl,
      apiKey,
      authRequired: true,
      adminApiKey: apiKey,
      adminAuthRequired: true,
      requireEventId: true,
      bodyLimit: 32_768,
      rateLimitMax: 1_000,
      rateLimitWindow: '1 minute',
      corsOrigins: [],
      logLevel: 'silent',
    };
    app = buildApp({ config, logger: false });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('persists raw JSON and normalized selections, then aggregates correct metrics', async () => {
    const headers = { 'x-api-key': apiKey };
    const endpoint = '/api/v1/integrations/connecta-cx/interactions';
    const first = await app.inject({
      method: 'POST',
      url: endpoint,
      headers,
      payload: {
        eventId: 'pg_evt_1',
        contactId: 'contact_1',
        botId: 'bot_1',
        selections: { tour: 'sim', hotel: true, guests: 2 },
      },
    });
    const second = await app.inject({
      method: 'POST',
      url: endpoint,
      headers,
      payload: {
        eventId: 'pg_evt_2',
        contactId: 'contact_1',
        botId: 'bot_1',
        selections: { tour: 'sim', spa: null },
      },
    });
    const third = await app.inject({
      method: 'POST',
      url: endpoint,
      headers,
      payload: {
        eventId: 'pg_evt_3',
        contactId: 'contact_2',
        botId: 'bot_2',
        selections: { tour: 'nao' },
      },
    });
    expect([first.statusCode, second.statusCode, third.statusCode]).toEqual([201, 201, 201]);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/interactions/${first.json().data.interactionId}`,
      headers,
    });
    expect(detail.json().data.rawPayload.selections).toEqual({
      tour: 'sim',
      hotel: true,
      guests: 2,
    });
    expect(detail.json().data.selections).toHaveLength(3);

    const summary = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/summary?botId=bot_1',
      headers,
    });
    expect(summary.json().data).toEqual({
      totalInteractions: 2,
      totalSelections: 5,
      uniqueContacts: 1,
    });

    const selections = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/selections',
      headers,
    });
    expect(selections.json().data).toEqual(
      expect.arrayContaining([
        { key: 'tour', value: 'sim', selectionCount: 2, uniqueContacts: 1 },
        { key: 'tour', value: 'nao', selectionCount: 1, uniqueContacts: 1 },
      ]),
    );
  });

  it('enforces idempotency under the database unique constraint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': apiKey },
      payload: {
        eventId: 'pg_evt_1',
        contactId: 'other',
        botId: 'other',
        selections: { new_option: 'yes' },
      },
    });
    expect(response.statusCode).toBe(409);
  });
});
