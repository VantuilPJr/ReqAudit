import {
  createHmac,
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

const localSessionSecret = 'reqaudit-local-session-secret-change-me';

function sessionSecret() {
  return process.env.SESSION_SECRET || localSessionSecret;
}

export function createSignedSessionToken(userId, expiresAt) {
  const payload = Buffer.from(
    JSON.stringify({ sub: Number(userId), exp: new Date(expiresAt).getTime() }),
  ).toString('base64url');
  const signature = createHmac('sha256', sessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySignedSessionToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  try {
    const expected = createHmac('sha256', sessionSecret())
      .update(payload)
      .digest('base64url');
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    )
      return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      !Number.isInteger(value?.sub) ||
      !Number.isFinite(value?.exp) ||
      value.exp <= Date.now()
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function defaultPassword(role) {
  if (role === 'ADMIN') return '12345678';
  if (role === 'AUDITOR') return 'Auditor@123';
  if (role === 'RESPONSAVEL') return 'Responsavel@123';
  return 'Gestor@123';
}
