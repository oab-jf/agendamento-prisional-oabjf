# 02 — Backend Wix/Velo e CMS

## Onde fica o backend

O frontend chama endpoints Wix/Velo em:

```text
https://www.juizdefora-oabmg.org.br/_functions
```

O backend não está dentro do repositório do frontend. Ele é mantido no Wix/Velo, principalmente nos arquivos:

```text
backend/adminApi.js
backend/http-functions.js
backend/documentos.jsw
backend/disponibilidade.js
```

`adminApi.js` concentra regras administrativas, sessões, convites, permissões, unidades, bloqueios, consulta/cancelamento/remarcação etc.

`http-functions.js` expõe os endpoints `/_functions/oab...`.

`documentos.jsw` concentra o fluxo de documentos/procurações e envios por e-mail.

`disponibilidade.js` é usado para listar datas/horários disponíveis e deve respeitar agendamentos ativos e bloqueios.

## Coleções Wix e IDs reais

Sempre use o ID real da coleção, não apenas o nome visual.

```text
BloqueiosAgenda            = Import4256
UnidadesPrisionais         = Import4258
AgendamentosPrisionais     = Import4259
SolicitacoesDocumentos     = Import4260
AdminLogs                  = Import4261
AdminSessoes               = Import4262
AdminUsuarios              = Import4263
```

## AdminUsuarios — campos relevantes

Campos principais:

```text
nome                         Texto
email                        Texto
cargoFuncao                  Texto
ativo                        Booleano
permissoesJson               Texto
senhaSalt                    Texto
senhaHash                    Texto
precisaTrocarSenha           Booleano
ultimoAcessoEm               Data e hora
criadoEm                     Data e hora
atualizadoEm                 Data e hora
criadoPor                    Texto
atualizadoPor                Texto
```

Campos de segurança:

```text
cpfHash                      Texto
cpfCadastrado                Booleano
cpfAtualizadoEm              Data e hora
emailVerificado              Booleano
emailVerificadoEm            Data e hora
precisaVerificarEmail        Booleano
codigoEmailHash              Texto
codigoEmailExpiraEm          Data e hora
codigoEmailTentativas        Número
codigoEmailBloqueadoAte      Data e hora
senhaAlteradaEm              Data e hora
```

Campos de convite:

```text
conviteHash                  Texto
conviteExpiraEm              Data e hora
conviteEnviadoEm             Data e hora
conviteAceitoEm              Data e hora
cadastroConcluido            Booleano
statusConvite                Texto
```

Nunca criar campo `cpf` em claro.

## Secrets Wix

Não salvar valores de secrets na documentação, no repositório ou em prints.

Secrets usados/esperados pelo backend atual:

```text
OAB_ADMIN_EMAILS
OAB_ADMIN_PASSWORD
OAB_ADMIN_TOKEN
OAB_ADMIN_PASSWORD_PEPPER
OAB_CPF_HASH_PEPPER
OAB_ADMIN_EMAIL_CODE_PEPPER
OAB_CENTRAL_URL
INFOBIP_BASE_URL
INFOBIP_API_KEY
INFOBIP_FROM_EMAIL
INFOBIP_FROM_NAME
```

Observações:

- `OAB_CPF_HASH_PEPPER` não deve ser trocado depois que usuários com CPF forem criados, porque a validação de CPF duplicado depende do hash.
- `OAB_ADMIN_EMAIL_CODE_PEPPER` é usado para hash do código de confirmação por e-mail.
- `OAB_CENTRAL_URL` é opcional para montar links de convite. Valor padrão esperado: `https://central.juizdefora-oabmg.org.br`.

## Infobip

O envio de e-mails depende dos secrets `INFOBIP_*` e do endpoint `/email/3/send`.

Fluxos que usam e-mail:

- confirmação de agendamento;
- envio de documento à unidade;
- confirmação de documento ao advogado;
- convite administrativo;
- código de confirmação de e-mail para admin.

## Regras sensíveis

- CPF nunca deve ser armazenado em claro.
- Token de convite nunca deve ser armazenado em claro; o backend salva apenas `conviteHash`.
- Senha nunca deve ser armazenada em claro; usar salt/hash.
- Códigos de e-mail devem expirar e ter limite de tentativas.
- Logs administrativos não devem guardar CPF, senha, token de convite ou código de e-mail.
