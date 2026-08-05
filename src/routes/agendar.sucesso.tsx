import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Mail, Info } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { CopyButton } from "@/components/CopyButton";
import { usePrototype } from "@/lib/prototype-store";

export const Route = createFileRoute("/agendar/sucesso")({
  component: Page,
});

function Page() {
  const { booking, resetBooking } = usePrototype();
  const nav = useNavigate();

  function novo() {
    resetBooking();
    nav({ to: "/agendar/unidade" });
  }

  function voltarCentral() {
    resetBooking();
    nav({ to: "/" });
  }

  return (
    <MobileShell title="Agendamento confirmado" showHeader>
      <div className="flex flex-1 flex-col">
        <div className="mx-auto mb-5 mt-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">Agendamento confirmado</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Seu protocolo foi gerado com sucesso.
        </p>

        <div className="mt-5 rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Protocolo</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold tracking-wide text-foreground break-all">{booking.protocolo ?? "AG-2026-000123"}</span>
            <CopyButton value={booking.protocolo ?? "AG-2026-000123"} />
          </div>
          <hr className="my-3" />
          <Row k="Unidade" v={booking.unidadeNome} />
          <Row k="Data" v={booking.dataLabel} />
          <Row k="Horário" v={booking.horario ? (booking.horarioFim ? `${booking.horario} – ${booking.horarioFim}` : booking.horario) : undefined} />
          <Row k="Nome da IPL" v={booking.ipl} />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Guarde o protocolo gerado. Ele poderá ser usado para acompanhamento junto à OAB.
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Em caso de dúvidas, entre em contato com a OAB Juiz de Fora informando o protocolo do agendamento.
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <button onClick={novo} className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground">
            Fazer novo agendamento
          </button>
          <button onClick={voltarCentral} className="flex h-12 w-full items-center justify-center rounded-xl border text-sm font-medium">
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

