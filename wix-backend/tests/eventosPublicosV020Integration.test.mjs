import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../source/http-functions.js", import.meta.url),
  "utf8",
);

function publicEventsV020Block() {
  const start = source.indexOf(
    "// Site público — detalhe, RSVP e ticketing de Eventos v0.2",
  );
  const end = source.indexOf(
    "/**\n * GET /_functions/oabHome",
    start,
  );

  assert.notEqual(start, -1, "bloco v0.2 não encontrado");
  assert.notEqual(end, -1, "fim do bloco v0.2 não encontrado");

  return source.slice(start, end);
}

test("detalhe público usa slug, formulário e ingressos do Wix", () => {
  const block = publicEventsV020Block();

  assert.match(
    source,
    /import \{ wixEventsV2, orders \} from 'wix-events\.v2';/,
  );
  assert.match(
    source,
    /import \{ rsvpV2 \} from '@wix\/events';/,
  );
  assert.match(
    block,
    /wixEventsV2\.getEventBySlug\(slug,/,
  );
  assert.match(
    block,
    /orders\.listAvailableTickets\(\{/,
  );
  assert.match(
    block,
    /export async function use_oabEventoPublico\(request\)/,
  );
  assert.match(block, /customRsvpSupported/);
  assert.match(block, /customTicketingSupported/);
  assert.match(block, /function eventoV020StreetAddress\(address = \{\}\)/);
  assert.match(block, /address\.formattedAddress/);
  assert.match(block, /address\.formatted/);
  assert.match(block, /street\.name/);
  assert.match(block, /street\.number/);
});

test("RSVP público usa RSVP V2 atual e valida o formulário oficial", () => {
  const block = publicEventsV020Block();

  assert.match(
    block,
    /export async function use_oabEventoRsvp\(request\)/,
  );
  assert.match(
    block,
    /rsvpV2\.createRsvp\(\{\s*rsvp: rsvpPayload,/s,
  );
  assert.match(block, /formFields/);
  assert.match(block, /additionalGuestDetails/);
  assert.match(block, /ORIGEM_NAO_AUTORIZADA/);
  assert.match(block, /MUITAS_TENTATIVAS/);
});

test("ticketing reserva estoque sem receber dados de cartão", () => {
  const block = publicEventsV020Block();

  assert.match(
    block,
    /export async function use_oabEventoReservarIngressos\(request\)/,
  );
  assert.match(
    block,
    /orders\.createReservation\(\s*evento\.id,\s*\{\s*ticketQuantities,/s,
  );
  assert.match(block, /ticket-form\?reservationId=/);
  assert.match(block, /orders\.cancelReservation\(/);

  assert.doesNotMatch(block, /cardNumber/i);
  assert.doesNotMatch(block, /cvv/i);
  assert.doesNotMatch(block, /securityCode/i);
  assert.doesNotMatch(block, /creditCard/i);
});
