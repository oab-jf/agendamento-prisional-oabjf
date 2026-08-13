# Diagnóstico live — Catálogo configurável de Agendamentos — 13/08/2026

## Estado publicado no Wix

Coleção:

- ID: `AgendamentoConfiguracoes`;
- nome: `Configurações de Agendamentos`;
- registro principal: `catalogo-principal`;
- leitura, inserção, atualização e remoção restritas ao contexto administrativo.

Arquivos Velo publicados neste lote:

- `adminApi.js` — `d45a1f3bd3f6e7635a32ee9be773b735bbe41cbde969486110485c8c35967be1`;
- `http-functions.js` — `6395e1b519ef7ae564f89f3b0885aaf5cabf0a74b5cbd23be4a561585c525915`;
- `agendamentosConfiguracao.js` — `32e0d2dfa51e9e1144aa81662665def9b56b4bc06b69ebe491459a97480cf581`;
- `agendamentosConfiguracaoRepository.js` — `18df5a3c56bed3c0d1389546e112413cc048e66e495e845993a67b0141f4b195`;
- `agendamentosConfiguracaoStore.js` — `b50f8b88b20bafd18f69da70cb861abff5c4bac580dd178f208ebe25a079616e`.

## Smoke pós-publicação

Executado após publicação única do backend:

- catálogo público: somente Atendimento Prisional exposto;
- catálogo administrativo: `4` modalidades;
- modalidades ativas: `1`;
- modalidades em rascunho: `3`;
- revisão do catálogo: `1`;
- contrato legado: `total=18`, `itens=18`;
- nenhum rascunho exposto ao público;
- agenda prisional legada preservada.

## Estado inicial

- Atendimento Prisional: ativo e protegido;
- Salas de Apoio: rascunho;
- Escritórios Compartilhados: rascunho;
- Suporte PJe: rascunho.

## Leitura do resultado

O catálogo configurável foi inicializado sem substituir o fluxo prisional
existente. As modalidades ainda não configuradas permanecem invisíveis ao
público e podem ser completadas posteriormente pelo Portal de Gestão.

A ativação continua condicionada às regras de prontidão do domínio.
