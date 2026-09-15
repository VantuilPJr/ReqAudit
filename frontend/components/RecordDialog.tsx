import type { Dispatch, SetStateAction } from 'react';
import { Check, ClipboardCheck, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { uploadAuditAttachment } from '../api/audits';
import { toast } from './toast';
import { FormField as Field, Picker } from './shared';
import type { Row } from '../types';
import type { BootstrapData, NonConformity, User } from '../types/domain';
import { displayText, labels } from '../utils/formatters';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Props = {
  modal: Row | null;
  setModal: Dispatch<SetStateAction<Row | null>>;
  busy: boolean;
  mutate: (path: string, method: RequestMethod, body: Row, message?: string) => Promise<Row | null>;
  data: BootstrapData;
  user: User;
  detail: NonConformity | null;
  pendingFile: File | null;
  setPendingFile: Dispatch<SetStateAction<File | null>>;
  refresh: () => Promise<BootstrapData>;
  navigate: (path: string) => void;
};

export function RecordDialog({ modal, setModal, busy, mutate, data, user, detail, pendingFile, setPendingFile, refresh, navigate: go }: Props) {
  return (<Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent
          className={`app-dialog ${['requirement', 'audit'].includes(displayText(modal?.type)) ? 'wide-dialog' : ''}`}
          showCloseButton={!busy}
        >
          {modal && (
            <>
              <DialogTitle>
                {
                  (
                    {
                      requirement: modal.id
                        ? 'Editar requisito'
                        : 'Novo requisito funcional',
                      audit: 'Iniciar auditoria',
                      nc: 'Registrar não conformidade',
                      correction: 'Registrar evidência de correção',
                      deadline: 'Alterar prazo',
                      responsible: 'Alterar responsável',
                      resolve: 'Verificar e resolver NC',
                      user: 'Editar usuário',
                    } as Record<string, string>
                  )[modal.type]
                }
              </DialogTitle>
              <DialogDescription>
                {modal.type === 'audit'
                  ? 'Identifique o material avaliado. O sistema preservará esses dados e os 15 itens do checklist na auditoria.'
                  : modal.type === 'nc'
                    ? `${modal.requirementCode} · Item ${modal.checklistItemId}: ${modal.itemDescription}`
                    : modal.type === 'user'
                      ? 'O e-mail do responsável é usado nas notificações e no envio das correções.'
                    : modal.type === 'resolve'
                      ? 'Confirme que você verificou a evidência e que a correção resolve o problema identificado.'
                      : 'Preencha as informações abaixo para salvar o registro.'}
              </DialogDescription>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  let r: Row | null = null;
                  const m = modal;
                  if (m.type === 'user')
                    r = await mutate(
                      `/admin/users/${m.id}`,
                      'PATCH',
                      {
                        name: m.name,
                        email: m.email,
                        password: m.password,
                      },
                      'Usuário atualizado.',
                    );
                  if (m.type === 'requirement')
                    r = await mutate(
                      `/requirements${m.id ? `/${m.id}` : ''}`,
                      m.id ? 'PUT' : 'POST',
                      m,
                      'Requisito salvo.',
                    );
                  if (m.type === 'audit') {
                    const auditPayload: Row = {
                      sourceType: m.sourceType,
                      auditorId: m.auditorId,
                      ...(m.sourceType === 'DOCUMENTO'
                        ? {
                            documentType: m.documentType,
                            documentTitle: m.documentTitle,
                            documentCode: m.documentCode,
                            documentVersion: m.documentVersion,
                            documentReference: m.documentReference,
                            documentScope: m.documentScope,
                          }
                        : { requirementId: m.requirementId }),
                    };
                    r = await mutate(
                      '/audits',
                      'POST',
                      auditPayload,
                      pendingFile ? undefined : 'Auditoria iniciada.',
                    );
                    if (r && pendingFile) {
                      await uploadAuditAttachment(Number(r.id), pendingFile);
                      await refresh();
                      toast.success('Auditoria iniciada com documento anexado.');
                      setPendingFile(null);
                    }
                  }
                  if (m.type === 'nc')
                    r = await mutate(
                      '/non-conformities',
                      'POST',
                      m,
                      'Não conformidade registrada.',
                    );
                  if (m.type === 'correction')
                    r = await mutate(
                      `/non-conformities/${m.id}/correction`,
                      'POST',
                      m,
                      'Correção registrada para verificação do auditor.',
                    );
                  if (m.type === 'deadline' || m.type === 'responsible')
                    r = await mutate(
                      `/non-conformities/${m.id}/${m.type}`,
                      'PATCH',
                      m,
                      'Não conformidade atualizada.',
                    );
                  if (m.type === 'resolve')
                    r = await mutate(
                      `/non-conformities/${m.id}/status`,
                      'PATCH',
                      { status: 'RESOLVIDA' },
                      'Correção verificada. NC resolvida.',
                    );
                  if (r) {
                    setModal(null);
                    if (m.type === 'audit') go(`audits/${r.id}`);
                  }
                }}
              >
                {modal.type === 'user' && (
                  <>
                    <Field
                      label="Nome"
                      required
                      value={displayText(modal.name)}
                      onChange={(value) =>
                        setModal({ ...modal, name: value })
                      }
                    />
                    <Field
                      label="E-mail"
                      type="email"
                      required
                      value={displayText(modal.email)}
                      onChange={(value) =>
                        setModal({ ...modal, email: value })
                      }
                    />
                    <Field
                      label="Nova senha"
                      type="password"
                      value={displayText(modal.password)}
                      hint="Deixe em branco para manter a senha atual. Use pelo menos 8 caracteres."
                      onChange={(value) =>
                        setModal({ ...modal, password: value })
                      }
                    />
                  </>
                )}
                {modal.type === 'requirement' && (
                  <div className="form-grid">
                    {[
                      ['code', 'Código', false, true],
                      ['title', 'Título', false, true],
                      ['description', 'Descrição', true, true],
                      ['actor', 'Ator', false, false],
                      ['preconditions', 'Pré-condições', true, false],
                      ['mainFlow', 'Fluxo principal', true, false],
                      [
                        'alternativeFlow',
                        'Fluxos alternativos ou exceções',
                        true,
                        false,
                      ],
                      ['businessRules', 'Regras de negócio', true, false],
                      [
                        'acceptanceCriteria',
                        'Critérios de aceitação',
                        true,
                        false,
                      ],
                      ['dependencies', 'Dependências', false, false],
                      [
                        'origin',
                        'Origem e necessidade de negócio',
                        true,
                        false,
                      ],
                    ].map(([key, label, area, required]) => (
                      <Field
                        key={String(key)}
                        label={String(label)}
                        value={displayText(modal[String(key)])}
                        onChange={(v) =>
                          setModal({ ...modal, [String(key)]: v })
                        }
                        area={Boolean(area)}
                        required={Boolean(required)}
                      />
                    ))}
                    <div className="field">
                      <label htmlFor="picker-Prioridade">Prioridade</label>
                      <Picker
                        label="Prioridade"
                        value={modal.priority}
                        onChange={(v) => setModal({ ...modal, priority: v })}
                        options={['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].map(
                          (s) => ({ value: s, label: labels[s] }),
                        )}
                      />
                    </div>
                  </div>
                )}
                {modal.type === 'audit' && (
                  <>
                    <div className="field">
                      <label htmlFor="picker-O-que-será-avaliado">
                        O que será avaliado?
                      </label>
                      <Picker
                        label="O que será avaliado"
                        value={modal.sourceType}
                        onChange={(v) =>
                          setModal({ ...modal, sourceType: v })
                        }
                        options={[
                          { value: 'DOCUMENTO', label: 'Documento externo' },
                          { value: 'REQUISITO', label: 'Requisito cadastrado' },
                        ]}
                      />
                    </div>
                    {modal.sourceType === 'REQUISITO' ? (
                      <div className="field">
                        <label htmlFor="picker-Requisito">Requisito</label>
                        <Picker
                          label="Requisito"
                          value={modal.requirementId}
                          onChange={(v) =>
                            setModal({ ...modal, requirementId: v })
                          }
                          options={data.requirements.map((r) => ({
                            value: r.id,
                            label: `${r.code} · ${r.title}`,
                          }))}
                        />
                        {!data.requirements.length && (
                          <small>
                            Nenhum requisito cadastrado. Selecione documento externo para avaliar diretamente pelo checklist.
                          </small>
                        )}
                      </div>
                    ) : (
                      <div className="form-grid document-form">
                        <div className="field">
                          <label htmlFor="picker-Tipo-do-documento">
                            Tipo do documento *
                          </label>
                          <Picker
                            label="Tipo do documento"
                            value={modal.documentType}
                            onChange={(v) =>
                              setModal({ ...modal, documentType: v })
                            }
                            options={['PDF', 'IMPRESSO', 'JIRA', 'OUTRO'].map(
                              (value) => ({ value, label: labels[value] }),
                            )}
                          />
                        </div>
                        <Field
                          label="Nome do documento"
                          required
                          value={displayText(modal.documentTitle)}
                          onChange={(v) =>
                            setModal({ ...modal, documentTitle: v })
                          }
                        />
                        <Field
                          label="Código ou chave"
                          value={displayText(modal.documentCode)}
                          hint="Ex.: ESP-07, PROJ-123 ou RF-018"
                          onChange={(v) =>
                            setModal({ ...modal, documentCode: v })
                          }
                        />
                        <Field
                          label="Versão"
                          value={displayText(modal.documentVersion)}
                          hint="Ex.: 2.1, revisão 04 ou sprint 18"
                          onChange={(v) =>
                            setModal({ ...modal, documentVersion: v })
                          }
                        />
                        <Field
                          label="Referência, caminho ou link"
                          value={displayText(modal.documentReference)}
                          hint="Informe onde localizar o PDF, impresso ou item do Jira."
                          onChange={(v) =>
                            setModal({ ...modal, documentReference: v })
                          }
                        />
                        <Field
                          label="Trecho, página ou requisitos avaliados"
                          area
                          value={displayText(modal.documentScope)}
                          hint="Ex.: páginas 12–15, RF-010 a RF-018 ou critérios de aceite do PROJ-123."
                          onChange={(v) =>
                            setModal({ ...modal, documentScope: v })
                          }
                        />
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="picker-Auditor">Auditor responsável (uma pessoa)</label>
                      <Picker
                        label="Auditor"
                        value={modal.auditorId}
                        disabled={user.role === 'AUDITOR'}
                        onChange={(v) => setModal({ ...modal, auditorId: v })}
                        options={data.users
                          .filter((u) => u.role === 'AUDITOR')
                          .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
                      />
                    </div>
                    <div className="field">
                      <span className="field-label">Documento sendo auditado (opcional)</span>
                      <input
                        id="audit-file-input"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setPendingFile(f);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className={`attachment-upload-area ${pendingFile ? 'dragover' : ''}`}
                        style={{ marginTop: 0 }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const f = e.dataTransfer.files?.[0];
                          if (f) setPendingFile(f);
                        }}
                        onClick={() => document.getElementById('audit-file-input')?.click()}
                        aria-label="Anexar documento à auditoria"
                      >
                        <Paperclip size={18} style={{ color: '#6366f1' }} />
                        <strong style={{ fontSize: '0.875rem' }}>
                          {pendingFile ? pendingFile.name : 'Clique ou arraste o documento'}
                        </strong>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                          {pendingFile
                            ? `${(pendingFile.size / 1024).toFixed(0)} KB — será enviado ao criar a auditoria`
                            : 'PDF, Word, Excel, imagens — máx. 20 MB'}
                        </p>
                      </button>
                      {pendingFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          style={{ fontSize: '0.75rem', minHeight: 28, padding: '0 8px', color: '#ef4444' }}
                          onClick={() => setPendingFile(null)}
                        >
                          <Trash2 size={13} /> Remover
                        </Button>
                      )}
                      <small>O documento será vinculado à auditoria para referência e download.</small>
                    </div>
                    <div className="template-note">
                      <ClipboardCheck size={24} />
                      <span>
                        <strong>Qualidade de requisitos funcionais</strong>
                        <small>Template padrão · 15 itens de verificação</small>
                      </span>
                    </div>
                  </>
                )}
                {modal.type === 'nc' && (
                  <>
                    <Field
                      label="Título"
                      required
                      value={modal.title}
                      onChange={(v) => setModal({ ...modal, title: v })}
                    />
                    <Field
                      label="Descrição do problema"
                      required
                      area
                      value={modal.description}
                      onChange={(v) => setModal({ ...modal, description: v })}
                    />
                    <div className="field">
                      <label htmlFor="picker-Severidade">Severidade</label>
                      <Picker
                        label="Severidade"
                        value={modal.severity}
                        onChange={(v) => setModal({ ...modal, severity: v })}
                        options={['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].map(
                          (s) => ({ value: s, label: labels[s] }),
                        )}
                      />
                    </div>
                  </>
                )}
                {['nc', 'responsible'].includes(modal.type) && (
                  <div className="field">
                    <label htmlFor="picker-Responsável">Responsável</label>
                    <Picker
                      label="Responsável"
                      value={modal.responsibleId}
                      onChange={(v) => setModal({ ...modal, responsibleId: v })}
                      options={data.users
                        .filter((u) => u.role === 'RESPONSAVEL')
                        .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
                    />
                  </div>
                )}
                {['nc', 'deadline'].includes(modal.type) && (
                  <Field
                    label="Prazo"
                    type="date"
                    required
                    value={modal.dueDate}
                    onChange={(v) => setModal({ ...modal, dueDate: v })}
                  />
                )}
                {modal.type === 'deadline' && (
                  <Field
                    label="Justificativa da alteração"
                    required
                    area
                    value={modal.reason}
                    onChange={(v) => setModal({ ...modal, reason: v })}
                    hint="O nível será recalculado de acordo com o novo prazo. O histórico anterior será preservado."
                  />
                )}
                {modal.type === 'correction' && (
                  <Field
                    label="O que foi corrigido e como verificar"
                    required
                    area
                    value={modal.correction}
                    onChange={(v) => setModal({ ...modal, correction: v })}
                    hint="Descreva a alteração no requisito e a evidência utilizada para validá-la."
                  />
                )}
                {modal.type === 'resolve' && (
                  <p className="evidence">{detail?.correction}</p>
                )}
                <div className="form-footer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setModal(null)}
                  >
                    {modal.type === 'nc' ? 'Registrar depois' : 'Cancelar'}
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy
                      ? 'Salvando…'
                      : modal.type === 'audit'
                        ? 'Iniciar auditoria'
                        : modal.type === 'resolve'
                          ? 'Confirmar resolução'
                          : 'Salvar registro'}{' '}
                    <Check size={16} />
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
  );
}
