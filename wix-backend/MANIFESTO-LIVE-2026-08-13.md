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

## Fase 1F — observação automática

Após o checkpoint `60a9905`, o shadow read foi ativado automaticamente para
consultas administrativas suportadas.

Alteração live:

- `adminApi.js` — `581f7c33183097394a0b2f6d313e83b679aeb715a61353ddf665b2c9d78232ab`

Permanecem inalterados:

- `http-functions.js` — `be4033eebe3f07238901b09e861e9a7c152278a8b3f22b7d563f4455e12bd54b`;
- bridge administrativo;
- módulos do repositório e shadow read;
- coleções e índices.

A constante passou a:

`AGENDAMENTOS_SHADOW_READ_ENABLED = true`

### Garantias preservadas

- a resposta oficial continua sendo a leitura legada;
- `shadowRead` não é exposto em requisições normais;
- o candidato é somente leitura;
- falhas do candidato permanecem não bloqueantes;
- `shadowDebug=1` continua reservado ao diagnóstico administrativo;
- nenhuma escrita schema v2 foi ativada.

### Smoke live da observação automática

Executado em 13/08/2026:

- contrato normal inicial: `total=15`, `itens=15`;
- contrato normal final: `total=15`, `itens=15`;
- `shadowRead` exposto em requests normais: não;
- probes de controle: `9`;
- comparações concluídas: `9`;
- paridade: `9`;
- divergências: `0`;
- erros: `0`.

A observação automática pode permanecer ligada enquanto o desenvolvimento
multimodal prossegue, sem promover o candidato a fonte oficial.
## Catálogo configurável de Agendamentos

Em 13/08/2026 foi publicada a fundação operacional do catálogo configurável.

### Persistência

Coleção Wix:

- `AgendamentoConfiguracoes`;
- aggregate principal: `catalogo-principal`;
- permissões administrativas;
- schema versionado e revisão otimista.

### Arquivos Velo live

- `adminApi.js` — `d45a1f3bd3f6e7635a32ee9be773b735bbe41cbde969486110485c8c35967be1`;
- `http-functions.js` — `6395e1b519ef7ae564f89f3b0885aaf5cabf0a74b5cbd23be4a561585c525915`;
- `agendamentosConfiguracao.js` — `32e0d2dfa51e9e1144aa81662665def9b56b4bc06b69ebe491459a97480cf581`;
- `agendamentosConfiguracaoRepository.js` — `18df5a3c56bed3c0d1389546e112413cc048e66e495e845993a67b0141f4b195`;
- `agendamentosConfiguracaoStore.js` — `b50f8b88b20bafd18f69da70cb861abff5c4bac580dd178f208ebe25a079616e`.

### Smoke live

- catálogo público: somente Atendimento Prisional;
- catálogo administrativo: 4 modalidades;
- ativos: 1;
- rascunhos: 3;
- revisão: 1;
- agenda legada: `total=18`, `itens=18`.

A resposta oficial da agenda prisional continua preservada. O catálogo
configurável passa a controlar a disponibilidade pública das modalidades sem
expor itens incompletos.
