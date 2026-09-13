import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  Files,
  ShieldCheck,
} from 'lucide-react';

export function HomePage({ authenticated }: { authenticated: boolean }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    document.querySelector<HTMLDetailsElement>('.public-mobile-menu')?.removeAttribute('open');
  };

  const destination = authenticated ? '#/dashboard' : '#/login';

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
        <a className="public-login-link" href={destination}>
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
            <a className="public-primary" href={destination}>
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
