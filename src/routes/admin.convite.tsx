import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { navigateTo } from "@/lib/pages-router-shim";
import { buscarConviteAdmin, concluirConviteAdmin } from "@/lib/oab-api";

export const Route = createFileRoute("/admin/convite")({
  component: ConvitePage,
});

const BACK_LINK = (
  <Link
    to="/admin"
    className="inline-flex items-center rounded-md border border-clay/20 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-sand md:px-3 md:py-2 md:text-xs md:tracking-[0.15em]"
  >
    <span className="md:hidden">Voltar</span>
    <span className="hidden md:inline">Voltar para o painel</span>
  </Link>
);

// -------- CPF helpers --------
function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}
function applyCpfMask(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function isValidCpf(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (factor - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const dv1 = calc(d.slice(0, 9), 10);
  const dv2 = calc(d.slice(0, 10), 11);
  return dv1 === Number(d[9]) && dv2 === Number(d[10]);
}

type ConviteInfo = {
  email: string;
  cargoFuncao?: string;
  statusConvite?: string;
  conviteExpiraEm?: string | null;
  cadastroConcluido?: boolean;
};

export function formatarDataHoraBrasilia(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}

function mensagemErroConvite(code?: string, fallback?: string): string {
  switch (code) {
    case "CONVITE_EXPIRADO":
      return "Este convite expirou. Solicite um novo convite.";
    case "CONVITE_JA_UTILIZADO":
      return "Este convite já foi utilizado.";
    case "CONVITE_INVALIDO":
      return "Convite inválido.";
    default:
      return fallback || "Não foi possível verificar o convite.";
  }
}

function ConvitePage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [convite, setConvite] = useState<ConviteInfo | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setErroCarregar("Link de convite incompleto.");
      setLoading(false);
      return;
    }
    setToken(t);
    buscarConviteAdmin(t)
      .then((r) => {
        if (!r.ok) {
          setErroCarregar(mensagemErroConvite(r.code, r.message || r.error));
          return;
        }
        if (r.convite.cadastroConcluido) {
          setErroCarregar("Este convite já foi utilizado.");
          return;
        }
        const status = r.convite.statusConvite;
        if (status && status !== "pendente") {
          setErroCarregar(
            status === "expirado"
              ? "Este convite expirou. Solicite um novo convite."
              : status === "utilizado"
                ? "Este convite já foi utilizado."
                : "Convite inválido.",
          );
          return;
        }
        setConvite(r.convite);
      })
      .catch(() => setErroCarregar("Não foi possível verificar o convite."))
      .finally(() => setLoading(false));
  }, []);


  return (
    <AppShell title="Concluir cadastro" width="narrow" rightSlot={BACK_LINK}>
      {loading && (
        <div className="rounded-xl border border-clay/15 bg-card p-6 text-center text-sm text-muted-foreground">
          Verificando convite…
        </div>
      )}

      {!loading && (erroCarregar || !convite || !token) && (
        <ConviteInvalido mensagem={erroCarregar || "Não foi possível verificar o convite."} />
      )}

      {!loading && convite && token && (
        <ConcluirForm token={token} convite={convite} />
      )}
    </AppShell>
  );
}

function ConviteInvalido({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-2xl border border-clay/15 bg-card p-6 text-center">
      <h2 className="mb-2 text-lg font-semibold text-ink">Não foi possível abrir este convite</h2>
      <p className="mb-5 text-sm text-muted-foreground">{mensagem}</p>
      <p className="mb-5 text-xs text-muted-foreground">
        Solicite um novo convite ao administrador da Central.
      </p>
      <Link
        to="/admin"
        className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-brand-blue"
      >
        Voltar para o login
      </Link>
    </div>
  );
}

function ConcluirForm({ token, convite }: { token: string; convite: ConviteInfo }) {
  const [nome, setNome] = useState("");
  const [cargoFuncao, setCargoFuncao] = useState(convite.cargoFuncao || "");
  const [cpf, setCpf] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submit = async () => {
    setErro(null);
    const nomeTrim = nome.trim();
    if (!nomeTrim || !/\s/.test(nomeTrim) || nomeTrim.length < 3) {
      setErro("Informe o nome completo (nome e sobrenome).");
      return;
    }
    if (!isValidCpf(cpf)) {
      setErro("Informe um CPF válido.");
      return;
    }
    if (novaSenha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro("A confirmação da senha não confere.");
      return;
    }

    setEnviando(true);
    try {
      const r = await concluirConviteAdmin({
        token,
        nome: nomeTrim,
        cpf: onlyDigits(cpf),
        novaSenha,
        cargoFuncao: cargoFuncao.trim() || undefined,
      });
      // Limpa CPF/senha do estado imediatamente após envio
      setCpf("");
      setNovaSenha("");
      setConfirmarSenha("");
      if (!r.ok) {
        setErro(r.message || r.error || "Não foi possível concluir o cadastro.");
        return;
      }
      toast.success(r.mensagem || "Cadastro concluído. Faça login para acessar o painel.");
      // Sem query string com dados sensíveis. Apenas navega para /admin.
      navigateTo("/admin", true);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const expiraFormatado = formatarDataHoraBrasilia(convite.conviteExpiraEm);

  return (
    <div className="rounded-2xl border border-clay/15 bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold text-ink">Concluir cadastro</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Complete seus dados para criar seu acesso ao painel administrativo.
      </p>
      {expiraFormatado && (
        <p className="mb-5 text-xs text-muted-foreground">
          Este convite é válido até <strong className="text-ink">{expiraFormatado}</strong> (horário de Brasília).
        </p>
      )}


      <div className="grid gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">E-mail</span>
          <input
            type="email"
            value={convite.email}
            disabled
            className="h-10 w-full rounded-md border border-clay/20 bg-muted/40 px-3 text-sm text-muted-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">Nome completo</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            placeholder="Nome e sobrenome"
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">
            Cargo/Função {convite.cargoFuncao ? "" : "(opcional)"}
          </span>
          <input
            value={cargoFuncao}
            onChange={(e) => setCargoFuncao(e.target.value)}
            placeholder="Ex.: Coordenador, Estagiário"
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">CPF</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={cpf}
            onChange={(e) => setCpf(applyCpfMask(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Seu CPF é armazenado apenas em formato criptografado e nunca é exibido no painel.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">Nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-clay">Confirmar nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            className="h-10 w-full rounded-md border border-clay/25 bg-paper px-3 text-sm"
          />
        </label>
      </div>

      {erro && <div className="mt-4 alert-danger p-3 text-sm">{erro}</div>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={enviando}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-brand-blue disabled:opacity-60"
        >
          {enviando ? "Concluindo…" : "Concluir cadastro"}
        </button>
      </div>
    </div>
  );
}

