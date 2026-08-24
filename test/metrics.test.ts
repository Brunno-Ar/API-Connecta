import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestContext } from './support/app.js';
import type { MemoryInteractionRepository } from './support/memory-repository.js';

describe('metrics and queries', () => {
  let app: FastifyInstance;
  let repository: MemoryInteractionRepository;
  let headers: Record<string, string>;

  beforeEach(async () => {
    const context = await createTestContext();
    app = context.app;
    repository = context.repository;
    headers = { 'x-api-key': context.apiKey };
    await repository.create({
      eventId: 'e1',
      contactId: 'c1',
      botId: 'bot_a',
      selections: { tour: 'sim', hotel: true },
    });
    await repository.create({
      eventId: 'e2',
      contactId: 'c1',
      botId: 'bot_a',
      selections: { tour: 'sim' },
    });
    await repository.create({
      eventId: 'e3',
      contactId: 'c2',
      botId: 'bot_b',
      selections: { tour: 'nao', evento: 'casamento' },
    });
    repository.items[0]!.receivedAt = new Date('2026-08-18T10:00:00Z');
    repository.items[1]!.receivedAt = new Date('2026-08-19T10:00:00Z');
    repository.items[2]!.receivedAt = new Date('2026-08-20T10:00:00Z');
  });

  afterEach(async () => app.close());

  it('distinguishes interactions, selections and unique contacts', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/metrics', headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      totalInteractions: 3,
      totalSelections: 5,
      uniqueContacts: 2,
    });
    expect(response.json().data.selections).toEqual(
      expect.arrayContaining([
        { key: 'tour', value: 'sim', selectionCount: 2, uniqueContacts: 1 },
        { key: 'tour', value: 'nao', selectionCount: 1, uniqueContacts: 1 },
      ]),
    );
  });

  it('filters by bot and contact', async () => {
    const byBot = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/summary?botId=bot_a',
      headers,
    });
    const byContact = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/summary?contactId=c2',
      headers,
    });
    expect(byBot.json().data).toEqual({
      totalInteractions: 2,
      totalSelections: 3,
      uniqueContacts: 1,
    });
    expect(byContact.json().data).toEqual({
      totalInteractions: 1,
      totalSelections: 2,
      uniqueContacts: 1,
    });
  });

  it('filters by period and rejects an inverted period', async () => {
    const filtered = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/summary?from=2026-08-19T00%3A00%3A00Z&to=2026-08-19T23%3A59%3A59Z',
      headers,
    });
    expect(filtered.json().data.totalInteractions).toBe(1);
    const invalid = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics/summary?from=2026-08-20T00%3A00%3A00Z&to=2026-08-19T00%3A00%3A00Z',
      headers,
    });
    expect(invalid.statusCode).toBe(422);
  });

  it('filters interactions by selection key and value', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/interactions?selectionKey=tour&selectionValue=nao',
      headers,
    });
    expect(response.json().pagination.total).toBe(1);
    expect(response.json().data[0].contactId).toBe('c2');
  });

  it('groups metrics by multiple bots', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/metrics/bots', headers });
    expect(response.json().data).toEqual(
      expect.arrayContaining([
        { botId: 'bot_a', totalInteractions: 2, totalSelections: 3, uniqueContacts: 1 },
        { botId: 'bot_b', totalInteractions: 1, totalSelections: 2, uniqueContacts: 1 },
      ]),
    );
  });

  it('paginates interaction lists', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/api/v1/interactions?page=1&limit=2',
      headers,
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/v1/interactions?page=2&limit=2',
      headers,
    });
    expect(first.json().data).toHaveLength(2);
    expect(first.json().pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(second.json().data).toHaveLength(1);
  });

  it('reports database health without exposing details', async () => {
    expect((await app.inject('/api/v1/health')).json()).toEqual({ status: 'ok' });
    repository.healthy = false;
    const response = await app.inject('/api/v1/health');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
  });
});
