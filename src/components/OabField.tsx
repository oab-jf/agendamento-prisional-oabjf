/**
 * Campo composto de OAB: UF (2 letras) + número (até 7 dígitos).
 *
 * Comportamento:
 * - UF é forçada para CAIXA ALTA e aceita apenas letras (A–Z).
 * - Ao digitar a 2ª letra, o foco move automaticamente para o número
 *   e o teclado mobile vira numérico.
 * - Backspace no número vazio devolve o foco para a UF.
 *
 * Valor externo:
 * - Armazenado/serializado como "UF-NUMERO" (ex.: "MG-123456").
 * - O componente recebe esse formato em `value` e chama `onChange` com ele.
 */
import { useId, useRef } from "react";

type Props = {
  label?: string;
  /** Formato combinado "UF-NÚMERO". */
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
  /** Mensagem de erro; quando presente, ambas as bordas ficam vermelhas. */
  error?: string;
};

/** Quebra o valor combinado em partes UF e número, sanitizando o conteúdo. */
function parse(v: string): { uf: string; num: string } {
  if (!v) return { uf: "", num: "" };
  const uf = (v.match(/[A-Za-z]{1,2}/)?.[0] ?? "").toUpperCase().slice(0, 2);
  return { uf, num: v.replace(/\D/g, "").slice(0, 7) };
}

/** Recombina UF e número no formato persistido. */
function format(uf: string, num: string): string {
  if (!uf && !num) return "";
  if (!num) return uf;
  return `${uf}-${num}`;
}

export function OabField({ label = "Número da OAB", value, onChange, required, hint, error }: Props) {
  const ufId = useId();
  const numId = useId();
  const numRef = useRef<HTMLInputElement>(null);
  const { uf, num } = parse(value);

  const borderCls = error ? "border-destructive" : "border-input";

  return (
    <div>
      <label htmlFor={ufId} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <div className="flex gap-2">
        {/* Campo UF: 2 letras, maiúsculo automático. */}
        <input
          id={ufId}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={2}
          value={uf}
          placeholder="UF"
          aria-label="UF da OAB"
          aria-invalid={!!error}
          onChange={(e) => {
            const next = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
            onChange(format(next, num));
            // Ao completar a UF, foca o número automaticamente.
            if (next.length === 2) {
              window.setTimeout(() => numRef.current?.focus(), 0);
            }
          }}
          className={`h-12 w-20 rounded-xl border bg-background px-3 text-center text-base font-semibold uppercase tracking-wider text-foreground placeholder:font-normal placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary ${borderCls}`}
        />
        {/* Campo número: até 7 dígitos, teclado numérico no mobile. */}
        <input
          id={numId}
          ref={numRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={7}
          value={num}
          placeholder="000000"
          aria-label="Número da OAB"
          aria-invalid={!!error}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 7);
            onChange(format(uf, next));
          }}
          onKeyDown={(e) => {
            // Backspace no início devolve o foco para a UF — UX esperada de campos compostos.
            if (e.key === "Backspace" && num === "") {
              const el = document.getElementById(ufId) as HTMLInputElement | null;
              el?.focus();
            }
          }}
          className={`h-12 flex-1 rounded-xl border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary ${borderCls}`}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

