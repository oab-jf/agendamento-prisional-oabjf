import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminApi = await readFile(new URL('../source/adminApi.js', import.meta.url), 'utf8');

test('site editor v0.2 conecta PaginasInstitucionais', () => {
  assert.match(adminApi, /PAGINAS_INSTITUCIONAIS:\s*'PaginasInstitucionais'/);
  assert.match(adminApi, /mapInstitutionalSiteEditorDocument/);
  assert.match(adminApi, /listarPaginasInstitucionaisSiteEditor/);
});

test('site editor v0.2 salva institucionais com revisão', () => {
  assert.match(adminApi, /salvarPaginaInstitucionalSiteEditor/);
  assert.match(adminApi, /CONFLITO_REVISAO/);
  assert.match(adminApi, /PaginasInstitucionais/);
});

test('site editor v0.2 mantém imagens somente leitura', () => {
  assert.match(adminApi, /kind: 'richtext'/);
  assert.match(adminApi, /readOnly: true/);
  assert.match(adminApi, /mediaUpload: true/);
});
