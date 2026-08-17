import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(currentDir, '../source/http-functions.js');
const source = fs.readFileSync(sourcePath, 'utf8');

test('cadastros públicos são criados como pendentes e não aceitam publicação automática', () => {
  assert.match(source, /garantirCadastroNaoPublicado\(COL\.CORRESPONDENTES, created\)/);
  assert.match(source, /garantirCadastroNaoPublicado\(COL\.OPORTUNIDADES, created\)/);
  assert.match(source, /portalStatus:\s*PUBLICACOES_PORTAL_STATUS\.PENDENTE/);
});

test('endpoints públicos consultam exclusivamente itens publicados', () => {
  assert.match(source, /query\(COL\.CORRESPONDENTES\)[\s\S]*?eq\('_publishStatus', 'PUBLISHED'\)[\s\S]*?eq\('aceiteTermos', true\)/);
  assert.match(source, /query\(COL\.OPORTUNIDADES\)[\s\S]*?eq\('_publishStatus', 'PUBLISHED'\)[\s\S]*?eq\('aceiteTermosDeUso', true\)/);
});

test('fila administrativa consulta drafts e exige permissão de formulários', () => {
  assert.match(source, /use_oabAdminPublicacoesPendentes/);
  assert.match(source, /query\(COL\.CORRESPONDENTES\)[\s\S]*?eq\('_publishStatus', 'DRAFT'\)/);
  assert.match(source, /query\(COL\.OPORTUNIDADES\)[\s\S]*?eq\('_publishStatus', 'DRAFT'\)/);
  assert.match(source, /FORMULARIOS_GESTAO_PERMISSIONS\.VER/);
});

test('aprovar usa tarefa CMS oficial de atualização de publish status', () => {
  assert.match(source, /import \{ tasks as cmsTasks \} from '@wix\/data'/);
  assert.match(source, /type:\s*'UPDATE_PUBLISH_STATUS'/);
  assert.match(source, /operation:\s*'SCHEDULE_PUBLISHED_STATUS'/);
  assert.match(source, /schedulePublishedStatusOptions:\s*\{ date: scheduledAt \}/);
  assert.match(source, /filter:\s*\{ _id: target\.id \}/);
});

test('ação de publicação exige operar e arquivamento preserva registro', () => {
  assert.match(source, /use_oabAdminPublicacaoAcao/);
  assert.match(source, /FORMULARIOS_GESTAO_PERMISSIONS\.OPERAR/);
  assert.match(source, /portalStatus:\s*PUBLICACOES_PORTAL_STATUS\.ARQUIVADO/);
  assert.doesNotMatch(source, /use_oabAdminPublicacaoAcao[\s\S]*?wixData\.remove\(/);
});

test('currículo privado só recebe URL temporária com permissão de anexos', () => {
  assert.match(source, /use_oabAdminOportunidadeCurriculo/);
  assert.match(source, /FORMULARIOS_GESTAO_PERMISSIONS\.ANEXOS/);
  assert.match(source, /mediaManager\.getDownloadUrl\(/);
  assert.match(source, /PUBLICACOES_PENDENTES_DOWNLOAD_MINUTES/);
});
