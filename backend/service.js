import { adherence, today, daysLate, escalationLevel } from './domain.js';
import { transaction } from './database.js';
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
    const identityText = [
      item.documentTitle || item.requirementTitle,
      item.documentCode || item.requirementCode,
      item.documentVersion ? `versão ${item.documentVersion}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const body = `${message}\n\nDocumento avaliado: ${identityText}\nProblema: ${item.title}\nResponsável: ${item.responsibleName}\nAuditor: ${item.auditorName}\nSeveridade: ${item.severity}\nPrazo: ${item.dueDate}\nStatus: ${item.status}\nNível: ${item.escalationLevel}`;
    for (const uid of new Set(ids)) {
      const user = get('SELECT * FROM users WHERE id=?', uid);
      if (!user) continue;
      run(
        'INSERT INTO notifications (userId,nonConformityId,message,createdAt) VALUES (?,?,?,?)',
        uid,
        item.id,
        subject,
        timestamp(),
      );
      run(
        'INSERT INTO outbox (nonConformityId,recipient,subject,body,status,createdAt) VALUES (?,?,?,?,?,?)',
        item.id,
        user.email,
        subject,
        body,
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
