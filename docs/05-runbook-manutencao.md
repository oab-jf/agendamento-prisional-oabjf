# 05 — Runbook de manutenção

## Publicar frontend no Cloudflare Pages

1. Rodar:

```bash
npm run build:pages
```

2. Conferir `dist-pages/`.
3. Publicar o conteúdo de `dist-pages/` no Cloudflare Pages.
4. Validar:

```text
/
/admin
/admin/convite?token=fake
/consultar
/agendar/unidade
/documento/unidade
```

`/admin/convite?token=fake` deve abrir a tela da rota e mostrar convite inválido, não 404.

## Publicar backend no Wix

Substituir no Velo:

```text
backend/adminApi.js
backend/http-functions.js
backend/documentos.jsw
backend/disponibilidade.js, se houver alteração de disponibilidade
```

Depois publicar o site Wix.

Nunca publicar com erro de build no Wix. Abra o `build.log` e corrija antes.

## Testar login admin

No console do navegador:

```js
await (async () => {
  const res = await fetch("https://www.juizdefora-oabmg.org.br/_functions/oabAdminLogin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: "EMAIL_ADMIN", senha: "SENHA_ADMIN" }),
  });
  return { httpStatus: res.status, httpOk: res.ok, body: await res.json() };
})();
```

Esperado:

```text
httpStatus 200
body.ok true
```

## Testar convite

1. Entrar como admin.
2. Aba Usuários → Enviar convite.
3. Criar convite com e-mail de teste.
4. Abrir link recebido no e-mail.
5. Se a tela disser “convite inválido”, testar direto:

```js
await (async () => {
  const token = new URLSearchParams(window.location.search).get("token");
  const res = await fetch(
    `https://www.juizdefora-oabmg.org.br/_functions/oabAdminConvite?token=${encodeURIComponent(token)}`,
    { headers: { Accept: "application/json" } },
  );
  return { httpStatus: res.status, httpOk: res.ok, body: await res.json() };
})();
```

Se `body.ok === true`, o backend está certo e o problema é parsing/frontend.

## Testar bloqueios

1. Criar bloqueio na aba Bloqueios.
2. Consultar datas públicas:

```js
await (async () => {
  const res = await fetch("https://www.juizdefora-oabmg.org.br/_functions/oabDatas?unidadeSlug=SLUG", {
    headers: { Accept: "application/json" },
  });
  return { httpStatus: res.status, httpOk: res.ok, body: await res.json() };
})();
```

3. Conferir se datas bloqueadas não aparecem.
4. Para bloqueio por horário, testar:

```js
await (async () => {
  const res = await fetch("https://www.juizdefora-oabmg.org.br/_functions/oabHorarios?unidadeSlug=SLUG&dataIso=YYYY-MM-DD", {
    headers: { Accept: "application/json" },
  });
  return { httpStatus: res.status, httpOk: res.ok, body: await res.json() };
})();
```

## Testar documentos

1. Fluxo público `/documento/unidade` até sucesso.
2. Confirmar protocolo `DOC-...`.
3. Verificar aba Documentos no painel.
4. Abrir arquivo enviado.
5. Marcar como concluído.
6. Conferir e-mails de unidade e advogado.

## Testar remarcação pública

1. Criar agendamento ativo.
2. Acessar `/consultar`.
3. Consultar por protocolo + e-mail.
4. Remarcar para outra data/horário.
5. Conferir novo protocolo.
6. Usar “visualizar agendamento”.

## Problemas comuns

### Convite mostra “inválido ou expirado”, mas API retorna `ok: true`

Corrigir parsing frontend. A resposta pode vir flat:

```text
body.email
body.cargoFuncao
body.statusConvite
```

ou aninhada:

```text
body.convite.email
```

O frontend deve usar `body.convite || body`.

### Fuso de convite parece errado

Backend pode retornar ISO UTC, por exemplo:

```text
2026-07-15T19:55:24.749Z
```

A interface deve exibir em `America/Sao_Paulo`:

```text
15/07/2026 às 16:55
```

### Datas bloqueadas continuam aparecendo

Verificar se o backend de disponibilidade consulta `BloqueiosAgenda = Import4256`.

### Usuário não vê uma aba

Verificar permissões `.ver` no usuário.

### Publicação Cloudflare quebrou

Confirmar que foi publicado `dist-pages/`, não `dist`, `.output` ou build TanStack Start.
