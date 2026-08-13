# Diagnóstico — Shadow read automático — 13/08/2026

Fonte: smoke live executado após a ativação automática da Fase 1F.

## Contrato normal

- Inicial: `total=15`, `itens=15`.
- Final: `total=15`, `itens=15`.
- `shadowRead` exposto: não.

## Probes de controle

- Total: 9
- Completed: 9
- Paridade: 9
- Divergência: 0
- Erros: 0

## Casos

- conjunto completo: 15 / 15;
- status `agendado`: 10 / 10;
- status `cancelado`: 4 / 4;
- status `reagendado`: 1 / 1;
- 07/08/2026: 1 / 1;
- 10/08/2026: 4 / 4;
- 11/08/2026: 1 / 1;
- 12/08/2026: 3 / 3;
- 13/08/2026: 2 / 2.

## Leitura do resultado

As requisições normais executadas durante o smoke não expuseram o relatório de
shadow read. A observação automática ocorreu internamente no backend e a
resposta oficial permaneceu legada.

## Privacidade

Este registro contém apenas contagens, status técnicos e datas de teste. Não
inclui nomes, e-mails, telefones, IPL, INFOPEN, protocolos ou IDs de
agendamentos.
