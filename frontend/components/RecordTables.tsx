import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Audit, NonConformity } from '../types/domain';
import {
  auditCode,
  formatDate,
  ncCode,
  percentage,
} from '../utils/formatters';
import { EmptyState, StatusBadge } from './shared';

export function NonConformityTable({
  items,
  onOpen,
}: {
  items: NonConformity[];
  onOpen: (id: number) => void;
}) {
  if (!items.length) return <EmptyState text="Nenhuma não conformidade encontrada." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Não conformidade</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead>Prazo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead><span className="sr-only">Abrir</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <button type="button" className="row-link" onClick={() => onOpen(item.id)}>
                <span className="record-code">
                  {ncCode(item.id)} <span>· {item.requirementCode}</span>
                </span>
                <strong>{item.title}</strong>
              </button>
            </TableCell>
            <TableCell>
              <span className="person">
                <span className="mini-avatar">
                  {item.responsibleName.split(' ').map((name) => name[0]).slice(0, 2).join('')}
                </span>
                {item.responsibleName}
              </span>
            </TableCell>
            <TableCell>
              <span className={item.overdue ? 'late-text' : ''}>{formatDate(item.dueDate)}</span>
              {item.overdue && <small className="late-text">{item.daysLate} dia(s) de atraso</small>}
            </TableCell>
            <TableCell>
              <StatusBadge value={item.status} />
              {item.escalationLevel > 0 && <small>Nível {item.escalationLevel}</small>}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Abrir ${ncCode(item.id)}`}
                onClick={() => onOpen(item.id)}
              >
                <ArrowUpRight />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AuditTable({ items, onOpen }: { items: Audit[]; onOpen: (id: number) => void }) {
  if (!items.length)
    return <EmptyState text="Nenhuma auditoria criada. Inicie uma auditoria a partir de um requisito." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Auditoria / requisito</TableHead>
          <TableHead>Auditor</TableHead>
          <TableHead>Progresso</TableHead>
          <TableHead>Aderência</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((audit) => (
          <TableRow key={audit.id}>
            <TableCell>
              <button type="button" className="row-link" onClick={() => onOpen(audit.id)}>
                <span className="record-code">{auditCode(audit.id)} · {audit.requirementCode}</span>
                <strong>{audit.requirementTitle}</strong>
              </button>
            </TableCell>
            <TableCell>{audit.auditorName}</TableCell>
            <TableCell>
              <div className="table-progress">
                <Progress value={((15 - audit.stats.pending) / 15) * 100} aria-label="Itens respondidos" />
                <small>{15 - audit.stats.pending}/15 itens</small>
              </div>
            </TableCell>
            <TableCell>
              <strong className="score">{percentage(audit.stats.adherence)}</strong>
              {audit.stats.pending > 0 && <small>Parcial</small>}
            </TableCell>
            <TableCell><StatusBadge value={audit.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
