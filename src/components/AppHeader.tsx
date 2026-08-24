import { Menu, X } from "lucide-react";
import { memo, useState } from "react";
import type { ReactNode } from "react";

export type AppHeaderProps = {
  title?: string;
  eyebrow?: string;
  meta?: ReactNode;
  rightSlot?: ReactNode;
};

const PRODUCTION_SITE_URL = "https://www.juizdefora-oabmg.org.br";

const SITE_URL = (
  import.meta.env.VITE_SITE_URL ||
  (import.meta.env.DEV ? "http://localhost:4321" : PRODUCTION_SITE_URL)
).replace(/\/+$/, "");

const navigation = [
  { label: "Institucional", href: `${SITE_URL}/caa-mg-em-jf` },
  { label: "Serviços", href: `${SITE_URL}/servicos`, active: true },
  { label: "Eventos", href: `${SITE_URL}/eventos` },
  { label: "Notícias", href: `${SITE_URL}/noticias` },
  { label: "Prerrogativas", href: `${SITE_URL}/institucional/prerrogativas` },
];

function AppHeaderComponent({ rightSlot }: AppHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="public-site-header">
      <div className="public-site-header__tricolor" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <nav className="public-site-header__inner" aria-label="Navegação institucional">
        <a
          href={SITE_URL}
          className="public-site-header__brand"
          aria-label="OAB Juiz de Fora — início"
        >
          <img src="/oab-logo.png" alt="OAB Juiz de Fora — 4ª Subseção" />
        </a>

        <div className="public-site-header__nav">
          {navigation.map((item) => (
            <a
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={item.active ? "public-site-header__nav-link--active" : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>

        {rightSlot ? (
          <div className="public-site-header__custom-action">{rightSlot}</div>
        ) : (
          <a href={`${SITE_URL}/servicos`} className="public-site-header__quick-link">
            Acesso rápido
          </a>
        )}

        <button
          type="button"
          className="public-site-header__menu-button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </nav>

      {open && (
        <>
          <button
            type="button"
            className="public-site-header__mobile-backdrop"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <div className="public-site-header__mobile-panel">
            <div className="public-site-header__mobile-inner">
              {navigation.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="public-site-header__mobile-meta">
                OAB/MG · 4ª Subseção de Juiz de Fora
                <br />
                (32) 3690-5900
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

export const AppHeader = memo(AppHeaderComponent);
