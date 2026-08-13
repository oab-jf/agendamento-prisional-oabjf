# ADR 006 — Shadow read administrativo automático

- **Status:** Aceito
- **Data:** 13/08/2026
- **Dependências:** ADR 004 e ADR 005

## Contexto

A Fase 1E validou o novo repositório contra dados live por meio de um probe
administrativo explícito. Foram 13 comparações concluídas com paridade, sem
divergências ou erros, mantendo a feature flag global desligada.

O passo seguinte é observar o candidato durante o uso normal das consultas
administrativas suportadas, sem promover sua resposta para o Portal.

## Decisão

A constante passa de:

`AGENDAMENTOS_SHADOW_READ_ENABLED = false`

para:

`AGENDAMENTOS_SHADOW_READ_ENABLED = true`

Esta é a única alteração semântica da ativação.

## Contrato preservado

Mesmo com a flag ligada:

1. a leitura legada continua sendo a resposta oficial;
2. a leitura candidata é usada somente para comparação;
3. `shadowRead` não é incluído em respostas normais;
4. `shadowDebug=1` continua sendo necessário para expor o relatório técnico;
5. falhas do candidato não bloqueiam a resposta oficial;
6. nenhuma gravação schema v2 é ativada.

Busca textual continua tratada como caso não suportado pelo comparador até
implementação específica.

## Homologação

O smoke live após a publicação registrou:

- contrato normal inicial: 15 itens;
- contrato normal final: 15 itens;
- relatório de shadow read exposto no contrato normal: não;
- 9 probes de controle;
- 9 comparações concluídas;
- 9 paridades;
- 0 divergências;
- 0 erros.

## Consequência

O novo motor passa a receber tráfego real em modo de observação silenciosa.
Isso amplia a evidência operacional sem alterar a experiência do usuário nem a
fonte oficial de dados do Portal.
