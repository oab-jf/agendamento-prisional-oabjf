# OAB/JF — Manifesto do backend live — 12/08/2026

## Captura-base

Portal de Gestão: `plataforma-agendamentos-multimodalidade` @ `1be2101`
Central pública: `main` @ `36ced20`

Hashes da captura inicial:

- `adminApi.js` — `6f9dc699350d8bea0e40abaaad597d7c2f59619b1fd9a47b350e80d01d5f67eb`
- `http-functions.js` — `586f923297b0687d3252e94fa71d0a79e8326510884196bc43bade53fefb995c`
- `disponibilidade.jsw` — `59a1fe90a34247885c3c4be467e8ee0143b7bb0ac4bf838f2f86f00f2b27140c`
- `documentos.jsw` — `3c6af7f0a147b2448b1098ba513668aa4363f1910c60c8ffd5eb35ef251e0821`
- `enviosListas.js` — `acdce038a2cf452321edbddd246177390e8b8768938e4a8aaaaea7a7a3bcd654`
- `agendamentos.jsw` — `cd1faa64ba580ca4285f5e17b9e471646c34fe763740442c14bc76d0f5b9620a`
- `painelAdmin.jsw` — `da2a55d573606b8ce260201958e92f531870863cfacd0edb6ff14229254d71bb`
- `jobs.config` — `eca1a0e47939dc8adefeff267602ba6f3fb228db6492a0c68dd79b4bdd6f1318`

O commit `2bfe08c` preserva essa captura inicial no histórico Git.

## Atualização operacional — e-mail do advogado nas listas

Em 12/08/2026, a OAB/JF informou que a lista diária enviada às unidades
prisionais precisa trazer o e-mail do advogado para que a unidade possa enviar
o link de acesso ao atendimento.

A atualização foi aplicada em duas etapas:

1. v0.1 — inclusão do e-mail na versão HTML e texto da lista, alerta para
   registros sem e-mail válido e inclusão do e-mail no hash de conteúdo.
   SHA-256: `7d73c2f16a15f65d7a831e6e862496acef60ed1b29548cad22e8e807a6ba0fe1`
2. v0.2 — reenvio retroativo com contexto explícito, usando o motivo controlado
   `incluir_emails_advogados`.
   SHA-256: `7e641d56bf7991c44c37ed9be9d5febb967b475b5bd10ddb171f942f5f3f1182`

O assunto contextual da v0.2 é:

`Lista atualizada com e-mails para envio dos links — [Unidade] — [Data]`

O corpo informa que a mensagem substitui a lista anterior e que o reenvio ocorre
para incluir os e-mails necessários ao envio dos links de acesso.

## Homologação operacional

- envio de teste confirmado com o e-mail do advogado;
- reenvio retroativo do Anexo Feminino Eliane Betti concluído em 12/08/2026;
- 2 agendamentos atuais, 2 com e-mail válido e 0 sem e-mail;
- Penitenciária José Edson Cavalieri não foi reenviada porque não havia
  agendamentos atuais.

## Estado live versionado após o hotfix

Todos os arquivos permanecem iguais à captura-base, exceto:

- `enviosListas.js` — `7e641d56bf7991c44c37ed9be9d5febb967b475b5bd10ddb171f942f5f3f1182`

A pasta `wix-backend/source/` deve acompanhar o estado live auditado. O histórico
Git preserva os snapshots anteriores.
