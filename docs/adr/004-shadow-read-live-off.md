# ADR 004 — Shadow read administrativo live com feature flag OFF

- **Status:** Aceito
- **Data:** 12/08/2026
- **Dependências:** ADR 001, ADR 002 e ADR 003

## Contexto

A Fase 1C consolidou o adaptador `wix-data`, paginação por cursor e wiring de
shadow read em módulos testáveis fora do Velo. A etapa seguinte precisa
introduzir essa infraestrutura no backend publicado sem substituir a leitura
oficial do Atendimento Prisional.

## Decisões

1. Os módulos Velo são publicados antes de qualquer integração com endpoints.
2. A listagem administrativa existente continua sendo a resposta oficial.
3. `adminApi.js` chama uma ponte de observação, mas a constante
   `AGENDAMENTOS_SHADOW_READ_ENABLED` permanece `false`.
4. Com a flag desligada, a ponte retorna antes de instanciar ou consultar o
   repositório candidato.
5. `http-functions.js` permanece inalterado.
6. Nenhuma coleção, índice ou escrita schema v2 é criada nesta etapa.
7. O estado live deve ser versionado em `wix-backend/source/`.
8. Antes de ativar shadow read, será feito um checkpoint separado deste estado
   OFF e um plano explícito de observabilidade/paridade.

## Homologação

Após a publicação da Camada 2, o smoke test do endpoint administrativo retornou:

- autenticação administrativa válida;
- `total=15`;
- `itens=15`;
- contrato vigente preservado.

## Consequência

O backend de produção contém a infraestrutura candidata, mas ainda não executa
shadow read. O próximo passo seguro é ativá-lo de forma controlada e observar
paridade sem alterar a resposta oficial.
