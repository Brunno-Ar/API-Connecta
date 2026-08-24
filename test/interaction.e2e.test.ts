import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestContext } from './support/app.js';

const validBody = {
  eventId: 'evt_1',
  contactId: 'contact_1',
  botId: 'bot_1',
  selections: { tour_visitacao: 'sim', hotel: true },
};

describe('interaction HTTP flow', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => app?.close());

  it('creates an interaction, preserves raw payload and normalizes multiple/new selections', async () => {
    const context = await createTestContext();
    app = context.app;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey },
      payload: validBody,
    });
    expect(response.statusCode).toBe(201);
    const id = response.json().data.interactionId as string;
    expect(context.repository.items[0]?.rawPayload).toEqual(validBody);
    expect(context.repository.items[0]?.selections).toHaveLength(2);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/interactions/${id}`,
      headers: { 'x-api-key': context.adminApiKey },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.selections).toEqual(
      expect.arrayContaining([
        { key: 'tour_visitacao', value: 'sim' },
        { key: 'hotel', value: true },
      ]),
    );
  });

  it('accepts a flat Connecta payload on the same endpoint and normalizes extra pairs', async () => {
    const context = await createTestContext();
    app = context.app;
    const flatBody = {
      eventId: 'evt_flat_1',
      contactId: 'contact_flat_1',
      botId: 'bot_flat_1',
      tour_visitacao: 'sim',
      hotel: true,
      numero_convidados: 2,
    };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey },
      payload: flatBody,
    });

    expect(response.statusCode).toBe(201);
    expect(context.repository.items[0]?.rawPayload).toEqual(flatBody);
    expect(context.repository.items[0]?.selections).toEqual(
      expect.arrayContaining([
        { key: 'tour_visitacao', value: 'sim' },
        { key: 'hotel', value: true },
        { key: 'numero_convidados', value: 2 },
      ]),
    );
  });

  it('accepts a flat payload without eventId while it remains optional', async () => {
    const context = await createTestContext();
    app = context.app;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey },
      payload: {
        contactId: 'contact_flat_2',
        botId: 'bot_flat_2',
        menu_harmonizado: 'nao',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(context.repository.items[0]?.selections).toEqual([
      { key: 'menu_harmonizado', value: 'nao' },
    ]);
  });

  it('accepts a flat payload using only the endpoint when authentication is disabled', async () => {
    const context = await createTestContext({ authRequired: false });
    app = context.app;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      payload: {
        contactId: 'contact_url_only',
        botId: 'bot_url_only',
        tour_visitacao: 'sim',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(context.repository.items[0]?.selections).toEqual([
      { key: 'tour_visitacao', value: 'sim' },
    ]);

    const protectedMetrics = await app.inject({ method: 'GET', url: '/api/v1/metrics' });
    expect(protectedMetrics.statusCode).toBe(401);

    const ingestionKeyCannotReadMetrics = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics',
      headers: { 'x-api-key': context.apiKey },
    });
    expect(ingestionKeyCannotReadMetrics.statusCode).toBe(401);

    const authorizedMetrics = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics',
      headers: { 'x-api-key': context.adminApiKey },
    });
    expect(authorizedMetrics.statusCode).toBe(200);
  });

  it.each([
    ['missing contactId', { eventId: 'x', botId: 'b', selections: { option: 'yes' } }],
    ['missing botId', { eventId: 'x', contactId: 'c', selections: { option: 'yes' } }],
    ['missing selections', { eventId: 'x', contactId: 'c', botId: 'b' }],
    ['empty selections', { eventId: 'x', contactId: 'c', botId: 'b', selections: {} }],
    ['array selections', { eventId: 'x', contactId: 'c', botId: 'b', selections: ['yes'] }],
    [
      'nested value',
      { eventId: 'x', contactId: 'c', botId: 'b', selections: { option: { nested: true } } },
    ],
    [
      'oversized key',
      { eventId: 'x', contactId: 'c', botId: 'b', selections: { [`a${'x'.repeat(100)}`]: 'yes' } },
    ],
    [
      'oversized value',
      { eventId: 'x', contactId: 'c', botId: 'b', selections: { option: 'x'.repeat(501) } },
    ],
    [
      'unsafe/non-snake key',
      { eventId: 'x', contactId: 'c', botId: 'b', selections: { 'Reservar Tour': 'yes' } },
    ],
    [
      'flat payload with non-snake key',
      { eventId: 'x', contactId: 'c', botId: 'b', 'Reservar Tour': 'yes' },
    ],
    [
      'flat payload with nested value',
      { eventId: 'x', contactId: 'c', botId: 'b', option: { nested: true } },
    ],
  ])('rejects %s', async (_name, payload) => {
    const context = await createTestContext();
    app = context.app;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey },
      payload,
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('INVALID_PAYLOAD');
  });

  it('requires valid authentication', async () => {
    const context = await createTestContext();
    app = context.app;
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      payload: validBody,
    });
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': 'invalid' },
      payload: validBody,
    });
    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
  });

  it('rejects a duplicate event without creating it twice', async () => {
    const context = await createTestContext();
    app = context.app;
    const request = {
      method: 'POST' as const,
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey },
      payload: validBody,
    };
    expect((await app.inject(request)).statusCode).toBe(201);
    const duplicate = await app.inject(request);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('DUPLICATE_INTERACTION');
    expect(context.repository.items).toHaveLength(1);
  });

  it('can require eventId through configuration', async () => {
    const context = await createTestContext({ requireEventId: true });
    app = context.app;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey },
      payload: { ...validBody, eventId: undefined },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('EVENT_ID_REQUIRED');
  });

  it('rejects a request above the body limit', async () => {
    const context = await createTestContext({ bodyLimit: 256 });
    app = context.app;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ ...validBody, selections: { option: 'x'.repeat(500) } }),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns a safe 500 when persistence fails', async () => {
    const context = await createTestContext();
    app = context.app;
    context.repository.failCreate = true;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/connecta-cx/interactions',
      headers: { 'x-api-key': context.apiKey },
      payload: validBody,
    });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_ERROR');
  });
});
