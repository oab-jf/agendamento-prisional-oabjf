import { memo } from "react";

const SITE_URL = "https://www.juizdefora-oabmg.org.br";

function AppFooterComponent() {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer__tricolor" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className="public-site-footer__inner">
        <div className="public-site-footer__brand">
          <a href={SITE_URL} aria-label="OAB Juiz de Fora — início">
            <img src="/oab-logo.png" alt="OAB Juiz de Fora — 4ª Subseção" />
          </a>
        </div>

        <nav className="public-site-footer__links" aria-label="Navegação institucional">
          <span>Navegação</span>
          <a href={`${SITE_URL}/caa-mg-em-jf`}>Institucional</a>
          <a href={`${SITE_URL}/servicos`}>Serviços</a>
          <a href={`${SITE_URL}/eventos`}>Eventos</a>
          <a href={`${SITE_URL}/noticias`}>Notícias</a>
          <a href={`${SITE_URL}/institucional/prerrogativas`}>Prerrogativas</a>
        </nav>

        <div className="public-site-footer__contact">
          <span>Contato</span>
          <address>
            Av. dos Andradas, 696 — Morro da Glória<br />
            Juiz de Fora/MG · CEP 36036-000<br />
            <a href="tel:+553236905900">(32) 3690-5900</a>
          </address>
        </div>
      </div>

      <div className="public-site-footer__legal">
        OAB/MG · 4ª Subseção de Juiz de Fora
      </div>
    </footer>
  );
}

export const AppFooter = memo(AppFooterComponent);
