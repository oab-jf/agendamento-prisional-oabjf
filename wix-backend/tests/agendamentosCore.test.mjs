import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENDAMENTOS_SCHEMA_VERSION,
  APPOINTMENT_STATUS,
  MODALITY_FAMILY_IDS,
  MODALITY_IDS,
  adaptLegacyPrisonAppointment,
  appointmentStatusOccupiesCapacity,
  buildLegacyPrisonSlotKey,
  buildSlotIdentity,
  countSlotOccupancy,
  evaluateSlotCapacity,
  getModalityDefinition,
  listModalityDefinitions,
  modalityScopeAllows,
  normalizeAppointmentRecord,
  normalizeModalityScopes,
} from "../domain/agendamentosCore.js";

const SLOT = {
  modalityId: MODALITY_IDS.PRISIONAL_VIRTUAL,
  resourceId: "prisional:ceresp-jf",
  dateIso: "2026-08-20",
  startTime: "09:00",
};

function legacyAppointment(overrides = {}) {
  return {
    _id: "ag-1",
    protocolo: "AG-2026-123456",
    unidadeSlug: "ceresp-jf",
    unidadeNome: "CERESP Juiz de Fora",
    dataAtendimentoIso: "2026-08-20",
    horarioInicio: "09:00",
    horarioFim: "09:30",
    nomeAdvogado: "Pessoa Advogada",
    numeroOab: "MG 123456",
    emailAdvogado: "ADVOGADA@EXAMPLE.COM",
    telefoneAdvogado: "(32) 99999-9999",
    nomeIpl: "Pessoa assistida",
    infopen: "123",
    status: "agendado",
    ...overrides,
  };
}

test("o catálogo inicial habilita somente o atendimento prisional", () => {
  const enabled = listModalityDefinitions();

  assert.deepEqual(
    enabled.map((item) => item.id),
    [MODALITY_IDS.PRISIONAL_VIRTUAL],
  );

  const all = listModalityDefinitions({ includeDisabled: true });
  assert.equal(all.length, 5);
  assert.equal(
    getModalityDefinition(MODALITY_IDS.PJE_SUPORTE_INSTALACAO).enabled,
    false,
  );
});

test("o adaptador legado preserva o contrato prisional no schema v2", () => {
  const normalized = adaptLegacyPrisonAppointment(legacyAppointment());

  assert.equal(normalized.schemaVersion, AGENDAMENTOS_SCHEMA_VERSION);
  assert.equal(normalized.sourceSchemaVersion, 1);
  assert.equal(normalized.legacy, true);
  assert.equal(normalized.modalityId, MODALITY_IDS.PRISIONAL_VIRTUAL);
  assert.equal(
    normalized.modalityFamilyId,
    MODALITY_FAMILY_IDS.PRISIONAL,
  );
  assert.equal(normalized.resourceId, "prisional:ceresp-jf");
  assert.equal(normalized.slot.dateIso, "2026-08-20");
  assert.equal(normalized.slot.startTime, "09:00");
  assert.equal(normalized.slot.endTime, "09:30");
  assert.equal(normalized.slot.durationMinutes, 30);
  assert.equal(normalized.requester.email, "advogada@example.com");
  assert.equal(
    normalized.specificData.prison.assistedPersonName,
    "Pessoa assistida",
  );
  assert.deepEqual(normalized.compatibility.issues, []);
});

test("a chave legada permanece byte a byte compatível", () => {
  assert.equal(
    buildLegacyPrisonSlotKey({
      unitSlug: "CERESP-JF",
      dateIso: "2026-08-20",
      startTime: "09:00",
    }),
    "ceresp-jf|2026-08-20|09:00",
  );
});

test("a identidade v2 diferencia modalidade e recurso", () => {
  const prison = buildSlotIdentity(SLOT);
  const pje = buildSlotIdentity({
    ...SLOT,
    modalityId: MODALITY_IDS.PJE_SUPORTE_INSTALACAO,
    resourceId: "pje:tecnico-1",
  });

  assert.equal(
    prison,
    "v2|prisional_virtual|prisional%3Aceresp-jf|2026-08-20|09:00",
  );
  assert.notEqual(prison, pje);
});

test("somente status agendado ocupa capacidade", () => {
  assert.equal(
    appointmentStatusOccupiesCapacity(APPOINTMENT_STATUS.AGENDADO),
    true,
  );
  assert.equal(
    appointmentStatusOccupiesCapacity(APPOINTMENT_STATUS.CANCELADO),
    false,
  );
  assert.equal(
    appointmentStatusOccupiesCapacity(APPOINTMENT_STATUS.REAGENDADO),
    false,
  );
  assert.equal(
    appointmentStatusOccupiesCapacity(APPOINTMENT_STATUS.REALIZADO),
    false,
  );
  assert.equal(
    appointmentStatusOccupiesCapacity(APPOINTMENT_STATUS.NAO_COMPARECEU),
    false,
  );
});

test("a ocupação ignora registros cancelados e reagendados", () => {
  const records = [
    legacyAppointment({ _id: "a", status: "agendado" }),
    legacyAppointment({ _id: "b", status: "cancelado" }),
    legacyAppointment({ _id: "c", status: "reagendado" }),
  ];

  assert.equal(countSlotOccupancy(records, SLOT), 1);
});

test("a capacidade maior que um é aplicada pelo mesmo núcleo", () => {
  const records = [
    legacyAppointment({ _id: "a" }),
    legacyAppointment({ _id: "b" }),
  ];

  const full = evaluateSlotCapacity({
    records,
    slot: SLOT,
    capacity: 2,
  });

  assert.deepEqual(full, {
    capacity: 2,
    occupancy: 2,
    remaining: 0,
    available: false,
  });

  const ignoringOne = evaluateSlotCapacity({
    records,
    slot: SLOT,
    capacity: 2,
    ignoreAppointmentId: "b",
  });

  assert.equal(ignoringOne.occupancy, 1);
  assert.equal(ignoringOne.available, true);
});

test("um registro v2 mantém a modalidade explícita", () => {
  const normalized = normalizeAppointmentRecord({
    _id: "v2-1",
    schemaVersion: 2,
    modalidadeId: MODALITY_IDS.ESPACO_REUNIAO,
    recursoId: "sede:sala-reuniao-1",
    dataAtendimentoIso: "2026-08-21",
    horarioInicio: "10:00",
    duracaoMinutos: 60,
    status: "agendado",
    dadosEspecificos: {
      space: {
        attendees: 6,
      },
    },
  });

  assert.equal(normalized.legacy, false);
  assert.equal(normalized.modalityId, MODALITY_IDS.ESPACO_REUNIAO);
  assert.equal(normalized.slot.endTime, "11:00");
  assert.equal(normalized.specificData.space.attendees, 6);
});

test("modalidade criada pelo catálogo operacional é aceita no schema v2", () => {
  const normalized = normalizeAppointmentRecord({
    schemaVersion: 2,
    modalidadeId: "mentoria_advocacia",
    modalidadeFamiliaId: "geral",
    recursoId: "sede:sala-mentoria",
    dataAtendimentoIso: "2026-08-21",
    horarioInicio: "10:00",
    duracaoMinutos: 45,
    status: "agendado",
  });

  assert.equal(normalized.modalityId, "mentoria_advocacia");
  assert.equal(normalized.modalityFamilyId, "geral");
  assert.equal(normalized.slot.endTime, "10:45");
  assert.equal(
    normalized.slot.identity,
    "v2|mentoria_advocacia|sede%3Asala-mentoria|2026-08-21|10:00",
  );
});

test("o adaptador sinaliza legado incompleto sem fabricar slot", () => {
  const normalized = adaptLegacyPrisonAppointment({
    _id: "incompleto",
    status: "",
  });

  assert.equal(normalized.slot.identity, "");
  assert.deepEqual(normalized.compatibility.issues, [
    "unidade_ausente",
    "data_ausente_ou_invalida",
    "horario_ausente_ou_invalido",
  ]);
});

test("escopos aceitam wildcard, família e modalidade", () => {
  assert.deepEqual(normalizeModalityScopes(["*", "prisional"]), ["*"]);

  assert.equal(
    modalityScopeAllows(
      [MODALITY_FAMILY_IDS.ESPACOS_PROFISSIONAIS],
      MODALITY_IDS.ESPACO_REUNIAO,
    ),
    true,
  );

  assert.equal(
    modalityScopeAllows(
      [MODALITY_IDS.PRISIONAL_VIRTUAL],
      MODALITY_IDS.PJE_SUPORTE_INSTALACAO,
    ),
    false,
  );
});
