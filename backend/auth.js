import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function defaultPassword(role) {
  if (role === 'ADMIN') return 'Admin@123';
  if (role === 'AUDITOR') return 'Auditor@123';
  if (role === 'RESPONSAVEL') return 'Responsavel@123';
  return 'Gestor@123';
}
