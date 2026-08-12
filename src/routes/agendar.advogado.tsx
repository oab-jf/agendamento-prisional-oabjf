import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { Field } from "@/components/Field";
import { OabField } from "@/components/OabField";
import { usePrototype } from "@/lib/prototype-store";
import { emailError, nomeError, oabError, phoneError } from "@/lib/validators";

export const Route = createFileRoute("/agendar/advogado")({
  component: Page,
});

function Page() {
  const { booking, setBooking } = usePrototype();
  const nav = useNavigate();

  // Estado local — inputs não atualizam o contexto global a cada tecla.
  // Inicializado a partir de booking apenas uma vez ao montar.
  const advNomeRef = useRef<HTMLInputElement>(null);
  const initialAdvNomeRef = useRef(booking.advNome ?? "");
  const [advOab, setAdvOab] = useState(booking.advOab ?? "");
  const [advEmail, setAdvEmail] = useState(booking.advEmail ?? "");
  const [advTelefone, setAdvTelefone] = useState(booking.advTelefone ?? "");
  const [attempted, setAttempted] = useState(false);

  const errs = {
    oab: oabError(advOab),
    email: emailError(advEmail),
    tel: phoneError(advTelefone),
  };
  const show = (e?: string) => (attempted ? e : undefined);
  const firstControlledError = errs.oab || errs.email || errs.tel;

  function continuar() {
    const advNome = advNomeRef.current?.value.trim() ?? "";
    const erroNome = nomeError(advNome);
    const firstError = erroNome || firstControlledError;

    if (firstError) {
      setAttempted(true);
      toast.error("Verifique os campos", { description: firstError });
      return;
    }
    // Commit único ao contexto global apenas ao avançar.
    setBooking({ advNome, advOab, advEmail, advTelefone });
    nav({ to: "/agendar/ipl" });
  }

  return (
    <MobileShell title="Agendar atendimento" step={{ current: 4, total: 7 }} back="/agendar/horario">
      <PageTitle title="Seus dados" subtitle="Informe seus dados profissionais. Usaremos para confirmação e contato." />

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="ag-adv-nome" className="mb-1.5 block text-sm font-medium text-foreground">
            Nome completo <span className="ml-1 text-destructive">*</span>
          </label>

          <input
            id="ag-adv-nome"
            ref={advNomeRef}
            type="text"
            defaultValue={initialAdvNomeRef.current}
            placeholder="Ex.: Maria de Oliveira"
            autoComplete="new-password"
            name="oabjf-ag-adv-nome"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            spellCheck={false}
            className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <OabField value={advOab} onChange={setAdvOab} hint="Informe a UF e o número de inscrição." required error={show(errs.oab)} />
        <Field
          label="E-mail"
          required
          type="email"
          value={advEmail}
          onChange={setAdvEmail}
          placeholder="seu.email@exemplo.com"
          error={show(errs.email)}
          autoComplete="email"
          hint="Este e-mail será compartilhado com a unidade prisional para o envio do link de acesso e comunicações diretamente relacionadas ao atendimento. A OAB/JF também poderá usá-lo para confirmações e avisos sobre este agendamento."
        />
        <Field label="Telefone" required type="tel" value={advTelefone} onChange={setAdvTelefone} placeholder="(32) 99999-0000" mask="phone" error={show(errs.tel)} autoComplete="tel" />
      </div>
      <StepActions back="/agendar/horario" onNext={continuar} />
    </MobileShell>
  );
}

