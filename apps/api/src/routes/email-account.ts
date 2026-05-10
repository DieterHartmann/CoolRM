import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getPlatformClient, getTenantClient, getTenantSchemaName } from '@crm/db';
import { encrypt, decrypt } from '../lib/crypto.js';
import { createSmtpTransporter } from '../lib/email.js';

interface SmtpConfigStored {
  fromName: string;
  fromEmail: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  encryptedPass: string;
  imapHost?: string;
  imapPort?: number;
  imapTls?: boolean;
}

const smtpBody = z.object({
  fromName: z.string().min(1, 'From name is required').max(100),
  fromEmail: z.string().email('Invalid from email'),
  host: z.string().min(1, 'SMTP host is required').max(200),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().min(1, 'Username is required').max(200),
  password: z.string().max(200).optional(),
  imapHost: z.string().max(200).optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapTls: z.boolean().optional(),
});

const testBody = z.object({
  host: z.string().min(1).max(200),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().min(1).max(200),
  password: z.string().min(1, 'Password is required for testing').max(200),
});

async function getVerifiedApplet(tenantId: string, appletId: string) {
  const db = getPlatformClient();
  const applet = await db.applet.findUnique({ where: { id: appletId }, select: { tenantId: true } });
  if (!applet || applet.tenantId !== tenantId) return null;
  return applet;
}

const emailAccountRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/applets/:id/email-account
  app.get('/:id/email-account', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id } = request.params as { id: string };
    if (!await getVerifiedApplet(tenantId, id)) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));
    const account = await tenantDb.emailAccount.findFirst({ where: { appletId: id } });

    if (!account?.smtpConfig) return { success: true, data: { account: null } };

    const cfg = account.smtpConfig as unknown as SmtpConfigStored;
    return {
      success: true,
      data: {
        account: {
          id: account.id,
          fromName: cfg.fromName,
          fromEmail: cfg.fromEmail,
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          user: cfg.user,
          passwordSet: !!cfg.encryptedPass,
          imapHost: cfg.imapHost ?? null,
          imapPort: cfg.imapPort ?? null,
          imapTls: cfg.imapTls ?? null,
          lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
          lastError: account.lastError ?? null,
          lastErrorAt: account.lastErrorAt?.toISOString() ?? null,
        },
      },
    };
  });

  // PUT /api/v1/applets/:id/email-account
  app.put('/:id/email-account', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id } = request.params as { id: string };
    if (!await getVerifiedApplet(tenantId, id)) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const parsed = smtpBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    const { fromName, fromEmail, host, port, secure, user, password, imapHost, imapPort, imapTls } = parsed.data;
    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));

    // Resolve encrypted password — use new one if provided, keep existing otherwise
    let encryptedPass: string;
    if (password) {
      encryptedPass = encrypt(password);
    } else {
      const existing = await tenantDb.emailAccount.findFirst({ where: { appletId: id } });
      const existingCfg = existing?.smtpConfig as unknown as SmtpConfigStored | undefined;
      if (!existingCfg?.encryptedPass) {
        return reply.status(400).send({ success: false, error: 'Password is required for a new account' });
      }
      encryptedPass = existingCfg.encryptedPass;
    }

    const stored: SmtpConfigStored = {
      fromName, fromEmail, host, port, secure, user, encryptedPass,
      ...(imapHost ? {
        imapHost,
        ...(imapPort !== undefined ? { imapPort } : {}),
        ...(imapTls !== undefined ? { imapTls } : {}),
      } : {}),
    };
    const storedJson = JSON.parse(JSON.stringify(stored)) as object;

    const existing = await tenantDb.emailAccount.findFirst({ where: { appletId: id } });
    if (existing) {
      // Saving new SMTP config clears previous errors so the sync worker retries cleanly
      await tenantDb.emailAccount.update({
        where: { id: existing.id },
        data: { smtpConfig: storedJson, lastError: null, lastErrorAt: null },
      });
    } else {
      await tenantDb.emailAccount.create({
        data: { appletId: id, provider: 'imap', smtpConfig: storedJson },
      });
    }

    return {
      success: true,
      data: {
        account: {
          fromName, fromEmail, host, port, secure, user, passwordSet: true,
          imapHost: imapHost ?? null,
          imapPort: imapPort ?? null,
          imapTls: imapTls ?? null,
          lastSyncAt: null,
          lastError: null,
          lastErrorAt: null,
        },
      },
    };
  });

  // DELETE /api/v1/applets/:id/email-account
  app.delete('/:id/email-account', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id } = request.params as { id: string };
    if (!await getVerifiedApplet(tenantId, id)) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const tenantDb = getTenantClient(getTenantSchemaName(tenantId));
    await tenantDb.emailAccount.deleteMany({ where: { appletId: id } });

    return { success: true, data: {} };
  });

  // POST /api/v1/applets/:id/email-account/test
  app.post('/:id/email-account/test', async (request, reply) => {
    const tenantId = request.sessionUser!.tenantId;
    if (!tenantId) return reply.status(403).send({ success: false, error: 'Tenant not provisioned yet' });

    const { id } = request.params as { id: string };
    if (!await getVerifiedApplet(tenantId, id)) {
      return reply.status(404).send({ success: false, error: 'Applet not found' });
    }

    const parsed = testBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    const { host, port, secure, user, password } = parsed.data;

    try {
      const transporter = createSmtpTransporter({ host, port, secure, user, pass: password });
      await transporter.verify();
      return { success: true, data: { ok: true } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return reply.status(400).send({ success: false, error: `SMTP connection failed: ${msg}` });
    }
  });
};

export default emailAccountRoutes;
