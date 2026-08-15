import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MobileShell } from "@/components/MobileShell";
import {
  listarCatalogoAgendamentos,
  type PublicAppointmentCatalog,
  type PublicAppointmentModality,
  type PublicAppointmentOffer,
} from "@/lib/oab-api";

export const Route = createFileRoute("/")({
  component: Home,
});

const FALLBACK_CATALOG: PublicAppointmentCatalog = {
  schemaVersion: 1,
  revision: 1,
  modalities: [
    {
      id: "prisional_virtual",
      familyId: "prisional",
      template: "prisional",
      publicName: "Atendimento Prisional",
      description:
        "Atendimento virtual com pessoa privada de liberdade nas unidades participantes.",
      order: 10,
      offers: [
        {
          id: "atendimento-prisional-virtual",
          name: "Agendar atendimento virtual",
          description: "Reserve um horário com pessoa privada de liberdade.",
          bookingPath: "/agendar/unidade",
          durationMinutes: 30,
          capacity: 1,
          minimumNoticeHours: 0,
          maximumAdvanceDays: 30,
          cancelDeadlineHours: 0,
          rescheduleDeadlineHours: 0,
          availabilityMode: "legacy",
          weeklySchedule: [],
          instructions: "",
          location: {
            id: "atendimento-virtual",
            name: "Atendimento virtual",
            address: "Online",
            kind: "virtual",
          },
          resource: {
            id: "unidades-prisionais",
            name: "Unidades prisionais participantes",
            kind: "legacy_prison_units",
          },
          order: 10,
        },
      ],
    },
  ],
};

function Home() {
  const [catalog, setCatalog] = useState<PublicAppointmentCatalog | null>(null);

  useEffect(() => {
    let active = true;
    void listarCatalogoAgendamentos()
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch(() => {
        if (active) setCatalog(FALLBACK_CATALOG);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleCatalog = catalog || FALLBACK_CATALOG;
  const modalities = useMemo(
    () => visibleCatalog.modalities.filter((modality) => modality.offers.length > 0),
    [visibleCatalog],
  );

  return (
    <MobileShell>
      <section className="public-home-hero">
        <span className="eyebrow-public">Serviços para a advocacia</span>
        <h1>Central de Agendamentos</h1>
        <p>
          Agende atendimentos e espaços disponibilizados pela OAB Juiz de Fora.
          Acompanhe reservas já realizadas e acesse as operações vinculadas aos serviços.
        </p>
      </section>

      <section className="public-home-section" aria-labelledby="servicos-title">
        <div className="public-home-section__heading">
          <div>
            <span className="eyebrow-public" id="servicos-title">Serviços disponíveis</span>
            <p>Escolha o serviço que deseja utilizar.</p>
          </div>
        </div>

        <div className="public-service-grid">
          {modalities.map((modality) => (
            <ServiceCard key={modality.id} modality={modality} />
          ))}
        </div>
      </section>

      <section className="public-home-support" aria-labelledby="acoes-title">
        <div className="public-home-section__heading">
          <div>
            <span className="eyebrow-public" id="acoes-title">Ações rápidas</span>
            <p>Consulte uma reserva existente ou envie documentos vinculados ao Atendimento Prisional.</p>
          </div>
        </div>

        <div className="public-support-grid">
          <SupportLink
            to="/consultar"
            icon={<Search aria-hidden />}
            title="Consultar agendamento"
            desc="Localize, cancele ou remarque uma reserva usando protocolo e e-mail."
          />
          <SupportLink
            to="/documento/unidade"
            icon={<FileText aria-hidden />}
            title="Enviar documento"
            desc="Encaminhe documento ou procuração vinculados ao Atendimento Prisional."
          />
        </div>
      </section>
    </MobileShell>
  );
}

function actionLabel(
  modality: PublicAppointmentModality,
  offer: PublicAppointmentOffer,
  multiple: boolean,
) {
  if (modality.id === "prisional_virtual") return "Agendar atendimento";
  if (!multiple) return "Agendar atendimento";
  return offer.resource?.name || offer.name;
}

function ServiceCard({ modality }: { modality: PublicAppointmentModality }) {
  const multiple = modality.offers.length > 1;

  return (
    <article className="public-service-card">
      <div className="public-service-card__content">
        <h3>{modality.publicName}</h3>
        <p>{modality.description}</p>
      </div>

      <div className="public-service-card__actions">
        {modality.offers.map((offer) => {
          const label = actionLabel(modality, offer, multiple);
          const inner = (
            <>
              <span>
                <strong>{label}</strong>
                {multiple && offer.location?.name && <small>{offer.location.name}</small>}
              </span>
              <ArrowRight aria-hidden />
            </>
          );

          if (offer.bookingPath.startsWith("/")) {
            return (
              <Link key={offer.id} to={offer.bookingPath as any} className="public-service-card__action">
                {inner}
              </Link>
            );
          }

          return (
            <a key={offer.id} href={offer.bookingPath} className="public-service-card__action">
              {inner}
            </a>
          );
        })}
      </div>
    </article>
  );
}

function SupportLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to as any} className="public-support-link">
      <div className="public-support-link__icon" aria-hidden>{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      <ArrowRight className="public-support-link__arrow" aria-hidden />
    </Link>
  );
}
