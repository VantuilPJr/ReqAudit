import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKLIST, dateOffset } from './domain.js';
import { defaultPassword, hashPassword } from './auth.js';
export const ATTACHMENTS_DIR =
  process.env.ATTACHMENTS_PATH ||
  fileURLToPath(new URL('../data/attachments', import.meta.url));
export function openDatabase(
  filename = process.env.DATABASE_PATH ||
    fileURLToPath(new URL('../data/reqaudit.sqlite', import.meta.url)),
) {
  if (filename !== ':memory:')
    mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, managementLevel TEXT, passwordHash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requirements (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL, actor TEXT NOT NULL DEFAULT '', preconditions TEXT NOT NULL DEFAULT '', mainFlow TEXT NOT NULL DEFAULT '', alternativeFlow TEXT NOT NULL DEFAULT '', businessRules TEXT NOT NULL DEFAULT '', acceptanceCriteria TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL, dependencies TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checklist_items (id INTEGER PRIMARY KEY, description TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audits (id INTEGER PRIMARY KEY, requirementId INTEGER REFERENCES requirements(id), auditorId INTEGER NOT NULL REFERENCES users(id), requirementSnapshot TEXT NOT NULL, sourceType TEXT NOT NULL DEFAULT 'REQUISITO' CHECK(sourceType IN ('REQUISITO','DOCUMENTO')), documentSnapshot TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL, finishedAt TEXT, status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO', adherencePercentage REAL);
    CREATE TABLE IF NOT EXISTS answers (auditId INTEGER NOT NULL REFERENCES audits(id), checklistItemId INTEGER NOT NULL REFERENCES checklist_items(id), description TEXT NOT NULL, result TEXT CHECK(result IN ('CONFORME','NAO_CONFORME')), observation TEXT NOT NULL DEFAULT '', PRIMARY KEY(auditId, checklistItemId));
    CREATE TABLE IF NOT EXISTS non_conformities (id INTEGER PRIMARY KEY, auditId INTEGER NOT NULL, checklistItemId INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('BAIXA','MEDIA','ALTA','CRITICA')), responsibleId INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'ABERTA' CHECK(status IN ('ABERTA','EM_TRATAMENTO','RESOLVIDA','ESCALONADA')), dueDate TEXT NOT NULL, escalationLevel INTEGER NOT NULL DEFAULT 0 CHECK(escalationLevel BETWEEN 0 AND 3), correction TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, resolvedAt TEXT, UNIQUE(auditId, checklistItemId), FOREIGN KEY(auditId, checklistItemId) REFERENCES answers(auditId, checklistItemId));
    CREATE TABLE IF NOT EXISTS nc_history (id INTEGER PRIMARY KEY, nonConformityId INTEGER NOT NULL REFERENCES non_conformities(id), userId INTEGER REFERENCES users(id), action TEXT NOT NULL, description TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id), nonConformityId INTEGER NOT NULL REFERENCES non_conformities(id), message TEXT NOT NULL, createdAt TEXT NOT NULL, readAt TEXT);
    CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY, nonConformityId INTEGER NOT NULL REFERENCES non_conformities(id), recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'SIMULADO', error TEXT, createdAt TEXT NOT NULL, sentAt TEXT);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS nc_deadlines ON non_conformities(status, dueDate);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expiresAt);
  `);
  migrateBinaryResults(db);
  migrateExternalDocuments(db);
  migrateAuthentication(db);
  migrateAttachments(db);
  migrateSettings(db);
  db.exec('PRAGMA optimize');
  mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  return db;
}
export function migrateBinaryResults(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL, previousData TEXT NOT NULL)',
  );
  const migrationId = '20260909_binary_audit_results';
  if (
    db.prepare('SELECT id FROM schema_migrations WHERE id=?').get(migrationId)
  )
    return;
  transaction(db, () => {
    const answers = db
      .prepare("SELECT * FROM answers WHERE result='NAO_APLICAVEL'")
      .all();
    const audits = db
      .prepare(
        "SELECT * FROM audits WHERE id IN (SELECT auditId FROM answers WHERE result='NAO_APLICAVEL')",
      )
      .all();
    db.prepare(
      'INSERT INTO schema_migrations (id,appliedAt,previousData) VALUES (?,?,?)',
    ).run(
      migrationId,
      new Date().toISOString(),
      JSON.stringify({ answers, audits }),
    );
    for (const audit of audits) {
      db.prepare(
        "UPDATE audits SET status='EM_ANDAMENTO',finishedAt=NULL,adherencePercentage=NULL WHERE id=?",
      ).run(audit.id);
    }
    db.prepare(
      "UPDATE answers SET result=NULL WHERE result='NAO_APLICAVEL'",
    ).run();
    // Also enforce the new choices in databases created with the legacy CHECK constraint.
    db.exec(`CREATE TRIGGER IF NOT EXISTS answers_binary_insert BEFORE INSERT ON answers
      WHEN NEW.result IS NOT NULL AND NEW.result NOT IN ('CONFORME','NAO_CONFORME')
      BEGIN SELECT RAISE(ABORT,'Resultado de auditoria inválido'); END;
      CREATE TRIGGER IF NOT EXISTS answers_binary_update BEFORE UPDATE OF result ON answers
      WHEN NEW.result IS NOT NULL AND NEW.result NOT IN ('CONFORME','NAO_CONFORME')
      BEGIN SELECT RAISE(ABORT,'Resultado de auditoria inválido'); END;`);
  });
}
export function migrateExternalDocuments(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL, previousData TEXT NOT NULL)',
  );
  const migrationId = '20260911_external_document_audits';
  if (
    db.prepare('SELECT id FROM schema_migrations WHERE id=?').get(migrationId)
  )
    return;
  const columns = db.prepare('PRAGMA table_info(audits)').all();
  const requirementId = columns.find((column) => column.name === 'requirementId');
  const alreadyCompatible =
    requirementId?.notnull === 0 &&
    columns.some((column) => column.name === 'sourceType') &&
    columns.some((column) => column.name === 'documentSnapshot');
  if (alreadyCompatible) {
    db.prepare(
      'INSERT INTO schema_migrations (id,appliedAt,previousData) VALUES (?,?,?)',
    ).run(migrationId, new Date().toISOString(), '{}');
    return;
  }
  const previousSchema = db
    .prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='audits'")
    .get()?.sql;
  db.exec('PRAGMA foreign_keys=OFF');
  try {
    transaction(db, () => {
      db.exec(`CREATE TABLE audits_external_documents (
        id INTEGER PRIMARY KEY,
        requirementId INTEGER REFERENCES requirements(id),
        auditorId INTEGER NOT NULL REFERENCES users(id),
        requirementSnapshot TEXT NOT NULL,
        sourceType TEXT NOT NULL DEFAULT 'REQUISITO' CHECK(sourceType IN ('REQUISITO','DOCUMENTO')),
        documentSnapshot TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL,
        finishedAt TEXT,
        status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
        adherencePercentage REAL
      )`);
      db.exec(`INSERT INTO audits_external_documents
        (id,requirementId,auditorId,requirementSnapshot,sourceType,documentSnapshot,createdAt,finishedAt,status,adherencePercentage)
        SELECT id,requirementId,auditorId,requirementSnapshot,'REQUISITO','{}',createdAt,finishedAt,status,adherencePercentage FROM audits`);
      db.exec('DROP TABLE audits');
      db.exec('ALTER TABLE audits_external_documents RENAME TO audits');
      db.prepare(
        'INSERT INTO schema_migrations (id,appliedAt,previousData) VALUES (?,?,?)',
      ).run(
        migrationId,
        new Date().toISOString(),
        JSON.stringify({ previousSchema }),
      );
      const violations = db.prepare('PRAGMA foreign_key_check').all();
      if (violations.length)
        throw new Error('A migração de documentos externos violou vínculos existentes.');
    });
  } finally {
    db.exec('PRAGMA foreign_keys=ON');
  }
}
export function migrateAuthentication(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL, previousData TEXT NOT NULL)',
  );
  const migrationId = '20260911_password_sessions';
  if (
    db.prepare('SELECT id FROM schema_migrations WHERE id=?').get(migrationId)
  )
    return;
  const columns = db.prepare('PRAGMA table_info(users)').all();
  if (!columns.some((column) => column.name === 'passwordHash'))
    db.exec("ALTER TABLE users ADD COLUMN passwordHash TEXT NOT NULL DEFAULT ''");
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expiresAt);`);
  transaction(db, () => {
    const users = db
      .prepare("SELECT id,role FROM users WHERE passwordHash=''")
      .all();
    const update = db.prepare('UPDATE users SET passwordHash=? WHERE id=?');
    for (const user of users)
      update.run(hashPassword(defaultPassword(user.role)), user.id);
    db.prepare(
      'INSERT INTO schema_migrations (id,appliedAt,previousData) VALUES (?,?,?)',
    ).run(
      migrationId,
      new Date().toISOString(),
      JSON.stringify({ initializedUsers: users.map((user) => user.id) }),
    );
  });
}
export function migrateAttachments(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL, previousData TEXT NOT NULL)',
  );
  const migrationId = '20260911_audit_attachments';
  if (
    db.prepare('SELECT id FROM schema_migrations WHERE id=?').get(migrationId)
  )
    return;
  const columns = db.prepare('PRAGMA table_info(audits)').all();
  if (!columns.some((c) => c.name === 'attachmentPath'))
    db.exec('ALTER TABLE audits ADD COLUMN attachmentPath TEXT');
  if (!columns.some((c) => c.name === 'attachmentName'))
    db.exec('ALTER TABLE audits ADD COLUMN attachmentName TEXT');
  db.prepare(
    'INSERT INTO schema_migrations (id,appliedAt,previousData) VALUES (?,?,?)',
  ).run(migrationId, new Date().toISOString(), '{}');
}
export function migrateSettings(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )`);
  const defaults = [
    ['smtp_enabled', 'false'],
    ['smtp_host', ''],
    ['smtp_port', '587'],
    ['smtp_secure', 'false'],
    ['smtp_user', ''],
    ['smtp_pass', ''],
    ['smtp_from', 'ReqAudit <reqaudit@example.test>'],
    ['notify_email', ''],
  ];
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)',
  );
  for (const [key, value] of defaults) insert.run(key, value);
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export function seed(db) {
  if (db.prepare('SELECT count(*) n FROM users').get().n) return;
  transaction(db, () => {
    const user = db.prepare(
      'INSERT INTO users (id,name,email,role,managementLevel,passwordHash) VALUES (?,?,?,?,?,?)',
    );
    [
      [1, 'Maria Oliveira', 'maria@example.test', 'AUDITOR', null],
      [2, 'João Silva', 'joao@example.test', 'RESPONSAVEL', null],
      [3, 'Ana Costa', 'ana@example.test', 'RESPONSAVEL', null],
      [4, 'Pedro Santos', 'pedro@example.test', 'GESTOR', 'LIDER'],
      [5, 'Carla Mendes', 'carla@example.test', 'GESTOR', 'GERENTE'],
      [6, 'Administrador', 'admin@example.test', 'ADMIN', null],
    ].forEach((row) => user.run(...row, hashPassword(defaultPassword(row[3]))));
    CHECKLIST.forEach((text, i) =>
      db.prepare('INSERT INTO checklist_items VALUES (?,?)').run(i + 1, text),
    );
    const now = new Date().toISOString();
    const reqs = [
      [
        'RF-001',
        'Realizar login no sistema',
        'O sistema deverá permitir que usuários cadastrados realizem autenticação utilizando e-mail e senha.',
        'Usuário',
        'Possuir cadastro ativo.',
        '1. Informar e-mail.\n2. Informar senha.\n3. Validar credenciais.\n4. Direcionar à página inicial.',
        'A1. Credenciais inválidas.\nA2. Usuário bloqueado.',
        'RN-01 Após cinco tentativas inválidas, bloquear o usuário.',
        'Login válido deve redirecionar à tela inicial.',
        'ALTA',
        'RF-002 Cadastro de usuário',
        'Solicitação do time de segurança',
      ],
      [
        'RF-002',
        'Cadastrar usuário',
        'O sistema deverá permitir o cadastro de usuários com nome, e-mail único e senha.',
        'Visitante',
        'Não possuir conta com o mesmo e-mail.',
        '1. Preencher dados.\n2. Validar campos.\n3. Criar conta.\n4. Confirmar cadastro.',
        'A1. E-mail já cadastrado.',
        'RN-02 E-mail deve ser único.',
        'Dado um e-mail novo e dados válidos, quando cadastrar, então a conta é criada.',
        'ALTA',
        '',
        'Expansão da base de clientes',
      ],
      [
        'RF-003',
        'Recuperar senha',
        'O sistema deverá permitir a recuperação da senha por um link enviado ao e-mail cadastrado.',
        'Usuário',
        'Possuir uma conta ativa.',
        '1. Solicitar recuperação.\n2. Receber link.\n3. Informar nova senha.',
        'A1. Link expirado.',
        'RN-03 Link válido por 30 minutos e de uso único.',
        'Um link usado não pode ser reutilizado. Um link expirado deve ser rejeitado.',
        'MEDIA',
        'RF-001; RF-002',
        'Reduzir chamados de suporte',
      ],
    ];
    reqs.forEach((r) =>
      db
        .prepare(
          'INSERT INTO requirements (code,title,description,actor,preconditions,mainFlow,alternativeFlow,businessRules,acceptanceCriteria,priority,dependencies,origin,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(...r, now, now),
    );
    for (let id = 1; id <= 3; id++) {
      const req = db.prepare('SELECT * FROM requirements WHERE id=?').get(id);
      const finished = id < 3;
      db.prepare(
        'INSERT INTO audits (id,requirementId,auditorId,requirementSnapshot,createdAt,finishedAt,status,adherencePercentage) VALUES (?,?,?,?,?,?,?,?)',
      ).run(
        id,
        id,
        1,
        JSON.stringify(req),
        now,
        finished ? now : null,
        finished ? 'FINALIZADA' : 'EM_ANDAMENTO',
        id === 1 ? 86.67 : id === 2 ? 100 : null,
      );
      CHECKLIST.forEach((description, i) =>
        db
          .prepare('INSERT INTO answers VALUES (?,?,?,?,?)')
          .run(
            id,
            i + 1,
            description,
            id === 3
              ? i < 5
                ? 'CONFORME'
                : null
              : id === 1
                ? [9, 10].includes(i)
                  ? 'NAO_CONFORME'
                  : 'CONFORME'
                : 'CONFORME',
            id === 1 && i === 9
              ? 'Faltam critérios para bloqueio e credenciais inválidas.'
              : '',
          ),
      );
    }
    [
      [
        1,
        10,
        'Critérios de aceitação incompletos',
        'Faltam cenários verificáveis para credenciais inválidas e bloqueio após cinco tentativas.',
        'ALTA',
        2,
        dateOffset(-2),
      ],
      [
        1,
        11,
        'Testabilidade do bloqueio',
        'Definir como desbloquear a conta e validar a duração do bloqueio.',
        'MEDIA',
        3,
        dateOffset(3),
      ],
    ].forEach((row) => {
      const result = db
        .prepare(
          'INSERT INTO non_conformities (auditId,checklistItemId,title,description,severity,responsibleId,dueDate,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        )
        .run(...row, now);
      const id = Number(result.lastInsertRowid);
      db.prepare(
        'INSERT INTO nc_history (nonConformityId,userId,action,description,createdAt) VALUES (?,1,?,?,?)',
      ).run(
        id,
        'CRIACAO',
        'NC criada na auditoria de demonstração e atribuída ao responsável.',
        now,
      );
      db.prepare(
        'INSERT INTO notifications (userId,nonConformityId,message,createdAt) VALUES (?,?,?,?)',
      ).run(
        row[5],
        id,
        `NC-${String(id).padStart(3, '0')} foi atribuída a você.`,
        now,
      );
    });
  });
}
