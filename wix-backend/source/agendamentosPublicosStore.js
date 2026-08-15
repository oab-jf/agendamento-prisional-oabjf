import wixData from "wix-data";
import { getSecret } from "wix-secrets-backend";
import { fetch } from "wix-fetch";

import { obterCatalogoAgendamentosAdminCore } from "backend/agendamentosConfiguracaoStore";
import { evaluateOfferReadiness } from "backend/agendamentosConfiguracao";
import {
  buildOccupancyLockId,
  buildOfferSlots,
  buildPublicSlotIdentity,
  listOfferDates,
  validateRequestedPublicSlot,
} from "backend/agendamentosPublicos";

const APPOINTMENTS_COLLECTION = "Import4259";
const OCCUPANCY_COLLECTION = "AgendamentoOcupacoes";
const LOCK_TTL_MS = 10 * 60 * 1000;
const INFOBIP_EMAIL_ENDPOINT = "/email/3/send";
const CENTRAL_PUBLIC_URL = "https://central.juizdefora-oabmg.org.br";
const ACTIVE_APPOINTMENT_STATUS = "agendado";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text(value));
}

function normalizeOab(value) {
  return text(value).toUpperCase().replace(/\s+/g, " ");
}

function isValidOab(value) {
  return /\d{3,}/.test(text(value));
}

function formatDateLabel(dateIso) {
  const parsed = new Date(`${dateIso}T12:00:00-03:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function isActiveAppointment(item) {
  return text(item?.status || ACTIVE_APPOINTMENT_STATUS).toLowerCase() === ACTIVE_APPOINTMENT_STATUS;
}

function isVersionedAppointment(item) {
  return Number(item?.schemaVersion || 0) >= 2 && Boolean(text(item?.modalidadeId || item?.modalityId));
}

function mapPublicContext(catalog, offer) {
  const modality = catalog.modalities.find((item) => item.id === offer.modalityId);
  const location = catalog.locations.find((item) => item.id === offer.locationId);
  const resource = catalog.resources.find((item) => item.id === offer.resourceId);

  if (!modality || modality.status !== "ativo") throw new Error("SERVICO_INDISPONIVEL");
  if (!location || location.status !== "ativo") throw new Error("LOCAL_INDISPONIVEL");
  if (!resource || resource.status !== "ativo") throw new Error("ITEM_INDISPONIVEL");
  if (offer.status !== "ativo" || offer.availabilityMode !== "weekly") {
    throw new Error("OPCAO_INDISPONIVEL");
  }

  const readiness = evaluateOfferReadiness(catalog, offer.id);
  if (!readiness.ready) throw new Error("OPCAO_NAO_PRONTA");

  const amenities = (resource.amenityIds || [])
    .map((id) => catalog.amenities.find((item) => item.id === id && item.active !== false))
    .filter(Boolean)
    .map((item) => ({ id: item.id, name: item.name, category: item.category }));

  return { catalog, modality, location, resource, offer, amenities };
}

export async function obterContextoOfertaPublica(offerId) {
  const id = text(offerId);
  if (!id) throw new Error("OFERTA_OBRIGATORIA");
  const result = await obterCatalogoAgendamentosAdminCore();
  const catalog = result.catalog;
  const offer = catalog.offers.find((item) => item.id === id);
  if (!offer) throw new Error("OFERTA_INEXISTENTE");
  return mapPublicContext(catalog, offer);
}

async function removeLockQuietly(lockId) {
  if (!lockId) return;
  try {
    await wixData.remove(OCCUPANCY_COLLECTION, lockId, { suppressAuth: true });
  } catch {
    // idempotente
  }
}

function lockExpired(lock, now = new Date()) {
  if (lock?.appointmentId) return false;
  const expiresAt = lock?.expiresAt instanceof Date ? lock.expiresAt : new Date(lock?.expiresAt || 0);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
}

async function loadDateOccupancy(context, dateIso, { now = new Date(), ignoreAppointmentId = "" } = {}) {
  const [lockResult, appointmentResult] = await Promise.all([
    wixData
      .query(OCCUPANCY_COLLECTION)
      .eq("resourceId", context.resource.id)
      .eq("dateIso", dateIso)
      .limit(1000)
      .find({ suppressAuth: true }),
    wixData
      .query(APPOINTMENTS_COLLECTION)
      .eq("recursoId", context.resource.id)
      .eq("dataAtendimentoIso", dateIso)
      .limit(1000)
      .find({ suppressAuth: true }),
  ]);

  const appointments = Array.isArray(appointmentResult.items) ? appointmentResult.items : [];
  const appointmentsById = new Map(
    appointments.map((item) => [text(item?._id), item]).filter(([id]) => Boolean(id)),
  );

  const locks = [];
  for (const item of lockResult.items || []) {
    if (lockExpired(item, now)) {
      await removeLockQuietly(item._id);
      continue;
    }

    const appointmentId = text(item?.appointmentId);
    if (appointmentId) {
      const appointment = appointmentsById.get(appointmentId);
      // Um lock finalizado só ocupa capacidade enquanto o agendamento correspondente
      // continua ativo. Isso também torna cancelamento/remarcação tolerantes a falhas
      // transitórias ao remover o lock.
      if (!appointment || !isActiveAppointment(appointment)) {
        await removeLockQuietly(item._id);
        continue;
      }
    }

    locks.push(item);
  }

  const occupancyByStart = {};
  const representedAppointmentIds = new Set();

  for (const lock of locks) {
    if (ignoreAppointmentId && text(lock.appointmentId) === text(ignoreAppointmentId)) continue;
    const startTime = text(lock.startTime);
    if (!startTime) continue;
    occupancyByStart[startTime] = (occupancyByStart[startTime] || 0) + 1;
    if (lock.appointmentId) representedAppointmentIds.add(text(lock.appointmentId));
  }

  for (const appointment of appointments) {
    if (!isActiveAppointment(appointment)) continue;
    if (ignoreAppointmentId && text(appointment._id) === text(ignoreAppointmentId)) continue;
    if (representedAppointmentIds.has(text(appointment._id))) continue;
    const startTime = text(appointment.horarioInicio);
    if (!startTime) continue;
    occupancyByStart[startTime] = (occupancyByStart[startTime] || 0) + 1;
  }

  return occupancyByStart;
}

export async function listarDisponibilidadeOfertaPublica({ offerId, dateIso = "", ignoreAppointmentId = "" } = {}) {
  const context = await obterContextoOfertaPublica(offerId);
  if (!dateIso) {
    return {
      context: publicContextPayload(context),
      dates: listOfferDates(context.offer, { now: new Date(), limit: context.offer.maximumAdvanceDays }),
    };
  }

  const occupancyByStart = await loadDateOccupancy(context, dateIso, {
    ignoreAppointmentId,
  });

  return {
    context: publicContextPayload(context),
    dateIso,
    slots: buildOfferSlots(context.offer, dateIso, {
      now: new Date(),
      occupancyByStart,
    }),
  };
}

function publicContextPayload(context) {
  return {
    modality: {
      id: context.modality.id,
      familyId: context.modality.familyId,
      publicName: context.modality.publicName,
      description: context.modality.description,
    },
    offer: {
      id: context.offer.id,
      name: context.offer.name,
      description: context.offer.description,
      durationMinutes: context.offer.durationMinutes,
      capacity: context.offer.capacity,
      minimumNoticeHours: context.offer.minimumNoticeHours,
      maximumAdvanceDays: context.offer.maximumAdvanceDays,
      cancelDeadlineHours: context.offer.cancelDeadlineHours,
      rescheduleDeadlineHours: context.offer.rescheduleDeadlineHours,
      instructions: context.offer.instructions,
    },
    location: {
      id: context.location.id,
      name: context.location.name,
      address: context.location.address,
      kind: context.location.kind,
    },
    resource: {
      id: context.resource.id,
      name: context.resource.name,
      kind: context.resource.kind,
      amenities: context.amenities,
    },
  };
}

async function claimSeat(context, { dateIso, startTime }) {
  const slotIdentity = buildPublicSlotIdentity({
    modalityId: context.modality.id,
    resourceId: context.resource.id,
    dateIso,
    startTime,
  });

  const now = new Date();
  for (let seat = 1; seat <= context.offer.capacity; seat += 1) {
    const lockId = buildOccupancyLockId({
      modalityId: context.modality.id,
      resourceId: context.resource.id,
      dateIso,
      startTime,
      seat,
    });

    const lock = {
      _id: lockId,
      title: `${slotIdentity} · vaga ${seat}`,
      schemaVersion: 1,
      slotIdentity,
      seat,
      offerId: context.offer.id,
      resourceId: context.resource.id,
      dateIso,
      startTime,
      appointmentId: "",
      protocol: "",
      expiresAt: new Date(now.getTime() + LOCK_TTL_MS),
      createdAt: now,
      updatedAt: now,
    };

    try {
      return await wixData.insert(OCCUPANCY_COLLECTION, lock, { suppressAuth: true });
    } catch (error) {
      let existing = null;
      try {
        existing = await wixData.get(OCCUPANCY_COLLECTION, lockId, { suppressAuth: true });
      } catch {
        throw error;
      }

      if (existing && lockExpired(existing, now)) {
        await removeLockQuietly(lockId);
        try {
          return await wixData.insert(OCCUPANCY_COLLECTION, lock, { suppressAuth: true });
        } catch {
          // outra chamada ganhou a vaga; tenta a próxima
        }
      }
    }
  }

  return null;
}

async function finalizeLock(lock, appointment, protocol) {
  if (!lock?._id) return;
  await wixData.update(
    OCCUPANCY_COLLECTION,
    {
      ...lock,
      appointmentId: appointment._id,
      protocol,
      expiresAt: null,
      updatedAt: new Date(),
    },
    { suppressAuth: true },
  );
}

export async function liberarOcupacaoAgendamento(appointment) {
  if (!appointment?._id) return;
  const result = await wixData
    .query(OCCUPANCY_COLLECTION)
    .eq("appointmentId", appointment._id)
    .limit(20)
    .find({ suppressAuth: true });

  for (const lock of result.items || []) {
    await removeLockQuietly(lock._id);
  }
}

async function generateUniqueProtocol() {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const number = String(Math.floor(100000 + Math.random() * 900000));
    const protocol = `AG-${year}-${number}`;
    const result = await wixData
      .query(APPOINTMENTS_COLLECTION)
      .eq("protocolo", protocol)
      .limit(1)
      .find({ suppressAuth: true });
    if (!(result.items || []).length) return protocol;
  }
  return `AG-${year}-${String(Date.now()).slice(-6)}`;
}

function validateBookingPayload(payload = {}) {
  const data = {
    offerId: text(payload.offerId || payload.ofertaId),
    dateIso: text(payload.dateIso || payload.dataIso),
    startTime: text(payload.startTime || payload.horarioInicio),
    name: text(payload.name || payload.nomeAdvogado || payload.solicitanteNome),
    oabNumber: normalizeOab(payload.oabNumber || payload.numeroOab || payload.solicitanteOab),
    email: normalizeEmail(payload.email || payload.emailAdvogado || payload.solicitanteEmail),
    phone: text(payload.phone || payload.telefoneAdvogado || payload.solicitanteTelefone),
    rulesAccepted: payload.rulesAccepted === true || payload.cienciaRegras === true || payload.aceiteRegras === true,
  };

  if (!data.offerId || !data.dateIso || !data.startTime) {
    return { ok: false, code: "DADOS_AGENDAMENTO_OBRIGATORIOS", message: "Escolha a opção, a data e o horário do atendimento." };
  }
  if (data.name.length < 3) {
    return { ok: false, code: "NOME_INVALIDO", message: "Informe o nome completo do(a) advogado(a)." };
  }
  if (!isValidOab(data.oabNumber)) {
    return { ok: false, code: "OAB_INVALIDA", message: "Informe um número de OAB válido." };
  }
  if (!isValidEmail(data.email)) {
    return { ok: false, code: "EMAIL_INVALIDO", message: "Informe um e-mail válido." };
  }
  if (data.phone.replace(/\D/g, "").length < 10) {
    return { ok: false, code: "TELEFONE_INVALIDO", message: "Informe um telefone válido com DDD." };
  }
  if (!data.rulesAccepted) {
    return { ok: false, code: "REGRAS_NAO_ACEITAS", message: "Confirme a ciência das regras antes de concluir." };
  }
  return { ok: true, data };
}

export async function criarAgendamentoPublicoV2(payload = {}) {
  const validation = validateBookingPayload(payload);
  if (!validation.ok) return validation;
  const data = validation.data;
  let lock = null;
  let appointment = null;

  try {
    const context = await obterContextoOfertaPublica(data.offerId);
    const occupancyByStart = await loadDateOccupancy(context, data.dateIso);
    const slotValidation = validateRequestedPublicSlot({
      offer: context.offer,
      dateIso: data.dateIso,
      startTime: data.startTime,
      occupancyByStart,
      now: new Date(),
    });

    if (!slotValidation.ok) return slotValidation;

    lock = await claimSeat(context, { dateIso: data.dateIso, startTime: data.startTime });
    if (!lock) {
      return {
        ok: false,
        code: "HORARIO_INDISPONIVEL",
        message: "Este horário acabou de ser ocupado. Escolha outra opção.",
      };
    }

    // Revalida após adquirir a vaga para impedir submissões de slots fora da grade.
    const slot = slotValidation.slot;
    const protocol = await generateUniqueProtocol();
    const now = new Date();
    const slotIdentity = buildPublicSlotIdentity({
      modalityId: context.modality.id,
      resourceId: context.resource.id,
      dateIso: data.dateIso,
      startTime: slot.horarioInicio,
    });

    const item = {
      title: protocol,
      protocolo: protocol,
      schemaVersion: 2,
      modalidadeId: context.modality.id,
      modalidadeFamiliaId: context.modality.familyId || "geral",
      modalidadeNome: context.modality.publicName,
      localId: context.location.id,
      localNome: context.location.name,
      localEndereco: context.location.address,
      recursoId: context.resource.id,
      recursoNome: context.resource.name,
      ofertaId: context.offer.id,
      ofertaNome: context.offer.name,
      dataAtendimentoIso: data.dateIso,
      dataLabel: formatDateLabel(data.dateIso),
      horarioInicio: slot.horarioInicio,
      horarioFim: slot.horarioFim,
      duracaoMinutos: context.offer.durationMinutes,
      capacidade: context.offer.capacity,
      slotIdentidade: slotIdentity,
      timeZone: "America/Sao_Paulo",
      solicitanteNome: data.name,
      solicitanteOab: data.oabNumber,
      solicitanteEmail: data.email,
      solicitanteTelefone: data.phone,
      // aliases de compatibilidade com consulta/admin atuais
      nomeAdvogado: data.name,
      numeroOab: data.oabNumber,
      emailAdvogado: data.email,
      emailIndex: data.email,
      telefoneAdvogado: data.phone,
      cienciaRegras: true,
      aceiteRegras: true,
      cancelamentoPrazoHoras: context.offer.cancelDeadlineHours,
      remarcacaoPrazoHoras: context.offer.rescheduleDeadlineHours,
      status: ACTIVE_APPOINTMENT_STATUS,
      origem: "central-multimodal-v2",
      emailAdvogadoEnviado: false,
      emailAdvogadoDestino: data.email,
      emailAdvogadoErro: "",
      emailAdvogadoEnviadoEm: null,
      criadoEm: now,
      atualizadoEm: now,
    };

    appointment = await wixData.insert(APPOINTMENTS_COLLECTION, item, { suppressAuth: true });
    try {
      await finalizeLock(lock, appointment, protocol);
    } catch (lockError) {
      // O agendamento já é a fonte de verdade. Remove o lock temporário e deixa
      // o fallback por registro ativo preservar a capacidade sem devolver falso erro.
      console.warn(`Agendamento ${protocol} salvo, mas o lock não foi finalizado.`, lockError);
      await removeLockQuietly(lock?._id);
      lock = null;
    }

    const emailAudit = await tentarEnviarConfirmacao({ context, appointment, protocol });
    try {
      appointment = await wixData.update(
        APPOINTMENTS_COLLECTION,
        { ...appointment, ...emailAudit, atualizadoEm: new Date() },
        { suppressAuth: true },
      );
    } catch (auditError) {
      console.warn("Agendamento v2 salvo, mas auditoria do e-mail não foi persistida.", auditError);
    }

    return {
      ok: true,
      protocol,
      protocolo: protocol,
      emailSent: emailAudit.emailAdvogadoEnviado === true,
      emailAdvogadoEnviado: emailAudit.emailAdvogadoEnviado === true,
      appointment: mapGenericAppointmentPublic(appointment),
      agendamento: mapGenericAppointmentPublic(appointment),
    };
  } catch (error) {
    console.error("Erro ao criar agendamento público v2:", error);
    if (!appointment && lock?._id) await removeLockQuietly(lock._id);
    return {
      ok: false,
      code: text(error?.message) || "ERRO_INTERNO",
      message:
        text(error?.message) === "OPCAO_INDISPONIVEL" || text(error?.message) === "OPCAO_NAO_PRONTA"
          ? "Esta opção de atendimento não está disponível para reserva."
          : "Não foi possível confirmar o agendamento agora. Tente novamente.",
    };
  }
}

export function mapGenericAppointmentPublic(item = {}) {
  const startTime = text(item.horarioInicio);
  const endTime = text(item.horarioFim);
  return {
    _id: item._id,
    schemaVersion: 2,
    protocolo: text(item.protocolo || item.title),
    modalidadeId: text(item.modalidadeId),
    modalidadeFamiliaId: text(item.modalidadeFamiliaId || "geral"),
    servicoNome: text(item.modalidadeNome),
    ofertaId: text(item.ofertaId),
    ofertaNome: text(item.ofertaNome),
    localId: text(item.localId),
    localNome: text(item.localNome),
    localEndereco: text(item.localEndereco),
    recursoId: text(item.recursoId),
    recursoNome: text(item.recursoNome),
    dataIso: text(item.dataAtendimentoIso),
    dataLabel: text(item.dataLabel) || formatDateLabel(text(item.dataAtendimentoIso)),
    horarioInicio: startTime,
    horarioFim: endTime,
    horarioLabel: startTime && endTime ? `${startTime} – ${endTime}` : startTime,
    nomeAdvogado: text(item.solicitanteNome || item.nomeAdvogado),
    numeroOab: text(item.solicitanteOab || item.numeroOab),
    emailAdvogado: normalizeEmail(item.solicitanteEmail || item.emailAdvogado || item.emailIndex),
    telefoneAdvogado: text(item.solicitanteTelefone || item.telefoneAdvogado),
    status: text(item.status || ACTIVE_APPOINTMENT_STATUS).toLowerCase(),
    prazoCancelamentoHoras: Math.max(0, Number(item.cancelamentoPrazoHoras || 0)),
    prazoRemarcacaoHoras: Math.max(0, Number(item.remarcacaoPrazoHoras || 0)),
  };
}

export async function remarcarAgendamentoPublicoV2(original, { dateIso, startTime }) {
  if (!isVersionedAppointment(original)) {
    return { ok: false, code: "AGENDAMENTO_NAO_V2", message: "Agendamento incompatível com a remarcação multimodal." };
  }

  const offerId = text(original.ofertaId);
  const context = await obterContextoOfertaPublica(offerId);
  const occupancyByStart = await loadDateOccupancy(context, dateIso, {
    ignoreAppointmentId: original._id,
  });
  const slotValidation = validateRequestedPublicSlot({
    offer: context.offer,
    dateIso,
    startTime,
    occupancyByStart,
    now: new Date(),
  });
  if (!slotValidation.ok) return slotValidation;

  let lock = await claimSeat(context, { dateIso, startTime });
  if (!lock) return { ok: false, code: "HORARIO_INDISPONIVEL", message: "Este horário acabou de ser ocupado." };

  let newAppointment = null;
  try {
    const slot = slotValidation.slot;
    const protocol = await generateUniqueProtocol();
    const now = new Date();
    const slotIdentity = buildPublicSlotIdentity({
      modalityId: context.modality.id,
      resourceId: context.resource.id,
      dateIso,
      startTime: slot.horarioInicio,
    });

    const next = {
      ...original,
      _id: undefined,
      _createdDate: undefined,
      _updatedDate: undefined,
      title: protocol,
      protocolo: protocol,
      dataAtendimentoIso: dateIso,
      dataLabel: formatDateLabel(dateIso),
      horarioInicio: slot.horarioInicio,
      horarioFim: slot.horarioFim,
      slotIdentidade: slotIdentity,
      status: ACTIVE_APPOINTMENT_STATUS,
      origem: "remarcacao-usuario-v2",
      agendamentoOrigemId: original._id,
      protocoloOrigem: text(original.protocolo || original.title),
      reagendadoParaId: "",
      reagendadoParaProtocolo: "",
      canceladoEm: null,
      criadoEm: now,
      atualizadoEm: now,
    };

    newAppointment = await wixData.insert(APPOINTMENTS_COLLECTION, next, { suppressAuth: true });
    try {
      await finalizeLock(lock, newAppointment, protocol);
    } catch (lockError) {
      console.warn(`Remarcação ${protocol} salva, mas o lock não foi finalizado.`, lockError);
      await removeLockQuietly(lock?._id);
      lock = null;
    }

    const originalSaved = await wixData.update(
      APPOINTMENTS_COLLECTION,
      {
        ...original,
        status: "reagendado",
        reagendadoEm: now,
        atualizadoEm: now,
        reagendadoParaId: newAppointment._id,
        reagendadoParaProtocolo: protocol,
        reagendadoParaDataIso: dateIso,
        reagendadoParaDataLabel: formatDateLabel(dateIso),
        reagendadoParaHorarioInicio: slot.horarioInicio,
        reagendadoParaHorarioFim: slot.horarioFim,
      },
      { suppressAuth: true },
    );

    try {
      await liberarOcupacaoAgendamento(original);
    } catch (releaseError) {
      // O status “reagendado” já faz o lock antigo deixar de ocupar capacidade
      // no próximo cálculo. A limpeza física é best-effort.
      console.warn(`Não foi possível limpar imediatamente o lock do protocolo ${text(original.protocolo || original.title)}.`, releaseError);
    }

    const emailAudit = await tentarEnviarConfirmacao({ context, appointment: newAppointment, protocol });
    try {
      newAppointment = await wixData.update(
        APPOINTMENTS_COLLECTION,
        { ...newAppointment, ...emailAudit, atualizadoEm: new Date() },
        { suppressAuth: true },
      );
    } catch (auditError) {
      console.warn("Remarcação v2 concluída, mas auditoria do e-mail não foi persistida.", auditError);
    }

    return {
      ok: true,
      protocol,
      protocolo: protocol,
      original: originalSaved,
      appointment: newAppointment,
    };
  } catch (error) {
    if (!newAppointment && lock?._id) await removeLockQuietly(lock._id);
    if (newAppointment?._id) {
      try {
        await wixData.update(
          APPOINTMENTS_COLLECTION,
          { ...newAppointment, status: "cancelado", canceladoEm: new Date(), atualizadoEm: new Date() },
          { suppressAuth: true },
        );
        await liberarOcupacaoAgendamento(newAppointment);
      } catch (rollbackError) {
        console.error("Falha ao reverter remarcação v2:", rollbackError);
      }
    }
    throw error;
  }
}

async function getRequiredSecret(name) {
  const value = await getSecret(name);
  if (!text(value)) throw new Error(`Secret ${name} indisponível.`);
  return value;
}

async function getOptionalSecret(name) {
  try {
    return text(await getSecret(name));
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function authHeader(apiKey) {
  const key = text(apiKey);
  return /^(App|Basic|Bearer)\s+/i.test(key) ? key : `App ${key}`;
}

function multipart(fields = {}) {
  const boundary = `----oabjf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="${text(name).replace(/"/g, "")}"\r\n\r\n`);
    parts.push(String(value));
    parts.push("\r\n");
  }
  parts.push(`--${boundary}--\r\n`);
  return { boundary, body: parts.join("") };
}

async function sendInfobipEmail({ to, subject, textBody, htmlBody }) {
  const [baseUrlRaw, apiKey, fromEmailRaw, fromNameRaw, logoUrl] = await Promise.all([
    getRequiredSecret("INFOBIP_BASE_URL"),
    getRequiredSecret("INFOBIP_API_KEY"),
    getRequiredSecret("INFOBIP_FROM_EMAIL"),
    getRequiredSecret("INFOBIP_FROM_NAME"),
    getOptionalSecret("OAB_EMAIL_LOGO_URL"),
  ]);
  const baseUrl = text(baseUrlRaw).replace(/\/+$/, "").replace(/^(?!https?:\/\/)/i, "https://");
  const fromEmail = normalizeEmail(fromEmailRaw);
  const fromName = text(fromNameRaw).replace(/[<>\"]/g, "") || "OAB Juiz de Fora";
  const data = multipart({
    from: `${fromName} <${fromEmail}>`,
    to: JSON.stringify({ to }),
    subject,
    text: textBody,
    html: htmlBody.replace("{{LOGO_URL}}", escapeHtml(logoUrl)),
  });
  const response = await fetch(`${baseUrl}${INFOBIP_EMAIL_ENDPOINT}`, {
    method: "post",
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
      "Content-Type": `multipart/form-data; boundary=${data.boundary}`,
    },
    body: data.body,
  });
  if (!response.ok) throw new Error(`Infobip retornou ${response.status}.`);
}

async function tentarEnviarConfirmacao({ context, appointment, protocol }) {
  const to = normalizeEmail(appointment.solicitanteEmail || appointment.emailAdvogado);
  try {
    const date = text(appointment.dataLabel);
    const time = `${text(appointment.horarioInicio)} – ${text(appointment.horarioFim)}`;
    const subject = `[OAB/JF] Agendamento confirmado · ${protocol}`;
    const textBody = [
      `Olá, ${text(appointment.solicitanteNome)}.`,
      "",
      "Seu agendamento na OAB Juiz de Fora foi confirmado.",
      "",
      `Serviço: ${context.modality.publicName}`,
      `Atendimento: ${context.resource.name}`,
      `Local: ${context.location.name}${context.location.address ? ` — ${context.location.address}` : ""}`,
      `Data: ${date}`,
      `Horário: ${time}`,
      `Protocolo: ${protocol}`,
      "",
      `Consulte, cancele ou remarque em ${CENTRAL_PUBLIC_URL}/consultar`,
    ].join("\n");
    const htmlBody = `<!doctype html><html><body style="margin:0;background:#f4f0e8;color:#171717;font-family:Arial,Helvetica,sans-serif"><table width="100%" role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px"><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf8;border:1px solid #ddd6c8"><tr><td style="height:3px;background:#b11f2a"></td></tr><tr><td style="padding:28px 30px 18px;border-bottom:1px solid #e6dfd3"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#1f4b78">OAB Juiz de Fora</div><h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#171717">Agendamento confirmado</h1></td></tr><tr><td style="padding:26px 30px"><p style="margin:0 0 20px;line-height:1.6">Olá, ${escapeHtml(appointment.solicitanteNome)}.</p><table width="100%" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f7f1e6"><tr><td style="padding:12px 14px;border-bottom:1px solid #e4dccf">Serviço</td><td style="padding:12px 14px;border-bottom:1px solid #e4dccf;font-weight:700">${escapeHtml(context.modality.publicName)}</td></tr><tr><td style="padding:12px 14px;border-bottom:1px solid #e4dccf">Atendimento</td><td style="padding:12px 14px;border-bottom:1px solid #e4dccf;font-weight:700">${escapeHtml(context.resource.name)}</td></tr><tr><td style="padding:12px 14px;border-bottom:1px solid #e4dccf">Local</td><td style="padding:12px 14px;border-bottom:1px solid #e4dccf;font-weight:700">${escapeHtml(context.location.name)}</td></tr><tr><td style="padding:12px 14px;border-bottom:1px solid #e4dccf">Data e horário</td><td style="padding:12px 14px;border-bottom:1px solid #e4dccf;font-weight:700">${escapeHtml(date)} · ${escapeHtml(time)}</td></tr><tr><td style="padding:12px 14px">Protocolo</td><td style="padding:12px 14px;font-weight:700;color:#b11f2a">${escapeHtml(protocol)}</td></tr></table><p style="margin:22px 0 0;line-height:1.6;color:#56524c">Guarde o protocolo. Você pode acompanhar, cancelar ou remarcar em <a style="color:#1f4b78" href="${CENTRAL_PUBLIC_URL}/consultar">${CENTRAL_PUBLIC_URL}/consultar</a>.</p></td></tr></table></td></tr></table></body></html>`;
    await sendInfobipEmail({ to, subject, textBody, htmlBody });
    return {
      emailAdvogadoEnviado: true,
      emailAdvogadoDestino: to,
      emailAdvogadoErro: "",
      emailAdvogadoEnviadoEm: new Date(),
    };
  } catch (error) {
    console.warn(`Agendamento ${protocol} salvo, mas e-mail não enviado.`, error);
    return {
      emailAdvogadoEnviado: false,
      emailAdvogadoDestino: to,
      emailAdvogadoErro: text(error?.message || error).slice(0, 700),
      emailAdvogadoEnviadoEm: null,
    };
  }
}

export const __test = {
  isVersionedAppointment,
  lockExpired,
  validateBookingPayload,
};
