# 01 — Arquitetura e deploy

## Arquitetura resumida

```text
Usuário/Advogado/Admin
        ↓
Cloudflare Pages — SPA estática
        ↓
Wix/Velo HTTP Functions — /_functions/oab...
        ↓
Wix CMS + Wix Media + Infobip e-mail
```

## Dois modos de execução

### Preview/dev

Usa TanStack Start/TanStack Router:

- `src/main.tsx`
- `src/client-entry.tsx`
- `src/router.tsx`
- `src/routeTree.gen.ts`
- `src/routes/*`

### Produção/Cloudflare Pages

Usa SPA estática com roteador próprio:

- `index.pages.html`
- `src/pages-main.tsx`
- `src/pages-router.tsx`
- `src/lib/pages-router-shim.tsx`
- `vite.pages.config.ts`

`vite.pages.config.ts` faz o alias de `@tanstack/react-router` para `src/lib/pages-router-shim.tsx`, evitando que TanStack Router/Start entre no bundle publicado.

## Build correto para publicação

```bash
npm run build:pages
```

ou:

```bash
vite build --config vite.pages.config.ts
```

O resultado correto fica em:

```text
dist-pages/
  index.html
  assets/
  _redirects
  _headers
  favicon.png
  oab-logo.png
```

## Publicação no Cloudflare Pages

1. Rodar `npm run build:pages`.
2. Conferir se a pasta gerada é `dist-pages/`.
3. Compactar ou subir o conteúdo de `dist-pages/` no projeto Cloudflare Pages.
4. Projeto Cloudflare: `central-oabjf`.
5. Domínio público: `central.juizdefora-oabmg.org.br`.

## Arquivos que não devem ser alterados sem motivo forte

- `vite.pages.config.ts`
- `index.pages.html`
- `src/pages-main.tsx`
- `src/pages-router.tsx`
- `src/lib/pages-router-shim.tsx`

Alterar esses arquivos pode quebrar o runtime estático da Central.

## Rotas registradas no runtime Pages

`src/pages-router.tsx` importa e registra manualmente as rotas. Ao criar uma rota nova, ela precisa ser registrada ali, além de existir em `src/routes`.

Rotas públicas principais:

```text
/
/agendar/unidade
/agendar/regras
/agendar/data
/agendar/horario
/agendar/advogado
/agendar/ipl
/agendar/revisao
/agendar/sucesso
/documento/unidade
/documento/advogado
/documento/ipl
/documento/upload
/documento/revisao
/documento/sucesso
/consultar
/admin
/admin/convite
/gestao
```

## Redirecionamento SPA

`public/_redirects` deve conter:

```text
/*    /index.html   200
```

Isso garante que rotas internas como `/admin/convite?token=...` sejam resolvidas pela SPA.
