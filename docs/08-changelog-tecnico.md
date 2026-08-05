# 08 — Changelog técnico resumido

## v26

- Fluxo de convites administrativos.
- Rota `/admin/convite?token=...`.
- Normalização da resposta `body.convite || body` para convite.
- Exibição de expiração em horário de Brasília.
- Aba Usuários sem coluna Segurança na listagem.
- Segurança movida para edição do usuário.
- CPF nunca exibido; apenas status “CPF cadastrado/pendente”.
- Login admin com código por e-mail e troca obrigatória de senha.
- Unidades e Bloqueios no painel.
- Bloqueios impactando disponibilidade pública.
- Mobile das abas admin com seletor de área.

## Decisões arquiteturais importantes

- A Central roda fora do Wix como SPA estática no Cloudflare Pages.
- O Wix continua como backend/CMS/e-mails/uploads.
- O build publicado não usa TanStack Start/TanStack Router real.
- Usuários admin são criados por convite, não por senha temporária cadastrada pelo admin.
- CPF é tratado como dado sensível e salvo apenas como hash.
- Bloqueios são uma aba própria, separada de Unidades.

## Próximas frentes prováveis

- Envio diário das listas de atendimentos para as unidades.
- Tela/aba de configuração de envios.
- Logs administrativos mais visíveis.
- Migração gradual de usuário legacy para permissões explícitas.
