# 00 — Visão geral

## O que é

A Central de Agendamento Prisional é uma aplicação web para a OAB/MG — 4ª Subseção de Juiz de Fora. Ela atende dois grandes públicos:

- advocacia, nos fluxos públicos de agendamento, consulta/remarcação/cancelamento e envio de documentos;
- equipe administrativa da OAB, no painel com agendamentos, documentos, unidades, bloqueios e usuários.

## Domínios e responsabilidades

- **Frontend público/admin**: SPA estática publicada no Cloudflare Pages.
- **Domínio da Central**: `central.juizdefora-oabmg.org.br`.
- **Backend/CMS/e-mails/uploads**: Wix/Velo do site `https://www.juizdefora-oabmg.org.br`.
- **Base dos endpoints no frontend**: `https://www.juizdefora-oabmg.org.br/_functions`.

## Stack do frontend

- React 19
- Vite 7
- Tailwind CSS v4
- shadcn/ui
- Sonner para toasts
- TanStack Start/TanStack Router apenas no ambiente de preview/dev
- Runtime estático próprio para Cloudflare Pages

## Módulos principais

Fluxos públicos:

- agendamento prisional;
- envio de documentos/procurações;
- consulta de agendamento por protocolo + e-mail;
- cancelamento pelo usuário;
- remarcação pelo usuário;
- conclusão de cadastro por convite administrativo.

Painel administrativo:

- Agendamentos;
- Documentos;
- Unidades;
- Bloqueios;
- Usuários.

## Estado atual importante

A criação de usuários administrativos ocorre por **convite**:

1. um admin informa e-mail e permissões;
2. o usuário recebe o link por e-mail;
3. conclui o cadastro com nome completo, CPF e senha;
4. faz login;
5. confirma código recebido por e-mail;
6. acessa o painel.

O CPF nunca deve ser salvo ou exibido em claro. O backend armazena somente hash.
