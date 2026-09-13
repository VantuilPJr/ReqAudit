import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type {
  Audit,
  DashboardStats,
  NonConformity,
  User,
} from '../types/domain';
import { AuditTable } from '../components/RecordTables';
import {
  EmptyState,
  PageHeader,
  StatusBadge,
} from '../components/shared';
import {
  auditCode,
  displayText,
  formatDate,
  labels,
  ncCode,
  percentage,
} from '../utils/formatters';

type DashboardPageProps = {
  user: User;
  dashboard: DashboardStats;
  audits: Audit[];
  nonConformities: NonConformity[];
  inProgressAudit?: Audit;
  assignedNonConformity?: NonConformity;
  canAudit: boolean;
  isAdmin: boolean;
  busy: boolean;
  onNavigate: (path: string) => void;
  onNewAudit: () => void;
  onCheckDeadlines: () => void;
};

export function DashboardPage({
  user,
  dashboard,
  audits,
  nonConformities,
  inProgressAudit,
  assignedNonConformity,
  canAudit,
  isAdmin,
  busy,
  onNavigate,
  onNewAudit,
  onCheckDeadlines,
}: DashboardPageProps) {
  const overdueItems = nonConformities.filter((item) => item.overdue);
  const metrics = [
    {
      name: 'Auditorias realizadas',
      value: dashboard.finished,
      note: `${dashboard.inProgress} em andamento`,
      icon: ClipboardCheck,
      tone: 'blue',
      path: 'audits',
    },
    {
      name: 'Aderência média',
      value: percentage(dashboard.averageAdherence),
      note: 'Das auditorias finalizadas',
      icon: ShieldCheck,
      tone: 'green',
      path: 'audits',
    },
    {
      name: 'NCs em aberto',
      value: dashboard.openNCs,
      note: `${dashboard.resolvedNCs} resolvidas`,
      icon: CircleAlert,
      tone: 'amber',
      path: 'non-conformities',
    },
    {
      name: 'NCs atrasadas',
      value: dashboard.overdueNCs,
      note: 'Precisam de acompanhamento',
      icon: Clock3,
      tone: 'red',
      path: 'non-conformities',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${labels[user.role]} · VISÃO GERAL`}
        title={`Olá, ${displayText(user.name).split(' ')[0]}`}
        description="Veja o que exige ação e continue seu trabalho de onde parou."
        action={canAudit && (
          <Button className="primary-action" onClick={onNewAudit}>
            <Plus /> Nova auditoria
          </Button>
        )}
      />
      <div className="metrics">
        {metrics.map((metric) => (
          <button
            type="button"
            className="metric"
            key={metric.name}
            onClick={() => onNavigate(metric.path)}
          >
            <div className="metric-label">
              {metric.name}
              <span className={`metric-icon ${metric.tone}`}>
                <metric.icon size={19} />
              </span>
            </div>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel attention-panel">
          <div className="section-top">
            <div>
              <span className="section-kicker">PRIORIDADES</span>
              <h2>Precisam da sua atenção</h2>
            </div>
            <button
              type="button"
              className="section-link"
              onClick={() => onNavigate('non-conformities')}
            >
              Ver todas <ArrowUpRight size={16} />
            </button>
          </div>
          {overdueItems.length ? (
            overdueItems.map((item) => (
              <button
                type="button"
                className="attention-item"
                key={item.id}
                onClick={() => onNavigate(`non-conformities/${item.id}`)}
              >
                <span className="attention-symbol"><Clock3 size={20} /></span>
                <span>
                  <small>{ncCode(item.id)} · {item.requirementCode}</small>
                  <strong>{item.title}</strong>
                  <span>{item.responsibleName} · Venceu em {formatDate(item.dueDate)}</span>
                </span>
                <span className="attention-right">
                  <StatusBadge value="ALTA">{item.daysLate} dias de atraso</StatusBadge>
                  <ArrowUpRight size={18} />
                </span>
              </button>
            ))
          ) : (
            <EmptyState text="Todos os prazos estão em dia." />
          )}
          <div className="panel-bottom">
            <span><Info size={16} /> Verificação diária às 08h, horário de Brasília.</span>
            {isAdmin ? (
              <Button variant="outline" disabled={busy} onClick={onCheckDeadlines}>
                <RefreshCw /> Verificar prazos
              </Button>
            ) : (
              <small>Controle disponível no perfil Administrador</small>
            )}
          </div>
        </section>
        <section className="panel next-action-panel">
          <span className="section-kicker">PRÓXIMA AÇÃO</span>
          {inProgressAudit ? (
            <>
              <span className="next-action-icon"><ClipboardCheck size={24} /></span>
              <h2>Continue {auditCode(inProgressAudit.id)}</h2>
              <p>{inProgressAudit.requirementTitle}</p>
              <small>{15 - inProgressAudit.stats.pending} de 15 itens respondidos</small>
              <Progress value={((15 - inProgressAudit.stats.pending) / 15) * 100} aria-label="Progresso da auditoria" />
              <Button onClick={() => onNavigate(`audits/${inProgressAudit.id}`)}>
                Continuar auditoria <ArrowUpRight />
              </Button>
            </>
          ) : assignedNonConformity ? (
            <>
              <span className="next-action-icon warning"><CircleAlert size={24} /></span>
              <h2>Trate {ncCode(assignedNonConformity.id)}</h2>
              <p>{assignedNonConformity.title}</p>
              <small>Prazo: {formatDate(assignedNonConformity.dueDate)}</small>
              <Button onClick={() => onNavigate(`non-conformities/${assignedNonConformity.id}`)}>
                Abrir não conformidade <ArrowUpRight />
              </Button>
            </>
          ) : (
            <>
              <span className="next-action-icon"><CheckCircle2 size={24} /></span>
              <h2>Nenhuma tarefa pendente</h2>
              <p>Os itens sob sua responsabilidade estão em dia.</p>
              {canAudit && <Button onClick={onNewAudit}>Iniciar auditoria <Plus /></Button>}
            </>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="section-top">
          <div>
            <span className="section-kicker">ACOMPANHAMENTO</span>
            <h2>Auditorias recentes</h2>
          </div>
          <Button variant="ghost" onClick={() => onNavigate('audits')}>
            Ver todas <ArrowUpRight />
          </Button>
        </div>
        <AuditTable items={audits.slice(0, 4)} onOpen={(id) => onNavigate(`audits/${id}`)} />
      </section>
      <p className="demo-footnote">
        <span className="live-dot" /> Dados persistidos no SQLite · Atualização automática a cada 15 segundos.
      </p>
    </>
  );
}
