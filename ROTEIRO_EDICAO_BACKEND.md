# Roteiro para edição do backend do ReqAudit

Este roteiro mostra como alterar o backend existente, testar o resultado e executar a versão atualizada. O projeto usa Node.js, Express e SQLite. Não é necessário configurar PostgreSQL nem gerar um cliente Prisma.

As regras atuais aceitam somente **CONFORME** e **NAO_CONFORME**. A aderência considera os 15 itens do checklist. Um item ainda não respondido é uma pendência de preenchimento, não uma terceira resposta.

## 1 Preparar o ambiente

Abra a pasta `req-audit` no editor e use o terminal nessa pasta:

```powershell
cd 'C:\Users\User\Downloads\Projects\Qualidade\req-audit'
node --version
npm test
```

Use Node.js 22.18 ou superior. Se estiver em outro computador e ainda não houver dependências instaladas, execute `npm install` antes dos testes. O arquivo `package-lock.json` registra as versões utilizadas.

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd` no lugar de `npm` nos comandos deste roteiro.

Para desenvolver:

```powershell
npm run dev
```

Abra **http://127.0.0.1:5173**. O frontend usa essa porta e encaminha `/api` para o backend na porta 3001. Não execute `npm start` ao mesmo tempo: os dois comandos tentariam ocupar a porta 3001.

Caso mude `PORT` no `.env`, ajuste também o destino de `/api` em `vite.local.ts` para desenvolver com a nova porta.

**Ao editar o backend, pare com Ctrl+C e execute novamente.** O script atual não utiliza reinício automático do Node. A atualização automática da interface React não reinicia o backend.

## 2 Conhecer os arquivos na ordem de leitura

| Arquivo | Responsabilidade | O que editar aqui |
| --- | --- | --- |
| `backend/server.js` | Inicializa banco, Express, agendamento e envio de e-mails; serve a interface compilada | Porta, horário do cron, frequência de processamento da caixa de saída e inicialização |
| `backend/app.js` | Rotas REST, validação de entradas e permissões dos perfis | Novos endpoints, campos aceitos, regras de acesso e respostas da API |
| `backend/domain.js` | Regras pequenas que independem do banco | Cálculo de aderência, resultados permitidos, datas, severidades e limites de escalonamento |
| `backend/database.js` | Tabelas, dados iniciais, transações e migrações | Novas colunas, integridade dos relacionamentos e atualização de bases existentes |
| `backend/service.js` | Consultas e operações do processo | Dados de auditoria e NC, painel, histórico, destinatários e escalonamento |
| `backend/mail.js` | Processa e-mails pendentes via Nodemailer | Configuração do transporte e tratamento de sucesso ou falha no envio |
| `tests/reqaudit.test.js` | Testes de regras, API, banco e falhas | Casos de aceite e regressão da mudança |
| `.env.example` | Modelo das configurações locais | Documentação de novas variáveis, sem credenciais reais |

O caminho de uma requisição é:

```text
Interface React
  → /api no Express
  → sessão autenticada e validação da permissão
  → regra de domínio ou serviço
  → SQLite
  → resposta JSON para a interface
```

Por exemplo, ao marcar Conforme, a interface chama `PUT /api/audits/:id/checklist/:itemId`. A rota verifica o auditor e o estado da auditoria, valida o resultado, salva a resposta e retorna o resultado recalculado.

## 3 Fazer backup antes de alterar o banco

Encerre as instâncias do ReqAudit antes da cópia, incluindo qualquer execução iniciada pelo atalho. Na pasta `req-audit`, execute:

```powershell
$backupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Path '.\backups' -Force
Copy-Item -LiteralPath '.\data' -Destination ".\backups\data-$backupStamp" -Recurse
```

A pasta `data` contém `reqaudit.sqlite` e pode conter arquivos auxiliares do SQLite. Copie a pasta inteira com o aplicativo parado. Preserve também uma cópia do código anterior ou um commit, caso passe a utilizar Git.

Se já configurou `DATABASE_PATH`, faça backup do banco nesse caminho, que pode ser diferente do padrão `data/reqaudit.sqlite`.

Os testes existentes usam bancos em memória ou temporários; não alteram a base de demonstração. Para testar uma alteração manual sem tocar nos dados atuais, inicie o backend com um banco separado:

```powershell
$env:DATABASE_PATH = Join-Path (Get-Location) 'data\desenvolvimento.sqlite'
npm start
```

Esse banco será criado com os exemplos iniciais. Depois de encerrar o servidor com Ctrl+C, remova a variável apenas da sessão atual para voltar ao banco padrão:

```powershell
Remove-Item Env:DATABASE_PATH
```

## 4 Definir a mudança antes de editar

Escreva um exemplo de entrada e o resultado esperado. Por exemplo:

> Uma auditoria com 13 itens conformes e dois não conformes deve retornar 86,67%. Se houver um item sem resposta, a finalização deve ser recusada.

Escolha o arquivo a partir da mudança desejada:

| Mudança | Arquivos principais | Conferências adicionais |
| --- | --- | --- |
| Alterar cálculo de aderência | `domain.js`, função `adherence` | Testes de percentuais e painel em `service.js` |
| Alterar prazo de escalonamento | `domain.js`, função `escalationLevel` | Testar o dia anterior, o limite e o dia seguinte; conferir destinatários |
| Alterar destinatários dos avisos | `service.js`, função `communicate` | Notificações por usuário, e-mails e ausência de duplicação |
| Alterar o horário da verificação | `server.js`, chamada `cron.schedule` | Manter explícito o fuso `America/Sao_Paulo` |
| Alterar permissões | `app.js`, funções de validação dos perfis | Testar uma requisição permitida e outra recusada |
| Incluir um campo no requisito | `database.js`, `app.js` e frontend | Migração, leitura, gravação, formulário e snapshot das novas auditorias |
| Alterar a identificação do documento externo | `database.js`, `app.js`, `service.js` e frontend | Snapshot imutável, auditorias antigas, NCs e mensagens |
| Incluir uma rota de consulta | `app.js` e, se necessário, `service.js` | Contrato JSON, perfil permitido e teste HTTP |
| Alterar o texto do checklist | `domain.js` e migração em `database.js` | Preservar as auditorias já realizadas |

## 5 Entender as regras que devem permanecer consistentes

- **Respostas:** apenas `CONFORME` e `NAO_CONFORME`. O valor `NULL` no banco significa que o auditor ainda não respondeu.
- **Aderência:** conformes ÷ total de itens × 100. Durante o preenchimento, a aderência é parcial; a finalização exige todos os itens respondidos.
- **Origem da auditoria:** `REQUISITO` usa um cadastro existente; `DOCUMENTO` aceita PDF, impresso, Jira ou outro material sem criar requisito. Cada caminho preserva seu próprio snapshot.
- **Auditoria finalizada:** mantém suas respostas, observações e documento avaliado. Uma nova auditoria permite reavaliar uma versão corrigida.
- **NC:** nasce de um item não conforme e mantém o vínculo com a auditoria e o item. Uma solicitação repetida de criação retorna a NC existente.
- **Resolução:** exige evidência de correção e verificação pelo auditor ou administrador.
- **Atraso:** é independente do status e usa a data civil de São Paulo. NC resolvida não é escalonada.
- **Escalonamento:** ocorre nos limites de um, dois e cinco dias. Repetir a verificação no mesmo nível não repete a comunicação.
- **Transações:** mudanças relacionadas em NC, histórico, notificações e caixa de saída devem ser salvas juntas. Evite adicionar um `await` dentro de `transaction`, que atualmente recebe uma função síncrona.

O login cria um token aleatório, salva somente o hash desse token em `sessions` e entrega o valor ao navegador em cookie `HttpOnly`. As senhas usam `scrypt` com sal individual. O cabeçalho `x-user-id` existe apenas nas instâncias de teste criadas com `allowTestIdentity`; o servidor normal ignora esse cabeçalho.

Nas consultas SQL, mantenha parâmetros `?` para valores recebidos do usuário. Não concatene texto digitado diretamente em uma consulta.

## 6 Exercício opcional de edição de uma rota

Este exemplo serve para praticar e **não foi aplicado ao sistema entregue**. Ele cria uma consulta específica para o resumo do painel, reutilizando a função já existente `s.dashboard()`.

No arquivo `backend/app.js`, dentro de `createApp`, coloque a nova rota depois do middleware que identifica `req.actor` e antes do tratamento final de rotas inexistentes:

```javascript
app.get('/api/dashboard', (req, res) => {
  res.json(s.dashboard());
});
```

Como é uma consulta com os mesmos dados do painel existente, o exemplo mantém acesso aos usuários autenticados. Se adicionar informações restritas, aplique `requireRole` ou uma regra de acesso adequada antes de retornar os dados.

Em `tests/reqaudit.test.js`, acrescente um teste usando a função `fixture` já presente:

```javascript
test('rota do painel retorna o resumo da base de teste', async (t) => {
  const { request } = await fixture(t);
  const response = await request('/dashboard');

  assert.equal(response.status, 200);
  assert.equal(response.body.audits, 3);
  assert.equal(response.body.finished, 2);
  assert.equal(response.body.openNCs, 2);
});
```

O auxiliar `request` já acrescenta `/api`. Portanto, use `/dashboard` no teste, não `/api/dashboard`.

Execute `npm test`, reinicie o backend e consulte a rota no PowerShell:

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{ email = 'maria@example.test'; password = 'Auditor@123' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/auth/login' -Method Post -ContentType 'application/json' -Body $body -WebSession $session
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/dashboard' -WebSession $session
```

Sem realizar esse exercício, a consulta existente para o painel continua sendo `GET /api/bootstrap`, no campo `dashboard`.

## 7 Alterar uma regra de negócio

Para alterar os limites de escalonamento, abra `escalationLevel` em `backend/domain.js`. A regra atual verifica os maiores limites primeiro:

```javascript
export function escalationLevel(days) {
  return days >= 5 ? 3 : days >= 2 ? 2 : days >= 1 ? 1 : 0;
}
```

Se a equipe aprovar novos limites, altere essa função e ajuste os testes para os novos valores. Não altere apenas o texto da tela: `service.escalate()` utiliza essa função para decidir a comunicação.

Verifique também NCs já escalonadas. O serviço eleva o nível quando necessário, mas não o reduz automaticamente ao trocar a política. Se os novos limites exigirem revisar níveis antigos, defina essa atualização em uma migração, preserve o histórico e registre o motivo. A alteração individual de prazo já possui uma regra explícita de recálculo.

## 8 Alterar tabelas e migrar dados existentes

`CREATE TABLE IF NOT EXISTS` cria tabelas ausentes; ele **não adiciona colunas a tabelas que já existem**. Da mesma forma, `seed` só cadastra dados na primeira execução. Editar os exemplos não atualiza uma base que já está em uso.

Para uma mudança de estrutura:

1. Faça backup e teste em uma cópia da base.
2. Atualize a definição para bases novas.
3. Crie uma migração com identificador próprio, executada durante `openDatabase`.
4. Consulte `schema_migrations` para evitar reaplicar a mesma migração.
5. Valide e transforme os registros existentes dentro de uma transação.
6. Preserve IDs e chaves estrangeiras, especialmente o vínculo entre `non_conformities` e `answers`.
7. Confira `PRAGMA foreign_key_check` e teste uma segunda abertura do banco.
8. Só então utilize a migração na base principal.

As funções `migrateBinaryResults` e `migrateExternalDocuments` mostram casos reais. A primeira converte respostas antigas; a segunda recria `audits` para tornar `requirementId` opcional sem perder IDs, respostas ou NCs. Use identificadores novos para futuras mudanças e nunca reaplique uma migração existente com outra finalidade.

O checklist tem duas representações importantes. `checklist_items` é o modelo utilizado por novas auditorias. `answers.description` guarda o texto copiado para cada auditoria. Atualize o modelo mediante migração, preservando os textos históricos. Alterar a quantidade de itens exige revisar também o frontend, que apresenta o total padrão de 15 itens.

## 9 Trabalhar com e-mail

Mantenha o envio desativado durante o desenvolvimento comum. As mensagens ficam na caixa de saída como simuladas e nenhuma mensagem real é enviada.

Quando precisar testar envio, entre como administrador e use **Configurações de e-mail**, ou configure um ambiente SMTP de teste no `.env`. `service.communicate()` cria a notificação interna e a mensagem destinada ao e-mail do responsável; `mail.js` processa as que estão PENDENTE. A rotina roda a cada 15 segundos enquanto o servidor estiver aberto.

Teste os cenários de sucesso e falha separadamente. Uma falha não deve desfazer a NC nem ser registrada como ENVIADO. A versão atual mantém mensagens FALHOU para consulta e não as reenvia automaticamente. Uma funcionalidade de reenvio exigiria uma ação explícita, controle de duplicação e novos testes.

## 10 Conferir a mudança antes de usar

Execute na pasta `req-audit`:

```powershell
npm test
npm run lint
npm run typecheck
```

`typecheck` verifica a parte TypeScript e não substitui os testes das regras e rotas escritas em JavaScript.

Se também alterou o frontend, gere a interface compilada:

```powershell
npm run build
```

Pare o servidor anterior e inicie `npm start`, ou abra `INICIAR_REQAUDIT.cmd`. Confira uma rota existente:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health'
```

O retorno deve identificar `application: ReqAudit` e `status: ok`. Em seguida, execute o fluxo afetado e confira seu resultado, uma entrada inválida, as permissões e a persistência após reinício.

| Sintoma | Verificação inicial |
| --- | --- |
| O código mudou, mas o comportamento continua igual | Reiniciar o processo Node; para frontend na porta 3001, gerar o build novamente |
| Erro EADDRINUSE | Encerrar a outra instância que já ocupa a porta 3001 |
| Nova rota retorna 404 | Conferir `/api`, método HTTP, posição da rota antes do tratamento 404 e reinício do backend |
| Resposta 401 | Conferir login, cookie da sessão e prazo de validade |
| Resposta 403 | Conferir o papel do usuário autenticado e as validações da rota |
| Coluna nova não existe | Conferir se a migração foi aplicada à base utilizada |
| Percentual parece incorreto | Conferir `conforming`, `total` e `pending`; o cálculo inclui os 15 itens |
| E-mail não foi enviado | Conferir modo simulado, status da caixa de saída e configuração SMTP |

Ao terminar, registre no README o comportamento que mudou, a configuração necessária e os testes executados. Mantenha o roteiro de demonstração coerente com a versão que será apresentada.
