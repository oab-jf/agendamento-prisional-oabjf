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
      <section className="public-success">
        <CheckCircle2 className="public-success__icon" aria-hidden />
        <span className="eyebrow-public">Reserva concluída</span>
        <h1>Agendamento confirmado</h1>
        <p>Seu horário foi reservado. Guarde o protocolo para consultar, cancelar ou remarcar o atendimento.</p>

        <div className="public-success__protocol">
          <span>Protocolo</span>
          <div className="public-success__protocol-row">
            <strong>{booking.protocolo ?? "AG-2026-000123"}</strong>
            <CopyButton value={booking.protocolo ?? "AG-2026-000123"} />
          </div>
        </div>

        <dl className="public-summary text-left">
          <SummaryRow k="Unidade" v={booking.unidadeNome} />
          <SummaryRow k="Data" v={booking.dataLabel} />
          <SummaryRow k="Horário" v={booking.horario ? (booking.horarioFim ? `${booking.horario} – ${booking.horarioFim}` : booking.horario) : undefined} />
          <SummaryRow k="Nome da IPL" v={booking.ipl} />
        </dl>

        <div className="public-note mt-4 text-left">
          <Mail className="public-note__icon" aria-hidden />
          Guarde o protocolo. Ele será usado para consultar, cancelar ou remarcar este agendamento.
        </div>
        <div className="public-note mt-3 text-left">
          <Info className="public-note__icon" aria-hidden />
          Em caso de dúvidas, entre em contato com a OAB Juiz de Fora e informe o protocolo.
        </div>

        <div className="public-success__actions">
          <button onClick={novo} className="public-button public-button--primary">Fazer novo agendamento</button>
          <button onClick={voltarCentral} className="public-button public-button--secondary">Voltar para a Central</button>
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

