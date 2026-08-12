import assert from "node:assert/strict";
import test from "node:test";

import {
  MODALITY_IDS,
  normalizeAppointmentRecord,
} from "../domain/agendamentosCore.js";
import {
  APPOINTMENTS_WIX_SHADOW_READ,
  createWixAppointmentsShadowReader,
} from "../domain/agendamentosShadowReadWix.js";

function appointment(id, status = "agendado") {
  return normalizeAppointmentRecord({
    _id: id,
    schemaVersion: 2,
    modalidadeId: MODALITY_IDS.PRISIONAL_VIRTUAL,
    recursoId: "prisional:ceresp-jf",
    dataAtendimentoIso: "2026-08-20",
    horarioInicio: "09:00",
    duracaoMinutos: 30,
    status,
    protocolo: `AG-${id}`,
  });
}

function page(items) {
  return {
    items,
    pageInfo: {
      pageSize: 25,
      hasNextPage: false,
      endCursor: null,
      totalMatches: items.length,
    },
    diagnostics: {
      invalidRecordCount: 0,
      invalidRecords: [],
    },
  };
}

test("a feature flag Wix permanece desligada por padrão", () => {
  assert.equal(APPOINTMENTS_WIX_SHADOW_READ.defaultEnabled, false);
});

test("o wiring exige leitor primário", () => {
  assert.throws(
    () =>
      createWixAppointmentsShadowReader({
        candidateRepository: { list: async () => page([]) },
      }),
    /Leitor primário/,
  );
});

test("o wiring exige repositório candidato", () => {
  assert.throws(
    () =>
      createWixAppointmentsShadowReader({
        primaryReader: async () => page([]),
      }),
    /Repositório candidato Wix/,
  );
});

test("flag desligada não chama o repositório Wix candidato", async () => {
  let candidateCalls = 0;
  const primary = page([appointment("1")]);

  const read = createWixAppointmentsShadowReader({
    primaryReader: async () => primary,
    candidateRepository: {
      async list() {
        candidateCalls += 1;
        return primary;
      },
    },
  });

  const result = await read({});

  assert.equal(candidateCalls, 0);
  assert.equal(result.result, primary);
  assert.equal(result.shadow.status, "disabled");
});

test("flag true executa candidato e mantém a resposta primária", async () => {
  const primary = page([appointment("1")]);
  const candidate = page([appointment("1", "cancelado")]);

  const read = createWixAppointmentsShadowReader({
    primaryReader: async () => primary,
    candidateRepository: {
      async list() {
        return candidate;
      },
    },
    enabled: true,
  });

  const result = await read({});

  assert.equal(result.result, primary);
  assert.equal(result.shadow.status, "completed");
  assert.equal(result.shadow.parity, false);
});

test("flag textual enabled é aceita sem mudar o default", async () => {
  let calls = 0;
  const primary = page([appointment("1")]);

  const read = createWixAppointmentsShadowReader({
    primaryReader: async () => primary,
    candidateRepository: {
      async list() {
        calls += 1;
        return primary;
      },
    },
    enabled: "enabled",
  });

  const result = await read({});

  assert.equal(calls, 1);
  assert.equal(result.shadow.parity, true);
});

test("requestIdFactory injeta identificador técnico no relatório", async () => {
  const primary = page([appointment("1")]);
  const logs = [];

  const read = createWixAppointmentsShadowReader({
    primaryReader: async () => primary,
    candidateRepository: {
      async list() {
        return primary;
      },
    },
    enabled: true,
    requestIdFactory: () => "req-123",
    logger: (entry) => logs.push(entry),
  });

  await read({});

  assert.equal(logs[0].requestId, "req-123");
});

test("falha do candidato continua sem afetar a leitura primária", async () => {
  const primary = page([appointment("1")]);

  const read = createWixAppointmentsShadowReader({
    primaryReader: async () => primary,
    candidateRepository: {
      async list() {
        throw new Error("Wix indisponível");
      },
    },
    enabled: true,
  });

  const result = await read({});

  assert.equal(result.result, primary);
  assert.equal(result.shadow.status, "candidate_error");
});
