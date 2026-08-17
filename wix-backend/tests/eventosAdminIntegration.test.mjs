import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const adminApi = fs.readFileSync(path.join(root, 'source/adminApi.js'), 'utf8');
const httpFunctions = fs.readFileSync(path.join(root, 'source/http-functions.js'), 'utf8');

test('RBAC de Eventos separa leitura, financeiro, presença e certificados', () => {
  assert.match(adminApi, /EVENTOS_VER:\s*'eventos\.ver'/);
  assert.match(adminApi, /EVENTOS_FINANCEIRO:\s*'eventos\.financeiro'/);
  assert.match(adminApi, /EVENTOS_PRESENCA:\s*'eventos\.presenca'/);
  assert.match(adminApi, /EVENTOS_CERTIFICADOS:\s*'eventos\.certificados'/);
  assert.match(adminApi, /ADMIN_PERMISSIONS_SCHEMA_VERSION\s*=\s*6/);
  assert.match(adminApi, /version < 5/);
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


test('operação de participantes reutiliza a sessão principal do Portal', () => {
  assert.match(httpFunctions, /export async function use_oabAdminEventoOperacao/);
  assert.match(httpFunctions, /validarAcessoAdminEventosOperacao/);
  assert.match(httpFunctions, /const resultado = await meAdminApi\(token\)/);
  assert.match(httpFunctions, /getEventoCertificados\(eventId\)/);
});

test('presença do Portal delega o contrato real de salvarPresenca com changes[]', () => {
  assert.match(httpFunctions, /export async function use_oabAdminEventoPresenca/);
  assert.match(httpFunctions, /EVENTOS_OPERACAO_PERMISSIONS\.PRESENCA/);
  assert.match(httpFunctions, /const rsvpId = text\(payload\.rsvpId\)/);
  assert.match(httpFunctions, /const rsvpGuestId = Number\(payload\.rsvpGuestId\)/);
  assert.match(httpFunctions, /const presencaChange = \{/);
  assert.match(httpFunctions, /guestId,/);
  assert.match(httpFunctions, /compareceu,/);
  assert.match(httpFunctions, /const presencaPayload = \{\s*eventId,\s*changes: \[presencaChange\],\s*actionOrigin: 'event_individual',/);
  assert.match(httpFunctions, /salvarPresenca\(\s*presencaPayload,/);
  assert.doesNotMatch(httpFunctions, /presente: compareceu/);
});

test('emissão do Portal delega ao emissor existente e exige permissão própria', () => {
  assert.match(httpFunctions, /export async function use_oabAdminEventoCertificado/);
  assert.match(httpFunctions, /EVENTOS_OPERACAO_PERMISSIONS\.CERTIFICADOS/);
  assert.match(httpFunctions, /emitirCertificado\(\{/);
  assert.match(httpFunctions, /eventId,/);
  assert.match(httpFunctions, /guestId,/);
});

test('relatório financeiro completo usa pedidos confirmados com detalhes e invoice', () => {
  assert.match(adminApi, /elevate\(orders\.listOrders\)/);
  assert.match(adminApi, /fieldset:\s*\['DETAILS', 'INVOICE'\]/);
  assert.match(adminApi, /tag:\s*\['CONFIRMED'\]/);
  assert.match(adminApi, /obterRelatorioFinanceiroEventoAdminApi/);
  assert.match(adminApi, /agregarTiposIngressosFinanceiros/);
  assert.match(adminApi, /agregarTotaisPedidosFinanceiros/);
});

test('endpoint do relatório financeiro exige a sessão administrativa do Portal', () => {
  assert.match(httpFunctions, /export async function use_oabAdminEventoFinanceiroRelatorio/);
  assert.match(httpFunctions, /obterRelatorioFinanceiroEventoAdminApi/);
  assert.match(httpFunctions, /getAdminTokenFromRequest\(request\)/);
});
