import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { listarHorariosDisponiveis, type HorarioDisponivel } from "@/lib/oab-api";
import { usePrototype } from "@/lib/prototype-store";

export const Route = createFileRoute("/agendar/horario")({
  component: Page,
});

function Page() {
  const { booking, setBooking } = usePrototype();
  const nav = useNavigate();
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function carregar() {
    if (!booking.unidadeId || !booking.data) return;
    setLoading(true);
    setError(null);
    try {
      setHorarios(await listarHorariosDisponiveis(booking.unidadeId, booking.data));
    } catch (e) {
      console.error(e);
      setError("Não foi possível carregar os horários. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.unidadeId, booking.data]);

  const backTo = booking.reagendando ? "/agendar/revisao" : "/agendar/data";

  function continuar() {
    nav({ to: booking.reagendando ? "/agendar/revisao" : "/agendar/advogado" });
  }

  return (
    <MobileShell
      title={booking.reagendando ? "Alterar horário" : "Agendar atendimento"}
      step={booking.reagendando ? undefined : { current: 3, total: 7 }}
      back={backTo}
    >
      {booking.reagendando && (
        <div className="public-context-note mb-4">
          <div className="public-context-note__title">Alterando horário do agendamento</div>
          <div className="mt-1 text-muted-foreground">
            Dados preservados · Nova data: <span className="font-medium text-foreground">{booking.dataLabel ?? "—"}</span>
          </div>
        </div>
      )}

      <PageTitle
        title="Escolha o horário"
        subtitle="Duração de 30 minutos. Apenas um atendimento por horário em cada unidade."
      />

      {(!booking.unidadeId || !booking.data) && (
        <div className="public-flow-empty public-flow-empty--compact text-left">
          Escolha a unidade e a data antes de selecionar o horário.{" "}
          <Link to="/agendar/data" className="public-text-action">
            Voltar
          </Link>
          .
        </div>
      )}

      {booking.unidadeId && booking.data && loading && (
        <div className="public-flow-loading public-flow-loading--boxed">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando horários…
        </div>
      )}

      {booking.unidadeId && booking.data && !loading && error && (
        <div className="alert-danger p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm leading-relaxed text-foreground">{error}</p>
          </div>
          <button
            onClick={carregar}
            className="public-button public-button--primary mt-4 w-full"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {booking.unidadeId && booking.data && !loading && !error && (
        <>
          {horarios.length === 0 ? (
            <div className="public-flow-empty public-flow-empty--compact text-left">
              Nenhum horário disponível nesta data. Escolha outra data.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {horarios.map((h) => {
                const selected = booking.horario === h.horarioInicio;
                return (
                  <button
                    key={h.horarioInicio}
                    type="button"
                    onClick={() => setBooking({ horario: h.horarioInicio, horarioFim: h.horarioFim })}
                    className={
                      "public-time " + (selected ? "public-time--selected" : "")
                    }
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <StepActions
        back={backTo}
        onNext={continuar}
        nextLabel={booking.reagendando ? "Voltar para revisão" : undefined}
        nextDisabled={!booking.horario}
      />
    </MobileShell>
  );
}

