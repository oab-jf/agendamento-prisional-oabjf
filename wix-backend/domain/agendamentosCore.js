/**
 * Núcleo puro da Plataforma de Agendamentos da OAB/JF.
 *
 * Não importa APIs do Wix. Pode ser executado no Velo e em testes Node.
 * Nesta primeira versão, somente o Atendimento Prisional está habilitado.
 */

export const AGENDAMENTOS_SCHEMA_VERSION = 2;
export const AGENDAMENTOS_TIME_ZONE = "America/Sao_Paulo";

export const MODALITY_FAMILY_IDS = Object.freeze({
  PRISIONAL: "prisional",
  ESPACOS_PROFISSIONAIS: "espacos_profissionais",
  PJE: "pje",
});

export const MODALITY_IDS = Object.freeze({
  PRISIONAL_VIRTUAL: "prisional_virtual",
  ESPACO_ATENDIMENTO: "espaco_atendimento",
  ESPACO_INDIVIDUAL: "espaco_individual",
  ESPACO_REUNIAO: "espaco_reuniao",
  PJE_SUPORTE_INSTALACAO: "pje_suporte_instalacao",
});

export const APPOINTMENT_STATUS = Object.freeze({
  AGENDADO: "agendado",
  CANCELADO: "cancelado",
  REAGENDADO: "reagendado",
  REALIZADO: "realizado",
  NAO_COMPARECEU: "nao_compareceu",
});

const OCCUPYING_STATUSES = Object.freeze([APPOINTMENT_STATUS.AGENDADO]);
const KNOWN_STATUSES = Object.freeze(Object.values(APPOINTMENT_STATUS));
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function normalizeDateIsoLoose(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const match = text(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function normalizeTimeLoose(value) {
  const match = text(value).match(/^([0-2]\d:[0-5]\d)/);
  return match && TIME_PATTERN.test(match[1]) ? match[1] : "";
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function addMinutesToTime(startTime, minutes) {
  if (!TIME_PATTERN.test(startTime)) return "";

  const [hour, minute] = startTime.split(":").map(Number);
  const total = hour * 60 + minute + minutes;

  if (total < 0 || total >= 24 * 60) return "";

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

function durationBetween(startTime, endTime) {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return null;
  }

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const duration =
    endHour * 60 + endMinute - (startHour * 60 + startMinute);

  return duration > 0 ? duration : null;
}

function encodeSlotPart(value) {
  return encodeURIComponent(text(value));
}

function defineModality(definition) {
  return deepFreeze({
    enabled: false,
    configurationStatus: "pending",
    supports: {
      cancellation: true,
      rescheduling: true,
      documents: false,
    },
    defaults: {
      durationMinutes: null,
      capacity: null,
    },
    ...definition,
  });
}

export const MODALITY_CATALOG = deepFreeze({
  [MODALITY_IDS.PRISIONAL_VIRTUAL]: defineModality({
    id: MODALITY_IDS.PRISIONAL_VIRTUAL,
    familyId: MODALITY_FAMILY_IDS.PRISIONAL,
    publicName: "Atendimento Prisional",
    adminName: "Atendimento prisional virtual",
    enabled: true,
    configurationStatus: "legacy-compatible",
    supports: {
      cancellation: true,
      rescheduling: true,
      documents: true,
    },
    defaults: {
      durationMinutes: 30,
      capacity: 1,
    },
  }),

  [MODALITY_IDS.ESPACO_ATENDIMENTO]: defineModality({
    id: MODALITY_IDS.ESPACO_ATENDIMENTO,
    familyId: MODALITY_FAMILY_IDS.ESPACOS_PROFISSIONAIS,
    publicName: "Sala para atendimento",
    adminName: "Espaço para atendimento",
  }),

  [MODALITY_IDS.ESPACO_INDIVIDUAL]: defineModality({
    id: MODALITY_IDS.ESPACO_INDIVIDUAL,
    familyId: MODALITY_FAMILY_IDS.ESPACOS_PROFISSIONAIS,
    publicName: "Sala ou escritório individual",
    adminName: "Espaço individual",
  }),

  [MODALITY_IDS.ESPACO_REUNIAO]: defineModality({
    id: MODALITY_IDS.ESPACO_REUNIAO,
    familyId: MODALITY_FAMILY_IDS.ESPACOS_PROFISSIONAIS,
    publicName: "Sala de reunião",
    adminName: "Sala de reunião",
  }),

  [MODALITY_IDS.PJE_SUPORTE_INSTALACAO]: defineModality({
    id: MODALITY_IDS.PJE_SUPORTE_INSTALACAO,
    familyId: MODALITY_FAMILY_IDS.PJE,
    publicName: "Suporte e instalação do PJe",
    adminName: "Suporte PJe",
  }),
});

export function getModalityDefinition(modalityId) {
  return MODALITY_CATALOG[text(modalityId)] || null;
}

export function listModalityDefinitions({ includeDisabled = false } = {}) {
  return Object.values(MODALITY_CATALOG).filter(
    (definition) => includeDisabled || definition.enabled,
  );
}

export function normalizeAppointmentStatus(value, { legacy = false } = {}) {
  const normalized = text(value).toLowerCase() || APPOINTMENT_STATUS.AGENDADO;

  if (KNOWN_STATUSES.includes(normalized)) {
    return normalized;
  }

  if (legacy) {
    return APPOINTMENT_STATUS.AGENDADO;
  }

  throw new Error(`Status de agendamento desconhecido: ${normalized}`);
}

export function appointmentStatusOccupiesCapacity(status) {
  return OCCUPYING_STATUSES.includes(
    normalizeAppointmentStatus(status, { legacy: true }),
  );
}

export function buildLegacyPrisonSlotKey({
  unitSlug,
  dateIso,
  startTime,
}) {
  const normalizedUnit = text(unitSlug).toLowerCase();
  const normalizedDate = normalizeDateIsoLoose(dateIso);
  const normalizedTime = normalizeTimeLoose(startTime);

  if (!normalizedUnit || !normalizedDate || !normalizedTime) {
    throw new Error(
      "Unidade, data e horário são obrigatórios para a chave de slot legada.",
    );
  }

  return `${normalizedUnit}|${normalizedDate}|${normalizedTime}`;
}

export function buildSlotIdentity({
  modalityId,
  resourceId,
  dateIso,
  startTime,
}) {
  const definition = getModalityDefinition(modalityId);
  const normalizedResource = text(resourceId);
  const normalizedDate = normalizeDateIsoLoose(dateIso);
  const normalizedTime = normalizeTimeLoose(startTime);

  if (!definition) {
    throw new Error(`Modalidade desconhecida: ${text(modalityId)}`);
  }

  if (!normalizedResource || !normalizedDate || !normalizedTime) {
    throw new Error(
      "Modalidade, recurso, data e horário são obrigatórios para a identidade do slot.",
    );
  }

  return [
    "v2",
    encodeSlotPart(definition.id),
    encodeSlotPart(normalizedResource),
    normalizedDate,
    normalizedTime,
  ].join("|");
}

export function adaptLegacyPrisonAppointment(record = {}) {
  const unitSlug = text(
    record.unidadeSlug ||
      record.unidadeslug ||
      record.unidade_slug ||
      record.unidadeId ||
      record.unidade,
  ).toLowerCase();

  const dateIso = normalizeDateIsoLoose(
    record.dataAtendimentoIso ||
      record.dataAtendimentoISO ||
      record.dataatendimentoiso ||
      record.dataAtendimento ||
      record.dataIso ||
      record.data,
  );

  const startTime = normalizeTimeLoose(
    record.horarioInicio || record.horario || record.horaInicio,
  );

  const explicitEndTime = normalizeTimeLoose(
    record.horarioFim || record.horarioFinal || record.horaFim,
  );

  const durationMinutes =
    durationBetween(startTime, explicitEndTime) ||
    normalizePositiveInteger(record.duracaoMinutos, 30);

  const endTime =
    explicitEndTime || addMinutesToTime(startTime, durationMinutes);

  const resourceId = unitSlug ? `prisional:${unitSlug}` : "";
  const issues = [];

  if (!unitSlug) issues.push("unidade_ausente");
  if (!dateIso) issues.push("data_ausente_ou_invalida");
  if (!startTime) issues.push("horario_ausente_ou_invalido");

  const slotIdentity =
    resourceId && dateIso && startTime
      ? buildSlotIdentity({
          modalityId: MODALITY_IDS.PRISIONAL_VIRTUAL,
          resourceId,
          dateIso,
          startTime,
        })
      : "";

  const legacySlotKey =
    unitSlug && dateIso && startTime
      ? buildLegacyPrisonSlotKey({
          unitSlug,
          dateIso,
          startTime,
        })
      : text(record.slotKey);

  return {
    id: text(record._id || record.id),
    schemaVersion: AGENDAMENTOS_SCHEMA_VERSION,
    sourceSchemaVersion: 1,
    legacy: true,

    modalityId: MODALITY_IDS.PRISIONAL_VIRTUAL,
    modalityFamilyId: MODALITY_FAMILY_IDS.PRISIONAL,

    protocol: text(record.protocolo || record.title),
    status: normalizeAppointmentStatus(record.status, { legacy: true }),

    locationId: text(record.localId || record.locationId),
    resourceId,
    offerId: text(record.ofertaId || record.offerId) ||
      (unitSlug ? `prisional:${unitSlug}` : ""),

    slot: {
      identity: slotIdentity,
      legacyKey: legacySlotKey,
      dateIso,
      startTime,
      endTime,
      durationMinutes,
      timeZone: AGENDAMENTOS_TIME_ZONE,
    },

    requester: {
      name: text(record.nomeAdvogado),
      oabNumber: text(record.numeroOab),
      email: text(record.emailAdvogado).toLowerCase(),
      phone: text(record.telefoneAdvogado),
    },

    specificData: {
      prison: {
        unitSlug,
        unitName: text(record.unidadeNome),
        assistedPersonName: text(record.nomeIpl),
        infopen: text(record.infopen),
      },
    },

    relationships: {
      originAppointmentId: text(record.agendamentoOrigemId),
      originProtocol: text(record.protocoloOrigem),
      rescheduledToAppointmentId: text(record.reagendadoParaId),
      rescheduledToProtocol: text(record.reagendadoParaProtocolo),
    },

    compatibility: {
      sourceCollection: "Import4259",
      issues,
    },
  };
}

function normalizeVersionedAppointment(record) {
  const modalityId = text(record.modalidadeId || record.modalityId);
  const definition = getModalityDefinition(modalityId);

  if (!definition) {
    throw new Error(`Modalidade desconhecida: ${modalityId || "(vazia)"}`);
  }

  const resourceId = text(record.recursoId || record.resourceId);
  const dateIso = normalizeDateIsoLoose(
    record.dataAtendimentoIso || record.dataIso || record.dateIso,
  );
  const startTime = normalizeTimeLoose(
    record.horarioInicio || record.startTime,
  );

  const durationMinutes = normalizePositiveInteger(
    record.duracaoMinutos || record.durationMinutes,
    definition.defaults.durationMinutes || 30,
  );

  const endTime =
    normalizeTimeLoose(record.horarioFim || record.endTime) ||
    addMinutesToTime(startTime, durationMinutes);

  const slotIdentity =
    resourceId && dateIso && startTime
      ? buildSlotIdentity({
          modalityId,
          resourceId,
          dateIso,
          startTime,
        })
      : "";

  return {
    id: text(record._id || record.id),
    schemaVersion: AGENDAMENTOS_SCHEMA_VERSION,
    sourceSchemaVersion: Number(record.schemaVersion) || 2,
    legacy: false,

    modalityId,
    modalityFamilyId: definition.familyId,

    protocol: text(record.protocolo || record.protocol || record.title),
    status: normalizeAppointmentStatus(record.status),

    locationId: text(record.localId || record.locationId),
    resourceId,
    offerId: text(record.ofertaId || record.offerId),

    slot: {
      identity: slotIdentity,
      legacyKey: text(record.slotKeyLegado || record.legacySlotKey),
      dateIso,
      startTime,
      endTime,
      durationMinutes,
      timeZone: text(record.timeZone) || AGENDAMENTOS_TIME_ZONE,
    },

    requester: {
      name: text(record.solicitanteNome || record.requester?.name),
      oabNumber: text(
        record.solicitanteOab || record.requester?.oabNumber,
      ),
      email: text(
        record.solicitanteEmail || record.requester?.email,
      ).toLowerCase(),
      phone: text(
        record.solicitanteTelefone || record.requester?.phone,
      ),
    },

    specificData:
      record.dadosEspecificos && typeof record.dadosEspecificos === "object"
        ? record.dadosEspecificos
        : record.specificData && typeof record.specificData === "object"
          ? record.specificData
          : {},

    relationships: {
      originAppointmentId: text(
        record.agendamentoOrigemId || record.relationships?.originAppointmentId,
      ),
      originProtocol: text(
        record.protocoloOrigem || record.relationships?.originProtocol,
      ),
      rescheduledToAppointmentId: text(
        record.reagendadoParaId ||
          record.relationships?.rescheduledToAppointmentId,
      ),
      rescheduledToProtocol: text(
        record.reagendadoParaProtocolo ||
          record.relationships?.rescheduledToProtocol,
      ),
    },

    compatibility: {
      sourceCollection: text(record.sourceCollection) || "Import4259",
      issues:
        resourceId && dateIso && startTime
          ? []
          : ["slot_incompleto"],
    },
  };
}

export function normalizeAppointmentRecord(record = {}) {
  const version = Number(record.schemaVersion || 0);
  const modalityId = text(record.modalidadeId || record.modalityId);

  if (version >= AGENDAMENTOS_SCHEMA_VERSION || modalityId) {
    return normalizeVersionedAppointment(record);
  }

  return adaptLegacyPrisonAppointment(record);
}

export function countSlotOccupancy(
  records,
  slot,
  { ignoreAppointmentId = "" } = {},
) {
  const targetIdentity = buildSlotIdentity(slot);
  const ignoredId = text(ignoreAppointmentId);

  return (Array.isArray(records) ? records : []).reduce((count, record) => {
    const normalized = normalizeAppointmentRecord(record);

    if (ignoredId && normalized.id === ignoredId) {
      return count;
    }

    if (!appointmentStatusOccupiesCapacity(normalized.status)) {
      return count;
    }

    return normalized.slot.identity === targetIdentity ? count + 1 : count;
  }, 0);
}

export function evaluateSlotCapacity({
  records = [],
  slot,
  capacity = 1,
  ignoreAppointmentId = "",
}) {
  const normalizedCapacity = normalizePositiveInteger(capacity, 1);
  const occupancy = countSlotOccupancy(records, slot, {
    ignoreAppointmentId,
  });
  const remaining = Math.max(normalizedCapacity - occupancy, 0);

  return {
    capacity: normalizedCapacity,
    occupancy,
    remaining,
    available: remaining > 0,
  };
}

export function normalizeModalityScopes(scopes) {
  const raw = Array.isArray(scopes) ? scopes : [scopes];
  const knownFamilyIds = Object.values(MODALITY_FAMILY_IDS);
  const knownModalityIds = Object.values(MODALITY_IDS);

  const normalized = raw
    .map((scope) => text(scope))
    .filter(
      (scope) =>
        scope === "*" ||
        knownFamilyIds.includes(scope) ||
        knownModalityIds.includes(scope),
    );

  if (normalized.includes("*")) {
    return ["*"];
  }

  return [...new Set(normalized)].sort();
}

export function modalityScopeAllows(scopes, modalityId) {
  const definition = getModalityDefinition(modalityId);

  if (!definition) return false;

  const normalized = normalizeModalityScopes(scopes);

  return (
    normalized.includes("*") ||
    normalized.includes(definition.id) ||
    normalized.includes(definition.familyId)
  );
}
