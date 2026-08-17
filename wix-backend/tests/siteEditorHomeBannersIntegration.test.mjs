import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminApi = await readFile(
  new URL('../source/adminApi.js', import.meta.url),
  'utf8',
);
const httpFunctions = await readFile(
  new URL('../source/http-functions.js', import.meta.url),
  'utf8',
);

test('Home banners habilitam upload real pelo Media Manager com permissão editorial', () => {
  assert.match(adminApi, /import \{ mediaManager \} from 'wix-media-backend'/);
  assert.match(adminApi, /mediaManager\.getUploadUrl\(/);
  assert.match(adminApi, /prepararUploadImagemSiteAdminApi/);
  assert.match(adminApi, /image\/jpeg/);
  assert.match(adminApi, /SITE_EDITOR_IMAGE_MAX_BYTES\s*=\s*8 \* 1024 \* 1024/);
});

test('Home banners podem ser criados inativos, reordenados e excluídos com segurança', () => {
  assert.match(adminApi, /HOME_BANNERS_MAX_ACTIVE\s*=\s*5/);
  assert.match(adminApi, /criarBannerHomeSiteAdminApi/);
  assert.match(adminApi, /ativo:\s*false/);
  assert.match(adminApi, /reordenarBannerHomeSiteAdminApi/);
  assert.match(adminApi, /excluirBannerHomeSiteAdminApi/);
  assert.match(adminApi, /Desative e salve o banner antes de excluí-lo/);
});

test('save da Home persiste imagens e status ativo com limite de cinco banners', () => {
  assert.match(adminApi, /imagemDesktop:\s*text\(desktopImage\?\.url\)/);
  assert.match(adminApi, /imagemMobile:\s*text\(mobileImage\?\.url\)/);
  assert.match(adminApi, /ativo:\s*nextActive/);
  assert.match(adminApi, /LIMITE_BANNERS_ATIVOS/);
});

test('oabHome mantém banner legado e adiciona banners para o novo rotator', () => {
  assert.match(httpFunctions, /async function carregarDestaquesHome\(\)/);
  assert.match(httpFunctions, /\.slice\(0, 5\)/);
  assert.match(httpFunctions, /const banner = banners\[0\] \|\| null/);
  assert.match(httpFunctions, /banner,\s*\n\s*banners,\s*\n\s*news,/);
  assert.match(httpFunctions, /version:\s*1/);
});

test('endpoint administrativo despacha ações de banner sem criar endpoint paralelo', () => {
  assert.match(httpFunctions, /action === 'prepareImageUpload'/);
  assert.match(httpFunctions, /action === 'createHomeBanner'/);
  assert.match(httpFunctions, /action === 'deleteHomeBanner'/);
  assert.match(httpFunctions, /action === 'reorderHomeBanner'/);
  assert.match(httpFunctions, /use_oabAdminSiteConteudo/);
});
