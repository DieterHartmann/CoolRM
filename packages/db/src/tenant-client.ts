import { PrismaClient } from './generated/tenant/index.js';

// LRU-style cache: one PrismaClient per tenant schema.
// Clients are created on first access and reused for the lifetime of the process.
const _clients = new Map<string, PrismaClient>();

function buildTenantUrl(schemaName: string): string {
  const base = process.env['DATABASE_URL'];
  if (!base) throw new Error('DATABASE_URL is not set');

  // Append ?schema= (or replace existing) so Prisma sets search_path on connect
  const url = new URL(base);
  url.searchParams.set('schema', schemaName);
  return url.toString();
}

export function getTenantClient(schemaName: string): PrismaClient {
  let client = _clients.get(schemaName);
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: buildTenantUrl(schemaName) } },
      log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
    });
    _clients.set(schemaName, client);
  }
  return client;
}

export async function disconnectTenantClient(schemaName: string): Promise<void> {
  const client = _clients.get(schemaName);
  if (client) {
    await client.$disconnect();
    _clients.delete(schemaName);
  }
}

export async function disconnectAllTenantClients(): Promise<void> {
  await Promise.all([..._clients.values()].map((c) => c.$disconnect()));
  _clients.clear();
}

export type { PrismaClient as TenantClient } from './generated/tenant/index.js';
