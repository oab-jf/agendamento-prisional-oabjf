# Backend Wix/Velo versionado

A base desta pasta foi capturada diretamente do editor Wix/Velo em 12/08/2026.
O commit `2bfe08c` preserva no histórico o snapshot inicial auditado.

Em 12/08/2026, `enviosListas.js` recebeu um hotfix operacional solicitado pela
OAB/JF para incluir o e-mail do advogado nas listas enviadas às unidades
prisionais e, nos reenvios retroativos dessa correção, explicitar o motivo da
atualização.

Depois, na Fase 1D da plataforma multimodal, foram publicados módulos Velo
adicionais e uma ponte de shadow read administrativo. O `adminApi.js` foi
conectado a essa ponte com a feature flag explicitamente desligada.

Na Fase 1E foi publicado um probe administrativo autenticado e explícito.
A flag global continua desligada; somente requisições com `shadowDebug=1`
executam o candidato e expõem o relatório técnico de paridade.

## Estado live relevante

- `enviosListas.js` — `7e641d56bf7991c44c37ed9be9d5febb967b475b5bd10ddb171f942f5f3f1182`
- `adminApi.js` — `a2a33e94b2da32398f42cffe3fe7b755072853286e4bbbd3f2d13785ab2a3f2a`
- `http-functions.js` — `be4033eebe3f07238901b09e861e9a7c152278a8b3f22b7d563f4455e12bd54b`
- `agendamentosAdminShadowBridge.js` — `c371ae3de951eab4e2876db49d1057be0136051e59a92a0f2c12071cd8a148c7`
- `agendamentosCore.js` — `6e20b984bcf0902c30cdfc029c4f789a5f06cbcfb6c47407446875487f32adf6`
- `agendamentosRepository.js` — `196014ba05213f8690d17bc3f9a4ed0357796d62caca0ee8a38accbacbbe0a52`
- `agendamentosRepositoryWix.js` — `c336ad6ee49869984899b922c156ef7d74cf04d40548572f1a68b19e02fa7629`
- `agendamentosShadowRead.js` — `c705d34da78693e4d2b13e8de0925feec0a6c412b041af092e1f81e898c363ec`
- `agendamentosShadowReadWix.js` — `fa288aa25802a899cc7af3e54bab34fdba28796543c1ffae831f5711c2268a51`

O shadow read administrativo global permanece `OFF`. A listagem oficial
continua sendo produzida pelo fluxo legado de `adminApi.js`. O candidato
somente executa quando um administrador chama explicitamente o probe
`shadowDebug=1`.

Os demais arquivos pré-existentes permanecem iguais à captura-base, salvo
quando um manifesto posterior registrar explicitamente outra alteração.

Não copie estes arquivos de volta ao Wix sem um pacote de publicação auditado.
O Git deve preservar tanto a captura-base quanto cada evolução do estado live.

## Evidência de paridade — 13/08/2026

O probe controlado foi executado sobre a base live e registrou 14 casos:
13 comparações concluídas com paridade, 0 divergências, 0 erros e 1 caso
ignorado por busca textual ainda não suportada no comparador. O contrato
normal permaneceu com 15 itens antes e depois, sem expor `shadowRead`.

Consulte `../MANIFESTO-LIVE-2026-08-13.md` e
`../../docs/diagnosticos/2026-08-13-shadow-read-controlado.md`.
