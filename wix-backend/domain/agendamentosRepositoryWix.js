/**
 * Adaptador Wix Data do repositório de Agendamentos.
 *
 * O módulo não importa `wix-data` diretamente. A dependência é injetada para
 * permitir testes locais com a mesma cadeia de métodos usada no Velo. No bridge
 * de produção, passe o objeto importado de `wix-data`.
 */

import {
  APPOINTMENT_STATUS,
  MODALITY_IDS,
  normalizeAppointmentRecord,
} from "./agendamentosCore.js";
import {
  buildAppointmentQueryPlan,
  encodeAppointmentCursor,
  normalizeAppointmentQuery,
} from "./agendamentosRepository.js";

export const WIX_APPOINTMENTS_COLLECTION = "Import4259";

export const WIX_APPOINTMENTS_REPOSITORY_DEFAULTS = Object.freeze({
  collectionId: WIX_APPOINTMENTS_COLLECTION,
  suppressAuth: true,
});

const KNOWN_MODALITY_IDS = Object.freeze(Object.values(MODALITY_IDS));
const KNOWN_STATUSES = Object.freeze(Object.values(APPOINTMENT_STATUS));
const SORT_FIELDS = Object.freeze([
  "dataAtendimentoIso",
  "horarioInicio",
  "_id",
]);

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeOabForComparison(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildOabPersistenceVariants(normalizedOab) {
  const compact = normalizeOabForComparison(normalizedOab);

  if (!compact) return [];

  const match = compact.match(/^([A-Z]{2})([0-9A-Z]+)$/);

  if (!match) {
    return [compact];
  }

  const [, uf, number] = match;

  return unique([
    compact,
    `${uf}-${number}`,
    `${uf} ${number}`,
    `${uf}/${number}`,
    `${uf}.${number}`,
  ]);
}

function ensureWixData(wixData) {
  if (!wixData || typeof wixData.query !== "function") {
    throw new Error("Adaptador wix-data não informado.");
  }

  return wixData;
}

function createQuery(wixData, collectionId) {
  return ensureWixData(wixData).query(collectionId);
}

function applyDateRange(query, dateFrom, dateTo) {
  let next = query;

  if (dateFrom) {
    next = next.ge("dataAtendimentoIso", dateFrom);
  }

  if (dateTo) {
    next = next.le("dataAtendimentoIso", dateTo);
  }

  return next;
}

function applyCommonExactFilters(query, exactFilters) {
  let next = query;

  if (exactFilters.protocol) {
    next = next.eq("protocolo", exactFilters.protocol);
  }

  return next;
}

function buildLegacyEmailCondition(wixData, collectionId, email) {
  const byIndex = createQuery(wixData, collectionId).eq("emailIndex", email);
  const byPrimary = createQuery(wixData, collectionId).eq(
    "emailAdvogado",
    email,
  );

  return byIndex.or(byPrimary);
}

function buildCursorCondition(
  wixData,
  collectionId,
  cursor,
  sortDirection,
) {
  if (!cursor) return null;

  const compare = sortDirection === "desc" ? "lt" : "gt";

  const byDate = createQuery(wixData, collectionId)[compare](
    "dataAtendimentoIso",
    cursor.d,
  );

  const byTime = createQuery(wixData, collectionId)
    .eq("dataAtendimentoIso", cursor.d)
    [compare]("horarioInicio", cursor.t);

  const byId = createQuery(wixData, collectionId)
    .eq("dataAtendimentoIso", cursor.d)
    .eq("horarioInicio", cursor.t)
    [compare]("_id", cursor.i);

  return byDate.or(byTime).or(byId);
}

function applyCursor(
  query,
  wixData,
  collectionId,
  cursor,
  sortDirection,
) {
  const condition = buildCursorCondition(
    wixData,
    collectionId,
    cursor,
    sortDirection,
  );

  return condition ? query.and(condition) : query;
}

function applySortAndLimit(query, sortDirection, limit) {
  const sorted =
    sortDirection === "desc"
      ? query.descending(...SORT_FIELDS)
      : query.ascending(...SORT_FIELDS);

  return sorted.limit(limit);
}

function buildSchemaV2Query({
  wixData,
  collectionId,
  branch,
  exactFilters,
}) {
  let built = createQuery(wixData, collectionId).ge("schemaVersion", 2);

  const modalities =
    branch.filters.modalityIds.length > 0
      ? branch.filters.modalityIds
      : KNOWN_MODALITY_IDS;

  built = built.hasSome("modalidadeId", modalities);

  if (branch.filters.resourceIds.length > 0) {
    built = built.hasSome("recursoId", branch.filters.resourceIds);
  }

  if (branch.filters.statuses.length > 0) {
    built = built.hasSome("status", branch.filters.statuses);
  } else {
    const knownStatus = createQuery(wixData, collectionId).hasSome(
      "status",
      KNOWN_STATUSES,
    );
    const emptyStatus = createQuery(wixData, collectionId).isEmpty("status");
    built = built.and(knownStatus.or(emptyStatus));
  }

  built = applyDateRange(
    built,
    branch.filters.dateFrom,
    branch.filters.dateTo,
  );

  built = applyCommonExactFilters(built, exactFilters);

  if (exactFilters.requesterEmail) {
    built = built.eq("solicitanteEmail", exactFilters.requesterEmail);
  }

  if (exactFilters.oabNumber) {
    built = built.hasSome(
      "solicitanteOab",
      buildOabPersistenceVariants(exactFilters.oabNumber),
    );
  }

  return built;
}

function buildLegacyPrisonQuery({
  wixData,
  collectionId,
  branch,
  exactFilters,
}) {
  let built = createQuery(wixData, collectionId)
    .isEmpty("modalidadeId")
    .isEmpty("modalityId");

  if (branch.filters.unitSlugs.length > 0) {
    built = built.hasSome("unidadeSlug", branch.filters.unitSlugs);
  }

  if (branch.filters.statuses.length > 0) {
    built = built.hasSome("status", branch.filters.statuses);
  }

  built = applyDateRange(
    built,
    branch.filters.dateFrom,
    branch.filters.dateTo,
  );

  built = applyCommonExactFilters(built, exactFilters);

  if (exactFilters.requesterEmail) {
    built = built.and(
      buildLegacyEmailCondition(
        wixData,
        collectionId,
        exactFilters.requesterEmail,
      ),
    );
  }

  if (exactFilters.oabNumber) {
    built = built.hasSome(
      "numeroOab",
      buildOabPersistenceVariants(exactFilters.oabNumber),
    );
  }

  return built;
}

function buildWixBranchQuery({
  wixData,
  collectionId,
  branch,
  exactFilters,
}) {
  if (branch.kind === "schema-v2") {
    return buildSchemaV2Query({
      wixData,
      collectionId,
      branch,
      exactFilters,
    });
  }

  if (branch.kind === "legacy-prison") {
    return buildLegacyPrisonQuery({
      wixData,
      collectionId,
      branch,
      exactFilters,
    });
  }

  throw new Error(`Ramo de consulta desconhecido: ${text(branch.kind)}`);
}

function branchResultHasNext(result) {
  if (typeof result?.hasNext === "function") {
    try {
      return result.hasNext() === true;
    } catch {
      return false;
    }
  }

  return false;
}

function branchTotalCount(result) {
  const total = Number(result?.totalCount);
  return Number.isFinite(total) && total >= 0
    ? total
    : Array.isArray(result?.items)
      ? result.items.length
      : 0;
}

function invalidRecordDescriptor(record, error) {
  return {
    id: text(record?._id || record?.id),
    protocol: text(record?.protocolo || record?.protocol || record?.title),
    reason: error instanceof Error ? error.message : String(error),
  };
}

function normalizeBranchItems(result, branchKind) {
  const valid = [];
  const invalid = [];

  for (const record of Array.isArray(result?.items) ? result.items : []) {
    try {
      const appointment = normalizeAppointmentRecord(record);

      if (!appointment.id || !appointment.slot.dateIso || !appointment.slot.startTime) {
        invalid.push({
          ...invalidRecordDescriptor(
            record,
            new Error("Registro sem identidade temporal completa."),
          ),
          branch: branchKind,
        });
        continue;
      }

      valid.push(appointment);
    } catch (error) {
      invalid.push({
        ...invalidRecordDescriptor(record, error),
        branch: branchKind,
      });
    }
  }

  return { valid, invalid };
}

function appointmentKey(appointment) {
  return {
    d: text(appointment?.slot?.dateIso) || "9999-12-31",
    t: text(appointment?.slot?.startTime) || "99:99",
    i: text(appointment?.id),
  };
}

function compareAppointmentKeys(left, right) {
  if (left.d !== right.d) return left.d < right.d ? -1 : 1;
  if (left.t !== right.t) return left.t < right.t ? -1 : 1;
  if (left.i !== right.i) return left.i < right.i ? -1 : 1;
  return 0;
}

function compareAppointments(left, right, direction) {
  const comparison = compareAppointmentKeys(
    appointmentKey(left),
    appointmentKey(right),
  );

  return direction === "desc" ? comparison * -1 : comparison;
}

function appointmentMatchesCanonicalExactFilters(appointment, query) {
  if (
    query.protocol &&
    text(appointment.protocol).toUpperCase() !== query.protocol
  ) {
    return false;
  }

  if (
    query.requesterEmail &&
    text(appointment.requester?.email).toLowerCase() !== query.requesterEmail
  ) {
    return false;
  }

  if (
    query.oabNumber &&
    normalizeOabForComparison(appointment.requester?.oabNumber) !==
      query.oabNumber
  ) {
    return false;
  }

  return true;
}

function mergeBranchAppointments(branches, query) {
  const byId = new Map();

  for (const branch of branches) {
    for (const appointment of branch.valid) {
      if (!appointmentMatchesCanonicalExactFilters(appointment, query)) {
        continue;
      }

      if (!byId.has(appointment.id)) {
        byId.set(appointment.id, appointment);
      }
    }
  }

  return [...byId.values()].sort((left, right) =>
    compareAppointments(left, right, query.sortDirection),
  );
}

function createPageInfo({
  query,
  merged,
  branchResults,
  totalMatches,
}) {
  const items = merged.slice(0, query.pageSize);
  const last = items.at(-1) || null;
  const branchHasNext = branchResults.some((branch) => branch.hasNext);
  const hasNextPage = merged.length > query.pageSize || branchHasNext;

  return {
    items,
    pageInfo: {
      pageSize: query.pageSize,
      hasNextPage,
      endCursor: last
        ? encodeAppointmentCursor({
            v: 1,
            s: query.sortDirection,
            d: last.slot.dateIso,
            t: last.slot.startTime,
            i: last.id,
          })
        : null,
      totalMatches,
    },
  };
}

export function buildWixAppointmentQueryDescriptors(input = {}) {
  const plan = buildAppointmentQueryPlan(input);

  return plan.branches
    .filter((branch) => branch.enabled)
    .map((branch) => ({
      kind: branch.kind,
      collection: branch.collection,
      filters: branch.filters,
      exactFilters: plan.exactFilters,
      sort: plan.sort,
      pagination: plan.pagination,
    }));
}

export function createWixAppointmentsRepository({
  wixData,
  collectionId = WIX_APPOINTMENTS_REPOSITORY_DEFAULTS.collectionId,
  findOptions = {},
  logger,
} = {}) {
  ensureWixData(wixData);

  const effectiveFindOptions = {
    suppressAuth: WIX_APPOINTMENTS_REPOSITORY_DEFAULTS.suppressAuth,
    ...findOptions,
  };

  return {
    async list(input = {}) {
      const query = normalizeAppointmentQuery(input);
      const plan = buildAppointmentQueryPlan(input);
      const enabledBranches = plan.branches.filter((branch) => branch.enabled);

      const branchResults = [];

      for (const branch of enabledBranches) {
        const baseWixQuery = buildWixBranchQuery({
          wixData,
          collectionId,
          branch,
          exactFilters: plan.exactFilters,
        });

        const pagedWixQuery = applyCursor(
          baseWixQuery,
          wixData,
          collectionId,
          query.cursor,
          query.sortDirection,
        );

        const executable = applySortAndLimit(
          pagedWixQuery,
          query.sortDirection,
          query.pageSize + 1,
        );

        const result = await executable.find(effectiveFindOptions);
        const normalized = normalizeBranchItems(result, branch.kind);

        let totalCount = branchTotalCount(result);

        if (query.cursor && typeof baseWixQuery.count === "function") {
          totalCount = await baseWixQuery.count(effectiveFindOptions);
        }

        branchResults.push({
          kind: branch.kind,
          rawCount: Array.isArray(result?.items) ? result.items.length : 0,
          totalCount,
          hasNext: branchResultHasNext(result),
          ...normalized,
        });
      }

      const merged = mergeBranchAppointments(branchResults, query);
      const rawTotalMatches = branchResults.reduce(
        (sum, branch) => sum + branch.totalCount,
        0,
      );

      const canonicalFilteredOut = branchResults.reduce(
        (sum, branch) =>
          sum +
          branch.valid.filter(
            (appointment) =>
              !appointmentMatchesCanonicalExactFilters(appointment, query),
          ).length,
        0,
      );

      const invalidCount = branchResults.reduce(
        (sum, branch) => sum + branch.invalid.length,
        0,
      );

      const totalMatches = Math.max(
        0,
        rawTotalMatches - canonicalFilteredOut - invalidCount,
      );

      const page = createPageInfo({
        query,
        merged,
        branchResults,
        totalMatches,
      });

      const diagnostics = {
        invalidRecordCount: invalidCount,
        invalidRecords: branchResults
          .flatMap((branch) => branch.invalid)
          .slice(0, 20),
        branches: branchResults.map((branch) => ({
          kind: branch.kind,
          rawCount: branch.rawCount,
          totalCount: branch.totalCount,
          hasNext: branch.hasNext,
        })),
      };

      if (typeof logger === "function") {
        try {
          logger({
            event: "agendamentos.repository_wix.read",
            branchCount: branchResults.length,
            pageItemCount: page.items.length,
            hasNextPage: page.pageInfo.hasNextPage,
            invalidRecordCount: diagnostics.invalidRecordCount,
          });
        } catch {
          // Observabilidade nunca pode interromper a leitura.
        }
      }

      return {
        ...page,
        diagnostics,
      };
    },

    async getById(id) {
      const normalizedId = text(id);

      if (!normalizedId) {
        return null;
      }

      if (typeof wixData.get !== "function") {
        throw new Error("O adaptador wix-data não expõe get().");
      }

      let record;

      try {
        record = await wixData.get(
          collectionId,
          normalizedId,
          effectiveFindOptions,
        );
      } catch {
        return null;
      }

      return record ? normalizeAppointmentRecord(record) : null;
    },
  };
}

export {
  buildOabPersistenceVariants,
};
