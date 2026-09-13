import { ArrowLeft, ArrowUpRight, ClipboardCheck, Files, Plus, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Audit, Requirement } from '../types/domain';
import { EmptyState, PageHeader, StatusBadge } from '../components/shared';
import { displayText, labels } from '../utils/formatters';

type RequirementsPageProps = {
  requirements: Requirement[];
  audits: Audit[];
  selectedId?: number;
  search: string;
  canAudit: boolean;
  canEdit: boolean;
  onSearch: (value: string) => void;
  onNavigate: (path: string) => void;
  onNew: () => void;
  onEdit: (requirement: Requirement) => void;
  onAudit: (requirementId: number) => void;
};

const detailFields: Array<[string, keyof Requirement]> = [
  ['Ator', 'actor'],
  ['Prioridade', 'priority'],
  ['Pré-condições', 'preconditions'],
  ['Fluxo principal', 'mainFlow'],
  ['Fluxos alternativos', 'alternativeFlow'],
  ['Regras de negócio', 'businessRules'],
  ['Critérios de aceitação', 'acceptanceCriteria'],
  ['Dependências', 'dependencies'],
  ['Origem e necessidade de negócio', 'origin'],
];

export function RequirementsPage({
  requirements,
  audits,
  selectedId,
  search,
  canAudit,
  canEdit,
  onSearch,
  onNavigate,
  onNew,
  onEdit,
  onAudit,
}: RequirementsPageProps) {
  const selected = selectedId ? requirements.find((item) => item.id === selectedId) : undefined;

  if (selectedId) {
    if (!selected) return <EmptyState text="Requisito não encontrado." />;
    return (
      <>
        <Button variant="ghost" className="back" onClick={() => onNavigate('requirements')}>
          <ArrowLeft /> Requisitos
        </Button>
        <PageHeader
          eyebrow={selected.code}
          title={selected.title}
          action={(
            <div className="actions">
              {canEdit && <Button variant="outline" onClick={() => onEdit(selected)}>Editar requisito</Button>}
              {canAudit && <Button onClick={() => onAudit(selected.id)}><Plus /> Iniciar auditoria</Button>}
            </div>
          )}
        />
        <section className="panel requirement-detail">
          <div className="detail-section">
            <h2>Descrição</h2>
            <p>{selected.description}</p>
          </div>
          <div className="detail-columns">
            {detailFields.map(([label, key]) => {
              const value = displayText(selected[key]);
              return (
                <div className="detail-section" key={key}>
                  <h3>{label}</h3>
                  <p>{labels[value] || value || 'Não informado'}</p>
                </div>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  const visible = requirements.filter((item) =>
    `${item.code} ${item.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="ARTEFATOS AUDITADOS"
        title="Requisitos funcionais"
        description="Especifique o comportamento esperado e mantenha a origem de cada requisito."
        action={canEdit && <Button className="primary-action" onClick={onNew}><Plus /> Novo requisito</Button>}
      />
      <div className="toolbar">
        <div className="search">
          <Search size={18} />
          <Input aria-label="Buscar requisitos" placeholder="Buscar por código ou título…" value={search} onChange={(event) => onSearch(event.target.value)} />
        </div>
        <span>{requirements.length} requisitos</span>
      </div>
      <div className="requirements-grid">
        {visible.map((item) => (
          <article className="requirement-card" key={item.id}>
            <div className="card-top">
              <span className="document-icon"><Files size={22} /></span>
              <StatusBadge value={item.priority} />
            </div>
            <span className="record-code">{item.code}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <div className="requirement-meta">
              <span><UserRound size={15} />{item.actor || 'Ator não informado'}</span>
              <span>{audits.filter((audit) => audit.requirementId === item.id).length} auditoria(s)</span>
            </div>
            <div className="card-actions">
              <Button variant="outline" onClick={() => onNavigate(`requirements/${item.id}`)}>Ver requisito <ArrowUpRight /></Button>
              {canAudit && <Button variant="ghost" onClick={() => onAudit(item.id)}>Auditar <ClipboardCheck /></Button>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
