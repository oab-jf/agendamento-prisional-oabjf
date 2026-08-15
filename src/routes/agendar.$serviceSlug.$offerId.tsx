import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/Field";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { OabField } from "@/components/OabField";
import {
  confirmarAgendamentoV2,
  listarDisponibilidadeOferta,
  type PublicBookingContext,
  type PublicBookingDate,
  type PublicBookingSlot,
} from "@/lib/oab-api";
import { emailError, nomeError, oabError, phoneError } from "@/lib/validators";

export const Route = createFileRoute("/agendar/$serviceSlug/$offerId")({
  component: Page,
});

type Step = "date" | "time" | "details" | "review" | "success";

function routeParams(pathname: string) {
  const match = pathname.match(/^\/agendar\/([^/]+)\/([^/]+)\/?$/);
  return {
    serviceSlug: decodeURIComponent(match?.[1] || ""),
    offerId: decodeURIComponent(match?.[2] || ""),
  };
}

function Page() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { offerId } = useMemo(() => routeParams(pathname), [pathname]);

  const [step, setStep] = useState<Step>("date");
  const [context, setContext] = useState<PublicBookingContext | null>(null);
  const [dates, setDates] = useState<PublicBookingDate[]>([]);
  const [slots, setSlots] = useState<PublicBookingSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<PublicBookingDate | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PublicBookingSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState("");

  const [name, setName] = useState("");
  const [oab, setOab] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!offerId) {
      setError("Não foi possível identificar esta opção de atendimento.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    listarDisponibilidadeOferta(offerId)
      .then((result) => {
        if (cancelled) return;
        setContext(result.context);
        setDates(result.dates || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar esta agenda.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offerId]);

  async function chooseDate(date: PublicBookingDate) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setError(null);
    try {
      const result = await listarDisponibilidadeOferta(offerId, date.dataIso);
      setContext(result.context);
      setSlots(result.slots || []);
      setStep("time");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar os horários.";
      setError(message);
      toast.error("Não foi possível carregar os horários", { description: message });
    } finally {
      setLoadingSlots(false);
    }
  }

  function advanceDetails() {
    const firstError = nomeError(name) || oabError(oab) || emailError(email) || phoneError(phone);
    if (firstError) {
      setAttempted(true);
      toast.error("Revise seus dados", { description: firstError });
      return;
    }
    setStep("review");
  }

  async function submit() {
    if (!context || !selectedDate || !selectedSlot || submitting) return;
    if (!rulesAccepted) {
      toast.error("Confirme a ciência das regras antes de concluir.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await confirmarAgendamentoV2({
        offerId,
        dateIso: selectedDate.dataIso,
        startTime: selectedSlot.horarioInicio,
        name: name.trim(),
        oabNumber: oab,
        email: email.trim(),
        phone,
        rulesAccepted: true,
      });

      if (!result.ok) {
        const message = result.message || "Não foi possível confirmar o agendamento.";
        setError(message);
        toast.error("Agendamento não confirmado", { description: message });
        if (result.code === "HORARIO_INDISPONIVEL") {
          const refreshed = await listarDisponibilidadeOferta(offerId, selectedDate.dataIso);
          setSlots(refreshed.slots || []);
          setSelectedSlot(null);
          setStep("time");
        }
        return;
      }

      setProtocol(result.protocolo);
      setStep("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível concluir agora.";
      setError(message);
      toast.error("Não foi possível concluir", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  const current = step === "date" ? 1 : step === "time" ? 2 : step === "details" ? 3 : 4;

  if (loading) {
    return (
      <MobileShell title="Central de Agendamentos" back="/">
        <div className="public-flow-loading" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-brand-red" aria-hidden />
          <span>Carregando agenda…</span>
        </div>
      </MobileShell>
    );
  }

  if (!context || error && !dates.length) {
    return (
      <MobileShell title="Central de Agendamentos" back="/">
        <div className="public-flow-empty">
          <span className="eyebrow-public">Agenda indisponível</span>
          <h1>Não foi possível abrir este atendimento</h1>
          <p>{error || "Esta opção não está disponível para reserva no momento."}</p>
          <Link to="/" className="public-button public-button--secondary">
            <ArrowLeft size={16} aria-hidden /> Voltar para a Central
          </Link>
        </div>
      </MobileShell>
    );
  }

  if (step === "success") {
    return (
      <MobileShell title="Central de Agendamentos">
        <section className="public-success" aria-labelledby="booking-success-title">
          <CheckCircle2 className="public-success__icon" aria-hidden />
          <span className="eyebrow-public">Reserva concluída</span>
          <h1 id="booking-success-title">Agendamento confirmado</h1>
          <p>
            Seu horário foi reservado. Guarde o protocolo para consultar, cancelar ou remarcar o atendimento.
          </p>
          <div className="public-success__protocol">
            <span>Protocolo</span>
            <strong>{protocol}</strong>
          </div>
          <AppointmentSummary context={context} date={selectedDate} slot={selectedSlot} />
          <div className="public-success__actions">
            <Link to="/consultar" className="public-button public-button--primary">
              Consultar agendamento <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/" className="public-button public-button--secondary">
              Voltar para a Central
            </Link>
          </div>
        </section>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title="Agendar atendimento"
      contextLabel={context.modality.publicName}
      back="/"
      step={{ current, total: 4 }}
      stepLabels={["Data", "Horário", "Seus dados", "Revisão"]}
    >
      <section className="public-service-context" aria-label="Atendimento selecionado">
        <span>Opção de atendimento</span>
        <strong>{context.resource.name}</strong>
        <p>{context.offer.description || context.modality.description}</p>
        <div className="public-service-context__meta">
          <span><MapPin size={15} aria-hidden /> {context.location.name}</span>
          <span><Clock3 size={15} aria-hidden /> {context.offer.durationMinutes} min</span>
        </div>
        {context.location.address && <small>{context.location.address}</small>}
        {context.resource.amenities.length > 0 && (
          <div className="public-amenities" aria-label="Recursos disponíveis">
            {context.resource.amenities.map((amenity) => (
              <span key={amenity.id}><Sparkles size={13} aria-hidden /> {amenity.name}</span>
            ))}
          </div>
        )}
      </section>

      {error && <div className="public-inline-alert" role="alert">{error}</div>}

      {step === "date" && (
        <section className="public-step" aria-labelledby="date-title">
          <PageTitle title="Escolha a data" subtitle={`Você pode reservar com até ${context.offer.maximumAdvanceDays} dias de antecedência.`} />
          {dates.length ? (
            <div className="public-choice-grid public-choice-grid--dates">
              {dates.map((date) => (
                <button key={date.id} type="button" className="public-choice" onClick={() => void chooseDate(date)} disabled={loadingSlots}>
                  <CalendarDays size={17} aria-hidden />
                  <span>{date.label}</span>
                  <ArrowRight size={15} aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <div className="public-flow-empty public-flow-empty--compact">
              <h2>Nenhuma data disponível</h2>
              <p>Não há datas abertas para este atendimento no período configurado.</p>
            </div>
          )}
        </section>
      )}

      {step === "time" && (
        <section className="public-step" aria-labelledby="time-title">
          <PageTitle title="Escolha o horário" subtitle={selectedDate?.labelCompleta || selectedDate?.label || ""} />
          {loadingSlots ? (
            <div className="public-flow-loading"><Loader2 className="h-5 w-5 animate-spin text-brand-red" /> Carregando horários…</div>
          ) : slots.length ? (
            <div className="public-choice-grid public-choice-grid--times">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`public-time ${selectedSlot?.id === slot.id ? "public-time--selected" : ""}`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  <span>{slot.label}</span>
                  {context.offer.capacity > 1 && <small>{slot.vagasRestantes} {slot.vagasRestantes === 1 ? "vaga" : "vagas"}</small>}
                </button>
              ))}
            </div>
          ) : (
            <div className="public-flow-empty public-flow-empty--compact"><h2>Horários esgotados</h2><p>Escolha outra data para continuar.</p></div>
          )}
          <StepActions
            backLabel="Datas"
            onBack={() => { setStep("date"); setSelectedSlot(null); }}
            nextLabel="Continuar"
            onNext={() => selectedSlot && setStep("details")}
            nextDisabled={!selectedSlot}
          />
        </section>
      )}

      {step === "details" && (
        <section className="public-step" aria-labelledby="details-title">
          <PageTitle title="Seus dados" subtitle="Usaremos essas informações para confirmar e administrar sua reserva." />
          <div className="public-form-grid">
            <Field label="Nome completo" value={name} onChange={setName} required autoComplete="name" error={attempted ? nomeError(name) : undefined} />
            <OabField value={oab} onChange={setOab} required error={attempted ? oabError(oab) : undefined} />
            <Field label="E-mail" type="email" value={email} onChange={setEmail} required autoComplete="email" error={attempted ? emailError(email) : undefined} hint="A confirmação e o protocolo serão enviados para este e-mail." />
            <Field label="Telefone" type="tel" mask="phone" value={phone} onChange={setPhone} required autoComplete="tel" error={attempted ? phoneError(phone) : undefined} />
          </div>
          <StepActions backLabel="Horários" onBack={() => setStep("time")} nextLabel="Revisar" onNext={advanceDetails} />
        </section>
      )}

      {step === "review" && (
        <section className="public-step" aria-labelledby="review-title">
          <PageTitle title="Revise e confirme" subtitle="Confira os dados antes de reservar o horário." />
          <AppointmentSummary context={context} date={selectedDate} slot={selectedSlot} />
          <div className="public-review-person">
            <span>Responsável pela reserva</span>
            <strong>{name}</strong>
            <p>{oab} · {email} · {phone}</p>
          </div>
          <div className="public-rules">
            <div className="public-rules__icon"><ShieldCheck size={20} aria-hidden /></div>
            <div>
              <h2>Regras do atendimento</h2>
              <p>{context.offer.instructions || "Compareça no horário reservado e observe as orientações da OAB/JF."}</p>
              <ul>
                <li>Cancelamento pela Central até {context.offer.cancelDeadlineHours}h antes.</li>
                <li>Remarcação pela Central até {context.offer.rescheduleDeadlineHours}h antes.</li>
              </ul>
              <label className="public-check">
                <input type="checkbox" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} />
                <span>Li e estou de acordo com as regras deste atendimento.</span>
              </label>
            </div>
          </div>
          <StepActions backLabel="Seus dados" onBack={() => setStep("details")} nextLabel={submitting ? "Confirmando…" : "Confirmar agendamento"} onNext={() => void submit()} nextDisabled={!rulesAccepted || submitting} />
        </section>
      )}
    </MobileShell>
  );
}

function AppointmentSummary({ context, date, slot }: { context: PublicBookingContext; date: PublicBookingDate | null; slot: PublicBookingSlot | null }) {
  return (
    <dl className="public-summary">
      <div><dt>Serviço</dt><dd>{context.modality.publicName}</dd></div>
      <div><dt>Atendimento</dt><dd>{context.resource.name}</dd></div>
      <div><dt>Local</dt><dd>{context.location.name}</dd></div>
      {context.location.address && <div><dt>Endereço</dt><dd>{context.location.address}</dd></div>}
      <div><dt>Data</dt><dd>{date?.labelCompleta || date?.label || "—"}</dd></div>
      <div><dt>Horário</dt><dd>{slot?.label || "—"}</dd></div>
    </dl>
  );
}
