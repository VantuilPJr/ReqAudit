import express from 'express';
import { createService } from './service.js';
import { fail, publicUser, requireValue, text } from './http.js';
import { sessionMiddleware } from './middleware/session.js';
import { createUploadMiddleware } from './uploads.js';
import { registerPublicAuthRoutes, registerAuthRoutes } from './routes/auth.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerRequirementRoutes } from './routes/requirements.js';
import { registerAuditRoutes } from './routes/audits.js';
import { registerNonConformityRoutes } from './routes/nonConformities.js';
import { registerNotificationRoutes } from './routes/notifications.js';

export function createApp(db, { allowTestIdentity = false } = {}) {
  const app = express();
  const service = createService(db);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return res.status(403).json({ error: 'Origem não permitida.' });
    }
    next();
  });

  const publicContext = { db, service, text, fail, publicUser };
  registerPublicAuthRoutes(app, publicContext);
  app.use('/api', sessionMiddleware(service, allowTestIdentity));

  const requireRole = (req, roles) => {
    if (!roles.includes(req.actor.role)) fail('Seu perfil não pode executar esta ação.', 403);
  };
  const getAudit = (id) => service.audit(Number(id)) || fail('Auditoria não encontrada.', 404);
  const getNC = (id) => service.nc(Number(id)) || fail('Não conformidade não encontrada.', 404);
  const ownAudit = (req, audit) => {
    if (req.actor.role !== 'ADMIN' && req.actor.id !== audit.auditorId) {
      fail('Somente o auditor responsável pode alterar esta auditoria.', 403);
    }
  };
  const manageNC = (req, nonConformity) => {
    if (!['ADMIN', 'GESTOR'].includes(req.actor.role) && req.actor.id !== nonConformity.auditorId) {
      fail('Somente o auditor ou a gestão pode alterar a atribuição e o prazo.', 403);
    }
  };
  const responsible = (id) => {
    const user = service.get('SELECT * FROM users WHERE id=?', Number(id));
    requireValue(user && user.role === 'RESPONSAVEL', 'Selecione um responsável válido.');
    return user;
  };

  const context = {
    db,
    service,
    upload: createUploadMiddleware(),
    fail,
    publicUser,
    requireValue,
    text,
    requireRole,
    getAudit,
    getNC,
    ownAudit,
    manageNC,
    responsible,
  };
  registerAuthRoutes(app, context);
  registerAdminRoutes(app, context);
  registerRequirementRoutes(app, context);
  registerAuditRoutes(app, context);
  registerNonConformityRoutes(app, context);
  registerNotificationRoutes(app, context);

  app.use('/api', (_, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));
  app.use((err, req, res, _next) => {
    if (err.code?.startsWith('ERR_SQLITE') && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já existe um registro com este código ou vínculo.' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({
      error: err.status ? err.message : 'Não foi possível concluir a operação.',
    });
  });
  return { app, service };
}