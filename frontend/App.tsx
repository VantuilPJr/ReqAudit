import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Files,
  ClipboardCheck,
  CircleAlert,
  Bell,
  ShieldCheck,
  UserRound,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toast';
import { apiRequest, ApiError } from './api/client';
import { login, logout } from './api/auth';
import {
  getEmailSettings,
  sendTestEmail,
  updateEmailSettings,
} from './api/admin';
import type {
  Audit,
  AuditAnswer,
  BootstrapData,
  EmailSettings,
  LoginCredentials,
  NonConformity,
  User,
} from './types/domain';
import { toast } from './components/toast';
import { AppShell } from './components/AppShell';
import { RecordDialog } from './components/RecordDialog';
import type { Row } from './types';
import { EmptyState as Empty } from './components/shared';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequirementsPage } from './pages/RequirementsPage';
import { AuditsPage } from './pages/AuditsPage';
import { NonConformitiesPage } from './pages/NonConformitiesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { futureDate } from './utils/formatters';

const api = <T,>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
) => apiRequest<T>(path, { method, body });
export function App() {
  const [data, setData] = useState<BootstrapData | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loginForm, setLoginForm] = useState<LoginCredentials>({ email: '', password: '' }),
    [hash, setHash] = useState(location.hash || '#/login'),
    [modal, setModal] = useState<Row | null>(null),
    [detail, setDetail] = useState<NonConformity | null>(null),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('TODAS');
  const route = hash.replace('#/', '').split('/'),
    page = route[0],
    selectedId = Number(route[1]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    smtp_enabled: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    smtp_from: 'ReqAudit <reqaudit@example.test>',
    notify_email: '',
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const settingsRequested = useRef(false);

  useEffect(() => {
    const isAdmin = data?.currentUser?.role === 'ADMIN';
    if (page === 'settings' && isAdmin && !settingsLoaded && !settingsRequested.current) {
      settingsRequested.current = true;
      void getEmailSettings()
        .then((s) => {
          setEmailSettings(s);
          setSettingsLoaded(true);
        })
        .catch(() => {
          settingsRequested.current = false;
          toast.error('Não foi possível carregar as configurações de e-mail.');
        });
    }
  }, [page, data, settingsLoaded]);

  const refresh = async () => {
    const result = await api<BootstrapData>('/bootstrap');
    setData(result);
    setError('');
    return result;
  };
  useEffect(() => {
    let active = true;
    const reload = () => {
      api<BootstrapData>('/bootstrap')
        .then((result) => {
          if (active) {
            setData(result);
            setError('');
          }
        })
        .catch((e) => {
          if (!active) return;
          if (e.status === 401) {
            setData(null);
            setError('');
            const currentPage = (location.hash || '#/login').replace('#/', '').split('/')[0];
            if (currentPage !== 'login') {
              window.location.replace('#/login');
            }
          } else setError(e.message);
        });
    };
    reload();
    const timer = window.setInterval(reload, 15000);
    const change = () => {
      setHash(location.hash || '#/login');
      setSearch('');
      setFilter('TODAS');
      setDetail(null);
      reload();
    };
    window.addEventListener('hashchange', change);
    window.addEventListener('focus', reload);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('hashchange', change);
      window.removeEventListener('focus', reload);
    };
  }, []);
  useEffect(() => {
    if (data && page === 'login') window.location.replace('#/dashboard');
  }, [data, page]);
  useEffect(() => {
    let active = true;
    if (page === 'non-conformities' && selectedId)
      api<NonConformity>(`/non-conformities/${selectedId}`)
        .then((result) => {
          if (active && result.id === selectedId) setDetail(result);
        })
        .catch((e) => {
          if (active) toast.error(e.message);
        });
    return () => {
      active = false;
    };
  }, [page, selectedId, data]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(drafts).length) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drafts]);
  const go = (path: string) => {
    window.location.assign(`#/${path}`);
  };
  const mutate = async (
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body: Row,
    message?: string,
  ) => {
    if (busy) return null;
    setBusy(true);
    try {
      const result = await api<Row>(path, method, body);
      await refresh();
      if (message) toast.success(message);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setData(null);
        window.location.assign('#/login');
      }
      toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  if (!data && page === 'login')
    return (
      <LoginPage
        busy={busy}
        error={error}
        credentials={loginForm}
        onChange={setLoginForm}
        onSubmit={async () => {
          setBusy(true);
          setError('');
          try {
            await login(loginForm.email, loginForm.password);
            await refresh();
            window.location.assign('#/dashboard');
          } catch (loginError) {
            setError((loginError as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  if (!data)
    return (
      <div className="startup">
        <ShieldCheck size={42} />
        <h1>ReqAudit</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={() => refresh().catch((e) => setError(e.message))}>
              Tentar novamente
            </Button>
          </>
        ) : (
          <p>Carregando seu espaço de auditoria…</p>
        )}
      </div>
    );
  const user = data.currentUser,
    canAudit = ['AUDITOR', 'ADMIN'].includes(user.role),
    canRequirement = ['AUDITOR', 'ADMIN', 'RESPONSAVEL'].includes(user.role),
    isAdmin = user.role === 'ADMIN',
    dash = data.dashboard;

  const unread = data.notifications.filter((notification) => !notification.readAt).length;
  const inProgressAudit = data.audits.find(
    (item) =>
      item.status === 'EM_ANDAMENTO' &&
      (isAdmin || item.auditorId === user.id),
  );
  const assignedNC = data.nonConformities.find(
    (item) =>
      item.status !== 'RESOLVIDA' && item.responsibleId === user.id,
  );
  const newAudit = (requirementId?: number) =>
    setModal({
      type: 'audit',
      sourceType: requirementId ? 'REQUISITO' : 'DOCUMENTO',
      requirementId: requirementId || data.requirements[0]?.id,
      documentType: 'PDF',
      documentTitle: '',
      documentCode: '',
      documentVersion: '',
      documentReference: '',
      documentScope: '',
      auditorId: user.role === 'AUDITOR' ? user.id : 1,
    });
  const createNC = (a: Audit, item: AuditAnswer) =>
    setModal({
      type: 'nc',
      auditId: a.id,
      checklistItemId: item.checklistItemId,
      requirementCode: a.requirementCode,
      itemDescription: item.description,
      title: `Revisar ${item.description.replace(/\?$/, '').toLowerCase()}`,
      description: `O documento ${a.requirementCode} não atende ao item ${item.checklistItemId}: ${item.description}`,
      severity: 'MEDIA',
      responsibleId: 2,
      dueDate: futureDate(),
    });
  const nav = [
    { id: 'dashboard', text: 'Visão geral', icon: LayoutDashboard },
    { id: 'requirements', text: 'Requisitos', icon: Files },
    { id: 'audits', text: 'Auditorias', icon: ClipboardCheck },
    { id: 'non-conformities', text: 'Não conformidades', icon: CircleAlert },
    { id: 'notifications', text: 'Notificações', icon: Bell },
    ...(isAdmin
      ? [
          { id: 'users', text: 'Usuários e acessos', icon: UserRound },
          { id: 'settings', text: 'Configurações de e-mail', icon: Settings },
        ]
      : []),
  ];
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '252px' } as React.CSSProperties}
    >
      <AppShell
        user={user as unknown as User}
        page={page}
        navigation={nav}
        unreadNotifications={unread}
        openNonConformities={Number(dash.openNCs)}
        onNavigate={go}
        onLogout={async () => {
          if (busy) return;
          setBusy(true);
          try {
            await logout();
          } finally {
            setData(null);
            setModal(null);
            setBusy(false);
            window.location.assign('#/login');
          }
        }}
      >
          {page === 'dashboard' && (
            <DashboardPage
              user={user as unknown as User}
              dashboard={dash as unknown as import('./types/domain').DashboardStats}
              audits={data.audits as unknown as Audit[]}
              nonConformities={data.nonConformities as unknown as NonConformity[]}
              inProgressAudit={inProgressAudit as unknown as Audit | undefined}
              assignedNonConformity={assignedNC as unknown as NonConformity | undefined}
              canAudit={canAudit}
              isAdmin={isAdmin}
              busy={busy}
              onNavigate={go}
              onNewAudit={() => newAudit()}
              onCheckDeadlines={() => {
                void mutate('/admin/check-deadlines', 'POST', {}).then((result) => {
                  if (result) toast.success(`${result.updated} NC(s) escalonada(s).`);
                });
              }}
            />
          )}          {page === 'requirements' && (
            <RequirementsPage
              requirements={data.requirements as unknown as import('./types/domain').Requirement[]}
              audits={data.audits as unknown as Audit[]}
              selectedId={selectedId || undefined}
              search={search}
              canAudit={canAudit}
              canEdit={canRequirement}
              onSearch={setSearch}
              onNavigate={go}
              onNew={() => setModal({ type: 'requirement', code: '', title: '', description: '', priority: 'MEDIA' })}
              onEdit={(requirement) => setModal({ ...requirement, type: 'requirement' })}
              onAudit={newAudit}
            />
          )}          {page === 'audits' && (
            <AuditsPage
              audits={data.audits as unknown as Audit[]}
              selectedId={selectedId || undefined}
              user={user as unknown as User}
              isAdmin={isAdmin}
              canAudit={canAudit}
              busy={busy}
              drafts={drafts}
              onDraftsChange={setDrafts}
              onNavigate={go}
              onNewAudit={() => newAudit()}
              onCreateNonConformity={createNC}
              onMutate={(path, method, body, message) => mutate(path, method, body as Row, message)}
              onRefresh={refresh}
            />
          )}          {page === 'non-conformities' && (
            <NonConformitiesPage
              items={data.nonConformities as unknown as NonConformity[]}
              detail={detail as unknown as NonConformity | null}
              selectedId={selectedId || undefined}
              user={user as unknown as User}
              isAdmin={isAdmin}
              busy={busy}
              search={search}
              filter={filter}
              onSearch={setSearch}
              onFilter={setFilter}
              onNavigate={go}
              onOpenModal={(values) => setModal(values as Row)}
              onMutate={(path, method, body, message) => mutate(path, method, body as Row, message)}
              onCheckDeadlines={() => {
                void mutate('/admin/check-deadlines', 'POST', {}).then((result) => {
                  if (result) toast.success(`Verificação concluída: ${result.updated} NC(s) escalonada(s).`);
                });
              }}
            />
          )}          {page === 'notifications' && (
            <NotificationsPage
              user={user as unknown as User}
              notifications={data.notifications as unknown as import('./types/domain').Notification[]}
              outbox={data.outbox as unknown as import('./types/domain').OutboxMessage[]}
              emailMode={data.emailMode as 'SMTP' | 'SIMULADO'}
              isAdmin={isAdmin}
              busy={busy}
              unread={unread}
              onNavigate={go}
              onReadAll={() => { void mutate('/notifications/read', 'PATCH', {}, 'Notificações marcadas como lidas.'); }}
            />
          )}
          {page === 'users' && isAdmin && (
            <UsersPage
              users={data.users as unknown as User[]}
              emailMode={data.emailMode as 'SMTP' | 'SIMULADO'}
              onEdit={(selectedUser) => setModal({ type: 'user', id: selectedUser.id, name: selectedUser.name, email: selectedUser.email, notificationEmail: selectedUser.notificationEmail || '', password: '' })}
            />
          )}
          {page === 'settings' && isAdmin && (
            <SettingsPage
              settings={emailSettings}
              busy={settingsBusy}
              onChange={setEmailSettings}
              onSave={() => {
                if (settingsBusy) return;
                setSettingsBusy(true);
                void updateEmailSettings(emailSettings)
                  .then(async () => { toast.success('Configurações salvas.'); await refresh(); })
                  .catch((settingsError) => toast.error((settingsError as Error).message))
                  .finally(() => setSettingsBusy(false));
              }}
              onTest={() => {
                if (settingsBusy) return;
                setSettingsBusy(true);
                void sendTestEmail()
                  .then((result) => toast.success(`E-mail de teste enviado para ${result.to}`))
                  .catch((settingsError) => toast.error((settingsError as Error).message))
                  .finally(() => setSettingsBusy(false));
              }}
            />
          )}          {!nav.some((n) => n.id === page) && (
            <Empty text="Página não encontrada. Use a navegação para continuar." />
          )}
      </AppShell>
      <RecordDialog
        modal={modal}
        setModal={setModal}
        busy={busy}
        mutate={mutate}
        data={data}
        user={user}
        detail={detail}
        pendingFile={pendingFile}
        setPendingFile={setPendingFile}
        refresh={refresh}
        navigate={go}
      />
      <Toaster />
    </SidebarProvider>
  );
}


