import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getPlatformClient, getTenantClient, getTenantSchemaName } from '@crm/db';

const createTagBody = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
});

const updateTagBody = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const tagRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/applets/:id/tags — list all tags for applet
  app.get('/:id/tags', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id } = request.params as { id: string };
    const db = getPlatformClient();
    const applet = await db.applet.findUnique({ where: { id }, select: { tenantId: true } });
    if (!applet || applet.tenantId !== tenantId) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));
    const tags = await tenantDb.tag.findMany({
      where: { appletId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, appletId: true, name: true, color: true, createdAt: true },
    });

    return { success: true, data: { tags } };
  });

  // POST /api/v1/applets/:id/tags — create a tag
  app.post('/:id/tags', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id } = request.params as { id: string };
    const parsed = createTagBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    const db = getPlatformClient();
    const applet = await db.applet.findUnique({ where: { id }, select: { tenantId: true } });
    if (!applet || applet.tenantId !== tenantId) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));
    try {
      const tag = await tenantDb.tag.create({
        data: { appletId: id, name: parsed.data.name, color: parsed.data.color },
        select: { id: true, appletId: true, name: true, color: true, createdAt: true },
      });
      return reply.status(201).send({ success: true, data: { tag } });
    } catch {
      return reply.status(409).send({ success: false, error: 'A tag with that name already exists' });
    }
  });

  // PATCH /api/v1/applets/:id/tags/:tagId — rename or recolor a tag
  app.patch('/:id/tags/:tagId', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id, tagId } = request.params as { id: string; tagId: string };
    const parsed = updateTagBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }
    if (!parsed.data.name && !parsed.data.color) {
      return reply.status(400).send({ success: false, error: 'Nothing to update' });
    }

    const db = getPlatformClient();
    const applet = await db.applet.findUnique({ where: { id }, select: { tenantId: true } });
    if (!applet || applet.tenantId !== tenantId) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));
    const existing = await tenantDb.tag.findFirst({ where: { id: tagId, appletId: id } });
    if (!existing) return reply.status(404).send({ success: false, error: 'Tag not found' });

    const data: { name?: string; color?: string } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.color !== undefined) data.color = parsed.data.color;

    const tag = await tenantDb.tag.update({
      where: { id: tagId },
      data,
      select: { id: true, appletId: true, name: true, color: true, createdAt: true },
    });
    return { success: true, data: { tag } };
  });

  // DELETE /api/v1/applets/:id/tags/:tagId — delete a tag (cascades to contact_tags)
  app.delete('/:id/tags/:tagId', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id, tagId } = request.params as { id: string; tagId: string };
    const db = getPlatformClient();
    const applet = await db.applet.findUnique({ where: { id }, select: { tenantId: true } });
    if (!applet || applet.tenantId !== tenantId) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));
    const existing = await tenantDb.tag.findFirst({ where: { id: tagId, appletId: id } });
    if (!existing) return reply.status(404).send({ success: false, error: 'Tag not found' });

    await tenantDb.tag.delete({ where: { id: tagId } });
    return { success: true, data: {} };
  });

  // POST /api/v1/applets/:id/contacts/:contactId/tags — apply a tag to a contact
  app.post('/:id/contacts/:contactId/tags', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id, contactId } = request.params as { id: string; contactId: string };
    const body = z.object({ tagId: z.string().uuid() }).safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'tagId (UUID) is required' });
    }

    const db = getPlatformClient();
    const applet = await db.applet.findUnique({ where: { id }, select: { tenantId: true } });
    if (!applet || applet.tenantId !== tenantId) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));

    const contact = await tenantDb.contact.findFirst({
      where: { id: contactId, appletId: id, deletedAt: null },
      select: { id: true },
    });
    if (!contact) return reply.status(404).send({ success: false, error: 'Contact not found' });

    const tag = await tenantDb.tag.findFirst({
      where: { id: body.data.tagId, appletId: id },
      select: { id: true, appletId: true, name: true, color: true, createdAt: true },
    });
    if (!tag) return reply.status(404).send({ success: false, error: 'Tag not found' });

    await tenantDb.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId: body.data.tagId } },
      create: { contactId, tagId: body.data.tagId, appliedBy: 'manual' },
      update: {},
    });

    return { success: true, data: { tag } };
  });

  // DELETE /api/v1/applets/:id/contacts/:contactId/tags/:tagId — remove a tag from a contact
  app.delete('/:id/contacts/:contactId/tags/:tagId', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id, contactId, tagId } = request.params as { id: string; contactId: string; tagId: string };
    const db = getPlatformClient();
    const applet = await db.applet.findUnique({ where: { id }, select: { tenantId: true } });
    if (!applet || applet.tenantId !== tenantId) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));
    await tenantDb.contactTag.deleteMany({ where: { contactId, tagId } });
    return { success: true, data: {} };
  });
};

export default tagRoutes;
