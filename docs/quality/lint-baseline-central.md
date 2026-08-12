# Baseline de lint da Central

## Situação

O repositório da Central já possui dívida de lint anterior à fundação
multimodal, concentrada principalmente em formatação Prettier, alguns usos de
`any` e avisos de Fast Refresh.

A primeira tentativa da fundação executou `npm run lint` como se a base fosse
limpa. Isso fez a instalação falhar apesar de os 11 testes do novo domínio
terem sido aprovados.

## Regra adotada neste ciclo

Enquanto a dívida histórica não for tratada em tarefa própria:

1. o instalador mede os diagnósticos da base antes da alteração;
2. aplica a fundação;
3. mede novamente;
4. bloqueia qualquer diagnóstico novo;
5. aceita diagnósticos removidos;
6. mantém testes do domínio, build e `git diff --check` como gates bloqueantes.

Essa regra não declara o lint como resolvido. Ela apenas impede que o novo
ciclo aumente a dívida existente.

## Pendência futura

Criar uma rodada separada de higiene técnica para:

- aplicar a formatação em lote com diff revisável;
- resolver os usos de `any` relevantes;
- separar exports que geram avisos de Fast Refresh;
- tornar `npm run lint` novamente um gate integral de sucesso.
