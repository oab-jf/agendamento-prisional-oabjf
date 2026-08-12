import assert from "node:assert/strict";
import test from "node:test";

import {
  APPOINTMENT_STATUS,
  MODALITY_IDS,
} from "../domain/agendamentosCore.js";
import {
  DEFAULT_APPOINTMENTS_PAGE_SIZE,
  MAX_APPOINTMENTS_PAGE_SIZE,
  buildAppointmentQueryPlan,
  createReferenceAppointmentsRepository,
  decodeAppointmentCursor,
  executeReferenceAppointmentQuery,
  normalizeAppointmentQuery,
} from "../domain/agendamentosRepository.js";

function legacyAppointment(index, overrides = {}) {
  const hour = String(9 + index).padStart(2, "0");

  return {
    _id: `legacy-${index}`,
    protocolo: `AG-2026-${String(index).padStart(6, "0")}`,
    unidadeSlug: index % 2 === 0 ? "ceresp-jf" : "pjec",
    dataAtendimentoIso: "2026-08-20",
    horarioInicio: `${hour}:00`,
    horarioFim: `${hour}:30`,
    nomeAdvogado: `Advogada ${index}`,
    numeroOab: `MG ${1000 + index}`,
    emailAdvogado: `advogada${index}@example.com`,
    nomeIpl: `Pessoa ${index}`,
    status: "agendado",
    ...overrides,
  };
}

function v2Appointment(index, overrides = {}) {
  return {
    _id: `v2-${index}`,
    schemaVersion: 2,
    modalidadeId: MODALITY_IDS.ESPACO_REUNIAO,
    recursoId: "sede:sala-reuniao-1",
    dataAtendimentoIso: "2026-08-21",
    horarioInicio: `${String(9 + index).padStart(2, "0")}:00`,
    duracaoMinutos: 60,
    status: "agendado",
    protocolo: `ESP-2026-${index}`,
    solicitanteEmail: `pessoa${index}@example.com`,
    solicitanteOab: `MG ${2000 + index}`,
    ...overrides,
  };
}

test("a consulta aplica defaults seguros", () => {
  const query = normalizeAppointmentQuery();

  assert.equal(query.pageSize, DEFAULT_APPOINTMENTS_PAGE_SIZE);
  assert.equal(query.sortDirection, "asc");
  assert.equal(query.includeLegacy, true);
  assert.deepEqual(query.modalityIds, []);
});

test("o tamanho da página é limitado", () => {
  assert.equal(
    normalizeAppointmentQuery({ pageSize: 999 }).pageSize,
    MAX_APPOINTMENTS_PAGE_SIZE,
  );
});

test("datas invertidas são rejeitadas", () => {
  assert.throws(
    () =>
      normalizeAppointmentQuery({
        dateFrom: "2026-08-21",
        dateTo: "2026-08-20",
      }),
    /data inicial/i,
  );
});

test("modalidade desconhecida é rejeitada", () => {
  assert.throws(
    () =>
      normalizeAppointmentQuery({
        modalityIds: ["modalidade_inexistente"],
      }),
    /Modalidade desconhecida/,
  );
});

test("registros legados são filtrados como prisional virtual", () => {
  const page = executeReferenceAppointmentQuery(
    [legacyAppointment(0), v2Appointment(0)],
    {
      modalityIds: [MODALITY_IDS.PRISIONAL_VIRTUAL],
    },
  );

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].legacy, true);
  assert.equal(page.items[0].modalityId, MODALITY_IDS.PRISIONAL_VIRTUAL);
});

test("includeLegacy false remove registros antigos", () => {
  const page = executeReferenceAppointmentQuery(
    [legacyAppointment(0), v2Appointment(0)],
    {
      includeLegacy: false,
    },
  );

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["v2-0"],
  );
});

test("filtros por recurso, status e período são combinados", () => {
  const page = executeReferenceAppointmentQuery(
    [
      legacyAppointment(0),
      legacyAppointment(1, { status: APPOINTMENT_STATUS.CANCELADO }),
      legacyAppointment(2, { dataAtendimentoIso: "2026-08-22" }),
    ],
    {
      resourceIds: ["prisional:ceresp-jf"],
      statuses: [APPOINTMENT_STATUS.AGENDADO],
      dateFrom: "2026-08-20",
      dateTo: "2026-08-20",
    },
  );

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["legacy-0"],
  );
});

test("e-mail, OAB e protocolo usam comparação exata normalizada", () => {
  const page = executeReferenceAppointmentQuery([legacyAppointment(0)], {
    requesterEmail: "ADVOGADA0@EXAMPLE.COM",
    oabNumber: "MG-1000",
    protocol: "ag-2026-000000",
  });

  assert.equal(page.items.length, 1);
});

test("a paginação por cursor não repete registros", () => {
  const records = [
    legacyAppointment(0),
    legacyAppointment(1),
    legacyAppointment(2),
  ];

  const first = executeReferenceAppointmentQuery(records, { pageSize: 2 });
  const second = executeReferenceAppointmentQuery(records, {
    pageSize: 2,
    cursor: first.pageInfo.endCursor,
  });

  assert.deepEqual(
    first.items.map((item) => item.id),
    ["legacy-0", "legacy-1"],
  );
  assert.deepEqual(
    second.items.map((item) => item.id),
    ["legacy-2"],
  );
  assert.equal(first.pageInfo.hasNextPage, true);
  assert.equal(second.pageInfo.hasNextPage, false);
});

test("a paginação descendente preserva a direção no cursor", () => {
  const records = [
    legacyAppointment(0),
    legacyAppointment(1),
    legacyAppointment(2),
  ];

  const first = executeReferenceAppointmentQuery(records, {
    pageSize: 1,
    sortDirection: "desc",
  });

  const cursor = decodeAppointmentCursor(first.pageInfo.endCursor);
  const second = executeReferenceAppointmentQuery(records, {
    pageSize: 1,
    sortDirection: "desc",
    cursor: first.pageInfo.endCursor,
  });

  assert.equal(cursor.s, "desc");
  assert.equal(first.items[0].id, "legacy-2");
  assert.equal(second.items[0].id, "legacy-1");
});

test("registros v2 inválidos são relatados sem derrubar a página", () => {
  const page = executeReferenceAppointmentQuery([
    legacyAppointment(0),
    {
      _id: "invalido",
      schemaVersion: 2,
      modalidadeId: "modalidade_inexistente",
    },
  ]);

  assert.equal(page.items.length, 1);
  assert.equal(page.diagnostics.invalidRecordCount, 1);
  assert.equal(page.diagnostics.invalidRecords[0].id, "invalido");
});

test("registros sem data ou horário ficam fora da página e entram no diagnóstico", () => {
  const page = executeReferenceAppointmentQuery([
    legacyAppointment(0),
    {
      _id: "sem-slot",
      unidadeSlug: "ceresp-jf",
      status: "agendado",
    },
  ]);

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["legacy-0"],
  );
  assert.equal(page.diagnostics.invalidRecordCount, 1);
  assert.deepEqual(page.diagnostics.invalidRecords[0].issues, [
    "data_ausente_ou_invalida",
    "horario_ausente_ou_invalido",
  ]);
});

test("o plano de consulta separa legado e schema v2", () => {
  const plan = buildAppointmentQueryPlan({
    modalityIds: [MODALITY_IDS.PRISIONAL_VIRTUAL],
    pageSize: 30,
  });

  assert.equal(plan.branches[0].kind, "schema-v2");
  assert.equal(plan.branches[1].kind, "legacy-prison");
  assert.equal(plan.branches[1].enabled, true);
  assert.equal(plan.pagination.fetchLimitPerBranch, 31);
});

test("o plano traduz recursos prisionais para slugs legados", () => {
  const plan = buildAppointmentQueryPlan({
    resourceIds: ["prisional:ceresp-jf"],
  });

  assert.deepEqual(plan.branches[1].filters.unitSlugs, ["ceresp-jf"]);
  assert.equal(plan.branches[1].enabled, true);
});

test("o plano desativa o ramo legado para modalidade não prisional", () => {
  const plan = buildAppointmentQueryPlan({
    modalityIds: [MODALITY_IDS.ESPACO_REUNIAO],
  });

  assert.equal(plan.branches[1].enabled, false);
});

test("o repositório de referência permite trocar a fonte em testes", async () => {
  const repository = createReferenceAppointmentsRepository([
    legacyAppointment(0),
  ]);

  assert.equal((await repository.list()).items.length, 1);

  repository.replaceRecords([v2Appointment(0)]);

  assert.equal((await repository.getById("v2-0")).legacy, false);
  assert.equal((await repository.list()).items[0].id, "v2-0");
});
