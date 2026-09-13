import { Send, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EmailSettings } from '../types/domain';
import { FormField, PageHeader } from '../components/shared';

type Props = {
  settings: EmailSettings;
  busy: boolean;
  onChange: (settings: EmailSettings) => void;
  onSave: () => void;
  onTest: () => void;
};

export function SettingsPage({ settings, busy, onChange, onSave, onTest }: Props) {
  const update = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => onChange({ ...settings, [key]: value });
  return (
    <>
      <PageHeader eyebrow="ADMINISTRAÇÃO" title="Configurações de e-mail" description="Configure o envio de notificações SMTP ou deixe desabilitado para simular envios localmente." />
      <section className="panel settings-panel">
        <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
          <div className="field">
            <span className="field-label">Modo de envio</span>
            <button type="button" className={`email-mode-toggle ${settings.smtp_enabled ? 'enabled' : ''}`} onClick={() => update('smtp_enabled', !settings.smtp_enabled)}>
              {settings.smtp_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              <span>
                <strong>{settings.smtp_enabled ? 'Envio real habilitado (SMTP)' : 'Modo simulado'}</strong>
                <small>{settings.smtp_enabled ? 'O sistema enviará e-mails para os usuários cadastrados.' : 'Os envios ficam registrados na caixa de saída local.'}</small>
              </span>
            </button>
          </div>
          <fieldset className="settings-fields" disabled={!settings.smtp_enabled}>
            <div className="form-grid">
              <FormField label="Host SMTP" value={settings.smtp_host} onChange={(value) => update('smtp_host', value)} hint="Ex.: smtp.gmail.com ou smtp.office365.com" />
              <FormField label="Porta" type="number" value={settings.smtp_port} onChange={(value) => update('smtp_port', Number(value))} hint="Ex.: 587 (TLS) ou 465 (SSL)" />
              <FormField label="Usuário SMTP" value={settings.smtp_user} onChange={(value) => update('smtp_user', value)} />
              <FormField label="Senha SMTP (ou App Password)" type="password" value={settings.smtp_pass} onChange={(value) => update('smtp_pass', value)} hint="A senha não será exibida após salva." />
            </div>
            <hr />
            <div className="form-grid">
              <FormField label="Nome de remetente" value={settings.smtp_from} onChange={(value) => update('smtp_from', value)} hint="Ex.: ReqAudit <naoresponda@empresa.com>" />
              <FormField label="Destinatário do e-mail de teste (opcional)" value={settings.notify_email} onChange={(value) => update('notify_email', value)} hint="Usado somente pelo teste. As NCs seguem para o responsável." />
            </div>
          </fieldset>
          <div className="form-footer settings-actions">
            <Button type="button" variant="outline" disabled={busy || !settings.smtp_enabled} onClick={onTest}><Send size={16} /> Testar envio</Button>
            <Button type="submit" disabled={busy} className="primary-action">{busy ? 'Salvando…' : 'Salvar configurações'}</Button>
          </div>
        </form>
      </section>
    </>
  );
}
