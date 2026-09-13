import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { User } from '../types/domain';
import { PageHeader, StatusBadge } from '../components/shared';

type Props = {
  users: User[];
  emailMode: 'SMTP' | 'SIMULADO';
  onEdit: (user: User) => void;
};

export function UsersPage({ users, emailMode, onEdit }: Props) {
  return (
    <>
      <PageHeader eyebrow="ADMINISTRAÇÃO" title="Usuários e acessos" description="Atualize os e-mails que recebem notificações e redefina senhas quando necessário." />
      <div className={`mail-status ${emailMode === 'SMTP' ? 'enabled' : ''}`}>
        <Mail size={19} />
        <span>
          <strong>{emailMode === 'SMTP' ? 'Envio de e-mail habilitado' : 'Envio de e-mail em modo simulado'}</strong>
          <small>{emailMode === 'SMTP' ? 'Novas NCs são enviadas ao e-mail cadastrado do responsável.' : 'Configure o SMTP para que as mensagens saiam deste computador.'}</small>
        </span>
      </div>
      <section className="panel users-panel">
        <Table>
          <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Perfil</TableHead><TableHead>E-mail</TableHead><TableHead><span className="sr-only">Editar</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell><strong>{user.name}</strong></TableCell>
                <TableCell><StatusBadge value={user.role} /></TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell><Button variant="outline" onClick={() => onEdit(user)}>Editar</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
