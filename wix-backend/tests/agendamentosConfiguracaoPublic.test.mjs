import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const apiClient = fs.readFileSync(
  new URL("../../src/lib/oab-api.ts", import.meta.url),
  "utf8",
);
const home = fs.readFileSync(
  new URL("../../src/routes/index.tsx", import.meta.url),
  "utf8",
);

test("cliente público consulta o catálogo configurável", () => {
  assert.match(apiClient, /export async function listarCatalogoAgendamentos/);
  assert.match(apiClient, /oabAgendamentoCatalogo/);
});

test("home pública usa catálogo e mantém fallback prisional", () => {
  assert.match(home, /listarCatalogoAgendamentos/);
  assert.match(home, /FALLBACK_CATALOG/);
  assert.match(home, /Atendimento Prisional/);
});

test("home pública não lista modalidades futuras de forma estática", () => {
  assert.doesNotMatch(home, /Salas de Apoio/);
  assert.doesNotMatch(home, /Escritórios Compartilhados/);
  assert.doesNotMatch(home, /Suporte PJe/);
});
