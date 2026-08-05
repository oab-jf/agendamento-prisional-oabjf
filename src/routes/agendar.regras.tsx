import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CircleCheck, X } from "lucide-react";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { usePrototype } from "@/lib/prototype-store";

export const Route = createFileRoute("/agendar/regras")({
  component: Page,
});

const REGRAS = [
  "O atendimento é exclusivo para advogado(a).",
  "Cada agendamento é para uma única IPL.",
  "É proibido gravar, fotografar ou capturar a tela.",
  "O atendimento deve ser feito com câmera e áudio funcionando.",
  "O link não deve ser compartilhado com terceiros.",
];

const REGRAS_COMPLETAS = [
  ...REGRAS,
  "A tolerância máxima de atraso é de 10 minutos.",
  "Em caso de instabilidade, o atendimento poderá ser remarcado.",
  "Cancelamentos devem ser feitos com até 24h de antecedência.",
  "O uso indevido pode levar à suspensão do acesso ao sistema.",
  "As salas virtuais são monitoradas apenas quanto à conectividade.",
];

function Page() {
  const { booking, setBooking } = usePrototype();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <MobileShell title="Agendar atendimento" step={{ current: 6, total: 7 }} back="/agendar/ipl">
      <PageTitle title="Ciência das regras" subtitle="Leia as regras antes de continuar." />
      <ul className="flex flex-col gap-3">
        {REGRAS.map((r) => (
          <li key={r} className="flex items-start gap-3 rounded-xl border bg-card p-3 text-sm leading-relaxed">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
      >
        Ver regras completas
      </button>

      <label className="mt-5 flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
        <input
          type="checkbox"
          checked={!!booking.cienciaRegras}
          onChange={(e) => setBooking({ cienciaRegras: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <span className="text-sm font-medium leading-relaxed text-foreground">
          Declaro estar ciente das regras do atendimento virtual.
        </span>
      </label>

      <StepActions
        back="/agendar/ipl"
        onNext={() => nav({ to: "/agendar/revisao" })}
        nextDisabled={!booking.cienciaRegras}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">Regras completas</h2>
              <button onClick={() => setOpen(false)} className="-mr-2 -mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              {REGRAS_COMPLETAS.map((r) => <li key={r}>{r}</li>)}
            </ol>
            <button onClick={() => setOpen(false)} className="mt-5 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">Fechar</button>
          </div>
        </div>
      )}
    </MobileShell>
  );
}

