import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getPlatformClient, getTenantClient, getTenantSchemaName } from '@crm/db';
import { config } from '../config.js';

const createBody = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

function embedCode(widgetKey: string): string {
  return `<script src="${config.PLATFORM_URL}/widget.js" data-key="${widgetKey}" defer></script>`;
}

const appletRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/applets — list applets for current tenant
  app.get('/', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) {
      return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });
    }

    const db = getPlatformClient();
    const applets = await db.applet.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, widgetKey: true, isActive: true, createdAt: true },
    });

    return {
      success: true,
      data: {
        applets: applets.map((a) => ({ ...a, embedCode: embedCode(a.widgetKey) })),
      },
    };
  });

  // GET /api/v1/applets/:id/contacts — list contacts for an applet (from tenant schema)
  app.get('/:id/contacts', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) {
      return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });
    }

    const { id } = request.params as { id: string };
    const db = getPlatformClient();

    const applet = await db.applet.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!applet || applet.tenantId !== tenantId) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const schemaName = getTenantSchemaName(tenantId);
    const tenantDb = getTenantClient(schemaName);

    const contacts = await tenantDb.contact.findMany({
      where: { appletId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, refNumber: true, name: true, email: true,
        phone: true, message: true, status: true, createdAt: true,
      },
    });

    return { success: true, data: { contacts } };
  });

  // POST /api/v1/applets — create a new applet
  app.post('/', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) {
      return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });
    }

    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid request body',
      });
    }

    const db = getPlatformClient();
    const widgetKey = 'wk_' + randomBytes(16).toString('hex');

    const applet = await db.applet.create({
      data: {
        tenantId,
        name: parsed.data.name,
        widgetKey,
        isActive: true, // Phase 3 billing will control this
      },
      select: { id: true, name: true, widgetKey: true, isActive: true, createdAt: true },
    });

    return reply.status(201).send({
      success: true,
      data: { applet: { ...applet, embedCode: embedCode(applet.widgetKey) } },
    });
  });
};

export default appletRoutes;
