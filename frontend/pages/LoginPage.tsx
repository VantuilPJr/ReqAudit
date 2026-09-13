import type { SyntheticEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '../components/shared';
import type { LoginCredentials } from '../types/domain';

type LoginPageProps = {
  busy: boolean;
  error: string;
  credentials: LoginCredentials;
  onChange: (credentials: LoginCredentials) => void;
  onSubmit: () => Promise<void>;
};

export function LoginPage({
  busy,
  error,
  credentials,
  onChange,
  onSubmit,
}: LoginPageProps) {
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy) void onSubmit();
  };

  return (
    <main className="login-page">
      <header className="login-nav">
        <div className="public-brand" aria-label="ReqAudit">
          <span className="brand-mark"><ShieldCheck size={24} /></span>
          <span>Req<strong>Audit</strong></span>
        </div>
      </header>
      <section className="login-panel">
        <div className="login-box">
          <div className="login-heading">
            <p className="eyebrow">ACESSO RESTRITO</p>
            <h1>Entre no ReqAudit</h1>
            <p>Use seu e-mail e senha para acessar o espaço de auditoria.</p>
          </div>
          <form onSubmit={submit}>
            <FormField
              label="E-mail"
              type="email"
              required
              value={credentials.email}
              onChange={(email) => onChange({ ...credentials, email })}
            />
            <FormField
              label="Senha"
              type="password"
              required
              value={credentials.password}
              onChange={(password) => onChange({ ...credentials, password })}
            />
            {error && <p className="login-error" role="alert">{error}</p>}
            <Button type="submit" disabled={busy} className="login-submit">
              {busy ? 'Verificando…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
