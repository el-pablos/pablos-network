import { createHash, randomBytes } from 'crypto';

export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

export function hashString(input: string, algorithm: string = 'sha256'): string {
  return createHash(algorithm).update(input).digest('hex');
}

export function generateFingerprint(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return hashString(normalized);
}

export function generateConsentToken(): string {
  return `pablos-verify-${generateToken(16)}`;
}

