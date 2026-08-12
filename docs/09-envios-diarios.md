# Envios diários das listas

## Objetivo

Enviar automaticamente para cada unidade prisional a lista de atendimentos do próximo dia útil.

## Regras operacionais

- envio principal às **17h**, horário de Brasília;
- reprocessamento de falhas às **18h**, horário de Brasília;
- a data-alvo é o próximo dia útil;
- listas vazias também são enviadas;
- somente agendamentos com status `agendado` entram;
- cancelados e registros originais reagendados não entram;
- unidades inativas ou com `receberListaDiaria === false` não recebem;
- cada unidade precisa ter `emailListas` ou `emailRecebimentoListas` válido;
- cada atendimento da lista deve trazer o e-mail do advogado para o envio do
  link de acesso pela unidade prisional.

## Agendamento no Wix

O arquivo `backend/jobs.config` utiliza horários UTC:

- `20:00 UTC`: envio principal, equivalente a 17h em Brasília;
- `21:00 UTC`: reprocessamento das falhas, equivalente a 18h em Brasília.

Alterações no `jobs.config` só entram em vigor após a publicação do site Wix.

## Coleções

### `EnviosListas`

Registra histórico, tentativas, status, destinatário, data-alvo, erros, provedor e auditoria dos envios.

### `ConfiguracoesCentral`

O registro com chave `envios-listas` controla a ativação operacional da automação e guarda o resumo da última execução.

## Endpoints administrativos

- `GET /_functions/oabAdminConfiguracaoEnvios`
- `POST /_functions/oabAdminConfiguracaoEnvios`
- `GET /_functions/oabAdminEnviosListas`
- `POST /_functions/oabAdminTestarEnvioLista`
- `POST /_functions/oabAdminExecutarEnvioListas`
- `POST /_functions/oabAdminReenviarLista`

## Permissões

- `config.ver`: consultar configuração e histórico;
- `config.testar_envios`: enviar teste;
- `config.ativar_envios`: ativar, pausar, executar agora e reenviar.

Usuários legados continuam com acesso completo conforme a regra geral do painel.

## Teste obrigatório

A automação começa pausada. O backend impede a ativação enquanto não existir ao menos um envio de teste concluído com sucesso.

Código retornado nessa situação:

`TESTE_OBRIGATORIO`

## Idempotência

O envio automático usa uma chave baseada em unidade, data-alvo e conteúdo. Uma execução repetida com conteúdo idêntico não envia uma segunda mensagem.

Quando o conteúdo muda, um novo envio pode ocorrer com o assunto identificado como **Lista atualizada**.

## E-mail do advogado e finalidade operacional

A lista diária inclui, para cada atendimento:

- nome do advogado;
- OAB;
- **e-mail para envio do link**;
- IPL;
- INFOPEN;
- protocolo.

O endereço deve aparecer tanto no HTML quanto na versão de texto e, no HTML,
permanece visível e clicável por `mailto:`.

A unidade deve usar esse e-mail para o envio do link de acesso e para
comunicações diretamente relacionadas ao atendimento. O cadastro público deve
informar essa finalidade no momento em que o advogado preenche o campo e repeti-la
na revisão antes da confirmação.

Registros sem e-mail válido são explicitamente sinalizados como
`E-mail não informado`; a lista inteira não deve ser bloqueada por um único
registro inconsistente.

### Reenvio retroativo da correção de 12/08/2026

Para a regularização das listas já enviadas sem os e-mails, foi criado o motivo
controlado:

`incluir_emails_advogados`

Nessa situação específica, o assunto passa a ser:

`Lista atualizada com e-mails para envio dos links — [Unidade] — [Data]`

e o corpo explica que a mensagem substitui a lista anterior porque o reenvio
inclui os e-mails necessários ao envio dos links.

## Lista vazia

A ausência de agendamentos não é tratada como erro. A unidade recebe uma mensagem informando que não há atendimentos agendados para a data.

## Falhas e reenvio

Uma falha em uma unidade não interrompe o processamento das demais.

Status principais:

- `enviado`;
- `erro`;
- `sem_destinatario`;
- `processando`.

O reenvio manual é uma ação oficial e gera uma nova mensagem identificada como lista atualizada.

## Pausa e rollback

Para interromper os envios rapidamente, defina `enviosAtivos` como `false` no painel. Os jobs continuam sendo chamados, mas encerram sem disparar mensagens.

Para remover o agendamento, retire as entradas do `jobs.config` e publique novamente o site Wix.

Não apague a coleção `EnviosListas`, pois ela mantém o histórico operacional.

## Secrets

O módulo reutiliza os secrets da integração Infobip. A documentação deve registrar apenas os nomes, nunca os valores:

- `INFOBIP_BASE_URL`
- `INFOBIP_API_KEY`
- `INFOBIP_FROM_EMAIL`
- `INFOBIP_FROM_NAME`

## Pendência de design antes do encerramento do projeto

Antes da conclusão do ecossistema OAB/JF, os templates transacionais do Site,
Central e Portal devem passar por uma revisão transversal de identidade:
estrutura base única, tipografia, cores, cabeçalho, rodapé, componentes de
alerta, responsividade, linguagem e assinatura institucional consistentes.
