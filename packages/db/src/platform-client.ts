import { PrismaClient } from './generated/platform/index.js';

let _client: PrismaClient | undefined;

export function getPlatformClient(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return _client;
}

export async function disconnectPlatformClient(): Promise<void> {
  await _client?.$disconnect();
  _client = undefined;
}

export type { PrismaClient as PlatformClient } from './generated/platform/index.js';
