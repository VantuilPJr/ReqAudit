export const labels: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_TRATAMENTO: 'Em tratamento',
  RESOLVIDA: 'Resolvida',
  ESCALONADA: 'Escalonada',
  FINALIZADA: 'Finalizada',
  EM_ANDAMENTO: 'Em andamento',
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
  AUDITOR: 'Auditor',
  RESPONSAVEL: 'Responsável',
  GESTOR: 'Gestor',
  ADMIN: 'Administrador',
  CONFORME: 'Conforme',
  NAO_CONFORME: 'Não conforme',
  REQUISITO: 'Requisito cadastrado',
  DOCUMENTO: 'Documento externo',
  PDF: 'PDF',
  IMPRESSO: 'Impresso',
  JIRA: 'Jira',
  OUTRO: 'Outro',
};

export const displayText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';

export const ncCode = (id: number) => `NC-${String(id).padStart(3, '0')}`;
export const auditCode = (id: number) => `AUD-${String(id).padStart(3, '0')}`;

export const percentage = (value: number | null) =>
  value === null
    ? 'Sem resultado'
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export const formatDate = (value: string) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(
        'pt-BR',
      )
    : '—';

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export function futureDate(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
