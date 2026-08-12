/**
 * Ponte entre a listagem administrativa legada e o shadow read v2.
 *
 * A resposta oficial continua sendo produzida por adminApi.js.
 * Quando a flag está desligada, esta função retorna antes de instanciar ou
 * consultar o repositório candidato.
 *
 * Quando habilitada futuramente, a comparação só roda se a leitura primária
 * representar o conjunto completo dos filtros suportados. Busca textual ampla
 * e resultados truncados são deliberadamente ignorados para evitar falsos
 * diagnósticos de paridade.
 */

import {
  MODALITY_IDS,
} from "./agendamentosCore.js";
import {
  executeReferenceAppointmentQuery,
} from "./agendamentosRepository.js";
import {
  createWixAppointmentsRepository,
} from "./agendamentosRepositoryWix.js";
import {
  createWixAppointmentsShadowReader,
} from "./agendamentosShadowReadWix.js";

export const ADMIN_APPOINTMENTS_SHADOW_DEFAULTS = Object.freeze({
  enabled: false,
  pageSize: 100,
  collectionId: "Import4259",
});

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeSearch(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function safeLog(logger, report) {
  if (typeof logger !== "function") return;

  try {
    logger(report);
  } catch {
    // Observabilidade nunca pode afetar a listagem oficial.
  }
}

function makeRequestId() {
  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join("-");
}

export function buildAdminAppointmentsShadowQuery(
  filtros = {},
  {
    pageSize = ADMIN_APPOINTMENTS_SHADOW_DEFAULTS.pageSize,
  } = {},
) {
  const unidadeSlug = text(
    filtros.unidadeSlug || filtros.unidade || filtros.slug,
  ).toLowerCase();
  const status = text(filtros.status).toLowerCase();
  const dataIso = text(
    filtros.dataIso || filtros.data || filtros.dataAtendimentoIso,
  );
  const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);

  if (busca) {
    return {
      supported: false,
      reason: "unsupported_text_search",
    };
  }

  if (dataIso && !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
    return {
      supported: false,
      reason: "invalid_date_filter",
    };
  }

  return {
    supported: true,
    query: {
      modalityIds: [MODALITY_IDS.PRISIONAL_VIRTUAL],
      resourceIds:
        unidadeSlug && unidadeSlug !== "todos"
          ? [`prisional:${unidadeSlug}`]
          : [],
      statuses:
        status && status !== "todos"
          ? [status]
          : [],
      dateFrom: dataIso || "",
      dateTo: dataIso || "",
      includeLegacy: true,
      sortDirection: "desc",
      pageSize,
    },
  };
}

export function buildPrimaryAdminShadowPage(rawResult, query) {
  const items = Array.isArray(rawResult?.items) ? rawResult.items : [];
  const totalCount = Number(rawResult?.totalCount);

  if (!Number.isFinite(totalCount) || totalCount < 0) {
    return {
      supported: false,
      reason: "primary_total_unknown",
    };
  }

  if (totalCount > items.length) {
    return {
      supported: false,
      reason: "primary_result_truncated",
      totalCount,
      itemCount: items.length,
    };
  }

  return {
    supported: true,
    page: executeReferenceAppointmentQuery(items, query),
  };
}

export async function observeAdminAppointmentsShadowRead({
  wixData,
  rawResult,
  filtros = {},
  enabled = ADMIN_APPOINTMENTS_SHADOW_DEFAULTS.enabled,
  logger,
  requestIdFactory = makeRequestId,
  collectionId = ADMIN_APPOINTMENTS_SHADOW_DEFAULTS.collectionId,
  findOptions = {},
} = {}) {
  if (enabled !== true) {
    return {
      enabled: false,
      status: "disabled",
    };
  }

  const requestId =
    typeof requestIdFactory === "function"
      ? text(requestIdFactory())
      : "";

  try {
    const translated = buildAdminAppointmentsShadowQuery(filtros);

    if (!translated.supported) {
      const report = {
        enabled: true,
        status: "skipped",
        requestId,
        reason: translated.reason,
      };

      safeLog(logger, report);
      return report;
    }

    const primary = buildPrimaryAdminShadowPage(
      rawResult,
      translated.query,
    );

    if (!primary.supported) {
      const report = {
        enabled: true,
        status: "skipped",
        requestId,
        reason: primary.reason,
        totalCount: Number(primary.totalCount || 0),
        itemCount: Number(primary.itemCount || 0),
      };

      safeLog(logger, report);
      return report;
    }

    const candidateRepository = createWixAppointmentsRepository({
      wixData,
      collectionId,
      findOptions,
    });

    const readWithShadow = createWixAppointmentsShadowReader({
      primaryReader: async () => primary.page,
      candidateRepository,
      enabled: true,
      logger,
      requestIdFactory: () => requestId,
    });

    const outcome = await readWithShadow(translated.query);

    return outcome.shadow;
  } catch (error) {
    const report = {
      enabled: true,
      status: "bridge_error",
      requestId,
      errorCode: "ADMIN_APPOINTMENTS_SHADOW_BRIDGE_FAILED",
      errorMessage:
        error instanceof Error ? error.message : "Falha desconhecida.",
    };

    safeLog(logger, report);
    return report;
  }
}
