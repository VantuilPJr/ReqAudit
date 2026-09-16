import nodemailer from 'nodemailer';

function testEmailHtml() {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f3f6fa;color:#25324a;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
    <div style="padding:32px 16px;background:#f3f6fa">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;border-collapse:separate;border-spacing:0">
        <tr><td style="padding:22px 28px;background:#16253f;border-radius:18px 18px 0 0"><div style="font-size:22px;font-weight:700;color:#ffffff">Req<span style="color:#5dd6be">Audit</span></div><div style="margin-top:4px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#b9c6d8">Qualidade de requisitos</div></td></tr>
        <tr><td style="padding:34px 36px 30px;background:#ffffff;border:1px solid #e3e9f1;border-top:0"><div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#68809e">Configuração de e-mail</div><h1 style="margin:8px 0 16px;font-size:25px;line-height:1.25;color:#16253f">Envio de e-mail confirmado</h1><p style="margin:0 0 18px;font-size:15px">O ReqAudit conseguiu estabelecer conexão com o servidor SMTP e entregar esta mensagem.</p><div style="padding:16px 18px;background:#eef8f6;border-radius:8px;color:#3f5f5d;font-size:14px"><strong>Próximo passo</strong><br>As notificações de não conformidade serão enviadas automaticamente aos endereços cadastrados.</div></td></tr>
        <tr><td style="padding:18px 28px;background:#eef2f7;border:1px solid #e3e9f1;border-top:0;border-radius:0 0 18px 18px;color:#738198;font-size:12px">Esta mensagem foi gerada automaticamente pelo ReqAudit.<br><span style="color:#52627a">Não responda a este e-mail.</span></td></tr>
      </table>
    </div>
  </body>
</html>`;
}

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
            html: row.htmlBody || undefined,
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
  const text = `Olá!\n\nEste é um e-mail de teste do ReqAudit.\nSe você recebeu esta mensagem, o envio de e-mail está funcionando corretamente.\n\nReqAudit · Qualidade de Requisitos`;
  await transport.sendMail({
    from: cfg.from,
    to: dest,
    subject: 'ReqAudit — Teste de configuração de e-mail',
    text,
    html: testEmailHtml(),
  });
  transport.close();
  return { sent: true, to: dest };
}
