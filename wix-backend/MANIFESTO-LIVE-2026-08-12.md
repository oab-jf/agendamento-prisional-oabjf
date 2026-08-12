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

Em 12/08/2026, a lista diária foi atualizada para incluir o e-mail do advogado
destinado ao envio do link pela unidade prisional.

Estado live homologado:

- `enviosListas.js` — `7e641d56bf7991c44c37ed9be9d5febb967b475b5bd10ddb171f942f5f3f1182`

## Plataforma multimodal — Fase 1D

### Camada 1 — módulos inertes

Foram publicados no Backend do Wix, sem import por endpoints existentes:

- `agendamentosCore.js` — `6e20b984bcf0902c30cdfc029c4f789a5f06cbcfb6c47407446875487f32adf6`
- `agendamentosRepository.js` — `196014ba05213f8690d17bc3f9a4ed0357796d62caca0ee8a38accbacbbe0a52`
- `agendamentosRepositoryWix.js` — `c336ad6ee49869984899b922c156ef7d74cf04d40548572f1a68b19e02fa7629`
- `agendamentosShadowRead.js` — `c705d34da78693e4d2b13e8de0925feec0a6c412b041af092e1f81e898c363ec`
- `agendamentosShadowReadWix.js` — `fa288aa25802a899cc7af3e54bab34fdba28796543c1ffae831f5711c2268a51`

A publicação foi concluída sem erro.

### Camada 2 — integração administrativa com flag OFF

Foi adicionado:

- `agendamentosAdminShadowBridge.js` — `c371ae3de951eab4e2876db49d1057be0136051e59a92a0f2c12071cd8a148c7`

E `adminApi.js` passou ao estado:

- `adminApi.js` — `0a96333d2b80c0c9520569c62451a775e0708ca72bf1dcd74e44800e62dc30e4`

A integração mantém:

`AGENDAMENTOS_SHADOW_READ_ENABLED = false`

Portanto:

- a resposta oficial da listagem administrativa continua sendo a implementação
  legada;
- o repositório candidato não executa query quando a flag está desligada;
- nenhum endpoint HTTP foi alterado;
- nenhuma coleção ou índice foi alterado;
- nenhuma gravação schema v2 foi ativada.

### Smoke test live

Após publicação:

- login administrativo: confirmado;
- listagem de agendamentos: `total=15`, `itens=15`;
- contrato administrativo vigente: preservado;
- shadow read: `OFF`.

## Estado live versionado

A pasta `wix-backend/source/` deve acompanhar o estado efetivamente publicado no
Wix. `adminApi.js` e `agendamentosAdminShadowBridge.js` são recapturados do live
antes do checkpoint desta fase; os cinco módulos da Camada 1 são versionados a
partir do payload exato que foi publicado.

O histórico Git preserva os estados anteriores.
