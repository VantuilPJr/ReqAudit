import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  Files,
  ClipboardCheck,
  CircleAlert,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Check,
  Clock3,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Mail,
  RefreshCw,
  Search,
  Play,
  FileCheck2,
  History,
  UserRound,
  ArrowUp,
  Info,
  Paperclip,
  Upload,
  Trash2,
  Download,
  Settings,
  Send,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Toaster, toast as toastManager } from '@/components/ui/toast';
const toast = {
  success: (title: string) => toastManager.add({ title, type: 'success' }),
  error: (title: string) => toastManager.add({ title, type: 'error' }),
};
import './styles.css';

import type { Row } from './types';
const displayText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';
const labels: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_TRATAMENTO: 'Em tratamento',
  RESOLVIDA: 'Resolvida',
  ESCALONADA: 'Escalonada',
  FINALIZADA: 'Finalizada',
  EM_ANDAMENTO: 'Em andamento',
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
  AUDITOR: 'Auditor',
  RESPONSAVEL: 'Responsável',
  GESTOR: 'Gestor',
  ADMIN: 'Administrador',
  CONFORME: 'Conforme',
  NAO_CONFORME: 'Não conforme',
  REQUISITO: 'Requisito cadastrado',
  DOCUMENTO: 'Documento externo',
  PDF: 'PDF',
  IMPRESSO: 'Impresso',
  JIRA: 'Jira',
  OUTRO: 'Outro',
};
const ncCode = (id: number) => `NC-${String(id).padStart(3, '0')}`;
const auditCode = (id: number) => `AUD-${String(id).padStart(3, '0')}`;
const pct = (n: number | null) =>
  n === null
    ? 'Sem resultado'
    : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const date = (s: string) =>
  s
    ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString(
        'pt-BR',
      )
    : '—';
const dateTime = (s: string) =>
  new Date(s).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
async function api(path: string, method = 'GET', body?: Row) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  });
  let json: Row;
  try {
    json = await response.json();
  } catch {
    throw new Error(
      'Não foi possível acessar o servidor. Verifique se o ReqAudit está em execução.',
    );
  }
  if (!response.ok) {
    const error = new Error(json.error || 'Falha na operação.') as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return json;
}
function Badge({
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
function Picker({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={String(value ?? '')}
      onValueChange={(v) => onChange(v ?? '')}
      items={options.map((o) => ({ ...o, value: String(o.value) }))}
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
        {options.map((o) => (
          <SelectItem value={String(o.value)} key={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Field({
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
  onChange: (v: string) => void;
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
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={required}
        />
      ) : (
        <Input
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          required={required}
        />
      )}{' '}
      {hint && <small>{hint}</small>}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <FileCheck2 size={30} />
      <p>{text}</p>
    </div>
  );
}
function Header({
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
function EvaluatedDocument({ record, open = false }: { record: Row; open?: boolean }) {
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
        <Badge value={external ? displayText(snapshot?.type) : 'REQUISITO'} />
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

function Observation({
  item,
  value,
  onDraft,
  disabled,
  onSave,
}: {
  item: Row;
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
      <label
        className="sr-only"
        htmlFor={`observation-${item.checklistItemId}`}
      >
        Observação do item {item.checklistItemId}
      </label>
      <Textarea
        id={`observation-${item.checklistItemId}`}
        value={value}
        disabled={disabled}
        placeholder="Registre a evidência da sua avaliação…"
        onChange={(e) => onDraft(e.target.value)}
      />
      {!disabled && value !== item.observation && (
        <Button variant="outline" onClick={() => onSave(value)}>
          Salvar observação
        </Button>
      )}
    </details>
  );
}

function FileAttachment({
  audit,
  canEdit,
  onRefresh,
}: {
  audit: Row;
  canEdit: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);

  const doUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/audits/${audit.id}/attachment`, {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Falha ao enviar arquivo.');
      }
      await onRefresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const doDelete = async () => {
    if (!confirm('Remover o anexo desta auditoria?')) return;
    setUploading(true);
    try {
      await fetch(`/api/audits/${audit.id}/attachment`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      await onRefresh();
    } catch {
      alert('Falha ao remover o anexo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="attachment-widget">
      <h3>
        <Paperclip size={16} /> Documento anexado à auditoria
      </h3>
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
              onClick={doDelete}
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
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className={`attachment-upload-area ${dragover ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragover(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void doUpload(f);
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

function PublicHome({ authenticated }: { authenticated: boolean }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    document.querySelector<HTMLDetailsElement>('.public-mobile-menu')?.removeAttribute('open');
  };

  return (
    <main className="public-home">
      <header className="public-nav">
        <a href="#/home" className="public-brand" aria-label="ReqAudit — início">
          <span className="brand-mark"><ShieldCheck size={24} /></span>
          <span>Req<strong>Audit</strong></span>
        </a>
        <nav aria-label="Navegação principal">
          <button type="button" onClick={() => scrollTo('recursos')}>Recursos</button>
          <button type="button" onClick={() => scrollTo('fluxo')}>Como funciona</button>
          <button type="button" onClick={() => scrollTo('sobre')}>Sobre</button>
        </nav>
        <details className="public-mobile-menu">
          <summary>Menu</summary>
          <div>
            <button type="button" onClick={() => scrollTo('recursos')}>Recursos</button>
            <button type="button" onClick={() => scrollTo('fluxo')}>Como funciona</button>
            <button type="button" onClick={() => scrollTo('sobre')}>Sobre</button>
          </div>
        </details>
        <a className="public-login-link" href={authenticated ? '#/dashboard' : '#/login'}>
          {authenticated ? 'Abrir painel' : 'Entrar'} <ArrowUpRight size={16} />
        </a>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="eyebrow">AUDITORIA DE REQUISITOS</p>
          <h1>Qualidade de requisitos com decisões claras.</h1>
          <p className="public-lead">
            Avalie documentos pelo checklist, registre não conformidades e acompanhe
            cada correção com responsável, prazo e histórico.
          </p>
          <div className="public-actions">
            <a className="public-primary" href={authenticated ? '#/dashboard' : '#/login'}>
              {authenticated ? 'Ir para o painel' : 'Acessar o sistema'}
              <ArrowUpRight size={18} />
            </a>
            <button type="button" onClick={() => scrollTo('fluxo')}>Conhecer o fluxo</button>
          </div>
          <div className="public-source-row" aria-label="Fontes que podem ser avaliadas">
            <span>PDF</span><span>Documento impresso</span><span>Jira</span><span>Outras fontes</span>
          </div>
        </div>

        <div className="public-preview" aria-label="Exemplo de auditoria">
          <div className="preview-topline">
            <span><FileCheck2 size={18} /> Auditoria em andamento</span>
            <b>AUD-004</b>
          </div>
          <div className="preview-document">
            <small>DOCUMENTO AVALIADO</small>
            <strong>Especificação do módulo de acesso</strong>
            <span>PDF · versão 2.1</span>
          </div>
          <div className="preview-progress">
            <span><b>11</b> de 15 itens avaliados</span>
            <div><i /></div>
          </div>
          <div className="preview-results">
            <span><CheckCircle2 size={18} /><b>9</b><small>Conformes</small></span>
            <span><CircleAlert size={18} /><b>2</b><small>Não conformes</small></span>
          </div>
          <div className="preview-status">
            <span className="live-dot" /> Dados salvos no ambiente local
          </div>
        </div>
      </section>

      <section className="public-section" id="recursos">
        <div className="public-section-heading">
          <p className="eyebrow">RECURSOS</p>
          <h2>Do documento à correção, no mesmo fluxo.</h2>
          <p>O sistema organiza a avaliação sem exigir o cadastro prévio de cada requisito.</p>
        </div>
        <div className="public-feature-grid">
          <article>
            <span><ClipboardCheck size={22} /></span>
            <h3>Checklist objetivo</h3>
            <p>Classifique cada critério como Conforme ou Não conforme e registre observações.</p>
          </article>
          <article>
            <span><Files size={22} /></span>
            <h3>Documento identificado</h3>
            <p>Preserve nome, tipo, versão, referência e escopo do material avaliado.</p>
          </article>
          <article>
            <span><CircleAlert size={22} /></span>
            <h3>Tratamento de NCs</h3>
            <p>Defina responsável e prazo, anexe evidências e mantenha todo o histórico.</p>
          </article>
          <article>
            <span><Bell size={22} /></span>
            <h3>Avisos direcionados</h3>
            <p>Notifique o responsável no sistema e por e-mail quando uma correção for necessária.</p>
          </article>
        </div>
      </section>

      <section className="public-flow" id="fluxo">
        <div className="public-section-heading">
          <p className="eyebrow">COMO FUNCIONA</p>
          <h2>Um processo simples e rastreável.</h2>
        </div>
        <ol>
          <li><b>01</b><div><h3>Identifique o documento</h3><p>Informe a fonte que será analisada, seja PDF, impresso, Jira ou outro material.</p></div></li>
          <li><b>02</b><div><h3>Aplique o checklist</h3><p>Avalie os 15 critérios e registre o contexto de cada decisão.</p></div></li>
          <li><b>03</b><div><h3>Acompanhe a correção</h3><p>Transforme falhas em NCs, atribua responsáveis e valide as evidências.</p></div></li>
        </ol>
      </section>

      <section className="public-about" id="sobre">
        <div>
          <p className="eyebrow">REQAUDIT</p>
          <h2>Controle local, histórico preservado.</h2>
        </div>
        <p>
          O ReqAudit foi criado para apoiar auditorias de requisitos funcionais.
          Usuários, avaliações, anexos e notificações permanecem no banco SQLite deste computador.
        </p>
      </section>

      <footer className="public-footer">
        <a href="#/home" className="public-brand"><ShieldCheck size={20} /><span>Req<strong>Audit</strong></span></a>
        <span>Qualidade de requisitos · Ambiente local</span>
      </footer>
    </main>
  );
}

function App() {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loginForm, setLoginForm] = useState<Row>({ email: '', password: '' }),
    [hash, setHash] = useState(location.hash || '#/home'),
    [modal, setModal] = useState<Row | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('TODAS');
  const route = hash.replace('#/', '').split('/'),
    page = route[0],
    selectedId = Number(route[1]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [emailSettings, setEmailSettings] = useState<Row>({
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
      void fetch('/api/admin/settings')
        .then((res) => res.json())
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
    const result = await api('/bootstrap');
    setData(result);
    setError('');
    return result;
  };
  useEffect(() => {
    let active = true;
    const reload = () => {
      api('/bootstrap')
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
            const currentPage = (location.hash || '#/home').replace('#/', '').split('/')[0];
            if (!['home', 'login'].includes(currentPage)) {
              window.location.replace('#/login');
            }
          } else setError(e.message);
        });
    };
    reload();
    const timer = window.setInterval(reload, 15000);
    const change = () => {
      setHash(location.hash || '#/home');
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
      api(`/non-conformities/${selectedId}`)
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
    method: string,
    body: Row,
    message?: string,
  ) => {
    if (busy) return null;
    setBusy(true);
    try {
      const result = await api(path, method, body);
      await refresh();
      if (message) toast.success(message);
      return result;
    } catch (e) {
      if ((e as Error & { status?: number }).status === 401) {
        setData(null);
        window.location.assign('#/login');
      }
      toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  if (page === 'home') return <PublicHome authenticated={Boolean(data)} />;
  if (!data && page === 'login')
    return (
      <main className="login-page">
        <header className="login-nav">
          <a href="#/home" className="public-brand" aria-label="ReqAudit — início">
            <span className="brand-mark"><ShieldCheck size={24} /></span>
            <span>Req<strong>Audit</strong></span>
          </a>
          <a href="#/home">Voltar para a página inicial</a>
        </header>
        <section className="login-panel">
          <div className="login-box">
            <div className="login-heading">
              <p className="eyebrow">ACESSO RESTRITO</p>
              <h2>Entre no ReqAudit</h2>
              <p>Use seu e-mail e senha para acessar o espaço de auditoria.</p>
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                setBusy(true);
                setError('');
                try {
                  await api('/auth/login', 'POST', loginForm);
                  await refresh();
                  window.location.assign('#/dashboard');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field
                label="E-mail"
                type="email"
                required
                value={displayText(loginForm.email)}
                onChange={(value) => setLoginForm({ ...loginForm, email: value })}
              />
              <Field
                label="Senha"
                type="password"
                required
                value={displayText(loginForm.password)}
                onChange={(value) => setLoginForm({ ...loginForm, password: value })}
              />
              {error && <p className="login-error" role="alert">{error}</p>}
              <Button type="submit" disabled={busy} className="login-submit">
                {busy ? 'Verificando…' : 'Entrar'}
              </Button>
            </form>
            <div className="initial-access">
              <strong>Acessos iniciais</strong>
              <button type="button" onClick={() => setLoginForm({ email: 'maria@example.test', password: 'Auditor@123' })}>
                <span>Auditor</span><small>maria@example.test</small>
              </button>
              <button type="button" onClick={() => setLoginForm({ email: 'admin@example.test', password: 'Admin@123' })}>
                <span>Administrador</span><small>admin@example.test</small>
              </button>
              <p>Ao selecionar um acesso, a senha inicial é preenchida no formulário.</p>
            </div>
          </div>
        </section>
      </main>
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

  const audit = data.audits.find((a: Row) => a.id === selectedId);
  const unread = data.notifications.filter((n: Row) => !n.readAt).length;
  const inProgressAudit = data.audits.find(
    (item: Row) =>
      item.status === 'EM_ANDAMENTO' &&
      (isAdmin || item.auditorId === user.id),
  );
  const assignedNC = data.nonConformities.find(
    (item: Row) =>
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
  const createNC = (a: Row, item: Row) =>
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
  const ncs = data.nonConformities.filter(
    (n: Row) =>
      `${ncCode(n.id)} ${n.title} ${n.requirementCode} ${n.responsibleName}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'TODAS' ||
        (filter === 'ATRASADAS' && n.overdue) ||
        n.status === filter),
  );
  const ncTable = (items: Row[]) =>
    items.length ? (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Não conformidade</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className="sr-only">Abrir</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((n) => (
            <TableRow key={n.id}>
              <TableCell>
                <button
                  className="row-link"
                  onClick={() => go(`non-conformities/${n.id}`)}
                >
                  <span className="record-code">
                    {ncCode(n.id)} <span>· {n.requirementCode}</span>
                  </span>
                  <strong>{n.title}</strong>
                </button>
              </TableCell>
              <TableCell>
                <span className="person">
                  <span className="mini-avatar">
                    {n.responsibleName
                      .split(' ')
                      .map((x: string) => x[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  {n.responsibleName}
                </span>
              </TableCell>
              <TableCell>
                <span className={n.overdue ? 'late-text' : ''}>
                  {date(n.dueDate)}
                </span>
                {n.overdue && (
                  <small className="late-text">
                    {n.daysLate} dia(s) de atraso
                  </small>
                )}
              </TableCell>
              <TableCell>
                <Badge value={n.status} />
                {n.escalationLevel > 0 && (
                  <small>Nível {n.escalationLevel}</small>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Abrir ${ncCode(n.id)}`}
                  onClick={() => go(`non-conformities/${n.id}`)}
                >
                  <ArrowUpRight />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ) : (
      <Empty text="Nenhuma não conformidade encontrada." />
    );
  const auditTable = (items: Row[]) =>
    items.length ? (
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
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <button
                  className="row-link"
                  onClick={() => go(`audits/${a.id}`)}
                >
                  <span className="record-code">
                    {auditCode(a.id)} · {a.requirementCode}
                  </span>
                  <strong>{a.requirementTitle}</strong>
                </button>
              </TableCell>
              <TableCell>{a.auditorName}</TableCell>
              <TableCell>
                <div className="table-progress">
                  <Progress
                    value={((15 - a.stats.pending) / 15) * 100}
                    aria-label="Itens respondidos"
                  />
                  <small>{15 - a.stats.pending}/15 itens</small>
                </div>
              </TableCell>
              <TableCell>
                <strong className="score">{pct(a.stats.adherence)}</strong>
                {a.stats.pending > 0 && <small>Parcial</small>}
              </TableCell>
              <TableCell>
                <Badge value={a.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ) : (
      <Empty text="Nenhuma auditoria criada. Inicie uma auditoria a partir de um requisito." />
    );
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '252px' } as React.CSSProperties}
    >
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <a href="#/dashboard" className="brand">
            <span className="brand-mark">
              <ShieldCheck size={26} />
            </span>
            <span>
              Req<span className="brand-light">Audit</span>
              <small>QUALIDADE DE REQUISITOS</small>
            </span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-caption">ESPAÇO DE TRABALHO</p>
          <SidebarMenu>
            {nav.map((n) => (
              <SidebarMenuItem key={n.id}>
                <SidebarMenuButton
                  isActive={page === n.id}
                  onClick={() => go(n.id)}
                  className="nav-button"
                >
                  <n.icon size={20} />
                  <span>{n.text}</span>
                  {n.id === 'non-conformities' && dash.openNCs > 0 && (
                    <b className="nav-count">{dash.openNCs}</b>
                  )}
                  {n.id === 'notifications' && unread > 0 && (
                    <b className="nav-count">{unread}</b>
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
          <div className="version">
            ReqAudit <span>v1.0</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <SidebarTrigger />
            <span>
              Workspace <ChevronRight size={14} />{' '}
              <b>{nav.find((n) => n.id === page)?.text || 'ReqAudit'}</b>
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="bell-button"
              onClick={() => go('notifications')}
              aria-label={`${unread} notificações não lidas`}
            >
              <Bell size={20} />
              {unread > 0 && <span />}
            </button>
            <div className="profile">
              <span className="avatar">
                {user.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div>
                <strong>{displayText(user.name)}</strong>
                <small>{labels[displayText(user.role)]} · {displayText(user.email)}</small>
              </div>
              <Button
                variant="ghost"
                className="logout-button"
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    await api('/auth/logout', 'POST', {});
                  } finally {
                    setData(null);
                    setModal(null);
                    setBusy(false);
                    window.location.assign('#/login');
                  }
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </header>
        <main className="main-content">
          {page === 'dashboard' && (
            <>
              <Header
                eyebrow={`${labels[user.role]} · VISÃO GERAL`}
                title={`Olá, ${displayText(user.name).split(' ')[0]}`}
                description="Veja o que exige ação e continue seu trabalho de onde parou."
                action={
                  canAudit && (
                    <Button
                      className="primary-action"
                      onClick={() => newAudit()}
                    >
                      <Plus /> Nova auditoria
                    </Button>
                  )
                }
              />
              <div className="metrics">
                {[
                  {
                    name: 'Auditorias realizadas',
                    value: dash.finished,
                    note: `${dash.inProgress} em andamento`,
                    icon: ClipboardCheck,
                    tone: 'blue',
                    path: 'audits',
                  },
                  {
                    name: 'Aderência média',
                    value: pct(dash.averageAdherence),
                    note: 'Das auditorias finalizadas',
                    icon: ShieldCheck,
                    tone: 'green',
                    path: 'audits',
                  },
                  {
                    name: 'NCs em aberto',
                    value: dash.openNCs,
                    note: `${dash.resolvedNCs} resolvidas`,
                    icon: CircleAlert,
                    tone: 'amber',
                    path: 'non-conformities',
                  },
                  {
                    name: 'NCs atrasadas',
                    value: dash.overdueNCs,
                    note: 'Precisam de acompanhamento',
                    icon: Clock3,
                    tone: 'red',
                    path: 'non-conformities',
                  },
                ].map((m) => (
                  <button
                    className="metric"
                    key={m.name}
                    onClick={() => go(m.path)}
                  >
                    <div className="metric-label">
                      {m.name}
                      <span className={`metric-icon ${m.tone}`}>
                        <m.icon size={19} />
                      </span>
                    </div>
                    <strong>{m.value}</strong>
                    <small>{m.note}</small>
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
                    <button className="section-link" onClick={() => go('non-conformities')}>
                      Ver todas <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {data.nonConformities.filter((n: Row) => n.overdue).length ? (
                    data.nonConformities
                      .filter((n: Row) => n.overdue)
                      .map((n: Row) => (
                        <button
                          className="attention-item"
                          key={n.id}
                          onClick={() => go(`non-conformities/${n.id}`)}
                        >
                          <span className="attention-symbol">
                            <Clock3 size={20} />
                          </span>
                          <span>
                            <small>
                              {ncCode(n.id)} · {n.requirementCode}
                            </small>
                            <strong>{n.title}</strong>
                            <span>
                              {n.responsibleName} · Venceu em {date(n.dueDate)}
                            </span>
                          </span>
                          <span className="attention-right">
                            <Badge value="ALTA">
                              {n.daysLate} dias de atraso
                            </Badge>
                            <ArrowUpRight size={18} />
                          </span>
                        </button>
                      ))
                  ) : (
                    <Empty text="Todos os prazos estão em dia." />
                  )}
                  <div className="panel-bottom">
                    <span>
                      <Info size={16} /> Verificação diária às 08h, horário de
                      Brasília.
                    </span>
                    {isAdmin ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          const r = await mutate(
                            '/admin/check-deadlines',
                            'POST',
                            {},
                          );
                          if (r)
                            toast.success(`${r.updated} NC(s) escalonada(s).`);
                        }}
                      >
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
                      <small>
                        {15 - inProgressAudit.stats.pending} de 15 itens respondidos
                      </small>
                      <Progress
                        value={((15 - inProgressAudit.stats.pending) / 15) * 100}
                        aria-label="Progresso da auditoria"
                      />
                      <Button onClick={() => go(`audits/${inProgressAudit.id}`)}>
                        Continuar auditoria <ArrowUpRight />
                      </Button>
                    </>
                  ) : assignedNC ? (
                    <>
                      <span className="next-action-icon warning"><CircleAlert size={24} /></span>
                      <h2>Trate {ncCode(assignedNC.id)}</h2>
                      <p>{assignedNC.title}</p>
                      <small>Prazo: {date(assignedNC.dueDate)}</small>
                      <Button onClick={() => go(`non-conformities/${assignedNC.id}`)}>
                        Abrir não conformidade <ArrowUpRight />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="next-action-icon"><CheckCircle2 size={24} /></span>
                      <h2>Nenhuma tarefa pendente</h2>
                      <p>Os itens sob sua responsabilidade estão em dia.</p>
                      {canAudit && (
                        <Button onClick={() => newAudit()}>
                          Iniciar auditoria <Plus />
                        </Button>
                      )}
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
                  <Button variant="ghost" onClick={() => go('audits')}>
                    Ver todas <ArrowUpRight />
                  </Button>
                </div>
                {auditTable(data.audits.slice(0, 4))}
              </section>
              <p className="demo-footnote">
                <span className="live-dot" /> Dados persistidos no SQLite · Atualização automática a cada 15 segundos.
              </p>
            </>
          )}
          {page === 'requirements' && !selectedId && (
            <>
              <Header
                eyebrow="ARTEFATOS AUDITADOS"
                title="Requisitos funcionais"
                description="Especifique o comportamento esperado e mantenha a origem de cada requisito."
                action={
                  canRequirement && (
                    <Button
                      className="primary-action"
                      onClick={() =>
                        setModal({
                          type: 'requirement',
                          code: '',
                          title: '',
                          description: '',
                          priority: 'MEDIA',
                        })
                      }
                    >
                      <Plus /> Novo requisito
                    </Button>
                  )
                }
              />
              <div className="toolbar">
                <div className="search">
                  <Search size={18} />
                  <Input
                    aria-label="Buscar requisitos"
                    placeholder="Buscar por código ou título…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <span>{data.requirements.length} requisitos</span>
              </div>
              <div className="requirements-grid">
                {data.requirements
                  .filter((r: Row) =>
                    `${r.code} ${r.title}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((r: Row) => (
                    <article className="requirement-card" key={r.id}>
                      <div className="card-top">
                        <span className="document-icon">
                          <Files size={22} />
                        </span>
                        <Badge value={r.priority} />
                      </div>
                      <span className="record-code">{r.code}</span>
                      <h2>{r.title}</h2>
                      <p>{r.description}</p>
                      <div className="requirement-meta">
                        <span>
                          <UserRound size={15} />
                          {r.actor || 'Ator não informado'}
                        </span>
                        <span>
                          {
                            data.audits.filter(
                              (a: Row) => a.requirementId === r.id,
                            ).length
                          }{' '}
                          auditoria(s)
                        </span>
                      </div>
                      <div className="card-actions">
                        <Button
                          variant="outline"
                          onClick={() => go(`requirements/${r.id}`)}
                        >
                          Ver requisito <ArrowUpRight />
                        </Button>
                        {canAudit && (
                          <Button
                            variant="ghost"
                            onClick={() => newAudit(r.id)}
                          >
                            Auditar <ClipboardCheck />
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {page === 'requirements' &&
            selectedId &&
            (() => {
              const r = data.requirements.find((x: Row) => x.id === selectedId);
              return r ? (
                <>
                  <Button
                    variant="ghost"
                    className="back"
                    onClick={() => go('requirements')}
                  >
                    <ArrowLeft /> Requisitos
                  </Button>
                  <Header
                    eyebrow={r.code}
                    title={r.title}
                    action={
                      <div className="actions">
                        {canRequirement && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setModal({ ...r, type: 'requirement' })
                            }
                          >
                            Editar requisito
                          </Button>
                        )}
                        {canAudit && (
                          <Button onClick={() => newAudit(r.id)}>
                            <Plus /> Iniciar auditoria
                          </Button>
                        )}
                      </div>
                    }
                  />
                  <section className="panel requirement-detail">
                    <div className="detail-section">
                      <h2>Descrição</h2>
                      <p>{r.description}</p>
                    </div>
                    <div className="detail-columns">
                      {[
                        ['Ator', 'actor'],
                        ['Prioridade', 'priority'],
                        ['Pré-condições', 'preconditions'],
                        ['Fluxo principal', 'mainFlow'],
                        ['Fluxos alternativos', 'alternativeFlow'],
                        ['Regras de negócio', 'businessRules'],
                        ['Critérios de aceitação', 'acceptanceCriteria'],
                        ['Dependências', 'dependencies'],
                        ['Origem e necessidade de negócio', 'origin'],
                      ].map(([label, key]) => (
                        <div className="detail-section" key={key}>
                          <h3>{label}</h3>
                          <p>
                            {labels[displayText(r[key])] ||
                              displayText(r[key]) ||
                              'Não informado'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <Empty text="Requisito não encontrado." />
              );
            })()}
          {page === 'audits' && !selectedId && (
            <>
              <Header
                eyebrow="AVALIAÇÃO DE QUALIDADE"
                title="Auditorias"
                description="Avalie pelo checklist um requisito cadastrado ou um documento externo, como PDF, impresso ou item do Jira."
                action={
                  canAudit && (
                    <Button
                      className="primary-action"
                      onClick={() => newAudit()}
                    >
                      <Plus /> Nova auditoria
                    </Button>
                  )
                }
              />
              <section className="panel">{auditTable(data.audits)}</section>
            </>
          )}
          {page === 'audits' &&
            selectedId &&
            (audit ? (
              <>
                <Button
                  variant="ghost"
                  className="back"
                  onClick={() => go('audits')}
                >
                  <ArrowLeft /> Auditorias
                </Button>
                <Header
                  eyebrow={`${auditCode(audit.id)} · ${audit.requirementCode}`}
                  title={audit.requirementTitle}
                  description={`Auditor: ${audit.auditorName} · Iniciada em ${date(audit.createdAt)}`}
                  action={<Badge value={audit.status} />}
                />
                <div className="audit-layout">
                  <section className="checklist">
                    <EvaluatedDocument
                      record={audit}
                      open={audit.sourceType === 'DOCUMENTO'}
                    />
                    <FileAttachment
                      audit={audit}
                      canEdit={audit.status === 'EM_ANDAMENTO' && (user.id === audit.auditorId || isAdmin)}
                      onRefresh={refresh}
                    />
                    <div className="checklist-heading">
                      <h2>Checklist de auditoria</h2>
                      <span>{15 - audit.stats.pending} de 15 respondidos</span>
                    </div>
                    {audit.answers.map((item: Row) => {
                      const nc = audit.nonConformities.find(
                          (n: Row) =>
                            n.checklistItemId === item.checklistItemId,
                        ),
                        editable =
                          audit.status === 'EM_ANDAMENTO' &&
                          (user.id === audit.auditorId || isAdmin);
                      return (
                        <article
                          className={`check-item ${item.result?.toLowerCase() || ''}`}
                          key={item.checklistItemId}
                        >
                          <div className="question">
                            <span>
                              {String(item.checklistItemId).padStart(2, '0')}
                            </span>
                            <h3>{item.description}</h3>
                            {item.result === 'CONFORME' && (
                              <CheckCircle2 size={19} />
                            )}
                          </div>
                          <RadioGroup
                            value={item.result || ''}
                            disabled={!editable || busy}
                            onValueChange={async (result) => {
                              const r = await mutate(
                                `/audits/${audit.id}/checklist/${item.checklistItemId}`,
                                'PUT',
                                { result },
                              );
                              if (r && result === 'NAO_CONFORME' && !nc)
                                createNC(r, item);
                            }}
                            aria-label={item.description}
                            className="answer-options"
                          >
                            {['CONFORME', 'NAO_CONFORME'].map((result) => (
                              <label
                                className={
                                  item.result === result ? 'selected' : ''
                                }
                                key={result}
                              >
                                <RadioGroupItem value={result} />
                                {labels[result]}
                              </label>
                            ))}
                          </RadioGroup>
                          <Observation
                            item={item}
                            value={
                              drafts[`${audit.id}:${item.checklistItemId}`] ??
                              item.observation
                            }
                            onDraft={(value) =>
                              setDrafts((previous) => ({
                                ...previous,
                                [`${audit.id}:${item.checklistItemId}`]: value,
                              }))
                            }
                            disabled={!editable || !item.result || busy}
                            onSave={async (value) => {
                              const saved = await mutate(
                                `/audits/${audit.id}/checklist/${item.checklistItemId}`,
                                'PUT',
                                { observation: value },
                                'Observação salva.',
                              );
                              if (saved)
                                setDrafts((previous) => {
                                  const next = { ...previous };
                                  delete next[
                                    `${audit.id}:${item.checklistItemId}`
                                  ];
                                  return next;
                                });
                            }}
                          />
                          {item.result === 'NAO_CONFORME' && (
                            <div className="nc-prompt">
                              <span>
                                <CircleAlert size={16} />
                                {nc
                                  ? `${ncCode(nc.id)} vinculada a este item`
                                  : 'Há uma não conformidade a registrar'}
                              </span>
                              {nc ? (
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    go(`non-conformities/${nc.id}`)
                                  }
                                >
                                  Abrir NC <ArrowUpRight />
                                </Button>
                              ) : (
                                (user.id === audit.auditorId || isAdmin) && (
                                  <Button
                                    variant="outline"
                                    onClick={() => createNC(audit, item)}
                                  >
                                    <Plus /> Registrar NC
                                  </Button>
                                )
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </section>
                  <aside className="audit-summary panel">
                    <span className="section-kicker">
                      RESULTADO DA AUDITORIA
                    </span>
                    <h2>
                      Aderência{audit.stats.pending > 0 ? ' parcial' : ''}
                    </h2>
                    <div className="adherence-number">
                      {pct(audit.stats.adherence)}
                    </div>
                    <Progress
                      value={audit.stats.adherence || 0}
                      aria-label="Percentual de aderência"
                    />
                    <dl>
                      {[
                        ['Conformes', audit.stats.conforming, 'green'],
                        ['Não conformes', audit.stats.nonConforming, 'red'],
                        ['Pendentes', audit.stats.pending, 'amber'],
                        [
                          'NCs em aberto',
                          audit.nonConformities.filter(
                            (n: Row) => n.status !== 'RESOLVIDA',
                          ).length,
                          'blue',
                        ],
                      ].map(([label, value, tone]) => (
                        <div key={label}>
                          <dt>
                            <i className={`dot ${tone}`} />
                            {label}
                          </dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="formula">
                      {audit.stats.conforming} conformes ÷ {audit.stats.total}{' '}
                      itens
                      {audit.stats.total > 0 ? ' × 100' : ''}
                      <br />
                      Todos os itens entram no cálculo.
                    </p>
                    {audit.status === 'EM_ANDAMENTO' &&
                      (user.id === audit.auditorId || isAdmin) && (
                        <>
                          <Button
                            className="finish-button"
                            disabled={busy || audit.stats.pending > 0}
                            onClick={async () => {
                              const saved = await mutate(
                                `/audits/${audit.id}/finish`,
                                'POST',
                                {
                                  observations: Object.fromEntries(
                                    Object.entries(drafts)
                                      .filter(([key]) =>
                                        key.startsWith(`${audit.id}:`),
                                      )
                                      .map(([key, value]) => [
                                        key.split(':')[1],
                                        value,
                                      ]),
                                  ),
                                },
                                'Auditoria finalizada. O resultado foi preservado.',
                              );
                              if (saved)
                                setDrafts((previous) =>
                                  Object.fromEntries(
                                    Object.entries(previous).filter(
                                      ([key]) =>
                                        !key.startsWith(`${audit.id}:`),
                                    ),
                                  ),
                                );
                            }}
                          >
                            <Check /> Finalizar auditoria
                          </Button>
                          {audit.stats.pending > 0 && (
                            <small>
                              Responda todos os itens para finalizar.
                            </small>
                          )}
                        </>
                      )}
                    {audit.status === 'FINALIZADA' && (
                      <p className="completed">
                        <CheckCircle2 size={18} /> Finalizada em{' '}
                        {date(audit.finishedAt)}
                      </p>
                    )}
                  </aside>
                </div>
              </>
            ) : (
              <Empty text="Auditoria não encontrada." />
            ))}
          {page === 'non-conformities' && !selectedId && (
            <>
              <Header
                eyebrow="TRATAMENTO E ACOMPANHAMENTO"
                title="Não conformidades"
                description="Controle responsáveis, prazos e a verificação das correções."
                action={
                  isAdmin && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        const r = await mutate(
                          '/admin/check-deadlines',
                          'POST',
                          {},
                        );
                        if (r)
                          toast.success(
                            `Verificação concluída: ${r.updated} NC(s) escalonada(s).`,
                          );
                      }}
                    >
                      <RefreshCw /> Verificar prazos
                    </Button>
                  )
                }
              />
              <div className="toolbar">
                <div className="search">
                  <Search size={18} />
                  <Input
                    aria-label="Buscar não conformidades"
                    placeholder="Buscar NC, requisito ou responsável…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Picker
                  label="Filtrar por status"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'TODAS', label: 'Todos os status' },
                    { value: 'ATRASADAS', label: 'Somente atrasadas' },
                    ...[
                      'ABERTA',
                      'EM_TRATAMENTO',
                      'ESCALONADA',
                      'RESOLVIDA',
                    ].map((s) => ({ value: s, label: labels[s] })),
                  ]}
                />
              </div>
              <section className="panel">{ncTable(ncs)}</section>
            </>
          )}
          {page === 'non-conformities' &&
            selectedId &&
            (detail ? (
              <>
                <Button
                  variant="ghost"
                  className="back"
                  onClick={() => go('non-conformities')}
                >
                  <ArrowLeft /> Não conformidades
                </Button>
                <Header
                  eyebrow={`${ncCode(detail.id)} · ${detail.requirementCode}`}
                  title={detail.title}
                  action={<Badge value={detail.status} />}
                />
                <div className="nc-detail-grid">
                  <div>
                    <EvaluatedDocument record={detail} open />
                    <section className="panel nc-description">
                      <h2>Não conformidade identificada</h2>
                      <p>{detail.description}</p>
                      <button
                        className="inline-link"
                        onClick={() => go(`audits/${detail.auditId}`)}
                      >
                        Ver item {detail.checklistItemId} da auditoria{' '}
                        <ArrowUpRight size={16} />
                      </button>
                    </section>
                    <section className="panel correction-panel">
                      <h2>Evidência de correção</h2>
                      {detail.correction ? (
                        <p className="evidence">{detail.correction}</p>
                      ) : (
                        <p className="muted">
                          O responsável ainda não registrou a correção.
                        </p>
                      )}
                      {detail.status !== 'RESOLVIDA' &&
                        ([detail.responsibleId, detail.auditorId].includes(
                          user.id,
                        ) ||
                          isAdmin) && (
                          <div className="actions">
                            <Button
                              variant="outline"
                              onClick={() =>
                                setModal({
                                  type: 'correction',
                                  id: detail.id,
                                  correction: detail.correction,
                                })
                              }
                            >
                              Registrar correção
                            </Button>
                            {(user.id === detail.auditorId || isAdmin) && (
                              <Button
                                disabled={busy || !detail.correction}
                                onClick={() =>
                                  setModal({ type: 'resolve', id: detail.id })
                                }
                              >
                                <CheckCircle2 /> Verificar e resolver
                              </Button>
                            )}
                          </div>
                        )}
                    </section>
                    <section className="panel history-panel">
                      <h2>
                        <History size={20} /> Histórico de acompanhamento
                      </h2>
                      <div className="timeline">
                        {detail.history.map((h: Row) => (
                          <div className="timeline-item" key={h.id}>
                            <span
                              className={`timeline-icon ${h.action === 'ESCALONAMENTO' ? 'warning' : ''}`}
                            >
                              {h.action === 'ESCALONAMENTO' ? (
                                <ArrowUp size={14} />
                              ) : (
                                <Check size={14} />
                              )}
                            </span>
                            <div>
                              <strong>
                                {h.action === 'ESCALONAMENTO'
                                  ? 'Escalonamento automático'
                                  : h.action === 'CORRECAO'
                                    ? 'Correção registrada'
                                    : h.action === 'CRIACAO'
                                      ? 'Não conformidade criada'
                                      : h.action === 'STATUS'
                                        ? 'Status atualizado'
                                        : h.action === 'PRAZO'
                                          ? 'Prazo atualizado'
                                          : 'Responsável atualizado'}
                              </strong>
                              <p>{h.description}</p>
                              <small>
                                {h.userName || 'Sistema'} ·{' '}
                                {dateTime(h.createdAt)}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                  <aside className="panel nc-properties">
                    <h2>Detalhes da NC</h2>
                    <dl>
                      <div>
                        <dt>Severidade</dt>
                        <dd>
                          <Badge value={detail.severity} />
                        </dd>
                      </div>
                      <div>
                        <dt>Responsável</dt>
                        <dd>{detail.responsibleName}</dd>
                      </div>
                      <div>
                        <dt>Auditor</dt>
                        <dd>{detail.auditorName}</dd>
                      </div>
                      <div>
                        <dt>Prazo</dt>
                        <dd className={detail.overdue ? 'late-text' : ''}>
                          {date(detail.dueDate)}
                          {detail.overdue && (
                            <small>{detail.daysLate} dia(s) de atraso</small>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Escalonamento</dt>
                        <dd>
                          Nível {detail.escalationLevel}
                          <small>
                            {detail.escalationLevel === 0
                              ? 'Sem escalonamento'
                              : detail.escalationLevel === 1
                                ? 'Responsável e auditor'
                                : detail.escalationLevel === 2
                                  ? 'Responsável, auditor e líder'
                                  : 'Responsável, auditor, líder e gerente'}
                          </small>
                        </dd>
                      </div>
                    </dl>
                    {detail.status !== 'RESOLVIDA' && (
                      <div className="property-actions">
                        {(user.id === detail.responsibleId ||
                          user.id === detail.auditorId ||
                          isAdmin) &&
                          detail.status !== 'EM_TRATAMENTO' && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                mutate(
                                  `/non-conformities/${detail.id}/status`,
                                  'PATCH',
                                  { status: 'EM_TRATAMENTO' },
                                  'Tratamento iniciado.',
                                )
                              }
                            >
                              <Play /> Iniciar tratamento
                            </Button>
                          )}
                        {(user.id === detail.auditorId ||
                          isAdmin ||
                          user.role === 'GESTOR') && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setModal({
                                  type: 'responsible',
                                  id: detail.id,
                                  responsibleId: detail.responsibleId,
                                })
                              }
                            >
                              Alterar responsável
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setModal({
                                  type: 'deadline',
                                  id: detail.id,
                                  dueDate: detail.dueDate,
                                  reason: '',
                                })
                              }
                            >
                              Alterar prazo
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </aside>
                </div>
              </>
            ) : (
              <p>Carregando não conformidade…</p>
            ))}
          {page === 'notifications' && (
            <>
              <Header
                eyebrow="COMUNICAÇÃO"
                title="Notificações"
                description={`Avisos para ${user.name}.`}
                action={
                  <Button
                    variant="outline"
                    disabled={busy || !unread}
                    onClick={() =>
                      mutate(
                        '/notifications/read',
                        'PATCH',
                        {},
                        'Notificações marcadas como lidas.',
                      )
                    }
                  >
                    <Check /> Marcar todas como lidas
                  </Button>
                }
              />
              <section className="panel notifications-panel">
                {data.notifications.length ? (
                  data.notifications.map((n: Row) => (
                    <button
                      className={`notification-item ${!n.readAt ? 'unread' : ''}`}
                      key={n.id}
                      onClick={() =>
                        go(`non-conformities/${n.nonConformityId}`)
                      }
                    >
                      <span className="notification-icon">
                        <Bell size={19} />
                      </span>
                      <span>
                        <strong>{n.message}</strong>
                        <small>{dateTime(n.createdAt)}</small>
                      </span>
                      {!n.readAt && <i />}
                      <ChevronRight size={18} />
                    </button>
                  ))
                ) : (
                  <Empty text="Você está em dia. Nenhuma notificação para este perfil." />
                )}
              </section>
              {isAdmin && (
                <>
                  <Header
                    eyebrow="E-MAIL"
                    title="Caixa de saída"
                    description={
                      data.emailMode === 'SIMULADO'
                        ? 'Modo de demonstração: mensagens registradas localmente, sem envio real.'
                        : 'Envio SMTP habilitado. Consulte o status de cada mensagem.'
                    }
                  />
                  <section className="panel outbox-panel">
                    {data.outbox.length ? (
                      data.outbox.map((mail: Row) => (
                        <details key={mail.id}>
                          <summary>
                            <Mail size={18} />
                            <span>
                              <strong>{mail.subject}</strong>
                              <small>
                                {mail.recipient} · {dateTime(mail.createdAt)}
                              </small>
                            </span>
                            <Badge value={mail.status}>
                              {mail.status === 'SIMULADO'
                                ? 'Simulado'
                                : mail.status === 'ENVIADO'
                                  ? 'Enviado'
                                  : mail.status === 'FALHOU'
                                    ? 'Falhou'
                                    : 'Pendente'}
                            </Badge>
                          </summary>
                          <pre>{mail.body}</pre>
                          {mail.error && (
                            <p className="late-text">{mail.error}</p>
                          )}
                        </details>
                      ))
                    ) : (
                      <Empty text="As mensagens serão registradas ao criar, atualizar ou escalonar uma NC." />
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {page === 'users' && isAdmin && (
            <>
              <Header
                eyebrow="ADMINISTRAÇÃO"
                title="Usuários e acessos"
                description="Atualize os e-mails que recebem notificações e redefina senhas quando necessário."
              />
              <div className={`mail-status ${data.emailMode === 'SMTP' ? 'enabled' : ''}`}>
                <Mail size={19} />
                <span>
                  <strong>
                    {data.emailMode === 'SMTP'
                      ? 'Envio de e-mail habilitado'
                      : 'Envio de e-mail em modo simulado'}
                  </strong>
                  <small>
                    {data.emailMode === 'SMTP'
                      ? 'Novas NCs são enviadas ao e-mail cadastrado do responsável.'
                      : 'Configure o SMTP para que as mensagens saiam deste computador.'}
                  </small>
                </span>
              </div>
              <section className="panel users-panel">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>
                        <span className="sr-only">Editar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((item: Row) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <strong>{item.name}</strong>
                        </TableCell>
                        <TableCell>
                          <Badge value={displayText(item.role)} />
                        </TableCell>
                        <TableCell>{displayText(item.email)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setModal({
                                type: 'user',
                                id: item.id,
                                name: item.name,
                                email: item.email,
                                password: '',
                              })
                            }
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            </>
          )}
          {page === 'settings' && isAdmin && (
            <>
              <Header
                eyebrow="ADMINISTRAÇÃO"
                title="Configurações de e-mail"
                description="Configure o envio de notificações SMTP ou deixe desabilitado para simular envios localmente."
              />
              <section className="panel" style={{ padding: 32, maxWidth: 800 }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (settingsBusy) return;
                    setSettingsBusy(true);
                    try {
                      const res = await fetch('/api/admin/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(emailSettings),
                      });
                      if (res.ok) {
                        toast.success('Configurações salvas.');
                        await refresh();
                      }
                    } finally {
                      setSettingsBusy(false);
                    }
                  }}
                >
                  <div className="field">
                    <span className="field-label">Modo de envio</span>
                    <button
                      type="button"
                      onClick={() => setEmailSettings({ ...emailSettings, smtp_enabled: !emailSettings.smtp_enabled })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 16px',
                        background: emailSettings.smtp_enabled ? '#eef2ff' : '#f1f5f9',
                        border: `1px solid ${emailSettings.smtp_enabled ? '#c7d2fe' : '#e2e8f0'}`,
                        borderRadius: 10,
                        color: emailSettings.smtp_enabled ? '#4338ca' : '#475569',
                        width: '100%',
                        textAlign: 'left'
                      }}
                    >
                      {emailSettings.smtp_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      <span>
                        <strong>{emailSettings.smtp_enabled ? 'Envio real habilitado (SMTP)' : 'Modo Simulado'}</strong>
                        <small style={{ marginTop: 2, color: 'inherit' }}>
                          {emailSettings.smtp_enabled
                            ? 'O sistema enviará e-mails de verdade para os usuários.'
                            : 'O sistema registrará os envios na Caixa de Saída, mas não enviará nada.'}
                        </small>
                      </span>
                    </button>
                  </div>
                  
                  <div style={{ opacity: emailSettings.smtp_enabled ? 1 : 0.6, pointerEvents: emailSettings.smtp_enabled ? 'auto' : 'none' }}>
                    <div className="form-grid">
                      <Field
                        label="Host SMTP"
                        value={displayText(emailSettings.smtp_host)}
                        onChange={(v) => setEmailSettings({ ...emailSettings, smtp_host: v })}
                        hint="Ex.: smtp.gmail.com ou smtp.office365.com"
                      />
                      <Field
                        label="Porta"
                        type="number"
                        value={displayText(emailSettings.smtp_port)}
                        onChange={(v) => setEmailSettings({ ...emailSettings, smtp_port: Number(v) })}
                        hint="Ex.: 587 (TLS) ou 465 (SSL)"
                      />
                      <Field
                        label="Usuário SMTP"
                        value={displayText(emailSettings.smtp_user)}
                        onChange={(v) => setEmailSettings({ ...emailSettings, smtp_user: v })}
                      />
                      <Field
                        label="Senha SMTP (ou App Password)"
                        type="password"
                        value={displayText(emailSettings.smtp_pass)}
                        onChange={(v) => setEmailSettings({ ...emailSettings, smtp_pass: v })}
                        hint="A senha não será exibida após salva."
                      />
                    </div>
                    
                    <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: '16px 0 24px' }} />
                    
                    <div className="form-grid">
                      <Field
                        label="Nome de Remetente"
                        value={displayText(emailSettings.smtp_from)}
                        onChange={(v) => setEmailSettings({ ...emailSettings, smtp_from: v })}
                        hint="Ex.: ReqAudit <naoresponda@empresa.com>"
                      />
                      <Field
                        label="Destinatário do e-mail de teste (opcional)"
                        value={displayText(emailSettings.notify_email)}
                        onChange={(v) => setEmailSettings({ ...emailSettings, notify_email: v })}
                        hint="Usado somente pelo botão Testar envio. As NCs seguem para o e-mail cadastrado do responsável."
                      />
                    </div>
                  </div>

                  <div className="form-footer" style={{ marginTop: 10, paddingTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={settingsBusy || !emailSettings.smtp_enabled}
                      onClick={async () => {
                        setSettingsBusy(true);
                        try {
                          const res = await fetch('/api/admin/settings/test-email', { method: 'POST' });
                          const json = await res.json();
                          if (res.ok) toast.success(`E-mail de teste enviado para ${json.to}`);
                          else toast.error(`Erro: ${json.error}`);
                        } catch {
                          toast.error('Falha de conexão.');
                        } finally {
                          setSettingsBusy(false);
                        }
                      }}
                    >
                      <Send size={16} style={{ marginRight: 6 }} /> Testar Envio
                    </Button>
                    <Button type="submit" disabled={settingsBusy} className="primary-action">
                      {settingsBusy ? 'Salvando…' : 'Salvar Configurações'}
                    </Button>
                  </div>
                </form>
              </section>
            </>
          )}
          {!nav.some((n) => n.id === page) && (
            <Empty text="Página não encontrada. Use a navegação para continuar." />
          )}
        </main>
      </SidebarInset>
      <Dialog
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
                      const fd = new FormData();
                      fd.append('file', pendingFile);
                      await fetch(`/api/audits/${(r as Row).id}/attachment`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        body: fd,
                      });
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
                          options={data.requirements.map((r: Row) => ({
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
                      <label htmlFor="picker-Auditor">Auditor</label>
                      <Picker
                        label="Auditor"
                        value={modal.auditorId}
                        disabled={user.role === 'AUDITOR'}
                        onChange={(v) => setModal({ ...modal, auditorId: v })}
                        options={data.users
                          .filter((u: Row) => u.role === 'AUDITOR')
                          .map((u: Row) => ({ value: u.id, label: u.name }))}
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
                        .filter((u: Row) => u.role === 'RESPONSAVEL')
                        .map((u: Row) => ({ value: u.id, label: u.name }))}
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
      <Toaster />
    </SidebarProvider>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
