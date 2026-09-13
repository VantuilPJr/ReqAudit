import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  openDatabase,
  seed,
  migrateBinaryResults,
  migrateExternalDocuments,
} from '../backend/database.js';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../backend/app.js';
import { createService } from '../backend/service.js';
import {
  adherence,
  escalationLevel,
  daysLate,
  dateOffset,
  today,
  validDate,
} from '../backend/domain.js';
import { createMailer } from '../backend/mail.js';
async function fixture(t, database) {
  const db = database || openDatabase(':memory:');
  seed(db);
  const { app, service } = createApp(db, { allowTestIdentity: true });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const request = async (route, method = 'GET', body, actor = 1) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-user-id': String(actor),
      },
      ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  return { db, service, request, base };
}
test('aderência inclui todos os 15 itens e diferencia respostas pendentes', () => {
  const answers = [
    ...Array(13).fill({ result: 'CONFORME' }),
    ...Array(2).fill({ result: 'NAO_CONFORME' }),
  ];
  assert.equal(adherence(answers).adherence, 86.67);
  assert.equal(adherence(answers).total, 15);
  assert.equal(
    adherence(Array(15).fill({ result: 'NAO_CONFORME' })).adherence,
    0,
  );
  assert.equal(
    adherence(Array(15).fill({ result: 'CONFORME' })).adherence,
    100,
  );
  assert.equal(adherence([]).adherence, null);
  assert.equal(
    adherence([{ result: null }, { result: 'CONFORME' }]).pending,
    1,
  );
});
test('migração reabre somente auditorias legadas com pendências e preserva NCs e histórico', async (t) => {
  const template = openDatabase(':memory:');
  const tableSchema = template
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name!='schema_migrations' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((row) => row.sql)
    .join(';');
  template.close();
  const legacy = new DatabaseSync(':memory:');
  legacy.exec(
    'PRAGMA foreign_keys=ON;' +
      tableSchema.replace(
        "result IN ('CONFORME','NAO_CONFORME')",
        "result IN ('CONFORME','NAO_CONFORME','NAO_APLICAVEL')",
      ),
  );
  seed(legacy);
  legacy
    .prepare(
      "UPDATE answers SET result='NAO_APLICAVEL',observation='Dependência registrada na versão original.' WHERE auditId=1 AND checklistItemId=13",
    )
    .run();
  legacy
    .prepare('UPDATE audits SET adherencePercentage=85.71 WHERE id=1')
    .run();
  const service = createService(legacy);
  const before = Object.fromEntries(
    ['non_conformities', 'nc_history', 'notifications', 'outbox'].map(
      (table) => [table, service.all(`SELECT * FROM ${table}`)],
    ),
  );
  const unaffected = service.get('SELECT * FROM audits WHERE id=2');
  migrateBinaryResults(legacy);
  const migrated = service.audit(1);
  assert.equal(migrated.status, 'EM_ANDAMENTO');
  assert.equal(migrated.finishedAt, null);
  assert.equal(migrated.adherencePercentage, null);
  assert.equal(migrated.stats.adherence, 80);
  assert.equal(migrated.stats.pending, 1);
  assert.equal(migrated.answers[12].result, null);
  assert.equal(
    migrated.answers[12].observation,
    'Dependência registrada na versão original.',
  );
  assert.deepEqual(service.get('SELECT * FROM audits WHERE id=2'), unaffected);
  for (const [table, rows] of Object.entries(before))
    assert.deepEqual(service.all(`SELECT * FROM ${table}`), rows);
  assert.deepEqual(service.all('PRAGMA foreign_key_check'), []);
  assert.throws(() =>
    service.run(
      "UPDATE answers SET result='NAO_APLICAVEL' WHERE auditId=1 AND checklistItemId=13",
    ),
  );
  const saved = JSON.parse(
    service.get('SELECT previousData FROM schema_migrations').previousData,
  );
  assert.equal(saved.answers[0].result, 'NAO_APLICAVEL');
  assert.equal(saved.audits[0].status, 'FINALIZADA');
  const { request } = await fixture(t, legacy);
  assert.equal((await request('/audits/1/finish', 'POST', {})).status, 400);
  assert.equal(
    (await request('/audits/1/checklist/10', 'PUT', { result: 'CONFORME' }))
      .status,
    400,
  );
  assert.equal(
    (await request('/audits/1/checklist/13', 'PUT', { result: 'CONFORME' }))
      .status,
    200,
  );
  assert.equal(
    (await request('/audits/1/finish', 'POST', {})).body.adherence,
    86.67,
  );
  migrateBinaryResults(legacy);
  assert.equal(service.audit(1).status, 'FINALIZADA');
  assert.equal(service.audit(1).stats.pending, 0);
  assert.equal(service.all('SELECT * FROM schema_migrations').length, 1);
});
test('banco novo aceita somente conforme e não conforme', () => {
  const db = openDatabase(':memory:');
  seed(db);
  try {
    assert.throws(() =>
      db
        .prepare(
          "UPDATE answers SET result='NAO_APLICAVEL' WHERE auditId=3 AND checklistItemId=15",
        )
        .run(),
    );
    assert.equal(createService(db).audit(1).stats.adherence, 86.67);
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM answers WHERE result NOT IN ('CONFORME','NAO_CONFORME')",
        )
        .get().n,
      0,
    );
  } finally {
    db.close();
  }
});
test('datas civis em São Paulo e níveis nos limites de 0, 1, 2 e 5 dias', () => {
  assert.equal(today(new Date('2026-09-09T01:30:00Z')), '2026-09-08');
  assert.deepEqual(
    [0, 1, 2, 4, 5, 20].map(escalationLevel),
    [0, 1, 2, 2, 3, 3],
  );
  assert.equal(daysLate('2026-09-08', '2026-09-08'), 0);
  assert.equal(daysLate('2026-09-08', '2026-09-09'), 1);
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2028-02-29'), true);
});
test('login cria sessão persistida, protege a API e respeita o perfil', async (t) => {
  const db = openDatabase(':memory:');
  seed(db);
  const { app } = createApp(db);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  assert.equal((await fetch(`${base}/bootstrap`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@reqaudit.com',
          password: 'senha-errada',
        }),
      })
    ).status,
    401,
  );
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@reqaudit.com',
      password: '12345678',
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const authenticated = await fetch(`${base}/bootstrap`, {
    headers: { cookie },
  });
  assert.equal(authenticated.status, 200);
  assert.equal((await authenticated.json()).currentUser.role, 'ADMIN');
  assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n, 1);
  assert.notEqual(
    db.prepare("SELECT passwordHash FROM users WHERE role='ADMIN'").get()
      .passwordHash,
    '12345678',
  );
  const logout = await fetch(`${base}/auth/logout`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(logout.status, 200);
  assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n, 0);
  assert.equal(
    (await fetch(`${base}/bootstrap`, { headers: { cookie } })).status,
    401,
  );
});
test('cadastro, código único e preservação do requisito avaliado', async (t) => {
  const { request } = await fixture(t);
  const requirement = {
    code: 'RF-099',
    title: 'Exportar relatório',
    description: 'Permitir exportação em PDF.',
    priority: 'ALTA',
    origin: 'Solicitação de negócio',
  };
  const created = await request('/requirements', 'POST', requirement);
  assert.equal(created.status, 201);
  assert.equal(
    (await request('/requirements', 'POST', requirement)).status,
    409,
  );
  const audit = await request('/audits', 'POST', {
    requirementId: created.body.id,
    auditorId: 1,
  });
  assert.equal(audit.status, 201);
  await request(`/requirements/${created.body.id}`, 'PUT', {
    ...requirement,
    title: 'Novo título',
  });
  const saved = (await request(`/audits/${audit.body.id}`)).body;
  assert.equal(saved.requirementSnapshot.title, 'Exportar relatório');
  assert.equal(saved.answers.length, 15);
  assert.equal(saved.stats.pending, 15);
});
test('auditoria avalia documento externo sem cadastro prévio e preserva sua identificação', async (t) => {
  const { request, service } = await fixture(t);
  const requirementsBefore = service.get('SELECT count(*) n FROM requirements').n;
  const created = await request('/audits', 'POST', {
    sourceType: 'DOCUMENTO',
    auditorId: 1,
    documentType: 'JIRA',
    documentTitle: 'História de autenticação corporativa',
    documentCode: 'SEG-482',
    documentVersion: 'Sprint 18',
    documentReference: 'https://jira.example.test/browse/SEG-482',
    documentScope: 'Descrição e critérios de aceite',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.requirementId, null);
  assert.equal(created.body.sourceType, 'DOCUMENTO');
  assert.equal(created.body.documentTitle, 'História de autenticação corporativa');
  assert.equal(created.body.requirementCode, 'SEG-482');
  assert.equal(created.body.answers.length, 15);
  assert.equal(created.body.stats.pending, 15);
  assert.equal(service.get('SELECT count(*) n FROM requirements').n, requirementsBefore);

  await request(`/audits/${created.body.id}/checklist/1`, 'PUT', {
    result: 'NAO_CONFORME',
  });
  const nc = await request('/non-conformities', 'POST', {
    auditId: created.body.id,
    checklistItemId: 1,
    title: 'História sem identificador funcional',
    description: 'O documento não informa um identificador funcional único.',
    severity: 'MEDIA',
    responsibleId: 2,
    dueDate: dateOffset(2),
  });
  assert.equal(nc.status, 201);
  assert.equal(nc.body.documentTitle, 'História de autenticação corporativa');
  assert.equal(nc.body.documentCode, 'SEG-482');
  assert.match(
    service.get('SELECT body FROM outbox WHERE nonConformityId=?', nc.body.id)
      .body,
    /Documento avaliado: História de autenticação corporativa · SEG-482 · versão Sprint 18/,
  );
  assert.equal(
    (
      await request('/audits', 'POST', {
        sourceType: 'DOCUMENTO',
        auditorId: 1,
        documentType: 'PLANILHA',
        documentTitle: 'Documento inválido',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/audits', 'POST', {
        sourceType: 'DOCUMENTO',
        auditorId: 1,
        documentType: 'PDF',
        documentTitle: '   ',
      })
    ).status,
    400,
  );
});
test('migração permite documentos externos e preserva auditorias e respostas antigas', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE requirements (id INTEGER PRIMARY KEY, code TEXT NOT NULL, title TEXT NOT NULL);
      CREATE TABLE checklist_items (id INTEGER PRIMARY KEY, description TEXT NOT NULL);
      CREATE TABLE audits (id INTEGER PRIMARY KEY, requirementId INTEGER NOT NULL REFERENCES requirements(id), auditorId INTEGER NOT NULL REFERENCES users(id), requirementSnapshot TEXT NOT NULL, createdAt TEXT NOT NULL, finishedAt TEXT, status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO', adherencePercentage REAL);
      CREATE TABLE answers (auditId INTEGER NOT NULL REFERENCES audits(id), checklistItemId INTEGER NOT NULL REFERENCES checklist_items(id), description TEXT NOT NULL, result TEXT, observation TEXT NOT NULL DEFAULT '', PRIMARY KEY(auditId, checklistItemId));
      INSERT INTO users VALUES (1,'Maria');
      INSERT INTO requirements VALUES (1,'RF-001','Login');
      INSERT INTO checklist_items VALUES (1,'Possui identificador?');
      INSERT INTO audits VALUES (1,1,1,'{"code":"RF-001","title":"Login"}','2026-09-11T10:00:00.000Z',NULL,'EM_ANDAMENTO',NULL);
      INSERT INTO answers VALUES (1,1,'Possui identificador?','CONFORME','Conferido.');`);
    migrateExternalDocuments(db);
    migrateExternalDocuments(db);
    const columns = db.prepare('PRAGMA table_info(audits)').all();
    assert.equal(columns.find((column) => column.name === 'requirementId').notnull, 0);
    assert.ok(columns.some((column) => column.name === 'documentSnapshot'));
    assert.equal(db.prepare('SELECT sourceType FROM audits WHERE id=1').get().sourceType, 'REQUISITO');
    assert.equal(db.prepare('SELECT observation FROM answers').get().observation, 'Conferido.');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(
      db.prepare("SELECT count(*) n FROM schema_migrations WHERE id='20260911_external_document_audits'").get().n,
      1,
    );
  } finally {
    db.close();
  }
});
test('auditorias independentes, apenas duas respostas aceitas e finalização completa', async (t) => {
  const { request } = await fixture(t);
  const first = (
    await request('/audits', 'POST', { requirementId: 1, auditorId: 1 })
  ).body;
  const second = (
    await request('/audits', 'POST', { requirementId: 1, auditorId: 1 })
  ).body;
  assert.equal(
    (await request(`/audits/${first.id}/finish`, 'POST', {})).status,
    400,
  );
  for (const result of ['NAO_APLICAVEL', 'OUTRO', '', null]) {
    assert.equal(
      (await request(`/audits/${first.id}/checklist/1`, 'PUT', { result }))
        .status,
      400,
    );
  }
  for (let i = 1; i <= 15; i++)
    assert.equal(
      (
        await request(`/audits/${first.id}/checklist/${i}`, 'PUT', {
          result: 'CONFORME',
        })
      ).status,
      200,
    );
  const finished = await request(`/audits/${first.id}/finish`, 'POST', {});
  assert.equal(finished.body.adherence, 100);
  assert.equal(finished.body.audit.status, 'FINALIZADA');
  assert.equal(
    (
      await request(`/audits/${first.id}/checklist/1`, 'PUT', {
        result: 'CONFORME',
      })
    ).status,
    400,
  );
  assert.equal((await request(`/audits/${second.id}`)).body.stats.pending, 15);
});
test('NC exige item reprovado e criação repetida não duplica registros', async (t) => {
  const { request, service } = await fixture(t);
  const nc = {
    auditId: 3,
    checklistItemId: 1,
    title: 'Problema de clareza',
    description: 'Critério ambíguo.',
    severity: 'ALTA',
    responsibleId: 2,
    dueDate: dateOffset(2),
  };
  assert.equal((await request('/non-conformities', 'POST', nc)).status, 400);
  await request('/audits/3/checklist/1', 'PUT', { result: 'NAO_CONFORME' });
  const a = await request('/non-conformities', 'POST', nc),
    b = await request('/non-conformities', 'POST', nc);
  assert.equal(a.status, 201);
  assert.equal(b.body.id, a.body.id);
  assert.equal(
    service.get(
      'SELECT count(*) n FROM nc_history WHERE nonConformityId=?',
      a.body.id,
    ).n,
    1,
  );
  assert.equal(
    service.get(
      'SELECT count(*) n FROM outbox WHERE nonConformityId=?',
      a.body.id,
    ).n,
    1,
  );
  assert.equal(
    (await request('/audits/3/checklist/1', 'PUT', { result: 'CONFORME' }))
      .status,
    400,
  );
});
test('nova NC notifica o responsável no sistema e prepara o e-mail cadastrado', async (t) => {
  const { request, service } = await fixture(t);
  service.run(
    "UPDATE settings SET value='true' WHERE key='smtp_enabled'",
  );
  await request('/audits/3/checklist/1', 'PUT', {
    result: 'NAO_CONFORME',
  });
  const created = await request('/non-conformities', 'POST', {
    auditId: 3,
    checklistItemId: 1,
    title: 'Identificação ausente',
    description: 'O documento não informa um identificador único.',
    severity: 'ALTA',
    responsibleId: 2,
    dueDate: dateOffset(3),
  });
  assert.equal(created.status, 201);
  assert.ok(
    service.get(
      'SELECT id FROM notifications WHERE userId=? AND nonConformityId=?',
      2,
      created.body.id,
    ),
  );
  const email = service.get(
    'SELECT recipient,status FROM outbox WHERE nonConformityId=?',
    created.body.id,
  );
  assert.equal(email.recipient, 'joao@example.test');
  assert.equal(email.status, 'PENDENTE');
});
test('fluxo de tratamento, evidência, validação pelo auditor e histórico', async (t) => {
  const { request, service } = await fixture(t);
  assert.equal(
    (
      await request('/non-conformities/1/status', 'PATCH', {
        status: 'RESOLVIDA',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        '/non-conformities/1/status',
        'PATCH',
        { status: 'EM_TRATAMENTO' },
        2,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        '/non-conformities/1/correction',
        'POST',
        { correction: 'Incluídos cenários de bloqueio e erro.' },
        2,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        '/non-conformities/1/status',
        'PATCH',
        { status: 'RESOLVIDA' },
        2,
      )
    ).status,
    403,
  );
  const resolved = await request('/non-conformities/1/status', 'PATCH', {
    status: 'RESOLVIDA',
  });
  assert.equal(resolved.body.status, 'RESOLVIDA');
  assert.ok(resolved.body.resolvedAt);
  assert.equal(resolved.body.overdue, false);
  assert.equal(
    (
      await request('/non-conformities/1/deadline', 'PATCH', {
        dueDate: dateOffset(2),
        reason: 'Novo prazo',
      })
    ).status,
    400,
  );
  service.escalate();
  assert.equal(service.nc(1).escalationLevel, 0);
  assert.equal((await request('/non-conformities/1/history')).body.length, 4);
});
test('escalonamento idempotente, destinatários e preservação de tratamento', async (t) => {
  const { service } = await fixture(t);
  service.run(
    'UPDATE non_conformities SET dueDate=? WHERE id=1',
    dateOffset(-1),
  );
  assert.equal(service.escalate().updated, 1);
  assert.equal(service.nc(1).escalationLevel, 1);
  assert.equal(service.nc(1).status, 'ESCALONADA');
  assert.equal(service.all('SELECT * FROM outbox').length, 2);
  assert.equal(service.escalate().updated, 0);
  assert.equal(service.all('SELECT * FROM outbox').length, 2);
  service.run(
    "UPDATE non_conformities SET dueDate=?,status='EM_TRATAMENTO' WHERE id=1",
    dateOffset(-2),
  );
  service.escalate();
  assert.equal(service.nc(1).status, 'EM_TRATAMENTO');
  assert.equal(service.all('SELECT * FROM outbox').length, 5);
  service.run(
    'UPDATE non_conformities SET dueDate=? WHERE id=1',
    dateOffset(-5),
  );
  service.escalate();
  assert.equal(service.nc(1).escalationLevel, 3);
  assert.equal(service.all('SELECT * FROM outbox').length, 9);
  assert.deepEqual(
    service
      .all('SELECT DISTINCT recipient FROM outbox ORDER BY recipient')
      .map((r) => r.recipient),
    [
      'carla@example.test',
      'joao@example.test',
      'maria@example.test',
      'pedro@example.test',
    ],
  );
});
test('alteração de prazo recalcula nível e status e registra justificativa', async (t) => {
  const { request, service } = await fixture(t);
  const late = await request('/non-conformities/2/deadline', 'PATCH', {
    dueDate: dateOffset(-5),
    reason: 'Prazo original corrigido',
  });
  assert.equal(late.status, 200);
  assert.equal(late.body.status, 'ESCALONADA');
  assert.equal(late.body.escalationLevel, 3);
  const future = await request('/non-conformities/2/deadline', 'PATCH', {
    dueDate: dateOffset(5),
    reason: 'Prorrogação aprovada',
  });
  assert.equal(future.body.status, 'ABERTA');
  assert.equal(future.body.escalationLevel, 0);
  assert.equal(future.body.overdue, false);
  assert.equal(
    service.all(
      "SELECT * FROM nc_history WHERE nonConformityId=2 AND action='PRAZO'",
    ).length,
    2,
  );
});
test('atribuição informa novo responsável e é restrita à gestão', async (t) => {
  const { request, service } = await fixture(t);
  assert.equal(
    (
      await request(
        '/non-conformities/1/responsible',
        'PATCH',
        { responsibleId: 3 },
        2,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/non-conformities/1/responsible', 'PATCH', {
        responsibleId: 3,
      })
    ).status,
    200,
  );
  assert.equal(service.nc(1).responsibleName, 'Ana Costa');
  assert.ok(
    service.all(
      'SELECT * FROM notifications WHERE userId=3 AND nonConformityId=1',
    ).length,
  );
  assert.equal(
    (await request('/admin/check-deadlines', 'POST', {}, 1)).status,
    403,
  );
  assert.equal(
    (await request('/admin/check-deadlines', 'POST', {}, 6)).status,
    200,
  );
});
test('caixa de saída e notificações respeitam perfil e leitura', async (t) => {
  const { request, base } = await fixture(t);
  await request('/admin/check-deadlines', 'POST', {}, 6);
  assert.equal((await request('/bootstrap')).body.outbox.length, 0);
  assert.ok(
    (await request('/bootstrap', 'GET', undefined, 6)).body.outbox.length > 0,
  );
  await request('/notifications/read', 'PATCH', {}, 2);
  assert.equal(
    (
      await request('/bootstrap', 'GET', undefined, 2)
    ).body.notifications.filter((n) => !n.readAt).length,
    0,
  );
  assert.ok(
    (await request('/bootstrap')).body.notifications.some((n) => !n.readAt),
  );
  const blocked = await fetch(base + '/requirements', {
    headers: { origin: 'https://example.org' },
  });
  assert.equal(blocked.status, 403);
});
test('falha transacional não deixa NC, histórico ou comunicação parcial', async (t) => {
  const { db, service } = await fixture(t);
  const before = service.all('SELECT * FROM nc_history').length;
  db.exec(
    "CREATE TRIGGER refuse_mail BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'Simulated outbox failure'); END;",
  );
  assert.throws(() => service.escalate());
  assert.equal(service.nc(1).escalationLevel, 0);
  assert.equal(service.all('SELECT * FROM nc_history').length, before);
  assert.equal(service.all('SELECT * FROM outbox').length, 0);
});
test('falha de configuração SMTP fica visível e não marca mensagem como enviada', async (t) => {
  const { db, service } = await fixture(t);
  const oldEnabled = process.env.SMTP_ENABLED,
    oldHost = process.env.SMTP_HOST;
  t.after(() => {
    if (oldEnabled === undefined) delete process.env.SMTP_ENABLED;
    else process.env.SMTP_ENABLED = oldEnabled;
    if (oldHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = oldHost;
  });
  process.env.SMTP_ENABLED = 'true';
  delete process.env.SMTP_HOST;
  service.escalate();
  await createMailer(db)();
  assert.ok(
    service
      .all('SELECT * FROM outbox')
      .every((m) => m.status === 'FALHOU' && !m.sentAt),
  );
  assert.equal(service.nc(1).escalationLevel, 2);
});
test('dados persistem ao fechar e reabrir o banco SQLite', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'reqaudit-test-')),
    filename = path.join(dir, 'test.sqlite');
  try {
    const db = openDatabase(filename);
    seed(db);
    createService(db).run(
      "UPDATE requirements SET title='Persistido após reinício' WHERE id=1",
    );
    db.close();
    const reopened = openDatabase(filename);
    assert.equal(
      reopened.prepare('SELECT title FROM requirements WHERE id=1').get().title,
      'Persistido após reinício',
    );
    seed(reopened);
    assert.equal(
      reopened.prepare('SELECT count(*) n FROM requirements').get().n,
      3,
    );
    reopened.close();
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dir, { recursive: true, force: true });
  }
});

test('finalização salva observações pendentes atomicamente e preserva resultado', async (t) => {
  const { request, service, db } = await fixture(t);
  const created = (
    await request('/audits', 'POST', { requirementId: 1, auditorId: 1 })
  ).body;
  service.run(
    "UPDATE answers SET result='CONFORME' WHERE auditId=?",
    created.id,
  );
  const invalid = await request(`/audits/${created.id}/finish`, 'POST', {
    observations: { 1: 'Não pode salvar parcialmente', 99: 'Item inexistente' },
  });
  assert.equal(invalid.status, 400);
  assert.equal(service.audit(created.id).status, 'EM_ANDAMENTO');
  assert.equal(service.audit(created.id).answers[0].observation, '');
  db.exec(
    "CREATE TRIGGER fail_finish BEFORE UPDATE ON audits BEGIN SELECT RAISE(ABORT,'Erro de teste ao finalizar'); END;",
  );
  const previousError = console.error;
  console.error = () => {};
  try {
    assert.equal(
      (
        await request(`/audits/${created.id}/finish`, 'POST', {
          observations: { 1: 'Texto ainda pendente' },
        })
      ).status,
      500,
    );
  } finally {
    console.error = previousError;
  }
  assert.equal(service.audit(created.id).answers[0].observation, '');
  db.exec('DROP TRIGGER fail_finish');
  const finished = await request(`/audits/${created.id}/finish`, 'POST', {
    observations: {
      1: 'Identificador verificado na especificação.',
      15: 'Origem confirmada com a área de negócio.',
    },
  });
  assert.equal(finished.status, 200);
  assert.equal(
    finished.body.audit.answers[0].observation,
    'Identificador verificado na especificação.',
  );
  assert.equal(
    finished.body.audit.answers[14].observation,
    'Origem confirmada com a área de negócio.',
  );
  assert.equal(finished.body.adherence, 100);
  assert.equal(
    (
      await request(`/audits/${created.id}/finish`, 'POST', {
        observations: { 1: 'Alteração posterior' },
      })
    ).status,
    400,
  );
});
