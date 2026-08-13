import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import {
  listarCatalogoAgendamentos,
  type PublicAppointmentCatalog,
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
        "Agendamento virtual com pessoa privada de liberdade nas unidades participantes.",
      order: 10,
      offers: [
        {
          id: "atendimento-prisional-virtual",
          name: "Agendar atendimento virtual",
          description: "Reserve um horário com pessoa privada de liberdade.",
          bookingPath: "/agendar/unidade",
          durationMinutes: 30,
          capacity: 1,
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
  const offers = useMemo(
    () =>
      visibleCatalog.modalities.flatMap((modality) =>
        modality.offers.map((offer) => ({ modality, offer })),
      ),
    [visibleCatalog],
  );

  return (
    <MobileShell>
      <div className="mb-10 md:mb-14">
        <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-blue md:text-xs">
          Serviços para a advocacia
        </div>
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl">
          Central de <em className="font-serif italic text-brand-blue">Agendamentos</em>
        </h1>
        <div className="mt-5 h-px w-16 bg-brand-red" />
        <p className="mt-5 max-w-2xl text-xs leading-relaxed text-clay md:text-lg">
          Escolha o atendimento desejado. Novas modalidades só ficam disponíveis
          quando a OAB/JF conclui e ativa toda a configuração operacional.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 md:gap-5">
        {offers.map(({ modality, offer }, index) => (
          <ActionItem
            key={offer.id}
            number={String(index + 1).padStart(2, "0")}
            to={offer.bookingPath.startsWith("/") ? offer.bookingPath : undefined}
            href={offer.bookingPath.startsWith("/") ? undefined : offer.bookingPath}
            title={offer.name}
            desc={offer.description || modality.description}
            eyebrow={modality.publicName}
          />
        ))}
      </div>

      <section className="mt-10 border-t border-clay/15 pt-7 md:mt-14 md:pt-9">
        <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-blue md:text-xs">
          Atendimento Prisional
        </div>
        <div className="grid gap-3 md:grid-cols-2 md:gap-5">
          <ActionItem
            number="A"
            to="/documento/unidade"
            title="Enviar documento ou procuração"
            desc="Encaminhe documentos para assinatura da pessoa custodiada."
          />
          <ActionItem
            number="B"
            to="/consultar"
            title="Consultar agendamento"
            desc="Acompanhe, cancele ou remarque usando protocolo e e-mail."
          />
        </div>
      </section>

      <div className="mt-6 text-center md:hidden">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-clay transition-colors hover:text-brand-red"
        >
          Acesso administrativo OAB
          <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      </div>
    </MobileShell>
  );
}

function ActionItem({
  number,
  to,
  href,
  title,
  desc,
  eyebrow,
}: {
  number: string;
  to?: string;
  href?: string;
  title: string;
  desc: string;
  eyebrow?: string;
}) {
  const className =
    "group relative flex min-h-[112px] items-start gap-4 border border-clay/15 bg-sand px-5 py-4 transition-colors hover:border-brand-red/40 hover:bg-sand/70 active:bg-sand/50 md:min-h-[210px] md:flex-col md:gap-5 md:px-6 md:py-7";
  const inner = (
    <>
      <div aria-hidden className="absolute left-0 top-0 h-full w-0.5 bg-brand-red" />
      <div className="flex shrink-0 items-baseline gap-2 pt-0.5">
        <span className="font-serif text-2xl leading-none text-brand-blue md:text-3xl">
          {number}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-red md:text-[10px]">
            {eyebrow}
          </div>
        )}
        <div className="font-serif text-lg leading-tight text-ink transition-colors group-hover:text-brand-red md:text-2xl">
          {title}
        </div>
        <div className="mt-1.5 text-sm leading-relaxed text-clay md:text-base">
          {desc}
        </div>
      </div>
      <ArrowUpRight
        className="mt-1 h-4 w-4 shrink-0 text-brand-blue transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-red md:absolute md:right-5 md:top-5 md:h-5 md:w-5"
        strokeWidth={1.5}
      />
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link to={(to || "/") as any} className={className}>
      {inner}
    </Link>
  );
}
