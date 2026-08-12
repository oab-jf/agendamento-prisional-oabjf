import wixData from 'wix-data';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

const COL = {
  UNIDADES: 'Import4258',
  AGENDAMENTOS: 'Import4259',
  BLOQUEIOS: 'Import4256',
  ENVIOS: 'EnviosListas',
  CONFIG: 'ConfiguracoesCentral',
};

const CONFIG_CHAVE = 'envios-listas';
const TIMEZONE = 'America/Sao_Paulo';
const HORARIO_BRASILIA = '17:00';
const INFOBIP_EMAIL_ENDPOINT = '/email/3/send';
const MAX_RESULTS = 250;
const MOTIVO_ATUALIZACAO_EMAILS = 'incluir_emails_advogados';

/**
 * Job principal: executado diariamente às 20:00 UTC (17:00 em Brasília).
 * O job respeita a chave `enviosAtivos` em ConfiguracoesCentral.
 */
export async function executarEnvioListasDiariasJob() {
  return executarLoteEnviosListas({
    modo: 'automatico',
    origem: 'job-diario-17h',
    respeitarConfiguracaoAtiva: true,
  });
}

/**
 * Segunda tentativa automática, uma hora após o envio principal.
 * Reprocessa apenas unidades cujo envio automático da mesma data falhou.
 */
export async function reprocessarFalhasListasDiariasJob() {
  return executarLoteEnviosListas({
    modo: 'automatico',
    origem: 'job-reprocessamento-18h',
    respeitarConfiguracaoAtiva: true,
    somenteFalhas: true,
  });
}

export async function obterConfiguracaoEnviosListasCore() {
  const config = await obterOuCriarConfiguracao();
  return {
    ok: true,
    configuracao: mapConfiguracao(config),
  };
}

export async function atualizarConfiguracaoEnviosListasCore(payload = {}, solicitadoPor = '') {
  const atual = await obterOuCriarConfiguracao();
  const agora = new Date();
  const ativandoAgora = payload.enviosAtivos === true && atual.enviosAtivos !== true;

  if (ativandoAgora && !(await existeTesteEnvioBemSucedido())) {
    return {
      ok: false,
      codigo: 'TESTE_OBRIGATORIO',
      mensagem: 'Envie e confirme pelo menos um e-mail de teste antes de ativar os envios automáticos.',
      configuracao: mapConfiguracao(atual),
    };
  }

  const atualizado = {
    ...atual,
    title: 'Envio diário de listas',
    chave: CONFIG_CHAVE,
    enviosAtivos:
      typeof payload.enviosAtivos === 'boolean' ? payload.enviosAtivos : atual.enviosAtivos === true,
    horarioBrasilia: HORARIO_BRASILIA,
    timezone: TIMEZONE,
    enviarListaVazia: true,
    usarProximoDiaUtil: true,
    emailAlertaOperacional:
      payload.emailAlertaOperacional !== undefined
        ? normalizeEmail(payload.emailAlertaOperacional)
        : normalizeEmail(atual.emailAlertaOperacional),
    atualizadoEm: agora,
    atualizadoPor: text(solicitadoPor) || 'painel-admin',
  };

  if (atual._id) {
    const salvo = await wixData.update(COL.CONFIG, atualizado, { suppressAuth: true });
    return { ok: true, configuracao: mapConfiguracao(salvo), mensagem: 'Configuração atualizada.' };
  }

  const salvo = await wixData.insert(COL.CONFIG, {
    ...atualizado,
    criadoEm: agora,
  }, { suppressAuth: true });

  return { ok: true, configuracao: mapConfiguracao(salvo), mensagem: 'Configuração criada.' };
}

export async function listarEnviosListasCore(filtros = {}) {
  const status = text(filtros.status).toLowerCase();
  const modo = text(filtros.modo).toLowerCase();
  const unidadeSlug = normalizarSlug(filtros.unidadeSlug || filtros.unidade);
  const dataIso = normalizarDataIso(filtros.dataIso || filtros.dataAtendimentosIso || filtros.data);
  const busca = normalizeSearch(filtros.busca || filtros.q || filtros.search);

  let query = wixData.query(COL.ENVIOS).descending('criadoEm').limit(MAX_RESULTS);

  if (status && status !== 'todos') query = query.eq('status', status);
  if (modo && modo !== 'todos') query = query.eq('modo', modo);
  if (unidadeSlug && unidadeSlug !== 'todas') query = query.eq('unidadeSlug', unidadeSlug);
  if (dataIso) query = query.eq('dataAtendimentosIso', dataIso);

  const result = await query.find({ suppressAuth: true });
  let envios = (result.items || []).map(mapEnvio);

  if (busca) {
    envios = envios.filter((item) =>
      normalizeSearch([
        item.unidadeNome,
        item.unidadeSlug,
        item.emailDestino,
        item.status,
        item.modo,
        item.mensagemErro,
        item.assunto,
      ].join(' ')).includes(busca),
    );
  }

  const configuracao = await obterOuCriarConfiguracao();
  const proximaDataAlvoIso = await determinarProximoDiaUtil();

  return {
    ok: true,
    total: envios.length,
    envios,
    configuracao: mapConfiguracao(configuracao),
    proximaDataAlvoIso,
    proximaDataAlvoLabel: formatDateBr(proximaDataAlvoIso),
  };
}

export async function testarEnvioListaCore(payload = {}, solicitadoPor = '') {
  const unidadeSlug = normalizarSlug(payload.unidadeSlug || payload.unidade);
  const emailTeste = normalizeEmail(payload.emailTeste || payload.emailDestino || payload.email);
  const dataAlvoIso = normalizarDataIso(payload.dataAlvoIso || payload.dataIso || payload.data)
    || await determinarProximoDiaUtil();

  if (!unidadeSlug) {
    return { ok: false, codigo: 'UNIDADE_OBRIGATORIA', mensagem: 'Selecione a unidade do teste.' };
  }

  if (!isValidEmail(emailTeste)) {
    return { ok: false, codigo: 'EMAIL_TESTE_INVALIDO', mensagem: 'Informe um e-mail válido para o teste.' };
  }

  if (!isDataIsoValida(dataAlvoIso)) {
    return { ok: false, codigo: 'DATA_INVALIDA', mensagem: 'Informe uma data válida para o teste.' };
  }

  const unidade = await buscarUnidadeAtivaPorSlug(unidadeSlug);
  if (!unidade) {
    return { ok: false, codigo: 'UNIDADE_NAO_ENCONTRADA', mensagem: 'Unidade ativa não encontrada.' };
  }

  const resultado = await enviarListaParaUnidade({
    unidade,
    dataAlvoIso,
    modo: 'teste',
    emailOverride: emailTeste,
    solicitadoPor: text(solicitadoPor) || 'painel-admin',
    origem: 'teste-manual',
    forcar: true,
  });

  return {
    ...resultado,
    mensagem: resultado.ok
      ? `E-mail de teste enviado para ${emailTeste}.`
      : resultado.mensagem,
  };
}

export async function executarEnvioListasAgoraCore(payload = {}, solicitadoPor = '') {
  const dataAlvoIso = normalizarDataIso(payload.dataAlvoIso || payload.dataIso || payload.data)
    || await determinarProximoDiaUtil();

  if (!isDataIsoValida(dataAlvoIso)) {
    return { ok: false, codigo: 'DATA_INVALIDA', mensagem: 'Informe uma data válida.' };
  }

  return executarLoteEnviosListas({
    dataAlvoIso,
    unidadeSlug: normalizarSlug(payload.unidadeSlug || payload.unidade),
    modo: 'manual',
    origem: 'execucao-manual',
    solicitadoPor: text(solicitadoPor) || 'painel-admin',
    respeitarConfiguracaoAtiva: false,
    forcar: payload.forcar === true,
  });
}

export async function reenviarListaCore(payload = {}, solicitadoPor = '') {
  const envioId = text(payload.envioId || payload._id || payload.id);
  const motivoAtualizacao = normalizarMotivoAtualizacao(
    payload.motivoAtualizacao || payload.motivo || payload.contextoAtualizacao,
  );

  if (!envioId) {
    return { ok: false, codigo: 'ID_OBRIGATORIO', mensagem: 'Envio não identificado.' };
  }

  let envio;
  try {
    envio = await wixData.get(COL.ENVIOS, envioId, { suppressAuth: true });
  } catch (err) {
    envio = null;
  }

  if (!envio || !envio._id) {
    return { ok: false, codigo: 'NAO_ENCONTRADO', mensagem: 'Registro de envio não encontrado.' };
  }

  const unidade = await buscarUnidadeAtivaPorSlug(envio.unidadeSlug);
  if (!unidade) {
    return { ok: false, codigo: 'UNIDADE_NAO_ENCONTRADA', mensagem: 'Unidade ativa não encontrada.' };
  }

  return enviarListaParaUnidade({
    unidade,
    dataAlvoIso: normalizarDataIso(envio.dataAtendimentosIso),
    modo: 'manual',
    solicitadoPor: text(solicitadoPor) || 'painel-admin',
    origem: `reenvio:${envioId}`,
    motivoAtualizacao,
    forcar: true,
  });
}

export async function executarLoteEnviosListas(options = {}) {
  const configuracao = await obterOuCriarConfiguracao();
  const modo = text(options.modo || 'automatico').toLowerCase();
  const respeitarConfiguracaoAtiva = options.respeitarConfiguracaoAtiva !== false;

  if (modo === 'automatico' && respeitarConfiguracaoAtiva && configuracao.enviosAtivos !== true) {
    return {
      ok: true,
      executado: false,
      codigo: 'ENVIOS_PAUSADOS',
      mensagem: 'O envio automático de listas está pausado.',
      configuracao: mapConfiguracao(configuracao),
    };
  }

  const dataAlvoIso = normalizarDataIso(options.dataAlvoIso) || await determinarProximoDiaUtil();

  if (!isDataIsoValida(dataAlvoIso)) {
    return { ok: false, codigo: 'DATA_INVALIDA', mensagem: 'Não foi possível determinar a data-alvo.' };
  }

  const unidades = await listarUnidadesAtivas();
  const filtroSlug = normalizarSlug(options.unidadeSlug);
  const unidadesAlvo = filtroSlug
    ? unidades.filter((unidade) => unidade.slug === filtroSlug)
    : unidades;

  if (!unidadesAlvo.length) {
    return {
      ok: false,
      codigo: filtroSlug ? 'UNIDADE_NAO_ENCONTRADA' : 'SEM_UNIDADES_ATIVAS',
      mensagem: filtroSlug ? 'Unidade ativa não encontrada.' : 'Nenhuma unidade ativa foi encontrada.',
    };
  }

  const resultados = [];

  for (const unidade of unidadesAlvo) {
    if (options.somenteFalhas === true) {
      const anterior = await buscarEnvioAutomatico(unidade.slug, dataAlvoIso);
      if (!anterior || anterior.status === 'enviado') {
        resultados.push({
          ok: true,
          ignorado: true,
          unidadeSlug: unidade.slug,
          unidadeNome: unidade.nome,
          codigo: anterior?.status === 'enviado' ? 'JA_ENVIADO' : 'SEM_FALHA_ANTERIOR',
        });
        continue;
      }
    }

    const resultado = await enviarListaParaUnidade({
      unidade,
      dataAlvoIso,
      modo,
      solicitadoPor: text(options.solicitadoPor) || text(options.origem) || 'sistema',
      origem: text(options.origem) || modo,
      forcar: options.forcar === true || options.somenteFalhas === true,
    });

    resultados.push(resultado);
  }

  const resumo = resumirResultados(resultados);
  const okGeral = resumo.erros === 0 && resumo.semDestinatario === 0;

  if (modo === 'automatico') {
    await atualizarUltimaExecucaoConfiguracao(configuracao, {
      dataAlvoIso,
      status: okGeral ? 'concluido' : resumo.enviados > 0 ? 'concluido_com_erros' : 'erro',
      mensagem: montarMensagemResumo(resumo, dataAlvoIso),
      solicitadoPor: text(options.origem) || 'job',
    });
  }

  return {
    ok: okGeral,
    executado: true,
    dataAlvoIso,
    dataAlvoLabel: formatDateBr(dataAlvoIso),
    resumo,
    resultados,
    mensagem: montarMensagemResumo(resumo, dataAlvoIso),
  };
}

async function enviarListaParaUnidade({
  unidade,
  dataAlvoIso,
  modo,
  emailOverride = '',
  solicitadoPor = '',
  origem = '',
  motivoAtualizacao = '',
  forcar = false,
}) {
  const dataLabel = formatDateBr(dataAlvoIso);
  const emailDestino = normalizeEmail(emailOverride || unidade.emailListas);
  const agendamentos = await listarAgendamentosValidos(unidade.slug, dataAlvoIso);
  const conteudoBase = JSON.stringify(agendamentos.map((item) => ({
    protocolo: text(item.protocolo),
    horarioInicio: text(item.horarioInicio),
    horarioFim: text(item.horarioFim),
    nomeAdvogado: text(item.nomeAdvogado),
    numeroOab: text(item.numeroOab),
    emailAdvogado: obterEmailAdvogado(item),
    nomeIpl: text(item.nomeIpl),
    infopen: text(item.infopen),
  })));
  const conteudoHash = hashTexto(`${unidade.slug}|${dataAlvoIso}|${conteudoBase}`);
  const chaveIdempotencia = modo === 'automatico'
    ? `lista:${dataAlvoIso}:${unidade.slug}:automatico:${conteudoHash}`
    : `lista:${dataAlvoIso}:${unidade.slug}:${modo}:${Date.now()}`;

  let registroExistente = null;
  let envioAutomaticoAnterior = null;

  if (modo === 'automatico') {
    registroExistente = await buscarEnvioPorChave(chaveIdempotencia);

    if (registroExistente?.status === 'enviado' && !forcar) {
      return {
        ok: true,
        ignorado: true,
        codigo: 'JA_ENVIADO',
        unidadeSlug: unidade.slug,
        unidadeNome: unidade.nome,
        dataAlvoIso,
        envio: mapEnvio(registroExistente),
      };
    }

    envioAutomaticoAnterior = await buscarUltimoEnvioAutomatico(unidade.slug, dataAlvoIso, 'enviado');
  }

  const listaAtualizada =
    (modo === 'automatico' && envioAutomaticoAnterior && envioAutomaticoAnterior.conteudoHash !== conteudoHash)
    || (modo === 'manual' && text(origem).startsWith('reenvio:'));
  const atualizacaoEmails = motivoAtualizacao === MOTIVO_ATUALIZACAO_EMAILS;
  const assuntoBase = atualizacaoEmails
    ? `Lista atualizada com e-mails para envio dos links — ${unidade.nome} — ${dataLabel}`
    : `${listaAtualizada ? 'Lista atualizada' : 'Lista de atendimentos'} — ${unidade.nome} — ${dataLabel}`;
  const assunto = modo === 'teste' ? `[TESTE] ${assuntoBase}` : assuntoBase;
  const agora = new Date();
  const tentativas = Number(registroExistente?.tentativas || 0) + 1;

  const baseRegistro = {
    ...(registroExistente || {}),
    title: `${unidade.nome} — ${dataLabel} — ${modo}`,
    unidadeSlug: unidade.slug,
    unidadeNome: unidade.nome,
    emailDestino,
    dataAtendimentosIso: dataAlvoIso,
    dataAtendimentosLabel: dataLabel,
    totalAgendamentos: agendamentos.length,
    status: 'processando',
    modo,
    tentativas,
    chaveIdempotencia,
    conteudoHash,
    assunto,
    mensagemErro: '',
    provider: 'infobip',
    providerMessageId: '',
    protocolosJson: JSON.stringify(agendamentos.map((item) => text(item.protocolo)).filter(Boolean)),
    solicitadoPor: text(solicitadoPor || origem || 'sistema'),
    iniciadoEm: agora,
    enviadoEm: null,
    finalizadoEm: null,
    criadoEm: registroExistente?.criadoEm || registroExistente?._createdDate || agora,
    atualizadoEm: agora,
  };

  const registro = await salvarRegistroEnvio(baseRegistro);

  if (!isValidEmail(emailDestino)) {
    const final = await finalizarRegistroEnvio(registro, {
      status: 'sem_destinatario',
      mensagemErro: 'A unidade não possui e-mail válido para recebimento das listas.',
    });

    return {
      ok: false,
      codigo: 'SEM_DESTINATARIO',
      mensagem: 'A unidade não possui e-mail válido para recebimento das listas.',
      unidadeSlug: unidade.slug,
      unidadeNome: unidade.nome,
      dataAlvoIso,
      envio: mapEnvio(final),
    };
  }

  const email = montarEmailLista({
    unidade,
    dataAlvoIso,
    dataLabel,
    agendamentos,
    modo,
    motivoAtualizacao,
  });

  let config;
  try {
    config = await carregarConfigInfobip();
  } catch (err) {
    const mensagem = normalizarMensagemErro(err);
    const final = await finalizarRegistroEnvio(registro, {
      status: 'erro',
      mensagemErro: mensagem,
    });

    return {
      ok: false,
      codigo: 'CONFIG_INFOBIP_INCOMPLETA',
      mensagem,
      unidadeSlug: unidade.slug,
      unidadeNome: unidade.nome,
      dataAlvoIso,
      envio: mapEnvio(final),
    };
  }

  const envio = await enviarEmailInfobip({
    config,
    to: emailDestino,
    subject: assunto,
    textBody: email.textBody,
    htmlBody: email.htmlBody,
  });

  if (!envio.ok) {
    const final = await finalizarRegistroEnvio(registro, {
      status: 'erro',
      mensagemErro: envio.mensagem || 'Falha no envio pela Infobip.',
      providerMessageId: text(envio.messageId),
    });

    return {
      ok: false,
      codigo: 'EMAIL_NAO_ENVIADO',
      mensagem: envio.mensagem || 'Não foi possível enviar a lista.',
      unidadeSlug: unidade.slug,
      unidadeNome: unidade.nome,
      dataAlvoIso,
      envio: mapEnvio(final),
    };
  }

  const final = await finalizarRegistroEnvio(registro, {
    status: 'enviado',
    mensagemErro: '',
    providerMessageId: text(envio.messageId),
    enviadoEm: new Date(),
  });

  if (modo !== 'teste' && agendamentos.length) {
    await marcarAgendamentosComoEnviadosSemFalhar(agendamentos, final.enviadoEm || new Date());
  }

  return {
    ok: true,
    mensagem: agendamentos.length
      ? `Lista enviada para ${unidade.nome}.`
      : `Lista vazia enviada para ${unidade.nome}.`,
    unidadeSlug: unidade.slug,
    unidadeNome: unidade.nome,
    emailDestino,
    dataAlvoIso,
    totalAgendamentos: agendamentos.length,
    envio: mapEnvio(final),
  };
}

async function listarUnidadesAtivas() {
  const result = await wixData.query(COL.UNIDADES).limit(MAX_RESULTS).find({ suppressAuth: true });

  return (result.items || [])
    .map(mapUnidade)
    .filter((unidade) => unidade.ativa && unidade.receberListaDiaria && unidade.slug && unidade.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function buscarUnidadeAtivaPorSlug(slug) {
  const unidades = await listarUnidadesAtivas();
  return unidades.find((unidade) => unidade.slug === normalizarSlug(slug)) || null;
}

function mapUnidade(item = {}) {
  const slug = normalizarSlug(item.slug || item.codigo || item.id || item.unidadeSlug);
  const nome = text(item.nome || item.title || item.unidadeNome || slug);
  const ativa = item.ativa !== false && item.ativo !== false;
  const emailListas = normalizeEmail(
    item.emailRecebimentoListas || item.emailListas || item.emailLista,
  );

  return {
    _id: text(item._id),
    slug,
    nome,
    ativa,
    receberListaDiaria: item.receberListaDiaria !== false,
    emailListas,
  };
}

async function listarAgendamentosValidos(unidadeSlug, dataAlvoIso) {
  const porCampoPrincipal = await wixData
    .query(COL.AGENDAMENTOS)
    .eq('unidadeSlug', unidadeSlug)
    .eq('dataAtendimentoIso', dataAlvoIso)
    .limit(MAX_RESULTS)
    .find({ suppressAuth: true });

  let items = porCampoPrincipal.items || [];

  if (!items.length) {
    const porSlotKey = await wixData
      .query(COL.AGENDAMENTOS)
      .eq('unidadeSlug', unidadeSlug)
      .startsWith('slotKey', `${unidadeSlug}|${dataAlvoIso}|`)
      .limit(MAX_RESULTS)
      .find({ suppressAuth: true });
    items = porSlotKey.items || [];
  }

  if (!items.length) {
    const legado = await wixData
      .query(COL.AGENDAMENTOS)
      .eq('unidadeSlug', unidadeSlug)
      .eq('dataAtendimento', dataAlvoIso)
      .limit(MAX_RESULTS)
      .find({ suppressAuth: true });
    items = legado.items || [];
  }

  return items
    .filter((item) => normalizarStatusAgendamento(item.status) === 'agendado')
    .sort((a, b) => {
      const horario = text(a.horarioInicio).localeCompare(text(b.horarioInicio));
      if (horario !== 0) return horario;
      return text(a.nomeAdvogado).localeCompare(text(b.nomeAdvogado), 'pt-BR');
    });
}

function normalizarStatusAgendamento(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

async function determinarProximoDiaUtil() {
  const hoje = obterDataLocalIso(new Date(), TIMEZONE);
  let cursor = adicionarDiasIso(hoje, 1);

  for (let i = 0; i < 45; i += 1) {
    if (!ehFimDeSemana(cursor) && !(await estaBloqueadoGlobalmenteDiaInteiro(cursor))) {
      return cursor;
    }
    cursor = adicionarDiasIso(cursor, 1);
  }

  return adicionarDiasIso(hoje, 1);
}

async function estaBloqueadoGlobalmenteDiaInteiro(dataIso) {
  try {
    const result = await wixData.query(COL.BLOQUEIOS).limit(MAX_RESULTS).find({ suppressAuth: true });

    return (result.items || []).some((item) => {
      const ativo = item.ativo !== false && item.ativa !== false && text(item.status).toLowerCase() !== 'inativo';
      const escopo = text(item.escopo || item.scope).toLowerCase();
      const todas = item.todasUnidades === true || escopo === 'todas' || text(item.unidadeSlug) === 'todas';
      const tipo = text(item.tipo || item.tipoBloqueio).toLowerCase();
      const diaInteiro = item.diaInteiro === true || tipo === 'dia_inteiro' || tipo === 'intervalo_datas' || !text(item.horarioInicio);
      const inicio = normalizarDataIso(item.dataInicio || item.inicioData || item.dataIso || item.data);
      const fim = normalizarDataIso(item.dataFim || item.fimData || item.dataFinal || inicio);
      return ativo && todas && diaInteiro && inicio && fim && dataIso >= inicio && dataIso <= fim;
    });
  } catch (err) {
    console.warn('Não foi possível verificar bloqueios globais ao calcular o próximo dia útil.', err);
    return false;
  }
}

function montarEmailLista({
  unidade,
  dataAlvoIso,
  dataLabel,
  agendamentos,
  modo,
  motivoAtualizacao = '',
}) {
  const total = agendamentos.length;
  const totalSemEmail = agendamentos.filter((item) => !obterEmailAdvogado(item)).length;
  const avisoSemEmailTexto = totalSemEmail
    ? `ATENÇÃO: ${totalSemEmail} ${totalSemEmail === 1 ? 'agendamento está' : 'agendamentos estão'} sem e-mail válido para envio do link.`
    : '';
  const atualizacaoEmails = motivoAtualizacao === MOTIVO_ATUALIZACAO_EMAILS;
  const contextoAtualizacaoTexto = atualizacaoEmails
    ? 'ATUALIZAÇÃO: esta mensagem substitui a lista enviada anteriormente. O reenvio está sendo realizado para incluir os e-mails dos(as) advogados(as), necessários ao envio dos links de acesso aos atendimentos.'
    : '';

  const linhasTexto = agendamentos.length
    ? agendamentos.map((item) => {
        const emailAdvogado = obterEmailAdvogado(item);

        return [
          `${formatarHorario(item)} — ${text(item.nomeAdvogado)}`,
          `OAB: ${text(item.numeroOab) || '—'}`,
          `E-mail para envio do link: ${emailAdvogado || 'E-mail não informado'}`,
          `IPL: ${text(item.nomeIpl) || '—'}`,
          `INFOPEN: ${text(item.infopen) || '—'}`,
          `Protocolo: ${text(item.protocolo) || '—'}`,
        ].join(' | ');
      })
    : ['Não há atendimentos agendados para esta data.'];

  const textBody = [
    modo === 'teste' ? 'ENVIO DE TESTE' : '',
    'OAB Juiz de Fora — Central de Agendamento Prisional',
    '',
    `Unidade: ${unidade.nome}`,
    `Data dos atendimentos: ${dataLabel}`,
    `Total de agendamentos: ${total}`,
    '',
    contextoAtualizacaoTexto,
    '',
    'Utilize o e-mail informado exclusivamente para o envio do link e para comunicações diretamente relacionadas a este atendimento.',
    avisoSemEmailTexto,
    '',
    ...linhasTexto,
    '',
    'Esta lista considera apenas agendamentos com status Agendado no momento do envio.',
    'Cancelamentos ou remarcações posteriores exigem o reenvio de uma lista atualizada.',
  ].filter(Boolean).join('\n');

  const rows = agendamentos.map((item) => {
    const emailAdvogado = obterEmailAdvogado(item);
    const emailHtml = emailAdvogado
      ? `<a href="mailto:${escapeHtml(emailAdvogado)}" style="color:#274c77;text-decoration:underline">${escapeHtml(emailAdvogado)}</a>`
      : '<strong style="color:#9f2d2d">E-mail não informado</strong>';

    return `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd3c5;white-space:nowrap">${escapeHtml(formatarHorario(item))}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd3c5">${escapeHtml(text(item.nomeAdvogado) || '—')}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd3c5;white-space:nowrap">${escapeHtml(text(item.numeroOab) || '—')}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd3c5">${emailHtml}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd3c5">${escapeHtml(text(item.nomeIpl) || '—')}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd3c5;white-space:nowrap">${escapeHtml(text(item.infopen) || '—')}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #ddd3c5;white-space:nowrap;font-family:monospace">${escapeHtml(text(item.protocolo) || '—')}</td>
    </tr>`;
  }).join('');

  const contextoAtualizacaoHtml = atualizacaoEmails
    ? `<div style="margin-top:16px;padding:14px 16px;border:1px solid #b8a98f;background:#f1eadf;color:#3f372e;font-size:13px">
        <strong>Atualização da lista:</strong> esta mensagem substitui a lista enviada anteriormente. O reenvio está sendo realizado para incluir os e-mails dos(as) advogados(as), necessários ao envio dos links de acesso aos atendimentos.
      </div>`
    : '';

  const alertaSemEmailHtml = totalSemEmail
    ? `<div style="margin-top:16px;padding:12px 14px;border:1px solid #d7aaa5;background:#f7e9e7;color:#6f2525;font-size:12px">
        <strong>Atenção:</strong> ${totalSemEmail} ${totalSemEmail === 1 ? 'agendamento está' : 'agendamentos estão'} sem e-mail válido para envio do link.
      </div>`
    : '';

  const tabela = total
    ? `<div style="overflow-x:auto"><table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;font-size:13px">
        <thead>
          <tr style="background:#eee7dc;color:#2f2a24;text-align:left">
            <th style="padding:10px 8px;border-bottom:1px solid #c9bdad">Horário</th>
            <th style="padding:10px 8px;border-bottom:1px solid #c9bdad">Advogado(a)</th>
            <th style="padding:10px 8px;border-bottom:1px solid #c9bdad">OAB</th>
            <th style="padding:10px 8px;border-bottom:1px solid #c9bdad">E-mail para envio do link</th>
            <th style="padding:10px 8px;border-bottom:1px solid #c9bdad">IPL</th>
            <th style="padding:10px 8px;border-bottom:1px solid #c9bdad">INFOPEN</th>
            <th style="padding:10px 8px;border-bottom:1px solid #c9bdad">Protocolo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table></div>`
    : `<div style="margin-top:18px;padding:16px;border:1px solid #d8cdbf;background:#f5f0e8;color:#4f473e;border-radius:6px">
        Não há atendimentos agendados para esta data.
      </div>`;

  const htmlBody = `<!doctype html>
  <html lang="pt-BR">
    <body style="margin:0;background:#f3eee6;padding:24px 12px;font-family:Arial,sans-serif;color:#2f2a24;line-height:1.5">
      <div style="max-width:1040px;margin:0 auto;background:#fffdf8;border:1px solid #d8cdbf;border-radius:8px;overflow:hidden">
        <div style="display:flex;height:4px">
          <div style="width:25%;background:#9f2d2d"></div><div style="width:50%;background:#f7f2e9"></div><div style="width:25%;background:#274c77"></div>
        </div>
        <div style="padding:24px">
          ${modo === 'teste' ? '<div style="margin-bottom:14px;padding:8px 10px;border:1px solid #b8a98f;background:#f1eadf;font-size:12px;font-weight:bold">ENVIO DE TESTE — não encaminhar à unidade como lista oficial.</div>' : ''}
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#756b5e">OAB/MG · 4ª Subseção de Juiz de Fora</div>
          <h1 style="margin:6px 0 4px;font-family:Georgia,serif;font-size:25px;font-weight:normal">Lista de atendimentos</h1>
          <p style="margin:0;color:#756b5e">Central de Agendamento Prisional</p>
          <div style="margin-top:20px;padding:14px 16px;background:#f5f0e8;border-left:3px solid #274c77">
            <div><strong>Unidade:</strong> ${escapeHtml(unidade.nome)}</div>
            <div><strong>Data dos atendimentos:</strong> ${escapeHtml(dataLabel)}</div>
            <div><strong>Total de agendamentos:</strong> ${total}</div>
          </div>
          ${contextoAtualizacaoHtml}
          <div style="margin-top:16px;padding:12px 14px;border:1px solid #c9bdad;background:#fffaf2;color:#4f473e;font-size:12px">
            <strong>Orientação operacional:</strong> utilize o e-mail informado exclusivamente para o envio do link e para comunicações diretamente relacionadas a este atendimento.
          </div>
          ${alertaSemEmailHtml}
          ${tabela}
          <p style="margin:18px 0 0;font-size:12px;color:#756b5e">
            Esta lista considera apenas agendamentos com status <strong>Agendado</strong> no momento do envio.
            Cancelamentos ou remarcações posteriores exigem o reenvio de uma lista atualizada.
          </p>
        </div>
        <div style="padding:14px 24px;background:#2f2a24;color:#eee7dc;font-size:11px">
          OAB Juiz de Fora · Av. dos Andradas, 696 · (32) 3690-5900
        </div>
      </div>
    </body>
  </html>`;

  return { textBody, htmlBody, dataIso: dataAlvoIso };
}

function formatarHorario(item = {}) {
  const inicio = text(item.horarioInicio);
  const fim = text(item.horarioFim);
  return inicio && fim ? `${inicio}–${fim}` : inicio || '—';
}

function obterEmailAdvogado(item = {}) {
  const email = normalizeEmail(item.emailAdvogado || item.emailIndex);
  return isValidEmail(email) ? email : '';
}

function normalizarMotivoAtualizacao(value) {
  return text(value) === MOTIVO_ATUALIZACAO_EMAILS
    ? MOTIVO_ATUALIZACAO_EMAILS
    : '';
}

async function buscarEnvioAutomatico(unidadeSlug, dataIso) {
  return buscarUltimoEnvioAutomatico(unidadeSlug, dataIso);
}

async function buscarUltimoEnvioAutomatico(unidadeSlug, dataIso, status = '') {
  let query = wixData
    .query(COL.ENVIOS)
    .eq('unidadeSlug', normalizarSlug(unidadeSlug))
    .eq('dataAtendimentosIso', normalizarDataIso(dataIso))
    .eq('modo', 'automatico')
    .descending('atualizadoEm')
    .limit(1);

  if (status) query = query.eq('status', status);

  const result = await query.find({ suppressAuth: true });
  return (result.items || [])[0] || null;
}

async function existeTesteEnvioBemSucedido() {
  const result = await wixData
    .query(COL.ENVIOS)
    .eq('modo', 'teste')
    .eq('status', 'enviado')
    .limit(1)
    .find({ suppressAuth: true });
  return (result.items || []).length > 0;
}

async function buscarEnvioPorChave(chave) {
  const result = await wixData
    .query(COL.ENVIOS)
    .eq('chaveIdempotencia', chave)
    .limit(1)
    .find({ suppressAuth: true });
  return (result.items || [])[0] || null;
}

async function salvarRegistroEnvio(item) {
  if (item._id) {
    return wixData.update(COL.ENVIOS, item, { suppressAuth: true });
  }
  return wixData.insert(COL.ENVIOS, item, { suppressAuth: true });
}

async function finalizarRegistroEnvio(registro, patch = {}) {
  const agora = new Date();
  return wixData.update(COL.ENVIOS, {
    ...registro,
    ...patch,
    finalizadoEm: agora,
    atualizadoEm: agora,
  }, { suppressAuth: true });
}

async function marcarAgendamentosComoEnviadosSemFalhar(items, enviadoEm) {
  try {
    const dataEnvio = enviadoEm instanceof Date ? enviadoEm : new Date(enviadoEm);
    const atualizados = items.map((item) => ({
      ...item,
      listaDiariaEnviada: true,
      listaDiariaEnviadaEm: dataEnvio,
      atualizadoEm: dataEnvio,
    }));

    if (typeof wixData.bulkUpdate === 'function') {
      await wixData.bulkUpdate(COL.AGENDAMENTOS, atualizados, { suppressAuth: true });
      return;
    }

    for (const item of atualizados) {
      await wixData.update(COL.AGENDAMENTOS, item, { suppressAuth: true });
    }
  } catch (err) {
    console.warn('A lista foi enviada, mas não foi possível marcar os agendamentos.', err);
  }
}

async function obterOuCriarConfiguracao() {
  const result = await wixData
    .query(COL.CONFIG)
    .eq('chave', CONFIG_CHAVE)
    .limit(1)
    .find({ suppressAuth: true });

  const existente = (result.items || [])[0];
  if (existente) return existente;

  const agora = new Date();
  return wixData.insert(COL.CONFIG, {
    title: 'Envio diário de listas',
    chave: CONFIG_CHAVE,
    enviosAtivos: false,
    horarioBrasilia: HORARIO_BRASILIA,
    timezone: TIMEZONE,
    enviarListaVazia: true,
    usarProximoDiaUtil: true,
    emailAlertaOperacional: '',
    ultimaExecucaoStatus: 'nunca_executado',
    ultimaExecucaoMensagem: 'Configuração criada. Homologue o envio de teste antes de ativar.',
    ultimaDataAlvoIso: '',
    criadoEm: agora,
    atualizadoEm: agora,
    atualizadoPor: 'sistema',
  }, { suppressAuth: true });
}

async function atualizarUltimaExecucaoConfiguracao(config, dados = {}) {
  try {
    const agora = new Date();
    await wixData.update(COL.CONFIG, {
      ...config,
      title: 'Envio diário de listas',
      chave: CONFIG_CHAVE,
      ultimaExecucaoEm: agora,
      ultimaExecucaoStatus: text(dados.status),
      ultimaExecucaoMensagem: text(dados.mensagem).slice(0, 1000),
      ultimaDataAlvoIso: normalizarDataIso(dados.dataAlvoIso),
      atualizadoEm: agora,
      atualizadoPor: text(dados.solicitadoPor) || 'job',
    }, { suppressAuth: true });
  } catch (err) {
    console.warn('Não foi possível atualizar o resumo da última execução.', err);
  }
}

function mapConfiguracao(item = {}) {
  return {
    _id: text(item._id),
    chave: CONFIG_CHAVE,
    enviosAtivos: item.enviosAtivos === true,
    horarioBrasilia: HORARIO_BRASILIA,
    timezone: TIMEZONE,
    enviarListaVazia: true,
    usarProximoDiaUtil: true,
    emailAlertaOperacional: normalizeEmail(item.emailAlertaOperacional),
    ultimaExecucaoEm: dateToIso(item.ultimaExecucaoEm),
    ultimaExecucaoStatus: text(item.ultimaExecucaoStatus || 'nunca_executado'),
    ultimaExecucaoMensagem: text(item.ultimaExecucaoMensagem),
    ultimaDataAlvoIso: normalizarDataIso(item.ultimaDataAlvoIso),
    atualizadoEm: dateToIso(item.atualizadoEm || item._updatedDate),
    atualizadoPor: text(item.atualizadoPor),
  };
}

function mapEnvio(item = {}) {
  return {
    _id: text(item._id),
    unidadeSlug: normalizarSlug(item.unidadeSlug),
    unidadeNome: text(item.unidadeNome),
    emailDestino: normalizeEmail(item.emailDestino),
    dataAtendimentosIso: normalizarDataIso(item.dataAtendimentosIso),
    dataAtendimentosLabel: text(item.dataAtendimentosLabel) || formatDateBr(item.dataAtendimentosIso),
    totalAgendamentos: Number(item.totalAgendamentos || 0),
    status: text(item.status),
    statusLabel: statusLabel(item.status),
    modo: text(item.modo),
    modoLabel: modoLabel(item.modo),
    tentativas: Number(item.tentativas || 0),
    chaveIdempotencia: text(item.chaveIdempotencia),
    conteudoHash: text(item.conteudoHash),
    assunto: text(item.assunto),
    mensagemErro: text(item.mensagemErro),
    provider: text(item.provider),
    providerMessageId: text(item.providerMessageId),
    solicitadoPor: text(item.solicitadoPor),
    iniciadoEm: dateToIso(item.iniciadoEm),
    enviadoEm: dateToIso(item.enviadoEm),
    finalizadoEm: dateToIso(item.finalizadoEm),
    criadoEm: dateToIso(item.criadoEm || item._createdDate),
    atualizadoEm: dateToIso(item.atualizadoEm || item._updatedDate),
  };
}

function statusLabel(value) {
  const status = text(value);
  if (status === 'enviado') return 'Enviado';
  if (status === 'erro') return 'Com erro';
  if (status === 'sem_destinatario') return 'Sem destinatário';
  if (status === 'processando') return 'Processando';
  if (status === 'sem_agendamentos') return 'Sem agendamentos';
  return status || 'Não informado';
}

function modoLabel(value) {
  const modo = text(value);
  if (modo === 'automatico') return 'Automático';
  if (modo === 'manual') return 'Manual';
  if (modo === 'teste') return 'Teste';
  return modo || 'Não informado';
}

function resumirResultados(resultados = []) {
  return resultados.reduce((acc, item) => {
    acc.total += 1;
    if (item.ignorado) acc.ignorados += 1;
    else if (item.ok) {
      acc.enviados += 1;
      if (Number(item.totalAgendamentos || item.envio?.totalAgendamentos || 0) === 0) acc.listasVazias += 1;
    } else if (item.codigo === 'SEM_DESTINATARIO') acc.semDestinatario += 1;
    else acc.erros += 1;
    return acc;
  }, { total: 0, enviados: 0, listasVazias: 0, erros: 0, semDestinatario: 0, ignorados: 0 });
}

function montarMensagemResumo(resumo, dataIso) {
  return [
    `Envios de ${formatDateBr(dataIso)}:`,
    `${resumo.enviados} enviado(s)`,
    `${resumo.listasVazias} lista(s) vazia(s)`,
    `${resumo.erros} erro(s)`,
    `${resumo.semDestinatario} sem destinatário`,
    `${resumo.ignorados} ignorado(s)`,
  ].join(' ');
}

async function carregarConfigInfobip() {
  const [baseUrlRaw, apiKeyRaw, fromEmailRaw, fromNameRaw] = await Promise.all([
    getSecret('INFOBIP_BASE_URL'),
    getSecret('INFOBIP_API_KEY'),
    getSecret('INFOBIP_FROM_EMAIL'),
    getSecret('INFOBIP_FROM_NAME'),
  ]);

  const baseUrl = normalizarBaseUrl(baseUrlRaw);
  const apiKey = text(apiKeyRaw);
  const fromEmail = normalizeEmail(fromEmailRaw);
  const fromName = text(fromNameRaw) || 'OAB Juiz de Fora';

  if (!baseUrl) throw new Error('INFOBIP_BASE_URL inválido ou não configurado.');
  if (!apiKey) throw new Error('INFOBIP_API_KEY não configurado.');
  if (!isValidEmail(fromEmail)) throw new Error('INFOBIP_FROM_EMAIL inválido ou não configurado.');

  return { baseUrl, apiKey, fromEmail, fromName };
}

async function enviarEmailInfobip({ config, to, subject, textBody, htmlBody }) {
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
        mensagem: `Infobip retornou erro ${response.status}: ${text(raw).slice(0, 700)}`,
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      messageId: extrairInfobipMessageId(parsed),
    };
  } catch (err) {
    return { ok: false, mensagem: normalizarMensagemErro(err) };
  }
}

function extrairInfobipMessageId(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';
  if (parsed.messageId) return text(parsed.messageId);
  if (Array.isArray(parsed.messages) && parsed.messages[0]) return text(parsed.messages[0].messageId);
  return '';
}

function montarMultipartFormData(fields = {}) {
  const boundary = `----wix-listas-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const parts = [];

  Object.keys(fields).forEach((name) => {
    const value = fields[name];
    if (value === null || value === undefined) return;
    parts.push(`--${boundary}\r\n`);
    parts.push(`Content-Disposition: form-data; name="${text(name).replace(/"/g, '')}"\r\n\r\n`);
    parts.push(String(value));
    parts.push('\r\n');
  });

  parts.push(`--${boundary}--\r\n`);
  return { boundary, body: parts.join('') };
}

function montarAuthorizationHeader(apiKey) {
  const key = text(apiKey);
  if (/^(App|Basic|Bearer)\s+/i.test(key)) return key;
  return `App ${key}`;
}

function formatarRemetente(nome, email) {
  const cleanName = text(nome).replace(/[<>\"]/g, '');
  const cleanEmail = normalizeEmail(email);
  return cleanName ? `${cleanName} <${cleanEmail}>` : cleanEmail;
}

function normalizarBaseUrl(value) {
  let url = text(value);
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, '');
}

function obterDataLocalIso(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function adicionarDiasIso(dataIso, dias) {
  const m = text(dataIso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(dias || 0), 12, 0, 0));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function ehFimDeSemana(dataIso) {
  const m = text(dataIso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).getUTCDay();
  return day === 0 || day === 6;
}

function formatDateBr(dataIso) {
  const m = text(dataIso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : text(dataIso);
}

function normalizarDataIso(value) {
  const raw = text(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

function isDataIsoValida(value) {
  const iso = normalizarDataIso(value);
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
}

function normalizarSlug(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '');
}

function normalizeSearch(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function hashTexto(value) {
  const str = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function dateToIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function normalizarMensagemErro(err) {
  if (!err) return 'Erro desconhecido.';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  try {
    return JSON.stringify(err);
  } catch (_) {
    return String(err);
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}