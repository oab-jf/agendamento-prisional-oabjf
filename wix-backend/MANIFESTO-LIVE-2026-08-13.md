# OAB/JF — Manifesto do backend live — 13/08/2026

## Base segura

- Branch: `plataforma-agendamentos-multimodalidade`
- Checkpoint anterior: `a86e597`
- Shadow read global: `OFF`
- Resposta oficial: fluxo legado

## Fase 1E — probe controlado

Foram alterados somente:

- `adminApi.js` — `a2a33e94b2da32398f42cffe3fe7b755072853286e4bbbd3f2d13785ab2a3f2a`
- `http-functions.js` — `be4033eebe3f07238901b09e861e9a7c152278a8b3f22b7d563f4455e12bd54b`

O bridge e os módulos da Fase 1D permanecem inalterados.

O probe exige simultaneamente:

- autenticação administrativa válida;
- parâmetro explícito `shadowDebug=1`.

Sem esse parâmetro:

- o candidato não executa;
- o campo `shadowRead` não aparece;
- o contrato do Portal não muda.

## Diagnóstico live

Executado em 13/08/2026:

- contrato normal antes: `total=15`, `itens=15`, sem `shadowRead`;
- contrato normal depois: `total=15`, `itens=15`, sem `shadowRead`;
- probes totais: `14`;
- comparações concluídas: `13`;
- paridade: `13`;
- divergências: `0`;
- erros: `0`;
- ignorados: `1`.

O único caso ignorado foi busca textual, com motivo técnico
`unsupported_text_search`.

Os probes com paridade cobriram:

- conjunto completo atual;
- unidade disponível na amostra;
- status `agendado`, `cancelado` e `reagendado`;
- datas presentes entre 07/08/2026 e 25/08/2026.

## Limites da evidência

A paridade comprova o comportamento do candidato sobre a amostra live atual
consultada. Ela não é uma prova abstrata de correção para qualquer volume ou
qualquer combinação futura de dados.

O próximo passo permitido é ativar shadow read automático apenas como
observação, mantendo a resposta legada oficial e tratando busca textual como
caso explicitamente ignorado até suporte posterior.

## Integridade operacional

Nesta fase:

- nenhuma coleção foi alterada;
- nenhum índice foi alterado;
- nenhuma escrita schema v2 foi ativada;
- nenhum comportamento público de agendamento foi alterado.
