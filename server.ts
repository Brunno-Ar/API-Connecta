import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnvFile } from 'node:process';
import Fastify from 'fastify';
import { buildApp } from './src/create-app.js';
import { loadConfig } from './src/config/env.js';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export const app = buildApp({ config: loadConfig() }, Fastify);
const ready = app.ready();

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await ready;
  app.server.emit('request', request, response);
}
