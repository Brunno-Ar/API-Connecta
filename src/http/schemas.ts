import { z } from 'zod';

const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);
const structuralKeys = new Set(['eventId', 'contactId', 'botId']);
const selectionValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

function extractFlatSelections(body: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => !structuralKeys.has(key)),
  ) as Record<string, string | number | boolean | null>;
}

function validateSelections(
  selections: Record<string, string | number | boolean | null>,
  context: z.core.$RefinementCtx,
  nested: boolean,
) {
  const entries = Object.entries(selections);
  const pathFor = (key?: string) =>
    nested ? ['selections', ...(key ? [key] : [])] : key ? [key] : [];

  if (entries.length === 0) {
    context.addIssue({
      code: 'custom',
      path: pathFor(),
      message: 'At least one selection is required',
      input: selections,
    });
  }
  if (entries.length > 50) {
    context.addIssue({
      code: 'custom',
      path: pathFor(),
      message: 'At most 50 selections are allowed',
      input: selections,
    });
  }
  for (const [key] of entries) {
    if (key.length > 100) {
      context.addIssue({
        code: 'custom',
        path: pathFor(key),
        message: 'Key must have at most 100 characters',
        input: key,
      });
    }
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      context.addIssue({
        code: 'custom',
        path: pathFor(key),
        message: 'Key must be a stable snake_case identifier',
        input: key,
      });
    }
    if (blockedKeys.has(key)) {
      context.addIssue({
        code: 'custom',
        path: pathFor(key),
        message: 'Unsafe key is not allowed',
        input: key,
      });
    }
  }
}

const nestedInteractionBodySchema = z
  .object({
    eventId: z.string().trim().min(1).max(200).optional(),
    contactId: z.string().trim().min(1).max(200),
    botId: z.string().trim().min(1).max(200),
    selections: z.record(z.string(), selectionValueSchema),
  })
  .strict()
  .superRefine((body, context) => {
    validateSelections(body.selections, context, true);
  });

const flatInteractionBodySchema = z
  .object({
    eventId: z.string().trim().min(1).max(200).optional(),
    contactId: z.string().trim().min(1).max(200),
    botId: z.string().trim().min(1).max(200),
    selections: z.never().optional(),
  })
  .catchall(selectionValueSchema)
  .superRefine((body, context) => {
    validateSelections(extractFlatSelections(body), context, false);
  });

export const interactionBodySchema = z
  .union([nestedInteractionBodySchema, flatInteractionBodySchema])
  .transform((body) => {
    if ('selections' in body && body.selections !== undefined) return body;
    return {
      ...(body.eventId ? { eventId: body.eventId } : {}),
      contactId: body.contactId,
      botId: body.botId,
      selections: extractFlatSelections(body),
    };
  });

const optionalText = z.string().trim().min(1).max(200).optional();
const date = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const filtersSchema = z
  .object({
    botId: optionalText,
    contactId: optionalText,
    selectionKey: z.string().trim().min(1).max(100).optional(),
    selectionValue: z.string().max(500).optional(),
    from: date.optional(),
    to: date.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'from must be earlier than or equal to to',
    path: ['from'],
  });

export const listQuerySchema = filtersSchema.and(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
);

export const idParamsSchema = z.object({ id: z.uuid() });

const selectionValueJsonSchema = {
  anyOf: [
    { type: 'string', maxLength: 500 },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'null' },
  ],
} as const;

const nestedInteractionBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['contactId', 'botId', 'selections'],
  properties: {
    eventId: { type: 'string', minLength: 1, maxLength: 200 },
    contactId: { type: 'string', minLength: 1, maxLength: 200 },
    botId: { type: 'string', minLength: 1, maxLength: 200 },
    selections: {
      type: 'object',
      minProperties: 1,
      maxProperties: 50,
      propertyNames: { pattern: '^[a-z][a-z0-9_]*$', maxLength: 100 },
      additionalProperties: selectionValueJsonSchema,
    },
  },
} as const;

const flatInteractionBodyJsonSchema = {
  type: 'object',
  required: ['contactId', 'botId'],
  minProperties: 3,
  maxProperties: 53,
  propertyNames: {
    pattern: '^(?:eventId|contactId|botId|[a-z][a-z0-9_]*)$',
    maxLength: 100,
  },
  properties: {
    eventId: { type: 'string', minLength: 1, maxLength: 200 },
    contactId: { type: 'string', minLength: 1, maxLength: 200 },
    botId: { type: 'string', minLength: 1, maxLength: 200 },
    selections: { not: {} },
  },
  additionalProperties: selectionValueJsonSchema,
} as const;

export const interactionBodyJsonSchema = {
  anyOf: [nestedInteractionBodyJsonSchema, flatInteractionBodyJsonSchema],
} as const;

export const errorJsonSchema = {
  type: 'object',
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean', const: false },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
    },
  },
} as const;
