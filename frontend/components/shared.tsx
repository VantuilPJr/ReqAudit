import React from 'react';
import { ChevronRight, FileCheck2, Files } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Audit, NonConformity } from '../types/domain';
import { displayText, labels } from '../utils/formatters';

export function StatusBadge({
  value,
  children,
}: {
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={`badge ${value?.toLowerCase() || ''}`}>
      <span className="badge-dot" />
      {children || labels[value || ''] || value}
    </span>
  );
}

export function Picker({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={String(value ?? '')}
      onValueChange={(nextValue) => onChange(nextValue ?? '')}
      items={options.map((option) => ({ ...option, value: String(option.value) }))}
      disabled={disabled}
    >
      <SelectTrigger
        className="picker"
        aria-label={label}
        id={`picker-${label.replaceAll(' ', '-')}`}
      >
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem value={String(option.value)} key={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FormField({
  label,
  value,
  onChange,
  area = false,
  required = false,
  type = 'text',
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  area?: boolean;
  required?: boolean;
  type?: string;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      {area ? (
        <Textarea
          id={id}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          required={required}
        />
      ) : (
        <Input
          id={id}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          required={required}
        />
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty">
      <FileCheck2 size={30} />
      <p>{text}</p>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="subtitle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EvaluatedDocument({ record, open = false }: { record: Audit | NonConformity; open?: boolean }) {
  const external = record.sourceType === 'DOCUMENTO';
  const snapshot = (external
    ? record.documentSnapshot
    : record.requirementSnapshot) as Record<string, unknown>;
  const fields = external
    ? [
        ['type', 'Tipo'],
        ['title', 'Nome do documento'],
        ['code', 'Código ou chave'],
        ['version', 'Versão'],
        ['reference', 'Referência, caminho ou link'],
        ['scope', 'Trecho, página ou requisitos avaliados'],
      ]
    : [
        ['code', 'Código'],
        ['title', 'Título'],
        ['description', 'Descrição'],
        ['actor', 'Ator'],
        ['preconditions', 'Pré-condições'],
        ['mainFlow', 'Fluxo principal'],
        ['alternativeFlow', 'Fluxos alternativos'],
        ['businessRules', 'Regras de negócio'],
        ['acceptanceCriteria', 'Critérios de aceitação'],
        ['priority', 'Prioridade'],
        ['dependencies', 'Dependências'],
        ['origin', 'Origem'],
      ];
  const reference = displayText(snapshot?.reference);

  return (
    <details className="panel artifact-snapshot" open={open}>
      <summary>
        <Files size={18} />
        {external ? 'Documento externo avaliado' : 'Requisito cadastrado avaliado'}
        <StatusBadge value={external ? displayText(snapshot?.type) : 'REQUISITO'} />
        <ChevronRight size={16} />
      </summary>
      <div>
        {fields.map(([key, label]) => {
          const raw = displayText(snapshot?.[key]);
          const value = key === 'type' ? labels[raw] || raw : raw;
          return (
            <p key={key}>
              <strong>{label}</strong>
              {key === 'reference' && /^https?:\/\//i.test(reference) ? (
                <a className="document-reference" href={reference} target="_blank" rel="noreferrer">
                  {reference}
                </a>
              ) : (
                value || 'Não informado'
              )}
            </p>
          );
        })}
      </div>
    </details>
  );
}
