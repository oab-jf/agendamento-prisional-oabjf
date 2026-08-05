import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Info } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { CopyButton } from "@/components/CopyButton";
import { usePrototype } from "@/lib/prototype-store";

export const Route = createFileRoute("/documento/sucesso")({
  component: Page,
});

function Page() {
  const { doc, resetDoc } = usePrototype();
  const nav = useNavigate();

  function novo() {
    resetDoc();
    nav({ to: "/documento/unidade" });
  }

  function voltarCentral() {
    resetDoc();
    nav({ to: "/" });
  }

  return (
    <MobileShell title="Solicitação enviada" showHeader>
      <div className="flex flex-1 flex-col">
        <div className="mx-auto mb-5 mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">
          {doc.emailUnidadeEnviado === false || doc.status === "com_erro"
            ? "Solicitação registrada"
            : "Solicitação enviada"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {doc.emailUnidadeEnviado === false || doc.status === "com_erro"
            ? "Sua solicitação foi registrada, mas houve falha no envio automático para a unidade. A OAB poderá acompanhar pelo painel administrativo."
            : "Sua solicitação foi registrada e a unidade prisional foi notificada."}
        </p>

        <div className="mt-5 rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Protocolo</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold tracking-wide text-foreground break-all">
              {doc.protocolo ?? "—"}
            </span>
            {doc.protocolo && <CopyButton value={doc.protocolo} />}
          </div>
          <hr className="my-3" />
          <Row k="Unidade" v={doc.unidadeNome} />
          <Row k="Advogado(a)" v={doc.advNome} />
          <Row k="OAB" v={doc.advOab} />
          <Row k="Nome da IPL" v={doc.ipl} />
          <Row k="Tipo de documento" v={doc.tipoDocumentoLabel} />
          <Row k="Arquivo" v={doc.arquivoPrincipalNome} />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          A unidade prisional devolverá o documento assinado diretamente ao advogado, conforme fluxo definido.
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <button
            onClick={novo}
            className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            Enviar novo documento
          </button>
          <button
            onClick={voltarCentral}
            className="flex h-12 w-full items-center justify-center rounded-xl border text-sm font-medium"
          >
            Voltar para a Central
          </button>
        </div>
      </div>
    </MobileShell>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium text-foreground">{v ?? "—"}</span>
    </div>
  );
}

