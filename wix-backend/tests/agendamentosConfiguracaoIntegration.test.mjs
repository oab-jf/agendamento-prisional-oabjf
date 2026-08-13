import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adminApi = fs.readFileSync(
  new URL("../source/adminApi.js", import.meta.url),
  "utf8",
);
const httpFunctions = fs.readFileSync(
  new URL("../source/http-functions.js", import.meta.url),
  "utf8",
);
const store = fs.readFileSync(
  new URL("../source/agendamentosConfiguracaoStore.js", import.meta.url),
  "utf8",
);

test("catálogo configurável entra no RBAC versão 3", () => {
  assert.match(adminApi, /AGENDAMENTOS_CONFIGURAR:\s*'agendamentos\.configurar'/);
  assert.match(adminApi, /ADMIN_PERMISSIONS_SCHEMA_VERSION\s*=\s*3/);
  assert.match(adminApi, /Configurar modalidades, locais, recursos e ofertas/);
});

test("adminApi conecta store e preserva shadow read automático", () => {
  assert.match(adminApi, /from 'backend\/agendamentosConfiguracaoStore'/);
  assert.match(adminApi, /AGENDAMENTOS_SHADOW_READ_ENABLED\s*=\s*true/);
  assert.match(adminApi, /export async function obterCatalogoAgendamentosAdminApi/);
  assert.match(adminApi, /export async function salvarCatalogoAgendamentosAdminApi/);
});

test("endpoint público expõe apenas a projeção preparada pelo domínio", () => {
  assert.match(adminApi, /export async function obterCatalogoAgendamentosPublicoApi/);
  assert.match(httpFunctions, /export async function use_oabAgendamentoCatalogo/);
  assert.match(store, /obterCatalogoAgendamentosPublicoCore/);
});

test("endpoint administrativo aceita leitura e escrita no mesmo recurso", () => {
  assert.match(httpFunctions, /export async function use_oabAdminAgendamentoCatalogo/);
  assert.match(httpFunctions, /obterCatalogoAgendamentosAdminApi\(token\)/);
  assert.match(httpFunctions, /salvarCatalogoAgendamentosAdminApi\(payload, token\)/);
});

test("dependência de configuração também concede leitura da agenda", () => {
  assert.match(
    adminApi,
    /next\.has\(ADMIN_PERMISSIONS\.AGENDAMENTOS_CONFIGURAR\)[\s\S]*?next\.add\(ADMIN_PERMISSIONS\.AGENDAMENTOS_VER\)/,
  );
});
