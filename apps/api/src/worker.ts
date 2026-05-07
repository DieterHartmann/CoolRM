import './config.js';
import { Worker, Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { config } from './config.js';
import { disconnectPlatformClient, disconnectAllTenantClients } from '@crm/db';

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

// ── Queue definitions ─────────────────────────────────────────────────────────
export const emailSyncQueue = new Queue('email-sync', { connection });

// ── Worker: email polling ─────────────────────────────────────────────────────
// TODO Phase 2: implement actual email sync logic
const emailSyncWorker = new Worker(
  'email-sync',
  async (job) => {
    console.info({ jobId: job.id, data: job.data }, 'email-sync job received (stub)');
  },
  {
    connection,
    concurrency: 5,
  },
);

emailSyncWorker.on('failed', (job, err) => {
  console.error({ jobId: job?.id, err }, 'email-sync job failed');
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  console.info({ signal }, 'Worker shutting down');
  await emailSyncWorker.close();
  await connection.quit();
  await disconnectPlatformClient();
  await disconnectAllTenantClients();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.info('Worker started — listening for jobs');
