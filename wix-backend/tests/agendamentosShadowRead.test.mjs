import assert from "node:assert/strict";
import test from "node:test";

import {
  MODALITY_IDS,
  normalizeAppointmentRecord,
} from "../domain/agendamentosCore.js";
import {
  compareAppointmentRepositoryPages,
  runAppointmentShadowRead,
} from "../domain/agendamentosShadowRead.js";

function normalizedAppointment(id, overrides = {}) {
  return normalizeAppointmentRecord({
    _id: id,
    schemaVersion: 2,
    modalidadeId: MODALITY_IDS.PRISIONAL_VIRTUAL,
    recursoId: "prisional:ceresp-jf",
    dataAtendimentoIso: "2026-08-20",
    horarioInicio: "09:00",
    duracaoMinutos: 30,
    status: "agendado",
    protocolo: `AG-${id}`,
    solicitanteNome: "Nome que não pode aparecer no relatório",
    solicitanteEmail: "sensivel@example.com",
    dadosEspecificos: {
      prison: {
        assistedPersonName: "Pessoa assistida sensível",
      },
    },
    ...overrides,
  });
}

function page(items, overrides = {}) {
  return {
    items,
    pageInfo: {
      hasNextPage: false,
      totalMatches: items.length,
      endCursor: null,
      ...overrides,
    },
  };
}

test("shadow read desativado não chama o candidato", async () => {
  let candidateCalls = 0;
  const primary = page([normalizedAppointment("1")]);

  const result = await runAppointmentShadowRead({
    query: {},
    primaryReader: async () => primary,
    candidateReader: async () => {
      candidateCalls += 1;
      return primary;
    },
  });

  assert.equal(candidateCalls, 0);
  assert.equal(result.result, primary);
  assert.equal(result.shadow.status, "disabled");
});

test("páginas idênticas produzem paridade", () => {
  const primary = page([normalizedAppointment("1")]);
  const candidate = page([normalizedAppointment("1")]);

  const comparison = compareAppointmentRepositoryPages(primary, candidate);

  assert.equal(comparison.parity, true);
  assert.deepEqual(comparison.changed, []);
});

test("diferenças de conteúdo são descritas sem valores sensíveis", () => {
  const primary = page([normalizedAppointment("1")]);
  const candidate = page([
    normalizedAppointment("1", {
      status: "cancelado",
    }),
  ]);

  const comparison = compareAppointmentRepositoryPages(primary, candidate);
  const serialized = JSON.stringify(comparison);

  assert.equal(comparison.parity, false);
  assert.deepEqual(comparison.changed, [
    {
      key: "1",
      fields: ["status"],
    },
  ]);
  assert.doesNotMatch(serialized, /sensivel@example\.com/i);
  assert.doesNotMatch(serialized, /Pessoa assistida sensível/i);
});

test("ausências, excedentes e ordem divergente são detectados", () => {
  const one = normalizedAppointment("1");
  const two = normalizedAppointment("2", { horarioInicio: "10:00" });
  const three = normalizedAppointment("3", { horarioInicio: "11:00" });

  const comparison = compareAppointmentRepositoryPages(
    page([one, two]),
    page([two, three]),
  );

  assert.equal(comparison.parity, false);
  assert.deepEqual(comparison.missingInCandidate, ["1"]);
  assert.deepEqual(comparison.unexpectedInCandidate, ["3"]);
  assert.equal(comparison.orderMismatch, true);
});

test("shadow read retorna sempre a resposta primária", async () => {
  const primary = page([normalizedAppointment("1")]);
  const candidate = page([
    normalizedAppointment("1", { status: "cancelado" }),
  ]);

  const result = await runAppointmentShadowRead({
    query: {},
    enabled: true,
    primaryReader: async () => primary,
    candidateReader: async () => candidate,
  });

  assert.equal(result.result, primary);
  assert.equal(result.shadow.status, "completed");
  assert.equal(result.shadow.parity, false);
});

test("falha do candidato não altera a resposta oficial", async () => {
  const primary = page([normalizedAppointment("1")]);

  const result = await runAppointmentShadowRead({
    query: {},
    enabled: true,
    primaryReader: async () => primary,
    candidateReader: async () => {
      throw new Error("Falha simulada");
    },
  });

  assert.equal(result.result, primary);
  assert.equal(result.shadow.status, "candidate_error");
  assert.equal(result.shadow.errorCode, "APPOINTMENTS_SHADOW_READ_FAILED");
});

test("falha do leitor primário continua sendo bloqueante", async () => {
  await assert.rejects(
    () =>
      runAppointmentShadowRead({
        query: {},
        enabled: true,
        primaryReader: async () => {
          throw new Error("Falha primária");
        },
        candidateReader: async () => page([]),
      }),
    /Falha primária/,
  );
});

test("falha do logger não afeta a leitura", async () => {
  const primary = page([normalizedAppointment("1")]);

  const result = await runAppointmentShadowRead({
    query: {},
    enabled: true,
    primaryReader: async () => primary,
    candidateReader: async () => primary,
    logger: () => {
      throw new Error("Logger indisponível");
    },
  });

  assert.equal(result.result, primary);
  assert.equal(result.shadow.parity, true);
});
