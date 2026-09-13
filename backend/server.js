import 'dotenv/config';
import cron from 'node-cron';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { openDatabase, seed } from './database.js';
import { createApp } from './app.js';
import { createMailer } from './mail.js';
const db = openDatabase();
seed(db);
const { app, service } = createApp(db),
  flush = createMailer(db);
app.use(
  express.static(fileURLToPath(new URL('../dist-local', import.meta.url))),
);
app.get('/{*path}', (_, res) =>
  res.sendFile(
    fileURLToPath(new URL('../dist-local/index.html', import.meta.url)),
  ),
);
const task = cron.schedule(
  '0 8 * * *',
  () => {
    try {
      service.escalate();
      void flush();
    } catch (e) {
      console.error('Falha na verificação de prazos:', e.message);
    }
  },
  { timezone: 'America/Sao_Paulo', noOverlap: true },
);
const mailTimer = setInterval(() => void flush(), 15000);
mailTimer.unref();
const server = app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () =>
  console.log(
    `ReqAudit disponível em http://localhost:${process.env.PORT || 3001}`,
  ),
);
function close() {
  void task.stop();
  clearInterval(mailTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
