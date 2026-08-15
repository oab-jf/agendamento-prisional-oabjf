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
  const envioComErro = doc.emailUnidadeEnviado === false || doc.status === "com_erro";

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
      <section className="public-success">
        <CheckCircle2 className="public-success__icon" aria-hidden />
        <span className="eyebrow-public">Atendimento Prisional</span>
        <h1>{envioComErro ? "Solicitação registrada" : "Solicitação enviada"}</h1>
        <p>
          {envioComErro
            ? "A solicitação foi registrada. A OAB poderá acompanhar o encaminhamento pelo painel administrativo."
            : "A solicitação foi registrada e encaminhada à unidade prisional."}
        </p>

        <div className="public-success__protocol">
          <span>Protocolo</span>
          <div className="public-success__protocol-row">
            <strong>{doc.protocolo ?? "—"}</strong>
            {doc.protocolo && <CopyButton value={doc.protocolo} />}
          </div>
        </div>

        <dl className="public-summary text-left">
          <SummaryRow k="Unidade" v={doc.unidadeNome} />
          <SummaryRow k="Advogado(a)" v={doc.advNome} />
          <SummaryRow k="OAB" v={doc.advOab} />
          <SummaryRow k="Pessoa custodiada" v={doc.ipl} />
          <SummaryRow k="Tipo de documento" v={doc.tipoDocumentoLabel} />
          <SummaryRow k="Arquivo" v={doc.arquivoPrincipalNome} />
        </dl>

        <div className="public-note text-left">
          <Info className="public-note__icon" aria-hidden />
          A unidade prisional devolverá o documento assinado diretamente ao advogado, conforme o fluxo de atendimento.
        </div>

        <div className="public-success__actions">
          <button onClick={novo} className="public-button public-button--primary">
            Enviar novo documento
          </button>
          <button onClick={voltarCentral} className="public-button public-button--secondary">
            Voltar para a Central
          </button>
        </div>
      </section>
    </MobileShell>
  );
}

function SummaryRow({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v ?? "—"}</dd>
    </div>
  );
}
