import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, Calendar, ChevronDown, Clock, Filter, Mail, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import {
  analisarImpactoAdminBloqueio,
  atualizarAdminBloqueio,
  criarAdminBloqueio,
  listarAdminBloqueios,
  listarAdminUnidades,
  removerAdminBloqueio,
  type AdminBloqueio,
  type AdminBloqueioEscopo,
  type AdminBloqueioImpactoResposta,
  type AdminBloqueioTipo,
  type AdminUnidade,
  type CriarAdminBloqueioPayload,
} from "@/lib/oab-api";

type Props = {
  token: string;
  hasPermission: (chave: string) => boolean;
  onUnauthorized: () => void;
  initialUnidadeSlug?: string;
};

function normalize(v: string | undefined | null) {
  return (v || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateBR(iso?: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function tipoLabel(t: AdminBloqueioTipo): string {
  if (t === "dia_inteiro") return "Dia inteiro";
  if (t === "intervalo_datas") return "Intervalo de datas";
  return "Horário específico";
}

function periodoLabel(b: AdminBloqueio): string {
  if (b.dataLabel) return b.dataLabel;
  const ini = formatDateBR(b.dataInicio);
  const fim = b.dataFim ? formatDateBR(b.dataFim) : "";
  if (b.tipo === "intervalo_datas" && fim && fim !== ini) return `${ini} → ${fim}`;
  return ini;
}

function horarioLabel(b: AdminBloqueio): string {
  if (b.horarioLabel) return b.horarioLabel;
  if (b.tipo === "horario" && b.horarioInicio && b.horarioFim) {
    return `${b.horarioInicio} – ${b.horarioFim}`;
  }
  return "";
}

function StatusPill({ status }: { status: AdminBloqueio["status"] }) {
  const cls =
    status === "ativo"
      ? "badge-danger"
      : status === "encerrado"
        ? "badge-neutral"
        : "badge-warning";
  const label =
    status === "ativo" ? "Ativo" : status === "encerrado" ? "Encerrado" : "Inativo";
  return <span className={"badge-base " + cls}>{label}</span>;
}

export function BloqueiosTab({ token, hasPermission, onUnauthorized, initialUnidadeSlug }: Props) {
  const [status, setStatus] = useState<string>("todos");
  const [escopo, setEscopo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [unidadeSlug, setUnidadeSlug] = useState<string>(initialUnidadeSlug || "");
  const [dataIso, setDataIso] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [bloqueios, setBloqueios] = useState<AdminBloqueio[]>([]);
  const [unidades, setUnidades] = useState<AdminUnidade[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [criarAberto, setCriarAberto] = useState(false);
  const [editar, setEditar] = useState<AdminBloqueio | null>(null);
  const [remover, setRemover] = useState<AdminBloqueio | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const podeCriar = hasPermission("bloqueios.criar");
  const podeEditar = hasPermission("bloqueios.editar");
  const podeRemover = hasPermission("bloqueios.remover");
  const podeCancelarAgendamentos = hasPermission("agendamentos.cancelar");

  useEffect(() => {
    setExpandidos(new Set());
  }, [status, escopo, busca, unidadeSlug, dataIso, reloadKey]);

  const filtrosAtivos =
    (status !== "todos" ? 1 : 0) +
    (escopo !== "todos" ? 1 : 0) +
    (unidadeSlug ? 1 : 0) +
    (dataIso ? 1 : 0) +
    (busca.trim() ? 1 : 0);

  // Carrega unidades para filtros/formulários
  useEffect(() => {
    let cancelled = false;
    listarAdminUnidades(token, { status: "ativas" })
      .then((r) => {
        if (!cancelled) setUnidades(r.unidades || []);
      })
      .catch(() => {
        /* silencioso: filtro/select ainda funcionam sem lista */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    listarAdminBloqueios(token, {
      status: status !== "todos" ? status : undefined,
      busca: busca.trim() || undefined,
      unidadeSlug: unidadeSlug || undefined,
      dataIso: dataIso || undefined,
      escopo: escopo !== "todos" ? escopo : undefined,
    })
      .then((r) => {
        if (cancelled) return;
        setBloqueios(r.bloqueios || []);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message === "SESSAO_EXPIRADA") {
          toast.error("Sua sessão expirou. Entre novamente.");
          onUnauthorized();
          return;
        }
        setErro(e.message || "Não foi possível carregar os bloqueios.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, status, escopo, busca, unidadeSlug, dataIso, reloadKey, onUnauthorized]);

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return bloqueios;
    return bloqueios.filter((b) =>
      normalize(
        `${b.unidadeNome ?? ""} ${b.unidadeSlug ?? ""} ${b.motivo} ${b.observacoesInternas ?? ""}`,
      ).includes(q),
    );
  }, [bloqueios, busca]);

  const resumo = useMemo(() => {
    let ativos = 0;
    let encerrados = 0;
    let todasUn = 0;
    let unidadeEspec = 0;
    for (const b of bloqueios) {
      if (b.status === "ativo") ativos += 1;
      if (b.status === "encerrado") encerrados += 1;
      if (b.escopo === "todas") todasUn += 1;
      else unidadeEspec += 1;
    }
    return { total: bloqueios.length, ativos, encerrados, todasUn, unidadeEspec };
  }, [bloqueios]);

  const handleRemover = useCallback(async () => {
    if (!remover) return;
    setRemovendoId(remover._id);
    try {
      const r = await removerAdminBloqueio(token, remover._id);
      if (!r.ok) {
        toast.error(r.message || r.error || "Não foi possível remover o bloqueio.");
        return;
      }
      toast.success(r.mensagem || "Bloqueio removido.");
      setRemover(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setRemovendoId(null);
    }
  }, [remover, token, onUnauthorized]);

  return (
    <div>
      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <ResumoCard label="Total" valor={resumo.total} />
        <ResumoCard label="Ativos" valor={resumo.ativos} tone="danger" />
        <ResumoCard label="Encerrados" valor={resumo.encerrados} tone="neutral" />
        <ResumoCard label="Todas as unidades" valor={resumo.todasUn} tone="info" />
        <ResumoCard label="Unidade específica" valor={resumo.unidadeEspec} tone="info" />
      </div>

      {/* Filtros — mobile colapsáveis */}
      <div className="mb-4 md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltrosAbertos((v) => !v)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-clay/25 bg-paper px-3 text-sm font-medium text-ink"
          >
            <Filter className="h-3.5 w-3.5" /> Filtros
            {filtrosAtivos > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-ink px-1.5 text-[10px] font-semibold text-paper">
                {filtrosAtivos}
              </span>
            )}
            <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (filtrosAbertos ? "rotate-180" : "")} />
          </button>
          {podeCriar && (
            <button
              type="button"
              onClick={() => setCriarAberto(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-semibold text-paper hover:bg-brand-blue"
            >
              <Plus className="h-4 w-4" /> Novo
            </button>
          )}
        </div>
        {filtrosAbertos && (
          <div className="mt-2 space-y-2 rounded-md border border-clay/15 bg-sand/30 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-10 w-full rounded-md border border-clay/20 bg-background pl-8 pr-3 text-sm"
                placeholder="Buscar por unidade, motivo ou observação"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-md border border-clay/20 bg-background px-2 text-sm"
              >
                <option value="todos">Todos os status</option>
                <option value="ativos">Ativos</option>
                <option value="encerrados">Encerrados</option>
                <option value="inativos">Inativos</option>
              </select>
              <select
                value={escopo}
                onChange={(e) => setEscopo(e.target.value)}
                className="h-10 rounded-md border border-clay/20 bg-background px-2 text-sm"
              >
                <option value="todos">Todos os escopos</option>
                <option value="todas">Todas as unidades</option>
                <option value="unidade">Unidade específica</option>
              </select>
            </div>
            <select
              value={unidadeSlug}
              onChange={(e) => setUnidadeSlug(e.target.value)}
              className="h-10 w-full rounded-md border border-clay/20 bg-background px-2 text-sm"
            >
              <option value="">Todas as unidades</option>
              {unidades.map((u) => (
                <option key={u._id} value={u.slug || u.codigo || ""}>
                  {u.nome}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dataIso}
              onChange={(e) => setDataIso(e.target.value)}
              className="h-10 w-full rounded-md border border-clay/20 bg-background px-2 text-sm"
            />
            {filtrosAtivos > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setStatus("todos");
                  setEscopo("todos");
                  setUnidadeSlug("");
                  setDataIso("");
                }}
                className="h-9 w-full rounded-md border border-clay/20 bg-paper px-3 text-xs font-medium text-clay hover:bg-sand"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filtros — desktop */}
      <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-md border border-clay/20 bg-background pl-8 pr-3 text-sm"
            placeholder="Buscar por unidade, motivo ou observação"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-clay/20 bg-background px-2 text-sm"
        >
          <option value="todos">Todos os status</option>
          <option value="ativos">Ativos</option>
          <option value="encerrados">Encerrados</option>
          <option value="inativos">Inativos</option>
        </select>
        <select
          value={escopo}
          onChange={(e) => setEscopo(e.target.value)}
          className="h-10 rounded-md border border-clay/20 bg-background px-2 text-sm"
        >
          <option value="todos">Todos os escopos</option>
          <option value="todas">Todas as unidades</option>
          <option value="unidade">Unidade específica</option>
        </select>
        <select
          value={unidadeSlug}
          onChange={(e) => setUnidadeSlug(e.target.value)}
          className="h-10 max-w-[200px] rounded-md border border-clay/20 bg-background px-2 text-sm"
        >
          <option value="">Todas as unidades</option>
          {unidades.map((u) => (
            <option key={u._id} value={u.slug || u.codigo || ""}>
              {u.nome}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dataIso}
          onChange={(e) => setDataIso(e.target.value)}
          className="h-10 rounded-md border border-clay/20 bg-background px-2 text-sm"
        />
        {filtrosAtivos > 0 && (
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setStatus("todos");
              setEscopo("todos");
              setUnidadeSlug("");
              setDataIso("");
            }}
            className="h-10 rounded-md border border-clay/20 bg-paper px-3 text-xs font-medium text-clay hover:bg-sand"
          >
            Limpar filtros
          </button>
        )}
        {podeCriar && (
          <button
            type="button"
            onClick={() => setCriarAberto(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-semibold text-paper hover:bg-brand-blue"
          >
            <Plus className="h-4 w-4" /> Novo bloqueio
          </button>
        )}
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        {loading
          ? "Carregando bloqueios…"
          : `${filtrados.length} bloqueio${filtrados.length === 1 ? "" : "s"}`}
      </div>

      {erro && (
        <div className="mb-3 flex items-center justify-between alert-danger p-3 text-sm">
          <span>{erro}</span>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-md border border-[color:var(--danger-border)] px-2 py-1 text-xs text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)]"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-clay/15 bg-card md:block">
        <div className="grid grid-cols-[1.4fr_1fr_1.2fr_0.9fr_1.5fr_0.7fr_1fr] gap-3 border-b border-clay/15 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Unidade</div>
          <div>Tipo</div>
          <div>Período</div>
          <div>Horário</div>
          <div>Motivo</div>
          <div>Status</div>
          <div className="text-right">Ações</div>
        </div>
        {filtrados.map((b) => (
          <div
            key={b._id}
            className="grid grid-cols-[1.4fr_1fr_1.2fr_0.9fr_1.5fr_0.7fr_1fr] items-start gap-3 border-b border-clay/10 px-4 py-3 text-sm last:border-b-0 hover:bg-muted/20"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-ink">
                {b.escopo === "todas" ? "Todas as unidades" : b.unidadeNome || b.unidadeSlug}
              </div>
              {b.escopo === "unidade" && b.unidadeSlug && (
                <div className="mt-0.5 truncate font-mono text-[11px] text-clay">{b.unidadeSlug}</div>
              )}
            </div>
            <div className="min-w-0 text-[12px] text-ink/90">
              {b.tipoLabel || tipoLabel(b.tipo)}
            </div>
            <div className="min-w-0 text-[12px] text-ink/90">{periodoLabel(b)}</div>
            <div className="min-w-0 text-[12px] text-ink/90">{horarioLabel(b) || "—"}</div>
            <div className="min-w-0 text-[12px] text-ink/90" title={b.motivo}>
              <div className="line-clamp-2">{b.motivo}</div>
              {b.observacoesInternas && (
                <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                  {b.observacoesInternas}
                </div>
              )}
              {!!b.totalAgendamentosCancelados && (
                <div className="mt-1 text-[10.5px] text-clay">
                  {b.totalAgendamentosCancelados} cancelado{b.totalAgendamentosCancelados === 1 ? "" : "s"} · {b.totalEmailsCancelamentoEnviados || 0} e-mail{b.totalEmailsCancelamentoEnviados === 1 ? "" : "s"} enviado{b.totalEmailsCancelamentoEnviados === 1 ? "" : "s"}
                </div>
              )}
            </div>
            <div>
              <StatusPill status={b.status} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setEditar(b)}
                  className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2 py-1 text-[11px] font-medium text-ink hover:bg-sand"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
              )}
              {podeRemover && (
                <button
                  type="button"
                  onClick={() => setRemover(b)}
                  className="inline-flex items-center gap-1 rounded-md border border-[color:var(--danger-border)] bg-paper px-2 py-1 text-[11px] font-medium text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)]"
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && filtrados.length === 0 && !erro && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum bloqueio encontrado.
          </div>
        )}
      </div>

      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {filtrados.map((b) => {
          const aberto = expandidos.has(b._id);
          const nomeUn = b.escopo === "todas" ? "Todas as unidades" : b.unidadeNome || b.unidadeSlug;
          const tipo = b.tipoLabel || tipoLabel(b.tipo);
          return (
            <div key={b._id} className="overflow-hidden rounded-lg border border-clay/15 bg-card">
              <button
                type="button"
                onClick={() =>
                  setExpandidos((prev) => {
                    const next = new Set(prev);
                    if (next.has(b._id)) next.delete(b._id);
                    else next.add(b._id);
                    return next;
                  })
                }
                aria-expanded={aberto}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 truncate text-sm font-medium text-ink">{nomeUn}</div>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-clay">
                    {tipo} · {periodoLabel(b)}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    Motivo: {b.motivo}
                  </div>
                </div>
                <ChevronDown
                  className={"h-4 w-4 shrink-0 text-clay transition-transform " + (aberto ? "rotate-180" : "")}
                />
              </button>
              {aberto && (
                <div className="border-t border-clay/10 px-3 py-2.5">
                  <div className="space-y-1 text-[12px]">
                    <div className="flex items-center gap-1.5 text-ink/90">
                      <Calendar className="h-3 w-3 text-muted-foreground" /> {periodoLabel(b)}
                    </div>
                    {horarioLabel(b) && (
                      <div className="flex items-center gap-1.5 text-ink/90">
                        <Clock className="h-3 w-3 text-muted-foreground" /> {horarioLabel(b)}
                      </div>
                    )}
                    <div className="text-ink/90">
                      <span className="text-muted-foreground">Motivo: </span>
                      {b.motivo}
                    </div>
                    {b.observacoesInternas && (
                      <div className="text-[11px] text-muted-foreground">
                        <span className="text-clay">Obs.: </span>
                        {b.observacoesInternas}
                      </div>
                    )}
                    {!!b.totalAgendamentosCancelados && (
                      <div className="rounded-md border border-clay/15 bg-sand/30 p-2 text-[11px] text-clay">
                        {b.totalAgendamentosCancelados} agendamento{b.totalAgendamentosCancelados === 1 ? "" : "s"} cancelado{b.totalAgendamentosCancelados === 1 ? "" : "s"} · {b.totalEmailsCancelamentoEnviados || 0} e-mail{b.totalEmailsCancelamentoEnviados === 1 ? "" : "s"} enviado{b.totalEmailsCancelamentoEnviados === 1 ? "" : "s"}
                        {!!b.totalEmailsCancelamentoComErro && ` · ${b.totalEmailsCancelamentoComErro} falha${b.totalEmailsCancelamentoComErro === 1 ? "" : "s"}`}
                      </div>
                    )}
                    <div className="text-[11px] text-clay">
                      Escopo: {b.escopo === "todas" ? "Todas as unidades" : "Unidade específica"}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => setEditar(b)}
                        className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-sand"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                    )}
                    {podeRemover && (
                      <button
                        type="button"
                        onClick={() => setRemover(b)}
                        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--danger-border)] bg-paper px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && filtrados.length === 0 && !erro && (
          <div className="rounded-xl border border-clay/15 bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum bloqueio encontrado.
          </div>
        )}
      </div>

      {criarAberto && (
        <BloqueioFormModal
          token={token}
          modo="criar"
          unidades={unidades}
          podeCancelarAgendamentos={podeCancelarAgendamentos}
          onClose={() => setCriarAberto(false)}
          onSuccess={() => {
            setCriarAberto(false);
            setReloadKey((k) => k + 1);
          }}
          onUnauthorized={onUnauthorized}
        />
      )}

      {editar && (
        <BloqueioFormModal
          token={token}
          modo="editar"
          bloqueio={editar}
          unidades={unidades}
          podeCancelarAgendamentos={podeCancelarAgendamentos}
          onClose={() => setEditar(null)}
          onSuccess={() => {
            setEditar(null);
            setReloadKey((k) => k + 1);
          }}
          onUnauthorized={onUnauthorized}
        />
      )}

      {remover && (
        <ConfirmarRemoverModal
          bloqueio={remover}
          removendo={removendoId !== null}
          onConfirm={handleRemover}
          onCancel={() => removendoId === null && setRemover(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Resumo card
// ============================================================

function ResumoCard({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: number;
  tone?: "danger" | "info" | "neutral";
}) {
  const toneClass =
    tone === "danger"
      ? "text-[color:var(--danger-text)]"
      : tone === "info"
        ? "text-[color:var(--info-text)]"
        : tone === "neutral"
          ? "text-clay"
          : "text-ink";
  return (
    <div className="rounded-lg border border-clay/15 bg-card px-2.5 py-1.5 md:px-3 md:py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground md:text-[10px]">
        {label}
      </div>
      <div className={`mt-0.5 text-base font-semibold md:mt-1 md:text-xl ${toneClass}`}>{valor}</div>
    </div>
  );
}

// ============================================================
// Confirmar remoção
// ============================================================

function ConfirmarRemoverModal({
  bloqueio,
  removendo,
  onConfirm,
  onCancel,
}: {
  bloqueio: AdminBloqueio;
  removendo: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-semibold">Remover bloqueio?</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Esse bloqueio deixará de afetar a disponibilidade da agenda.
        </p>
        <div className="mb-5 rounded-lg border border-clay/15 bg-muted/40 p-3 text-xs">
          <div className="font-medium">
            {bloqueio.escopo === "todas"
              ? "Todas as unidades"
              : bloqueio.unidadeNome || bloqueio.unidadeSlug}
          </div>
          <div className="text-muted-foreground">
            {bloqueio.tipoLabel || tipoLabel(bloqueio.tipo)} · {periodoLabel(bloqueio)}
            {horarioLabel(bloqueio) ? ` · ${horarioLabel(bloqueio)}` : ""}
          </div>
          <div className="mt-1 text-ink/90">{bloqueio.motivo}</div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={removendo}
            className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={removendo}
            className="rounded-md border border-[color:var(--danger-border)] bg-paper px-3 py-2 text-sm font-semibold text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)] disabled:opacity-60"
          >
            {removendo ? "Removendo…" : "Remover bloqueio"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Form criar / editar
// ============================================================

function BloqueioFormModal({
  token,
  modo,
  bloqueio,
  unidades,
  podeCancelarAgendamentos,
  onClose,
  onSuccess,
  onUnauthorized,
}: {
  token: string;
  modo: "criar" | "editar";
  bloqueio?: AdminBloqueio;
  unidades: AdminUnidade[];
  podeCancelarAgendamentos: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onUnauthorized: () => void;
}) {
  const [escopo, setEscopo] = useState<AdminBloqueioEscopo>(bloqueio?.escopo ?? "todas");
  const [unidadeSlug, setUnidadeSlug] = useState<string>(bloqueio?.unidadeSlug ?? "");
  const [tipo, setTipo] = useState<AdminBloqueioTipo>(bloqueio?.tipo ?? "dia_inteiro");
  const [dataInicio, setDataInicio] = useState<string>(bloqueio?.dataInicio?.slice(0, 10) ?? "");
  const [dataFim, setDataFim] = useState<string>(bloqueio?.dataFim?.slice(0, 10) ?? "");
  const [horarioInicio, setHorarioInicio] = useState<string>(bloqueio?.horarioInicio ?? "");
  const [horarioFim, setHorarioFim] = useState<string>(bloqueio?.horarioFim ?? "");
  const [motivo, setMotivo] = useState<string>(bloqueio?.motivo ?? "");
  const [observacoes, setObservacoes] = useState<string>(bloqueio?.observacoesInternas ?? "");
  const [ativo, setAtivo] = useState<boolean>(bloqueio ? bloqueio.ativo : true);
  const [enviando, setEnviando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<"form" | "confirmar">("form");
  const [impacto, setImpacto] = useState<Extract<AdminBloqueioImpactoResposta, { ok: true }> | null>(null);
  const [cancelarAfetados, setCancelarAfetados] = useState(false);

  const validar = (): string | null => {
    if (!motivo.trim()) return "Informe o motivo público do bloqueio.";
    if (escopo === "unidade" && !unidadeSlug) return "Selecione a unidade do bloqueio.";
    if (!dataInicio) return "Informe a data do bloqueio.";
    if (tipo === "intervalo_datas") {
      if (!dataFim) return "Informe a data final do intervalo.";
      if (dataFim < dataInicio) return "A data final não pode ser anterior à data inicial.";
    }
    if (tipo === "horario") {
      if (!horarioInicio || !horarioFim) return "Informe o horário inicial e final.";
      if (horarioFim <= horarioInicio) return "O horário final deve ser posterior ao horário inicial.";
    }
    return null;
  };

  const montarPayload = (): CriarAdminBloqueioPayload => ({
    escopo,
    unidadeSlug: escopo === "unidade" ? unidadeSlug : undefined,
    tipo,
    dataInicio,
    dataFim:
      tipo === "intervalo_datas"
        ? dataFim
        : tipo === "dia_inteiro" || tipo === "horario"
          ? dataInicio
          : undefined,
    horarioInicio: tipo === "horario" ? horarioInicio : undefined,
    horarioFim: tipo === "horario" ? horarioFim : undefined,
    motivo: motivo.trim(),
    observacoesInternas: observacoes.trim() || undefined,
    ativo,
  });

  const tratarErroSessao = (e: unknown) => {
    if ((e as Error).message === "SESSAO_EXPIRADA") {
      toast.error("Sua sessão expirou. Entre novamente.");
      onUnauthorized();
      return true;
    }
    return false;
  };

  const salvar = async (
    payload: CriarAdminBloqueioPayload,
    cancelarAgendamentosExistentes = false,
  ) => {
    setEnviando(true);
    setErro(null);
    try {
      const r =
        modo === "criar"
          ? await criarAdminBloqueio(token, {
              ...payload,
              cancelarAgendamentosExistentes,
            })
          : await atualizarAdminBloqueio(token, { ...payload, bloqueioId: bloqueio!._id });

      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível salvar o bloqueio.");
        return;
      }

      toast.success(r.mensagem || (modo === "criar" ? "Bloqueio criado." : "Bloqueio atualizado."));

      if (r.cancelamento?.totalEmailsComErro) {
        toast.warning(
          `${r.cancelamento.totalEmailsComErro} notificação${r.cancelamento.totalEmailsComErro === 1 ? " não foi enviada" : " não foram enviadas"}. Os agendamentos foram cancelados mesmo assim.`,
        );
      }

      if (r.cancelamento?.listaAtualizadaRecomendada) {
        toast.warning(
          "A lista diária dessa data já havia sido enviada. Reenvie uma lista atualizada na aba Envios.",
        );
      }

      onSuccess();
    } catch (e) {
      if (tratarErroSessao(e)) return;
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const revisarOuSalvar = async () => {
    setErro(null);
    const validacao = validar();
    if (validacao) {
      setErro(validacao);
      return;
    }

    const payload = montarPayload();

    if (modo === "editar" || !ativo) {
      await salvar(payload, false);
      return;
    }

    setAnalisando(true);
    try {
      const r = await analisarImpactoAdminBloqueio(token, payload);
      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível verificar os agendamentos afetados.");
        return;
      }

      if (r.totalAfetados === 0) {
        await salvar(payload, false);
        return;
      }

      setImpacto(r);
      setCancelarAfetados(false);
      setEtapa("confirmar");
    } catch (e) {
      if (tratarErroSessao(e)) return;
      setErro("Falha ao verificar os agendamentos afetados. Tente novamente.");
    } finally {
      setAnalisando(false);
    }
  };

  const confirmarCriacao = async () => {
    const payload = montarPayload();
    await salvar(
      payload,
      cancelarAfetados && podeCancelarAgendamentos && impacto?.podeCancelar === true,
    );
  };

  const bloqueado = enviando || analisando;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={() => !bloqueado && onClose()}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {etapa === "confirmar" && impacto ? (
          <>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-4 w-4 text-[color:var(--warning-text)]" />
              Revisar impacto do bloqueio
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              O período informado já possui agendamentos ativos. Escolha como deseja prosseguir.
            </p>

            <div className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] p-4">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning-text)]" />
                <div>
                  <div className="font-semibold text-ink">
                    {impacto.totalAfetados} agendamento{impacto.totalAfetados === 1 ? "" : "s"} afetado{impacto.totalAfetados === 1 ? "" : "s"}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Se você criar o bloqueio sem cancelar, esses agendamentos continuarão válidos. O bloqueio impedirá apenas novos horários.
                  </p>
                </div>
              </div>
            </div>

            {impacto.totalComListaJaEnviada ? (
              <div className="mt-3 alert-info p-3 text-xs">
                Pelo menos um desses agendamentos já constou em lista diária enviada. Se houver cancelamento, será necessário reenviar uma lista atualizada na aba Envios.
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-lg border border-clay/15 bg-paper">
              <div className="border-b border-clay/10 bg-sand/35 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-clay">
                Agendamentos identificados
              </div>
              <div className="divide-y divide-clay/10">
                {impacto.agendamentos.slice(0, 6).map((item) => (
                  <div key={item._id} className="px-3 py-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-medium text-ink">{item.nomeAdvogado || "Advogado não informado"}</span>
                      <span className="font-mono text-[10px] text-clay">{item.protocolo}</span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {item.unidadeNome} · {item.dataLabel || formatDateBR(item.dataIso)} · {item.horarioLabel}
                    </div>
                  </div>
                ))}
              </div>
              {(impacto.truncado || impacto.totalAfetados > impacto.agendamentos.length) && (
                <div className="border-t border-clay/10 px-3 py-2 text-[11px] text-muted-foreground">
                  E mais {impacto.totalAfetados - impacto.agendamentos.length} agendamento{impacto.totalAfetados - impacto.agendamentos.length === 1 ? "" : "s"}.
                </div>
              )}
            </div>

            {podeCancelarAgendamentos && impacto.podeCancelar ? (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-clay/20 bg-sand/25 p-4">
                <input
                  type="checkbox"
                  checked={cancelarAfetados}
                  onChange={(e) => setCancelarAfetados(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Mail className="h-3.5 w-3.5" />
                    Cancelar os agendamentos e avisar os advogados
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    Os {impacto.totalAfetados} agendamentos serão cancelados e cada advogado receberá um e-mail com o motivo público informado. Se algum e-mail falhar, o cancelamento será mantido e a falha ficará registrada.
                  </span>
                </span>
              </label>
            ) : (
              <div className="mt-4 alert-warning p-3 text-xs">
                Você pode criar o bloqueio, mas não possui permissão para cancelar os agendamentos existentes.
              </div>
            )}

            {erro && <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>}

            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setEtapa("form");
                  setImpacto(null);
                  setCancelarAfetados(false);
                  setErro(null);
                }}
                disabled={bloqueado}
                className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60"
              >
                Voltar e revisar
              </button>
              <button
                type="button"
                onClick={confirmarCriacao}
                disabled={bloqueado}
                className={
                  "rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60 " +
                  (cancelarAfetados
                    ? "bg-[color:var(--danger-text)] text-paper hover:opacity-90"
                    : "bg-ink text-paper hover:bg-brand-blue")
                }
              >
                {enviando
                  ? "Criando…"
                  : cancelarAfetados
                    ? `Criar e cancelar ${impacto.totalAfetados}`
                    : "Criar sem cancelar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
              <Ban className="h-4 w-4 text-clay" />
              {modo === "criar" ? "Novo bloqueio de agenda" : "Editar bloqueio"}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Bloqueios impedem novos agendamentos no período configurado. Ao criar, o sistema verifica se já existem agendamentos afetados antes de concluir.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-clay">Escopo</span>
                <select
                  value={escopo}
                  onChange={(e) => setEscopo(e.target.value as AdminBloqueioEscopo)}
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                >
                  <option value="todas">Todas as unidades</option>
                  <option value="unidade">Unidade específica</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-clay">Unidade</span>
                <select
                  value={unidadeSlug}
                  onChange={(e) => setUnidadeSlug(e.target.value)}
                  disabled={escopo !== "unidade"}
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm disabled:bg-muted/40 disabled:text-clay"
                >
                  <option value="">
                    {escopo === "unidade" ? "Selecione a unidade" : "— não se aplica —"}
                  </option>
                  {unidades.map((u) => (
                    <option key={u._id} value={u.slug || u.codigo || ""}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-clay">Tipo de bloqueio</span>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as AdminBloqueioTipo)}
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                >
                  <option value="dia_inteiro">Dia inteiro</option>
                  <option value="intervalo_datas">Intervalo de datas</option>
                  <option value="horario">Horário específico</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-clay">
                  {tipo === "intervalo_datas" ? "Data inicial" : "Data"}
                </span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                />
              </label>

              {tipo === "intervalo_datas" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-clay">Data final</span>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                  />
                </label>
              )}

              {tipo === "horario" && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-clay">Horário inicial</span>
                    <input
                      type="time"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-clay">Horário final</span>
                    <input
                      type="time"
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                    />
                  </label>
                </>
              )}

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-clay">Motivo público</span>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                  placeholder="Ex.: indisponibilidade da unidade, manutenção, feriado…"
                />
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  Este texto será informado por e-mail aos advogados caso existam agendamentos cancelados.
                </span>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-clay">Observações internas</span>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm"
                  placeholder="Informações para a equipe administrativa. Não serão enviadas aos advogados."
                />
              </label>

              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-ink">Bloqueio ativo</span>
              </label>
            </div>

            {modo === "editar" && bloqueio?.totalAgendamentosCancelados ? (
              <div className="mt-4 alert-info p-3 text-xs">
                Este bloqueio já cancelou {bloqueio.totalAgendamentosCancelados} agendamento{bloqueio.totalAgendamentosCancelados === 1 ? "" : "s"} quando foi criado. Editar o período não cancela novos agendamentos automaticamente.
              </div>
            ) : null}

            {erro && <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={bloqueado}
                className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={revisarOuSalvar}
                disabled={bloqueado}
                className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60"
              >
                {analisando
                  ? "Verificando…"
                  : enviando
                    ? "Salvando…"
                    : modo === "criar"
                      ? "Revisar bloqueio"
                      : "Salvar alterações"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
