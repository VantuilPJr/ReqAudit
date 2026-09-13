import { Bell, Check, ChevronRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Notification, OutboxMessage, User } from '../types/domain';
import { EmptyState, PageHeader, StatusBadge } from '../components/shared';
import { formatDateTime } from '../utils/formatters';

type Props = {
  user: User;
  notifications: Notification[];
  outbox: OutboxMessage[];
  emailMode: 'SMTP' | 'SIMULADO';
  isAdmin: boolean;
  busy: boolean;
  unread: number;
  onNavigate: (path: string) => void;
  onReadAll: () => void;
};

const mailStatus = (status: OutboxMessage['status']) =>
  ({ SIMULADO: 'Simulado', ENVIADO: 'Enviado', FALHOU: 'Falhou', PENDENTE: 'Pendente' })[status];

export function NotificationsPage({ user, notifications, outbox, emailMode, isAdmin, busy, unread, onNavigate, onReadAll }: Props) {
  return (
    <>
      <PageHeader
        eyebrow="COMUNICAÇÃO"
        title="Notificações"
        description={`Avisos para ${user.name}.`}
        action={<Button variant="outline" disabled={busy || !unread} onClick={onReadAll}><Check /> Marcar todas como lidas</Button>}
      />
      <section className="panel notifications-panel">
        {notifications.length ? notifications.map((item) => (
          <button type="button" className={`notification-item ${!item.readAt ? 'unread' : ''}`} key={item.id} onClick={() => onNavigate(`non-conformities/${item.nonConformityId}`)}>
            <span className="notification-icon"><Bell size={19} /></span>
            <span><strong>{item.message}</strong><small>{formatDateTime(item.createdAt)}</small></span>
            {!item.readAt && <i />}
            <ChevronRight size={18} />
          </button>
        )) : <EmptyState text="Você está em dia. Nenhuma notificação para este perfil." />}
      </section>
      {isAdmin && (
        <>
          <PageHeader
            eyebrow="E-MAIL"
            title="Caixa de saída"
            description={emailMode === 'SIMULADO' ? 'Modo de demonstração: mensagens registradas localmente, sem envio real.' : 'Envio SMTP habilitado. Consulte o status de cada mensagem.'}
          />
          <section className="panel outbox-panel">
            {outbox.length ? outbox.map((mail) => (
              <details key={mail.id}>
                <summary>
                  <Mail size={18} />
                  <span><strong>{mail.subject}</strong><small>{mail.recipient} · {formatDateTime(mail.createdAt)}</small></span>
                  <StatusBadge value={mail.status}>{mailStatus(mail.status)}</StatusBadge>
                </summary>
                <pre>{mail.body}</pre>
                {mail.error && <p className="late-text">{mail.error}</p>}
              </details>
            )) : <EmptyState text="As mensagens serão registradas ao criar, atualizar ou escalonar uma NC." />}
          </section>
        </>
      )}
    </>
  );
}
