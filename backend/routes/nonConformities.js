import { transaction } from '../database.js';
import { STATUSES, SEVERITIES, validDate, escalationLevel, daysLate } from '../domain.js';

export function registerNonConformityRoutes(app, { db, service: s, fail, getAudit, getNC, ownAudit, manageNC, responsible, requireValue, text, mailer }) {
  app.get('/api/non-conformities', (_, res) =>
    res.json(
      s
        .all('SELECT id FROM non_conformities ORDER BY id DESC')
        .map((n) => s.nc(n.id)),
    ),
  );
  app.post('/api/non-conformities', async (req, res) => {
    const a = getAudit(req.body.auditId);
    ownAudit(req, a);
    const item = a.answers.find(
      (x) => x.checklistItemId === Number(req.body.checklistItemId),
    );
    requireValue(
      item?.result === 'NAO_CONFORME',
      'Uma NC deve estar vinculada a um item não conforme desta auditoria.',
    );
    const existing = s.get(
      'SELECT id FROM non_conformities WHERE auditId=? AND checklistItemId=?',
      a.id,
      item.checklistItemId,
    );
    if (existing) return res.json(s.nc(existing.id));
    const title = text(req.body.title, 'Título', true),
      description = text(req.body.description, 'Descrição', true),
      user = responsible(req.body.responsibleId);
    requireValue(
      SEVERITIES.includes(req.body.severity),
      'Severidade inválida.',
    );
    requireValue(validDate(req.body.dueDate), 'Prazo inválido.');
    const id = transaction(db, () => {
      const r = s.run(
        'INSERT INTO non_conformities (auditId,checklistItemId,title,description,severity,responsibleId,dueDate,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        a.id,
        item.checklistItemId,
        title,
        description,
        req.body.severity,
        user.id,
        req.body.dueDate,
        new Date().toISOString(),
      );
      const id = Number(r.lastInsertRowid);
      s.history(
        id,
        req.actor.id,
        'CRIACAO',
        `NC criada e atribuída a ${user.name}, com prazo ${req.body.dueDate}.`,
      );
      s.communicate(s.nc(id), 'Nova não conformidade atribuída.');
      return id;
    });
    await mailer?.();
    res.status(201).json(s.nc(id));
  });
  app.get('/api/non-conformities/:id', (req, res) =>
    res.json({
      ...getNC(req.params.id),
      history: s.all(
        'SELECT h.*,u.name userName FROM nc_history h LEFT JOIN users u ON u.id=h.userId WHERE nonConformityId=? ORDER BY h.id DESC',
        Number(req.params.id),
      ),
    }),
  );
  app.get('/api/non-conformities/:id/history', (req, res) => {
    getNC(req.params.id);
    res.json(
      s.all(
        'SELECT h.*,u.name userName FROM nc_history h LEFT JOIN users u ON u.id=h.userId WHERE nonConformityId=? ORDER BY h.id DESC',
        Number(req.params.id),
      ),
    );
  });
  app.patch('/api/non-conformities/:id/status', async (req, res) => {
    const n = getNC(req.params.id),
      status = req.body.status;
    requireValue(
      STATUSES.includes(status) && status !== 'ESCALONADA',
      'Escolha um status válido. Escalonamento é automático.',
    );
    if (
      req.actor.id !== n.auditorId &&
      req.actor.id !== n.responsibleId &&
      req.actor.role !== 'ADMIN'
    )
      fail('Somente o responsável ou auditor pode tratar esta NC.', 403);
    if (status === n.status) return res.json(n);
    requireValue(
      n.status !== 'RESOLVIDA',
      'NC resolvida não pode ser alterada.',
    );
    if (status === 'RESOLVIDA') {
      if (req.actor.id !== n.auditorId && req.actor.role !== 'ADMIN')
        fail('A correção deve ser verificada pelo auditor.', 403);
      requireValue(
        n.correction.trim(),
        'Registre a evidência de correção antes de resolver.',
      );
    }
    if (status === 'ABERTA')
      fail('Uma NC iniciada deve seguir para tratamento e resolução.');
    transaction(db, () => {
      s.run(
        'UPDATE non_conformities SET status=?,resolvedAt=? WHERE id=?',
        status,
        status === 'RESOLVIDA' ? new Date().toISOString() : null,
        n.id,
      );
      s.history(
        n.id,
        req.actor.id,
        'STATUS',
        `Status alterado de ${n.status} para ${status}.${status === 'RESOLVIDA' ? ' Correção verificada pelo auditor.' : ''}`,
      );
      s.communicate(
        s.nc(n.id),
        status === 'RESOLVIDA'
          ? 'Correção verificada e NC resolvida.'
          : 'Tratamento iniciado.',
        0,
        [n.auditorId],
      );
    });
    await mailer?.();
    res.json(s.nc(n.id));
  });
  app.post('/api/non-conformities/:id/correction', async (req, res) => {
    const n = getNC(req.params.id);
    if (
      ![n.auditorId, n.responsibleId].includes(req.actor.id) &&
      req.actor.role !== 'ADMIN'
    )
      fail('Seu perfil não pode registrar correção nesta NC.', 403);
    requireValue(
      n.status !== 'RESOLVIDA',
      'NC resolvida não pode ser alterada.',
    );
    const correction = text(req.body.correction, 'Evidência de correção', true);
    transaction(db, () => {
      s.run(
        "UPDATE non_conformities SET correction=?,status='EM_TRATAMENTO' WHERE id=?",
        correction,
        n.id,
      );
      s.history(n.id, req.actor.id, 'CORRECAO', correction);
      s.communicate(
        s.nc(n.id),
        'Correção registrada. Aguardando verificação do auditor.',
        0,
        [n.auditorId],
      );
    });
    await mailer?.();
    res.json(s.nc(n.id));
  });
  app.patch('/api/non-conformities/:id/responsible', async (req, res) => {
    const n = getNC(req.params.id);
    manageNC(req, n);
    requireValue(
      n.status !== 'RESOLVIDA',
      'NC resolvida não pode ser alterada.',
    );
    const u = responsible(req.body.responsibleId);
    if (u.id !== n.responsibleId)
      transaction(db, () => {
        s.run(
          'UPDATE non_conformities SET responsibleId=? WHERE id=?',
          u.id,
          n.id,
        );
        s.history(
          n.id,
          req.actor.id,
          'RESPONSAVEL',
          `Responsável alterado de ${n.responsibleName} para ${u.name}.`,
        );
        s.communicate(s.nc(n.id), 'Você foi atribuído como responsável.', 0, [
          n.auditorId,
        ]);
      });
    await mailer?.();
    res.json(s.nc(n.id));
  });
  app.patch('/api/non-conformities/:id/deadline', async (req, res) => {
    const n = getNC(req.params.id);
    manageNC(req, n);
    requireValue(
      n.status !== 'RESOLVIDA',
      'NC resolvida não pode ser alterada.',
    );
    requireValue(validDate(req.body.dueDate), 'Prazo inválido.');
    const reason = text(req.body.reason, 'Justificativa', true);
    if (n.dueDate !== req.body.dueDate)
      transaction(db, () => {
        const level = escalationLevel(daysLate(req.body.dueDate));
        s.run(
          "UPDATE non_conformities SET dueDate=?,escalationLevel=?,status=CASE WHEN status='ESCALONADA' AND ?=0 THEN 'ABERTA' WHEN status='ABERTA' AND ? > 0 THEN 'ESCALONADA' ELSE status END WHERE id=?",
          req.body.dueDate,
          level,
          level,
          level,
          n.id,
        );
        s.history(
          n.id,
          req.actor.id,
          'PRAZO',
          `Prazo alterado de ${n.dueDate} para ${req.body.dueDate}. Nível recalculado de ${n.escalationLevel} para ${level}. Motivo: ${reason}`,
        );
        s.communicate(s.nc(n.id), 'Prazo atualizado.', level, [n.auditorId]);
      });
    await mailer?.();
    res.json(s.nc(n.id));
  });
}
