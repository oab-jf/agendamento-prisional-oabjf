import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, AlertTriangle, Loader2 } from "lucide-react";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { PublicChoiceCard } from "@/components/PublicChoiceCard";
import { listarDatasDisponiveis, listarHorariosDisponiveis, type DataDisponivel } from "@/lib/oab-api";
import { usePrototype } from "@/lib/prototype-store";

export const Route = createFileRoute("/agendar/data")({
  component: Page,
});

function Page() {
  const { booking, setBooking } = usePrototype();
  const [datas, setDatas] = useState<DataDisponivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const PAGE = 8;
  const [visiveis, setVisiveis] = useState(PAGE);

  async function carregar() {
    if (!booking.unidadeId) return;
    setLoading(true);
    setError(null);
    setVisiveis(PAGE);
    try {
      setDatas(await listarDatasDisponiveis(booking.unidadeId));
    } catch (e) {
      console.error(e);
      setError("Não foi possível carregar as datas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.unidadeId]);

  const backTo = booking.reagendando ? "/agendar/revisao" : "/agendar/unidade";

  return (
    <MobileShell
      title={booking.reagendando ? "Alterar data" : "Agendar atendimento"}
      step={booking.reagendando ? undefined : { current: 2, total: 7 }}
      back={backTo}
    >
      {booking.reagendando && (
        <div className="public-context-note mb-4">
          <div className="public-context-note__title">Alterando data do agendamento</div>
          <div className="mt-1 text-muted-foreground">
            Seus dados foram preservados: <span className="font-medium text-foreground">{booking.unidadeNome}</span>
            {booking.advNome ? <> · {booking.advNome}</> : null}
            {booking.ipl ? <> · IPL {booking.ipl}</> : null}.
          </div>
        </div>
      )}

      <PageTitle
        title="Escolha a data"
        subtitle="Datas com prazo encerrado aparecem desabilitadas."
      />

      {!booking.unidadeId && (
        <div className="public-flow-empty public-flow-empty--compact text-left">
          Nenhuma unidade selecionada.{" "}
          <Link to="/agendar/unidade" className="public-text-action">
            Voltar para escolher a unidade
          </Link>
          .
        </div>
      )}

      {booking.unidadeId && loading && (
        <div className="public-date-loading" role="status" aria-live="polite">
          <div className="public-date-loading__status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <div>
              <strong>Buscando as próximas datas disponíveis</strong>
              <span>Validando agenda, bloqueios e horários da unidade selecionada.</span>
            </div>
          </div>
          <div className="public-date-loading__skeleton" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {booking.unidadeId && !loading && error && (
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

      {booking.unidadeId && !loading && !error && (
        <div>
          {datas.length === 0 && (
            <div className="public-flow-empty public-flow-empty--compact text-left">
              Nenhuma data disponível no momento.
            </div>
          )}

          {datas.length > 0 && (
            <div
              className="public-choice-grid public-choice-grid--dates"
              role="radiogroup"
              aria-label="Datas disponíveis"
            >
              {datas.slice(0, visiveis).map((d) => {
                const selected = booking.data === d.dataIso;
                const disabled = d.encerrado || d.disponivel === false;

                function prefetchHorarios() {
                  if (!disabled && booking.unidadeId) {
                    void listarHorariosDisponiveis(booking.unidadeId, d.dataIso).catch(() => undefined);
                  }
                }

                return (
                  <PublicChoiceCard
                    key={d.dataIso}
                    title={d.label}
                    description={disabled ? "Prazo encerrado" : "Horários disponíveis"}
                    icon={<Calendar size={18} aria-hidden />}
                    selected={selected}
                    disabled={disabled}
                    onIntent={prefetchHorarios}
                    onClick={() => {
                      if (disabled) return;
                      setBooking({
                        data: d.dataIso,
                        dataLabel: d.label,
                        horario: undefined,
                        horarioFim: undefined,
                      });
                      prefetchHorarios();
                    }}
                  />
                );
              })}
            </div>
          )}

          {datas.length > 0 && (
            <div className="public-date-pagination">
              {visiveis < datas.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => setVisiveis((v) => Math.min(v + PAGE, datas.length))}
                    className="public-button public-button--secondary"
                  >
                    Ver próximas datas
                  </button>
                  <p>
                    Mostrando {Math.min(visiveis, datas.length)} de {datas.length} datas disponíveis.
                  </p>
                </>
              ) : datas.length > PAGE ? (
                <p>Todas as datas disponíveis no período foram exibidas.</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <StepActions back={backTo} next="/agendar/horario" nextDisabled={!booking.data} />
    </MobileShell>
  );
}

