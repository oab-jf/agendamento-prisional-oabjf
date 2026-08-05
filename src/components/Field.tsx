/**
 * Campo de entrada genérico com suporte a máscara, validação visual e
 * preservação da posição do cursor durante a formatação.
 *
 * Uso típico:
 *   <Field label="Telefone" mask="phone" value={v} onChange={setV} error={msg} required />
 *
 * Erros e dicas:
 * - Se `error` estiver presente, a borda fica vermelha e a mensagem aparece abaixo.
 * - `hint` aparece quando não há erro, para orientações neutras.
 */
import { useId, useRef } from "react";
import { applyMask, type MaskType } from "@/lib/masks";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  /** Mensagem de erro a exibir. Borda fica vermelha quando presente. */
  error?: string;
  /** Dica neutra; suprimida quando há `error`. */
  hint?: string;
  /** Máscara opcional (ver `src/lib/masks.ts`). */
  mask?: MaskType;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal" | "search" | "url" | "none";
  maxLength?: number;
  disabled?: boolean;
  autoComplete?: string;
};

/**
 * Calcula a posição do cursor após reaplicar a máscara, mantendo o cursor
 * logo após o N-ésimo dígito digitado. Sem isso, o cursor "pula" para o fim
 * a cada caractere quando o usuário edita no meio do campo.
 */
function positionAfterDigits(value: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i])) seen += 1;
    if (seen >= digitCount) return i + 1;
  }
  return value.length;
}

export function Field({ label, value, onChange, type = "text", placeholder, required, error, hint, mask, inputMode, maxLength, disabled, autoComplete }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Define o teclado mobile mais adequado quando não for explicitado.
  const computedInputMode =
    inputMode ??
    (mask === "phone" || mask === "digits" || mask === "infopen" || mask === "ipl"
      ? "numeric"
      : type === "tel"
        ? "tel"
        : type === "email"
          ? "email"
          : undefined);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={computedInputMode}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={!!error}
        autoComplete={autoComplete ?? (type === "email" ? "email" : mask === "phone" ? "tel" : undefined)}
        onChange={(e) => {
          const raw = e.target.value;
          // Conta dígitos antes do cursor para reposicioná-lo após a máscara.
          const cursor = e.target.selectionStart ?? raw.length;
          const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
          const next = mask ? applyMask(raw, mask) : raw;
          onChange(next);
          if (mask) {
            // Aguarda o React re-renderizar antes de reposicionar o cursor.
            window.requestAnimationFrame(() => {
              const el = inputRef.current;
              if (el && el === document.activeElement) {
                const nextCursor = positionAfterDigits(next, digitsBeforeCursor);
                el.setSelectionRange(nextCursor, nextCursor);
              }
            });
          }
        }}
        className={
          "h-12 w-full rounded-xl border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground " +
          (error ? "border-destructive" : "border-input")
        }
      />
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

