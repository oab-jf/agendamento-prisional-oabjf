import {
  createFileRoute,
  Link } from "@tanstack/react-router";
import { memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import { ArrowUpRight,
  Ban,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Info,
  LogOut,
  Search,
  Users,
  Send,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import {
  adminLogin,
  adminMe,
  cancelarAdminAgendamento,
  concluirAdminDocumento,
  confirmarEmailAdmin,
  listarAdminAgendamentos,
  listarAdminDocumentos,
  listarDatasDisponiveis,
  listarHorariosDisponiveis,
  reenviarCodigoEmailAdmin,
  remarcarAdminAgendamento,
  trocarSenhaAdmin,
  type AdminAgendamento,
  type AdminDocumento,
  type AdminDocumentosFiltros,
  type AdminFiltros,
  type DataDisponivel,
  type HorarioDisponivel,
} from "@/lib/oab-api";
import { UsuariosTab } from "@/components/admin/UsuariosTab";
import { UnidadesTab } from "@/components/admin/UnidadesTab";
import { BloqueiosTab } from "@/components/admin/BloqueiosTab";
import { EnviosTab } from "@/components/admin/EnviosTab";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const TOKEN_KEY = "oabAdminToken";
const EMAIL_KEY = "oabAdminEmail";
const PERMS_KEY = "oabAdminPermissoes";
const LEGACY_KEY = "oabAdminLegacy";
const ADMIN_ID_KEY = "oabAdminId";

type AdminSessionInfo = {
  permissoes: string[];
  legacy: boolean;
  adminId?: string;
  adminEmail?: string;
};

function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [legacy, setLegacy] = useState<boolean>(false);
  const [sessaoValidada, setSessaoValidada] = useState<boolean>(false);
  const validationDoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = sessionStorage.getItem(TOKEN_KEY);
    const e = sessionStorage.getItem(EMAIL_KEY);
    const id = sessionStorage.getItem(ADMIN_ID_KEY);
    const p = sessionStorage.getItem(PERMS_KEY);
    const l = sessionStorage.getItem(LEGACY_KEY);
    if (t) setToken(t);
    if (e) setAdminEmail(e);
    if (id) setAdminId(id);
    if (p) {
      try {
        const parsed = JSON.parse(p);
        if (Array.isArray(parsed)) setPermissoes(parsed.filter((x) => typeof x === "string"));
      } catch {
        /* ignore */
      }
    }
    if (l === "1") setLegacy(true);
  }, []);

  const handleLogin = useCallback((t: string, email: string, session: AdminSessionInfo) => {
    sessionStorage.setItem(TOKEN_KEY, t);
    sessionStorage.setItem(EMAIL_KEY, email);
    sessionStorage.setItem(PERMS_KEY, JSON.stringify(session.permissoes));
    sessionStorage.setItem(LEGACY_KEY, session.legacy ? "1" : "0");
    if (session.adminId) sessionStorage.setItem(ADMIN_ID_KEY, session.adminId);
    else sessionStorage.removeItem(ADMIN_ID_KEY);
    setToken(t);
    setAdminEmail(email);
    setAdminId(session.adminId ?? null);
    setPermissoes(session.permissoes);
    setLegacy(session.legacy);
    setSessaoValidada(true);
    validationDoneRef.current = t;
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(PERMS_KEY);
    sessionStorage.removeItem(LEGACY_KEY);
    sessionStorage.removeItem(ADMIN_ID_KEY);
    setToken(null);
    setAdminEmail(null);
    setAdminId(null);
    setPermissoes([]);
    setLegacy(false);
    setSessaoValidada(false);
    validationDoneRef.current = null;
  }, []);

  // Ao entrar no painel com um token restaurado, revalidar via /oabAdminMe.
  useEffect(() => {
    if (!token) return;
    if (validationDoneRef.current === token) return;
    validationDoneRef.current = token;
    let cancelled = false;
    adminMe(token)
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          toast.error(r.message || "Sessão inválida. Entre novamente.");
          handleLogout();
          return;
        }
        setPermissoes(r.permissoes || []);
        setLegacy(!!r.legacy);
        sessionStorage.setItem(PERMS_KEY, JSON.stringify(r.permissoes || []));
        sessionStorage.setItem(LEGACY_KEY, r.legacy ? "1" : "0");
        if (r.admin?._id) {
          setAdminId(r.admin._id);
          sessionStorage.setItem(ADMIN_ID_KEY, r.admin._id);
        }
        if (r.admin?.email) {
          setAdminEmail(r.admin.email);
          sessionStorage.setItem(EMAIL_KEY, r.admin.email);
        }
        setSessaoValidada(true);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message === "SESSAO_EXPIRADA") {
          toast.error("Sua sessão expirou. Entre novamente.");
          handleLogout();
          return;
        }
        // Falha de rede: mantém sessão local (permissões em cache) para não travar o painel.
        setSessaoValidada(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, handleLogout]);

  const hasPermission = useCallback(
    (chave: string) => {
      if (legacy) return true;
      return permissoes.includes(chave);
    },
    [legacy, permissoes],
  );

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <AdminShell
      token={token}
      email={adminEmail}
      adminId={adminId ?? undefined}
      hasPermission={hasPermission}
      sessaoValidada={sessaoValidada}
      onLogout={handleLogout}
    />
  );
}


type LoginHandler = (token: string, email: string, session: AdminSessionInfo) => void;

function LoginScreen({ onLogin }: { onLogin: LoginHandler }) {
  return <LoginLayout onLogin={onLogin} />;
}

const ADMIN_BACK_LINK = (
  <Link
    to="/"
    className="inline-flex items-center rounded-md border border-clay/20 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-sand md:px-3 md:py-2 md:text-xs md:tracking-[0.15em]"
  >
    <span className="md:hidden">Voltar</span>
    <span className="hidden md:inline">Voltar para a Central</span>
  </Link>
);

const LoginLayout = memo(function LoginLayout({ onLogin }: { onLogin: LoginHandler }) {
  return (
    <AppShell title="Acesso administrativo" width="narrow" rightSlot={ADMIN_BACK_LINK}>
      <LoginForm onLogin={onLogin} />
    </AppShell>
  );
});

type LoginStep = "login" | "verificar-email" | "trocar-senha";

function LoginForm({ onLogin }: { onLogin: LoginHandler }) {
  const [step, setStep] = useState<LoginStep>("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estado temporário para verificação de e-mail
  const [codigo, setCodigo] = useState("");
  const [reenviando, setReenviando] = useState(false);

  // Estado para troca obrigatória de senha
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingAdmin, setPendingAdmin] = useState<{
    email: string;
    permissoes?: string[];
    legacy?: boolean;
    _id?: string;
  } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");

  const voltarParaLogin = () => {
    setStep("login");
    setCodigo("");
    setSenha("");
    setNovaSenha("");
    setConfirmarNovaSenha("");
    setPendingToken(null);
    setPendingAdmin(null);
    setErro(null);
  };

  const entrarNoPainel = (token: string, admin: { email?: string; permissoes?: string[]; legacy?: boolean; _id?: string }) => {
    onLogin(token, admin.email || email.trim(), {
      permissoes: Array.isArray(admin.permissoes) ? admin.permissoes : [],
      legacy: !!admin.legacy,
      adminId: admin._id,
      adminEmail: admin.email,
    });
    // Limpa credenciais sensíveis do estado
    setSenha("");
    setNovaSenha("");
    setConfirmarNovaSenha("");
    setCodigo("");
    toast.success("Bem-vindo ao painel.");
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!email || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const r = await adminLogin(email.trim(), senha);
      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível entrar. Verifique suas credenciais.");
        return;
      }
      // E-mail não verificado — mostrar etapa de código
      if (r.precisaVerificarEmail) {
        setStep("verificar-email");
        return;
      }
      // Token retornado
      if (r.token) {
        const admin = r.admin || { email: email.trim() };
        if (r.precisaTrocarSenha) {
          setPendingToken(r.token);
          setPendingAdmin({
            email: admin.email || email.trim(),
            permissoes: admin.permissoes,
            legacy: admin.legacy,
            _id: admin._id,
          });
          setStep("trocar-senha");
          return;
        }
        entrarNoPainel(r.token, admin);
        return;
      }
      setErro("Resposta inesperada do servidor. Tente novamente.");
    } catch {
      setErro("Falha de conexão com o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const submitCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!codigo.trim()) {
      setErro("Informe o código enviado por e-mail.");
      return;
    }
    setLoading(true);
    try {
      const r = await confirmarEmailAdmin({ email: email.trim(), senha, codigo: codigo.trim() });
      if (!r.ok) {
        setErro(r.message || r.error || "Código inválido.");
        return;
      }
      if (r.precisaTrocarSenha) {
        setPendingToken(r.token);
        setPendingAdmin({
          email: r.admin?.email || email.trim(),
          permissoes: r.admin?.permissoes,
          legacy: r.admin?.legacy,
          _id: r.admin?._id,
        });
        setCodigo("");
        setStep("trocar-senha");
        return;
      }
      entrarNoPainel(r.token, r.admin || { email: email.trim() });
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    setErro(null);
    setReenviando(true);
    try {
      const r = await reenviarCodigoEmailAdmin({ email: email.trim(), senha });
      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível reenviar o código.");
        return;
      }
      toast.success(r.mensagem || "Código reenviado. Verifique seu e-mail.");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setReenviando(false);
    }
  };

  const submitTrocaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (novaSenha.length < 8) {
      setErro("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErro("As senhas não conferem.");
      return;
    }
    if (!pendingToken) {
      setErro("Sessão expirou. Faça login novamente.");
      voltarParaLogin();
      return;
    }
    setLoading(true);
    try {
      const r = await trocarSenhaAdmin(pendingToken, { novaSenha });
      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível salvar a nova senha.");
        return;
      }
      toast.success(r.mensagem || "Senha atualizada com sucesso.");
      entrarNoPainel(r.token, r.admin || pendingAdmin || { email: email.trim() });
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const containerCls =
    "mx-auto w-full max-w-md rounded-lg border border-clay/15 bg-sand/40 p-6 md:p-8";

  if (step === "verificar-email") {
    return (
      <form onSubmit={submitCodigo} className={containerCls}>
        <h1 className="mb-1 font-serif text-2xl text-ink">Verifique seu e-mail</h1>
        <p className="mb-6 text-sm text-clay">
          Enviamos um código de validação para o e-mail cadastrado. Informe o código para confirmar seu acesso ao painel.
        </p>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-clay">Código de verificação</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-11 w-full rounded-md border border-clay/25 bg-paper px-3 text-base tracking-[0.35em] text-center font-medium"
            required
          />
        </label>
        {erro && <div className="mb-4 alert-danger p-3 text-sm">{erro}</div>}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-ink text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-brand-blue disabled:opacity-60"
        >
          {loading ? "Confirmando…" : "Confirmar código"}
        </button>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={voltarParaLogin}
            className="text-xs font-medium text-clay hover:text-ink"
          >
            Voltar para login
          </button>
          <button
            type="button"
            onClick={reenviarCodigo}
            disabled={reenviando}
            className="rounded-md border border-clay/25 bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand disabled:opacity-60"
          >
            {reenviando ? "Reenviando…" : "Reenviar código"}
          </button>
        </div>
      </form>
    );
  }

  if (step === "trocar-senha") {
    return (
      <form onSubmit={submitTrocaSenha} className={containerCls}>
        <h1 className="mb-1 font-serif text-2xl text-ink">Crie uma nova senha</h1>
        <p className="mb-6 text-sm text-clay">
          Antes de acessar o painel, defina uma senha própria para substituir a senha temporária.
        </p>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-clay">Nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="h-11 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
            required
            minLength={8}
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-clay">Confirmar nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmarNovaSenha}
            onChange={(e) => setConfirmarNovaSenha(e.target.value)}
            className="h-11 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
            required
            minLength={8}
          />
        </label>
        {erro && <div className="mb-4 alert-danger p-3 text-sm">{erro}</div>}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-ink text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-brand-blue disabled:opacity-60"
        >
          {loading ? "Salvando…" : "Salvar nova senha"}
        </button>
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={voltarParaLogin}
            className="text-xs font-medium text-clay hover:text-ink"
          >
            Voltar para login
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitLogin} className={containerCls}>
      <h1 className="mb-1 font-serif text-2xl text-ink">Acesso administrativo</h1>
      <p className="mb-6 text-sm text-clay">
        Entre com suas credenciais para gerenciar os agendamentos.
      </p>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-clay">E-mail</span>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          required
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-medium text-clay">Senha</span>
        <div className="relative">
          <input
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="h-11 w-full rounded-md border border-clay/25 bg-paper pl-3 pr-11 text-sm"
            required
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrarSenha}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-clay/70 hover:text-clay focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-r-md"
          >
            {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      {erro && (
        <div className="mb-4 alert-danger p-3 text-sm">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-md bg-ink text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-brand-blue disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar no painel"}
      </button>
    </form>
  );
}

type AdminTabKey =
  | "agendamentos"
  | "documentos"
  | "unidades"
  | "bloqueios"
  | "envios"
  | "usuarios";

function AdminShell({
  token,
  email,
  adminId,
  hasPermission,
  sessaoValidada,
  onLogout,
}: {
  token: string;
  email: string | null;
  adminId?: string;
  hasPermission: (chave: string) => boolean;
  sessaoValidada: boolean;
  onLogout: () => void;
}) {
  const tabsDisponiveis = useMemo(() => {
    const list: { key: AdminTabKey; label: string; icon: React.ReactNode }[] = [];
    if (hasPermission("agendamentos.ver"))
      list.push({ key: "agendamentos", label: "Agendamentos", icon: <Calendar className="h-4 w-4" /> });
    if (hasPermission("documentos.ver"))
      list.push({ key: "documentos", label: "Documentos", icon: <FileText className="h-4 w-4" /> });
    if (hasPermission("unidades.ver"))
      list.push({ key: "unidades", label: "Unidades", icon: <Building2 className="h-4 w-4" /> });
    if (hasPermission("bloqueios.ver"))
      list.push({ key: "bloqueios", label: "Bloqueios", icon: <Ban className="h-4 w-4" /> });
    if (hasPermission("config.ver"))
      list.push({ key: "envios", label: "Envios", icon: <Send className="h-4 w-4" /> });
    if (hasPermission("usuarios.ver"))
      list.push({ key: "usuarios", label: "Usuários", icon: <Users className="h-4 w-4" /> });
    return list;
  }, [hasPermission]);

  const [activeTab, setActiveTab] = useState<AdminTabKey>(
    () => (tabsDisponiveis[0]?.key as AdminTabKey) || "agendamentos",
  );

  useEffect(() => {
    if (tabsDisponiveis.length === 0) return;
    if (!tabsDisponiveis.some((t) => t.key === activeTab)) {
      setActiveTab(tabsDisponiveis[0].key);
    }
  }, [tabsDisponiveis, activeTab]);

  const tabBase =
    "flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors cursor-pointer";
  const tabActive = "border-brand-red text-ink";
  const tabInactive = "border-transparent text-clay hover:text-ink hover:border-clay/30";

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeTabInfo = tabsDisponiveis.find((t) => t.key === activeTab) ?? tabsDisponiveis[0];

  return (
    <AppShell
      title="Painel administrativo"
      meta={email ?? undefined}
      width="wide"
      rightSlot={
        <button
          onClick={onLogout}
          aria-label="Sair"
          className="inline-flex items-center gap-1.5 rounded-md border border-clay/20 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-clay transition-colors hover:bg-sand hover:text-ink md:px-3 md:py-2 md:text-xs"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      }
    >
      {tabsDisponiveis.length === 0 ? (
        <div className="rounded-xl border border-clay/15 bg-card p-8 text-center text-sm text-muted-foreground">
          {sessaoValidada
            ? "Seu usuário ainda não tem permissões para acessar áreas do painel. Fale com um administrador."
            : "Validando permissões…"}
        </div>
      ) : (
        <>
          {/* Mobile: seletor de seção */}
          <div className="relative mb-4 md:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={mobileNavOpen}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-clay/25 bg-paper px-3 py-2.5 text-left text-sm font-medium text-ink shadow-[0_1px_0_rgba(60,40,20,0.04)]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {activeTabInfo?.icon}
                <span className="min-w-0 truncate">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-clay">Área do painel: </span>
                  <span className="text-ink">{activeTabInfo?.label}</span>
                </span>
              </span>
              <ChevronDown
                className={"h-4 w-4 shrink-0 text-clay transition-transform " + (mobileNavOpen ? "rotate-180" : "")}
              />
            </button>
            {mobileNavOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMobileNavOpen(false)}
                  aria-hidden
                />
                <div
                  role="menu"
                  className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-clay/25 bg-paper shadow-lg"
                >
                  {tabsDisponiveis.map((t) => {
                    const ativo = t.key === activeTab;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={ativo}
                        onClick={() => {
                          setActiveTab(t.key);
                          setMobileNavOpen(false);
                        }}
                        className={
                          "flex w-full items-center gap-2 border-b border-clay/10 px-3 py-2.5 text-left text-sm last:border-b-0 " +
                          (ativo
                            ? "bg-sand/60 text-ink font-medium"
                            : "text-clay hover:bg-sand/40 hover:text-ink")
                        }
                      >
                        {t.icon} {t.label}
                        {ativo && <Check className="ml-auto h-4 w-4 text-brand-red" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Desktop: abas horizontais */}
          <nav className="mb-5 hidden border-b border-clay/15 md:-mx-8 md:block md:px-8">
            <div className="flex gap-4 overflow-x-auto">
              {tabsDisponiveis.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  aria-current={activeTab === t.key ? "page" : undefined}
                  className={`${tabBase} ${activeTab === t.key ? tabActive : tabInactive}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </nav>
          {activeTab === "agendamentos" && hasPermission("agendamentos.ver") && (
            <AgendamentosTab
              token={token}
              hasPermission={hasPermission}
              onUnauthorized={onLogout}
            />
          )}
          {activeTab === "documentos" && hasPermission("documentos.ver") && (
            <DocumentosTab
              token={token}
              hasPermission={hasPermission}
              onUnauthorized={onLogout}
            />
          )}
          {activeTab === "unidades" && hasPermission("unidades.ver") && (
            <UnidadesTab
              token={token}
              hasPermission={hasPermission}
              onUnauthorized={onLogout}
            />
          )}
          {activeTab === "bloqueios" && hasPermission("bloqueios.ver") && (
            <BloqueiosTab
              token={token}
              hasPermission={hasPermission}
              onUnauthorized={onLogout}
            />
          )}
          {activeTab === "envios" && hasPermission("config.ver") && (
            <EnviosTab
              token={token}
              hasPermission={hasPermission}
              onUnauthorized={onLogout}
              onOpenUnidades={
                hasPermission("unidades.ver") ? () => setActiveTab("unidades") : undefined
              }
            />
          )}
          {activeTab === "usuarios" && hasPermission("usuarios.ver") && (
            <UsuariosTab
              token={token}
              currentAdminId={adminId}
              currentAdminEmail={email ?? undefined}
              hasPermission={hasPermission}
              onUnauthorized={onLogout}
            />
          )}
        </>
      )}
    </AppShell>
  );
}


function statusKey(s: string): "agendado" | "cancelado" | "reagendado" | "realizado" | "outro" {
  const k = (s || "").toLowerCase();
  if (k === "agendado" || k === "confirmado") return "agendado";
  if (k === "cancelado") return "cancelado";
  if (k === "reagendado" || k === "remarcado") return "reagendado";
  if (k === "realizado" || k === "concluido" || k === "concluído") return "realizado";
  return "outro";
}

function normalizeText(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const k = statusKey(status);
  // Direção: tags SEMPRE retangulares. Cores via tokens semânticos (styles.css).
  const styles: Record<string, string> = {
    agendado: "badge-success",
    cancelado: "badge-danger",
    reagendado: "badge-warning",
    realizado: "badge-info",
    outro: "badge-neutral",
  };
  return (
    <span className={"badge-base " + styles[k]}>
      {label || status}
    </span>
  );
}

function SummaryChip({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "emerald" | "red" | "amber" | "sky";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors md:px-3 md:py-2 " +
        (active
          ? "border-clay/30 bg-sand/60"
          : "border-clay/15 bg-sand/25 hover:bg-sand/50")
      }
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-clay">
        {label}
      </span>
      <span className="tabular-nums text-sm font-semibold text-ink md:text-base">{value}</span>
    </button>
  );
}

const ADMIN_ACTION_BTN_BASE =
  "h-8 w-full rounded-md border px-3 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:h-7 md:w-[80%] md:px-2.5 md:text-[11px]";

const ADMIN_ACTION_BTN_SHADOW = "shadow-[0_1px_0_rgba(60,40,20,0.04)]";

function actionBtnClass(variant: "neutral" | "danger" | "success", enabled: boolean) {
  if (!enabled) {
    return (
      ADMIN_ACTION_BTN_BASE +
      " cursor-not-allowed border-clay/10 bg-paper/40 text-clay/50 shadow-none"
    );
  }
  if (variant === "danger") {
    return (
      ADMIN_ACTION_BTN_BASE +
      " cursor-pointer border-[color:var(--danger-border)] bg-paper text-[color:var(--danger-text)] hover:bg-[color:var(--danger-bg)] " +
      ADMIN_ACTION_BTN_SHADOW
    );
  }
  if (variant === "success") {
    return (
      ADMIN_ACTION_BTN_BASE +
      " cursor-pointer border-[color:var(--success-border)] bg-paper text-[color:var(--success-text)] hover:bg-[color:var(--success-bg)] " +
      ADMIN_ACTION_BTN_SHADOW
    );
  }
  return (
    ADMIN_ACTION_BTN_BASE +
    " cursor-pointer border-clay/25 bg-paper text-ink hover:border-clay/40 hover:bg-sand/70 " +
    ADMIN_ACTION_BTN_SHADOW
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-clay">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-ink/90">{value}</dd>
    </div>
  );
}



function AgendamentosTab({
  token,
  hasPermission,
  onUnauthorized,
}: {
  token: string;
  hasPermission: (chave: string) => boolean;
  onUnauthorized: () => void;
}) {
  const permCancelar = hasPermission("agendamentos.cancelar");
  const permRemarcar = hasPermission("agendamentos.remarcar");
  const [status, setStatus] = useState<string>("todos");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const buscaDiferida = useDeferredValue(busca);
  const [dataIso, setDataIso] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [agendamentos, setAgendamentos] = useState<AdminAgendamento[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmar, setConfirmar] = useState<AdminAgendamento | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [remarcar, setRemarcar] = useState<AdminAgendamento | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set());

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sempre que filtros ou recarga mudarem, colapsa todos os cards mobile.
  useEffect(() => {
    setExpandedCards((prev) => (prev.size === 0 ? prev : new Set()));
  }, [status, unidadeFiltro, dataIso, buscaDiferida, reloadKey]);

  const handleConfirmCancel = async () => {
    if (!confirmar) return;
    const alvo = confirmar;
    setCancelandoId(alvo._id);
    try {
      const r = await cancelarAdminAgendamento(token, alvo._id);
      if (!r.ok) {
        toast.error(r.message || r.error || "Não foi possível cancelar o agendamento.");
        return;
      }
      toast.success(r.mensagem || "Agendamento cancelado.");
      setConfirmar(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setCancelandoId(null);
    }
  };

  const handleRemarcado = () => {
    setRemarcar(null);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    // Busca sempre todos os status; o filtro de status é aplicado no frontend
    // para que os cards de resumo permaneçam consistentes ao alternar status.
    const filtros: AdminFiltros = {
      dataIso: dataIso || undefined,
    };
    listarAdminAgendamentos(token, filtros)
      .then((list) => {
        if (cancelled) return;
        setAgendamentos(list);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message === "SESSAO_EXPIRADA") {
          toast.error("Sua sessão expirou. Entre novamente.");
          onUnauthorized();
          return;
        }
        setErro("Não foi possível carregar os agendamentos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, dataIso, reloadKey, onUnauthorized]);

  const unidadesDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agendamentos) {
      const key = a.unidadeSlug || a.unidadeNome;
      if (key && !map.has(key)) map.set(key, a.unidadeNome || key);
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }, [agendamentos]);

  const agendamentosNormalizados = useMemo(
    () =>
      agendamentos.map((a) => ({
        raw: a,
        unidadeKey: a.unidadeSlug || a.unidadeNome,
        search: normalizeText(
          [
            a.protocolo,
            a.nomeAdvogado,
            a.numeroOab,
            a.nomeIpl,
            a.infopen,
            a.unidadeNome,
            a.emailAdvogado,
            a.telefoneAdvogado,
            a.protocoloOrigem,
            a.novoProtocolo,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      })),
    [agendamentos],
  );

  // Base para o resumo: aplica unidade + busca (data já vem filtrada da API),
  // mas NÃO aplica o status. Assim os cards mostram o panorama do contexto.
  const baseResumo = useMemo(() => {
    const q = normalizeText(buscaDiferida);
    return agendamentosNormalizados.flatMap(({ raw, unidadeKey, search }) => {
      if (unidadeFiltro !== "todas") {
        if (unidadeKey !== unidadeFiltro) return [];
      }
      if (!q || search.includes(q)) return [raw];
      return [];
    });
  }, [agendamentosNormalizados, buscaDiferida, unidadeFiltro]);

  const lista = useMemo(() => {
    if (status === "todos") return baseResumo;
    return baseResumo.filter((a) => statusKey(a.status) === status);
  }, [baseResumo, status]);

  const resumo = useMemo(() => {
    const r = {
      total: baseResumo.length,
      agendado: 0,
      cancelado: 0,
      reagendado: 0,
      realizado: 0,
    };
    for (const a of baseResumo) {
      const k = statusKey(a.status);
      if (k === "agendado") r.agendado++;
      else if (k === "cancelado") r.cancelado++;
      else if (k === "reagendado") r.reagendado++;
      else if (k === "realizado") r.realizado++;
    }
    return r;
  }, [baseResumo]);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const limparFiltros = () => {
    setStatus("todos");
    setUnidadeFiltro("todas");
    setDataIso("");
    setBusca("");
    setMobileFiltersOpen(false);
  };

  const verPorProtocolo = (protocolo: string) => {
    setStatus("todos");
    setUnidadeFiltro("todas");
    setDataIso("");
    setBusca(protocolo);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const filtrosAtivosCount =
    (status !== "todos" ? 1 : 0) +
    (unidadeFiltro !== "todas" ? 1 : 0) +
    (dataIso !== "" ? 1 : 0) +
    (busca !== "" ? 1 : 0);
  const filtrosAtivos = filtrosAtivosCount > 0;


  return (
    <div>
      {/* Resumo */}
      <div className={`mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 ${resumo.realizado > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <SummaryChip
          label="Total"
          value={resumo.total}
          tone="neutral"
          active={status === "todos"}
          onClick={() => setStatus("todos")}
        />
        <SummaryChip
          label="Agendados"
          value={resumo.agendado}
          tone="emerald"
          active={status === "agendado"}
          onClick={() => setStatus("agendado")}
        />
        <SummaryChip
          label="Reagendados"
          value={resumo.reagendado}
          tone="amber"
          active={status === "reagendado"}
          onClick={() => setStatus("reagendado")}
        />
        <SummaryChip
          label="Cancelados"
          value={resumo.cancelado}
          tone="red"
          active={status === "cancelado"}
          onClick={() => setStatus("cancelado")}
        />
        {resumo.realizado > 0 && (
          <SummaryChip
            label="Realizados"
            value={resumo.realizado}
            tone="sky"
            active={status === "realizado"}
            onClick={() => setStatus("realizado")}
          />
        )}
      </div>

      {/* Botão de filtros (apenas mobile) */}
      <div className="mb-2 md:hidden">
        <button
          type="button"
          aria-expanded={mobileFiltersOpen}
          aria-controls="admin-filtros-panel"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-clay/15 bg-sand/30 px-3 py-2 text-xs font-medium text-ink hover:bg-sand/60 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {filtrosAtivos && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-clay/20 bg-paper px-1 text-[10px] font-semibold text-ink">
                {filtrosAtivosCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Filtros */}
      <div
        id="admin-filtros-panel"
        className={`${mobileFiltersOpen ? "block" : "hidden"} md:block mb-4 rounded-xl border border-clay/15 bg-card p-2.5 md:p-3`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3 w-3" /> Filtros
          </div>
          <div className="flex items-center gap-1.5">
            {filtrosAtivos && (
              <button
                onClick={limparFiltros}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
              >
                Limpar
              </button>
            )}
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded-md border border-clay/20 px-2 py-1 text-[11px] text-ink hover:bg-muted"
            >
              Atualizar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-12">
          <label className="block lg:col-span-2">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border border-clay/20 bg-background px-2 text-sm md:h-10 md:px-3"
            >
              <option value="todos">Todos</option>
              <option value="agendado">Agendado</option>
              <option value="reagendado">Reagendado</option>
              <option value="realizado">Realizado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
          <label className="block lg:col-span-4">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">Unidade</span>
            <select
              value={unidadeFiltro}
              onChange={(e) => setUnidadeFiltro(e.target.value)}
              className="h-9 w-full rounded-md border border-clay/20 bg-background px-2 text-sm md:h-10 md:px-3"
            >
              <option value="todas">Todas</option>
              {unidadesDisponiveis.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block lg:col-span-2">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">Data</span>
            <input
              type="date"
              value={dataIso}
              onChange={(e) => setDataIso(e.target.value)}
              className="h-9 w-full rounded-md border border-clay/20 bg-background px-2 text-sm md:h-10 md:px-3"
            />
          </label>
          <label className="col-span-2 block lg:col-span-4">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-full rounded-md border border-clay/20 bg-background pl-8 pr-3 text-sm md:h-10"
                placeholder="Protocolo, advogado, OAB, nome da IPL ou unidade"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        {loading
          ? "Carregando agendamentos…"
          : `${lista.length} agendamento${lista.length === 1 ? "" : "s"}`}
      </div>

      {erro && (
        <div className="mb-3 flex items-center justify-between alert-danger p-3 text-sm">
          <span>Não foi possível carregar os agendamentos.</span>
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
        <div className="grid grid-cols-[1.4fr_2.1fr_0.9fr_1.1fr_92px_116px] gap-3 border-b border-clay/15 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Advogado(a)</div>
          <div>Unidade</div>
          <div>Data / Hora</div>
          <div>Nome da IPL / INFOPEN</div>
          <div>Status</div>
          <div className="text-right">Ações</div>
        </div>
        {lista.map((a) => {
          const k = statusKey(a.status);
          const podeRemarcar = k === "agendado" && !!a.unidadeSlug;
          const podeCancelar = k === "agendado";
          const cancelando = cancelandoId === a._id;
          return (
            <div
              key={a._id || a.protocolo}
              className="grid grid-cols-[1.4fr_2.1fr_0.9fr_1.1fr_92px_116px] items-start gap-3 border-b border-clay/10 px-4 py-2.5 text-sm last:border-b-0 hover:bg-muted/20"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{a.nomeAdvogado}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  OAB {a.numeroOab}
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {a.protocolo}
                </div>
                {k === "reagendado" && a.novoProtocolo && (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-700/90">
                    <span>
                      Reagendado para <span className="font-mono">{a.novoProtocolo}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => verPorProtocolo(a.novoProtocolo!)}
                      title="Ver novo agendamento"
                      aria-label={`Ver agendamento ${a.novoProtocolo}`}
                      className="inline-flex h-4 w-4 items-center justify-center rounded text-amber-700/70 hover:text-amber-700"
                    >
                      <Eye size={12} />
                    </button>
                  </div>
                )}
                {a.protocoloOrigem && (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/80">
                    <span>
                      Origem: <span className="font-mono">{a.protocoloOrigem}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => verPorProtocolo(a.protocoloOrigem!)}
                      title="Ver agendamento de origem"
                      aria-label={`Ver agendamento ${a.protocoloOrigem}`}
                      className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground/70 hover:text-ink"
                    >
                      <Eye size={12} />
                    </button>
                  </div>
                )}
              </div>
              <div className="min-w-0 text-ink/90" title={a.unidadeNome}>
                <span className="line-clamp-2 leading-snug">{a.unidadeNome}</span>
              </div>
              <div className="text-ink/90">
                <div className="text-[13px]">{a.dataLabel}</div>
                <div className="text-[11px] text-muted-foreground">{a.horarioLabel}</div>
              </div>
              <div className="min-w-0 text-ink/90">
                <div className="truncate text-[13px]" title={a.nomeIpl}>
                  {a.nomeIpl}
                </div>
                {a.infopen && (
                  <div className="text-[11px] text-muted-foreground">INFOPEN {a.infopen}</div>
                )}
              </div>
              <div>
                <StatusBadge status={a.status} label={a.statusLabel} />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {permRemarcar && (
                  <button
                    onClick={() => podeRemarcar && setRemarcar(a)}
                    disabled={!podeRemarcar}
                    title={
                      podeRemarcar ? "Remarcar agendamento" : "Indisponível para este status"
                    }
                    className={actionBtnClass("neutral", podeRemarcar)}
                  >
                    Remarcar
                  </button>
                )}
                {permCancelar && (
                  <button
                    onClick={() => podeCancelar && setConfirmar(a)}
                    disabled={!podeCancelar || cancelando}
                    title={
                      podeCancelar ? "Cancelar agendamento" : "Indisponível para este status"
                    }
                    className={actionBtnClass("danger", podeCancelar && !cancelando)}
                  >
                    {cancelando ? "…" : "Cancelar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && lista.length === 0 && !erro && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {filtrosAtivos
              ? "Nenhum agendamento encontrado com os filtros selecionados."
              : "Nenhum agendamento encontrado."}
          </div>
        )}
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {lista.map((a) => {
          const k = statusKey(a.status);
          const podeRemarcar = k === "agendado" && !!a.unidadeSlug;
          const podeCancelar = k === "agendado";
          const cancelando = cancelandoId === a._id;
          const cardId = a._id || a.protocolo;
          const isOpen = expandedCards.has(cardId);
          const panelId = `agendamento-detalhes-${cardId}`;
          return (
            <div
              key={cardId}
              className="overflow-hidden rounded-lg border border-clay/15 bg-card"
            >
              {/* Resumo clicável */}
              <button
                type="button"
                onClick={() => toggleCard(cardId)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={isOpen ? "Recolher detalhes do agendamento" : "Expandir detalhes do agendamento"}
                className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-sand/40 active:bg-sand/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-medium text-ink">
                      {a.nomeAdvogado}
                    </div>
                    <StatusBadge status={a.status} label={a.statusLabel} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{a.protocolo}</span>
                    <span className="text-clay/40">·</span>
                    <span>{a.dataLabel} · {a.horarioLabel}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground/85">
                    {a.unidadeNome}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`mt-1 shrink-0 text-clay transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* Conteúdo expandido */}
              {isOpen && (
                <div id={panelId} className="border-t border-clay/10 px-3 pb-3 pt-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>OAB {a.numeroOab}</span>
                  </div>
                  {k === "reagendado" && a.novoProtocolo && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700/90">
                      <span>
                        Reagendado para <span className="font-mono">{a.novoProtocolo}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => verPorProtocolo(a.novoProtocolo!)}
                        title="Ver novo agendamento"
                        aria-label={`Ver agendamento ${a.novoProtocolo}`}
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-amber-700/70 hover:text-amber-700"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  )}
                  {a.protocoloOrigem && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80">
                      <span>
                        Origem: <span className="font-mono">{a.protocoloOrigem}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => verPorProtocolo(a.protocoloOrigem!)}
                        title="Ver agendamento de origem"
                        aria-label={`Ver agendamento ${a.protocoloOrigem}`}
                        className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground/70 hover:text-ink"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  )}

                  <dl className="mt-2 space-y-1 text-[13px]">
                    <InfoRow label="Unidade" value={a.unidadeNome} />
                    <InfoRow label="Data" value={`${a.dataLabel} · ${a.horarioLabel}`} />
                    <InfoRow
                      label="Nome da IPL"
                      value={`${a.nomeIpl}${a.infopen ? ` · INFOPEN ${a.infopen}` : ""}`}
                    />
                  </dl>

                  {(permRemarcar || permCancelar) && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {permRemarcar && (
                        <button
                          onClick={() => podeRemarcar && setRemarcar(a)}
                          disabled={!podeRemarcar}
                          title={podeRemarcar ? "Remarcar agendamento" : "Indisponível para este status"}
                          className={actionBtnClass("neutral", podeRemarcar)}
                        >
                          Remarcar
                        </button>
                      )}
                      {permCancelar && (
                        <button
                          onClick={() => podeCancelar && setConfirmar(a)}
                          disabled={!podeCancelar || cancelando}
                          title={podeCancelar ? "Cancelar agendamento" : "Indisponível para este status"}
                          className={actionBtnClass("danger", podeCancelar && !cancelando)}
                        >
                          {cancelando ? "Cancelando…" : "Cancelar"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && lista.length === 0 && !erro && (
          <div className="rounded-xl border border-clay/15 bg-card p-6 text-center text-sm text-muted-foreground">
            {filtrosAtivos
              ? "Nenhum agendamento encontrado com os filtros selecionados."
              : "Nenhum agendamento encontrado."}
          </div>
        )}
      </div>

      {confirmar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => cancelandoId === null && setConfirmar(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">Cancelar agendamento</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Tem certeza que deseja cancelar este agendamento? Essa ação liberará o horário para
              novos agendamentos.
            </p>
            <div className="mb-5 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="font-mono">{confirmar.protocolo}</div>
              <div className="mt-1 text-muted-foreground">
                {confirmar.unidadeNome} · {confirmar.dataLabel} · {confirmar.horarioLabel}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmar(null)}
                disabled={cancelandoId !== null}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelandoId !== null}
                className="rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {cancelandoId !== null ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {remarcar && (
        <RemarcarModal
          token={token}
          agendamento={remarcar}
          onClose={() => setRemarcar(null)}
          onSuccess={handleRemarcado}
          onUnauthorized={onUnauthorized}
        />
      )}
    </div>
  );
}

function RemarcarModal({
  token,
  agendamento,
  onClose,
  onSuccess,
  onUnauthorized,
}: {
  token: string;
  agendamento: AdminAgendamento;
  onClose: () => void;
  onSuccess: () => void;
  onUnauthorized: () => void;
}) {
  const unidadeSlug = agendamento.unidadeSlug || "";
  const [datas, setDatas] = useState<DataDisponivel[]>([]);
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([]);
  const [dataIso, setDataIso] = useState<string>("");
  const [horario, setHorario] = useState<HorarioDisponivel | null>(null);
  const [loadingDatas, setLoadingDatas] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!unidadeSlug) return;
    let cancelled = false;
    setLoadingDatas(true);
    setErro(null);
    listarDatasDisponiveis(unidadeSlug)
      .then((d) => {
        if (!cancelled) setDatas(d);
      })
      .catch(() => {
        if (!cancelled) setErro("Não foi possível carregar as datas.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDatas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unidadeSlug]);

  useEffect(() => {
    if (!unidadeSlug || !dataIso) {
      setHorarios([]);
      setHorario(null);
      return;
    }
    let cancelled = false;
    setLoadingHorarios(true);
    setHorario(null);
    listarHorariosDisponiveis(unidadeSlug, dataIso)
      .then((h) => {
        if (!cancelled) setHorarios(h);
      })
      .catch(() => {
        if (!cancelled) setErro("Não foi possível carregar os horários.");
      })
      .finally(() => {
        if (!cancelled) setLoadingHorarios(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unidadeSlug, dataIso]);

  const confirmar = async () => {
    if (!dataIso || !horario) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await remarcarAdminAgendamento(token, {
        agendamentoId: agendamento._id,
        unidadeSlug,
        dataIso,
        horarioInicio: horario.horarioInicio,
        horarioFim: horario.horarioFim,
      });
      if (!r.ok) {
        const msg = r.message || r.error || "Não foi possível remarcar o agendamento.";
        setErro(msg);
        toast.error(msg);
        return;
      }
      toast.success(
        r.mensagem ||
          `Agendamento remarcado. Novo protocolo: ${r.novoAgendamento?.protocolo || r.protocolo}`,
      );
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !enviando && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold">Remarcar agendamento</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Escolha uma nova data e horário para este atendimento.
        </p>

        <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="font-mono">{agendamento.protocolo}</div>
          <div className="mt-1 text-muted-foreground">
            {agendamento.unidadeNome} · {agendamento.dataLabel} · {agendamento.horarioLabel}
          </div>
        </div>

        {!unidadeSlug && (
          <div className="mb-4 alert-danger p-3 text-sm">
            Unidade não identificada para este agendamento.
          </div>
        )}

        <div className="mb-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Nova data
          </label>
          {loadingDatas ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Carregando datas…
            </div>
          ) : (
            <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto">
              {datas.length === 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Nenhuma data disponível.
                </div>
              )}
              {datas.map((d) => {
                const disabled = d.encerrado || d.disponivel === false;
                const selected = dataIso === d.dataIso;
                return (
                  <button
                    key={d.dataIso}
                    type="button"
                    disabled={disabled}
                    onClick={() => setDataIso(d.dataIso)}
                    className={
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                      (disabled
                        ? "cursor-not-allowed opacity-50"
                        : selected
                          ? "border-primary bg-primary/10 font-medium"
                          : "hover:bg-muted")
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {dataIso && (
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Novo horário
            </label>
            {loadingHorarios ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Carregando horários…
              </div>
            ) : horarios.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Nenhum horário disponível nesta data.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {horarios.map((h) => {
                  const selected = horario?.horarioInicio === h.horarioInicio;
                  return (
                    <button
                      key={h.horarioInicio}
                      type="button"
                      onClick={() => setHorario(h)}
                      className={
                        "rounded-lg border px-2 py-2 text-sm transition-colors " +
                        (selected
                          ? "border-primary bg-primary/10 font-medium"
                          : "hover:bg-muted")
                      }
                    >
                      {h.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {erro && (
          <div className="mb-3 alert-danger p-3 text-sm">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={enviando}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          >
            Voltar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando || !dataIso || !horario || !unidadeSlug}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {enviando ? "Remarcando…" : "Confirmar remarcação"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Documentos (somente leitura)
// ============================================================

function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateParts(value?: string | Date | null): { date: string; time: string } {
  if (!value) return { date: "—", time: "" };
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

// Regex que detecta termos técnicos internos que não devem vazar para o usuário.
const TERMOS_TECNICOS_EMAIL_UNIDADE =
  /email\s*(agenda|destino|documentos|unidade|recebimento|dest\w*)/i;

/**
 * Deixa as mensagens de erro amigáveis, escondendo nomes de campos internos.
 */
export function friendlyDocumentoError(message?: string): string {
  const raw = (message || "").trim();
  if (!raw) {
    return "Não foi possível concluir a operação. Tente novamente em instantes.";
  }
  if (TERMOS_TECNICOS_EMAIL_UNIDADE.test(raw)) {
    return "Não foi possível enviar o documento para a unidade porque não há um e-mail de recebimento cadastrado para essa unidade. Verifique o cadastro da unidade prisional e informe o e-mail que deve receber os documentos.";
  }
  return raw;
}

type StatusPrincipal = "recebido" | "concluido" | "com_erro";

function statusPrincipal(d: AdminDocumento): StatusPrincipal {
  const s = (d.status || "").toLowerCase();
  if (s === "com_erro" || !!(d.mensagemErro && d.mensagemErro.trim())) return "com_erro";
  if (s === "concluido" || s === "concluído") return "concluido";
  return "recebido";
}

function statusPrincipalLabel(s: StatusPrincipal): string {
  if (s === "concluido") return "Concluído";
  if (s === "com_erro") return "Com erro";
  return "Recebido";
}

function documentoTemErro(d: AdminDocumento): boolean {
  return statusPrincipal(d) === "com_erro";
}

function documentoUnidadeEnviado(d: AdminDocumento): boolean {
  return d.emailUnidadeEnviado === true || (d.status || "").toLowerCase() === "enviado_unidade";
}

type ErroDetalhe = { title: string; message: string };

function DocStatusBadge({
  doc,
  onShowErro,
}: {
  doc: AdminDocumento;
  onShowErro?: (payload: ErroDetalhe) => void;
}) {
  const s = statusPrincipal(doc);
  let cls = "badge-info";
  if (s === "concluido") cls = "badge-success";
  else if (s === "com_erro") cls = "badge-danger";
  const erroMsg = (doc.mensagemErro || "").trim();
  const clicavel = s === "com_erro" && !!onShowErro;
  const base = "badge-base gap-1 " + cls;
  if (clicavel) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onShowErro!({ title: "Detalhes do erro", message: friendlyDocumentoError(erroMsg) });
        }}
        className={base + " cursor-pointer hover:brightness-95"}
        aria-label="Ver detalhes do erro"
        title="Ver detalhes do erro"
      >
        {statusPrincipalLabel(s)}
        <Info className="h-3 w-3" aria-hidden />
      </button>
    );
  }
  return <span className={base}>{statusPrincipalLabel(s)}</span>;
}

/**
 * Pill de acompanhamento (envio à unidade / confirmação ao advogado).
 * No estado negativo, exibe ícone ⓘ e abre modal explicativo ao clicar.
 */
function EnvioPill({
  ok,
  labelOk,
  labelPendente,
  onExplain,
}: {
  ok: boolean;
  labelOk: string;
  labelPendente: string;
  onExplain?: () => void;
}) {
  const base = "badge-base gap-1 text-[10px] px-1.5 ";
  if (ok) {
    return (
      <span className={base + " badge-success"}>
        {labelOk}
      </span>
    );
  }
  const cls = base + " badge-warning";
  if (onExplain) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExplain();
        }}
        className={cls + " cursor-pointer hover:brightness-95"}
        aria-label={labelPendente}
        title={labelPendente}
      >
        {labelPendente}
        <Info className="h-3 w-3" aria-hidden />
      </button>
    );
  }
  return <span className={cls}>{labelPendente}</span>;
}

function ArquivoLink({ doc }: { doc: AdminDocumento }) {
  const candidatos = [
    doc.arquivoUrlEmail,
    doc.arquivoUrlPublica,
    doc.arquivoUrl,
    doc.arquivoPrincipalUrl,
  ];
  const url = candidatos.find(
    (u): u is string =>
      typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://")),
  );
  if (!url) {
    return <span className="text-[11px] text-muted-foreground">Arquivo indisponível</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-blue hover:underline"
    >
      Abrir arquivo
      <ArrowUpRight className="h-3 w-3" aria-hidden />
    </a>
  );
}

function DocumentosTab({
  token,
  hasPermission,
  onUnauthorized,
}: {
  token: string;
  hasPermission: (chave: string) => boolean;
  onUnauthorized: () => void;
}) {
  const podeAbrir = hasPermission("documentos.abrir");
  const podeConcluir = hasPermission("documentos.concluir");
  const [statusF, setStatusF] = useState<string>("todos");
  const [unidadeF, setUnidadeF] = useState<string>("todas");
  const [dataIso, setDataIso] = useState("");
  const [busca, setBusca] = useState("");
  const buscaDiferida = useDeferredValue(busca);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<AdminDocumento[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [confirmarConclusao, setConfirmarConclusao] = useState<AdminDocumento | null>(null);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [erroDetalhes, setErroDetalhes] = useState<ErroDetalhe | null>(null);

  const handleConfirmarConclusao = async () => {
    if (!confirmarConclusao) return;
    const alvo = confirmarConclusao;
    setConcluindoId(alvo._id);
    try {
      const r = await concluirAdminDocumento(token, alvo._id);
      if (!r.ok) {
        toast.error(r.message || r.error || "Não foi possível concluir o documento.");
        return;
      }
      toast.success(r.mensagem || "Documento marcado como concluído.");
      setConfirmarConclusao(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      if ((e as Error).message === "SESSAO_EXPIRADA") {
        toast.error("Sua sessão expirou. Entre novamente.");
        onUnauthorized();
        return;
      }
      toast.error("Falha de conexão. Tente novamente.");
    } finally {
      setConcluindoId(null);
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setExpandedCards((prev) => (prev.size === 0 ? prev : new Set()));
  }, [statusF, unidadeF, dataIso, buscaDiferida, reloadKey]);

  const [unidadesConhecidas, setUnidadesConhecidas] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    // "recebido" no filtro precisa englobar também o legado "enviado_unidade" — não enviamos
    // status ao backend nesse caso, e depois normalizamos no frontend.
    const STATUS_BACKEND = new Set(["concluido", "com_erro"]);
    const filtros: AdminDocumentosFiltros = {};
    if (dataIso) filtros.dataIso = dataIso;
    if (unidadeF !== "todas") filtros.unidadeSlug = unidadeF;
    const buscaTrim = (buscaDiferida || "").trim();
    if (buscaTrim) filtros.busca = buscaTrim;
    if (STATUS_BACKEND.has(statusF)) filtros.status = statusF;
    listarAdminDocumentos(token, filtros)
      .then((list) => {
        if (cancelled) return;
        setDocumentos(list);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message === "SESSAO_EXPIRADA") {
          toast.error("Sua sessão expirou. Entre novamente.");
          onUnauthorized();
          return;
        }
        setErro("Não foi possível carregar os documentos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, dataIso, unidadeF, statusF, buscaDiferida, reloadKey, onUnauthorized]);

  // Acumula unidades já vistas para não esvaziar o dropdown quando o backend filtra por unidade.
  useEffect(() => {
    if (!documentos.length) return;
    setUnidadesConhecidas((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const d of documentos) {
        const key = d.unidadeSlug || d.unidadeNome || "";
        if (key && !next.has(key)) {
          next.set(key, d.unidadeNome || key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [documentos]);

  const unidadesDisponiveis = useMemo(
    () =>
      Array.from(unidadesConhecidas, ([value, label]) => ({ value, label })).sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR"),
      ),
    [unidadesConhecidas],
  );

  // Backend aplicou dataIso, unidadeSlug, busca e (quando aplicável) status.
  // "recebido" no filtro precisa incluir também o legado "enviado_unidade".
  const baseResumo = useMemo(() => documentos, [documentos]);

  const lista = useMemo(() => {
    if (statusF === "recebido")
      return baseResumo.filter((d) => statusPrincipal(d) === "recebido");
    return baseResumo;
  }, [baseResumo, statusF]);

  const resumo = useMemo(() => {
    const r = { total: baseResumo.length, recebidos: 0, concluidos: 0, comErro: 0 };
    for (const d of baseResumo) {
      const s = statusPrincipal(d);
      if (s === "recebido") r.recebidos++;
      else if (s === "concluido") r.concluidos++;
      else if (s === "com_erro") r.comErro++;
    }
    return r;
  }, [baseResumo]);

  const filtrosAtivosCount =
    (statusF !== "todos" ? 1 : 0) +
    (unidadeF !== "todas" ? 1 : 0) +
    (dataIso !== "" ? 1 : 0) +
    (busca !== "" ? 1 : 0);
  const filtrosAtivos = filtrosAtivosCount > 0;

  const limparFiltros = () => {
    setStatusF("todos");
    setUnidadeF("todas");
    setDataIso("");
    setBusca("");
    setMobileFiltersOpen(false);
  };

  return (
    <div>
      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryChip
          label="Total"
          value={resumo.total}
          active={statusF === "todos"}
          onClick={() => setStatusF("todos")}
        />
        <SummaryChip
          label="Recebidos"
          value={resumo.recebidos}
          active={statusF === "recebido"}
          onClick={() => setStatusF("recebido")}
        />
        <SummaryChip
          label="Concluídos"
          value={resumo.concluidos}
          active={statusF === "concluido"}
          onClick={() => setStatusF("concluido")}
        />
        <SummaryChip
          label="Com erro"
          value={resumo.comErro}
          active={statusF === "com_erro"}
          onClick={() => setStatusF("com_erro")}
        />
      </div>

      {/* Botão de filtros (mobile) */}
      <div className="mb-2 md:hidden">
        <button
          type="button"
          aria-expanded={mobileFiltersOpen}
          aria-controls="admin-doc-filtros-panel"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-clay/15 bg-sand/30 px-3 py-2 text-xs font-medium text-ink hover:bg-sand/60 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {filtrosAtivos && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-clay/20 bg-paper px-1 text-[10px] font-semibold text-ink">
                {filtrosAtivosCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Filtros */}
      <div
        id="admin-doc-filtros-panel"
        className={`${mobileFiltersOpen ? "block" : "hidden"} md:block mb-4 rounded-xl border border-clay/15 bg-card p-2.5 md:p-3`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3 w-3" /> Filtros
          </div>
          <div className="flex items-center gap-1.5">
            {filtrosAtivos && (
              <button
                onClick={limparFiltros}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
              >
                Limpar
              </button>
            )}
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded-md border border-clay/20 px-2 py-1 text-[11px] text-ink hover:bg-muted"
            >
              Atualizar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-12">
          <label className="block lg:col-span-2">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <select
              value={statusF}
              onChange={(e) => setStatusF(e.target.value)}
              className="h-9 w-full rounded-md border border-clay/20 bg-background px-2 text-sm md:h-10 md:px-3"
            >
              <option value="todos">Todos</option>
              <option value="recebido">Recebido</option>
              <option value="concluido">Concluído</option>
              <option value="com_erro">Com erro</option>
            </select>
          </label>
          <label className="block lg:col-span-4">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
              Unidade
            </span>
            <select
              value={unidadeF}
              onChange={(e) => setUnidadeF(e.target.value)}
              className="h-9 w-full rounded-md border border-clay/20 bg-background px-2 text-sm md:h-10 md:px-3"
            >
              <option value="todas">Todas</option>
              {unidadesDisponiveis.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block lg:col-span-2">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
              Data
            </span>
            <input
              type="date"
              value={dataIso}
              onChange={(e) => setDataIso(e.target.value)}
              className="h-9 w-full rounded-md border border-clay/20 bg-background px-2 text-sm md:h-10 md:px-3"
            />
          </label>
          <label className="col-span-2 block lg:col-span-4">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
              Buscar
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-full rounded-md border border-clay/20 bg-background pl-8 pr-3 text-sm md:h-10"
                placeholder="Protocolo, advogado, OAB, e-mail, IPL, unidade ou arquivo"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="mb-3 text-xs text-muted-foreground">
        {loading
          ? "Carregando documentos…"
          : `${lista.length} documento${lista.length === 1 ? "" : "s"}`}
      </div>

      {erro && (
        <div className="mb-3 flex items-center justify-between alert-danger p-3 text-sm">
          <span>Não foi possível carregar os documentos.</span>
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
        <div className="grid grid-cols-[1.5fr_1.5fr_1.3fr_1.0fr_0.9fr_1.35fr] gap-3 border-b border-clay/15 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Advogado(a)</div>
          <div>Unidade</div>
          <div>Documento</div>
          <div>IPL / INFOPEN</div>
          <div>Criado em</div>
          <div>Status</div>
        </div>
        {lista.map((d) => {
          const concluido = statusPrincipal(d) === "concluido";
          const criado = formatDateParts(d.criadoEm);
          const advOk = d.emailAdvogadoEnviado === true;
          const uniOk = documentoUnidadeEnviado(d);
          const showAdvErro = () =>
            setErroDetalhes({
              title: "Confirmação não enviada",
              message: d.emailAdvogadoErro
                ? friendlyDocumentoError(d.emailAdvogadoErro)
                : "A solicitação foi registrada, mas não foi possível enviar o e-mail de confirmação ao advogado. O protocolo continua válido e pode ser acompanhado pelo painel.",
            });
          const showUniErro = () =>
            setErroDetalhes({
              title: "Documento não enviado",
              message: d.mensagemErro
                ? friendlyDocumentoError(d.mensagemErro)
                : "Não foi possível enviar o documento para a unidade. Verifique o cadastro da unidade prisional e tente novamente.",
            });
          return (
            <div
              key={d._id || d.protocolo}
              className="grid grid-cols-[1.5fr_1.5fr_1.3fr_1.0fr_0.9fr_1.35fr] items-start gap-3 border-b border-clay/10 px-4 py-2.5 text-sm last:border-b-0 hover:bg-muted/20"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{d.nomeAdvogado || "—"}</div>
                {d.numeroOab && (
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    OAB {d.numeroOab}
                  </div>
                )}
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {d.protocolo}
                </div>
                <div className="mt-1.5">
                  <EnvioPill
                    ok={advOk}
                    labelOk="Confirmação enviada"
                    labelPendente="Confirmação não enviada"
                    onExplain={advOk ? undefined : showAdvErro}
                  />
                </div>
              </div>
              <div className="min-w-0 text-ink/90" title={d.unidadeNome}>
                <span className="line-clamp-2 leading-snug">{d.unidadeNome || "—"}</span>
                <div className="mt-1.5">
                  <EnvioPill
                    ok={uniOk}
                    labelOk="Documento enviado"
                    labelPendente="Documento não enviado"
                    onExplain={uniOk ? undefined : showUniErro}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] text-ink/90">
                  {d.tipoDocumentoLabel || d.tipoDocumento || "—"}
                </div>
                {podeAbrir && (
                  <div className="mt-2">
                    <ArquivoLink doc={d} />
                  </div>
                )}
              </div>
              <div className="min-w-0 text-ink/90">
                <div className="truncate text-[13px]" title={d.nomeIpl}>
                  {d.nomeIpl || "—"}
                </div>
                {d.infopen && (
                  <div className="text-[11px] text-muted-foreground">INFOPEN {d.infopen}</div>
                )}
              </div>
              <div className="text-[12px] text-muted-foreground leading-tight">
                <div>{criado.date}</div>
                {criado.time && <div>{criado.time}</div>}
              </div>
              <div className="min-w-0">
                <div className="flex flex-col items-start gap-1.5">
                  <DocStatusBadge doc={d} onShowErro={setErroDetalhes} />
                  {!concluido && podeConcluir && (
                    <button
                      type="button"
                      onClick={() => setConfirmarConclusao(d)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-[color:var(--success-text)] transition-colors hover:bg-[color:var(--success-bg)]"
                    >
                      Marcar concluído
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && lista.length === 0 && !erro && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {filtrosAtivos
              ? "Nenhum documento encontrado com os filtros selecionados."
              : "Nenhum documento encontrado."}
          </div>
        )}
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {lista.map((d) => {
          const cardId = d._id || d.protocolo;
          const isOpen = expandedCards.has(cardId);
          const panelId = `documento-detalhes-${cardId}`;
          const criado = formatDateParts(d.criadoEm);
          const advOk = d.emailAdvogadoEnviado === true;
          const uniOk = documentoUnidadeEnviado(d);
          const showAdvErro = () =>
            setErroDetalhes({
              title: "Confirmação não enviada",
              message: d.emailAdvogadoErro
                ? friendlyDocumentoError(d.emailAdvogadoErro)
                : "A solicitação foi registrada, mas não foi possível enviar o e-mail de confirmação ao advogado. O protocolo continua válido e pode ser acompanhado pelo painel.",
            });
          const showUniErro = () =>
            setErroDetalhes({
              title: "Documento não enviado",
              message: d.mensagemErro
                ? friendlyDocumentoError(d.mensagemErro)
                : "Não foi possível enviar o documento para a unidade. Verifique o cadastro da unidade prisional e tente novamente.",
            });
          return (
            <div key={cardId} className="overflow-hidden rounded-lg border border-clay/15 bg-card">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCard(cardId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCard(cardId);
                  }
                }}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-sand/40 active:bg-sand/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-medium text-ink">
                      {d.nomeAdvogado || "—"}
                    </div>
                    <span onClick={(e) => e.stopPropagation()}>
                      <DocStatusBadge doc={d} onShowErro={setErroDetalhes} />
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{d.protocolo}</span>
                    {d.tipoDocumentoLabel && (
                      <>
                        <span className="text-clay/40">·</span>
                        <span>{d.tipoDocumentoLabel}</span>
                      </>
                    )}
                  </div>
                  {d.unidadeNome && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground/85">
                      {d.unidadeNome}
                    </div>
                  )}
                  <div
                    className="mt-1.5 flex flex-wrap gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EnvioPill
                      ok={advOk}
                      labelOk="Confirmação enviada"
                      labelPendente="Confirmação não enviada"
                      onExplain={advOk ? undefined : showAdvErro}
                    />
                    <EnvioPill
                      ok={uniOk}
                      labelOk="Documento enviado"
                      labelPendente="Documento não enviado"
                      onExplain={uniOk ? undefined : showUniErro}
                    />
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`mt-1 shrink-0 text-clay transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </div>

              {isOpen && (
                <div id={panelId} className="border-t border-clay/10 px-3 pb-3 pt-2.5">
                  <dl className="space-y-1 text-[13px]">
                    {d.numeroOab && <InfoRow label="OAB" value={d.numeroOab} />}
                    {d.emailAdvogado && <InfoRow label="E-mail" value={d.emailAdvogado} />}
                    {d.telefoneAdvogado && <InfoRow label="Tel." value={d.telefoneAdvogado} />}
                    {d.nomeIpl && (
                      <InfoRow
                        label="IPL"
                        value={`${d.nomeIpl}${d.infopen ? ` · INFOPEN ${d.infopen}` : ""}`}
                      />
                    )}
                    <InfoRow
                      label="Tipo"
                      value={d.tipoDocumentoLabel || d.tipoDocumento || "—"}
                    />
                    <InfoRow
                      label="Criado"
                      value={criado.time ? `${criado.date} · ${criado.time}` : criado.date}
                    />
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {podeAbrir ? <ArquivoLink doc={d} /> : <span />}
                    {statusPrincipal(d) !== "concluido" && podeConcluir && (
                      <button
                        type="button"
                        onClick={() => setConfirmarConclusao(d)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-[color:var(--success-text)] transition-colors hover:bg-[color:var(--success-bg)]"
                      >
                        Marcar concluído
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loading && lista.length === 0 && !erro && (
          <div className="rounded-xl border border-clay/15 bg-card p-6 text-center text-sm text-muted-foreground">
            {filtrosAtivos
              ? "Nenhum documento encontrado com os filtros selecionados."
              : "Nenhum documento encontrado."}
          </div>
        )}
      </div>


      {confirmarConclusao && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => concluindoId === null && setConfirmarConclusao(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">Marcar documento como concluído</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Marque como concluído apenas quando a unidade já tiver devolvido o documento
              assinado.
            </p>
            <div className="mb-5 rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="font-mono">{confirmarConclusao.protocolo}</div>
              <div className="mt-1 text-muted-foreground">
                {confirmarConclusao.unidadeNome || "—"}
                {confirmarConclusao.tipoDocumentoLabel
                  ? ` · ${confirmarConclusao.tipoDocumentoLabel}`
                  : ""}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmarConclusao(null)}
                disabled={concluindoId !== null}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmarConclusao}
                disabled={concluindoId !== null}
                className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60"
              >
                {concluindoId !== null ? "Concluindo…" : "Confirmar conclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {erroDetalhes && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setErroDetalhes(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold">{erroDetalhes.title}</h2>
            <div className="mb-5 whitespace-pre-wrap alert-danger p-3 text-sm">
              {erroDetalhes.message}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setErroDetalhes(null)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


