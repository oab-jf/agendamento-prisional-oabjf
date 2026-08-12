/**
 * Wiring de shadow read para o candidato Wix Data.
 *
 * A flag é OFF por padrão. Este módulo não altera endpoints nem ativa leitura
 * paralela por conta própria; ele apenas compõe o leitor primário com o
 * repositório candidato quando uma integração futura decidir habilitá-lo.
 */

import {
  APPOINTMENTS_SHADOW_READ_DEFAULTS,
  resolveAppointmentShadowReadEnabled,
  runAppointmentShadowRead,
} from "backend/agendamentosShadowRead";

export const APPOINTMENTS_WIX_SHADOW_READ = Object.freeze({
  flagName: "agendamentos.repositoryV2.shadowRead",
  defaultEnabled: false,
});

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function createWixAppointmentsShadowReader({
  primaryReader,
  candidateRepository,
  enabled = APPOINTMENTS_WIX_SHADOW_READ.defaultEnabled,
  logger,
  requestIdFactory,
  maxDifferences = APPOINTMENTS_SHADOW_READ_DEFAULTS.maxDifferences,
} = {}) {
  if (typeof primaryReader !== "function") {
    throw new Error("Leitor primário não informado.");
  }

  if (
    !candidateRepository ||
    typeof candidateRepository.list !== "function"
  ) {
    throw new Error("Repositório candidato Wix não informado.");
  }

  const featureEnabled = resolveAppointmentShadowReadEnabled(enabled);

  return async function readWithShadow(input = {}) {
    const requestId =
      typeof requestIdFactory === "function"
        ? text(requestIdFactory())
        : "";

    return runAppointmentShadowRead({
      query: input,
      primaryReader,
      candidateReader: (query) => candidateRepository.list(query),
      enabled: featureEnabled,
      logger,
      requestId,
      maxDifferences,
    });
  };
}
