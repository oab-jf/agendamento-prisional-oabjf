import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Pencil, Plus, Search, Send, Trash2, UserX } from "lucide-react";
import {
  atualizarAdminUsuario,
  criarAdminUsuario,
  desativarAdminUsuario,
  excluirAdminUsuario,
  listarAdminUsuarios,
  reenviarConviteAdminUsuario,
  type AdminUsuario,
  type PermissaoGrupo,
} from "@/lib/oab-api";

type Props = {
  token: string;
  currentAdminId?: string;
  currentAdminEmail?: string;
  hasPermission: (chave: string) => boolean;
  onUnauthorized: () => void;
};

type FormPermissoesState = Set<string>;

const TEMPLATES: Record<string, string[]> = {
  admin_completo: [
    "agendamentos.ver",
    "agendamentos.cancelar",
    "agendamentos.remarcar",
    "documentos.ver",
    "documentos.abrir",
    "documentos.concluir",
    "unidades.ver",
    "unidades.criar",
    "unidades.editar",
    "unidades.ativar",
    "bloqueios.ver",
    "bloqueios.criar",
    "bloqueios.editar",
    "bloqueios.remover",
    "usuarios.ver",
    "usuarios.criar",
    "usuarios.editar",
    "usuarios.desativar",
    "config.ver",
    "config.testar_envios",
    "config.ativar_envios",
  ],
  op_agendamentos: [
    "agendamentos.ver",
    "agendamentos.cancelar",
    "agendamentos.remarcar",
    "unidades.ver",
    "bloqueios.ver",
  ],
  op_documentos: ["documentos.ver", "documentos.abrir", "documentos.concluir", "unidades.ver"],
  somente_consulta: [
    "agendamentos.ver",
    "documentos.ver",
    "unidades.ver",
    "bloqueios.ver",
    "usuarios.ver",
    "config.ver",
  ],
};

function normalize(v: string | undefined | null) {
  return (v || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// -------- convite helpers --------
type ConviteEstado = "ativo" | "inativo" | "convite_pendente" | "convite_expirado";

function estadoUsuario(u: AdminUsuario): ConviteEstado {
  if (!u.ativo) return "inativo";
  const status = (u.statusConvite || "").toLowerCase();
  if (status === "expirado" || status === "convite_expirado") return "convite_expirado";
  // Cadastro concluído: usuário completo. Legacy sem statusConvite também é completo.
  if (u.cadastroConcluido === true) return "ativo";
  if (u.legacy) return "ativo";
  if (status === "pendente" || status === "convite_pendente" || status === "enviado") {
    return "convite_pendente";
  }
  // Se veio conviteExpiraEm mas sem cadastroConcluido, tratar como pendente.
  if (u.conviteEnviadoEm && !u.cadastroConcluido) return "convite_pendente";
  return "ativo";
}

function displayNome(u: AdminUsuario): string {
  const nome = u.nome?.trim();
  if (nome) return nome;
  return "Cadastro pendente";
}

type PillTone = "success" | "neutral" | "warning" | "info" | "danger";

function StatusPill({ estado }: { estado: ConviteEstado }) {
  const map: Record<ConviteEstado, { label: string; cls: string }> = {
    ativo: { label: "Ativo", cls: "badge-success" },
    inativo: { label: "Inativo", cls: "badge-neutral" },
    convite_pendente: { label: "Convite pendente", cls: "badge-info" },
    convite_expirado: { label: "Convite expirado", cls: "badge-warning" },
  };
  const item = map[estado];
  return (
    <span
      className={
        "inline-flex w-fit items-center self-start whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium leading-[1.4] tracking-wide ring-1 " +
        item.cls
      }
    >
      {item.label}
    </span>
  );
}

function SecurityTag({ label, kind }: { label: string; kind: PillTone }) {
  const map: Record<PillTone, string> = {
    success: "badge-success",
    warning: "badge-warning",
    neutral: "badge-neutral",
    info: "badge-info",
    danger: "badge-warning",
  };
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-medium leading-[1.4] tracking-wide ring-1 " +
        (map[kind] || map.neutral)
      }
    >
      {label}
    </span>
  );
}

function securityTagsFor(u: AdminUsuario): { label: string; kind: PillTone }[] {
  const tags: { label: string; kind: PillTone }[] = [];
  const est = estadoUsuario(u);
  if (est === "convite_pendente") {
    tags.push({ label: "Convite pendente", kind: "info" });
    if (u.conviteExpiraEm) {
      tags.push({ label: `Expira em ${formatDate(u.conviteExpiraEm)}`, kind: "neutral" });
    }
    return tags;
  }
  if (est === "convite_expirado") {
    tags.push({ label: "Convite expirado", kind: "warning" });
    return tags;
  }
  tags.push(
    u.cpfCadastrado
      ? { label: "CPF cadastrado", kind: "success" }
      : { label: "CPF pendente", kind: "warning" },
  );
  tags.push(
    u.emailVerificado === false || u.precisaVerificarEmail
      ? { label: "E-mail pendente", kind: "warning" }
      : { label: "E-mail verificado", kind: "success" },
  );
  if (u.precisaTrocarSenha) {
    tags.push({ label: "Senha temporária", kind: "info" });
  } else if (u.senhaAlteradaEm) {
    tags.push({ label: "Senha já alterada", kind: "success" });
  }
  if (u.conviteAceitoEm) {
    tags.push({ label: "Convite aceito", kind: "success" });
  }
  return tags;
}

export function UsuariosTab({
  token,
  currentAdminId,
  currentAdminEmail,
  hasPermission,
  onUnauthorized,
}: Props) {
  const [status, setStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [permissoesDisponiveis, setPermissoesDisponiveis] = useState<PermissaoGrupo[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [criarAberto, setCriarAberto] = useState(false);
  const [editar, setEditar] = useState<AdminUsuario | null>(null);
  const [confirmarDesativar, setConfirmarDesativar] = useState<AdminUsuario | null>(null);
  const [desativandoId, setDesativandoId] = useState<string | null>(null);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);

  const podeCriar = hasPermission("usuarios.criar");
  const podeEditar = hasPermission("usuarios.editar");
  const podeDesativar = hasPermission("usuarios.desativar");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    listarAdminUsuarios(token, {
      status: status !== "todos" ? status : undefined,
      busca: busca.trim() || undefined,
    })
      .then((r) => {
        if (cancelled) return;
        setUsuarios(r.usuarios || []);
        setPermissoesDisponiveis(r.permissoesDisponiveis || []);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message === "SESSAO_EXPIRADA") {
          toast.error("Sua sessão expirou. Entre novamente.");
          onUnauthorized();
          return;
        }
        setErro(e.message || "Não foi possível carregar os usuários.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, status, busca, reloadKey, onUnauthorized]);

  const usuariosFiltrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      normalize(
        `${u.nome || ""} ${u.email} ${u.cargoFuncao || ""} ${(u.permissoes || []).join(" ")}`,
      ).includes(q),
    );
  }, [usuarios, busca]);

  const isSelf = useCallback(
    (u: AdminUsuario) =>
      (currentAdminId && u._id === currentAdminId) ||
      (!!currentAdminEmail && normalize(u.email) === normalize(currentAdminEmail)),
    [currentAdminId, currentAdminEmail],
  );

  const handleDesativar = async () => {
    if (!confirmarDesativar) return;
    const alvo = confirmarDesativar;
    setDesativandoId(alvo._id);
    try {
      const r = await desativarAdminUsuario(token, alvo._id);
      if (!r.ok) {
        toast.error(r.message || r.error || "Não foi possível desativar o usuário.");
        return;
      }
      toast.success(r.mensagem || "Usuário desativado.");
      setConfirmarDesativar(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setDesativandoId(null);
    }
  };

  const copiar = async (texto: string, msg = "Link copiado.") => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(msg);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const handleReenviarConvite = async (u: AdminUsuario) => {
    setReenviandoId(u._id);
    try {
      const r = await reenviarConviteAdminUsuario(token, u._id);
      if (!r.ok) {
        toast.error(r.message || r.error || "Não foi possível reenviar o convite.");
        return;
      }
      toast.success(r.mensagem || "Convite reenviado.");
      if (r.conviteUrl) {
        // opção discreta: já copia o link novo
        void copiar(r.conviteUrl, "Convite reenviado. Link copiado.");
      }
      setReloadKey((k) => k + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setReenviandoId(null);
    }
  };

  return (
    <div>
      {/* Barra de ações */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-md border border-clay/20 bg-background pl-8 pr-3 text-sm"
            placeholder="Buscar por nome, e-mail ou permissão"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-clay/20 bg-background px-2 text-sm"
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
        {podeCriar && (
          <button
            type="button"
            onClick={() => setCriarAberto(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-semibold text-paper hover:bg-brand-blue"
          >
            <Plus className="h-4 w-4" /> Enviar convite
          </button>
        )}
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        {loading
          ? "Carregando usuários…"
          : `${usuariosFiltrados.length} usuário${usuariosFiltrados.length === 1 ? "" : "s"}`}
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

      {/* Desktop: tabela */}
      <div className="hidden overflow-hidden rounded-xl border border-clay/15 bg-card md:block">
        <div className="grid grid-cols-[1.6fr_1.8fr_0.9fr_1.3fr] gap-3 border-b border-clay/15 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Nome / Cargo</div>
          <div>E-mail / Permissões</div>
          <div>Status</div>
          <div className="text-right">Ações</div>
        </div>
        {usuariosFiltrados.map((u) => {
          const self = isSelf(u);
          const est = estadoUsuario(u);
          const pendente = est === "convite_pendente" || est === "convite_expirado";
          const cargoLabel = u.cargoFuncao?.trim() || "Não informado";
          const resumoPerm = u.legacy
            ? "Administrador (legado)"
            : u.permissoes && u.permissoes.length > 0
              ? `${u.permissoes.length} permiss${u.permissoes.length === 1 ? "ão" : "ões"}`
              : "Sem permissões";
          return (
            <div
              key={u._id}
              className="grid grid-cols-[1.6fr_1.8fr_0.9fr_1.3fr] items-center gap-3 border-b border-clay/10 px-4 py-2.5 text-sm last:border-b-0 hover:bg-muted/20"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">
                  {displayNome(u)}{" "}
                  {self && <span className="text-[10px] text-muted-foreground">(você)</span>}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">{cargoLabel}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-ink/90">{u.email}</div>
                <div
                  className="truncate text-[11px] text-muted-foreground"
                  title={(u.permissoes || []).join(", ")}
                >
                  {resumoPerm}
                </div>
              </div>
              <div className="flex flex-col items-start gap-1 text-[12px] text-muted-foreground">
                <StatusPill estado={est} />
                <span className="text-[10.5px]">Último acesso: {formatDate(u.ultimoAcessoEm)}</span>
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
                {pendente && (podeEditar || podeCriar) && (
                  <button
                    type="button"
                    disabled={reenviandoId === u._id}
                    onClick={() => handleReenviarConvite(u)}
                    className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2 py-1 text-[11px] font-medium text-ink hover:bg-sand disabled:opacity-60"
                  >
                    <Send className="h-3 w-3" />
                    {reenviandoId === u._id ? "Reenviando…" : "Reenviar convite"}
                  </button>
                )}
                {podeDesativar && u.ativo && !self && (
                  <button
                    type="button"
                    onClick={() => setConfirmarDesativar(u)}
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--danger-border)] bg-paper px-2 py-1 text-[11px] font-medium text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)]"
                  >
                    <UserX className="h-3 w-3" /> Desativar
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && usuariosFiltrados.length === 0 && !erro && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {usuariosFiltrados.map((u) => {
          const self = isSelf(u);
          const est = estadoUsuario(u);
          const pendente = est === "convite_pendente" || est === "convite_expirado";
          const cargoLabel = u.cargoFuncao?.trim() || "Não informado";
          return (
            <div key={u._id} className="rounded-lg border border-clay/15 bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">
                    {displayNome(u)}{" "}
                    {self && <span className="text-[10px] text-muted-foreground">(você)</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">{cargoLabel}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{u.email}</div>
                </div>
                <StatusPill estado={est} />
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Último acesso: {formatDate(u.ultimoAcessoEm)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {u.legacy
                  ? "Administrador (legado)"
                  : `${(u.permissoes || []).length} permiss${(u.permissoes || []).length === 1 ? "ão" : "ões"}`}
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
                {pendente && (podeEditar || podeCriar) && (
                  <button
                    type="button"
                    disabled={reenviandoId === u._id}
                    onClick={() => handleReenviarConvite(u)}
                    className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-sand disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {reenviandoId === u._id ? "Reenviando…" : "Reenviar convite"}
                  </button>
                )}
                {podeDesativar && u.ativo && !self && (
                  <button
                    type="button"
                    onClick={() => setConfirmarDesativar(u)}
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--danger-border)] bg-paper px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)]"
                  >
                    <UserX className="h-3.5 w-3.5" /> Desativar
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && usuariosFiltrados.length === 0 && !erro && (
          <div className="rounded-xl border border-clay/15 bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {criarAberto && (
        <ConviteFormModal
          token={token}
          permissoesDisponiveis={permissoesDisponiveis}
          onClose={() => setCriarAberto(false)}
          onSuccess={() => {
            setCriarAberto(false);
            setReloadKey((k) => k + 1);
          }}
          onUnauthorized={onUnauthorized}
        />
      )}

      {editar && (
        <UsuarioFormModal
          token={token}
          usuario={editar}
          bloquearAtivo={isSelf(editar)}
          isSelf={isSelf(editar)}
          podeExcluir={podeDesativar}
          permissoesDisponiveis={permissoesDisponiveis}
          onClose={() => setEditar(null)}
          onSuccess={() => {
            setEditar(null);
            setReloadKey((k) => k + 1);
          }}
          onUnauthorized={onUnauthorized}
        />
      )}

      {confirmarDesativar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => desativandoId === null && setConfirmarDesativar(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">Desativar usuário?</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Esse usuário não conseguirá mais acessar o painel administrativo.
            </p>
            <div className="mb-5 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="font-medium">{displayNome(confirmarDesativar)}</div>
              <div className="text-muted-foreground">{confirmarDesativar.email}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmarDesativar(null)}
                disabled={desativandoId !== null}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                onClick={handleDesativar}
                disabled={desativandoId !== null}
                className="rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {desativandoId !== null ? "Desativando…" : "Desativar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Form de convite (criação)
// ============================================================

function ConviteFormModal({
  token,
  permissoesDisponiveis,
  onClose,
  onSuccess,
  onUnauthorized,
}: {
  token: string;
  permissoesDisponiveis: PermissaoGrupo[];
  onClose: () => void;
  onSuccess: () => void;
  onUnauthorized: () => void;
}) {
  const [email, setEmail] = useState("");
  const [cargoFuncao, setCargoFuncao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [permissoes, setPermissoes] = useState<FormPermissoesState>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conviteUrl, setConviteUrl] = useState<string | null>(null);

  const todasChaves = useMemo(
    () => permissoesDisponiveis.flatMap((g) => g.permissoes.map((p) => p.chave)),
    [permissoesDisponiveis],
  );

  const toggle = (chave: string) => {
    setPermissoes((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };
  const marcarTudo = () => setPermissoes(new Set(todasChaves));
  const limpar = () => setPermissoes(new Set());
  const somenteLeitura = () =>
    setPermissoes(new Set(todasChaves.filter((c) => c.endsWith(".ver"))));
  const aplicarTemplate = (key: keyof typeof TEMPLATES) => {
    const list = TEMPLATES[key].filter((c) => todasChaves.includes(c));
    setPermissoes(new Set(list));
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Link do convite copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const submit = async () => {
    setErro(null);
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      setErro("Informe um e-mail válido.");
      return;
    }
    setEnviando(true);
    try {
      const r = await criarAdminUsuario(token, {
        email: emailNorm,
        cargoFuncao: cargoFuncao.trim() || undefined,
        ativo,
        permissoes: Array.from(permissoes),
      });
      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível enviar o convite.");
        return;
      }
      toast.success(r.mensagem || "Convite enviado com sucesso.");
      if (r.conviteUrl) {
        setConviteUrl(r.conviteUrl);
      } else {
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
      onClick={() => !enviando && !conviteUrl && onClose()}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold">Enviar convite</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Informe o e-mail e defina as permissões. A pessoa receberá um link para concluir o
          cadastro.
        </p>

        {conviteUrl ? (
          <div className="mb-4 alert-info p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-ink">
              <Mail className="h-4 w-4" /> Convite enviado por e-mail
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Se preferir, você também pode copiar o link do convite e enviar por outro canal.
            </p>
            <div className="mb-3 break-all rounded-md border border-clay/20 bg-paper/80 p-2 font-mono text-[11px] text-ink">
              {conviteUrl}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => copiar(conviteUrl)}
                className="inline-flex items-center gap-1 rounded-md border border-clay/25 bg-paper px-3 py-2 text-sm font-medium text-ink hover:bg-sand"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar link
              </button>
              <button
                onClick={onSuccess}
                className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-clay">E-mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="nome@dominio.com"
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-clay">
                  Cargo/Função (opcional)
                </span>
                <input
                  value={cargoFuncao}
                  onChange={(e) => setCargoFuncao(e.target.value)}
                  placeholder="Ex.: Coordenador, Estagiário"
                  className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-ink">Usuário ativo</span>
              </label>
            </div>

            <PermissoesBlock
              permissoes={permissoes}
              toggle={toggle}
              marcarTudo={marcarTudo}
              limpar={limpar}
              somenteLeitura={somenteLeitura}
              aplicarTemplate={aplicarTemplate}
              permissoesDisponiveis={permissoesDisponiveis}
            />

            {erro && <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={enviando}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {enviando ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Form de edição
// ============================================================

function UsuarioFormModal({
  token,
  usuario,
  bloquearAtivo,
  isSelf,
  podeExcluir,
  permissoesDisponiveis,
  onClose,
  onSuccess,
  onUnauthorized,
}: {
  token: string;
  usuario: AdminUsuario;
  bloquearAtivo?: boolean;
  isSelf?: boolean;
  podeExcluir?: boolean;
  permissoesDisponiveis: PermissaoGrupo[];
  onClose: () => void;
  onSuccess: () => void;
  onUnauthorized: () => void;
}) {
  const est = estadoUsuario(usuario);
  const conviteAberto = est === "convite_pendente" || est === "convite_expirado";

  const [nome, setNome] = useState(usuario.nome ?? "");
  const [email, setEmail] = useState(usuario.email ?? "");
  const [cargoFuncao, setCargoFuncao] = useState(usuario.cargoFuncao ?? "");
  const [ativo, setAtivo] = useState<boolean>(usuario.ativo);
  const [permissoes, setPermissoes] = useState<FormPermissoesState>(
    () => new Set(usuario.permissoes || []),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const podeMostrarZonaRisco = !usuario.ativo && !isSelf && !!podeExcluir;

  const handleExcluir = async () => {
    setExcluindo(true);
    try {
      const r = await excluirAdminUsuario(token, usuario._id);
      if (!r.ok) {
        toast.error(r.message || r.error || "Não foi possível excluir o usuário agora.");
        return;
      }
      toast.success(r.mensagem || "Usuário excluído com sucesso.");
      setConfirmarExcluir(false);
      onSuccess();
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setExcluindo(false);
    }
  };

  const todasChaves = useMemo(
    () => permissoesDisponiveis.flatMap((g) => g.permissoes.map((p) => p.chave)),
    [permissoesDisponiveis],
  );

  const toggle = (chave: string) => {
    setPermissoes((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };
  const marcarTudo = () => setPermissoes(new Set(todasChaves));
  const limpar = () => setPermissoes(new Set());
  const somenteLeitura = () =>
    setPermissoes(new Set(todasChaves.filter((c) => c.endsWith(".ver"))));
  const aplicarTemplate = (key: keyof typeof TEMPLATES) => {
    const list = TEMPLATES[key].filter((c) => todasChaves.includes(c));
    setPermissoes(new Set(list));
  };

  const submit = async () => {
    setErro(null);
    if (!email.trim()) {
      setErro("Informe o e-mail.");
      return;
    }
    if (!conviteAberto) {
      if (!nome.trim() || !/\s/.test(nome.trim()) || nome.trim().length < 3) {
        setErro("Informe o nome completo (nome e sobrenome).");
        return;
      }
    }

    setEnviando(true);
    try {
      const r = await atualizarAdminUsuario(token, {
        usuarioId: usuario._id,
        nome: conviteAberto ? undefined : nome.trim(),
        email: email.trim().toLowerCase(),
        cargoFuncao: cargoFuncao.trim() || undefined,
        ativo,
        permissoes: Array.from(permissoes),
      });
      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível salvar o usuário.");
        return;
      }
      toast.success(r.mensagem || "Usuário atualizado.");
      onSuccess();
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
        <h2 className="mb-1 text-lg font-semibold">Editar usuário</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Ajuste e-mail, cargo/função, status e permissões.
        </p>

        {conviteAberto && (
          <div className="mb-5 alert-info p-3">
            <div className="mb-1 text-sm font-medium text-ink">
              Cadastro ainda não concluído
            </div>
            <p className="text-xs text-muted-foreground">
              Este usuário recebeu um convite e ainda não finalizou o cadastro. Nome, CPF e senha
              serão preenchidos por ele ao aceitar o convite.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {!conviteAberto && (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-clay">Nome completo</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome e sobrenome"
                autoComplete="name"
                className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-clay">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-clay">
              Cargo/Função {conviteAberto ? "(opcional)" : ""}
            </span>
            <input
              value={cargoFuncao}
              onChange={(e) => setCargoFuncao(e.target.value)}
              placeholder="Ex.: Coordenador, Estagiário"
              className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
            />
          </label>

          <div className="sm:col-span-2 rounded-md border border-clay/15 bg-paper p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-clay">
              Segurança do acesso
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {securityTagsFor(usuario).map((t) => (
                <SecurityTag key={t.label} label={t.label} kind={t.kind} />
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Essas informações ajudam a confirmar a identidade do usuário e proteger o acesso
              administrativo. O CPF nunca é exibido no painel.
            </p>
          </div>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              disabled={bloquearAtivo}
              className="h-4 w-4"
            />
            <span className="text-sm text-ink">
              Usuário ativo
              {bloquearAtivo && (
                <span className="ml-2 text-[11px] text-muted-foreground">
                  (não é possível desativar o próprio usuário)
                </span>
              )}
            </span>
          </label>
        </div>

        <PermissoesBlock
          permissoes={permissoes}
          toggle={toggle}
          marcarTudo={marcarTudo}
          limpar={limpar}
          somenteLeitura={somenteLeitura}
          aplicarTemplate={aplicarTemplate}
          permissoesDisponiveis={permissoesDisponiveis}
        />

        {podeMostrarZonaRisco && (
          <div className="mt-7 alert-danger p-4">
            <h3 className="mb-1 text-sm font-semibold text-destructive">Zona de risco</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Este usuário está inativo. Se ele não for mais necessário, você pode excluí-lo
              definitivamente.
            </p>
            <button
              type="button"
              onClick={() => setConfirmarExcluir(true)}
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--danger-border)] bg-paper px-3 py-2 text-sm font-medium text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)] disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir usuário
            </button>
          </div>
        )}

        {erro && <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={enviando}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={enviando}
            className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60"
          >
            {enviando ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>

      {confirmarExcluir && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !excluindo && setConfirmarExcluir(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">Excluir usuário?</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Essa ação remove o usuário do painel administrativo. O histórico de ações já
              registradas continuará nos logs.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmarExcluir(false)}
                disabled={excluindo}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--danger-text)] hover:brightness-95 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> {excluindo ? "Excluindo…" : "Excluir usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Bloco de permissões reutilizável
// ============================================================

function PermissoesBlock({
  permissoes,
  toggle,
  marcarTudo,
  limpar,
  somenteLeitura,
  aplicarTemplate,
  permissoesDisponiveis,
}: {
  permissoes: FormPermissoesState;
  toggle: (chave: string) => void;
  marcarTudo: () => void;
  limpar: () => void;
  somenteLeitura: () => void;
  aplicarTemplate: (key: keyof typeof TEMPLATES) => void;
  permissoesDisponiveis: PermissaoGrupo[];
}) {
  return (
    <div className="mt-7 border-t border-clay/15 pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink sm:text-lg">Permissões</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={marcarTudo}
            className="rounded-md border border-clay/30 bg-paper px-2.5 py-1.5 font-medium text-ink hover:bg-sand"
          >
            Marcar tudo
          </button>
          <button
            type="button"
            onClick={limpar}
            className="rounded-md border border-clay/30 bg-paper px-2.5 py-1.5 font-medium text-ink hover:bg-sand"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={somenteLeitura}
            className="rounded-md border border-clay/30 bg-paper px-2.5 py-1.5 font-medium text-ink hover:bg-sand"
          >
            Somente leitura
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-clay/15 bg-sand/30 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-clay">
          Modelos rápidos
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => aplicarTemplate("admin_completo")}
            className="rounded-md border border-clay/30 bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand"
          >
            Administrador completo
          </button>
          <button
            type="button"
            onClick={() => aplicarTemplate("op_agendamentos")}
            className="rounded-md border border-clay/30 bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand"
          >
            Operação de agendamentos
          </button>
          <button
            type="button"
            onClick={() => aplicarTemplate("op_documentos")}
            className="rounded-md border border-clay/30 bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand"
          >
            Operação de documentos
          </button>
          <button
            type="button"
            onClick={() => aplicarTemplate("somente_consulta")}
            className="rounded-md border border-clay/30 bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand"
          >
            Somente consulta
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {permissoesDisponiveis.map((g) => (
          <div key={g.grupo} className="rounded-md border border-clay/15 bg-sand/30 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-clay">
              {g.grupo}
            </div>
            <div className="space-y-1.5">
              {g.permissoes.map((p) => (
                <label key={p.chave} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={permissoes.has(p.chave)}
                    onChange={() => toggle(p.chave)}
                    className="h-4 w-4"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

