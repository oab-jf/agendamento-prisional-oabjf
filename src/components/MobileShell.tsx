/**
 * Compatibilidade: reexporta o shell institucional único.
 * Mantido para que as rotas existentes continuem funcionando
 * sem precisar trocar imports.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

type Props = {
  children: ReactNode;
  title?: string;
  step?: { current: number; total: number };
  back?: string;
  showHeader?: boolean;
};

function MobileShellComponent({ children, title, step, back }: Props) {
  const rightSlot = useMemo(
    () =>
      back ? (
        <Link
          to={back as any}
          aria-label="Voltar"
          className="inline-flex items-center gap-1.5 rounded-md border border-clay/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-ink transition-colors hover:bg-sand"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Voltar
        </Link>
      ) : (
        <Link
          to="/admin"
          aria-label="Acesso administrativo"
          className="hidden items-center gap-1.5 rounded-md border border-clay/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-ink transition-colors hover:bg-sand sm:inline-flex"
        >
          Acesso administrativo
        </Link>
      ),
    [back],
  );

  return (
    <AppShell
      title={title ?? "Central de Agendamento Prisional"}
      step={step}
      width="narrow"
      rightSlot={rightSlot}
    >
      {children}
    </AppShell>
  );
}

export const MobileShell = memo(MobileShellComponent);

/** Título grande da etapa + subtítulo opcional. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-3xl leading-[1.1] tracking-tight text-ink md:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm leading-relaxed text-clay md:text-base">{subtitle}</p>
      )}
    </div>
  );
}

export function StepActions({
  back,
  next,
  nextLabel = "Continuar",
  nextDisabled,
  onNext,
  destructiveNext,
}: {
  back?: string;
  next?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  onNext?: () => void;
  destructiveNext?: boolean;
}) {
  const navigate = useNavigate();

  function handleNext() {
    if (nextDisabled) return;
    if (onNext) {
      onNext();
      return;
    }
    if (next) navigate({ to: next as any });
  }

  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-clay/15 pt-6 md:flex-row-reverse md:items-center md:justify-start md:gap-4">
      <button
        type="button"
        onClick={handleNext}
        disabled={nextDisabled}
        aria-disabled={nextDisabled}
        className={
          "inline-flex h-13 w-full items-center justify-center rounded-md px-6 py-4 text-sm font-medium uppercase tracking-[0.15em] transition-colors md:h-12 md:w-auto md:min-w-56 " +
          (nextDisabled
            ? "cursor-not-allowed bg-sand text-clay"
            : destructiveNext
            ? "bg-brand-red text-paper hover:bg-brand-red/90"
            : "bg-ink text-paper hover:bg-brand-blue")
        }
      >
        {nextLabel}
      </button>
      {back && (
        <Link
          to={back as any}
          className="inline-flex h-12 w-full items-center justify-center text-sm font-medium text-clay transition-colors hover:text-brand-red md:w-auto md:justify-start"
        >
          ← Voltar
        </Link>
      )}
    </div>
  );
}

