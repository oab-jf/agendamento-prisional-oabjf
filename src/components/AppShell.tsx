/**
 * Shell institucional único — combina AppHeader + main + AppFooter.
 * Usado por home, fluxo de agendamento, login admin e painel admin.
 */
import type { ReactNode } from "react";
import { memo } from "react";
import { AppHeader, type AppHeaderProps } from "./AppHeader";
import { AppFooter } from "./AppFooter";

type Props = AppHeaderProps & {
  children: ReactNode;
  /** Barra de etapa abaixo do header (opcional). */
  step?: { current: number; total: number };
  /** Largura do conteúdo. "narrow" para formulários, "wide" para admin. */
  width?: "narrow" | "wide";
  /** Classes extras para o <main>. */
  mainClassName?: string;
};

const WIDTH = {
  narrow: "max-w-4xl",
  wide: "max-w-7xl",
} as const;

function AppShellComponent({
  children,
  step,
  width = "narrow",
  mainClassName = "",
  ...header
}: Props) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-paper">
      <AppHeader {...header} />
      {step && (
        <div className="w-full border-b border-clay/10 bg-paper">
          <div className="mx-auto w-full max-w-6xl px-4 py-3 md:px-8">
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-clay">
              <span>
                Etapa {step.current} / {step.total}
              </span>
              <span>{Math.round((step.current / step.total) * 100)}%</span>
            </div>
            <div className="h-px w-full overflow-hidden bg-clay/20">
              <div
                className="h-full bg-brand-red transition-all"
                style={{ width: `${(step.current / step.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <main
        className={
          "mx-auto flex w-full flex-1 flex-col px-4 py-6 md:px-8 md:py-10 " +
          WIDTH[width] +
          (mainClassName ? " " + mainClassName : "")
        }
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}

export const AppShell = memo(AppShellComponent);

