import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import { transaction } from '../database.js';
import { RESULTS } from '../domain.js';

export function registerAuditRoutes(app, { db, service: s, upload, fail, getAudit, ownAudit, requireRole, requireValue, text }) {
  app.post('/api/audits', (req, res) => {
    requireRole(req, ['ADMIN', 'AUDITOR']);
    const body = req.body || {};
    const sourceType = body.sourceType || 'REQUISITO';
    requireValue(
      ['REQUISITO', 'DOCUMENTO'].includes(sourceType),
      'Origem da auditoria inválida.',
    );
    requireValue(
      (typeof body.auditorId === 'number' || typeof body.auditorId === 'string') &&
        Number.isInteger(Number(body.auditorId)) && Number(body.auditorId) > 0,
      'Selecione um único auditor responsável.',
    );
    const auditor = s.get(
      'SELECT * FROM users WHERE id=?',
      Number(body.auditorId),
    );
    requireValue(auditor?.role === 'AUDITOR', 'Selecione um auditor válido.');
    if (req.actor.role === 'AUDITOR' && auditor.id !== req.actor.id)
      fail('Selecione seu próprio perfil de auditor.', 403);
    let requirement = null;
    let document = {};
    if (sourceType === 'REQUISITO') {
      requirement = s.get(
        'SELECT * FROM requirements WHERE id=?',
        Number(body.requirementId),
      );
      requireValue(requirement, 'Selecione um requisito.');
    } else {
      const documentType = text(body.documentType, 'Tipo do documento', true);
      requireValue(
        ['PDF', 'IMPRESSO', 'JIRA', 'OUTRO'].includes(documentType),
        'Tipo do documento inválido.',
      );
      document = {
        title: text(body.documentTitle, 'Nome do documento', true),
        code: text(body.documentCode, 'Código do documento'),
        version: text(body.documentVersion, 'Versão do documento'),
        type: documentType,
        reference: text(body.documentReference, 'Referência do documento'),
        scope: text(body.documentScope, 'Trecho avaliado'),
      };
    }
    const id = transaction(db, () => {
      const result = s.run(
        'INSERT INTO audits (requirementId,auditorId,requirementSnapshot,sourceType,documentSnapshot,createdAt) VALUES (?,?,?,?,?,?)',
        requirement?.id || null,
        auditor.id,
        JSON.stringify(requirement || {}),
        sourceType,
        JSON.stringify(document),
        new Date().toISOString(),
      );
      const id = Number(result.lastInsertRowid);
      s.all('SELECT * FROM checklist_items ORDER BY id').forEach((item) =>
        s.run(
          'INSERT INTO answers (auditId,checklistItemId,description) VALUES (?,?,?)',
          id,
          item.id,
          item.description,
        ),
      );
      return id;
    });
    res.status(201).json(s.audit(id));
  });
  app.post('/api/audits/:id/attachment', upload.single('file'), (req, res) => {
    let saved = false;
    try {
      const a = getAudit(req.params.id);
      ownAudit(req, a);
      if (!req.file) fail('Nenhum arquivo enviado.');
      s.run(
        'UPDATE audits SET attachmentPath=?,attachmentName=? WHERE id=?',
        req.file.path,
        req.file.originalname,
        a.id,
      );
      saved = true;
      if (a.attachmentPath && existsSync(a.attachmentPath)) {
        try { unlinkSync(a.attachmentPath); } catch {}
      }
      res.json(s.audit(a.id));
    } catch (error) {
      if (!saved && req.file?.path && existsSync(req.file.path)) {
        try { unlinkSync(req.file.path); } catch {}
      }
      throw error;
    }
  });
  app.delete('/api/audits/:id/attachment', (req, res) => {
    const a = getAudit(req.params.id);
    ownAudit(req, a);
    if (a.attachmentPath && existsSync(a.attachmentPath)) {
      try { unlinkSync(a.attachmentPath); } catch {}
    }
    s.run('UPDATE audits SET attachmentPath=NULL,attachmentName=NULL WHERE id=?', a.id);
    res.json({ ok: true });
  });
  app.get('/api/audits/:id/attachment', (req, res) => {
    const a = getAudit(req.params.id);
    if (!a.attachmentPath || !existsSync(a.attachmentPath))
      fail('Nenhum anexo encontrado para esta auditoria.', 404);
    const safeName = encodeURIComponent(a.attachmentName || 'anexo');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    createReadStream(a.attachmentPath).pipe(res);
  });
  app.get('/api/audits', (_, res) =>
    res.json(
      s.all('SELECT id FROM audits ORDER BY id DESC').map((a) => s.audit(a.id)),
    ),
  );
  app.get('/api/audits/:id', (req, res) => res.json(getAudit(req.params.id)));
  app.get('/api/audits/:id/checklist', (req, res) =>
    res.json(getAudit(req.params.id).answers),
  );
  app.put('/api/audits/:id/checklist/:itemId', (req, res) => {
    const a = getAudit(req.params.id);
    ownAudit(req, a);
    requireValue(
      a.status === 'EM_ANDAMENTO',
      'A auditoria está finalizada e seu checklist foi preservado.',
    );
    requireValue(
      a.answers.some((x) => x.checklistItemId === Number(req.params.itemId)),
      'Item de checklist inválido.',
    );
    const old = a.answers.find(
      (x) => x.checklistItemId === Number(req.params.itemId),
    );
    const result = req.body.result === undefined ? old.result : req.body.result;
    requireValue(RESULTS.includes(result), 'Resultado inválido.');
    const nc = s.get(
      'SELECT id FROM non_conformities WHERE auditId=? AND checklistItemId=?',
      a.id,
      Number(req.params.itemId),
    );
    if (nc && result !== 'NAO_CONFORME')
      fail(
        'Este item possui uma NC. Preserve o resultado e registre a correção na NC; uma nova auditoria pode reavaliar o requisito.',
      );
    s.run(
      'UPDATE answers SET result=?,observation=? WHERE auditId=? AND checklistItemId=?',
      result,
      req.body.observation === undefined
        ? old.observation
        : text(req.body.observation, 'Observação'),
      a.id,
      Number(req.params.itemId),
    );
    res.json(s.audit(a.id));
  });
  app.post('/api/audits/:id/finish', (req, res) => {
    const a = getAudit(req.params.id);
    ownAudit(req, a);
    if (a.stats.pending)
      fail(
        `Responda os ${a.stats.pending} item(ns) pendente(s) antes de finalizar.`,
      );
    const observations = req.body.observations || {};
    requireValue(
      typeof observations === 'object' && !Array.isArray(observations),
      'Observações inválidas.',
    );
    const pendingNotes = Object.entries(observations).map(([id, value]) => {
      requireValue(
        a.answers.some((answer) => answer.checklistItemId === Number(id)),
        'Item de observação inválido.',
      );
      return [Number(id), text(value, 'Observação')];
    });
    if (a.status === 'FINALIZADA' && pendingNotes.length)
      fail('A auditoria finalizada não pode ser alterada.');
    if (a.status !== 'FINALIZADA')
      transaction(db, () => {
        for (const [itemId, observation] of pendingNotes)
          s.run(
            'UPDATE answers SET observation=? WHERE auditId=? AND checklistItemId=?',
            observation,
            a.id,
            itemId,
          );
        s.run(
          "UPDATE audits SET status='FINALIZADA',finishedAt=?,adherencePercentage=? WHERE id=?",
          new Date().toISOString(),
          a.stats.adherence,
          a.id,
        );
      });
    res.json({ ...a.stats, audit: s.audit(a.id) });
  });
}
