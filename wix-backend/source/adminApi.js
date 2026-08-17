import wixData from 'wix-data';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { elevate } from 'wix-auth';
import { mediaManager } from 'wix-media-backend';
import { orders } from 'wix-events.v2';

import {
  listarHorariosDisponiveis,
} from 'backend/disponibilidade';

import {
  obterConfiguracaoEnviosListasCore,
  atualizarConfiguracaoEnviosListasCore,
  listarEnviosListasCore,
  testarEnvioListaCore,
  executarEnvioListasAgoraCore,
  reenviarListaCore,
} from 'backend/enviosListas';

import {
  observeAdminAppointmentsShadowRead,
} from 'backend/agendamentosAdminShadowBridge';

import {
  obterCatalogoAgendamentosAdminCore,
  salvarCatalogoAgendamentosAdminCore,
  obterCatalogoAgendamentosPublicoCore,
} from 'backend/agendamentosConfiguracaoStore';

import {
  liberarOcupacaoAgendamento,
  remarcarAgendamentoPublicoV2,
} from 'backend/agendamentosPublicosStore';

const COL = {
  UNIDADES: 'Import4258',
  AGENDAMENTOS: 'Import4259',
  SOLICITACOES_DOCUMENTOS: 'Import4260',
  ADMIN_USUARIOS: 'Import4263',
  ADMIN_SESSOES: 'Import4262',
  ADMIN_LOGS: 'Import4261',
  BLOQUEIOS_AGENDA: 'Import4256',
  DESTAQUES_HOME: 'DestaquesHome',
  PAGINAS_INSTITUCIONAIS: 'PaginasInstitucionais',
};

const ADMIN_SECRETS = {
  EMAILS: 'OAB_ADMIN_EMAILS',
  PASSWORD: 'OAB_ADMIN_PASSWORD',
  TOKEN: 'OAB_ADMIN_TOKEN',
};

const MAX_RESULTS = 250;
const CANCELAMENTO_ANTECEDENCIA_HORAS = 24;
const REMARCACAO_ANTECEDENCIA_HORAS = 24;
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_MAX_TENTATIVAS = 5;
const EMAIL_CODE_BLOQUEIO_MS = 15 * 60 * 1000;
const ADMIN_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INFOBIP_EMAIL_ENDPOINT = '/email/3/send';
const CENTRAL_PUBLIC_URL = 'https://central.juizdefora-oabmg.org.br';
const LEGACY_ADMIN_ID = 'legacy-secret-admin';
const AGENDAMENTOS_SHADOW_READ_ENABLED = true;
const SITE_EDITOR_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const SITE_EDITOR_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const HOME_BANNERS_MAX_ACTIVE = 5;
const HOME_BANNERS_MAX_TOTAL = 20;
const SITE_EDITOR_BANNER_FOLDER = '/oab-jf/site/banners';
const obterResumoVendasEventoElevado = elevate(orders.getSummary);
const listarPedidosEventoElevado = elevate(orders.listOrders);

const ADMIN_PERMISSIONS = {
  AGENDAMENTOS_VER: 'agendamentos.ver',
  AGENDAMENTOS_CANCELAR: 'agendamentos.cancelar',
  AGENDAMENTOS_REMARCAR: 'agendamentos.remarcar',
  AGENDAMENTOS_CONFIGURAR: 'agendamentos.configurar',

  DOCUMENTOS_VER: 'documentos.ver',
  DOCUMENTOS_ABRIR: 'documentos.abrir',
  DOCUMENTOS_CONCLUIR: 'documentos.concluir',

  UNIDADES_VER: 'unidades.ver',
  UNIDADES_CRIAR: 'unidades.criar',
  UNIDADES_EDITAR: 'unidades.editar',
  UNIDADES_ATIVAR: 'unidades.ativar',

  BLOQUEIOS_VER: 'bloqueios.ver',
  BLOQUEIOS_CRIAR: 'bloqueios.criar',
  BLOQUEIOS_EDITAR: 'bloqueios.editar',
  BLOQUEIOS_REMOVER: 'bloqueios.remover',

  FORMULARIOS_VER: 'formularios.ver',
  FORMULARIOS_OPERAR: 'formularios.operar',
  FORMULARIOS_ANEXOS: 'formularios.anexos',

  EVENTOS_VER: 'eventos.ver',
  EVENTOS_FINANCEIRO: 'eventos.financeiro',
  EVENTOS_PRESENCA: 'eventos.presenca',
  EVENTOS_CERTIFICADOS: 'eventos.certificados',

  USUARIOS_VER: 'usuarios.ver',
  USUARIOS_CRIAR: 'usuarios.criar',
  USUARIOS_EDITAR: 'usuarios.editar',
  USUARIOS_DESATIVAR: 'usuarios.desativar',

  CONFIG_VER: 'config.ver',
  CONFIG_TESTAR_ENVIOS: 'config.testar_envios',
  CONFIG_ATIVAR_ENVIOS: 'config.ativar_envios',

  SITE_CONTEUDO_VER: 'site.conteudo.ver',
  SITE_CONTEUDO_EDITAR: 'site.conteudo.editar',
};

const ALL_ADMIN_PERMISSIONS = Object.keys(ADMIN_PERMISSIONS).map((key) => ADMIN_PERMISSIONS[key]);
const ADMIN_PERMISSIONS_SCHEMA_VERSION = 6;
const USUARIOS_CRITICOS_PERMISSAO = ADMIN_PERMISSIONS.USUARIOS_EDITAR;

export async function loginAdminApi(payload = {}) {
  try {
    const email = normalizeEmail(payload.email || payload.login || payload.usuario);
    const senha = text(payload.senha || payload.password);

    if (!email || !senha) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe e-mail e senha para acessar o painel.',
      };
    }

    const usuario = await buscarAdminUsuarioPorEmail(email);

    if (usuario && usuario._id) {
      if (usuario.ativo === false) {
        return {
          ok: false,
          codigo: 'USUARIO_INATIVO',
          mensagem: 'Este usuário está inativo. Fale com um administrador.',
        };
      }

      if (usuario.cadastroConcluido === false || text(usuario.statusConvite) === 'pendente') {
        return {
          ok: false,
          codigo: 'CADASTRO_PENDENTE',
          mensagem: 'Conclua seu cadastro pelo convite enviado por e-mail antes de acessar o painel.',
        };
      }

      const senhaOk = await validarSenhaUsuario(usuario, senha);

      if (!senhaOk) {
        const loginReparado = await tentarRepararLoginComCredencialLegacy(usuario, email, senha);

        if (loginReparado && loginReparado.ok) {
          return loginReparado;
        }

        return {
          ok: false,
          codigo: 'ADMIN_NAO_AUTORIZADO',
          mensagem: 'E-mail ou senha inválidos.',
        };
      }

      if (usuarioPrecisaVerificarEmail(usuario)) {
        const envio = await gerarEnviarCodigoEmailUsuario(usuario, 'login');

        if (!envio.ok) {
          return envio;
        }

        return {
          ok: true,
          precisaVerificarEmail: true,
          mensagem: 'Enviamos um código de validação para o e-mail cadastrado.',
          email,
          admin: mapAdminUsuarioSeguro(envio.usuario || usuario),
        };
      }

      const sessao = await criarSessaoAdmin(usuario);
      const agora = new Date();

      await atualizarUsuarioSemFalhar(usuario, {
        ultimoAcessoEm: agora,
        atualizadoEm: agora,
      });

      return {
        ok: true,
        mensagem: 'Login administrativo autorizado.',
        token: sessao.token,
        precisaTrocarSenha: usuario.precisaTrocarSenha === true,
        admin: mapAdminUsuarioSeguro({ ...usuario, ultimoAcessoEm: agora }),
      };
    }

    // Compatibilidade/contingência: mantém o acesso antigo por secrets.
    // Use este caminho apenas para bootstrap ou emergência.
    const config = await getAdminConfig();

    if (!config.emails.length || !config.password || !config.token) {
      return {
        ok: false,
        codigo: 'CONFIG_ADMIN_INCOMPLETA',
        mensagem: 'Configuração administrativa incompleta.',
      };
    }

    const emailAutorizado = config.emails.includes(email);
    const senhaCorreta = senha === config.password;

    if (!emailAutorizado || !senhaCorreta) {
      return {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'E-mail ou senha inválidos.',
      };
    }

    return {
      ok: true,
      mensagem: 'Login administrativo autorizado.',
      token: config.token,
      admin: {
        _id: LEGACY_ADMIN_ID,
        nome: 'Administrador',
        email,
        ativo: true,
        permissoes: ALL_ADMIN_PERMISSIONS,
        legacy: true,
      },
    };
  } catch (err) {
    console.error('Erro em loginAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível acessar o painel administrativo agora.',
    };
  }
}

export async function listarAgendamentosAdminApi(filtros = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.AGENDAMENTOS_VER);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const unidadeSlug = text(filtros.unidadeSlug || filtros.unidade || filtros.slug);
    const status = text(filtros.status).toLowerCase();

    const dataIso = normalizeDateIso(
      filtros.dataIso || filtros.data || filtros.dataAtendimentoIso
    );

    const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);
    const shadowDebug = ['1', 'true', 'on', 'enabled'].includes(
      text(filtros.shadowDebug).toLowerCase()
    );

    let query = wixData
      .query(COL.AGENDAMENTOS)
      .descending('criadoEm')
      .limit(MAX_RESULTS);

    if (unidadeSlug && unidadeSlug !== 'todos') {
      query = query.eq('unidadeSlug', unidadeSlug);
    }

    if (status && status !== 'todos') {
      query = query.eq('status', status);
    }

    if (dataIso && /^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      query = query.eq('dataAtendimentoIso', dataIso);
    }

    const result = await query.find({ suppressAuth: true });

    const shadowReadReport = await observeAdminAppointmentsShadowRead({
      wixData,
      rawResult: result,
      filtros,
      enabled: AGENDAMENTOS_SHADOW_READ_ENABLED || shadowDebug,
      logger: (report) => console.info('agendamentos.shadow-read', report),
    });

    let agendamentos = (result.items || []).map(mapAgendamentoAdmin);

    if (busca) {
      agendamentos = agendamentos.filter((item) =>
        agendamentoMatchesBusca(item, busca)
      );
    }

    return {
      ok: true,
      total: agendamentos.length,
      agendamentos,
      ...(shadowDebug ? { shadowRead: shadowReadReport } : {}),
    };
  } catch (err) {
    console.error('Erro em listarAgendamentosAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar os agendamentos administrativos.',
    };
  }
}



export async function obterCatalogoAgendamentosAdminApi(tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.AGENDAMENTOS_CONFIGURAR
    );

    if (!tokenOk.ok) return tokenOk;

    const resultado = await obterCatalogoAgendamentosAdminCore();

    return {
      ok: true,
      ...resultado,
    };
  } catch (err) {
    console.error('Erro em obterCatalogoAgendamentosAdminApi:', err);

    return catalogoAgendamentosErrorResult(
      err,
      'Não foi possível carregar a configuração de agendamentos.'
    );
  }
}

export async function salvarCatalogoAgendamentosAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.AGENDAMENTOS_CONFIGURAR
    );

    if (!tokenOk.ok) return tokenOk;

    const catalog = payload.catalog || payload.catalogo;
    const expectedRevision = payload.expectedRevision ?? payload.revisionEsperada;

    if (!catalog || typeof catalog !== 'object') {
      return {
        ok: false,
        codigo: 'CATALOGO_OBRIGATORIO',
        mensagem: 'Envie a configuração completa de agendamentos para salvar.',
      };
    }

    const updatedBy = normalizeEmail(tokenOk?.usuario?.email) || 'administracao';
    const resultado = await salvarCatalogoAgendamentosAdminCore({
      catalog,
      expectedRevision,
      updatedBy,
    });

    await registrarAdminLog(
      tokenOk,
      'agendamentos.configuracao.salvar',
      'AgendamentoConfiguracoes',
      'catalogo-principal',
      {
        revision: resultado?.catalog?.revision,
        modalidades: resultado?.catalog?.modalities?.length || 0,
        locais: resultado?.catalog?.locations?.length || 0,
        recursos: resultado?.catalog?.resources?.length || 0,
        ofertas: resultado?.catalog?.offers?.length || 0,
      }
    );

    return {
      ok: true,
      mensagem: 'Configuração de agendamentos salva com sucesso.',
      ...resultado,
    };
  } catch (err) {
    console.error('Erro em salvarCatalogoAgendamentosAdminApi:', err);

    return catalogoAgendamentosErrorResult(
      err,
      'Não foi possível salvar a configuração de agendamentos.'
    );
  }
}

export async function obterCatalogoAgendamentosPublicoApi() {
  try {
    const catalogo = await obterCatalogoAgendamentosPublicoCore();

    return {
      ok: true,
      catalogo,
    };
  } catch (err) {
    console.error('Erro em obterCatalogoAgendamentosPublicoApi:', err);

    return catalogoAgendamentosErrorResult(
      err,
      'Não foi possível carregar as modalidades de agendamento.'
    );
  }
}

function catalogoAgendamentosErrorResult(err, fallbackMessage) {
  const code = text(err?.code) || 'ERRO_INTERNO';
  const known = new Set([
    'CATALOGO_COLECAO_AUSENTE',
    'CATALOGO_ARQUIVO_INVALIDO',
    'CATALOGO_REVISAO_DIVERGENTE',
    'CATALOGO_ID_INVALIDO',
    'CATALOGO_ID_DUPLICADO',
    'MODALIDADE_DADOS_OBRIGATORIOS',
    'LOCAL_DADOS_OBRIGATORIOS',
    'RECURSO_DADOS_OBRIGATORIOS',
    'OFERTA_DADOS_OBRIGATORIOS',
    'RECURSO_LOCAL_INEXISTENTE',
    'OFERTA_MODALIDADE_INEXISTENTE',
    'OFERTA_LOCAL_INEXISTENTE',
    'OFERTA_RECURSO_INEXISTENTE',
    'OFERTA_RECURSO_LOCAL_DIVERGENTE',
    'OFERTA_NAO_PRONTA',
    'MODALIDADE_NAO_PRONTA',
  ]);

  return {
    ok: false,
    codigo: known.has(code) ? code : 'ERRO_INTERNO',
    mensagem: known.has(code) && text(err?.message)
      ? text(err.message)
      : fallbackMessage,
    detalhes: known.has(code) && err?.details ? err.details : undefined,
  };
}


export async function meAdminApi(tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    return {
      ok: true,
      admin: mapAdminUsuarioSeguro(tokenOk.usuario),
      permissoes: tokenOk.permissoes || [],
      legacy: tokenOk.legacy === true,
    };
  } catch (err) {
    console.error('Erro em meAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível validar sua sessão agora.',
    };
  }
}

export async function listarUsuariosAdminApi(filtros = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.USUARIOS_VER);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);
    const status = text(filtros.status || 'todos').toLowerCase();

    // Evita ordenar diretamente no Wix por campos recém-criados/importados.
    // Em algumas coleções criadas por CSV, o Wix pode gerar erro interno ao usar .descending()
    // antes de o campo estar totalmente normalizado/indexado.
    let query = wixData
      .query(COL.ADMIN_USUARIOS)
      .limit(MAX_RESULTS);

    if (status === 'ativos') query = query.eq('ativo', true);
    if (status === 'inativos') query = query.eq('ativo', false);

    const result = await query.find({ suppressAuth: true });
    let usuarios = (result.items || []).map(mapAdminUsuarioSeguro);

    if (busca) {
      usuarios = usuarios.filter((usuario) =>
        normalizeSearch([usuario.nome, usuario.email, usuario.cargoFuncao].join(' ')).includes(busca)
      );
    }

    usuarios.sort((a, b) => {
      const dataA = new Date(a.criadoEm || 0).getTime() || 0;
      const dataB = new Date(b.criadoEm || 0).getTime() || 0;
      return dataB - dataA;
    });

    return {
      ok: true,
      total: usuarios.length,
      usuarios,
      permissoesDisponiveis: listarPermissoesDisponiveis(),
    };
  } catch (err) {
    console.error('Erro em listarUsuariosAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar os usuários administrativos.',
    };
  }
}

export async function criarUsuarioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.USUARIOS_CRIAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const email = normalizeEmail(payload.email || payload.login || payload.usuario);
    const cargoFuncao = text(payload.cargoFuncao || payload.cargo || payload.funcao).replace(/\s+/g, ' ');
    const permissoes = normalizarPermissoes(payload.permissoes || payload.permissoesJson || []);
    const ativo = payload.ativo !== false;

    if (!isValidEmail(email)) {
      return {
        ok: false,
        codigo: 'EMAIL_INVALIDO',
        mensagem: 'Informe um e-mail válido para enviar o convite.',
      };
    }

    const existente = await buscarAdminUsuarioPorEmail(email);

    if (existente && existente._id && existente.cadastroConcluido !== false) {
      return {
        ok: false,
        codigo: 'EMAIL_JA_CADASTRADO',
        mensagem: 'Já existe um usuário administrativo com este e-mail.',
      };
    }

    const convite = await salvarEnviarConviteUsuarioAdmin({
      usuarioExistente: existente,
      email,
      cargoFuncao,
      ativo,
      permissoes,
      auth: tokenOk,
      origem: existente && existente._id ? 'reenviar' : 'criar',
    });

    await registrarAdminLog(
      tokenOk,
      existente && existente._id ? 'usuarios.reenviar_convite' : 'usuarios.criar_convite',
      'AdminUsuarios',
      convite.usuario._id,
      {
        email,
        permissoes,
        cargoFuncao,
        conviteEmailEnviado: convite.envio.ok === true,
      }
    );

    return {
      ok: true,
      mensagem: convite.envio.ok
        ? 'Convite enviado com sucesso.'
        : 'Convite criado, mas não foi possível enviar o e-mail agora.',
      usuario: mapAdminUsuarioSeguro(convite.usuario),
      conviteEmailEnviado: convite.envio.ok === true,
      aviso: convite.envio.ok ? undefined : convite.envio.mensagem,
    };
  } catch (err) {
    console.error('Erro em criarUsuarioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível criar o convite agora.',
    };
  }
}

export async function reenviarConviteUsuarioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.USUARIOS_CRIAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const usuarioId = text(payload.usuarioId || payload._id || payload.id);

    if (!usuarioId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Usuário não identificado.',
      };
    }

    const usuario = await wixData.get(COL.ADMIN_USUARIOS, usuarioId, { suppressAuth: true });

    if (!usuario || !usuario._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Usuário não encontrado.',
      };
    }

    if (usuario.cadastroConcluido !== false && text(usuario.statusConvite) !== 'pendente') {
      return {
        ok: false,
        codigo: 'CONVITE_NAO_PENDENTE',
        mensagem: 'Este usuário já concluiu o cadastro.',
      };
    }

    const convite = await salvarEnviarConviteUsuarioAdmin({
      usuarioExistente: usuario,
      email: usuario.email,
      cargoFuncao: usuario.cargoFuncao,
      ativo: usuario.ativo !== false,
      permissoes: normalizarPermissoesArmazenadas(usuario.permissoesJson || usuario.permissoes),
      auth: tokenOk,
      origem: 'reenviar',
    });

    await registrarAdminLog(tokenOk, 'usuarios.reenviar_convite', 'AdminUsuarios', convite.usuario._id, {
      email: convite.usuario.email,
      conviteEmailEnviado: convite.envio.ok === true,
    });

    return {
      ok: true,
      mensagem: convite.envio.ok
        ? 'Convite reenviado com sucesso.'
        : 'Convite atualizado, mas não foi possível enviar o e-mail agora.',
      usuario: mapAdminUsuarioSeguro(convite.usuario),
      conviteEmailEnviado: convite.envio.ok === true,
      aviso: convite.envio.ok ? undefined : convite.envio.mensagem,
    };
  } catch (err) {
    console.error('Erro em reenviarConviteUsuarioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível reenviar o convite agora.',
    };
  }
}

export async function obterConviteAdminApi(payload = {}) {
  try {
    const convite = await buscarUsuarioPorConviteValido(payload.token || payload.convite || payload.codigo);

    if (!convite.ok) return convite;

    const usuario = convite.usuario;

    return {
      ok: true,
      email: normalizeEmail(usuario.email),
      cargoFuncao: text(usuario.cargoFuncao),
      cadastroConcluido: usuario.cadastroConcluido === true,
      statusConvite: text(usuario.statusConvite || 'pendente'),
      conviteExpiraEm: dateTimeToIso(usuario.conviteExpiraEm),
    };
  } catch (err) {
    console.error('Erro em obterConviteAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar o convite agora.',
    };
  }
}

export async function concluirConviteAdminApi(payload = {}) {
  try {
    const convite = await buscarUsuarioPorConviteValido(payload.token || payload.convite || payload.codigo);

    if (!convite.ok) return convite;

    const usuario = convite.usuario;
    const nome = text(payload.nome || payload.nomeCompleto || payload.name).replace(/\s+/g, ' ');
    const cargoFuncao = text(
      payload.cargoFuncao !== undefined ? payload.cargoFuncao : usuario.cargoFuncao
    ).replace(/\s+/g, ' ');
    const cpfDigits = digitsOnly(payload.cpf || payload.documento || payload.cpfUsuario);
    const senha = text(payload.senha || payload.novaSenha || payload.password);

    if (!nome || nome.length < 3 || !/\s/.test(nome)) {
      return {
        ok: false,
        codigo: 'NOME_INVALIDO',
        mensagem: 'Informe seu nome completo.',
      };
    }

    if (!isValidCpf(cpfDigits)) {
      return {
        ok: false,
        codigo: 'CPF_INVALIDO',
        mensagem: 'Informe um CPF válido.',
      };
    }

    if (!senha || senha.length < 8) {
      return {
        ok: false,
        codigo: 'SENHA_INVALIDA',
        mensagem: 'A senha deve ter pelo menos 8 caracteres.',
      };
    }

    const cpfHash = await hashCpfAdmin(cpfDigits);
    const cpfExistente = await buscarAdminUsuarioPorCpfHash(cpfHash, usuario._id);

    if (cpfExistente && cpfExistente._id) {
      return {
        ok: false,
        codigo: 'CPF_JA_CADASTRADO',
        mensagem: 'Já existe um usuário administrativo com este CPF.',
      };
    }

    const agora = new Date();
    const salt = gerarTokenSeguro(18);
    const senhaHash = await hashSenhaAdmin(senha, salt);

    const atualizado = await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...usuario,
        title: `${nome} - ${usuario.email}`,
        nome,
        cargoFuncao,
        ativo: usuario.ativo !== false,
        cpfHash,
        cpfCadastrado: true,
        cpfAtualizadoEm: agora,
        senhaSalt: salt,
        senhaHash,
        precisaTrocarSenha: false,
        senhaAlteradaEm: agora,
        emailVerificado: false,
        precisaVerificarEmail: true,
        emailVerificadoEm: null,
        codigoEmailHash: '',
        codigoEmailExpiraEm: null,
        codigoEmailTentativas: 0,
        codigoEmailBloqueadoAte: null,
        cadastroConcluido: true,
        statusConvite: 'aceito',
        conviteAceitoEm: agora,
        conviteHash: '',
        conviteExpiraEm: null,
        atualizadoEm: agora,
        atualizadoPor: usuario.email,
      },
      { suppressAuth: true }
    );

    await registrarAdminLog(
      { ok: true, usuario: atualizado, permissoes: normalizarPermissoesArmazenadas(atualizado.permissoesJson) },
      'usuarios.concluir_convite',
      'AdminUsuarios',
      atualizado._id,
      { email: atualizado.email }
    );

    return {
      ok: true,
      mensagem: 'Cadastro concluído com sucesso. Faça login para validar seu e-mail e acessar o painel.',
      email: atualizado.email,
      usuario: mapAdminUsuarioSeguro(atualizado),
    };
  } catch (err) {
    console.error('Erro em concluirConviteAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível concluir o cadastro agora.',
    };
  }
}

export async function atualizarUsuarioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.USUARIOS_EDITAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const usuarioId = text(payload.usuarioId || payload._id || payload.id);

    if (!usuarioId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Usuário não identificado.',
      };
    }

    const item = await wixData.get(COL.ADMIN_USUARIOS, usuarioId, {
      suppressAuth: true,
    });

    if (!item || !item._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Usuário não encontrado.',
      };
    }

    const nome = text(payload.nome || payload.nomeCompleto || item.nome).replace(/\s+/g, ' ');
    const email = normalizeEmail(payload.email || item.email);
    const cargoFuncao = text(
      payload.cargoFuncao !== undefined ? payload.cargoFuncao : item.cargoFuncao
    ).replace(/\s+/g, ' ');
    const cpfInformado = payload.cpf !== undefined || payload.novoCpf !== undefined || payload.documento !== undefined;
    const cpfDigits = cpfInformado ? digitsOnly(payload.cpf || payload.novoCpf || payload.documento) : '';
    const permissoes = payload.permissoes !== undefined
      ? normalizarPermissoes(payload.permissoes)
      : normalizarPermissoesArmazenadas(item.permissoesJson || item.permissoes);
    const ativo = payload.ativo === undefined ? item.ativo !== false : payload.ativo === true;

    const erro = validarDadosUsuario(
      {
        nome,
        email,
        cargoFuncao,
        cpf: cpfInformado ? cpfDigits : 'cpf-existente-ok',
        senha: 'senha-existente-ok',
        permissoes,
      },
      { ignorarSenha: true, ignorarCpf: !cpfInformado && !!item.cpfHash }
    );

    if (erro) {
      return {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro,
      };
    }

    const emailExistente = await buscarAdminUsuarioPorEmail(email);

    if (emailExistente && emailExistente._id && emailExistente._id !== item._id) {
      return {
        ok: false,
        codigo: 'EMAIL_JA_CADASTRADO',
        mensagem: 'Já existe outro usuário administrativo com este e-mail.',
      };
    }

    let cpfPatch = {};

    if (cpfInformado) {
      const cpfHash = await hashCpfAdmin(cpfDigits);
      const cpfExistente = await buscarAdminUsuarioPorCpfHash(cpfHash, item._id);

      if (cpfExistente && cpfExistente._id) {
        return {
          ok: false,
          codigo: 'CPF_JA_CADASTRADO',
          mensagem: 'Já existe outro usuário administrativo com este CPF.',
        };
      }

      cpfPatch = {
        cpfHash,
        cpfCadastrado: true,
        cpfAtualizadoEm: new Date(),
      };
    }

    const validacaoCritica = await validarAlteracaoUsuarioCritico({
      usuarioAtual: item,
      usuarioAtualizado: { ...item, ativo, permissoesJson: serializarPermissoes(permissoes) },
      auth: tokenOk,
    });

    if (!validacaoCritica.ok) {
      return validacaoCritica;
    }

    const agora = new Date();
    const atualizado = {
      ...item,
      title: `${nome} - ${email}`,
      nome,
      email,
      cargoFuncao,
      ativo,
      permissoesJson: serializarPermissoes(permissoes),
      ...cpfPatch,
      atualizadoEm: agora,
      atualizadoPor: tokenOk.usuario?.email || '',
    };

    const salvo = await wixData.update(COL.ADMIN_USUARIOS, atualizado, {
      suppressAuth: true,
    });

    await registrarAdminLog(tokenOk, 'usuarios.atualizar', 'AdminUsuarios', salvo._id, {
      email,
      ativo,
      cargoFuncao,
      permissoes,
      cpfAtualizado: cpfInformado === true,
    });

    return {
      ok: true,
      mensagem: 'Usuário atualizado com sucesso.',
      usuario: mapAdminUsuarioSeguro(salvo),
    };
  } catch (err) {
    console.error('Erro em atualizarUsuarioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar o usuário agora.',
    };
  }
}

export async function desativarUsuarioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.USUARIOS_DESATIVAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    return atualizarUsuarioAdminApi(
      {
        ...payload,
        ativo: false,
      },
      tokenRecebido
    );
  } catch (err) {
    console.error('Erro em desativarUsuarioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível desativar o usuário agora.',
    };
  }
}


export async function excluirUsuarioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.USUARIOS_DESATIVAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const usuarioId = text(payload.usuarioId || payload._id || payload.id);

    if (!usuarioId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Usuário não identificado.',
      };
    }

    const item = await wixData.get(COL.ADMIN_USUARIOS, usuarioId, {
      suppressAuth: true,
    });

    if (!item || !item._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Usuário não encontrado.',
      };
    }

    const isSelf = tokenOk?.usuario?._id && item._id === tokenOk.usuario._id;

    if (isSelf) {
      return {
        ok: false,
        codigo: 'OPERACAO_NAO_PERMITIDA',
        mensagem: 'Você não pode excluir seu próprio usuário.',
      };
    }

    if (item.ativo !== false) {
      return {
        ok: false,
        codigo: 'USUARIO_ATIVO',
        mensagem: 'Desative o usuário antes de excluí-lo.',
      };
    }

    await encerrarSessoesUsuario(item._id);

    await registrarAdminLog(tokenOk, 'usuarios.excluir', 'AdminUsuarios', item._id, {
      email: item.email,
      nome: item.nome,
      permissoes: normalizarPermissoesArmazenadas(item.permissoesJson || item.permissoes),
    });

    await wixData.remove(COL.ADMIN_USUARIOS, item._id, {
      suppressAuth: true,
    });

    return {
      ok: true,
      mensagem: 'Usuário excluído com sucesso.',
      usuarioId: item._id,
    };
  } catch (err) {
    console.error('Erro em excluirUsuarioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível excluir o usuário agora.',
    };
  }
}

export async function resetarSenhaUsuarioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.USUARIOS_EDITAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const usuarioId = text(payload.usuarioId || payload._id || payload.id);
    const novaSenha = text(payload.novaSenha || payload.senhaTemporaria || payload.senha) || gerarSenhaTemporaria();

    if (!usuarioId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Usuário não identificado.',
      };
    }

    if (novaSenha.length < 8) {
      return {
        ok: false,
        codigo: 'SENHA_INVALIDA',
        mensagem: 'A senha temporária deve ter pelo menos 8 caracteres.',
      };
    }

    const item = await wixData.get(COL.ADMIN_USUARIOS, usuarioId, {
      suppressAuth: true,
    });

    if (!item || !item._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Usuário não encontrado.',
      };
    }

    const salt = gerarTokenSeguro(18);
    const senhaHash = await hashSenhaAdmin(novaSenha, salt);
    const agora = new Date();

    const salvo = await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...item,
        senhaSalt: salt,
        senhaHash,
        precisaTrocarSenha: true,
        senhaAlteradaEm: null,
        atualizadoEm: agora,
        atualizadoPor: tokenOk.usuario?.email || '',
      },
      { suppressAuth: true }
    );

    await encerrarSessoesUsuario(item._id);
    await registrarAdminLog(tokenOk, 'usuarios.resetar_senha', 'AdminUsuarios', item._id, {
      email: item.email,
    });

    return {
      ok: true,
      mensagem: 'Senha temporária definida com sucesso.',
      usuario: mapAdminUsuarioSeguro(salvo),
      senhaTemporaria: novaSenha,
    };
  } catch (err) {
    console.error('Erro em resetarSenhaUsuarioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível redefinir a senha agora.',
    };
  }
}


export async function confirmarEmailAdminApi(payload = {}) {
  try {
    const email = normalizeEmail(payload.email || payload.login || payload.usuario);
    const senha = text(payload.senha || payload.password);
    const codigo = digitsOnly(payload.codigo || payload.code || payload.token);

    if (!email || !senha || !codigo) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe e-mail, senha e código de validação.',
      };
    }

    const usuario = await buscarAdminUsuarioPorEmail(email);

    if (!usuario || !usuario._id || usuario.ativo === false) {
      return {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'E-mail ou senha inválidos.',
      };
    }

    const senhaOk = await validarSenhaUsuario(usuario, senha);

    if (!senhaOk) {
      return {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'E-mail ou senha inválidos.',
      };
    }

    const validacao = await validarCodigoEmailUsuario(usuario, codigo);

    if (!validacao.ok) {
      return validacao;
    }

    const agora = new Date();
    const usuarioAtualizado = await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...usuario,
        emailVerificado: true,
        precisaVerificarEmail: false,
        emailVerificadoEm: agora,
        codigoEmailHash: '',
        codigoEmailExpiraEm: null,
        codigoEmailTentativas: 0,
        codigoEmailBloqueadoAte: null,
        ultimoAcessoEm: agora,
        atualizadoEm: agora,
        atualizadoPor: 'validacao-email',
      },
      { suppressAuth: true }
    );

    const sessao = await criarSessaoAdmin(usuarioAtualizado);

    await registrarAdminLog(
      { ok: true, usuario: usuarioAtualizado, permissoes: normalizarPermissoesArmazenadas(usuarioAtualizado.permissoesJson) },
      'usuarios.validar_email',
      'AdminUsuarios',
      usuarioAtualizado._id,
      { email }
    );

    return {
      ok: true,
      mensagem: 'E-mail validado com sucesso.',
      token: sessao.token,
      precisaTrocarSenha: usuarioAtualizado.precisaTrocarSenha === true,
      admin: mapAdminUsuarioSeguro(usuarioAtualizado),
    };
  } catch (err) {
    console.error('Erro em confirmarEmailAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível confirmar o e-mail agora.',
    };
  }
}

export async function reenviarCodigoEmailAdminApi(payload = {}) {
  try {
    const email = normalizeEmail(payload.email || payload.login || payload.usuario);
    const senha = text(payload.senha || payload.password);

    if (!email || !senha) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe e-mail e senha para reenviar o código.',
      };
    }

    const usuario = await buscarAdminUsuarioPorEmail(email);

    if (!usuario || !usuario._id || usuario.ativo === false) {
      return {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'E-mail ou senha inválidos.',
      };
    }

    const senhaOk = await validarSenhaUsuario(usuario, senha);

    if (!senhaOk) {
      return {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'E-mail ou senha inválidos.',
      };
    }

    if (!usuarioPrecisaVerificarEmail(usuario)) {
      return {
        ok: true,
        mensagem: 'Este e-mail já está validado.',
        email,
        emailVerificado: true,
      };
    }

    const envio = await gerarEnviarCodigoEmailUsuario(usuario, 'reenviar');

    if (!envio.ok) return envio;

    return {
      ok: true,
      mensagem: 'Enviamos um novo código para o e-mail cadastrado.',
      email,
    };
  } catch (err) {
    console.error('Erro em reenviarCodigoEmailAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível reenviar o código agora.',
    };
  }
}

export async function trocarSenhaAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    if (tokenOk.legacy === true) {
      return {
        ok: false,
        codigo: 'OPERACAO_NAO_PERMITIDA',
        mensagem: 'Este acesso de contingência não permite troca de senha.',
      };
    }

    const novaSenha = text(payload.novaSenha || payload.senhaNova || payload.senha);

    if (!novaSenha || novaSenha.length < 8) {
      return {
        ok: false,
        codigo: 'SENHA_INVALIDA',
        mensagem: 'A nova senha deve ter pelo menos 8 caracteres.',
      };
    }

    const usuario = await wixData.get(COL.ADMIN_USUARIOS, tokenOk.usuario._id, {
      suppressAuth: true,
    });

    if (!usuario || !usuario._id || usuario.ativo === false) {
      return {
        ok: false,
        codigo: 'ADMIN_NAO_AUTORIZADO',
        mensagem: 'Usuário inativo ou não autorizado.',
      };
    }

    if (usuarioPrecisaVerificarEmail(usuario)) {
      return {
        ok: false,
        codigo: 'EMAIL_NAO_VERIFICADO',
        mensagem: 'Valide seu e-mail antes de trocar a senha.',
      };
    }

    const agora = new Date();
    const salt = gerarTokenSeguro(18);
    const senhaHash = await hashSenhaAdmin(novaSenha, salt);

    const salvo = await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...usuario,
        senhaSalt: salt,
        senhaHash,
        precisaTrocarSenha: false,
        senhaAlteradaEm: agora,
        atualizadoEm: agora,
        atualizadoPor: usuario.email,
      },
      { suppressAuth: true }
    );

    await encerrarSessoesUsuario(usuario._id);
    const sessao = await criarSessaoAdmin(salvo);

    await registrarAdminLog(
      { ok: true, usuario: salvo, permissoes: normalizarPermissoesArmazenadas(salvo.permissoesJson) },
      'usuarios.trocar_senha',
      'AdminUsuarios',
      salvo._id,
      { email: salvo.email }
    );

    return {
      ok: true,
      mensagem: 'Senha alterada com sucesso.',
      token: sessao.token,
      admin: mapAdminUsuarioSeguro(salvo),
    };
  } catch (err) {
    console.error('Erro em trocarSenhaAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível trocar a senha agora.',
    };
  }
}


export async function listarUnidadesAdminApi(filtros = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.UNIDADES_VER);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);
    const status = text(filtros.status || 'todos').toLowerCase();

    let query = wixData
      .query(COL.UNIDADES)
      .limit(MAX_RESULTS);

    const result = await query.find({ suppressAuth: true });
    let unidades = (result.items || []).map(mapUnidadeAdmin);

    if (status === 'ativas' || status === 'ativos') {
      unidades = unidades.filter((u) => u.ativa !== false);
    } else if (status === 'inativas' || status === 'inativos') {
      unidades = unidades.filter((u) => u.ativa === false);
    }

    if (busca) {
      unidades = unidades.filter((u) => unidadeAdminMatchesBusca(u, busca));
    }

    unidades.sort((a, b) => {
      if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    return {
      ok: true,
      total: unidades.length,
      unidades,
    };
  } catch (err) {
    console.error('Erro em listarUnidadesAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar as unidades prisionais.',
    };
  }
}

export async function criarUnidadeAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.UNIDADES_CRIAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const dados = normalizarPayloadUnidade(payload, { criar: true });
    const erro = validarDadosUnidade(dados);

    if (erro) {
      return {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro,
      };
    }

    const existente = await buscarUnidadeAdminPorSlug(dados.slug);

    if (existente && existente._id) {
      return {
        ok: false,
        codigo: 'SLUG_JA_CADASTRADO',
        mensagem: 'Já existe uma unidade com este código/slug.',
      };
    }

    const agora = new Date();
    const item = montarItemUnidade(dados, {
      criadoEm: agora,
      atualizadoEm: agora,
      criadoPor: tokenOk.usuario?.email || '',
      atualizadoPor: tokenOk.usuario?.email || '',
    });

    const salvo = await wixData.insert(COL.UNIDADES, item, {
      suppressAuth: true,
    });

    await registrarAdminLog(tokenOk, 'unidades.criar', 'UnidadesPrisionais', salvo._id, {
      slug: dados.slug,
      nome: dados.nome,
      ativa: dados.ativa,
    });

    return {
      ok: true,
      mensagem: 'Unidade criada com sucesso.',
      unidade: mapUnidadeAdmin(salvo),
    };
  } catch (err) {
    console.error('Erro em criarUnidadeAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível criar a unidade agora.',
    };
  }
}

export async function atualizarUnidadeAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.UNIDADES_EDITAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const unidadeId = text(payload.unidadeId || payload._id || payload.id);

    if (!unidadeId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Unidade não identificada.',
      };
    }

    const atual = await buscarUnidadeAdminPorIdOuSlug(unidadeId);

    if (!atual || !atual._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Unidade não encontrada.',
      };
    }

    const dados = normalizarPayloadUnidade(payload, { criar: false, itemAtual: atual });
    const erro = validarDadosUnidade(dados);

    if (erro) {
      return {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro,
      };
    }

    if (dados.slug !== text(atual.slug)) {
      const alterarSlug = payload.permitirAlterarSlug === true;

      if (!alterarSlug) {
        return {
          ok: false,
          codigo: 'ALTERACAO_SLUG_BLOQUEADA',
          mensagem: 'O código/slug da unidade não deve ser alterado depois da criação. Crie uma nova unidade se precisar de outro código.',
        };
      }

      const existente = await buscarUnidadeAdminPorSlug(dados.slug);

      if (existente && existente._id && existente._id !== atual._id) {
        return {
          ok: false,
          codigo: 'SLUG_JA_CADASTRADO',
          mensagem: 'Já existe uma unidade com este código/slug.',
        };
      }
    }

    const agora = new Date();
    const atualizado = {
      ...atual,
      ...montarItemUnidade(dados, {
        criadoEm: atual.criadoEm || atual._createdDate,
        criadoPor: atual.criadoPor || '',
        atualizadoEm: agora,
        atualizadoPor: tokenOk.usuario?.email || '',
      }),
    };

    const salvo = await wixData.update(COL.UNIDADES, atualizado, {
      suppressAuth: true,
    });

    await registrarAdminLog(tokenOk, 'unidades.atualizar', 'UnidadesPrisionais', salvo._id, {
      slug: dados.slug,
      nome: dados.nome,
      ativa: dados.ativa,
    });

    return {
      ok: true,
      mensagem: 'Unidade atualizada com sucesso.',
      unidade: mapUnidadeAdmin(salvo),
    };
  } catch (err) {
    console.error('Erro em atualizarUnidadeAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar a unidade agora.',
    };
  }
}

export async function alterarStatusUnidadeAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.UNIDADES_ATIVAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const unidadeId = text(payload.unidadeId || payload._id || payload.id);

    if (!unidadeId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Unidade não identificada.',
      };
    }

    const atual = await buscarUnidadeAdminPorIdOuSlug(unidadeId);

    if (!atual || !atual._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Unidade não encontrada.',
      };
    }

    const ativa = payload.ativa !== undefined || payload.ativo !== undefined
      ? asBoolean(payload.ativa !== undefined ? payload.ativa : payload.ativo)
      : text(payload.status).toLowerCase() === 'ativa' || text(payload.status).toLowerCase() === 'ativo';

    const agora = new Date();
    const salvo = await wixData.update(
      COL.UNIDADES,
      {
        ...atual,
        ativa,
        ativo: ativa,
        atualizadoEm: agora,
        atualizadoPor: tokenOk.usuario?.email || '',
      },
      { suppressAuth: true }
    );

    await registrarAdminLog(tokenOk, ativa ? 'unidades.ativar' : 'unidades.desativar', 'UnidadesPrisionais', salvo._id, {
      slug: text(salvo.slug),
      nome: text(salvo.nome || salvo.title),
      ativa,
    });

    return {
      ok: true,
      mensagem: ativa ? 'Unidade ativada com sucesso.' : 'Unidade desativada com sucesso.',
      unidade: mapUnidadeAdmin(salvo),
    };
  } catch (err) {
    console.error('Erro em alterarStatusUnidadeAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível alterar o status da unidade agora.',
    };
  }
}


export async function listarBloqueiosAdminApi(filtros = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.BLOQUEIOS_VER);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);
    const status = text(filtros.status || 'todos').toLowerCase();
    const unidadeSlug = normalizarSlugUnidade(filtros.unidadeSlug || filtros.unidade || '');
    const dataIso = text(filtros.dataIso || filtros.data || '');
    const escopoFiltro = normalizarEscopoBloqueio(filtros.escopo || '');

    const result = await wixData
      .query(COL.BLOQUEIOS_AGENDA)
      .limit(MAX_RESULTS)
      .find({ suppressAuth: true });

    let bloqueios = (result.items || []).map(mapBloqueioAdmin);

    if (status === 'ativos' || status === 'ativo') {
      bloqueios = bloqueios.filter((b) => b.ativo !== false && b.status !== 'encerrado');
    } else if (status === 'futuros' || status === 'futuro') {
      bloqueios = bloqueios.filter((b) => b.ativo !== false && b.status !== 'encerrado');
    } else if (status === 'encerrados' || status === 'encerrado') {
      bloqueios = bloqueios.filter((b) => b.status === 'encerrado');
    } else if (status === 'inativos' || status === 'inativo' || status === 'removidos') {
      bloqueios = bloqueios.filter((b) => b.ativo === false);
    }

    if (unidadeSlug) {
      bloqueios = bloqueios.filter((b) => b.escopo === 'todas' || b.unidadeSlug === unidadeSlug);
    }

    if (dataIso) {
      bloqueios = bloqueios.filter((b) => dataDentroDoBloqueio(dataIso, b.dataInicio, b.dataFim));
    }

    if (escopoFiltro) {
      bloqueios = bloqueios.filter((b) => b.escopo === escopoFiltro);
    }

    if (busca) {
      bloqueios = bloqueios.filter((b) => bloqueioAdminMatchesBusca(b, busca));
    }

    bloqueios.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'ativo') return -1;
        if (b.status === 'ativo') return 1;
      }
      const dataCmp = text(a.dataInicio).localeCompare(text(b.dataInicio));
      if (dataCmp !== 0) return dataCmp;
      return text(a.horarioInicio).localeCompare(text(b.horarioInicio));
    });

    return {
      ok: true,
      total: bloqueios.length,
      bloqueios,
    };
  } catch (err) {
    console.error('Erro em listarBloqueiosAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar os bloqueios de agenda.',
    };
  }
}

export async function analisarImpactoBloqueioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.BLOQUEIOS_CRIAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const dados = await normalizarPayloadBloqueio(payload, { criar: true });
    const erro = validarDadosBloqueio(dados);

    if (erro) {
      return {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro,
      };
    }

    const afetados = dados.ativo === false
      ? []
      : await listarAgendamentosAfetadosPorBloqueio(dados);

    return {
      ok: true,
      totalAfetados: afetados.length,
      totalComListaJaEnviada: afetados.filter((item) => item.listaDiariaEnviada === true).length,
      podeCancelar: temPermissaoAdmin(tokenOk, ADMIN_PERMISSIONS.AGENDAMENTOS_CANCELAR),
      agendamentos: afetados.slice(0, 20).map(mapAgendamentoImpactoBloqueio),
      truncado: afetados.length > 20,
    };
  } catch (err) {
    console.error('Erro em analisarImpactoBloqueioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível verificar os agendamentos afetados agora.',
    };
  }
}

export async function criarBloqueioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.BLOQUEIOS_CRIAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const dados = await normalizarPayloadBloqueio(payload, { criar: true });
    const erro = validarDadosBloqueio(dados);

    if (erro) {
      return {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro,
      };
    }

    const cancelarAgendamentosExistentes =
      dados.ativo !== false && asBoolean(payload.cancelarAgendamentosExistentes);

    if (
      cancelarAgendamentosExistentes &&
      !temPermissaoAdmin(tokenOk, ADMIN_PERMISSIONS.AGENDAMENTOS_CANCELAR)
    ) {
      return {
        ok: false,
        codigo: 'SEM_PERMISSAO',
        mensagem: 'Você não tem permissão para cancelar os agendamentos afetados.',
      };
    }

    const afetados = dados.ativo === false
      ? []
      : await listarAgendamentosAfetadosPorBloqueio(dados);

    const agora = new Date();
    const item = {
      ...montarItemBloqueio(dados, {
        criadoEm: agora,
        atualizadoEm: agora,
        criadoPor: tokenOk.usuario?.email || '',
        atualizadoPor: tokenOk.usuario?.email || '',
      }),
      motivoPublico: dados.motivo,
      cancelarAgendamentosExistentes,
      totalAgendamentosAfetados: afetados.length,
      totalAgendamentosCancelados: 0,
      totalEmailsCancelamentoEnviados: 0,
      totalEmailsCancelamentoComErro: 0,
      cancelamentoAgendamentosExecutadoEm: null,
    };

    let salvo = await wixData.insert(COL.BLOQUEIOS_AGENDA, item, {
      suppressAuth: true,
    });

    let cancelamento = {
      solicitado: cancelarAgendamentosExistentes,
      totalAfetados: afetados.length,
      totalCancelados: 0,
      totalEmailsEnviados: 0,
      totalEmailsComErro: 0,
      listaAtualizadaRecomendada: false,
      datasComListaJaEnviada: [],
    };

    if (cancelarAgendamentosExistentes && afetados.length > 0) {
      cancelamento = await cancelarAgendamentosPorBloqueio({
        agendamentos: afetados,
        dadosBloqueio: dados,
        bloqueio: salvo,
        auth: tokenOk,
      });

      const atualizado = {
        ...salvo,
        totalAgendamentosAfetados: cancelamento.totalAfetados,
        totalAgendamentosCancelados: cancelamento.totalCancelados,
        totalEmailsCancelamentoEnviados: cancelamento.totalEmailsEnviados,
        totalEmailsCancelamentoComErro: cancelamento.totalEmailsComErro,
        cancelamentoAgendamentosExecutadoEm: new Date(),
        atualizadoEm: new Date(),
      };

      salvo = await wixData.update(COL.BLOQUEIOS_AGENDA, atualizado, {
        suppressAuth: true,
      });
    }

    await registrarAdminLog(tokenOk, 'bloqueios.criar', 'BloqueiosAgenda', salvo._id, {
      escopo: dados.escopo,
      unidadeSlug: dados.unidadeSlug,
      tipo: dados.tipo,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      horarioInicio: dados.horarioInicio,
      horarioFim: dados.horarioFim,
      motivoPublico: dados.motivo,
      cancelarAgendamentosExistentes,
      totalAgendamentosAfetados: afetados.length,
      totalAgendamentosCancelados: cancelamento.totalCancelados,
      totalEmailsCancelamentoEnviados: cancelamento.totalEmailsEnviados,
      totalEmailsCancelamentoComErro: cancelamento.totalEmailsComErro,
      protocolosCancelados: cancelamento.protocolosCancelados || [],
    });

    const mensagem = cancelarAgendamentosExistentes
      ? cancelamento.totalCancelados > 0
        ? `Bloqueio criado. ${cancelamento.totalCancelados} agendamento${cancelamento.totalCancelados === 1 ? '' : 's'} cancelado${cancelamento.totalCancelados === 1 ? '' : 's'}.`
        : 'Bloqueio criado. Não havia agendamentos ativos para cancelar.'
      : afetados.length > 0
        ? `Bloqueio criado sem cancelar ${afetados.length} agendamento${afetados.length === 1 ? '' : 's'} existente${afetados.length === 1 ? '' : 's'}.`
        : 'Bloqueio criado com sucesso.';

    return {
      ok: true,
      mensagem,
      bloqueio: mapBloqueioAdmin(salvo),
      impacto: {
        totalAfetados: afetados.length,
      },
      cancelamento,
    };
  } catch (err) {
    console.error('Erro em criarBloqueioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível criar o bloqueio agora.',
    };
  }
}

export async function atualizarBloqueioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.BLOQUEIOS_EDITAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const bloqueioId = text(payload.bloqueioId || payload._id || payload.id);

    if (!bloqueioId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Bloqueio não identificado.',
      };
    }

    const atual = await buscarBloqueioAdminPorId(bloqueioId);

    if (!atual || !atual._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Bloqueio não encontrado.',
      };
    }

    const dados = await normalizarPayloadBloqueio(payload, { criar: false, itemAtual: atual });
    const erro = validarDadosBloqueio(dados);

    if (erro) {
      return {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro,
      };
    }

    const agora = new Date();
    const atualizado = {
      ...atual,
      ...montarItemBloqueio(dados, {
        criadoEm: atual.criadoEm || atual._createdDate,
        criadoPor: atual.criadoPor || '',
        atualizadoEm: agora,
        atualizadoPor: tokenOk.usuario?.email || '',
      }),
    };

    const salvo = await wixData.update(COL.BLOQUEIOS_AGENDA, atualizado, {
      suppressAuth: true,
    });

    await registrarAdminLog(tokenOk, 'bloqueios.atualizar', 'BloqueiosAgenda', salvo._id, {
      escopo: dados.escopo,
      unidadeSlug: dados.unidadeSlug,
      tipo: dados.tipo,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      horarioInicio: dados.horarioInicio,
      horarioFim: dados.horarioFim,
      motivo: dados.motivo,
    });

    return {
      ok: true,
      mensagem: 'Bloqueio atualizado com sucesso.',
      bloqueio: mapBloqueioAdmin(salvo),
    };
  } catch (err) {
    console.error('Erro em atualizarBloqueioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar o bloqueio agora.',
    };
  }
}

export async function removerBloqueioAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.BLOQUEIOS_REMOVER);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const bloqueioId = text(payload.bloqueioId || payload._id || payload.id);

    if (!bloqueioId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Bloqueio não identificado.',
      };
    }

    const atual = await buscarBloqueioAdminPorId(bloqueioId);

    if (!atual || !atual._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Bloqueio não encontrado.',
      };
    }

    await registrarAdminLog(tokenOk, 'bloqueios.remover', 'BloqueiosAgenda', atual._id, {
      escopo: text(atual.escopo),
      unidadeSlug: text(atual.unidadeSlug),
      tipo: text(atual.tipo),
      dataInicio: text(atual.dataInicio || atual.dataIso || atual.data),
      dataFim: text(atual.dataFim || atual.dataInicio || atual.dataIso || atual.data),
      motivo: text(atual.motivo),
    });

    await wixData.remove(COL.BLOQUEIOS_AGENDA, atual._id, {
      suppressAuth: true,
    });

    return {
      ok: true,
      mensagem: 'Bloqueio removido com sucesso.',
    };
  } catch (err) {
    console.error('Erro em removerBloqueioAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível remover o bloqueio agora.',
    };
  }
}


export async function consultarAgendamentoPublicoApi(payload = {}) {
  try {
    const protocolo = normalizeProtocol(
      payload.protocolo ||
        payload.codigo ||
        payload.codigoProtocolo ||
        payload.numeroProtocolo
    );

    const emailAdvogado = normalizeEmail(
      payload.emailAdvogado ||
        payload.advEmail ||
        payload.email ||
        payload.emailIndex
    );

    if (!protocolo || !emailAdvogado) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o protocolo e o e-mail usado no agendamento.',
      };
    }

    if (!isValidEmail(emailAdvogado)) {
      return {
        ok: false,
        codigo: 'EMAIL_INVALIDO',
        mensagem: 'Informe um e-mail válido.',
      };
    }

    const item = await buscarAgendamentoPorProtocolo(protocolo);

    if (!item) {
      return consultaAgendamentoNaoEncontrada();
    }

    const emailRegistro = normalizeEmail(item.solicitanteEmail || item.emailAdvogado || item.emailIndex);

    if (!emailRegistro || emailRegistro !== emailAdvogado) {
      return consultaAgendamentoNaoEncontrada();
    }

    return {
      ok: true,
      mensagem: 'Agendamento encontrado.',
      agendamento: mapAgendamentoConsultaPublica(item),
    };
  } catch (err) {
    console.error('Erro em consultarAgendamentoPublicoApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível consultar o agendamento agora.',
    };
  }
}


export async function cancelarAgendamentoPublicoApi(payload = {}) {
  try {
    const protocolo = normalizeProtocol(
      payload.protocolo ||
        payload.codigo ||
        payload.codigoProtocolo ||
        payload.numeroProtocolo
    );

    const emailAdvogado = normalizeEmail(
      payload.emailAdvogado ||
        payload.advEmail ||
        payload.email ||
        payload.emailIndex
    );

    if (!protocolo || !emailAdvogado) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o protocolo e o e-mail usado no agendamento.',
      };
    }

    if (!isValidEmail(emailAdvogado)) {
      return {
        ok: false,
        codigo: 'EMAIL_INVALIDO',
        mensagem: 'Informe um e-mail válido.',
      };
    }

    const item = await buscarAgendamentoPorProtocolo(protocolo);

    if (!item) {
      return consultaAgendamentoNaoEncontrada();
    }

    const emailRegistro = normalizeEmail(item.solicitanteEmail || item.emailAdvogado || item.emailIndex);

    if (!emailRegistro || emailRegistro !== emailAdvogado) {
      return consultaAgendamentoNaoEncontrada();
    }

    const statusAtual = text(item.status || 'agendado').toLowerCase() || 'agendado';

    if (statusAtual === 'cancelado') {
      if (Number(item.schemaVersion || 0) >= 2 && text(item.modalidadeId)) {
        try {
          await liberarOcupacaoAgendamento(item);
        } catch (releaseError) {
          console.warn('Agendamento já cancelado; lock será limpo de forma oportunista.', releaseError);
        }
      }
      return {
        ok: true,
        codigo: 'JA_CANCELADO',
        mensagem: 'Este agendamento já estava cancelado.',
        agendamento: mapAgendamentoConsultaPublica(item),
      };
    }

    const permissao = calcularPermissaoCancelamentoUsuario(item);

    if (!permissao.podeCancelar) {
      return {
        ok: false,
        codigo: permissao.codigo || 'CANCELAMENTO_NAO_PERMITIDO',
        mensagem: permissao.mensagem || 'Este agendamento não pode ser cancelado pela Central.',
        agendamento: mapAgendamentoConsultaPublica(item),
      };
    }

    const agora = new Date();
    const atualizado = {
      ...item,
      status: 'cancelado',
      canceladoEm: agora,
      atualizadoEm: agora,
    };

    const salvo = await wixData.update(COL.AGENDAMENTOS, atualizado, {
      suppressAuth: true,
    });

    if (Number(salvo.schemaVersion || 0) >= 2 && text(salvo.modalidadeId)) {
      try {
        await liberarOcupacaoAgendamento(salvo);
      } catch (releaseError) {
        // O status cancelado já impede a ocupação lógica no próximo cálculo.
        // Não devolve falso erro ao usuário depois de o cancelamento ter sido salvo.
        console.warn('Cancelamento v2 concluído; lock será limpo de forma oportunista.', releaseError);
      }
    }

    return {
      ok: true,
      mensagem: 'Agendamento cancelado com sucesso.',
      agendamento: mapAgendamentoConsultaPublica(salvo),
    };
  } catch (err) {
    console.error('Erro em cancelarAgendamentoPublicoApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível cancelar o agendamento agora.',
    };
  }
}


export async function remarcarAgendamentoPublicoApi(payload = {}) {
  let novoSalvo = null;

  try {
    const protocolo = normalizeProtocol(
      payload.protocolo ||
        payload.codigo ||
        payload.codigoProtocolo ||
        payload.numeroProtocolo
    );

    const emailAdvogado = normalizeEmail(
      payload.emailAdvogado ||
        payload.advEmail ||
        payload.email ||
        payload.emailIndex
    );

    const dataIsoDestino = normalizeDateIso(
      payload.dataIso ||
        payload.data ||
        payload.dataAtendimentoIso ||
        payload.novaDataIso ||
        payload.novaData
    );

    const horarioInicioDestino = normalizeTime(
      payload.horarioInicio ||
        payload.horario ||
        payload.inicio ||
        payload.value ||
        payload.novoHorarioInicio ||
        payload.novoHorario
    );

    let horarioFimDestino =
      normalizeTime(
        payload.horarioFim ||
          payload.horarioFinal ||
          payload.fim ||
          payload.end ||
          payload.novoHorarioFim
      ) || addMinutesToTime(horarioInicioDestino, 30);

    if (!protocolo || !emailAdvogado) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o protocolo e o e-mail usado no agendamento.',
      };
    }

    if (!isValidEmail(emailAdvogado)) {
      return {
        ok: false,
        codigo: 'EMAIL_INVALIDO',
        mensagem: 'Informe um e-mail válido.',
      };
    }

    if (!dataIsoDestino || !/^\d{4}-\d{2}-\d{2}$/.test(dataIsoDestino)) {
      return {
        ok: false,
        codigo: 'DADOS_REMARCACAO_INVALIDOS',
        mensagem: 'Informe uma nova data válida.',
      };
    }

    if (!horarioInicioDestino || !/^\d{2}:\d{2}$/.test(horarioInicioDestino)) {
      return {
        ok: false,
        codigo: 'DADOS_REMARCACAO_INVALIDOS',
        mensagem: 'Informe um novo horário válido.',
      };
    }

    const original = await buscarAgendamentoPorProtocolo(protocolo);

    if (!original) {
      return consultaAgendamentoNaoEncontrada();
    }

    const emailRegistro = normalizeEmail(original.solicitanteEmail || original.emailAdvogado || original.emailIndex);

    if (!emailRegistro || emailRegistro !== emailAdvogado) {
      return consultaAgendamentoNaoEncontrada();
    }

    const permissao = calcularPermissaoRemarcacaoUsuario(original);

    if (!permissao.podeRemarcar) {
      return {
        ok: false,
        codigo: permissao.codigo || 'REMARCACAO_NAO_PERMITIDA',
        mensagem: permissao.mensagem || 'Este agendamento não pode ser remarcado pela Central.',
        agendamento: mapAgendamentoConsultaPublica(original),
      };
    }

    if (Number(original.schemaVersion || 0) >= 2 && text(original.modalidadeId)) {
      const resultadoV2 = await remarcarAgendamentoPublicoV2(original, {
        dateIso: dataIsoDestino,
        startTime: horarioInicioDestino,
      });

      if (!resultadoV2.ok) {
        return {
          ok: false,
          codigo: resultadoV2.code || 'REMARCACAO_NAO_CONCLUIDA',
          mensagem: resultadoV2.message || 'Não foi possível remarcar o agendamento.',
          agendamento: mapAgendamentoConsultaPublica(original),
        };
      }

      return {
        ok: true,
        mensagem: 'Agendamento remarcado com sucesso.',
        protocolo: resultadoV2.protocolo,
        agendamento: mapAgendamentoConsultaPublica(resultadoV2.appointment),
        agendamentoOriginal: mapAgendamentoConsultaPublica(resultadoV2.original),
        novoAgendamento: mapAgendamentoConsultaPublica(resultadoV2.appointment),
      };
    }

    const unidadeSlugDestino = text(original.unidadeSlug);

    if (!unidadeSlugDestino) {
      return {
        ok: false,
        codigo: 'UNIDADE_INVALIDA',
        mensagem: 'Não foi possível identificar a unidade prisional deste agendamento.',
        agendamento: mapAgendamentoConsultaPublica(original),
      };
    }

    const unidadeDestino = await buscarUnidadePorSlug(unidadeSlugDestino);

    if (!unidadeDestino) {
      return {
        ok: false,
        codigo: 'UNIDADE_INVALIDA',
        mensagem: 'Unidade prisional não encontrada ou inativa.',
        agendamento: mapAgendamentoConsultaPublica(original),
      };
    }

    const originalDataIso = normalizeDateIso(
      original.dataAtendimentoIso ||
        original.dataIso ||
        original.dataAtendimento ||
        original.data
    );

    const originalHorarioInicio = normalizeTime(
      original.horarioInicio ||
        original.horario
    );

    if (
      originalDataIso === dataIsoDestino &&
      originalHorarioInicio === horarioInicioDestino
    ) {
      return {
        ok: false,
        codigo: 'MESMO_HORARIO',
        mensagem: 'Escolha uma data ou horário diferente do agendamento atual.',
        agendamento: mapAgendamentoConsultaPublica(original),
      };
    }

    const validacaoHorario = await validarHorarioDisponivelParaRemarcacao({
      unidadeSlug: unidadeSlugDestino,
      dataIso: dataIsoDestino,
      horarioInicio: horarioInicioDestino,
      ignorarAgendamentoId: original._id,
    });

    if (!validacaoHorario.ok) {
      return {
        ...validacaoHorario,
        agendamento: mapAgendamentoConsultaPublica(original),
      };
    }

    if (validacaoHorario.horario && validacaoHorario.horario.horarioFim) {
      horarioFimDestino = validacaoHorario.horario.horarioFim;
    }

    const ocupado = await existeAgendamentoAtivoConflitante(
      {
        unidadeSlug: unidadeSlugDestino,
        dataIso: dataIsoDestino,
        horarioInicio: horarioInicioDestino,
      },
      original._id
    );

    if (ocupado) {
      return {
        ok: false,
        codigo: 'HORARIO_INDISPONIVEL',
        mensagem: 'Este horário acabou de ser ocupado. Escolha outro horário.',
        agendamento: mapAgendamentoConsultaPublica(original),
      };
    }

    const agora = new Date();
    const novoProtocolo = await gerarProtocoloUnico();
    const dataLabelDestino = formatDateLabel(dataIsoDestino);
    const slotKeyDestino = montarSlotKey(
      unidadeSlugDestino,
      dataIsoDestino,
      horarioInicioDestino
    );

    const novoAgendamento = {
      title: novoProtocolo,
      protocolo: novoProtocolo,

      unidadeSlug: unidadeSlugDestino,
      unidadeNome: unidadeDestino.nome,

      dataAtendimentoIso: dataIsoDestino,
      dataLabel: dataLabelDestino,

      horarioInicio: horarioInicioDestino,
      horarioFim: horarioFimDestino,
      slotKey: slotKeyDestino,

      nomeAdvogado: text(original.nomeAdvogado),
      numeroOab: text(original.numeroOab),
      emailAdvogado: normalizeEmail(original.solicitanteEmail || original.emailAdvogado || original.emailIndex),
      emailIndex: normalizeEmail(original.solicitanteEmail || original.emailAdvogado || original.emailIndex),
      telefoneAdvogado: text(original.telefoneAdvogado),

      nomeIpl: text(original.nomeIpl),
      infopen: text(original.infopen),

      cienciaRegras: original.cienciaRegras === true || original.aceiteRegras === true,
      aceiteRegras: original.aceiteRegras === true || original.cienciaRegras === true,

      status: 'agendado',
      origem: 'remarcacao-usuario',

      agendamentoOrigemId: original._id,
      protocoloOrigem: text(original.protocolo || original.title),

      criadoEm: agora,
      atualizadoEm: agora,
    };

    novoSalvo = await wixData.insert(COL.AGENDAMENTOS, novoAgendamento, {
      suppressAuth: true,
    });

    const originalAtualizado = {
      ...original,
      status: 'reagendado',
      reagendadoEm: agora,
      atualizadoEm: agora,

      reagendadoParaId: novoSalvo._id,
      reagendadoParaProtocolo: novoProtocolo,
      reagendadoParaDataIso: dataIsoDestino,
      reagendadoParaDataLabel: dataLabelDestino,
      reagendadoParaHorarioInicio: horarioInicioDestino,
      reagendadoParaHorarioFim: horarioFimDestino,
    };

    const originalSalvo = await wixData.update(
      COL.AGENDAMENTOS,
      originalAtualizado,
      {
        suppressAuth: true,
      }
    );

    return {
      ok: true,
      mensagem: 'Agendamento remarcado com sucesso.',
      protocolo: novoProtocolo,
      agendamento: mapAgendamentoConsultaPublica(novoSalvo),
      agendamentoOriginal: mapAgendamentoConsultaPublica(originalSalvo),
      novoAgendamento: mapAgendamentoConsultaPublica(novoSalvo),
    };
  } catch (err) {
    console.error('Erro em remarcarAgendamentoPublicoApi:', err);

    if (novoSalvo && novoSalvo._id) {
      try {
        await wixData.update(
          COL.AGENDAMENTOS,
          {
            ...novoSalvo,
            status: 'cancelado',
            canceladoEm: new Date(),
            atualizadoEm: new Date(),
          },
          {
            suppressAuth: true,
          }
        );
      } catch (rollbackErr) {
        console.error('Falha ao desfazer novo agendamento após erro de remarcação pública:', rollbackErr);
      }
    }

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível remarcar o agendamento agora.',
    };
  }
}


export async function listarDocumentosAdminApi(filtros = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.DOCUMENTOS_VER);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const unidadeSlug = text(filtros.unidadeSlug || filtros.unidade || filtros.slug);
    const status = text(filtros.status).toLowerCase();

    const dataIso = normalizeDateIso(
      filtros.dataIso || filtros.data || filtros.criadoEmIso || filtros.createdDate
    );

    const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);

    let query = wixData
      .query(COL.SOLICITACOES_DOCUMENTOS)
      .descending('criadoEm')
      .limit(MAX_RESULTS);

    if (unidadeSlug && unidadeSlug !== 'todos') {
      query = query.eq('unidadeSlug', unidadeSlug);
    }

    const result = await query.find({ suppressAuth: true });

    let documentos = (result.items || []).map(mapDocumentoAdmin);

    if (status && status !== 'todos') {
      const statusFiltro = normalizarDocumentoStatusPrincipal(status);
      documentos = documentos.filter((item) => item.status === statusFiltro);
    }

    if (dataIso && /^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
      documentos = documentos.filter((item) => item.dataIso === dataIso);
    }

    if (busca) {
      documentos = documentos.filter((item) =>
        documentoMatchesBusca(item, busca)
      );
    }

    return {
      ok: true,
      total: documentos.length,
      documentos,
    };
  } catch (err) {
    console.error('Erro em listarDocumentosAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar os documentos administrativos.',
    };
  }
}


export async function concluirDocumentoAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.DOCUMENTOS_CONCLUIR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const documentoId = text(
      payload.documentoId ||
        payload.solicitacaoId ||
        payload._id ||
        payload.id
    );

    if (!documentoId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Documento não identificado.',
      };
    }

    const item = await wixData.get(COL.SOLICITACOES_DOCUMENTOS, documentoId, {
      suppressAuth: true,
    });

    if (!item || !item._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Solicitação de documento não encontrada.',
      };
    }

    const statusAtual = normalizarDocumentoStatusPrincipal(item.status);

    if (statusAtual === 'concluido') {
      return {
        ok: true,
        codigo: 'JA_CONCLUIDO',
        mensagem: 'Este documento já estava marcado como concluído.',
        documento: mapDocumentoAdmin(item),
      };
    }

    const agora = new Date();

    const atualizado = {
      ...item,
      status: 'concluido',
      mensagemErro: '',
      atualizadoEm: agora,
    };

    const salvo = await wixData.update(COL.SOLICITACOES_DOCUMENTOS, atualizado, {
      suppressAuth: true,
    });

    return {
      ok: true,
      mensagem: 'Documento marcado como concluído.',
      documento: mapDocumentoAdmin(salvo),
    };
  } catch (err) {
    console.error('Erro em concluirDocumentoAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível marcar o documento como concluído agora.',
    };
  }
}

export async function cancelarAgendamentoAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.AGENDAMENTOS_CANCELAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const agendamentoId = text(
      payload.agendamentoId ||
        payload._id ||
        payload.id
    );

    if (!agendamentoId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Agendamento não identificado.',
      };
    }

    const item = await wixData.get(COL.AGENDAMENTOS, agendamentoId, {
      suppressAuth: true,
    });

    if (!item || !item._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Agendamento não encontrado.',
      };
    }

    const statusAtual = text(item.status || 'agendado').toLowerCase();

    if (statusAtual === 'cancelado') {
      return {
        ok: true,
        codigo: 'JA_CANCELADO',
        mensagem: 'Este agendamento já estava cancelado.',
        agendamento: mapAgendamentoAdmin(item),
      };
    }

    if (statusAtual === 'realizado') {
      return {
        ok: false,
        codigo: 'STATUS_INVALIDO',
        mensagem: 'Não é possível cancelar um agendamento já marcado como realizado.',
      };
    }

    const agora = new Date();

    const atualizado = {
      ...item,
      status: 'cancelado',
      canceladoEm: agora,
      atualizadoEm: agora,
    };

    const salvo = await wixData.update(COL.AGENDAMENTOS, atualizado, {
      suppressAuth: true,
    });

    return {
      ok: true,
      mensagem: 'Agendamento cancelado com sucesso.',
      agendamento: mapAgendamentoAdmin(salvo),
    };
  } catch (err) {
    console.error('Erro em cancelarAgendamentoAdminApi:', err);

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível cancelar o agendamento agora.',
    };
  }
}

export async function remarcarAgendamentoAdminApi(payload = {}, tokenRecebido = '') {
  let novoSalvo = null;

  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.AGENDAMENTOS_REMARCAR);

    if (!tokenOk.ok) {
      return tokenOk;
    }

    const agendamentoId = text(
      payload.agendamentoId ||
        payload._id ||
        payload.id
    );

    if (!agendamentoId) {
      return {
        ok: false,
        codigo: 'ID_OBRIGATORIO',
        mensagem: 'Agendamento original não identificado.',
      };
    }

    const original = await wixData.get(COL.AGENDAMENTOS, agendamentoId, {
      suppressAuth: true,
    });

    if (!original || !original._id) {
      return {
        ok: false,
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Agendamento original não encontrado.',
      };
    }

    const statusAtual = text(original.status || 'agendado').toLowerCase();

    if (statusAtual !== 'agendado') {
      return {
        ok: false,
        codigo: 'STATUS_INVALIDO',
        mensagem: 'Somente agendamentos com status agendado podem ser remarcados.',
      };
    }

    const unidadeSlugDestino = text(
      payload.unidadeSlug ||
        payload.unidade ||
        payload.slug ||
        original.unidadeSlug
    );

    const dataIsoDestino = normalizeDateIso(
      payload.dataIso ||
        payload.data ||
        payload.dataAtendimentoIso
    );

    const horarioInicioDestino = normalizeTime(
      payload.horarioInicio ||
        payload.horario ||
        payload.inicio ||
        payload.value
    );

    let horarioFimDestino =
      normalizeTime(
        payload.horarioFim ||
          payload.horarioFinal ||
          payload.fim ||
          payload.end
      ) || addMinutesToTime(horarioInicioDestino, 30);

    const erroDados = validarDadosRemarcacao({
      unidadeSlug: unidadeSlugDestino,
      dataIso: dataIsoDestino,
      horarioInicio: horarioInicioDestino,
    });

    if (erroDados) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: erroDados,
      };
    }

    const unidadeDestino = await buscarUnidadePorSlug(unidadeSlugDestino);

    if (!unidadeDestino) {
      return {
        ok: false,
        codigo: 'UNIDADE_INVALIDA',
        mensagem: 'Unidade prisional não encontrada ou inativa.',
      };
    }

    const originalDataIso = normalizeDateIso(
      original.dataAtendimentoIso ||
        original.dataIso ||
        original.dataAtendimento ||
        original.data
    );

    const originalHorarioInicio = normalizeTime(
      original.horarioInicio ||
        original.horario
    );

    const originalUnidadeSlug = text(original.unidadeSlug);

    if (
      originalUnidadeSlug === unidadeSlugDestino &&
      originalDataIso === dataIsoDestino &&
      originalHorarioInicio === horarioInicioDestino
    ) {
      return {
        ok: false,
        codigo: 'MESMO_HORARIO',
        mensagem: 'Escolha uma data ou horário diferente do agendamento atual.',
      };
    }

    const validacaoHorario = await validarHorarioDisponivelParaRemarcacao({
      unidadeSlug: unidadeSlugDestino,
      dataIso: dataIsoDestino,
      horarioInicio: horarioInicioDestino,
      ignorarAgendamentoId: agendamentoId,
    });

    if (!validacaoHorario.ok) {
      return validacaoHorario;
    }

    if (validacaoHorario.horario && validacaoHorario.horario.horarioFim) {
      horarioFimDestino = validacaoHorario.horario.horarioFim;
    }

    const ocupado = await existeAgendamentoAtivoConflitante(
      {
        unidadeSlug: unidadeSlugDestino,
        dataIso: dataIsoDestino,
        horarioInicio: horarioInicioDestino,
      },
      agendamentoId
    );

    if (ocupado) {
      return {
        ok: false,
        codigo: 'HORARIO_INDISPONIVEL',
        mensagem: 'Este horário acabou de ser ocupado. Escolha outro horário.',
      };
    }

    const agora = new Date();
    const novoProtocolo = await gerarProtocoloUnico();
    const dataLabelDestino = formatDateLabel(dataIsoDestino);
    const slotKeyDestino = montarSlotKey(
      unidadeSlugDestino,
      dataIsoDestino,
      horarioInicioDestino
    );

    const novoAgendamento = {
      title: novoProtocolo,
      protocolo: novoProtocolo,

      unidadeSlug: unidadeSlugDestino,
      unidadeNome: unidadeDestino.nome,

      dataAtendimentoIso: dataIsoDestino,
      dataLabel: dataLabelDestino,

      horarioInicio: horarioInicioDestino,
      horarioFim: horarioFimDestino,
      slotKey: slotKeyDestino,

      nomeAdvogado: text(original.nomeAdvogado),
      numeroOab: text(original.numeroOab),
      emailAdvogado: text(original.emailAdvogado),
      telefoneAdvogado: text(original.telefoneAdvogado),

      nomeIpl: text(original.nomeIpl),
      infopen: text(original.infopen),

      cienciaRegras: original.cienciaRegras === true || original.aceiteRegras === true,
      aceiteRegras: original.aceiteRegras === true || original.cienciaRegras === true,

      status: 'agendado',
      origem: 'remarcacao-admin',

      agendamentoOrigemId: original._id,
      protocoloOrigem: text(original.protocolo || original.title),

      criadoEm: agora,
      atualizadoEm: agora,
    };

    novoSalvo = await wixData.insert(COL.AGENDAMENTOS, novoAgendamento, {
      suppressAuth: true,
    });

    const originalAtualizado = {
      ...original,
      status: 'reagendado',
      reagendadoEm: agora,
      atualizadoEm: agora,

      reagendadoParaId: novoSalvo._id,
      reagendadoParaProtocolo: novoProtocolo,
      reagendadoParaDataIso: dataIsoDestino,
      reagendadoParaDataLabel: dataLabelDestino,
      reagendadoParaHorarioInicio: horarioInicioDestino,
      reagendadoParaHorarioFim: horarioFimDestino,
    };

    const originalSalvo = await wixData.update(
      COL.AGENDAMENTOS,
      originalAtualizado,
      {
        suppressAuth: true,
      }
    );

    return {
      ok: true,
      mensagem: 'Agendamento remarcado com sucesso.',
      protocolo: novoProtocolo,
      agendamentoOriginal: mapAgendamentoAdmin(originalSalvo),
      novoAgendamento: mapAgendamentoAdmin(novoSalvo),
    };
  } catch (err) {
    console.error('Erro em remarcarAgendamentoAdminApi:', err);

    if (novoSalvo && novoSalvo._id) {
      try {
        await wixData.update(
          COL.AGENDAMENTOS,
          {
            ...novoSalvo,
            status: 'cancelado',
            canceladoEm: new Date(),
            atualizadoEm: new Date(),
          },
          {
            suppressAuth: true,
          }
        );
      } catch (rollbackErr) {
        console.error('Falha ao desfazer novo agendamento após erro de remarcação:', rollbackErr);
      }
    }

    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível remarcar o agendamento agora.',
    };
  }
}


// ============================================================
// Envios diários de listas (admin)
// ============================================================

export async function obterConfiguracaoEnviosAdminApi(tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.CONFIG_VER);
    if (!tokenOk.ok) return tokenOk;
    return await obterConfiguracaoEnviosListasCore();
  } catch (err) {
    console.error('Erro em obterConfiguracaoEnviosAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar a configuração dos envios.',
    };
  }
}

export async function atualizarConfiguracaoEnviosAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.CONFIG_ATIVAR_ENVIOS);
    if (!tokenOk.ok) return tokenOk;

    const resultado = await atualizarConfiguracaoEnviosListasCore(
      payload,
      tokenOk.usuario?.email || 'painel-admin',
    );

    if (resultado.ok) {
      await registrarAdminLog(
        tokenOk,
        'envios.configuracao.atualizar',
        'ConfiguracoesCentral',
        resultado.configuracao?._id || 'envios-listas',
        {
          enviosAtivos: resultado.configuracao?.enviosAtivos === true,
          horarioBrasilia: resultado.configuracao?.horarioBrasilia || '17:00',
          enviarListaVazia: true,
          usarProximoDiaUtil: true,
        },
      );
    }

    return resultado;
  } catch (err) {
    console.error('Erro em atualizarConfiguracaoEnviosAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível atualizar a configuração dos envios.',
    };
  }
}

export async function listarEnviosListasAdminApi(filtros = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.CONFIG_VER);
    if (!tokenOk.ok) return tokenOk;
    return await listarEnviosListasCore(filtros);
  } catch (err) {
    console.error('Erro em listarEnviosListasAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar o histórico de envios.',
    };
  }
}

export async function testarEnvioListaAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.CONFIG_TESTAR_ENVIOS);
    if (!tokenOk.ok) return tokenOk;

    const resultado = await testarEnvioListaCore(
      payload,
      tokenOk.usuario?.email || 'painel-admin',
    );

    await registrarAdminLog(
      tokenOk,
      'envios.lista.testar',
      'EnviosListas',
      resultado.envio?._id || '',
      {
        ok: resultado.ok === true,
        unidadeSlug: payload.unidadeSlug || payload.unidade || '',
        dataAlvoIso: payload.dataAlvoIso || payload.dataIso || '',
        emailTeste: normalizeEmail(payload.emailTeste || payload.emailDestino || payload.email),
        codigo: resultado.codigo || '',
      },
    );

    return resultado;
  } catch (err) {
    console.error('Erro em testarEnvioListaAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível executar o envio de teste.',
    };
  }
}

export async function executarEnvioListasAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.CONFIG_ATIVAR_ENVIOS);
    if (!tokenOk.ok) return tokenOk;

    const resultado = await executarEnvioListasAgoraCore(
      payload,
      tokenOk.usuario?.email || 'painel-admin',
    );

    await registrarAdminLog(
      tokenOk,
      'envios.listas.executar',
      'EnviosListas',
      '',
      {
        ok: resultado.ok === true,
        dataAlvoIso: resultado.dataAlvoIso || payload.dataAlvoIso || payload.dataIso || '',
        unidadeSlug: payload.unidadeSlug || payload.unidade || '',
        resumo: resultado.resumo || {},
      },
    );

    return resultado;
  } catch (err) {
    console.error('Erro em executarEnvioListasAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível executar os envios agora.',
    };
  }
}

export async function reenviarListaAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.CONFIG_ATIVAR_ENVIOS);
    if (!tokenOk.ok) return tokenOk;

    const resultado = await reenviarListaCore(
      payload,
      tokenOk.usuario?.email || 'painel-admin',
    );

    await registrarAdminLog(
      tokenOk,
      'envios.lista.reenviar',
      'EnviosListas',
      payload.envioId || payload._id || payload.id || resultado.envio?._id || '',
      {
        ok: resultado.ok === true,
        codigo: resultado.codigo || '',
        novoEnvioId: resultado.envio?._id || '',
      },
    );

    return resultado;
  } catch (err) {
    console.error('Erro em reenviarListaAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível reenviar a lista agora.',
    };
  }
}


function eventoAdminNumero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function eventoAdminDinheiro(value) {
  const item = value && typeof value === 'object' ? value : {};
  const amount = eventoAdminNumero(item.value ?? item.amount);
  return {
    currency: text(item.currency || 'BRL') || 'BRL',
    value: amount,
  };
}

function normalizarResumoFinanceiroEvento(resultado) {
  const sales = Array.isArray(resultado?.sales) ? resultado.sales : [];

  return sales.map((sale) => {
    const total = eventoAdminDinheiro(sale?.total);
    const revenue = eventoAdminDinheiro(sale?.revenue);
    const currency = total.currency || revenue.currency || 'BRL';

    return {
      currency,
      ticketsSold: eventoAdminNumero(sale?.totalTickets),
      totalOrders: eventoAdminNumero(sale?.totalOrders),
      totalSales: total.value,
      revenue: revenue.value,
      salesRevenueDifference: Math.max(0, total.value - revenue.value),
    };
  });
}

function mapEventoAdmin(item, financeiro = null, financeiroPermitido = false) {
  const tipo = text(item?.type).toUpperCase();
  const startIso = dateTimeToIso(item?.start);
  const endIso = dateTimeToIso(item?.end);

  return {
    id: text(item?._id || item?.id),
    title: text(item?.title) || 'Evento sem título',
    slug: text(item?.slug),
    status: text(item?.status).toUpperCase(),
    registrationStatus: text(item?.registrationStatus).toUpperCase(),
    type: tipo || 'NONE',
    isTicketed: tipo === 'TICKETS',
    startDate: startIso,
    endDate: endIso,
    dateLabel: text(item?.scheduleFormatted || item?.scheduleStartDateFormatted),
    locationName: text(item?.locationName),
    locationAddress: text(item?.locationAddress),
    publicUrl: text(item?.registrationUrl),
    lowestPriceFormatted: text(item?.lowestPriceFormatted),
    highestPriceFormatted: text(item?.highestPriceFormatted),
    financeiroPermitido: financeiroPermitido === true,
    financeiro,
  };
}

async function obterFinanceiroEventoAdmin(eventId) {
  const id = text(eventId);
  if (!id) return [];

  try {
    const resultado = await obterResumoVendasEventoElevado({ eventId: id });
    return normalizarResumoFinanceiroEvento(resultado);
  } catch (err) {
    console.warn('Não foi possível obter o resumo financeiro do evento.', {
      eventId: id,
      message: normalizarMensagemErroApi(err),
    });
    return null;
  }
}

function eventoAdminValorDinheiro(value) {
  const item = value && typeof value === 'object' ? value : {};
  return eventoAdminNumero(item.value ?? item.amount);
}

function eventoAdminMoeda(...values) {
  for (const value of values) {
    const currency = text(value?.currency);
    if (currency) return currency;
  }
  return 'BRL';
}

function somarTaxasFinanceiras(items = []) {
  return (Array.isArray(items) ? items : []).reduce(
    (total, item) => total + eventoAdminValorDinheiro(item?.amount),
    0
  );
}

function normalizarItemFinanceiroPedido(item, fallbackCurrency = 'BRL') {
  const price = item?.price || {};
  const total = item?.total || {};
  const discount = item?.discount?.amount || {};
  const tax = item?.tax?.amount || {};
  const currency = eventoAdminMoeda(total, price, discount, tax) || fallbackCurrency;

  return {
    name: text(item?.name) || 'Ingresso',
    quantity: Math.max(0, eventoAdminNumero(item?.quantity)),
    currency,
    unitPrice: eventoAdminValorDinheiro(price),
    total: eventoAdminValorDinheiro(total),
    discount: eventoAdminValorDinheiro(discount),
    tax: eventoAdminValorDinheiro(tax),
    fees: somarTaxasFinanceiras(item?.fees),
  };
}

function normalizarPedidoFinanceiroEvento(order) {
  const invoice = order?.invoice && typeof order.invoice === 'object'
    ? order.invoice
    : {};
  const currency = eventoAdminMoeda(
    invoice?.grandTotal,
    invoice?.total,
    invoice?.subTotal,
    invoice?.revenue,
    order?.totalPrice
  );
  const items = (Array.isArray(invoice?.items) ? invoice.items : [])
    .map((item) => normalizarItemFinanceiroPedido(item, currency));
  const grandTotal = eventoAdminValorDinheiro(invoice?.grandTotal)
    || eventoAdminValorDinheiro(invoice?.total)
    || eventoAdminValorDinheiro(order?.totalPrice);

  return {
    orderNumber: text(order?.orderNumber),
    created: dateTimeToIso(order?.created),
    status: text(order?.status).toUpperCase(),
    confirmed: order?.confirmed === true,
    paymentMethod: text(order?.method),
    channel: text(order?.channel).toUpperCase(),
    ticketsQuantity: Math.max(0, eventoAdminNumero(order?.ticketsQuantity)),
    currency,
    subtotal: eventoAdminValorDinheiro(invoice?.subTotal),
    discount: eventoAdminValorDinheiro(invoice?.discount?.amount),
    tax: eventoAdminValorDinheiro(invoice?.tax?.amount),
    fees: somarTaxasFinanceiras(invoice?.fees),
    grandTotal,
    revenue: eventoAdminValorDinheiro(invoice?.revenue),
    couponCode: text(invoice?.discount?.code),
    couponName: text(invoice?.discount?.name),
    items,
  };
}

async function listarPedidosFinanceirosEventoAdmin(eventId) {
  const id = text(eventId);
  if (!id) return [];

  const result = [];
  const limit = 100;
  let offset = 0;
  let total = 0;

  do {
    const response = await listarPedidosEventoElevado({
      eventId: [id],
      fieldset: ['DETAILS', 'INVOICE'],
      tag: ['CONFIRMED'],
      sort: 'created:asc',
      offset,
      limit,
    });
    const batch = Array.isArray(response?.orders) ? response.orders : [];
    total = Math.max(eventoAdminNumero(response?.total), offset + batch.length);
    result.push(...batch.map(normalizarPedidoFinanceiroEvento));
    offset += batch.length;

    if (!batch.length || batch.length < limit) break;
  } while (offset < total);

  return result;
}

function agregarTotaisPedidosFinanceiros(pedidos = []) {
  const porMoeda = new Map();

  for (const pedido of pedidos) {
    const currency = text(pedido?.currency || 'BRL') || 'BRL';
    const atual = porMoeda.get(currency) || {
      currency,
      orders: 0,
      tickets: 0,
      subtotal: 0,
      discounts: 0,
      taxes: 0,
      fees: 0,
      grandTotal: 0,
      revenue: 0,
    };

    atual.orders += 1;
    atual.tickets += eventoAdminNumero(pedido?.ticketsQuantity);
    atual.subtotal += eventoAdminNumero(pedido?.subtotal);
    atual.discounts += eventoAdminNumero(pedido?.discount);
    atual.taxes += eventoAdminNumero(pedido?.tax);
    atual.fees += eventoAdminNumero(pedido?.fees);
    atual.grandTotal += eventoAdminNumero(pedido?.grandTotal);
    atual.revenue += eventoAdminNumero(pedido?.revenue);
    porMoeda.set(currency, atual);
  }

  return Array.from(porMoeda.values());
}

function agregarTiposIngressosFinanceiros(pedidos = []) {
  const tipos = new Map();

  for (const pedido of pedidos) {
    const items = Array.isArray(pedido?.items) ? pedido.items : [];

    for (const item of items) {
      const currency = text(item?.currency || pedido?.currency || 'BRL') || 'BRL';
      const name = text(item?.name) || 'Ingresso';
      const unitPrice = eventoAdminNumero(item?.unitPrice);
      const key = `${currency}\u0000${name}\u0000${unitPrice}`;
      const atual = tipos.get(key) || {
        name,
        currency,
        unitPrice,
        quantity: 0,
        total: 0,
        discount: 0,
        tax: 0,
        fees: 0,
      };

      atual.quantity += eventoAdminNumero(item?.quantity);
      atual.total += eventoAdminNumero(item?.total);
      atual.discount += eventoAdminNumero(item?.discount);
      atual.tax += eventoAdminNumero(item?.tax);
      atual.fees += eventoAdminNumero(item?.fees);
      tipos.set(key, atual);
    }
  }

  return Array.from(tipos.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR') || a.unitPrice - b.unitPrice
  );
}

export async function obterRelatorioFinanceiroEventoAdminApi(
  eventId,
  tokenRecebido = ''
) {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.EVENTOS_FINANCEIRO
    );
    if (!tokenOk.ok) return tokenOk;

    const id = text(eventId);
    if (!id) {
      return {
        ok: false,
        codigo: 'DADOS_OBRIGATORIOS',
        mensagem: 'Informe o evento para gerar o relatório financeiro.',
      };
    }

    const [resumoOficial, pedidos] = await Promise.all([
      obterFinanceiroEventoAdmin(id),
      listarPedidosFinanceirosEventoAdmin(id),
    ]);

    if (resumoOficial === null) {
      return {
        ok: false,
        codigo: 'FINANCEIRO_INDISPONIVEL',
        mensagem: 'O Wix não retornou os dados financeiros deste evento agora.',
      };
    }

    return {
      ok: true,
      eventId: id,
      generatedAt: new Date().toISOString(),
      summary: resumoOficial,
      totals: agregarTotaisPedidosFinanceiros(pedidos),
      ticketTypes: agregarTiposIngressosFinanceiros(pedidos),
      orders: pedidos.map(({ items, ...pedido }) => pedido),
    };
  } catch (err) {
    console.error('Erro em obterRelatorioFinanceiroEventoAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível gerar o relatório financeiro deste evento agora.',
    };
  }
}

async function listarEventosAdminRaw() {
  const batchSize = 100;
  const items = [];
  let offset = 0;
  let totalCount = 0;

  do {
    const result = await wixData
      .query('Events/Events')
      .descending('start')
      .skip(offset)
      .limit(batchSize)
      .find({ suppressAuth: true });

    const batch = Array.isArray(result?.items) ? result.items : [];
    totalCount = Number(result?.totalCount) || batch.length;
    items.push(...batch);
    offset += batch.length;

    if (!batch.length || batch.length < batchSize) break;
  } while (offset < totalCount);

  return items;
}

function eventoAdminMatchesFiltros(item, { busca = '', tipo = '', status = '' } = {}) {
  const itemTipo = text(item?.type).toUpperCase();
  const itemStatus = text(item?.status).toUpperCase();
  const title = normalizeSearch(item?.title);

  if (busca && !title.includes(busca)) return false;
  if ((tipo === 'TICKETS' || tipo === 'RSVP') && itemTipo !== tipo) return false;
  if (status && status !== 'TODOS' && itemStatus !== status) return false;

  return true;
}

function agregarResumoFinanceiroEventos(eventos = []) {
  const porMoeda = new Map();

  for (const evento of eventos) {
    const financeiro = Array.isArray(evento?.financeiro) ? evento.financeiro : [];

    for (const item of financeiro) {
      const currency = text(item?.currency || 'BRL') || 'BRL';
      const atual = porMoeda.get(currency) || {
        currency,
        ticketsSold: 0,
        totalOrders: 0,
        totalSales: 0,
        revenue: 0,
        salesRevenueDifference: 0,
      };

      atual.ticketsSold += eventoAdminNumero(item?.ticketsSold);
      atual.totalOrders += eventoAdminNumero(item?.totalOrders);
      atual.totalSales += eventoAdminNumero(item?.totalSales);
      atual.revenue += eventoAdminNumero(item?.revenue);
      atual.salesRevenueDifference += eventoAdminNumero(item?.salesRevenueDifference);
      porMoeda.set(currency, atual);
    }
  }

  return Array.from(porMoeda.values());
}

async function mapEventosAdminComFinanceiro(
  rawItems = [],
  financeiroPermitido = false
) {
  const result = [];
  const batchSize = 6;

  for (let index = 0; index < rawItems.length; index += batchSize) {
    const batch = rawItems.slice(index, index + batchSize);
    const mapped = await Promise.all(
      batch.map(async (item) => {
        const isTicketed = text(item?.type).toUpperCase() === 'TICKETS';
        const financeiro = financeiroPermitido && isTicketed
          ? await obterFinanceiroEventoAdmin(item?._id)
          : null;
        return mapEventoAdmin(item, financeiro, financeiroPermitido);
      })
    );
    result.push(...mapped);
  }

  return result;
}

export async function listarEventosAdminApi(filtros = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.EVENTOS_VER
    );

    if (!tokenOk.ok) return tokenOk;

    const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);
    const tipo = text(filtros.tipo || filtros.type).toUpperCase();
    const status = text(filtros.status).toUpperCase();
    const pagina = Math.max(1, Math.floor(eventoAdminNumero(filtros.pagina || filtros.page) || 1));
    const pageSize = Math.min(
      50,
      Math.max(10, Math.floor(eventoAdminNumero(filtros.pageSize || filtros.limit) || 25))
    );
    const financeiroPermitido =
      tokenOk.legacy === true ||
      hasPermission(tokenOk.permissoes, ADMIN_PERMISSIONS.EVENTOS_FINANCEIRO);

    const rawItems = await listarEventosAdminRaw();
    const filtrados = rawItems.filter((item) =>
      eventoAdminMatchesFiltros(item, { busca, tipo, status })
    );
    const total = filtrados.length;
    const offset = (pagina - 1) * pageSize;
    const pageRaw = filtrados.slice(offset, offset + pageSize);

    const ticketedFiltered = financeiroPermitido
      ? filtrados.filter((item) => text(item?.type).toUpperCase() === 'TICKETS')
      : [];
    const financialMapped = financeiroPermitido
      ? await mapEventosAdminComFinanceiro(ticketedFiltered, true)
      : [];
    const financeiroPorId = new Map(
      financialMapped.map((item) => [item.id, item.financeiro])
    );

    const eventos = pageRaw.map((item) => {
      const id = text(item?._id || item?.id);
      const isTicketed = text(item?.type).toUpperCase() === 'TICKETS';
      const financeiro = financeiroPermitido && isTicketed
        ? (financeiroPorId.get(id) ?? null)
        : null;
      return mapEventoAdmin(item, financeiro, financeiroPermitido);
    });

    return {
      ok: true,
      pagina,
      pageSize,
      total,
      eventos,
      financeiroPermitido,
      resumo: {
        eventos: total,
        ticketados: filtrados.filter(
          (item) => text(item?.type).toUpperCase() === 'TICKETS'
        ).length,
        financeiro: financeiroPermitido
          ? agregarResumoFinanceiroEventos(financialMapped)
          : [],
      },
    };
  } catch (err) {
    console.error('Erro em listarEventosAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível carregar os eventos administrativos.',
    };
  }
}


const SITE_EDITOR_PUBLIC_URL = 'https://www.juizdefora-oabmg.org.br/';

function siteEditorDate(value) {
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

function siteEditorRevision(item = {}) {
  const updated = siteEditorDate(item._updatedDate);
  return updated ? updated.toISOString() : text(item._id);
}

function siteEditorImageUrl(value) {
  const candidate =
    value && typeof value === 'object'
      ? value.url || value.src || value.fileUrl || value.uri
      : value;
  const raw = text(candidate);

  if (!raw) return '';
  if (/^https:\/\//i.test(raw)) return raw;

  const match = raw.match(/^(?:wix:)?image:\/\/v1\/([^/]+)/i);
  return match && match[1]
    ? `https://static.wixstatic.com/media/${match[1]}`
    : '';
}

function siteEditorPageId(item = {}) {
  return `home:${text(item._id)}`;
}

function mapHomeSiteEditorDocument(item = {}, index = 0, total = 1) {
  const desktop = siteEditorImageUrl(item.imagemDesktop);
  const mobile = siteEditorImageUrl(item.imagemMobile);
  const imageAlt = text(item.imagemAlt);
  const title = text(item.titulo) || `Banner ${index + 1}`;

  return {
    id: siteEditorPageId(item),
    label: `Home - Banner ${String(index + 1).padStart(2, '0')} - ${title}`,
    path: '/',
    sourceUrl: SITE_EDITOR_PUBLIC_URL,
    sourceRevision: siteEditorRevision(item),
    meta: {
      kind: 'home-banner',
      position: index + 1,
      total,
      active: item.ativo === true,
      priority: Number(item.prioridade) || 0,
    },
    sections: [
      {
        id: 'hero',
        label: 'Banner da Home',
        description:
          'Arte e conteúdo de um destaque da sequência editorial da página inicial.',
        visible: item.ativo === true,
        visibilityEditable: true,
        fields: [
          {
            kind: 'text',
            id: 'hero.title',
            label: 'Identificação / título',
            value: title,
            required: true,
            maxLength: 100,
            help:
              'Serve para identificar o banner no painel. Quando houver texto de apoio ou botão, também funciona como título público.',
          },
          {
            kind: 'textarea',
            id: 'hero.body',
            label: 'Texto de apoio',
            value: text(item.chamada),
            required: false,
            maxLength: 420,
            help: 'Opcional. Uma arte pode funcionar sozinha, sem bloco de texto.',
          },
          {
            kind: 'image',
            id: 'hero.desktopImage',
            label: 'Imagem desktop',
            url: desktop,
            alt: imageAlt,
            uploadable: true,
            altEditable: false,
            help:
              'JPG, PNG ou WebP, até 8 MB. Esta é a arte principal do banner.',
          },
          {
            kind: 'image',
            id: 'hero.mobileImage',
            label: 'Imagem mobile',
            url: mobile,
            alt: imageAlt,
            uploadable: true,
            altEditable: false,
            help:
              'Opcional. Se ficar vazia, a versão desktop também será usada no mobile.',
          },
          {
            kind: 'text',
            id: 'hero.imageAlt',
            label: 'Texto alternativo das imagens',
            value: imageAlt,
            required: false,
            maxLength: 180,
            help:
              'Obrigatório quando o banner estiver ativo. Descreva de forma objetiva o conteúdo visual.',
          },
          {
            kind: 'link',
            id: 'hero.cta',
            label: 'Botão / chamada',
            text: text(item.rotuloCta),
            href: text(item.linkCta),
            required: false,
            help:
              'Opcional. Se usar, informe texto e destino. Aceita caminho interno iniciado por / ou HTTPS.',
          },
        ],
      },
    ],
  };
}

function siteEditorField(document = {}, fieldId = '') {
  const sections = Array.isArray(document.sections) ? document.sections : [];
  for (const section of sections) {
    const fields = Array.isArray(section?.fields) ? section.fields : [];
    const field = fields.find((item) => text(item?.id) === fieldId);
    if (field) return field;
  }
  return null;
}

function validarSiteEditorHref(value) {
  const raw = text(value);
  if (!raw) return false;
  if (raw.startsWith('/')) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function siteEditorSection(document = {}, sectionId = '') {
  const sections = Array.isArray(document.sections) ? document.sections : [];
  return sections.find((item) => text(item?.id) === sectionId) || null;
}

function validarDocumentoHomeSiteEditor(document = {}) {
  const section = siteEditorSection(document, 'hero');
  const title = siteEditorField(document, 'hero.title');
  const body = siteEditorField(document, 'hero.body');
  const desktopImage = siteEditorField(document, 'hero.desktopImage');
  const imageAlt = siteEditorField(document, 'hero.imageAlt');
  const cta = siteEditorField(document, 'hero.cta');
  const active = section?.visible === true;

  if (!title || !text(title.value)) {
    return 'Informe uma identificação para o banner da Home.';
  }
  if (text(title.value).length > 100) {
    return 'A identificação do banner deve ter até 100 caracteres.';
  }
  if (body && text(body.value).length > 420) {
    return 'O texto de apoio da Home deve ter até 420 caracteres.';
  }
  if (imageAlt && text(imageAlt.value).length > 180) {
    return 'O texto alternativo deve ter até 180 caracteres.';
  }

  if (active) {
    if (!desktopImage || !text(desktopImage.url)) {
      return 'Envie uma imagem desktop antes de ativar o banner.';
    }
    if (!imageAlt || !text(imageAlt.value)) {
      return 'Informe o texto alternativo antes de ativar o banner.';
    }
  }

  const ctaText = text(cta?.text);
  const ctaHref = text(cta?.href);
  if ((ctaText && !ctaHref) || (!ctaText && ctaHref)) {
    return 'Para usar a chamada, informe o texto e o destino do botão.';
  }
  if (ctaHref && !validarSiteEditorHref(ctaHref)) {
    return 'Use um caminho interno iniciado por / ou um endereço HTTPS no botão.';
  }

  return '';
}

async function obterDestaqueHomeSiteEditorPorId(itemId = '') {
  const id = text(itemId);
  if (!id) return null;

  try {
    return await wixData.get(COL.DESTAQUES_HOME, id, {
      suppressAuth: true,
    });
  } catch (_) {
    return null;
  }
}

async function listarDestaquesHomeSiteEditor() {
  const result = await wixData
    .query(COL.DESTAQUES_HOME)
    .descending('prioridade')
    .descending('_updatedDate')
    .limit(50)
    .find({ suppressAuth: true });

  return (result.items || []).filter((item) => item && item._id);
}


function siteEditorSafeFileName(value = '') {
  const raw = text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = raw
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return cleaned || `banner-${Date.now()}.jpg`;
}

async function validarLimiteBannersAtivos(excludeId = '') {
  const items = await listarDestaquesHomeSiteEditor();
  return items.filter(
    (item) => item.ativo === true && text(item._id) !== text(excludeId)
  ).length;
}

export async function prepararUploadImagemSiteAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR
    );
    if (!tokenOk.ok) return tokenOk;

    const mimeType = text(payload.mimeType).toLowerCase();
    const fileName = siteEditorSafeFileName(payload.fileName);
    const sizeInBytes = Number(payload.sizeInBytes) || 0;

    if (!SITE_EDITOR_IMAGE_MIME_TYPES.has(mimeType)) {
      return {
        ok: false,
        codigo: 'ARQUIVO_INVALIDO',
        mensagem: 'Envie uma imagem JPG, PNG ou WebP.',
      };
    }
    if (!sizeInBytes || sizeInBytes > SITE_EDITOR_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        codigo: 'ARQUIVO_INVALIDO',
        mensagem: 'A imagem deve ter até 8 MB.',
      };
    }

    const upload = await mediaManager.getUploadUrl(
      SITE_EDITOR_BANNER_FOLDER,
      {
        mediaOptions: {
          mimeType,
          mediaType: 'image',
        },
        metadataOptions: {
          isPrivate: false,
          isVisitorUpload: false,
          context: {
            origem: 'portal-gestao-oabjf',
            fluxo: 'site-editor-banner-home',
            nomeOriginal: text(payload.fileName),
          },
        },
      }
    );

    if (!upload || !text(upload.uploadUrl)) {
      return {
        ok: false,
        codigo: 'UPLOAD_INDISPONIVEL',
        mensagem: 'Não foi possível preparar o envio da imagem agora.',
      };
    }

    return {
      ok: true,
      upload: {
        uploadUrl: text(upload.uploadUrl),
        fileName,
        mimeType,
        maxBytes: SITE_EDITOR_IMAGE_MAX_BYTES,
      },
    };
  } catch (err) {
    console.error('Erro em prepararUploadImagemSiteAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível preparar o envio da imagem.',
    };
  }
}

export async function criarBannerHomeSiteAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR
    );
    if (!tokenOk.ok) return tokenOk;

    const items = await listarDestaquesHomeSiteEditor();
    if (items.length >= HOME_BANNERS_MAX_TOTAL) {
      return {
        ok: false,
        codigo: 'LIMITE_BANNERS',
        mensagem: `A Home pode manter no máximo ${HOME_BANNERS_MAX_TOTAL} banners cadastrados.`,
      };
    }

    const lowestPriority = items.length
      ? Math.min(...items.map((item) => Number(item.prioridade) || 0))
      : 10;

    const created = await wixData.insert(
      COL.DESTAQUES_HOME,
      {
        titulo: 'Novo banner',
        chamada: '',
        imagemDesktop: '',
        imagemMobile: '',
        imagemAlt: '',
        rotuloCta: '',
        linkCta: '',
        abrirNovaAba: false,
        ativo: false,
        prioridade: items.length ? lowestPriority - 10 : 10,
      },
      { suppressAuth: true }
    );

    await registrarAdminLog(
      tokenOk,
      'site.banner.criar',
      'DestaquesHome',
      created._id,
      { pagina: '/', ativo: false }
    );

    return {
      ok: true,
      mensagem: 'Novo banner criado como inativo.',
      pageId: siteEditorPageId(created),
    };
  } catch (err) {
    console.error('Erro em criarBannerHomeSiteAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível criar o banner da Home.',
    };
  }
}

export async function excluirBannerHomeSiteAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR
    );
    if (!tokenOk.ok) return tokenOk;

    const pageId = text(payload.pageId);
    const match = pageId.match(/^home:(.+)$/);
    if (!match || !match[1]) {
      return { ok: false, codigo: 'DADOS_INVALIDOS', mensagem: 'Banner inválido.' };
    }

    const items = await listarDestaquesHomeSiteEditor();
    if (items.length <= 1) {
      return {
        ok: false,
        codigo: 'ULTIMO_BANNER',
        mensagem: 'Mantenha pelo menos um banner cadastrado na Home.',
      };
    }

    const current = await obterDestaqueHomeSiteEditorPorId(match[1]);
    if (!current || !current._id) {
      return { ok: false, codigo: 'CONTEUDO_NAO_ENCONTRADO', mensagem: 'Banner não encontrado.' };
    }
    if (current.ativo === true) {
      return {
        ok: false,
        codigo: 'BANNER_ATIVO',
        mensagem: 'Desative e salve o banner antes de excluí-lo.',
      };
    }

    const sourceRevision = text(payload.sourceRevision);
    const currentRevision = siteEditorRevision(current);
    if (sourceRevision && sourceRevision !== currentRevision) {
      return {
        ok: false,
        codigo: 'CONFLITO_REVISAO',
        mensagem: 'O banner foi alterado por outra sessão. Recarregue antes de excluir.',
      };
    }

    await wixData.remove(COL.DESTAQUES_HOME, current._id, { suppressAuth: true });
    await registrarAdminLog(
      tokenOk,
      'site.banner.excluir',
      'DestaquesHome',
      current._id,
      { pagina: '/', titulo: text(current.titulo) }
    );

    return { ok: true, mensagem: 'Banner removido.' };
  } catch (err) {
    console.error('Erro em excluirBannerHomeSiteAdminApi:', err);
    return { ok: false, codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível excluir o banner.' };
  }
}

export async function reordenarBannerHomeSiteAdminApi(payload = {}, tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR
    );
    if (!tokenOk.ok) return tokenOk;

    const pageId = text(payload.pageId);
    const direction = text(payload.direction).toLowerCase();
    const match = pageId.match(/^home:(.+)$/);
    if (!match || !match[1] || !['up', 'down'].includes(direction)) {
      return { ok: false, codigo: 'DADOS_INVALIDOS', mensagem: 'Ordem de banner inválida.' };
    }

    const items = await listarDestaquesHomeSiteEditor();
    const currentIndex = items.findIndex((item) => text(item._id) === match[1]);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0) {
      return { ok: false, codigo: 'CONTEUDO_NAO_ENCONTRADO', mensagem: 'Banner não encontrado.' };
    }
    if (targetIndex < 0 || targetIndex >= items.length) {
      return { ok: true, mensagem: 'O banner já está no limite desta ordem.' };
    }

    const ordered = [...items];
    [ordered[currentIndex], ordered[targetIndex]] = [
      ordered[targetIndex],
      ordered[currentIndex],
    ];

    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      const nextPriority = (ordered.length - index) * 10;
      if ((Number(item.prioridade) || 0) === nextPriority) continue;
      await wixData.update(
        COL.DESTAQUES_HOME,
        { ...item, prioridade: nextPriority },
        { suppressAuth: true }
      );
    }

    await registrarAdminLog(
      tokenOk,
      'site.banner.reordenar',
      'DestaquesHome',
      match[1],
      { pagina: '/', direcao: direction }
    );

    return { ok: true, mensagem: 'Ordem dos banners atualizada.' };
  } catch (err) {
    console.error('Erro em reordenarBannerHomeSiteAdminApi:', err);
    return { ok: false, codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível reordenar os banners.' };
  }
}

const SITE_EDITOR_INSTITUTIONAL_PATHS = {
  'sobre-a-oab': '/institucional/sobre-a-oab',
  'conselho-federal': '/institucional/conselho-federal',
  'oab-minas-gerais': '/institucional/oab-minas-gerais',
  esa: '/institucional/esa',
  ted: '/institucional/ted',
  'caa-mg-em-jf': '/caa-mg-em-jf',
  diretoria: '/prerrogativas/diretoria',
  procuradoria: '/prerrogativas/procuradoria',
};

function siteEditorInstitutionalPath(item = {}) {
  const slug = text(item.slug);
  const fixed = SITE_EDITOR_INSTITUTIONAL_PATHS[slug];
  if (fixed) return fixed;
  return text(item.secao).toLowerCase() === 'prerrogativas'
    ? `/prerrogativas/${slug}`
    : `/institucional/${slug}`;
}

function siteEditorTextField(id, label, value, options = {}) {
  return {
    kind: options.multiline ? 'textarea' : 'text',
    id, label, value: text(value),
    ...(options.required ? { required: true } : {}),
    ...(options.maxLength ? { maxLength: options.maxLength } : {}),
    ...(options.help ? { help: options.help } : {}),
  };
}

function siteEditorRichField(id, label, html, options = {}) {
  return {
    kind: 'richtext', id, label, html: text(html),
    ...(options.required ? { required: true } : {}),
    ...(options.maxLength ? { maxLength: options.maxLength } : {}),
    ...(options.help ? { help: options.help } : {}),
  };
}

function siteEditorOptionalTextFields(item = {}) {
  const fields = [];
  const add = (id, label, key, maxLength = 140) => {
    if (text(item[key])) fields.push(siteEditorTextField(id, label, item[key], { maxLength }));
  };
  add('contact.primaryPhone', 'Telefone principal', 'telefonePrimario', 40);
  add('contact.secondaryPhone', 'Telefone secundário', 'telefoneSecundario', 40);
  add('contact.whatsapp', 'WhatsApp', 'whatsapp', 40);
  add('contact.serviceType', 'Tipo de atendimento', 'tipoAtendimento', 80);
  return fields;
}

function mapInstitutionalSiteEditorDocument(item = {}) {
  const path = siteEditorInstitutionalPath(item);
  const image = siteEditorImageUrl(item.imagem);
  const imageAlt = text(item.imagemAlt) || text(item.titulo);
  const sections = [
    {
      id: 'main', label: 'Apresentação',
      description: 'Título, chamada, navegação e imagem principal da página.',
      visible: true, visibilityEditable: false,
      fields: [
        siteEditorTextField('main.title', 'Título', item.titulo, { required: true, maxLength: 140 }),
        siteEditorTextField('main.summary', 'Chamada', item.chamada, { required: true, maxLength: 500, multiline: true }),
        siteEditorTextField('main.navigationLabel', 'Rótulo da navegação', item.rotuloNavegacao, { required: true, maxLength: 100 }),
        ...(image ? [
          { kind: 'image', id: 'main.image', label: 'Imagem principal', url: image, alt: imageAlt, readOnly: true },
          siteEditorTextField('main.imageAlt', 'Texto alternativo da imagem', imageAlt, { required: true, maxLength: 180 }),
        ] : []),
      ],
    },
    {
      id: 'content', label: 'Conteúdo',
      description: 'Corpo editorial principal exibido na página pública.',
      visible: true, visibilityEditable: false,
      fields: [siteEditorRichField('content.body', 'Conteúdo da página', item.conteudo, { required: true, maxLength: 30000 })],
    },
  ];

  const contactFields = siteEditorOptionalTextFields(item);
  if (text(item.horario)) contactFields.push(siteEditorRichField('contact.hours', 'Horários', item.horario, { maxLength: 3000 }));
  if (contactFields.length) sections.push({ id: 'contact', label: 'Atendimento e contato', description: 'Canais e horários exibidos para orientar o público.', visible: true, visibilityEditable: false, fields: contactFields });

  const leadership = [];
  const add = (id, label, key, maxLength = 140) => { if (text(item[key])) leadership.push(siteEditorTextField(id, label, item[key], { maxLength })); };
  add('leadership.primaryName', 'Nome do responsável', 'responsavelNome');
  add('leadership.primaryRole', 'Cargo do responsável', 'responsavelCargo');
  add('leadership.primaryOab', 'OAB do responsável', 'responsavelOab', 60);
  const leaderImage = siteEditorImageUrl(item.responsavelFoto);
  if (leaderImage) {
    leadership.push({ kind: 'image', id: 'leadership.primaryImage', label: 'Foto do responsável', url: leaderImage, alt: text(item.responsavelFotoAlt) || text(item.responsavelNome), readOnly: true });
    leadership.push(siteEditorTextField('leadership.primaryImageAlt', 'Texto alternativo da foto', item.responsavelFotoAlt || item.responsavelNome, { maxLength: 180 }));
  }
  add('leadership.secondaryName', 'Nome do segundo responsável', 'responsavelSecundarioNome');
  add('leadership.secondaryRole', 'Cargo do segundo responsável', 'responsavelSecundarioCargo');
  add('leadership.secondaryOab', 'OAB do segundo responsável', 'responsavelSecundarioOab', 60);
  const secondImage = siteEditorImageUrl(item.responsavelSecundarioFoto);
  if (secondImage) {
    leadership.push({ kind: 'image', id: 'leadership.secondaryImage', label: 'Foto do segundo responsável', url: secondImage, alt: text(item.responsavelSecundarioFotoAlt) || text(item.responsavelSecundarioNome), readOnly: true });
    leadership.push(siteEditorTextField('leadership.secondaryImageAlt', 'Texto alternativo da segunda foto', item.responsavelSecundarioFotoAlt || item.responsavelSecundarioNome, { maxLength: 180 }));
  }
  if (leadership.length) sections.push({ id: 'leadership', label: 'Responsáveis', description: 'Responsáveis institucionais apresentados nesta página.', visible: true, visibilityEditable: false, fields: leadership });

  const teamFields = [];
  if (text(item.equipeTitulo)) teamFields.push(siteEditorTextField('team.title', 'Título da equipe', item.equipeTitulo, { maxLength: 140 }));
  if (text(item.equipe)) teamFields.push(siteEditorRichField('team.body', 'Equipe', item.equipe, { maxLength: 20000 }));
  if (teamFields.length) sections.push({ id: 'team', label: 'Equipe', description: 'Título e conteúdo da equipe vinculada à página.', visible: true, visibilityEditable: false, fields: teamFields });

  sections.push({ id: 'seo', label: 'SEO', description: 'Metadados usados por buscadores e compartilhamentos.', visible: false, visibilityEditable: false, fields: [
    siteEditorTextField('seo.title', 'Título SEO', item.seoTitulo, { maxLength: 70 }),
    siteEditorTextField('seo.description', 'Descrição SEO', item.seoDescricao, { maxLength: 180, multiline: true }),
  ] });

  const sectionLabel = text(item.secao).toLowerCase() === 'prerrogativas' ? 'Prerrogativas' : 'Institucional';
  return {
    id: `institutional:${text(item._id)}`,
    label: `${sectionLabel} - ${text(item.rotuloNavegacao || item.titulo)}`,
    path, sourceUrl: `${SITE_EDITOR_PUBLIC_URL.replace(/\/$/, '')}${path}`,
    sourceRevision: siteEditorRevision(item), sections,
  };
}

async function listarPaginasInstitucionaisSiteEditor() {
  const result = await wixData.query(COL.PAGINAS_INSTITUCIONAIS).ascending('ordem').ascending('titulo').limit(100).find({ suppressAuth: true });
  return (result.items || []).filter((item) => item && item._id);
}

async function obterPaginaInstitucionalSiteEditorPorId(itemId = '') {
  const id = text(itemId);
  if (!id) return null;
  try { return await wixData.get(COL.PAGINAS_INSTITUCIONAIS, id, { suppressAuth: true }); } catch (_) { return null; }
}

function siteEditorRichFieldHtml(document = {}, fieldId = '') {
  const field = siteEditorField(document, fieldId);
  return field && field.kind === 'richtext' ? text(field.html) : '';
}
function siteEditorTextFieldValue(document = {}, fieldId = '') {
  const field = siteEditorField(document, fieldId);
  return field && (field.kind === 'text' || field.kind === 'textarea') ? text(field.value) : '';
}
function siteEditorPlainRichText(value = '') { return text(value).replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim(); }

function validarDocumentoInstitucionalSiteEditor(document = {}) {
  const title = siteEditorTextFieldValue(document, 'main.title');
  const summary = siteEditorTextFieldValue(document, 'main.summary');
  const navigationLabel = siteEditorTextFieldValue(document, 'main.navigationLabel');
  const body = siteEditorRichFieldHtml(document, 'content.body');
  if (!title) return 'Informe o título da página institucional.';
  if (title.length > 140) return 'O título deve ter até 140 caracteres.';
  if (!summary) return 'Informe a chamada da página institucional.';
  if (summary.length > 500) return 'A chamada deve ter até 500 caracteres.';
  if (!navigationLabel) return 'Informe o rótulo da navegação.';
  if (!siteEditorPlainRichText(body)) return 'Informe o conteúdo principal da página.';
  if (siteEditorTextFieldValue(document, 'seo.title').length > 70) return 'O título SEO deve ter até 70 caracteres.';
  if (siteEditorTextFieldValue(document, 'seo.description').length > 180) return 'A descrição SEO deve ter até 180 caracteres.';
  return '';
}

function aplicarTexto(document, next, key, fieldId) { const field = siteEditorField(document, fieldId); if (field && (field.kind === 'text' || field.kind === 'textarea')) next[key] = text(field.value); }
function aplicarRich(document, next, key, fieldId) { const field = siteEditorField(document, fieldId); if (field && field.kind === 'richtext') next[key] = text(field.html); }

async function salvarPaginaInstitucionalSiteEditor(payload = {}, document = {}, itemId = '', tokenOk = {}) {
  const current = await obterPaginaInstitucionalSiteEditorPorId(itemId);
  if (!current || !current._id) return { ok: false, codigo: 'CONTEUDO_NAO_ENCONTRADO', mensagem: 'A página institucional não foi encontrada.' };
  const currentRevision = siteEditorRevision(current);
  const sourceRevision = text(payload.sourceRevision || document.sourceRevision);
  if (sourceRevision && sourceRevision !== currentRevision) return { ok: false, codigo: 'CONFLITO_REVISAO', mensagem: 'O conteúdo foi alterado por outra sessão. Recarregue o editor antes de salvar novamente.', sourceRevision: currentRevision };
  const validationError = validarDocumentoInstitucionalSiteEditor(document);
  if (validationError) return { ok: false, codigo: 'DADOS_INVALIDOS', mensagem: validationError };
  const updated = { ...current };
  aplicarTexto(document, updated, 'titulo', 'main.title'); aplicarTexto(document, updated, 'chamada', 'main.summary'); aplicarTexto(document, updated, 'rotuloNavegacao', 'main.navigationLabel'); aplicarTexto(document, updated, 'imagemAlt', 'main.imageAlt'); aplicarRich(document, updated, 'conteudo', 'content.body');
  aplicarTexto(document, updated, 'telefonePrimario', 'contact.primaryPhone'); aplicarTexto(document, updated, 'telefoneSecundario', 'contact.secondaryPhone'); aplicarTexto(document, updated, 'whatsapp', 'contact.whatsapp'); aplicarTexto(document, updated, 'tipoAtendimento', 'contact.serviceType'); aplicarRich(document, updated, 'horario', 'contact.hours');
  aplicarTexto(document, updated, 'responsavelNome', 'leadership.primaryName'); aplicarTexto(document, updated, 'responsavelCargo', 'leadership.primaryRole'); aplicarTexto(document, updated, 'responsavelOab', 'leadership.primaryOab'); aplicarTexto(document, updated, 'responsavelFotoAlt', 'leadership.primaryImageAlt');
  aplicarTexto(document, updated, 'responsavelSecundarioNome', 'leadership.secondaryName'); aplicarTexto(document, updated, 'responsavelSecundarioCargo', 'leadership.secondaryRole'); aplicarTexto(document, updated, 'responsavelSecundarioOab', 'leadership.secondaryOab'); aplicarTexto(document, updated, 'responsavelSecundarioFotoAlt', 'leadership.secondaryImageAlt');
  aplicarTexto(document, updated, 'equipeTitulo', 'team.title'); aplicarRich(document, updated, 'equipe', 'team.body'); aplicarTexto(document, updated, 'seoTitulo', 'seo.title'); aplicarTexto(document, updated, 'seoDescricao', 'seo.description');
  const saved = await wixData.update(COL.PAGINAS_INSTITUCIONAIS, updated, { suppressAuth: true });
  await registrarAdminLog(tokenOk, 'site.conteudo.salvar', 'PaginasInstitucionais', saved._id, { pagina: siteEditorInstitutionalPath(saved), titulo: text(saved.titulo), revisaoAnterior: currentRevision, revisaoAtual: siteEditorRevision(saved) });
  return { ok: true, mensagem: 'Página institucional salva na fonte editorial.', page: mapInstitutionalSiteEditorDocument(saved) };
}

export async function obterConteudoSiteAdminApi(tokenRecebido = '') {
  try {
    const tokenOk = await validarAdminToken(tokenRecebido, ADMIN_PERMISSIONS.SITE_CONTEUDO_VER);
    if (!tokenOk.ok) return tokenOk;
    const [homeItems, institutionalItems] = await Promise.all([listarDestaquesHomeSiteEditor(), listarPaginasInstitucionaisSiteEditor()]);
    const homePages = homeItems.map((item, index) => mapHomeSiteEditorDocument(item, index, homeItems.length));
    const pages = [...homePages, ...institutionalItems.map(mapInstitutionalSiteEditorDocument)];
    if (!pages.length) return { ok: false, codigo: 'CONTEUDO_NAO_ENCONTRADO', mensagem: 'Nenhum conteúdo editorial foi encontrado.' };
    return { ok: true, workspace: { pages, capabilities: { remoteDraft: true, publish: false, mediaUpload: true, homeBannerManagement: true, maxActiveHomeBanners: HOME_BANNERS_MAX_ACTIVE }, discoveryNote: 'O editor está conectado à Home e às páginas institucionais reais. A Home aceita até 5 banners ativos, com imagens enviadas ao Media Manager. Salvar atualiza o CMS; o deploy do novo site permanece separado.' } };
  } catch (err) {
    console.error('Erro em obterConteudoSiteAdminApi:', err);
    return { ok: false, codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível carregar o conteúdo editorial do site.' };
  }
}

export async function salvarConteudoSiteAdminApi(
  payload = {},
  tokenRecebido = ''
) {
  try {
    const tokenOk = await validarAdminToken(
      tokenRecebido,
      ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR
    );

    if (!tokenOk.ok) return tokenOk;

    const document = payload.document || {};
    const pageId = text(payload.pageId || document.id);
    const institutionalMatch = pageId.match(/^institutional:(.+)$/);
    if (institutionalMatch && institutionalMatch[1]) {
      return salvarPaginaInstitucionalSiteEditor(payload, document, institutionalMatch[1], tokenOk);
    }
    const match = pageId.match(/^home:(.+)$/);

    if (!match || !match[1]) {
      return {
        ok: false,
        codigo: 'PAGINA_NAO_SUPORTADA',
        mensagem: 'Esta página ainda não está disponível para edição remota.',
      };
    }

    const current = await obterDestaqueHomeSiteEditorPorId(match[1]);

    if (!current || !current._id) {
      return {
        ok: false,
        codigo: 'CONTEUDO_NAO_ENCONTRADO',
        mensagem: 'O destaque da Home não foi encontrado.',
      };
    }

    const currentRevision = siteEditorRevision(current);
    const sourceRevision = text(
      payload.sourceRevision || document.sourceRevision
    );

    if (sourceRevision && sourceRevision !== currentRevision) {
      return {
        ok: false,
        codigo: 'CONFLITO_REVISAO',
        mensagem:
          'O conteúdo foi alterado por outra sessão. Recarregue o editor antes de salvar novamente.',
        sourceRevision: currentRevision,
      };
    }

    const validationError = validarDocumentoHomeSiteEditor(document);

    if (validationError) {
      return {
        ok: false,
        codigo: 'DADOS_INVALIDOS',
        mensagem: validationError,
      };
    }

    const section = siteEditorSection(document, 'hero');
    const title = siteEditorField(document, 'hero.title');
    const body = siteEditorField(document, 'hero.body');
    const desktopImage = siteEditorField(document, 'hero.desktopImage');
    const mobileImage = siteEditorField(document, 'hero.mobileImage');
    const imageAlt = siteEditorField(document, 'hero.imageAlt');
    const cta = siteEditorField(document, 'hero.cta');
    const nextActive = section?.visible === true;

    if (nextActive && current.ativo !== true) {
      const activeCount = await validarLimiteBannersAtivos(current._id);
      if (activeCount >= HOME_BANNERS_MAX_ACTIVE) {
        return {
          ok: false,
          codigo: 'LIMITE_BANNERS_ATIVOS',
          mensagem: `A Home pode exibir no máximo ${HOME_BANNERS_MAX_ACTIVE} banners ativos ao mesmo tempo.`,
        };
      }
    }

    const updated = {
      ...current,
      titulo: text(title.value),
      chamada: text(body?.value),
      imagemDesktop: text(desktopImage?.url),
      imagemMobile: text(mobileImage?.url),
      imagemAlt: text(imageAlt?.value),
      rotuloCta: text(cta?.text),
      linkCta: text(cta?.href),
      ativo: nextActive,
    };

    const saved = await wixData.update(COL.DESTAQUES_HOME, updated, {
      suppressAuth: true,
    });

    await registrarAdminLog(
      tokenOk,
      'site.conteudo.salvar',
      'DestaquesHome',
      saved._id,
      {
        pagina: '/',
        titulo: text(saved.titulo),
        revisaoAnterior: currentRevision,
        revisaoAtual: siteEditorRevision(saved),
      }
    );

    return {
      ok: true,
      mensagem: 'Conteúdo da Home salvo na fonte editorial.',
      page: mapHomeSiteEditorDocument(saved),
    };
  } catch (err) {
    console.error('Erro em salvarConteudoSiteAdminApi:', err);
    return {
      ok: false,
      codigo: 'ERRO_INTERNO',
      mensagem: 'Não foi possível salvar o conteúdo editorial do site.',
    };
  }
}

async function getAdminConfig() {
  const [emailsRaw, password, token] = await Promise.all([
    getSecret(ADMIN_SECRETS.EMAILS),
    getSecret(ADMIN_SECRETS.PASSWORD),
    getSecret(ADMIN_SECRETS.TOKEN),
  ]);

  const emails = text(emailsRaw)
    .split(/[;,\n]/)
    .map((email) => text(email).toLowerCase())
    .filter(Boolean);

  return {
    emails,
    password: text(password),
    token: text(token),
  };
}

async function validarAdminToken(tokenRecebido, permissaoObrigatoria = '') {
  const token = text(tokenRecebido);

  if (!token) {
    return {
      ok: false,
      codigo: 'ADMIN_NAO_AUTORIZADO',
      mensagem: 'Sessão administrativa inválida ou expirada.',
    };
  }

  const config = await getAdminConfig();

  if (config.token && token === config.token) {
    return validarPermissao({
      ok: true,
      legacy: true,
      usuario: {
        _id: LEGACY_ADMIN_ID,
        nome: 'Administrador',
        email: (config.emails || [])[0] || 'admin',
        ativo: true,
        permissoes: ALL_ADMIN_PERMISSIONS,
        legacy: true,
      },
      permissoes: ALL_ADMIN_PERMISSIONS,
    }, permissaoObrigatoria);
  }

  const sessao = await buscarSessaoAdminPorToken(token);

  if (!sessao || !sessao._id) {
    return {
      ok: false,
      codigo: 'ADMIN_NAO_AUTORIZADO',
      mensagem: 'Sessão administrativa inválida ou expirada.',
    };
  }

  const expiraEm = parseDateTime(sessao.expiraEm);

  if (!expiraEm || expiraEm.getTime() <= Date.now()) {
    await encerrarSessaoSemFalhar(sessao);
    return {
      ok: false,
      codigo: 'SESSAO_EXPIRADA',
      mensagem: 'Sua sessão expirou. Entre novamente.',
    };
  }

  const usuario = await wixData.get(COL.ADMIN_USUARIOS, sessao.usuarioId, {
    suppressAuth: true,
  });

  if (!usuario || !usuario._id || usuario.ativo === false) {
    return {
      ok: false,
      codigo: 'ADMIN_NAO_AUTORIZADO',
      mensagem: 'Usuário inativo ou não autorizado.',
    };
  }

  const permissoes = normalizarPermissoesArmazenadas(usuario.permissoesJson || usuario.permissoes);

  return validarPermissao({
    ok: true,
    legacy: false,
    sessao,
    usuario: {
      ...usuario,
      permissoes,
    },
    permissoes,
  }, permissaoObrigatoria);
}

function validarPermissao(auth, permissaoObrigatoria = '') {
  const permissao = text(permissaoObrigatoria);

  if (!permissao) return auth;

  if (auth.legacy === true || hasPermission(auth.permissoes, permissao)) {
    return auth;
  }

  return {
    ok: false,
    codigo: 'SEM_PERMISSAO',
    mensagem: 'Você não tem permissão para executar esta ação.',
  };
}



async function tentarRepararLoginComCredencialLegacy(usuario, email, senha) {
  try {
    const config = await getAdminConfig();
    const emailAutorizado = config.emails.includes(normalizeEmail(email));
    const senhaCorreta = text(senha) && text(senha) === config.password;

    if (!emailAutorizado || !senhaCorreta || !config.token) {
      return null;
    }

    const agora = new Date();
    const salt = gerarTokenSeguro(18);
    const senhaHash = await hashSenhaAdmin(senha, salt);
    const permissoesAtuais = normalizarPermissoesArmazenadas(usuario.permissoesJson || usuario.permissoes || []);
    const permissoes = permissoesAtuais.length ? permissoesAtuais : ALL_ADMIN_PERMISSIONS;

    const usuarioAtualizado = await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...usuario,
        ativo: true,
        senhaSalt: salt,
        senhaHash,
        permissoesJson: serializarPermissoes(permissoes),
        precisaTrocarSenha: true,
        emailVerificado: true,
        precisaVerificarEmail: false,
        emailVerificadoEm: usuario.emailVerificadoEm || agora,
        ultimoAcessoEm: agora,
        atualizadoEm: agora,
        atualizadoPor: 'auto-reparo-legacy',
      },
      { suppressAuth: true }
    );

    const sessao = await criarSessaoAdmin(usuarioAtualizado);

    await registrarAdminLog(
      {
        ok: true,
        legacy: true,
        usuario: {
          _id: LEGACY_ADMIN_ID,
          email,
          permissoes: ALL_ADMIN_PERMISSIONS,
        },
      },
      'usuarios.reparar_senha_legacy',
      'AdminUsuarios',
      usuarioAtualizado._id,
      { email }
    );

    return {
      ok: true,
      mensagem: 'Login administrativo autorizado.',
      token: sessao.token,
      admin: mapAdminUsuarioSeguro(usuarioAtualizado),
      aviso: 'A senha do usuário administrativo foi sincronizada com a configuração atual.',
    };
  } catch (err) {
    console.warn('Não foi possível reparar login administrativo com credencial legacy.', err);
    return null;
  }
}


async function salvarEnviarConviteUsuarioAdmin({ usuarioExistente, email, cargoFuncao = '', ativo = true, permissoes = [], auth, origem = 'criar' }) {
  const conviteToken = gerarTokenSeguro(42);
  const conviteHash = await hashConviteAdmin(conviteToken);
  const agora = new Date();
  const conviteExpiraEm = new Date(agora.getTime() + ADMIN_INVITE_TTL_MS);

  let salvo;

  if (usuarioExistente && usuarioExistente._id) {
    salvo = await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...usuarioExistente,
        title: `${usuarioExistente.nome || 'Convite pendente'} - ${email}`,
        email,
        cargoFuncao: cargoFuncao || usuarioExistente.cargoFuncao || '',
        ativo,
        permissoesJson: serializarPermissoes(permissoes),
        cadastroConcluido: false,
        statusConvite: 'pendente',
        conviteHash,
        conviteExpiraEm,
        conviteEnviadoEm: null,
        conviteAceitoEm: null,
        atualizadoEm: agora,
        atualizadoPor: auth?.usuario?.email || '',
      },
      { suppressAuth: true }
    );
  } else {
    salvo = await wixData.insert(
      COL.ADMIN_USUARIOS,
      {
        title: `Convite pendente - ${email}`,
        nome: '',
        email,
        cargoFuncao: cargoFuncao || '',
        ativo,
        permissoesJson: serializarPermissoes(permissoes),
        cpfHash: '',
        cpfCadastrado: false,
        cpfAtualizadoEm: null,
        emailVerificado: false,
        precisaVerificarEmail: false,
        emailVerificadoEm: null,
        codigoEmailHash: '',
        codigoEmailExpiraEm: null,
        codigoEmailTentativas: 0,
        codigoEmailBloqueadoAte: null,
        senhaSalt: '',
        senhaHash: '',
        precisaTrocarSenha: false,
        senhaAlteradaEm: null,
        cadastroConcluido: false,
        statusConvite: 'pendente',
        conviteHash,
        conviteExpiraEm,
        conviteEnviadoEm: null,
        conviteAceitoEm: null,
        ultimoAcessoEm: null,
        criadoEm: agora,
        atualizadoEm: agora,
        criadoPor: auth?.usuario?.email || '',
        atualizadoPor: auth?.usuario?.email || '',
      },
      { suppressAuth: true }
    );
  }

  const conviteUrl = await montarUrlConviteAdmin(conviteToken);
  const envio = await enviarConviteEmailAdmin({ usuario: salvo, conviteUrl, expiraEm: conviteExpiraEm, origem });

  if (envio.ok) {
    salvo = await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...salvo,
        conviteEnviadoEm: new Date(),
        atualizadoEm: new Date(),
        atualizadoPor: origem === 'reenviar' ? 'reenviar-convite' : auth?.usuario?.email || '',
      },
      { suppressAuth: true }
    );
  }

  return { usuario: salvo, conviteUrl, envio };
}

async function buscarUsuarioPorConviteValido(conviteToken) {
  const token = text(conviteToken);

  if (!token) {
    return {
      ok: false,
      codigo: 'CONVITE_INVALIDO',
      mensagem: 'Convite inválido ou incompleto.',
    };
  }

  const conviteHash = await hashConviteAdmin(token);
  let usuario = null;

  try {
    const result = await wixData
      .query(COL.ADMIN_USUARIOS)
      .eq('conviteHash', conviteHash)
      .limit(1)
      .find({ suppressAuth: true });

    usuario = (result.items || [])[0] || null;
  } catch (err) {
    console.warn('Não foi possível consultar convite administrativo.', err);
  }

  if (!usuario || !usuario._id) {
    return {
      ok: false,
      codigo: 'CONVITE_INVALIDO',
      mensagem: 'Convite inválido ou expirado.',
    };
  }

  if (usuario.cadastroConcluido === true || text(usuario.statusConvite) === 'aceito') {
    return {
      ok: false,
      codigo: 'CONVITE_JA_UTILIZADO',
      mensagem: 'Este convite já foi utilizado.',
    };
  }

  const expiraEm = parseDateTime(usuario.conviteExpiraEm);

  if (!expiraEm || expiraEm.getTime() <= Date.now()) {
    await atualizarUsuarioSemFalhar(usuario, {
      statusConvite: 'expirado',
      atualizadoEm: new Date(),
      atualizadoPor: 'convite-expirado',
    });

    return {
      ok: false,
      codigo: 'CONVITE_EXPIRADO',
      mensagem: 'Este convite expirou. Solicite um novo convite à OAB.',
    };
  }

  return { ok: true, usuario };
}

async function hashConviteAdmin(conviteToken) {
  const pepper = await getEmailCodePepper();
  return sha256(`admin-invite|${text(conviteToken)}|${pepper}`);
}

async function montarUrlConviteAdmin(conviteToken) {
  let baseUrl = '';
  try {
    baseUrl = text(await getSecret('OAB_CENTRAL_URL'));
  } catch (err) {
    baseUrl = '';
  }
  if (!baseUrl) baseUrl = 'https://central.juizdefora-oabmg.org.br';
  baseUrl = baseUrl.replace(/\/+$/, '');
  return `${baseUrl}/admin/convite?token=${encodeURIComponent(text(conviteToken))}`;
}

async function enviarConviteEmailAdmin({ usuario, conviteUrl, expiraEm, origem = 'criar' }) {
  try {
    const config = await carregarConfigInfobipAdmin();
    const email = normalizeEmail(usuario.email);
    const expira = parseDateTime(expiraEm);
    const expiraLabel = expira ? formatDateTimePtBr(expira) : 'em breve';
    const subject = 'Convite de acesso — Central OAB Juiz de Fora';
    const textBody = `Olá.\n\nVocê recebeu um convite para acessar o painel administrativo da Central de Agendamento Prisional da OAB Juiz de Fora.\n\nConclua seu cadastro pelo link abaixo:\n${conviteUrl}\n\nO convite expira em ${expiraLabel}.\n\nSe você não esperava este convite, ignore esta mensagem.`;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;color:#2f2a24;line-height:1.5">
        <p>Olá.</p>
        <p>Você recebeu um convite para acessar o painel administrativo da <strong>Central de Agendamento Prisional da OAB Juiz de Fora</strong>.</p>
        <p style="margin:18px 0">
          <a href="${escapeHtml(conviteUrl)}" style="display:inline-block;background:#2f2a24;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Concluir cadastro</a>
        </p>
        <p>O convite expira em <strong>${escapeHtml(expiraLabel)}</strong>.</p>
        <p style="font-size:12px;color:#6b6257">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${escapeHtml(conviteUrl)}</p>
        <p style="font-size:12px;color:#6b6257">Se você não esperava este convite, ignore esta mensagem.</p>
      </div>`;

    const envio = await enviarEmailInfobipAdmin({ config, to: email, subject, textBody, htmlBody });

    if (!envio.ok) {
      return {
        ok: false,
        codigo: 'EMAIL_CONVITE_NAO_ENVIADO',
        mensagem: envio.mensagem || 'Não foi possível enviar o convite por e-mail.',
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      codigo: 'CONFIG_INFOBIP_INCOMPLETA',
      mensagem: 'Não foi possível enviar o convite. Verifique a configuração de e-mail.',
    };
  }
}

function formatDateTimePtBr(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function usuarioPrecisaVerificarEmail(usuario = {}) {
  // Compatibilidade: usuários antigos sem os novos campos são tratados como já verificados.
  if (usuario.precisaVerificarEmail === true) return true;
  if (usuario.emailVerificado === false) return true;
  return false;
}

async function buscarAdminUsuarioPorCpfHash(cpfHash, ignorarUsuarioId = '') {
  const hash = text(cpfHash);
  if (!hash) return null;

  try {
    const result = await wixData
      .query(COL.ADMIN_USUARIOS)
      .eq('cpfHash', hash)
      .limit(1)
      .find({ suppressAuth: true });

    const item = (result.items || [])[0] || null;
    if (!item) return null;
    if (ignorarUsuarioId && item._id === ignorarUsuarioId) return null;
    return item;
  } catch (err) {
    console.warn('Não foi possível consultar CPF hash em AdminUsuarios.', err);
    return null;
  }
}

async function validarCodigoEmailUsuario(usuario, codigo) {
  const agoraMs = Date.now();
  const bloqueadoAte = parseDateTime(usuario.codigoEmailBloqueadoAte);

  if (bloqueadoAte && bloqueadoAte.getTime() > agoraMs) {
    return {
      ok: false,
      codigo: 'CODIGO_BLOQUEADO',
      mensagem: 'Muitas tentativas incorretas. Aguarde alguns minutos e solicite um novo código.',
    };
  }

  const expiraEm = parseDateTime(usuario.codigoEmailExpiraEm);

  if (!usuario.codigoEmailHash || !expiraEm || expiraEm.getTime() <= agoraMs) {
    return {
      ok: false,
      codigo: 'CODIGO_EXPIRADO',
      mensagem: 'O código expirou. Solicite um novo código de validação.',
    };
  }

  const calculado = await hashCodigoEmailAdmin(codigo, usuario.email, usuario._id);

  if (!timingSafeEqualString(calculado, usuario.codigoEmailHash)) {
    const tentativas = Number(usuario.codigoEmailTentativas || 0) + 1;
    const patch = {
      ...usuario,
      codigoEmailTentativas: tentativas,
      atualizadoEm: new Date(),
    };

    if (tentativas >= EMAIL_CODE_MAX_TENTATIVAS) {
      patch.codigoEmailBloqueadoAte = new Date(Date.now() + EMAIL_CODE_BLOQUEIO_MS);
    }

    await atualizarUsuarioSemFalhar(usuario, patch);

    return {
      ok: false,
      codigo: tentativas >= EMAIL_CODE_MAX_TENTATIVAS ? 'CODIGO_BLOQUEADO' : 'CODIGO_INVALIDO',
      mensagem: tentativas >= EMAIL_CODE_MAX_TENTATIVAS
        ? 'Muitas tentativas incorretas. Aguarde alguns minutos e solicite um novo código.'
        : 'Código inválido. Confira o número enviado por e-mail.',
    };
  }

  return { ok: true };
}

async function gerarEnviarCodigoEmailUsuario(usuario, origem = 'login') {
  const bloqueadoAte = parseDateTime(usuario.codigoEmailBloqueadoAte);

  if (bloqueadoAte && bloqueadoAte.getTime() > Date.now()) {
    return {
      ok: false,
      codigo: 'CODIGO_BLOQUEADO',
      mensagem: 'Aguarde alguns minutos antes de solicitar um novo código.',
    };
  }

  const codigo = gerarCodigoEmail();
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + EMAIL_CODE_TTL_MS);
  const codigoEmailHash = await hashCodigoEmailAdmin(codigo, usuario.email, usuario._id);

  const atualizado = await wixData.update(
    COL.ADMIN_USUARIOS,
    {
      ...usuario,
      codigoEmailHash,
      codigoEmailExpiraEm: expiraEm,
      codigoEmailTentativas: 0,
      codigoEmailBloqueadoAte: null,
      precisaVerificarEmail: true,
      emailVerificado: false,
      atualizadoEm: agora,
      atualizadoPor: origem === 'reenviar' ? 'reenviar-codigo-email' : 'login-validacao-email',
    },
    { suppressAuth: true }
  );

  const envio = await enviarCodigoEmailAdmin({
    usuario: atualizado,
    codigo,
    expiraEm,
  });

  if (!envio.ok) {
    return envio;
  }

  return {
    ok: true,
    usuario: atualizado,
  };
}

function gerarCodigoEmail() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

async function hashCodigoEmailAdmin(codigo, email, usuarioId) {
  const pepper = await getEmailCodePepper();
  return sha256(`email-code|${text(usuarioId)}|${normalizeEmail(email)}|${digitsOnly(codigo)}|${pepper}`);
}

async function hashCpfAdmin(cpfDigits) {
  const cpf = digitsOnly(cpfDigits);
  const pepper = await getCpfPepper();
  return sha256(`cpf|${cpf}|${pepper}`);
}

async function getCpfPepper() {
  try {
    const pepper = await getSecret('OAB_CPF_HASH_PEPPER');
    if (text(pepper)) return text(pepper);
  } catch (err) {
    // Secret opcional para não quebrar publicação antes da configuração.
  }
  return getPasswordPepper();
}

async function getEmailCodePepper() {
  try {
    const pepper = await getSecret('OAB_ADMIN_EMAIL_CODE_PEPPER');
    if (text(pepper)) return text(pepper);
  } catch (err) {
    // Secret opcional para não quebrar publicação antes da configuração.
  }
  return getPasswordPepper();
}

async function enviarCodigoEmailAdmin({ usuario, codigo, expiraEm }) {
  try {
    const config = await carregarConfigInfobipAdmin();
    const nome = text(usuario.nome || 'Usuário');
    const email = normalizeEmail(usuario.email);
    const minutos = Math.max(1, Math.round((expiraEm.getTime() - Date.now()) / 60000));
    const subject = 'Código de validação — Central OAB Juiz de Fora';
    const textBody = `Olá, ${nome}.\n\nSeu código de validação para acesso à Central de Agendamento Prisional é: ${codigo}\n\nEle expira em aproximadamente ${minutos} minutos.\n\nSe você não solicitou este acesso, ignore esta mensagem.`;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;color:#2f2a24;line-height:1.5">
        <p>Olá, ${escapeHtml(nome)}.</p>
        <p>Seu código de validação para acesso à <strong>Central de Agendamento Prisional da OAB Juiz de Fora</strong> é:</p>
        <p style="font-size:24px;letter-spacing:4px;font-weight:700;margin:16px 0;color:#1f2937">${codigo}</p>
        <p>Ele expira em aproximadamente ${minutos} minutos.</p>
        <p style="font-size:12px;color:#6b6257">Se você não solicitou este acesso, ignore esta mensagem.</p>
      </div>`;

    const envio = await enviarEmailInfobipAdmin({
      config,
      to: email,
      subject,
      textBody,
      htmlBody,
    });

    if (!envio.ok) {
      return {
        ok: false,
        codigo: 'EMAIL_CODIGO_NAO_ENVIADO',
        mensagem: envio.mensagem || 'Não foi possível enviar o código de validação por e-mail.',
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      codigo: 'CONFIG_INFOBIP_INCOMPLETA',
      mensagem: 'Não foi possível enviar o código de validação. Verifique a configuração de e-mail.',
    };
  }
}

async function carregarConfigInfobipAdmin() {
  const [baseUrlRaw, apiKeyRaw, fromEmailRaw, fromNameRaw] = await Promise.all([
    getRequiredSecretAdmin('INFOBIP_BASE_URL'),
    getRequiredSecretAdmin('INFOBIP_API_KEY'),
    getRequiredSecretAdmin('INFOBIP_FROM_EMAIL'),
    getRequiredSecretAdmin('INFOBIP_FROM_NAME'),
  ]);

  const baseUrl = normalizarBaseUrlAdmin(baseUrlRaw);
  const apiKey = text(apiKeyRaw);
  const fromEmail = normalizeEmail(fromEmailRaw);
  const fromName = text(fromNameRaw) || 'OAB Juiz de Fora';

  if (!baseUrl || !apiKey || !isValidEmail(fromEmail)) {
    throw new Error('Configuração Infobip inválida.');
  }

  return { baseUrl, apiKey, fromEmail, fromName };
}

async function getRequiredSecretAdmin(secretName) {
  const value = await getSecret(secretName);
  if (!text(value)) throw new Error(`Secret ${secretName} vazio.`);
  return value;
}

function normalizarBaseUrlAdmin(value) {
  let url = text(value);
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, '');
}

function montarAuthorizationHeaderAdmin(apiKey) {
  const key = text(apiKey);
  if (/^(App|Basic|Bearer)\s+/i.test(key)) return key;
  return `App ${key}`;
}

function formatarRemetenteAdmin(nome, email) {
  const cleanName = text(nome).replace(/[<>\"]/g, '');
  const cleanEmail = normalizeEmail(email);
  if (!cleanName) return cleanEmail;
  return `${cleanName} <${cleanEmail}>`;
}

function escapeMultipartNameAdmin(value) {
  return text(value).replace(/"/g, '');
}

function montarMultipartFormDataAdmin(fields = {}) {
  const boundary = `----wix-admin-email-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const parts = [];

  Object.keys(fields).forEach((name) => {
    const value = fields[name];
    if (value === null || value === undefined) return;
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="${escapeMultipartNameAdmin(name)}"\r\n\r\n`);
    parts.push(String(value));
    parts.push('\r\n');
  });

  parts.push(`--${boundary}--\r\n`);

  return { boundary, body: parts.join('') };
}

async function enviarEmailInfobipAdmin({ config, to, subject, textBody, htmlBody }) {
  if (!isValidEmail(to)) {
    return { ok: false, mensagem: 'E-mail de destino inválido.' };
  }

  const endpoint = `${config.baseUrl}${INFOBIP_EMAIL_ENDPOINT}`;
  const multipart = montarMultipartFormDataAdmin({
    from: formatarRemetenteAdmin(config.fromName, config.fromEmail),
    to: JSON.stringify({ to }),
    subject,
    text: textBody,
    html: htmlBody,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'post',
      headers: {
        Authorization: montarAuthorizationHeaderAdmin(config.apiKey),
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
      },
      body: multipart.body,
    });

    const raw = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        mensagem: `Infobip retornou erro ${response.status}: ${text(raw).slice(0, 700)}`,
      };
    }

    return { ok: true, statusCode: response.status };
  } catch (err) {
    return { ok: false, mensagem: normalizarMensagemErroApi(err) };
  }
}


function normalizarMensagemErroApi(err) {
  if (!err) return 'Erro desconhecido.';
  if (typeof err === 'string') return err;
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
  try {
    return JSON.stringify(err);
  } catch (_) {
    return String(err);
  }
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function digitsOnly(value) {
  return text(value).replace(/\D/g, '');
}

function isValidCpf(value) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += Number(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  const digito1 = resto === 10 ? 0 : resto;
  if (digito1 !== Number(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  const digito2 = resto === 10 ? 0 : resto;
  return digito2 === Number(cpf[10]);
}

async function buscarAdminUsuarioPorEmail(email) {
  const value = normalizeEmail(email);

  if (!value) return null;

  try {
    const result = await wixData
      .query(COL.ADMIN_USUARIOS)
      .eq('email', value)
      .limit(1)
      .find({ suppressAuth: true });

    return (result.items || [])[0] || null;
  } catch (err) {
    // Coleção ainda não criada: mantém fallback por secrets funcionando.
    console.warn('Não foi possível consultar AdminUsuarios. Verifique se a coleção existe.', err);
    return null;
  }
}

async function buscarSessaoAdminPorToken(token) {
  try {
    const tokenHash = await hashTokenAdmin(token);
    const result = await wixData
      .query(COL.ADMIN_SESSOES)
      .eq('tokenHash', tokenHash)
      .eq('ativa', true)
      .limit(1)
      .find({ suppressAuth: true });

    return (result.items || [])[0] || null;
  } catch (err) {
    console.warn('Não foi possível consultar AdminSessoes.', err);
    return null;
  }
}

async function criarSessaoAdmin(usuario) {
  const token = gerarTokenSeguro(48);
  const tokenHash = await hashTokenAdmin(token);
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + ADMIN_SESSION_TTL_MS);

  await wixData.insert(
    COL.ADMIN_SESSOES,
    {
      title: `${usuario.email} - ${agora.toISOString()}`,
      usuarioId: usuario._id,
      usuarioEmail: usuario.email,
      tokenHash,
      ativa: true,
      criadoEm: agora,
      expiraEm,
      encerradoEm: null,
    },
    { suppressAuth: true }
  );

  return {
    token,
    expiraEm,
  };
}

async function encerrarSessaoSemFalhar(sessao) {
  try {
    await wixData.update(
      COL.ADMIN_SESSOES,
      {
        ...sessao,
        ativa: false,
        encerradoEm: new Date(),
      },
      { suppressAuth: true }
    );
  } catch (err) {
    console.warn('Não foi possível encerrar sessão administrativa.', err);
  }
}

async function encerrarSessoesUsuario(usuarioId) {
  try {
    const result = await wixData
      .query(COL.ADMIN_SESSOES)
      .eq('usuarioId', usuarioId)
      .eq('ativa', true)
      .limit(100)
      .find({ suppressAuth: true });

    await Promise.all(
      (result.items || []).map((sessao) =>
        wixData.update(
          COL.ADMIN_SESSOES,
          {
            ...sessao,
            ativa: false,
            encerradoEm: new Date(),
          },
          { suppressAuth: true }
        )
      )
    );
  } catch (err) {
    console.warn('Não foi possível encerrar sessões do usuário.', err);
  }
}

async function validarSenhaUsuario(usuario, senha) {
  const salt = text(usuario.senhaSalt);
  const senhaHash = text(usuario.senhaHash);

  if (!salt || !senhaHash || !senha) return false;

  const calculado = await hashSenhaAdmin(senha, salt);

  return timingSafeEqualString(calculado, senhaHash);
}

async function hashSenhaAdmin(senha, salt) {
  const pepper = await getPasswordPepper();
  return sha256(`${salt}|${text(senha)}|${pepper}`);
}

async function hashTokenAdmin(token) {
  const pepper = await getPasswordPepper();
  return sha256(`session|${text(token)}|${pepper}`);
}

async function getPasswordPepper() {
  try {
    const pepper = await getSecret('OAB_ADMIN_PASSWORD_PEPPER');
    if (text(pepper)) return text(pepper);
  } catch (err) {
    // Secret opcional nesta primeira rodada.
  }

  const config = await getAdminConfig();
  return config.token || config.password || 'oab-admin-default-pepper';
}

function extrairPermissoesBrutas(value) {
  let raw = value;
  let version = 1;

  if (typeof raw === 'string') {
    const parsed = tryParseJson(raw);
    raw = parsed !== null ? parsed : raw.split(/[;,\n]/);
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const permissions = Array.isArray(raw.permissions)
      ? raw.permissions
      : Array.isArray(raw.permissoes)
        ? raw.permissoes
        : null;

    if (permissions) {
      const parsedVersion = Number(raw.version || raw.versao || raw.schemaVersion);
      version = Number.isFinite(parsedVersion) && parsedVersion > 0
        ? Math.floor(parsedVersion)
        : 1;
      raw = permissions;
    } else {
      raw = Object.keys(raw).filter((key) => raw[key] === true);
    }
  }

  return {
    raw: Array.isArray(raw) ? raw : [],
    version,
  };
}

function aplicarDependenciasPermissoes(permissoes = []) {
  const next = new Set(permissoes);

  if (
    next.has(ADMIN_PERMISSIONS.FORMULARIOS_OPERAR) ||
    next.has(ADMIN_PERMISSIONS.FORMULARIOS_ANEXOS)
  ) {
    next.add(ADMIN_PERMISSIONS.FORMULARIOS_VER);
  }

  if (next.has(ADMIN_PERMISSIONS.AGENDAMENTOS_CONFIGURAR)) {
    next.add(ADMIN_PERMISSIONS.AGENDAMENTOS_VER);
  }

  if (
    next.has(ADMIN_PERMISSIONS.EVENTOS_FINANCEIRO) ||
    next.has(ADMIN_PERMISSIONS.EVENTOS_PRESENCA) ||
    next.has(ADMIN_PERMISSIONS.EVENTOS_CERTIFICADOS)
  ) {
    next.add(ADMIN_PERMISSIONS.EVENTOS_VER);
  }

  if (next.has(ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR)) {
    next.add(ADMIN_PERMISSIONS.SITE_CONTEUDO_VER);
  }

  return Array.from(next).sort();
}

function normalizarPermissoes(value) {
  const { raw } = extrairPermissoesBrutas(value);
  const permitidas = new Set(ALL_ADMIN_PERMISSIONS);
  const unique = new Set();

  raw.forEach((item) => {
    const permissao = text(item);
    if (permitidas.has(permissao)) unique.add(permissao);
  });

  return aplicarDependenciasPermissoes(Array.from(unique));
}

function normalizarPermissoesArmazenadas(value) {
  const { raw, version } = extrairPermissoesBrutas(value);
  const permissoes = normalizarPermissoes(raw);
  const next = new Set(permissoes);

  if (version < 2) {
    const possuiaAcessoLegadoAFormularios =
      next.has(ADMIN_PERMISSIONS.FORMULARIOS_VER) ||
      next.has(ADMIN_PERMISSIONS.USUARIOS_VER);

    if (possuiaAcessoLegadoAFormularios) {
      next.add(ADMIN_PERMISSIONS.FORMULARIOS_VER);

      const perfilDedicadoLegado =
        permissoes.length === 1 &&
        permissoes[0] === ADMIN_PERMISSIONS.FORMULARIOS_VER;
      const possuiaPermissaoOperacional = permissoes.some((permissao) =>
        permissao !== ADMIN_PERMISSIONS.FORMULARIOS_VER &&
        !permissao.endsWith('.ver')
      );

      if (perfilDedicadoLegado || possuiaPermissaoOperacional) {
        next.add(ADMIN_PERMISSIONS.FORMULARIOS_OPERAR);
        next.add(ADMIN_PERMISSIONS.FORMULARIOS_ANEXOS);
      }
    }
  }

  if (version < 3) {
    const possuiaGestaoEstruturalAgendamentos = [
      ADMIN_PERMISSIONS.AGENDAMENTOS_CANCELAR,
      ADMIN_PERMISSIONS.AGENDAMENTOS_REMARCAR,
      ADMIN_PERMISSIONS.UNIDADES_CRIAR,
      ADMIN_PERMISSIONS.UNIDADES_EDITAR,
      ADMIN_PERMISSIONS.UNIDADES_ATIVAR,
      ADMIN_PERMISSIONS.BLOQUEIOS_CRIAR,
      ADMIN_PERMISSIONS.BLOQUEIOS_EDITAR,
      ADMIN_PERMISSIONS.BLOQUEIOS_REMOVER,
      ADMIN_PERMISSIONS.CONFIG_ATIVAR_ENVIOS,
      ADMIN_PERMISSIONS.USUARIOS_EDITAR,
    ].some((permissao) => next.has(permissao));

    if (possuiaGestaoEstruturalAgendamentos) {
      next.add(ADMIN_PERMISSIONS.AGENDAMENTOS_CONFIGURAR);
    }
  }

  if (version < 4 && next.has(ADMIN_PERMISSIONS.USUARIOS_EDITAR)) {
    next.add(ADMIN_PERMISSIONS.EVENTOS_VER);
    next.add(ADMIN_PERMISSIONS.EVENTOS_FINANCEIRO);
  }

  if (version < 5 && next.has(ADMIN_PERMISSIONS.USUARIOS_EDITAR)) {
    next.add(ADMIN_PERMISSIONS.EVENTOS_PRESENCA);
    next.add(ADMIN_PERMISSIONS.EVENTOS_CERTIFICADOS);
  }

  if (version < 6 && next.has(ADMIN_PERMISSIONS.USUARIOS_EDITAR)) {
    next.add(ADMIN_PERMISSIONS.SITE_CONTEUDO_VER);
    next.add(ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR);
  }

  return aplicarDependenciasPermissoes(Array.from(next));
}

function serializarPermissoes(permissoes = []) {
  return JSON.stringify({
    version: ADMIN_PERMISSIONS_SCHEMA_VERSION,
    permissions: normalizarPermissoes(permissoes),
  });
}

function hasPermission(permissoes = [], permissao) {
  if (!permissao) return true;
  if (!Array.isArray(permissoes)) return false;
  return permissoes.includes(permissao);
}

function listarPermissoesDisponiveis() {
  return [
    {
      grupo: 'Agendamentos',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.AGENDAMENTOS_VER, label: 'Ver agendamentos' },
        { chave: ADMIN_PERMISSIONS.AGENDAMENTOS_CANCELAR, label: 'Cancelar agendamentos' },
        { chave: ADMIN_PERMISSIONS.AGENDAMENTOS_REMARCAR, label: 'Remarcar agendamentos' },
        { chave: ADMIN_PERMISSIONS.AGENDAMENTOS_CONFIGURAR, label: 'Configurar modalidades, locais, recursos e ofertas' },
      ],
    },
    {
      grupo: 'Documentos',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.DOCUMENTOS_VER, label: 'Ver documentos' },
        { chave: ADMIN_PERMISSIONS.DOCUMENTOS_ABRIR, label: 'Abrir arquivos enviados' },
        { chave: ADMIN_PERMISSIONS.DOCUMENTOS_CONCLUIR, label: 'Marcar documentos como concluídos' },
      ],
    },
    {
      grupo: 'Unidades',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.UNIDADES_VER, label: 'Ver unidades' },
        { chave: ADMIN_PERMISSIONS.UNIDADES_CRIAR, label: 'Criar unidades' },
        { chave: ADMIN_PERMISSIONS.UNIDADES_EDITAR, label: 'Editar unidades' },
        { chave: ADMIN_PERMISSIONS.UNIDADES_ATIVAR, label: 'Ativar/desativar unidades' },
      ],
    },
    {
      grupo: 'Bloqueios',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.BLOQUEIOS_VER, label: 'Ver bloqueios' },
        { chave: ADMIN_PERMISSIONS.BLOQUEIOS_CRIAR, label: 'Criar bloqueios' },
        { chave: ADMIN_PERMISSIONS.BLOQUEIOS_EDITAR, label: 'Editar bloqueios' },
        { chave: ADMIN_PERMISSIONS.BLOQUEIOS_REMOVER, label: 'Remover bloqueios' },
      ],
    },
    {
      grupo: 'Formulários e Denúncias',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.FORMULARIOS_VER, label: 'Consultar formulários e denúncias' },
        { chave: ADMIN_PERMISSIONS.FORMULARIOS_OPERAR, label: 'Operar triagem, atendimento e ações em lote' },
        { chave: ADMIN_PERMISSIONS.FORMULARIOS_ANEXOS, label: 'Abrir anexos privados' },
      ],
    },
    {
      grupo: 'Eventos',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.EVENTOS_VER, label: 'Ver eventos' },
        { chave: ADMIN_PERMISSIONS.EVENTOS_FINANCEIRO, label: 'Ver faturamento de ingressos' },
        { chave: ADMIN_PERMISSIONS.EVENTOS_PRESENCA, label: 'Confirmar e remover presença' },
        { chave: ADMIN_PERMISSIONS.EVENTOS_CERTIFICADOS, label: 'Emitir certificados' },
      ],
    },
    {
      grupo: 'Conteúdo do site',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.SITE_CONTEUDO_VER, label: 'Ver conteúdo editorial do site' },
        { chave: ADMIN_PERMISSIONS.SITE_CONTEUDO_EDITAR, label: 'Editar conteúdo editorial do site' },
      ],
    },
    {
      grupo: 'Usuários',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.USUARIOS_VER, label: 'Ver usuários' },
        { chave: ADMIN_PERMISSIONS.USUARIOS_CRIAR, label: 'Criar usuários' },
        { chave: ADMIN_PERMISSIONS.USUARIOS_EDITAR, label: 'Editar usuários e permissões' },
        { chave: ADMIN_PERMISSIONS.USUARIOS_DESATIVAR, label: 'Desativar usuários' },
      ],
    },
    {
      grupo: 'Configurações e envios',
      permissoes: [
        { chave: ADMIN_PERMISSIONS.CONFIG_VER, label: 'Ver configurações' },
        { chave: ADMIN_PERMISSIONS.CONFIG_TESTAR_ENVIOS, label: 'Testar envios' },
        { chave: ADMIN_PERMISSIONS.CONFIG_ATIVAR_ENVIOS, label: 'Ativar envio automático' },
      ],
    },
  ];
}

function validarDadosUsuario(dados, options = {}) {
  if (!dados.nome || dados.nome.length < 3 || !/\s/.test(dados.nome)) {
    return 'Informe o nome completo do usuário.';
  }
  if (!isValidEmail(dados.email)) return 'Informe um e-mail válido.';
  if (!options.ignorarCargo && dados.cargoFuncao && dados.cargoFuncao.length < 2) return 'Informe um cargo ou função válido.';
  if (!options.ignorarCpf && !isValidCpf(dados.cpf)) return 'Informe um CPF válido.';
  if (!options.ignorarSenha && (!dados.senha || dados.senha.length < 8)) {
    return 'A senha temporária deve ter pelo menos 8 caracteres.';
  }
  if (!Array.isArray(dados.permissoes)) return 'Permissões inválidas.';
  return '';
}

async function validarAlteracaoUsuarioCritico({ usuarioAtual, usuarioAtualizado, auth }) {
  const isSelf = auth?.usuario?._id && usuarioAtual._id === auth.usuario._id;
  const atualPermissoes = normalizarPermissoesArmazenadas(usuarioAtual.permissoesJson || usuarioAtual.permissoes);
  const novasPermissoes = normalizarPermissoesArmazenadas(usuarioAtualizado.permissoesJson || usuarioAtualizado.permissoes);
  const tinhaPermissaoCritica = hasPermission(atualPermissoes, USUARIOS_CRITICOS_PERMISSAO);
  const teraPermissaoCritica = usuarioAtualizado.ativo !== false && hasPermission(novasPermissoes, USUARIOS_CRITICOS_PERMISSAO);

  if (isSelf && usuarioAtualizado.ativo === false) {
    return {
      ok: false,
      codigo: 'OPERACAO_NAO_PERMITIDA',
      mensagem: 'Você não pode desativar seu próprio usuário.',
    };
  }

  if (isSelf && tinhaPermissaoCritica && !teraPermissaoCritica) {
    return {
      ok: false,
      codigo: 'OPERACAO_NAO_PERMITIDA',
      mensagem: 'Você não pode remover sua própria permissão de gerenciar usuários.',
    };
  }

  if (tinhaPermissaoCritica && !teraPermissaoCritica) {
    const totalCriticos = await contarUsuariosAtivosComPermissao(USUARIOS_CRITICOS_PERMISSAO);

    if (totalCriticos <= 1) {
      return {
        ok: false,
        codigo: 'ULTIMO_ADMIN_USUARIOS',
        mensagem: 'Não é possível remover a última pessoa com permissão para gerenciar usuários.',
      };
    }
  }

  return { ok: true };
}

async function contarUsuariosAtivosComPermissao(permissao) {
  try {
    const result = await wixData
      .query(COL.ADMIN_USUARIOS)
      .eq('ativo', true)
      .limit(1000)
      .find({ suppressAuth: true });

    return (result.items || []).filter((usuario) =>
      hasPermission(normalizarPermissoesArmazenadas(usuario.permissoesJson || usuario.permissoes), permissao)
    ).length;
  } catch (err) {
    console.warn('Não foi possível contar usuários críticos.', err);
    return 0;
  }
}

function mapAdminUsuarioSeguro(item = {}) {
  const permissoes = normalizarPermissoesArmazenadas(item.permissoesJson || item.permissoes);

  return {
    _id: text(item._id),
    nome: text(item.nome || item.name || item.title),
    email: normalizeEmail(item.email),
    cargoFuncao: text(item.cargoFuncao || item.cargo || item.funcao),
    ativo: item.ativo !== false,
    cpfCadastrado: item.cpfCadastrado === true || !!item.cpfHash,
    emailVerificado: item.emailVerificado !== false,
    precisaVerificarEmail: item.precisaVerificarEmail === true,
    cadastroConcluido: item.cadastroConcluido !== false,
    statusConvite: text(item.statusConvite || (item.cadastroConcluido === false ? 'pendente' : 'aceito')),
    permissoes,
    permissoesJson: JSON.stringify(permissoes),
    precisaTrocarSenha: item.precisaTrocarSenha === true,
    ultimoAcessoEm: dateTimeToIso(item.ultimoAcessoEm),
    criadoEm: dateTimeToIso(item.criadoEm || item._createdDate),
    atualizadoEm: dateTimeToIso(item.atualizadoEm || item._updatedDate),
    cpfAtualizadoEm: dateTimeToIso(item.cpfAtualizadoEm),
    emailVerificadoEm: dateTimeToIso(item.emailVerificadoEm),
    senhaAlteradaEm: dateTimeToIso(item.senhaAlteradaEm),
    conviteEnviadoEm: dateTimeToIso(item.conviteEnviadoEm),
    conviteExpiraEm: dateTimeToIso(item.conviteExpiraEm),
    conviteAceitoEm: dateTimeToIso(item.conviteAceitoEm),
    legacy: item.legacy === true,
  };
}

async function atualizarUsuarioSemFalhar(usuario, patch = {}) {
  try {
    return await wixData.update(
      COL.ADMIN_USUARIOS,
      {
        ...usuario,
        ...patch,
      },
      { suppressAuth: true }
    );
  } catch (err) {
    console.warn('Não foi possível atualizar auditoria do usuário.', err);
    return usuario;
  }
}

async function registrarAdminLog(auth, acao, entidade, entidadeId, detalhes = {}) {
  try {
    await wixData.insert(
      COL.ADMIN_LOGS,
      {
        title: `${acao} - ${new Date().toISOString()}`,
        acao,
        entidade,
        entidadeId: text(entidadeId),
        usuarioId: text(auth?.usuario?._id),
        usuarioEmail: normalizeEmail(auth?.usuario?.email),
        detalhesJson: JSON.stringify(detalhes || {}),
        criadoEm: new Date(),
      },
      { suppressAuth: true }
    );
  } catch (err) {
    console.warn('Não foi possível registrar auditoria administrativa.', err);
  }
}

function gerarSenhaTemporaria() {
  return `${gerarTokenSeguro(4)}-${gerarTokenSeguro(4)}-${gerarTokenSeguro(4)}`;
}

function gerarTokenSeguro(length = 32) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const seed = `${Date.now()}-${Math.random()}-${Math.random()}`;
  let hashSeed = sha256(seed);

  for (let i = 0; i < length; i += 1) {
    if (i > 0 && i % hashSeed.length === 0) {
      hashSeed = sha256(`${hashSeed}-${Date.now()}-${Math.random()}`);
    }

    const sliceStart = (i * 2) % hashSeed.length;
    const hex = hashSeed.slice(sliceStart, sliceStart + 2);
    const value = parseInt(hex || '0', 16) + Math.floor(Math.random() * 256);
    out += chars[value % chars.length];
  }

  return out;
}

function timingSafeEqualString(a, b) {
  const x = text(a);
  const y = text(b);

  if (x.length !== y.length) return false;

  let diff = 0;
  for (let i = 0; i < x.length; i += 1) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return diff === 0;
}

function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function tryParseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i;
  let j;
  const result = [];
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = sha256.h = sha256.h || [];
  const k = sha256.k = sha256.k || [];
  let primeCounter = k[lengthProperty];

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  const utf8 = unescape(encodeURIComponent(ascii));
  ascii = utf8;

  for (i = 0; i < ascii[lengthProperty]; i += 1) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[ascii[lengthProperty] >> 2] |= 0x80 << (((3 - ascii[lengthProperty]) % 4) * 8);
  words[(((ascii[lengthProperty] + 8) >> 6) << 4) + 15] = asciiBitLength;

  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, j += 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
          w[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
        ) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i += 1) {
    for (j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result.push((b < 16 ? '0' : '') + b.toString(16));
    }
  }

  return result.join('');
}




async function buscarBloqueioAdminPorId(id) {
  const bloqueioId = text(id);
  if (!bloqueioId) return null;

  try {
    const item = await wixData.get(COL.BLOQUEIOS_AGENDA, bloqueioId, { suppressAuth: true });
    return item && item._id ? item : null;
  } catch (err) {
    return null;
  }
}

async function normalizarPayloadBloqueio(payload = {}, options = {}) {
  const atual = options.itemAtual || {};
  const escopo = normalizarEscopoBloqueio(
    payload.escopo ||
      payload.scope ||
      (payload.todasUnidades === true || payload.todas === true ? 'todas' : '') ||
      atual.escopo ||
      atual.scope ||
      ''
  ) || normalizarEscopoPorUnidade(payload.unidadeSlug || payload.unidade || payload.unidadeId || atual.unidadeSlug || atual.unidadeId);

  let unidadeSlug = normalizarSlugUnidade(
    payload.unidadeSlug ||
      payload.unidade ||
      payload.unidadeId ||
      atual.unidadeSlug ||
      atual.unidadeId ||
      ''
  );
  let unidadeNome = text(payload.unidadeNome || atual.unidadeNome || '');

  if (escopo === 'todas') {
    unidadeSlug = 'todas';
    unidadeNome = 'Todas as unidades';
  } else if (unidadeSlug) {
    const unidade = await buscarUnidadeAdminPorIdOuSlug(unidadeSlug);
    if (unidade && unidade._id) {
      const mapped = mapUnidadeAdmin(unidade);
      unidadeSlug = mapped.slug;
      unidadeNome = mapped.nome;
    }
  }

  const tipo = normalizarTipoBloqueio(
    payload.tipo ||
      payload.tipoBloqueio ||
      (payload.diaInteiro === true ? 'dia_inteiro' : '') ||
      atual.tipo ||
      atual.tipoBloqueio ||
      ''
  );

  const dataInicio = normalizarDataIso(
    payload.dataInicio ||
      payload.inicioData ||
      payload.dataIso ||
      payload.data ||
      atual.dataInicio ||
      atual.inicioData ||
      atual.dataIso ||
      atual.data
  );
  const dataFim = normalizarDataIso(
    payload.dataFim ||
      payload.fimData ||
      payload.dataFinal ||
      atual.dataFim ||
      atual.fimData ||
      atual.dataFinal ||
      dataInicio
  );

  let horarioInicio = normalizarHorario(payload.horarioInicio || payload.inicioHorario || payload.horario || atual.horarioInicio || atual.inicioHorario || atual.horario);
  let horarioFim = normalizarHorario(payload.horarioFim || payload.fimHorario || atual.horarioFim || atual.fimHorario);

  const tipoFinal = tipo || (horarioInicio ? 'horario' : dataFim && dataFim !== dataInicio ? 'intervalo_datas' : 'dia_inteiro');

  if (tipoFinal === 'dia_inteiro' || tipoFinal === 'intervalo_datas') {
    horarioInicio = '';
    horarioFim = '';
  } else if (tipoFinal === 'horario' && horarioInicio && !horarioFim) {
    horarioFim = adicionarMinutosHorario(horarioInicio, 30);
  }

  const ativo = payload.ativo === undefined && payload.ativa === undefined
    ? atual.ativo !== false && atual.ativa !== false
    : asBoolean(payload.ativo !== undefined ? payload.ativo : payload.ativa);

  return {
    escopo: escopo || 'unidade',
    unidadeSlug,
    unidadeNome,
    tipo: tipoFinal,
    dataInicio,
    dataFim: dataFim || dataInicio,
    horarioInicio,
    horarioFim,
    motivo: text(
      payload.motivoPublico ||
        payload.motivo ||
        payload.reason ||
        atual.motivoPublico ||
        atual.motivo ||
        atual.reason
    ).replace(/\s+/g, ' '),
    observacoesInternas: text(payload.observacoesInternas || payload.observacoes || atual.observacoesInternas || atual.observacoes),
    ativo,
  };
}

function validarDadosBloqueio(dados = {}) {
  if (dados.escopo !== 'todas' && dados.escopo !== 'unidade') {
    return 'Informe se o bloqueio vale para todas as unidades ou para uma unidade específica.';
  }

  if (dados.escopo === 'unidade' && !dados.unidadeSlug) {
    return 'Selecione a unidade prisional do bloqueio.';
  }

  if (!['dia_inteiro', 'intervalo_datas', 'horario'].includes(dados.tipo)) {
    return 'Informe o tipo de bloqueio.';
  }

  if (!isDataIsoValida(dados.dataInicio)) {
    return 'Informe a data inicial do bloqueio.';
  }

  if (!isDataIsoValida(dados.dataFim)) {
    return 'Informe a data final do bloqueio.';
  }

  if (dados.dataFim < dados.dataInicio) {
    return 'A data final não pode ser anterior à data inicial.';
  }

  if (dados.tipo === 'horario') {
    if (!isHorarioValido(dados.horarioInicio) || !isHorarioValido(dados.horarioFim)) {
      return 'Informe o horário inicial e final do bloqueio.';
    }

    if (horarioParaMinutos(dados.horarioFim) <= horarioParaMinutos(dados.horarioInicio)) {
      return 'O horário final deve ser posterior ao horário inicial.';
    }
  }

  if (!dados.motivo || dados.motivo.length < 3) {
    return 'Informe o motivo do bloqueio.';
  }

  return '';
}

function montarItemBloqueio(dados = {}, auditoria = {}) {
  const dataFim = dados.dataFim || dados.dataInicio;
  const diaInteiro = dados.tipo === 'dia_inteiro' || dados.tipo === 'intervalo_datas';
  const title = gerarTituloBloqueio(dados);

  return {
    title,
    escopo: dados.escopo,
    scope: dados.escopo,
    todasUnidades: dados.escopo === 'todas',
    unidadeSlug: dados.escopo === 'todas' ? 'todas' : dados.unidadeSlug,
    unidadeId: dados.escopo === 'todas' ? 'todas' : dados.unidadeSlug,
    unidadeNome: dados.escopo === 'todas' ? 'Todas as unidades' : dados.unidadeNome,
    tipo: dados.tipo,
    tipoBloqueio: dados.tipo,
    diaInteiro,
    dataInicio: dados.dataInicio,
    dataFim,
    inicioData: dados.dataInicio,
    fimData: dataFim,
    dataIso: dados.dataInicio,
    data: dados.dataInicio,
    horarioInicio: diaInteiro ? '' : dados.horarioInicio,
    horarioFim: diaInteiro ? '' : dados.horarioFim,
    inicioHorario: diaInteiro ? '' : dados.horarioInicio,
    fimHorario: diaInteiro ? '' : dados.horarioFim,
    motivo: dados.motivo,
    motivoPublico: dados.motivo,
    reason: dados.motivo,
    observacoesInternas: dados.observacoesInternas || '',
    observacoes: dados.observacoesInternas || '',
    ativo: dados.ativo !== false,
    ativa: dados.ativo !== false,
    status: dados.ativo !== false ? 'ativo' : 'inativo',
    ...auditoria,
  };
}

function mapBloqueioAdmin(item = {}) {
  const escopo = normalizarEscopoBloqueio(item.escopo || item.scope || (item.todasUnidades ? 'todas' : 'unidade')) || 'unidade';
  const tipo = normalizarTipoBloqueio(item.tipo || item.tipoBloqueio || (item.diaInteiro ? 'dia_inteiro' : 'horario')) || 'dia_inteiro';
  const dataInicio = normalizarDataIso(item.dataInicio || item.inicioData || item.dataIso || item.data);
  const dataFim = normalizarDataIso(item.dataFim || item.fimData || item.dataFinal || dataInicio);
  const horarioInicio = normalizarHorario(item.horarioInicio || item.inicioHorario || item.horario);
  const horarioFim = normalizarHorario(item.horarioFim || item.fimHorario);
  const ativo = item.ativo !== false && item.ativa !== false && text(item.status).toLowerCase() !== 'inativo';
  const hoje = hojeIso();
  const encerrado = ativo && dataFim && dataFim < hoje;
  const status = !ativo ? 'inativo' : encerrado ? 'encerrado' : 'ativo';
  const unidadeSlug = escopo === 'todas'
    ? 'todas'
    : normalizarSlugUnidade(item.unidadeSlug || item.unidadeId || item.unidade || '');
  const unidadeNome = escopo === 'todas'
    ? 'Todas as unidades'
    : text(item.unidadeNome || item.unidadeLabel || item.unidade || unidadeSlug);

  return {
    _id: text(item._id),
    id: text(item._id),
    title: text(item.title),
    escopo,
    escopoLabel: escopo === 'todas' ? 'Todas as unidades' : 'Unidade específica',
    todasUnidades: escopo === 'todas',
    unidadeSlug,
    unidadeId: unidadeSlug,
    unidadeNome,
    tipo,
    tipoLabel: tipoBloqueioLabel(tipo),
    diaInteiro: tipo === 'dia_inteiro' || tipo === 'intervalo_datas',
    dataInicio,
    dataFim: dataFim || dataInicio,
    dataIso: dataInicio,
    dataLabel: formatarPeriodoDataLabel(dataInicio, dataFim || dataInicio),
    horarioInicio,
    horarioFim,
    horarioLabel: formatarHorarioBloqueioLabel(tipo, horarioInicio, horarioFim),
    motivo: text(item.motivoPublico || item.motivo || item.reason),
    motivoPublico: text(item.motivoPublico || item.motivo || item.reason),
    observacoesInternas: text(item.observacoesInternas || item.observacoes),
    ativo,
    status,
    statusLabel: status === 'ativo' ? 'Ativo' : status === 'encerrado' ? 'Encerrado' : 'Inativo',
    criadoEm: dateTimeToIso(item.criadoEm || item._createdDate),
    atualizadoEm: dateTimeToIso(item.atualizadoEm || item._updatedDate),
    criadoPor: text(item.criadoPor),
    atualizadoPor: text(item.atualizadoPor),
    cancelarAgendamentosExistentes: item.cancelarAgendamentosExistentes === true,
    totalAgendamentosAfetados: Number(item.totalAgendamentosAfetados || 0),
    totalAgendamentosCancelados: Number(item.totalAgendamentosCancelados || 0),
    totalEmailsCancelamentoEnviados: Number(item.totalEmailsCancelamentoEnviados || 0),
    totalEmailsCancelamentoComErro: Number(item.totalEmailsCancelamentoComErro || 0),
    cancelamentoAgendamentosExecutadoEm: dateTimeToIso(item.cancelamentoAgendamentosExecutadoEm),
  };
}

function bloqueioAdminMatchesBusca(bloqueio, busca) {
  return normalizeSearch([
    bloqueio.unidadeNome,
    bloqueio.unidadeSlug,
    bloqueio.tipoLabel,
    bloqueio.dataLabel,
    bloqueio.horarioLabel,
    bloqueio.motivo,
    bloqueio.observacoesInternas,
  ].join(' ')).includes(busca);
}

function temPermissaoAdmin(auth = {}, permissao = '') {
  if (!permissao) return true;
  if (auth.legacy === true || auth.usuario?.legacy === true) return true;
  return (auth.permissoes || auth.usuario?.permissoes || []).includes(permissao);
}

async function listarAgendamentosAfetadosPorBloqueio(dados = {}) {
  let query = wixData
    .query(COL.AGENDAMENTOS)
    .eq('status', 'agendado')
    .limit(1000);

  if (dados.escopo === 'unidade' && dados.unidadeSlug) {
    query = query.eq('unidadeSlug', dados.unidadeSlug);
  }

  let result = await query.find({ suppressAuth: true });
  const items = [...(result.items || [])];

  while (result.hasNext && result.hasNext() && items.length < 5000) {
    result = await result.next();
    items.push(...(result.items || []));
  }

  return items
    .filter((item) => agendamentoEhAfetadoPorBloqueio(item, dados))
    .sort((a, b) => {
      const da = `${normalizeDateIso(a.dataAtendimentoIso || a.dataIso || a.dataAtendimento || a.data)} ${normalizeTime(a.horarioInicio || a.horario)}`;
      const db = `${normalizeDateIso(b.dataAtendimentoIso || b.dataIso || b.dataAtendimento || b.data)} ${normalizeTime(b.horarioInicio || b.horario)}`;
      return da.localeCompare(db);
    });
}

function agendamentoEhAfetadoPorBloqueio(item = {}, dados = {}) {
  if (text(item.status || 'agendado').toLowerCase() !== 'agendado') return false;

  if (
    dados.escopo === 'unidade' &&
    normalizarSlugUnidade(item.unidadeSlug) !== normalizarSlugUnidade(dados.unidadeSlug)
  ) {
    return false;
  }

  const dataIso = normalizeDateIso(
    item.dataAtendimentoIso || item.dataIso || item.dataAtendimento || item.data
  );

  if (!dataIso || dataIso < dados.dataInicio || dataIso > dados.dataFim) return false;

  if (dados.tipo !== 'horario') return true;

  const inicioAgendamento = normalizeTime(item.horarioInicio || item.horario);
  const fimAgendamento =
    normalizeTime(item.horarioFim || item.horarioFinal) ||
    addMinutesToTime(inicioAgendamento, 30);

  if (!inicioAgendamento || !fimAgendamento) return false;

  return (
    horarioParaMinutos(inicioAgendamento) < horarioParaMinutos(dados.horarioFim) &&
    horarioParaMinutos(fimAgendamento) > horarioParaMinutos(dados.horarioInicio)
  );
}

function mapAgendamentoImpactoBloqueio(item = {}) {
  const dataIso = normalizeDateIso(
    item.dataAtendimentoIso || item.dataIso || item.dataAtendimento || item.data
  );
  const horarioInicio = normalizeTime(item.horarioInicio || item.horario);
  const horarioFim =
    normalizeTime(item.horarioFim || item.horarioFinal) ||
    addMinutesToTime(horarioInicio, 30);

  return {
    _id: text(item._id),
    protocolo: text(item.protocolo || item.title),
    unidadeSlug: text(item.unidadeSlug),
    unidadeNome: text(item.unidadeNome),
    dataIso,
    dataLabel: text(item.dataLabel) || formatDateLabel(dataIso),
    horarioInicio,
    horarioFim,
    horarioLabel: horarioInicio && horarioFim ? `${horarioInicio} – ${horarioFim}` : horarioInicio,
    nomeAdvogado: text(item.nomeAdvogado),
    numeroOab: text(item.numeroOab),
    emailAdvogado: normalizeEmail(item.solicitanteEmail || item.emailAdvogado || item.emailIndex),
    nomeIpl: text(item.nomeIpl),
    infopen: text(item.infopen),
    listaDiariaEnviada: item.listaDiariaEnviada === true,
  };
}

async function cancelarAgendamentosPorBloqueio({ agendamentos = [], dadosBloqueio = {}, bloqueio = {}, auth = {} }) {
  let configEmail = null;
  let erroConfigEmail = '';

  try {
    configEmail = await carregarConfigInfobipAdmin();
  } catch (err) {
    erroConfigEmail = normalizarMensagemErroApi(err);
  }

  const resultados = [];
  const tamanhoLote = 5;

  for (let i = 0; i < agendamentos.length; i += tamanhoLote) {
    const lote = agendamentos.slice(i, i + tamanhoLote);
    const processados = await Promise.all(
      lote.map((item) =>
        cancelarAgendamentoIndividualPorBloqueio({
          item,
          dadosBloqueio,
          bloqueio,
          auth,
          configEmail,
          erroConfigEmail,
        })
      )
    );
    resultados.push(...processados);
  }

  const cancelados = resultados.filter((r) => r.cancelado === true);
  const emailsEnviados = resultados.filter((r) => r.emailEnviado === true);
  const emailsComErro = resultados.filter((r) => r.cancelado === true && r.emailEnviado !== true);
  const datasComListaJaEnviada = Array.from(
    new Set(
      resultados
        .filter((r) => r.cancelado === true && r.listaDiariaEnviada === true)
        .map((r) => `${r.unidadeSlug}|${r.dataIso}`)
    )
  ).map((chave) => {
    const [unidadeSlug, dataIso] = chave.split('|');
    return { unidadeSlug, dataIso };
  });

  return {
    solicitado: true,
    totalAfetados: agendamentos.length,
    totalCancelados: cancelados.length,
    totalEmailsEnviados: emailsEnviados.length,
    totalEmailsComErro: emailsComErro.length,
    protocolosCancelados: cancelados.map((r) => r.protocolo).filter(Boolean),
    listaAtualizadaRecomendada: datasComListaJaEnviada.length > 0,
    datasComListaJaEnviada,
    falhasEmail: emailsComErro.slice(0, 20).map((r) => ({
      protocolo: r.protocolo,
      email: r.emailDestino,
      mensagem: r.emailErro,
    })),
  };
}

async function cancelarAgendamentoIndividualPorBloqueio({
  item = {},
  dadosBloqueio = {},
  bloqueio = {},
  auth = {},
  configEmail = null,
  erroConfigEmail = '',
}) {
  let atual = item;

  try {
    atual = await wixData.get(COL.AGENDAMENTOS, item._id, { suppressAuth: true });
  } catch (_) {
    // Usa o item já carregado caso a releitura falhe.
  }

  const protocolo = text(atual.protocolo || atual.title);
  const dataIso = normalizeDateIso(
    atual.dataAtendimentoIso || atual.dataIso || atual.dataAtendimento || atual.data
  );
  const unidadeSlug = text(atual.unidadeSlug);

  if (!atual || !atual._id || text(atual.status).toLowerCase() !== 'agendado') {
    return {
      protocolo,
      dataIso,
      unidadeSlug,
      cancelado: false,
      ignorado: true,
    };
  }

  const agora = new Date();
  const motivoPublico = text(dadosBloqueio.motivo);
  const emailDestino = normalizeEmail(atual.emailAdvogado || atual.emailIndex);

  let salvo = await wixData.update(
    COL.AGENDAMENTOS,
    {
      ...atual,
      status: 'cancelado',
      canceladoEm: agora,
      canceladoPor: auth.usuario?.email || 'bloqueio-agenda',
      motivoCancelamento: motivoPublico,
      origemCancelamento: 'bloqueio_agenda',
      bloqueioIdCancelamento: text(bloqueio._id),
      emailCancelamentoEnviado: false,
      emailCancelamentoDestino: emailDestino,
      emailCancelamentoErro: '',
      atualizadoEm: agora,
    },
    { suppressAuth: true }
  );

  let emailEnviado = false;
  let emailErro = '';

  if (!isValidEmail(emailDestino)) {
    emailErro = 'Agendamento sem e-mail válido para notificação.';
  } else if (!configEmail) {
    emailErro = erroConfigEmail || 'Configuração de e-mail indisponível.';
  } else {
    const email = montarEmailCancelamentoBloqueio(salvo, dadosBloqueio);
    const envio = await enviarEmailInfobipAdmin({
      config: configEmail,
      to: emailDestino,
      subject: email.subject,
      textBody: email.textBody,
      htmlBody: email.htmlBody,
    });

    emailEnviado = envio.ok === true;
    emailErro = envio.ok ? '' : text(envio.mensagem || 'Falha no envio do e-mail.');
  }

  try {
    salvo = await wixData.update(
      COL.AGENDAMENTOS,
      {
        ...salvo,
        emailCancelamentoEnviado: emailEnviado,
        emailCancelamentoDestino: emailDestino,
        emailCancelamentoErro: emailErro,
        emailCancelamentoEnviadoEm: emailEnviado ? new Date() : null,
        atualizadoEm: new Date(),
      },
      { suppressAuth: true }
    );
  } catch (err) {
    console.warn('Não foi possível registrar o resultado do e-mail de cancelamento.', err);
  }

  return {
    protocolo,
    dataIso,
    unidadeSlug,
    cancelado: true,
    emailDestino,
    emailEnviado,
    emailErro,
    listaDiariaEnviada: atual.listaDiariaEnviada === true,
  };
}

function montarEmailCancelamentoBloqueio(agendamento = {}, dadosBloqueio = {}) {
  const protocolo = text(agendamento.protocolo || agendamento.title);
  const nomeAdvogado = text(agendamento.nomeAdvogado) || 'Advogado(a)';
  const unidadeNome = text(agendamento.unidadeNome) || text(dadosBloqueio.unidadeNome);
  const dataIso = normalizeDateIso(
    agendamento.dataAtendimentoIso || agendamento.dataIso || agendamento.dataAtendimento || agendamento.data
  );
  const dataLabel = text(agendamento.dataLabel) || formatDateLabel(dataIso);
  const horarioInicio = normalizeTime(agendamento.horarioInicio || agendamento.horario);
  const horarioFim =
    normalizeTime(agendamento.horarioFim || agendamento.horarioFinal) ||
    addMinutesToTime(horarioInicio, 30);
  const horarioLabel = horarioInicio && horarioFim ? `${horarioInicio} – ${horarioFim}` : horarioInicio;
  const motivoPublico = text(dadosBloqueio.motivo);
  const consultaUrl = `${CENTRAL_PUBLIC_URL}/consultar`;
  const subject = `Cancelamento de agendamento — ${unidadeNome} — ${dataLabel}`;

  const textBody = [
    `Olá, ${nomeAdvogado}.`,
    '',
    'Informamos que seu agendamento de atendimento prisional foi cancelado pela OAB Juiz de Fora.',
    '',
    `Protocolo: ${protocolo}`,
    `Unidade: ${unidadeNome}`,
    `Data: ${dataLabel}`,
    `Horário: ${horarioLabel}`,
    `Motivo: ${motivoPublico}`,
    '',
    'O agendamento não foi remarcado automaticamente. Para realizar um novo agendamento, acesse a Central.',
    consultaUrl,
    '',
    'OAB/MG — 4ª Subseção de Juiz de Fora',
  ].join('\n');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#24211d;line-height:1.55;max-width:640px;margin:0 auto;">
      <div style="border-top:4px solid #9d2b2b;padding:24px;border-left:1px solid #d9d0c4;border-right:1px solid #d9d0c4;border-bottom:1px solid #d9d0c4;background:#fffdf8;">
        <p>Olá, <strong>${escapeHtml(nomeAdvogado)}</strong>.</p>
        <p>Informamos que seu agendamento de atendimento prisional foi cancelado pela OAB Juiz de Fora.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;background:#f5f0e8;">
          <tr><td style="padding:8px 12px;color:#6f665b;width:110px;">Protocolo</td><td style="padding:8px 12px;font-weight:600;">${escapeHtml(protocolo)}</td></tr>
          <tr><td style="padding:8px 12px;color:#6f665b;">Unidade</td><td style="padding:8px 12px;">${escapeHtml(unidadeNome)}</td></tr>
          <tr><td style="padding:8px 12px;color:#6f665b;">Data</td><td style="padding:8px 12px;">${escapeHtml(dataLabel)}</td></tr>
          <tr><td style="padding:8px 12px;color:#6f665b;">Horário</td><td style="padding:8px 12px;">${escapeHtml(horarioLabel)}</td></tr>
        </table>
        <div style="border-left:3px solid #9d2b2b;background:#f8eee9;padding:12px 14px;margin:18px 0;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6f665b;margin-bottom:4px;">Motivo informado pela OAB/JF</div>
          <div>${escapeHtml(motivoPublico)}</div>
        </div>
        <p>O agendamento não foi remarcado automaticamente. Para realizar um novo agendamento, acesse a Central.</p>
        <p><a href="${consultaUrl}" style="display:inline-block;background:#24211d;color:#fffdf8;text-decoration:none;padding:10px 16px;border-radius:5px;">Acessar a Central</a></p>
        <p style="margin-top:28px;color:#6f665b;font-size:13px;">OAB/MG — 4ª Subseção de Juiz de Fora</p>
      </div>
    </div>`;

  return { subject, textBody, htmlBody };
}

function normalizarEscopoPorUnidade(value) {
  const v = text(value).toLowerCase();
  if (!v || v === 'todas' || v === 'todos' || v === '__todas__' || v === 'all') return 'todas';
  return 'unidade';
}

function normalizarEscopoBloqueio(value) {
  const v = text(value).toLowerCase();
  if (!v) return '';
  if (['todas', 'todos', 'all', 'global', 'geral', 'todas_unidades'].includes(v)) return 'todas';
  if (['unidade', 'unidade_especifica', 'especifica', 'specific'].includes(v)) return 'unidade';
  return '';
}

function normalizarTipoBloqueio(value) {
  const v = text(value).toLowerCase();
  if (!v) return '';
  if (['dia', 'dia_inteiro', 'inteiro', 'data', 'data_inteira'].includes(v)) return 'dia_inteiro';
  if (['intervalo', 'intervalo_datas', 'periodo', 'período'].includes(v)) return 'intervalo_datas';
  if (['horario', 'horário', 'horario_especifico', 'horário_específico', 'intervalo_horarios'].includes(v)) return 'horario';
  return '';
}

function normalizarDataIso(value) {
  const v = text(value);
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function isDataIsoValida(value) {
  const v = normalizarDataIso(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function dataDentroDoBloqueio(dataIso, inicio, fim) {
  const data = normalizarDataIso(dataIso);
  const a = normalizarDataIso(inicio);
  const b = normalizarDataIso(fim || inicio);
  if (!data || !a) return false;
  return data >= a && data <= (b || a);
}

function normalizarHorario(value) {
  const v = text(value);
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function isHorarioValido(value) {
  return /^\d{2}:\d{2}$/.test(normalizarHorario(value));
}

function horarioParaMinutos(value) {
  const h = normalizarHorario(value);
  if (!h) return 0;
  const [hh, mm] = h.split(':').map((n) => Number(n));
  return hh * 60 + mm;
}

function adicionarMinutosHorario(value, minutos) {
  const total = horarioParaMinutos(value) + Number(minutos || 0);
  const safe = Math.max(0, Math.min(total, 24 * 60));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function tipoBloqueioLabel(tipo) {
  if (tipo === 'horario') return 'Horário específico';
  if (tipo === 'intervalo_datas') return 'Intervalo de datas';
  return 'Dia inteiro';
}

function formatarPeriodoDataLabel(inicio, fim) {
  const a = normalizarDataIso(inicio);
  const b = normalizarDataIso(fim || inicio);
  if (!a) return '—';
  if (!b || b === a) return formatarDataCurta(a);
  return `${formatarDataCurta(a)} a ${formatarDataCurta(b)}`;
}

function formatarDataCurta(value) {
  const v = normalizarDataIso(value);
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

function formatarHorarioBloqueioLabel(tipo, inicio, fim) {
  if (tipo === 'dia_inteiro' || tipo === 'intervalo_datas') return 'Dia inteiro';
  const a = normalizarHorario(inicio);
  const b = normalizarHorario(fim);
  if (!a && !b) return '—';
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

function gerarTituloBloqueio(dados = {}) {
  const unidade = dados.escopo === 'todas' ? 'Todas as unidades' : dados.unidadeNome || dados.unidadeSlug;
  const periodo = formatarPeriodoDataLabel(dados.dataInicio, dados.dataFim);
  const horario = formatarHorarioBloqueioLabel(dados.tipo, dados.horarioInicio, dados.horarioFim);
  return [unidade, periodo, horario, dados.motivo].filter(Boolean).join(' · ');
}

async function buscarUnidadeAdminPorIdOuSlug(idOuSlug) {
  const id = text(idOuSlug);
  if (!id) return null;

  try {
    const byId = await wixData.get(COL.UNIDADES, id, { suppressAuth: true });
    if (byId && byId._id) return byId;
  } catch (err) {
    // tenta por slug abaixo
  }

  return buscarUnidadeAdminPorSlug(id);
}

async function buscarUnidadeAdminPorSlug(slug) {
  const value = text(slug);
  if (!value) return null;

  const result = await wixData
    .query(COL.UNIDADES)
    .eq('slug', value)
    .limit(1)
    .find({ suppressAuth: true });

  return (result.items || [])[0] || null;
}

function normalizarPayloadUnidade(payload = {}, options = {}) {
  const atual = options.itemAtual || {};
  const criar = options.criar === true;
  const nome = text(payload.nome || payload.unidadeNome || payload.title || atual.nome || atual.title).replace(/\s+/g, ' ');
  const slugBase = criar
    ? (payload.slug || payload.codigo || payload.id || nome)
    : (payload.slug !== undefined || payload.codigo !== undefined || payload.id !== undefined
      ? payload.slug || payload.codigo || payload.id
      : atual.slug || atual.codigo || atual.id || atual.unidadeSlug || nome);
  const slug = normalizarSlugUnidade(slugBase);
  const ativa = payload.ativa === undefined && payload.ativo === undefined
    ? atual.ativa !== false && atual.ativo !== false
    : asBoolean(payload.ativa !== undefined ? payload.ativa : payload.ativo);
  const receberListaDiaria = payload.receberListaDiaria === undefined
    ? atual.receberListaDiaria !== false
    : asBoolean(payload.receberListaDiaria);

  const emailAgenda = normalizeEmail(
    payload.emailAgenda ||
      payload.emailRecebimentoDocumentos ||
      payload.emailDocumentos ||
      payload.emailDestino ||
      atual.emailAgenda ||
      atual.emailDestino ||
      atual.emailDocumentos
  );
  const emailDocumentos = normalizeEmail(
    payload.emailDocumentos ||
      payload.emailRecebimentoDocumentos ||
      payload.emailAgenda ||
      payload.emailDestino ||
      atual.emailDocumentos ||
      atual.emailAgenda ||
      atual.emailDestino
  );
  const emailDestino = normalizeEmail(
    payload.emailDestino ||
      payload.emailRecebimentoDocumentos ||
      payload.emailAgenda ||
      payload.emailDocumentos ||
      atual.emailDestino ||
      atual.emailAgenda ||
      atual.emailDocumentos
  );
  const emailListas = normalizeEmail(
    payload.emailListas ||
      payload.emailRecebimentoListas ||
      payload.emailLista ||
      atual.emailListas ||
      atual.emailRecebimentoListas ||
      atual.emailLista
  );

  return {
    nome,
    slug,
    ativa,
    receberListaDiaria,
    endereco: text(payload.endereco || payload.localizacao || atual.endereco || atual.localizacao),
    cidade: text(payload.cidade || atual.cidade),
    emailAgenda,
    emailDocumentos,
    emailDestino,
    emailListas,
    observacoesInternas: text(payload.observacoesInternas || payload.observacoes || atual.observacoesInternas || atual.observacoes),
  };
}

function validarDadosUnidade(dados = {}) {
  if (!dados.nome || dados.nome.length < 3) {
    return 'Informe o nome da unidade prisional.';
  }

  if (!dados.slug || dados.slug.length < 2) {
    return 'Informe um código/slug válido para a unidade.';
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dados.slug)) {
    return 'O código/slug deve usar apenas letras minúsculas, números e hífens.';
  }

  const emails = [
    ['e-mail principal da unidade', dados.emailAgenda],
    ['e-mail de recebimento de documentos', dados.emailDocumentos],
    ['e-mail de destino', dados.emailDestino],
    ['e-mail de recebimento das listas', dados.emailListas],
  ];

  for (const [label, email] of emails) {
    if (email && !isValidEmail(email)) {
      return `Informe um ${label} válido.`;
    }
  }

  return '';
}

function montarItemUnidade(dados = {}, auditoria = {}) {
  return {
    title: dados.nome,
    nome: dados.nome,
    slug: dados.slug,
    codigo: dados.slug,
    id: dados.slug,
    ativa: dados.ativa !== false,
    ativo: dados.ativa !== false,
    receberListaDiaria: dados.receberListaDiaria !== false,
    horarioEnvioLista: '17:00',
    endereco: dados.endereco || '',
    localizacao: dados.endereco || '',
    cidade: dados.cidade || '',
    emailAgenda: dados.emailAgenda || dados.emailDocumentos || dados.emailDestino || '',
    emailDocumentos: dados.emailDocumentos || dados.emailAgenda || dados.emailDestino || '',
    emailDestino: dados.emailDestino || dados.emailAgenda || dados.emailDocumentos || '',
    emailListas: dados.emailListas || '',
    emailRecebimentoListas: dados.emailListas || '',
    observacoesInternas: dados.observacoesInternas || '',
    ...auditoria,
  };
}

function mapUnidadeAdmin(item = {}) {
  const slug = text(item.slug || item.id || item.codigo || item.unidadeSlug);
  const nome = text(item.nome || item.title || item.unidadeNome);
  const ativa = item.ativa !== false && item.ativo !== false;
  const emailAgenda = normalizeEmail(item.emailAgenda || item.emailDestino || item.emailDocumentos);
  const emailDocumentos = normalizeEmail(item.emailDocumentos || item.emailAgenda || item.emailDestino);
  const emailListas = normalizeEmail(item.emailListas || item.emailRecebimentoListas || item.emailLista);
  const avisos = [];

  if (!emailDocumentos) {
    avisos.push({ codigo: 'EMAIL_DOCUMENTOS_AUSENTE', mensagem: 'E-mail de recebimento de documentos não cadastrado.' });
  }

  if (!emailListas) {
    avisos.push({ codigo: 'EMAIL_LISTAS_AUSENTE', mensagem: 'E-mail de recebimento das listas não cadastrado.' });
  }

  return {
    _id: text(item._id),
    id: slug,
    slug,
    codigo: slug,
    nome,
    endereco: text(item.endereco || item.localizacao),
    cidade: text(item.cidade),
    ativa,
    ativo: ativa,
    receberListaDiaria: item.receberListaDiaria !== false,
    horarioEnvioLista: text(item.horarioEnvioLista || '17:00'),
    emailAgenda,
    emailDestino: normalizeEmail(item.emailDestino || emailAgenda),
    emailDocumentos,
    emailRecebimentoDocumentos: emailDocumentos,
    emailListas,
    emailRecebimentoListas: emailListas,
    observacoesInternas: text(item.observacoesInternas || item.observacoes),
    avisos,
    criadoEm: dateTimeToIso(item.criadoEm || item._createdDate),
    atualizadoEm: dateTimeToIso(item.atualizadoEm || item._updatedDate),
    criadoPor: text(item.criadoPor),
    atualizadoPor: text(item.atualizadoPor),
  };
}

function unidadeAdminMatchesBusca(unidade, busca) {
  return normalizeSearch([
    unidade.nome,
    unidade.slug,
    unidade.endereco,
    unidade.emailAgenda,
    unidade.emailDocumentos,
    unidade.emailListas,
  ].join(' ')).includes(busca);
}

function normalizarSlugUnidade(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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

  if (!unidade.slug || !unidade.nome || unidade.ativa === false) {
    return null;
  }

  return unidade;
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
    ativa,
  };
}

async function validarHorarioDisponivelParaRemarcacao(dados) {
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
      mensagem: 'Este horário não está disponível. Escolha outro horário.',
    };
  }

  return {
    ok: true,
    horario: horarioEncontrado,
  };
}

async function carregarHorariosNormalizados(unidadeSlug, dataIso) {
  const resultado = await chamarListarHorariosDisponiveis(unidadeSlug, dataIso);
  const bloqueios = await carregarBloqueiosAtivosParaDisponibilidade(unidadeSlug);

  return extrairHorarios(resultado)
    .map(mapHorarioDisponivel)
    .filter((horario) => !!horario.id && horario.disponivel !== false)
    .filter((horario) => !horarioBloqueadoPorAgenda(horario, bloqueios, dataIso))
    .sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));
}

async function carregarBloqueiosAtivosParaDisponibilidade(unidadeSlug) {
  const result = await wixData
    .query(COL.BLOQUEIOS_AGENDA)
    .limit(MAX_RESULTS)
    .find({ suppressAuth: true });

  const hoje = hojeIso();
  return (result.items || [])
    .map(mapBloqueioAdmin)
    .filter((b) => b.ativo !== false && b.status !== 'encerrado')
    .filter((b) => !b.dataFim || b.dataFim >= hoje)
    .filter((b) => bloqueioAplicaUnidadeDisponibilidade(b, unidadeSlug));
}

function bloqueioAplicaUnidadeDisponibilidade(bloqueio, unidadeSlug) {
  if (!bloqueio || bloqueio.ativo === false) return false;
  if (bloqueio.escopo === 'todas' || bloqueio.todasUnidades === true) return true;
  return text(bloqueio.unidadeSlug).toLowerCase() === text(unidadeSlug).toLowerCase();
}

function bloqueiosDaDataDisponibilidade(bloqueios, dataIso) {
  return (bloqueios || []).filter((b) => dataDentroDoBloqueio(dataIso, b.dataInicio, b.dataFim));
}

function bloqueioDiaInteiroDisponibilidade(bloqueio) {
  return bloqueio?.tipo === 'dia_inteiro' || bloqueio?.tipo === 'intervalo_datas' || !bloqueio?.horarioInicio;
}

function intervalosHorarioSobrepoemDisponibilidade(inicioA, fimA, inicioB, fimB) {
  const a1 = horarioParaMinutos(inicioA);
  const a2 = horarioParaMinutos(fimA);
  const b1 = horarioParaMinutos(inicioB);
  const b2 = horarioParaMinutos(fimB);
  return a1 < b2 && b1 < a2;
}

function horarioBloqueadoPorAgenda(horario, bloqueios, dataIso) {
  const bloqueiosData = bloqueiosDaDataDisponibilidade(bloqueios, dataIso);
  if (bloqueiosData.some(bloqueioDiaInteiroDisponibilidade)) return true;

  return bloqueiosData.some((b) => {
    if (b.tipo !== 'horario') return false;
    return intervalosHorarioSobrepoemDisponibilidade(
      horario.horarioInicio,
      horario.horarioFim || adicionarMinutosHorario(horario.horarioInicio, 30),
      b.horarioInicio,
      b.horarioFim || adicionarMinutosHorario(b.horarioInicio, 30)
    );
  });
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

function validarDadosRemarcacao(dados) {
  if (!dados.unidadeSlug) return 'Informe a unidade prisional.';

  if (!dados.dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dados.dataIso)) {
    return 'Informe uma nova data válida.';
  }

  if (!dados.horarioInicio || !/^\d{2}:\d{2}$/.test(dados.horarioInicio)) {
    return 'Informe um novo horário válido.';
  }

  return '';
}


function mapDocumentoAdmin(item) {
  const statusOriginal = text(item.status || 'recebido').toLowerCase() || 'recebido';
  const status = normalizarDocumentoStatusPrincipal(statusOriginal);
  const tipoDocumento = text(item.tipoDocumento);
  const tipoDocumentoLabel = text(item.tipoDocumentoLabel) || getTipoDocumentoLabel(tipoDocumento);
  const criadoEm = item.criadoEm || item._createdDate || null;
  const atualizadoEm = item.atualizadoEm || item._updatedDate || null;
  const arquivoPrincipalUrlOriginal = text(item.arquivoPrincipalUrl);
  const arquivoUrlPublica = normalizarArquivoUrlParaAdmin(arquivoPrincipalUrlOriginal);
  const arquivoUrlParaAdmin = arquivoUrlPublica || (isHttpUrl(arquivoPrincipalUrlOriginal) ? arquivoPrincipalUrlOriginal : '');
  const dataIso = normalizeDateIso(criadoEm);

  return {
    _id: item._id,
    protocolo: text(item.protocolo || item.title),
    title: text(item.title),

    unidadeSlug: text(item.unidadeSlug),
    unidadeNome: text(item.unidadeNome),

    nomeAdvogado: text(item.nomeAdvogado),
    numeroOab: text(item.numeroOab),
    emailAdvogado: text(item.emailAdvogado || item.emailIndex),
    telefoneAdvogado: text(item.telefoneAdvogado),

    nomeIpl: text(item.nomeIpl),
    infopen: text(item.infopen),

    tipoDocumento,
    tipoDocumentoLabel,

    arquivoPrincipalUrl: arquivoUrlParaAdmin,
    arquivoPrincipalUrlOriginal,
    arquivoUrl: arquivoUrlParaAdmin,
    arquivoUrlPublica: arquivoUrlParaAdmin,
    arquivoUrlEmail: arquivoUrlParaAdmin,
    arquivoPrincipalNome: text(item.arquivoPrincipalNome),
    arquivosJson: text(item.arquivosJson),
    observacoesAdvogado: text(item.observacoesAdvogado),

    status,
    statusOriginal,
    statusLabel: getDocumentoStatusLabel(status),
    mensagemErro: text(item.mensagemErro),

    unidadeEmailDestino: text(item.unidadeEmailDestino),
    emailUnidadeEnviado: asBoolean(item.emailUnidadeEnviado),
    emailUnidadeEnviadoEm: dateTimeToIso(item.emailUnidadeEnviadoEm),

    emailAdvogadoEnviado: asBoolean(item.emailAdvogadoEnviado),
    emailAdvogadoDestino: text(item.emailAdvogadoDestino),
    emailAdvogadoErro: text(item.emailAdvogadoErro),
    emailAdvogadoEnviadoEm: dateTimeToIso(item.emailAdvogadoEnviadoEm),

    dataIso,
    criadoEm: dateTimeToIso(criadoEm),
    criadoEmLabel: formatDateTimeLabel(criadoEm),
    atualizadoEm: dateTimeToIso(atualizadoEm),
  };
}


async function buscarAgendamentoPorProtocolo(protocolo) {
  const p = normalizeProtocol(protocolo);

  if (!p) return null;

  const porProtocolo = await wixData
    .query(COL.AGENDAMENTOS)
    .eq('protocolo', p)
    .limit(1)
    .find({ suppressAuth: true });

  if (porProtocolo.items && porProtocolo.items.length) {
    return porProtocolo.items[0];
  }

  const porTitulo = await wixData
    .query(COL.AGENDAMENTOS)
    .eq('title', p)
    .limit(1)
    .find({ suppressAuth: true });

  if (porTitulo.items && porTitulo.items.length) {
    return porTitulo.items[0];
  }

  return null;
}

function consultaAgendamentoNaoEncontrada() {
  return {
    ok: false,
    codigo: 'NAO_ENCONTRADO',
    mensagem: 'Não encontramos um agendamento com esses dados. Confira o protocolo e o e-mail informado.',
  };
}

function mapAgendamentoConsultaPublica(item) {
  const dataIso = normalizeDateIso(
    item.dataAtendimentoIso ||
      item.dataIso ||
      item.dataAtendimento ||
      item.data
  );

  const horarioInicio = normalizeTime(item.horarioInicio || item.horario);
  const duracao = Math.max(5, Number(item.duracaoMinutos || 30));
  const horarioFim =
    normalizeTime(item.horarioFim || item.horarioFinal) ||
    addMinutesToTime(horarioInicio, duracao);

  const status = text(item.status || 'agendado').toLowerCase() || 'agendado';
  const isV2 = Number(item.schemaVersion || 0) >= 2 && Boolean(text(item.modalidadeId));

  const reagendadoParaHorarioInicio = normalizeTime(item.reagendadoParaHorarioInicio);
  const reagendadoParaHorarioFim =
    normalizeTime(item.reagendadoParaHorarioFim) ||
    addMinutesToTime(reagendadoParaHorarioInicio, duracao);

  const permissaoCancelamento = calcularPermissaoCancelamentoUsuario(item);
  const permissaoRemarcacao = calcularPermissaoRemarcacaoUsuario(item);
  const prazoCancelamentoHoras = Math.max(
    0,
    Number(isV2 ? item.cancelamentoPrazoHoras : CANCELAMENTO_ANTECEDENCIA_HORAS) || 0
  );
  const prazoRemarcacaoHoras = Math.max(
    0,
    Number(isV2 ? item.remarcacaoPrazoHoras : REMARCACAO_ANTECEDENCIA_HORAS) || 0
  );

  return {
    protocolo: text(item.protocolo || item.title),
    schemaVersion: isV2 ? 2 : 1,
    modalidadeId: text(item.modalidadeId),
    modalidadeFamiliaId: text(item.modalidadeFamiliaId),
    servicoNome: text(item.modalidadeNome),
    ofertaId: text(item.ofertaId),
    ofertaNome: text(item.ofertaNome),
    localId: text(item.localId),
    localNome: text(item.localNome),
    localEndereco: text(item.localEndereco),
    recursoId: text(item.recursoId),
    recursoNome: text(item.recursoNome),

    unidadeSlug: text(item.unidadeSlug),
    unidadeNome: text(item.unidadeNome),

    dataIso,
    dataLabel: text(item.dataLabel) || formatDateLabel(dataIso),

    horarioInicio,
    horarioFim,
    horarioLabel:
      horarioInicio && horarioFim
        ? `${horarioInicio} – ${horarioFim}`
        : horarioInicio,

    nomeAdvogado: text(item.solicitanteNome || item.nomeAdvogado),
    numeroOab: text(item.solicitanteOab || item.numeroOab),
    emailAdvogado: text(item.solicitanteEmail || item.emailAdvogado || item.emailIndex),
    telefoneAdvogado: text(item.solicitanteTelefone || item.telefoneAdvogado),

    nomeIpl: text(item.nomeIpl),
    infopen: text(item.infopen),

    status,
    statusLabel: getStatusLabel(status),

    protocoloOrigem: text(item.protocoloOrigem),
    agendamentoOrigemId: text(item.agendamentoOrigemId),

    reagendadoParaProtocolo: text(item.reagendadoParaProtocolo),
    reagendadoParaDataIso: text(item.reagendadoParaDataIso),
    reagendadoParaDataLabel: text(item.reagendadoParaDataLabel),
    reagendadoParaHorarioInicio,
    reagendadoParaHorarioFim,
    reagendadoParaHorarioLabel:
      reagendadoParaHorarioInicio && reagendadoParaHorarioFim
        ? `${reagendadoParaHorarioInicio} – ${reagendadoParaHorarioFim}`
        : reagendadoParaHorarioInicio,

    podeCancelar: permissaoCancelamento.podeCancelar,
    cancelamentoPermitido: permissaoCancelamento.podeCancelar,
    cancelamentoCodigo: permissaoCancelamento.codigo,
    cancelamentoMensagem: permissaoCancelamento.mensagem,
    prazoCancelamentoHoras,

    podeRemarcar: permissaoRemarcacao.podeRemarcar,
    remarcacaoPermitida: permissaoRemarcacao.podeRemarcar,
    remarcacaoCodigo: permissaoRemarcacao.codigo,
    remarcacaoMensagem: permissaoRemarcacao.mensagem,
    prazoRemarcacaoHoras,
  };
}

function mapAgendamentoAdmin(item) {
  const dataIso = normalizeDateIso(
    item.dataAtendimentoIso ||
      item.dataIso ||
      item.dataAtendimento ||
      item.data
  );

  const horarioInicio = normalizeTime(item.horarioInicio || item.horario);

  const horarioFim =
    normalizeTime(item.horarioFim || item.horarioFinal) ||
    addMinutesToTime(horarioInicio, 30);

  const status = text(item.status || 'agendado').toLowerCase() || 'agendado';
  const isV2 = Number(item.schemaVersion || 0) >= 2 && Boolean(text(item.modalidadeId));
  const solicitanteNome = text(item.solicitanteNome || item.nomeAdvogado);
  const solicitanteOab = text(item.solicitanteOab || item.numeroOab);
  const solicitanteEmail = text(item.solicitanteEmail || item.emailAdvogado || item.emailIndex);
  const solicitanteTelefone = text(item.solicitanteTelefone || item.telefoneAdvogado);

  return {
    _id: item._id,
    protocolo: text(item.protocolo || item.title),

    schemaVersion: isV2 ? 2 : 1,
    modalidadeId: text(item.modalidadeId),
    modalidadeFamiliaId: text(item.modalidadeFamiliaId),
    modalidadeNome: text(item.modalidadeNome),
    servicoNome: text(item.modalidadeNome),
    ofertaId: text(item.ofertaId),
    ofertaNome: text(item.ofertaNome),
    localId: text(item.localId),
    localNome: text(item.localNome),
    localEndereco: text(item.localEndereco),
    recursoId: text(item.recursoId),
    recursoNome: text(item.recursoNome),

    unidadeSlug: text(item.unidadeSlug),
    unidadeNome: text(item.unidadeNome),

    dataIso,
    dataLabel: text(item.dataLabel) || formatDateLabel(dataIso),

    horarioInicio,
    horarioFim,
    horarioLabel:
      horarioInicio && horarioFim
        ? `${horarioInicio} – ${horarioFim}`
        : horarioInicio,

    solicitanteNome,
    nomeAdvogado: solicitanteNome,
    numeroOab: solicitanteOab,
    emailAdvogado: solicitanteEmail,
    telefoneAdvogado: solicitanteTelefone,

    nomeIpl: text(item.nomeIpl),
    infopen: text(item.infopen),

    status,
    statusLabel: getStatusLabel(status),

    protocoloOrigem: text(item.protocoloOrigem),
    agendamentoOrigemId: text(item.agendamentoOrigemId),

    reagendadoEm: item.reagendadoEm || null,
    reagendadoParaId: text(item.reagendadoParaId),
    reagendadoParaProtocolo: text(item.reagendadoParaProtocolo),
    reagendadoParaDataIso: text(item.reagendadoParaDataIso),
    reagendadoParaDataLabel: text(item.reagendadoParaDataLabel),
    reagendadoParaHorarioInicio: text(item.reagendadoParaHorarioInicio),
    reagendadoParaHorarioFim: text(item.reagendadoParaHorarioFim),

    criadoEm: item.criadoEm || item._createdDate || null,
    atualizadoEm: item.atualizadoEm || item._updatedDate || null,
    canceladoEm: item.canceladoEm || null,
  };
}


function documentoMatchesBusca(item, buscaNormalizada) {
  if (!buscaNormalizada) return true;

  const haystack = normalizeSearch(
    [
      item.protocolo,
      item.unidadeNome,
      item.nomeAdvogado,
      item.numeroOab,
      item.emailAdvogado,
      item.telefoneAdvogado,
      item.nomeIpl,
      item.infopen,
      item.tipoDocumentoLabel,
      item.arquivoPrincipalNome,
      item.statusLabel,
      item.mensagemErro,
      item.emailAdvogadoDestino,
      item.unidadeEmailDestino,
    ].join(' ')
  );

  return haystack.includes(buscaNormalizada);
}

function agendamentoMatchesBusca(item, buscaNormalizada) {
  if (!buscaNormalizada) return true;

  const haystack = normalizeSearch(
    [
      item.protocolo,
      item.unidadeNome,
      item.nomeAdvogado,
      item.numeroOab,
      item.emailAdvogado,
      item.telefoneAdvogado,
      item.nomeIpl,
      item.infopen,
      item.statusLabel,
      item.protocoloOrigem,
      item.reagendadoParaProtocolo,
    ].join(' ')
  );

  return haystack.includes(buscaNormalizada);
}

function statusOcupaAgenda(status) {
  return text(status || 'agendado').toLowerCase() === 'agendado';
}

async function existeAgendamentoAtivoConflitante(dados, ignorarAgendamentoId = '') {
  const slotKey = montarSlotKey(
    dados.unidadeSlug,
    dados.dataIso,
    dados.horarioInicio
  );

  const porSlot = await wixData
    .query(COL.AGENDAMENTOS)
    .eq('slotKey', slotKey)
    .limit(50)
    .find({ suppressAuth: true });

  const conflitosPorSlot = (porSlot.items || []).filter((item) => {
    if (text(item._id) === text(ignorarAgendamentoId)) return false;
    return statusOcupaAgenda(item.status);
  });

  if (conflitosPorSlot.length > 0) {
    return true;
  }

  const porCampos = await wixData
    .query(COL.AGENDAMENTOS)
    .eq('unidadeSlug', dados.unidadeSlug)
    .eq('dataAtendimentoIso', dados.dataIso)
    .eq('horarioInicio', dados.horarioInicio)
    .limit(50)
    .find({ suppressAuth: true });

  const conflitosPorCampos = (porCampos.items || []).filter((item) => {
    if (text(item._id) === text(ignorarAgendamentoId)) return false;
    return statusOcupaAgenda(item.status);
  });

  return conflitosPorCampos.length > 0;
}

function montarSlotKey(unidadeSlug, dataIso, horarioInicio) {
  return `${unidadeSlug}|${dataIso}|${horarioInicio}`;
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


function normalizarDocumentoStatusPrincipal(status) {
  const s = text(status || 'recebido').toLowerCase();

  if (s === 'concluido' || s === 'concluído') {
    return 'concluido';
  }

  if (s === 'com_erro' || s === 'erro') {
    return 'com_erro';
  }

  // "enviado_unidade" é apenas um indicador técnico de envio.
  // Para o cliente, o status principal continua sendo "Recebido".
  return 'recebido';
}

function getDocumentoStatusLabel(status) {
  const s = normalizarDocumentoStatusPrincipal(status);

  const labels = {
    recebido: 'Recebido',
    concluido: 'Concluído',
    com_erro: 'Com erro',
  };

  return labels[s] || 'Recebido';
}

function getTipoDocumentoLabel(tipo) {
  const t = text(tipo).toLowerCase();

  const labels = {
    procuracao: 'Procuração',
    documento_complementar: 'Formulário/documento para assinatura',
    outro: 'Outro documento',
  };

  return labels[t] || tipo || 'Documento';
}

function asBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  const v = text(value).toLowerCase();

  return v === 'true' || v === '1' || v === 'sim' || v === 'yes';
}

function dateTimeToIso(value) {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return text(value);
}

function formatDateTimeLabel(value) {
  const iso = dateTimeToIso(value);

  if (!iso) return '';

  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) return text(value);

  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mi = String(parsed.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function normalizarArquivoUrlParaAdmin(url) {
  const value = text(url);

  if (!value) return '';

  if (isHttpUrl(value)) {
    return value;
  }

  if (value.startsWith('wix:image://v1/')) {
    const media = extrairWixMediaParts(value);

    if (media.fileId) {
      return `https://static.wixstatic.com/media/${media.fileId}`;
    }
  }

  if (value.startsWith('wix:document://v1/')) {
    const media = extrairWixMediaParts(value);

    if (media.fileId) {
      const downloadName = media.fileName
        ? `?dn=${encodeURIComponent(media.fileName)}`
        : '';

      return `https://static.wixstatic.com/ugd/${media.fileId}${downloadName}`;
    }
  }

  if (value.startsWith('wix:video://v1/')) {
    const media = extrairWixMediaParts(value);

    if (media.fileId) {
      return `https://video.wixstatic.com/video/${media.fileId}`;
    }
  }

  return '';
}

function extrairWixMediaParts(value) {
  const semHash = text(value).split('#')[0];
  const semPrefixo = semHash.replace(/^wix:[a-z]+:\/\/v1\//i, '');
  const partes = semPrefixo.split('/').filter(Boolean);

  const fileId = partes[0] || '';
  const fileName =
    partes.length > 1 ? decodeURIComponentSafe(partes.slice(1).join('/')) : '';

  return {
    fileId,
    fileName,
  };
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(text(value));
}

function getStatusLabel(status) {
  const s = text(status || 'agendado').toLowerCase();

  const labels = {
    agendado: 'Agendado',
    cancelado: 'Cancelado',
    realizado: 'Realizado',
    reagendado: 'Reagendado',
  };

  return labels[s] || status || 'Agendado';
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

  if (!/^\d{2}:\d{2}$/.test(horario)) return '';

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(dataIso))) return null;

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

function formatDateLabel(dataIso) {
  const diaSemana = formatWeekday(dataIso);
  const diaMes = formatDayMonth(dataIso);

  if (!diaSemana || !diaMes) return text(dataIso);

  return `${diaSemana}, ${diaMes}`;
}


function calcularPermissaoCancelamentoUsuario(item) {
  const status = text(item.status || 'agendado').toLowerCase() || 'agendado';

  if (status === 'cancelado') {
    return {
      podeCancelar: false,
      codigo: 'JA_CANCELADO',
      mensagem: 'Este agendamento já está cancelado.',
    };
  }

  if (status === 'reagendado' || status === 'remarcado') {
    return {
      podeCancelar: false,
      codigo: 'JA_REAGENDADO',
      mensagem: 'Este agendamento foi reagendado. Consulte o novo protocolo para acompanhar os dados atualizados.',
    };
  }

  if (status === 'realizado' || status === 'concluido' || status === 'concluído') {
    return {
      podeCancelar: false,
      codigo: 'ATENDIMENTO_REALIZADO',
      mensagem: 'Este atendimento já foi realizado e não pode ser cancelado pela Central.',
    };
  }

  if (status !== 'agendado' && status !== 'confirmado') {
    return {
      podeCancelar: false,
      codigo: 'STATUS_INVALIDO',
      mensagem: 'Este agendamento não pode ser cancelado pela Central.',
    };
  }

  const atendimento = montarDataHoraAtendimento(item);

  if (!atendimento) {
    return {
      podeCancelar: false,
      codigo: 'DATA_INVALIDA',
      mensagem: 'Não foi possível validar o prazo de cancelamento deste agendamento.',
    };
  }

  const agora = nowSaoPauloPseudoDate();
  const diffMs = atendimento.getTime() - agora.getTime();
  const prazoHoras = Math.max(
    0,
    Number(
      Number(item.schemaVersion || 0) >= 2
        ? item.cancelamentoPrazoHoras
        : CANCELAMENTO_ANTECEDENCIA_HORAS
    ) || 0
  );
  const prazoMs = prazoHoras * 60 * 60 * 1000;

  if (diffMs <= 0) {
    return {
      podeCancelar: false,
      codigo: 'ATENDIMENTO_PASSADO',
      mensagem: 'Este agendamento já passou e não pode ser cancelado pela Central.',
    };
  }

  if (diffMs < prazoMs) {
    return {
      podeCancelar: false,
      codigo: 'PRAZO_ENCERRADO',
      mensagem: `O cancelamento pela Central está disponível até ${prazoHoras} horas antes do horário agendado.`,
    };
  }

  return {
    podeCancelar: true,
    codigo: 'PODE_CANCELAR',
    mensagem: 'Este agendamento pode ser cancelado pela Central.',
  };
}


function calcularPermissaoRemarcacaoUsuario(item) {
  const status = text(item.status || 'agendado').toLowerCase() || 'agendado';

  if (status === 'cancelado') {
    return {
      podeRemarcar: false,
      codigo: 'JA_CANCELADO',
      mensagem: 'Este agendamento está cancelado e não pode ser remarcado pela Central.',
    };
  }

  if (status === 'reagendado' || status === 'remarcado') {
    return {
      podeRemarcar: false,
      codigo: 'JA_REAGENDADO',
      mensagem: 'Este agendamento já foi reagendado. Consulte o novo protocolo para acompanhar os dados atualizados.',
    };
  }

  if (status === 'realizado' || status === 'concluido' || status === 'concluído') {
    return {
      podeRemarcar: false,
      codigo: 'ATENDIMENTO_REALIZADO',
      mensagem: 'Este atendimento já foi realizado e não pode ser remarcado pela Central.',
    };
  }

  if (status !== 'agendado' && status !== 'confirmado') {
    return {
      podeRemarcar: false,
      codigo: 'STATUS_INVALIDO',
      mensagem: 'Este agendamento não pode ser remarcado pela Central.',
    };
  }

  const atendimento = montarDataHoraAtendimento(item);

  if (!atendimento) {
    return {
      podeRemarcar: false,
      codigo: 'DATA_INVALIDA',
      mensagem: 'Não foi possível validar o prazo de remarcação deste agendamento.',
    };
  }

  const agora = nowSaoPauloPseudoDate();
  const diffMs = atendimento.getTime() - agora.getTime();
  const prazoHoras = Math.max(
    0,
    Number(
      Number(item.schemaVersion || 0) >= 2
        ? item.remarcacaoPrazoHoras
        : REMARCACAO_ANTECEDENCIA_HORAS
    ) || 0
  );
  const prazoMs = prazoHoras * 60 * 60 * 1000;

  if (diffMs <= 0) {
    return {
      podeRemarcar: false,
      codigo: 'ATENDIMENTO_PASSADO',
      mensagem: 'Este agendamento já passou e não pode ser remarcado pela Central.',
    };
  }

  if (diffMs < prazoMs) {
    return {
      podeRemarcar: false,
      codigo: 'PRAZO_ENCERRADO',
      mensagem: `A remarcação pela Central está disponível até ${prazoHoras} horas antes do horário agendado.`,
    };
  }

  return {
    podeRemarcar: true,
    codigo: 'PODE_REMARCAR',
    mensagem: 'Este agendamento pode ser remarcado pela Central.',
  };
}

function montarDataHoraAtendimento(item) {
  const dataIso = normalizeDateIso(
    item.dataAtendimentoIso ||
      item.dataIso ||
      item.dataAtendimento ||
      item.data
  );

  const horarioInicio = normalizeTime(item.horarioInicio || item.horario);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso) || !/^\d{2}:\d{2}$/.test(horarioInicio)) {
    return null;
  }

  const [yyyy, mm, dd] = dataIso.split('-').map(Number);
  const [hh, mi] = horarioInicio.split(':').map(Number);

  return new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
}

function nowSaoPauloPseudoDate() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());

    const map = {};
    parts.forEach((part) => {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    });

    let hour = Number(map.hour || 0);
    if (hour === 24) hour = 0;

    return new Date(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      hour,
      Number(map.minute || 0),
      Number(map.second || 0),
      0
    );
  } catch (err) {
    return new Date();
  }
}


function normalizeProtocol(value) {
  return text(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text(value));
}

function normalizeSearch(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}