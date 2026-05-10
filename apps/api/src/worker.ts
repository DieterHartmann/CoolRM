import './config.js';
import { Worker, Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { config } from './config.js';
import { getPlatformClient, getTenantClient, getTenantSchemaName, disconnectPlatformClient, disconnectAllTenantClients } from '@crm/db';
import { decrypt } from './lib/crypto.js';
import { syncMailbox } from './lib/imap.js';
import { sendMailboxErrorEmail } from './lib/email.js';

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const emailSyncQueue = new Queue('email-sync', { connection });

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

const emailSyncWorker = new Worker(
  'email-sync',
  async (job) => {
    if (job.name !== 'sync-all') return;
    console.info({ jobId: job.id }, '[Worker] Running email sync pass');

    const platformDb = getPlatformClient();
    const tenants = await platformDb.tenant.findMany({
      select: { id: true, ownerEmail: true },
    });

    for (const tenant of tenants) {
      const schemaName = getTenantSchemaName(tenant.id);
      const tenantDb = getTenantClient(schemaName);

      let accounts;
      try {
        accounts = await tenantDb.emailAccount.findMany();
      } catch {
        // Tenant schema not yet provisioned
        continue;
      }

      for (const account of accounts) {
        const cfg = account.smtpConfig as unknown as SmtpConfigStored | undefined;
        if (!cfg?.encryptedPass || !cfg.imapHost) continue;

        let pass: string;
        try {
          pass = decrypt(cfg.encryptedPass);
        } catch (err) {
          console.error(`[Worker] Failed to decrypt password for account ${account.id}:`, err);
          continue;
        }

        const hadError = !!account.lastError;

        try {
          await syncMailbox({
            cfg: {
              imapHost: cfg.imapHost,
              imapPort: cfg.imapPort ?? 993,
              imapTls: cfg.imapTls ?? true,
              user: cfg.user,
              pass,
            },
            schemaName,
            appletId: account.appletId,
            accountId: account.id,
            lastSyncAt: account.lastSyncAt,
          });
          console.info(`[Worker] Synced account ${account.id}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown IMAP error';
          console.error(`[Worker] IMAP sync failed for account ${account.id}:`, errorMsg);

          await tenantDb.emailAccount.update({
            where: { id: account.id },
            data: { lastError: errorMsg, lastErrorAt: new Date() },
          });

          // Notify only on first failure (transition from healthy → broken)
          if (!hadError) {
            try {
              await sendMailboxErrorEmail(tenant.ownerEmail, cfg.fromEmail, errorMsg);
            } catch (emailErr) {
              console.error('[Worker] Failed to send error notification:', emailErr);
            }
          }
        }
      }
    }
  },
  { connection, concurrency: 1 },
);

emailSyncWorker.on('failed', (job, err) => {
  console.error({ jobId: job?.id, err }, '[Worker] email-sync job failed');
});

// Schedule the repeatable sync every 5 minutes
emailSyncQueue.add('sync-all', {}, {
  repeat: { every: 5 * 60 * 1000 },
  jobId: 'sync-all-repeatable',
}).catch(err => console.error('[Worker] Failed to schedule repeatable job:', err));

// Also kick off one run immediately on startup
emailSyncQueue.add('sync-all', {})
  .catch(err => console.error('[Worker] Failed to add initial sync job:', err));

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  console.info({ signal }, '[Worker] Shutting down');
  await emailSyncWorker.close();
  await connection.quit();
  await disconnectPlatformClient();
  await disconnectAllTenantClients();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.info('[Worker] Started — listening for jobs');
