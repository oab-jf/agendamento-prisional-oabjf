# 99 — Alertas críticos

## Build e roteamento

- Não publicar build TanStack Start no Cloudflare Pages.
- Não depender de `RouterProvider`, `routeTree` ou `getRouter` no build publicado.
- Não remover o alias de `@tanstack/react-router` para `pages-router-shim` em `vite.pages.config.ts`.
- Toda nova rota de produção precisa ser registrada em `src/pages-router.tsx`.
- Publicar apenas `dist-pages/`.

## CPF e segurança

- Nunca criar campo `cpf` no CMS.
- Nunca salvar CPF em claro.
- Nunca exibir CPF completo ou mascarado.
- Nunca colocar CPF em URL, toast, log visual, sessionStorage ou localStorage.
- Nunca salvar token de convite em claro no CMS.
- Nunca salvar código de confirmação em claro.
- Nunca trocar `OAB_CPF_HASH_PEPPER` depois de usuários com CPF criados.

## Wix CMS

- Usar IDs reais das coleções `ImportXXXX`.
- Não confiar apenas no nome visual da coleção.
- Antes de mexer em backend, confirmar IDs atuais no Wix.

## Convites

- Convite válido pode retornar resposta flat (`body.email`) ou aninhada (`body.convite.email`).
- Frontend deve aceitar ambos.
- Expiração vem em ISO UTC; exibir em `America/Sao_Paulo`.

## Bloqueios

- Bloqueios precisam afetar datas, horários, criação e remarcação.
- Se a aba Bloqueios funciona mas datas públicas não mudam, o problema está no motor de disponibilidade.

## E-mails

- Convites, códigos, documentos e confirmações dependem da Infobip.
- Se e-mail não chegar, validar `INFOBIP_*` e resposta do endpoint.
- Não incluir dados sensíveis nos e-mails além do necessário.

## Lovable

Ao pedir alterações ao Lovable, reforçar sempre:

```text
Não mexer em Cloudflare/build/roteamento estável.
Não reintroduzir TanStack Start/TanStack Router no build publicado.
Usar npm run build:pages.
Gerar ZIP de dist-pages.
```
