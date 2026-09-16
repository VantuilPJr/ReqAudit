import { adherence, today, daysLate, escalationLevel } from './domain.js';
import { transaction } from './database.js';

const severityLabels = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};
const statusLabels = {
  ABERTA: 'Aberta',
  EM_TRATAMENTO: 'Em tratamento',
  RESOLVIDA: 'Resolvida',
  ESCALONADA: 'Escalonada',
};
const severityStyles = {
  BAIXA: { background: '#e8f5ee', color: '#18734b' },
  MEDIA: { background: '#fff4d6', color: '#8a5a00' },
  ALTA: { background: '#ffe7df', color: '#a63d1f' },
  CRITICA: { background: '#ffe0e6', color: '#b4233c' },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function htmlLines(value) {
  return escapeHtml(value).replaceAll('\n', '<br>');
}

export function renderNotificationEmail({ item, message, level = 0, recipientName }) {
  const code = `NC-${String(item.id).padStart(3, '0')}`;
  const status = statusLabels[item.status] || item.status;
  const severity = severityLabels[item.severity] || item.severity;
  const severityStyle = severityStyles[item.severity] || severityStyles.MEDIA;
  const escalation = Number(level || item.escalationLevel || 0);
  const documentIdentity = [
    item.documentTitle || item.requirementTitle,
    item.documentCode || item.requirementCode,
    item.documentVersion ? `versão ${item.documentVersion}` : '',
  ].filter(Boolean).join(' · ');
  const reference = item.documentReference || 'Não informado';
  const scope = item.documentScope || 'Documento completo';
  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001');
  const plain = [
    'REQAUDIT · QUALIDADE DE REQUISITOS',
    'ATUALIZAÇÃO DE NÃO CONFORMIDADE',
    '',
    `Olá, ${recipientName || 'equipe'},`,
    message,
    '',
    `${code} · ${item.title}`,
    `Documento avaliado: ${documentIdentity || 'Não informado'}`,
    `Referência: ${reference}`,
    `Escopo: ${scope}`,
    `Status: ${status}`,
    `Severidade: ${severity}`,
    `Prazo: ${item.dueDate}`,
    `Responsável: ${item.responsibleName}`,
    `Auditor: ${item.auditorName}`,
    `Nível de escalonamento: ${escalation}`,
    '',
    'Problema identificado:',
    item.description,
    '',
    `Acesse o ReqAudit para acompanhar esta NC: ${appUrl}`,
    '',
    'ReqAudit · Qualidade de Requisitos',
  ].join('\n');
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f3f6fa;color:#25324a;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
    <div style="padding:32px 16px;background:#f3f6fa">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;border-collapse:separate;border-spacing:0">
        <tr>
          <td style="padding:22px 28px;background:#16253f;border-radius:18px 18px 0 0">
            <div style="font-size:22px;font-weight:700;letter-spacing:.2px;color:#ffffff">Req<span style="color:#5dd6be">Audit</span></div>
            <div style="margin-top:4px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#b9c6d8">Qualidade de requisitos</div>
          </td>
        </tr>
        <tr>
          <td style="padding:34px 36px 28px;background:#ffffff;border:1px solid #e3e9f1;border-top:0">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#68809e">Atualização de não conformidade</div>
            <h1 style="margin:8px 0 16px;font-size:25px;line-height:1.25;color:#16253f">${escapeHtml(code)} · ${escapeHtml(item.title)}</h1>
            <p style="margin:0 0 8px;font-size:15px">Olá, <strong>${escapeHtml(recipientName || 'equipe')}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#50627a">${htmlLines(message)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 8px;font-size:14px">
              <tr><td style="width:34%;padding:10px 12px;background:#f6f8fb;color:#6b7b91">Documento avaliado</td><td style="padding:10px 12px;background:#f6f8fb;font-weight:700;color:#25324a">${escapeHtml(documentIdentity || 'Não informado')}</td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Referência</td><td style="padding:10px 12px;background:#f6f8fb;color:#25324a">${escapeHtml(reference)}</td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Escopo</td><td style="padding:10px 12px;background:#f6f8fb;color:#25324a">${escapeHtml(scope)}</td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Status</td><td style="padding:10px 12px;background:#f6f8fb;font-weight:700;color:#25324a">${escapeHtml(status)}</td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Severidade</td><td style="padding:10px 12px;background:#f6f8fb"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${severityStyle.background};color:${severityStyle.color};font-size:12px;font-weight:700">${escapeHtml(severity)}</span></td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Prazo</td><td style="padding:10px 12px;background:#f6f8fb;font-weight:700;color:#25324a">${escapeHtml(item.dueDate)}</td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Responsável</td><td style="padding:10px 12px;background:#f6f8fb;color:#25324a">${escapeHtml(item.responsibleName)}</td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Auditor</td><td style="padding:10px 12px;background:#f6f8fb;color:#25324a">${escapeHtml(item.auditorName)}</td></tr>
              <tr><td style="padding:10px 12px;background:#f6f8fb;color:#6b7b91">Nível de escalonamento</td><td style="padding:10px 12px;background:#f6f8fb;color:#25324a">${escalation}</td></tr>
            </table>
            <div style="margin-top:22px;padding:18px 20px;border-left:4px solid #e06b48;background:#fff8f5;border-radius:8px">
              <div style="font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#a63d1f">Problema identificado</div>
              <div style="margin-top:6px;font-size:14px;color:#4b5668">${htmlLines(item.description)}</div>
            </div>
            <div style="margin-top:22px;padding:18px 20px;background:#eef8f6;border-radius:8px">
              <div style="font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#197866">Próxima ação</div>
              <div style="margin-top:6px;font-size:14px;color:#3f5f5d">Acesse o ReqAudit para consultar evidências, histórico e próximos responsáveis.</div>
            </div>
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;margin-top:26px;padding:12px 18px;background:#16253f;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">Abrir ReqAudit</a>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;background:#eef2f7;border:1px solid #e3e9f1;border-top:0;border-radius:0 0 18px 18px;color:#738198;font-size:12px">
            Esta mensagem foi gerada automaticamente pelo ReqAudit.<br>
            <span style="color:#52627a">Não responda a este e-mail.</span>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
  return { plain, html };
}

export function createService(db) {
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const timestamp = () => new Date().toISOString();
  const mailEnabled = () => {
    try {
      const setting = get(
        "SELECT value FROM settings WHERE key='smtp_enabled'",
      )?.value;
      return setting === 'true' || process.env.SMTP_ENABLED === 'true';
    } catch {
      return process.env.SMTP_ENABLED === 'true';
    }
  };
  const json = (value) => {
    try {
      return JSON.parse(value || '{}');
    } catch {
      return {};
    }
  };
  function identity(row) {
    const requirementSnapshot = json(row.requirementSnapshot);
    const documentSnapshot = json(row.documentSnapshot);
    const external = row.sourceType === 'DOCUMENTO';
    const targetTitle = external
      ? documentSnapshot.title
      : requirementSnapshot.title;
    const targetCode = external
      ? documentSnapshot.code || 'DOCUMENTO EXTERNO'
      : requirementSnapshot.code;
    return {
      sourceType: external ? 'DOCUMENTO' : 'REQUISITO',
      requirementSnapshot,
      documentSnapshot,
      targetTitle: targetTitle || 'Documento sem título',
      targetCode: targetCode || 'SEM CÓDIGO',
      requirementTitle: targetTitle || 'Documento sem título',
      requirementCode: targetCode || 'SEM CÓDIGO',
      documentTitle: external ? documentSnapshot.title || '' : targetTitle || '',
      documentCode: external ? documentSnapshot.code || '' : targetCode || '',
      documentVersion: external ? documentSnapshot.version || '' : '',
      documentType: external ? documentSnapshot.type || 'OUTRO' : 'REQUISITO',
      documentReference: external ? documentSnapshot.reference || '' : '',
      documentScope: external ? documentSnapshot.scope || '' : '',
    };
  }
  function history(id, userId, action, description) {
    run(
      'INSERT INTO nc_history (nonConformityId,userId,action,description,createdAt) VALUES (?,?,?,?,?)',
      id,
      userId,
      action,
      description,
      timestamp(),
    );
  }
  function nc(id) {
    const row = get(
      `SELECT n.*, a.requirementId, a.requirementSnapshot, a.sourceType, a.documentSnapshot, u.name responsibleName, a.auditorId, au.name auditorName FROM non_conformities n JOIN audits a ON a.id=n.auditId JOIN users u ON u.id=n.responsibleId JOIN users au ON au.id=a.auditorId WHERE n.id=?`,
      id,
    );
    return (
      row && {
        ...row,
        ...identity(row),
        daysLate: row.status === 'RESOLVIDA' ? 0 : daysLate(row.dueDate),
        overdue: row.status !== 'RESOLVIDA' && row.dueDate < today(),
      }
    );
  }
  function audit(id) {
    const row = get(
      'SELECT a.*,u.name auditorName FROM audits a JOIN users u ON u.id=a.auditorId WHERE a.id=?',
      id,
    );
    if (!row) return null;
    const answers = all(
      'SELECT * FROM answers WHERE auditId=? ORDER BY checklistItemId',
      id,
    );
    return {
      ...row,
      ...identity(row),
      answers,
      stats: adherence(answers),
      nonConformities: all(
        'SELECT id FROM non_conformities WHERE auditId=?',
        id,
      ).map((x) => nc(x.id)),
    };
  }
  function communicate(item, message, level = 0, additional = []) {
    const ids = [
      item.responsibleId,
      ...(level ? [item.auditorId] : []),
      ...additional,
    ];
    if (level >= 2)
      ids.push(
        ...all("SELECT id FROM users WHERE managementLevel='LIDER'").map(
          (u) => u.id,
        ),
      );
    if (level >= 3)
      ids.push(
        ...all("SELECT id FROM users WHERE managementLevel='GERENTE'").map(
          (u) => u.id,
        ),
      );
    const subject = `${level ? `[ESCALONAMENTO NÍVEL ${level}] ` : ''}NC-${String(item.id).padStart(3, '0')} · ${message}`;
    for (const uid of new Set(ids)) {
      const user = get('SELECT * FROM users WHERE id=?', uid);
      if (!user) continue;
      const email = renderNotificationEmail({
        item,
        message,
        level,
        recipientName: user.name,
      });
      run(
        'INSERT INTO notifications (userId,nonConformityId,message,createdAt) VALUES (?,?,?,?)',
        uid,
        item.id,
        subject,
        timestamp(),
      );
      run(
        'INSERT INTO outbox (nonConformityId,recipient,subject,body,htmlBody,status,createdAt) VALUES (?,?,?,?,?,?,?)',
        item.id,
        user.notificationEmail || user.email,
        subject,
        email.plain,
        email.html,
        mailEnabled() ? 'PENDENTE' : 'SIMULADO',
        timestamp(),
      );
    }
  }
  function escalate(date = today()) {
    return transaction(db, () => {
      let updated = 0;
      for (const row of all(
        "SELECT id FROM non_conformities WHERE status!='RESOLVIDA' AND dueDate<?",
        date,
      )) {
        const item = nc(row.id),
          days = daysLate(item.dueDate, date),
          level = escalationLevel(days);
        if (level <= item.escalationLevel) continue;
        run(
          "UPDATE non_conformities SET escalationLevel=?,status=CASE WHEN status='ABERTA' THEN 'ESCALONADA' ELSE status END WHERE id=?",
          level,
          item.id,
        );
        history(
          item.id,
          null,
          'ESCALONAMENTO',
          `Escalonada do nível ${item.escalationLevel} para ${level}, com ${days} dia(s) de atraso.`,
        );
        communicate(nc(item.id), `Atrasada há ${days} dia(s).`, level);
        updated++;
      }
      return { updated, checkedAt: timestamp(), date };
    });
  }
  function dashboard() {
    const audits = all('SELECT id FROM audits ORDER BY id DESC').map((a) =>
      audit(a.id),
    );
    const ncs = all('SELECT id FROM non_conformities ORDER BY id DESC').map(
      (n) => nc(n.id),
    );
    const finished = audits.filter((a) => a.status === 'FINALIZADA');
    const scores = finished
      .map((a) => a.stats.adherence)
      .filter((a) => a !== null);
    return {
      audits: audits.length,
      finished: finished.length,
      inProgress: audits.length - finished.length,
      averageAdherence: scores.length
        ? Math.round(
            (scores.reduce((s, x) => s + x, 0) / scores.length) * 100 + 1e-8,
          ) / 100
        : null,
      openNCs: ncs.filter((n) => n.status !== 'RESOLVIDA').length,
      overdueNCs: ncs.filter((n) => n.overdue).length,
      resolvedNCs: ncs.filter((n) => n.status === 'RESOLVIDA').length,
    };
  }
  return {
    all,
    get,
    run,
    nc,
    audit,
    history,
    communicate,
    escalate,
    dashboard,
  };
}
