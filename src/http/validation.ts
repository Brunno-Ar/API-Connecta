import type { ZodType } from 'zod';
import { AppError } from '../domain/errors.js';

export function parseWith<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      'INVALID_PAYLOAD',
      'The request data is invalid.',
      422,
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
