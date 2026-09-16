import { openDatabase, seed } from '../backend/database.js';
import { createApp } from '../backend/app.js';
import { createMailer } from '../backend/mail.js';

// Vercel loads this module once per warm Function instance. The database and
// mailer are kept at module scope so requests in the same instance share the
// session and outbox state. For durable production data, configure an external
// database and object storage before using this adapter beyond a demo.
const db = openDatabase();
seed(db);
const mailer = createMailer(db);
const { app } = createApp(db, { mailer, allowStatelessSession: true });

export default function handler(req, res) {
  // Rewrites may preserve either the /api prefix or the function filename.
  // Normalize both forms so Express always sees the routes registered in app.js.
  const originalUrl = req.url || '/';
  const parsed = new URL(originalUrl, 'http://vercel.local');
  let pathname = parsed.pathname;
  const functionPrefix = '/api/index.js';
  if (pathname === functionPrefix || pathname.startsWith(`${functionPrefix}/`)) {
    pathname = pathname.slice(functionPrefix.length) || '/';
  }
  if (!pathname.startsWith('/api')) {
    pathname = pathname === '/' ? '/api' : `/api${pathname}`;
  }
  req.url = `${pathname}${parsed.search}`;
  return app(req, res);
}
