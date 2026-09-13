export function registerRequirementRoutes(app, { service: s, fail, requireRole, requireValue, text }) {
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
}