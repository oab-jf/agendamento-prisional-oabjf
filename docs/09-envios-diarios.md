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
- cada unidade precisa ter `emailListas` ou `emailRecebimentoListas` válido.

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
