# ADR 002 — Repositório v2 e shadow read de Agendamentos

- **Status:** Aceito
- **Data:** 12/08/2026
- **Dependência:** ADR 001

## Contexto

A consulta administrativa vigente carrega um conjunto limitado de registros e
aplica parte dos filtros no frontend. A multimodalidade exigirá consultas
indexáveis, paginação server-side e leitura compatível de registros legados.

Não é seguro substituir a leitura oficial do Atendimento Prisional de uma só
vez.

## Decisões

1. A semântica canônica de consulta será independente do Wix.
2. A paginação será por cursor estável, ordenado por data, horário e ID.
3. O tamanho padrão será 25 e o limite máximo será 100.
4. Registros sem schema ou modalidade serão adaptados como
   `prisional_virtual`.
5. Registros v2 inválidos serão excluídos da página e registrados em
   diagnóstico, sem derrubar toda a consulta.
6. O plano de persistência terá ramos separados para schema v2 e legado
   prisional.
7. A primeira integração será feita por shadow read:
   - a leitura antiga continua sendo a resposta oficial;
   - a leitura v2 roda apenas quando habilitada;
   - diferenças são registradas sem dados pessoais;
   - falhas da leitura candidata nunca afetam a resposta oficial.
8. A feature flag permanece desativada por padrão.

## Filtros desta fase

- modalidade;
- recurso;
- status;
- intervalo de datas;
- protocolo exato;
- e-mail exato;
- OAB exata normalizada.

Busca textual ampla fica fora desta fatia porque precisará de estratégia de
índice e linguagem própria por modalidade.

## Segurança e privacidade

O relatório de paridade não registra nome, e-mail, telefone, IPL, INFOPEN,
documentos ou dados específicos. Ele usa somente identificadores técnicos,
protocolo, modalidade, status, recurso e identidade do slot.

## Consequências

Esta fatia ainda não consulta o Wix em produção. Ela estabelece o contrato,
a referência de comportamento e o mecanismo de comparação que serão usados
pelo adaptador Wix da próxima fase.
