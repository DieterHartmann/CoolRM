import './config.js'; // validates env on import — must be first
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { disconnectPlatformClient, disconnectAllTenantClients } from '@crm/db';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(helmet);

  await app.register(cors, {
    origin: config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(sensible);

  await app.register(rateLimit, {
    global: false, // opt-in per route
  });

  // ── Health ────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    ts: new Date().toISOString(),
    env: config.NODE_ENV,
  }));

  // ── TODO Phase 1: register route plugins here ─────────────────────────────
  // await app.register(authRoutes, { prefix: '/api/v1/auth' });
  // await app.register(contactRoutes, { prefix: '/api/v1/contacts' });
  // await app.register(tenantRoutes, { prefix: '/api/v1/tenants' });

  return app;
}

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await disconnectPlatformClient();
    await disconnectAllTenantClients();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main();
