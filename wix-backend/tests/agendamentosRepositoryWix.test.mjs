import assert from "node:assert/strict";
import test from "node:test";

import {
  MODALITY_IDS,
} from "../domain/agendamentosCore.js";
import {
  decodeAppointmentCursor,
} from "../domain/agendamentosRepository.js";
import {
  WIX_APPOINTMENTS_COLLECTION,
  buildOabPersistenceVariants,
  buildWixAppointmentQueryDescriptors,
  createWixAppointmentsRepository,
} from "../domain/agendamentosRepositoryWix.js";

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

  eq(field, expected) {
    return this.withPredicate((item) => valueAt(item, field) === expected);
  }

  ge(field, expected) {
    return this.withPredicate((item) => compare(valueAt(item, field), expected) >= 0);
  }

  le(field, expected) {
    return this.withPredicate((item) => compare(valueAt(item, field), expected) <= 0);
  }

  gt(field, expected) {
    return this.withPredicate((item) => compare(valueAt(item, field), expected) > 0);
  }

  lt(field, expected) {
    return this.withPredicate((item) => compare(valueAt(item, field), expected) < 0);
  }

  isEmpty(field) {
    return this.withPredicate((item) => {
      const value = valueAt(item, field);
      return value === undefined || value === null;
    });
  }

  hasSome(field, values) {
    const expected = Array.isArray(values) ? values : [values];
    return this.withPredicate((item) => {
      const actual = valueAt(item, field);
      if (Array.isArray(actual)) {
        return actual.some((entry) => expected.includes(entry));
      }
      return expected.includes(actual);
    });
  }

  and(other) {
    const left = this.predicate;
    const right = other.predicate;
    return this.copy({
      predicate: (item) => left(item) && right(item),
    });
  }

  or(other) {
    const left = this.predicate;
    const right = other.predicate;
    return this.copy({
      predicate: (item) => left(item) || right(item),
    });
  }

  ascending(...fields) {
    return this.copy({
      sortFields: fields.flat(),
      sortDirection: "asc",
    });
  }

  descending(...fields) {
    return this.copy({
      sortFields: fields.flat(),
      sortDirection: "desc",
    });
  }

  limit(value) {
    return this.copy({ pageLimit: Number(value) });
  }

  async count(options = {}) {
    this.owner.countCalls.push({
      collection: this.collection,
      options: clone(options),
    });

    const records = this.owner.collections.get(this.collection) || [];
    return records.filter(this.predicate).length;
  }

  async find(options = {}) {
    this.owner.findCalls.push({
      collection: this.collection,
      options: clone(options),
      limit: this.pageLimit,
      sortFields: [...this.sortFields],
      sortDirection: this.sortDirection,
    });

    const records = this.owner.collections.get(this.collection) || [];
    const filtered = records.filter(this.predicate);
    const sorted = [...filtered].sort((left, right) => {
      for (const field of this.sortFields) {
        const result = compare(valueAt(left, field), valueAt(right, field));
        if (result !== 0) {
          return this.sortDirection === "desc" ? result * -1 : result;
        }
      }
      return 0;
    });

    const items = sorted.slice(0, this.pageLimit);
    const totalCount = sorted.length;

    return {
      items: clone(items),
      totalCount,
      hasNext() {
        return totalCount > items.length;
      },
    };
  }
}

function createFakeWixData(records = []) {
  return {
    collections: new Map([[WIX_APPOINTMENTS_COLLECTION, clone(records)]]),
    queryCalls: [],
    findCalls: [],
    countCalls: [],
    getCalls: [],

    query(collection) {
      this.queryCalls.push(collection);
      return new FakeQuery({ owner: this, collection });
    },

    async get(collection, id, options = {}) {
      this.getCalls.push({ collection, id, options: clone(options) });
      const records = this.collections.get(collection) || [];
      const found = records.find((item) => item._id === id);
      if (!found) throw new Error("not found");
      return clone(found);
    },
  };
}

function legacy(index, overrides = {}) {
  const hour = String(9 + index).padStart(2, "0");
  return {
    _id: `legacy-${index}`,
    protocolo: `AG-2026-${String(index).padStart(6, "0")}`,
    unidadeSlug: index % 2 === 0 ? "ceresp-jf" : "anexo-feminino",
    dataAtendimentoIso: "2026-08-20",
    horarioInicio: `${hour}:00`,
    horarioFim: `${hour}:30`,
    nomeAdvogado: `Advogada ${index}`,
    numeroOab: `MG-${1000 + index}`,
    emailAdvogado: `advogada${index}@example.com`,
    emailIndex: `advogada${index}@example.com`,
    status: "agendado",
    ...overrides,
  };
}

function v2(index, overrides = {}) {
  const hour = String(9 + index).padStart(2, "0");
  return {
    _id: `v2-${index}`,
    schemaVersion: 2,
    modalidadeId: MODALITY_IDS.ESPACO_REUNIAO,
    recursoId: "sede:sala-reuniao-1",
    dataAtendimentoIso: "2026-08-21",
    horarioInicio: `${hour}:00`,
    horarioFim: `${hour}:30`,
    duracaoMinutos: 30,
    status: "agendado",
    protocolo: `ESP-2026-${index}`,
    solicitanteNome: `Pessoa ${index}`,
    solicitanteEmail: `pessoa${index}@example.com`,
    solicitanteOab: `MG-${2000 + index}`,
    ...overrides,
  };
}

test("o adaptador exige uma dependência compatível com wix-data", () => {
  assert.throws(
    () => createWixAppointmentsRepository(),
    /wix-data não informado/i,
  );
});

test("o plano Wix mantém ramos separados para schema v2 e legado", () => {
  const descriptors = buildWixAppointmentQueryDescriptors();

  assert.deepEqual(
    descriptors.map((item) => item.kind),
    ["schema-v2", "legacy-prison"],
  );
});

test("modalidade não prisional desativa o ramo legado", () => {
  const descriptors = buildWixAppointmentQueryDescriptors({
    modalityIds: [MODALITY_IDS.ESPACO_REUNIAO],
  });

  assert.deepEqual(
    descriptors.map((item) => item.kind),
    ["schema-v2"],
  );
});

test("recurso prisional é traduzido para unidade no plano legado", () => {
  const descriptors = buildWixAppointmentQueryDescriptors({
    resourceIds: ["prisional:ceresp-jf"],
  });

  const legacyDescriptor = descriptors.find(
    (item) => item.kind === "legacy-prison",
  );

  assert.deepEqual(legacyDescriptor.filters.unitSlugs, ["ceresp-jf"]);
});

test("a listagem padrão mescla legado e v2 na ordenação canônica", async () => {
  const wixData = createFakeWixData([
    v2(0),
    legacy(1),
    legacy(0),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list();

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["legacy-0", "legacy-1", "v2-0"],
  );
  assert.equal(page.pageInfo.totalMatches, 3);
});

test("a ordenação descendente é aplicada nos dois ramos", async () => {
  const wixData = createFakeWixData([
    legacy(0),
    legacy(1),
    v2(0),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({ sortDirection: "desc" });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["v2-0", "legacy-1", "legacy-0"],
  );

  assert.ok(
    wixData.findCalls.every((call) => call.sortDirection === "desc"),
  );
});

test("filtros de status, data e recurso são executados antes da normalização", async () => {
  const wixData = createFakeWixData([
    legacy(0),
    legacy(1, { status: "cancelado" }),
    legacy(2, { dataAtendimentoIso: "2026-08-22" }),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({
    resourceIds: ["prisional:ceresp-jf"],
    statuses: ["agendado"],
    dateFrom: "2026-08-20",
    dateTo: "2026-08-20",
  });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["legacy-0"],
  );
});

test("protocolo exato funciona no ramo legado", async () => {
  const wixData = createFakeWixData([legacy(0), legacy(1)]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({
    protocol: "ag-2026-000001",
  });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["legacy-1"],
  );
});

test("e-mail legado aceita emailIndex quando emailAdvogado não existe", async () => {
  const wixData = createFakeWixData([
    legacy(0, {
      emailAdvogado: undefined,
      emailIndex: "fallback@example.com",
    }),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({
    requesterEmail: "FALLBACK@EXAMPLE.COM",
  });

  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].requester.email, "fallback@example.com");
});

test("e-mail v2 usa solicitanteEmail", async () => {
  const wixData = createFakeWixData([v2(0), v2(1)]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({
    requesterEmail: "PESSOA1@EXAMPLE.COM",
    modalityIds: [MODALITY_IDS.ESPACO_REUNIAO],
  });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["v2-1"],
  );
});

test("variantes de persistência da OAB cobrem formatos históricos usuais", () => {
  assert.deepEqual(
    buildOabPersistenceVariants("mg123456"),
    [
      "MG123456",
      "MG-123456",
      "MG 123456",
      "MG/123456",
      "MG.123456",
    ],
  );
});

test("filtro de OAB legado aceita formato com espaço e confirma canonicamente", async () => {
  const wixData = createFakeWixData([
    legacy(0, { numeroOab: "MG 123456" }),
    legacy(1, { numeroOab: "MG 654321" }),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({
    oabNumber: "MG-123456",
  });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["legacy-0"],
  );
});

test("filtro de OAB v2 aceita formato compacto", async () => {
  const wixData = createFakeWixData([
    v2(0, { solicitanteOab: "MG123456" }),
    v2(1, { solicitanteOab: "MG999999" }),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({
    modalityIds: [MODALITY_IDS.ESPACO_REUNIAO],
    oabNumber: "MG-123456",
  });

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["v2-0"],
  );
});

test("pageSize + 1 é o limite enviado a cada ramo", async () => {
  const wixData = createFakeWixData([
    legacy(0),
    legacy(1),
    v2(0),
    v2(1),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  await repository.list({ pageSize: 2 });

  assert.ok(wixData.findCalls.length >= 2);
  assert.ok(
    wixData.findCalls.every((call) => call.limit === 3),
  );
});

test("cursor ascendente não repete itens entre páginas", async () => {
  const wixData = createFakeWixData([
    legacy(0),
    legacy(1),
    legacy(2),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const first = await repository.list({ pageSize: 2 });
  const second = await repository.list({
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
  assert.equal(first.pageInfo.totalMatches, 3);
  assert.equal(second.pageInfo.totalMatches, 3);
  assert.ok(wixData.countCalls.length > 0);
});

test("cursor descendente preserva direção e continuidade", async () => {
  const wixData = createFakeWixData([
    legacy(0),
    legacy(1),
    legacy(2),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const first = await repository.list({
    pageSize: 1,
    sortDirection: "desc",
  });

  const cursor = decodeAppointmentCursor(first.pageInfo.endCursor);

  const second = await repository.list({
    pageSize: 1,
    sortDirection: "desc",
    cursor: first.pageInfo.endCursor,
  });

  assert.equal(cursor.s, "desc");
  assert.equal(first.items[0].id, "legacy-2");
  assert.equal(second.items[0].id, "legacy-1");
});

test("hasNextPage considera a mesclagem global", async () => {
  const wixData = createFakeWixData([
    legacy(0),
    legacy(1),
    v2(0),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list({ pageSize: 2 });

  assert.equal(page.items.length, 2);
  assert.equal(page.pageInfo.hasNextPage, true);
});

test("suppressAuth true é usado por padrão no find", async () => {
  const wixData = createFakeWixData([legacy(0)]);
  const repository = createWixAppointmentsRepository({ wixData });

  await repository.list();

  assert.ok(
    wixData.findCalls.every((call) => call.options.suppressAuth === true),
  );
});

test("findOptions pode sobrescrever o padrão de leitura", async () => {
  const wixData = createFakeWixData([legacy(0)]);
  const repository = createWixAppointmentsRepository({
    wixData,
    findOptions: {
      suppressAuth: false,
      consistentRead: true,
    },
  });

  await repository.list();

  assert.ok(
    wixData.findCalls.every(
      (call) =>
        call.options.suppressAuth === false &&
        call.options.consistentRead === true,
    ),
  );
});

test("getById normaliza o registro recuperado do Wix", async () => {
  const wixData = createFakeWixData([legacy(0)]);
  const repository = createWixAppointmentsRepository({ wixData });

  const item = await repository.getById("legacy-0");

  assert.equal(item.id, "legacy-0");
  assert.equal(item.legacy, true);
  assert.deepEqual(wixData.getCalls[0], {
    collection: WIX_APPOINTMENTS_COLLECTION,
    id: "legacy-0",
    options: { suppressAuth: true },
  });
});

test("getById retorna null para ID vazio ou não encontrado", async () => {
  const wixData = createFakeWixData([legacy(0)]);
  const repository = createWixAppointmentsRepository({ wixData });

  assert.equal(await repository.getById(""), null);
  assert.equal(await repository.getById("inexistente"), null);
});

test("registros v2 de modalidades criadas pelo catálogo entram no ramo candidato", async () => {
  const wixData = createFakeWixData([
    v2(0, { modalidadeId: "mentoria_advocacia", modalidadeFamiliaId: "formacao" }),
    v2(1),
  ]);
  const repository = createWixAppointmentsRepository({ wixData });

  const page = await repository.list();

  assert.deepEqual(
    page.items.map((item) => item.id),
    ["v2-0", "v2-1"],
  );
});

test("logger recebe somente metadados técnicos de contagem", async () => {
  const wixData = createFakeWixData([legacy(0)]);
  const logs = [];
  const repository = createWixAppointmentsRepository({
    wixData,
    logger: (entry) => logs.push(entry),
  });

  await repository.list({
    requesterEmail: "advogada0@example.com",
  });

  assert.equal(logs.length, 1);

  const serialized = JSON.stringify(logs[0]);
  assert.match(serialized, /repository_wix\.read/);
  assert.doesNotMatch(serialized, /advogada0@example\.com/i);
  assert.doesNotMatch(serialized, /Advogada 0/i);
});

test("falha do logger não derruba a leitura", async () => {
  const wixData = createFakeWixData([legacy(0)]);
  const repository = createWixAppointmentsRepository({
    wixData,
    logger: () => {
      throw new Error("logger indisponível");
    },
  });

  const page = await repository.list();

  assert.equal(page.items.length, 1);
});
