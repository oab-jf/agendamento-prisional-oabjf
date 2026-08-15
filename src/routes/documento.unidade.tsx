import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Building2, Loader2 } from "lucide-react";
import { MobileShell, PageTitle, StepActions } from "@/components/MobileShell";
import { PublicChoiceCard } from "@/components/PublicChoiceCard";
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
    void carregar();
  }, []);

  return (
    <MobileShell title="Enviar documento" step={{ current: 1, total: 6 }}>
      <PageTitle
        title="Escolha a unidade prisional"
        subtitle="Selecione a unidade que deverá receber o documento."
      />

      {loading && (
        <div className="public-flow-loading public-flow-loading--boxed" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando unidades…
        </div>
      )}

      {!loading && error && (
        <div className="public-inline-alert public-inline-alert--danger" role="alert">
          <AlertTriangle aria-hidden />
          <div>
            <strong>Não foi possível carregar as unidades</strong>
            <p>{error}</p>
            <button onClick={() => void carregar()} className="public-button public-button--secondary">
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="public-choice-stack" role="radiogroup" aria-label="Unidades prisionais">
          {unidades.map((u) => (
            <PublicChoiceCard
              key={u.slug}
              title={u.nome}
              description={u.endereco}
              icon={<Building2 size={18} aria-hidden />}
              selected={doc.unidadeId === u.slug}
              onClick={() => setDoc({ unidadeId: u.slug, unidadeNome: u.nome })}
            />
          ))}
        </div>
      )}

      <StepActions
        next="/documento/advogado"
        nextDisabled={!doc.unidadeId || loading || !!error}
      />
    </MobileShell>
  );
}
