import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

// Encrypted format: "<iv-hex>:<tag-hex>:<ciphertext-hex>"
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(data: string): string {
  const parts = data.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');
  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
