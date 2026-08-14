import assert from "node:assert/strict";
import test from "node:test";
import {
  AVAILABILITY_MODE,
  CATALOG_STATUS,
  buildPublicAppointmentCatalog,
  createDefaultAppointmentCatalog,
  evaluateModalityReadiness,
  prepareAppointmentCatalogForSave,
} from "../domain/agendamentosConfiguracao.js";

test("sementes: somente prisional ativo e demais em rascunho", () => {
  const catalog = createDefaultAppointmentCatalog();
  assert.equal(catalog.modalities.length, 4);
  assert.deepEqual(catalog.modalities.filter((x) => x.status === CATALOG_STATUS.ACTIVE).map((x) => x.id), ["prisional_virtual"]);
});

test("projeção pública esconde rascunhos", () => {
  const result = buildPublicAppointmentCatalog(createDefaultAppointmentCatalog());
  assert.equal(result.modalities.length, 1);
  assert.equal(result.modalities[0].id, "prisional_virtual");
});

test("cadastros protegidos são preservados", () => {
  const current = createDefaultAppointmentCatalog();
  const next = structuredClone(current);
  next.modalities = next.modalities.filter((x) => x.id !== "prisional_virtual");
  next.offers[0].status = "pausado";
  const saved = prepareAppointmentCatalogForSave(next, { currentValue: current, expectedRevision: 1 });
  assert.equal(saved.modalities[0].id, "prisional_virtual");
  assert.equal(saved.offers[0].status, "ativo");
});

test("revisão otimista bloqueia sobrescrita", () => {
  const current = createDefaultAppointmentCatalog();
  assert.throws(() => prepareAppointmentCatalogForSave(current, { currentValue: current, expectedRevision: 4 }), (error) => error.code === "CATALOGO_REVISAO_DIVERGENTE");
});

test("rascunho pode permanecer incompleto", () => {
  const current = createDefaultAppointmentCatalog();
  const next = structuredClone(current);
  next.modalities.find((x) => x.id === "espaco_atendimento").description = "Texto da OAB.";
  const saved = prepareAppointmentCatalogForSave(next, { currentValue: current, expectedRevision: 1 });
  assert.equal(saved.revision, 2);
});

test("ativação exige oferta completa", () => {
  const current = createDefaultAppointmentCatalog();
  const next = structuredClone(current);
  next.modalities.find((x) => x.id === "espaco_atendimento").status = "ativo";
  assert.throws(() => prepareAppointmentCatalogForSave(next, { currentValue: current, expectedRevision: 1 }), (error) => error.code === "MODALIDADE_NAO_PRONTA");
});

test("modalidade fica pronta com local, recurso, oferta e grade", () => {
  const current = createDefaultAppointmentCatalog();
  const next = structuredClone(current);
  next.locations.push({ id: "sede-oab", name: "Sede OAB/JF", address: "Juiz de Fora", kind: "physical", status: "ativo" });
  next.resources.push({ id: "sala-01", locationId: "sede-oab", name: "Sala 01", kind: "room", capacity: 1, status: "ativo" });
  next.offers.push({ id: "sala-apoio-01", modalityId: "espaco_atendimento", locationId: "sede-oab", resourceId: "sala-01", name: "Sala de Apoio 01", description: "Reserva", status: "ativo", durationMinutes: 60, capacity: 1, bookingPath: "/agendar/servico?oferta=sala-apoio-01", availabilityMode: AVAILABILITY_MODE.WEEKLY, weeklySchedule: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }] });
  next.modalities.find((x) => x.id === "espaco_atendimento").status = "ativo";
  const saved = prepareAppointmentCatalogForSave(next, { currentValue: current, expectedRevision: 1 });
  assert.equal(evaluateModalityReadiness(saved, "espaco_atendimento").ready, true);
});

test("schema v2 adiciona recursos e comodidades sem quebrar catálogo legado", () => {
  const current = createDefaultAppointmentCatalog();
  const legacy = structuredClone(current);
  delete legacy.amenities;
  legacy.schemaVersion = 1;
  legacy.resources = legacy.resources.map(({ amenityIds, ...resource }) => resource);
  const saved = prepareAppointmentCatalogForSave(legacy, {
    currentValue: current,
    expectedRevision: 1,
  });
  assert.equal(saved.schemaVersion, 2);
  assert.deepEqual(saved.amenities, []);
  assert.deepEqual(saved.resources[0].amenityIds, []);
});

test("item agendável pode referenciar comodidades reutilizáveis", () => {
  const current = createDefaultAppointmentCatalog();
  const next = structuredClone(current);
  next.amenities.push({ id: "tv", name: "TV", category: "Equipamento", active: true, order: 10 });
  next.locations.push({ id: "sede-oab", name: "Sede OAB/JF", address: "Juiz de Fora", kind: "physical", status: "ativo" });
  next.resources.push({ id: "sala-tv", locationId: "sede-oab", name: "Sala com TV", kind: "room", capacity: 1, amenityIds: ["tv"], status: "ativo" });
  next.offers.push({ id: "sala-tv-agenda", modalityId: "espaco_atendimento", locationId: "sede-oab", resourceId: "sala-tv", name: "Sala com TV", description: "Reserva", status: "ativo", durationMinutes: 60, capacity: 1, bookingPath: "/agendar/salas-de-apoio/sala-tv-agenda", availabilityMode: AVAILABILITY_MODE.WEEKLY, weeklySchedule: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }] });
  next.modalities.find((x) => x.id === "espaco_atendimento").status = "ativo";

  const saved = prepareAppointmentCatalogForSave(next, { currentValue: current, expectedRevision: 1 });
  const publicCatalog = buildPublicAppointmentCatalog(saved);
  const room = publicCatalog.modalities.find((item) => item.id === "espaco_atendimento")?.offers[0]?.resource;

  assert.equal(saved.resources.find((item) => item.id === "sala-tv").amenityIds[0], "tv");
  assert.deepEqual(room.amenities, [{ id: "tv", name: "TV", category: "Equipamento" }]);
});

test("comodidade inexistente é rejeitada antes de salvar", () => {
  const current = createDefaultAppointmentCatalog();
  const next = structuredClone(current);
  next.locations.push({ id: "sede-oab", name: "Sede OAB/JF", address: "Juiz de Fora", kind: "physical", status: "rascunho" });
  next.resources.push({ id: "sala-invalida", locationId: "sede-oab", name: "Sala", kind: "room", capacity: 1, amenityIds: ["tv-inexistente"], status: "rascunho" });

  assert.throws(
    () => prepareAppointmentCatalogForSave(next, { currentValue: current, expectedRevision: 1 }),
    (error) => error.code === "RECURSO_COMODIDADE_INEXISTENTE",
  );
});
