import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_KEY_BYTES = 64;
const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password, saltHex = randomBytes(16).toString('hex')) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  const passwordHash = scryptSync(password, saltHex, PASSWORD_KEY_BYTES).toString('hex');
  return { salt: saltHex, hash: passwordHash, algorithm: 'scrypt-v1' };
}

export function verifyPassword(password, saltHex, expectedHashHex) {
  if (typeof password !== 'string' || !saltHex || !expectedHashHex) return false;
  const actual = scryptSync(password, saltHex, PASSWORD_KEY_BYTES);
  const expected = Buffer.from(expectedHashHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}
