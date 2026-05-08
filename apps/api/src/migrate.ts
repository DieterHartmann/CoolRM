// Runs platform schema migrations at startup, then re-provisions every known
// tenant. All DDL uses IF NOT EXISTS — safe to run on every container start.
// After a volume wipe this recreates the platform schema; existing tenants
// get their per-tenant schemas recreated automatically.
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPlatformClient, disconnectPlatformClient, provisionTenant } from '@crm/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(
  __dirname,
  '../../../packages/db/prisma/migrations',
);

async function run(): Promise<void> {
  const db = getPlatformClient();

  // Track applied migrations in a simple table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS _crm_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const entries = readdirSync(migrationsDir)
    .filter((e) => statSync(path.join(migrationsDir, e)).isDirectory())
    .sort();

  for (const name of entries) {
    const sqlFile = path.join(migrationsDir, name, 'migration.sql');

    const already = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM _crm_migrations WHERE name = ${name}
    `;
    if (Number(already[0]?.count ?? 0) > 0) {
      console.info(`[migrate] already applied: ${name}`);
      continue;
    }

    console.info(`[migrate] applying: ${name}`);
    const sql = readFileSync(sqlFile, 'utf-8');
    // $executeRawUnsafe uses prepared statements — PostgreSQL rejects multiple
    // commands in one prepared statement. Execute each statement individually.
    const statements = sql
      .split(';')
      .map((s) =>
        s.split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt);
    }

    await db.$executeRaw`INSERT INTO _crm_migrations (name) VALUES (${name})`;
    console.info(`[migrate] done: ${name}`);
  }

  // Re-provision all known tenants. provisionTenant is fully idempotent —
  // every CREATE uses IF NOT EXISTS. On a fresh start there are no tenants yet;
  // after a volume wipe with existing data restored, schemas are recreated here.
  const appDbUser = process.env['APP_DB_USER'];
  if (!appDbUser) {
    console.error('[migrate] FATAL: APP_DB_USER env var is not set');
    process.exit(1);
  }

  const tenants = await db.$queryRaw<{ id: string }[]>`SELECT id FROM tenant`;
  if (tenants.length > 0) {
    console.info(`[migrate] re-provisioning ${tenants.length} tenant schema(s)`);
    for (const t of tenants) {
      try {
        await provisionTenant(t.id, appDbUser);
        console.info(`[migrate] provisioned tenant: ${t.id}`);
      } catch (err) {
        console.error(`[migrate] failed to provision tenant ${t.id}:`, err);
      }
    }
  }

  await disconnectPlatformClient();
}

run().catch((err) => {
  console.error('[migrate] FATAL:', err);
  process.exit(1);
});
