/**
 * Rodapé institucional único — OAB Juiz de Fora.
 * Compacto: identidade, atendimento e contato.
 */
import { memo } from "react";

const OAB_LOGO_URL = "/oab-logo.png";

const TRICOLOR = (
  <div className="flex h-1 w-full" aria-hidden>
    <div className="flex-1 bg-brand-red" />
    <div className="flex-[2] bg-paper" />
    <div className="flex-1 bg-brand-blue" />
  </div>
);

function AppFooterComponent() {
  return (
    <footer className="mt-10 w-full bg-ink text-paper/80">
      {TRICOLOR}
      <div className="mx-auto w-full max-w-6xl px-5 py-4 md:px-8 md:py-8">
        <div className="grid gap-3 md:grid-cols-2 md:gap-8">
          <div>
            <img
              src={OAB_LOGO_URL}
              alt="OAB Juiz de Fora"
              className="mb-1.5 h-9 w-auto brightness-0 invert md:mb-2 md:h-12"
            />
            <div className="font-serif text-[16px] leading-tight text-paper md:text-base">
              Central de Agendamento Prisional
            </div>
          </div>

          <div className="md:text-right">
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-paper/70 md:text-[10px] md:tracking-[0.18em]">
              Endereço
            </div>
            <address className="mt-1 text-[11px] not-italic leading-snug text-paper/75 md:mt-1.5 md:text-sm md:leading-relaxed md:text-paper/80">
              Av. dos Andradas, 696<br />
              Morro da Glória, Juiz de Fora/MG<br />
              CEP: 36036-000<br />
              <a
                href="tel:+553236905900"
                className="mt-0.5 inline-block text-paper/90 hover:text-paper md:mt-1"
              >
                (32) 3690-5900
              </a>
            </address>
          </div>
        </div>

        <div className="mt-3 border-t border-paper/15 pt-2.5 text-center text-[9px] uppercase tracking-[0.12em] text-paper/55 md:mt-6 md:pt-4 md:text-[10px] md:tracking-[0.18em] md:text-paper/60">
          Uso restrito a profissionais da advocacia. Dados tratados conforme a LGPD.
        </div>
      </div>
    </footer>
  );
}

export const AppFooter = memo(AppFooterComponent);

