# Diagnóstico — Shadow read controlado — 13/08/2026

Fonte: execução live do probe administrativo da Fase 1E.

## Contrato normal

- Antes: `total=15`, `itens=15`, shadow exposto: não.
- Depois: `total=15`, `itens=15`, shadow exposto: não.

## Resultado agregado

- Probes: 14
- Completed: 13
- Paridade: 13
- Divergência: 0
- Erros: 0
- Skipped: 1

## Casos com paridade

- conjunto completo: 15 / 15;
- unidade `afeb`: 15 / 15;
- status `agendado`: 10 / 10;
- status `cancelado`: 4 / 4;
- status `reagendado`: 1 / 1;
- 07/08/2026: 1 / 1;
- 10/08/2026: 4 / 4;
- 11/08/2026: 1 / 1;
- 12/08/2026: 3 / 3;
- 13/08/2026: 2 / 2;
- 18/08/2026: 1 / 1;
- 19/08/2026: 2 / 2;
- 25/08/2026: 1 / 1.

## Caso ignorado

Busca textual:

- resultado oficial: 0;
- candidato: 0;
- status: `skipped`;
- motivo: `unsupported_text_search`.

## Privacidade

O relatório operacional utilizado como evidência foi sanitizado e não contém
nomes, e-mails, telefones, IPL, INFOPEN, protocolos ou IDs dos agendamentos.
