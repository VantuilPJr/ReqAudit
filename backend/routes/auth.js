import { createSessionToken, hashSessionToken, verifyPassword } from '../auth.js';
import { transaction } from '../database.js';
import { getMailConfig } from '../mail.js';

export function registerPublicAuthRoutes(app, { db, service: s, text, fail, publicUser }) {
  app.get('/api/health', (_, res) =>
    res.json({ status: 'ok', application: 'ReqAudit' }),
  );
  app.post('/api/auth/login', (req, res) => {
    const email = text(req.body?.email, 'E-mail', true).toLowerCase();
    const password = req.body?.password;
    const user = s.get(
      'SELECT * FROM users WHERE lower(email)=?',
      email,
    );
    if (
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 200 ||
      !user ||
      !verifyPassword(password, user.passwordHash)
    )
      fail('E-mail ou senha inválidos.', 401);
    const token = createSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    transaction(db, () => {
      s.run('DELETE FROM sessions WHERE expiresAt<=?', now.toISOString());
      s.run(
        'INSERT INTO sessions (id,userId,createdAt,expiresAt) VALUES (?,?,?,?)',
        hashSessionToken(token),
        user.id,
        now.toISOString(),
        expiresAt.toISOString(),
      );
    });
    res.cookie('reqaudit_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: expiresAt.getTime() - now.getTime(),
    });
    res.json({ user: publicUser(user), expiresAt: expiresAt.toISOString() });
  });
}

export function registerAuthRoutes(app, { db, service: s, publicUser }) {
  app.get('/api/auth/me', (req, res) =>
    res.json({ user: publicUser(req.actor) }),
  );
  app.post('/api/auth/logout', (req, res) => {
    if (req.sessionId) s.run('DELETE FROM sessions WHERE id=?', req.sessionId);
    res.clearCookie('reqaudit_session', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
    });
    res.json({ ok: true });
  });
  app.get('/api/bootstrap', (req, res) => {
    const cfg = getMailConfig(db);
    res.json({
      users: s.all(
        'SELECT id,name,email,role,managementLevel FROM users ORDER BY name',
      ),
      requirements: s.all('SELECT * FROM requirements ORDER BY id'),
      audits: s
        .all('SELECT id FROM audits ORDER BY id DESC')
        .map((a) => s.audit(a.id)),
      nonConformities: s
        .all('SELECT id FROM non_conformities ORDER BY id DESC')
        .map((n) => s.nc(n.id)),
      notifications: s.all(
        'SELECT * FROM notifications WHERE userId=? ORDER BY id DESC',
        req.actor.id,
      ),
      outbox:
        req.actor.role === 'ADMIN'
          ? s.all('SELECT * FROM outbox ORDER BY id DESC')
          : [],
      dashboard: s.dashboard(),
      emailMode: cfg.enabled ? 'SMTP' : 'SIMULADO',
      currentUser: publicUser(req.actor),
    });
  });
}