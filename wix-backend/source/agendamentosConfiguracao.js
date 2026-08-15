/**
 * Catálogo configurável da Plataforma de Agendamentos OAB/JF.
 *
 * Núcleo puro: não importa APIs Wix e pode ser executado em Node/Velo.
 * O catálogo é tratado como um aggregate root versionado para que referências,
 * prontidão e ativação sejam validadas atomicamente.
 */

export const APPOINTMENT_CATALOG_SCHEMA_VERSION = 2;
export const APPOINTMENT_CATALOG_RECORD_ID = "catalogo-principal";
export const APPOINTMENT_CATALOG_COLLECTION_ID = "AgendamentoConfiguracoes";

export const CATALOG_STATUS = Object.freeze({
  DRAFT: "rascunho",
  ACTIVE: "ativo",
  PAUSED: "pausado",
});

export const AVAILABILITY_MODE = Object.freeze({
  LEGACY: "legacy",
  WEEKLY: "weekly",
});

export const MODALITY_TEMPLATE = Object.freeze({
  PRISON: "prisional",
  PROFESSIONAL_SPACE: "espaco_profissional",
  PJE_SUPPORT: "pje_suporte",
});

const STATUS_VALUES = new Set(Object.values(CATALOG_STATUS));
const AVAILABILITY_VALUES = new Set(Object.values(AVAILABILITY_MODE));
const WEEKDAY_VALUES = new Set([0, 1, 2, 3, 4, 5, 6]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/;

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function integer(value, fallback = null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function boolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function normalizeId(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeStatus(value, fallback = CATALOG_STATUS.DRAFT) {
  const normalized = text(value).toLowerCase();
  return STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeAvailabilityMode(value, fallback = AVAILABILITY_MODE.WEEKLY) {
  const normalized = text(value).toLowerCase();
  return AVAILABILITY_VALUES.has(normalized) ? normalized : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byOrderThenName(a, b) {
  const orderA = integer(a?.order, 9999);
  const orderB = integer(b?.order, 9999);
  if (orderA !== orderB) return orderA - orderB;
  return text(a?.name || a?.publicName).localeCompare(
    text(b?.name || b?.publicName),
    "pt-BR",
  );
}

function uniqueById(items, entityLabel) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id || !ID_PATTERN.test(item.id)) {
      throw catalogError(
        "CATALOGO_ID_INVALIDO",
        `${entityLabel}: identifique cada item com letras minúsculas, números, hífen ou sublinhado.`,
      );
    }
    if (ids.has(item.id)) {
      throw catalogError(
        "CATALOGO_ID_DUPLICADO",
        `${entityLabel}: o identificador “${item.id}” está duplicado.`,
      );
    }
    ids.add(item.id);
  }
}

export function catalogError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

export function createDefaultAppointmentCatalog() {
  return {
    schemaVersion: APPOINTMENT_CATALOG_SCHEMA_VERSION,
    revision: 1,
    modalities: [
      {
        id: "prisional_virtual",
        familyId: "prisional",
        template: MODALITY_TEMPLATE.PRISON,
        publicName: "Atendimento Prisional",
        adminName: "Atendimento prisional virtual",
        description:
          "Agendamento virtual com pessoa privada de liberdade nas unidades participantes.",
        status: CATALOG_STATUS.ACTIVE,
        protected: true,
        order: 10,
      },
      {
        id: "espaco_atendimento",
        familyId: "espacos_profissionais",
        template: MODALITY_TEMPLATE.PROFESSIONAL_SPACE,
        publicName: "Salas de Apoio",
        adminName: "Salas de Apoio",
        description: "Reserva de salas destinadas ao apoio da advocacia.",
        status: CATALOG_STATUS.DRAFT,
        protected: false,
        order: 20,
      },
      {
        id: "espaco_individual",
        familyId: "espacos_profissionais",
        template: MODALITY_TEMPLATE.PROFESSIONAL_SPACE,
        publicName: "Escritórios Compartilhados",
        adminName: "Escritórios Compartilhados",
        description:
          "Reserva de estações ou escritórios compartilhados disponibilizados pela OAB/JF.",
        status: CATALOG_STATUS.DRAFT,
        protected: false,
        order: 30,
      },
      {
        id: "pje_suporte_instalacao",
        familyId: "pje",
        template: MODALITY_TEMPLATE.PJE_SUPPORT,
        publicName: "Suporte PJe",
        adminName: "Suporte e instalação do PJe",
        description:
          "Atendimento técnico agendado para suporte e instalação do PJe.",
        status: CATALOG_STATUS.DRAFT,
        protected: false,
        order: 40,
      },
    ],
    locations: [
      {
        id: "atendimento-virtual",
        name: "Atendimento virtual",
        address: "Online",
        kind: "virtual",
        status: CATALOG_STATUS.ACTIVE,
        protected: true,
        order: 10,
      },
    ],
    resources: [
      {
        id: "unidades-prisionais",
        locationId: "atendimento-virtual",
        name: "Unidades prisionais participantes",
        kind: "legacy_prison_units",
        capacity: 1,
        amenityIds: [],
        status: CATALOG_STATUS.ACTIVE,
        protected: true,
        order: 10,
      },
    ],
    amenities: [],
    offers: [
      {
        id: "atendimento-prisional-virtual",
        modalityId: "prisional_virtual",
        locationId: "atendimento-virtual",
        resourceId: "unidades-prisionais",
        name: "Agendar atendimento virtual",
        description: "Reserve um horário com pessoa privada de liberdade.",
        status: CATALOG_STATUS.ACTIVE,
        protected: true,
        durationMinutes: 30,
        capacity: 1,
        minimumNoticeHours: 24,
        maximumAdvanceDays: 60,
        cancelDeadlineHours: 24,
        rescheduleDeadlineHours: 24,
        bookingPath: "/agendar/unidade",
        availabilityMode: AVAILABILITY_MODE.LEGACY,
        weeklySchedule: [],
        instructions:
          "Escolha a unidade prisional, a data e o horário disponíveis.",
        order: 10,
      },
    ],
    updatedAt: null,
    updatedBy: "bootstrap",
  };
}

function normalizeModality(value) {
  const item = value && typeof value === "object" ? value : {};
  return {
    id: normalizeId(item.id),
    familyId: normalizeId(item.familyId || item.family || "geral") || "geral",
    template: text(item.template) || MODALITY_TEMPLATE.PROFESSIONAL_SPACE,
    publicName: text(item.publicName || item.name),
    adminName: text(item.adminName || item.publicName || item.name),
    description: text(item.description),
    status: normalizeStatus(item.status),
    protected: boolean(item.protected, false),
    order: integer(item.order, 9999),
  };
}

function normalizeLocation(value) {
  const item = value && typeof value === "object" ? value : {};
  return {
    id: normalizeId(item.id),
    name: text(item.name),
    address: text(item.address),
    kind: text(item.kind || "physical") || "physical",
    status: normalizeStatus(item.status),
    protected: boolean(item.protected, false),
    order: integer(item.order, 9999),
  };
}

function normalizeAmenity(value) {
  const item = value && typeof value === "object" ? value : {};
  return {
    id: normalizeId(item.id),
    name: text(item.name),
    category: text(item.category || "Outro") || "Outro",
    active: boolean(item.active, true),
    order: integer(item.order, 9999),
  };
}

function normalizeResource(value) {
  const item = value && typeof value === "object" ? value : {};
  const amenityIds = Array.isArray(item.amenityIds)
    ? Array.from(new Set(item.amenityIds.map(normalizeId).filter(Boolean)))
    : [];
  return {
    id: normalizeId(item.id),
    locationId: normalizeId(item.locationId),
    name: text(item.name),
    kind: text(item.kind || "room") || "room",
    capacity: Math.max(1, integer(item.capacity, 1)),
    amenityIds,
    status: normalizeStatus(item.status),
    protected: boolean(item.protected, false),
    order: integer(item.order, 9999),
  };
}

function normalizeSchedule(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  for (const raw of value) {
    const weekday = integer(raw?.weekday, null);
    const startTime = text(raw?.startTime || raw?.start);
    const endTime = text(raw?.endTime || raw?.end);
    if (
      !WEEKDAY_VALUES.has(weekday) ||
      !TIME_PATTERN.test(startTime) ||
      !TIME_PATTERN.test(endTime) ||
      endTime <= startTime
    ) continue;
    unique.set(`${weekday}:${startTime}:${endTime}`, { weekday, startTime, endTime });
  }
  return Array.from(unique.values()).sort((a, b) =>
    a.weekday !== b.weekday ? a.weekday - b.weekday : a.startTime.localeCompare(b.startTime),
  );
}

function normalizeOffer(value) {
  const item = value && typeof value === "object" ? value : {};
  return {
    id: normalizeId(item.id),
    modalityId: normalizeId(item.modalityId),
    locationId: normalizeId(item.locationId),
    resourceId: normalizeId(item.resourceId),
    name: text(item.name),
    description: text(item.description),
    status: normalizeStatus(item.status),
    protected: boolean(item.protected, false),
    durationMinutes: Math.max(5, integer(item.durationMinutes, 30)),
    capacity: Math.max(1, integer(item.capacity, 1)),
    minimumNoticeHours: Math.max(0, integer(item.minimumNoticeHours, 0)),
    maximumAdvanceDays: Math.max(1, integer(item.maximumAdvanceDays, 30)),
    cancelDeadlineHours: Math.max(0, integer(item.cancelDeadlineHours, 0)),
    rescheduleDeadlineHours: Math.max(0, integer(item.rescheduleDeadlineHours, 0)),
    bookingPath: text(item.bookingPath),
    availabilityMode: normalizeAvailabilityMode(item.availabilityMode),
    weeklySchedule: normalizeSchedule(item.weeklySchedule),
    instructions: text(item.instructions),
    order: integer(item.order, 9999),
  };
}

function assertBasicEntityFields(catalog) {
  for (const modality of catalog.modalities) {
    if (!modality.publicName || !modality.adminName) {
      throw catalogError("MODALIDADE_DADOS_OBRIGATORIOS", `A modalidade “${modality.id || "sem identificação"}” precisa de nome público e nome administrativo.`);
    }
  }
  for (const location of catalog.locations) {
    if (!location.name) throw catalogError("LOCAL_DADOS_OBRIGATORIOS", `O local “${location.id || "sem identificação"}” precisa de nome.`);
  }
  for (const resource of catalog.resources) {
    if (!resource.name || !resource.locationId) throw catalogError("RECURSO_DADOS_OBRIGATORIOS", `O recurso “${resource.id || "sem identificação"}” precisa de nome e local.`);
  }
  for (const amenity of catalog.amenities) {
    if (!amenity.name) throw catalogError("COMODIDADE_DADOS_OBRIGATORIOS", `O recurso ou comodidade “${amenity.id || "sem identificação"}” precisa de nome.`);
  }
  for (const offer of catalog.offers) {
    if (!offer.name || !offer.modalityId || !offer.locationId || !offer.resourceId) {
      throw catalogError("OFERTA_DADOS_OBRIGATORIOS", `A oferta “${offer.id || "sem identificação"}” precisa de nome, modalidade, local e recurso.`);
    }
  }
}

function assertReferences(catalog) {
  const modalityIds = new Set(catalog.modalities.map((item) => item.id));
  const locationIds = new Set(catalog.locations.map((item) => item.id));
  const resourcesById = new Map(catalog.resources.map((item) => [item.id, item]));
  const amenityIds = new Set(catalog.amenities.map((item) => item.id));
  for (const resource of catalog.resources) {
    if (!locationIds.has(resource.locationId)) throw catalogError("RECURSO_LOCAL_INEXISTENTE", `O recurso “${resource.name}” referencia um local inexistente.`);
    for (const amenityId of resource.amenityIds) {
      if (!amenityIds.has(amenityId)) throw catalogError("RECURSO_COMODIDADE_INEXISTENTE", `O item “${resource.name}” referencia um recurso ou comodidade inexistente.`);
    }
  }
  for (const offer of catalog.offers) {
    const resource = resourcesById.get(offer.resourceId);
    if (!modalityIds.has(offer.modalityId)) throw catalogError("OFERTA_MODALIDADE_INEXISTENTE", `A oferta “${offer.name}” referencia uma modalidade inexistente.`);
    if (!locationIds.has(offer.locationId)) throw catalogError("OFERTA_LOCAL_INEXISTENTE", `A oferta “${offer.name}” referencia um local inexistente.`);
    if (!resource) throw catalogError("OFERTA_RECURSO_INEXISTENTE", `A oferta “${offer.name}” referencia um recurso inexistente.`);
    if (resource.locationId !== offer.locationId) throw catalogError("OFERTA_RECURSO_LOCAL_DIVERGENTE", `O recurso da oferta “${offer.name}” pertence a outro local.`);
  }
}

function preserveProtectedEntities(currentItems, nextItems) {
  const nextById = new Map(nextItems.map((item) => [item.id, item]));
  for (const current of currentItems) if (current.protected === true) nextById.set(current.id, clone(current));
  return Array.from(nextById.values()).sort(byOrderThenName);
}

export function normalizeAppointmentCatalog(value, options = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const current = options.current ? normalizeAppointmentCatalog(options.current) : null;
  const catalog = {
    schemaVersion: APPOINTMENT_CATALOG_SCHEMA_VERSION,
    revision: Math.max(1, integer(raw.revision, current?.revision || 1)),
    modalities: Array.isArray(raw.modalities) ? raw.modalities.map(normalizeModality) : [],
    locations: Array.isArray(raw.locations) ? raw.locations.map(normalizeLocation) : [],
    resources: Array.isArray(raw.resources) ? raw.resources.map(normalizeResource) : [],
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map(normalizeAmenity) : [],
    offers: Array.isArray(raw.offers) ? raw.offers.map(normalizeOffer) : [],
    updatedAt: text(raw.updatedAt) || null,
    updatedBy: text(raw.updatedBy) || "",
  };
  if (current && options.preserveProtected !== false) {
    catalog.modalities = preserveProtectedEntities(current.modalities, catalog.modalities);
    catalog.locations = preserveProtectedEntities(current.locations, catalog.locations);
    catalog.resources = preserveProtectedEntities(current.resources, catalog.resources);
    catalog.offers = preserveProtectedEntities(current.offers, catalog.offers);
    catalog.amenities.sort(byOrderThenName);
  } else {
    catalog.modalities.sort(byOrderThenName);
    catalog.locations.sort(byOrderThenName);
    catalog.resources.sort(byOrderThenName);
    catalog.amenities.sort(byOrderThenName);
    catalog.offers.sort(byOrderThenName);
  }
  uniqueById(catalog.modalities, "Modalidades");
  uniqueById(catalog.locations, "Locais");
  uniqueById(catalog.resources, "Recursos");
  uniqueById(catalog.amenities, "Recursos e comodidades");
  uniqueById(catalog.offers, "Ofertas");
  assertBasicEntityFields(catalog);
  assertReferences(catalog);
  return catalog;
}

function readinessItem(code, label, ok, entityId = "") {
  return { code, label, ok: ok === true, entityId };
}

export function evaluateOfferReadiness(catalogValue, offerId) {
  const catalog = normalizeAppointmentCatalog(catalogValue, { preserveProtected: false });
  const offer = catalog.offers.find((item) => item.id === text(offerId));
  if (!offer) return { ready: false, checks: [readinessItem("oferta_inexistente", "Oferta existente", false)] };
  const modality = catalog.modalities.find((item) => item.id === offer.modalityId);
  const location = catalog.locations.find((item) => item.id === offer.locationId);
  const resource = catalog.resources.find((item) => item.id === offer.resourceId);
  const hasAvailability = offer.availabilityMode === AVAILABILITY_MODE.LEGACY || offer.weeklySchedule.length > 0;
  const checks = [
    readinessItem("modalidade_ativa", "Modalidade ativa", modality?.status === CATALOG_STATUS.ACTIVE, modality?.id),
    readinessItem("local_ativo", "Local ativo", location?.status === CATALOG_STATUS.ACTIVE, location?.id),
    readinessItem("recurso_ativo", "Recurso ativo", resource?.status === CATALOG_STATUS.ACTIVE, resource?.id),
    readinessItem("rota_publica", "Destino público configurado", Boolean(offer.bookingPath), offer.id),
    readinessItem("duracao", "Duração definida", offer.durationMinutes > 0, offer.id),
    readinessItem("capacidade", "Capacidade definida", offer.capacity > 0, offer.id),
    readinessItem("disponibilidade", "Disponibilidade configurada", hasAvailability, offer.id),
  ];
  return { ready: checks.every((item) => item.ok), checks };
}

export function evaluateModalityReadiness(catalogValue, modalityId) {
  const catalog = normalizeAppointmentCatalog(catalogValue, { preserveProtected: false });
  const modality = catalog.modalities.find((item) => item.id === text(modalityId));
  if (!modality) return { ready: false, checks: [readinessItem("modalidade_inexistente", "Modalidade existente", false)], offers: [] };
  const offers = catalog.offers.filter((item) => item.modalityId === modality.id).map((offer) => ({ offerId: offer.id, status: offer.status, ...evaluateOfferReadiness(catalog, offer.id) }));
  const activeReadyOffers = offers.filter((item) => item.status === CATALOG_STATUS.ACTIVE && item.ready);
  const checks = [
    readinessItem("nome_publico", "Nome público informado", Boolean(modality.publicName), modality.id),
    readinessItem("descricao", "Descrição informada", Boolean(modality.description), modality.id),
    readinessItem("oferta_ativa", "Ao menos uma oferta ativa e pronta", activeReadyOffers.length > 0, modality.id),
  ];
  return { ready: checks.every((item) => item.ok), checks, offers };
}

export function evaluateCatalogReadiness(catalogValue) {
  const catalog = normalizeAppointmentCatalog(catalogValue, { preserveProtected: false });
  return {
    modalities: catalog.modalities.map((modality) => ({ modalityId: modality.id, status: modality.status, ...evaluateModalityReadiness(catalog, modality.id) })),
    offers: catalog.offers.map((offer) => ({ offerId: offer.id, status: offer.status, ...evaluateOfferReadiness(catalog, offer.id) })),
  };
}

function assertActivationReadiness(catalog) {
  for (const offer of catalog.offers) {
    if (offer.status !== CATALOG_STATUS.ACTIVE) continue;
    const readiness = evaluateOfferReadiness(catalog, offer.id);
    if (!readiness.ready) throw catalogError("OFERTA_NAO_PRONTA", `A oferta “${offer.name}” ainda não pode ser ativada.`, { offerId: offer.id, checks: readiness.checks });
  }
  for (const modality of catalog.modalities) {
    if (modality.status !== CATALOG_STATUS.ACTIVE) continue;
    const readiness = evaluateModalityReadiness(catalog, modality.id);
    if (!readiness.ready) throw catalogError("MODALIDADE_NAO_PRONTA", `A modalidade “${modality.publicName}” ainda não pode ser ativada.`, { modalityId: modality.id, checks: readiness.checks });
  }
}

export function prepareAppointmentCatalogForSave(nextValue, { currentValue, expectedRevision, updatedBy = "" } = {}) {
  const current = normalizeAppointmentCatalog(currentValue || createDefaultAppointmentCatalog(), { preserveProtected: false });
  if (expectedRevision !== undefined && expectedRevision !== null && Number(expectedRevision) !== Number(current.revision)) {
    throw catalogError("CATALOGO_REVISAO_DIVERGENTE", "A configuração foi alterada por outra pessoa. Atualize a página antes de salvar novamente.", { expectedRevision, currentRevision: current.revision });
  }
  const next = normalizeAppointmentCatalog(nextValue, { current, preserveProtected: true });
  assertActivationReadiness(next);
  return { ...next, revision: current.revision + 1, updatedAt: new Date().toISOString(), updatedBy: text(updatedBy) || "administracao" };
}

export function buildPublicAppointmentCatalog(catalogValue) {
  const catalog = normalizeAppointmentCatalog(catalogValue, { preserveProtected: false });
  const modalities = catalog.modalities.filter((item) => item.status === CATALOG_STATUS.ACTIVE).map((modality) => {
    const offers = catalog.offers.filter((offer) => offer.modalityId === modality.id && offer.status === CATALOG_STATUS.ACTIVE && evaluateOfferReadiness(catalog, offer.id).ready).map((offer) => {
      const location = catalog.locations.find((item) => item.id === offer.locationId);
      const resource = catalog.resources.find((item) => item.id === offer.resourceId);
      return {
        id: offer.id,
        name: offer.name,
        description: offer.description,
        bookingPath: offer.bookingPath,
        durationMinutes: offer.durationMinutes,
        capacity: offer.capacity,
        minimumNoticeHours: offer.minimumNoticeHours,
        maximumAdvanceDays: offer.maximumAdvanceDays,
        cancelDeadlineHours: offer.cancelDeadlineHours,
        rescheduleDeadlineHours: offer.rescheduleDeadlineHours,
        availabilityMode: offer.availabilityMode,
        weeklySchedule: clone(offer.weeklySchedule),
        instructions: offer.instructions,
        location: location ? { id: location.id, name: location.name, address: location.address, kind: location.kind } : null,
        resource: resource ? {
          id: resource.id,
          name: resource.name,
          kind: resource.kind,
          amenities: resource.amenityIds
            .map((amenityId) => catalog.amenities.find((item) => item.id === amenityId && item.active !== false))
            .filter(Boolean)
            .map((item) => ({ id: item.id, name: item.name, category: item.category })),
        } : null,
        order: offer.order,
      };
    }).sort(byOrderThenName);
    if (!offers.length) return null;
    return { id: modality.id, familyId: modality.familyId, template: modality.template, publicName: modality.publicName, description: modality.description, offers, order: modality.order };
  }).filter(Boolean).sort(byOrderThenName);
  return { schemaVersion: catalog.schemaVersion, revision: catalog.revision, modalities };
}

export function sanitizeAppointmentCatalogForAdmin(catalogValue) {
  const catalog = normalizeAppointmentCatalog(catalogValue, { preserveProtected: false });
  return { ...clone(catalog), readiness: evaluateCatalogReadiness(catalog) };
}
