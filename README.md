# ReqAudit

O ReqAudit é uma aplicação web para avaliar a qualidade de requisitos funcionais, registrar não conformidades e acompanhar a correção dos problemas encontrados.

[Repositório no GitHub](https://github.com/VantuilPJr/ReqAudit)

## Sobre o projeto

O sistema atende auditor, responsável pela correção, gestor e administrador. Uma auditoria pode partir de um requisito cadastrado ou de um documento externo, como PDF, material impresso ou item do Jira. O auditor responde aos 15 itens do checklist com **Conforme** ou **Não conforme**, e cada reprovação pode originar uma não conformidade com responsável, prazo, histórico e evidência de correção.

A aplicação funciona localmente, persiste dados em SQLite e mantém os anexos no computador. O envio de e-mail é opcional: no modo simulado, as mensagens ficam visíveis na caixa de saída; com SMTP habilitado, o Nodemailer dispara a comunicação ao responsável.

## Funcionalidades

- Autenticação por e-mail e senha, com sessão em cookie `HttpOnly`.
- Perfis Administrador, Auditor, Responsável e Gestor.
- Cadastro e edição de requisitos funcionais.
- Auditoria de requisito cadastrado ou documento externo sem cadastro prévio.
- Checklist binário com 15 itens e cálculo de aderência.
- Anexo do documento avaliado à auditoria.
- Registro, atribuição e acompanhamento de não conformidades.
- Histórico de tratamento, correção e validação pelo auditor.
- Notificações internas, caixa de saída e envio SMTP opcional.
- Escalonamento diário de prazos e verificação manual pelo administrador.
- Persistência das auditorias e de seus snapshots no SQLite.

## Tecnologias

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Base UI e Lucide.

**Backend:** Node.js, Express, SQLite nativo, Nodemailer, Multer e node-cron.

**Qualidade:** Node Test Runner, TypeScript, Oxlint e Oxfmt.

## Arquitetura

```text
frontend/
  api/                 cliente HTTP e chamadas por domínio
  components/          layout, tabelas, diálogo e componentes compartilhados
  features/audits/     controles específicos das auditorias
  pages/               telas por fluxo do produto
  types/               entidades do domínio
  utils/               formatação e rótulos
backend/
  middleware/          autenticação de sessão
  routes/              rotas agrupadas por domínio
  app.js               composição do Express
  database.js          schema, migrações e dados de demonstração
  domain.js            regras puras de aderência, datas e escalonamento
  service.js           consultas e operações do processo
  mail.js              configuração e processamento do SMTP
```

O `frontend/main.tsx` inicializa o React. O estado de alto nível e a navegação ficam em `frontend/App.tsx`; cada página concentra a apresentação de um fluxo. No backend, `app.js` monta os middlewares e registra os grupos de rotas, enquanto as regras e a persistência permanecem em módulos próprios.

## Executar localmente

Requisitos: Node.js **22.18 ou superior**.

```bash
git clone https://github.com/VantuilPJr/ReqAudit.git
cd ReqAudit
npm install
npm run build
npm start
```

Abra [http://localhost:3001](http://localhost:3001). No Windows, o arquivo `INICIAR_REQAUDIT.cmd`, localizado um nível acima da pasta do repositório nesta instalação, executa o mesmo fluxo.

Para desenvolver com atualização automática do frontend:

```bash
npm run dev
```

A interface de desenvolvimento abre em `http://127.0.0.1:5173` e encaminha `/api` ao backend na porta 3001.

### Contas de demonstração

| Perfil        | E-mail               | Senha             |
| ------------- | -------------------- | ----------------- |
| Administrador | `admin@reqaudit.com` | `12345678`        |
| Auditor       | `maria@example.test` | `Auditor@123`     |
| Responsável   | `joao@example.test`  | `Responsavel@123` |

Essas credenciais servem somente para a demonstração local. O administrador pode alterar os dados na tela **Usuários e acessos**.

## Variáveis de ambiente

Copie `.env.example` para `.env` quando quiser mudar a configuração local. A configuração SMTP salva pelo administrador na interface tem prioridade sobre o arquivo.

| Variável           | Uso                                                      |
| ------------------ | -------------------------------------------------------- |
| `PORT`             | Porta do servidor; padrão `3001`                         |
| `DATABASE_PATH`    | Caminho do arquivo SQLite; padrão `data/reqaudit.sqlite` |
| `ATTACHMENTS_PATH` | Diretório dos anexos; padrão `data/attachments`          |
| `SMTP_ENABLED`     | Ativa o envio real quando `true`                         |
| `SMTP_HOST`        | Host do servidor SMTP                                    |
| `SMTP_PORT`        | Porta SMTP; padrão `587`                                 |
| `SMTP_SECURE`      | Usa conexão segura direta quando `true`                  |
| `SMTP_USER`        | Usuário SMTP                                             |
| `SMTP_PASS`        | Senha ou App Password SMTP                               |
| `SMTP_FROM`        | Remetente exibido nos e-mails                            |

Nunca versione o arquivo `.env` ou credenciais reais.

## E-mail e notificações

Ao criar ou atualizar uma não conformidade, o backend grava a notificação interna e a mensagem da caixa de saída na mesma transação. Se o SMTP estiver habilitado, tenta enviar a mensagem imediatamente; o processamento periódico a cada 15 segundos trata mensagens ainda pendentes. Falhas ficam registradas para consulta do administrador.

Para usar Gmail, por exemplo, configure `smtp.gmail.com`, porta `587`, seu usuário e uma App Password. Antes de ativar o envio, substitua os endereços `.test` dos usuários por endereços reais e use **Testar envio** na tela de configurações.

## Testes e validação

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Os 20 testes cobrem aderência, migrações, login, permissões, auditoria de documentos externos, checklist, criação e tratamento de NCs, escalonamento, notificações, e-mail, transações e persistência. Eles usam bancos temporários e não alteram os dados locais.

## Screenshots

![Página exclusiva de login do ReqAudit](docs/screenshots/login.png)

Para completar a apresentação visual do projeto, as próximas capturas recomendadas são:

1. Dashboard do auditor.
2. Checklist de uma auditoria em andamento.
3. Detalhe e histórico de uma não conformidade.
4. Configuração de e-mail do administrador.

As capturas adicionais devem usar dados de demonstração e ficar em `docs/screenshots/`.

## Publicação

A versão atual foi projetada para execução local. Para publicá-la sem trocar SQLite, anexos locais e o processo contínuo de agendamento, use um serviço com processo Node e volume persistente, como Render, Railway ou Fly.io.

A Vercel executa o Express como uma Function, por isso exige antes estas adaptações:

- migrar SQLite para PostgreSQL, por exemplo Neon ou Supabase;
- armazenar anexos no Vercel Blob ou S3;
- substituir o processo `node-cron` por uma rota protegida acionada pelo Vercel Cron;
- configurar cookie seguro, origem permitida e segredos no ambiente de produção.

Essas mudanças afetam persistência e operação e não foram aplicadas automaticamente nesta versão.

## Documentação complementar

- [Roteiro de demonstração](docs/ROTEIRO_DEMONSTRACAO.md)
- [Roteiro para editar o backend](docs/ROTEIRO_EDICAO_BACKEND.md)

## Melhorias futuras

- Migrar banco e anexos para serviços adequados a uma demonstração pública.
- Ampliar os testes de interface e a cobertura de acessibilidade.
- Revisar responsividade em telas pequenas com testes em dispositivos reais.
- Adicionar uma estratégia de recuperação de senha antes de uso fora do ambiente acadêmico.
