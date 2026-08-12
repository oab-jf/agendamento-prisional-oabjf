# ADR 001 — Fundação da Plataforma de Agendamentos Multimodalidade

- **Status:** Aceito
- **Data:** 12/08/2026
- **Escopo:** Central pública, backend Wix e Portal de Gestão

## Contexto

A solução vigente é funcional para Atendimento Prisional, mas mistura
modalidade, unidade física, recurso reservável e regra de disponibilidade.

Salas, Escritórios e PJe não devem ser implementados por cópia da Central
Prisional.

## Decisões

1. A Central pública continuará como aplicação transacional independente.
2. O site institucional continuará como hub e camada editorial.
3. O Portal continuará como aplicação administrativa independente.
4. O domínio será composto por Modalidade, Local, Recurso, Oferta,
   Agendamento, Bloqueio e Política.
5. Registros legados de `Import4259` serão lidos como `prisional_virtual`,
   schema 1, por um adaptador.
6. O schema novo será versionado como v2.
7. Modalidades futuras existirão no catálogo, mas permanecerão desativadas até
   que regras, recursos e migração sejam homologados.
8. Permissões continuarão separadas por ação; escopo de modalidade será uma
   segunda dimensão.
9. Disponibilidade e criação deverão usar o mesmo núcleo de capacidade.
10. Nenhuma mudança pública será feita nesta primeira fatia.

## Invariantes de compatibilidade

- chave legada: `unidadeSlug|dataIso|horarioInicio`;
- timezone: `America/Sao_Paulo`;
- modalidade legada: `prisional_virtual`;
- status que ocupa capacidade nesta fase: `agendado`;
- duração prisional padrão: 30 minutos;
- capacidade prisional padrão: 1.

## Consequências

A primeira entrega é invisível ao usuário. Ela cria uma base testável e
versiona o backend vigente. A integração com endpoints Wix acontecerá numa
fatia posterior, por wrappers e feature flag, preservando contratos públicos.
