import { ok, badRequest, notFound, serverError } from 'wix-http-functions';
import wixData from 'wix-data';
import { mediaManager } from 'wix-media-backend';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { submissions } from 'wix-forms.v2';
import { elevate } from 'wix-auth';
import { wixEventsV2, orders } from 'wix-events.v2';
import { rsvpV2 } from '@wix/events';
import { posts } from 'wix-blog-backend';
import { tasks as cmsTasks } from '@wix/data';

import {
  listarDatasDisponiveis,
  listarHorariosDisponiveis,
} from 'backend/disponibilidade';

import {
  loginAdminApi,
  meAdminApi,
  listarUsuariosAdminApi,
  criarUsuarioAdminApi,
  atualizarUsuarioAdminApi,
  desativarUsuarioAdminApi,
  resetarSenhaUsuarioAdminApi,
  excluirUsuarioAdminApi,
  confirmarEmailAdminApi,
  reenviarCodigoEmailAdminApi,
  trocarSenhaAdminApi,
  obterConviteAdminApi,
  concluirConviteAdminApi,
  reenviarConviteUsuarioAdminApi,
  listarUnidadesAdminApi,
  criarUnidadeAdminApi,
  atualizarUnidadeAdminApi,
  alterarStatusUnidadeAdminApi,
  listarBloqueiosAdminApi,
  analisarImpactoBloqueioAdminApi,
  criarBloqueioAdminApi,
  atualizarBloqueioAdminApi,
  removerBloqueioAdminApi,
  listarAgendamentosAdminApi,
  listarDocumentosAdminApi,
  consultarAgendamentoPublicoApi,
  cancelarAgendamentoPublicoApi,
  remarcarAgendamentoPublicoApi,
  concluirDocumentoAdminApi,
  cancelarAgendamentoAdminApi,
  remarcarAgendamentoAdminApi,
  obterConfiguracaoEnviosAdminApi,
  atualizarConfiguracaoEnviosAdminApi,
  listarEnviosListasAdminApi,
  testarEnvioListaAdminApi,
  executarEnvioListasAdminApi,
  reenviarListaAdminApi,
  obterCatalogoAgendamentosAdminApi,
  salvarCatalogoAgendamentosAdminApi,
  obterCatalogoAgendamentosPublicoApi,
  listarEventosAdminApi,
  obterRelatorioFinanceiroEventoAdminApi,
  obterConteudoSiteAdminApi,
  salvarConteudoSiteAdminApi,
  prepararUploadImagemSiteAdminApi,
  criarBannerHomeSiteAdminApi,
  excluirBannerHomeSiteAdminApi,
  reordenarBannerHomeSiteAdminApi,
} from 'backend/adminApi';

import {
  criarAgendamentoPublicoV2,
  listarDisponibilidadeOfertaPublica,
} from 'backend/agendamentosPublicosStore';

import { confirmarSolicitacaoDocumento } from 'backend/documentos';

import {
  loginCertificadosAdminApi,
  migrarLoginLegadoCertificadosAdminApi,
  meCertificadosAdminApi,
  listarUsuariosCertificadosAdminApi,
  criarUsuarioCertificadosAdminApi,
  atualizarUsuarioCertificadosAdminApi,
  desativarUsuarioCertificadosAdminApi,
  excluirUsuarioCertificadosAdminApi,
  confirmarEmailCertificadosAdminApi,
  reenviarCodigoEmailCertificadosAdminApi,
  trocarSenhaCertificadosAdminApi,
  obterConviteCertificadosAdminApi,
  concluirConviteCertificadosAdminApi,
  reenviarConviteCertificadosAdminApi,
} from 'backend/certificadosAdmin';

import {
  listarEventosCertificados,
  pesquisarEventosCertificados,
  getEventoCertificados,
  getParticipanteCertificados,
  salvarPresenca,
  listarPresencaAuditoria,
  reverterPresencaAuditoria,
  atualizarParticipanteCertificados,
  emitirCertificado,
  invalidarCertificado,
  validarCertificado,
  consultarCertificados,
  registrarEnvioCertificado,
  atualizarStatusEnviosCertificados,
} from 'backend/certificados';

const COL = {
  SALAS_APOIO: 'Import4255',
  PAGINAS_INSTITUCIONAIS: 'PaginasInstitucionais',
  LEGACY_COMISSOES_DESCRICOES: 'Import4253',
  LEGACY_COMISSOES_MEMBROS: 'Import4252',
  PESSOAS_INSTITUCIONAIS: 'PessoasInstitucionais',
  GESTOES_INSTITUCIONAIS: 'GestoesInstitucionais',
  ORGAOS_INSTITUCIONAIS: 'OrgaosInstitucionais',
  VINCULOS_INSTITUCIONAIS: 'VinculosInstitucionais',
  CONVENIOS: 'Conveniosv2',
  CORRESPONDENTES: 'Import4254',
  OPORTUNIDADES: 'News',
  UNIDADES: 'Import4258',
  AGENDAMENTOS: 'Import4259',
  BLOQUEIOS_AGENDA: 'Import4256',
  DESTAQUES_HOME: 'DestaquesHome',
  BLOG_POSTS: 'Blog/Posts',
  EVENTS: 'Events/Events',
  FORMULARIOS_GESTAO_OPERACAO: 'FormulariosGestaoOperacao',
  FORMULARIOS_GESTAO_HISTORICO: 'FormulariosGestaoHistorico',
};

const FORM_CONTATO = {
  id: '3f5058a8-a9d6-47aa-87f4-1b6f99a43a21',
  namespace: 'wix.form_app.form',
  targets: {
    firstName: 'first_name_abae',
    lastName: 'last_name_d97c',
    email: 'email_5139',
    phone: 'phone_4c77',
    subject: 'short_answer_484b',
    message: 'long_answer_3524',
  },
};

const FORM_FALE_PRESIDENTE = {
  id: '9d1a55bb-23f4-4a89-9c06-93a7b180b10a',
  namespace: 'wix.form_app.form',
  targets: {
    name: 'nome_fb6a',
    email: 'email_203c',
    phone: 'telefone_d24c',
    oab: 'n_da_oab',
    message: 'mensagem',
  },
};

const FALE_PRESIDENTE_LIMITS = {
  name: 160,
  email: 254,
  phone: 32,
  oab: 40,
  message: 5000,
};

const FORM_DENUNCIA_PROPAGANDA = {
  id: '950cd10b-6535-49b2-a6f8-34c594728b93',
  namespace: 'wix.form_app.form',
  targets: {
    reporter: 'denunciante',
    reported: 'denunciado',
    location: 'local',
    occurrenceDate: 'data_ocorrencia',
    report: 'relato',
    privateImage: 'imagem_privada',
    privateVideo: 'video_privado',
  },
};


const FORMULARIOS_GESTAO = {
  contato: {
    key: 'contato',
    id: FORM_CONTATO.id,
    namespace: FORM_CONTATO.namespace,
    nome: 'Contato',
    categoria: 'formulario',
  },
  'fale-presidente': {
    key: 'fale-presidente',
    id: FORM_FALE_PRESIDENTE.id,
    namespace: FORM_FALE_PRESIDENTE.namespace,
    nome: 'Fale com o Presidente',
    categoria: 'formulario',
  },
  'denuncia-propaganda': {
    key: 'denuncia-propaganda',
    id: FORM_DENUNCIA_PROPAGANDA.id,
    namespace: FORM_DENUNCIA_PROPAGANDA.namespace,
    nome: 'Denúncia de Propaganda Irregular',
    categoria: 'denuncia',
  },
};

const FORMULARIOS_GESTAO_POR_ID = Object.values(FORMULARIOS_GESTAO)
  .reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

const FORMULARIOS_GESTAO_NAMESPACE = 'wix.form_app.form';
const FORMULARIOS_GESTAO_PAGE_SIZE_DEFAULT = 25;
const FORMULARIOS_GESTAO_PAGE_SIZE_MAX = 50;
const FORMULARIOS_GESTAO_DOWNLOAD_MINUTES = 10;
const FORMULARIOS_GESTAO_STATUS = [
  'NOVO',
  'EM_ANALISE',
  'CONCLUIDO',
  'ARQUIVADO',
];
const FORMULARIOS_GESTAO_PRIORIDADES = [
  'NORMAL',
  'ALTA',
  'URGENTE',
];
const FORMULARIOS_GESTAO_NOTA_MAX_LENGTH = 2000;
const FORMULARIOS_GESTAO_HISTORICO_LIMIT = 100;
const FORMULARIOS_GESTAO_PERMISSIONS = {
  VER: 'formularios.ver',
  OPERAR: 'formularios.operar',
  ANEXOS: 'formularios.anexos',
};

const PUBLICACOES_PENDENTES_DOWNLOAD_MINUTES = 10;
const PUBLICACOES_PENDENTES_MAX_RESULTS = 100;
const PUBLICACOES_PORTAL_STATUS = {
  PENDENTE: 'PENDENTE',
  PUBLICANDO: 'PUBLICANDO',
  ARQUIVADO: 'ARQUIVADO',
};
const criarTarefaCmsElevada = elevate(cmsTasks.createTask);
const obterTarefaCmsElevada = elevate(cmsTasks.getTask);

const DENUNCIA_PROPAGANDA_LIMITS = {
  reporter: 180,
  reported: 220,
  location: 300,
  report: 5000,
};

const DENUNCIA_PROPAGANDA_MAX_BYTES = 2 * 1024 * 1024;
const DENUNCIA_PROPAGANDA_UPLOAD_FOLDER =
  '/oab-jf/denuncias/propaganda-irregular';
const DENUNCIA_PROPAGANDA_RATE_LIMIT_MAX = 3;
const DENUNCIA_PROPAGANDA_UPLOAD_RATE_LIMIT_MAX = 6;
const denunciaPropagandaRateLimit = new Map();
const denunciaPropagandaUploadRateLimit = new Map();

const DENUNCIA_PROPAGANDA_MIME_CONFIG = {
  'image/jpeg': {
    kind: 'imagem',
    mediaType: 'image',
    extensions: ['jpg', 'jpeg'],
    defaultExtension: 'jpg',
  },
  'image/png': {
    kind: 'imagem',
    mediaType: 'image',
    extensions: ['png'],
    defaultExtension: 'png',
  },
  'image/webp': {
    kind: 'imagem',
    mediaType: 'image',
    extensions: ['webp'],
    defaultExtension: 'webp',
  },
  'video/mp4': {
    kind: 'video',
    mediaType: 'video',
    extensions: ['mp4'],
    defaultExtension: 'mp4',
  },
  'video/quicktime': {
    kind: 'video',
    mediaType: 'video',
    extensions: ['mov'],
    defaultExtension: 'mov',
  },
  'video/webm': {
    kind: 'video',
    mediaType: 'video',
    extensions: ['webm'],
    defaultExtension: 'webm',
  },
};

const FALE_PRESIDENTE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const FALE_PRESIDENTE_RATE_LIMIT_MAX = 3;
const falePresidenteRateLimit = new Map();

const CONTATO_LIMITS = {
  firstName: 80,
  lastName: 120,
  email: 254,
  phone: 32,
  subject: 160,
  message: 5000,
};

const CONTATO_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTATO_RATE_LIMIT_MAX = 5;
const contatoRateLimit = new Map();

const CADASTRO_RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
const CADASTRO_RATE_LIMIT_MAX = 3;
const CURRICULO_PREPARO_RATE_LIMIT_MAX = 5;
const cadastroCorrespondenteRateLimit = new Map();
const cadastroOportunidadeRateLimit = new Map();
const preparoCurriculoOportunidadeRateLimit = new Map();

const CORRESPONDENTE_LIMITS = {
  name: 160,
  oab: 32,
  phone: 32,
  email: 254,
  address: 300,
  city: 120,
  areas: 10,
};

const OPORTUNIDADE_LIMITS = {
  title: 160,
  contactName: 160,
  phone: 32,
  email: 254,
  city: 120,
  area: 80,
  types: 3,
  modalities: 3,
  description: 5000,
  externalUrl: 500,
};

const FORMULARIO_MIN_DURATION_MS = 1200;
const OPORTUNIDADE_EXPIRATION_DAYS = 120;
const OPORTUNIDADE_RESUME_FOLDER = '/oab-jf/oportunidades/curriculos';
const OPORTUNIDADE_RESUME_MAX_BYTES = 5 * 1024 * 1024;

const CADASTRO_ALLOWED_ORIGINS = [
  'https://juizdefora-oabmg.org.br',
  'https://www.juizdefora-oabmg.org.br',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
];

const CORRESPONDENTE_AREAS = [
  'Administrativo',
  'Ambiental',
  'Civil',
  'Compliance',
  'Constitucional',
  'Consumidor',
  'Digital',
  'Eleitoral',
  'Empresarial',
  'Penal',
  'Previdenciário',
  'Processual',
  'Propriedade intelectual',
  'Trabalhista',
  'Tributário',
];

const OPORTUNIDADE_AREAS = [
  'Público',
  'Constitucional',
  'Administrativo',
  'Penal',
  'Tributário',
  'Processual Penal',
  'Eleitoral',
  'Financeiro',
  'Civil',
  'Privado',
  'Empresarial',
  'Trabalho',
  'Processual Civil',
  'Ambiental',
  'Consumidor',
  'Internacional Público',
  'Internacional Privado',
  'Previdenciário',
  'Digital',
  'Proteção de Dados',
  'Sanitário',
  'Agrário',
  'Marítimo & Aeronáutico',
  'Desportivo',
  'Militar',
  'Outra',
];

const OPORTUNIDADE_TIPOS = [
  'Vaga',
  'Candidato',
  'Espaço no escritório',
];

const OPORTUNIDADE_MODALIDADES = [
  'Presencial',
  'Remoto',
  'Hibrido',
];

const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const OPORTUNIDADE_RESUME_MIME_CONFIG = {
  'application/pdf': {
    extensions: ['pdf'],
    defaultExtension: 'pdf',
  },
  'application/msword': {
    extensions: ['doc'],
    defaultExtension: 'doc',
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['docx'],
    defaultExtension: 'docx',
  },
};

const criarSubmissaoFormularioElevada = elevate(
  submissions.createSubmission
);

const consultarSubmissoesFormularioElevada = elevate(
  submissions.querySubmissionsByNamespace
);
const obterSubmissaoFormularioElevada = elevate(
  submissions.getSubmission
);
const contarSubmissoesFormularioElevada = elevate(
  submissions.countSubmissions
);
const marcarSubmissoesFormularioComoVistasElevada = elevate(
  submissions.bulkMarkSubmissionsAsSeen
);

// Janela pública de agenda: mostra até 15 datas úteis disponíveis dentro dos próximos 30 dias.
// Ajustar aqui se a OAB quiser abrir uma antecedência maior ou menor.
const JANELA_AGENDAMENTO_DIAS = 30;
const MAX_DATAS_AGENDAMENTO = 15;

const INFOBIP_EMAIL_ENDPOINT = '/email/3/send';

const ALLOWED_ORIGINS = [
  'https://certificados.juizdefora-oabmg.org.br',
  'https://central.juizdefora-oabmg.org.br',
  'https://central-agendamento-prisional.oabjf.workers.dev',
  'https://oabjf.workers.dev',
  'https://preview--agendamento-prisional.lovable.app',
  'https://juizdefora-oabmg.org.br',
  'https://www.juizdefora-oabmg.org.br',
  'https://lovable.dev',
  'https://www.lovable.dev',
  'https://lovable.app',
  'https://www.lovable.app',
  'http://localhost:5173',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  'http://localhost:3000',
];

const ALLOWED_ORIGIN_SUFFIXES = [
  '.pages.dev',
  '.lovable.dev',
  '.lovable.app',
  '.workers.dev',
];

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function getMethod(request) {
  return String(request.method || '').toUpperCase();
}

function isOptions(request) {
  return getMethod(request) === 'OPTIONS';
}

function isGet(request) {
  return getMethod(request) === 'GET';
}

function isPost(request) {
  return getMethod(request) === 'POST';
}

function normalizeOrigin(origin) {
  return text(origin).replace(/\/+$/, '');
}

function getRequestOrigin(request) {
  try {
    const fromHeader = getHeader(request, ['origin', 'Origin']);

    if (fromHeader) {
      return normalizeOrigin(fromHeader);
    }

    return normalizeOrigin(request.headers.origin || request.headers.Origin || '');
  } catch (err) {
    return '';
  }
}

function isAllowedOrigin(origin) {
  const value = normalizeOrigin(origin);

  if (!value) return false;

  if (ALLOWED_ORIGINS.includes(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname || '';

    if (
      url.protocol !== 'https:' &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1'
    ) {
      return false;
    }

    return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch (err) {
    return false;
  }
}

function getCorsHeaders(request) {
  const origin = getRequestOrigin(request);

  const allowOrigin = isAllowedOrigin(origin)
    ? origin
    : 'https://central.juizdefora-oabmg.org.br';

  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-OAB-Admin-Token, Accept, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonOk(request, body) {
  return ok({
    headers: getCorsHeaders(request),
    body,
  });
}

function jsonBadRequest(request, body) {
  return badRequest({
    headers: getCorsHeaders(request),
    body,
  });
}

function jsonNotFound(request, body) {
  return notFound({
    headers: getCorsHeaders(request),
    body,
  });
}

function jsonServerError(request, body) {
  return serverError({
    headers: getCorsHeaders(request),
    body,
  });
}

function getQueryParam(request, names) {
  const aliases = Array.isArray(names) ? names : [names];

  try {
    const query = request.query || {};

    for (const name of aliases) {
      const value = query[name];

      if (Array.isArray(value) && value.length) {
        return text(value[0]);
      }

      if (value !== undefined && value !== null) {
        return text(value);
      }
    }
  } catch (err) {
    // tenta pela URL abaixo
  }

  try {
    const url = new URL(request.url);

    for (const name of aliases) {
      const value = url.searchParams.get(name);

      if (value) {
        return text(value);
      }
    }
  } catch (err) {
    // sem URL disponível
  }

  return '';
}

function getHeader(request, names) {
  const aliases = Array.isArray(names) ? names : [names];

  try {
    const headers = request.headers || {};

    if (typeof headers.get === 'function') {
      for (const name of aliases) {
        const value = headers.get(name);

        if (value !== undefined && value !== null) {
          return text(value);
        }
      }
    }

    for (const name of aliases) {
      const direct = headers[name];

      if (direct !== undefined && direct !== null) {
        return text(direct);
      }

      const lower = headers[String(name).toLowerCase()];

      if (lower !== undefined && lower !== null) {
        return text(lower);
      }
    }
  } catch (err) {
    // sem headers acessíveis
  }

  return '';
}

function getAdminTokenFromRequest(request) {
  const headerToken = getHeader(request, [
    'x-oab-admin-token',
    'X-OAB-Admin-Token',
  ]);

  const authorization = getHeader(request, [
    'authorization',
    'Authorization',
  ]);

  const bearerToken = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';

  return headerToken || bearerToken;
}


function getFormularioGestaoConfig(value) {
  const key = text(value);

  if (!key) return null;

  if (FORMULARIOS_GESTAO[key]) {
    return FORMULARIOS_GESTAO[key];
  }

  if (FORMULARIOS_GESTAO_POR_ID[key]) {
    return FORMULARIOS_GESTAO_POR_ID[key];
  }

  return null;
}

function formularioGestaoDataIso(value) {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const raw = String(value);

  try {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  } catch (err) {
    return raw;
  }
}

function formularioGestaoExcerpt(value, limit = 180) {
  const normalized = text(value).replace(/\s+/g, ' ');

  if (!normalized || normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function parseAnexoPrivadoFormularioGestao(value) {
  const raw = text(value);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.privado !== true ||
      !text(parsed.fileUrl)
    ) {
      return null;
    }

    return {
      tipo: text(parsed.tipo),
      nomeOriginal: text(parsed.nomeOriginal),
      nomeArmazenado: text(parsed.nomeArmazenado),
      mimeType: text(parsed.mimeType),
      tamanhoBytes: Number(parsed.tamanhoBytes) || 0,
      fileId: text(parsed.fileId),
      fileUrl: text(parsed.fileUrl),
      privado: true,
    };
  } catch (err) {
    return null;
  }
}

function anexoFormularioGestaoSeguro(anexo) {
  if (!anexo) return null;

  return {
    disponivel: true,
    tipo: anexo.tipo,
    nome: anexo.nomeOriginal || anexo.nomeArmazenado || 'Anexo',
    mimeType: anexo.mimeType,
    tamanhoBytes: anexo.tamanhoBytes,
  };
}

function normalizarSubmissaoFormularioGestao(item) {
  const config = FORMULARIOS_GESTAO_POR_ID[text(item?.formId)];
  const values = item?.submissions && typeof item.submissions === 'object'
    ? item.submissions
    : {};
  const id = text(item?._id || item?.id);
  const createdDate = formularioGestaoDataIso(
    item?._createdDate || item?.createdDate
  );
  const updatedDate = formularioGestaoDataIso(
    item?._updatedDate || item?.updatedDate
  );
  const seen = item?.seen === true;

  if (!config) {
    return {
      id,
      formKey: '',
      formId: text(item?.formId),
      formName: 'Formulário',
      categoria: 'formulario',
      createdDate,
      updatedDate,
      seen,
      status: text(item?.status),
      primary: '',
      secondary: '',
      title: 'Submissão',
      excerpt: '',
      attachments: {
        image: false,
        video: false,
      },
    };
  }

  if (config.key === 'contato') {
    const targets = FORM_CONTATO.targets;
    const fullName = [
      text(values[targets.firstName]),
      text(values[targets.lastName]),
    ].filter(Boolean).join(' ');

    return {
      id,
      formKey: config.key,
      formId: config.id,
      formName: config.nome,
      categoria: config.categoria,
      createdDate,
      updatedDate,
      seen,
      status: text(item?.status),
      primary: fullName || text(values[targets.email]) || 'Sem nome',
      secondary: text(values[targets.email]) || text(values[targets.phone]),
      title: text(values[targets.subject]) || 'Contato',
      excerpt: formularioGestaoExcerpt(values[targets.message]),
      attachments: {
        image: false,
        video: false,
      },
    };
  }

  if (config.key === 'fale-presidente') {
    const targets = FORM_FALE_PRESIDENTE.targets;

    return {
      id,
      formKey: config.key,
      formId: config.id,
      formName: config.nome,
      categoria: config.categoria,
      createdDate,
      updatedDate,
      seen,
      status: text(item?.status),
      primary: text(values[targets.name]) || text(values[targets.email]) || 'Sem nome',
      secondary: [
        text(values[targets.oab]) ? `OAB ${text(values[targets.oab])}` : '',
        text(values[targets.email]),
      ].filter(Boolean).join(' · '),
      title: 'Fale com o Presidente',
      excerpt: formularioGestaoExcerpt(values[targets.message]),
      attachments: {
        image: false,
        video: false,
      },
    };
  }

  const targets = FORM_DENUNCIA_PROPAGANDA.targets;
  const image = parseAnexoPrivadoFormularioGestao(
    values[targets.privateImage]
  );
  const video = parseAnexoPrivadoFormularioGestao(
    values[targets.privateVideo]
  );

  return {
    id,
    formKey: config.key,
    formId: config.id,
    formName: config.nome,
    categoria: config.categoria,
    createdDate,
    updatedDate,
    seen,
    status: text(item?.status),
    primary: text(values[targets.reporter]) || 'Denunciante não identificado',
    secondary: text(values[targets.reported])
      ? `Denunciado: ${text(values[targets.reported])}`
      : '',
    title: text(values[targets.reported])
      ? `Denúncia contra ${text(values[targets.reported])}`
      : 'Denúncia de propaganda irregular',
    excerpt: formularioGestaoExcerpt(values[targets.report]),
    attachments: {
      image: Boolean(image),
      video: Boolean(video),
    },
  };
}

function detalhesSubmissaoFormularioGestao(item) {
  const summary = normalizarSubmissaoFormularioGestao(item);
  const config = FORMULARIOS_GESTAO_POR_ID[text(item?.formId)];
  const values = item?.submissions && typeof item.submissions === 'object'
    ? item.submissions
    : {};

  if (!config) {
    return {
      ...summary,
      fields: [],
      attachmentDetails: {
        image: null,
        video: null,
      },
    };
  }

  if (config.key === 'contato') {
    const targets = FORM_CONTATO.targets;

    return {
      ...summary,
      fields: [
        {
          key: 'nome',
          label: 'Nome',
          value: [
            text(values[targets.firstName]),
            text(values[targets.lastName]),
          ].filter(Boolean).join(' '),
          type: 'text',
        },
        {
          key: 'email',
          label: 'E-mail',
          value: text(values[targets.email]),
          type: 'email',
        },
        {
          key: 'telefone',
          label: 'Telefone',
          value: text(values[targets.phone]),
          type: 'phone',
        },
        {
          key: 'assunto',
          label: 'Assunto',
          value: text(values[targets.subject]),
          type: 'text',
        },
        {
          key: 'mensagem',
          label: 'Mensagem',
          value: text(values[targets.message]),
          type: 'long-text',
        },
      ],
      attachmentDetails: {
        image: null,
        video: null,
      },
    };
  }

  if (config.key === 'fale-presidente') {
    const targets = FORM_FALE_PRESIDENTE.targets;

    return {
      ...summary,
      fields: [
        {
          key: 'nome',
          label: 'Nome',
          value: text(values[targets.name]),
          type: 'text',
        },
        {
          key: 'email',
          label: 'E-mail',
          value: text(values[targets.email]),
          type: 'email',
        },
        {
          key: 'telefone',
          label: 'Telefone',
          value: text(values[targets.phone]),
          type: 'phone',
        },
        {
          key: 'oab',
          label: 'Nº da OAB',
          value: text(values[targets.oab]),
          type: 'text',
        },
        {
          key: 'mensagem',
          label: 'Mensagem',
          value: text(values[targets.message]),
          type: 'long-text',
        },
      ],
      attachmentDetails: {
        image: null,
        video: null,
      },
    };
  }

  const targets = FORM_DENUNCIA_PROPAGANDA.targets;
  const image = parseAnexoPrivadoFormularioGestao(
    values[targets.privateImage]
  );
  const video = parseAnexoPrivadoFormularioGestao(
    values[targets.privateVideo]
  );

  return {
    ...summary,
    fields: [
      {
        key: 'denunciante',
        label: 'Denunciante',
        value: text(values[targets.reporter]),
        type: 'text',
      },
      {
        key: 'denunciado',
        label: 'Denunciado',
        value: text(values[targets.reported]),
        type: 'text',
      },
      {
        key: 'local',
        label: 'Local',
        value: text(values[targets.location]),
        type: 'text',
      },
      {
        key: 'data',
        label: 'Data da ocorrência',
        value: text(values[targets.occurrenceDate]),
        type: 'date',
      },
      {
        key: 'relato',
        label: 'Relato',
        value: text(values[targets.report]),
        type: 'long-text',
      },
    ],
    attachmentDetails: {
      image: anexoFormularioGestaoSeguro(image),
      video: anexoFormularioGestaoSeguro(video),
    },
  };
}

function formularioGestaoErroResponse(request, resultado) {
  const safeResultado = resultado || {
    ok: false,
    codigo: 'ERRO_INTERNO',
    mensagem: 'Não foi possível concluir a operação.',
  };

  if (
    safeResultado.codigo === 'ERRO_INTERNO' ||
    safeResultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
    safeResultado.codigo === 'WIX_FORMS_INDISPONIVEL'
  ) {
    return jsonServerError(request, safeResultado);
  }

  return jsonBadRequest(request, safeResultado);
}

function mensagemPermissaoFormularioGestao(permissoesObrigatorias = []) {
  if (permissoesObrigatorias.includes(FORMULARIOS_GESTAO_PERMISSIONS.ANEXOS)) {
    return 'Seu perfil não possui acesso aos anexos privados deste módulo.';
  }

  if (permissoesObrigatorias.includes(FORMULARIOS_GESTAO_PERMISSIONS.OPERAR)) {
    return 'Seu perfil permite consultar os envios, mas não alterar o atendimento.';
  }

  return 'Seu perfil não possui acesso a Formulários e Denúncias.';
}

async function validarAcessoAdminFormularios(
  request,
  permissoesObrigatorias = [FORMULARIOS_GESTAO_PERMISSIONS.VER]
) {
  const token = getAdminTokenFromRequest(request);

  if (!token) {
    return {
      ok: false,
      response: jsonBadRequest(request, {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'Acesso administrativo obrigatório.',
      }),
    };
  }

  const resultado = await meAdminApi(token);

  if (!resultado || !resultado.ok) {
    return {
      ok: false,
      response: formularioGestaoErroResponse(request, resultado),
    };
  }

  const permissoes = Array.isArray(resultado.permissoes)
    ? resultado.permissoes.map(text).filter(Boolean)
    : [];
  const required = Array.isArray(permissoesObrigatorias)
    ? permissoesObrigatorias.map(text).filter(Boolean)
    : [text(permissoesObrigatorias)].filter(Boolean);
  const legacy = resultado.legacy === true;
  const permitido =
    legacy || required.every((permissao) => permissoes.includes(permissao));

  if (!permitido) {
    return {
      ok: false,
      response: jsonBadRequest(request, {
        ok: false,
        codigo: 'SEM_PERMISSAO',
        permissaoNecessaria: required.join(','),
        mensagem: mensagemPermissaoFormularioGestao(required),
      }),
    };
  }

  return {
    ok: true,
    token,
    admin: resultado.admin || null,
    permissoes,
    legacy,
    podeOperar:
      legacy || permissoes.includes(FORMULARIOS_GESTAO_PERMISSIONS.OPERAR),
    podeAbrirAnexos:
      legacy || permissoes.includes(FORMULARIOS_GESTAO_PERMISSIONS.ANEXOS),
  };
}

async function contarFormulariosGestao() {
  const formIds = Object.values(FORMULARIOS_GESTAO).map((item) => item.id);

  const raw = await contarSubmissoesFormularioElevada(
    formIds,
    FORMULARIOS_GESTAO_NAMESPACE
  );

  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.formsSubmissionsCount)
      ? raw.formsSubmissionsCount
      : raw && raw.formId
        ? [raw]
        : [];

  const byId = rows.reduce((acc, item) => {
    const formId = text(item?.formId);
    if (!formId) return acc;

    acc[formId] = {
      totalCount: Number(item?.totalCount) || 0,
      unseenCount: Number(item?.unseenCount) || 0,
    };

    return acc;
  }, {});

  return Object.values(FORMULARIOS_GESTAO).map((config) => ({
    key: config.key,
    id: config.id,
    name: config.nome,
    category: config.categoria,
    totalCount: byId[config.id]?.totalCount || 0,
    unseenCount: byId[config.id]?.unseenCount || 0,
  }));
}

async function consultarFormulariosGestao({
  config,
  limit,
  cursor,
  onlyUnseen,
}) {
  let query = consultarSubmissoesFormularioElevada()
    .eq('namespace', config.namespace)
    .eq('formId', config.id)
    .descending('_createdDate')
    .limit(limit);

  if (onlyUnseen) {
    query = query.eq('seen', false);
  }

  if (cursor) {
    query = query.skipTo(cursor);
  }

  const result = await query.find();

  const items = Array.isArray(result?.items)
    ? result.items
    : Array.isArray(result)
      ? result
      : [];

  const nextCursor = text(
    result?.cursors?.next ||
    result?.pagingMetadata?.cursors?.next ||
    ''
  );

  const hasNext = typeof result?.hasNext === 'function'
    ? result.hasNext()
    : Boolean(nextCursor);

  const normalizedItems = items.map(normalizarSubmissaoFormularioGestao);
  const enrichedItems = await enriquecerItensComOperacaoFormularioGestao(
    normalizedItems
  );

  return {
    items: enrichedItems,
    nextCursor,
    hasNext,
  };
}

async function obterSubmissaoFormularioGestao(submissionId) {
  const resultado = await obterSubmissaoFormularioElevada(submissionId);
  const item =
    resultado && resultado.submission
      ? resultado.submission
      : resultado;

  if (!item) {
    return null;
  }

  const formId = text(item.formId);
  const config = FORMULARIOS_GESTAO_POR_ID[formId];

  if (!config) {
    console.warn(
      'Submissão encontrada, mas pertence a um formulário não gerenciado pelo Portal de Gestão.',
      {
        submissionId: text(item._id || item.id || submissionId),
        formId,
      }
    );

    return null;
  }

  return item;
}

function normalizarStatusOperacionalFormularioGestao(value) {
  const normalized = text(value).toUpperCase();
  return FORMULARIOS_GESTAO_STATUS.includes(normalized)
    ? normalized
    : '';
}

function normalizarPrioridadeFormularioGestao(value) {
  const normalized = text(value).toUpperCase();
  return FORMULARIOS_GESTAO_PRIORIDADES.includes(normalized)
    ? normalized
    : '';
}

function identidadeAdminFormularioGestao(admin = {}) {
  const email = normalizeEmail(admin.email);
  const id = text(admin._id || admin.id || email);
  const nome = text(admin.nome || admin.name || email || 'Administrador');

  return {
    id,
    nome,
    email,
  };
}

function mapOperacaoFormularioGestao(item, fallback = {}) {
  const responsavelId = text(item?.responsavelId);
  const responsavelNome = text(item?.responsavelNome);
  const responsavelEmail = normalizeEmail(item?.responsavelEmail);

  return {
    statusOperacional:
      normalizarStatusOperacionalFormularioGestao(item?.statusOperacional) ||
      'NOVO',
    prioridade:
      normalizarPrioridadeFormularioGestao(item?.prioridade) ||
      'NORMAL',
    responsavel:
      responsavelId || responsavelNome || responsavelEmail
        ? {
            id: responsavelId,
            nome: responsavelNome,
            email: responsavelEmail,
          }
        : null,
    updatedAt: formularioGestaoDataIso(
      item?._updatedDate || fallback.updatedAt
    ),
  };
}

function mapHistoricoFormularioGestao(item = {}) {
  return {
    id: text(item._id),
    action: text(item.acao),
    field: text(item.campo),
    previousValue: text(item.valorAnterior),
    newValue: text(item.valorNovo),
    detail: text(item.detalhe),
    admin: {
      id: text(item.adminId),
      name: text(item.adminNome),
      email: normalizeEmail(item.adminEmail),
    },
    createdAt: formularioGestaoDataIso(item._createdDate),
  };
}

async function buscarOperacaoFormularioGestao(submissionId) {
  const result = await wixData
    .query(COL.FORMULARIOS_GESTAO_OPERACAO)
    .eq('submissionId', submissionId)
    .limit(1)
    .find({ suppressAuth: true });

  return (result.items || [])[0] || null;
}

async function buscarOperacoesFormularioGestao(submissionIds = []) {
  const ids = Array.from(new Set(submissionIds.map(text).filter(Boolean)));

  if (!ids.length) {
    return new Map();
  }

  const items = [];
  const chunkSize = 100;

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const result = await wixData
      .query(COL.FORMULARIOS_GESTAO_OPERACAO)
      .hasSome('submissionId', chunk)
      .limit(chunkSize)
      .find({ suppressAuth: true });

    items.push(...(result.items || []));
  }

  return new Map(
    items.map((item) => [
      text(item.submissionId),
      mapOperacaoFormularioGestao(item),
    ])
  );
}

async function listarHistoricoFormularioGestao(submissionId) {
  const result = await wixData
    .query(COL.FORMULARIOS_GESTAO_HISTORICO)
    .eq('submissionId', submissionId)
    .descending('_createdDate')
    .limit(FORMULARIOS_GESTAO_HISTORICO_LIMIT)
    .find({ suppressAuth: true });

  return (result.items || []).map(mapHistoricoFormularioGestao);
}

async function registrarHistoricoFormularioGestao({
  submissionId,
  formKey,
  action,
  field = '',
  previousValue = '',
  newValue = '',
  detail = '',
  admin,
}) {
  const actor = identidadeAdminFormularioGestao(admin);

  const created = await wixData.insert(
    COL.FORMULARIOS_GESTAO_HISTORICO,
    {
      submissionId,
      formKey,
      acao: text(action),
      campo: text(field),
      valorAnterior: text(previousValue),
      valorNovo: text(newValue),
      detalhe: text(detail),
      adminId: actor.id,
      adminNome: actor.nome,
      adminEmail: actor.email,
    },
    { suppressAuth: true }
  );

  return mapHistoricoFormularioGestao(created);
}

async function salvarOperacaoFormularioGestao({
  existing,
  submissionId,
  formKey,
  statusOperacional,
  prioridade,
  responsavel,
}) {
  const item = {
    ...(existing || {}),
    submissionId,
    formKey,
    statusOperacional,
    prioridade,
    responsavelId: responsavel?.id || '',
    responsavelNome: responsavel?.nome || '',
    responsavelEmail: responsavel?.email || '',
  };

  let saved;

  if (existing?._id) {
    saved = await wixData.update(
      COL.FORMULARIOS_GESTAO_OPERACAO,
      item,
      { suppressAuth: true }
    );
  } else {
    try {
      saved = await wixData.insert(
        COL.FORMULARIOS_GESTAO_OPERACAO,
        item,
        { suppressAuth: true }
      );
    } catch (insertError) {
      const raced = await buscarOperacaoFormularioGestao(submissionId);

      if (!raced?._id) {
        throw insertError;
      }

      saved = await wixData.update(
        COL.FORMULARIOS_GESTAO_OPERACAO,
        {
          ...raced,
          ...item,
          _id: raced._id,
        },
        { suppressAuth: true }
      );
    }
  }

  return {
    raw: saved,
    operation: mapOperacaoFormularioGestao(saved),
  };
}

async function enriquecerItensComOperacaoFormularioGestao(items = []) {
  const operations = await buscarOperacoesFormularioGestao(
    items.map((item) => item.id)
  );

  return items.map((item) => ({
    ...item,
    operation:
      operations.get(item.id) ||
      mapOperacaoFormularioGestao(null),
  }));
}

async function readJsonBody(request) {
  try {
    if (request.body && typeof request.body.json === 'function') {
      return await request.body.json();
    }
  } catch (err) {
    console.warn('Falha ao ler request.body.json().', err);
  }

  try {
    if (request.body && typeof request.body.text === 'function') {
      const raw = await request.body.text();

      return raw ? JSON.parse(raw) : {};
    }
  } catch (err) {
    console.warn('Falha ao ler request.body.text().', err);
  }

  try {
    if (request.body && typeof request.body === 'object') {
      return request.body;
    }
  } catch (err) {
    // segue vazio
  }

  return {};
}

function normalizeDateIso(value) {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dateToIso(value);
  }

  const v = text(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return v;
  }

  const parsed = new Date(v);

  if (!Number.isNaN(parsed.getTime())) {
    return dateToIso(parsed);
  }

  return v;
}

function normalizeTime(value) {
  const v = text(value);

  if (!v) return '';

  const match = v.match(/(\d{1,2}):(\d{2})/);

  if (!match) return v;

  const hh = String(Number(match[1])).padStart(2, '0');
  const mm = String(Number(match[2])).padStart(2, '0');

  return `${hh}:${mm}`;
}

function addMinutesToTime(time, minutesToAdd) {
  const horario = normalizeTime(time);

  if (!/^\d{2}:\d{2}$/.test(horario)) {
    return '';
  }

  const [hh, mm] = horario.split(':').map(Number);
  const total = hh * 60 + mm + minutesToAdd;

  const nextHh = Math.floor(total / 60);
  const nextMm = total % 60;

  return `${String(nextHh).padStart(2, '0')}:${String(nextMm).padStart(2, '0')}`;
}

function dateToIso(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function dateFromIso(dataIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(dataIso))) {
    return null;
  }

  const [yyyy, mm, dd] = dataIso.split('-').map(Number);

  return new Date(yyyy, mm - 1, dd, 12, 0, 0);
}

function formatWeekday(dataIso) {
  const date = dateFromIso(dataIso);

  if (!date) return '';

  const dias = [
    'Domingo',
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
  ];

  return dias[date.getDay()];
}

function formatDayMonth(dataIso) {
  const date = dateFromIso(dataIso);

  if (!date) return '';

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');

  return `${dd}/${mm}`;
}

function formatDateBr(dataIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(dataIso))) {
    return text(dataIso);
  }

  const [yyyy, mm, dd] = dataIso.split('-');

  return `${dd}/${mm}/${yyyy}`;
}

function formatDateLabel(dataIso) {
  const diaSemana = formatWeekday(dataIso);
  const diaMes = formatDayMonth(dataIso);

  if (!diaSemana || !diaMes) {
    return text(dataIso);
  }

  return `${diaSemana}, ${diaMes}`;
}

function mapUnidade(item) {
  const slug = text(item.slug || item.id || item.codigo || item.unidadeSlug);
  const nome = text(item.nome || item.title || item.unidadeNome);
  const ativa = item.ativa !== false && item.ativo !== false;

  return {
    _id: item._id,
    id: slug,
    slug,
    nome,
    endereco: text(item.endereco || item.localizacao || item.cidade),
    ativa,
  };
}

function filtrarUnidadeValida(unidade) {
  return !!unidade.slug && !!unidade.nome && unidade.ativa !== false;
}

function splitCidadeUf(value) {
  const normalized = text(value);
  const match = normalized.match(/^(.*?)\s*-\s*([A-Za-z]{2})$/);

  if (!match) {
    return {
      city: normalized,
      uf: '',
    };
  }

  return {
    city: text(match[1]),
    uf: text(match[2]).toUpperCase(),
  };
}

function criarUrlBuscaGoogleMaps(address, city, uf) {
  const query = [address, city, uf]
    .map(text)
    .filter(Boolean)
    .join(', ');

  if (!query) return '';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function isGoogleMapsHost(hostname) {
  const host = text(hostname).toLowerCase();

  return (
    host === 'google.com' ||
    host.endsWith('.google.com') ||
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl'
  );
}

function normalizarUrlRotaSala(value, address, city, uf) {
  const fallback = criarUrlBuscaGoogleMaps(address, city, uf);
  const rawUrl = text(value);

  if (!rawUrl) return fallback;

  try {
    const url = new URL(rawUrl);

    if (!['https:', 'http:'].includes(url.protocol)) {
      return fallback;
    }

    if (!isGoogleMapsHost(url.hostname)) {
      return fallback;
    }

    if (url.pathname.includes('/maps/embed')) {
      return fallback;
    }

    return url.toString();
  } catch (err) {
    return fallback;
  }
}


function getClientIp(request) {
  const forwarded = getHeader(request, [
    'x-forwarded-for',
    'X-Forwarded-For',
    'cf-connecting-ip',
    'CF-Connecting-IP',
    'x-real-ip',
    'X-Real-IP',
    'x-wix-client-ip',
    'X-Wix-Client-Ip',
  ]);

  return text(forwarded).split(',')[0].trim().slice(0, 80);
}

function normalizarTelefoneContato(value) {
  return text(value).replace(/\s+/g, ' ');
}

function normalizarPayloadContato(payload = {}) {
  return {
    firstName: text(payload.firstName || payload.nome),
    lastName: text(payload.lastName || payload.sobrenome),
    email: normalizeEmail(payload.email),
    phone: normalizarTelefoneContato(payload.phone || payload.telefone),
    subject: text(payload.subject || payload.assunto),
    message: text(payload.message || payload.mensagem),
    website: text(
      payload.website ||
      payload.companyWebsite ||
      payload.siteEmpresa
    ),
    formStartedAt: Number(
      payload.formStartedAt ||
      payload.iniciadoEm ||
      0
    ),
  };
}

function validarPayloadContato(dados) {
  const erros = {};
  const phoneDigits = dados.phone.replace(/\D/g, '');

  if (!dados.firstName) {
    erros.firstName = 'Informe seu nome.';
  } else if (dados.firstName.length > CONTATO_LIMITS.firstName) {
    erros.firstName = `O nome deve ter no máximo ${CONTATO_LIMITS.firstName} caracteres.`;
  }

  if (!dados.lastName) {
    erros.lastName = 'Informe seu sobrenome.';
  } else if (dados.lastName.length > CONTATO_LIMITS.lastName) {
    erros.lastName = `O sobrenome deve ter no máximo ${CONTATO_LIMITS.lastName} caracteres.`;
  }

  if (!dados.email) {
    erros.email = 'Informe seu e-mail.';
  } else if (
    dados.email.length > CONTATO_LIMITS.email ||
    !isValidEmail(dados.email)
  ) {
    erros.email = 'Informe um e-mail válido.';
  }

  if (!dados.phone) {
    erros.phone = 'Informe seu telefone.';
  } else if (
    dados.phone.length > CONTATO_LIMITS.phone ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 13
  ) {
    erros.phone = 'Informe um telefone válido com DDD.';
  }

  if (!dados.subject) {
    erros.subject = 'Informe o assunto.';
  } else if (dados.subject.length < 3) {
    erros.subject = 'O assunto deve ter pelo menos 3 caracteres.';
  } else if (dados.subject.length > CONTATO_LIMITS.subject) {
    erros.subject = `O assunto deve ter no máximo ${CONTATO_LIMITS.subject} caracteres.`;
  }

  if (!dados.message) {
    erros.message = 'Escreva sua mensagem.';
  } else if (dados.message.length < 10) {
    erros.message = 'A mensagem deve ter pelo menos 10 caracteres.';
  } else if (dados.message.length > CONTATO_LIMITS.message) {
    erros.message = `A mensagem deve ter no máximo ${CONTATO_LIMITS.message} caracteres.`;
  }

  return erros;
}

function deveIgnorarContatoComoSpam(dados) {
  return Boolean(dados.website);
}

function limparRateLimitContato(now = Date.now()) {
  for (const [key, entry] of contatoRateLimit.entries()) {
    if (
      !entry ||
      !Number.isFinite(entry.startedAt) ||
      now - entry.startedAt >= CONTATO_RATE_LIMIT_WINDOW_MS
    ) {
      contatoRateLimit.delete(key);
    }
  }
}

function consumirRateLimitContato(request, email) {
  const now = Date.now();
  limparRateLimitContato(now);

  const ip = getClientIp(request);
  const key = `${ip || 'sem-ip'}|${normalizeEmail(email) || 'sem-email'}`;
  const current = contatoRateLimit.get(key);

  if (
    !current ||
    now - current.startedAt >= CONTATO_RATE_LIMIT_WINDOW_MS
  ) {
    contatoRateLimit.set(key, {
      startedAt: now,
      count: 1,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= CONTATO_RATE_LIMIT_MAX) {
    const remaining = Math.max(
      1,
      CONTATO_RATE_LIMIT_WINDOW_MS - (now - current.startedAt)
    );

    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(remaining / 1000),
    };
  }

  current.count += 1;
  contatoRateLimit.set(key, current);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function criarSubmissaoContato(dados) {
  const targets = FORM_CONTATO.targets;

  return criarSubmissaoFormularioElevada(
    {
      formId: FORM_CONTATO.id,
      submissions: {
        [targets.firstName]: dados.firstName,
        [targets.lastName]: dados.lastName,
        [targets.email]: dados.email,
        [targets.phone]: dados.phone,
        [targets.subject]: dados.subject,
        [targets.message]: dados.message,
      },
    },
    {}
  );
}


function normalizarPayloadFalePresidente(payload = {}) {
  return {
    name: text(payload.name || payload.nome),
    email: normalizeEmail(payload.email),
    phone: normalizarTelefoneContato(payload.phone || payload.telefone),
    oab: text(payload.oab || payload.numeroOab).toUpperCase(),
    message: text(payload.message || payload.mensagem),
    website: text(
      payload.website ||
      payload.companyWebsite ||
      payload.siteEmpresa
    ),
    formStartedAt: Number(
      payload.formStartedAt ||
      payload.iniciadoEm ||
      0
    ),
  };
}

function validarPayloadFalePresidente(dados) {
  const erros = {};
  const phoneDigits = dados.phone.replace(/\D/g, '');
  const oabDigits = dados.oab.replace(/\D/g, '');

  if (!dados.name) {
    erros.name = 'Informe seu nome completo.';
  } else if (dados.name.length < 3) {
    erros.name = 'Use pelo menos 3 caracteres.';
  } else if (dados.name.length > FALE_PRESIDENTE_LIMITS.name) {
    erros.name =
      `O nome deve ter no máximo ${FALE_PRESIDENTE_LIMITS.name} caracteres.`;
  }

  if (!dados.email) {
    erros.email = 'Informe seu e-mail.';
  } else if (
    dados.email.length > FALE_PRESIDENTE_LIMITS.email ||
    !isValidEmail(dados.email)
  ) {
    erros.email = 'Informe um e-mail válido.';
  }

  if (!dados.phone) {
    erros.phone = 'Informe seu telefone.';
  } else if (
    dados.phone.length > FALE_PRESIDENTE_LIMITS.phone ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 13
  ) {
    erros.phone = 'Informe um telefone válido com DDD.';
  }

  if (!dados.oab) {
    erros.oab = 'Informe seu número de inscrição na OAB.';
  } else if (
    dados.oab.length > FALE_PRESIDENTE_LIMITS.oab ||
    oabDigits.length < 3
  ) {
    erros.oab = 'Informe um número de OAB válido.';
  }

  if (!dados.message) {
    erros.message = 'Escreva sua mensagem.';
  } else if (dados.message.length < 10) {
    erros.message = 'A mensagem deve ter pelo menos 10 caracteres.';
  } else if (dados.message.length > FALE_PRESIDENTE_LIMITS.message) {
    erros.message =
      `A mensagem deve ter no máximo ${FALE_PRESIDENTE_LIMITS.message} caracteres.`;
  }

  return erros;
}

function deveIgnorarFalePresidenteComoSpam(dados) {
  return Boolean(dados.website) || formularioPreenchidoRapido(dados);
}

function limparRateLimitFalePresidente(now = Date.now()) {
  for (const [key, entry] of falePresidenteRateLimit.entries()) {
    if (
      !entry ||
      !Number.isFinite(entry.startedAt) ||
      now - entry.startedAt >= FALE_PRESIDENTE_RATE_LIMIT_WINDOW_MS
    ) {
      falePresidenteRateLimit.delete(key);
    }
  }
}

function consumirRateLimitFalePresidente(request, email) {
  const now = Date.now();
  limparRateLimitFalePresidente(now);

  const ip = getClientIp(request);
  const key = `${ip || 'sem-ip'}|${normalizeEmail(email) || 'sem-email'}`;
  const current = falePresidenteRateLimit.get(key);

  if (
    !current ||
    now - current.startedAt >= FALE_PRESIDENTE_RATE_LIMIT_WINDOW_MS
  ) {
    falePresidenteRateLimit.set(key, {
      startedAt: now,
      count: 1,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= FALE_PRESIDENTE_RATE_LIMIT_MAX) {
    const remaining = Math.max(
      1,
      FALE_PRESIDENTE_RATE_LIMIT_WINDOW_MS - (now - current.startedAt)
    );

    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(remaining / 1000),
    };
  }

  current.count += 1;
  falePresidenteRateLimit.set(key, current);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function criarSubmissaoFalePresidente(dados) {
  const targets = FORM_FALE_PRESIDENTE.targets;

  return criarSubmissaoFormularioElevada(
    {
      formId: FORM_FALE_PRESIDENTE.id,
      submissions: {
        [targets.name]: dados.name,
        [targets.email]: dados.email,
        [targets.phone]: dados.phone,
        [targets.oab]: dados.oab,
        [targets.message]: dados.message,
      },
    },
    {}
  );
}


function normalizarTipoAnexoDenuncia(value) {
  const normalized = text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (['imagem', 'image', 'foto', 'photo'].includes(normalized)) {
    return 'imagem';
  }

  if (['video', 'vídeo'].includes(normalized)) {
    return 'video';
  }

  return '';
}

function inferMimeTypeAnexoDenuncia(fileName) {
  const extension = getFileExtension(fileName);

  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'webm') return 'video/webm';

  return '';
}

function getDenunciaMimeConfig(mimeType) {
  return DENUNCIA_PROPAGANDA_MIME_CONFIG[text(mimeType).toLowerCase()] || null;
}

function normalizarMimeTypeAnexoDenuncia(mimeType, fileName, kind) {
  const informado = text(mimeType).toLowerCase();
  const aliases = {
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'video/x-quicktime': 'video/quicktime',
    'video/mov': 'video/quicktime',
  };
  const normalizado = aliases[informado] || informado;
  const extension = getFileExtension(fileName);
  const configInformada = getDenunciaMimeConfig(normalizado);

  if (
    configInformada &&
    (!kind || configInformada.kind === kind) &&
    (!extension || configInformada.extensions.includes(extension))
  ) {
    return normalizado;
  }

  const inferido = inferMimeTypeAnexoDenuncia(fileName);
  const configInferida = getDenunciaMimeConfig(inferido);

  if (
    configInferida &&
    (!kind || configInferida.kind === kind)
  ) {
    return inferido;
  }

  return normalizado;
}

function normalizarPayloadAnexoDenuncia(payload = {}) {
  const fileName = text(
    payload.fileName ||
      payload.nomeArquivo ||
      payload.name
  );
  const dataUrl = text(
    payload.dataUrl ||
      payload.fileDataUrl ||
      payload.arquivoDataUrl
  );
  const base64Informado = text(
    payload.fileBase64 ||
      payload.base64 ||
      payload.arquivoBase64
  );
  const dataParts = splitDataUrl(base64Informado || dataUrl);
  const kind = normalizarTipoAnexoDenuncia(
    payload.kind ||
      payload.tipo ||
      payload.attachmentType
  );
  const mimeType = normalizarMimeTypeAnexoDenuncia(
    payload.mimeType ||
      payload.contentType ||
      dataParts.mimeType,
    fileName,
    kind
  );

  return {
    kind,
    reporter: normalizarTextoLinhaFormulario(
      payload.reporter ||
        payload.denunciante ||
        payload.nome
    ),
    fileName,
    mimeType,
    base64: text(dataParts.base64).replace(/\s/g, ''),
  };
}

function validarPayloadAnexoDenuncia(dados) {
  const erros = {};
  const config = getDenunciaMimeConfig(dados.mimeType);
  const extension = getFileExtension(dados.fileName);

  if (!dados.kind) {
    erros.attachment = 'Informe se o anexo é uma imagem ou um vídeo.';
  }

  if (!dados.fileName || dados.fileName.length > 180) {
    erros.attachment = 'O nome do arquivo é inválido.';
  }

  if (
    !config ||
    !dados.kind ||
    config.kind !== dados.kind ||
    !extension ||
    !config.extensions.includes(extension)
  ) {
    erros.attachment =
      dados.kind === 'video'
        ? 'Envie o vídeo em MP4, MOV ou WebM.'
        : 'Envie a imagem em JPG, PNG ou WebP.';
  }

  if (
    !dados.base64 ||
    dados.base64.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(dados.base64)
  ) {
    erros.attachment = 'O conteúdo do anexo é inválido.';
  }

  const tamanhoAproximado = Math.floor((dados.base64.length * 3) / 4);

  if (
    tamanhoAproximado <= 0 ||
    tamanhoAproximado > DENUNCIA_PROPAGANDA_MAX_BYTES + 3
  ) {
    erros.attachment = 'Cada anexo deve ter no máximo 2 MB.';
  }

  return erros;
}

function montarNomeAnexoDenuncia(fileName, mimeType, kind) {
  const config = getDenunciaMimeConfig(mimeType);
  const originalExtension = getFileExtension(fileName);
  const extension =
    config && config.extensions.includes(originalExtension)
      ? originalExtension
      : config
        ? config.defaultExtension
        : originalExtension || 'bin';
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const base = sanitizeFileBaseName(fileName || kind || 'anexo');

  return `denuncia-${kind}-${timestamp}-${gerarUploadToken()}-${base}.${extension}`;
}

async function uploadAnexoDenunciaPrivado(dados) {
  const config = getDenunciaMimeConfig(dados.mimeType);
  const buffer = decodeBase64ToBuffer(dados.base64);

  if (!config || !buffer || !buffer.length) {
    throw new Error('O anexo está vazio ou em formato inválido.');
  }

  if (buffer.length > DENUNCIA_PROPAGANDA_MAX_BYTES) {
    throw new Error('O anexo é maior que 2 MB.');
  }

  const fileName = montarNomeAnexoDenuncia(
    dados.fileName,
    dados.mimeType,
    dados.kind
  );

  const uploaded = await chamarMediaManagerUpload(
    DENUNCIA_PROPAGANDA_UPLOAD_FOLDER,
    buffer,
    fileName,
    {
      mediaOptions: {
        mimeType: dados.mimeType,
        mediaType: config.mediaType,
      },
      metadataOptions: {
        isPrivate: true,
        isVisitorUpload: true,
        context: {
          origem: 'novo-site-oabjf',
          fluxo: 'denuncia-propaganda-irregular',
          tipo: dados.kind,
          nomeOriginal: dados.fileName,
        },
      },
    }
  );

  const fileUrl = extrairArquivoUrlUpload(uploaded);
  const fileId = text(
    uploaded &&
      (uploaded._id ||
        uploaded.id ||
        uploaded.fileId ||
        uploaded.mediaId)
  );

  if (!fileUrl) {
    throw new Error(
      'O Wix salvou o anexo, mas não retornou uma referência privada válida.'
    );
  }

  return {
    kind: dados.kind,
    originalFileName: dados.fileName,
    // O nome gerado por este fluxo é a identidade do anexo. O FileInfo do
    // Media Manager pode expor propriedades diferentes entre tipos de mídia;
    // não substitua esse nome por aliases da resposta de upload.
    fileName,
    fileUrl,
    fileId,
    mimeType: dados.mimeType,
    sizeBytes: buffer.length,
  };
}

function normalizarReferenciaAnexoDenuncia(value, expectedKind) {
  if (!value || typeof value !== 'object') return null;

  const kind = normalizarTipoAnexoDenuncia(
    value.kind ||
      value.tipo ||
      expectedKind
  );

  return {
    kind,
    originalFileName: text(
      value.originalFileName ||
        value.nomeOriginal ||
        value.originalName
    ),
    fileName: text(
      value.fileName ||
        value.nomeArquivo ||
        value.savedName
    ),
    fileUrl: text(
      value.fileUrl ||
        value.wixFileUrl ||
        value.url
    ),
    fileId: text(
      value.fileId ||
        value.wixFileId ||
        value.id
    ),
    mimeType: text(
      value.mimeType ||
        value.contentType
    ).toLowerCase(),
    sizeBytes: Number(
      value.sizeBytes ||
        value.fileSize ||
        value.tamanhoBytes ||
        0
    ),
  };
}

function validarReferenciaAnexoDenuncia(anexo, expectedKind) {
  if (!anexo) return '';

  const config = getDenunciaMimeConfig(anexo.mimeType);

  if (
    anexo.kind !== expectedKind ||
    !anexo.fileUrl ||
    !anexo.mimeType ||
    !Number.isFinite(anexo.sizeBytes)
  ) {
    return 'A referência do anexo está incompleta.';
  }

  if (!config || config.kind !== expectedKind) {
    return expectedKind === 'video'
      ? 'O vídeo enviado não está em um formato permitido.'
      : 'A imagem enviada não está em um formato permitido.';
  }

  if (
    anexo.sizeBytes <= 0 ||
    anexo.sizeBytes > DENUNCIA_PROPAGANDA_MAX_BYTES
  ) {
    return 'Cada anexo deve ter no máximo 2 MB.';
  }

  return '';
}

function extrairFileIdAnexoDenuncia(fileUrl) {
  const normalized = text(fileUrl);
  const match = normalized.match(
    /^wix:(?:image|video):\/\/v1\/([^/?#]+)/i
  );

  return match && match[1] ? decodeURIComponent(match[1]) : '';
}

async function getFileInfoAnexoDenunciaComRetentativa(fileUrl) {
  let lastError = null;

  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const fileInfo = await mediaManager.getFileInfo(fileUrl);
      const opStatus = text(fileInfo && fileInfo.opStatus).toUpperCase();

      if (!opStatus || opStatus === 'READY') {
        return fileInfo;
      }

      lastError = new Error(
        `O anexo ainda está sendo processado pelo Wix (${opStatus}).`
      );
    } catch (err) {
      lastError = err;
    }

    if (attempt < 7) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }

  throw lastError || new Error('Anexo não encontrado no Media Manager.');
}

async function validarAnexoEnviadoDenuncia(anexo, expectedKind) {
  if (!anexo) return null;

  const referenceError = validarReferenciaAnexoDenuncia(
    anexo,
    expectedKind
  );

  if (referenceError) {
    throw new Error(referenceError);
  }

  const fileInfo = await getFileInfoAnexoDenunciaComRetentativa(
    anexo.fileUrl
  );
  const fileUrl = text(fileInfo && fileInfo.fileUrl) || anexo.fileUrl;
  const fileId =
    text(
      fileInfo &&
        (fileInfo._id ||
          fileInfo.id ||
          fileInfo.fileId ||
          fileInfo.mediaId)
    ) ||
    anexo.fileId ||
    extrairFileIdAnexoDenuncia(fileUrl);
  const mimeType = text(fileInfo && fileInfo.mimeType).toLowerCase();
  const mediaType = text(fileInfo && fileInfo.mediaType).toLowerCase();
  const actualFileName = text(
    fileInfo &&
      (fileInfo.originalFileName ||
        fileInfo.fileName)
  );
  const sizeInBytes = Number(fileInfo && fileInfo.sizeInBytes);
  const isPrivate = fileInfo && fileInfo.isPrivate === true;
  const config = getDenunciaMimeConfig(mimeType);
  const extension = getFileExtension(actualFileName);

  if (!isPrivate) {
    throw new Error('O anexo não foi armazenado como arquivo privado.');
  }

  if (
    !config ||
    config.kind !== expectedKind ||
    (mediaType && mediaType !== config.mediaType)
  ) {
    throw new Error('O tipo real do anexo não corresponde ao arquivo informado.');
  }

  if (
    !extension ||
    !config.extensions.includes(extension) ||
    mimeType !== anexo.mimeType
  ) {
    throw new Error('O formato real do anexo difere do arquivo selecionado.');
  }

  if (
    !Number.isFinite(sizeInBytes) ||
    sizeInBytes <= 0 ||
    sizeInBytes > DENUNCIA_PROPAGANDA_MAX_BYTES
  ) {
    throw new Error('O Wix não confirmou um tamanho válido para o anexo.');
  }

  if (sizeInBytes !== anexo.sizeBytes) {
    throw new Error('O tamanho real do anexo difere do arquivo selecionado.');
  }

  if (
    !actualFileName ||
    !actualFileName
      .toLowerCase()
      .startsWith(`denuncia-${expectedKind}-`)
  ) {
    throw new Error('O anexo confirmado não pertence ao fluxo de denúncias.');
  }

  return {
    kind: expectedKind,
    originalFileName: anexo.originalFileName,
    fileName: actualFileName,
    fileUrl,
    fileId,
    mimeType,
    sizeBytes: sizeInBytes,
  };
}

function serializarAnexoPrivadoDenuncia(anexo) {
  if (!anexo) return '';

  return JSON.stringify({
    tipo: anexo.kind,
    nomeOriginal: anexo.originalFileName,
    nomeArmazenado: anexo.fileName,
    mimeType: anexo.mimeType,
    tamanhoBytes: anexo.sizeBytes,
    fileId: anexo.fileId,
    fileUrl: anexo.fileUrl,
    privado: true,
  });
}

function normalizarPayloadDenunciaPropaganda(payload = {}) {
  return {
    reporter: normalizarTextoLinhaFormulario(
      payload.reporter ||
        payload.denunciante ||
        payload.nome
    ),
    reported: normalizarTextoLinhaFormulario(
      payload.reported ||
        payload.denunciado
    ),
    location: normalizarTextoLinhaFormulario(
      payload.location ||
        payload.local
    ),
    occurrenceDate: normalizeDateIso(
      payload.occurrenceDate ||
        payload.dataOcorrencia ||
        payload.data
    ),
    report: normalizarTextoMultilinhaFormulario(
      payload.report ||
        payload.relato ||
        payload.mensagem
    ),
    image: normalizarReferenciaAnexoDenuncia(
      payload.image ||
        payload.imagem,
      'imagem'
    ),
    video: normalizarReferenciaAnexoDenuncia(
      payload.video,
      'video'
    ),
    website: text(
      payload.website ||
        payload.companyWebsite ||
        payload.siteEmpresa
    ),
    formStartedAt: Number(
      payload.formStartedAt ||
        payload.iniciadoEm ||
        0
    ),
  };
}

function validarPayloadDenunciaPropaganda(dados) {
  const erros = {};

  if (!dados.reporter) {
    erros.reporter = 'Informe o nome do denunciante.';
  } else if (dados.reporter.length < 3) {
    erros.reporter = 'Use pelo menos 3 caracteres.';
  } else if (
    dados.reporter.length > DENUNCIA_PROPAGANDA_LIMITS.reporter
  ) {
    erros.reporter =
      `Use no máximo ${DENUNCIA_PROPAGANDA_LIMITS.reporter} caracteres.`;
  }

  if (!dados.reported) {
    erros.reported = 'Informe quem está sendo denunciado.';
  } else if (dados.reported.length < 2) {
    erros.reported = 'Use pelo menos 2 caracteres.';
  } else if (
    dados.reported.length > DENUNCIA_PROPAGANDA_LIMITS.reported
  ) {
    erros.reported =
      `Use no máximo ${DENUNCIA_PROPAGANDA_LIMITS.reported} caracteres.`;
  }

  if (!dados.location) {
    erros.location = 'Informe o local da ocorrência ou divulgação.';
  } else if (dados.location.length < 2) {
    erros.location = 'Informe um local válido.';
  } else if (
    dados.location.length > DENUNCIA_PROPAGANDA_LIMITS.location
  ) {
    erros.location =
      `Use no máximo ${DENUNCIA_PROPAGANDA_LIMITS.location} caracteres.`;
  }

  const hoje = dateToIso(new Date());

  if (
    !dados.occurrenceDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dados.occurrenceDate)
  ) {
    erros.occurrenceDate = 'Informe uma data válida.';
  } else if (dados.occurrenceDate > hoje) {
    erros.occurrenceDate = 'A data da ocorrência não pode estar no futuro.';
  }

  if (!dados.report) {
    erros.report = 'Descreva a situação denunciada.';
  } else if (dados.report.length < 20) {
    erros.report = 'Use pelo menos 20 caracteres no relato.';
  } else if (
    dados.report.length > DENUNCIA_PROPAGANDA_LIMITS.report
  ) {
    erros.report =
      `Use no máximo ${DENUNCIA_PROPAGANDA_LIMITS.report} caracteres.`;
  }

  const imageError = validarReferenciaAnexoDenuncia(
    dados.image,
    'imagem'
  );
  const videoError = validarReferenciaAnexoDenuncia(
    dados.video,
    'video'
  );

  if (imageError) erros.image = imageError;
  if (videoError) erros.video = videoError;

  return erros;
}

function deveIgnorarDenunciaPropagandaComoSpam(dados) {
  return Boolean(dados.website) || formularioPreenchidoRapido(dados);
}

async function criarSubmissaoDenunciaPropaganda(
  dados,
  imagemPrivada,
  videoPrivado
) {
  const targets = FORM_DENUNCIA_PROPAGANDA.targets;
  const submissions = {
    [targets.reporter]: dados.reporter,
    [targets.reported]: dados.reported,
    [targets.location]: dados.location,
    [targets.occurrenceDate]: dados.occurrenceDate,
    [targets.report]: dados.report,
    [targets.privateImage]:
      serializarAnexoPrivadoDenuncia(imagemPrivada),
    [targets.privateVideo]:
      serializarAnexoPrivadoDenuncia(videoPrivado),
  };

  return criarSubmissaoFormularioElevada(
    {
      formId: FORM_DENUNCIA_PROPAGANDA.id,
      submissions,
    },
    {}
  );
}


function isAllowedCadastroOrigin(origin) {
  const normalized = normalizeOrigin(origin);

  if (!normalized) return true;
  if (CADASTRO_ALLOWED_ORIGINS.includes(normalized)) return true;

  try {
    const url = new URL(normalized);

    return (
      url.protocol === 'https:' &&
      (url.hostname === 'site-oabjf.pages.dev' ||
        url.hostname.endsWith('.site-oabjf.pages.dev'))
    );
  } catch (err) {
    return false;
  }
}

function normalizarTextoComparacaoFormulario(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarTextoLinhaFormulario(value) {
  return text(value).replace(/\s+/g, ' ');
}

function normalizarTextoMultilinhaFormulario(value) {
  return text(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n');
}

function normalizarListaFormulario(value) {
  const source = Array.isArray(value)
    ? value
    : text(value)
      ? text(value).split(',')
      : [];
  const unique = new Map();

  for (const item of source) {
    const normalized = normalizarTextoLinhaFormulario(item);
    const key = normalizarTextoComparacaoFormulario(normalized);

    if (normalized && key && !unique.has(key)) {
      unique.set(key, normalized);
    }
  }

  return Array.from(unique.values());
}

function normalizarValorPermitidoFormulario(value, allowedValues) {
  const key = normalizarTextoComparacaoFormulario(value);

  if (!key) return '';

  return (
    allowedValues.find(
      (allowed) => normalizarTextoComparacaoFormulario(allowed) === key
    ) || ''
  );
}

function normalizarListaPermitidaFormulario(
  value,
  allowedValues,
  maxItems = allowedValues.length
) {
  return normalizarListaFormulario(value)
    .map((item) => normalizarValorPermitidoFormulario(item, allowedValues))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizarUfFormulario(value) {
  const uf = text(value).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  return UFS_BRASIL.includes(uf) ? uf : '';
}

function normalizarOabCadastro(value) {
  const raw = text(value)
    .toUpperCase()
    .replace(/^OAB\s*\/?\s*/i, '')
    .replace(/^([A-Z]{2})\s*[-/]?\s*/i, '$1/')
    .replace(/\s+/g, '');
  const stateFirst = raw.match(/^([A-Z]{2})\/?([0-9.\-]+)$/);
  const numberFirst = raw.match(/^([0-9.\-]+)(?:\/([A-Z]{2}))?$/);
  let digits = '';
  let uf = '';

  if (stateFirst) {
    uf = stateFirst[1];
    digits = stateFirst[2].replace(/\D/g, '');
  } else if (numberFirst) {
    digits = numberFirst[1].replace(/\D/g, '');
    uf = text(numberFirst[2]).toUpperCase();
  }

  if (digits.length < 3 || digits.length > 10) return '';
  if (uf && !UFS_BRASIL.includes(uf)) return '';

  return uf ? `${digits}/${uf}` : digits;
}

function normalizarUrlCadastro(value) {
  const raw = text(value);

  if (!raw) return '';

  return normalizarUrlPublica(raw);
}

function getOportunidadeResumeMimeConfig(mimeType) {
  return OPORTUNIDADE_RESUME_MIME_CONFIG[text(mimeType).toLowerCase()] || null;
}

function inferOportunidadeResumeMimeType(fileName) {
  const extension = getFileExtension(fileName);

  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  return '';
}

function normalizarPayloadCurriculoOportunidade(value) {
  if (!value || typeof value !== 'object') {
    return {
      fileName: '',
      mimeType: '',
      fileUrl: '',
      sizeBytes: 0,
    };
  }

  const fileName = text(value.fileName || value.name || value.nomeArquivo);
  const mimeType = text(
    value.mimeType ||
      value.contentType ||
      inferOportunidadeResumeMimeType(fileName)
  ).toLowerCase();
  const fileUrl = text(value.fileUrl || value.wixFileUrl || value.url);
  const sizeBytes = Number(value.sizeBytes || value.fileSize || 0);

  return {
    fileName,
    mimeType,
    fileUrl,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
  };
}

function normalizarPayloadPrepararCurriculo(payload = {}) {
  const fileName = text(payload.fileName || payload.name || payload.nomeArquivo);
  const mimeType = text(
    payload.mimeType ||
      payload.contentType ||
      inferOportunidadeResumeMimeType(fileName)
  ).toLowerCase();
  const sizeBytes = Number(payload.sizeBytes || payload.fileSize || 0);

  return {
    email: normalizeEmail(payload.email),
    fileName,
    mimeType,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
    website: text(
      payload.website || payload.companyWebsite || payload.siteEmpresa
    ),
    formStartedAt: Number(payload.formStartedAt || payload.iniciadoEm || 0),
  };
}

function normalizarPayloadCadastroCorrespondente(payload = {}) {
  return {
    name: normalizarTextoLinhaFormulario(payload.name || payload.nomeCompleto),
    oab: normalizarOabCadastro(payload.oab || payload.numeroOab),
    phone: normalizarTelefoneContato(payload.phone || payload.telefone),
    email: normalizeEmail(payload.email || payload.eMail),
    address: normalizarTextoLinhaFormulario(payload.address || payload.endereco),
    city: normalizarTextoLinhaFormulario(payload.city || payload.cidade),
    uf: normalizarUfFormulario(payload.uf),
    areas: normalizarListaPermitidaFormulario(
      payload.areas || payload.areaDeAtuacao,
      CORRESPONDENTE_AREAS,
      CORRESPONDENTE_LIMITS.areas
    ),
    acceptedTerms:
      payload.acceptedTerms === true ||
      payload.termsAccepted === true ||
      payload.aceiteTermos === true,
    website: text(
      payload.website || payload.companyWebsite || payload.siteEmpresa
    ),
    formStartedAt: Number(payload.formStartedAt || payload.iniciadoEm || 0),
  };
}

function normalizarPayloadCadastroOportunidade(payload = {}) {
  const externalUrlRaw = text(
    payload.externalUrl ||
      payload.siteUrl ||
      payload.linkedinUrl ||
      payload.currculo
  );

  return {
    title: normalizarTextoLinhaFormulario(payload.title || payload.titulo),
    contactName: normalizarTextoLinhaFormulario(
      payload.contactName || payload.nomePessoaOuEmpresa || payload.responsavel
    ),
    phone: normalizarTelefoneContato(payload.phone || payload.telefone),
    email: normalizeEmail(payload.email),
    city: normalizarTextoLinhaFormulario(payload.city || payload.cidade),
    uf: normalizarUfFormulario(payload.uf),
    area: normalizarValorPermitidoFormulario(
      payload.area,
      OPORTUNIDADE_AREAS
    ),
    types: normalizarListaPermitidaFormulario(
      payload.types || payload.tipo,
      OPORTUNIDADE_TIPOS,
      OPORTUNIDADE_LIMITS.types
    ),
    modalities: normalizarListaPermitidaFormulario(
      payload.modalities || payload.modalidade,
      OPORTUNIDADE_MODALIDADES,
      OPORTUNIDADE_LIMITS.modalities
    ),
    description: normalizarTextoMultilinhaFormulario(
      payload.description || payload.descrioCurta || payload.descricao
    ),
    externalUrlRaw,
    externalUrl: normalizarUrlCadastro(externalUrlRaw),
    resume: normalizarPayloadCurriculoOportunidade(
      payload.resume || payload.curriculo
    ),
    acceptedTerms:
      payload.acceptedTerms === true ||
      payload.termsAccepted === true ||
      payload.aceiteTermosDeUso === true,
    website: text(
      payload.website || payload.companyWebsite || payload.siteEmpresa
    ),
    formStartedAt: Number(payload.formStartedAt || payload.iniciadoEm || 0),
  };
}

function validarPayloadCadastroCorrespondente(dados) {
  const erros = {};
  const phoneDigits = dados.phone.replace(/\D/g, '');

  if (!dados.name) {
    erros.name = 'Informe seu nome completo.';
  } else if (dados.name.length < 3) {
    erros.name = 'Use pelo menos 3 caracteres.';
  } else if (dados.name.length > CORRESPONDENTE_LIMITS.name) {
    erros.name = `Use no máximo ${CORRESPONDENTE_LIMITS.name} caracteres.`;
  }

  if (!dados.oab) {
    erros.oab = 'Informe um número de OAB válido.';
  } else if (dados.oab.length > CORRESPONDENTE_LIMITS.oab) {
    erros.oab = `Use no máximo ${CORRESPONDENTE_LIMITS.oab} caracteres.`;
  }

  if (!dados.phone) {
    erros.phone = 'Informe seu telefone.';
  } else if (
    dados.phone.length > CORRESPONDENTE_LIMITS.phone ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 13
  ) {
    erros.phone = 'Informe um telefone válido com DDD.';
  }

  if (!dados.email) {
    erros.email = 'Informe seu e-mail.';
  } else if (
    dados.email.length > CORRESPONDENTE_LIMITS.email ||
    !isValidEmail(dados.email)
  ) {
    erros.email = 'Informe um e-mail válido.';
  }

  if (!dados.address) {
    erros.address = 'Informe seu endereço profissional.';
  } else if (dados.address.length < 5) {
    erros.address = 'Informe um endereço mais completo.';
  } else if (dados.address.length > CORRESPONDENTE_LIMITS.address) {
    erros.address = `Use no máximo ${CORRESPONDENTE_LIMITS.address} caracteres.`;
  }

  if (!dados.city) {
    erros.city = 'Informe a cidade.';
  } else if (dados.city.length < 2) {
    erros.city = 'Informe uma cidade válida.';
  } else if (dados.city.length > CORRESPONDENTE_LIMITS.city) {
    erros.city = `Use no máximo ${CORRESPONDENTE_LIMITS.city} caracteres.`;
  }

  if (!dados.uf) {
    erros.uf = 'Selecione a UF.';
  }

  if (!dados.areas.length) {
    erros.areas = 'Selecione pelo menos uma área de atuação.';
  }

  if (!dados.acceptedTerms) {
    erros.acceptedTerms = 'Confirme a ciência e o aceite dos termos.';
  }

  return erros;
}

function validarCurriculoOportunidade(resume) {
  const hasAnyValue = Boolean(
    resume.fileName || resume.mimeType || resume.fileUrl || resume.sizeBytes
  );

  if (!hasAnyValue) return '';

  const config = getOportunidadeResumeMimeConfig(resume.mimeType);
  const extension = getFileExtension(resume.fileName);

  if (!resume.fileName || !resume.mimeType || !resume.fileUrl) {
    return 'O arquivo de currículo está incompleto. Selecione-o novamente.';
  }

  if (!config) {
    return 'Envie o currículo em PDF, DOC ou DOCX.';
  }

  if (!extension || !config.extensions.includes(extension)) {
    return 'A extensão do currículo não corresponde ao formato do arquivo.';
  }

  if (!/^wix:document:\/\/v1\//i.test(resume.fileUrl)) {
    return 'A referência do currículo é inválida. Selecione o arquivo novamente.';
  }

  if (
    resume.sizeBytes <= 0 ||
    resume.sizeBytes > OPORTUNIDADE_RESUME_MAX_BYTES
  ) {
    return 'O currículo deve ter no máximo 5 MB.';
  }

  return '';
}

function validarPayloadPrepararCurriculo(dados) {
  const erros = {};
  const config = getOportunidadeResumeMimeConfig(dados.mimeType);
  const extension = getFileExtension(dados.fileName);

  if (!dados.email || !isValidEmail(dados.email)) {
    erros.email = 'Informe um e-mail válido antes de enviar o currículo.';
  }

  if (!dados.fileName || dados.fileName.length > 180) {
    erros.resume = 'O nome do arquivo é inválido.';
  } else if (
    !config ||
    !extension ||
    !config.extensions.includes(extension)
  ) {
    erros.resume = 'Envie o currículo em PDF, DOC ou DOCX.';
  }

  if (
    dados.sizeBytes <= 0 ||
    dados.sizeBytes > OPORTUNIDADE_RESUME_MAX_BYTES
  ) {
    erros.resume = 'O currículo deve ter no máximo 5 MB.';
  }

  return erros;
}

function validarPayloadCadastroOportunidade(dados) {
  const erros = {};
  const phoneDigits = dados.phone.replace(/\D/g, '');

  if (!dados.title) {
    erros.title = 'Informe o título da oportunidade.';
  } else if (dados.title.length < 3) {
    erros.title = 'Use pelo menos 3 caracteres.';
  } else if (dados.title.length > OPORTUNIDADE_LIMITS.title) {
    erros.title = `Use no máximo ${OPORTUNIDADE_LIMITS.title} caracteres.`;
  }

  if (!dados.contactName) {
    erros.contactName = 'Informe a pessoa ou organização responsável.';
  } else if (dados.contactName.length < 2) {
    erros.contactName = 'Use pelo menos 2 caracteres.';
  } else if (dados.contactName.length > OPORTUNIDADE_LIMITS.contactName) {
    erros.contactName = `Use no máximo ${OPORTUNIDADE_LIMITS.contactName} caracteres.`;
  }

  if (!dados.phone) {
    erros.phone = 'Informe um telefone de contato.';
  } else if (
    dados.phone.length > OPORTUNIDADE_LIMITS.phone ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 13
  ) {
    erros.phone = 'Informe um telefone válido com DDD.';
  }

  if (!dados.email) {
    erros.email = 'Informe um e-mail de contato.';
  } else if (
    dados.email.length > OPORTUNIDADE_LIMITS.email ||
    !isValidEmail(dados.email)
  ) {
    erros.email = 'Informe um e-mail válido.';
  }

  if (!dados.city) {
    erros.city = 'Informe a cidade.';
  } else if (dados.city.length < 2) {
    erros.city = 'Informe uma cidade válida.';
  } else if (dados.city.length > OPORTUNIDADE_LIMITS.city) {
    erros.city = `Use no máximo ${OPORTUNIDADE_LIMITS.city} caracteres.`;
  }

  if (!dados.uf) {
    erros.uf = 'Selecione a UF.';
  }

  if (!dados.area) {
    erros.area = 'Selecione a área principal.';
  }

  if (!dados.types.length) {
    erros.types = 'Selecione pelo menos um tipo de oportunidade.';
  }

  if (!dados.modalities.length) {
    erros.modalities = 'Selecione pelo menos uma modalidade.';
  }

  if (!dados.description) {
    erros.description = 'Descreva a oportunidade.';
  } else if (dados.description.length < 20) {
    erros.description = 'Use pelo menos 20 caracteres.';
  } else if (dados.description.length > OPORTUNIDADE_LIMITS.description) {
    erros.description = `Use no máximo ${OPORTUNIDADE_LIMITS.description} caracteres.`;
  }

  if (dados.externalUrlRaw) {
    if (dados.externalUrlRaw.length > OPORTUNIDADE_LIMITS.externalUrl) {
      erros.externalUrl = `Use no máximo ${OPORTUNIDADE_LIMITS.externalUrl} caracteres.`;
    } else if (!dados.externalUrl) {
      erros.externalUrl = 'Informe uma URL válida, começando com https://.';
    }
  }

  const resumeError = validarCurriculoOportunidade(dados.resume);

  if (resumeError) {
    erros.resume = resumeError;
  }

  if (!dados.acceptedTerms) {
    erros.acceptedTerms = 'Confirme a ciência e o aceite dos termos.';
  }

  return erros;
}

function formularioPreenchidoRapido(dados, now = Date.now()) {
  const startedAt = Number(dados.formStartedAt);

  if (!Number.isFinite(startedAt) || startedAt <= 0) return false;

  return now - startedAt < FORMULARIO_MIN_DURATION_MS;
}

function deveIgnorarCadastroComoSpam(dados) {
  return Boolean(dados.website) || formularioPreenchidoRapido(dados);
}

function limparRateLimitCadastro(store, now = Date.now()) {
  for (const [key, entry] of store.entries()) {
    if (
      !entry ||
      !Number.isFinite(entry.startedAt) ||
      now - entry.startedAt >= CADASTRO_RATE_LIMIT_WINDOW_MS
    ) {
      store.delete(key);
    }
  }
}

function consumirRateLimitCadastro(
  store,
  request,
  email,
  maxAttempts = CADASTRO_RATE_LIMIT_MAX
) {
  const now = Date.now();
  limparRateLimitCadastro(store, now);

  const ip = getClientIp(request);
  const key = `${ip || 'sem-ip'}|${normalizeEmail(email) || 'sem-email'}`;
  const current = store.get(key);

  if (
    !current ||
    now - current.startedAt >= CADASTRO_RATE_LIMIT_WINDOW_MS
  ) {
    store.set(key, { startedAt: now, count: 1 });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maxAttempts) {
    const remaining = Math.max(
      1,
      CADASTRO_RATE_LIMIT_WINDOW_MS - (now - current.startedAt)
    );

    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(remaining / 1000),
    };
  }

  current.count += 1;
  store.set(key, current);

  return { allowed: true, retryAfterSeconds: 0 };
}

function gerarIdIgnoradoFormulario(prefix) {
  return `${prefix}-ignorado-${Date.now().toString(36)}`;
}

async function garantirCadastroNaoPublicado(collectionId, createdItem) {
  const itemId = text(createdItem && (createdItem._id || createdItem.id));
  const publishStatus = text(
    createdItem && createdItem._publishStatus
  ).toUpperCase();

  if (itemId && publishStatus === 'PUBLISHED') {
    try {
      await wixData.remove(collectionId, itemId, { suppressAuth: true });
    } catch (removeError) {
      console.error(
        `Falha ao remover cadastro publicado automaticamente em ${collectionId}:`,
        removeError
      );
    }

    throw new Error(
      `A coleção ${collectionId} publicou o cadastro automaticamente. O item foi removido por segurança.`
    );
  }

  if (!itemId) {
    throw new Error(`O Wix não retornou o ID do cadastro em ${collectionId}.`);
  }

  return itemId;
}

async function criarCadastroCorrespondente(dados) {
  const created = await wixData.insert(
    COL.CORRESPONDENTES,
    {
      nomeCompleto: dados.name,
      oab: dados.oab,
      telefone: dados.phone,
      eMail: dados.email,
      endereco: dados.address,
      cidade: dados.city,
      uf: dados.uf,
      areaDeAtuacao: dados.areas,
      aceiteTermos: true,
      portalStatus: PUBLICACOES_PORTAL_STATUS.PENDENTE,
    },
    { suppressAuth: true }
  );

  return garantirCadastroNaoPublicado(COL.CORRESPONDENTES, created);
}

function montarNomeCurriculoOportunidade(fileName, mimeType) {
  const config = getOportunidadeResumeMimeConfig(mimeType);
  const originalExtension = getFileExtension(fileName);
  const extension =
    config && config.extensions.includes(originalExtension)
      ? originalExtension
      : config
        ? config.defaultExtension
        : originalExtension || 'bin';
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const base = sanitizeFileBaseName(fileName || 'curriculo');

  return `oportunidade-${timestamp}-${gerarUploadToken()}-${base}.${extension}`;
}

async function prepararUploadCurriculoOportunidade(dados) {
  const fileName = montarNomeCurriculoOportunidade(
    dados.fileName,
    dados.mimeType
  );
  const result = await mediaManager.getUploadUrl(
    OPORTUNIDADE_RESUME_FOLDER,
    {
      mediaOptions: {
        mimeType: dados.mimeType,
        mediaType: 'document',
      },
      metadataOptions: {
        isPrivate: true,
        isVisitorUpload: true,
        context: {
          origem: 'novo-site-oabjf',
          fluxo: 'cadastro-oportunidades',
          nomeOriginal: dados.fileName,
        },
      },
    }
  );
  const uploadUrl = text(result && result.uploadUrl);

  if (!uploadUrl) {
    throw new Error('O Wix não retornou a URL de upload do currículo.');
  }

  return { uploadUrl, fileName };
}

async function getFileInfoCurriculoComRetentativa(fileUrl) {
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const fileInfo = await mediaManager.getFileInfo(fileUrl);
      const opStatus = text(fileInfo && fileInfo.opStatus).toUpperCase();

      if (!opStatus || opStatus === 'READY') {
        return fileInfo;
      }

      lastError = new Error(
        `O currículo ainda está sendo processado pelo Wix (${opStatus}).`
      );
    } catch (err) {
      lastError = err;
    }

    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  throw lastError || new Error('Currículo não encontrado no Media Manager.');
}

async function validarCurriculoEnviadoOportunidade(resume) {
  if (!resume || !resume.fileUrl) return '';

  const fileInfo = await getFileInfoCurriculoComRetentativa(resume.fileUrl);
  const fileUrl = text(fileInfo && fileInfo.fileUrl) || resume.fileUrl;
  const mimeType = text(fileInfo && fileInfo.mimeType).toLowerCase();
  const mediaType = text(fileInfo && fileInfo.mediaType).toLowerCase();
  const originalFileName = text(
    fileInfo && (fileInfo.originalFileName || fileInfo.fileName)
  );
  const sizeInBytes = Number(fileInfo && fileInfo.sizeInBytes);
  const isPrivate = fileInfo && fileInfo.isPrivate === true;
  const config = getOportunidadeResumeMimeConfig(mimeType);
  const extension = getFileExtension(originalFileName);

  if (!/^wix:document:\/\/v1\//i.test(fileUrl)) {
    throw new Error('A referência do currículo não é um documento Wix.');
  }

  if (!isPrivate) {
    throw new Error('O currículo não foi armazenado como arquivo privado.');
  }

  if (mediaType && mediaType !== 'document') {
    throw new Error('O arquivo enviado não é um documento.');
  }

  if (!config || !extension || !config.extensions.includes(extension)) {
    throw new Error('O currículo enviado não está em um formato permitido.');
  }

  if (mimeType !== text(resume.mimeType).toLowerCase()) {
    throw new Error('O tipo real do currículo difere do formato informado.');
  }

  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
    throw new Error('O Wix não confirmou o tamanho do currículo enviado.');
  }

  if (sizeInBytes > OPORTUNIDADE_RESUME_MAX_BYTES) {
    throw new Error('O currículo enviado é maior que 5 MB.');
  }

  if (resume.sizeBytes > 0 && sizeInBytes !== resume.sizeBytes) {
    throw new Error('O tamanho real do currículo difere do arquivo selecionado.');
  }

  if (!/^oportunidade-\d{14}-[a-z0-9]+-/i.test(originalFileName)) {
    throw new Error('O currículo não pertence ao fluxo público de oportunidades.');
  }

  if (resume.fileName !== originalFileName) {
    throw new Error('O currículo confirmado não corresponde ao arquivo enviado.');
  }

  return fileUrl;
}

function calcularVencimentoOportunidade() {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + OPORTUNIDADE_EXPIRATION_DAYS);
  return expiresAt;
}

async function criarCadastroOportunidade(dados, curriculoUrl) {
  const item = {
    title: dados.title,
    nomePessoaOuEmpresa: dados.contactName,
    telefone: dados.phone,
    email: dados.email,
    cidade: dados.city,
    uf: dados.uf,
    area: dados.area,
    tipo: dados.types,
    modalidade: dados.modalities,
    descrioCurta: dados.description,
    aceiteTermosDeUso: true,
    vencimento: calcularVencimentoOportunidade(),
    status: 'Pendente',
    portalStatus: PUBLICACOES_PORTAL_STATUS.PENDENTE,
  };

  if (dados.externalUrl) {
    item.currculo = dados.externalUrl;
  }

  if (curriculoUrl) {
    item.curriculo = curriculoUrl;
  }

  const created = await wixData.insert(
    COL.OPORTUNIDADES,
    item,
    { suppressAuth: true }
  );

  return garantirCadastroNaoPublicado(COL.OPORTUNIDADES, created);
}

function mapSalaApoio(item = {}) {
  const slug = text(item.slug);
  const title = text(item.nomeDaSala);
  const address = text(item.endereco);
  const phone = text(item.telefone);
  const { city, uf } = splitCidadeUf(item.cidadeUf);

  return {
    id: slug,
    slug,
    title,
    city,
    uf,
    address,
    phone,
    routeUrl: normalizarUrlRotaSala(
      item.rotas,
      address,
      city,
      uf
    ),
  };
}

function filtrarSalaApoioValida(item) {
  return !!item.id && !!item.title;
}

function normalizarSlugPaginaInstitucional(value) {
  return text(value)
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9-]/g, '');
}

function normalizarSecaoPaginaInstitucional(value) {
  return text(value)
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9-]/g, '');
}

function sanitizarHtmlInstitucional(value) {
  let html = value === null || value === undefined ? '' : String(value);

  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<(script|style|iframe|object|embed|form|input|button|textarea|select|option|link|meta)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ''
    )
    .replace(
      /<(script|style|iframe|object|embed|form|input|button|textarea|select|option|link|meta)\b[^>]*\/?\s*>/gi,
      ''
    )
    .replace(/\s(on\w+|style)\s*=\s*(["'])[^"']*\2/gi, '')
    .replace(
      /\s(href|src)\s*=\s*(["'])\s*(javascript:|data:text\/html)[^"']*\2/gi,
      ''
    );

  return html.trim();
}

function normalizarImagemPaginaInstitucional(value) {
  const candidate =
    value && typeof value === 'object'
      ? value.url || value.src || value.fileUrl || value.uri
      : value;

  const raw = text(candidate);

  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const wixImageMatch = raw.match(/^wix:image:\/\/v1\/([^/]+)\//i);

  if (wixImageMatch && wixImageMatch[1]) {
    return `https://static.wixstatic.com/media/${wixImageMatch[1]}`;
  }

  return '';
}

function normalizarTipoAtendimentoPagina(value) {
  const normalized = text(value).toUpperCase();

  return ['EMERGENCIA', 'AGENDAMENTO'].includes(normalized)
    ? normalized
    : '';
}

function mapPaginaInstitucional(item = {}) {
  const ordemNumero = Number(item.ordem);
  const titulo = text(item.titulo);
  const chamada = text(item.chamada);

  return {
    id: text(item._id),
    slug: normalizarSlugPaginaInstitucional(item.slug),
    section: text(item.secao),
    title: titulo,
    intro: chamada,
    contentHtml: sanitizarHtmlInstitucional(item.conteudo),
    imageUrl: normalizarImagemPaginaInstitucional(item.imagem),
    imageAlt: text(item.imagemAlt),
    navigationLabel: text(item.rotuloNavegacao) || titulo,
    order: Number.isFinite(ordemNumero) ? ordemNumero : 0,
    seoTitle: text(item.seoTitulo) || titulo,
    seoDescription: text(item.seoDescricao) || chamada,
    serviceType: normalizarTipoAtendimentoPagina(item.tipoAtendimento) || undefined,
    primaryPhone: text(item.telefonePrimario),
    secondaryPhone: text(item.telefoneSecundario),
    whatsapp: text(item.whatsapp),
    scheduleHtml: sanitizarHtmlInstitucional(item.horario),
    responsibleName: text(item.responsavelNome),
    responsibleRole: text(item.responsavelCargo),
    responsibleOab: text(item.responsavelOab),
    responsiblePhotoUrl: normalizarImagemPaginaInstitucional(item.responsavelFoto),
    responsiblePhotoAlt: text(item.responsavelFotoAlt),
    secondaryResponsibleName: text(item.responsavelSecundarioNome),
    secondaryResponsibleRole: text(item.responsavelSecundarioCargo),
    secondaryResponsibleOab: text(item.responsavelSecundarioOab),
    secondaryResponsiblePhotoUrl: normalizarImagemPaginaInstitucional(
      item.responsavelSecundarioFoto
    ),
    secondaryResponsiblePhotoAlt: text(item.responsavelSecundarioFotoAlt),
    teamTitle: text(item.equipeTitulo),
    teamHtml: sanitizarHtmlInstitucional(item.equipe),
  };
}

function filtrarPaginaInstitucionalValida(item) {
  return !!item.slug && !!item.section && !!item.title;
}

function normalizarSlugPublico(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

function normalizarListaTextoPublica(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const unique = new Map();

  for (const item of values) {
    const cleaned = text(item).replace(/\s+/g, ' ');

    if (!cleaned) continue;

    const key = cleaned
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  }

  return Array.from(unique.values());
}

function normalizarUrlPublica(value) {
  let raw = text(value);

  if (!raw) return '';

  if (/^www\./i.test(raw)) {
    raw = `https://${raw}`;
  }

  if (!/^https?:\/\//i.test(raw)) {
    return '';
  }

  if (raw.includes('@') && !/https?:\/\/[^/]*linkedin\.com/i.test(raw)) {
    return '';
  }

  try {
    const parsed = new URL(raw);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return '';
    }

    parsed.username = '';
    parsed.password = '';

    return parsed.toString();
  } catch (_) {
    return '';
  }
}

function normalizarEmailPublico(value) {
  const email = text(value).toLowerCase();

  if (!email || email.length > 254) return '';

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizarDataIsoPublica(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function extrairSlugConvenio(item = {}) {
  const rawPath = text(item['link-convenios-v2-title']);
  const rawSegment = rawPath
    ? rawPath.split('?')[0].split('#')[0].split('/').filter(Boolean).pop()
    : '';
  let decodedSegment = rawSegment || '';

  try {
    decodedSegment = decodeURIComponent(decodedSegment);
  } catch (_) {
    decodedSegment = rawSegment || '';
  }

  return (
    normalizarSlugPublico(decodedSegment) ||
    normalizarSlugPublico(item.title) ||
    text(item._id).slice(0, 12)
  );
}

function garantirSlugsUnicos(items) {
  const counts = new Map();

  for (const item of items) {
    counts.set(item.slug, (counts.get(item.slug) || 0) + 1);
  }

  return items.map((item) => {
    if ((counts.get(item.slug) || 0) <= 1) {
      return item;
    }

    return {
      ...item,
      slug: `${item.slug}-${item.id.slice(0, 8)}`,
    };
  });
}

function mapConvenioPublico(item = {}) {
  const desconto = Number(item.desconto);
  const legacyPathRaw = text(item['link-convenios-v2-title']);
  const legacyPath = legacyPathRaw.startsWith('/') ? legacyPathRaw : '';

  return {
    id: text(item._id),
    slug: extrairSlugConvenio(item),
    name: text(item.title).replace(/\s+/g, ' '),
    segments: normalizarListaTextoPublica(item.segmento),
    description: text(item.descricao),
    discount:
      Number.isFinite(desconto) && desconto > 0 ? desconto : null,
    logoUrl: normalizarImagemPaginaInstitucional(item.logo),
    phone: text(item.telefone),
    contact: text(item.contato),
    address: text(item.endereco),
    websiteUrl: normalizarUrlPublica(item.site2 || item.url),
    instagramUrl: normalizarUrlPublica(item.instagram2),
    legacyPath,
    updatedAt: normalizarDataIsoPublica(item._updatedDate),
  };
}

function filtrarConvenioPublicoValido(item) {
  return !!item.id && !!item.slug && !!item.name;
}

function mapCorrespondentePublico(item = {}) {
  return {
    id: text(item._id),
    name: text(item.nomeCompleto).replace(/\s+/g, ' '),
    phone: text(item.telefone),
    email: normalizarEmailPublico(item.eMail),
    areas: normalizarListaTextoPublica(item.areaDeAtuacao),
    city: text(item.cidade).replace(/\s+/g, ' '),
    uf: text(item.uf).toUpperCase().slice(0, 2),
  };
}

function filtrarCorrespondentePublicoValido(item) {
  return !!item.id && !!item.name && item.areas.length > 0;
}

function mapOportunidadePublica(item = {}) {
  return {
    id: text(item._id),
    title: text(item.title).replace(/\s+/g, ' '),
    types: normalizarListaTextoPublica(item.tipo),
    area: text(item.area),
    modalities: normalizarListaTextoPublica(item.modalidade),
    city: text(item.cidade).replace(/\s+/g, ' '),
    uf: text(item.uf).toUpperCase().slice(0, 2),
    description: text(item.descrioCurta),
    contactName: text(item.nomePessoaOuEmpresa).replace(/\s+/g, ' '),
    phone: text(item.telefone),
    email: normalizarEmailPublico(item.email),
    externalUrl: normalizarUrlPublica(item.currculo),
    expiresAt: normalizarDataIsoPublica(item.vencimento),
    publishedAt: normalizarDataIsoPublica(
      item._publishDate || item._createdDate
    ),
  };
}

function filtrarOportunidadePublicaValida(item) {
  return !!item.id && !!item.title && !!item.expiresAt;
}

async function carregarConveniosPublicos() {
  const cmsItems = await consultarTodosItensWix(() =>
    wixData
      .query(COL.CONVENIOS)
      .hasSome('situao', ['Ativo'])
      .ascending('title')
  );

  const items = garantirSlugsUnicos(
    cmsItems
      .map(mapConvenioPublico)
      .filter(filtrarConvenioPublicoValido)
  );

  return items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function carregarCorrespondentesPublicos() {
  const cmsItems = await consultarTodosItensWix(() =>
    wixData
      .query(COL.CORRESPONDENTES)
      .eq('_publishStatus', 'PUBLISHED')
      .eq('aceiteTermos', true)
      .ascending('nomeCompleto')
  );

  return cmsItems
    .map(mapCorrespondentePublico)
    .filter(filtrarCorrespondentePublicoValido)
    .sort((a, b) => {
      const cityCompare = a.city.localeCompare(b.city, 'pt-BR');

      if (cityCompare !== 0) return cityCompare;

      return a.name.localeCompare(b.name, 'pt-BR');
    });
}

async function carregarOportunidadesPublicas() {
  const now = new Date();
  const cmsItems = await consultarTodosItensWix(() =>
    wixData
      .query(COL.OPORTUNIDADES)
      .eq('_publishStatus', 'PUBLISHED')
      .eq('aceiteTermosDeUso', true)
      .ge('vencimento', now)
      .descending('_createdDate')
  );

  return cmsItems
    .map(mapOportunidadePublica)
    .filter(filtrarOportunidadePublicaValida)
    .sort((a, b) => {
      const publishedCompare =
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime();

      if (publishedCompare !== 0) return publishedCompare;

      return a.title.localeCompare(b.title, 'pt-BR');
    });
}


const ORDEM_PAPEL_INSTITUCIONAL = {
  PRESIDENTE: 10,
  VICE_PRESIDENTE: 20,
  SECRETARIO_GERAL: 30,
  SECRETARIO: 30,
  SECRETARIO_GERAL_ADJUNTO: 40,
  SECRETARIO_ADJUNTO: 40,
  DIRETOR_TESOUREIRO: 50,
  DIRETOR: 50,
  DIRETOR_TESOUREIRO_ADJUNTO: 60,
  DIRETOR_INSTITUCIONAL: 70,
  CONSELHEIRO: 80,
  MEMBRO: 100,
};

function normalizarTipoOrgaoInstitucional(value) {
  const normalized = text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z_]/g, '');

  const aliases = {
    DIRETORIA: 'DIRETORIA',
    CONSELHO: 'CONSELHO',
    COMISSAO: 'COMISSAO',
    COMISSOES: 'COMISSAO',
    NUCLEO: 'NUCLEO',
    NUCLEOS: 'NUCLEO',
  };

  return aliases[normalized] || '';
}

function mapGestaoInstitucional(item = {}) {
  const anoInicio = Number(item.anoInicio);
  const anoFim = Number(item.anoFim);

  return {
    id: text(item._id),
    slug: normalizarSlugPaginaInstitucional(item.slug),
    title: text(item.titulo),
    description: text(item.descricao),
    startYear: Number.isFinite(anoInicio) ? anoInicio : null,
    endYear: Number.isFinite(anoFim) ? anoFim : null,
    current: item.atual === true,
  };
}

function mapOrgaoInstitucional(item = {}) {
  const ordem = Number(item.ordem);

  return {
    id: text(item._id),
    slug: normalizarSlugPaginaInstitucional(item.slug),
    type: normalizarTipoOrgaoInstitucional(item.tipo),
    name: text(item.nome),
    category: text(item.categoria),
    summary: text(item.resumo),
    descriptionHtml: sanitizarHtmlInstitucional(item.descricao),
    order: Number.isFinite(ordem) ? ordem : 0,
    seoTitle: text(item.seoTitulo) || text(item.nome),
    seoDescription: text(item.seoDescricao) || text(item.resumo),
    legacyPath: text(item.slugLegado),
  };
}

function mapPessoaInstitucional(item = {}) {
  return {
    id: text(item._id),
    name: text(item.nome),
    oab: text(item.oab),
    slug: normalizarSlugPaginaInstitucional(item.slug),
    photoUrl: normalizarImagemPaginaInstitucional(item.foto),
    photoAlt: text(item.fotoAlt),
    bioHtml: sanitizarHtmlInstitucional(item.miniBio),
  };
}

function mapVinculoInstitucional(item = {}) {
  const ordem = Number(item.ordem);
  const papel = text(item.papel).toUpperCase();

  return {
    id: text(item._id),
    personId: text(item.pessoa),
    organizationId: text(item.orgao),
    managementId: text(item.gestao),
    role: papel,
    roleLabel: text(item.rotuloFuncao) || papel,
    order: Number.isFinite(ordem)
      ? ordem
      : ORDEM_PAPEL_INSTITUCIONAL[papel] || 999,
    featured: item.destaque === true,
  };
}

function compararMembrosInstitucionais(a, b) {
  const roleCompare =
    (ORDEM_PAPEL_INSTITUCIONAL[a.role] || 999) -
    (ORDEM_PAPEL_INSTITUCIONAL[b.role] || 999);

  if (roleCompare !== 0) return roleCompare;

  const orderCompare = a.order - b.order;

  if (orderCompare !== 0) return orderCompare;

  return a.name.localeCompare(b.name, 'pt-BR');
}

async function consultarTodosItensWix(criarQuery, pageSize = 1000) {
  const items = [];
  let offset = 0;

  while (true) {
    const result = await criarQuery()
      .skip(offset)
      .limit(pageSize)
      .find({ suppressAuth: true });
    const page = result.items || [];

    items.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += page.length;
  }

  return items;
}

async function carregarPessoasInstitucionaisPorIds(ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const items = [];
  const chunkSize = 100;

  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const result = await wixData
      .query(COL.PESSOAS_INSTITUCIONAIS)
      .hasSome('_id', chunk)
      .eq('ativo', true)
      .limit(chunkSize)
      .find({ suppressAuth: true });

    items.push(...(result.items || []));
  }

  return items;
}

async function carregarGestaoInstitucionalAtual() {
  let result = await wixData
    .query(COL.GESTOES_INSTITUCIONAIS)
    .eq('ativo', true)
    .eq('atual', true)
    .descending('anoInicio')
    .limit(1)
    .find({ suppressAuth: true });

  if (!(result.items || []).length) {
    result = await wixData
      .query(COL.GESTOES_INSTITUCIONAIS)
      .eq('ativo', true)
      .descending('anoInicio')
      .limit(1)
      .find({ suppressAuth: true });
  }

  return (result.items || [])[0] || null;
}

async function montarEstruturaInstitucionalAtual({ type = '', slug = '' } = {}) {
  const gestaoCms = await carregarGestaoInstitucionalAtual();

  if (!gestaoCms) {
    throw new Error('Nenhuma gestão institucional ativa foi encontrada.');
  }

  const management = mapGestaoInstitucional(gestaoCms);
  let orgQuery = wixData
    .query(COL.ORGAOS_INSTITUCIONAIS)
    .eq('ativo', true);

  if (type) {
    orgQuery = orgQuery.eq('tipo', type);
  }

  if (slug) {
    orgQuery = orgQuery.eq('slug', slug);
  }

  const orgResult = await orgQuery
    .ascending('ordem')
    .ascending('nome')
    .limit(200)
    .find({ suppressAuth: true });
  const organizationsCms = orgResult.items || [];
  const organizationIds = organizationsCms
    .map((item) => text(item._id))
    .filter(Boolean);

  if (!organizationIds.length) {
    return {
      management,
      items: [],
    };
  }

  const linksCms = await consultarTodosItensWix(() =>
    wixData
      .query(COL.VINCULOS_INSTITUCIONAIS)
      .eq('ativo', true)
      .eq('gestao', management.id)
      .hasSome('orgao', organizationIds)
      .ascending('ordem')
  );
  const links = linksCms.map(mapVinculoInstitucional);
  const peopleCms = await carregarPessoasInstitucionaisPorIds(
    links.map((item) => item.personId)
  );
  const peopleById = new Map(
    peopleCms.map((item) => {
      const person = mapPessoaInstitucional(item);
      return [person.id, person];
    })
  );
  const linksByOrganization = new Map();

  for (const link of links) {
    const person = peopleById.get(link.personId);

    if (!person) continue;

    const member = {
      id: link.id,
      personId: person.id,
      name: person.name,
      oab: person.oab,
      slug: person.slug,
      photoUrl: person.photoUrl,
      photoAlt: person.photoAlt,
      bioHtml: person.bioHtml,
      role: link.role,
      roleLabel: link.roleLabel,
      order: link.order,
      featured: link.featured,
    };
    const list = linksByOrganization.get(link.organizationId) || [];

    list.push(member);
    linksByOrganization.set(link.organizationId, list);
  }

  const items = organizationsCms
    .map((item) => {
      const organization = mapOrgaoInstitucional(item);
      const members = (
        linksByOrganization.get(organization.id) || []
      ).sort(compararMembrosInstitucionais);

      return {
        ...organization,
        memberCount: members.length,
        members,
      };
    })
    .filter(
      (item) => item.id && item.slug && item.type && item.name
    )
    .sort((a, b) => {
      const orderCompare = a.order - b.order;

      if (orderCompare !== 0) return orderCompare;

      return a.name.localeCompare(b.name, 'pt-BR');
    });

  return {
    management,
    items,
  };
}

async function buscarUnidadePorSlug(unidadeSlug) {
  const result = await wixData
    .query(COL.UNIDADES)
    .eq('slug', unidadeSlug)
    .limit(1)
    .find({ suppressAuth: true });

  const item = (result.items || [])[0];

  if (!item) return null;

  const unidade = mapUnidade(item);

  if (!filtrarUnidadeValida(unidade)) return null;

  return unidade;
}

function resultadoDatasValido(resultado) {
  if (Array.isArray(resultado)) return true;

  if (!resultado || typeof resultado !== 'object') return false;

  if (resultado.ok === true) return true;
  if (Array.isArray(resultado.datas)) return true;
  if (Array.isArray(resultado.dias)) return true;
  if (Array.isArray(resultado.items)) return true;
  if (Array.isArray(resultado.resultados)) return true;

  return false;
}

function resultadoHorariosValido(resultado) {
  if (Array.isArray(resultado)) return true;

  if (!resultado || typeof resultado !== 'object') return false;

  if (resultado.ok === true) return true;
  if (Array.isArray(resultado.horarios)) return true;
  if (Array.isArray(resultado.items)) return true;
  if (Array.isArray(resultado.resultados)) return true;
  if (Array.isArray(resultado.slots)) return true;

  return false;
}

async function chamarListarDatasDisponiveis(unidadeSlug) {
  let erroString = null;

  try {
    const resultadoString = await listarDatasDisponiveis(unidadeSlug);

    if (resultadoDatasValido(resultadoString)) {
      return resultadoString;
    }
  } catch (err) {
    erroString = err;
    console.warn(
      'listarDatasDisponiveis(unidadeSlug) falhou. Tentando formato objeto...',
      err
    );
  }

  try {
    return await listarDatasDisponiveis({
      unidadeSlug,
    });
  } catch (err) {
    console.error('listarDatasDisponiveis também falhou no formato objeto:', err);

    if (erroString) {
      throw erroString;
    }

    throw err;
  }
}

async function chamarListarHorariosDisponiveis(unidadeSlug, dataIso) {
  let erroParametros = null;

  try {
    const resultadoParametros = await listarHorariosDisponiveis(
      unidadeSlug,
      dataIso
    );

    if (resultadoHorariosValido(resultadoParametros)) {
      return resultadoParametros;
    }
  } catch (err) {
    erroParametros = err;
    console.warn(
      'listarHorariosDisponiveis(unidadeSlug, dataIso) falhou. Tentando formato objeto...',
      err
    );
  }

  try {
    return await listarHorariosDisponiveis({
      unidadeSlug,
      dataIso,
    });
  } catch (err) {
    console.error('listarHorariosDisponiveis também falhou no formato objeto:', err);

    if (erroParametros) {
      throw erroParametros;
    }

    throw err;
  }
}

function extrairDatas(resultado) {
  if (Array.isArray(resultado)) {
    return resultado;
  }

  if (!resultado || typeof resultado !== 'object') {
    return [];
  }

  return (
    resultado.datas ||
    resultado.dias ||
    resultado.items ||
    resultado.resultados ||
    []
  );
}

function extrairHorarios(resultado) {
  if (Array.isArray(resultado)) {
    return resultado;
  }

  if (!resultado || typeof resultado !== 'object') {
    return [];
  }

  return (
    resultado.horarios ||
    resultado.items ||
    resultado.resultados ||
    resultado.slots ||
    []
  );
}

function mapDataDisponivel(item) {
  if (typeof item === 'string') {
    const dataIso = normalizeDateIso(item);

    return {
      id: dataIso,
      dataIso,
      label: formatDateLabel(dataIso),
      diaSemana: formatWeekday(dataIso),
      diaMes: formatDayMonth(dataIso),
      disponivel: true,
      encerrado: false,
    };
  }

  const dataIso = normalizeDateIso(
    item.dataIso ||
      item.dataAtendimentoIso ||
      item.data ||
      item.date ||
      item.id ||
      item.value
  );

  const encerrado =
    item.encerrado === true ||
    item.prazoEncerrado === true ||
    item.foraDoPrazo === true;

  const disponivel =
    item.disponivel !== false &&
    item.available !== false &&
    item.bloqueado !== true &&
    !encerrado;

  return {
    id: dataIso,
    dataIso,
    label:
      text(item.label || item.dataLabel || item.nome || item.title) ||
      formatDateLabel(dataIso),
    diaSemana: text(item.diaSemana || item.weekday) || formatWeekday(dataIso),
    diaMes: text(item.diaMes || item.dayMonth) || formatDayMonth(dataIso),
    disponivel,
    encerrado,
  };
}

function mapHorarioDisponivel(item) {
  if (typeof item === 'string') {
    const horarioInicio = normalizeTime(item);
    const horarioFim = addMinutesToTime(horarioInicio, 30);

    return {
      id: horarioInicio,
      value: horarioInicio,
      label: horarioInicio,
      horarioInicio,
      horarioFim,
      disponivel: true,
    };
  }

  const horarioInicio = normalizeTime(
    item.horarioInicio ||
      item.inicio ||
      item.start ||
      item.horario ||
      item.value ||
      item.id ||
      item.label
  );

  const horarioFim =
    normalizeTime(
      item.horarioFim ||
        item.fim ||
        item.end ||
        item.termino ||
        item.horarioFinal
    ) || addMinutesToTime(horarioInicio, 30);

  const disponivel =
    item.disponivel !== false &&
    item.available !== false &&
    item.ocupado !== true &&
    item.bloqueado !== true;

  return {
    id: horarioInicio,
    value: horarioInicio,
    label: text(item.label || item.nome || item.title) || horarioInicio,
    horarioInicio,
    horarioFim,
    disponivel,
  };
}


function hojeIsoAgenda() {
  return dateToIso(new Date());
}

function adicionarDiasIso(dataIso, dias) {
  const base = dateFromIso(dataIso);
  if (!base) return '';
  base.setDate(base.getDate() + Number(dias || 0));
  return dateToIso(base);
}

function isFimDeSemanaIso(dataIso) {
  const d = dateFromIso(dataIso);
  if (!d) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

function normalizarEscopoBloqueioAgenda(value) {
  const v = text(value).toLowerCase();
  if (['todas', 'todos', 'all', 'global', 'geral', 'todas_unidades'].includes(v)) return 'todas';
  if (['unidade', 'unidade_especifica', 'especifica', 'specific'].includes(v)) return 'unidade';
  return '';
}

function normalizarTipoBloqueioAgenda(value) {
  const v = text(value).toLowerCase();
  if (['dia', 'dia_inteiro', 'inteiro', 'data', 'data_inteira'].includes(v)) return 'dia_inteiro';
  if (['intervalo', 'intervalo_datas', 'periodo', 'período'].includes(v)) return 'intervalo_datas';
  if (['horario', 'horário', 'horario_especifico', 'horário_específico', 'intervalo_horarios'].includes(v)) return 'horario';
  return '';
}

function horarioParaMinutosAgenda(value) {
  const h = normalizeTime(value);
  if (!/^\d{2}:\d{2}$/.test(h)) return null;
  const [hh, mm] = h.split(':').map((n) => Number(n));
  return hh * 60 + mm;
}

function intervalosHorarioSobrepoemAgenda(inicioA, fimA, inicioB, fimB) {
  const a1 = horarioParaMinutosAgenda(inicioA);
  const a2 = horarioParaMinutosAgenda(fimA);
  const b1 = horarioParaMinutosAgenda(inicioB);
  const b2 = horarioParaMinutosAgenda(fimB);
  if (a1 === null || a2 === null || b1 === null || b2 === null) return false;
  return a1 < b2 && b1 < a2;
}

function mapBloqueioAgendaDisponibilidade(item = {}) {
  const escopo =
    normalizarEscopoBloqueioAgenda(item.escopo || item.scope || (item.todasUnidades ? 'todas' : 'unidade')) ||
    'unidade';
  const tipo =
    normalizarTipoBloqueioAgenda(item.tipo || item.tipoBloqueio || (item.diaInteiro ? 'dia_inteiro' : 'horario')) ||
    'dia_inteiro';
  const dataInicio = normalizeDateIso(item.dataInicio || item.inicioData || item.dataIso || item.data);
  const dataFim = normalizeDateIso(item.dataFim || item.fimData || item.dataFinal || dataInicio);
  const ativo = item.ativo !== false && item.ativa !== false && text(item.status).toLowerCase() !== 'inativo';
  const unidadeSlug =
    escopo === 'todas'
      ? 'todas'
      : text(item.unidadeSlug || item.unidadeId || item.unidade || '').toLowerCase();
  return {
    _id: text(item._id),
    escopo,
    tipo,
    todasUnidades: escopo === 'todas',
    unidadeSlug,
    dataInicio,
    dataFim: dataFim || dataInicio,
    horarioInicio: normalizeTime(item.horarioInicio || item.inicioHorario || item.horario),
    horarioFim: normalizeTime(item.horarioFim || item.fimHorario),
    motivo: text(item.motivo || item.reason),
    ativo,
  };
}

function bloqueioAgendaAplicaUnidade(bloqueio, unidadeSlug) {
  if (!bloqueio || bloqueio.ativo === false) return false;
  if (bloqueio.escopo === 'todas' || bloqueio.todasUnidades === true) return true;
  return text(bloqueio.unidadeSlug).toLowerCase() === text(unidadeSlug).toLowerCase();
}

function bloqueioAgendaAplicaData(bloqueio, dataIso) {
  const data = normalizeDateIso(dataIso);
  const inicio = normalizeDateIso(bloqueio?.dataInicio);
  const fim = normalizeDateIso(bloqueio?.dataFim || bloqueio?.dataInicio);
  if (!data || !inicio) return false;
  return data >= inicio && data <= (fim || inicio);
}

function bloqueioAgendaDiaInteiro(bloqueio) {
  return bloqueio?.tipo === 'dia_inteiro' || bloqueio?.tipo === 'intervalo_datas' || !bloqueio?.horarioInicio;
}

async function carregarBloqueiosAtivosAgenda(unidadeSlug) {
  const result = await wixData
    .query(COL.BLOQUEIOS_AGENDA)
    .limit(250)
    .find({ suppressAuth: true });

  const hoje = hojeIsoAgenda();
  return (result.items || [])
    .map(mapBloqueioAgendaDisponibilidade)
    .filter((b) => b.ativo !== false)
    .filter((b) => b.dataFim >= hoje)
    .filter((b) => bloqueioAgendaAplicaUnidade(b, unidadeSlug));
}

function bloqueiosDaDataAgenda(bloqueios, dataIso) {
  return (bloqueios || []).filter((b) => bloqueioAgendaAplicaData(b, dataIso));
}

function dataTotalmenteBloqueadaAgenda(bloqueios, dataIso) {
  return bloqueiosDaDataAgenda(bloqueios, dataIso).some(bloqueioAgendaDiaInteiro);
}

function horarioBloqueadoAgenda(horario, bloqueios, dataIso) {
  const bloqueiosData = bloqueiosDaDataAgenda(bloqueios, dataIso);
  if (bloqueiosData.some(bloqueioAgendaDiaInteiro)) return true;
  return bloqueiosData.some((b) => {
    if (b.tipo !== 'horario') return false;
    return intervalosHorarioSobrepoemAgenda(
      horario.horarioInicio,
      horario.horarioFim || addMinutesToTime(horario.horarioInicio, 30),
      b.horarioInicio,
      b.horarioFim || addMinutesToTime(b.horarioInicio, 30)
    );
  });
}

function gerarDatasCandidatasAgenda(datasBase = []) {
  const map = new Map();
  for (const item of datasBase) {
    if (item?.dataIso && /^\d{4}-\d{2}-\d{2}$/.test(item.dataIso)) {
      map.set(item.dataIso, item);
    }
  }

  const hoje = hojeIsoAgenda();
  for (let i = 1; i <= JANELA_AGENDAMENTO_DIAS; i += 1) {
    const dataIso = adicionarDiasIso(hoje, i);
    if (!dataIso || isFimDeSemanaIso(dataIso)) continue;
    if (!map.has(dataIso)) {
      map.set(dataIso, {
        id: dataIso,
        dataIso,
        label: formatDateLabel(dataIso),
        diaSemana: formatWeekday(dataIso),
        diaMes: formatDayMonth(dataIso),
        disponivel: true,
        encerrado: false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.dataIso.localeCompare(b.dataIso));
}

async function carregarDatasNormalizadas(unidadeSlug) {
  const unidade = await buscarUnidadePorSlug(unidadeSlug);
  if (!unidade) return [];

  const bloqueios = await carregarBloqueiosAtivosAgenda(unidadeSlug);
  const candidatas = gerarDatasCandidatasAgenda([])
    .filter((data) => data.encerrado !== true && data.disponivel !== false)
    .filter((data) => !dataTotalmenteBloqueadaAgenda(bloqueios, data.dataIso));

  const datas = [];
  const TAMANHO_LOTE_DATAS = 4;

  for (let inicio = 0; inicio < candidatas.length; inicio += TAMANHO_LOTE_DATAS) {
    if (datas.length >= MAX_DATAS_AGENDAMENTO) break;

    const lote = candidatas.slice(inicio, inicio + TAMANHO_LOTE_DATAS);
    const resultados = await Promise.all(
      lote.map(async (data) => {
        try {
          const horarios = await carregarHorariosNormalizados(unidadeSlug, data.dataIso, { bloqueios });
          if (!horarios.length) return null;

          return {
            ...data,
            id: data.dataIso,
            label: data.label || formatDateLabel(data.dataIso),
            diaSemana: data.diaSemana || formatWeekday(data.dataIso),
            diaMes: data.diaMes || formatDayMonth(data.dataIso),
            disponivel: true,
            encerrado: false,
          };
        } catch (err) {
          console.warn('Não foi possível validar horários para a data candidata.', data.dataIso, err);
          return null;
        }
      })
    );

    for (const resultado of resultados) {
      if (!resultado) continue;
      datas.push(resultado);
      if (datas.length >= MAX_DATAS_AGENDAMENTO) break;
    }
  }

  return datas.slice(0, MAX_DATAS_AGENDAMENTO);
}

async function carregarHorariosNormalizados(unidadeSlug, dataIso, options = {}) {
  const resultado = await chamarListarHorariosDisponiveis(unidadeSlug, dataIso);
  const bloqueios = options.bloqueios || (await carregarBloqueiosAtivosAgenda(unidadeSlug));

  return extrairHorarios(resultado)
    .map(mapHorarioDisponivel)
    .filter((horario) => !!horario.id && horario.disponivel !== false)
    .filter((horario) => !horarioBloqueadoAgenda(horario, bloqueios, dataIso))
    .sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));
}

async function validarHorarioDisponivelFinal(dados) {
  const horarios = await carregarHorariosNormalizados(
    dados.unidadeSlug,
    dados.dataIso
  );

  const horarioEncontrado = horarios.find(
    (horario) => horario.horarioInicio === dados.horarioInicio
  );

  if (!horarioEncontrado) {
    return {
      ok: false,
      codigo: 'HORARIO_INDISPONIVEL',
      mensagem: 'Este horário não está mais disponível. Escolha outro horário.',
    };
  }

  return {
    ok: true,
    horario: horarioEncontrado,
  };
}

function normalizarPayloadAgendamento(payload = {}) {
  const unidadeSlug = text(
    payload.unidadeSlug || payload.unidadeId || payload.unidade || payload.slug
  );

  const dataIso = normalizeDateIso(
    payload.dataIso ||
      payload.data ||
      payload.dataAtendimentoIso ||
      payload.dataAtendimento
  );

  const horarioInicio = normalizeTime(
    payload.horarioInicio || payload.horario || payload.value || payload.inicio
  );

  const horarioFim =
    normalizeTime(payload.horarioFim || payload.fim || payload.end) ||
    addMinutesToTime(horarioInicio, 30);

  const nomeAdvogado = text(
    payload.nomeAdvogado || payload.advNome || payload.advogado || payload.nome
  );

  const numeroOab = text(
    payload.numeroOab || payload.advOab || payload.oab || payload.oabNumero
  );

  const emailAdvogado = normalizeEmail(
    payload.emailAdvogado || payload.advEmail || payload.email
  );

  const telefoneAdvogado = text(
    payload.telefoneAdvogado ||
      payload.advTelefone ||
      payload.telefone ||
      payload.celular
  );

  const nomeIpl = text(
    payload.nomeIpl ||
      payload.ipl ||
      payload.nomePessoaPrivadaLiberdade ||
      payload.nomeCustodiado ||
      payload.pessoa
  );

  const infopen = text(payload.infopen || payload.numeroInfopen);

  const cienciaRegras =
    payload.cienciaRegras === true ||
    payload.aceiteRegras === true ||
    payload.aceitouRegras === true ||
    payload.regrasAceitas === true;

  return {
    unidadeSlug,
    dataIso,
    horarioInicio,
    horarioFim,
    nomeAdvogado,
    numeroOab,
    emailAdvogado,
    telefoneAdvogado,
    nomeIpl,
    infopen,
    cienciaRegras,
  };
}

function validarDadosAgendamento(dados) {
  if (!dados.unidadeSlug) return 'Informe a unidade prisional.';

  if (!dados.dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dados.dataIso)) {
    return 'Informe uma data válida.';
  }

  if (!dados.horarioInicio || !/^\d{2}:\d{2}$/.test(dados.horarioInicio)) {
    return 'Informe um horário válido.';
  }

  if (!dados.nomeAdvogado) return 'Informe o nome do advogado.';
  if (!dados.numeroOab) return 'Informe o número da OAB.';

  if (!isValidEmail(dados.emailAdvogado)) {
    return 'Informe um e-mail válido.';
  }

  if (!dados.telefoneAdvogado) return 'Informe o telefone.';
  if (!dados.nomeIpl) return 'Informe os dados da IPL.';

  if (!dados.cienciaRegras) {
    return 'É necessário aceitar as regras antes de confirmar.';
  }

  return '';
}

function montarSlotKey(unidadeSlug, dataIso, horarioInicio) {
  return `${unidadeSlug}|${dataIso}|${horarioInicio}`;
}

async function existeAgendamentoConflitante(dados) {
  const slotKey = montarSlotKey(
    dados.unidadeSlug,
    dados.dataIso,
    dados.horarioInicio
  );

  const porSlot = await wixData
    .query(COL.AGENDAMENTOS)
    .eq('slotKey', slotKey)
    .limit(20)
    .find({ suppressAuth: true });

  const conflitosPorSlot = (porSlot.items || []).filter(
    (item) => text(item.status || 'agendado').toLowerCase() !== 'cancelado'
  );

  if (conflitosPorSlot.length > 0) {
    return true;
  }

  const porCampos = await wixData
    .query(COL.AGENDAMENTOS)
    .eq('unidadeSlug', dados.unidadeSlug)
    .eq('dataAtendimentoIso', dados.dataIso)
    .eq('horarioInicio', dados.horarioInicio)
    .limit(20)
    .find({ suppressAuth: true });

  const conflitosPorCampos = (porCampos.items || []).filter(
    (item) => text(item.status || 'agendado').toLowerCase() !== 'cancelado'
  );

  return conflitosPorCampos.length > 0;
}

async function gerarProtocoloUnico() {
  const ano = new Date().getFullYear();

  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const numero = String(Math.floor(100000 + Math.random() * 900000));
    const protocolo = `AG-${ano}-${numero}`;

    const existente = await wixData
      .query(COL.AGENDAMENTOS)
      .eq('protocolo', protocolo)
      .limit(1)
      .find({ suppressAuth: true });

    if (!existente.items.length) {
      return protocolo;
    }
  }

  return `AG-${ano}-${String(Date.now()).slice(-6)}`;
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text(value));
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function limitarTexto(value, max = 500) {
  const v = text(value);

  if (v.length <= max) return v;

  return `${v.slice(0, max)}...`;
}

function tryParseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function normalizarMensagemErroApi(err) {
  if (!err) return 'Erro desconhecido.';

  if (typeof err === 'string') {
    return err.slice(0, 900);
  }

  if (err.message) {
    return String(err.message).slice(0, 900);
  }

  try {
    return JSON.stringify(err).slice(0, 900);
  } catch (jsonErr) {
    return 'Erro não identificado.';
  }
}

function normalizarBaseUrl(value) {
  let url = text(value);

  if (!url) return '';

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  return url.replace(/\/+$/, '');
}

function isPublicHttpUrl(value) {
  return /^https?:\/\//i.test(text(value));
}

async function getRequiredSecret(secretName) {
  try {
    const value = await getSecret(secretName);

    if (!text(value)) {
      throw new Error(`Secret ${secretName} está vazio.`);
    }

    return value;
  } catch (err) {
    throw new Error(`Secret ${secretName} não configurado ou inacessível.`);
  }
}

async function getOptionalSecret(secretName) {
  try {
    const value = await getSecret(secretName);
    return text(value);
  } catch (err) {
    return '';
  }
}

async function carregarConfigInfobip() {
  const [baseUrlRaw, apiKeyRaw, fromEmailRaw, fromNameRaw, logoUrlRaw] = await Promise.all([
    getRequiredSecret('INFOBIP_BASE_URL'),
    getRequiredSecret('INFOBIP_API_KEY'),
    getRequiredSecret('INFOBIP_FROM_EMAIL'),
    getRequiredSecret('INFOBIP_FROM_NAME'),
    getOptionalSecret('OAB_EMAIL_LOGO_URL'),
  ]);

  const baseUrl = normalizarBaseUrl(baseUrlRaw);
  const apiKey = text(apiKeyRaw);
  const fromEmail = normalizeEmail(fromEmailRaw);
  const fromName = text(fromNameRaw) || 'OAB Juiz de Fora';
  const logoUrl = isPublicHttpUrl(logoUrlRaw) ? text(logoUrlRaw) : '';

  if (!baseUrl) {
    throw new Error('INFOBIP_BASE_URL inválido.');
  }

  if (!apiKey) {
    throw new Error('INFOBIP_API_KEY vazio.');
  }

  if (!isValidEmail(fromEmail)) {
    throw new Error('INFOBIP_FROM_EMAIL inválido.');
  }

  return {
    baseUrl,
    apiKey,
    fromEmail,
    fromName,
    logoUrl,
  };
}

function montarAuthorizationHeader(apiKey) {
  const key = text(apiKey);

  if (/^(App|Basic|Bearer)\s+/i.test(key)) {
    return key;
  }

  return `App ${key}`;
}

function formatarRemetente(nome, email) {
  const cleanName = text(nome).replace(/[<>"]/g, '');
  const cleanEmail = normalizeEmail(email);

  if (!cleanName) return cleanEmail;

  return `${cleanName} <${cleanEmail}>`;
}

function escapeMultipartName(value) {
  return text(value).replace(/"/g, '');
}

function montarMultipartFormData(fields = {}) {
  const boundary = `----wix-infobip-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  const parts = [];

  Object.keys(fields).forEach((name) => {
    const value = fields[name];

    if (value === null || value === undefined) return;

    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="${escapeMultipartName(name)}"\r\n\r\n`);
    parts.push(String(value));
    parts.push('\r\n');
  });

  parts.push(`--${boundary}--\r\n`);

  return {
    boundary,
    body: parts.join(''),
  };
}

function extrairInfobipMessageId(parsed) {
  try {
    if (!parsed) return '';

    if (parsed.messages && parsed.messages[0] && parsed.messages[0].messageId) {
      return parsed.messages[0].messageId;
    }

    if (parsed.messageId) {
      return parsed.messageId;
    }

    return '';
  } catch (err) {
    return '';
  }
}

async function enviarEmailInfobip({ config, to, subject, textBody, htmlBody }) {
  if (!isValidEmail(to)) {
    return {
      ok: false,
      mensagem: 'E-mail de destino inválido.',
    };
  }

  const endpoint = `${config.baseUrl}${INFOBIP_EMAIL_ENDPOINT}`;

  const multipart = montarMultipartFormData({
    from: formatarRemetente(config.fromName, config.fromEmail),
    to: JSON.stringify({ to }),
    subject,
    text: textBody,
    html: htmlBody,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'post',
      headers: {
        Authorization: montarAuthorizationHeader(config.apiKey),
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
      },
      body: multipart.body,
    });

    const raw = await response.text();
    const parsed = tryParseJson(raw);

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        mensagem: `Infobip retornou erro ${response.status}: ${limitarTexto(raw, 700)}`,
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      resposta: parsed || raw,
      messageId: extrairInfobipMessageId(parsed),
    };
  } catch (err) {
    return {
      ok: false,
      mensagem: normalizarMensagemErroApi(err),
    };
  }
}

async function registrarAuditoriaEmailAdvogadoAgendamento(itemSalvo, auditoria = {}) {
  try {
    const atualizado = {
      ...itemSalvo,
      ...auditoria,
      atualizadoEm: new Date(),
    };

    return await wixData.update(COL.AGENDAMENTOS, atualizado, {
      suppressAuth: true,
    });
  } catch (err) {
    console.warn(
      'Agendamento registrado, mas não foi possível gravar auditoria do e-mail ao advogado.',
      err
    );
    return itemSalvo;
  }
}

async function tentarEnviarEmailAgendamentoParaAdvogado({ dados, unidade, protocolo, dataLabel }) {
  const emailDestino = normalizeEmail(dados.emailAdvogado);

  try {
    const envio = await enviarEmailAgendamentoParaAdvogado({
      dados,
      unidade,
      protocolo,
      dataLabel,
      emailDestino,
    });

    if (!envio.ok) {
      throw new Error(envio.mensagem || 'Falha no envio da confirmação ao advogado.');
    }

    return {
      emailAdvogadoEnviado: true,
      emailAdvogadoDestino: emailDestino,
      emailAdvogadoErro: '',
      emailAdvogadoEnviadoEm: new Date(),
    };
  } catch (err) {
    const mensagemErro = normalizarMensagemErroApi(err);

    console.warn(
      `Agendamento ${protocolo} confirmado, mas a confirmação ao advogado não foi enviada.`,
      err
    );

    return {
      emailAdvogadoEnviado: false,
      emailAdvogadoDestino: emailDestino,
      emailAdvogadoErro: mensagemErro,
      emailAdvogadoEnviadoEm: null,
    };
  }
}

async function enviarEmailAgendamentoParaAdvogado({
  dados,
  unidade,
  protocolo,
  dataLabel,
  emailDestino,
}) {
  const config = await carregarConfigInfobip();
  const assunto = `[OAB/JF] Confirmação de agendamento - ${protocolo}`;

  const corpoTexto = montarEmailTextoAgendamentoAdvogado({
    dados,
    unidade,
    protocolo,
    dataLabel,
  });

  const corpoHtml = montarEmailHtmlAgendamentoAdvogado({
    dados,
    unidade,
    protocolo,
    dataLabel,
    logoUrl: config.logoUrl,
  });

  return enviarEmailInfobip({
    config,
    to: emailDestino,
    subject: assunto,
    textBody: corpoTexto,
    htmlBody: corpoHtml,
  });
}

function montarDataEmailAgendamento(dados, dataLabel) {
  const dataBr = formatDateBr(dados.dataIso);
  const label = text(dataLabel);

  if (label && dataBr && !label.includes(dataBr)) {
    return `${label} (${dataBr})`;
  }

  return label || dataBr;
}

function montarHorarioEmailAgendamento(dados) {
  if (dados.horarioInicio && dados.horarioFim) {
    return `${dados.horarioInicio} – ${dados.horarioFim}`;
  }

  return dados.horarioInicio || '';
}

function montarEmailTextoAgendamentoAdvogado({ dados, unidade, protocolo, dataLabel }) {
  return [
    `Olá, ${dados.nomeAdvogado}.`,
    '',
    'Seu agendamento foi confirmado pela Central de Agendamentos Prisionais da OAB Juiz de Fora.',
    '',
    `Protocolo: ${protocolo}`,
    `Unidade prisional: ${unidade.nome}`,
    `Data: ${montarDataEmailAgendamento(dados, dataLabel)}`,
    `Horário: ${montarHorarioEmailAgendamento(dados)}`,
    `Nome da IPL: ${dados.nomeIpl}`,
    `Advogado(a): ${dados.nomeAdvogado}`,
    '',
    'Guarde este protocolo. Ele poderá ser usado para acompanhamento junto à OAB Juiz de Fora.',
    '',
    'Este é um e-mail automático da Central de Agendamentos Prisionais da OAB Juiz de Fora.',
  ].join('\n');
}

function montarBlocoHtmlEmail(titulo, linhas = []) {
  const rowsHtml = linhas
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;color:#6b7280;width:210px;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;color:#111827;font-weight:700;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
            ${escapeHtml(value)}
          </td>
        </tr>
      `
    )
    .join('');

  return `
    <div style="border:1px solid #ece7dd;border-radius:10px;overflow:hidden;">
      <div style="background:#faf7f1;padding:11px 14px;border-bottom:1px solid #ece7dd;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#111827;">
        ${escapeHtml(titulo)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;">
        ${rowsHtml}
      </table>
    </div>
  `;
}

function montarEmailHtmlAgendamentoAdvogado({ dados, unidade, protocolo, dataLabel, logoUrl }) {
  const logoHtml = logoUrl
    ? `
      <img
        src="${escapeHtml(logoUrl)}"
        alt="OAB Juiz de Fora"
        width="120"
        style="display:block;max-width:120px;height:auto;border:0;margin:0;"
      />
    `
    : `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#111827;">
        OAB<span style="color:#b42318;">.</span>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#1d4ed8;margin-top:4px;">
        Juiz de Fora
      </div>
    `;

  const linhas = [
    ['Protocolo', protocolo],
    ['Unidade prisional', unidade.nome],
    ['Data', montarDataEmailAgendamento(dados, dataLabel)],
    ['Horário', montarHorarioEmailAgendamento(dados)],
    ['Nome da IPL', dados.nomeIpl],
    ['Advogado(a)', dados.nomeAdvogado],
  ];

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f5f2ed;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f5f2ed;">
          <tr>
            <td align="center" style="padding:28px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:720px;background:#ffffff;border:1px solid #e7e2d8;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="height:5px;background:#b42318;width:25%;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="height:5px;background:#ffffff;width:50%;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="height:5px;background:#1d4ed8;width:25%;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:26px 30px 20px 30px;border-bottom:1px solid #eee8dc;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="vertical-align:middle;width:150px;">
                          ${logoHtml}
                        </td>
                        <td style="vertical-align:middle;text-align:right;">
                          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#7a6f63;">
                            Central de Agendamentos Prisionais
                          </div>
                          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;margin-top:4px;">
                            Confirmação de agendamento
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px 30px 10px 30px;">
                    <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;color:#111827;">
                      Agendamento confirmado
                    </h1>
                    <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4b5563;">
                      Olá, ${escapeHtml(dados.nomeAdvogado)}. Seu agendamento foi confirmado pela Central de Agendamentos Prisionais da OAB Juiz de Fora.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 30px 20px 30px;">
                    ${montarBlocoHtmlEmail('Dados do agendamento', linhas)}
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 30px;background:#f9fafb;border-top:1px solid #eee8dc;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#4b5563;">
                      Guarde este protocolo. Ele poderá ser usado para acompanhamento junto à OAB Juiz de Fora.
                    </p>
                    <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af;">
                      Este e-mail foi enviado automaticamente pela Central de Agendamentos Prisionais da OAB Juiz de Fora.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

const DOCUMENT_UPLOAD_FOLDER = '/oab-central/documentos';
const MAX_DOCUMENT_UPLOAD_BYTES = 8 * 1024 * 1024;

const DOCUMENT_UPLOAD_MIME_CONFIG = {
  'application/pdf': {
    mediaType: 'document',
    extensions: ['pdf'],
    defaultExtension: 'pdf',
  },
  'image/jpeg': {
    mediaType: 'image',
    extensions: ['jpg', 'jpeg'],
    defaultExtension: 'jpg',
  },
  'image/png': {
    mediaType: 'image',
    extensions: ['png'],
    defaultExtension: 'png',
  },
};

function splitDataUrl(value) {
  const raw = text(value);

  if (!raw) {
    return {
      mimeType: '',
      base64: '',
    };
  }

  const match = raw.match(/^data:([^;,]+);base64,(.+)$/i);

  if (!match) {
    return {
      mimeType: '',
      base64: raw,
    };
  }

  return {
    mimeType: text(match[1]).toLowerCase(),
    base64: text(match[2]),
  };
}

function getFileExtension(fileName) {
  const nome = text(fileName).toLowerCase();
  const semQuery = nome.split('?')[0].split('#')[0];
  const idx = semQuery.lastIndexOf('.');

  if (idx < 0) return '';

  return semQuery.slice(idx + 1).replace(/[^a-z0-9]/g, '');
}

function inferMimeTypeFromFileName(fileName) {
  const ext = getFileExtension(fileName);

  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';

  return '';
}

function getMimeConfig(mimeType) {
  return DOCUMENT_UPLOAD_MIME_CONFIG[text(mimeType).toLowerCase()] || null;
}

function sanitizeFileBaseName(value) {
  const raw = text(value) || 'documento';
  const semExt = raw.replace(/\.[a-z0-9]{1,12}$/i, '');
  const semAcento = semExt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const limpo = semAcento
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return limpo || 'documento';
}

function gerarUploadToken(length = 5) {
  let out = '';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }

  return out;
}

function montarNomeArquivoUpload(nomeOriginal, mimeType) {
  const config = getMimeConfig(mimeType);
  const extOriginal = getFileExtension(nomeOriginal);
  const ext =
    config && config.extensions.includes(extOriginal)
      ? extOriginal
      : config
        ? config.defaultExtension
        : extOriginal || 'bin';

  const agora = new Date();
  const yyyy = agora.getFullYear();
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  const hh = String(agora.getHours()).padStart(2, '0');
  const mi = String(agora.getMinutes()).padStart(2, '0');
  const ss = String(agora.getSeconds()).padStart(2, '0');
  const base = sanitizeFileBaseName(nomeOriginal);
  const token = gerarUploadToken();

  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}-${token}-${base}.${ext}`;
}

function normalizarPayloadUploadUrlDocumento(payload = {}) {
  const nomeOriginal = text(
    payload.fileName ||
      payload.nomeArquivo ||
      payload.arquivoNome ||
      payload.arquivoPrincipalNome ||
      payload.name
  );

  const mimeType = text(
    payload.mimeType ||
      payload.contentType ||
      payload.tipoMime ||
      inferMimeTypeFromFileName(nomeOriginal)
  ).toLowerCase();

  const tamanhoBytes = Number(payload.sizeInBytes || payload.tamanhoBytes || payload.size || 0);

  return {
    nomeOriginal,
    mimeType,
    tamanhoBytes: Number.isFinite(tamanhoBytes) ? Math.max(0, Math.trunc(tamanhoBytes)) : 0,
  };
}

function validarUploadUrlDocumento(dados) {
  const erros = [];
  const config = getMimeConfig(dados.mimeType);
  const ext = getFileExtension(dados.nomeOriginal);

  if (!dados.nomeOriginal) {
    erros.push('Nome do arquivo não informado.');
  }

  if (!dados.mimeType) {
    erros.push('Tipo do arquivo não informado.');
  } else if (!config) {
    erros.push('Formato não permitido. Envie PDF, JPG ou PNG.');
  }

  if (config && ext && !config.extensions.includes(ext)) {
    erros.push('A extensão do arquivo não corresponde ao tipo informado.');
  }

  if (!dados.tamanhoBytes || dados.tamanhoBytes < 1) {
    erros.push('Tamanho do arquivo não informado.');
  } else if (dados.tamanhoBytes > MAX_DOCUMENT_UPLOAD_BYTES) {
    erros.push('Arquivo maior que 8 MB.');
  }

  if (erros.length) {
    return {
      ok: false,
      codigo: 'UPLOAD_INVALIDO',
      mensagem: erros.join('\n'),
    };
  }

  return { ok: true };
}

async function prepararUploadDocumentoDireto(dados) {
  const config = getMimeConfig(dados.mimeType);
  const fileName = montarNomeArquivoUpload(dados.nomeOriginal, dados.mimeType);

  const options = {
    mediaOptions: {
      mimeType: dados.mimeType,
      mediaType: config.mediaType,
    },
    metadataOptions: {
      isPrivate: false,
      isVisitorUpload: true,
      context: {
        origem: 'central-oabjf',
        fluxo: 'documentos',
        nomeOriginal: dados.nomeOriginal,
      },
    },
  };

  const result = await mediaManager.getUploadUrl(DOCUMENT_UPLOAD_FOLDER, options);
  const uploadUrl = text(result && result.uploadUrl);

  if (!uploadUrl) {
    return {
      ok: false,
      codigo: 'UPLOAD_URL_AUSENTE',
      mensagem: 'O Wix não retornou uma URL para envio do arquivo.',
    };
  }

  return {
    ok: true,
    uploadUrl,
    fileName,
    mimeType: dados.mimeType,
  };
}

function normalizarPayloadUploadDocumento(payload = {}) {
  const nomeOriginal = text(
    payload.fileName ||
      payload.nomeArquivo ||
      payload.arquivoNome ||
      payload.arquivoPrincipalNome ||
      payload.name
  );

  const dataUrlInformada = text(
    payload.dataUrl || payload.fileDataUrl || payload.arquivoDataUrl
  );

  const base64Informado = text(
    payload.fileBase64 || payload.base64 || payload.arquivoBase64
  );

  const baseSource = base64Informado || dataUrlInformada;
  const dataParts = splitDataUrl(baseSource);

  const mimeType = text(
    payload.mimeType ||
      payload.contentType ||
      payload.tipoMime ||
      dataParts.mimeType ||
      inferMimeTypeFromFileName(nomeOriginal)
  ).toLowerCase();

  const base64 = text(dataParts.base64).replace(/\s/g, '');

  return {
    nomeOriginal,
    mimeType,
    base64,
  };
}

function validarUploadDocumento(dados) {
  const erros = [];
  const config = getMimeConfig(dados.mimeType);
  const ext = getFileExtension(dados.nomeOriginal);

  if (!dados.nomeOriginal) {
    erros.push('Nome do arquivo não informado.');
  }

  if (!dados.mimeType) {
    erros.push('Tipo do arquivo não informado.');
  } else if (!config) {
    erros.push('Formato não permitido. Envie PDF, JPG ou PNG.');
  }

  if (config && ext && !config.extensions.includes(ext)) {
    erros.push('A extensão do arquivo não corresponde ao tipo informado.');
  }

  if (!dados.base64) {
    erros.push('Conteúdo do arquivo não informado.');
  } else if (dados.base64.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dados.base64)) {
    erros.push('Conteúdo do arquivo está em Base64 inválido.');
  }

  const tamanhoAproximado = Math.floor((dados.base64.length * 3) / 4);

  if (tamanhoAproximado > MAX_DOCUMENT_UPLOAD_BYTES + 3) {
    erros.push('Arquivo maior que 8 MB.');
  }

  if (erros.length) {
    return {
      ok: false,
      codigo: 'UPLOAD_INVALIDO',
      mensagem: erros.join('\n'),
    };
  }

  return { ok: true };
}

function decodeBase64ToBuffer(base64) {
  if (typeof Buffer === 'undefined' || typeof Buffer.from !== 'function') {
    throw new Error('Buffer não está disponível no ambiente Wix.');
  }

  return Buffer.from(base64, 'base64');
}

function extrairArquivoUrlUpload(uploaded) {
  if (!uploaded || typeof uploaded !== 'object') return '';

  return text(
    uploaded.fileUrl ||
      uploaded.url ||
      uploaded.mediaUrl ||
      uploaded.src ||
      uploaded.documentUrl ||
      uploaded.file_url
  );
}

function montarRespostaUploadDocumento(uploaded, dados, nomeArquivoWix, tamanhoBytes) {
  const arquivoPrincipalUrl = extrairArquivoUrlUpload(uploaded);
  const arquivoPrincipalNome = dados.nomeOriginal || nomeArquivoWix;

  if (!arquivoPrincipalUrl) {
    return {
      ok: false,
      codigo: 'UPLOAD_SEM_URL',
      mensagem:
        'O arquivo foi salvo, mas o Wix não retornou uma URL identificável.',
    };
  }

  return {
    ok: true,
    mensagem: 'Arquivo enviado com sucesso.',
    arquivoPrincipalUrl,
    arquivoPrincipalNome,
    arquivo: {
      url: arquivoPrincipalUrl,
      nome: arquivoPrincipalNome,
      nomeSalvo: nomeArquivoWix,
      mimeType: dados.mimeType,
      tamanhoBytes,
      wixFileId: text(
        uploaded._id || uploaded.id || uploaded.fileId || uploaded.mediaId
      ),
      wixFileName: text(uploaded.fileName || uploaded.name || nomeArquivoWix),
    },
  };
}

async function chamarMediaManagerUpload(folderPath, buffer, fileName, options) {
  let primeiroErro = null;

  try {
    return await mediaManager.upload(folderPath, buffer, fileName, options);
  } catch (err) {
    primeiroErro = err;
    console.warn(
      'mediaManager.upload(folder, buffer, fileName, options) falhou. Tentando assinatura alternativa...',
      err
    );
  }

  try {
    return await mediaManager.upload(folderPath, fileName, buffer, options);
  } catch (err) {
    console.error('mediaManager.upload também falhou na assinatura alternativa:', err);

    if (primeiroErro) {
      throw primeiroErro;
    }

    throw err;
  }
}

async function uploadDocumentoParaMediaManager(dados) {
  const config = getMimeConfig(dados.mimeType);
  const buffer = decodeBase64ToBuffer(dados.base64);

  if (!buffer || !buffer.length) {
    return {
      ok: false,
      codigo: 'ARQUIVO_VAZIO',
      mensagem: 'Arquivo vazio ou inválido.',
    };
  }

  if (buffer.length > MAX_DOCUMENT_UPLOAD_BYTES) {
    return {
      ok: false,
      codigo: 'ARQUIVO_GRANDE',
      mensagem: 'Arquivo maior que 8 MB.',
    };
  }

  const nomeArquivoWix = montarNomeArquivoUpload(dados.nomeOriginal, dados.mimeType);

  const options = {
    mediaOptions: {
      mimeType: dados.mimeType,
      mediaType: config.mediaType,
    },
    metadataOptions: {
      isPrivate: false,
      isVisitorUpload: true,
      context: {
        origem: 'central-oabjf',
        fluxo: 'documentos',
        nomeOriginal: dados.nomeOriginal,
      },
    },
  };

  try {
    const uploaded = await chamarMediaManagerUpload(
      DOCUMENT_UPLOAD_FOLDER,
      buffer,
      nomeArquivoWix,
      options
    );

    return montarRespostaUploadDocumento(
      uploaded,
      dados,
      nomeArquivoWix,
      buffer.length
    );
  } catch (err) {
    return {
      ok: false,
      codigo: 'UPLOAD_FALHOU',
      mensagem: `Não foi possível salvar o arquivo no Wix Media Manager. ${normalizarMensagemErroApi(err)}`,
    };
  }
}

export function use_oabHealth(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    return jsonOk(request, {
      ok: true,
      service: 'oab-wix-api',
      message: 'API da Central OAB respondendo.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro no endpoint oabHealth:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Erro interno no endpoint de teste.',
    });
  }
}


const HOME_PUBLIC_BASE_URL = 'https://www.juizdefora-oabmg.org.br';

function normalizarDataHome(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const candidate =
    value && typeof value === 'object' && value.$date
      ? value.$date
      : value;

  const parsed = new Date(candidate);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dataIsoHome(value) {
  const parsed = normalizarDataHome(value);
  return parsed ? parsed.toISOString() : '';
}

function normalizarImagemHome(value) {
  const candidate =
    value && typeof value === 'object'
      ? value.url || value.src || value.fileUrl || value.uri
      : value;

  const raw = text(candidate);

  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(?:wix:)?image:\/\/v1\/([^/]+)/i);

  if (match && match[1]) {
    return `https://static.wixstatic.com/media/${match[1]}`;
  }

  return '';
}

function normalizarLinkHome(value, options = {}) {
  const raw = text(value);
  const allowRelative = options.allowRelative === true;

  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return allowRelative ? raw : `${HOME_PUBLIC_BASE_URL}${raw}`;
  }

  return '';
}

function resumirTextoHome(value, maxLength = 220) {
  const normalized = text(value).replace(/\s+/g, ' ');

  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function mapDestaqueHome(item = {}) {
  const priority = Number(item.prioridade);

  return {
    id: text(item._id),
    title: text(item.titulo),
    text: text(item.chamada),
    desktopImageUrl: normalizarImagemHome(item.imagemDesktop),
    mobileImageUrl:
      normalizarImagemHome(item.imagemMobile) ||
      normalizarImagemHome(item.imagemDesktop),
    imageAlt: text(item.imagemAlt) || text(item.titulo),
    ctaLabel: text(item.rotuloCta),
    ctaHref: normalizarLinkHome(item.linkCta, { allowRelative: true }),
    openInNewTab: item.abrirNovaAba === true,
    priority: Number.isFinite(priority) ? priority : 0,
  };
}

function destaqueHomeValido(item) {
  return !!item.id && !!item.title && !!item.desktopImageUrl;
}

function mapNoticiaHome(item = {}) {
  const slug = text(item.slug);
  const path =
    text(item.postPageUrl) ||
    (slug ? `/post/${slug}` : '');

  return {
    id: text(item.uuid) || text(item._id),
    title: text(item.title),
    excerpt: resumirTextoHome(item.excerpt || item.plainContent, 220),
    publishedAt: dataIsoHome(item.publishedDate || item.lastPublishedDate),
    imageUrl: normalizarImagemHome(item.coverImage),
    href: normalizarLinkHome(path),
  };
}

function noticiaHomeValida(item) {
  return (
    !!item.id &&
    !!item.title &&
    !!item.publishedAt &&
    !!item.href
  );
}

function mapEventoHome(item = {}) {
  const slug = text(item.slug);
  const path =
    text(item.siteEventPageUrl) ||
    (slug ? `/event-details/${slug}` : '');

  return {
    id: text(item._id),
    title: text(item.title),
    startAt: dataIsoHome(item.start),
    endAt: dataIsoHome(item.end),
    dateLabel: text(item.scheduleStartDateFormatted),
    timeLabel: text(item.scheduleStartTimeFormatted),
    location: text(item.locationName) || 'Local a confirmar',
    imageUrl: normalizarImagemHome(item.mainImage),
    href: normalizarLinkHome(path),
    registrationStatus: text(item.registrationStatus),
    format: text(item.type),
  };
}

function eventoHomeValido(item) {
  return (
    !!item.id &&
    !!item.title &&
    !!item.startAt &&
    !!item.href
  );
}

async function carregarDestaquesHome() {
  const now = new Date();
  const result = await wixData
    .query(COL.DESTAQUES_HOME)
    .eq('ativo', true)
    .descending('prioridade')
    .descending('_updatedDate')
    .limit(50)
    .find({ suppressAuth: true });

  return (result.items || [])
    .filter((item) => {
      const start = normalizarDataHome(item.inicio);
      const end = normalizarDataHome(item.fim);

      return (!start || start <= now) && (!end || end >= now);
    })
    .map(mapDestaqueHome)
    .filter(destaqueHomeValido)
    .sort((a, b) => {
      const priorityCompare = b.priority - a.priority;
      if (priorityCompare !== 0) return priorityCompare;
      return a.title.localeCompare(b.title, 'pt-BR');
    })
    .slice(0, 5);
}

async function carregarNoticiasHome() {
  const result = await wixData
    .query(COL.BLOG_POSTS)
    .eq('language', 'pt')
    .descending('publishedDate')
    .limit(4)
    .find({ suppressAuth: true });

  return (result.items || [])
    .map(mapNoticiaHome)
    .filter(noticiaHomeValida)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    )
    .slice(0, 4);
}

function noticiasPublicasNumero(value, fallback, min, max) {
  const raw = text(value);

  if (!raw) return fallback;

  const number = Number(raw);

  if (!Number.isInteger(number) || number < min || number > max) {
    return null;
  }

  return number;
}

function noticiasPublicasIncludeContent(value) {
  return ['1', 'true', 'sim', 'yes'].includes(text(value).toLowerCase());
}

function mapNoticiaPublica(item = {}, options = {}) {
  const includeContent = options.includeContent === true;
  const slug = text(item.slug);
  const legacyPath =
    text(item.postPageURL) ||
    text(item.postPageUrl) ||
    (slug ? `/post/${slug}` : '');
  const minutesToRead = Number(item.timeToRead);
  const mapped = {
    id: text(item.uuid) || text(item._id),
    slug,
    title: text(item.title),
    excerpt: resumirTextoHome(item.excerpt || item.plainContent, 320),
    publishedAt: dataIsoHome(item.publishedDate || item.lastPublishedDate),
    imageUrl:
      item.coverImageDisplayed === false
        ? ''
        : normalizarImagemHome(item.coverImage),
    href: slug ? `/noticias/${encodeURIComponent(slug)}` : normalizarLinkHome(legacyPath),
    legacyHref: normalizarLinkHome(legacyPath),
    minutesToRead:
      Number.isFinite(minutesToRead) && minutesToRead > 0
        ? Math.round(minutesToRead)
        : undefined,
    featured: item.featured === true,
    pinned: item.pinned === true,
  };

  if (includeContent) {
    mapped.contentText = text(item.plainContent);
    mapped.richContent =
      item.richContent && typeof item.richContent === 'object'
        ? item.richContent
        : null;
  }

  return mapped;
}

function noticiaPublicaValida(item = {}) {
  return (
    !!item.id &&
    !!item.slug &&
    !!item.title &&
    !!item.publishedAt &&
    !!item.href
  );
}

function mapNoticiaPublicaBlogApi(item = {}) {
  const slug = text(item.slug);
  const url = item.url && typeof item.url === 'object' ? item.url : {};
  const media = item.media && typeof item.media === 'object' ? item.media : {};
  const wixMedia =
    media.wixMedia && typeof media.wixMedia === 'object'
      ? media.wixMedia
      : {};
  const legacyPath = text(url.path) || (slug ? `/post/${slug}` : '');
  const minutesToRead = Number(item.minutesToRead);

  return {
    id: text(item._id) || text(item.id),
    slug,
    title: text(item.title),
    excerpt: resumirTextoHome(item.excerpt || item.contentText, 320),
    publishedAt: dataIsoHome(item.firstPublishedDate || item.lastPublishedDate),
    imageUrl:
      media.displayed === false
        ? ''
        : normalizarImagemHome(wixMedia.image || item.heroImage),
    href: slug
      ? `/noticias/${encodeURIComponent(slug)}`
      : normalizarLinkHome(legacyPath),
    legacyHref: normalizarLinkHome(legacyPath),
    minutesToRead:
      Number.isFinite(minutesToRead) && minutesToRead > 0
        ? Math.round(minutesToRead)
        : undefined,
    featured: item.featured === true,
    pinned: item.pinned === true,
    contentText: text(item.contentText),
    richContent:
      item.richContent && typeof item.richContent === 'object'
        ? item.richContent
        : null,
  };
}

async function carregarNoticiasConteudoPublico(options = {}) {
  const limit = options.limit;
  const cursor = text(options.cursor);
  const fieldsets = ['URL', 'CONTENT_TEXT', 'RICH_CONTENT'];

  let query = posts.queryPosts({ fieldsets });

  if (cursor) {
    query = query.skipTo(cursor).limit(limit);
  } else {
    query = query
      .eq('language', 'pt')
      .descending('firstPublishedDate')
      .limit(limit);
  }

  const [result, totalResult] = await Promise.all([
    query.find(),
    posts.getTotalPosts({ language: 'pt' }),
  ]);

  const items = (result.items || []).map(mapNoticiaPublicaBlogApi);
  const invalidItem = items.find((item) => !noticiaPublicaValida(item));

  if (invalidItem) {
    throw new Error(
      `Wix Blog API contém publicação sem contrato público válido: ${text(invalidItem.id) || 'sem-id'}`
    );
  }

  const total = Number(totalResult && totalResult.total);
  const nextCursor = text(result && result.cursors && result.cursors.next);
  const hasMore =
    typeof result.hasNext === 'function'
      ? result.hasNext()
      : !!nextCursor;

  return {
    total: Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : items.length,
    items,
    hasMore,
    nextCursor,
  };
}

async function carregarNoticiasPublicas(options = {}) {
  const offset = options.offset;
  const limit = options.limit;
  const includeContent = options.includeContent === true;

  const result = await wixData
    .query(COL.BLOG_POSTS)
    .eq('language', 'pt')
    .descending('publishedDate')
    .skip(offset)
    .limit(limit)
    .find({ suppressAuth: true });

  const rawItems = result.items || [];
  const items = rawItems.map((item) =>
    mapNoticiaPublica(item, { includeContent })
  );
  const invalidItem = items.find((item) => !noticiaPublicaValida(item));

  if (invalidItem) {
    throw new Error(
      `Blog/Posts contém publicação sem contrato público válido: ${text(invalidItem.id) || 'sem-id'}`
    );
  }

  const totalCount = Number(result.totalCount);
  const total = Number.isFinite(totalCount)
    ? Math.max(0, Math.trunc(totalCount))
    : offset + rawItems.length;

  return {
    total,
    items,
    hasMore: offset + rawItems.length < total,
  };
}

/**
 * GET /_functions/oabNoticias
 *
 * Lista notícias publicadas do Wix Blog (Blog/Posts).
 * O endpoint é paginado e só inclui richContent quando includeContent=1.
 * A coleção CMS News permanece reservada ao Espaço Estágio, Emprego e Oportunidades.
 */
export async function use_oabNoticias(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const offset = noticiasPublicasNumero(
      getQueryParam(request, 'offset'),
      0,
      0,
      100000
    );
    const limit = noticiasPublicasNumero(
      getQueryParam(request, 'limit'),
      50,
      1,
      100
    );

    if (offset === null || limit === null) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'PAGINACAO_INVALIDA',
        mensagem: 'offset deve ser inteiro >= 0 e limit deve estar entre 1 e 100.',
      });
    }

    const includeContent = noticiasPublicasIncludeContent(
      getQueryParam(request, ['includeContent', 'include_content'])
    );
    const result = await carregarNoticiasPublicas({
      offset,
      limit,
      includeContent,
    });

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=900',
      },
      body: {
        ok: true,
        version: 1,
        generatedAt: new Date().toISOString(),
        total: result.total,
        offset,
        limit,
        hasMore: result.hasMore,
        items: result.items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabNoticias:', err);

    return jsonServerError(request, {
      ok: false,
      version: 1,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar as notícias agora.',
    });
  }
}

/**
 * GET /_functions/oabNoticiasConteudo
 *
 * Entrega o conteúdo integral das notícias usando a API oficial do Wix Blog.
 * O fieldset RICH_CONTENT é obrigatório para que o corpo completo do post seja
 * retornado; Blog/Posts continua sendo usado pela listagem leve e pela Home.
 */
export async function use_oabNoticiasConteudo(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const limit = noticiasPublicasNumero(
      getQueryParam(request, 'limit'),
      50,
      1,
      100
    );

    if (limit === null) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'PAGINACAO_INVALIDA',
        mensagem: 'limit deve estar entre 1 e 100.',
      });
    }

    const cursor = text(getQueryParam(request, 'cursor'));
    const result = await carregarNoticiasConteudoPublico({ limit, cursor });

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=900',
      },
      body: {
        ok: true,
        version: 1,
        generatedAt: new Date().toISOString(),
        total: result.total,
        limit,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor || undefined,
        items: result.items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabNoticiasConteudo:', err);

    return jsonServerError(request, {
      ok: false,
      version: 1,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar o conteúdo completo das notícias agora.',
    });
  }
}

async function carregarEventosHome() {
  const now = new Date();
  const result = await wixData
    .query(COL.EVENTS)
    .eq('status', 'SCHEDULED')
    .ge('start', now)
    .ascending('start')
    .limit(12)
    .find({ suppressAuth: true });

  return (result.items || [])
    .map(mapEventoHome)
    .filter(eventoHomeValido)
    .filter((item) => new Date(item.startAt) >= now)
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() -
        new Date(b.startAt).getTime()
    )
    .slice(0, 4);
}


// ============================================================
// Site público — agenda completa de Eventos
// ============================================================

function eventoPublicoFormato(item = {}) {
  const textoLocal = [
    text(item.locationName),
    text(item.locationAddress),
  ]
    .join(' ')
    .toLowerCase();

  if (
    textoLocal.includes('online') ||
    textoLocal.includes('virtual') ||
    textoLocal.includes('zoom') ||
    textoLocal.includes('meet')
  ) {
    return 'ONLINE';
  }

  return 'PRESENCIAL';
}

function mapEventoPublico(item = {}) {
  const slug = text(item.slug);
  const fallbackPath = slug ? `/event-details/${slug}` : '';
  const detalhePath = text(item.siteEventPageUrl) || fallbackPath;
  const startAt = dataIsoHome(item.start);
  const endAt = dataIsoHome(item.end);
  const status = text(item.status).toUpperCase();
  const registrationType = text(item.type).toUpperCase() || 'NONE';
  const registrationStatus = text(item.registrationStatus).toUpperCase();
  const now = Date.now();

  const endTime = endAt ? new Date(endAt).getTime() : NaN;
  const startTime = startAt ? new Date(startAt).getTime() : NaN;

  return {
    id: text(item._id),
    title: text(item.title),
    slug,
    shortDescription: text(item.description),
    startAt,
    endAt,
    dateLabel: text(item.scheduleStartDateFormatted),
    timeLabel: text(item.scheduleStartTimeFormatted),
    scheduleLabel: text(item.scheduleFormatted),
    location: text(item.locationName) || 'Local a confirmar',
    locationAddress: text(item.locationAddress),
    imageUrl: normalizarImagemHome(item.mainImage),
    href: normalizarLinkHome(detalhePath),
    registrationUrl: normalizarLinkHome(item.registrationURL),
    registrationType,
    registrationStatus,
    lowestPriceFormatted: text(item.lowestPriceFormatted),
    highestPriceFormatted: text(item.highestPriceFormatted),
    status,
    format: eventoPublicoFormato(item),
    past:
      status === 'ENDED' ||
      (Number.isFinite(endTime) && endTime < now) ||
      (
        !Number.isFinite(endTime) &&
        Number.isFinite(startTime) &&
        startTime < now &&
        status !== 'STARTED'
      ),
  };
}

function eventoPublicoValido(item = {}) {
  const title = text(item.title);
  const status = text(item.status).toUpperCase();

  return (
    !!item.id &&
    !!title &&
    !!item.href &&
    status !== 'CANCELED' &&
    !title.toUpperCase().includes('TESTE INTERNO')
  );
}

async function carregarEventosPublicos() {
  const result = await wixData
    .query(COL.EVENTS)
    .descending('start')
    .limit(500)
    .find({ suppressAuth: true });

  const items = (result.items || [])
    .map(mapEventoPublico)
    .filter(eventoPublicoValido);

  const upcoming = items
    .filter((item) => !item.past)
    .sort(
      (a, b) =>
        new Date(a.startAt || 0).getTime() -
        new Date(b.startAt || 0).getTime()
    );

  const past = items
    .filter((item) => item.past)
    .sort(
      (a, b) =>
        new Date(b.startAt || 0).getTime() -
        new Date(a.startAt || 0).getTime()
    );

  return {
    items: [...upcoming, ...past],
    upcomingCount: upcoming.length,
    pastCount: past.length,
  };
}

/**
 * GET /_functions/oabEventosPublicos
 *
 * Agenda pública completa baseada em Events/Events.
 * Não expõe participantes, pedidos ou qualquer informação administrativa.
 */
export async function use_oabEventosPublicos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const result = await carregarEventosPublicos();

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=900',
      },
      body: {
        ok: true,
        version: 1,
        generatedAt: new Date().toISOString(),
        total: result.items.length,
        upcomingCount: result.upcomingCount,
        pastCount: result.pastCount,
        items: result.items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabEventosPublicos:', err);

    return jsonServerError(request, {
      ok: false,
      version: 1,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar a agenda de eventos agora.',
    });
  }
}


// ============================================================
// Site público — detalhe, RSVP e ticketing de Eventos v0.2
// ============================================================

const EVENTO_PUBLICO_ACTION_WINDOW_MS = 10 * 60 * 1000;
const EVENTO_PUBLICO_RSVP_MAX = 5;
const EVENTO_PUBLICO_RESERVA_MAX = 5;
const eventoPublicoRsvpRateLimit = new Map();
const eventoPublicoReservaRateLimit = new Map();

const EVENTO_PUBLICO_FIELDS = [
  'DETAILS',
  'TEXTS',
  'REGISTRATION',
  'URLS',
  'FORM',
  'SEO_SETTINGS',
];

const EVENTO_PUBLICO_RSVP_CONTROLS_SUPPORTED = new Set([
  'INPUT',
  'TEXTAREA',
  'DROPDOWN',
  'RADIO',
  'CHECKBOX',
  'NAME',
  'DATE',
]);

function eventoV020Slug(value) {
  const slug = text(value).toLowerCase();

  if (!/^[a-z0-9][a-z0-9-]{0,129}$/.test(slug)) {
    return '';
  }

  return slug;
}

function eventoV020DateIso(value) {
  return dataIsoHome(value);
}

function eventoV020Number(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function eventoV020Boolean(value) {
  return value === true;
}

function eventoV020First(...values) {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }

  return '';
}

function eventoV020RichTextToText(value) {
  const fragments = [];

  function walk(node) {
    if (node === null || node === undefined) return;

    if (typeof node === 'string' || typeof node === 'number') {
      const normalized = text(node);
      if (normalized) fragments.push(normalized);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node !== 'object') return;

    if (typeof node.text === 'string') {
      const normalized = text(node.text);
      if (normalized) fragments.push(normalized);
    }

    if (Array.isArray(node.nodes)) walk(node.nodes);
    if (Array.isArray(node.children)) walk(node.children);
    if (Array.isArray(node.content)) walk(node.content);

    if (node.document && typeof node.document === 'object') {
      walk(node.document);
    }
  }

  walk(value);

  return fragments
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function eventoV020NativeUrl(event = {}) {
  const base = text(event?.eventPageUrl?.base);
  const path = text(event?.eventPageUrl?.path);

  if (base && path) {
    try {
      return new URL(path, base).toString();
    } catch (err) {
      // usa fallback abaixo
    }
  }

  const slug = eventoV020Slug(event.slug);

  return slug
    ? `https://www.juizdefora-oabmg.org.br/event-details/${encodeURIComponent(slug)}`
    : '';
}

function eventoV020StreetAddress(address = {}) {
  const street = address?.streetAddress;

  if (!street) return '';

  if (typeof street === 'string') {
    return text(street);
  }

  if (typeof street !== 'object') {
    return '';
  }

  const name = eventoV020First(
    street.name,
    street.streetName
  );
  const number = eventoV020First(
    street.number,
    street.streetNumber
  );
  const complement = eventoV020First(
    street.apt,
    street.apartment,
    street.unit
  );

  const base = [name, number]
    .filter(Boolean)
    .join(', ');

  if (!complement) {
    return base;
  }

  return `${base}${base ? ' - ' : ''}${complement}`;
}

function eventoV020LocationAddress(event = {}) {
  const address = event?.location?.address;

  if (!address) return '';

  if (typeof address === 'string') {
    return text(address);
  }

  const formatted = eventoV020First(
    address.formattedAddress,
    address.formatted,
    address.fullAddress,
    address.addressLine
  );

  if (formatted) {
    return formatted;
  }

  const street = eventoV020StreetAddress(address);
  const city = text(address.city);
  const subdivision = eventoV020First(
    address.subdivision,
    address.state,
    address.region
  );
  const postalCode = eventoV020First(
    address.postalCode,
    address.zipCode
  );
  const country = eventoV020First(
    address.countryFullname,
    address.countryName,
    address.country
  );

  const locality =
    city && subdivision
      ? `${city} - ${subdivision}`
      : eventoV020First(city, subdivision);

  return [
    street,
    locality,
    postalCode,
    country,
  ]
    .filter(Boolean)
    .join(', ');
}

function eventoV020CalendarUrls(event = {}) {
  const urls = event.calendarUrls || event.calendarLinks || {};

  return {
    google: eventoV020First(
      urls.google,
      urls.googleCalendar,
      urls.googleCalendarUrl,
      urls.googleUrl
    ),
    ics: eventoV020First(
      urls.ics,
      urls.ical,
      urls.iCal,
      urls.icsUrl,
      urls.iCalUrl
    ),
  };
}

function eventoV020FormOptions(input = {}, control = {}) {
  const rawOptions = Array.isArray(input.options)
    ? input.options
    : Array.isArray(control.options)
      ? control.options
      : [];

  return rawOptions
    .map((option) => {
      if (option === null || option === undefined) return null;

      if (typeof option === 'string' || typeof option === 'number') {
        const value = text(option);
        return value ? { value, label: value } : null;
      }

      if (typeof option !== 'object') return null;

      const value = eventoV020First(
        option.value,
        option.id,
        option.key,
        option.label
      );

      if (!value) return null;

      return {
        value,
        label: eventoV020First(option.label, option.name, value),
      };
    })
    .filter(Boolean)
    .slice(0, 60);
}

function eventoV020FormFields(event = {}) {
  const controls = Array.isArray(event?.form?.controls)
    ? event.form.controls
    : [];
  const fields = [];
  let supported = true;

  for (const control of controls) {
    const controlType = text(
      control?.type || control?.controlType
    ).toUpperCase();

    if (
      controlType &&
      !EVENTO_PUBLICO_RSVP_CONTROLS_SUPPORTED.has(controlType)
    ) {
      supported = false;
    }

    const inputs = Array.isArray(control?.inputs)
      ? control.inputs
      : [];

    for (const input of inputs) {
      const name = text(input?.name);

      if (!name || name === 'rsvpStatus') continue;

      fields.push({
        name,
        label: eventoV020First(
          input?.label,
          control?.label,
          name === 'firstName'
            ? 'Nome'
            : name === 'lastName'
              ? 'Sobrenome'
              : name === 'email'
                ? 'E-mail'
                : name
        ),
        controlType: controlType || 'INPUT',
        inputType: text(input?.type).toUpperCase() || 'TEXT',
        required:
          input?.mandatory === true ||
          input?.required === true ||
          control?.mandatory === true ||
          control?.required === true,
        maxLength: Math.max(
          0,
          Math.min(
            5000,
            eventoV020Number(
              input?.maxLength || control?.maxLength,
              0
            )
          )
        ),
        options: eventoV020FormOptions(input, control),
      });
    }
  }

  const names = new Set(fields.map((field) => field.name));
  const hasSystemFields = ['firstName', 'lastName', 'email'].every(
    (name) => names.has(name)
  );

  return {
    fields,
    supported: supported && hasSystemFields,
  };
}

function eventoV020TicketDefinitions(raw = {}) {
  if (Array.isArray(raw)) return raw;

  const candidates = [
    raw.definitions,
    raw.ticketDefinitions,
    raw.items,
    raw.tickets,
  ];

  return (
    candidates.find((candidate) => Array.isArray(candidate)) || []
  );
}

function eventoV020TicketPrice(ticket = {}) {
  const raw = eventoV020First(
    ticket?.price?.value,
    ticket?.price?.amount,
    ticket?.fixedPrice?.value,
    ticket?.fixedPrice?.amount
  );

  const value = raw === '' ? null : Number(raw);

  return Number.isFinite(value) ? value : null;
}

function eventoV020TicketPricingType(ticket = {}) {
  return text(
    ticket?.pricing?.pricingType ||
    ticket?.pricingType
  ).toUpperCase();
}

function eventoV020TicketSupported(ticket = {}) {
  const pricingType = eventoV020TicketPricingType(ticket);
  const options =
    ticket?.pricing?.pricingOptions?.options ||
    ticket?.pricingOptions?.options ||
    ticket?.pricing?.options ||
    [];

  if (
    pricingType &&
    pricingType !== 'STANDARD'
  ) {
    return false;
  }

  if (Array.isArray(options) && options.length > 0) {
    return false;
  }

  return true;
}

function eventoV020MapTicket(ticket = {}, currencyFallback = 'BRL') {
  const priceValue = eventoV020TicketPrice(ticket);
  const currency = eventoV020First(
    ticket?.price?.currency,
    ticket?.fixedPrice?.currency,
    currencyFallback,
    'BRL'
  );

  let priceFormatted = eventoV020First(
    ticket?.priceFormatted,
    ticket?.formattedPrice
  );

  if (!priceFormatted && priceValue !== null) {
    try {
      priceFormatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency,
      }).format(priceValue);
    } catch (err) {
      priceFormatted = `R$ ${priceValue.toFixed(2).replace('.', ',')}`;
    }
  }

  return {
    id: eventoV020First(ticket?._id, ticket?.id),
    name: eventoV020First(ticket?.name, ticket?.title, 'Ingresso'),
    description: text(ticket?.description),
    free: ticket?.free === true || priceValue === 0,
    priceValue,
    currency,
    priceFormatted,
    limitPerCheckout: Math.max(
      0,
      eventoV020Number(ticket?.limitPerCheckout, 0)
    ),
    saleStatus: text(ticket?.saleStatus).toUpperCase(),
    feeType: text(ticket?.wixFeeConfig?.type).toUpperCase(),
    supported: eventoV020TicketSupported(ticket),
  };
}

async function eventoV020GetEventBySlug(slug) {
  const response = await wixEventsV2.getEventBySlug(slug, {
    fields: EVENTO_PUBLICO_FIELDS,
  });

  const event = response?.event || response;

  if (!event || !eventoV020First(event?._id, event?.id)) {
    return null;
  }

  return event;
}

async function eventoV020Load(slug, includeTickets = true) {
  const event = await eventoV020GetEventBySlug(slug);

  if (!event) return null;

  const status = text(event.status).toUpperCase();

  if (
    status === 'CANCELED' ||
    status === 'DRAFT' ||
    text(event.title).toUpperCase().includes('TESTE INTERNO')
  ) {
    return null;
  }

  const eventId = eventoV020First(event?._id, event?.id);
  const registration = event.registration || {};
  const registrationType = text(registration.type).toUpperCase();
  const registrationInitialType = text(
    registration.initialType
  ).toUpperCase();
  const registrationStatus = text(
    registration.status
  ).toUpperCase();

  const startAt = eventoV020DateIso(
    event?.dateAndTimeSettings?.startDate
  );
  const endAt = eventoV020DateIso(
    event?.dateAndTimeSettings?.endDate
  );

  const now = Date.now();
  const endMs = endAt ? new Date(endAt).getTime() : NaN;
  const startMs = startAt ? new Date(startAt).getTime() : NaN;

  const past =
    status === 'ENDED' ||
    (Number.isFinite(endMs) && endMs < now) ||
    (
      !Number.isFinite(endMs) &&
      Number.isFinite(startMs) &&
      startMs < now &&
      status !== 'STARTED'
    );

  const form = eventoV020FormFields(event);
  const nativeUrl = eventoV020NativeUrl(event);

  let rawTickets = [];
  let tickets = [];

  if (
    includeTickets &&
    registrationType === 'TICKETING' &&
    eventId
  ) {
    try {
      const ticketResponse = await orders.listAvailableTickets({
        eventId,
        limit: 100,
      });

      rawTickets = eventoV020TicketDefinitions(ticketResponse);
      const currency = eventoV020First(
        registration?.tickets?.lowestPrice?.currency,
        'BRL'
      );

      tickets = rawTickets
        .map((ticket) => eventoV020MapTicket(ticket, currency))
        .filter((ticket) => ticket.id);
    } catch (err) {
      console.warn('Eventos público: ingressos indisponíveis.', {
        eventId,
      });
    }
  }

  const soldOut =
    registration?.tickets?.soldOut === true ||
    registrationStatus.includes('SOLD_OUT');

  const ticketLimitPerOrder = Math.max(
    1,
    Math.min(
      50,
      eventoV020Number(
        registration?.tickets?.limitPerOrder ||
        registration?.tickets?.ticketLimitPerOrder,
        50
      )
    )
  );

  const reservationDurationInMinutes = Math.max(
    0,
    eventoV020Number(
      registration?.tickets?.reservationDurationInMinutes ||
      event?.reservationDurationInMinutes,
      0
    )
  );

  const externalRegistrationUrl = eventoV020First(
    registration?.external?.url,
    registration?.externalUrl
  );

  const customRsvpSupported =
    !past &&
    registrationType === 'RSVP' &&
    registrationInitialType === 'RSVP' &&
    !registrationStatus.includes('CLOSED') &&
    form.supported;

  const customTicketingSupported =
    !past &&
    registrationType === 'TICKETING' &&
    registrationInitialType === 'TICKETING' &&
    !registrationStatus.includes('CLOSED') &&
    !soldOut &&
    tickets.length > 0 &&
    tickets.every((ticket) => ticket.supported);

  return {
    rawEvent: event,
    rawTickets,
    publicEvent: {
      id: eventId,
      title: text(event.title),
      slug: eventoV020Slug(event.slug),
      shortDescription: text(event.shortDescription),
      description: eventoV020First(
        event.detailedDescription,
        eventoV020RichTextToText(event.description)
      ),
      imageUrl: normalizarImagemHome(event.mainImage),
      startAt,
      endAt,
      locationType: text(event?.location?.type).toUpperCase(),
      location: eventoV020First(
        event?.location?.name,
        event?.location?.type === 'ONLINE'
          ? 'Evento online'
          : ''
      ),
      locationAddress: eventoV020LocationAddress(event),
      status,
      past,
      nativeUrl,
      externalRegistrationUrl,
      registrationType,
      registrationStatus,
      registrationInitialType,
      soldOut,
      ticketLimitPerOrder,
      reservationDurationInMinutes,
      customRsvpSupported,
      rsvpSubmitStatus:
        registrationStatus.includes('WAITLIST')
          ? 'WAITLIST'
          : 'YES',
      customTicketingSupported,
      formFields: form.fields,
      tickets,
      calendarUrls: eventoV020CalendarUrls(event),
    },
  };
}

function eventoV020RateLimit(store, request, suffix = '') {
  const now = Date.now();

  for (const [key, entry] of store.entries()) {
    if (
      !entry ||
      !Number.isFinite(entry.startedAt) ||
      now - entry.startedAt >= EVENTO_PUBLICO_ACTION_WINDOW_MS
    ) {
      store.delete(key);
    }
  }

  const ip = getClientIp(request) || 'sem-ip';
  const key = `${ip}|${text(suffix).toLowerCase().slice(0, 180)}`;
  const current = store.get(key);

  if (
    !current ||
    now - current.startedAt >= EVENTO_PUBLICO_ACTION_WINDOW_MS
  ) {
    store.set(key, {
      startedAt: now,
      count: 1,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    count: current.count,
  };
}

function eventoV020RateLimitAllowed(result, max) {
  return !result.count || result.count <= max;
}

function eventoV020Email(value) {
  const email = text(value).toLowerCase();

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return '';
  }

  return email;
}

function eventoV020InputValue(field, value) {
  const options = Array.isArray(field.options)
    ? field.options
    : [];

  if (field.controlType === 'CHECKBOX') {
    const values = Array.isArray(value)
      ? value.map(text).filter(Boolean)
      : [];

    const allowed = new Set(options.map((option) => option.value));

    if (
      allowed.size &&
      values.some((item) => !allowed.has(item))
    ) {
      throw new Error(`Valor inválido para ${field.label}.`);
    }

    if (field.required && values.length === 0) {
      throw new Error(`Preencha o campo ${field.label}.`);
    }

    return {
      inputName: field.name,
      value: '',
      values,
    };
  }

  const normalized = text(value);

  if (field.required && !normalized) {
    throw new Error(`Preencha o campo ${field.label}.`);
  }

  if (
    field.maxLength > 0 &&
    normalized.length > field.maxLength
  ) {
    throw new Error(
      `O campo ${field.label} ultrapassa o limite permitido.`
    );
  }

  if (
    options.length &&
    normalized &&
    !options.some((option) => option.value === normalized)
  ) {
    throw new Error(`Valor inválido para ${field.label}.`);
  }

  return {
    inputName: field.name,
    value: normalized,
  };
}

function eventoV020BuildRsvp(evento, values = {}, status = 'YES') {
  const allowedStatus =
    evento.rsvpSubmitStatus === 'WAITLIST'
      ? 'WAITLIST'
      : 'YES';

  if (status !== allowedStatus) {
    throw new Error('Status de inscrição inválido.');
  }

  const inputValues = evento.formFields.map((field) =>
    eventoV020InputValue(field, values[field.name])
  );

  const firstName = text(values.firstName);
  const lastName = text(values.lastName);
  const email = eventoV020Email(values.email);

  if (!firstName || firstName.length > 50) {
    throw new Error('Informe um nome válido.');
  }

  if (!lastName || lastName.length > 50) {
    throw new Error('Informe um sobrenome válido.');
  }

  if (!email) {
    throw new Error('Informe um e-mail válido.');
  }

  return {
    eventId: evento.id,
    firstName,
    lastName,
    email,
    form: {
      inputValues,
    },
    status: allowedStatus,
    additionalGuestDetails: {
      guestCount: 0,
      guestNames: [],
    },
  };
}

function eventoV020CheckoutUrl(evento, reservationId) {
  const nativeUrl = text(evento.nativeUrl);
  const id = text(reservationId);

  if (!nativeUrl || !id) return '';

  return `${nativeUrl.replace(/\/+$/, '')}/ticket-form?reservationId=${encodeURIComponent(id)}`;
}

function eventoV020ReservationId(result = {}) {
  return eventoV020First(
    result?._id,
    result?.id,
    result?.reservationId,
    result?.reservation?._id,
    result?.reservation?.id
  );
}

function eventoV020ReservationExpiration(result = {}) {
  return eventoV020DateIso(
    result?.expirationDate ||
    result?.expirationTime ||
    result?.expires ||
    result?.reservation?.expirationDate
  );
}

/**
 * GET /_functions/oabEventoPublico?slug={slug}
 */
export async function use_oabEventoPublico(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 2,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const slug = eventoV020Slug(
      getQueryParam(request, ['slug', 'eventSlug'])
    );

    if (!slug) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'SLUG_INVALIDO',
        mensagem: 'Evento não identificado.',
      });
    }

    const result = await eventoV020Load(slug, true);

    if (!result) {
      return jsonNotFound(request, {
        ok: false,
        version: 2,
        codigo: 'EVENTO_NAO_ENCONTRADO',
        mensagem: 'Evento não encontrado.',
      });
    }

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control':
          'public, max-age=60, stale-while-revalidate=300',
      },
      body: {
        ok: true,
        version: 2,
        event: result.publicEvent,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabEventoPublico:', {
      mensagem: text(err?.message).slice(0, 180),
    });

    return jsonServerError(request, {
      ok: false,
      version: 2,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar este evento agora.',
    });
  }
}

/**
 * POST /_functions/oabEventoRsvp
 */
export async function use_oabEventoRsvp(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 2,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada.',
      });
    }

    const payload = await readJsonBody(request);
    const slug = eventoV020Slug(payload?.slug);
    const values =
      payload?.values && typeof payload.values === 'object'
        ? payload.values
        : {};
    const email = eventoV020Email(values.email);

    if (!slug) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'SLUG_INVALIDO',
        mensagem: 'Evento não identificado.',
      });
    }

    const rate = eventoV020RateLimit(
      eventoPublicoRsvpRateLimit,
      request,
      email || slug
    );

    if (!eventoV020RateLimitAllowed(rate, EVENTO_PUBLICO_RSVP_MAX)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitas tentativas foram realizadas em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rate.retryAfterSeconds,
      });
    }

    const result = await eventoV020Load(slug, false);

    if (!result) {
      return jsonNotFound(request, {
        ok: false,
        version: 2,
        codigo: 'EVENTO_NAO_ENCONTRADO',
        mensagem: 'Evento não encontrado.',
      });
    }

    if (!result.publicEvent.customRsvpSupported) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'RSVP_CUSTOM_NAO_SUPORTADO',
        mensagem:
          'A inscrição deste evento deve ser concluída no formulário oficial do Wix.',
      });
    }

    let rsvpPayload;

    try {
      rsvpPayload = eventoV020BuildRsvp(
        result.publicEvent,
        values,
        text(payload?.status).toUpperCase() || 'YES'
      );
    } catch (validationError) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'DADOS_INVALIDOS',
        mensagem:
          text(validationError?.message) ||
          'Revise os campos da inscrição.',
      });
    }

    const createdResponse = await rsvpV2.createRsvp({
      rsvp: rsvpPayload,
    });

    const created =
      createdResponse?.rsvp ||
      createdResponse?.entity ||
      createdResponse;

    return jsonOk(request, {
      ok: true,
      version: 2,
      mensagem:
        rsvpPayload.status === 'WAITLIST'
          ? 'Você entrou na lista de espera. Confira seu e-mail para acompanhar as próximas atualizações.'
          : 'Inscrição confirmada. Confira seu e-mail para as informações do evento.',
      rsvpId: eventoV020First(created?._id, created?.id),
      status: text(created?.status || rsvpPayload.status).toUpperCase(),
      calendarUrls: eventoV020CalendarUrls(
        createdResponse?.calendarLinks ||
        createdResponse?.calendarUrls ||
        {}
      ),
    });
  } catch (err) {
    console.error('Erro no endpoint oabEventoRsvp:', {
      mensagem: text(err?.message).slice(0, 180),
    });

    return jsonServerError(request, {
      ok: false,
      version: 2,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível concluir sua inscrição agora. Tente novamente em alguns instantes.',
    });
  }
}

/**
 * POST /_functions/oabEventoReservarIngressos
 *
 * Cria somente a reserva temporária. Dados de participante,
 * pagamento e meios de pagamento continuam no checkout hospedado
 * pelo Wix.
 */
export async function use_oabEventoReservarIngressos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 2,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada.',
      });
    }

    const payload = await readJsonBody(request);
    const slug = eventoV020Slug(payload?.slug);
    const requestedTickets = Array.isArray(payload?.tickets)
      ? payload.tickets
      : [];

    if (!slug) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'SLUG_INVALIDO',
        mensagem: 'Evento não identificado.',
      });
    }

    if (
      requestedTickets.length === 0 ||
      requestedTickets.length > 20
    ) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'INGRESSOS_INVALIDOS',
        mensagem: 'Selecione pelo menos um ingresso.',
      });
    }

    const rate = eventoV020RateLimit(
      eventoPublicoReservaRateLimit,
      request,
      slug
    );

    if (!eventoV020RateLimitAllowed(rate, EVENTO_PUBLICO_RESERVA_MAX)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitas reservas foram iniciadas em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rate.retryAfterSeconds,
      });
    }

    const result = await eventoV020Load(slug, true);

    if (!result) {
      return jsonNotFound(request, {
        ok: false,
        version: 2,
        codigo: 'EVENTO_NAO_ENCONTRADO',
        mensagem: 'Evento não encontrado.',
      });
    }

    const evento = result.publicEvent;

    if (!evento.customTicketingSupported) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'TICKETING_CUSTOM_NAO_SUPORTADO',
        mensagem:
          'A compra deste evento deve ser concluída no checkout oficial do Wix.',
      });
    }

    const definitions = new Map(
      evento.tickets.map((ticket) => [ticket.id, ticket])
    );

    let totalQuantity = 0;
    const ticketQuantities = [];

    for (const requested of requestedTickets) {
      const ticketDefinitionId = eventoV020First(
        requested?.ticketDefinitionId,
        requested?.id
      );

      const quantity = Number(requested?.quantity);
      const definition = definitions.get(ticketDefinitionId);

      if (
        !definition ||
        !definition.supported ||
        definition.saleStatus !== 'SALE_STARTED' ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return jsonBadRequest(request, {
          ok: false,
          version: 2,
          codigo: 'INGRESSO_INDISPONIVEL',
          mensagem:
            'Um dos ingressos selecionados não está disponível. Atualize a página e tente novamente.',
        });
      }

      const limit = definition.limitPerCheckout > 0
        ? Math.min(
            definition.limitPerCheckout,
            evento.ticketLimitPerOrder
          )
        : evento.ticketLimitPerOrder;

      if (quantity > limit) {
        return jsonBadRequest(request, {
          ok: false,
          version: 2,
          codigo: 'LIMITE_INGRESSOS',
          mensagem:
            `O ingresso “${definition.name}” permite até ${limit} unidade${limit === 1 ? '' : 's'} por pedido.`,
        });
      }

      totalQuantity += quantity;

      ticketQuantities.push({
        ticketDefinitionId,
        quantity,
      });
    }

    if (
      totalQuantity < 1 ||
      totalQuantity > evento.ticketLimitPerOrder
    ) {
      return jsonBadRequest(request, {
        ok: false,
        version: 2,
        codigo: 'LIMITE_INGRESSOS',
        mensagem:
          `Este evento permite até ${evento.ticketLimitPerOrder} ingresso${evento.ticketLimitPerOrder === 1 ? '' : 's'} por pedido.`,
      });
    }

    const reservation = await orders.createReservation(
      evento.id,
      {
        ticketQuantities,
      }
    );

    const reservationId = eventoV020ReservationId(reservation);

    if (!reservationId) {
      console.error(
        'Eventos público: Wix criou resposta de reserva sem ID.',
        {
          eventId: evento.id,
        }
      );

      return jsonServerError(request, {
        ok: false,
        version: 2,
        codigo: 'RESERVA_SEM_ID',
        mensagem:
          'Não foi possível iniciar o checkout agora. Tente novamente.',
      });
    }

    const checkoutUrl = eventoV020CheckoutUrl(
      evento,
      reservationId
    );

    if (!checkoutUrl) {
      try {
        await orders.cancelReservation(
          reservationId,
          evento.id
        );
      } catch (cancelError) {
        console.warn(
          'Eventos público: não foi possível cancelar reserva sem checkout URL.',
          {
            eventId: evento.id,
            reservationId,
          }
        );
      }

      return jsonServerError(request, {
        ok: false,
        version: 2,
        codigo: 'CHECKOUT_INDISPONIVEL',
        mensagem:
          'Não foi possível abrir o checkout agora. Tente novamente.',
      });
    }

    return jsonOk(request, {
      ok: true,
      version: 2,
      reservationId,
      expirationDate: eventoV020ReservationExpiration(reservation),
      checkoutUrl,
      mensagem:
        'Ingressos reservados temporariamente. Continue no checkout seguro para concluir a compra.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabEventoReservarIngressos:', {
      mensagem: text(err?.message).slice(0, 180),
    });

    return jsonServerError(request, {
      ok: false,
      version: 2,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível reservar os ingressos agora. Atualize a página e tente novamente.',
    });
  }
}


/**
 * GET /_functions/oabHome
 *
 * Entrega o banner editorial da Home, as notícias publicadas mais recentes e
 * os próximos eventos. O contrato contém apenas campos necessários à página
 * pública e mantém os links editoriais no site atualmente publicado.
 */
export async function use_oabHome(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const [banners, news, events] = await Promise.all([
      carregarDestaquesHome(),
      carregarNoticiasHome(),
      carregarEventosHome(),
    ]);
    const banner = banners[0] || null;

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=900',
      },
      body: {
        ok: true,
        version: 1,
        generatedAt: new Date().toISOString(),
        banner,
        banners,
        news,
        events,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabHome:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar o conteúdo da Home agora.',
    });
  }
}

export async function use_oabSalasApoio(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const result = await wixData
      .query(COL.SALAS_APOIO)
      .limit(100)
      .find({ suppressAuth: true });

    const items = (result.items || [])
      .map(mapSalaApoio)
      .filter(filtrarSalaApoioValida)
      .sort((a, b) => {
        const cityCompare = a.city.localeCompare(b.city, 'pt-BR');

        if (cityCompare !== 0) {
          return cityCompare;
        }

        return a.title.localeCompare(b.title, 'pt-BR');
      });

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
      body: {
        ok: true,
        version: 1,
        total: items.length,
        items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabSalasApoio:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar as salas de apoio.',
    });
  }
}



/**
 * GET /_functions/oabPaginasInstitucionais?secao=institucional
 *
 * Lista todas as páginas institucionais ativas para geração estática,
 * navegação contextual e fallback de rotas no novo site.
 */
export async function use_oabPaginasInstitucionais(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const secao = normalizarSecaoPaginaInstitucional(
      getQueryParam(request, ['secao', 'section'])
    );

    if (secao && secao.length > 80) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'SECAO_INVALIDA',
        mensagem: 'Informe uma seção válida.',
      });
    }

    let query = wixData
      .query(COL.PAGINAS_INSTITUCIONAIS)
      .eq('ativo', true);

    if (secao) {
      query = query.eq('secao', secao);
    }

    const result = await query
      .ascending('ordem')
      .ascending('titulo')
      .limit(100)
      .find({ suppressAuth: true });

    const items = (result.items || [])
      .map(mapPaginaInstitucional)
      .filter(filtrarPaginaInstitucionalValida)
      .sort((a, b) => {
        const sectionCompare = a.section.localeCompare(b.section, 'pt-BR');

        if (sectionCompare !== 0) {
          return sectionCompare;
        }

        const orderCompare = a.order - b.order;

        if (orderCompare !== 0) {
          return orderCompare;
        }

        return a.navigationLabel.localeCompare(b.navigationLabel, 'pt-BR');
      });

    const uniqueSlugs = new Set(items.map((item) => item.slug));

    if (uniqueSlugs.size !== items.length) {
      throw new Error(
        'A coleção PaginasInstitucionais possui slugs ativos duplicados.'
      );
    }

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
      body: {
        ok: true,
        version: 1,
        section: secao || null,
        total: items.length,
        items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabPaginasInstitucionais:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível listar as páginas institucionais agora.',
    });
  }
}

/**
 * GET /_functions/oabPaginaInstitucional?slug=caa-mg-em-jf
 *
 * Entrega conteúdo editorial público do CMS para o novo site estático.
 */
export async function use_oabPaginaInstitucional(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const slug = normalizarSlugPaginaInstitucional(
      getQueryParam(request, ['slug', 'pagina', 'path'])
    );

    if (!slug || slug.length > 120) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'SLUG_INVALIDO',
        mensagem: 'Informe um slug de página válido.',
      });
    }

    const result = await wixData
      .query(COL.PAGINAS_INSTITUCIONAIS)
      .eq('slug', slug)
      .eq('ativo', true)
      .descending('_updatedDate')
      .limit(1)
      .find({ suppressAuth: true });

    const itemCms = (result.items || [])[0];

    if (!itemCms) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'PAGINA_NAO_ENCONTRADA',
        mensagem: 'Página institucional não encontrada ou inativa.',
      });
    }

    const item = mapPaginaInstitucional(itemCms);

    if (!filtrarPaginaInstitucionalValida(item)) {
      throw new Error(
        `Página institucional ${slug} possui dados obrigatórios inválidos.`
      );
    }

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
      body: {
        ok: true,
        version: 1,
        item,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabPaginaInstitucional:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar a página institucional agora.',
    });
  }
}


/**
 * GET /_functions/oabEstruturaInstitucional
 * GET /_functions/oabEstruturaInstitucional?tipo=comissao
 * GET /_functions/oabEstruturaInstitucional?slug=comissao-de-direito-administrativo
 *
 * Entrega a gestão vigente, órgãos e vínculos públicos usados nas páginas de
 * Diretoria, Conselho Subseccional, Comissões e Núcleos do novo site.
 */
export async function use_oabEstruturaInstitucional(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const rawType = getQueryParam(request, ['tipo', 'type']);
    const type = normalizarTipoOrgaoInstitucional(rawType);
    const slug = normalizarSlugPaginaInstitucional(
      getQueryParam(request, ['slug', 'orgao', 'organization'])
    );

    if (rawType && !type) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'TIPO_INVALIDO',
        mensagem: 'Informe um tipo institucional válido.',
      });
    }

    if (slug && slug.length > 160) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'SLUG_INVALIDO',
        mensagem: 'Informe um slug institucional válido.',
      });
    }

    const structure = await montarEstruturaInstitucionalAtual({
      type,
      slug,
    });

    if (slug && structure.items.length === 0) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'ORGAO_NAO_ENCONTRADO',
        mensagem: 'Órgão institucional não encontrado ou inativo.',
      });
    }

    const uniqueSlugs = new Set(
      structure.items.map((item) => item.slug)
    );

    if (uniqueSlugs.size !== structure.items.length) {
      throw new Error(
        'A coleção OrgaosInstitucionais possui slugs ativos duplicados.'
      );
    }

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
      body: {
        ok: true,
        version: 1,
        management: structure.management,
        filter: {
          type: type || null,
          slug: slug || null,
        },
        total: structure.items.length,
        items: structure.items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabEstruturaInstitucional:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar a estrutura institucional agora.',
    });
  }
}


/**
 * GET /_functions/oabConvenios
 * GET /_functions/oabConvenios?slug=nome-do-convenio
 *
 * Expõe somente convênios publicados e marcados como ativos.
 */
export async function use_oabConvenios(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const slug = normalizarSlugPublico(
      getQueryParam(request, ['slug', 'convenio', 'agreement'])
    );
    const allItems = await carregarConveniosPublicos();
    const items = slug
      ? allItems.filter((item) => item.slug === slug)
      : allItems;

    if (slug && items.length === 0) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'CONVENIO_NAO_ENCONTRADO',
        mensagem: 'Convênio não encontrado ou inativo.',
      });
    }

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
      body: {
        ok: true,
        version: 1,
        filter: { slug: slug || null },
        total: items.length,
        items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabConvenios:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar os convênios agora.',
    });
  }
}

/**
 * GET /_functions/oabCorrespondentes
 *
 * Entrega somente os dados necessários ao diretório público. Número da OAB,
 * endereço completo, proprietário e demais campos internos não fazem parte do contrato.
 */
export async function use_oabCorrespondentes(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const items = await carregarCorrespondentesPublicos();

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
      body: {
        ok: true,
        version: 1,
        total: items.length,
        items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabCorrespondentes:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar os correspondentes agora.',
    });
  }
}

/**
 * GET /_functions/oabOportunidades
 *
 * Usa a publicação do CMS como aprovação editorial e remove automaticamente
 * itens vencidos. Currículos e documentos anexados nunca são expostos.
 */
export async function use_oabOportunidades(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const items = await carregarOportunidadesPublicas();

    return ok({
      headers: {
        ...getCorsHeaders(request),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
      },
      body: {
        ok: true,
        version: 1,
        generatedAt: new Date().toISOString(),
        total: items.length,
        items,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabOportunidades:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar as oportunidades agora.',
    });
  }
}


/**
 * POST /_functions/oabCadastrarCorrespondente
 *
 * Recebe um cadastro público, valida os dados e cria um item pendente na
 * coleção de Correspondentes. O número da OAB e o endereço completo ficam
 * restritos ao CMS e não fazem parte do endpoint público de consulta.
 */
export async function use_oabCadastrarCorrespondente(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedCadastroOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada para este formulário.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadCadastroCorrespondente(payload);

    if (deveIgnorarCadastroComoSpam(dados)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        mensagem:
          'Cadastro recebido. A publicação ocorrerá após análise da equipe.',
        submissionId: gerarIdIgnoradoFormulario('correspondente'),
        status: 'PENDENTE',
      });
    }

    const erros = validarPayloadCadastroCorrespondente(dados);

    if (Object.keys(erros).length > 0) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise os campos indicados e tente novamente.',
        erros,
      });
    }

    const rateLimit = consumirRateLimitCadastro(
      cadastroCorrespondenteRateLimit,
      request,
      dados.email
    );

    if (!rateLimit.allowed) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitos cadastros foram enviados em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const submissionId = await criarCadastroCorrespondente(dados);

    return jsonOk(request, {
      ok: true,
      version: 1,
      mensagem:
        'Cadastro recebido. A publicação ocorrerá após análise da equipe.',
      submissionId,
      status: 'PENDENTE',
    });
  } catch (err) {
    console.error(
      'Erro no endpoint oabCadastrarCorrespondente:',
      normalizarMensagemErroApi(err)
    );

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível registrar o cadastro agora. Tente novamente em alguns minutos.',
    });
  }
}

/**
 * POST /_functions/oabPrepararCurriculoOportunidade
 *
 * Gera uma URL temporária e de uso único para o navegador enviar diretamente
 * um currículo privado ao Media Manager, sem trafegar o arquivo em base64 pela
 * função HTTP de cadastro.
 */
export async function use_oabPrepararCurriculoOportunidade(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedCadastroOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada para este formulário.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadPrepararCurriculo(payload);

    if (deveIgnorarCadastroComoSpam(dados)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        skipped: true,
      });
    }

    const erros = validarPayloadPrepararCurriculo(dados);

    if (Object.keys(erros).length > 0) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise o currículo selecionado e tente novamente.',
        erros,
      });
    }

    const rateLimit = consumirRateLimitCadastro(
      preparoCurriculoOportunidadeRateLimit,
      request,
      dados.email,
      CURRICULO_PREPARO_RATE_LIMIT_MAX
    );

    if (!rateLimit.allowed) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitos envios de currículo foram iniciados em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const prepared = await prepararUploadCurriculoOportunidade(dados);

    return jsonOk(request, {
      ok: true,
      version: 1,
      uploadUrl: prepared.uploadUrl,
      fileName: prepared.fileName,
      mimeType: dados.mimeType,
      maxBytes: OPORTUNIDADE_RESUME_MAX_BYTES,
    });
  } catch (err) {
    console.error(
      'Erro no endpoint oabPrepararCurriculoOportunidade:',
      normalizarMensagemErroApi(err)
    );

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível preparar o envio do currículo agora. Tente novamente em alguns minutos.',
    });
  }
}

/**
 * POST /_functions/oabCadastrarOportunidade
 *
 * Recebe uma oportunidade pública e a cria como item pendente no CMS. O
 * currículo opcional é confirmado como documento privado e nunca é devolvido
 * pelo endpoint público de Oportunidades.
 */
export async function use_oabCadastrarOportunidade(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedCadastroOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada para este formulário.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadCadastroOportunidade(payload);

    if (deveIgnorarCadastroComoSpam(dados)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        mensagem:
          'Oportunidade recebida. A publicação ocorrerá após análise da equipe.',
        submissionId: gerarIdIgnoradoFormulario('oportunidade'),
        status: 'PENDENTE',
      });
    }

    const erros = validarPayloadCadastroOportunidade(dados);

    if (Object.keys(erros).length > 0) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise os campos indicados e tente novamente.',
        erros,
      });
    }

    const rateLimit = consumirRateLimitCadastro(
      cadastroOportunidadeRateLimit,
      request,
      dados.email
    );

    if (!rateLimit.allowed) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitas oportunidades foram enviadas em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    let curriculoUrl = '';

    if (dados.resume.fileUrl) {
      try {
        curriculoUrl = await validarCurriculoEnviadoOportunidade(dados.resume);
      } catch (uploadError) {
        console.warn(
          'Currículo rejeitado no cadastro de oportunidade:',
          normalizarMensagemErroApi(uploadError)
        );

        return jsonBadRequest(request, {
          ok: false,
          codigo: 'CURRICULO_INVALIDO',
          mensagem: 'Revise o currículo selecionado e tente novamente.',
          erros: {
            resume:
              'Não foi possível confirmar o currículo privado enviado. Selecione novamente um arquivo PDF, DOC ou DOCX de até 5 MB.',
          },
        });
      }
    }

    const submissionId = await criarCadastroOportunidade(
      dados,
      curriculoUrl
    );

    return jsonOk(request, {
      ok: true,
      version: 1,
      mensagem:
        'Oportunidade recebida. A publicação ocorrerá após análise da equipe.',
      submissionId,
      status: 'PENDENTE',
    });
  } catch (err) {
    console.error(
      'Erro no endpoint oabCadastrarOportunidade:',
      normalizarMensagemErroApi(err)
    );

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível registrar a oportunidade agora. Tente novamente em alguns minutos.',
    });
  }
}

/**
 * POST /_functions/oabFalePresidente
 *
 * Reutiliza o formulário Wix “Fale com o Presidente” e preserva sua
 * automação, seus registros e o vínculo com os contatos do Wix.
 */
/**
 * POST /_functions/oabAnexoDenunciaPropaganda
 *
 * Recebe um único anexo em Base64, valida formato e limite de 2 MB e salva
 * o arquivo como privado no Media Manager. A referência devolvida só pode
 * ser confirmada pelo endpoint final da denúncia.
 */
export async function use_oabAnexoDenunciaPropaganda(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedCadastroOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada para este formulário.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadAnexoDenuncia(payload);
    const erros = validarPayloadAnexoDenuncia(dados);

    if (Object.keys(erros).length > 0) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise o anexo selecionado e tente novamente.',
        erros,
      });
    }

    const rateLimit = consumirRateLimitCadastro(
      denunciaPropagandaUploadRateLimit,
      request,
      dados.reporter || 'anexo-denuncia',
      DENUNCIA_PROPAGANDA_UPLOAD_RATE_LIMIT_MAX
    );

    if (!rateLimit.allowed) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitos anexos foram enviados em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const attachment = await uploadAnexoDenunciaPrivado(dados);

    return jsonOk(request, {
      ok: true,
      version: 1,
      attachment,
      maxBytes: DENUNCIA_PROPAGANDA_MAX_BYTES,
      mensagem: 'Anexo protegido e preparado para a denúncia.',
    });
  } catch (err) {
    console.error(
      'Erro no endpoint oabAnexoDenunciaPropaganda:',
      normalizarMensagemErroApi(err)
    );

    return jsonServerError(request, {
      ok: false,
      version: 1,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível enviar o anexo agora. Tente novamente em alguns minutos.',
    });
  }
}

/**
 * POST /_functions/oabDenunciaPropagandaIrregular
 *
 * Registra a denúncia no Wix Forms e, quando houver anexos, confirma que os
 * arquivos pertencem ao fluxo, correspondem ao conteúdo informado e estão
 * privados antes de associar suas referências à submissão.
 */
export async function use_oabDenunciaPropagandaIrregular(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedCadastroOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada para este formulário.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadDenunciaPropaganda(payload);

    if (deveIgnorarDenunciaPropagandaComoSpam(dados)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        submissionId: gerarIdIgnoradoFormulario('denuncia-propaganda'),
        status: 'IGNORADO',
        mensagem: 'Denúncia recebida para análise.',
      });
    }

    const erros = validarPayloadDenunciaPropaganda(dados);

    if (Object.keys(erros).length > 0) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise os campos indicados e tente novamente.',
        erros,
      });
    }

    const rateLimit = consumirRateLimitCadastro(
      denunciaPropagandaRateLimit,
      request,
      dados.reporter,
      DENUNCIA_PROPAGANDA_RATE_LIMIT_MAX
    );

    if (!rateLimit.allowed) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitas denúncias foram enviadas em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    let imagemPrivada = null;
    let videoPrivado = null;

    try {
      imagemPrivada = await validarAnexoEnviadoDenuncia(
        dados.image,
        'imagem'
      );
    } catch (uploadError) {
      console.warn(
        'Imagem rejeitada na denúncia de propaganda irregular:',
        normalizarMensagemErroApi(uploadError)
      );

      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise a imagem anexada e tente novamente.',
        erros: {
          image:
            'Não foi possível confirmar a imagem protegida. Selecione novamente um arquivo de até 2 MB.',
        },
      });
    }

    try {
      videoPrivado = await validarAnexoEnviadoDenuncia(
        dados.video,
        'video'
      );
    } catch (uploadError) {
      console.warn(
        'Vídeo rejeitado na denúncia de propaganda irregular:',
        normalizarMensagemErroApi(uploadError)
      );

      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise o vídeo anexado e tente novamente.',
        erros: {
          video:
            'Não foi possível confirmar o vídeo protegido. Selecione novamente um arquivo de até 2 MB.',
        },
      });
    }

    const createdSubmission = await criarSubmissaoDenunciaPropaganda(
      dados,
      imagemPrivada,
      videoPrivado
    );
    const submission =
      createdSubmission && createdSubmission.submission
        ? createdSubmission.submission
        : createdSubmission;
    const submissionId = text(
      submission && (submission._id || submission.id)
    );

    if (!submissionId) {
      throw new Error(
        'Wix Forms não retornou o identificador da denúncia.'
      );
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      submissionId,
      status: text(submission && submission.status) || 'CONFIRMED',
      mensagem:
        'Denúncia recebida. A equipe responsável fará a análise do relato e das evidências encaminhadas.',
    });
  } catch (err) {
    console.error(
      'Erro no endpoint oabDenunciaPropagandaIrregular:',
      normalizarMensagemErroApi(err)
    );

    return jsonServerError(request, {
      ok: false,
      version: 1,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível registrar a denúncia agora. Tente novamente em alguns minutos.',
    });
  }
}


export async function use_oabFalePresidente(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada para este formulário.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadFalePresidente(payload);

    if (deveIgnorarFalePresidenteComoSpam(dados)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        submissionId: gerarIdIgnoradoFormulario('fale-presidente'),
        status: 'IGNORADO',
        mensagem: 'Mensagem enviada com sucesso.',
      });
    }

    const erros = validarPayloadFalePresidente(dados);

    if (Object.keys(erros).length > 0) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise os campos indicados e tente novamente.',
        erros,
      });
    }

    const rateLimit = consumirRateLimitFalePresidente(
      request,
      dados.email
    );

    if (!rateLimit.allowed) {
      return jsonBadRequest(request, {
        ok: false,
        version: 1,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem:
          'Muitas mensagens foram enviadas em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const createdSubmission = await criarSubmissaoFalePresidente(dados);
    const submission =
      createdSubmission && createdSubmission.submission
        ? createdSubmission.submission
        : createdSubmission;

    const submissionId = text(
      submission && (submission._id || submission.id)
    );

    if (!submissionId) {
      throw new Error(
        'Wix Forms não retornou o identificador da submissão.'
      );
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      submissionId,
      status: text(submission && submission.status) || 'CONFIRMED',
      mensagem:
        'Sua mensagem foi encaminhada ao Gabinete da Presidência.',
    });
  } catch (err) {
    console.error(
      'Erro no endpoint oabFalePresidente:',
      normalizarMensagemErroApi(err)
    );

    return jsonServerError(request, {
      ok: false,
      version: 1,
      codigo: 'ERRO_INTERNO',
      mensagem:
        'Não foi possível enviar sua mensagem agora. Tente novamente em alguns minutos.',
    });
  }
}


export async function use_oabContato(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const origin = getRequestOrigin(request);

    if (origin && !isAllowedOrigin(origin)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'ORIGEM_NAO_AUTORIZADA',
        mensagem: 'Origem não autorizada para este formulário.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadContato(payload);

    if (deveIgnorarContatoComoSpam(dados)) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        mensagem: 'Mensagem enviada com sucesso.',
      });
    }

    const erros = validarPayloadContato(dados);

    if (Object.keys(erros).length > 0) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Revise os campos indicados e tente novamente.',
        erros,
      });
    }

    const rateLimit = consumirRateLimitContato(request, dados.email);

    if (!rateLimit.allowed) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'MUITAS_TENTATIVAS',
        mensagem: 'Muitas mensagens foram enviadas em sequência. Aguarde alguns minutos e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const createdSubmission = await criarSubmissaoContato(dados);
    const submission =
      createdSubmission && createdSubmission.submission
        ? createdSubmission.submission
        : createdSubmission;

    const submissionId = text(
      submission && (submission._id || submission.id)
    );

    if (!submissionId) {
      throw new Error(
        'Wix Forms não retornou o identificador da submissão.'
      );
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      mensagem: 'Mensagem enviada com sucesso.',
      submissionId,
    });
  } catch (err) {
    console.error(
      'Erro no endpoint oabContato:',
      normalizarMensagemErroApi(err)
    );

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível enviar sua mensagem agora. Tente novamente em alguns minutos.',
    });
  }
}

export async function use_oabAgendamentoCatalogo(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const resultado = await obterCatalogoAgendamentosPublicoApi();

    if (resultado.ok) return jsonOk(request, resultado);

    if (resultado.codigo === 'CATALOGO_COLECAO_AUSENTE') {
      return jsonServerError(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAgendamentoCatalogo:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar as modalidades de agendamento.',
    });
  }
}


export async function use_oabAgendamentoDisponibilidade(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const offerId = getQueryParam(request, ['offerId', 'ofertaId', 'oferta']);
    const dataIso = normalizeDateIso(
      getQueryParam(request, ['dataIso', 'data', 'date'])
    );

    if (!offerId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'OFERTA_OBRIGATORIA',
        mensagem: 'Informe a opção de atendimento.',
      });
    }

    const resultado = await listarDisponibilidadeOfertaPublica({
      offerId,
      dateIso: dataIso,
    });

    return jsonOk(request, {
      ok: true,
      ...resultado,
    });
  } catch (err) {
    console.error('Erro no endpoint oabAgendamentoDisponibilidade:', err);
    const codigo = text(err && err.message);
    const indisponivel = [
      'OFERTA_INEXISTENTE',
      'SERVICO_INDISPONIVEL',
      'LOCAL_INDISPONIVEL',
      'ITEM_INDISPONIVEL',
      'OPCAO_INDISPONIVEL',
      'OPCAO_NAO_PRONTA',
    ].includes(codigo);

    if (indisponivel) {
      return jsonBadRequest(request, {
        ok: false,
        codigo,
        mensagem: 'Esta opção de atendimento não está disponível para reserva.',
      });
    }

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar a disponibilidade agora.',
    });
  }
}

export async function use_oabAgendamentosV2(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await criarAgendamentoPublicoV2(payload);

    if (resultado.ok) return jsonOk(request, resultado);

    return jsonBadRequest(request, {
      ok: false,
      codigo: resultado.code || resultado.codigo || 'DADOS_INVALIDOS',
      mensagem: resultado.message || resultado.mensagem || 'Não foi possível confirmar o agendamento.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAgendamentosV2:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível confirmar o agendamento agora.',
    });
  }
}


export async function use_oabUnidades(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const result = await wixData
      .query(COL.UNIDADES)
      .limit(100)
      .find({ suppressAuth: true });

    const unidades = (result.items || [])
      .map(mapUnidade)
      .filter(filtrarUnidadeValida)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return jsonOk(request, {
      ok: true,
      total: unidades.length,
      unidades,
    });
  } catch (err) {
    console.error('Erro no endpoint oabUnidades:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar as unidades.',
    });
  }
}

export async function use_oabDatas(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const unidadeSlug = getQueryParam(request, [
      'unidadeSlug',
      'unidade',
      'slug',
      'id',
    ]);

    if (!unidadeSlug) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Informe a unidade prisional.',
      });
    }

    const datas = await carregarDatasNormalizadas(unidadeSlug);

    return jsonOk(request, {
      ok: true,
      unidadeSlug,
      total: datas.length,
      datas,
    });
  } catch (err) {
    console.error('Erro no endpoint oabDatas:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar as datas disponíveis.',
    });
  }
}

export async function use_oabHorarios(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const unidadeSlug = getQueryParam(request, [
      'unidadeSlug',
      'unidade',
      'slug',
      'id',
    ]);

    const dataIso = normalizeDateIso(
      getQueryParam(request, [
        'dataIso',
        'data',
        'dataAtendimentoIso',
        'date',
      ])
    );

    if (!unidadeSlug) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Informe a unidade prisional.',
      });
    }

    if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Informe uma data válida.',
      });
    }

    const horarios = await carregarHorariosNormalizados(unidadeSlug, dataIso);

    return jsonOk(request, {
      ok: true,
      unidadeSlug,
      dataIso,
      total: horarios.length,
      horarios,
    });
  } catch (err) {
    console.error('Erro no endpoint oabHorarios:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar os horários disponíveis.',
    });
  }
}

export async function use_oabAgendamentos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadAgendamento(payload);
    const erroValidacao = validarDadosAgendamento(dados);

    if (erroValidacao) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: erroValidacao,
      });
    }

    const unidade = await buscarUnidadePorSlug(dados.unidadeSlug);

    if (!unidade) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Unidade prisional não encontrada ou inativa.',
      });
    }

    const validacaoHorario = await validarHorarioDisponivelFinal(dados);

    if (!validacaoHorario.ok) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: validacaoHorario.codigo || 'HORARIO_INDISPONIVEL',
        mensagem:
          validacaoHorario.mensagem ||
          'Este horário não está mais disponível.',
      });
    }

    if (validacaoHorario.horario && validacaoHorario.horario.horarioFim) {
      dados.horarioFim = validacaoHorario.horario.horarioFim;
    }

    const ocupado = await existeAgendamentoConflitante(dados);

    if (ocupado) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'HORARIO_INDISPONIVEL',
        mensagem: 'Este horário acabou de ser ocupado. Escolha outro horário.',
      });
    }

    const agora = new Date();
    const protocolo = await gerarProtocoloUnico();
    const dataLabel = formatDateLabel(dados.dataIso);
    const slotKey = montarSlotKey(
      dados.unidadeSlug,
      dados.dataIso,
      dados.horarioInicio
    );

    const item = {
      title: protocolo,
      protocolo,

      unidadeSlug: dados.unidadeSlug,
      unidadeNome: unidade.nome,

      dataAtendimentoIso: dados.dataIso,
      dataLabel,

      horarioInicio: dados.horarioInicio,
      horarioFim: dados.horarioFim,
      slotKey,

      nomeAdvogado: dados.nomeAdvogado,
      numeroOab: dados.numeroOab,
      emailAdvogado: dados.emailAdvogado,
      emailIndex: dados.emailAdvogado,
      telefoneAdvogado: dados.telefoneAdvogado,

      nomeIpl: dados.nomeIpl,
      infopen: dados.infopen,

      cienciaRegras: true,
      aceiteRegras: true,

      status: 'agendado',

      emailAdvogadoEnviado: false,
      emailAdvogadoDestino: dados.emailAdvogado,
      emailAdvogadoErro: '',
      emailAdvogadoEnviadoEm: null,

      criadoEm: agora,
      atualizadoEm: agora,
    };

    const salvo = await wixData.insert(COL.AGENDAMENTOS, item, {
      suppressAuth: true,
    });

    const auditoriaEmailAdvogado = await tentarEnviarEmailAgendamentoParaAdvogado({
      dados,
      unidade,
      protocolo,
      dataLabel,
    });

    await registrarAuditoriaEmailAdvogadoAgendamento(
      salvo,
      auditoriaEmailAdvogado
    );

    return jsonOk(request, {
      ok: true,
      mensagem: 'Agendamento confirmado com sucesso.',
      protocolo,
      emailAdvogadoEnviado: auditoriaEmailAdvogado.emailAdvogadoEnviado,
      agendamento: {
        _id: salvo._id,
        protocolo,
        unidadeSlug: dados.unidadeSlug,
        unidadeNome: unidade.nome,
        dataIso: dados.dataIso,
        dataLabel,
        horarioInicio: dados.horarioInicio,
        horarioFim: dados.horarioFim,
        nomeAdvogado: dados.nomeAdvogado,
        numeroOab: dados.numeroOab,
        nomeIpl: dados.nomeIpl,
        infopen: dados.infopen,
        status: 'agendado',
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabAgendamentos:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível confirmar o agendamento agora.',
    });
  }
}


/**
 * POST /_functions/oabConsultarAgendamento
 *
 * Consulta pública e segura do agendamento usando protocolo + e-mail do advogado.
 */
export async function use_oabConsultarAgendamento(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await consultarAgendamentoPublicoApi(payload);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'DADOS_OBRIGATORIOS' ||
      resultado.codigo === 'EMAIL_INVALIDO' ||
      resultado.codigo === 'CODIGO_INVALIDO' ||
    resultado.codigo === 'CODIGO_EXPIRADO' ||
    resultado.codigo === 'CODIGO_BLOQUEADO' ||
    resultado.codigo === 'EMAIL_NAO_VERIFICADO' ||
    resultado.codigo === 'EMAIL_CODIGO_NAO_ENVIADO' ||
    resultado.codigo === 'NAO_ENCONTRADO'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabConsultarAgendamento:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível consultar o agendamento agora.',
    });
  }
}


/**
 * POST /_functions/oabCancelarAgendamentoUsuario
 *
 * Cancela um agendamento pelo próprio usuário, usando protocolo + e-mail.
 */
export async function use_oabCancelarAgendamentoUsuario(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await cancelarAgendamentoPublicoApi(payload);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'DADOS_OBRIGATORIOS' ||
      resultado.codigo === 'EMAIL_INVALIDO' ||
      resultado.codigo === 'NAO_ENCONTRADO' ||
      resultado.codigo === 'JA_CANCELADO' ||
      resultado.codigo === 'JA_REAGENDADO' ||
      resultado.codigo === 'STATUS_INVALIDO' ||
      resultado.codigo === 'ATENDIMENTO_REALIZADO' ||
      resultado.codigo === 'ATENDIMENTO_PASSADO' ||
      resultado.codigo === 'PRAZO_ENCERRADO' ||
      resultado.codigo === 'DATA_INVALIDA' ||
      resultado.codigo === 'CANCELAMENTO_NAO_PERMITIDO'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabCancelarAgendamentoUsuario:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível cancelar o agendamento agora.',
    });
  }
}


/**
 * POST /_functions/oabRemarcarAgendamentoUsuario
 *
 * Remarca um agendamento pelo próprio usuário, usando protocolo + e-mail.
 */
export async function use_oabRemarcarAgendamentoUsuario(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await remarcarAgendamentoPublicoApi(payload);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'DADOS_OBRIGATORIOS' ||
      resultado.codigo === 'EMAIL_INVALIDO' ||
      resultado.codigo === 'NAO_ENCONTRADO' ||
      resultado.codigo === 'JA_CANCELADO' ||
      resultado.codigo === 'JA_REAGENDADO' ||
      resultado.codigo === 'STATUS_INVALIDO' ||
      resultado.codigo === 'ATENDIMENTO_REALIZADO' ||
      resultado.codigo === 'ATENDIMENTO_PASSADO' ||
      resultado.codigo === 'PRAZO_ENCERRADO' ||
      resultado.codigo === 'DATA_INVALIDA' ||
      resultado.codigo === 'DADOS_REMARCACAO_INVALIDOS' ||
      resultado.codigo === 'REMARCACAO_NAO_PERMITIDA' ||
      resultado.codigo === 'UNIDADE_INVALIDA' ||
      resultado.codigo === 'MESMO_HORARIO' ||
      resultado.codigo === 'HORARIO_INDISPONIVEL'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabRemarcarAgendamentoUsuario:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível remarcar o agendamento agora.',
    });
  }
}

/**
 * POST /_functions/oabDocumentoUploadUrl
 *
 * Gera uma URL assinada de uso único para a Central enviar o arquivo
 * diretamente ao Wix Media Manager, sem transportar Base64 pelo Velo.
 */
export async function use_oabDocumentoUploadUrl(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadUploadUrlDocumento(payload);
    const validacao = validarUploadUrlDocumento(dados);

    if (!validacao.ok) {
      return jsonBadRequest(request, validacao);
    }

    const resultado = await prepararUploadDocumentoDireto(dados);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabDocumentoUploadUrl:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO_UPLOAD_URL',
      mensagem: 'Não foi possível preparar o envio do arquivo agora.',
    });
  }
}

/**
 * POST /_functions/oabDocumentoUpload
 *
 * Recebe um arquivo em Base64 vindo da Central externa, salva no Wix Media Manager
 * e devolve a URL que será usada no endpoint /oabDocumentos.
 */
export async function use_oabDocumentoUpload(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const dados = normalizarPayloadUploadDocumento(payload);
    const validacao = validarUploadDocumento(dados);

    if (!validacao.ok) {
      return jsonBadRequest(request, validacao);
    }

    const resultado = await uploadDocumentoParaMediaManager(dados);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'UPLOAD_FALHOU' ||
      resultado.codigo === 'UPLOAD_SEM_URL'
    ) {
      return jsonServerError(request, resultado);
    }

    return jsonBadRequest(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabDocumentoUpload:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO_UPLOAD',
      mensagem: 'Não foi possível enviar o arquivo agora.',
    });
  }
}

/**
 * POST /_functions/oabDocumentos
 *
 * Recebe JSON com os dados da solicitação e uma URL de arquivo já existente.
 */
export async function use_oabDocumentos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await confirmarSolicitacaoDocumento(payload);

    if (resultado && resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado &&
      (resultado.codigo === 'ERRO_INTERNO' ||
        resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
        resultado.codigo === 'CONFIG_INFOBIP_INCOMPLETA')
    ) {
      return jsonServerError(request, resultado);
    }

    return jsonBadRequest(
      request,
      resultado || {
        ok: false,
        mensagem: 'Não foi possível registrar a solicitação de documento.',
      }
    );
  } catch (err) {
    console.error('Erro no endpoint oabDocumentos:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível registrar a solicitação de documento agora.',
    });
  }
}



export async function use_oabAdminMe(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const resultado = await meAdminApi(token);

    if (resultado.ok) return jsonOk(request, resultado);

    if (
      resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
      resultado.codigo === 'SESSAO_EXPIRADA' ||
      resultado.codigo === 'SEM_PERMISSAO' ||
      resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminMe:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível validar a sessão administrativa.',
    });
  }
}




// ============================================================
// Portal de Gestão — Publicações pendentes
// ============================================================

function normalizarListaPublicacaoAdmin(value) {
  if (Array.isArray(value)) {
    return value.map(text).filter(Boolean);
  }

  const raw = text(value);
  if (!raw) return [];

  return raw
    .split(/[;,|]/)
    .map((item) => text(item))
    .filter(Boolean);
}

function normalizarStatusPortalPublicacao(value) {
  const status = text(value).trim().toUpperCase();

  if (status === PUBLICACOES_PORTAL_STATUS.PUBLICANDO) {
    return PUBLICACOES_PORTAL_STATUS.PUBLICANDO;
  }

  if (status === PUBLICACOES_PORTAL_STATUS.ARQUIVADO) {
    return PUBLICACOES_PORTAL_STATUS.ARQUIVADO;
  }

  return PUBLICACOES_PORTAL_STATUS.PENDENTE;
}

function mapCorrespondentePendenteAdmin(item = {}) {
  return {
    id: text(item._id),
    kind: 'correspondente',
    title: text(item.nomeCompleto) || 'Correspondente sem nome',
    subtitle: [text(item.cidade), text(item.uf).toUpperCase()]
      .filter(Boolean)
      .join(' / '),
    createdAt: normalizarDataIsoPublica(item._createdDate),
    updatedAt: normalizarDataIsoPublica(item._updatedDate),
    publishStatus: 'DRAFT',
    portalStatus: normalizarStatusPortalPublicacao(item.portalStatus),
    correspondent: {
      name: text(item.nomeCompleto),
      oab: text(item.oab),
      phone: text(item.telefone),
      email: normalizeEmail(item.eMail),
      address: text(item.endereco),
      city: text(item.cidade),
      uf: text(item.uf).toUpperCase().slice(0, 2),
      areas: normalizarListaPublicacaoAdmin(item.areaDeAtuacao),
    },
    opportunity: null,
  };
}

function mapOportunidadePendenteAdmin(item = {}) {
  return {
    id: text(item._id),
    kind: 'oportunidade',
    title: text(item.title) || 'Oportunidade sem título',
    subtitle: [text(item.cidade), text(item.uf).toUpperCase()]
      .filter(Boolean)
      .join(' / '),
    createdAt: normalizarDataIsoPublica(item._createdDate),
    updatedAt: normalizarDataIsoPublica(item._updatedDate),
    publishStatus: 'DRAFT',
    portalStatus: normalizarStatusPortalPublicacao(item.portalStatus),
    correspondent: null,
    opportunity: {
      title: text(item.title),
      contactName: text(item.nomePessoaOuEmpresa),
      phone: text(item.telefone),
      email: normalizeEmail(item.email),
      city: text(item.cidade),
      uf: text(item.uf).toUpperCase().slice(0, 2),
      area: text(item.area),
      types: normalizarListaPublicacaoAdmin(item.tipo),
      modalities: normalizarListaPublicacaoAdmin(item.modalidade),
      description: text(item.descrioCurta),
      externalUrl: normalizarUrlPublica(item.currculo),
      hasResume: /^wix:document:\/\/v1\//i.test(text(item.curriculo)),
      expiresAt: normalizarDataIsoPublica(item.vencimento),
    },
  };
}

async function reconciliarPublicacaoPendenteAdmin(collectionId, kind, item) {
  if (
    normalizarStatusPortalPublicacao(item.portalStatus) !==
    PUBLICACOES_PORTAL_STATUS.PUBLICANDO
  ) {
    return item;
  }

  const taskId = text(item.portalPublicacaoTaskId);
  const task = taskId ? await consultarTarefaPublicacaoCms(taskId) : null;
  const taskStatus = text(task && task.status).toUpperCase();

  if (taskStatus === 'COMPLETED') {
    // O item pode ainda aparecer como DRAFT por consistência eventual.
    // Não o devolvemos à fila depois que a tarefa confirmou sucesso.
    return null;
  }

  if (['FAILED', 'CANCELLED'].includes(taskStatus)) {
    return salvarEstadoPortalPublicacao(
      { collectionId, kind, id: text(item._id) },
      item,
      {
        portalStatus: PUBLICACOES_PORTAL_STATUS.PENDENTE,
        portalPublicacaoTaskId: '',
        portalPublicacaoFalhouEm: new Date(),
      }
    );
  }

  const requestedAt = new Date(item.portalPublicacaoSolicitadaEm || 0).getTime();
  const stale =
    !taskId &&
    Number.isFinite(requestedAt) &&
    requestedAt > 0 &&
    Date.now() - requestedAt > 10 * 60 * 1000;

  if (stale) {
    return salvarEstadoPortalPublicacao(
      { collectionId, kind, id: text(item._id) },
      item,
      {
        portalStatus: PUBLICACOES_PORTAL_STATUS.PENDENTE,
        portalPublicacaoTaskId: '',
      }
    );
  }

  return item;
}

async function carregarPublicacoesPendentesAdmin() {
  const [correspondentesRaw, oportunidadesRaw] = await Promise.all([
    wixData
      .query(COL.CORRESPONDENTES)
      .eq('_publishStatus', 'DRAFT')
      .descending('_createdDate')
      .limit(PUBLICACOES_PENDENTES_MAX_RESULTS)
      .find({ suppressAuth: true }),
    wixData
      .query(COL.OPORTUNIDADES)
      .eq('_publishStatus', 'DRAFT')
      .descending('_createdDate')
      .limit(PUBLICACOES_PENDENTES_MAX_RESULTS)
      .find({ suppressAuth: true }),
  ]);

  const correspondentesReconciliados = await Promise.all(
    (correspondentesRaw.items || [])
      .filter((item) => normalizarStatusPortalPublicacao(item.portalStatus) !== PUBLICACOES_PORTAL_STATUS.ARQUIVADO)
      .map((item) =>
        reconciliarPublicacaoPendenteAdmin(
          COL.CORRESPONDENTES,
          'correspondente',
          item
        )
      )
  );
  const oportunidadesReconciliadas = await Promise.all(
    (oportunidadesRaw.items || [])
      .filter((item) => normalizarStatusPortalPublicacao(item.portalStatus) !== PUBLICACOES_PORTAL_STATUS.ARQUIVADO)
      .map((item) =>
        reconciliarPublicacaoPendenteAdmin(
          COL.OPORTUNIDADES,
          'oportunidade',
          item
        )
      )
  );

  const correspondentes = correspondentesReconciliados
    .filter(Boolean)
    .map(mapCorrespondentePendenteAdmin);
  const oportunidades = oportunidadesReconciliadas
    .filter(Boolean)
    .map(mapOportunidadePendenteAdmin);

  const items = [...correspondentes, ...oportunidades].sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  return {
    items,
    summary: {
      total: items.length,
      correspondentes: correspondentes.length,
      oportunidades: oportunidades.length,
      publicando: items.filter((item) => item.portalStatus === PUBLICACOES_PORTAL_STATUS.PUBLICANDO).length,
    },
  };
}

function resolverPublicacaoPendente(kind, id) {
  const safeKind = text(kind).trim().toLowerCase();
  const safeId = text(id);

  if (!safeId) return null;

  if (safeKind === 'correspondente') {
    return { kind: safeKind, id: safeId, collectionId: COL.CORRESPONDENTES };
  }

  if (safeKind === 'oportunidade') {
    return { kind: safeKind, id: safeId, collectionId: COL.OPORTUNIDADES };
  }

  return null;
}

async function obterPublicacaoPendenteAdmin(target) {
  if (!target) return null;
  const item = await wixData.get(target.collectionId, target.id, { suppressAuth: true });
  if (!item || text(item._publishStatus).toUpperCase() !== 'DRAFT') return null;
  return item;
}

function dadosRevisaoPublicacao(acesso) {
  return {
    portalRevisadoEm: new Date(),
    portalRevisadoPor: text(acesso?.admin?.nome || acesso?.admin?.email || 'Administrador'),
    portalRevisadoPorEmail: normalizeEmail(acesso?.admin?.email),
  };
}

async function salvarEstadoPortalPublicacao(target, item, patch) {
  return wixData.update(
    target.collectionId,
    {
      ...item,
      ...patch,
    },
    { suppressAuth: true }
  );
}

async function criarTarefaPublicacaoCms(target) {
  const scheduledAt = new Date(Date.now() + 3000).toISOString();
  const task = await criarTarefaCmsElevada({
    type: 'UPDATE_PUBLISH_STATUS',
    updatePublishStatusOptions: {
      dataCollectionId: target.collectionId,
      filter: { _id: target.id },
      operation: 'SCHEDULE_PUBLISHED_STATUS',
      schedulePublishedStatusOptions: { date: scheduledAt },
    },
  });

  return {
    taskId: text(task && (task._id || task.id)),
    scheduledAt,
  };
}

async function consultarTarefaPublicacaoCms(taskId) {
  const safeTaskId = text(taskId);
  if (!safeTaskId) return null;

  try {
    return await obterTarefaCmsElevada(safeTaskId);
  } catch (err) {
    console.warn('Não foi possível consultar tarefa CMS de publicação:', safeTaskId, normalizarMensagemErroApi(err));
    return null;
  }
}

export async function use_oabAdminPublicacoesPendentes(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [FORMULARIOS_GESTAO_PERMISSIONS.VER]
    );

    if (!acesso.ok) return acesso.response;

    const data = await carregarPublicacoesPendentesAdmin();

    return jsonOk(request, {
      ok: true,
      version: 1,
      ...data,
      permissions: {
        canOperate: acesso.podeOperar,
        canOpenAttachments: acesso.podeAbrirAnexos,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminPublicacoesPendentes:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar as publicações pendentes agora.',
    });
  }
}

export async function use_oabAdminPublicacaoAcao(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [
        FORMULARIOS_GESTAO_PERMISSIONS.VER,
        FORMULARIOS_GESTAO_PERMISSIONS.OPERAR,
      ]
    );

    if (!acesso.ok) return acesso.response;

    const payload = await readJsonBody(request);
    const target = resolverPublicacaoPendente(payload?.kind, payload?.id);
    const action = text(payload?.action).trim().toUpperCase();

    if (!target || !['PUBLICAR', 'ARQUIVAR'].includes(action)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Informe um cadastro pendente e uma ação válida.',
      });
    }

    const item = await obterPublicacaoPendenteAdmin(target);

    if (!item) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'PUBLICACAO_NAO_ENCONTRADA',
        mensagem: 'O cadastro pendente não foi encontrado ou já foi publicado.',
      });
    }

    if (action === 'ARQUIVAR') {
      await salvarEstadoPortalPublicacao(target, item, {
        portalStatus: PUBLICACOES_PORTAL_STATUS.ARQUIVADO,
        ...dadosRevisaoPublicacao(acesso),
      });

      return jsonOk(request, {
        ok: true,
        version: 1,
        action,
        id: target.id,
        kind: target.kind,
        status: 'ARQUIVADO',
        message: 'Cadastro arquivado sem publicação. O registro foi preservado no CMS.',
      });
    }

    const taskIdAnterior = text(item.portalPublicacaoTaskId);
    if (taskIdAnterior) {
      const taskAnterior = await consultarTarefaPublicacaoCms(taskIdAnterior);
      const statusAnterior = text(taskAnterior && taskAnterior.status).toUpperCase();

      if (
        taskAnterior &&
        !['COMPLETED', 'FAILED', 'CANCELLED'].includes(statusAnterior)
      ) {
        return jsonOk(request, {
          ok: true,
          version: 1,
          action,
          id: target.id,
          kind: target.kind,
          taskId: taskIdAnterior,
          status: 'PUBLICANDO',
          message: 'A publicação deste cadastro já está em processamento.',
        });
      }
    }

    const marcado = await salvarEstadoPortalPublicacao(target, item, {
      portalStatus: PUBLICACOES_PORTAL_STATUS.PUBLICANDO,
      portalPublicacaoSolicitadaEm: new Date(),
      portalPublicacaoTaskId: '',
      ...dadosRevisaoPublicacao(acesso),
    });

    let tarefa;
    try {
      tarefa = await criarTarefaPublicacaoCms(target);
    } catch (taskError) {
      await salvarEstadoPortalPublicacao(target, marcado, {
        portalStatus: PUBLICACOES_PORTAL_STATUS.PENDENTE,
        portalPublicacaoTaskId: '',
      });
      throw taskError;
    }

    if (tarefa.taskId) {
      try {
        await salvarEstadoPortalPublicacao(target, marcado, {
          portalStatus: PUBLICACOES_PORTAL_STATUS.PUBLICANDO,
          portalPublicacaoTaskId: tarefa.taskId,
          portalPublicacaoAgendadaPara: tarefa.scheduledAt,
        });
      } catch (metadataError) {
        console.warn(
          'Publicação CMS criada, mas os metadados da tarefa não puderam ser salvos:',
          tarefa.taskId,
          normalizarMensagemErroApi(metadataError)
        );
      }
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      action,
      id: target.id,
      kind: target.kind,
      taskId: tarefa.taskId,
      status: 'PUBLICANDO',
      message: 'Cadastro aprovado. A publicação no site foi agendada e deve concluir em alguns segundos.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminPublicacaoAcao:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível concluir a ação de publicação agora.',
    });
  }
}

export async function use_oabAdminOportunidadeCurriculo(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [
        FORMULARIOS_GESTAO_PERMISSIONS.VER,
        FORMULARIOS_GESTAO_PERMISSIONS.ANEXOS,
      ]
    );

    if (!acesso.ok) return acesso.response;

    const payload = await readJsonBody(request);
    const target = resolverPublicacaoPendente('oportunidade', payload?.id);
    const item = await obterPublicacaoPendenteAdmin(target);

    if (!item) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'PUBLICACAO_NAO_ENCONTRADA',
        mensagem: 'A oportunidade pendente não foi encontrada.',
      });
    }

    const fileUrl = text(item.curriculo);
    if (!/^wix:document:\/\/v1\//i.test(fileUrl)) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'CURRICULO_NAO_ENCONTRADO',
        mensagem: 'Esta oportunidade não possui currículo privado anexado.',
      });
    }

    const info = await mediaManager.getFileInfo(fileUrl);
    const name = text(info && (info.originalFileName || info.fileName)) || 'curriculo-oportunidade';
    const url = await mediaManager.getDownloadUrl(
      fileUrl,
      PUBLICACOES_PENDENTES_DOWNLOAD_MINUTES,
      name,
      null
    );

    if (!url) {
      return jsonServerError(request, {
        ok: false,
        codigo: 'URL_DOWNLOAD_NAO_GERADA',
        mensagem: 'Não foi possível gerar o acesso seguro ao currículo.',
      });
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      attachment: {
        name,
        url,
        expiresInMinutes: PUBLICACOES_PENDENTES_DOWNLOAD_MINUTES,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminOportunidadeCurriculo:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível abrir o currículo privado agora.',
    });
  }
}

// ============================================================
// Portal de Gestão — Formulários e Denúncias
// ============================================================

export async function use_oabAdminFormulariosResumo(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [FORMULARIOS_GESTAO_PERMISSIONS.VER]
    );

    if (!acesso.ok) {
      return acesso.response;
    }

    const forms = await contarFormulariosGestao();

    return jsonOk(request, {
      ok: true,
      version: 1,
      forms,
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminFormulariosResumo:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'WIX_FORMS_INDISPONIVEL',
      mensagem: 'Não foi possível carregar o resumo dos formulários agora.',
    });
  }
}

export async function use_oabAdminFormulariosSubmissoes(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [FORMULARIOS_GESTAO_PERMISSIONS.VER]
    );

    if (!acesso.ok) {
      return acesso.response;
    }

    const config = getFormularioGestaoConfig(
      getQueryParam(request, ['form', 'formKey', 'formId'])
    );

    if (!config) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'FORMULARIO_INVALIDO',
        mensagem: 'Selecione um formulário válido.',
      });
    }

    const requestedLimit = Number(
      getQueryParam(request, ['limit', 'pageSize']) ||
      FORMULARIOS_GESTAO_PAGE_SIZE_DEFAULT
    );

    const limit = Math.max(
      1,
      Math.min(
        FORMULARIOS_GESTAO_PAGE_SIZE_MAX,
        Number.isFinite(requestedLimit)
          ? Math.floor(requestedLimit)
          : FORMULARIOS_GESTAO_PAGE_SIZE_DEFAULT
      )
    );

    const cursor = getQueryParam(request, 'cursor');
    const onlyUnseenRaw = getQueryParam(request, ['unseen', 'onlyUnseen']);
    const onlyUnseen =
      onlyUnseenRaw === '1' ||
      onlyUnseenRaw.toLowerCase() === 'true';

    const result = await consultarFormulariosGestao({
      config,
      limit,
      cursor,
      onlyUnseen,
    });

    return jsonOk(request, {
      ok: true,
      version: 1,
      form: {
        key: config.key,
        id: config.id,
        name: config.nome,
        category: config.categoria,
      },
      items: result.items,
      paging: {
        limit,
        nextCursor: result.nextCursor,
        hasNext: result.hasNext,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminFormulariosSubmissoes:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'WIX_FORMS_INDISPONIVEL',
      mensagem: 'Não foi possível carregar as submissões agora.',
    });
  }
}

export async function use_oabAdminFormularioSubmissao(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [FORMULARIOS_GESTAO_PERMISSIONS.VER]
    );

    if (!acesso.ok) {
      return acesso.response;
    }

    const submissionId = getQueryParam(request, ['id', 'submissionId']);

    if (!submissionId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe a submissão que deseja consultar.',
      });
    }

    const item = await obterSubmissaoFormularioGestao(submissionId);

    if (!item) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'SUBMISSAO_NAO_ENCONTRADA',
        mensagem: 'A submissão não foi encontrada.',
      });
    }

    const [operacaoRaw, historico] = await Promise.all([
      buscarOperacaoFormularioGestao(submissionId),
      listarHistoricoFormularioGestao(submissionId),
    ]);

    const details = detalhesSubmissaoFormularioGestao(item);

    if (!acesso.podeAbrirAnexos) {
      details.attachmentDetails = {
        image: null,
        video: null,
      };
    }

    return jsonOk(request, {
      ok: true,
      version: 3,
      submission: {
        ...details,
        operation: mapOperacaoFormularioGestao(operacaoRaw),
      },
      history: historico,
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminFormularioSubmissao:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'WIX_FORMS_INDISPONIVEL',
      mensagem: 'Não foi possível carregar a submissão agora.',
    });
  }
}

export async function use_oabAdminFormularioMarcarVisto(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [
        FORMULARIOS_GESTAO_PERMISSIONS.VER,
        FORMULARIOS_GESTAO_PERMISSIONS.OPERAR,
      ]
    );

    if (!acesso.ok) {
      return acesso.response;
    }

    const payload = await readJsonBody(request);
    const submissionId = text(payload?.submissionId || payload?.id);

    if (!submissionId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe a submissão que deseja marcar como visualizada.',
      });
    }

    const item = await obterSubmissaoFormularioGestao(submissionId);

    if (!item) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'SUBMISSAO_NAO_ENCONTRADA',
        mensagem: 'A submissão não foi encontrada.',
      });
    }

    if (item.seen !== true) {
      await marcarSubmissoesFormularioComoVistasElevada(
        [submissionId],
        text(item.formId)
      );
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      submissionId,
      seen: true,
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminFormularioMarcarVisto:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'WIX_FORMS_INDISPONIVEL',
      mensagem: 'Não foi possível atualizar a submissão agora.',
    });
  }
}

export async function use_oabAdminFormularioAnexo(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [
        FORMULARIOS_GESTAO_PERMISSIONS.VER,
        FORMULARIOS_GESTAO_PERMISSIONS.ANEXOS,
      ]
    );

    if (!acesso.ok) {
      return acesso.response;
    }

    const payload = await readJsonBody(request);
    const submissionId = text(payload?.submissionId || payload?.id);
    const kind = text(payload?.kind || payload?.type).toLowerCase();

    if (!submissionId || !['image', 'video'].includes(kind)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe a submissão e o tipo de anexo.',
      });
    }

    const item = await obterSubmissaoFormularioGestao(submissionId);

    if (!item) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'SUBMISSAO_NAO_ENCONTRADA',
        mensagem: 'A submissão não foi encontrada.',
      });
    }

    if (text(item.formId) !== FORM_DENUNCIA_PROPAGANDA.id) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'ANEXO_NAO_DISPONIVEL',
        mensagem: 'Este formulário não possui anexos privados gerenciados pelo portal.',
      });
    }

    const values = item.submissions && typeof item.submissions === 'object'
      ? item.submissions
      : {};
    const target = kind === 'image'
      ? FORM_DENUNCIA_PROPAGANDA.targets.privateImage
      : FORM_DENUNCIA_PROPAGANDA.targets.privateVideo;
    const anexo = parseAnexoPrivadoFormularioGestao(values[target]);

    if (!anexo) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'ANEXO_NAO_ENCONTRADO',
        mensagem: 'O anexo solicitado não está disponível.',
      });
    }

    const nomeDownload =
      anexo.nomeOriginal ||
      anexo.nomeArmazenado ||
      (kind === 'image' ? 'imagem-denuncia' : 'video-denuncia');

    const url = await mediaManager.getDownloadUrl(
      anexo.fileUrl,
      FORMULARIOS_GESTAO_DOWNLOAD_MINUTES,
      nomeDownload,
      null
    );

    if (!url) {
      return jsonServerError(request, {
        ok: false,
        codigo: 'URL_DOWNLOAD_NAO_GERADA',
        mensagem: 'Não foi possível gerar o acesso seguro ao anexo.',
      });
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      attachment: {
        kind,
        name: nomeDownload,
        mimeType: anexo.mimeType,
        sizeBytes: anexo.tamanhoBytes,
        url,
        expiresInMinutes: FORMULARIOS_GESTAO_DOWNLOAD_MINUTES,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminFormularioAnexo:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível gerar o acesso seguro ao anexo agora.',
    });
  }
}


export async function use_oabAdminFormularioOperacao(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [
        FORMULARIOS_GESTAO_PERMISSIONS.VER,
        FORMULARIOS_GESTAO_PERMISSIONS.OPERAR,
      ]
    );

    if (!acesso.ok) {
      return acesso.response;
    }

    const payload = await readJsonBody(request);
    const submissionId = text(payload?.submissionId || payload?.id);

    if (!submissionId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe a submissão que deseja atualizar.',
      });
    }

    const submission = await obterSubmissaoFormularioGestao(submissionId);

    if (!submission) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'SUBMISSAO_NAO_ENCONTRADA',
        mensagem: 'A submissão não foi encontrada.',
      });
    }

    const config = FORMULARIOS_GESTAO_POR_ID[text(submission.formId)];

    if (!config) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'FORMULARIO_INVALIDO',
        mensagem: 'Esta submissão não pertence a um formulário gerenciado.',
      });
    }

    const hasStatus = payload?.statusOperacional !== undefined;
    const hasPriority = payload?.prioridade !== undefined;
    const responsavelAction = text(
      payload?.responsavelAcao || payload?.assigneeAction
    ).toLowerCase();

    if (!hasStatus && !hasPriority && !responsavelAction) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe ao menos uma alteração operacional.',
      });
    }

    const requestedStatus = hasStatus
      ? normalizarStatusOperacionalFormularioGestao(payload.statusOperacional)
      : '';

    if (hasStatus && !requestedStatus) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Selecione um status operacional válido.',
      });
    }

    const requestedPriority = hasPriority
      ? normalizarPrioridadeFormularioGestao(payload.prioridade)
      : '';

    if (hasPriority && !requestedPriority) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'Selecione uma prioridade válida.',
      });
    }

    if (
      responsavelAction &&
      !['assumir', 'liberar'].includes(responsavelAction)
    ) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: 'A ação de responsável informada é inválida.',
      });
    }

    const existing = await buscarOperacaoFormularioGestao(submissionId);
    const current = mapOperacaoFormularioGestao(existing);
    const next = {
      statusOperacional: hasStatus
        ? requestedStatus
        : current.statusOperacional,
      prioridade: hasPriority
        ? requestedPriority
        : current.prioridade,
      responsavel: current.responsavel,
    };
    const changes = [];

    if (
      hasStatus &&
      requestedStatus !== current.statusOperacional
    ) {
      changes.push({
        action: 'STATUS_ALTERADO',
        field: 'statusOperacional',
        previousValue: current.statusOperacional,
        newValue: requestedStatus,
      });
    }

    if (
      hasPriority &&
      requestedPriority !== current.prioridade
    ) {
      changes.push({
        action: 'PRIORIDADE_ALTERADA',
        field: 'prioridade',
        previousValue: current.prioridade,
        newValue: requestedPriority,
      });
    }

    if (responsavelAction === 'assumir') {
      const actor = identidadeAdminFormularioGestao(acesso.admin);
      const currentResponsibleId = text(current.responsavel?.id);
      const currentResponsibleName = text(current.responsavel?.nome);

      next.responsavel = actor;

      if (
        currentResponsibleId !== actor.id ||
        currentResponsibleName !== actor.nome
      ) {
        changes.push({
          action: 'RESPONSAVEL_ALTERADO',
          field: 'responsavel',
          previousValue:
            currentResponsibleName ||
            currentResponsibleId ||
            '',
          newValue: actor.nome || actor.id,
        });
      }
    } else if (responsavelAction === 'liberar') {
      if (current.responsavel) {
        changes.push({
          action: 'RESPONSAVEL_ALTERADO',
          field: 'responsavel',
          previousValue:
            current.responsavel.nome ||
            current.responsavel.id ||
            '',
          newValue: '',
        });
      }

      next.responsavel = null;
    }

    if (!changes.length) {
      return jsonOk(request, {
        ok: true,
        version: 1,
        changed: false,
        operation: current,
        history: await listarHistoricoFormularioGestao(submissionId),
      });
    }

    const saved = await salvarOperacaoFormularioGestao({
      existing,
      submissionId,
      formKey: config.key,
      statusOperacional: next.statusOperacional,
      prioridade: next.prioridade,
      responsavel: next.responsavel,
    });

    const createdHistory = [];

    for (const change of changes) {
      createdHistory.push(
        await registrarHistoricoFormularioGestao({
          submissionId,
          formKey: config.key,
          ...change,
          admin: acesso.admin,
        })
      );
    }

    return jsonOk(request, {
      ok: true,
      version: 1,
      changed: true,
      operation: saved.operation,
      historyEntries: createdHistory,
      history: await listarHistoricoFormularioGestao(submissionId),
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminFormularioOperacao:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar a gestão deste envio agora.',
    });
  }
}

export async function use_oabAdminFormularioNota(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminFormularios(
      request,
      [
        FORMULARIOS_GESTAO_PERMISSIONS.VER,
        FORMULARIOS_GESTAO_PERMISSIONS.OPERAR,
      ]
    );

    if (!acesso.ok) {
      return acesso.response;
    }

    const payload = await readJsonBody(request);
    const submissionId = text(payload?.submissionId || payload?.id);
    const note = text(payload?.note || payload?.nota || payload?.detail);

    if (!submissionId || !note) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe a submissão e a nota interna.',
      });
    }

    if (
      note.length < 2 ||
      note.length > FORMULARIOS_GESTAO_NOTA_MAX_LENGTH
    ) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem:
          `A nota interna deve ter entre 2 e ${FORMULARIOS_GESTAO_NOTA_MAX_LENGTH} caracteres.`,
      });
    }

    const submission = await obterSubmissaoFormularioGestao(submissionId);

    if (!submission) {
      return jsonNotFound(request, {
        ok: false,
        codigo: 'SUBMISSAO_NAO_ENCONTRADA',
        mensagem: 'A submissão não foi encontrada.',
      });
    }

    const config = FORMULARIOS_GESTAO_POR_ID[text(submission.formId)];

    if (!config) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'FORMULARIO_INVALIDO',
        mensagem: 'Esta submissão não pertence a um formulário gerenciado.',
      });
    }

    const entry = await registrarHistoricoFormularioGestao({
      submissionId,
      formKey: config.key,
      action: 'NOTA_ADICIONADA',
      detail: note,
      admin: acesso.admin,
    });

    return jsonOk(request, {
      ok: true,
      version: 1,
      entry,
      history: await listarHistoricoFormularioGestao(submissionId),
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminFormularioNota:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível adicionar a nota interna agora.',
    });
  }
}

// ============================================================
// Envios diários de listas para as unidades
// ============================================================

export async function use_oabAdminConfiguracaoEnvios(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    const token = getAdminTokenFromRequest(request);

    if (isGet(request)) {
      const resultado = await obterConfiguracaoEnviosAdminApi(token);
      if (resultado.ok) return jsonOk(request, resultado);
      return adminEnviosErroResponse(request, resultado);
    }

    if (isPost(request)) {
      const payload = await readJsonBody(request);
      const resultado = await atualizarConfiguracaoEnviosAdminApi(payload, token);
      if (resultado.ok) return jsonOk(request, resultado);
      return adminEnviosErroResponse(request, resultado);
    }

    return jsonBadRequest(request, {
      ok: false,
      mensagem: 'Método não permitido para este endpoint.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminConfiguracaoEnvios:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível processar a configuração dos envios.',
    });
  }
}

export async function use_oabAdminEnviosListas(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const filtros = {
      status: getQueryParam(request, ['status']),
      modo: getQueryParam(request, ['modo']),
      unidadeSlug: getQueryParam(request, ['unidadeSlug', 'unidade']),
      dataIso: getQueryParam(request, ['dataIso', 'dataAtendimentosIso', 'data']),
      busca: getQueryParam(request, ['busca', 'q', 'search']),
    };

    const resultado = await listarEnviosListasAdminApi(filtros, token);
    if (resultado.ok) return jsonOk(request, resultado);
    return adminEnviosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminEnviosListas:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar o histórico de envios.',
    });
  }
}

export async function use_oabAdminTestarEnvioLista(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await testarEnvioListaAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminEnviosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminTestarEnvioLista:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível executar o envio de teste.',
    });
  }
}

export async function use_oabAdminExecutarEnvioListas(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await executarEnvioListasAdminApi(payload, token);

    // Execuções com falhas parciais continuam sendo respostas operacionais válidas.
    if (resultado.ok || resultado.executado === true) return jsonOk(request, resultado);
    return adminEnviosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminExecutarEnvioListas:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível executar os envios agora.',
    });
  }
}

export async function use_oabAdminReenviarLista(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await reenviarListaAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminEnviosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminReenviarLista:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível reenviar a lista agora.',
    });
  }
}

function adminEnviosErroResponse(request, resultado = {}) {
  const codigo = resultado.codigo;

  if (
    codigo === 'ERRO_INTERNO' ||
    codigo === 'CONFIG_INFOBIP_INCOMPLETA' ||
    codigo === 'EMAIL_NAO_ENVIADO'
  ) {
    return jsonServerError(request, resultado);
  }

  if (
    codigo === 'ADMIN_NAO_AUTORIZADO' ||
    codigo === 'SESSAO_EXPIRADA' ||
    codigo === 'SEM_PERMISSAO' ||
    codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
    codigo === 'UNIDADE_OBRIGATORIA' ||
    codigo === 'UNIDADE_NAO_ENCONTRADA' ||
    codigo === 'SEM_UNIDADES_ATIVAS' ||
    codigo === 'EMAIL_TESTE_INVALIDO' ||
    codigo === 'TESTE_OBRIGATORIO' ||
    codigo === 'DATA_INVALIDA' ||
    codigo === 'ID_OBRIGATORIO' ||
    codigo === 'NAO_ENCONTRADO' ||
    codigo === 'SEM_DESTINATARIO'
  ) {
    return jsonBadRequest(request, resultado);
  }

  return jsonServerError(request, resultado);
}


export async function use_oabAdminUnidades(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    const token = getAdminTokenFromRequest(request);

    if (isGet(request)) {
      const filtros = {
        status: getQueryParam(request, ['status']),
        busca: getQueryParam(request, ['busca', 'q', 'search']),
      };

      const resultado = await listarUnidadesAdminApi(filtros, token);

      if (resultado.ok) return jsonOk(request, resultado);
      return adminUnidadesErroResponse(request, resultado);
    }

    if (isPost(request)) {
      const payload = await readJsonBody(request);
      const resultado = await criarUnidadeAdminApi(payload, token);

      if (resultado.ok) return jsonOk(request, resultado);
      return adminUnidadesErroResponse(request, resultado);
    }

    return jsonBadRequest(request, {
      ok: false,
      mensagem: 'Método não permitido para este endpoint.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminUnidades:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível processar unidades prisionais.',
    });
  }
}

export async function use_oabAdminUnidadeAtualizar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await atualizarUnidadeAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUnidadesErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminUnidadeAtualizar:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível atualizar a unidade prisional.',
    });
  }
}

export async function use_oabAdminUnidadeStatus(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await alterarStatusUnidadeAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUnidadesErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminUnidadeStatus:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível alterar o status da unidade prisional.',
    });
  }
}

function adminUnidadesErroResponse(request, resultado) {
  if (
    resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
    resultado.codigo === 'SESSAO_EXPIRADA' ||
    resultado.codigo === 'SEM_PERMISSAO' ||
    resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
    resultado.codigo === 'DADOS_INVALIDOS' ||
    resultado.codigo === 'ID_OBRIGATORIO' ||
    resultado.codigo === 'NAO_ENCONTRADO' ||
    resultado.codigo === 'SLUG_JA_CADASTRADO' ||
    resultado.codigo === 'ALTERACAO_SLUG_BLOQUEADA'
  ) {
    return jsonBadRequest(request, resultado);
  }

  return jsonServerError(request, resultado);
}


export async function use_oabAdminBloqueioImpacto(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await analisarImpactoBloqueioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminBloqueiosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminBloqueioImpacto:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível verificar os agendamentos afetados.',
    });
  }
}

export async function use_oabAdminBloqueios(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    const token = getAdminTokenFromRequest(request);

    if (isGet(request)) {
      const filtros = {
        status: getQueryParam(request, ['status']),
        busca: getQueryParam(request, ['busca', 'q', 'search']),
        unidadeSlug: getQueryParam(request, ['unidadeSlug', 'unidade']),
        dataIso: getQueryParam(request, ['dataIso', 'data']),
        escopo: getQueryParam(request, ['escopo']),
      };

      const resultado = await listarBloqueiosAdminApi(filtros, token);

      if (resultado.ok) return jsonOk(request, resultado);
      return adminBloqueiosErroResponse(request, resultado);
    }

    if (isPost(request)) {
      const payload = await readJsonBody(request);
      const resultado = await criarBloqueioAdminApi(payload, token);

      if (resultado.ok) return jsonOk(request, resultado);
      return adminBloqueiosErroResponse(request, resultado);
    }

    return jsonBadRequest(request, {
      ok: false,
      mensagem: 'Método não permitido para este endpoint.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminBloqueios:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível processar bloqueios de agenda.',
    });
  }
}

export async function use_oabAdminBloqueioAtualizar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await atualizarBloqueioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminBloqueiosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminBloqueioAtualizar:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível atualizar o bloqueio de agenda.',
    });
  }
}

export async function use_oabAdminBloqueioRemover(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await removerBloqueioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminBloqueiosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminBloqueioRemover:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível remover o bloqueio de agenda.',
    });
  }
}

function adminBloqueiosErroResponse(request, resultado) {
  if (
    resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
    resultado.codigo === 'SESSAO_EXPIRADA' ||
    resultado.codigo === 'SEM_PERMISSAO' ||
    resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
    resultado.codigo === 'DADOS_INVALIDOS' ||
    resultado.codigo === 'ID_OBRIGATORIO' ||
    resultado.codigo === 'NAO_ENCONTRADO'
  ) {
    return jsonBadRequest(request, resultado);
  }

  return jsonServerError(request, resultado);
}


function adminSiteConteudoErroResponse(request, resultado) {
  if (
    resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
    resultado.codigo === 'SESSAO_EXPIRADA' ||
    resultado.codigo === 'SEM_PERMISSAO' ||
    resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
    resultado.codigo === 'DADOS_INVALIDOS' ||
    resultado.codigo === 'CONFLITO_REVISAO' ||
    resultado.codigo === 'CONTEUDO_NAO_ENCONTRADO' ||
    resultado.codigo === 'PAGINA_NAO_SUPORTADA' ||
    resultado.codigo === 'ARQUIVO_INVALIDO' ||
    resultado.codigo === 'UPLOAD_INDISPONIVEL' ||
    resultado.codigo === 'LIMITE_BANNERS' ||
    resultado.codigo === 'LIMITE_BANNERS_ATIVOS' ||
    resultado.codigo === 'BANNER_ATIVO' ||
    resultado.codigo === 'ULTIMO_BANNER'
  ) {
    return jsonBadRequest(request, resultado);
  }

  return jsonServerError(request, resultado);
}

export async function use_oabAdminSiteConteudo(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    const token = getAdminTokenFromRequest(request);

    if (isGet(request)) {
      const resultado = await obterConteudoSiteAdminApi(token);

      if (resultado.ok) return jsonOk(request, resultado);
      return adminSiteConteudoErroResponse(request, resultado);
    }

    if (isPost(request)) {
      const payload = await readJsonBody(request);
      const action = text(payload.action);
      let resultado;

      if (action === 'prepareImageUpload') {
        resultado = await prepararUploadImagemSiteAdminApi(payload, token);
      } else if (action === 'createHomeBanner') {
        resultado = await criarBannerHomeSiteAdminApi(payload, token);
      } else if (action === 'deleteHomeBanner') {
        resultado = await excluirBannerHomeSiteAdminApi(payload, token);
      } else if (action === 'reorderHomeBanner') {
        resultado = await reordenarBannerHomeSiteAdminApi(payload, token);
      } else {
        resultado = await salvarConteudoSiteAdminApi(payload, token);
      }

      if (resultado.ok) return jsonOk(request, resultado);
      return adminSiteConteudoErroResponse(request, resultado);
    }

    return jsonBadRequest(request, {
      ok: false,
      mensagem: 'Método não permitido para este endpoint.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminSiteConteudo:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível processar o conteúdo editorial do site.',
    });
  }
}

export async function use_oabAdminUsuarios(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    const token = getAdminTokenFromRequest(request);

    if (isGet(request)) {
      const filtros = {
        status: getQueryParam(request, ['status']),
        busca: getQueryParam(request, ['busca', 'q', 'search']),
      };

      const resultado = await listarUsuariosAdminApi(filtros, token);

      if (resultado.ok) return jsonOk(request, resultado);
      return adminUsuariosErroResponse(request, resultado);
    }

    if (isPost(request)) {
      const payload = await readJsonBody(request);
      const resultado = await criarUsuarioAdminApi(payload, token);

      if (resultado.ok) return jsonOk(request, resultado);
      return adminUsuariosErroResponse(request, resultado);
    }

    return jsonBadRequest(request, {
      ok: false,
      mensagem: 'Método não permitido para este endpoint.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminUsuarios:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível processar usuários administrativos.',
    });
  }
}

export async function use_oabAdminUsuarioAtualizar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await atualizarUsuarioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminUsuarioAtualizar:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível atualizar o usuário administrativo.',
    });
  }
}

export async function use_oabAdminUsuarioDesativar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await desativarUsuarioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminUsuarioDesativar:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível desativar o usuário administrativo.',
    });
  }
}


export async function use_oabAdminUsuarioExcluir(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await excluirUsuarioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminUsuarioExcluir:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível excluir o usuário administrativo.',
    });
  }
}

export async function use_oabAdminUsuarioResetarSenha(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await resetarSenhaUsuarioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminUsuarioResetarSenha:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível redefinir a senha do usuário administrativo.',
    });
  }
}


export async function use_oabAdminConfirmarEmail(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await confirmarEmailAdminApi(payload);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminConfirmarEmail:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível confirmar o e-mail agora.',
    });
  }
}

export async function use_oabAdminReenviarCodigoEmail(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await reenviarCodigoEmailAdminApi(payload);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminReenviarCodigoEmail:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível reenviar o código agora.',
    });
  }
}

export async function use_oabAdminTrocarSenha(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await trocarSenhaAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminTrocarSenha:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível trocar a senha agora.',
    });
  }
}


export async function use_oabAdminConvite(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getQueryParam(request, ['token', 'convite']);
    const resultado = await obterConviteAdminApi({ token });

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminConvite:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar o convite agora.',
    });
  }
}

export async function use_oabAdminConcluirConvite(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await concluirConviteAdminApi(payload);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminConcluirConvite:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível concluir o cadastro agora.',
    });
  }
}

export async function use_oabAdminUsuarioReenviarConvite(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);
    const resultado = await reenviarConviteUsuarioAdminApi(payload, token);

    if (resultado.ok) return jsonOk(request, resultado);
    return adminUsuariosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminUsuarioReenviarConvite:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível reenviar o convite agora.',
    });
  }
}

function adminUsuariosErroResponse(request, resultado) {
  const codigo = resultado?.codigo;

  if (
    codigo === 'ERRO_INTERNO' ||
    codigo === 'CONFIG_INFOBIP_INCOMPLETA' ||
    codigo === 'EMAIL_CODIGO_NAO_ENVIADO'
  ) {
    return jsonServerError(request, resultado);
  }

  if (
    codigo === 'ADMIN_NAO_AUTORIZADO' ||
    codigo === 'SESSAO_EXPIRADA' ||
    codigo === 'SEM_PERMISSAO' ||
    codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
    codigo === 'DADOS_INVALIDOS' ||
    codigo === 'ID_OBRIGATORIO' ||
    codigo === 'NAO_ENCONTRADO' ||
    codigo === 'EMAIL_JA_CADASTRADO' ||
    codigo === 'CPF_JA_CADASTRADO' ||
    codigo === 'SENHA_INVALIDA' ||
    codigo === 'OPERACAO_NAO_PERMITIDA' ||
    codigo === 'ULTIMO_ADMIN_USUARIOS' ||
    codigo === 'USUARIO_ATIVO' ||
    codigo === 'USUARIO_INATIVO' ||
    codigo === 'EMAIL_NAO_VERIFICADO' ||
    codigo === 'CODIGO_BLOQUEADO' ||
    codigo === 'CODIGO_EXPIRADO' ||
    codigo === 'CODIGO_INVALIDO'
  ) {
    return jsonBadRequest(request, resultado);
  }

  return jsonServerError(request, resultado);
}


export async function use_oabAdminDocumentos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);

    const filtros = {
      unidadeSlug: getQueryParam(request, ['unidadeSlug', 'unidade', 'slug']),
      status: getQueryParam(request, ['status']),
      dataIso: getQueryParam(request, [
        'dataIso',
        'data',
        'criadoEmIso',
        'createdDate',
      ]),
      busca: getQueryParam(request, ['busca', 'q', 'search']),
    };

    const resultado = await listarDocumentosAdminApi(filtros, token);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
      resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminDocumentos:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar os documentos administrativos.',
    });
  }
}

export async function use_oabAdminConcluirDocumento(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);

    const resultado = await concluirDocumentoAdminApi(payload, token);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
      resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
      resultado.codigo === 'ID_OBRIGATORIO' ||
      resultado.codigo === 'NAO_ENCONTRADO'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminConcluirDocumento:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível marcar o documento como concluído agora.',
    });
  }
}

export async function use_oabAdminLogin(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await loginAdminApi(payload);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
      resultado.codigo === 'CONFIG_INFOBIP_INCOMPLETA' ||
      resultado.codigo === 'EMAIL_CODIGO_NAO_ENVIADO' ||
      resultado.codigo === 'ERRO_INTERNO'
    ) {
      return jsonServerError(request, resultado);
    }

    return jsonBadRequest(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminLogin:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível acessar o painel administrativo agora.',
    });
  }
}

export async function use_oabAdminAgendamentoCatalogo(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    const token = getAdminTokenFromRequest(request);
    let resultado;

    if (isGet(request)) {
      resultado = await obterCatalogoAgendamentosAdminApi(token);
    } else if (isPost(request)) {
      const payload = await readJsonBody(request);
      resultado = await salvarCatalogoAgendamentosAdminApi(payload, token);
    } else {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    if (resultado.ok) return jsonOk(request, resultado);

    if (
      resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
      resultado.codigo === 'SESSAO_EXPIRADA' ||
      resultado.codigo === 'SEM_PERMISSAO' ||
      resultado.codigo === 'CATALOGO_REVISAO_DIVERGENTE' ||
      resultado.codigo === 'CATALOGO_OBRIGATORIO' ||
      resultado.codigo === 'OFERTA_NAO_PRONTA' ||
      resultado.codigo === 'MODALIDADE_NAO_PRONTA' ||
      resultado.codigo?.endsWith('_OBRIGATORIOS') ||
      resultado.codigo?.endsWith('_INEXISTENTE') ||
      resultado.codigo === 'OFERTA_RECURSO_LOCAL_DIVERGENTE' ||
      resultado.codigo === 'CATALOGO_ID_INVALIDO' ||
      resultado.codigo === 'CATALOGO_ID_DUPLICADO'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminAgendamentoCatalogo:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível processar a configuração de agendamentos.',
    });
  }
}


export async function use_oabAdminAgendamentos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);

    const filtros = {
      unidadeSlug: getQueryParam(request, ['unidadeSlug', 'unidade', 'slug']),
      status: getQueryParam(request, ['status']),
      dataIso: getQueryParam(request, [
        'dataIso',
        'data',
        'dataAtendimentoIso',
      ]),
      busca: getQueryParam(request, ['busca', 'q', 'search']),
      shadowDebug: getQueryParam(request, ['shadowDebug']),
    };

    const resultado = await listarAgendamentosAdminApi(filtros, token);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
      resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminAgendamentos:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar os agendamentos administrativos.',
    });
  }
}

export async function use_oabAdminCancelarAgendamento(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);

    const resultado = await cancelarAgendamentoAdminApi(payload, token);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
      resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
      resultado.codigo === 'ID_OBRIGATORIO' ||
      resultado.codigo === 'NAO_ENCONTRADO' ||
      resultado.codigo === 'STATUS_INVALIDO'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminCancelarAgendamento:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível cancelar o agendamento agora.',
    });
  }
}

export async function use_oabAdminRemarcarAgendamento(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const token = getAdminTokenFromRequest(request);
    const payload = await readJsonBody(request);

    const resultado = await remarcarAgendamentoAdminApi(payload, token);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
      resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
      resultado.codigo === 'ID_OBRIGATORIO' ||
      resultado.codigo === 'NAO_ENCONTRADO' ||
      resultado.codigo === 'STATUS_INVALIDO' ||
      resultado.codigo === 'DADOS_OBRIGATORIOS' ||
      resultado.codigo === 'UNIDADE_INVALIDA' ||
      resultado.codigo === 'MESMO_HORARIO' ||
      resultado.codigo === 'HORARIO_INDISPONIVEL'
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminRemarcarAgendamento:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível remarcar o agendamento agora.',
    });
  }
}

// ============================================================
// Portal de Gestão — presença e certificados dentro de Eventos
// ============================================================

const EVENTOS_OPERACAO_PERMISSIONS = {
  VER: 'eventos.ver',
  PRESENCA: 'eventos.presenca',
  CERTIFICADOS: 'eventos.certificados',
};

function eventosOperacaoErroResponse(request, resultado) {
  const safeResultado = resultado || {
    ok: false,
    codigo: 'ERRO_INTERNO',
    mensagem: 'Não foi possível concluir a operação do evento.',
  };

  if (
    safeResultado.codigo === 'ERRO_INTERNO' ||
    safeResultado.codigo === 'CONFIG_ADMIN_INCOMPLETA' ||
    safeResultado.codigo === 'CONFIG_INFOBIP_INCOMPLETA'
  ) {
    return jsonServerError(request, safeResultado);
  }

  return jsonBadRequest(request, safeResultado);
}

async function validarAcessoAdminEventosOperacao(
  request,
  permissoesObrigatorias = [EVENTOS_OPERACAO_PERMISSIONS.VER]
) {
  const token = getAdminTokenFromRequest(request);

  if (!token) {
    return {
      ok: false,
      response: jsonBadRequest(request, {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'Acesso administrativo obrigatório.',
      }),
    };
  }

  const resultado = await meAdminApi(token);

  if (!resultado || !resultado.ok) {
    return {
      ok: false,
      response: eventosOperacaoErroResponse(request, resultado),
    };
  }

  const permissoes = Array.isArray(resultado.permissoes)
    ? resultado.permissoes.map(text).filter(Boolean)
    : [];
  const required = Array.isArray(permissoesObrigatorias)
    ? permissoesObrigatorias.map(text).filter(Boolean)
    : [text(permissoesObrigatorias)].filter(Boolean);
  const legacy = resultado.legacy === true;
  const permitido =
    legacy || required.every((permissao) => permissoes.includes(permissao));

  if (!permitido) {
    return {
      ok: false,
      response: jsonBadRequest(request, {
        ok: false,
        codigo: 'SEM_PERMISSAO',
        permissaoNecessaria: required.join(','),
        mensagem: 'Seu perfil não possui permissão para executar esta operação em Eventos.',
      }),
    };
  }

  return {
    ok: true,
    token,
    admin: resultado.admin || null,
    permissoes,
    legacy,
    podeEditarPresenca:
      legacy || permissoes.includes(EVENTOS_OPERACAO_PERMISSIONS.PRESENCA),
    podeEmitirCertificados:
      legacy || permissoes.includes(EVENTOS_OPERACAO_PERMISSIONS.CERTIFICADOS),
  };
}

export async function use_oabAdminEventoOperacao(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminEventosOperacao(
      request,
      [EVENTOS_OPERACAO_PERMISSIONS.VER]
    );
    if (!acesso.ok) return acesso.response;

    const eventId = getQueryParam(request, ['eventId', 'eventoId', 'id']);

    if (!eventId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o eventId.',
      });
    }

    const resultado = await getEventoCertificados(eventId);

    return jsonOk(request, {
      ok: true,
      ...resultado,
      operacao: {
        podeEditarPresenca: acesso.podeEditarPresenca === true,
        podeEmitirCertificados: acesso.podeEmitirCertificados === true,
      },
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminEventoOperacao:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar participantes e certificados deste evento agora.',
    });
  }
}

export async function use_oabAdminEventoPresenca(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminEventosOperacao(
      request,
      [EVENTOS_OPERACAO_PERMISSIONS.PRESENCA]
    );
    if (!acesso.ok) return acesso.response;

    const payload = await readJsonBody(request);
    const eventId = text(payload.eventId || payload.eventoId);
    const guestId = text(payload.guestId || payload.participanteId || payload.id);
    const temCompareceu = Object.prototype.hasOwnProperty.call(payload, 'compareceu');
    const temPresente = Object.prototype.hasOwnProperty.call(payload, 'presente');

    if (!eventId || !guestId || (!temCompareceu && !temPresente)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe evento, participante e o novo estado de presença.',
      });
    }

    const compareceu = temCompareceu
      ? payload.compareceu === true
      : payload.presente === true;
    const rsvpId = text(payload.rsvpId);
    const rsvpGuestId = Number(payload.rsvpGuestId);
    const nome = text(payload.nome || payload.name || payload.participantName);
    const email = text(payload.email || payload.participantEmail);

    // salvarPresenca() recebe o evento no topo e uma lista de alterações
    // em `changes`. O bridge HTTP do Portal converte a ação individual para
    // esse contrato sem duplicar a regra de negócio do backend de certificados.
    const presencaChange = {
      guestId,
      compareceu,
      ...(rsvpId ? { rsvpId } : {}),
      ...(Number.isFinite(rsvpGuestId) && rsvpGuestId > 0
        ? { rsvpGuestId }
        : {}),
      ...(nome ? { nome } : {}),
      ...(email ? { email } : {}),
    };

    const presencaPayload = {
      eventId,
      changes: [presencaChange],
      actionOrigin: 'event_individual',
    };

    const adminCertificados = acesso.admin
      ? {
          ...acesso.admin,
          _id: text(acesso.admin._id || acesso.admin.id),
          id: text(acesso.admin.id || acesso.admin._id),
          nome: text(acesso.admin.nome || acesso.admin.name),
          name: text(acesso.admin.name || acesso.admin.nome),
          email: text(acesso.admin.email),
        }
      : null;

    const resultado = await salvarPresenca(
      presencaPayload,
      { admin: adminCertificados }
    );

    if (resultado && resultado.ok) {
      return jsonOk(request, resultado);
    }

    return certificadosErroResponse(request, {
      ...resultado,
      codigo: resultado?.codigo || 'PRESENCA_NAO_ATUALIZADA',
      mensagem:
        resultado?.mensagem ||
        'A presença deste participante não pôde ser atualizada.',
    });
  } catch (err) {
    console.error('Erro no endpoint oabAdminEventoPresenca:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar a presença agora.',
    });
  }
}

export async function use_oabAdminEventoCertificado(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acesso = await validarAcessoAdminEventosOperacao(
      request,
      [EVENTOS_OPERACAO_PERMISSIONS.CERTIFICADOS]
    );
    if (!acesso.ok) return acesso.response;

    const payload = await readJsonBody(request);
    const eventId = text(payload.eventId || payload.eventoId);
    const guestId = text(payload.guestId || payload.participanteId || payload.id);

    if (!eventId || !guestId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe evento e participante para emitir o certificado.',
      });
    }

    const resultado = await emitirCertificado({
      ...payload,
      eventId,
      guestId,
    });

    if (resultado && resultado.ok) {
      return jsonOk(request, resultado);
    }

    return certificadosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint oabAdminEventoCertificado:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível emitir o certificado agora.',
    });
  }
}

// ============================================================
// Central de Certificados — endpoints públicos/admin iniciais
// ============================================================

function certificadosErroResponse(request, resultado) {
  const codigo = resultado?.codigo;

  if (
    codigo === 'ERRO_INTERNO' ||
    codigo === 'CONFIG_INFOBIP_INCOMPLETA' ||
    codigo === 'EMAIL_CODIGO_NAO_ENVIADO'
  ) {
    return jsonServerError(request, resultado);
  }

  if (
    codigo === 'DADOS_OBRIGATORIOS' ||
    codigo === 'EVENTO_INVALIDO' ||
    codigo === 'PARTICIPANTE_NAO_ENCONTRADO' ||
    codigo === 'PARTICIPANTE_EVENTO_INVALIDO' ||
    codigo === 'PRESENCA_NAO_CONFIRMADA' ||
    codigo === 'EMAIL_INVALIDO' ||
    codigo === 'CODIGO_OBRIGATORIO' ||
    codigo === 'MOTIVO_OBRIGATORIO' ||
    codigo === 'CERTIFICADO_NAO_ENCONTRADO' ||
    codigo === 'CERTIFICADO_NAO_INVALIDAVEL'
  ) {
    return jsonBadRequest(request, resultado);
  }

  return jsonBadRequest(request, resultado || {
    ok: false,
    mensagem: 'Não foi possível concluir a operação.'
  });
}

function certificadosAdminErroResponse(request, resultado) {
  const safeResultado = resultado || {
    ok: false,
    codigo: 'ADMIN_NAO_AUTORIZADO',
    mensagem: 'Acesso administrativo obrigatório.'
  };

  const codigo = safeResultado.codigo;

  if (
    codigo === 'ERRO_INTERNO' ||
    codigo === 'CONFIG_ADMIN_INCOMPLETA'
  ) {
    return jsonServerError(request, safeResultado);
  }

  return jsonBadRequest(request, safeResultado);
}

async function validarAcessoAdminCertificados(request, permission) {
  const token = getAdminTokenFromRequest(request);

  if (!token) {
    return {
      ok: false,
      response: jsonBadRequest(request, {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'Acesso administrativo obrigatório.'
      })
    };
  }

  const resultado = await meCertificadosAdminApi(token, permission);

  if (resultado && resultado.ok) {
    return {
      ok: true,
      token,
      admin: resultado.admin || null,
      permissoes: Array.isArray(resultado.permissoes) ? resultado.permissoes : []
    };
  }

  return {
    ok: false,
    response: certificadosAdminErroResponse(request, resultado)
  };
}



// ============================================================
// Portal de Gestão — Eventos
// ============================================================

export async function use_oabAdminEventos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const filtros = {
      busca: getQueryParam(request, ['busca', 'q', 'search']),
      tipo: getQueryParam(request, ['tipo', 'type']),
      status: getQueryParam(request, ['status']),
      pagina: getQueryParam(request, ['pagina', 'page']),
      pageSize: getQueryParam(request, ['pageSize', 'limit']),
    };

    const resultado = await listarEventosAdminApi(
      filtros,
      getAdminTokenFromRequest(request)
    );

    if (resultado && resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado &&
      (
        resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
        resultado.codigo === 'SESSAO_EXPIRADA' ||
        resultado.codigo === 'SEM_PERMISSAO'
      )
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(
      request,
      resultado || {
        ok: false,
        mensagem: 'Não foi possível carregar os eventos administrativos.',
      }
    );
  } catch (err) {
    console.error('Erro no endpoint oabAdminEventos:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar os eventos agora.',
    });
  }
}

export async function use_oabAdminEventoFinanceiroRelatorio(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'METODO_NAO_PERMITIDO',
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const eventId = getQueryParam(request, ['eventId', 'eventoId', 'id']);
    if (!eventId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o eventId.',
      });
    }

    const resultado = await obterRelatorioFinanceiroEventoAdminApi(
      eventId,
      getAdminTokenFromRequest(request)
    );

    if (resultado && resultado.ok) {
      return jsonOk(request, resultado);
    }

    if (
      resultado &&
      (
        resultado.codigo === 'ADMIN_NAO_AUTORIZADO' ||
        resultado.codigo === 'SESSAO_EXPIRADA' ||
        resultado.codigo === 'SEM_PERMISSAO' ||
        resultado.codigo === 'DADOS_OBRIGATORIOS'
      )
    ) {
      return jsonBadRequest(request, resultado);
    }

    return jsonServerError(
      request,
      resultado || {
        ok: false,
        mensagem: 'Não foi possível gerar o relatório financeiro deste evento.',
      }
    );
  } catch (err) {
    console.error('Erro no endpoint oabAdminEventoFinanceiroRelatorio:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível gerar o relatório financeiro agora.',
    });
  }
}

// ============================================================
// Central de Certificados — autenticação e usuários próprios
// ============================================================

function certificadosAdminApiResponse(request, resultado) {
  if (resultado && resultado.ok) return jsonOk(request, resultado);
  if (resultado && (resultado.codigo === 'ERRO_INTERNO' || resultado.codigo === 'CONFIG_ADMIN_INCOMPLETA')) {
    return jsonServerError(request, resultado);
  }
  return jsonBadRequest(request, resultado || {
    ok: false,
    mensagem: 'Não foi possível concluir a operação administrativa.'
  });
}

export async function use_certificadosAdminLogin(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isPost(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });

    const payload = await readJsonBody(request);
    let resultado = await loginCertificadosAdminApi(payload);

    if (resultado && resultado.codigo === 'MIGRACAO_NECESSARIA') {
      const legado = await loginAdminApi(payload);

      if (!legado || !legado.ok) {
        return certificadosAdminApiResponse(request, legado || {
          ok: false,
          codigo: 'CREDENCIAIS_INVALIDAS',
          mensagem: 'E-mail ou senha inválidos.'
        });
      }

      const migracao = await migrarLoginLegadoCertificadosAdminApi(payload, legado);

      if (!migracao || !migracao.ok) {
        return certificadosAdminApiResponse(request, migracao);
      }

      resultado = await loginCertificadosAdminApi(payload);
    }

    return certificadosAdminApiResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminLogin:', err);
    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível entrar no painel agora.'
    });
  }
}

export async function use_certificadosAdminMe(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isGet(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await meCertificadosAdminApi(getAdminTokenFromRequest(request)));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminMe:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível validar a sessão.' });
  }
}

export async function use_certificadosAdminUsuarios(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    const token = getAdminTokenFromRequest(request);
    if (isGet(request)) {
      const filtros = { status: getQueryParam(request, ['status']), busca: getQueryParam(request, ['busca','q','search']) };
      return certificadosAdminApiResponse(request, await listarUsuariosCertificadosAdminApi(filtros, token));
    }
    if (isPost(request)) return certificadosAdminApiResponse(request, await criarUsuarioCertificadosAdminApi(await readJsonBody(request), token));
    return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminUsuarios:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível processar os usuários.' });
  }
}

export async function use_certificadosAdminUsuarioAtualizar(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isPost(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await atualizarUsuarioCertificadosAdminApi(await readJsonBody(request), getAdminTokenFromRequest(request)));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminUsuarioAtualizar:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível atualizar o usuário.' });
  }
}

export async function use_certificadosAdminUsuarioDesativar(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isPost(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await desativarUsuarioCertificadosAdminApi(await readJsonBody(request), getAdminTokenFromRequest(request)));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminUsuarioDesativar:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível desativar o usuário.' });
  }
}

export async function use_certificadosAdminUsuarioExcluir(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isPost(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await excluirUsuarioCertificadosAdminApi(await readJsonBody(request), getAdminTokenFromRequest(request)));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminUsuarioExcluir:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível excluir o usuário.' });
  }
}

export async function use_certificadosAdminUsuarioReenviarConvite(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isPost(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await reenviarConviteCertificadosAdminApi(await readJsonBody(request), getAdminTokenFromRequest(request)));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminUsuarioReenviarConvite:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível reenviar o convite.' });
  }
}

export async function use_certificadosAdminConvite(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isGet(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await obterConviteCertificadosAdminApi(getQueryParam(request, ['token'])));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminConvite:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível consultar o convite.' });
  }
}

export async function use_certificadosAdminConcluirConvite(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isPost(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await concluirConviteCertificadosAdminApi(await readJsonBody(request)));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminConcluirConvite:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível concluir o convite.' });
  }
}

export async function use_certificadosAdminTrocarSenha(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    if (!isPost(request)) return jsonBadRequest(request, { ok: false, mensagem: 'Método não permitido.' });
    return certificadosAdminApiResponse(request, await trocarSenhaCertificadosAdminApi(await readJsonBody(request), getAdminTokenFromRequest(request)));
  } catch (err) {
    console.error('Erro no endpoint certificadosAdminTrocarSenha:', err);
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível alterar a senha.' });
  }
}

export async function use_certificadosAdminConfirmarEmail(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    return certificadosAdminApiResponse(request, await confirmarEmailCertificadosAdminApi(await readJsonBody(request)));
  } catch (err) {
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível confirmar o e-mail.' });
  }
}

export async function use_certificadosAdminReenviarCodigoEmail(request) {
  try {
    if (isOptions(request)) return jsonOk(request, { ok: true, method: 'OPTIONS' });
    return certificadosAdminApiResponse(request, await reenviarCodigoEmailCertificadosAdminApi(await readJsonBody(request)));
  } catch (err) {
    return jsonServerError(request, { ok: false, mensagem: 'Não foi possível reenviar o código.' });
  }
}

export function use_certificadosHealth(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    return jsonOk(request, {
      ok: true,
      service: 'central-certificados-wix-api',
      product: 'Central de Certificados',
      message: 'API da Central de Certificados respondendo.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro no endpoint certificadosHealth:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Erro interno no endpoint de teste da Central de Certificados.',
    });
  }
}

export async function use_certificadosEventos(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.ver');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const busca = getQueryParam(request, ['busca', 'q', 'search']);
    const resultado = await pesquisarEventosCertificados(busca);

    return jsonOk(request, {
      ok: true,
      busca: resultado.busca,
      total: resultado.eventos.length,
      eventos: resultado.eventos,
      participantes: resultado.participantes,
    });
  } catch (err) {
    console.error('Erro no endpoint certificadosEventos:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar os eventos para certificados.',
    });
  }
}

export async function use_certificadosEvento(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.ver');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const eventId = getQueryParam(request, ['eventId', 'eventoId', 'id']);

    if (!eventId) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o eventId.',
      });
    }

    const resultado = await getEventoCertificados(eventId);

    return jsonOk(request, {
      ok: true,
      ...resultado,
    });
  } catch (err) {
    console.error('Erro no endpoint certificadosEvento:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar o evento para certificados.',
    });
  }
}


export async function use_certificadosPresenca(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.presenca');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const payload = await readJsonBody(request);
    const resultado = await salvarPresenca(payload, { admin: acessoAdmin.admin });

    if (resultado.ok) return jsonOk(request, resultado);

    return certificadosErroResponse(request, {
      ...resultado,
      codigo: resultado.codigo || 'PRESENCA_NAO_ATUALIZADA',
      mensagem:
        resultado.mensagem ||
        'Uma ou mais alterações de presença não puderam ser salvas.',
    });
  } catch (err) {
    console.error('Erro no endpoint certificadosPresenca:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível salvar a presença agora.',
    });
  }
}

export async function use_certificadosPresencaAuditoria(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.auditoria');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const eventId = getQueryParam(request, ['eventId', 'eventoId', 'id']);
    const limit = Number(getQueryParam(request, ['limit', 'limite']) || 200);
    const resultado = await listarPresencaAuditoria({ eventId, limit });
    return jsonOk(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosPresencaAuditoria:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar o histórico de presença agora.',
    });
  }
}

export async function use_certificadosPresencaReverter(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.auditoria');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const payload = await readJsonBody(request);
    const resultado = await reverterPresencaAuditoria(payload, {
      admin: acessoAdmin.admin,
    });

    if (resultado.ok) return jsonOk(request, resultado);
    return certificadosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosPresencaReverter:', err);
    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível reverter a presença agora.',
    });
  }
}

export async function use_certificadosParticipanteAtualizar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.participantes.editar');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const payload = await readJsonBody(request);
    const resultado = await atualizarParticipanteCertificados(payload);

    if (resultado.ok) return jsonOk(request, resultado);

    return certificadosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosParticipanteAtualizar:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar o participante agora.',
    });
  }
}

export async function use_certificadosParticipante(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.ver');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const email = getQueryParam(request, ['email', 'participantEmail']);
    const nome = getQueryParam(request, ['nome', 'name', 'participantName']);
    const participantKey = getQueryParam(request, [
      'participantKey',
      'participanteKey',
      'key',
    ]);

    if (!email && !nome && !participantKey) {
      return jsonBadRequest(request, {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o participante, o e-mail ou o nome.',
      });
    }

    const resultado = await getParticipanteCertificados({
      email,
      nome,
      participantKey,
    });

    return jsonOk(request, {
      ok: true,
      ...resultado,
    });
  } catch (err) {
    console.error('Erro no endpoint certificadosParticipante:', err);

    return jsonServerError(request, {
      ok: false,
      mensagem: 'Não foi possível carregar o histórico do participante.',
    });
  }
}

export async function use_certificadosEmitir(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.emitir');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const payload = await readJsonBody(request);
    const resultado = await emitirCertificado(payload);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    return certificadosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosEmitir:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível emitir o certificado agora.',
    });
  }
}


export async function use_certificadosInvalidar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.invalidar');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const payload = await readJsonBody(request);
    const admin = acessoAdmin.admin || {};
    const resultado = await invalidarCertificado({
      ...payload,
      performedBy: {
        id: admin._id || admin.id || '',
        nome: admin.nome || admin.name || '',
        email: admin.email || '',
      },
    });

    if (resultado.ok) return jsonOk(request, resultado);
    return certificadosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosInvalidar:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível invalidar o certificado agora.',
    });
  }
}

export async function use_certificadosValidar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isGet(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const codigo = getQueryParam(request, [
      'codigo',
      'code',
      'certificateCode',
    ]);

    const resultado = await validarCertificado({ codigo });

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    return certificadosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosValidar:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível validar o certificado agora.',
    });
  }
}

export async function use_certificadosConsultar(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const payload = await readJsonBody(request);
    const resultado = await consultarCertificados(payload);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    return certificadosErroResponse(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosConsultar:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível consultar certificados agora.',
    });
  }
}

export async function use_certificadosRegistrarEnvio(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, {
        ok: true,
        method: 'OPTIONS',
      });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.enviar');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const payload = await readJsonBody(request);
    const resultado = await registrarEnvioCertificado(payload);

    if (resultado.ok) {
      return jsonOk(request, resultado);
    }

    return jsonBadRequest(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosRegistrarEnvio:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível registrar o envio do certificado agora.',
    });
  }
}


export async function use_certificadosAtualizarEnvios(request) {
  try {
    if (isOptions(request)) {
      return jsonOk(request, { ok: true, method: 'OPTIONS' });
    }

    if (!isPost(request)) {
      return jsonBadRequest(request, {
        ok: false,
        mensagem: 'Método não permitido para este endpoint.',
      });
    }

    const acessoAdmin = await validarAcessoAdminCertificados(request, 'certificados.enviar');
    if (!acessoAdmin.ok) return acessoAdmin.response;

    const payload = await readJsonBody(request);
    const resultado = await atualizarStatusEnviosCertificados(payload);

    if (resultado.ok) return jsonOk(request, resultado);
    return jsonBadRequest(request, resultado);
  } catch (err) {
    console.error('Erro no endpoint certificadosAtualizarEnvios:', err);

    return jsonServerError(request, {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar os status de entrega agora.',
    });
  }
}