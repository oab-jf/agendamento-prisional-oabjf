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

test('site editor adiciona permissões editoriais dedicadas', () => {
  assert.match(adminApi, /SITE_CONTEUDO_VER:\s*'site\.conteudo\.ver'/);
  assert.match(adminApi, /SITE_CONTEUDO_EDITAR:\s*'site\.conteudo\.editar'/);
  assert.match(adminApi, /ADMIN_PERMISSIONS_SCHEMA_VERSION\s*=\s*6/);
  assert.match(adminApi, /grupo:\s*'Conteúdo do site'/);
});

test('site editor usa DestaquesHome como fonte real da Home', () => {
  assert.match(adminApi, /DESTAQUES_HOME:\s*'DestaquesHome'/);
  assert.match(adminApi, /export async function obterConteudoSiteAdminApi/);
  assert.match(adminApi, /export async function salvarConteudoSiteAdminApi/);
  assert.match(adminApi, /CONFLITO_REVISAO/);
  assert.match(adminApi, /site\.conteudo\.salvar/);
});

test('endpoint administrativo expõe leitura e save do conteúdo', () => {
  assert.match(httpFunctions, /obterConteudoSiteAdminApi/);
  assert.match(httpFunctions, /salvarConteudoSiteAdminApi/);
  assert.match(httpFunctions, /export async function use_oabAdminSiteConteudo/);
  assert.match(httpFunctions, /getAdminTokenFromRequest\(request\)/);
});
