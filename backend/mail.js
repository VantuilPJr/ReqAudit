import nodemailer from 'nodemailer';

function getSetting(db, key, fallback = '') {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}

export function getMailConfig(db) {
  const enabled =
    getSetting(db, 'smtp_enabled') === 'true' ||
    process.env.SMTP_ENABLED === 'true';
  return {
    enabled,
    host: getSetting(db, 'smtp_host') || process.env.SMTP_HOST || '',
    port: Number(getSetting(db, 'smtp_port') || process.env.SMTP_PORT || 587),
    secure:
      getSetting(db, 'smtp_secure') === 'true' ||
      process.env.SMTP_SECURE === 'true',
    user: getSetting(db, 'smtp_user') || process.env.SMTP_USER || '',
    pass: getSetting(db, 'smtp_pass') || process.env.SMTP_PASS || '',
    from:
      getSetting(db, 'smtp_from') ||
      process.env.SMTP_FROM ||
      'ReqAudit <reqaudit@example.test>',
    notifyEmail: getSetting(db, 'notify_email') || '',
  };
}

export function createMailer(db) {
  let active = false;
  return async function flush() {
    const cfg = getMailConfig(db);
    if (active || !cfg.enabled) return;
    active = true;
    try {
      if (!cfg.host) throw new Error('SMTP_HOST não configurado.');
      const transport = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
        connectionTimeout: 10000,
        socketTimeout: 15000,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      for (const row of db
        .prepare(
          "SELECT * FROM outbox WHERE status='PENDENTE' ORDER BY id LIMIT 20",
        )
        .all()) {
        try {
          await transport.sendMail({
            from: cfg.from,
            to: row.recipient,
            subject: row.subject,
            text: row.body,
          });
          db.prepare(
            "UPDATE outbox SET status='ENVIADO',sentAt=?,error=NULL WHERE id=?",
          ).run(new Date().toISOString(), row.id);
        } catch (e) {
          db.prepare(
            "UPDATE outbox SET status='FALHOU',error=? WHERE id=?",
          ).run(e.message, row.id);
        }
      }
      transport.close();
    } catch (e) {
      db.prepare(
        "UPDATE outbox SET status='FALHOU',error=? WHERE status='PENDENTE'",
      ).run(e.message);
    } finally {
      active = false;
    }
  };
}

export async function sendTestEmail(db) {
  const cfg = getMailConfig(db);
  if (!cfg.host) throw new Error('Configure o host SMTP antes de testar.');
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const dest = cfg.notifyEmail || cfg.from;
  await transport.sendMail({
    from: cfg.from,
    to: dest,
    subject: 'ReqAudit — Teste de configuração de e-mail',
    text: `Olá!\n\nEste é um e-mail de teste do ReqAudit.\nSe você recebeu esta mensagem, o envio de e-mail está funcionando corretamente.\n\nReqAudit · Qualidade de Requisitos`,
  });
  transport.close();
  return { sent: true, to: dest };
}
