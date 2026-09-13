import { hashSessionToken } from '../auth.js';
import { cookieValue } from '../http.js';

export function sessionMiddleware(service, allowTestIdentity = false) {
  return (req, res, next) => {
    if (allowTestIdentity && req.get('x-user-id')) {
      req.actor = service.get('SELECT * FROM users WHERE id=?', Number(req.get('x-user-id')));
    } else {
      const token = cookieValue(req, 'reqaudit_session');
      if (token) {
        const session = service.get(
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
    if (!req.actor) return res.status(401).json({ error: 'Faça login para acessar o ReqAudit.' });
    next();
  };
}
