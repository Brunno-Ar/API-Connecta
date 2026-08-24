import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1),
    CONNECTA_CX_API_KEY: z.string().min(24).optional(),
    AUTH_REQUIRED: booleanFromString,
    REQUIRE_EVENT_ID: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(1_048_576).default(32_768),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
    RATE_LIMIT_WINDOW: z.string().default('1 minute'),
    CORS_ORIGINS: z.string().default(''),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((env, context) => {
    if (env.AUTH_REQUIRED && !env.CONNECTA_CX_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['CONNECTA_CX_API_KEY'],
        message: 'CONNECTA_CX_API_KEY is required when AUTH_REQUIRED=true',
      });
    }
  });

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  apiKey?: string;
  authRequired: boolean;
  requireEventId: boolean;
  bodyLimit: number;
  rateLimitMax: number;
  rateLimitWindow: string;
  corsOrigins: string[];
  logLevel: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = envSchema.parse(environment);
  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    ...(env.CONNECTA_CX_API_KEY ? { apiKey: env.CONNECTA_CX_API_KEY } : {}),
    authRequired: env.AUTH_REQUIRED,
    requireEventId: env.REQUIRE_EVENT_ID,
    bodyLimit: env.REQUEST_BODY_LIMIT_BYTES,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitWindow: env.RATE_LIMIT_WINDOW,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    logLevel: env.LOG_LEVEL,
  };
}
