import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../source/http-functions.js', import.meta.url),
  'utf8'
);

function blocoEventosPublicos() {
  const start = source.indexOf(
    '// Site público — agenda completa de Eventos'
  );
  const end = source.indexOf(
    '/**\n * GET /_functions/oabHome'
  );

  assert.notEqual(
    start,
    -1,
    'marcador do endpoint público de Eventos não encontrado'
  );
  assert.notEqual(
    end,
    -1,
    'endpoint oabHome não encontrado após Eventos público'
  );

  return source.slice(start, end);
}

test('agenda pública de Eventos usa a app collection oficial e contrato aditivo', () => {
  const block = blocoEventosPublicos();

  assert.match(block, /wixData\s*\n?\s*\.query\(COL\.EVENTS\)/);
  assert.match(block, /export async function use_oabEventosPublicos\(request\)/);
  assert.match(block, /registrationType/);
  assert.match(block, /registrationStatus/);
  assert.match(block, /lowestPriceFormatted/);
  assert.match(block, /highestPriceFormatted/);
  assert.match(block, /siteEventPageUrl/);
  assert.match(block, /registrationURL/);
  assert.match(block, /locationAddress/);
  assert.match(block, /TESTE INTERNO/);

  assert.doesNotMatch(
    block,
    /\.eq\(\s*['"]type['"]/,
    'a app collection de Eventos não deve ser filtrada por type'
  );
});

test('agenda pública exclui cancelados e preserva histórico + próximos', () => {
  const block = blocoEventosPublicos();

  assert.match(block, /status !== 'CANCELED'/);
  assert.match(block, /upcomingCount/);
  assert.match(block, /pastCount/);
  assert.match(block, /items: \[\.\.\.upcoming, \.\.\.past\]/);
  assert.match(block, /Cache-Control/);
});
