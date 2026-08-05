import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { Field } from "@/components/Field";
import { usePrototype } from "@/lib/prototype-store";
import { infopenError, nomeIplError } from "@/lib/validators";

export const Route = createFileRoute("/documento/ipl")({
  component: Page,
});

function Page() {
  const { doc, setDoc } = usePrototype();
  const nav = useNavigate();

  const [ipl, setIpl] = useState(doc.ipl ?? "");
  const [infopen, setInfopen] = useState(doc.infopen ?? "");
  const [attempted, setAttempted] = useState(false);

  const eIpl = nomeIplError(ipl);
  const eInfo = infopenError(infopen);
  const show = (e?: string) => (attempted ? e : undefined);
  const first = eIpl || eInfo;

  function continuar() {
    if (first) {
      setAttempted(true);
      toast.error("Verifique os campos", { description: first });
      return;
    }
    setDoc({ ipl, infopen });
    nav({ to: "/documento/upload" });
  }

  return (
    <MobileShell title="Enviar documento" step={{ current: 3, total: 6 }} back="/documento/advogado">
      <PageTitle
        title="Dados da pessoa custodiada"
        subtitle="Informe o nome da pessoa custodiada. O INFOPEN é opcional."
      />

      <div className="flex flex-col gap-4">
        <Field
          label="Nome da IPL"
          value={ipl}
          onChange={setIpl}
          placeholder="Ex.: João da Silva"
          required
          hint="Informe o nome da pessoa custodiada."
          error={show(eIpl)}
        />
        <Field label="INFOPEN (opcional)" value={infopen} onChange={setInfopen} placeholder="Ex.: 1234567" mask="infopen" error={show(eInfo)} />
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          O INFOPEN é opcional. Preencha apenas se souber.
        </div>
      </div>
      <StepActions back="/documento/advogado" onNext={continuar} />
    </MobileShell>
  );
}

