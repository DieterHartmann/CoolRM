import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getPlatformClient, getTenantClient, getTenantSchemaName, nextRefNumber } from '@crm/db';
import { sendNewContactEmail, sendContactConfirmationEmail, createSmtpTransporter, TenantMailOptions } from '../lib/email.js';
import { decrypt } from '../lib/crypto.js';

interface SmtpConfigStored {
  fromName: string;
  fromEmail: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  encryptedPass: string;
}

const submitBody = z.object({
  widget_key: z.string().startsWith('wk_', 'Invalid widget key'),
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(50).optional(),
  message: z.string().max(5000).optional(),
  custom_fields: z.record(z.string().max(1000)).optional(),
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

    const { widget_key, name, email, phone, message, custom_fields } = parsed.data;
    const db = getPlatformClient();

    const applet = await db.applet.findUnique({
      where: { widgetKey: widget_key },
      include: { tenant: { select: { id: true, ownerEmail: true, companyName: true } } },
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
        message: message ?? null,
        ...(custom_fields && Object.keys(custom_fields).length > 0 ? { customFields: custom_fields } : {}),
      },
    });

    // Fire-and-forget email pipeline — uses tenant SMTP if configured, falls back to platform
    const sendEmails = async () => {
      let tenantMail: TenantMailOptions | undefined;
      try {
        const account = await tenantDb.emailAccount.findFirst({ where: { appletId: applet.id } });
        const cfg = account?.smtpConfig as unknown as SmtpConfigStored | undefined;
        if (cfg?.encryptedPass) {
          const pass = decrypt(cfg.encryptedPass);
          tenantMail = {
            transporter: createSmtpTransporter({ host: cfg.host, port: cfg.port, secure: cfg.secure, user: cfg.user, pass }),
            from: cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail,
          };
        }
      } catch (err) {
        console.error('[Contacts] Could not load tenant SMTP config', err);
      }

      await sendNewContactEmail(
        applet.tenant.ownerEmail,
        applet.name,
        { ref, name, email, message: message ?? '', ...(phone !== undefined ? { phone } : {}) },
        tenantMail,
      );

      await sendContactConfirmationEmail(
        email,
        applet.tenant.companyName,
        { ref, name, message: message ?? '' },
        tenantMail,
      );
    };

    sendEmails().catch((err: unknown) => console.error('[Contacts] Email pipeline failed', { err }));

    return reply.status(201).send({ success: true, data: { ref } });
  });
};

export default contactRoutes;
