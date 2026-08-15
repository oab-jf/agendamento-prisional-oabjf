/**
 * Regras puras do fluxo público multimodal de agendamentos.
 *
 * Não importa APIs Wix. Mantém geração de datas/horários, validação de
 * antecedência e identidade determinística de locks testáveis em Node.
 */

import {
  AGENDAMENTOS_TIME_ZONE,
  buildSlotIdentity,
} from "./agendamentosCore.js";

const DATE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SAO_PAULO_OFFSET = "-03:00";
const ACTIVE_STATUS = "ativo";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function timeToMinutes(value) {
  const normalized = text(value);
  if (!TIME_PATTERN.test(normalized)) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value) {
  const total = Number(value);
  if (!Number.isInteger(total) || total < 0 || total >= 24 * 60) return "";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function localDateTime(dateIso, time = "00:00") {
  if (!DATE_ISO_PATTERN.test(text(dateIso)) || !TIME_PATTERN.test(text(time))) {
    return null;
  }
  const parsed = new Date(`${dateIso}T${time}:00${SAO_PAULO_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(dateIso, amount) {
  const date = localDateTime(dateIso, "12:00");
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENDAMENTOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function currentDateIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENDAMENTOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function weekdayFor(dateIso) {
  const date = localDateTime(dateIso, "12:00");
  return date ? date.getUTCDay() : null;
}

function dateLabel(dateIso) {
  const date = localDateTime(dateIso, "12:00");
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: AGENDAMENTOS_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(/\./g, "");
}

function fullDateLabel(dateIso) {
  const date = localDateTime(dateIso, "12:00");
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: AGENDAMENTOS_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizeSchedule(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      weekday: integer(item?.weekday, -1),
      startTime: text(item?.startTime || item?.start),
      endTime: text(item?.endTime || item?.end),
    }))
    .filter(
      (item) =>
        item.weekday >= 0 &&
        item.weekday <= 6 &&
        TIME_PATTERN.test(item.startTime) &&
        TIME_PATTERN.test(item.endTime) &&
        item.endTime > item.startTime,
    )
    .sort((a, b) =>
      a.weekday !== b.weekday
        ? a.weekday - b.weekday
        : a.startTime.localeCompare(b.startTime),
    );
}

export function normalizePublicOffer(value = {}) {
  return {
    id: text(value.id),
    modalityId: text(value.modalityId),
    locationId: text(value.locationId),
    resourceId: text(value.resourceId),
    durationMinutes: Math.max(5, integer(value.durationMinutes, 30)),
    capacity: Math.max(1, integer(value.capacity, 1)),
    minimumNoticeHours: Math.max(0, integer(value.minimumNoticeHours, 0)),
    maximumAdvanceDays: Math.max(1, integer(value.maximumAdvanceDays, 30)),
    cancelDeadlineHours: Math.max(0, integer(value.cancelDeadlineHours, 0)),
    rescheduleDeadlineHours: Math.max(0, integer(value.rescheduleDeadlineHours, 0)),
    weeklySchedule: normalizeSchedule(value.weeklySchedule),
  };
}

export function listOfferDates(offerValue, { now = new Date(), limit = 60 } = {}) {
  const offer = normalizePublicOffer(offerValue);
  if (!offer.id || !offer.weeklySchedule.length) return [];

  const today = currentDateIso(now);
  const maximum = Math.min(offer.maximumAdvanceDays, Math.max(1, Number(limit || 60)));
  const daysWithSchedule = new Set(offer.weeklySchedule.map((item) => item.weekday));
  const dates = [];

  for (let offset = 0; offset <= maximum; offset += 1) {
    const dateIso = addDays(today, offset);
    const weekday = weekdayFor(dateIso);
    if (!daysWithSchedule.has(weekday)) continue;

    const slots = buildOfferSlots(offer, dateIso, {
      now,
      occupancyByStart: {},
      ignoreCapacity: true,
    });

    if (!slots.length) continue;

    dates.push({
      id: dateIso,
      dataIso: dateIso,
      label: dateLabel(dateIso),
      labelCompleta: fullDateLabel(dateIso),
      diaSemana: new Intl.DateTimeFormat("pt-BR", {
        timeZone: AGENDAMENTOS_TIME_ZONE,
        weekday: "long",
      }).format(localDateTime(dateIso, "12:00")),
      disponivel: true,
    });
  }

  return dates;
}

export function buildOfferSlots(
  offerValue,
  dateIso,
  { now = new Date(), occupancyByStart = {}, ignoreCapacity = false } = {},
) {
  const offer = normalizePublicOffer(offerValue);
  if (!DATE_ISO_PATTERN.test(text(dateIso))) return [];

  const today = currentDateIso(now);
  const lastBookableDate = addDays(today, offer.maximumAdvanceDays);
  if (dateIso < today || dateIso > lastBookableDate) return [];

  const weekday = weekdayFor(dateIso);
  const ranges = offer.weeklySchedule.filter((item) => item.weekday === weekday);
  const slots = [];
  const seenStarts = new Set();

  for (const range of ranges) {
    const start = timeToMinutes(range.startTime);
    const end = timeToMinutes(range.endTime);
    if (start === null || end === null) continue;

    for (
      let cursor = start;
      cursor + offer.durationMinutes <= end;
      cursor += offer.durationMinutes
    ) {
      const startTime = minutesToTime(cursor);
      const endTime = minutesToTime(cursor + offer.durationMinutes);
      if (seenStarts.has(startTime)) continue;
      const startsAt = localDateTime(dateIso, startTime);
      if (!startsAt) continue;

      const earliest = now.getTime() + offer.minimumNoticeHours * 60 * 60 * 1000;
      if (startsAt.getTime() < earliest) continue;

      const occupancy = Math.max(0, integer(occupancyByStart[startTime], 0));
      const remaining = Math.max(offer.capacity - occupancy, 0);
      if (!ignoreCapacity && remaining <= 0) continue;

      seenStarts.add(startTime);
      slots.push({
        id: `${dateIso}-${startTime}`,
        value: startTime,
        label: `${startTime} – ${endTime}`,
        dataIso: dateIso,
        horarioInicio: startTime,
        horarioFim: endTime,
        capacidade: offer.capacity,
        ocupacao: occupancy,
        vagasRestantes: ignoreCapacity ? offer.capacity : remaining,
        disponivel: true,
      });
    }
  }

  return slots;
}

export function validateRequestedPublicSlot({ offer, dateIso, startTime, occupancyByStart, now = new Date() }) {
  const slots = buildOfferSlots(offer, dateIso, { now, occupancyByStart });
  const match = slots.find((slot) => slot.horarioInicio === text(startTime));
  if (!match) {
    return {
      ok: false,
      code: "HORARIO_INDISPONIVEL",
      message: "Este horário não está mais disponível. Escolha outra opção.",
    };
  }
  return { ok: true, slot: match };
}

function hash32(value, seed) {
  let hash = seed >>> 0;
  const source = String(value);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function buildOccupancyLockId({ modalityId, resourceId, dateIso, startTime, seat }) {
  const slotIdentity = buildSlotIdentity({ modalityId, resourceId, dateIso, startTime });
  const normalizedSeat = Math.max(1, integer(seat, 1));
  const source = `${slotIdentity}|seat:${normalizedSeat}`;
  return `occ_${hash32(source, 2166136261)}${hash32(source, 2246822519)}`;
}

export function buildPublicSlotIdentity({ modalityId, resourceId, dateIso, startTime }) {
  return buildSlotIdentity({ modalityId, resourceId, dateIso, startTime });
}

export function assertPublicOfferIsBookable({ modality, location, resource, offer }) {
  if (!modality || modality.status !== ACTIVE_STATUS) {
    throw new Error("SERVICO_INDISPONIVEL");
  }
  if (!location || location.status !== ACTIVE_STATUS) {
    throw new Error("LOCAL_INDISPONIVEL");
  }
  if (!resource || resource.status !== ACTIVE_STATUS) {
    throw new Error("ITEM_INDISPONIVEL");
  }
  if (!offer || offer.status !== ACTIVE_STATUS || offer.availabilityMode !== "weekly") {
    throw new Error("OPCAO_INDISPONIVEL");
  }
  if (!normalizeSchedule(offer.weeklySchedule).length) {
    throw new Error("HORARIOS_NAO_CONFIGURADOS");
  }
  return true;
}

export const __test = {
  addDays,
  currentDateIso,
  dateLabel,
  fullDateLabel,
  localDateTime,
  minutesToTime,
  normalizeSchedule,
  timeToMinutes,
  weekdayFor,
};
