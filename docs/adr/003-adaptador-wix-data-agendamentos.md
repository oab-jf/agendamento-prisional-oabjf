# ADR 003 — Adaptador Wix Data do Repositório de Agendamentos

- **Status:** Aceito
- **Data:** 12/08/2026
- **Dependências:** ADR 001 e ADR 002

## Contexto

A Fase 1B definiu a semântica canônica de consulta e o shadow read sem acesso
ao Wix. A próxima etapa precisa traduzir esse contrato para `wix-data` sem
substituir a leitura oficial do Atendimento Prisional e sem publicar qualquer
mudança de comportamento.

O histórico live continua na coleção `Import4259`, que hoje contém registros
legados do atendimento prisional e, futuramente, registros schema v2.

## Decisões

1. O adaptador será criado por `createWixAppointmentsRepository({ wixData })`.
2. O módulo não importa `wix-data` estaticamente. A dependência é injetada:
   - em testes, entra um fake compatível com `WixDataQuery`;
   - no bridge Velo futuro, entrará o objeto real importado de `wix-data`.
3. Os ramos permanecem separados:
   - `schema-v2`: `schemaVersion >= 2` e `modalidadeId` conhecida;
   - `legacy-prison`: ausência de `modalidadeId`/`modalityId`.
4. Os dois ramos usam a mesma ordenação estável:
   `dataAtendimentoIso`, `horarioInicio`, `_id`.
5. O cursor canônico é traduzido para uma condição lexicográfica composta:
   - data posterior/anterior;
   - ou mesma data e horário posterior/anterior;
   - ou mesma data/horário e `_id` posterior/anterior.
6. Cada ramo busca no máximo `pageSize + 1` itens. Os resultados são
   normalizados, deduplicados por ID, mesclados e paginados globalmente.
7. Filtros de modalidade, recurso, status, período e protocolo são enviados ao
   banco.
8. E-mail:
   - v2 usa `solicitanteEmail`;
   - legado aceita `emailIndex` ou `emailAdvogado`.
9. OAB usa variantes compatíveis com o formato histórico (`MG-123456`,
   `MG 123456`, `MG123456`, etc.) e passa por verificação canônica após a
   leitura.
10. A leitura usa `suppressAuth: true` por padrão, preservando o padrão atual do
    backend administrativo. A integração futura continua responsável por
    autenticar/autorizar a chamada antes de chegar ao repositório.
11. Observabilidade registra somente contagens e metadados técnicos. Não registra
    nome, e-mail, telefone, IPL, INFOPEN ou dados específicos.
12. O wiring de shadow read permanece **desativado por padrão** e não é ligado a
    nenhum endpoint nesta fatia.

## Total de resultados

O adaptador usa `totalCount` retornado pelos ramos do Wix e desconta, na janela
lida, registros inválidos ou rejeitados pela verificação canônica. Como a base
legada não possui todos os campos normalizados/indexados, divergências de
qualidade de dados continuam aparecendo nos diagnósticos do shadow read.

Antes de tornar o repositório v2 fonte oficial, a coleção deve receber os
índices e campos normalizados necessários, e a paridade precisa ser medida com
dados reais.

## Índices candidatos

Nenhum índice é criado nesta fase. Para a homologação com dados reais, validar
no Wix combinações equivalentes a:

### Schema v2

- `schemaVersion + modalidadeId + dataAtendimentoIso + horarioInicio`;
- `modalidadeId + recursoId + dataAtendimentoIso + horarioInicio`;
- `modalidadeId + status + dataAtendimentoIso + horarioInicio`;
- `protocolo`;
- `solicitanteEmail`;
- campo normalizado futuro para OAB.

### Legado prisional

- `unidadeSlug + dataAtendimentoIso + horarioInicio`;
- `unidadeSlug + status + dataAtendimentoIso + horarioInicio`;
- `protocolo`;
- `emailIndex`.

## Fora desta fatia

- alteração de `adminApi.js` ou `http-functions.js`;
- criação/alteração de coleção;
- criação de índices no Wix;
- gravação schema v2;
- ativação de feature flag;
- alteração de resposta pública ou administrativa;
- publicação no Wix.

## Critério para a próxima etapa

A próxima integração só deve ocorrer depois que:

1. os testes locais do adaptador estiverem verdes;
2. o build da Central continuar aprovado;
3. o diff permanecer restrito aos arquivos desta fase;
4. o bridge Velo for preparado sobre o snapshot live atual;
5. a leitura primária continuar sendo a resposta oficial.
