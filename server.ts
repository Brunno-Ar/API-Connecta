import 'fastify';
import { loadEnvFile } from 'node:process';
import { buildApp } from './src/app.js';
import { loadConfig } from './src/config/env.js';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const app = buildApp({ config: loadConfig() });

export default app;
