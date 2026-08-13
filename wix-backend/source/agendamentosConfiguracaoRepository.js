import {
  APPOINTMENT_CATALOG_COLLECTION_ID,
  APPOINTMENT_CATALOG_RECORD_ID,
  buildPublicAppointmentCatalog,
  catalogError,
  createDefaultAppointmentCatalog,
  normalizeAppointmentCatalog,
  prepareAppointmentCatalogForSave,
  sanitizeAppointmentCatalogForAdmin,
} from "backend/agendamentosConfiguracao";

function text(value) { return value == null ? "" : String(value).trim(); }
function parseCatalogJson(value) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(text(value)); }
  catch { throw catalogError("CATALOGO_ARQUIVO_INVALIDO", "A configuração de agendamentos armazenada no Wix está inválida. Restaure um backup antes de sobrescrever o registro."); }
}
function isMissingItemError(error) {
  const message = text(error?.message || error).toLowerCase();
  const code = text(error?.code).toLowerCase();
  return code === "wde0073" || code === "item_not_found" || message.includes("item not found") || message.includes("does not exist in collection") || message.includes("não encontrado");
}
function isMissingCollectionError(error) {
  const message = text(error?.message || error).toLowerCase();
  const code = text(error?.code).toLowerCase();
  return code === "wde0025" || code === "collection_not_found" || (message.includes("collection") && message.includes("not found")) || (message.includes("coleção") && message.includes("não existe"));
}
function toRecord(catalog, currentRecord = null) {
  const now = new Date();
  return {
    ...(currentRecord && currentRecord._id ? currentRecord : {}),
    _id: APPOINTMENT_CATALOG_RECORD_ID,
    title: "Catálogo principal de agendamentos",
    schemaVersion: catalog.schemaVersion,
    revision: catalog.revision,
    catalogoJson: JSON.stringify(catalog),
    atualizadoEm: now,
    atualizadoPor: catalog.updatedBy || "administracao",
  };
}
function assertWixData(wixData) {
  if (!wixData || typeof wixData.get !== "function" || typeof wixData.insert !== "function" || typeof wixData.update !== "function") {
    throw new TypeError("Dependência wix-data incompatível com o catálogo.");
  }
}

export function createAppointmentCatalogRepository({ wixData, collectionId = APPOINTMENT_CATALOG_COLLECTION_ID, options = { suppressAuth: true } } = {}) {
  assertWixData(wixData);
  async function getRecord() {
    try {
      const item = await wixData.get(collectionId, APPOINTMENT_CATALOG_RECORD_ID, options);
      return item && item._id ? item : null;
    } catch (error) {
      if (isMissingCollectionError(error)) throw catalogError("CATALOGO_COLECAO_AUSENTE", `Crie a coleção Wix “${collectionId}” antes de usar a configuração de agendamentos.`, { collectionId });
      if (isMissingItemError(error)) return null;
      throw error;
    }
  }
  async function loadOrCreate() {
    const currentRecord = await getRecord();
    if (currentRecord) {
      return { catalog: normalizeAppointmentCatalog(parseCatalogJson(currentRecord.catalogoJson), { preserveProtected: false }), record: currentRecord, created: false };
    }
    const catalog = createDefaultAppointmentCatalog();
    try {
      const record = await wixData.insert(collectionId, toRecord(catalog), options);
      return { catalog, record, created: true };
    } catch (error) {
      if (isMissingCollectionError(error)) throw catalogError("CATALOGO_COLECAO_AUSENTE", `Crie a coleção Wix “${collectionId}” antes de usar a configuração de agendamentos.`, { collectionId });
      const concurrentRecord = await getRecord();
      if (concurrentRecord) return { catalog: normalizeAppointmentCatalog(parseCatalogJson(concurrentRecord.catalogoJson), { preserveProtected: false }), record: concurrentRecord, created: false };
      throw error;
    }
  }
  async function getAdminCatalog() {
    const { catalog, created } = await loadOrCreate();
    return { catalog: sanitizeAppointmentCatalogForAdmin(catalog), seeded: created };
  }
  async function getPublicCatalog() {
    const { catalog } = await loadOrCreate();
    return buildPublicAppointmentCatalog(catalog);
  }
  async function saveAdminCatalog({ catalog: nextCatalog, expectedRevision, updatedBy } = {}) {
    const { catalog: currentCatalog, record } = await loadOrCreate();
    const savedCatalog = prepareAppointmentCatalogForSave(nextCatalog, { currentValue: currentCatalog, expectedRevision, updatedBy });
    const savedRecord = await wixData.update(collectionId, toRecord(savedCatalog, record), options);
    return { catalog: sanitizeAppointmentCatalogForAdmin(savedCatalog), record: savedRecord };
  }
  return { collectionId, loadOrCreate, getAdminCatalog, getPublicCatalog, saveAdminCatalog };
}
