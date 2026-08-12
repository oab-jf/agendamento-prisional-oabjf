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

## Estado live relevante

- `enviosListas.js` — `7e641d56bf7991c44c37ed9be9d5febb967b475b5bd10ddb171f942f5f3f1182`
- `adminApi.js` — `0a96333d2b80c0c9520569c62451a775e0708ca72bf1dcd74e44800e62dc30e4`
- `agendamentosAdminShadowBridge.js` — `c371ae3de951eab4e2876db49d1057be0136051e59a92a0f2c12071cd8a148c7`
- `agendamentosCore.js` — `6e20b984bcf0902c30cdfc029c4f789a5f06cbcfb6c47407446875487f32adf6`
- `agendamentosRepository.js` — `196014ba05213f8690d17bc3f9a4ed0357796d62caca0ee8a38accbacbbe0a52`
- `agendamentosRepositoryWix.js` — `c336ad6ee49869984899b922c156ef7d74cf04d40548572f1a68b19e02fa7629`
- `agendamentosShadowRead.js` — `c705d34da78693e4d2b13e8de0925feec0a6c412b041af092e1f81e898c363ec`
- `agendamentosShadowReadWix.js` — `fa288aa25802a899cc7af3e54bab34fdba28796543c1ffae831f5711c2268a51`

O shadow read administrativo permanece `OFF`. A listagem oficial continua
sendo produzida pelo fluxo legado de `adminApi.js`.

Os demais arquivos pré-existentes permanecem iguais à captura-base, salvo
quando um manifesto posterior registrar explicitamente outra alteração.

Não copie estes arquivos de volta ao Wix sem um pacote de publicação auditado.
O Git deve preservar tanto a captura-base quanto cada evolução do estado live.
