import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getPlatformClient, getTenantClient, getTenantSchemaName, nextRefNumber } from '@crm/db';
import { sendNewContactEmail } from '../lib/email.js';

const submitBody = z.object({
  widget_key: z.string().startsWith('wk_', 'Invalid widget key'),
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(50).optional(),
  message: z.string().min(1, 'Message is required').max(5000),
});

const contactRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/contacts — public widget submission endpoint
  app.post('/', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 hour' },
    },
  }, async (request, reply) => {
    const parsed = submitBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid request',
      });
    }

    const { widget_key, name, email, phone, message } = parsed.data;
    const db = getPlatformClient();

    const applet = await db.applet.findUnique({
      where: { widgetKey: widget_key },
      include: { tenant: { select: { id: true, ownerEmail: true } } },
    });

    if (!applet || !applet.isActive) {
      return reply.status(404).send({ success: false, error: 'Widget not found' });
    }

    const schemaName = getTenantSchemaName(applet.tenant.id);
    const ref = await nextRefNumber(schemaName);

    const tenantDb = getTenantClient(schemaName);
    await tenantDb.contact.create({
      data: {
        appletId: applet.id,
        refNumber: ref,
        name,
        email,
        phone: phone ?? null,
        message,
      },
    });

    // Fire-and-forget — don't fail the request if email delivery fails
    // Conditional spread avoids passing phone: undefined (exactOptionalPropertyTypes)
    sendNewContactEmail(applet.tenant.ownerEmail, applet.name, {
      ref, name, email, message,
      ...(phone !== undefined ? { phone } : {}),
    }).catch((err: unknown) => console.error('[Contacts] Notification email failed', { err }));

    return reply.status(201).send({ success: true, data: { ref } });
  });
};

export default contactRoutes;
