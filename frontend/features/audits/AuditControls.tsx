import { useRef, useState } from 'react';
import { Download, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { deleteAuditAttachment, uploadAuditAttachment } from '../../api/audits';
import { toast } from '../../components/toast';
import type { Audit, AuditAnswer } from '../../types/domain';
import { displayText } from '../../utils/formatters';

export function Observation({
  item,
  value,
  onDraft,
  disabled,
  onSave,
}: {
  item: AuditAnswer;
  value: string;
  onDraft: (value: string) => void;
  disabled: boolean;
  onSave: (value: string) => Promise<unknown>;
}) {
  return (
    <details className="observation" open={value ? true : undefined}>
      <summary>
        Observação{item.observation ? ' registrada' : ' (opcional)'}
      </summary>
      <label className="sr-only" htmlFor={`observation-${item.checklistItemId}`}>
        Observação do item {item.checklistItemId}
      </label>
      <Textarea
        id={`observation-${item.checklistItemId}`}
        value={value}
        disabled={disabled}
        placeholder="Registre a evidência da sua avaliação…"
        onChange={(event) => onDraft(event.target.value)}
      />
      {!disabled && value !== item.observation && (
        <Button variant="outline" onClick={() => onSave(value)}>
          Salvar observação
        </Button>
      )}
    </details>
  );
}

export function FileAttachment({
  audit,
  canEdit,
  onRefresh,
}: {
  audit: Audit;
  canEdit: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      await uploadAuditAttachment(Number(audit.id), file);
      await onRefresh();
      toast.success('Documento anexado.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!confirm('Remover o anexo desta auditoria?')) return;
    setUploading(true);
    try {
      await deleteAuditAttachment(Number(audit.id));
      await onRefresh();
      toast.success('Anexo removido.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="attachment-widget">
      <h3><Paperclip size={16} /> Documento anexado à auditoria</h3>
      {audit.attachmentName ? (
        <div className="attachment-current">
          <Download size={15} />
          <a
            href={`/api/audits/${audit.id}/attachment`}
            target="_blank"
            rel="noreferrer"
            title={displayText(audit.attachmentName)}
          >
            {displayText(audit.attachmentName)}
          </a>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={uploading}
              aria-label="Remover anexo"
              style={{ minHeight: 28, width: 28, padding: 0 }}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      ) : (
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 10 }}>
          Nenhum anexo vinculado a esta auditoria.
        </p>
      )}
      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.webp"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className={`attachment-upload-area ${dragover ? 'dragover' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragover(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void upload(file);
            }}
            onClick={() => fileRef.current?.click()}
            aria-label="Enviar arquivo para auditoria"
          >
            <Upload size={20} style={{ color: '#6366f1' }} />
            <strong>{uploading ? 'Enviando…' : audit.attachmentName ? 'Substituir arquivo' : 'Clique ou arraste um arquivo'}</strong>
            <p>PDF, Word, Excel, imagens — máximo 20 MB</p>
          </button>
        </>
      )}
    </div>
  );
}
