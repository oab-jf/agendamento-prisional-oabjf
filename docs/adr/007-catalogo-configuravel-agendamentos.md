# ADR 007 — Catálogo configurável da Plataforma de Agendamentos

- **Status:** Aceito
- **Data:** 13/08/2026
- **Dependências:** ADR 001 a ADR 006

## Contexto

A OAB/JF precisa incorporar Salas de Apoio, Escritórios Compartilhados e
Suporte PJe sem conhecer, antes da entrega, todos os horários, recursos,
capacidades e regras operacionais. Esses parâmetros não podem permanecer
presos ao código ou depender de uma nova publicação técnica.

Ao mesmo tempo, o Atendimento Prisional já opera em produção e precisa ser
preservado durante a transição para o modelo multimodal.

## Decisão

O catálogo de agendamentos passa a ser um aggregate root versionado, composto
por quatro conjuntos:

1. **Modalidades:** o serviço oferecido à advocacia;
2. **Locais:** onde o atendimento acontece;
3. **Recursos:** o elemento que reserva capacidade;
4. **Ofertas:** a combinação operacional de modalidade, local e recurso, com
   duração, capacidade, antecedência, rota pública e disponibilidade.

O aggregate é armazenado em um único registro da coleção Wix
`AgendamentoConfiguracoes`, com `_id = catalogo-principal`.

## Motivos para o aggregate único

- referências e ativação são validadas atomicamente;
- uma alteração nunca deixa metade da configuração salva;
- a revisão otimista impede sobrescrita concorrente;
- backup e rollback usam um único registro;
- o volume esperado é pequeno e adequado ao limite de um item Wix;
- reduz a complexidade operacional para a entrega imediata.

Se o catálogo superar esse limite no futuro, a API pode manter o mesmo
contrato e migrar a persistência para coleções separadas.

## Estados

Todos os itens usam:

- `rascunho`: configurável e não público;
- `ativo`: operacional, sujeito às validações de prontidão;
- `pausado`: preservado, mas indisponível ao público.

## Regra de publicação

Uma oferta ativa precisa ter:

- modalidade ativa;
- local ativo;
- recurso ativo e pertencente ao mesmo local;
- duração e capacidade válidas;
- rota pública definida;
- disponibilidade legada ou grade semanal válida.

Uma modalidade ativa precisa ter nome, descrição e ao menos uma oferta ativa e
pronta. A projeção pública elimina qualquer rascunho, item pausado ou cadeia
incompleta.

## Proteção do legado

O bootstrap cria e protege:

- modalidade `prisional_virtual`;
- local `atendimento-virtual`;
- recurso `unidades-prisionais`;
- oferta `atendimento-prisional-virtual`.

O Portal apresenta esses itens como somente leitura e o domínio preserva os
bytes normalizados mesmo que um cliente tente removê-los ou alterá-los.

## Sementes de entrega

- Atendimento Prisional: ativo e protegido;
- Salas de Apoio: rascunho;
- Escritórios Compartilhados: rascunho;
- Suporte PJe: rascunho.

A OAB/JF poderá concluir os rascunhos no Portal sem editar código ou entrar no
CMS.

## Segurança e permissões

A nova permissão é `agendamentos.configurar`. Ela implica
`agendamentos.ver`. A coleção CMS é restrita a administradores; a leitura
pública ocorre apenas pelo endpoint que devolve a projeção sanitizada.

## Consequências

- o Portal ganha uma área própria de configuração;
- a Central pública lê somente modalidades prontas;
- o legado prisional continua sendo o fluxo real já homologado;
- novos fluxos podem ser ativados posteriormente pela OAB quando suas rotas
  públicas e parâmetros estiverem concluídos.
