/**
 * Cliente HTTP da Central de Agendamentos OAB/JF.
 *
 * Conecta o fluxo público de agendamento aos endpoints publicados no Wix
 * (Velo HTTP Functions). Todas as respostas seguem o envelope `{ ok, ... }`.
 *
 * Normalização: o backend Wix pode responder com `codigo`, `mensagem`, `erro`
 * (PT-BR) ou `code`, `message`, `error` (EN). O cliente normaliza para que o
 * restante do app continue usando `code` / `message` / `error`.
 */

const API_BASE = "https://www.juizdefora-oabmg.org.br/_functions";

const CACHE_CATALOGO_MS = 2 * 60 * 1000;

export type PublicAppointmentOffer = {
  id: string;
  name: string;
  description: string;
  bookingPath: string;
  durationMinutes: number;
  capacity: number;
  location: {
    id: string;
    name: string;
    address: string;
    kind: string;
  } | null;
  resource: {
    id: string;
    name: string;
    kind: string;
  } | null;
  order: number;
};

export type PublicAppointmentModality = {
  id: string;
  familyId: string;
  template: string;
  publicName: string;
  description: string;
  offers: PublicAppointmentOffer[];
  order: number;
};

export type PublicAppointmentCatalog = {
  schemaVersion: number;
  revision: number;
  modalities: PublicAppointmentModality[];
};

const CACHE_UNIDADES_MS = 5 * 60 * 1000;
const CACHE_DATAS_MS = 2 * 60 * 1000;
const CACHE_HORARIOS_MS = 45 * 1000;

type CacheEntry<T> = { expiresAt: number; value: T };

const memoryCache = new Map<string, CacheEntry<unknown>>();

function canUseMemoryCache() {
  return typeof window !== "undefined";
}

function readMemoryCache<T>(key: string): T | null {
  if (!canUseMemoryCache()) return null;
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = readMemoryCache<T>(key);
  if (hit) return hit;
  const value = await loader();
  if (canUseMemoryCache()) {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  return value;
}

export async function listarCatalogoAgendamentos(): Promise<PublicAppointmentCatalog> {
  return cached("catalogo-agendamentos-publico", CACHE_CATALOGO_MS, async () => {
    const response = await fetch(`${API_BASE}/oabAgendamentoCatalogo`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const raw = (await response.json().catch(() => null)) as
      | { ok?: boolean; catalogo?: PublicAppointmentCatalog; mensagem?: string }
      | null;

    if (!response.ok || !raw?.ok || !raw.catalogo) {
      throw new Error(raw?.mensagem || "Não foi possível carregar as modalidades de agendamento.");
    }

    return raw.catalogo;
  });
}

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = {
  ok: false;
  // EN
  error?: string;
  code?: string;
  message?: string;
  // PT-BR (variações vindas do Wix/Velo)
  erro?: string;
  codigo?: string;
  mensagem?: string;
};

// ---------- Normalização de erros vindos do Wix ----------

type AnyErr = Partial<ApiErr> & Record<string, unknown>;

function getApiCode(data: AnyErr | null | undefined): string | undefined {
  if (!data) return undefined;
  return (data.code as string) || (data.codigo as string) || undefined;
}

function getApiMessage(data: AnyErr | null | undefined): string | undefined {
  if (!data) return undefined;
  return (
    (data.message as string) ||
    (data.mensagem as string) ||
    (data.error as string) ||
    (data.erro as string) ||
    undefined
  );
}

/**
 * Devolve sempre um envelope `{ ok:false, code?, message?, error? }`
 * com os campos EN preenchidos, independente do que o Wix tenha mandado.
 */
function normalizeApiError(
  data: AnyErr | null | undefined,
  fallbackMessage = "Não foi possível concluir a operação.",
): { ok: false; code?: string; message?: string; error?: string } {
  const code = getApiCode(data);
  const message = getApiMessage(data) || fallbackMessage;
  return { ok: false, code, message, error: message };
}

function isSessionExpiredCode(code?: string): boolean {
  return code === "ADMIN_NAO_AUTORIZADO" || code === "SESSAO_EXPIRADA";
}

// ---------- Tipos públicos ----------

export type Unidade = {
  id: string;
  slug: string;
  nome: string;
  endereco?: string;
  ativa?: boolean;
};

export type DataDisponivel = {
  id: string;
  dataIso: string;
  label: string;
  diaSemana: string;
  diaMes: string;
  disponivel: boolean;
  encerrado: boolean;
};

export type HorarioDisponivel = {
  id: string;
  value: string;
  label: string;
  horarioInicio: string;
  horarioFim: string;
  disponivel: boolean;
};

export type AgendamentoPayload = {
  unidadeSlug: string;
  unidadeNome?: string;
  dataIso: string;
  dataLabel?: string;
  horarioInicio: string;
  horarioFim: string;
  nomeAdvogado: string;
  numeroOab: string;
  emailAdvogado: string;
  telefoneAdvogado: string;
  nomeIpl: string;
  infopen?: string;
  cienciaRegras: boolean;
};

export type AgendamentoResposta =
  | { ok: true; protocolo: string; [k: string]: unknown }
  | { ok: false; code?: string; error?: string; message?: string };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao chamar ${path}`);
  return (await res.json()) as T;
}

export async function listarUnidades(): Promise<Unidade[]> {
  return cached("unidades", CACHE_UNIDADES_MS, async () => {
    const r = await getJson<ApiOk<{ unidades: Unidade[] }> | ApiErr>("/oabUnidades");
    if (!r.ok) throw new Error(getApiMessage(r) || "Falha ao listar unidades");
    return r.unidades.filter((u) => u.ativa !== false);
  });
}

export async function listarDatasDisponiveis(unidadeSlug: string): Promise<DataDisponivel[]> {
  return cached(`datas:${unidadeSlug}`, CACHE_DATAS_MS, async () => {
    const r = await getJson<ApiOk<{ datas: DataDisponivel[] }> | ApiErr>(
      `/oabDatas?unidadeSlug=${encodeURIComponent(unidadeSlug)}`,
    );
    if (!r.ok) throw new Error(getApiMessage(r) || "Falha ao listar datas");
    return r.datas;
  });
}

export async function listarHorariosDisponiveis(
  unidadeSlug: string,
  dataIso: string,
): Promise<HorarioDisponivel[]> {
  return cached(`horarios:${unidadeSlug}:${dataIso}`, CACHE_HORARIOS_MS, async () => {
    const r = await getJson<ApiOk<{ horarios: HorarioDisponivel[] }> | ApiErr>(
      `/oabHorarios?unidadeSlug=${encodeURIComponent(unidadeSlug)}&dataIso=${encodeURIComponent(dataIso)}`,
    );
    if (!r.ok) throw new Error(getApiMessage(r) || "Falha ao listar horários");
    return r.horarios.filter((h) => h.disponivel !== false);
  });
}

export type AdminLoginAdmin = {
  _id?: string;
  email: string;
  nome?: string;
  cargoFuncao?: string;
  permissoes?: string[];
  legacy?: boolean;
};

export type AdminLoginResposta =
  | {
      ok: true;
      token?: string;
      admin?: AdminLoginAdmin;
      precisaVerificarEmail?: boolean;
      precisaTrocarSenha?: boolean;
      email?: string;
      mensagem?: string;
    }
  | { ok: false; error?: string; message?: string; code?: string };

export async function adminLogin(email: string, senha: string): Promise<AdminLoginResposta> {
  const res = await fetch(`${API_BASE}/oabAdminLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  let raw: AnyErr | Record<string, unknown> | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo JSON */
  }
  if (!raw) {
    return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  }
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as AdminLoginResposta;
  }
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type ConfirmarEmailAdminResposta =
  | {
      ok: true;
      token: string;
      admin: AdminLoginAdmin;
      precisaTrocarSenha?: boolean;
      mensagem?: string;
    }
  | { ok: false; error?: string; message?: string; code?: string };

export async function confirmarEmailAdmin(payload: {
  email: string;
  senha: string;
  codigo: string;
}): Promise<ConfirmarEmailAdminResposta> {
  const res = await fetch(`${API_BASE}/oabAdminConfirmarEmail`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  let raw: AnyErr | Record<string, unknown> | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo */
  }
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as ConfirmarEmailAdminResposta;
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type ReenviarCodigoEmailResposta =
  | { ok: true; mensagem?: string }
  | { ok: false; error?: string; message?: string; code?: string };

export async function reenviarCodigoEmailAdmin(payload: {
  email: string;
  senha: string;
}): Promise<ReenviarCodigoEmailResposta> {
  const res = await fetch(`${API_BASE}/oabAdminReenviarCodigoEmail`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  let raw: AnyErr | Record<string, unknown> | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo */
  }
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as ReenviarCodigoEmailResposta;
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type TrocarSenhaAdminResposta =
  | { ok: true; token: string; admin: AdminLoginAdmin; mensagem?: string }
  | { ok: false; error?: string; message?: string; code?: string };

export async function trocarSenhaAdmin(
  token: string,
  payload: { novaSenha: string },
): Promise<TrocarSenhaAdminResposta> {
  const res = await fetch(`${API_BASE}/oabAdminTrocarSenha`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-OAB-Admin-Token": token,
    },
    body: JSON.stringify(payload),
  });
  let raw: AnyErr | Record<string, unknown> | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo */
  }
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as TrocarSenhaAdminResposta;
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type AdminAgendamento = {
  _id: string;
  protocolo: string;
  unidadeNome: string;
  unidadeSlug?: string;
  dataIso?: string;
  dataLabel: string;
  horarioLabel: string;
  nomeAdvogado: string;
  numeroOab: string;
  nomeIpl: string;
  infopen?: string;
  status: string;
  statusLabel: string;
  emailAdvogado?: string;
  telefoneAdvogado?: string;
  /** Para registros reagendados, protocolo do novo agendamento criado. */
  novoProtocolo?: string;
  /** Para novos registros gerados a partir de remarcação, protocolo de origem. */
  protocoloOrigem?: string;
};

export type AdminFiltros = {
  status?: string;
  unidadeSlug?: string;
  dataIso?: string;
  busca?: string;
};

export async function listarAdminAgendamentos(
  token: string,
  filtros: AdminFiltros = {},
): Promise<AdminAgendamento[]> {
  const qs = new URLSearchParams();
  if (filtros.status && filtros.status !== "todos") qs.set("status", filtros.status);
  if (filtros.unidadeSlug) qs.set("unidadeSlug", filtros.unidadeSlug);
  if (filtros.dataIso) qs.set("dataIso", filtros.dataIso);
  if (filtros.busca) qs.set("busca", filtros.busca);
  const url = `${API_BASE}/oabAdminAgendamentos${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-OAB-Admin-Token": token },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("SESSAO_EXPIRADA");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ao listar agendamentos`);
  const data = (await res.json()) as
    | { ok: true; agendamentos: Array<AdminAgendamento & { reagendadoParaProtocolo?: string }> }
    | AnyErr;
  if (!data.ok) {
    const code = getApiCode(data);
    if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
    throw new Error(getApiMessage(data) || "Falha ao listar agendamentos");
  }
  // Compatibilidade de campos de remarcação.
  return data.agendamentos.map((item) => ({
    ...item,
    novoProtocolo: item.novoProtocolo || item.reagendadoParaProtocolo,
  }));
}

export type CancelarAdminResposta =
  | {
      ok: true;
      mensagem?: string;
      agendamento: { _id: string; protocolo: string; status: string; statusLabel: string };
    }
  | { ok: false; error?: string; message?: string; code?: string };

export async function cancelarAdminAgendamento(
  token: string,
  agendamentoId: string,
): Promise<CancelarAdminResposta> {
  const res = await fetch(`${API_BASE}/oabAdminCancelarAgendamento`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-OAB-Admin-Token": token,
    },
    body: JSON.stringify({ agendamentoId }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("SESSAO_EXPIRADA");
  }
  let raw: AnyErr | CancelarAdminResposta | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo */
  }
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as CancelarAdminResposta;
  }
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type RemarcarAdminPayload = {
  agendamentoId: string;
  unidadeSlug: string;
  dataIso: string;
  horarioInicio: string;
  horarioFim: string;
};

export type RemarcarAdminResposta =
  | {
      ok: true;
      mensagem?: string;
      protocolo: string;
      agendamentoOriginal?: { status: string };
      novoAgendamento?: { protocolo: string; status: string };
    }
  | { ok: false; error?: string; message?: string; code?: string };

export async function remarcarAdminAgendamento(
  token: string,
  payload: RemarcarAdminPayload,
): Promise<RemarcarAdminResposta> {
  const res = await fetch(`${API_BASE}/oabAdminRemarcarAgendamento`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-OAB-Admin-Token": token,
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("SESSAO_EXPIRADA");
  }
  let raw: AnyErr | RemarcarAdminResposta | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo */
  }
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as RemarcarAdminResposta;
  }
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export async function confirmarAgendamento(
  payload: AgendamentoPayload,
): Promise<AgendamentoResposta> {
  const res = await fetch(`${API_BASE}/oabAgendamentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  // O Wix retorna o envelope mesmo em erros de negócio (4xx). Tenta ler JSON.
  let raw: AnyErr | AgendamentoResposta | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo JSON */
  }
  if (!raw) {
    return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  }
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as AgendamentoResposta;
  }
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

// ---------- Documentos (fluxo público) ----------

export const TIPOS_DOCUMENTO = [
  { value: "procuracao", label: "Procuração" },
  { value: "documento_complementar", label: "Formulário/documento para assinatura" },
  { value: "outro", label: "Outro documento" },
] as const;

export const DOCUMENTO_MIMES_ACEITOS = ["application/pdf", "image/jpeg", "image/png"] as const;
export const DOCUMENTO_EXTENSOES_ACEITAS = [".pdf", ".jpg", ".jpeg", ".png"] as const;
export const DOCUMENTO_TAMANHO_MAX_BYTES = 8 * 1024 * 1024;

export type DocumentoUploadResposta =
  | {
      ok: true;
      mensagem?: string;
      arquivoPrincipalUrl: string;
      arquivoPrincipalNome: string;
      arquivo: {
        url: string;
        nome: string;
        nomeSalvo?: string;
        mimeType: string;
        tamanhoBytes: number;
      };
    }
  | { ok: false; code?: string; error?: string; message?: string };

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Codifica em chunks para evitar estouro de call stack em arquivos maiores.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function validarArquivoDocumento(file: File): string | undefined {
  const nome = file.name.toLowerCase();
  const extOk = DOCUMENTO_EXTENSOES_ACEITAS.some((ext) => nome.endsWith(ext));
  const mimeOk = (DOCUMENTO_MIMES_ACEITOS as readonly string[]).includes(file.type);
  if (!extOk && !mimeOk) {
    return "Formato não aceito. Envie PDF, JPG ou PNG.";
  }
  if (file.size > DOCUMENTO_TAMANHO_MAX_BYTES) {
    return "Arquivo maior que 8 MB. Reduza o tamanho e tente novamente.";
  }
  if (file.size <= 0) {
    return "Arquivo vazio ou inválido.";
  }
  return undefined;
}

export async function uploadDocumentoArquivo(file: File): Promise<DocumentoUploadResposta> {
  const invalido = validarArquivoDocumento(file);
  if (invalido) {
    return { ok: false, code: "ARQUIVO_INVALIDO", error: invalido, message: invalido };
  }
  let fileBase64: string;
  try {
    fileBase64 = await fileToBase64(file);
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      code: "ARQUIVO_LEITURA",
      error: "Não foi possível ler o arquivo selecionado.",
      message: "Não foi possível ler o arquivo selecionado.",
    };
  }
  const res = await fetch(`${API_BASE}/oabDocumentoUpload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64,
    }),
  });
  let raw: AnyErr | DocumentoUploadResposta | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo JSON */
  }
  if (!raw) {
    return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  }
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as DocumentoUploadResposta;
  }
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type DocumentoSolicitacaoPayload = {
  unidadeSlug: string;
  unidadeNome?: string;
  advNome: string;
  numeroOab: string;
  advEmail: string;
  advTelefone: string;
  nomeIpl: string;
  infopen?: string;
  tipoDocumento: string;
  tipoDocumentoLabel: string;
  arquivoPrincipalUrl: string;
  arquivoPrincipalNome: string;
  observacoesAdvogado?: string;
};

export type DocumentoSolicitacaoResposta =
  | {
      ok: true;
      protocolo: string;
      solicitacaoId?: string;
      status?: string;
      emailUnidadeEnviado?: boolean;
      mensagem?: string;
    }
  | { ok: false; code?: string; error?: string; message?: string };

export async function confirmarDocumento(
  payload: DocumentoSolicitacaoPayload,
): Promise<DocumentoSolicitacaoResposta> {
  const res = await fetch(`${API_BASE}/oabDocumentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  let raw: AnyErr | DocumentoSolicitacaoResposta | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo JSON */
  }
  if (!raw) {
    return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  }
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as DocumentoSolicitacaoResposta;
  }
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

// ---------- Documentos (painel admin) ----------

export type AdminDocumento = {
  _id: string;
  protocolo: string;
  unidadeSlug?: string;
  unidadeNome?: string;
  nomeAdvogado?: string;
  numeroOab?: string;
  emailAdvogado?: string;
  telefoneAdvogado?: string;
  nomeIpl?: string;
  infopen?: string;
  tipoDocumento?: string;
  tipoDocumentoLabel?: string;
  arquivoPrincipalNome?: string;
  arquivoPrincipalUrl?: string;
  arquivoPrincipalUrlOriginal?: string;
  arquivoUrl?: string;
  arquivoUrlPublica?: string;
  arquivoUrlEmail?: string;
  status?: string;
  statusOriginal?: string;
  statusLabel?: string;
  mensagemErro?: string;
  unidadeEmailDestino?: string;
  emailUnidadeEnviado?: boolean;
  emailUnidadeEnviadoEm?: string;
  emailAdvogadoEnviado?: boolean;
  emailAdvogadoDestino?: string;
  emailAdvogadoErro?: string;
  emailAdvogadoEnviadoEm?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  [k: string]: unknown;
};

export type ConcluirAdminDocumentoResposta =
  | { ok: true; mensagem?: string; documento?: AdminDocumento }
  | { ok: false; code?: string; message?: string; error?: string };

export async function concluirAdminDocumento(
  token: string,
  documentoId: string,
): Promise<ConcluirAdminDocumentoResposta> {
  const res = await fetch(`${API_BASE}/oabAdminConcluirDocumento`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-OAB-Admin-Token": token,
    },
    body: JSON.stringify({ documentoId }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("SESSAO_EXPIRADA");
  }
  let raw: AnyErr | ConcluirAdminDocumentoResposta | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo */
  }
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as ConcluirAdminDocumentoResposta;
  }
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type AdminDocumentosFiltros = {
  status?: string;
  unidadeSlug?: string;
  dataIso?: string;
  busca?: string;
};

export async function listarAdminDocumentos(
  token: string,
  filtros: AdminDocumentosFiltros = {},
): Promise<AdminDocumento[]> {
  const qs = new URLSearchParams();
  if (filtros.status && filtros.status !== "todos") qs.set("status", filtros.status);
  if (filtros.unidadeSlug) qs.set("unidadeSlug", filtros.unidadeSlug);
  if (filtros.dataIso) qs.set("dataIso", filtros.dataIso);
  if (filtros.busca) qs.set("busca", filtros.busca);
  const url = `${API_BASE}/oabAdminDocumentos${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-OAB-Admin-Token": token },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("SESSAO_EXPIRADA");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ao listar documentos`);
  const data = (await res.json()) as
    | { ok: true; total?: number; documentos: AdminDocumento[] }
    | AnyErr;
  if (!data.ok) {
    const code = getApiCode(data);
    if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
    throw new Error(getApiMessage(data) || "Falha ao listar documentos");
  }
  return data.documentos || [];
}

// ---------- Consulta pública de agendamento ----------

export type ConsultaAgendamentoPayload = {
  protocolo: string;
  emailAdvogado: string;
};

export type ConsultaAgendamento = {
  protocolo: string;
  unidadeNome: string;
  unidadeSlug?: string;
  dataIso?: string;
  dataLabel?: string;
  horarioInicio?: string;
  horarioFim?: string;
  horarioLabel?: string;
  nomeAdvogado?: string;
  numeroOab?: string;
  nomeIpl?: string;
  infopen?: string;
  status: string;
  statusLabel: string;
  criadoEm?: string;
  atualizadoEm?: string;
  novoProtocolo?: string;
  protocoloOrigem?: string;
  podeCancelar?: boolean;
  cancelamentoPermitido?: boolean;
  cancelamentoCodigo?: string;
  cancelamentoMensagem?: string;
  prazoCancelamentoHoras?: number;
  podeRemarcar?: boolean;
  remarcacaoPermitida?: boolean;
  remarcacaoCodigo?: string;
  remarcacaoMensagem?: string;
  prazoRemarcacaoHoras?: number;
  reagendadoParaProtocolo?: string;
  reagendadoParaDataIso?: string;
  reagendadoParaDataLabel?: string;
  reagendadoParaHorarioInicio?: string;
  reagendadoParaHorarioFim?: string;
  reagendadoParaHorarioLabel?: string;
};

export type ConsultaAgendamentoResposta =
  | { ok: true; agendamento: ConsultaAgendamento }
  | { ok: false; code?: string; message?: string; error?: string };

export async function consultarAgendamento(
  payload: ConsultaAgendamentoPayload,
): Promise<ConsultaAgendamentoResposta> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/oabConsultarAgendamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        protocolo: payload.protocolo.trim().toUpperCase(),
        emailAdvogado: payload.emailAdvogado.trim().toLowerCase(),
      }),
    });
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      code: "REDE",
      error: "Não foi possível conectar. Verifique sua internet e tente novamente.",
      message: "Não foi possível conectar. Verifique sua internet e tente novamente.",
    };
  }
  let raw: AnyErr | ({ ok: true; agendamento?: ConsultaAgendamento } & Record<string, unknown>) | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo JSON */
  }
  if (!raw) {
    return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  }
  if ((raw as { ok?: boolean }).ok === true) {
    const r = raw as { ok: true; agendamento?: ConsultaAgendamento } & Record<string, unknown>;
    const agendamento = (r.agendamento || (r as unknown as ConsultaAgendamento)) as ConsultaAgendamento &
      { reagendadoParaProtocolo?: string };
    if (!agendamento.novoProtocolo && agendamento.reagendadoParaProtocolo) {
      agendamento.novoProtocolo = agendamento.reagendadoParaProtocolo;
    }
    return { ok: true, agendamento };
  }
  return normalizeApiError(raw as AnyErr, "Não foi possível consultar o agendamento.");
}

export async function cancelarAgendamentoUsuario(
  payload: ConsultaAgendamentoPayload,
): Promise<ConsultaAgendamentoResposta> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/oabCancelarAgendamentoUsuario`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        protocolo: payload.protocolo.trim().toUpperCase(),
        emailAdvogado: payload.emailAdvogado.trim().toLowerCase(),
      }),
    });
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      code: "REDE",
      error: "Não foi possível conectar. Verifique sua internet e tente novamente.",
      message: "Não foi possível conectar. Verifique sua internet e tente novamente.",
    };
  }
  let raw: AnyErr | ({ ok: true; agendamento?: ConsultaAgendamento } & Record<string, unknown>) | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo JSON */
  }
  if (!raw) {
    return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  }
  if ((raw as { ok?: boolean }).ok === true) {
    const r = raw as { ok: true; agendamento?: ConsultaAgendamento } & Record<string, unknown>;
    const agendamento = (r.agendamento || (r as unknown as ConsultaAgendamento)) as ConsultaAgendamento;
    return { ok: true, agendamento };
  }
  return normalizeApiError(raw as AnyErr, "Não foi possível cancelar o agendamento.");
}




export type RemarcarUsuarioPayload = {
  protocolo: string;
  emailAdvogado: string;
  dataIso: string;
  horarioInicio: string;
  horarioFim?: string;
};

export async function remarcarAgendamentoUsuario(
  payload: RemarcarUsuarioPayload,
): Promise<ConsultaAgendamentoResposta> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/oabRemarcarAgendamentoUsuario`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        protocolo: payload.protocolo.trim().toUpperCase(),
        emailAdvogado: payload.emailAdvogado.trim().toLowerCase(),
        dataIso: payload.dataIso,
        horarioInicio: payload.horarioInicio,
        ...(payload.horarioFim ? { horarioFim: payload.horarioFim } : {}),
      }),
    });
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      code: "REDE",
      error: "Não foi possível conectar. Verifique sua internet e tente novamente.",
      message: "Não foi possível conectar. Verifique sua internet e tente novamente.",
    };
  }
  let raw: AnyErr | ({ ok: true; agendamento?: ConsultaAgendamento } & Record<string, unknown>) | null = null;
  try {
    raw = (await res.json()) as never;
  } catch {
    /* sem corpo JSON */
  }
  if (!raw) {
    return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  }
  if ((raw as { ok?: boolean }).ok === true) {
    const r = raw as { ok: true; agendamento?: ConsultaAgendamento } & Record<string, unknown>;
    const agendamento = (r.agendamento || (r as unknown as ConsultaAgendamento)) as ConsultaAgendamento &
      { reagendadoParaProtocolo?: string };
    if (!agendamento.novoProtocolo && agendamento.reagendadoParaProtocolo) {
      agendamento.novoProtocolo = agendamento.reagendadoParaProtocolo;
    }
    return { ok: true, agendamento };
  }
  return normalizeApiError(raw as AnyErr, "Não foi possível remarcar o agendamento.");
}

// ============================================================
// Admin: usuários e permissões
// ============================================================

export type PermissaoItem = { chave: string; label: string };
export type PermissaoGrupo = { grupo: string; permissoes: PermissaoItem[] };

export type AdminUsuario = {
  _id: string;
  nome?: string;
  email: string;
  cargoFuncao?: string;
  ativo: boolean;
  permissoes: string[];
  cpfCadastrado?: boolean;
  emailVerificado?: boolean;
  precisaVerificarEmail?: boolean;
  precisaTrocarSenha?: boolean;
  cadastroConcluido?: boolean;
  statusConvite?: string;
  conviteExpiraEm?: string | null;
  conviteEnviadoEm?: string | null;
  conviteAceitoEm?: string | null;
  cpfAtualizadoEm?: string | null;
  emailVerificadoEm?: string | null;
  senhaAlteradaEm?: string | null;
  ultimoAcessoEm?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
  criadoPor?: string;
  atualizadoPor?: string;
  legacy?: boolean;
};

export type AdminMeInfo = {
  _id?: string;
  email: string;
  nome?: string;
};

export type AdminMeResposta =
  | { ok: true; admin: AdminMeInfo; permissoes: string[]; legacy?: boolean }
  | { ok: false; code?: string; message?: string; error?: string };

function adminHeaders(token: string, withJson = false): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "X-OAB-Admin-Token": token,
  };
  if (withJson) h["Content-Type"] = "application/json";
  return h;
}

async function parseAdminJson(res: Response): Promise<AnyErr | Record<string, unknown> | null> {
  try {
    return (await res.json()) as AnyErr | Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function adminMe(token: string): Promise<AdminMeResposta> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/oabAdminMe`, {
      method: "GET",
      headers: adminHeaders(token),
    });
  } catch (e) {
    console.error(e);
    return { ok: false, code: "REDE", error: "Falha de conexão.", message: "Falha de conexão." };
  }
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as AdminMeResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type ListarAdminUsuariosResposta = {
  ok: true;
  total: number;
  usuarios: AdminUsuario[];
  permissoesDisponiveis: PermissaoGrupo[];
};

export type AdminUsuariosFiltros = { status?: string; busca?: string };

export async function listarAdminUsuarios(
  token: string,
  filtros: AdminUsuariosFiltros = {},
): Promise<ListarAdminUsuariosResposta> {
  const qs = new URLSearchParams();
  if (filtros.status && filtros.status !== "todos") qs.set("status", filtros.status);
  if (filtros.busca) qs.set("busca", filtros.busca);
  const url = `${API_BASE}/oabAdminUsuarios${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "GET", headers: adminHeaders(token) });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) throw new Error(`HTTP ${res.status}`);
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as ListarAdminUsuariosResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  throw new Error(getApiMessage(raw as AnyErr) || "Falha ao listar usuários.");
}

export type CriarAdminUsuarioPayload = {
  email: string;
  cargoFuncao?: string;
  ativo?: boolean;
  permissoes: string[];
};

export type CriarAdminUsuarioResposta =
  | {
      ok: true;
      mensagem?: string;
      usuario: AdminUsuario;
      conviteUrl?: string;
      conviteExpiraEm?: string | null;
    }
  | { ok: false; code?: string; message?: string; error?: string };

export async function criarAdminUsuario(
  token: string,
  payload: CriarAdminUsuarioPayload,
): Promise<CriarAdminUsuarioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUsuarios`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as CriarAdminUsuarioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type ReenviarConviteAdminResposta =
  | {
      ok: true;
      mensagem?: string;
      conviteUrl?: string;
      conviteExpiraEm?: string | null;
    }
  | { ok: false; code?: string; message?: string; error?: string };

export async function reenviarConviteAdminUsuario(
  token: string,
  usuarioId: string,
): Promise<ReenviarConviteAdminResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUsuarioReenviarConvite`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify({ usuarioId }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as ReenviarConviteAdminResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type BuscarConviteResposta =
  | {
      ok: true;
      convite: {
        email: string;
        cargoFuncao?: string;
        statusConvite?: string;
        conviteExpiraEm?: string | null;
        cadastroConcluido?: boolean;
        permissoes?: string[];
      };
    }
  | { ok: false; code?: string; message?: string; error?: string };

export async function buscarConviteAdmin(token: string): Promise<BuscarConviteResposta> {
  const res = await fetch(
    `${API_BASE}/oabAdminConvite?token=${encodeURIComponent(token)}`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  const body = raw as Record<string, unknown>;
  if (body.ok === true) {
    const rawConvite = (body.convite && typeof body.convite === "object"
      ? (body.convite as Record<string, unknown>)
      : body) as Record<string, unknown>;
    return {
      ok: true,
      convite: {
        email: String(rawConvite.email ?? ""),
        cargoFuncao: (rawConvite.cargoFuncao as string | undefined) ?? undefined,
        statusConvite: (rawConvite.statusConvite as string | undefined) ?? undefined,
        conviteExpiraEm: (rawConvite.conviteExpiraEm as string | null | undefined) ?? null,
        cadastroConcluido: Boolean(rawConvite.cadastroConcluido),
        permissoes: Array.isArray(rawConvite.permissoes)
          ? (rawConvite.permissoes as string[])
          : undefined,
      },
    };
  }
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type ConcluirConvitePayload = {
  token: string;
  nome: string;
  cpf: string;
  novaSenha: string;
  cargoFuncao?: string;
};

export type ConcluirConviteResposta =
  | { ok: true; mensagem?: string; email?: string }
  | { ok: false; code?: string; message?: string; error?: string };

export async function concluirConviteAdmin(
  payload: ConcluirConvitePayload,
): Promise<ConcluirConviteResposta> {
  const res = await fetch(`${API_BASE}/oabAdminConcluirConvite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as ConcluirConviteResposta;
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type AtualizarAdminUsuarioPayload = {
  usuarioId: string;
  nome?: string;
  email: string;
  cargoFuncao?: string;
  ativo: boolean;
  permissoes: string[];
};

export type AtualizarAdminUsuarioResposta =
  | { ok: true; mensagem?: string; usuario: AdminUsuario }
  | { ok: false; code?: string; message?: string; error?: string };

export async function atualizarAdminUsuario(
  token: string,
  payload: AtualizarAdminUsuarioPayload,
): Promise<AtualizarAdminUsuarioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUsuarioAtualizar`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as AtualizarAdminUsuarioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type DesativarAdminUsuarioResposta =
  | { ok: true; mensagem?: string }
  | { ok: false; code?: string; message?: string; error?: string };

export async function desativarAdminUsuario(
  token: string,
  usuarioId: string,
): Promise<DesativarAdminUsuarioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUsuarioDesativar`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify({ usuarioId }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as DesativarAdminUsuarioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type ResetarSenhaAdminUsuarioPayload = {
  usuarioId: string;
  novaSenha?: string;
};

export type ResetarSenhaAdminUsuarioResposta =
  | { ok: true; mensagem?: string; senhaTemporaria?: string }
  | { ok: false; code?: string; message?: string; error?: string };

export async function resetarSenhaAdminUsuario(
  token: string,
  payload: ResetarSenhaAdminUsuarioPayload,
): Promise<ResetarSenhaAdminUsuarioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUsuarioResetarSenha`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as ResetarSenhaAdminUsuarioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type ExcluirAdminUsuarioResposta =
  | { ok: true; mensagem?: string }
  | { ok: false; code?: string; message?: string; error?: string };

export async function excluirAdminUsuario(
  token: string,
  usuarioId: string,
): Promise<ExcluirAdminUsuarioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUsuarioExcluir`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify({ usuarioId }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as ExcluirAdminUsuarioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  const normalized = normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
  const c = (normalized.code || code || "").toString();
  let friendly = normalized.message;
  if (c === "USUARIO_ATIVO") friendly = "Desative o usuário antes de excluí-lo.";
  else if (c === "SEM_PERMISSAO") friendly = "Você não tem permissão para executar essa ação.";
  else if (c === "OPERACAO_NAO_PERMITIDA") friendly = normalized.message || "Operação não permitida.";
  else if (!friendly) friendly = "Não foi possível excluir o usuário agora.";
  return { ...normalized, message: friendly };
}

// ============================================================
// Unidades (admin)
// ============================================================

export type AdminUnidadeAviso = { codigo: string; mensagem: string };

export type AdminUnidade = {
  _id: string;
  id?: string;
  slug: string;
  codigo?: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  ativa: boolean;
  ativo?: boolean;
  emailAgenda?: string;
  emailDestino?: string;
  emailDocumentos?: string;
  emailRecebimentoDocumentos?: string;
  emailListas?: string;
  emailRecebimentoListas?: string;
  observacoesInternas?: string;
  avisos?: AdminUnidadeAviso[];
  criadoEm?: string;
  atualizadoEm?: string;
};

export type AdminUnidadesFiltros = { status?: string; busca?: string };

export type ListarAdminUnidadesResposta = {
  ok: true;
  total: number;
  unidades: AdminUnidade[];
};

export async function listarAdminUnidades(
  token: string,
  filtros: AdminUnidadesFiltros = {},
): Promise<ListarAdminUnidadesResposta> {
  const qs = new URLSearchParams();
  if (filtros.status && filtros.status !== "todas") qs.set("status", filtros.status);
  if (filtros.busca) qs.set("busca", filtros.busca);
  const url = `${API_BASE}/oabAdminUnidades${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "GET", headers: adminHeaders(token) });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) throw new Error(`HTTP ${res.status}`);
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as ListarAdminUnidadesResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  throw new Error(getApiMessage(raw as AnyErr) || "Falha ao listar unidades.");
}

export type CriarAdminUnidadePayload = {
  nome: string;
  slug?: string;
  endereco?: string;
  ativa: boolean;
  emailRecebimentoDocumentos?: string;
  emailRecebimentoListas?: string;
  observacoesInternas?: string;
};

export type CriarAdminUnidadeResposta =
  | { ok: true; mensagem?: string; unidade: AdminUnidade }
  | { ok: false; code?: string; message?: string; error?: string };

export async function criarAdminUnidade(
  token: string,
  payload: CriarAdminUnidadePayload,
): Promise<CriarAdminUnidadeResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUnidades`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as CriarAdminUnidadeResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type AtualizarAdminUnidadePayload = {
  unidadeId: string;
  nome: string;
  endereco?: string;
  ativa: boolean;
  emailRecebimentoDocumentos?: string;
  emailRecebimentoListas?: string;
  observacoesInternas?: string;
};

export type AtualizarAdminUnidadeResposta =
  | { ok: true; mensagem?: string; unidade: AdminUnidade }
  | { ok: false; code?: string; message?: string; error?: string };

export async function atualizarAdminUnidade(
  token: string,
  payload: AtualizarAdminUnidadePayload,
): Promise<AtualizarAdminUnidadeResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUnidadeAtualizar`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as AtualizarAdminUnidadeResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type AlterarStatusAdminUnidadeResposta =
  | { ok: true; mensagem?: string; unidade?: AdminUnidade }
  | { ok: false; code?: string; message?: string; error?: string };

export async function alterarStatusAdminUnidade(
  token: string,
  unidadeId: string,
  ativa: boolean,
): Promise<AlterarStatusAdminUnidadeResposta> {
  const res = await fetch(`${API_BASE}/oabAdminUnidadeStatus`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify({ unidadeId, ativa }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as AlterarStatusAdminUnidadeResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}


// ============================================================
// BLOQUEIOS (admin)
// ============================================================

export type AdminBloqueioEscopo = "todas" | "unidade";
export type AdminBloqueioTipo = "dia_inteiro" | "intervalo_datas" | "horario";
export type AdminBloqueioStatus = "ativo" | "encerrado" | "inativo";

export type AdminBloqueio = {
  _id: string;
  id?: string;
  escopo: AdminBloqueioEscopo;
  escopoLabel?: string;
  todasUnidades?: boolean;
  unidadeSlug?: string;
  unidadeNome?: string;
  tipo: AdminBloqueioTipo;
  tipoLabel?: string;
  diaInteiro?: boolean;
  dataInicio: string;
  dataFim?: string;
  dataIso?: string;
  dataLabel?: string;
  horarioInicio?: string;
  horarioFim?: string;
  horarioLabel?: string;
  motivo: string;
  observacoesInternas?: string;
  ativo: boolean;
  status: AdminBloqueioStatus;
  statusLabel?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  motivoPublico?: string;
  cancelarAgendamentosExistentes?: boolean;
  totalAgendamentosAfetados?: number;
  totalAgendamentosCancelados?: number;
  totalEmailsCancelamentoEnviados?: number;
  totalEmailsCancelamentoComErro?: number;
  cancelamentoAgendamentosExecutadoEm?: string | null;
};

export type AdminBloqueiosFiltros = {
  status?: string;
  busca?: string;
  unidadeSlug?: string;
  dataIso?: string;
  escopo?: string;
};

export type ListarAdminBloqueiosResposta = {
  ok: true;
  total: number;
  bloqueios: AdminBloqueio[];
};

export async function listarAdminBloqueios(
  token: string,
  filtros: AdminBloqueiosFiltros = {},
): Promise<ListarAdminBloqueiosResposta> {
  const qs = new URLSearchParams();
  if (filtros.status && filtros.status !== "todos") qs.set("status", filtros.status);
  if (filtros.busca) qs.set("busca", filtros.busca);
  if (filtros.unidadeSlug) qs.set("unidadeSlug", filtros.unidadeSlug);
  if (filtros.dataIso) qs.set("dataIso", filtros.dataIso);
  if (filtros.escopo && filtros.escopo !== "todos") qs.set("escopo", filtros.escopo);
  const url = `${API_BASE}/oabAdminBloqueios${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "GET", headers: adminHeaders(token) });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) throw new Error(`HTTP ${res.status}`);
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as ListarAdminBloqueiosResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  throw new Error(getApiMessage(raw as AnyErr) || "Falha ao listar bloqueios.");
}

export type CriarAdminBloqueioPayload = {
  escopo: AdminBloqueioEscopo;
  unidadeSlug?: string;
  tipo: AdminBloqueioTipo;
  dataInicio: string;
  dataFim?: string;
  horarioInicio?: string;
  horarioFim?: string;
  motivo: string;
  observacoesInternas?: string;
  ativo?: boolean;
  cancelarAgendamentosExistentes?: boolean;
};

export type AdminBloqueioImpactoItem = {
  _id: string;
  protocolo: string;
  unidadeSlug?: string;
  unidadeNome?: string;
  dataIso: string;
  dataLabel?: string;
  horarioInicio?: string;
  horarioFim?: string;
  horarioLabel?: string;
  nomeAdvogado?: string;
  numeroOab?: string;
  emailAdvogado?: string;
  nomeIpl?: string;
  infopen?: string;
  listaDiariaEnviada?: boolean;
};

export type AdminBloqueioImpactoResposta =
  | {
      ok: true;
      totalAfetados: number;
      totalComListaJaEnviada?: number;
      podeCancelar: boolean;
      agendamentos: AdminBloqueioImpactoItem[];
      truncado?: boolean;
    }
  | { ok: false; code?: string; message?: string; error?: string };

export type AdminBloqueioCancelamentoResumo = {
  solicitado: boolean;
  totalAfetados: number;
  totalCancelados: number;
  totalEmailsEnviados: number;
  totalEmailsComErro: number;
  listaAtualizadaRecomendada?: boolean;
  datasComListaJaEnviada?: Array<{ unidadeSlug: string; dataIso: string }>;
};

export type AdminBloqueioResposta =
  | {
      ok: true;
      mensagem?: string;
      bloqueio?: AdminBloqueio;
      impacto?: { totalAfetados: number };
      cancelamento?: AdminBloqueioCancelamentoResumo;
    }
  | { ok: false; code?: string; message?: string; error?: string };

export async function analisarImpactoAdminBloqueio(
  token: string,
  payload: CriarAdminBloqueioPayload,
): Promise<AdminBloqueioImpactoResposta> {
  const res = await fetch(`${API_BASE}/oabAdminBloqueioImpacto`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) {
    return raw as unknown as AdminBloqueioImpactoResposta;
  }
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export async function criarAdminBloqueio(
  token: string,
  payload: CriarAdminBloqueioPayload,
): Promise<AdminBloqueioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminBloqueios`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as AdminBloqueioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export type AtualizarAdminBloqueioPayload = CriarAdminBloqueioPayload & {
  bloqueioId: string;
};

export async function atualizarAdminBloqueio(
  token: string,
  payload: AtualizarAdminBloqueioPayload,
): Promise<AdminBloqueioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminBloqueioAtualizar`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as AdminBloqueioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

export async function removerAdminBloqueio(
  token: string,
  bloqueioId: string,
): Promise<AdminBloqueioResposta> {
  const res = await fetch(`${API_BASE}/oabAdminBloqueioRemover`, {
    method: "POST",
    headers: adminHeaders(token, true),
    body: JSON.stringify({ bloqueioId }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) return { ok: false, error: `HTTP ${res.status}`, message: `HTTP ${res.status}` };
  if ((raw as { ok?: boolean }).ok === true) return raw as unknown as AdminBloqueioResposta;
  const code = getApiCode(raw as AnyErr);
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalizeApiError(raw as AnyErr, `HTTP ${res.status}`);
}

// ============================================================
// Envios diários de listas (admin)
// ============================================================

export type AdminConfiguracaoEnvios = {
  _id: string;
  chave?: string;
  enviosAtivos: boolean;
  horarioBrasilia: string;
  timezone: string;
  enviarListaVazia: boolean;
  usarProximoDiaUtil: boolean;
  emailAlertaOperacional?: string;
  ultimaExecucaoEm?: string | null;
  ultimaExecucaoStatus?: string;
  ultimaExecucaoMensagem?: string;
  ultimaDataAlvoIso?: string;
  atualizadoEm?: string | null;
  atualizadoPor?: string;
};

export type AdminEnvioLista = {
  _id: string;
  unidadeSlug: string;
  unidadeNome: string;
  emailDestino: string;
  dataAtendimentosIso: string;
  dataAtendimentosLabel: string;
  totalAgendamentos: number;
  status: string;
  statusLabel: string;
  modo: string;
  modoLabel: string;
  tentativas: number;
  assunto?: string;
  mensagemErro?: string;
  provider?: string;
  providerMessageId?: string;
  solicitadoPor?: string;
  iniciadoEm?: string | null;
  enviadoEm?: string | null;
  finalizadoEm?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
};

export type AdminEnviosResumo = {
  total: number;
  enviados: number;
  listasVazias: number;
  erros: number;
  semDestinatario: number;
  ignorados: number;
};

export type AdminEnviosListasFiltros = {
  status?: string;
  modo?: string;
  unidadeSlug?: string;
  dataIso?: string;
  busca?: string;
};

export type ListarAdminEnviosListasResposta = {
  ok: true;
  total: number;
  envios: AdminEnvioLista[];
  configuracao: AdminConfiguracaoEnvios;
  proximaDataAlvoIso: string;
  proximaDataAlvoLabel: string;
};

export type AdminConfiguracaoEnviosResposta =
  | {
      ok: true;
      configuracao: AdminConfiguracaoEnvios;
      mensagem?: string;
      message?: string;
    }
  | {
      ok: false;
      code?: string;
      message?: string;
      error?: string;
      configuracao?: AdminConfiguracaoEnvios;
    };

export type AdminEnvioListaAcaoResposta =
  | {
      ok: true;
      mensagem?: string;
      message?: string;
      envio?: AdminEnvioLista;
      unidadeSlug?: string;
      unidadeNome?: string;
      emailDestino?: string;
      dataAlvoIso?: string;
      totalAgendamentos?: number;
    }
  | {
      ok: false;
      code?: string;
      message?: string;
      error?: string;
      envio?: AdminEnvioLista;
    };

export type ExecutarAdminEnviosListasResposta = {
  ok: boolean;
  executado?: boolean;
  code?: string;
  message?: string;
  error?: string;
  dataAlvoIso?: string;
  dataAlvoLabel?: string;
  resumo?: AdminEnviosResumo;
  resultados?: Array<Record<string, unknown>>;
};

function normalizeAdminEnviosResponse<T extends Record<string, unknown>>(
  raw: T,
): T & { code?: string; message?: string; error?: string } {
  const normalized = raw as T & {
    codigo?: string;
    mensagem?: string;
    erro?: string;
    code?: string;
    message?: string;
    error?: string;
  };
  const code = normalized.code || normalized.codigo;
  const message =
    normalized.message || normalized.mensagem || normalized.error || normalized.erro;
  return {
    ...normalized,
    ...(code ? { code } : {}),
    ...(message ? { message, error: message } : {}),
  };
}

async function callAdminEnviosEndpoint<T extends Record<string, unknown>>(
  token: string,
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<T & { code?: string; message?: string; error?: string }> {
  const method = options.method || "GET";
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: adminHeaders(token, method === "POST"),
    ...(method === "POST" ? { body: JSON.stringify(options.body || {}) } : {}),
  });
  if (res.status === 401 || res.status === 403) throw new Error("SESSAO_EXPIRADA");
  const raw = await parseAdminJson(res);
  if (!raw) {
    return {
      ok: false,
      message: `HTTP ${res.status}`,
      error: `HTTP ${res.status}`,
    } as unknown as T & { code?: string; message?: string; error?: string };
  }
  const normalized = normalizeAdminEnviosResponse(raw as Record<string, unknown>);
  const code = normalized.code;
  if (isSessionExpiredCode(code)) throw new Error("SESSAO_EXPIRADA");
  return normalized as unknown as T & { code?: string; message?: string; error?: string };
}

export async function obterAdminConfiguracaoEnvios(
  token: string,
): Promise<AdminConfiguracaoEnviosResposta> {
  return callAdminEnviosEndpoint<AdminConfiguracaoEnviosResposta & Record<string, unknown>>(
    token,
    "/oabAdminConfiguracaoEnvios",
  );
}

export async function atualizarAdminConfiguracaoEnvios(
  token: string,
  payload: { enviosAtivos: boolean },
): Promise<AdminConfiguracaoEnviosResposta> {
  return callAdminEnviosEndpoint<AdminConfiguracaoEnviosResposta & Record<string, unknown>>(
    token,
    "/oabAdminConfiguracaoEnvios",
    { method: "POST", body: payload },
  );
}

export async function listarAdminEnviosListas(
  token: string,
  filtros: AdminEnviosListasFiltros = {},
): Promise<ListarAdminEnviosListasResposta> {
  const qs = new URLSearchParams();
  if (filtros.status && filtros.status !== "todos") qs.set("status", filtros.status);
  if (filtros.modo && filtros.modo !== "todos") qs.set("modo", filtros.modo);
  if (filtros.unidadeSlug) qs.set("unidadeSlug", filtros.unidadeSlug);
  if (filtros.dataIso) qs.set("dataIso", filtros.dataIso);
  if (filtros.busca) qs.set("busca", filtros.busca);
  const resposta = await callAdminEnviosEndpoint<
    (ListarAdminEnviosListasResposta | { ok: false }) & Record<string, unknown>
  >(token, `/oabAdminEnviosListas${qs.toString() ? `?${qs}` : ""}`);
  if (resposta.ok === true) return resposta as unknown as ListarAdminEnviosListasResposta;
  throw new Error(resposta.message || "Falha ao listar envios.");
}

export async function testarAdminEnvioLista(
  token: string,
  payload: { unidadeSlug: string; emailTeste: string; dataAlvoIso?: string },
): Promise<AdminEnvioListaAcaoResposta> {
  return callAdminEnviosEndpoint<AdminEnvioListaAcaoResposta & Record<string, unknown>>(
    token,
    "/oabAdminTestarEnvioLista",
    { method: "POST", body: payload },
  );
}

export async function executarAdminEnviosListas(
  token: string,
  payload: { dataAlvoIso?: string; unidadeSlug?: string; forcar?: boolean } = {},
): Promise<ExecutarAdminEnviosListasResposta> {
  return callAdminEnviosEndpoint<ExecutarAdminEnviosListasResposta & Record<string, unknown>>(
    token,
    "/oabAdminExecutarEnvioListas",
    { method: "POST", body: payload },
  );
}

export async function reenviarAdminLista(
  token: string,
  envioId: string,
): Promise<AdminEnvioListaAcaoResposta> {
  return callAdminEnviosEndpoint<AdminEnvioListaAcaoResposta & Record<string, unknown>>(
    token,
    "/oabAdminReenviarLista",
    { method: "POST", body: { envioId } },
  );
}
