# ReqAudit

Aplicação local para auditoria de qualidade de requisitos funcionais, implementada a partir de `ReqAudit_Auditoria_Requisitos_Funcionais.docx`. O auditor avalia os requisitos; o sistema registra os resultados, calcula a aderência, acompanha as não conformidades e comunica o tratamento.

## Executar no Windows

Na pasta **Qualidade**, abra **INICIAR_REQAUDIT.cmd** com dois cliques. O navegador abrirá diretamente a tela de login em **http://localhost:3001**. Mantenha a janela do aplicativo aberta; use **Ctrl+C** para encerrar. Os dados permanecem salvos ao fechar.

As dependências e a versão compilada já foram preparadas neste computador. Para instalar em outro computador, utilize Node.js **22.18 ou superior** e execute na pasta `req-audit`:

```powershell
npm install
npm run build
npm start
```

O servidor atende somente em `127.0.0.1`. O acesso exige e-mail e senha; a sessão é mantida em cookie `HttpOnly` e os dados, inclusive usuários e sessões, ficam no SQLite local.

Credenciais iniciais de demonstração:

- Administrador: `admin@reqaudit.com` / `12345678`
- Responsável: `joao@example.test` / `Responsavel@123`

O administrador pode alterar nomes, e-mails e senhas na página **Usuários**.

## Fluxo de uso

1. Acesse o sistema com uma conta autorizada e abra **Nova auditoria**.
2. Para avaliar um PDF, documento impresso, item do Jira ou outra fonte, escolha **Documento externo** e informe o nome, tipo e, quando houver, código, versão, referência e trecho avaliado. Não é necessário cadastrar cada requisito antes. Para usar o fluxo anterior, escolha **Requisito cadastrado**.
3. A auditoria preserva a identificação informada e recebe os 15 itens do checklist, sem respostas herdadas.
4. Marque **Conforme** ou **Não conforme** em cada item. Salve observações quando necessário. Ao reprovar um item, o formulário de NC já vem vinculado ao documento e ao item; é possível registrar depois.
5. Responda todos os itens e finalize. Observações ainda em edição são salvas junto com a finalização em uma única transação. A auditoria finalizada permanece preservada. Uma nova auditoria pode reavaliar uma versão corrigida do documento.
6. Abra uma NC, acompanhe prazo e responsável, inicie o tratamento e registre a evidência da correção. O auditor verifica a evidência e confirma a resolução.
7. Saia da conta do auditor e entre como **Administrador** para executar **Verificar prazos**, gerenciar usuários, configurar SMTP e consultar a **Caixa de saída**.

## Dados da demonstração

- RF-001 Realizar login, RF-002 Cadastrar usuário e RF-003 Recuperar senha.
- Em uma base nova, auditoria AUD-001 finalizada com **13 conformes e 2 não conformes: 86,67%**.
- AUD-002 finalizada e AUD-003 em andamento.
- NC-001 vencida há dois dias na criação da base, pronta para demonstrar escalonamento ao nível 2.
- NC-002 com prazo três dias após a criação da base.
- Maria é auditora; João e Ana são responsáveis; Pedro é líder; Carla é gerente; Administrador controla a verificação manual.

Os dados de exemplo são criados somente na primeira execução. As datas não são redefinidas em cada reinício.

## Regras implementadas

**Aderência:** conformes ÷ total de itens × 100, arredondada para duas casas. Todos os 15 itens entram no denominador. Durante a avaliação, itens ainda sem resposta aparecem como pendentes e o indicador é identificado como parcial. A finalização exige uma das duas respostas em cada item. A média do painel considera apenas auditorias finalizadas com aderência numérica.

**Atualização das bases anteriores:** a antiga opção Não aplicável foi removida por definição do escopo. Respostas antigas nessa categoria são convertidas em pendentes, sem receber automaticamente um julgamento de conformidade. As auditorias afetadas voltam a EM_ANDAMENTO e precisam ser concluídas pelo auditor. Observações, demais respostas e NCs permanecem preservadas; os registros anteriores da auditoria ficam guardados na tabela de migrações. Na base demonstrativa original, AUD-001 passa a ter 12 conformes, 2 não conformes e 1 pendente, com aderência parcial de 80%.

**Rastreabilidade:** a auditoria pode partir de um requisito cadastrado ou diretamente de um documento externo. Para fontes externas, preserva tipo, nome, código ou chave, versão, referência e escopo avaliado; para requisitos cadastrados, preserva o snapshot completo. O documento identificado acompanha auditoria, NC e comunicação. Cada item pode gerar uma NC; chamadas repetidas retornam a existente. Um item que já possui NC mantém sua classificação original, mesmo após a correção. As mudanças de NC geram histórico e comunicação em transação.

**Prazos:** vencem ao fim da data civil de São Paulo. Uma NC que vence hoje está no prazo. Atraso é independente de status. Níveis: 0 dentro do prazo; 1 a partir de um dia; 2 a partir de dois dias; 3 a partir de cinco dias. Nível 1 comunica responsável e auditor; nível 2 inclui líder; nível 3 inclui também gerente. A verificação repetida no mesmo nível não duplica mensagens. NCs em tratamento preservam esse status; NCs abertas passam a escalonadas. Resolvidas saem do cálculo de atraso.

**Alteração de prazo:** exige justificativa, recalcula o nível e conserva o histórico anterior. Um prazo futuro remove o atraso atual e zera o nível. Se a NC estava ESCALONADA, volta a ABERTA; EM_TRATAMENTO é preservado.

**Agendamento:** `node-cron` verifica diariamente às 08h no fuso `America/Sao_Paulo`, enquanto o aplicativo está em execução. Se ele estiver fechado, use a verificação manual na próxima abertura. A inicialização não consome a demonstração da NC vencida.

## E-mail e notificações

O modo padrão **SIMULADO** registra as mensagens na caixa de saída local e **não envia e-mails reais**. As notificações internas são separadas por destinatário. A caixa de saída global está disponível no perfil Administrador.

A interface atualiza os avisos a cada 15 segundos, ao navegar e ao retomar o foco da janela. Observações não salvas são mantidas durante a navegação dentro do aplicativo; ao fechar ou recarregar a página, o navegador avisa sobre essas alterações pendentes.

O administrador pode configurar e testar o SMTP em **Configurações de e-mail**. Também é possível usar as variáveis de `.env.example`; a configuração salva na interface tem prioridade. O Nodemailer processa novas mensagens pendentes a cada 15 segundos. Ao registrar uma NC, a notificação interna e o e-mail são direcionados ao responsável escolhido. Como os usuários de exemplo usam endereços `.test`, altere o e-mail do responsável em **Usuários** antes de habilitar o envio real. Mensagens criadas enquanto o modo estava simulado não são enviadas retroativamente. Falhas permanecem com status FALHOU e o motivo registrado.

## Arquitetura e arquivos

| Parte | Implementação |
| --- | --- |
| Interface | React, TypeScript, Vite, componentes Shadcn/Base UI, Tailwind e CSS |
| API | Node.js e Express, organizada em `backend/routes/` e montada em `backend/app.js` |
| Persistência | SQLite relacional, com chaves estrangeiras, índices e transações, via `node:sqlite` |
| Regras | `backend/domain.js` e `backend/service.js` |
| Banco e exemplos | `backend/database.js` |
| Automação e execução | `backend/server.js` |
| E-mail | Nodemailer, em `backend/mail.js` |
| Interface | Bootstrap em `frontend/main.tsx`, orquestração em `frontend/App.tsx`, páginas em `frontend/pages/` e componentes em `frontend/components/` |
| API da interface | Clientes por domínio em `frontend/api/`, com tratamento comum em `frontend/api/client.ts` |
| Tipos | Entidades compartilhadas em `frontend/types/domain.ts` |
| Testes reproduzíveis | `tests/reqaudit.test.js` |

O banco fica em `data/reqaudit.sqlite`. Para fazer backup, encerre o aplicativo e copie a pasta `data`. Para começar uma base nova, com o aplicativo fechado, renomeie a pasta `data` para preservar o backup; a próxima execução criará outra. Prisma era uma sugestão do documento; foi usado o driver SQLite do próprio Node para simplificar a instalação local.

O scaffold de interface preserva arquivos de suporte do Sites, mas a execução local utiliza `vite.local.ts`, `index.html` e o backend Express. A interface separa páginas, componentes, clientes de API, tipos e formatadores sem introduzir camadas artificiais. Não há publicação nem dependência de serviços externos para usar o aplicativo.

## Desenvolvimento e validação

```powershell
npm run dev        # Interface em http://127.0.0.1:5173 e API em 3001
npm test           # Testes de domínio, API, persistência e falhas
npm run typecheck  # Verificação TypeScript
npm run lint       # Verificação estática do código local
npm run build      # Compila a interface para dist-local
```

Os testes utilizam banco em memória ou arquivos temporários e não modificam os dados da demonstração. Não execute `npm run dev` e `npm start` simultaneamente: ambos utilizam a porta 3001.

## API REST

Todos os caminhos abaixo usam o prefixo `/api`. Exceto login e saúde, as rotas exigem uma sessão autenticada.

| Métodos | Caminho | Uso |
| --- | --- | --- |
| POST | `/auth/login` | Autenticar com e-mail e senha e iniciar sessão |
| GET | `/auth/me` | Consultar o usuário autenticado |
| POST | `/auth/logout` | Encerrar a sessão |
| GET | `/bootstrap` | Dados da interface e notificações do perfil |
| GET, POST | `/requirements` | Listar e cadastrar requisitos |
| GET, PUT | `/requirements/:id` | Consultar e editar requisito |
| GET, POST | `/audits` | Listar e iniciar auditorias de requisito cadastrado ou documento externo |
| GET | `/audits/:id` | Auditoria, snapshot, resultado e NCs |
| GET | `/audits/:id/checklist` | Checklist da auditoria |
| PUT | `/audits/:id/checklist/:itemId` | Resposta e observação |
| POST | `/audits/:id/finish` | Finalizar auditoria completa |
| GET, POST | `/non-conformities` | Listar e registrar NCs |
| GET | `/non-conformities/:id` | Detalhe e histórico |
| PATCH | `/non-conformities/:id/status` | Iniciar tratamento ou resolver |
| PATCH | `/non-conformities/:id/responsible` | Alterar responsável |
| PATCH | `/non-conformities/:id/deadline` | Alterar prazo com justificativa |
| POST | `/non-conformities/:id/correction` | Registrar evidência de correção |
| GET | `/non-conformities/:id/history` | Histórico de acompanhamento |
| POST | `/admin/check-deadlines` | Verificação administrativa idempotente |
| PATCH | `/admin/users/:id` | Administrar nome, e-mail e senha do usuário |
| GET, PUT | `/admin/settings` | Consultar ou salvar a configuração SMTP |
| POST | `/admin/settings/test-email` | Enviar uma mensagem de teste |
| PATCH | `/notifications/read` | Marcar avisos do perfil como lidos |

Consulte `ROTEIRO_DEMONSTRACAO.md` para a apresentação de até três minutos.

Para alterar o código, siga `ROTEIRO_EDICAO_BACKEND.md`, com mapa dos arquivos, exemplo de rota, orientações de migração e testes.

Referências técnicas: [SQLite no Node.js](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Nodemailer SMTP](https://nodemailer.com/smtp), [node-cron](https://nodecron.com/).
