import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { Field } from "@/components/Field";
import { usePrototype } from "@/lib/prototype-store";
import { infopenError, nomeIplError } from "@/lib/validators";

export const Route = createFileRoute("/agendar/ipl")({
  component: Page,
});

function Page() {
  const { booking, setBooking } = usePrototype();
  const nav = useNavigate();

  // Estado local — evita re-render global a cada tecla.
  const [ipl, setIpl] = useState(booking.ipl ?? "");
  const [infopen, setInfopen] = useState(booking.infopen ?? "");
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
    setBooking({ ipl, infopen });
    nav({ to: "/agendar/regras" });
  }

  return (
    <MobileShell title="Agendar atendimento" step={{ current: 5, total: 7 }} back="/agendar/advogado">
      <PageTitle title="Dados da pessoa a ser atendida" subtitle="Cada agendamento é válido para uma única IPL." />

      <div className="flex flex-col gap-4">
        <Field
          label="Nome da IPL"
          value={ipl}
          onChange={setIpl}
          placeholder="Ex.: João da Silva"
          required
          hint="Informe o nome da pessoa a ser atendida."
          error={show(eIpl)}
        />
        <Field label="INFOPEN (opcional)" value={infopen} onChange={setInfopen} placeholder="Ex.: 1234567" mask="infopen" error={show(eInfo)} />
        <div className="public-note">
          <Info className="public-note__icon" aria-hidden />
          O INFOPEN é opcional. Preencha apenas se souber.
        </div>
      </div>
      <StepActions back="/agendar/advogado" onNext={continuar} />
    </MobileShell>
  );
}

