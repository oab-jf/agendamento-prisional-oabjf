import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { usePrototype } from "@/lib/prototype-store";
import { confirmarDocumento } from "@/lib/oab-api";

export const Route = createFileRoute("/documento/revisao")({
  component: Page,
});

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-clay/10 py-2.5 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-[0.15em] text-clay">{label}</span>
      <span className="text-sm text-foreground sm:text-right">{value || "—"}</span>
    </div>
  );
}

function Page() {
  const { doc, setDoc } = usePrototype();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const camposOk =
    !!doc.unidadeId &&
    !!doc.advNome &&
    !!doc.advOab &&
    !!doc.advEmail &&
    !!doc.advTelefone &&
    !!doc.ipl &&
    !!doc.tipoDocumento &&
    !!doc.tipoDocumentoLabel &&
    !!doc.arquivoPrincipalUrl &&
    !!doc.arquivoPrincipalNome;

  async function confirmar() {
    if (!camposOk) {
      toast.error("Faltam informações", { description: "Volte e complete todas as etapas." });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await confirmarDocumento({
        unidadeSlug: doc.unidadeId!,
        unidadeNome: doc.unidadeNome,
        advNome: doc.advNome!,
        numeroOab: doc.advOab!,
        advEmail: doc.advEmail!,
        advTelefone: doc.advTelefone!,
        nomeIpl: doc.ipl!,
        infopen: doc.infopen || undefined,
        tipoDocumento: doc.tipoDocumento!,
        tipoDocumentoLabel: doc.tipoDocumentoLabel!,
        arquivoPrincipalUrl: doc.arquivoPrincipalUrl!,
        arquivoPrincipalNome: doc.arquivoPrincipalNome!,
        observacoesAdvogado: doc.observacoesAdvogado || undefined,
      });
      if (!res.ok) {
        const msg = res.message || res.error || "Não foi possível registrar a solicitação.";
        setError(msg);
        toast.error("Erro ao enviar", { description: msg });
        return;
      }
      setDoc({
        protocolo: res.protocolo,
        solicitacaoId: res.solicitacaoId,
        status: res.status,
        emailUnidadeEnviado: res.emailUnidadeEnviado,
      });
      nav({ to: "/documento/sucesso" });
    } catch (e) {
      console.error(e);
      const msg = "Falha de conexão. Tente novamente.";
      setError(msg);
      toast.error("Erro ao enviar", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MobileShell title="Enviar documento" step={{ current: 5, total: 6 }} back="/documento/upload">
      <PageTitle title="Revise antes de enviar" subtitle="Confira os dados. Ao confirmar, a unidade prisional será notificada." />

      <div className="rounded-2xl border bg-card p-4">
        <Row label="Unidade" value={doc.unidadeNome} />
        <Row label="Advogado(a)" value={doc.advNome} />
        <Row label="OAB" value={doc.advOab} />
        <Row label="E-mail" value={doc.advEmail} />
        <Row label="Telefone" value={doc.advTelefone} />
        <Row label="Nome da IPL" value={doc.ipl} />
        <Row label="INFOPEN" value={doc.infopen} />
        <Row label="Tipo de documento" value={doc.tipoDocumentoLabel} />
        <Row label="Arquivo" value={doc.arquivoPrincipalNome} />
        <Row label="Observações" value={doc.observacoesAdvogado} />
      </div>

      {!camposOk && (
        <p className="mt-4 text-xs text-destructive">
          Algumas informações estão faltando.{" "}
          <Link to="/documento/unidade" className="underline">
            Reinicie o fluxo
          </Link>
          .
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <StepActions
        back="/documento/upload"
        onNext={confirmar}
        nextDisabled={submitting || !camposOk}
        nextLabel={submitting ? "Enviando…" : "Confirmar envio"}
      />
    </MobileShell>
  );
}

