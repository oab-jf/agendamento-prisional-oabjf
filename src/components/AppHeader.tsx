/**
 * Cabeçalho institucional único — OAB Juiz de Fora.
 *
 * Mantém a mesma estrutura em todas as áreas (home, agendamento,
 * sucesso, login admin, painel admin). Apenas o texto/contexto muda.
 */
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import type { ReactNode } from "react";

const OAB_LOGO_URL = "/oab-logo.png";

export type AppHeaderProps = {
  /** Linha principal — contextual à tela. */
  title?: string;
  /** Texto institucional pequeno acima do título. */
  eyebrow?: string;
  /** Linha pequena abaixo do título (ex.: e-mail logado). */
  meta?: ReactNode;
  /** Slot de ação à direita (Voltar, Sair, link admin etc.). */
  rightSlot?: ReactNode;
};

const TRICOLOR = (
  <div className="flex h-1 w-full" aria-hidden>
    <div className="flex-1 bg-brand-red" />
    <div className="flex-[2] bg-paper" />
    <div className="flex-1 bg-brand-blue" />
  </div>
);

function AppHeaderComponent({
  title = "Central de Agendamento Prisional",
  eyebrow = "OAB/MG · 4ª Subseção de Juiz de Fora",
  meta,
  rightSlot,
}: AppHeaderProps) {
  return (
    <header className="w-full border-b border-clay/15 bg-paper">
      {TRICOLOR}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-3.5 py-3 md:gap-4 md:px-8 md:py-6">
        <Link
          to="/"
          aria-label="OAB Juiz de Fora — início"
          className="inline-flex shrink-0 items-center"
        >
          <img
            src={OAB_LOGO_URL}
            alt="OAB Juiz de Fora"
            className="h-8 w-auto sm:h-10 md:h-14"
          />
        </Link>

        <div className="min-w-0 flex-1 text-right md:text-left">
          <div className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-clay md:block">
            {eyebrow}
          </div>
          <div className="truncate font-serif text-[14px] leading-tight text-ink md:text-xl">
            {title}
          </div>
          {meta && (
            <div className="truncate text-[10px] text-clay/75 md:text-xs">{meta}</div>
          )}
        </div>

        {rightSlot && (
          <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
        )}
      </div>
    </header>
  );
}

export const AppHeader = memo(AppHeaderComponent);

