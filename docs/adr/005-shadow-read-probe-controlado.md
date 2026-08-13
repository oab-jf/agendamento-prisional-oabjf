# ADR 005 — Probe administrativo controlado para shadow read

- **Status:** Aceito
- **Data:** 13/08/2026
- **Dependências:** ADR 003 e ADR 004

## Contexto

A Fase 1D colocou o repositório candidato e o bridge no backend live com a
feature flag global desligada. Antes de ativar observação automática em
requisições normais, era necessário comparar legado e candidato contra dados
reais de produção sem mudar o contrato consumido pelo Portal.

## Decisão

Foi criado um probe administrativo explícito:

`shadowDebug=1`

A constante global continua:

`AGENDAMENTOS_SHADOW_READ_ENABLED = false`

Somente uma requisição administrativa autenticada com o parâmetro de probe:

1. executa o repositório candidato;
2. compara o resultado com a leitura legada;
3. inclui um relatório técnico `shadowRead` na resposta daquela requisição.

Requisições administrativas normais continuam sem executar o candidato e sem
expor `shadowRead`.

## Resultado

O diagnóstico live de 13/08/2026 registrou:

- 14 probes;
- 13 comparações concluídas;
- 13 com paridade;
- 0 divergências;
- 0 erros;
- 1 caso ignorado por busca textual não suportada.

O contrato normal permaneceu estável antes e depois dos probes.

## Consequência

A evidência é suficiente para avançar para observação automática controlada em
requisições suportadas, desde que a resposta legada continue oficial e falhas
do candidato permaneçam não bloqueantes.

Busca textual continua fora da comparação até implementação específica.
