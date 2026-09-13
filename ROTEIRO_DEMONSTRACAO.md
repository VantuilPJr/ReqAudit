# Demonstração do ReqAudit em até três minutos

Antes de gravar, abra INICIAR_REQAUDIT.cmd e entre como Maria Oliveira (`maria@example.test` / `Auditor@123`). Uma base nova contém AUD-001 com 86,67%, AUD-003 em andamento e NC-001 vencida. Em uma base atualizada, a AUD-001 pode ter um item pendente: avalie-o como Conforme ou Não conforme e finalize antes da gravação. Prepare as páginas em sequência e ensaie uma vez. A gravação do vídeo fica a cargo da equipe.

| Tempo | Mostrar | Fala sugerida |
| --- | --- | --- |
| 0:00–0:25 | Auditorias → Nova auditoria → Documento externo; preencher nome, tipo, código, versão e referência | “O ReqAudit pode avaliar diretamente um PDF, documento impresso ou item do Jira. Não é necessário cadastrar os requisitos antes; identificamos o material e o trecho analisado para manter a rastreabilidade.” |
| 0:25–1:05 | Iniciar a auditoria, mostrar a identificação preservada, responder um item Conforme e outro Não conforme, preencher e salvar a NC | “Cada auditoria copia o checklist padrão de 15 itens. O auditor decide o resultado. Ao identificar uma falha, registra uma NC vinculada ao documento e ao item, com responsável e prazo.” |
| 1:05–1:25 | Auditorias → uma auditoria finalizada | “Todos os 15 itens são avaliados como conformes ou não conformes. A aderência é a quantidade de conformes dividida por 15. Por exemplo, 13 conformes e dois não conformes resultam em 86,67%.” Ajuste a fala ao resultado real exibido. |
| 1:25–1:55 | NC-001, iniciar tratamento, observar responsável, prazo e histórico | “Cada NC mantém status, prazo, responsável e histórico. O responsável registra a correção e o auditor verifica antes de resolver.” |
| 1:55–2:25 | Sair, entrar como Administrador (`admin@example.test` / `Admin@123`) → Não conformidades → Verificar prazos → NC-001 | “A rotina diária verifica os prazos às oito horas. Este botão executa a mesma verificação. Após dois dias de atraso, a NC chega ao nível dois, comunicando responsável, auditor e líder.” |
| 2:25–3:00 | Notificações → Caixa de saída; mostrar Configurações de e-mail | “A comunicação gera notificações por destinatário e mensagens de e-mail. O administrador pode testar e ativar o SMTP no próprio sistema. A mensagem de uma NC é enviada ao e-mail do responsável escolhido.” |

Para repetir a demonstração de escalonamento na mesma base, altere o prazo de uma NC ainda aberta ou em tratamento para uma data futura, com justificativa, e depois para uma data passada. Isso gera novo histórico e comunicação. Para mostrar especificamente o botão mudando o nível a partir de zero, crie uma nova NC com prazo de ontem e só então execute a verificação. Não é necessário apagar dados.

Para demonstrar resolução separadamente, saia e entre como João (`joao@example.test` / `Responsavel@123`) para registrar a evidência de correção. Depois, entre novamente como Maria e confirme **Verificar e resolver**. A NC resolvida deixa de aparecer como atrasada, mas o histórico permanece disponível.
