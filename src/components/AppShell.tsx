/** Shell global estável da Central pública. */
import type { ReactNode } from "react";
import { memo } from "react";
import { AppHeader, type AppHeaderProps } from "./AppHeader";
import { AppFooter } from "./AppFooter";

type Props = AppHeaderProps & {
  children: ReactNode;
  /** Mantido por compatibilidade. Progresso agora pertence ao FlowHeader. */
  step?: { current: number; total: number };
  width?: "narrow" | "wide";
  mainClassName?: string;
};

function AppShellComponent({
  children,
  width = "wide",
  mainClassName = "",
  ...header
}: Props) {
  return (
    <div className="public-site-shell">
      <AppHeader {...header} />

      <main
        className={
          "public-site-main public-site-main--" +
          width +
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
