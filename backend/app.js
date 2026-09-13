import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createService } from './service.js';
import { transaction } from './database.js';
import { ATTACHMENTS_DIR } from './database.js';
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './auth.js';
import { getMailConfig, sendTestEmail } from './mail.js';
import {
  RESULTS,
  STATUSES,
  SEVERITIES,
  validDate,
  escalationLevel,
  daysLate,
} from './domain.js';
export function createApp(db, { allowTestIdentity = false } = {}) {
  const app = express(),
    s = createService(db);
  const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  ]);
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ATTACHMENTS_DIR),
      filename: (_req, _file, cb) =>
        cb(null, `${randomBytes(16).toString('hex')}${path.extname(_file.originalname)}`),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
      cb(new Error('Tipo de arquivo não permitido.'));
    },
  });
  const fail = (message, status = 400) => {
    const e = new Error(message);
    e.status = status;
    throw e;
  };
  const requireValue = (value, message) => {
    if (!value) fail(message);
  };
  const text = (value, label, required = false) => {
    if (value === undefined || value === null) {
      if (required) fail(`${label} é obrigatório.`);
      return '';
    }
    if (typeof value !== 'string' || value.length > 12000)
      fail(`${label} inválido.`);
    const v = value.trim();
    if (required && !v) fail(`${label} é obrigatório.`);
    return v;
  };
  const publicUser = (user) =>
    user && {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      managementLevel: user.managementLevel,
    };
  const cookieValue = (req, name) => {
    const pair = String(req.get('cookie') || '')
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : '';
  };
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      return res.status(403).json({ error: 'Origem não permitida.' });
    next();
  });
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
  app.use('/api', (req, res, next) => {
    if (allowTestIdentity && req.get('x-user-id'))
      req.actor = s.get(
        'SELECT * FROM users WHERE id=?',
        Number(req.get('x-user-id')),
      );
    else {
      const token = cookieValue(req, 'reqaudit_session');
      if (token) {
        const session = s.get(
          `SELECT u.*,s.id sessionId FROM sessions s
           JOIN users u ON u.id=s.userId
           WHERE s.id=? AND s.expiresAt>?`,
          hashSessionToken(token),
          new Date().toISOString(),
        );
        if (session) {
          req.actor = session;
          req.sessionId = session.sessionId;
        }
      }
    }
    if (!req.actor)
      return res.status(401).json({ error: 'Faça login para acessar o ReqAudit.' });
    next();
  });
  const requireRole = (req, roles) => {
    if (!roles.includes(req.actor.role))
      fail('Seu perfil não pode executar esta ação.', 403);
  };
  const getAudit = (id) =>
    s.audit(Number(id)) || fail('Auditoria não encontrada.', 404);
  const getNC = (id) =>
    s.nc(Number(id)) || fail('Não conformidade não encontrada.', 404);
  const ownAudit = (req, a) => {
    if (req.actor.role !== 'ADMIN' && req.actor.id !== a.auditorId)
      fail('Somente o auditor responsável pode alterar esta auditoria.', 403);
  };
  const manageNC = (req, n) => {
    if (
      !['ADMIN', 'GESTOR'].includes(req.actor.role) &&
      req.actor.id !== n.auditorId
    )
      fail(
        'Somente o auditor ou a gestão pode alterar a atribuição e o prazo.',
        403,
      );
  };
  const responsible = (id) => {
    const u = s.get('SELECT * FROM users WHERE id=?', Number(id));
    requireValue(
      u && u.role === 'RESPONSAVEL',
      'Selecione um responsável válido.',
    );
    return u;
  };
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
    requireValue(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      'Informe um e-mail válido.',
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
        'UPDATE users SET name=?,email=?,passwordHash=? WHERE id=?',
        name,
        email,
        password ? hashPassword(password) : user.passwordHash,
        user.id,
      );
      if (password) s.run('DELETE FROM sessions WHERE userId=?', user.id);
    });
    res.json(
      publicUser(s.get('SELECT * FROM users WHERE id=?', Number(req.params.id))),
    );
  });
  app.get('/api/requirements', (_, res) =>
    res.json(s.all('SELECT * FROM requirements ORDER BY id')),
  );
  app.get('/api/requirements/:id', (req, res) =>
    res.json(
      s.get('SELECT * FROM requirements WHERE id=?', Number(req.params.id)) ||
        fail('Requisito não encontrado.', 404),
    ),
  );
  function requirementData(body) {
    const fields = [
      'code',
      'title',
      'description',
      'actor',
      'preconditions',
      'mainFlow',
      'alternativeFlow',
      'businessRules',
      'acceptanceCriteria',
      'priority',
      'dependencies',
      'origin',
    ];
    const labels = [
      'Código',
      'Título',
      'Descrição',
      'Ator',
      'Pré-condições',
      'Fluxo principal',
      'Fluxos alternativos',
      'Regras de negócio',
      'Critérios de aceitação',
      'Prioridade',
      'Dependências',
      'Origem',
    ];
    const values = fields.map((f, i) =>
      text(
        body[f],
        labels[i],
        ['code', 'title', 'description', 'priority'].includes(f),
      ),
    );
    requireValue(
      /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(values[0]),
      'Código deve ter de 2 a 40 letras, números, pontos, hífens ou sublinhados.',
    );
    values[0] = values[0].toUpperCase();
    requireValue(
      ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].includes(values[9]),
      'Prioridade inválida.',
    );
    return { fields, values };
  }
  app.post('/api/requirements', (req, res) => {
    requireRole(req, ['ADMIN', 'AUDITOR', 'RESPONSAVEL']);
    const { fields, values } = requirementData(req.body);
    const now = new Date().toISOString();
    const result = s.run(
      `INSERT INTO requirements (${fields.join(',')},createdAt,updatedAt) VALUES (${fields.map(() => '?').join(',')},?,?)`,
      ...values,
      now,
      now,
    );
    res
      .status(201)
      .json(
        s.get(
          'SELECT * FROM requirements WHERE id=?',
          Number(result.lastInsertRowid),
        ),
      );
  });
  app.put('/api/requirements/:id', (req, res) => {
    requireRole(req, ['ADMIN', 'AUDITOR', 'RESPONSAVEL']);
    requireValue(
      s.get('SELECT id FROM requirements WHERE id=?', Number(req.params.id)),
      'Requisito não encontrado.',
    );
    const { fields, values } = requirementData(req.body);
    s.run(
      `UPDATE requirements SET ${fields.map((f) => `${f}=?`).join(',')},updatedAt=? WHERE id=?`,
      ...values,
      new Date().toISOString(),
      Number(req.params.id),
    );
    res.json(
      s.get('SELECT * FROM requirements WHERE id=?', Number(req.params.id)),
    );
  });
  app.post('/api/audits', (req, res) => {
    requireRole(req, ['ADMIN', 'AUDITOR']);
    const body = req.body || {};
    const sourceType = body.sourceType || 'REQUISITO';
    requireValue(
      ['REQUISITO', 'DOCUMENTO'].includes(sourceType),
      'Origem da auditoria inválida.',
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
    const a = getAudit(req.params.id);
    ownAudit(req, a);
    if (!req.file) fail('Nenhum arquivo enviado.');
    if (a.attachmentPath && existsSync(a.attachmentPath)) {
      try { unlinkSync(a.attachmentPath); } catch {}
    }
    s.run(
      'UPDATE audits SET attachmentPath=?,attachmentName=? WHERE id=?',
      req.file.path,
      req.file.originalname,
      a.id,
    );
    res.json(s.audit(a.id));
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
  app.get('/api/non-conformities', (_, res) =>
    res.json(
      s
        .all('SELECT id FROM non_conformities ORDER BY id DESC')
        .map((n) => s.nc(n.id)),
    ),
  );
  app.post('/api/non-conformities', (req, res) => {
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
  app.patch('/api/non-conformities/:id/status', (req, res) => {
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
    res.json(s.nc(n.id));
  });
  app.post('/api/non-conformities/:id/correction', (req, res) => {
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
    res.json(s.nc(n.id));
  });
  app.patch('/api/non-conformities/:id/responsible', (req, res) => {
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
    res.json(s.nc(n.id));
  });
  app.patch('/api/non-conformities/:id/deadline', (req, res) => {
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
    res.json(s.nc(n.id));
  });
  app.post('/api/admin/check-deadlines', (req, res) => {
    requireRole(req, ['ADMIN']);
    res.json(s.escalate());
  });
  app.patch('/api/notifications/read', (req, res) => {
    s.run(
      'UPDATE notifications SET readAt=? WHERE userId=? AND readAt IS NULL',
      new Date().toISOString(),
      req.actor.id,
    );
    res.json({ ok: true });
  });
  app.use('/api', (_, res) =>
    res.status(404).json({ error: 'Endpoint não encontrado.' }),
  );
  app.use((err, req, res, _next) => {
    if (err.code?.startsWith('ERR_SQLITE') && err.message.includes('UNIQUE'))
      return res
        .status(409)
        .json({ error: 'Já existe um registro com este código ou vínculo.' });
    if (err.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'JSON inválido.' });
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({
      error: err.status ? err.message : 'Não foi possível concluir a operação.',
    });
  });
  return { app, service: s };
}
