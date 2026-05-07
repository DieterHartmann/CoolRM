// Runs platform schema migrations at startup.
// Uses the Prisma client directly (no CLI) — reads the migration SQL and
// executes it. All statements use IF NOT EXISTS so this is fully idempotent.
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPlatformClient, disconnectPlatformClient } from '@crm/db';

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
    await db.$executeRawUnsafe(sql);

    await db.$executeRawUnsafe(
      `INSERT INTO _crm_migrations (name) VALUES ('${name}')`,
    );
    console.info(`[migrate] done: ${name}`);
  }

  await disconnectPlatformClient();
}

run().catch((err) => {
  console.error('[migrate] FATAL:', err);
  process.exit(1);
});
