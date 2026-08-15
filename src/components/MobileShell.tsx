import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { memo } from "react";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

type Props = {
  children: ReactNode;
  title?: string;
  step?: { current: number; total: number };
  back?: string;
  showHeader?: boolean;
  contextLabel?: string;
  stepLabels?: string[];
};

const BOOKING_STEPS = [
  "Unidade",
  "Data",
  "Horário",
  "Advogado",
  "Pessoa custodiada",
  "Regras",
  "Revisão",
];

const DOCUMENT_STEPS = [
  "Unidade",
  "Advogado",
  "Pessoa custodiada",
  "Documento",
  "Revisão",
  "Conclusão",
];

const GENERIC_STEPS = ["Data", "Horário", "Seus dados", "Revisão"];

function inferContext(title?: string) {
  const normalized = (title || "").toLowerCase();
  if (normalized.includes("consultar")) return "Agendamentos";
  if (
    normalized.includes("agendar") ||
    normalized.includes("alterar data") ||
    normalized.includes("alterar horário") ||
    normalized.includes("enviar documento") ||
    normalized.includes("solicitação")
  ) {
    return "Atendimento Prisional";
  }
  return "Central de Agendamentos";
}

function taskTitle(title?: string) {
  if (!title) return "";
  if (title === "Alterar data") return "Remarcar atendimento";
  if (title === "Alterar horário") return "Remarcar atendimento";
  return title;
}

function shouldShowFlowHeader(title?: string) {
  if (!title || title === "Central de Agendamentos") return false;
  if (title === "Agendamento confirmado" || title === "Solicitação enviada") return false;
  return true;
}

function resolveSteps(title: string | undefined, total: number, custom?: string[]) {
  if (custom?.length === total) return custom;
  if (total === 7) return BOOKING_STEPS;
  if (total === 6) return DOCUMENT_STEPS;
  if (total === 4) return GENERIC_STEPS;
  return Array.from({ length: total }, (_, index) => `Etapa ${index + 1}`);
}

function stepperTitle(title?: string, total?: number) {
  const normalized = (title || "").toLowerCase();
  if (normalized.includes("documento") || total === 6) return "Etapas do envio";
  if (
    normalized.includes("agendar") ||
    normalized.includes("remarcar") ||
    normalized.includes("alterar data") ||
    normalized.includes("alterar horário") ||
    total === 7 ||
    total === 4
  ) {
    return "Etapas do agendamento";
  }
  return "Etapas";
}

function MobileShellComponent({
  children,
  title,
  step,
  contextLabel,
  stepLabels,
}: Props) {
  const showFlowHeader = shouldShowFlowHeader(title);
  const labels = step ? resolveSteps(title, step.total, stepLabels) : [];

  return (
    <AppShell width="wide" mainClassName={showFlowHeader ? "public-flow-page" : ""}>
      {showFlowHeader ? (
        <div className="public-flow-frame">
          <Link to="/" className="public-flow-breadcrumb">
            <ArrowLeft size={15} aria-hidden />
            Central de Agendamentos
          </Link>

          <header className="public-flow-header">
            <div className="public-flow-header__context">
              <span>{contextLabel || inferContext(title)}</span>
              <h1>{taskTitle(title)}</h1>
            </div>

            {step && (
              <div className="public-flow-progress-mobile" aria-label={`Etapa ${step.current} de ${step.total}`}>
                <div>
                  <span>Etapa {step.current} de {step.total}</span>
                  <strong>{labels[step.current - 1]}</strong>
                </div>
                <div aria-hidden>
                  <span style={{ width: `${(step.current / step.total) * 100}%` }} />
                </div>
              </div>
            )}
          </header>

          <div className="public-flow-layout">
            <section className="public-flow-content">
              <div className="public-flow-body">{children}</div>
            </section>

            {step && (
              <aside className="public-flow-stepper" aria-label="Etapas do fluxo">
                <span className="public-flow-stepper__eyebrow">{stepperTitle(title, step.total)}</span>
                <ol>
                  {labels.map((label, index) => {
                    const number = index + 1;
                    const done = number < step.current;
                    const active = number === step.current;
                    return (
                      <li
                        key={`${number}-${label}`}
                        className={
                          done
                            ? "public-flow-stepper__done"
                            : active
                              ? "public-flow-stepper__active"
                              : ""
                        }
                        aria-current={active ? "step" : undefined}
                      >
                        <span aria-hidden>{done ? <Check size={13} /> : number}</span>
                        <strong>{label}</strong>
                      </li>
                    );
                  })}
                </ol>
              </aside>
            )}
          </div>
        </div>
      ) : (
        children
      )}
    </AppShell>
  );
}

export const MobileShell = memo(MobileShellComponent);

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="public-step-title">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function StepActions({
  back,
  next,
  backLabel = "Voltar",
  nextLabel = "Continuar",
  nextDisabled,
  onBack,
  onNext,
  destructiveNext,
}: {
  back?: string;
  next?: string;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  destructiveNext?: boolean;
}) {
  const navigate = useNavigate();

  function handleBack() {
    if (onBack) return onBack();
    if (back) navigate({ to: back as any });
  }

  function handleNext() {
    if (nextDisabled) return;
    if (onNext) return onNext();
    if (next) navigate({ to: next as any });
  }

  return (
    <div className="public-flow-actions">
      {(back || onBack) && (
        <button type="button" onClick={handleBack} className="public-button public-button--secondary">
          <ArrowLeft size={16} aria-hidden />
          {backLabel}
        </button>
      )}
      <button
        type="button"
        onClick={handleNext}
        disabled={nextDisabled}
        aria-disabled={nextDisabled}
        className={
          "public-button " +
          (destructiveNext ? "public-button--danger" : "public-button--primary") +
          (nextDisabled ? " public-button--disabled" : "")
        }
      >
        {nextLabel}
        {!destructiveNext && <ArrowRight size={16} aria-hidden />}
      </button>
    </div>
  );
}
