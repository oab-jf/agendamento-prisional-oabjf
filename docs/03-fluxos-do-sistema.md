# 03 — Fluxos do sistema

## 1. Agendamento público

Rotas:

```text
/agendar/unidade
/agendar/regras
/agendar/data
/agendar/horario
/agendar/advogado
/agendar/ipl
/agendar/revisao
/agendar/sucesso
```

Dados do rascunho ficam em `sessionStorage` via `PrototypeProvider` e `usePrototype`.

Endpoints usados:

```text
GET  /oabUnidades
GET  /oabDatas?unidadeSlug=...
GET  /oabHorarios?unidadeSlug=...&dataIso=...
POST /oabAgendamentos
```

Regras relevantes:

- unidade precisa estar ativa;
- datas/horários precisam estar disponíveis;
- bloqueios de agenda precisam remover datas/horários do fluxo público;
- agendamento gera protocolo `AG-...`;
- confirmação por e-mail ao advogado deve ser enviada pelo backend.

## 2. Consulta, cancelamento e remarcação pelo usuário

Rota:

```text
/consultar
```

Endpoints:

```text
POST /oabConsultarAgendamento
POST /oabCancelarAgendamentoUsuario
POST /oabRemarcarAgendamentoUsuario
GET  /oabDatas
GET  /oabHorarios
```

O usuário consulta usando protocolo + e-mail.

Cancelamento e remarcação seguem regra de antecedência mínima, atualmente 24 horas.

Ao remarcar:

- o agendamento original vira `reagendado`;
- é criado um novo protocolo;
- a interface oferece “visualizar agendamento” para ir direto ao novo protocolo.

## 3. Envio de documentos/procurações

Rotas:

```text
/documento/unidade
/documento/advogado
/documento/ipl
/documento/upload
/documento/revisao
/documento/sucesso
```

Endpoints:

```text
POST /oabDocumentoUpload
POST /oabDocumentos
```

Regras:

- aceita PDF/JPG/PNG até 8 MB;
- envia documento para a unidade;
- envia confirmação ao advogado;
- gera protocolo `DOC-...`;
- status administrativo simplificado: Recebido, Concluído, Com erro.

## 4. Painel administrativo

Rota:

```text
/admin
```

Login:

```text
POST /oabAdminLogin
POST /oabAdminConfirmarEmail
POST /oabAdminReenviarCodigoEmail
POST /oabAdminTrocarSenha
GET  /oabAdminMe
```

O painel valida sessão com `adminMe`. Sessão e permissões ficam em `sessionStorage`.

Abas:

```text
Agendamentos
Documentos
Unidades
Bloqueios
Usuários
```

A navegação mobile usa seletor “Área do painel: ...”, não apenas scroll horizontal.

## 5. Convite administrativo

Criação no painel:

```text
POST /oabAdminUsuarios
```

A criação de usuário agora é criação de convite. O admin informa:

- e-mail;
- permissões;
- cargo/função opcional;
- ativo/inativo.

O admin não informa CPF nem senha.

Conclusão pelo novo usuário:

```text
GET  /oabAdminConvite?token=...
POST /oabAdminConcluirConvite
```

Rota pública:

```text
/admin/convite?token=...
```

Fluxo:

1. admin envia convite;
2. usuário recebe link;
3. usuário informa nome completo, CPF e senha;
4. backend salva CPF apenas como hash;
5. usuário vai para `/admin`;
6. faz login com senha criada;
7. recebe código por e-mail;
8. confirma código e acessa o painel.

## 6. Bloqueios de agenda

Aba:

```text
/admin → Bloqueios
```

Endpoints:

```text
GET  /oabAdminBloqueios
POST /oabAdminBloqueios
POST /oabAdminBloqueioAtualizar
POST /oabAdminBloqueioRemover
```

Tipos:

- dia inteiro;
- intervalo de datas;
- horário específico.

Escopos:

- todas as unidades;
- unidade específica.

Bloqueios precisam impactar:

- listagem pública de datas;
- listagem pública de horários;
- criação de agendamento;
- remarcação pública/admin.

## 7. Unidades

Aba:

```text
/admin → Unidades
```

Endpoints:

```text
GET  /oabAdminUnidades
POST /oabAdminUnidades
POST /oabAdminUnidadeAtualizar
POST /oabAdminUnidadeStatus
```

Campos principais:

- nome;
- código/slug;
- endereço;
- e-mail para documentos;
- e-mail para listas;
- observações internas;
- ativa/inativa.

O código/slug só pode ser ajustado na criação. Depois deve ficar somente leitura.
