import assert from "node:assert/strict";
import test from "node:test";
import { createAppointmentCatalogRepository } from "../domain/agendamentosConfiguracaoRepository.js";

function fake(initial = null) {
  let stored = initial;
  const calls = [];
  return {
    calls,
    async get() { if (!stored) { const e = new Error("Item not found"); e.code = "WDE0073"; throw e; } return structuredClone(stored); },
    async insert(_collection, item) { calls.push("insert"); stored = { ...structuredClone(item), _revision: "1" }; return structuredClone(stored); },
    async update(_collection, item) { calls.push("update"); stored = { ...structuredClone(item), _revision: "2" }; return structuredClone(stored); },
  };
}

test("bootstrap cria registro único", async () => {
  const wixData = fake();
  const repo = createAppointmentCatalogRepository({ wixData });
  const result = await repo.getAdminCatalog();
  assert.equal(result.seeded, true);
  assert.equal(result.catalog.modalities.length, 4);
  assert.deepEqual(wixData.calls, ["insert"]);
});

test("salvar incrementa revisão", async () => {
  const wixData = fake();
  const repo = createAppointmentCatalogRepository({ wixData });
  const first = await repo.getAdminCatalog();
  const saved = await repo.saveAdminCatalog({ catalog: first.catalog, expectedRevision: 1, updatedBy: "admin" });
  assert.equal(saved.catalog.revision, 2);
});

test("coleção ausente gera erro específico", async () => {
  const wixData = { async get() { const e = new Error("Collection not found"); e.code = "WDE0025"; throw e; }, async insert() {}, async update() {} };
  await assert.rejects(createAppointmentCatalogRepository({ wixData }).getAdminCatalog(), (error) => error.code === "CATALOGO_COLECAO_AUSENTE");
});
