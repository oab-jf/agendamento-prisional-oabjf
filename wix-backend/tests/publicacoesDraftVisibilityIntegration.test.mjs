import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(currentDir, '../source/http-functions.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `marcador inicial ausente: ${startMarker}`);
  assert.notEqual(end, -1, `marcador final ausente: ${endMarker}`);

  return source.slice(start, end);
}

test('fila administrativa lê drafts do plugin legado PUBLISH', () => {
  const block = sliceBetween(
    'async function carregarPublicacoesPendentesAdmin()',
    '\nfunction resolverPublicacaoPendente('
  );

  assert.match(block, /showDrafts:\s*true/);
  assert.match(block, /consistentRead:\s*true/);
  assert.equal((block.match(/\.find\(draftReadOptions\)/g) || []).length, 2);
  assert.match(block, /query\(COL\.CORRESPONDENTES\)[\s\S]*?eq\('_publishStatus', 'DRAFT'\)/);
  assert.match(block, /query\(COL\.OPORTUNIDADES\)[\s\S]*?eq\('_publishStatus', 'DRAFT'\)/);
});

test('detalhe administrativo recupera o item draft por ID', () => {
  const block = sliceBetween(
    'async function obterPublicacaoPendenteAdmin(target)',
    '\nfunction dadosRevisaoPublicacao('
  );

  assert.match(block, /wixData\.get\([\s\S]*?showDrafts:\s*true/);
  assert.match(block, /consistentRead:\s*true/);
  assert.match(block, /_publishStatus\)\.toUpperCase\(\) !== 'DRAFT'/);
});

test('arquivar e reconciliar atualizam a versão draft, não a publicada', () => {
  const block = sliceBetween(
    'async function salvarEstadoPortalPublicacao(target, item, patch)',
    '\nasync function criarTarefaPublicacaoCms('
  );

  assert.match(block, /wixData\.update\(/);
  assert.match(block, /suppressAuth:\s*true/);
  assert.match(block, /showDrafts:\s*true/);
});
