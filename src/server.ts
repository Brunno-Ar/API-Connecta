import { loadEnvFile } from 'node:process';
import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

async function main() {
  const config = loadConfig();
  const app = buildApp({ config });

  const shutdown = async (signal: string) => {
    app.log.info({ event: 'shutdown_started', signal });
    await app.close();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
