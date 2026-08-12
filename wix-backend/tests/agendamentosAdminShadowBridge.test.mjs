import assert from "node:assert/strict";
import test from "node:test";

import {
  observeAdminAppointmentsShadowRead,
  buildAdminAppointmentsShadowQuery,
  buildPrimaryAdminShadowPage,
} from "../domain/agendamentosAdminShadowBridge.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function valueAt(record, field) {
  return record?.[field];
}

function compare(left, right) {
  if (left === right) return 0;
  if (left === undefined || left === null) return -1;
  if (right === undefined || right === null) return 1;
  return left < right ? -1 : 1;
}

class FakeQuery {
  constructor({
    owner,
    collection,
    predicate = () => true,
    sortFields = [],
    sortDirection = "asc",
    pageLimit = 50,
  }) {
    this.owner = owner;
    this.collection = collection;
    this.predicate = predicate;
    this.sortFields = sortFields;
    this.sortDirection = sortDirection;
    this.pageLimit = pageLimit;
  }
  copy(patch = {}) {
    return new FakeQuery({
      owner: this.owner,
      collection: this.collection,
      predicate: this.predicate,
      sortFields: this.sortFields,
      sortDirection: this.sortDirection,
      pageLimit: this.pageLimit,
      ...patch,
    });
  }
  withPredicate(nextPredicate) {
    const previous = this.predicate;
    return this.copy({
      predicate: (item) => previous(item) && nextPredicate(item),
    });
  }
  eq(field, expected) { return this.withPredicate((item) => valueAt(item, field) === expected); }
  ge(field, expected) { return this.withPredicate((item) => compare(valueAt(item, field), expected) >= 0); }
  le(field, expected) { return this.withPredicate((item) => compare(valueAt(item, field), expected) <= 0); }
  gt(field, expected) { return this.withPredicate((item) => compare(valueAt(item, field), expected) > 0); }
  lt(field, expected) { return this.withPredicate((item) => compare(valueAt(item, field), expected) < 0); }
  isEmpty(field) {
    return this.withPredicate((item) => {
      const value = valueAt(item, field);
      return value === undefined || value === null;
    });
  }
  hasSome(field, values) {
    const expected = Array.isArray(values) ? values : [values];
    return this.withPredicate((item) => expected.includes(valueAt(item, field)));
  }
  and(other) {
    const left = this.predicate;
    const right = other.predicate;
    return this.copy({ predicate: (item) => left(item) && right(item) });
  }
  or(other) {
    const left = this.predicate;
    const right = other.predicate;
    return this.copy({ predicate: (item) => left(item) || right(item) });
  }
  ascending(...fields) { return this.copy({ sortFields: fields.flat(), sortDirection: "asc" }); }
  descending(...fields) { return this.copy({ sortFields: fields.flat(), sortDirection: "desc" }); }
  limit(value) { return this.copy({ pageLimit: Number(value) }); }
  async count() {
    const records = this.owner.collections.get(this.collection) || [];
    return records.filter(this.predicate).length;
  }
  async find(options = {}) {
    this.owner.findCalls.push({ collection: this.collection, options: clone(options) });
    const records = this.owner.collections.get(this.collection) || [];
    const filtered = records.filter(this.predicate);
    const sorted = [...filtered].sort((left, right) => {
      for (const field of this.sortFields) {
        const result = compare(valueAt(left, field), valueAt(right, field));
        if (result !== 0) return this.sortDirection === "desc" ? result * -1 : result;
      }
      return 0;
    });
    const items = sorted.slice(0, this.pageLimit);
    return {
      items: clone(items),
      totalCount: sorted.length,
      hasNext() { return sorted.length > items.length; },
    };
  }
}

function createFakeWixData(records = []) {
  return {
    collections: new Map([["Import4259", clone(records)]]),
    queryCalls: [],
    findCalls: [],
    query(collection) {
      this.queryCalls.push(collection);
      return new FakeQuery({ owner: this, collection });
    },
  };
}

function legacy(index, overrides = {}) {
  return {
    _id: `legacy-${index}`,
    protocolo: `AG-${index}`,
    unidadeSlug: "anexo-feminino",
    dataAtendimentoIso: "2026-08-20",
    horarioInicio: `${String(9 + index).padStart(2, "0")}:00`,
    horarioFim: `${String(9 + index).padStart(2, "0")}:30`,
    nomeAdvogado: `Pessoa ${index}`,
    numeroOab: `MG-${1000 + index}`,
    emailAdvogado: `pessoa${index}@example.com`,
    status: "agendado",
    ...overrides,
  };
}

test("flag OFF retorna antes de tocar no wix-data candidato", async () => {
  const wixData = createFakeWixData([legacy(1)]);
  const report = await observeAdminAppointmentsShadowRead({
    wixData,
    rawResult: { items: [legacy(1)], totalCount: 1 },
    enabled: false,
  });
  assert.deepEqual(report, { enabled: false, status: "disabled" });
  assert.equal(wixData.queryCalls.length, 0);
  assert.equal(wixData.findCalls.length, 0);
});

test("busca textual é ignorada sem executar candidato", async () => {
  const wixData = createFakeWixData([legacy(1)]);
  const logs = [];
  const report = await observeAdminAppointmentsShadowRead({
    wixData,
    rawResult: { items: [legacy(1)], totalCount: 1 },
    filtros: { busca: "nome qualquer" },
    enabled: true,
    logger: (entry) => logs.push(entry),
    requestIdFactory: () => "req-1",
  });
  assert.equal(report.status, "skipped");
  assert.equal(report.reason, "unsupported_text_search");
  assert.equal(wixData.queryCalls.length, 0);
  assert.equal(logs[0].requestId, "req-1");
});

test("resultado primário truncado é ignorado sem falso diagnóstico", async () => {
  const wixData = createFakeWixData([legacy(1), legacy(2)]);
  const report = await observeAdminAppointmentsShadowRead({
    wixData,
    rawResult: { items: [legacy(1)], totalCount: 2 },
    enabled: true,
    requestIdFactory: () => "req-2",
  });
  assert.equal(report.status, "skipped");
  assert.equal(report.reason, "primary_result_truncated");
  assert.equal(wixData.queryCalls.length, 0);
});

test("conjunto completo equivalente produz paridade", async () => {
  const records = [legacy(1), legacy(2)];
  const wixData = createFakeWixData(records);
  const logs = [];
  const report = await observeAdminAppointmentsShadowRead({
    wixData,
    rawResult: { items: clone(records), totalCount: 2 },
    filtros: {
      unidadeSlug: "anexo-feminino",
      status: "agendado",
      dataIso: "2026-08-20",
    },
    enabled: true,
    logger: (entry) => logs.push(entry),
    requestIdFactory: () => "req-parity",
  });
  assert.equal(report.status, "completed");
  assert.equal(report.parity, true);
  assert.equal(report.primaryCount, 2);
  assert.equal(report.candidateCount, 2);
  assert.ok(wixData.queryCalls.length > 0);
  assert.equal(logs.at(-1).requestId, "req-parity");
});

test("tradução do filtro administrativo usa apenas identificadores técnicos", () => {
  const translated = buildAdminAppointmentsShadowQuery({
    unidadeSlug: "anexo-feminino",
    status: "agendado",
    dataIso: "2026-08-20",
  });
  assert.equal(translated.supported, true);
  assert.deepEqual(translated.query.resourceIds, ["prisional:anexo-feminino"]);
  assert.deepEqual(translated.query.statuses, ["agendado"]);
  assert.equal(translated.query.dateFrom, "2026-08-20");
  assert.equal(translated.query.dateTo, "2026-08-20");
});

test("página primária exige total conhecido e conjunto completo", () => {
  const query = buildAdminAppointmentsShadowQuery({}).query;
  assert.equal(
    buildPrimaryAdminShadowPage({ items: [] }, query).reason,
    "primary_total_unknown",
  );
  assert.equal(
    buildPrimaryAdminShadowPage({ items: [legacy(1)], totalCount: 2 }, query).reason,
    "primary_result_truncated",
  );
});

test("falha do candidato vira relatório e não lança erro", async () => {
  const records = [legacy(1)];
  const wixData = createFakeWixData(records);
  wixData.query = () => { throw new Error("falha simulada"); };
  const report = await observeAdminAppointmentsShadowRead({
    wixData,
    rawResult: { items: clone(records), totalCount: 1 },
    enabled: true,
    requestIdFactory: () => "req-error",
  });
  assert.equal(report.status, "candidate_error");
  assert.equal(report.requestId, "req-error");
  assert.equal(report.errorCode, "APPOINTMENTS_SHADOW_READ_FAILED");
});
