/**
 * Helpers de protótipo: geram dados fictícios e renderizam o botão
 * "Auto-preencher" usado em telas de formulário longo.
 */
import { Sparkles } from "lucide-react";

const MOCK_NOMES = [
  "Maria de Oliveira Souza",
  "João Pedro Almeida",
  "Ana Carolina Ribeiro",
  "Rafael Santos Tavares",
  "Beatriz Mendes Coutinho",
  "Carlos Eduardo Lima",
];
const MOCK_UFS = ["MG", "RJ", "SP", "ES"];

export function gerarMockAdvogado() {
  const nome = MOCK_NOMES[Math.floor(Math.random() * MOCK_NOMES.length)];
  const uf = MOCK_UFS[Math.floor(Math.random() * MOCK_UFS.length)];
  const numero = String(Math.floor(80000 + Math.random() * 120000));
  const primeiro = nome.split(" ")[0].toLowerCase();
  const dd = ["32", "31", "21", "11"][Math.floor(Math.random() * 4)];
  const tel = `(${dd}) 9${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}`;
  return {
    advNome: nome,
    advOab: `${uf}${numero}`,
    advEmail: `${primeiro}.adv@exemplo.com`,
    advTelefone: tel,
  };
}

export function gerarMockIpl() {
  const ipl = `${String(Math.floor(100 + Math.random() * 8999)).padStart(4, "0")}/${2024 + Math.floor(Math.random() * 2)}`;
  const infopen = String(Math.floor(1000000 + Math.random() * 8999999));
  return { ipl, infopen };
}

export function MockFillBanner({
  onFill,
  hint = "Preencha com dados fictícios para testar.",
}: {
  onFill: () => void;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border border-dashed border-brand-blue/40 bg-brand-blue/5 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-brand-blue">
          Modo protótipo
        </div>
        <div className="text-[11px] leading-snug text-clay">{hint}</div>
      </div>
      <button
        type="button"
        onClick={onFill}
        className="inline-flex shrink-0 items-center gap-1.5 border border-brand-blue/40 bg-paper px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-brand-blue transition-colors hover:bg-brand-blue hover:text-paper"
      >
        <Sparkles className="h-3 w-3" strokeWidth={1.5} />
        Auto-preencher
      </button>
    </div>
  );
}

