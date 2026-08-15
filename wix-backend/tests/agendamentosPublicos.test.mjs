import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOccupancyLockId,
  buildOfferSlots,
  listOfferDates,
  validateRequestedPublicSlot,
} from "../domain/agendamentosPublicos.js";

const OFFER = {
  id: "sala-01-agenda",
  modalityId: "espaco_atendimento",
  resourceId: "sala-01",
  durationMinutes: 60,
  capacity: 2,
  minimumNoticeHours: 24,
  maximumAdvanceDays: 30,
  weeklySchedule: [
    { weekday: 1, startTime: "08:00", endTime: "13:00" },
    { weekday: 1, startTime: "14:00", endTime: "18:00" },
    { weekday: 5, startTime: "09:00", endTime: "12:00" },
    { weekday: 5, startTime: "13:00", endTime: "16:00" },
  ],
};

const NOW = new Date("2026-08-14T09:00:00-03:00");

test("múltiplas faixas do mesmo dia preservam intervalo na agenda pública", () => {
  const slots = buildOfferSlots(OFFER, "2026-08-17", {
    now: NOW,
    occupancyByStart: {},
  });

  assert.deepEqual(
    slots.map((slot) => slot.horarioInicio),
    ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"],
  );
  assert.equal(slots.some((slot) => slot.horarioInicio === "13:00"), false);
});

test("capacidade remove horário cheio e mantém horário parcialmente ocupado", () => {
  const slots = buildOfferSlots(OFFER, "2026-08-17", {
    now: NOW,
    occupancyByStart: { "08:00": 2, "09:00": 1 },
  });

  assert.equal(slots.some((slot) => slot.horarioInicio === "08:00"), false);
  assert.equal(slots.find((slot) => slot.horarioInicio === "09:00")?.vagasRestantes, 1);
});

test("antecedência mínima impede horários próximos", () => {
  const offer = {
    ...OFFER,
    minimumNoticeHours: 48,
    weeklySchedule: [{ weekday: 5, startTime: "09:00", endTime: "16:00" }],
  };
  const friday = buildOfferSlots(offer, "2026-08-14", { now: NOW, occupancyByStart: {} });
  assert.deepEqual(friday, []);
});

test("datas públicas respeitam dias configurados", () => {
  const dates = listOfferDates(OFFER, { now: NOW, limit: 10 });
  assert.ok(dates.length > 0);
  assert.ok(dates.every((date) => ["2026-08-17", "2026-08-21", "2026-08-24"].includes(date.dataIso)));
});

test("validação final rejeita slot que ficou sem capacidade", () => {
  const result = validateRequestedPublicSlot({
    offer: OFFER,
    dateIso: "2026-08-17",
    startTime: "09:00",
    occupancyByStart: { "09:00": 2 },
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "HORARIO_INDISPONIVEL");
});

test("lock tem identidade determinística por slot e vaga", () => {
  const first = buildOccupancyLockId({
    modalityId: "espaco_atendimento",
    resourceId: "sala-01",
    dateIso: "2026-08-17",
    startTime: "09:00",
    seat: 1,
  });
  const same = buildOccupancyLockId({
    modalityId: "espaco_atendimento",
    resourceId: "sala-01",
    dateIso: "2026-08-17",
    startTime: "09:00",
    seat: 1,
  });
  const second = buildOccupancyLockId({
    modalityId: "espaco_atendimento",
    resourceId: "sala-01",
    dateIso: "2026-08-17",
    startTime: "09:00",
    seat: 2,
  });

  assert.match(first, /^occ_[a-f0-9]{16}$/);
  assert.equal(first, same);
  assert.notEqual(first, second);
});


test("requisição direta não pode reservar depois do limite máximo configurado", () => {
  const offer = {
    id: "agenda",
    modalityId: "servico_custom",
    locationId: "sede",
    resourceId: "sala-1",
    durationMinutes: 60,
    capacity: 1,
    minimumNoticeHours: 0,
    maximumAdvanceDays: 7,
    weeklySchedule: [
      { weekday: 5, startTime: "08:00", endTime: "18:00" },
    ],
  };
  const now = new Date("2026-08-14T09:00:00-03:00");
  assert.deepEqual(buildOfferSlots(offer, "2026-08-28", { now }), []);
});

test("faixas sobrepostas não duplicam o mesmo horário público", () => {
  const offer = {
    id: "agenda",
    modalityId: "servico_custom",
    locationId: "sede",
    resourceId: "sala-1",
    durationMinutes: 60,
    capacity: 1,
    minimumNoticeHours: 0,
    maximumAdvanceDays: 30,
    weeklySchedule: [
      { weekday: 5, startTime: "08:00", endTime: "12:00" },
      { weekday: 5, startTime: "10:00", endTime: "14:00" },
    ],
  };
  const now = new Date("2026-08-14T06:00:00-03:00");
  const slots = buildOfferSlots(offer, "2026-08-14", { now });
  assert.deepEqual(slots.map((slot) => slot.horarioInicio), ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"]);
});
