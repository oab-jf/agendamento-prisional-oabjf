import type { ComponentType } from "react";
import { useEffect } from "react";
import { useLocation, Link, navigateTo, RedirectError } from "./lib/pages-router-shim";

import { Route as IndexRoute } from "./routes/index";
import { Route as AdminRoute } from "./routes/admin";
import { Route as AdminConviteRoute } from "./routes/admin.convite";

import { Route as AgendarUnidadeRoute } from "./routes/agendar.unidade";
import { Route as AgendarRegrasRoute } from "./routes/agendar.regras";
import { Route as AgendarDataRoute } from "./routes/agendar.data";
import { Route as AgendarHorarioRoute } from "./routes/agendar.horario";
import { Route as AgendarAdvogadoRoute } from "./routes/agendar.advogado";
import { Route as AgendarIplRoute } from "./routes/agendar.ipl";
import { Route as AgendarRevisaoRoute } from "./routes/agendar.revisao";
import { Route as AgendarSucessoRoute } from "./routes/agendar.sucesso";

import { Route as DocumentoUnidadeRoute } from "./routes/documento.unidade";
import { Route as DocumentoAdvogadoRoute } from "./routes/documento.advogado";
import { Route as DocumentoIplRoute } from "./routes/documento.ipl";
import { Route as DocumentoUploadRoute } from "./routes/documento.upload";
import { Route as DocumentoRevisaoRoute } from "./routes/documento.revisao";
import { Route as DocumentoSucessoRoute } from "./routes/documento.sucesso";

import { Route as ConsultarRoute } from "./routes/consultar";
import { Route as GestaoRoute } from "./routes/gestao";

type RouteObject = {
  path?: string;
  component?: ComponentType;
  beforeLoad?: () => unknown;
  options?: { component?: ComponentType; beforeLoad?: () => unknown };
};

function pick(route: RouteObject) {
  const Component = route.component || route.options?.component;
  const beforeLoad = route.beforeLoad || route.options?.beforeLoad;
  return { Component, beforeLoad };
}

const routes = [
  { path: "/", ...pick(IndexRoute as RouteObject) },
  { path: "/admin", ...pick(AdminRoute as RouteObject) },
  { path: "/admin/convite", ...pick(AdminConviteRoute as RouteObject) },
  { path: "/agendar/unidade", ...pick(AgendarUnidadeRoute as RouteObject) },
  { path: "/agendar/regras", ...pick(AgendarRegrasRoute as RouteObject) },
  { path: "/agendar/data", ...pick(AgendarDataRoute as RouteObject) },
  { path: "/agendar/horario", ...pick(AgendarHorarioRoute as RouteObject) },
  { path: "/agendar/advogado", ...pick(AgendarAdvogadoRoute as RouteObject) },
  { path: "/agendar/ipl", ...pick(AgendarIplRoute as RouteObject) },
  { path: "/agendar/revisao", ...pick(AgendarRevisaoRoute as RouteObject) },
  { path: "/agendar/sucesso", ...pick(AgendarSucessoRoute as RouteObject) },
  { path: "/documento/unidade", ...pick(DocumentoUnidadeRoute as RouteObject) },
  { path: "/documento/advogado", ...pick(DocumentoAdvogadoRoute as RouteObject) },
  { path: "/documento/ipl", ...pick(DocumentoIplRoute as RouteObject) },
  { path: "/documento/upload", ...pick(DocumentoUploadRoute as RouteObject) },
  { path: "/documento/revisao", ...pick(DocumentoRevisaoRoute as RouteObject) },
  { path: "/documento/sucesso", ...pick(DocumentoSucessoRoute as RouteObject) },
  { path: "/consultar", ...pick(ConsultarRoute as RouteObject) },
  { path: "/gestao", ...pick(GestaoRoute as RouteObject) },
];

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Voltar para a Central
        </Link>
      </div>
    </main>
  );
}

function RouteRenderer({ match }: { match: (typeof routes)[number] }) {
  const { Component, beforeLoad } = match;

  // Executa beforeLoad para captar redirects.
  let redirectTo: string | null = null;
  if (beforeLoad) {
    try {
      beforeLoad();
    } catch (err) {
      if (err instanceof RedirectError) {
        redirectTo = err.to;
      } else {
        throw err;
      }
    }
  }

  useEffect(() => {
    if (redirectTo) navigateTo(redirectTo, true);
  }, [redirectTo]);

  if (redirectTo) return null;
  if (!Component) return <NotFoundPage />;
  return <Component />;
}

export function PagesRouter() {
  const location = useLocation();
  const pathname = normalizePath(location.pathname);
  const match = routes.find((r) => r.path === pathname);
  if (!match) return <NotFoundPage />;
  return <RouteRenderer key={pathname} match={match} />;
}

