import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPlatformClient } from './platform-client.js';
import { getTenantClient } from './tenant-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Schema name follows the brief: tenant_{first_8_hex_chars_of_uuid}
export function getTenantSchemaName(tenantId: string): string {
  const hex = tenantId.replace(/-/g, '');
  return `tenant_${hex.substring(0, 8)}`;
}

function assertSafeIdentifier(name: string): void {
  if (!/^tenant_[0-9a-f]{8}$/.test(name)) {
    throw new Error(`Unsafe identifier rejected: ${name}`);
  }
}

function parseSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) =>
      s.split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);
}

export interface ProvisionResult {
  schemaName: string;
}

/**
 * Creates a dedicated PostgreSQL schema and role for a new tenant, then
 * applies the tenant DDL (init.sql). Safe to call idempotently — uses
 * IF NOT EXISTS guards throughout.
 *
 * @param tenantId  - The tenant's UUID from the tenants table
 * @param appDbUser - The PostgreSQL role the application normally connects as
 *                    (needs GRANT so it can SET ROLE to the tenant role)
 */
export async function provisionTenant(
  tenantId: string,
  appDbUser: string,
): Promise<ProvisionResult> {
  const schemaName = getTenantSchemaName(tenantId);
  assertSafeIdentifier(schemaName);

  const platform = getPlatformClient();

  // Step 1: Create schema and dedicated role.
  // Wrapped in a DO block so we can use conditional logic without errors on repeat.
  await platform.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = '${schemaName}') THEN
        EXECUTE 'CREATE SCHEMA "${schemaName}"';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${schemaName}') THEN
        EXECUTE 'CREATE ROLE "${schemaName}" NOINHERIT';
      END IF;

      -- Allow the app role to switch into the tenant role via SET ROLE
      IF NOT EXISTS (
        SELECT 1 FROM pg_auth_members am
        JOIN pg_roles r ON r.oid = am.roleid
        JOIN pg_roles m ON m.oid = am.member
        WHERE r.rolname = '${schemaName}' AND m.rolname = '${appDbUser}'
      ) THEN
        EXECUTE 'GRANT "${schemaName}" TO "${appDbUser}"';
      END IF;
    END
    $$
  `);

  await platform.$executeRawUnsafe(
    `GRANT USAGE ON SCHEMA "${schemaName}" TO "${schemaName}"`,
  );

  // Step 2: Apply DDL inside a transaction with SET LOCAL search_path.
  // PostgreSQL DDL is transactional — a failure rolls everything back cleanly.
  const initSql = readFileSync(
    join(__dirname, '../prisma/tenant/init.sql'),
    'utf-8',
  );
  const statements = parseSqlStatements(initSql);

  await platform.$transaction(async (tx: { $executeRawUnsafe: (sql: string) => Promise<unknown> }) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schemaName}"`);
    for (const stmt of statements) {
      await tx.$executeRawUnsafe(stmt);
    }
  });

  // Step 3: Grant table-level permissions AFTER tables exist.
  // Each statement must be a separate call — $executeRawUnsafe rejects multiple statements (P42601).
  await platform.$executeRawUnsafe(`GRANT ALL ON ALL TABLES IN SCHEMA "${schemaName}" TO "${schemaName}"`);
  await platform.$executeRawUnsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA "${schemaName}" TO "${schemaName}"`);
  await platform.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON TABLES TO "${schemaName}"`);
  await platform.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON SEQUENCES TO "${schemaName}"`);

  return { schemaName };
}

/**
 * Generates the next CRM reference number for a tenant.
 * Uses the per-tenant contact_ref_seq sequence — never global, never reused.
 */
export async function nextRefNumber(schemaName: string): Promise<string> {
  assertSafeIdentifier(schemaName);
  const tenant = getTenantClient(schemaName);
  const result = await tenant.$queryRawUnsafe<[{ ref: string }]>(
    `SELECT 'CRM-' || LPAD(nextval('"${schemaName}".contact_ref_seq')::text, 5, '0') AS ref`,
  );
  const row = result[0];
  if (!row) throw new Error('Failed to generate ref number');
  return row.ref;
}
