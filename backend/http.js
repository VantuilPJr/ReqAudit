export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function requireValue(value, message) {
  if (!value) fail(message);
}

export function text(value, label, required = false) {
  if (value === undefined || value === null) {
    if (required) fail(`${label} é obrigatório.`);
    return '';
  }
  if (typeof value !== 'string' || value.length > 12000) fail(`${label} inválido.`);
  const normalized = value.trim();
  if (required && !normalized) fail(`${label} é obrigatório.`);
  return normalized;
}

export const publicUser = (user) =>
  user && {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    managementLevel: user.managementLevel,
  };

export function cookieValue(req, name) {
  const pair = String(req.get('cookie') || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
}
