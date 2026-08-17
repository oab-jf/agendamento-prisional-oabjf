import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../source/http-functions.js', import.meta.url),
  'utf8'
);

function functionBlock(name, nextMarker) {
  const start = source.indexOf(name);
  assert.notEqual(start, -1, `marcador ausente: ${name}`);

  const end = nextMarker
    ? source.indexOf(nextMarker, start + name.length)
    : source.length;

  assert.notEqual(end, -1, `marcador final ausente: ${nextMarker}`);
  return source.slice(start, end);
}

test('Notícias públicas usam Wix Blog e não a coleção News do Espaço Estágio, Emprego e Oportunidades', () => {
  assert.match(source, /BLOG_POSTS:\s*'Blog\/Posts'/);
  assert.match(source, /OPORTUNIDADES:\s*'News'/);

  const block = functionBlock(
    'async function carregarNoticiasPublicas',
    '/**\n * GET /_functions/oabNoticias'
  );

  assert.match(block, /\.query\(COL\.BLOG_POSTS\)/);
  assert.doesNotMatch(block, /COL\.OPORTUNIDADES/);
  assert.match(block, /\.eq\('language', 'pt'\)/);
  assert.match(block, /\.descending\('publishedDate'\)/);
  assert.match(block, /\.skip\(offset\)/);
  assert.match(block, /\.limit\(limit\)/);
});

test('conteúdo integral usa wix-blog-backend com fieldset RICH_CONTENT', () => {
  assert.match(source, /import \{ posts \} from 'wix-blog-backend'/);

  const loader = functionBlock(
    'async function carregarNoticiasConteudoPublico',
    '/**\n * GET /_functions/oabNoticias'
  );

  assert.match(loader, /posts\s*\.queryPosts\(\{ fieldsets \}\)/);
  assert.match(loader, /'RICH_CONTENT'/);
  assert.match(loader, /'CONTENT_TEXT'/);
  assert.match(loader, /'URL'/);
  assert.match(loader, /\.eq\('language', 'pt'\)/);
  assert.match(loader, /\.descending\('firstPublishedDate'\)/);
  assert.match(loader, /\.skipTo\(cursor\)/);
  assert.match(loader, /posts\.getTotalPosts\(\{ language: 'pt' \}\)/);
});

test('endpoint de conteúdo integral é cursor-based e retorna o corpo do post', () => {
  const block = functionBlock(
    'export async function use_oabNoticiasConteudo',
    'async function carregarEventosHome'
  );

  assert.match(block, /getQueryParam\(request, 'cursor'\)/);
  assert.match(block, /getQueryParam\(request, 'limit'\)/);
  assert.match(block, /nextCursor:/);
  assert.match(block, /hasMore:/);
  assert.match(block, /items: result\.items/);

  const mapper = functionBlock(
    'function mapNoticiaPublicaBlogApi',
    'async function carregarNoticiasConteudoPublico'
  );

  assert.match(mapper, /contentText: text\(item\.contentText\)/);
  assert.match(mapper, /richContent:/);
  assert.match(mapper, /firstPublishedDate/);
  assert.match(mapper, /media\.displayed === false/);
});

test('Home e listagem leve continuam usando Blog/Posts sem usar News', () => {
  const homeLoader = functionBlock(
    'async function carregarNoticiasHome',
    'function noticiasPublicasNumero'
  );
  const publicLoader = functionBlock(
    'async function carregarNoticiasPublicas',
    '/**\n * GET /_functions/oabNoticias'
  );

  assert.match(homeLoader, /\.query\(COL\.BLOG_POSTS\)/);
  assert.match(publicLoader, /\.query\(COL\.BLOG_POSTS\)/);
  assert.doesNotMatch(homeLoader, /COL\.OPORTUNIDADES/);
  assert.doesNotMatch(publicLoader, /COL\.OPORTUNIDADES/);
});
