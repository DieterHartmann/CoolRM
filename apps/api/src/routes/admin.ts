import { FastifyPluginAsync } from 'fastify';
import { getPlatformClient, getTenantClient, getTenantSchemaName } from '@crm/db';

const adminRoutes: FastifyPluginAsync = async (app) => {
  // All admin routes require superadmin role (session already resolved by app-level preHandler)
  app.addHook('preHandler', async (request, reply) => {
    if (request.sessionUser?.role !== 'superadmin') {
      return reply.status(403).send({ success: false, error: 'Forbidden' });
    }
  });

  // GET /api/v1/admin/tenants — all tenants with applets and contact counts
  app.get('/tenants', async () => {
    const db = getPlatformClient();

    const tenants = await db.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        applets: {
          select: { id: true, name: true, widgetKey: true, isActive: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const tenantsWithCounts = await Promise.all(
      tenants.map(async (tenant) => {
        let countMap = new Map<string, number>();

        if (tenant.applets.length > 0) {
          try {
            const schemaName = getTenantSchemaName(tenant.id);
            const tenantDb = getTenantClient(schemaName);
            const rows = await tenantDb.$queryRaw<{ applet_id: string; count: bigint }[]>`
              SELECT applet_id::text, COUNT(*)::bigint AS count
              FROM contacts
              WHERE deleted_at IS NULL
              GROUP BY applet_id
            `;
            countMap = new Map(rows.map((r) => [r.applet_id, Number(r.count)]));
          } catch {
            // Schema may not be provisioned yet — return 0 counts
          }
        }

        return {
          id: tenant.id,
          companyName: tenant.companyName,
          ownerEmail: tenant.ownerEmail,
          createdAt: tenant.createdAt.toISOString(),
          applets: tenant.applets.map((a) => ({
            id: a.id,
            name: a.name,
            widgetKey: a.widgetKey,
            isActive: a.isActive,
            contactCount: countMap.get(a.id) ?? 0,
            createdAt: a.createdAt.toISOString(),
          })),
        };
      }),
    );

    return { success: true, data: { tenants: tenantsWithCounts } };
  });

  // PATCH /api/v1/admin/applets/:id/active — suspend or activate an applet
  app.patch('/applets/:id/active', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { isActive?: unknown };

    if (typeof body.isActive !== 'boolean') {
      return reply.status(400).send({ success: false, error: 'isActive must be a boolean' });
    }

    const db = getPlatformClient();
    const applet = await db.applet.update({
      where: { id },
      data: { isActive: body.isActive },
      select: { id: true, isActive: true },
    });

    return { success: true, data: { applet } };
  });
};

export default adminRoutes;
