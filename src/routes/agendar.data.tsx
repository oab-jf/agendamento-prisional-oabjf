import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Check, AlertTriangle, Loader2 } from "lucide-react";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
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
  const PAGE = 5;
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
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
          <div className="font-semibold text-primary">Alterando data do agendamento</div>
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
        <div className="rounded-2xl border border-dashed bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
          Nenhuma unidade selecionada.{" "}
          <Link to="/agendar/unidade" className="font-medium text-brand-blue underline">
            Voltar para escolher a unidade
          </Link>
          .
        </div>
      )}

      {booking.unidadeId && loading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando datas…
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
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink text-sm font-medium uppercase tracking-[0.15em] text-paper hover:bg-brand-blue"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {booking.unidadeId && !loading && !error && (
        <div className="flex flex-col gap-3">
          {datas.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-muted/40 p-5 text-sm text-muted-foreground">
              Nenhuma data disponível no momento.
            </div>
          )}
          {datas.slice(0, visiveis).map((d) => {
            const selected = booking.data === d.dataIso;
            const disabled = d.encerrado || d.disponivel === false;
            return (
              <button
                key={d.dataIso}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setBooking({ data: d.dataIso, dataLabel: d.label, horario: undefined, horarioFim: undefined });
                  if (booking.unidadeId) {
                    void listarHorariosDisponiveis(booking.unidadeId, d.dataIso).catch(() => undefined);
                  }
                }}
                className={
                  "flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors " +
                  (disabled
                    ? "cursor-not-allowed border-input bg-muted/40 opacity-60"
                    : selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-input bg-card hover:bg-muted/40")
                }
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-tight text-foreground">{d.label}</div>
                  {disabled ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> Prazo encerrado
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">Horários disponíveis</div>
                  )}
                </div>
                {selected && <Check className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
          {datas.length > 0 && (
            <div className="mt-1 flex flex-col items-center gap-2">
              {visiveis < datas.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => setVisiveis((v) => Math.min(v + PAGE, datas.length))}
                    className="rounded-md border border-clay/30 bg-transparent px-4 py-2 text-sm text-ink transition-colors hover:bg-sand/60"
                  >
                    Ver próximas datas
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Mostrando {Math.min(visiveis, datas.length)} de {datas.length} datas disponíveis.
                  </p>
                </>
              ) : datas.length > PAGE ? (
                <p className="text-xs text-muted-foreground">
                  Todas as datas disponíveis no período foram exibidas.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <StepActions back={backTo} next="/agendar/horario" nextDisabled={!booking.data} />
    </MobileShell>
  );
}

