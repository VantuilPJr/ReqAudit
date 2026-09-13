export const CHECKLIST = [
  'O requisito possui identificador único?',
  'O requisito possui título claro?',
  'A descrição informa claramente o comportamento esperado?',
  'O requisito utiliza linguagem objetiva e sem ambiguidades?',
  'O ator responsável pela interação está identificado?',
  'As pré-condições estão definidas quando necessárias?',
  'O fluxo principal está descrito?',
  'Os fluxos alternativos ou de exceção estão descritos?',
  'As regras de negócio relacionadas estão identificadas?',
  'Existem critérios de aceitação verificáveis?',
  'O requisito é testável?',
  'O requisito não apresenta contradições internas?',
  'Dependências com outros requisitos estão identificadas?',
  'A prioridade do requisito está definida?',
  'O requisito possui rastreabilidade com sua origem ou necessidade de negócio?',
];
export const RESULTS = ['CONFORME', 'NAO_CONFORME'];
export const STATUSES = ['ABERTA', 'EM_TRATAMENTO', 'RESOLVIDA', 'ESCALONADA'];
export const SEVERITIES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function validDate(s) {
  return (
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function daysLate(due, date = today()) {
  return Math.max(
    0,
    Math.round((Date.parse(date) - Date.parse(due)) / 86400000),
  );
}
export function escalationLevel(days) {
  return days >= 5 ? 3 : days >= 2 ? 2 : days >= 1 ? 1 : 0;
}
export function dateOffset(n) {
  return new Date(Date.parse(today()) + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function adherence(answers) {
  const count = (result) => answers.filter((a) => a.result === result).length;
  const conforming = count('CONFORME'),
    nonConforming = count('NAO_CONFORME');
  return {
    total: answers.length,
    conforming,
    nonConforming,
    pending: answers.length - conforming - nonConforming,
    adherence: answers.length
      ? Math.round((conforming / answers.length) * 10000) / 100
      : null,
  };
}
