/**
 * Shadow read da Plataforma de Agendamentos.
 *
 * O resultado legado continua sendo a resposta oficial. A leitura candidata
 * serve apenas para medir paridade e nunca pode mudar a experiência pública.
 */

export const APPOINTMENTS_SHADOW_READ_DEFAULTS = Object.freeze({
  enabled: false,
  maxDifferences: 20,
});

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function safeLog(logger, report) {
  if (typeof logger !== "function") return;

  try {
    logger(report);
  } catch {
    // Falha de observabilidade não pode afetar a resposta oficial.
  }
}

function appointmentKey(appointment) {
  return (
    text(appointment?.id) ||
    text(appointment?.protocol) ||
    text(appointment?.slot?.identity)
  );
}

function comparableFingerprint(appointment) {
  return {
    id: text(appointment?.id),
    protocol: text(appointment?.protocol),
    modalityId: text(appointment?.modalityId),
    status: text(appointment?.status),
    resourceId: text(appointment?.resourceId),
    slotIdentity: text(appointment?.slot?.identity),
    dateIso: text(appointment?.slot?.dateIso),
    startTime: text(appointment?.slot?.startTime),
    endTime: text(appointment?.slot?.endTime),
    durationMinutes: Number(appointment?.slot?.durationMinutes || 0),
    originAppointmentId: text(
      appointment?.relationships?.originAppointmentId,
    ),
    rescheduledToAppointmentId: text(
      appointment?.relationships?.rescheduledToAppointmentId,
    ),
  };
}

function changedFields(primary, candidate) {
  const primaryFingerprint = comparableFingerprint(primary);
  const candidateFingerprint = comparableFingerprint(candidate);
  const fields = [];

  for (const field of Object.keys(primaryFingerprint)) {
    if (primaryFingerprint[field] !== candidateFingerprint[field]) {
      fields.push(field);
    }
  }

  return fields;
}

function pageItems(page) {
  return Array.isArray(page?.items) ? page.items : [];
}

export function compareAppointmentRepositoryPages(
  primaryPage,
  candidatePage,
  { maxDifferences = APPOINTMENTS_SHADOW_READ_DEFAULTS.maxDifferences } = {},
) {
  const primaryItems = pageItems(primaryPage);
  const candidateItems = pageItems(candidatePage);
  const primaryMap = new Map();
  const candidateMap = new Map();

  for (const item of primaryItems) {
    primaryMap.set(appointmentKey(item), item);
  }

  for (const item of candidateItems) {
    candidateMap.set(appointmentKey(item), item);
  }

  const missingInCandidate = [];
  const unexpectedInCandidate = [];
  const changed = [];

  for (const [key, primaryItem] of primaryMap) {
    if (!candidateMap.has(key)) {
      missingInCandidate.push(key);
      continue;
    }

    const fields = changedFields(primaryItem, candidateMap.get(key));

    if (fields.length > 0) {
      changed.push({ key, fields });
    }
  }

  for (const key of candidateMap.keys()) {
    if (!primaryMap.has(key)) {
      unexpectedInCandidate.push(key);
    }
  }

  const primaryOrder = primaryItems.map(appointmentKey);
  const candidateOrder = candidateItems.map(appointmentKey);
  const orderMismatch =
    JSON.stringify(primaryOrder) !== JSON.stringify(candidateOrder);

  const pageInfoMismatch = {
    hasNextPage:
      Boolean(primaryPage?.pageInfo?.hasNextPage) !==
      Boolean(candidatePage?.pageInfo?.hasNextPage),
    totalMatches:
      Number(primaryPage?.pageInfo?.totalMatches ?? -1) !==
      Number(candidatePage?.pageInfo?.totalMatches ?? -1),
  };

  const parity =
    missingInCandidate.length === 0 &&
    unexpectedInCandidate.length === 0 &&
    changed.length === 0 &&
    !orderMismatch &&
    !pageInfoMismatch.hasNextPage &&
    !pageInfoMismatch.totalMatches;

  return {
    parity,
    primaryCount: primaryItems.length,
    candidateCount: candidateItems.length,
    missingInCandidate: missingInCandidate.slice(0, maxDifferences),
    unexpectedInCandidate: unexpectedInCandidate.slice(0, maxDifferences),
    changed: changed.slice(0, maxDifferences),
    orderMismatch,
    pageInfoMismatch,
    truncated:
      missingInCandidate.length > maxDifferences ||
      unexpectedInCandidate.length > maxDifferences ||
      changed.length > maxDifferences,
  };
}

export function resolveAppointmentShadowReadEnabled(value) {
  if (value === true) return true;

  const normalized = text(value).toLowerCase();
  return ["1", "true", "on", "enabled"].includes(normalized);
}

export async function runAppointmentShadowRead({
  query,
  primaryReader,
  candidateReader,
  enabled = APPOINTMENTS_SHADOW_READ_DEFAULTS.enabled,
  logger,
  requestId = "",
  maxDifferences = APPOINTMENTS_SHADOW_READ_DEFAULTS.maxDifferences,
}) {
  if (typeof primaryReader !== "function") {
    throw new Error("Leitor primário não informado.");
  }

  const primaryResult = await primaryReader(query);

  if (!resolveAppointmentShadowReadEnabled(enabled)) {
    return {
      result: primaryResult,
      shadow: {
        enabled: false,
        status: "disabled",
      },
    };
  }

  if (typeof candidateReader !== "function") {
    const report = {
      enabled: true,
      status: "candidate_unavailable",
      requestId: text(requestId),
    };

    safeLog(logger, report);

    return {
      result: primaryResult,
      shadow: report,
    };
  }

  const startedAt = Date.now();

  try {
    const candidateResult = await candidateReader(query);
    const comparison = compareAppointmentRepositoryPages(
      primaryResult,
      candidateResult,
      { maxDifferences },
    );

    const report = {
      enabled: true,
      status: "completed",
      requestId: text(requestId),
      durationMs: Date.now() - startedAt,
      ...comparison,
    };

    safeLog(logger, report);

    return {
      result: primaryResult,
      shadow: report,
    };
  } catch (error) {
    const report = {
      enabled: true,
      status: "candidate_error",
      requestId: text(requestId),
      durationMs: Date.now() - startedAt,
      errorCode: "APPOINTMENTS_SHADOW_READ_FAILED",
      errorMessage:
        error instanceof Error ? error.message : "Falha desconhecida.",
    };

    safeLog(logger, report);

    return {
      result: primaryResult,
      shadow: report,
    };
  }
}
