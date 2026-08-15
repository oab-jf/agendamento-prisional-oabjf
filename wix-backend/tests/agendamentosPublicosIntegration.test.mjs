import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const httpFunctions = fs.readFileSync(
  new URL("../source/http-functions.js", import.meta.url),
  "utf8",
);
const adminApi = fs.readFileSync(
  new URL("../source/adminApi.js", import.meta.url),
  "utf8",
);
const store = fs.readFileSync(
  new URL("../source/agendamentosPublicosStore.js", import.meta.url),
  "utf8",
);
const apiClient = fs.readFileSync(
  new URL("../../src/lib/oab-api.ts", import.meta.url),
  "utf8",
);
const pagesRouter = fs.readFileSync(
  new URL("../../src/pages-router.tsx", import.meta.url),
  "utf8",
);
const publicRoute = fs.readFileSync(
  new URL("../../src/routes/agendar.$serviceSlug.$offerId.tsx", import.meta.url),
  "utf8",
);
const consultRoute = fs.readFileSync(
  new URL("../../src/routes/consultar.tsx", import.meta.url),
  "utf8",
);
const mobileShell = fs.readFileSync(
  new URL("../../src/components/MobileShell.tsx", import.meta.url),
  "utf8",
);
const appHeader = fs.readFileSync(
  new URL("../../src/components/AppHeader.tsx", import.meta.url),
  "utf8",
);
const appFooter = fs.readFileSync(
  new URL("../../src/components/AppFooter.tsx", import.meta.url),
  "utf8",
);
const choiceCard = fs.readFileSync(
  new URL("../../src/components/PublicChoiceCard.tsx", import.meta.url),
  "utf8",
);
const publicStyles = fs.readFileSync(
  new URL("../../src/styles.css", import.meta.url),
  "utf8",
);
const prisonUnitRoute = fs.readFileSync(
  new URL("../../src/routes/agendar.unidade.tsx", import.meta.url),
  "utf8",
);
const prisonDateRoute = fs.readFileSync(
  new URL("../../src/routes/agendar.data.tsx", import.meta.url),
  "utf8",
);
const documentUnitRoute = fs.readFileSync(
  new URL("../../src/routes/documento.unidade.tsx", import.meta.url),
  "utf8",
);
const documentUploadRoute = fs.readFileSync(
  new URL("../../src/routes/documento.upload.tsx", import.meta.url),
  "utf8",
);


test("HTTP público expõe disponibilidade e criação v2 sem substituir o endpoint prisional", () => {
  assert.match(httpFunctions, /from 'backend\/agendamentosPublicosStore'/);
  assert.match(httpFunctions, /export async function use_oabAgendamentoDisponibilidade/);
  assert.match(httpFunctions, /export async function use_oabAgendamentosV2/);
  assert.match(httpFunctions, /export async function use_oabAgendamentos\(/);
});

test("endpoint encaminha data selecionada para o contrato dateIso do store", () => {
  assert.match(
    httpFunctions,
    /listarDisponibilidadeOfertaPublica\(\{\s*offerId,\s*dateIso:\s*dataIso,\s*\}\)/,
  );
  assert.match(
    store,
    /listarDisponibilidadeOfertaPublica\(\{ offerId, dateIso = ""/,
  );
});


test("store multimodal usa coleção técnica de ocupação e lock por vaga", () => {
  assert.match(store, /const OCCUPANCY_COLLECTION = "AgendamentoOcupacoes"/);
  assert.match(store, /buildOccupancyLockId/);
  assert.match(store, /wixData\.insert\(OCCUPANCY_COLLECTION, lock/);
  assert.match(store, /appointmentId: appointment\._id/);
  assert.match(store, /!appointment \|\| !isActiveAppointment\(appointment\)/);
});


test("cancelamento e remarcação públicos reconhecem agendamento schema v2", () => {
  assert.match(adminApi, /item\.solicitanteEmail \|\| item\.emailAdvogado \|\| item\.emailIndex/);
  assert.match(adminApi, /await liberarOcupacaoAgendamento\(salvo\)/);
  assert.match(adminApi, /await remarcarAgendamentoPublicoV2\(original/);
  assert.match(adminApi, /cancelamentoPrazoHoras/);
  assert.match(adminApi, /remarcacaoPrazoHoras/);
});


test("agenda administrativa preserva contexto multimodal de registros v2", () => {
  assert.match(adminApi, /function mapAgendamentoAdmin\(item\)/);
  assert.match(adminApi, /schemaVersion: isV2 \? 2 : 1/);
  assert.match(adminApi, /modalidadeId: text\(item\.modalidadeId\)/);
  assert.match(adminApi, /modalidadeNome: text\(item\.modalidadeNome\)/);
  assert.match(adminApi, /ofertaNome: text\(item\.ofertaNome\)/);
  assert.match(adminApi, /localNome: text\(item\.localNome\)/);
  assert.match(adminApi, /recursoNome: text\(item\.recursoNome\)/);
  assert.match(adminApi, /nomeAdvogado: solicitanteNome/);
});


test("cliente público possui jornada dinâmica e consulta disponibilidade da oferta", () => {
  assert.match(apiClient, /export async function listarDisponibilidadeOferta/);
  assert.match(apiClient, /export async function confirmarAgendamentoV2/);
  assert.match(publicRoute, /createFileRoute\("\/agendar\/\$serviceSlug\/\$offerId"\)/);
  assert.match(publicRoute, /Revise e confirme/);
  assert.match(pagesRouter, /\^\\\/agendar\\\/\[\^\/\]\+\\\/\[\^\/\]\+\$/);
});


test("consulta/remarcação pública reutiliza a agenda multimodal e mantém contexto prisional", () => {
  assert.match(consultRoute, /listarDisponibilidadeOferta/);
  assert.match(consultRoute, /const isGeneric =/);
  assert.match(consultRoute, /label="Unidade prisional"/);
  assert.match(consultRoute, /label="Serviço"/);
  assert.match(consultRoute, /isGeneric \? "Atendimento" : "Unidade"/);
});

test("resultado da consulta importa PageTitle antes de renderizar o detalhe", () => {
  assert.match(
    consultRoute,
    /import \{ MobileShell, PageTitle \} from "@\/components\/MobileShell";/,
  );
  assert.match(consultRoute, /<PageTitle/);
});



test("upload de documento usa URL assinada e envio direto, sem Base64 pelo Velo", () => {
  assert.match(httpFunctions, /export async function use_oabDocumentoUploadUrl/);
  assert.match(httpFunctions, /mediaManager\.getUploadUrl\(DOCUMENT_UPLOAD_FOLDER/);
  assert.match(apiClient, /oabDocumentoUploadUrl/);
  assert.match(apiClient, /new XMLHttpRequest\(\)/);
  assert.match(apiClient, /xhr\.open\("PUT"/);
  assert.doesNotMatch(apiClient, /fileToBase64/);
  assert.match(documentUploadRoute, /document-upload-progress/);
  assert.match(documentUploadRoute, /uploadProgress/);
});

test("fluxos públicos compartilham shell, progresso, ações e escolhas canônicas", () => {
  assert.match(appHeader, /public-site-header__tricolor/);
  assert.match(appHeader, /public-site-header__nav/);
  assert.doesNotMatch(appHeader, />Voltar</);
  assert.match(appFooter, /public-site-footer__tricolor/);
  assert.match(appFooter, /public-site-footer__links/);
  assert.match(mobileShell, /public-flow-header/);
  assert.match(mobileShell, /public-flow-breadcrumb/);
  assert.match(mobileShell, /public-flow-progress/);
  assert.match(mobileShell, /public-flow-actions/);
  assert.match(mobileShell, /public-button--primary/);
  assert.match(choiceCard, /public-choice-card/);
  assert.match(choiceCard, /role="radio"/);
  assert.match(choiceCard, /aria-checked=\{selected\}/);
  assert.match(prisonUnitRoute, /<PublicChoiceCard/);
  assert.match(documentUnitRoute, /<PublicChoiceCard/);
  assert.match(prisonDateRoute, /<PublicChoiceCard/);
  assert.match(prisonDateRoute, /role="radiogroup"/);
  assert.doesNotMatch(prisonUnitRoute, /<MobileShell[^>]*back="\/"/);
  assert.doesNotMatch(documentUnitRoute, /<MobileShell[^>]*back="\/"/);
  assert.doesNotMatch(consultRoute, /← Voltar para a Central/);
  assert.doesNotMatch(prisonUnitRoute, /<StepActions\s+back="\/"\s+next="\/agendar\/data"/);
  assert.doesNotMatch(documentUnitRoute, /<StepActions\s+back="\/"\s+next="\/documento\/advogado"/);
  assert.match(mobileShell, /Etapas do agendamento/);
  assert.match(mobileShell, /Etapas do envio/);
  assert.match(mobileShell, /destructiveNext \? "public-button--danger" : "public-button--primary"/);
  assert.match(mobileShell, /nextDisabled \? " public-button--disabled" : ""/);
  assert.match(publicStyles, /public-flow-actions > \.public-button:last-child/);
  assert.match(publicStyles, /public-service-card__action:hover/);
  assert.match(publicStyles, /public-support-link:hover/);
  assert.match(publicStyles, /padding-left: 2rem/);
  assert.match(publicStyles, /padding-right: 2rem/);
});
