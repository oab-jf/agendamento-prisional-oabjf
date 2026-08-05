import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, ChevronDown, Filter, Mail, Pencil, Plus, Power, PowerOff, Search } from "lucide-react";
import {
  alterarStatusAdminUnidade,
  atualizarAdminUnidade,
  criarAdminUnidade,
  listarAdminUnidades,
  type AdminUnidade,
} from "@/lib/oab-api";

type Props = {
  token: string;
  hasPermission: (chave: string) => boolean;
  onUnauthorized: () => void;
};

function normalize(v: string | undefined | null) {
  return (v || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugify(v: string): string {
  return normalize(v)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isEmailValido(v: string): boolean {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function getCodigoUnidade(u: AdminUnidade): string {
  return u.slug || u.codigo || "";
}

function getEmailDocumentos(u: AdminUnidade): string {
  return (
    u.emailRecebimentoDocumentos ||
    u.emailDocumentos ||
    u.emailDestino ||
    ""
  ).trim();
}

function getEmailListas(u: AdminUnidade): string {
  return (u.emailRecebimentoListas || u.emailListas || u.emailAgenda || "").trim();
}

function StatusPill({ ativa }: { ativa: boolean }) {
  return (
    <span className={"badge-base " + (ativa ? "badge-success" : "badge-neutral")}>
      {ativa ? "Ativa" : "Inativa"}
    </span>
  );
}

function PendenciaTag({ children }: { children: React.ReactNode }) {
  return <span className="badge-base badge-warning">{children}</span>;
}

export function UnidadesTab({ token, hasPermission, onUnauthorized }: Props) {
  const [status, setStatus] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<AdminUnidade[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [criarAberto, setCriarAberto] = useState(false);
  const [editar, setEditar] = useState<AdminUnidade | null>(null);
  const [confirmarStatus, setConfirmarStatus] = useState<AdminUnidade | null>(null);
  const [alterandoStatusId, setAlterandoStatusId] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const podeCriar = hasPermission("unidades.criar");
  const podeEditar = hasPermission("unidades.editar");
  const podeAtivar = hasPermission("unidades.ativar");

  // Recolher cards ao trocar filtros/recarregar
  useEffect(() => {
    setExpandidos(new Set());
  }, [status, busca, reloadKey]);

  const filtrosAtivos = (status !== "todas" ? 1 : 0) + (busca.trim() ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    listarAdminUnidades(token, {
      status: status !== "todas" ? status : undefined,
      busca: busca.trim() || undefined,
    })
      .then((r) => {
        if (cancelled) return;
        setUnidades(r.unidades || []);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message === "SESSAO_EXPIRADA") {
          toast.error("Sua sessão expirou. Entre novamente.");
          onUnauthorized();
          return;
        }
        setErro(e.message || "Não foi possível carregar as unidades.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, status, busca, reloadKey, onUnauthorized]);

  const unidadesFiltradas = useMemo(() => {
    const q = normalize(busca);
    if (!q) return unidades;
    return unidades.filter((u) =>
      normalize(
        `${u.nome} ${getCodigoUnidade(u)} ${u.endereco ?? ""} ${getEmailDocumentos(u)} ${getEmailListas(u)}`,
      ).includes(q),
    );
  }, [unidades, busca]);

  const resumo = useMemo(() => {
    let ativas = 0;
    let inativas = 0;
    let pendencias = 0;
    for (const u of unidades) {
      if (u.ativa) ativas += 1;
      else inativas += 1;
      if (!getEmailDocumentos(u) || !getEmailListas(u)) pendencias += 1;
    }
    return { total: unidades.length, ativas, inativas, pendencias };
  }, [unidades]);

  const handleAlterarStatus = useCallback(async () => {
    if (!confirmarStatus) return;
    const alvo = confirmarStatus;
    const novaAtiva = !alvo.ativa;
    setAlterandoStatusId(alvo._id);
    try {
      const r = await alterarStatusAdminUnidade(token, alvo._id, novaAtiva);
      if (!r.ok) {
        toast.error(r.message || r.error || "Não foi possível alterar o status.");
        return;
      }
      toast.success(r.mensagem || (novaAtiva ? "Unidade ativada." : "Unidade desativada."));
      setConfirmarStatus(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setAlterandoStatusId(null);
    }
  }, [confirmarStatus, token, onUnauthorized]);

  return (
    <div>
      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <ResumoCard label="Total" valor={resumo.total} />
        <ResumoCard label="Ativas" valor={resumo.ativas} tone="success" />
        <ResumoCard label="Inativas" valor={resumo.inativas} tone="neutral" />
        <ResumoCard label="Com pendências" valor={resumo.pendencias} tone="warning" />
      </div>

      {/* Barra de ações — mobile: filtros colapsados */}
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
              <Plus className="h-4 w-4" /> Nova
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
                placeholder="Buscar por nome, código, endereço ou e-mail"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-md border border-clay/20 bg-background px-2 text-sm"
            >
              <option value="todas">Todas</option>
              <option value="ativas">Ativas</option>
              <option value="inativas">Inativas</option>
            </select>
            {filtrosAtivos > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setStatus("todas");
                }}
                className="h-9 w-full rounded-md border border-clay/20 bg-paper px-3 text-xs font-medium text-clay hover:bg-sand"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Barra de ações — desktop */}
      <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-md border border-clay/20 bg-background pl-8 pr-3 text-sm"
            placeholder="Buscar por nome, código, endereço ou e-mail"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-clay/20 bg-background px-2 text-sm"
        >
          <option value="todas">Todas</option>
          <option value="ativas">Ativas</option>
          <option value="inativas">Inativas</option>
        </select>
        {podeCriar && (
          <button
            type="button"
            onClick={() => setCriarAberto(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-semibold text-paper hover:bg-brand-blue"
          >
            <Plus className="h-4 w-4" /> Nova unidade
          </button>
        )}
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        {loading
          ? "Carregando unidades…"
          : `${unidadesFiltradas.length} unidade${unidadesFiltradas.length === 1 ? "" : "s"}`}
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
        <div className="grid grid-cols-[1.6fr_1fr_0.7fr_1.4fr_1.4fr_1.2fr] gap-3 border-b border-clay/15 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Unidade</div>
          <div>Código</div>
          <div>Status</div>
          <div>E-mail para documentos</div>
          <div>E-mail para listas</div>
          <div className="text-right">Ações</div>
        </div>
        {unidadesFiltradas.map((u) => {
          const emDoc = getEmailDocumentos(u);
          const emList = getEmailListas(u);
          return (
            <div
              key={u._id}
              className="grid grid-cols-[1.6fr_1fr_0.7fr_1.4fr_1.4fr_1.2fr] items-start gap-3 border-b border-clay/10 px-4 py-3 text-sm last:border-b-0 hover:bg-muted/20"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{u.nome}</div>
                {u.endereco && (
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {u.endereco}
                  </div>
                )}
              </div>
              <div className="min-w-0 truncate font-mono text-[12px] text-clay">
                {getCodigoUnidade(u)}
              </div>
              <div>
                <StatusPill ativa={u.ativa} />
              </div>
              <div className="min-w-0 truncate text-[12px] text-ink/90" title={emDoc}>
                {emDoc || <PendenciaTag>Sem e-mail para documentos</PendenciaTag>}
              </div>
              <div className="min-w-0 truncate text-[12px] text-ink/90" title={emList}>
                {emList || <PendenciaTag>Sem e-mail para listas</PendenciaTag>}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => setEditar(u)}
                    className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2 py-1 text-[11px] font-medium text-ink hover:bg-sand"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
                {podeAtivar && u.ativa && (
                  <button
                    type="button"
                    onClick={() => setConfirmarStatus(u)}
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--danger-border)] bg-paper px-2 py-1 text-[11px] font-medium text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)]"
                  >
                    <PowerOff className="h-3 w-3" /> Desativar
                  </button>
                )}
                {podeAtivar && !u.ativa && (
                  <button
                    type="button"
                    onClick={() => setConfirmarStatus(u)}
                    className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2 py-1 text-[11px] font-medium text-ink hover:bg-sand"
                  >
                    <Power className="h-3 w-3" /> Ativar
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && unidadesFiltradas.length === 0 && !erro && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma unidade encontrada.
          </div>
        )}
      </div>

      {/* Mobile — cards colapsáveis */}
      <div className="space-y-2 md:hidden">
        {unidadesFiltradas.map((u) => {
          const emDoc = getEmailDocumentos(u);
          const emList = getEmailListas(u);
          const semPendencia = emDoc && emList;
          const pendencias = (!emDoc ? 1 : 0) + (!emList ? 1 : 0);
          const aberto = expandidos.has(u._id);
          return (
            <div key={u._id} className="overflow-hidden rounded-lg border border-clay/15 bg-card">
              <button
                type="button"
                onClick={() =>
                  setExpandidos((prev) => {
                    const next = new Set(prev);
                    if (next.has(u._id)) next.delete(u._id);
                    else next.add(u._id);
                    return next;
                  })
                }
                aria-expanded={aberto}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{u.nome}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-clay">
                    <span className="font-mono">{getCodigoUnidade(u)}</span>
                    <span className="text-clay/50">·</span>
                    <StatusPill ativa={u.ativa} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {semPendencia
                      ? "2 e-mails cadastrados"
                      : `${pendencias} pendência${pendencias === 1 ? "" : "s"} de cadastro`}
                  </div>
                </div>
                <ChevronDown
                  className={"h-4 w-4 shrink-0 text-clay transition-transform " + (aberto ? "rotate-180" : "")}
                />
              </button>
              {aberto && (
                <div className="border-t border-clay/10 px-3 py-2.5">
                  {u.endereco && (
                    <div className="mb-2 text-[11px] text-muted-foreground">{u.endereco}</div>
                  )}
                  <div className="space-y-1 text-[12px]">
                    <div className="flex items-start gap-1.5">
                      <Mail className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-clay">Documentos</div>
                        <div className="break-all text-ink/90">
                          {emDoc || <PendenciaTag>Sem e-mail para documentos</PendenciaTag>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Mail className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-clay">Listas</div>
                        <div className="break-all text-ink/90">
                          {emList || <PendenciaTag>Sem e-mail para listas</PendenciaTag>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => setEditar(u)}
                        className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-sand"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                    )}
                    {podeAtivar && u.ativa && (
                      <button
                        type="button"
                        onClick={() => setConfirmarStatus(u)}
                        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--danger-border)] bg-paper px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)]"
                      >
                        <PowerOff className="h-3.5 w-3.5" /> Desativar
                      </button>
                    )}
                    {podeAtivar && !u.ativa && (
                      <button
                        type="button"
                        onClick={() => setConfirmarStatus(u)}
                        className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-sand"
                      >
                        <Power className="h-3.5 w-3.5" /> Ativar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && unidadesFiltradas.length === 0 && !erro && (
          <div className="rounded-xl border border-clay/15 bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhuma unidade encontrada.
          </div>
        )}
      </div>

      {criarAberto && (
        <UnidadeFormModal
          token={token}
          modo="criar"
          onClose={() => setCriarAberto(false)}
          onSuccess={() => {
            setCriarAberto(false);
            setReloadKey((k) => k + 1);
          }}
          onUnauthorized={onUnauthorized}
        />
      )}

      {editar && (
        <UnidadeFormModal
          token={token}
          modo="editar"
          unidade={editar}
          onClose={() => setEditar(null)}
          onSuccess={() => {
            setEditar(null);
            setReloadKey((k) => k + 1);
          }}
          onUnauthorized={onUnauthorized}
        />
      )}

      {confirmarStatus && (
        <ConfirmarStatusModal
          unidade={confirmarStatus}
          alterando={alterandoStatusId !== null}
          onConfirm={handleAlterarStatus}
          onCancel={() => alterandoStatusId === null && setConfirmarStatus(null)}
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
  tone?: "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-[color:var(--success-text)]"
      : tone === "warning"
        ? "text-[color:var(--warning-text)]"
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
// Confirmar ativar/desativar
// ============================================================

function ConfirmarStatusModal({
  unidade,
  alterando,
  onConfirm,
  onCancel,
}: {
  unidade: AdminUnidade;
  alterando: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const desativar = unidade.ativa;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-semibold">
          {desativar ? "Desativar unidade?" : "Ativar unidade?"}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {desativar
            ? "Unidades inativas deixam de aparecer nos fluxos públicos de agendamento e envio de documentos."
            : "Esta unidade voltará a aparecer nos fluxos públicos."}
        </p>
        <div className="mb-5 rounded-lg border border-clay/15 bg-muted/40 p-3 text-xs">
          <div className="font-medium">{unidade.nome}</div>
          <div className="font-mono text-muted-foreground">{getCodigoUnidade(unidade)}</div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={alterando}
            className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={alterando}
            className={
              "rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60 " +
              (desativar
                ? "bg-[color:var(--danger-text)] text-paper hover:opacity-90"
                : "bg-ink text-paper hover:bg-brand-blue")
            }
          >
            {alterando
              ? desativar
                ? "Desativando…"
                : "Ativando…"
              : desativar
                ? "Desativar unidade"
                : "Ativar unidade"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Form criar / editar
// ============================================================

function UnidadeFormModal({
  token,
  modo,
  unidade,
  onClose,
  onSuccess,
  onUnauthorized,
}: {
  token: string;
  modo: "criar" | "editar";
  unidade?: AdminUnidade;
  onClose: () => void;
  onSuccess: () => void;
  onUnauthorized: () => void;
}) {
  const [nome, setNome] = useState(unidade?.nome ?? "");
  const [slug, setSlug] = useState(unidade ? getCodigoUnidade(unidade) : "");
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(modo === "editar");
  const [endereco, setEndereco] = useState(unidade?.endereco ?? "");
  const [emailDoc, setEmailDoc] = useState(unidade ? getEmailDocumentos(unidade) : "");
  const [emailList, setEmailList] = useState(unidade ? getEmailListas(unidade) : "");
  const [observacoes, setObservacoes] = useState(unidade?.observacoesInternas ?? "");
  const [ativa, setAtiva] = useState<boolean>(unidade ? unidade.ativa : true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleNomeChange = (v: string) => {
    setNome(v);
    if (modo === "criar" && !slugEditadoManualmente) {
      setSlug(slugify(v));
    }
  };

  const handleSlugChange = (v: string) => {
    setSlug(slugify(v));
    setSlugEditadoManualmente(true);
  };

  const submit = async () => {
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome da unidade.");
      return;
    }
    if (modo === "criar" && !slug.trim()) {
      setErro("Informe o código da unidade.");
      return;
    }
    if (emailDoc && !isEmailValido(emailDoc)) {
      setErro("E-mail para documentos inválido.");
      return;
    }
    if (emailList && !isEmailValido(emailList)) {
      setErro("E-mail para listas inválido.");
      return;
    }

    setEnviando(true);
    try {
      if (modo === "criar") {
        const r = await criarAdminUnidade(token, {
          nome: nome.trim(),
          slug: slug.trim() || undefined,
          endereco: endereco.trim() || undefined,
          ativa,
          emailRecebimentoDocumentos: emailDoc.trim() || undefined,
          emailRecebimentoListas: emailList.trim() || undefined,
          observacoesInternas: observacoes.trim() || undefined,
        });
        if (!r.ok) {
          setErro(r.message || r.error || "Não foi possível criar a unidade.");
          return;
        }
        toast.success(r.mensagem || "Unidade criada.");
        onSuccess();
      } else if (unidade) {
        const r = await atualizarAdminUnidade(token, {
          unidadeId: unidade._id,
          nome: nome.trim(),
          endereco: endereco.trim() || undefined,
          ativa,
          emailRecebimentoDocumentos: emailDoc.trim() || undefined,
          emailRecebimentoListas: emailList.trim() || undefined,
          observacoesInternas: observacoes.trim() || undefined,
        });
        if (!r.ok) {
          setErro(r.message || r.error || "Não foi possível salvar a unidade.");
          return;
        }
        toast.success(r.mensagem || "Unidade atualizada.");
        onSuccess();
      }
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={() => !enviando && onClose()}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Building2 className="h-4 w-4 text-clay" />
          {modo === "criar" ? "Novo cadastro de unidade" : "Editar unidade"}
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {modo === "criar"
            ? "Preencha os dados da unidade prisional. O código é gerado automaticamente a partir do nome, mas pode ser ajustado antes de salvar."
            : "Ajuste os dados da unidade. O código não pode ser alterado após a criação."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-clay">Nome da unidade</span>
            <input
              value={nome}
              onChange={(e) => handleNomeChange(e.target.value)}
              className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
              placeholder="Ex.: Penitenciária José Edson Cavalieri"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-clay">Código da unidade</span>
            {modo === "criar" ? (
              <>
                <input
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 font-mono text-sm"
                  placeholder="penitenciaria-jose-edson-cavalieri"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  O código é usado nos agendamentos e não poderá ser alterado depois da criação.
                </span>
              </>
            ) : (
              <>
                <input
                  value={slug}
                  readOnly
                  className="h-10 w-full cursor-not-allowed rounded-md border border-clay/15 bg-muted/40 px-3 font-mono text-sm text-clay"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  O código da unidade é usado nos agendamentos e não deve ser alterado depois da
                  criação.
                </span>
              </>
            )}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-clay">Endereço</span>
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-clay">E-mail para documentos</span>
            <input
              type="email"
              value={emailDoc}
              onChange={(e) => setEmailDoc(e.target.value)}
              className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
              placeholder="documentos@unidade.gov.br"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-clay">E-mail para listas</span>
            <input
              type="email"
              value={emailList}
              onChange={(e) => setEmailList(e.target.value)}
              className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
              placeholder="agenda@unidade.gov.br"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-clay">Observações internas</span>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={ativa}
              onChange={(e) => setAtiva(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-ink">Unidade ativa</span>
          </label>
        </div>

        {modo === "editar" && (
          <div className="mt-5 rounded-lg border border-clay/15 bg-muted/30 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-clay">
              Bloqueios da unidade
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Os bloqueios são gerenciados na aba Bloqueios. Use essa seção para bloquear dias, períodos ou horários específicos da agenda.
            </div>
          </div>
        )}

        {erro && (
          <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={enviando}
            className="rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm text-ink hover:bg-sand disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={enviando}
            className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60"
          >
            {enviando ? "Salvando…" : modo === "criar" ? "Criar unidade" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

