# 04 — Painel admin e permissões

## Acesso

O painel fica em:

```text
/admin
```

A sessão é guardada no navegador com estas chaves de `sessionStorage`:

```text
oabAdminToken
oabAdminEmail
oabAdminPermissoes
oabAdminLegacy
oabAdminId
```

A cada restauração de sessão, o frontend chama:

```text
GET /oabAdminMe
```

Se a sessão expirar, o usuário é deslogado.

## Abas do painel

A ordem atual é:

```text
Agendamentos
Documentos
Unidades
Bloqueios
Usuários
```

Cada aba só aparece se o usuário tiver a permissão `.ver` correspondente.

## Permissões disponíveis

Agendamentos:

```text
agendamentos.ver
agendamentos.cancelar
agendamentos.remarcar
```

Documentos:

```text
documentos.ver
documentos.abrir
documentos.concluir
```

Unidades:

```text
unidades.ver
unidades.criar
unidades.editar
unidades.ativar
```

Bloqueios:

```text
bloqueios.ver
bloqueios.criar
bloqueios.editar
bloqueios.remover
```

Usuários:

```text
usuarios.ver
usuarios.criar
usuarios.editar
usuarios.desativar
```

Configurações/envios futuros:

```text
config.ver
config.testar_envios
config.ativar_envios
```

## Modelos rápidos de permissão

O frontend possui modelos rápidos na aba Usuários:

```text
Administrador completo
Operação de agendamentos
Operação de documentos
Somente consulta
```

Eles são apenas atalhos visuais; a fonte real de permissão é o array de chaves salvo no backend/CMS.

## Regras de UX/segurança na aba Usuários

### Criação

O botão é “Enviar convite”.

O admin informa apenas:

- e-mail;
- cargo/função opcional;
- usuário ativo;
- permissões.

Não pedir CPF, nome completo ou senha na criação do convite.

### Convite pendente

Usuários convidados aparecem como:

```text
Cadastro pendente
Convite pendente
```

Ações disponíveis:

- editar e-mail/cargo/status/permissões;
- reenviar convite;
- desativar, se permitido.

Não mostrar ação “Senha” para convite pendente.

### Usuário completo

Usuários com cadastro concluído permitem:

- editar dados;
- redefinir senha, se o fluxo estiver habilitado;
- desativar;
- excluir apenas se estiver inativo.

### CPF

CPF nunca aparece em listagem, modal, toast, URL, logs visuais ou storage.

Na edição, mostrar apenas:

```text
CPF cadastrado
CPF pendente
```

## Usuário legado

O campo `legacy` libera tudo no frontend. Use apenas para compatibilidade/bootstrap. A tendência é migrar tudo para permissões explícitas.
