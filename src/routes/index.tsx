import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <MobileShell>
      <div className="mb-10 md:mb-14">
        <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-blue md:text-xs">
          Atendimento institucional
        </div>
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl">
          Central de <em className="font-serif italic text-brand-blue">Agendamento</em> Prisional
        </h1>
        <div className="mt-5 h-px w-16 bg-brand-red" />
        <p className="mt-5 max-w-2xl text-xs leading-relaxed text-clay md:text-lg">
          Sistema destinado à advocacia para solicitações junto às unidades
          prisionais participantes da 4ª Subseção da OAB/MG.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 md:gap-5">
        <ActionItem
          number="01"
          to="/agendar/unidade"
          title="Agendar atendimento virtual"
          desc="Reserve um horário com pessoa privada de liberdade."
        />
        <ActionItem
          number="02"
          to="/documento/unidade"
          title="Enviar documento ou procuração"
          desc="Encaminhe formulários, procurações ou documentos para assinatura da pessoa custodiada."
        />
        <ActionItem
          number="03"
          to="/consultar"
          title="Consultar agendamento"
          desc="Acompanhe um agendamento usando protocolo e e-mail."
        />
      </div>


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
}: {
  number: string;
  to?: string;
  href?: string;
  title: string;
  desc: string;
}) {
  const className =
    "group relative flex min-h-[100px] items-start gap-4 border border-clay/15 bg-sand px-5 py-4 transition-colors hover:border-brand-red/40 hover:bg-sand/70 active:bg-sand/50 md:min-h-[200px] md:flex-col md:gap-5 md:px-6 md:py-7";
  const inner = (
    <>
      <div aria-hidden className="absolute left-0 top-0 h-full w-0.5 bg-brand-red" />
      <div className="flex shrink-0 items-baseline gap-2 pt-0.5">
        <span className="font-serif text-2xl leading-none text-brand-blue md:text-3xl">
          {number}
        </span>
      </div>
      <div className="min-w-0 flex-1">
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
    <Link to={to as any} className={className}>
      {inner}
    </Link>
  );
}

