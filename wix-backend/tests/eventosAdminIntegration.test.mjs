import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const adminApi = fs.readFileSync(path.join(root, 'source/adminApi.js'), 'utf8');
const httpFunctions = fs.readFileSync(path.join(root, 'source/http-functions.js'), 'utf8');

test('permissões do Portal incluem leitura e financeiro de eventos', () => {
  assert.match(adminApi, /EVENTOS_VER:\s*'eventos\.ver'/);
  assert.match(adminApi, /EVENTOS_FINANCEIRO:\s*'eventos\.financeiro'/);
  assert.match(adminApi, /ADMIN_PERMISSIONS_SCHEMA_VERSION\s*=\s*4/);
  assert.match(adminApi, /version < 4/);
});

test('financeiro de eventos usa o resumo oficial de pedidos do Wix Events', () => {
  assert.match(adminApi, /import \{ orders \} from 'wix-events\.v2'/);
  assert.match(adminApi, /elevate\(orders\.getSummary\)/);
  assert.match(adminApi, /salesRevenueDifference/);
  assert.match(adminApi, /totalOrders/);
  assert.match(adminApi, /totalTickets/);
});

test('endpoint administrativo de eventos usa a sessão unificada do Portal', () => {
  assert.match(httpFunctions, /export async function use_oabAdminEventos/);
  assert.match(httpFunctions, /listarEventosAdminApi/);
  assert.match(httpFunctions, /getAdminTokenFromRequest\(request\)/);
});


test('filtros de Eventos são aplicados em memória sem consultar type na app collection', () => {
  assert.match(adminApi, /listarEventosAdminRaw/);
  assert.match(adminApi, /eventoAdminMatchesFiltros/);
  assert.doesNotMatch(adminApi, /query\.eq\('type'/);
});

test('resumo executivo usa o universo filtrado inteiro e não apenas a página', () => {
  assert.match(adminApi, /const filtrados = rawItems\.filter/);
  assert.match(adminApi, /agregarResumoFinanceiroEventos/);
  assert.match(adminApi, /resumo:\s*\{/);
  assert.match(adminApi, /eventos:\s*total/);
});
