# 06 — Contratos de API

Base usada pelo frontend:

```text
https://www.juizdefora-oabmg.org.br/_functions
```

## Públicos

```text
GET  /oabUnidades
GET  /oabDatas?unidadeSlug=...
GET  /oabHorarios?unidadeSlug=...&dataIso=...
POST /oabAgendamentos
POST /oabConsultarAgendamento
POST /oabCancelarAgendamentoUsuario
POST /oabRemarcarAgendamentoUsuario
POST /oabDocumentoUpload
POST /oabDocumentos
GET  /oabAdminConvite?token=...
POST /oabAdminConcluirConvite
```

## Admin — autenticação e sessão

```text
POST /oabAdminLogin
GET  /oabAdminMe
POST /oabAdminConfirmarEmail
POST /oabAdminReenviarCodigoEmail
POST /oabAdminTrocarSenha
```

## Admin — agendamentos

```text
GET  /oabAdminAgendamentos
POST /oabAdminCancelarAgendamento
POST /oabAdminRemarcarAgendamento
```

## Admin — documentos

```text
GET  /oabAdminDocumentos
POST /oabAdminConcluirDocumento
```

## Admin — unidades

```text
GET  /oabAdminUnidades
POST /oabAdminUnidades
POST /oabAdminUnidadeAtualizar
POST /oabAdminUnidadeStatus
```

## Admin — bloqueios

```text
GET  /oabAdminBloqueios
POST /oabAdminBloqueioImpacto
POST /oabAdminBloqueios
POST /oabAdminBloqueioAtualizar
POST /oabAdminBloqueioRemover
```

## Admin — usuários e convites

```text
GET  /oabAdminUsuarios
POST /oabAdminUsuarios
POST /oabAdminUsuarioAtualizar
POST /oabAdminUsuarioDesativar
POST /oabAdminUsuarioExcluir
POST /oabAdminUsuarioResetarSenha
POST /oabAdminUsuarioReenviarConvite
```

## Headers admin

O frontend envia os dois headers por compatibilidade:

```text
Authorization: Bearer <token>
X-OAB-Admin-Token: <token>
```

Quando houver body JSON:

```text
Content-Type: application/json
Accept: application/json
```

## Erros

O backend pode responder em PT-BR ou EN:

```text
codigo / mensagem / erro
code / message / error
```

`src/lib/oab-api.ts` normaliza para `code`, `message`, `error`.

Códigos importantes:

```text
ADMIN_NAO_AUTORIZADO
SESSAO_EXPIRADA
CONVITE_INVALIDO
CONVITE_EXPIRADO
CONVITE_JA_UTILIZADO
SEM_PERMISSAO
USUARIO_ATIVO
OPERACAO_NAO_PERMITIDA
```

## Cache frontend

O cliente usa cache em memória:

```text
Unidades: 5 minutos
Datas: 2 minutos
Horários: 45 segundos
```

Após alterar bloqueios ou unidades, teste endpoints diretamente ou faça hard refresh para evitar leitura de cache curto.
