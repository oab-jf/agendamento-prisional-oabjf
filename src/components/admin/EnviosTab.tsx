import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  MailCheck,
  Play,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  atualizarAdminConfiguracaoEnvios,
  executarAdminEnviosListas,
  listarAdminEnviosListas,
  listarAdminUnidades,
  reenviarAdminLista,
  testarAdminEnvioLista,
  type AdminConfiguracaoEnvios,
  type AdminEnvioLista,
  type AdminEnviosResumo,
  type AdminUnidade,
} from "@/lib/oab-api";

type Props = {
  token: string;
  hasPermission: (chave: string) => boolean;
  onUnauthorized: () => void;
  onOpenUnidades?: () => void;
};

type ConfirmacaoAutomacao = "ativar" | "pausar" | null;

type Filtros = {
  busca: string;
  status: string;
  modo: string;
  unidadeSlug: string;
  dataIso: string;
};

const FILTROS_INICIAIS: Filtros = {
  busca: "",
  status: "todos",
  modo: "todos",
  unidadeSlug: "",
  dataIso: "",
};

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getUnidadeSlug(unidade: AdminUnidade): string {
  return unidade.slug || unidade.codigo || "";
}

function getEmailListas(unidade: AdminUnidade): string {
  return (unidade.emailRecebimentoListas || unidade.emailListas || "").trim();
}

function formatDateIso(value?: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatDateTimeBrasilia(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function statusExecucaoLabel(status?: string | null): string {
  const key = normalize(status).replace(/\s+/g, "_");
  if (!key || key === "nunca_executado") return "Ainda não executada";
  if (key === "concluido") return "Concluída";
  if (key === "concluido_com_erros") return "Concluída com erros";
  if (key === "erro") return "Com erro";
  return status || "Não informado";
}

function EnvioStatusBadge({ envio }: { envio: AdminEnvioLista }) {
  const cls =
    envio.status === "enviado"
      ? "badge-success"
      : envio.status === "erro"
        ? "badge-danger"
        : envio.status === "sem_destinatario"
          ? "badge-warning"
          : envio.status === "processando"
            ? "badge-info"
            : "badge-neutral";
  return <span className={`badge-base ${cls}`}>{envio.statusLabel || envio.status || "—"}</span>;
}

function ModoBadge({ envio }: { envio: AdminEnvioLista }) {
  const cls =
    envio.modo === "automatico"
      ? "badge-info"
      : envio.modo === "teste"
        ? "badge-warning"
        : "badge-neutral";
  return <span className={`badge-base ${cls}`}>{envio.modoLabel || envio.modo || "—"}</span>;
}

export function EnviosTab({ token, hasPermission, onUnauthorized, onOpenUnidades }: Props) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const buscaAdiada = useDeferredValue(filtros.busca);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [configuracao, setConfiguracao] = useState<AdminConfiguracaoEnvios | null>(null);
  const [envios, setEnvios] = useState<AdminEnvioLista[]>([]);
  const [unidades, setUnidades] = useState<AdminUnidade[]>([]);
  const [proximaDataAlvoIso, setProximaDataAlvoIso] = useState("");
  const [proximaDataAlvoLabel, setProximaDataAlvoLabel] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [testeAberto, setTesteAberto] = useState(false);
  const [executarAberto, setExecutarAberto] = useState(false);
  const [confirmacaoAutomacao, setConfirmacaoAutomacao] =
    useState<ConfirmacaoAutomacao>(null);
  const [alterandoAutomacao, setAlterandoAutomacao] = useState(false);
  const [reenvio, setReenvio] = useState<AdminEnvioLista | null>(null);
  const [reenviando, setReenviando] = useState(false);

  const podeTestar = hasPermission("config.testar_envios");
  const podeOperar = hasPermission("config.ativar_envios");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [historico, unidadesResp] = await Promise.all([
        listarAdminEnviosListas(token, {
          status: filtros.status !== "todos" ? filtros.status : undefined,
          modo: filtros.modo !== "todos" ? filtros.modo : undefined,
          unidadeSlug: filtros.unidadeSlug || undefined,
          dataIso: filtros.dataIso || undefined,
          busca: buscaAdiada.trim() || undefined,
        }),
        listarAdminUnidades(token, { status: "ativas" }),
      ]);

      setEnvios(historico.envios || []);
      setConfiguracao(historico.configuracao || null);
      setProximaDataAlvoIso(historico.proximaDataAlvoIso || "");
      setProximaDataAlvoLabel(
        historico.proximaDataAlvoLabel || formatDateIso(historico.proximaDataAlvoIso),
      );
      setUnidades(unidadesResp.unidades || []);
    } catch (e) {
      const message = (e as Error).message;
      if (message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      setErro(message || "Não foi possível carregar os envios.");
    } finally {
      setLoading(false);
    }
  }, [
    token,
    filtros.status,
    filtros.modo,
    filtros.unidadeSlug,
    filtros.dataIso,
    buscaAdiada,
    reloadKey,
    onUnauthorized,
  ]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setExpandidos(new Set());
  }, [filtros, reloadKey]);

  const unidadesAtivas = useMemo(
    () => unidades.filter((unidade) => unidade.ativa !== false && unidade.ativo !== false),
    [unidades],
  );

  const unidadesSemEmail = useMemo(
    () => unidadesAtivas.filter((unidade) => !getEmailListas(unidade)),
    [unidadesAtivas],
  );

  const filtrosAtivos =
    (filtros.busca.trim() ? 1 : 0) +
    (filtros.status !== "todos" ? 1 : 0) +
    (filtros.modo !== "todos" ? 1 : 0) +
    (filtros.unidadeSlug ? 1 : 0) +
    (filtros.dataIso ? 1 : 0);

  const resumoHistorico = useMemo(() => {
    return envios.reduce(
      (acc, envio) => {
        acc.total += 1;
        if (envio.status === "enviado") acc.enviados += 1;
        else if (envio.status === "erro") acc.erros += 1;
        else if (envio.status === "sem_destinatario") acc.semDestinatario += 1;
        return acc;
      },
      { total: 0, enviados: 0, erros: 0, semDestinatario: 0 },
    );
  }, [envios]);

  const limparFiltros = () => setFiltros(FILTROS_INICIAIS);

  const solicitarAlteracaoAutomacao = () => {
    if (!configuracao || !podeOperar) return;
    setConfirmacaoAutomacao(configuracao.enviosAtivos ? "pausar" : "ativar");
  };

  const confirmarAlteracaoAutomacao = async () => {
    if (!configuracao || !confirmacaoAutomacao) return;
    const ativar = confirmacaoAutomacao === "ativar";
    setAlterandoAutomacao(true);
    try {
      const resposta = await atualizarAdminConfiguracaoEnvios(token, {
        enviosAtivos: ativar,
      });
      if (!resposta.ok) {
        const mensagem =
          resposta.code === "TESTE_OBRIGATORIO"
            ? "Faça e confirme um envio de teste antes de ativar a automação."
            : resposta.message || resposta.error || "Não foi possível atualizar a automação.";
        toast.error(mensagem);
        return;
      }
      toast.success(ativar ? "Envios automáticos ativados." : "Envios automáticos pausados.");
      setConfirmacaoAutomacao(null);
      setReloadKey((key) => key + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setAlterandoAutomacao(false);
    }
  };

  const confirmarReenvio = async () => {
    if (!reenvio) return;
    setReenviando(true);
    try {
      const resposta = await reenviarAdminLista(token, reenvio._id);
      if (!resposta.ok) {
        toast.error(resposta.message || resposta.error || "Não foi possível reenviar a lista.");
        return;
      }
      toast.success(resposta.message || "Lista atualizada reenviada.");
      setReenvio(null);
      setReloadKey((key) => key + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ResumoCard
          label="Automação"
          valor={configuracao?.enviosAtivos ? "Ativa" : "Pausada"}
          tone={configuracao?.enviosAtivos ? "success" : "warning"}
        />
        <ResumoCard
          label="Horário"
          valor={`${configuracao?.horarioBrasilia || "17:00"}`}
          complemento="Brasília"
        />
        <ResumoCard
          label="Próxima lista"
          valor={proximaDataAlvoLabel || formatDateIso(proximaDataAlvoIso)}
          complemento="próximo dia útil"
        />
        <ResumoCard
          label="Última execução"
          valor={statusExecucaoLabel(configuracao?.ultimaExecucaoStatus)}
          complemento={formatDateTimeBrasilia(configuracao?.ultimaExecucaoEm)}
          tone={
            configuracao?.ultimaExecucaoStatus === "erro"
              ? "danger"
              : configuracao?.ultimaExecucaoStatus === "concluido_com_erros"
                ? "warning"
                : configuracao?.ultimaExecucaoStatus === "concluido"
                  ? "success"
                  : "neutral"
          }
        />
      </div>

      <div className="mb-4 rounded-xl border border-clay/15 bg-card p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Clock3 className="h-4 w-4 text-clay" /> Operação diária
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              As listas são enviadas diariamente às 17h para o próximo dia útil, inclusive quando
              não há atendimentos.
            </p>
            {configuracao?.ultimaExecucaoMensagem && (
              <p className="mt-2 text-xs text-clay">{configuracao.ultimaExecucaoMensagem}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {podeTestar && (
              <button
                type="button"
                onClick={() => setTesteAberto(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-clay/25 bg-paper px-3 text-sm font-medium text-ink hover:bg-sand"
              >
                <MailCheck className="h-4 w-4" /> Enviar teste
              </button>
            )}
            {podeOperar && (
              <button
                type="button"
                onClick={() => setExecutarAberto(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-clay/25 bg-paper px-3 text-sm font-medium text-ink hover:bg-sand"
              >
                <Play className="h-4 w-4" /> Executar agora
              </button>
            )}
            {podeOperar && configuracao && (
              <button
                type="button"
                onClick={solicitarAlteracaoAutomacao}
                className={
                  "inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors " +
                  (configuracao.enviosAtivos
                    ? "border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)] hover:brightness-95"
                    : "bg-ink text-paper hover:bg-brand-blue")
                }
              >
                {configuracao.enviosAtivos ? (
                  <>
                    <Clock3 className="h-4 w-4" /> Pausar automação
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Ativar automação
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {unidadesSemEmail.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 alert-warning p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {unidadesSemEmail.length} unidade{unidadesSemEmail.length === 1 ? " ativa está" : "s ativas estão"} sem e-mail para listas.
              </span>
            </div>
            {onOpenUnidades && (
              <button
                type="button"
                onClick={onOpenUnidades}
                className="shrink-0 rounded-md border border-[color:var(--warning-border)] bg-paper px-3 py-1.5 text-xs font-medium text-[color:var(--warning-text)] hover:brightness-95"
              >
                Abrir Unidades
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <MiniCard label="Registros exibidos" valor={resumoHistorico.total} />
        <MiniCard label="Enviados" valor={resumoHistorico.enviados} tone="success" />
        <MiniCard label="Com erro" valor={resumoHistorico.erros} tone="danger" />
        <MiniCard
          label="Sem destinatário"
          valor={resumoHistorico.semDestinatario}
          tone="warning"
        />
      </div>

      <div className="mb-4 md:hidden">
        <button
          type="button"
          onClick={() => setFiltrosAbertos((aberto) => !aberto)}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-clay/25 bg-paper px-3 text-sm font-medium text-ink"
        >
          <Filter className="h-3.5 w-3.5" /> Filtros
          {filtrosAtivos > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-ink px-1.5 text-[10px] font-semibold text-paper">
              {filtrosAtivos}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${filtrosAbertos ? "rotate-180" : ""}`}
          />
        </button>
        {filtrosAbertos && (
          <div className="mt-2 space-y-2 rounded-md border border-clay/15 bg-sand/30 p-3">
            <FiltrosForm filtros={filtros} setFiltros={setFiltros} unidades={unidadesAtivas} mobile />
            {filtrosAtivos > 0 && (
              <button
                type="button"
                onClick={limparFiltros}
                className="h-9 w-full rounded-md border border-clay/20 bg-paper px-3 text-xs font-medium text-clay hover:bg-sand"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
        <FiltrosForm filtros={filtros} setFiltros={setFiltros} unidades={unidadesAtivas} />
        {filtrosAtivos > 0 && (
          <button
            type="button"
            onClick={limparFiltros}
            className="h-10 rounded-md border border-clay/20 bg-paper px-3 text-xs font-medium text-clay hover:bg-sand"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{loading ? "Carregando envios…" : `${envios.length} envio${envios.length === 1 ? "" : "s"}`}</span>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-clay hover:bg-sand hover:text-ink disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {erro && (
        <div className="mb-3 flex items-center justify-between gap-3 alert-danger p-3 text-sm">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="shrink-0 rounded-md border border-[color:var(--danger-border)] px-2 py-1 text-xs"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="hidden overflow-hidden rounded-xl border border-clay/15 bg-card xl:block">
        <div className="grid grid-cols-[1.35fr_0.8fr_0.45fr_1.4fr_0.7fr_0.75fr_0.95fr_0.7fr] gap-3 border-b border-clay/15 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Unidade</div>
          <div>Data da lista</div>
          <div>Total</div>
          <div>Destinatário</div>
          <div>Modo</div>
          <div>Status</div>
          <div>Enviado em</div>
          <div className="text-right">Ações</div>
        </div>
        {envios.map((envio) => (
          <div
            key={envio._id}
            className="grid grid-cols-[1.35fr_0.8fr_0.45fr_1.4fr_0.7fr_0.75fr_0.95fr_0.7fr] items-start gap-3 border-b border-clay/10 px-4 py-3 text-sm last:border-b-0 hover:bg-muted/20"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-ink">{envio.unidadeNome || envio.unidadeSlug}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-clay">{envio.unidadeSlug}</div>
              {envio.mensagemErro && (
                <div className="mt-1 line-clamp-2 text-[11px] text-[color:var(--danger-text)]" title={envio.mensagemErro}>
                  {envio.mensagemErro}
                </div>
              )}
            </div>
            <div className="text-[12px] text-ink/90">{envio.dataAtendimentosLabel || formatDateIso(envio.dataAtendimentosIso)}</div>
            <div className="text-[12px] font-medium text-ink">{envio.totalAgendamentos}</div>
            <div className="min-w-0 break-all text-[12px] text-ink/90">{envio.emailDestino || "—"}</div>
            <div><ModoBadge envio={envio} /></div>
            <div><EnvioStatusBadge envio={envio} /></div>
            <div className="text-[12px] text-ink/90">{formatDateTimeBrasilia(envio.enviadoEm || envio.finalizadoEm)}</div>
            <div className="flex justify-end">
              {podeOperar && envio.modo !== "teste" && envio.status !== "processando" && (
                <button
                  type="button"
                  onClick={() => setReenvio(envio)}
                  className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2 py-1 text-[11px] font-medium text-ink hover:bg-sand"
                >
                  <Send className="h-3 w-3" /> Reenviar
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && envios.length === 0 && !erro && (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum envio encontrado.</div>
        )}
      </div>

      <div className="space-y-2 xl:hidden">
        {envios.map((envio) => {
          const aberto = expandidos.has(envio._id);
          return (
            <div key={envio._id} className="overflow-hidden rounded-lg border border-clay/15 bg-card">
              <button
                type="button"
                onClick={() =>
                  setExpandidos((anterior) => {
                    const proximo = new Set(anterior);
                    if (proximo.has(envio._id)) proximo.delete(envio._id);
                    else proximo.add(envio._id);
                    return proximo;
                  })
                }
                aria-expanded={aberto}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="min-w-0 truncate text-sm font-medium text-ink">{envio.unidadeNome || envio.unidadeSlug}</div>
                    <EnvioStatusBadge envio={envio} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-clay">
                    {envio.dataAtendimentosLabel || formatDateIso(envio.dataAtendimentosIso)} · {envio.totalAgendamentos} atendimento{envio.totalAgendamentos === 1 ? "" : "s"}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{envio.emailDestino || "Sem destinatário"}</div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-clay transition-transform ${aberto ? "rotate-180" : ""}`} />
              </button>
              {aberto && (
                <div className="border-t border-clay/10 px-3 py-3">
                  <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
                    <Detalhe label="Modo"><ModoBadge envio={envio} /></Detalhe>
                    <Detalhe label="Enviado em">{formatDateTimeBrasilia(envio.enviadoEm || envio.finalizadoEm)}</Detalhe>
                    <Detalhe label="Tentativas">{envio.tentativas || 0}</Detalhe>
                    <Detalhe label="Solicitado por">{envio.solicitadoPor || "—"}</Detalhe>
                    <Detalhe label="Assunto" wide>{envio.assunto || "—"}</Detalhe>
                    {envio.mensagemErro && (
                      <Detalhe label="Detalhes do erro" wide danger>{envio.mensagemErro}</Detalhe>
                    )}
                  </dl>
                  {podeOperar && envio.modo !== "teste" && envio.status !== "processando" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setReenvio(envio)}
                        className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-sand"
                      >
                        <Send className="h-3.5 w-3.5" /> Reenviar lista
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && envios.length === 0 && !erro && (
          <div className="rounded-xl border border-clay/15 bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum envio encontrado.
          </div>
        )}
      </div>

      {testeAberto && (
        <TesteModal
          token={token}
          unidades={unidadesAtivas}
          dataPadrao={proximaDataAlvoIso}
          onClose={() => setTesteAberto(false)}
          onSuccess={() => {
            setTesteAberto(false);
            setReloadKey((key) => key + 1);
          }}
          onUnauthorized={onUnauthorized}
        />
      )}

      {executarAberto && (
        <ExecutarModal
          token={token}
          unidades={unidadesAtivas}
          dataPadrao={proximaDataAlvoIso}
          onClose={() => setExecutarAberto(false)}
          onSuccess={() => setReloadKey((key) => key + 1)}
          onUnauthorized={onUnauthorized}
        />
      )}

      {confirmacaoAutomacao && configuracao && (
        <ConfirmacaoAutomacaoModal
          acao={confirmacaoAutomacao}
          loading={alterandoAutomacao}
          onConfirm={confirmarAlteracaoAutomacao}
          onCancel={() => !alterandoAutomacao && setConfirmacaoAutomacao(null)}
        />
      )}

      {reenvio && (
        <ConfirmacaoReenvioModal
          envio={reenvio}
          loading={reenviando}
          onConfirm={confirmarReenvio}
          onCancel={() => !reenviando && setReenvio(null)}
        />
      )}
    </div>
  );
}

function FiltrosForm({
  filtros,
  setFiltros,
  unidades,
  mobile = false,
}: {
  filtros: Filtros;
  setFiltros: React.Dispatch<React.SetStateAction<Filtros>>;
  unidades: AdminUnidade[];
  mobile?: boolean;
}) {
  const fieldClass = "h-10 rounded-md border border-clay/20 bg-background px-2 text-sm";
  return (
    <>
      <div className={`relative ${mobile ? "w-full" : "min-w-[220px] flex-1"}`}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filtros.busca}
          onChange={(event) => setFiltros((atual) => ({ ...atual, busca: event.target.value }))}
          className="h-10 w-full rounded-md border border-clay/20 bg-background pl-8 pr-3 text-sm"
          placeholder="Buscar por unidade, e-mail, assunto ou erro"
        />
      </div>
      <div className={mobile ? "grid grid-cols-2 gap-2" : "contents"}>
        <select
          value={filtros.status}
          onChange={(event) => setFiltros((atual) => ({ ...atual, status: event.target.value }))}
          className={`${fieldClass} ${mobile ? "w-full" : ""}`}
        >
          <option value="todos">Todos os status</option>
          <option value="enviado">Enviado</option>
          <option value="erro">Com erro</option>
          <option value="sem_destinatario">Sem destinatário</option>
          <option value="processando">Processando</option>
        </select>
        <select
          value={filtros.modo}
          onChange={(event) => setFiltros((atual) => ({ ...atual, modo: event.target.value }))}
          className={`${fieldClass} ${mobile ? "w-full" : ""}`}
        >
          <option value="todos">Todos os modos</option>
          <option value="automatico">Automático</option>
          <option value="manual">Manual</option>
          <option value="teste">Teste</option>
        </select>
      </div>
      <select
        value={filtros.unidadeSlug}
        onChange={(event) => setFiltros((atual) => ({ ...atual, unidadeSlug: event.target.value }))}
        className={`${fieldClass} ${mobile ? "w-full" : "max-w-[220px]"}`}
      >
        <option value="">Todas as unidades</option>
        {unidades.map((unidade) => (
          <option key={unidade._id} value={getUnidadeSlug(unidade)}>
            {unidade.nome}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={filtros.dataIso}
        onChange={(event) => setFiltros((atual) => ({ ...atual, dataIso: event.target.value }))}
        className={`${fieldClass} ${mobile ? "w-full" : ""}`}
      />
    </>
  );
}

function ResumoCard({
  label,
  valor,
  complemento,
  tone = "neutral",
}: {
  label: string;
  valor: string;
  complemento?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const valueClass =
    tone === "success"
      ? "text-[color:var(--success-text)]"
      : tone === "warning"
        ? "text-[color:var(--warning-text)]"
        : tone === "danger"
          ? "text-[color:var(--danger-text)]"
          : "text-ink";
  return (
    <div className="rounded-lg border border-clay/15 bg-card px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground md:text-[10px]">
        {label}
      </div>
      <div className={`mt-1 text-base font-semibold leading-tight md:text-lg ${valueClass}`}>{valor || "—"}</div>
      {complemento && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{complemento}</div>}
    </div>
  );
}

function MiniCard({
  label,
  valor,
  tone = "neutral",
}: {
  label: string;
  valor: number;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const valueClass =
    tone === "success"
      ? "text-[color:var(--success-text)]"
      : tone === "warning"
        ? "text-[color:var(--warning-text)]"
        : tone === "danger"
          ? "text-[color:var(--danger-text)]"
          : "text-ink";
  return (
    <div className="rounded-lg border border-clay/15 bg-card px-2.5 py-1.5 md:px-3 md:py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground md:text-[10px]">{label}</div>
      <div className={`mt-0.5 text-base font-semibold md:text-xl ${valueClass}`}>{valor}</div>
    </div>
  );
}

function Detalhe({
  label,
  children,
  wide = false,
  danger = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-clay">{label}</dt>
      <dd className={`mt-0.5 break-words ${danger ? "text-[color:var(--danger-text)]" : "text-ink/90"}`}>{children}</dd>
    </div>
  );
}

function TesteModal({
  token,
  unidades,
  dataPadrao,
  onClose,
  onSuccess,
  onUnauthorized,
}: {
  token: string;
  unidades: AdminUnidade[];
  dataPadrao: string;
  onClose: () => void;
  onSuccess: () => void;
  onUnauthorized: () => void;
}) {
  const [unidadeSlug, setUnidadeSlug] = useState("");
  const [emailTeste, setEmailTeste] = useState("");
  const [dataAlvoIso, setDataAlvoIso] = useState(dataPadrao);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submit = async () => {
    setErro(null);
    if (!unidadeSlug) {
      setErro("Selecione a unidade do teste.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTeste.trim())) {
      setErro("Informe um e-mail válido para o teste.");
      return;
    }
    setLoading(true);
    try {
      const resposta = await testarAdminEnvioLista(token, {
        unidadeSlug,
        emailTeste: emailTeste.trim().toLowerCase(),
        dataAlvoIso: dataAlvoIso || undefined,
      });
      if (!resposta.ok) {
        setErro(resposta.message || resposta.error || "Não foi possível enviar o teste.");
        return;
      }
      toast.success(resposta.message || `E-mail de teste enviado para ${emailTeste.trim()}.`);
      onSuccess();
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={() => !loading && onClose()} maxWidth="max-w-xl">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink">
        <MailCheck className="h-4 w-4 text-clay" /> Enviar teste
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        O teste será enviado somente para o e-mail informado abaixo. O destinatário oficial da unidade não será utilizado.
      </p>
      <div className="grid gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">Unidade</span>
          <select
            value={unidadeSlug}
            onChange={(event) => setUnidadeSlug(event.target.value)}
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          >
            <option value="">Selecione a unidade</option>
            {unidades.map((unidade) => (
              <option key={unidade._id} value={getUnidadeSlug(unidade)}>{unidade.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">E-mail de teste</span>
          <input
            type="email"
            value={emailTeste}
            onChange={(event) => setEmailTeste(event.target.value)}
            autoComplete="email"
            placeholder="nome@dominio.com"
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">Data da lista (opcional)</span>
          <input
            type="date"
            value={dataAlvoIso}
            onChange={(event) => setDataAlvoIso(event.target.value)}
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          />
        </label>
      </div>
      {erro && <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={loading} className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60">Cancelar</button>
        <button type="button" onClick={submit} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60">
          <Send className="h-3.5 w-3.5" /> {loading ? "Enviando…" : "Enviar teste"}
        </button>
      </div>
    </ModalShell>
  );
}

function ExecutarModal({
  token,
  unidades,
  dataPadrao,
  onClose,
  onSuccess,
  onUnauthorized,
}: {
  token: string;
  unidades: AdminUnidade[];
  dataPadrao: string;
  onClose: () => void;
  onSuccess: () => void;
  onUnauthorized: () => void;
}) {
  const [unidadeSlug, setUnidadeSlug] = useState("");
  const [dataAlvoIso, setDataAlvoIso] = useState(dataPadrao);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<AdminEnviosResumo | null>(null);
  const [mensagem, setMensagem] = useState("");

  const executar = async () => {
    setErro(null);
    setResumo(null);
    if (!dataAlvoIso) {
      setErro("Informe a data da lista.");
      return;
    }
    setLoading(true);
    try {
      const resposta = await executarAdminEnviosListas(token, {
        dataAlvoIso,
        unidadeSlug: unidadeSlug || undefined,
        forcar: false,
      });
      if (resposta.executado && resposta.resumo) {
        setResumo(resposta.resumo);
        setMensagem(resposta.message || "Execução concluída.");
        onSuccess();
        if (resposta.ok) toast.success(resposta.message || "Envios executados.");
        else toast.error(resposta.message || "Execução concluída com falhas.");
        return;
      }
      if (!resposta.ok) {
        setErro(resposta.message || resposta.error || "Não foi possível executar os envios.");
        return;
      }
      setMensagem(resposta.message || "Execução concluída.");
      onSuccess();
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={() => !loading && onClose()} maxWidth="max-w-2xl">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink">
        <Play className="h-4 w-4 text-clay" /> Executar envio agora
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Esta ação enviará mensagens oficiais aos e-mails de listas cadastrados nas unidades.
      </p>
      {!resumo ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-clay">Escopo</span>
              <select value={unidadeSlug} onChange={(event) => setUnidadeSlug(event.target.value)} className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm">
                <option value="">Todas as unidades</option>
                {unidades.map((unidade) => (
                  <option key={unidade._id} value={getUnidadeSlug(unidade)}>{unidade.nome}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-clay">Data da lista</span>
              <input type="date" value={dataAlvoIso} onChange={(event) => setDataAlvoIso(event.target.value)} className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm" />
            </label>
          </div>
          <div className="mt-4 alert-warning p-3 text-sm">
            Confirme o escopo <strong>{unidadeSlug ? "da unidade selecionada" : "de todas as unidades"}</strong> e a data <strong>{formatDateIso(dataAlvoIso)}</strong>.
          </div>
          {erro && <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60">Cancelar</button>
            <button type="button" onClick={executar} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60">
              <Send className="h-3.5 w-3.5" /> {loading ? "Executando…" : "Confirmar e enviar"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={resumo.erros || resumo.semDestinatario ? "alert-warning p-3 text-sm" : "alert-success p-3 text-sm"}>{mensagem}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniCard label="Total" valor={resumo.total} />
            <MiniCard label="Enviados" valor={resumo.enviados} tone="success" />
            <MiniCard label="Listas vazias" valor={resumo.listasVazias} />
            <MiniCard label="Erros" valor={resumo.erros} tone="danger" />
            <MiniCard label="Sem destinatário" valor={resumo.semDestinatario} tone="warning" />
            <MiniCard label="Ignorados" valor={resumo.ignorados} />
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-brand-blue">Concluir</button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function ConfirmacaoAutomacaoModal({
  acao,
  loading,
  onConfirm,
  onCancel,
}: {
  acao: "ativar" | "pausar";
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ativar = acao === "ativar";
  return (
    <ModalShell onClose={onCancel} maxWidth="max-w-md">
      <h2 className="mb-2 text-lg font-semibold text-ink">{ativar ? "Ativar envios automáticos?" : "Pausar envios automáticos?"}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {ativar
          ? "Depois da ativação, as listas oficiais passarão a ser enviadas automaticamente todos os dias às 17h."
          : "Enquanto a automação estiver pausada, os jobs continuarão sendo chamados, mas nenhuma lista automática será enviada."}
      </p>
      {ativar && (
        <div className="mb-4 alert-warning p-3 text-sm">Confirme que o envio de teste foi recebido e que os e-mails oficiais das unidades estão corretos.</div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60">Voltar</button>
        <button type="button" onClick={onConfirm} disabled={loading} className={ativar ? "rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60" : "rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--warning-text)] hover:brightness-95 disabled:opacity-60"}>
          {loading ? "Salvando…" : ativar ? "Ativar automação" : "Pausar automação"}
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmacaoReenvioModal({
  envio,
  loading,
  onConfirm,
  onCancel,
}: {
  envio: AdminEnvioLista;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell onClose={onCancel} maxWidth="max-w-md">
      <h2 className="mb-2 text-lg font-semibold text-ink">Reenviar lista?</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Uma nova mensagem oficial será enviada ao e-mail atual da unidade e identificada como <strong>Lista atualizada</strong>.
      </p>
      <div className="mb-4 rounded-lg border border-clay/15 bg-muted/30 p-3 text-xs">
        <div className="font-medium text-ink">{envio.unidadeNome || envio.unidadeSlug}</div>
        <div className="mt-0.5 text-muted-foreground">Data: {envio.dataAtendimentosLabel || formatDateIso(envio.dataAtendimentosIso)}</div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60">Voltar</button>
        <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60">
          <Send className="h-3.5 w-3.5" /> {loading ? "Reenviando…" : "Reenviar lista"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
  maxWidth,
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className={`my-8 w-full ${maxWidth} rounded-2xl bg-card p-6 shadow-xl`} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
