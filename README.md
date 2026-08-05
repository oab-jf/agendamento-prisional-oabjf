# Central de Agendamento Prisional — OAB Juiz de Fora

Documentação técnica de handoff da Central de Agendamento Prisional.

Esta documentação foi montada a partir do snapshot completo **v26** do frontend e do estado atual do backend Wix/Velo usado pela Central.

## Leitura recomendada

1. [`docs/00-visao-geral.md`](docs/00-visao-geral.md)
2. [`docs/01-arquitetura-e-deploy.md`](docs/01-arquitetura-e-deploy.md)
3. [`docs/02-backend-wix-e-cms.md`](docs/02-backend-wix-e-cms.md)
4. [`docs/03-fluxos-do-sistema.md`](docs/03-fluxos-do-sistema.md)
5. [`docs/04-painel-admin-e-permissoes.md`](docs/04-painel-admin-e-permissoes.md)
6. [`docs/05-runbook-manutencao.md`](docs/05-runbook-manutencao.md)
7. [`docs/06-contratos-de-api.md`](docs/06-contratos-de-api.md)
8. [`docs/07-design-system-e-ux.md`](docs/07-design-system-e-ux.md)
9. [`docs/08-changelog-tecnico.md`](docs/08-changelog-tecnico.md)
10. [`docs/09-envios-diarios.md`](docs/09-envios-diarios.md)
11. [`docs/99-alertas-criticos.md`](docs/99-alertas-criticos.md)

## Regra de ouro

O build publicado no Cloudflare Pages **não usa TanStack Start/TanStack Router em produção**. Ele usa o runtime estático:

- `index.pages.html`
- `src/pages-main.tsx`
- `src/pages-router.tsx`
- `src/lib/pages-router-shim.tsx`
- `vite.pages.config.ts`

Publicação correta:

```bash
npm run build:pages
```

Depois, subir a pasta `dist-pages/` no projeto Cloudflare Pages.
