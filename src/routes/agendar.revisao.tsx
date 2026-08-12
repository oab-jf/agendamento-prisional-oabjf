/**
 * Tela final do fluxo de agendamento — revisão e confirmação.
 *
 * Envia o payload para o Wix (`confirmarAgendamento`) e trata as respostas:
 * - `ok: true`  → salva protocolo retornado e segue para sucesso.
 * - `ok: false` → toast de erro; se for HORARIO_INDISPONIVEL, orienta o usuário
 *   a escolher outro horário.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { confirmarAgendamento } from "@/lib/oab-api";
import { usePrototype } from "@/lib/prototype-store";

export const Route = createFileRoute("/agendar/revisao")({
  component: Page,
});

function Page() {
  const { booking, setBooking } = usePrototype();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  function dadosCompletos(): string | undefined {
    if (!booking.unidadeId) return "Selecione a unidade prisional.";
    if (!booking.data) return "Selecione a data do atendimento.";
    if (!booking.horario || !booking.horarioFim) return "Selecione o horário.";
    if (!booking.advNome || !booking.advOab || !booking.advEmail || !booking.advTelefone)
      return "Preencha os dados do advogado.";
    if (!booking.ipl) return "Informe o nome da IPL.";
    if (!booking.cienciaRegras) return "É necessário aceitar as regras antes de confirmar.";
    return undefined;
  }

  async function confirmar() {
    const faltando = dadosCompletos();
    if (faltando) {
      toast.error("Dados incompletos", { description: faltando });
      return;
    }
    setLoading(true);
    try {
      const resp = await confirmarAgendamento({
        unidadeSlug: booking.unidadeId!,
        unidadeNome: booking.unidadeNome,
        dataIso: booking.data!,
        dataLabel: booking.dataLabel,
        horarioInicio: booking.horario!,
        horarioFim: booking.horarioFim!,
        nomeAdvogado: booking.advNome!,
        numeroOab: booking.advOab!,
        emailAdvogado: booking.advEmail!,
        telefoneAdvogado: booking.advTelefone!,
        nomeIpl: booking.ipl!,
        infopen: booking.infopen,
        cienciaRegras: !!booking.cienciaRegras,
      });

      if (resp.ok) {
        setBooking({ protocolo: resp.protocolo, reagendando: false });
        toast.success("Agendamento confirmado", { description: `Protocolo ${resp.protocolo}` });
        nav({ to: "/agendar/sucesso" });
        return;
      }

      const msg = resp.message || resp.error || "Não foi possível confirmar o agendamento.";
      if (resp.code === "HORARIO_INDISPONIVEL") {
        toast.error("Horário indisponível", {
          description: "Este horário acabou de ser ocupado. Escolha outro horário.",
        });
        setBooking({ horario: undefined, horarioFim: undefined });
        nav({ to: "/agendar/horario" });
        return;
      }
      toast.error("Não foi possível confirmar", { description: msg });
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão", { description: "Tente novamente em instantes." });
    } finally {
      setLoading(false);
    }
  }

  const items: [string, string | undefined][] = [
    ["Unidade", booking.unidadeNome],
    ["Data", booking.dataLabel],
    ["Horário", booking.horario && booking.horarioFim ? `${booking.horario} – ${booking.horarioFim}` : booking.horario],
    ["Advogado(a)", booking.advNome],
    ["OAB", booking.advOab],
    ["E-mail", booking.advEmail],
    ["Telefone", booking.advTelefone],
    ["Nome da IPL", booking.ipl],
    ["INFOPEN", booking.infopen || "Não informado"],
  ];

  return (
    <MobileShell title="Agendar atendimento" step={{ current: 7, total: 7 }} back={booking.reagendando ? "/agendar/horario" : "/agendar/regras"}>
      <PageTitle title="Revisão e confirmação" subtitle="Confira os dados antes de confirmar." />

      <div className="overflow-hidden rounded-2xl border bg-card">
        {items.map(([k, v], i) => (
          <div key={k} className={"flex items-start justify-between gap-4 p-3.5 text-sm " + (i > 0 ? "border-t" : "")}>
            <span className="shrink-0 text-muted-foreground">{k}</span>
            <span className={"text-right font-medium " + (v ? "text-foreground" : "text-destructive")}>{v || "Não informado"}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Uso do e-mail:</span>{" "}
        o endereço informado será compartilhado com a unidade prisional para o envio do link de acesso e comunicações diretamente relacionadas ao atendimento. A OAB/JF também poderá usá-lo para confirmações e avisos sobre este agendamento.
      </p>

      <StepActions
        back={booking.reagendando ? "/agendar/horario" : "/agendar/regras"}
        nextLabel={loading ? "Confirmando..." : "Confirmar agendamento"}
        onNext={confirmar}
        nextDisabled={loading}
      />
    </MobileShell>
  );
}

