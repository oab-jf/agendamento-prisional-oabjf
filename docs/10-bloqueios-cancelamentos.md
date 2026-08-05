# 10 — Bloqueios com cancelamento e notificação

## Objetivo

Ao criar um bloqueio de agenda, o painel verifica se existem agendamentos ativos no período e permite ao administrador decidir entre:

- criar o bloqueio sem alterar os agendamentos existentes; ou
- cancelar os agendamentos afetados e notificar os advogados por e-mail.

A ação destrutiva nunca acontece automaticamente.

## Fluxo

```text
Preencher bloqueio
→ revisar impacto
→ visualizar agendamentos afetados
→ escolher criar sem cancelar ou cancelar e notificar
→ confirmação
→ criação do bloqueio
→ cancelamentos
→ envio dos e-mails
→ registro de resultados
```

## Motivo público

O campo `Motivo público` é enviado aos advogados quando o cancelamento em massa é confirmado.

As `Observações internas` permanecem restritas ao painel e não são incluídas no e-mail.

## Regras

- Apenas agendamentos com status `agendado` são considerados.
- Cancelados, realizados e registros originais reagendados não são alterados.
- Bloqueio de dia inteiro ou intervalo afeta todos os horários da data.
- Bloqueio de horário específico usa sobreposição de intervalos.
- A opção de cancelamento exige, além de `bloqueios.criar`, a permissão `agendamentos.cancelar`.
- Falha no envio de e-mail não desfaz o cancelamento.
- Cada falha de e-mail fica registrada no agendamento.
- Editar um bloqueio existente não dispara novos cancelamentos automaticamente.

## Endpoint de análise

```text
POST /_functions/oabAdminBloqueioImpacto
```

Recebe o mesmo payload usado para criar o bloqueio e retorna:

```json
{
  "ok": true,
  "totalAfetados": 3,
  "totalComListaJaEnviada": 1,
  "podeCancelar": true,
  "agendamentos": [],
  "truncado": false
}
```

## Criação com cancelamento

```text
POST /_functions/oabAdminBloqueios
```

Campo adicional:

```json
{
  "cancelarAgendamentosExistentes": true
}
```

A resposta inclui o resumo:

```json
{
  "cancelamento": {
    "solicitado": true,
    "totalAfetados": 3,
    "totalCancelados": 3,
    "totalEmailsEnviados": 2,
    "totalEmailsComErro": 1,
    "listaAtualizadaRecomendada": true
  }
}
```

## Auditoria no CMS

### `BloqueiosAgenda`

- `motivoPublico`
- `cancelarAgendamentosExistentes`
- `totalAgendamentosAfetados`
- `totalAgendamentosCancelados`
- `totalEmailsCancelamentoEnviados`
- `totalEmailsCancelamentoComErro`
- `cancelamentoAgendamentosExecutadoEm`

### `AgendamentosPrisionais`

- `origemCancelamento`
- `bloqueioIdCancelamento`
- `emailCancelamentoEnviado`
- `emailCancelamentoDestino`
- `emailCancelamentoErro`
- `emailCancelamentoEnviadoEm`

Os campos existentes `canceladoPor` e `motivoCancelamento` também são preenchidos.

## Lista diária já enviada

Se algum agendamento cancelado já constou em uma lista diária, o backend retorna `listaAtualizadaRecomendada: true`.

O painel orienta o administrador a acessar a aba **Envios** e reenviar uma lista atualizada.
