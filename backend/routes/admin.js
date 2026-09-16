import { hashPassword } from '../auth.js';
import { transaction } from '../database.js';
import { getMailConfig, sendTestEmail } from '../mail.js';

export function registerAdminRoutes(app, { db, service: s, requireRole, requireValue, text, publicUser, mailer }) {
  app.get('/api/admin/settings', (req, res) => {
    requireRole(req, ['ADMIN']);
    const cfg = getMailConfig(db);
    res.json({
      smtp_enabled: cfg.enabled,
      smtp_host: cfg.host,
      smtp_port: cfg.port,
      smtp_secure: cfg.secure,
      smtp_user: cfg.user,
      smtp_from: cfg.from,
      notify_email: cfg.notifyEmail,
    });
  });
  app.put('/api/admin/settings', (req, res) => {
    requireRole(req, ['ADMIN']);
    const fields = [
      'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure',
      'smtp_user', 'smtp_from', 'notify_email',
    ];
    const upsert = db.prepare(
      'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    );
    transaction(db, () => {
      for (const key of fields) {
        if (req.body[key] !== undefined)
          upsert.run(key, String(req.body[key]));
      }
      if (req.body.smtp_pass !== undefined && req.body.smtp_pass !== '')
        upsert.run('smtp_pass', String(req.body.smtp_pass));
    });
    const cfg = getMailConfig(db);
    res.json({
      smtp_enabled: cfg.enabled,
      smtp_host: cfg.host,
      smtp_port: cfg.port,
      smtp_secure: cfg.secure,
      smtp_user: cfg.user,
      smtp_from: cfg.from,
      notify_email: cfg.notifyEmail,
    });
  });
  app.post('/api/admin/settings/test-email', async (req, res) => {
    requireRole(req, ['ADMIN']);
    try {
      const result = await sendTestEmail(db);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch('/api/admin/users/:id', (req, res) => {
    requireRole(req, ['ADMIN']);
    const user = s.get('SELECT * FROM users WHERE id=?', Number(req.params.id));
    requireValue(user, 'Usuário não encontrado.');
    const name = text(req.body?.name, 'Nome', true);
    const email = text(req.body?.email, 'E-mail', true).toLowerCase();
    const notificationEmail = req.body?.notificationEmail === undefined
      ? user.notificationEmail || ''
      : text(req.body.notificationEmail, 'E-mail para notificações').toLowerCase();
    requireValue(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      'Informe um e-mail válido.',
    );
    requireValue(
      !notificationEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail),
      'Informe um e-mail válido para notificações.',
    );
    const password = req.body?.password;
    if (password !== undefined && password !== '')
      requireValue(
        typeof password === 'string' &&
          password.length >= 8 &&
          password.length <= 200,
        'A senha deve ter pelo menos 8 caracteres.',
      );
    transaction(db, () => {
      s.run(
        'UPDATE users SET name=?,email=?,notificationEmail=?,passwordHash=? WHERE id=?',
        name,
        email,
        notificationEmail,
        password ? hashPassword(password) : user.passwordHash,
        user.id,
      );
      if (password) s.run('DELETE FROM sessions WHERE userId=?', user.id);
    });
    res.json(
      publicUser(s.get('SELECT * FROM users WHERE id=?', Number(req.params.id))),
    );
  });

  app.post('/api/admin/check-deadlines', async (req, res) => {
    requireRole(req, ['ADMIN']);
    const result = s.escalate();
    await mailer?.();
    res.json(result);
  });
}
