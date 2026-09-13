import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bell, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import type { User } from '../types/domain';
import { labels } from '../utils/formatters';

export type NavigationItem = {
  id: string;
  text: string;
  icon: LucideIcon;
};

type AppShellProps = {
  user: User;
  page: string;
  navigation: NavigationItem[];
  unreadNotifications: number;
  openNonConformities: number;
  onNavigate: (path: string) => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({
  user,
  page,
  navigation,
  unreadNotifications,
  openNonConformities,
  onNavigate,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <>
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <a href="#/dashboard" className="brand">
            <span className="brand-mark"><ShieldCheck size={26} /></span>
            <span>
              Req<span className="brand-light">Audit</span>
              <small>QUALIDADE DE REQUISITOS</small>
            </span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-caption">ESPAÇO DE TRABALHO</p>
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={page === item.id}
                  onClick={() => onNavigate(item.id)}
                  className="nav-button"
                >
                  <item.icon size={20} />
                  <span>{item.text}</span>
                  {item.id === 'non-conformities' && openNonConformities > 0 && (
                    <b className="nav-count">{openNonConformities}</b>
                  )}
                  {item.id === 'notifications' && unreadNotifications > 0 && (
                    <b className="nav-count">{unreadNotifications}</b>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-note">
            <span className="live-dot" /> Ambiente local
            <small>Dados salvos neste computador</small>
          </div>
          <div className="version">ReqAudit <span>v1.0</span></div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <SidebarTrigger />
            <span>
              Workspace <ChevronRight size={14} />{' '}
              <b>{navigation.find((item) => item.id === page)?.text || 'ReqAudit'}</b>
            </span>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="bell-button"
              onClick={() => onNavigate('notifications')}
              aria-label={`${unreadNotifications} notificações não lidas`}
            >
              <Bell size={20} />
              {unreadNotifications > 0 && <span />}
            </button>
            <div className="profile">
              <span className="avatar">
                {user.name.split(' ').map((name) => name[0]).slice(0, 2).join('')}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>{labels[user.role]} · {user.email}</small>
              </div>
              <Button variant="ghost" className="logout-button" onClick={() => void onLogout()}>
                Sair
              </Button>
            </div>
          </div>
        </header>
        <main id="main-content" className="main-content">{children}</main>
      </SidebarInset>
    </>
  );
}
