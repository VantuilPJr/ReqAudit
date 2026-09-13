import { ArrowLeft, ArrowUp, ArrowUpRight, Check, CheckCircle2, History, Play, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { NonConformity, User } from '../types/domain';
import { NonConformityTable } from '../components/RecordTables';
import { EvaluatedDocument, PageHeader, Picker, StatusBadge } from '../components/shared';
import { formatDate, formatDateTime, labels, ncCode } from '../utils/formatters';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Props = {
  items: NonConformity[];
  detail: NonConformity | null;
  selectedId?: number;
  user: User;
  isAdmin: boolean;
  busy: boolean;
  search: string;
  filter: string;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onNavigate: (path: string) => void;
  onOpenModal: (values: Record<string, unknown>) => void;
  onMutate: (path: string, method: RequestMethod, body: Record<string, unknown>, message?: string) => Promise<unknown>;
  onCheckDeadlines: () => void;
};

const historyTitle = (action: string) => {
  if (action === 'ESCALONAMENTO') return 'Escalonamento automático';
  if (action === 'CORRECAO') return 'Correção registrada';
  if (action === 'CRIACAO') return 'Não conformidade criada';
  if (action === 'STATUS') return 'Status atualizado';
  if (action === 'PRAZO') return 'Prazo atualizado';
  return 'Responsável atualizado';
};

export function NonConformitiesPage({
  items,
  detail,
  selectedId,
  user,
  isAdmin,
  busy,
  search,
  filter,
  onSearch,
  onFilter,
  onNavigate,
  onOpenModal,
  onMutate,
  onCheckDeadlines,
}: Props) {
  if (!selectedId) {
    const visible = items.filter((item) =>
      `${ncCode(item.id)} ${item.title} ${item.requirementCode} ${item.responsibleName}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'TODAS' || (filter === 'ATRASADAS' && item.overdue) || item.status === filter),
    );
    return (
      <>
        <PageHeader
          eyebrow="TRATAMENTO E ACOMPANHAMENTO"
          title="Não conformidades"
          description="Controle responsáveis, prazos e a verificação das correções."
          action={isAdmin && <Button variant="outline" disabled={busy} onClick={onCheckDeadlines}><RefreshCw /> Verificar prazos</Button>}
        />
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <Input aria-label="Buscar não conformidades" placeholder="Buscar NC, requisito ou responsável…" value={search} onChange={(event) => onSearch(event.target.value)} />
          </div>
          <Picker
            label="Filtrar por status"
            value={filter}
            onChange={onFilter}
            options={[
              { value: 'TODAS', label: 'Todos os status' },
              { value: 'ATRASADAS', label: 'Somente atrasadas' },
              ...['ABERTA', 'EM_TRATAMENTO', 'ESCALONADA', 'RESOLVIDA'].map((status) => ({ value: status, label: labels[status] })),
            ]}
          />
        </div>
        <section className="panel"><NonConformityTable items={visible} onOpen={(id) => onNavigate(`non-conformities/${id}`)} /></section>
      </>
    );
  }

  if (!detail) return <output>Carregando não conformidade…</output>;
  const canContribute = [detail.responsibleId, detail.auditorId].includes(user.id) || isAdmin;
  const canManage = user.id === detail.auditorId || isAdmin || user.role === 'GESTOR';
  return (
    <>
      <Button variant="ghost" className="back" onClick={() => onNavigate('non-conformities')}><ArrowLeft /> Não conformidades</Button>
      <PageHeader eyebrow={`${ncCode(detail.id)} · ${detail.requirementCode}`} title={detail.title} action={<StatusBadge value={detail.status} />} />
      <div className="nc-detail-grid">
        <div>
          <EvaluatedDocument record={detail} open />
          <section className="panel nc-description">
            <h2>Não conformidade identificada</h2>
            <p>{detail.description}</p>
            <button type="button" className="inline-link" onClick={() => onNavigate(`audits/${detail.auditId}`)}>
              Ver item {detail.checklistItemId} da auditoria <ArrowUpRight size={16} />
            </button>
          </section>
          <section className="panel correction-panel">
            <h2>Evidência de correção</h2>
            {detail.correction ? <p className="evidence">{detail.correction}</p> : <p className="muted">O responsável ainda não registrou a correção.</p>}
            {detail.status !== 'RESOLVIDA' && canContribute && (
              <div className="actions">
                <Button variant="outline" onClick={() => onOpenModal({ type: 'correction', id: detail.id, correction: detail.correction })}>Registrar correção</Button>
                {(user.id === detail.auditorId || isAdmin) && (
                  <Button disabled={busy || !detail.correction} onClick={() => onOpenModal({ type: 'resolve', id: detail.id })}>
                    <CheckCircle2 /> Verificar e resolver
                  </Button>
                )}
              </div>
            )}
          </section>
          <section className="panel history-panel">
            <h2><History size={20} /> Histórico de acompanhamento</h2>
            <div className="timeline">
              {(detail.history ?? []).map((entry) => (
                <div className="timeline-item" key={entry.id}>
                  <span className={`timeline-icon ${entry.action === 'ESCALONAMENTO' ? 'warning' : ''}`}>
                    {entry.action === 'ESCALONAMENTO' ? <ArrowUp size={14} /> : <Check size={14} />}
                  </span>
                  <div>
                    <strong>{historyTitle(entry.action)}</strong>
                    <p>{entry.description}</p>
                    <small>{entry.userName || 'Sistema'} · {formatDateTime(entry.createdAt)}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="panel nc-properties">
          <h2>Detalhes da NC</h2>
          <dl>
            <div><dt>Severidade</dt><dd><StatusBadge value={detail.severity} /></dd></div>
            <div><dt>Responsável</dt><dd>{detail.responsibleName}</dd></div>
            <div><dt>Auditor</dt><dd>{detail.auditorName}</dd></div>
            <div>
              <dt>Prazo</dt>
              <dd className={detail.overdue ? 'late-text' : ''}>{formatDate(detail.dueDate)}{detail.overdue && <small>{detail.daysLate} dia(s) de atraso</small>}</dd>
            </div>
            <div>
              <dt>Escalonamento</dt>
              <dd>Nível {detail.escalationLevel}<small>{detail.escalationLevel === 0 ? 'Sem escalonamento' : detail.escalationLevel === 1 ? 'Responsável e auditor' : detail.escalationLevel === 2 ? 'Responsável, auditor e líder' : 'Responsável, auditor, líder e gerente'}</small></dd>
            </div>
          </dl>
          {detail.status !== 'RESOLVIDA' && (
            <div className="property-actions">
              {canContribute && detail.status !== 'EM_TRATAMENTO' && (
                <Button disabled={busy} onClick={() => void onMutate(`/non-conformities/${detail.id}/status`, 'PATCH', { status: 'EM_TRATAMENTO' }, 'Tratamento iniciado.')}><Play /> Iniciar tratamento</Button>
              )}
              {canManage && (
                <>
                  <Button variant="outline" onClick={() => onOpenModal({ type: 'responsible', id: detail.id, responsibleId: detail.responsibleId })}>Alterar responsável</Button>
                  <Button variant="outline" onClick={() => onOpenModal({ type: 'deadline', id: detail.id, dueDate: detail.dueDate, reason: '' })}>Alterar prazo</Button>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
