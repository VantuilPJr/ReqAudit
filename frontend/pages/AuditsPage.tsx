import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, CircleAlert, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Audit, AuditAnswer, User } from '../types/domain';
import { AuditTable } from '../components/RecordTables';
import { EmptyState, EvaluatedDocument, PageHeader, StatusBadge } from '../components/shared';
import { FileAttachment, Observation } from '../features/audits/AuditControls';
import { auditCode, formatDate, labels, ncCode, percentage } from '../utils/formatters';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuditsPageProps = {
  audits: Audit[];
  selectedId?: number;
  user: User;
  isAdmin: boolean;
  canAudit: boolean;
  busy: boolean;
  drafts: Record<string, string>;
  onDraftsChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onNavigate: (path: string) => void;
  onNewAudit: () => void;
  onCreateNonConformity: (audit: Audit, answer: AuditAnswer) => void;
  onMutate: (path: string, method: RequestMethod, body: Record<string, unknown>, message?: string) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
};

export function AuditsPage({
  audits,
  selectedId,
  user,
  isAdmin,
  canAudit,
  busy,
  drafts,
  onDraftsChange,
  onNavigate,
  onNewAudit,
  onCreateNonConformity,
  onMutate,
  onRefresh,
}: AuditsPageProps) {
  if (!selectedId) {
    return (
      <>
        <PageHeader
          eyebrow="AVALIAÇÃO DE QUALIDADE"
          title="Auditorias"
          description="Avalie pelo checklist um requisito cadastrado ou um documento externo, como PDF, impresso ou item do Jira."
          action={canAudit && <Button className="primary-action" onClick={onNewAudit}><Plus /> Nova auditoria</Button>}
        />
        <section className="panel"><AuditTable items={audits} onOpen={(id) => onNavigate(`audits/${id}`)} /></section>
      </>
    );
  }

  const audit = audits.find((item) => item.id === selectedId);
  if (!audit) return <EmptyState text="Auditoria não encontrada." />;
  const editable = audit.status === 'EM_ANDAMENTO' && (user.id === audit.auditorId || isAdmin);

  return (
    <>
      <Button variant="ghost" className="back" onClick={() => onNavigate('audits')}><ArrowLeft /> Auditorias</Button>
      <PageHeader
        eyebrow={`${auditCode(audit.id)} · ${audit.requirementCode}`}
        title={audit.requirementTitle}
        description={`Auditor: ${audit.auditorName} · Iniciada em ${formatDate(audit.createdAt)}`}
        action={<StatusBadge value={audit.status} />}
      />
      <div className="audit-layout">
        <section className="checklist">
          <EvaluatedDocument record={audit} open={audit.sourceType === 'DOCUMENTO'} />
          <FileAttachment audit={audit} canEdit={editable} onRefresh={onRefresh} />
          <div className="checklist-heading">
            <h2>Checklist de auditoria</h2>
            <span>{15 - audit.stats.pending} de 15 respondidos</span>
          </div>
          {audit.answers.map((answer) => {
            const nonConformity = audit.nonConformities.find((item) => item.checklistItemId === answer.checklistItemId);
            const draftKey = `${audit.id}:${answer.checklistItemId}`;
            return (
              <article className={`check-item ${answer.result?.toLowerCase() || ''}`} key={answer.checklistItemId}>
                <div className="question">
                  <span>{String(answer.checklistItemId).padStart(2, '0')}</span>
                  <h3>{answer.description}</h3>
                  {answer.result === 'CONFORME' && <CheckCircle2 size={19} />}
                </div>
                <RadioGroup
                  value={answer.result || ''}
                  disabled={!editable || busy}
                  onValueChange={async (result) => {
                    const updated = await onMutate(`/audits/${audit.id}/checklist/${answer.checklistItemId}`, 'PUT', { result });
                    if (updated && result === 'NAO_CONFORME' && !nonConformity) onCreateNonConformity(audit, answer);
                  }}
                  aria-label={answer.description}
                  className="answer-options"
                >
                  {(['CONFORME', 'NAO_CONFORME'] as const).map((result) => (
                    <label className={answer.result === result ? 'selected' : ''} key={result}>
                      <RadioGroupItem value={result} />{labels[result]}
                    </label>
                  ))}
                </RadioGroup>
                <Observation
                  item={answer}
                  value={drafts[draftKey] ?? answer.observation}
                  onDraft={(value) => onDraftsChange((current) => ({ ...current, [draftKey]: value }))}
                  disabled={!editable || !answer.result || busy}
                  onSave={async (value) => {
                    const saved = await onMutate(`/audits/${audit.id}/checklist/${answer.checklistItemId}`, 'PUT', { observation: value }, 'Observação salva.');
                    if (saved) onDraftsChange((current) => {
                      const next = { ...current };
                      delete next[draftKey];
                      return next;
                    });
                  }}
                />
                {answer.result === 'NAO_CONFORME' && (
                  <div className="nc-prompt">
                    <span><CircleAlert size={16} />{nonConformity ? `${ncCode(nonConformity.id)} vinculada a este item` : 'Há uma não conformidade a registrar'}</span>
                    {nonConformity ? (
                      <Button variant="ghost" onClick={() => onNavigate(`non-conformities/${nonConformity.id}`)}>Abrir NC <ArrowUpRight /></Button>
                    ) : editable ? (
                      <Button variant="outline" onClick={() => onCreateNonConformity(audit, answer)}><Plus /> Registrar NC</Button>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </section>
        <aside className="audit-summary panel">
          <span className="section-kicker">RESULTADO DA AUDITORIA</span>
          <h2>Aderência{audit.stats.pending > 0 ? ' parcial' : ''}</h2>
          <div className="adherence-number">{percentage(audit.stats.adherence)}</div>
          <Progress value={audit.stats.adherence || 0} aria-label="Percentual de aderência" />
          <dl>
            {[
              ['Conformes', audit.stats.conforming, 'green'],
              ['Não conformes', audit.stats.nonConforming, 'red'],
              ['Pendentes', audit.stats.pending, 'amber'],
              ['NCs em aberto', audit.nonConformities.filter((item) => item.status !== 'RESOLVIDA').length, 'blue'],
            ].map(([label, value, tone]) => (
              <div key={label}><dt><i className={`dot ${tone}`} />{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <p className="formula">
            {audit.stats.conforming} conformes ÷ {audit.stats.total} itens{audit.stats.total > 0 ? ' × 100' : ''}<br />
            Todos os itens entram no cálculo.
          </p>
          {editable && (
            <>
              <Button
                className="finish-button"
                disabled={busy || audit.stats.pending > 0}
                onClick={async () => {
                  const observations = Object.fromEntries(Object.entries(drafts).filter(([key]) => key.startsWith(`${audit.id}:`)).map(([key, value]) => [key.split(':')[1], value]));
                  const saved = await onMutate(`/audits/${audit.id}/finish`, 'POST', { observations }, 'Auditoria finalizada. O resultado foi preservado.');
                  if (saved) onDraftsChange((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${audit.id}:`))));
                }}
              >
                <Check /> Finalizar auditoria
              </Button>
              {audit.stats.pending > 0 && <small>Responda todos os itens para finalizar.</small>}
            </>
          )}
          {audit.status === 'FINALIZADA' && <p className="completed"><CheckCircle2 size={18} /> Finalizada em {formatDate(audit.finishedAt)}</p>}
        </aside>
      </div>
    </>
  );
}
