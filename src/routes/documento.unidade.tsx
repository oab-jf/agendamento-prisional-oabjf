import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Check, AlertTriangle, Loader2 } from "lucide-react";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { listarUnidades, type Unidade } from "@/lib/oab-api";
import { usePrototype } from "@/lib/prototype-store";

export const Route = createFileRoute("/documento/unidade")({
  component: Page,
});

function Page() {
  const { doc, setDoc } = usePrototype();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setError(null);
    try {
      const lista = await listarUnidades();
      setUnidades(lista);
    } catch (e) {
      console.error(e);
      setError("Não foi possível carregar as unidades. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <MobileShell title="Enviar documento" step={{ current: 1, total: 6 }} back="/">
      <PageTitle
        title="Escolha a unidade prisional"
        subtitle="Selecione a unidade que deverá receber o documento."
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando unidades…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm leading-relaxed text-foreground">{error}</p>
          </div>
          <button
            onClick={carregar}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink text-sm font-medium uppercase tracking-[0.15em] text-paper hover:bg-brand-blue"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-3">
          {unidades.map((u) => {
            const selected = doc.unidadeId === u.slug;
            return (
              <button
                key={u.slug}
                type="button"
                onClick={() => setDoc({ unidadeId: u.slug, unidadeNome: u.nome })}
                className={
                  "flex items-start gap-4 rounded-2xl border p-4 text-left transition-colors " +
                  (selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-input bg-card hover:bg-muted/40")
                }
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-tight text-foreground">{u.nome}</div>
                  {u.endereco && <div className="mt-1 text-xs text-muted-foreground">{u.endereco}</div>}
                </div>
                {selected && <Check className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      <StepActions
        back="/"
        next="/documento/advogado"
        nextDisabled={!doc.unidadeId || loading || !!error}
      />
    </MobileShell>
  );
}

