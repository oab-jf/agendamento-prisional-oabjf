/**
 * Semântica de consulta e paginação da Plataforma de Agendamentos.
 *
 * Este arquivo é uma referência pura e independente do Wix. A futura camada
 * de persistência deverá produzir o mesmo resultado, inclusive para registros
 * legados do Atendimento Prisional.
 */

import {
  APPOINTMENT_STATUS,
  MODALITY_IDS,
  getModalityDefinition,
  normalizeAppointmentRecord,
} from "backend/agendamentosCore";

export const APPOINTMENTS_QUERY_VERSION = 1;
export const DEFAULT_APPOINTMENTS_PAGE_SIZE = 25;
export const MAX_APPOINTMENTS_PAGE_SIZE = 100;

const SORT_DIRECTIONS = Object.freeze(["asc", "desc"]);
const KNOWN_STATUSES = Object.freeze(Object.values(APPOINTMENT_STATUS));
const DATE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURSOR_VERSION = 1;

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function normalizeArray(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return uniqueSorted(source.map((item) => text(item)).filter(Boolean));
}

function normalizeDateIso(value, fieldName) {
  const normalized = text(value);

  if (!normalized) return "";

  if (!DATE_ISO_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} deve usar o formato AAAA-MM-DD.`);
  }

  return normalized;
}

function normalizeOabNumber(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizePositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function normalizeModalityIds(value) {
  const ids = normalizeArray(value);

  for (const modalityId of ids) {
    if (!getModalityDefinition(modalityId)) {
      throw new Error(`Modalidade desconhecida: ${modalityId}`);
    }
  }

  return ids;
}

function normalizeStatuses(value) {
  const statuses = normalizeArray(value).map((status) => status.toLowerCase());

  for (const status of statuses) {
    if (!KNOWN_STATUSES.includes(status)) {
      throw new Error(`Status de agendamento desconhecido: ${status}`);
    }
  }

  return uniqueSorted(statuses);
}

function normalizeSortDirection(value) {
  const direction = text(value).toLowerCase() || "asc";

  if (!SORT_DIRECTIONS.includes(direction)) {
    throw new Error(`Direção de ordenação inválida: ${direction}`);
  }

  return direction;
}

function cursorPayloadFromAppointment(appointment, direction) {
  return {
    v: CURSOR_VERSION,
    s: direction,
    d: appointment.slot.dateIso,
    t: appointment.slot.startTime,
    i: appointment.id,
  };
}

export function encodeAppointmentCursor(payload) {
  const normalized = {
    v: Number(payload?.v) || CURSOR_VERSION,
    s: normalizeSortDirection(payload?.s),
    d: normalizeDateIso(payload?.d, "Data do cursor"),
    t: text(payload?.t),
    i: text(payload?.i),
  };

  if (!normalized.t || !normalized.i) {
    throw new Error("Cursor incompleto.");
  }

  return encodeURIComponent(JSON.stringify(normalized));
}

export function decodeAppointmentCursor(cursor) {
  if (!cursor) return null;

  let parsed;

  try {
    parsed = JSON.parse(decodeURIComponent(String(cursor)));
  } catch {
    throw new Error("Cursor inválido.");
  }

  if (Number(parsed?.v) !== CURSOR_VERSION) {
    throw new Error("Versão de cursor incompatível.");
  }

  const normalized = {
    v: CURSOR_VERSION,
    s: normalizeSortDirection(parsed.s),
    d: normalizeDateIso(parsed.d, "Data do cursor"),
    t: text(parsed.t),
    i: text(parsed.i),
  };

  if (!normalized.t || !normalized.i) {
    throw new Error("Cursor incompleto.");
  }

  return normalized;
}

export function normalizeAppointmentQuery(input = {}) {
  const dateFrom = normalizeDateIso(input.dateFrom, "Data inicial");
  const dateTo = normalizeDateIso(input.dateTo, "Data final");

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("A data inicial não pode ser posterior à data final.");
  }

  const sortDirection = normalizeSortDirection(input.sortDirection);
  const cursor = decodeAppointmentCursor(input.cursor);

  if (cursor && cursor.s !== sortDirection) {
    throw new Error("O cursor não corresponde à direção de ordenação.");
  }

  return {
    version: APPOINTMENTS_QUERY_VERSION,
    modalityIds: normalizeModalityIds(input.modalityIds),
    resourceIds: normalizeArray(input.resourceIds),
    statuses: normalizeStatuses(input.statuses),
    dateFrom,
    dateTo,
    protocol: text(input.protocol).toUpperCase(),
    requesterEmail: text(input.requesterEmail).toLowerCase(),
    oabNumber: normalizeOabNumber(input.oabNumber),
    includeLegacy: input.includeLegacy !== false,
    sortDirection,
    pageSize: normalizePositiveInteger(
      input.pageSize,
      DEFAULT_APPOINTMENTS_PAGE_SIZE,
      MAX_APPOINTMENTS_PAGE_SIZE,
    ),
    cursor,
  };
}

function appointmentSortKey(appointment) {
  return {
    d: appointment.slot.dateIso || "9999-12-31",
    t: appointment.slot.startTime || "99:99",
    i: appointment.id || appointment.protocol || appointment.slot.identity,
  };
}

function compareKeys(left, right) {
  if (left.d !== right.d) return left.d < right.d ? -1 : 1;
  if (left.t !== right.t) return left.t < right.t ? -1 : 1;
  if (left.i !== right.i) return left.i < right.i ? -1 : 1;
  return 0;
}

function compareAppointments(left, right, direction) {
  const comparison = compareKeys(
    appointmentSortKey(left),
    appointmentSortKey(right),
  );

  return direction === "desc" ? comparison * -1 : comparison;
}

function isAfterCursor(appointment, cursor) {
  if (!cursor) return true;

  const comparison = compareKeys(appointmentSortKey(appointment), cursor);
  return cursor.s === "desc" ? comparison < 0 : comparison > 0;
}

function appointmentMatchesQuery(appointment, query) {
  if (!query.includeLegacy && appointment.legacy) return false;

  if (
    query.modalityIds.length > 0 &&
    !query.modalityIds.includes(appointment.modalityId)
  ) {
    return false;
  }

  if (
    query.resourceIds.length > 0 &&
    !query.resourceIds.includes(appointment.resourceId)
  ) {
    return false;
  }

  if (
    query.statuses.length > 0 &&
    !query.statuses.includes(appointment.status)
  ) {
    return false;
  }

  if (query.dateFrom && appointment.slot.dateIso < query.dateFrom) {
    return false;
  }

  if (query.dateTo && appointment.slot.dateIso > query.dateTo) {
    return false;
  }

  if (query.protocol && appointment.protocol.toUpperCase() !== query.protocol) {
    return false;
  }

  if (
    query.requesterEmail &&
    appointment.requester.email.toLowerCase() !== query.requesterEmail
  ) {
    return false;
  }

  if (
    query.oabNumber &&
    normalizeOabNumber(appointment.requester.oabNumber) !== query.oabNumber
  ) {
    return false;
  }

  return true;
}

function invalidRecordDescriptor(record, error) {
  return {
    id: text(record?._id || record?.id),
    protocol: text(record?.protocolo || record?.protocol || record?.title),
    reason: error instanceof Error ? error.message : String(error),
  };
}

export function executeReferenceAppointmentQuery(records, input = {}) {
  const query = normalizeAppointmentQuery(input);
  const normalizedRecords = [];
  const invalidRecords = [];

  for (const record of Array.isArray(records) ? records : []) {
    try {
      const normalized = normalizeAppointmentRecord(record);

      if (
        !normalized.id ||
        !normalized.slot.dateIso ||
        !normalized.slot.startTime
      ) {
        invalidRecords.push({
          ...invalidRecordDescriptor(
            record,
            new Error("Registro sem identidade temporal completa."),
          ),
          issues: normalized.compatibility.issues,
        });
        continue;
      }

      normalizedRecords.push(normalized);
    } catch (error) {
      invalidRecords.push(invalidRecordDescriptor(record, error));
    }
  }

  const matches = normalizedRecords
    .filter((appointment) => appointmentMatchesQuery(appointment, query))
    .sort((left, right) =>
      compareAppointments(left, right, query.sortDirection),
    );

  const afterCursor = matches.filter((appointment) =>
    isAfterCursor(appointment, query.cursor),
  );

  const pageItems = afterCursor.slice(0, query.pageSize);
  const hasNextPage = afterCursor.length > query.pageSize;
  const lastItem = pageItems.at(-1) || null;

  return {
    items: pageItems,
    pageInfo: {
      pageSize: query.pageSize,
      hasNextPage,
      endCursor: lastItem
        ? encodeAppointmentCursor(
            cursorPayloadFromAppointment(lastItem, query.sortDirection),
          )
        : null,
      totalMatches: matches.length,
    },
    diagnostics: {
      invalidRecordCount: invalidRecords.length,
      invalidRecords: invalidRecords.slice(0, 20),
    },
  };
}

export function buildAppointmentQueryPlan(input = {}) {
  const query = normalizeAppointmentQuery(input);
  const includesPrison =
    query.modalityIds.length === 0 ||
    query.modalityIds.includes(MODALITY_IDS.PRISIONAL_VIRTUAL);

  const v2Modalities =
    query.modalityIds.length > 0
      ? query.modalityIds
      : Object.values(MODALITY_IDS);

  const legacyUnitSlugs = query.resourceIds
    .filter((resourceId) => resourceId.startsWith("prisional:"))
    .map((resourceId) => resourceId.slice("prisional:".length))
    .filter(Boolean);

  const legacyResourceFilterCompatible =
    query.resourceIds.length === 0 || legacyUnitSlugs.length > 0;

  const branches = [
    {
      kind: "schema-v2",
      enabled: true,
      collection: "Import4259",
      filters: {
        schemaVersionMinimum: 2,
        modalityIds: v2Modalities,
        resourceIds: query.resourceIds,
        statuses: query.statuses,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    },
    {
      kind: "legacy-prison",
      enabled:
        query.includeLegacy &&
        includesPrison &&
        legacyResourceFilterCompatible,
      collection: "Import4259",
      filters: {
        modalityFieldMissing: true,
        unitSlugs: legacyUnitSlugs,
        statuses: query.statuses,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    },
  ];

  return {
    version: APPOINTMENTS_QUERY_VERSION,
    branches,
    sort: {
      fields: ["dataAtendimentoIso", "horarioInicio", "_id"],
      direction: query.sortDirection,
    },
    pagination: {
      mode: "cursor",
      pageSize: query.pageSize,
      fetchLimitPerBranch: query.pageSize + 1,
      cursor: query.cursor,
    },
    exactFilters: {
      protocol: query.protocol,
      requesterEmail: query.requesterEmail,
      oabNumber: query.oabNumber,
    },
  };
}

export function createReferenceAppointmentsRepository(initialRecords = []) {
  let records = Array.isArray(initialRecords) ? [...initialRecords] : [];

  return {
    async list(input = {}) {
      return executeReferenceAppointmentQuery(records, input);
    },

    async getById(id) {
      const normalizedId = text(id);
      const record = records.find(
        (item) => text(item?._id || item?.id) === normalizedId,
      );

      return record ? normalizeAppointmentRecord(record) : null;
    },

    replaceRecords(nextRecords) {
      records = Array.isArray(nextRecords) ? [...nextRecords] : [];
    },
  };
}
