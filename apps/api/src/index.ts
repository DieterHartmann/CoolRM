import './config.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { auth } from './auth.js';
import { getTenantSchemaName, disconnectPlatformClient, disconnectAllTenantClients } from '@crm/db';
import appletRoutes from './routes/applets.js';
import contactRoutes from './routes/contacts.js';
import widgetRoutes from './routes/widget.js';
import adminRoutes from './routes/admin.js';

// Extend Fastify's request type to carry session context
declare module 'fastify' {
  interface FastifyRequest {
    sessionUser?: {
      id: string;
      email: string;
      tenantId: string | null | undefined;
      role: string;
      schemaName: string | null;
    };
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug' },
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(sensible);

  await app.register(rateLimit, { global: false });

  // ── Body parser ────────────────────────────────────────────────────────────
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, typeof body === 'string' ? JSON.parse(body) : body);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      // Fastify's content-type parser consumes request.raw before this handler
      // runs, so toNodeHandler would see an empty stream. Instead we use
      // auth.handler (Web API) and reconstruct the Request from request.body.
      const headers = new Headers();
      for (const [k, v] of Object.entries(request.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }

      const url = `http://localhost:${config.PORT}${request.url}`;
      const init: RequestInit = { method: request.method, headers };
      if (request.body !== undefined && request.body !== null) {
        init.body = JSON.stringify(request.body);
      }

      const webRes = await auth.handler(new Request(url, init));
      const body = Buffer.from(await webRes.arrayBuffer());

      const outHeaders: Record<string, string> = {};
      webRes.headers.forEach((value, key) => { outHeaders[key] = value; });

      // Bypass Fastify serialization — write directly to the Node.js stream
      reply.hijack();
      reply.raw.writeHead(webRes.status, outHeaders);
      reply.raw.end(body);
    },
  });

  // ── Session middleware ─────────────────────────────────────────────────────
  // Resolves the session and attaches tenant context to every protected request.
  // Routes under /api/auth/* and /health are excluded.
  app.addHook('preHandler', async (request, reply) => {
    if (
      request.url.startsWith('/api/auth') ||
      request.url === '/health' ||
      request.url.startsWith('/api/v1/contacts') ||
      request.url.startsWith('/api/v1/widget/')
    ) {
      return;
    }

    const webHeaders = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') webHeaders.set(key, value);
      else if (Array.isArray(value)) webHeaders.set(key, value.join(', '));
    }

    type SessionResult = { user: { id: string; email: string; [key: string]: unknown } | null } | null;
    const session = await (auth.api.getSession as unknown as (opts: { headers: Headers }) => Promise<SessionResult>)({ headers: webHeaders });

    if (!session?.user) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    const tenantId = session.user['tenantId'] as string | null | undefined;

    request.sessionUser = {
      id: session.user.id,
      email: session.user.email,
      tenantId,
      role: session.user['role'] as string ?? 'member',
      schemaName: tenantId ? getTenantSchemaName(tenantId) : null,
    };
  });

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    ts: new Date().toISOString(),
    env: config.NODE_ENV,
  }));

  await app.register(appletRoutes, { prefix: '/api/v1/applets' });
  await app.register(contactRoutes, { prefix: '/api/v1/contacts' });
  await app.register(widgetRoutes, { prefix: '/api/v1/widget' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

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
