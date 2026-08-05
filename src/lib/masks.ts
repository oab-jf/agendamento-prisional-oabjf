/**
 * Máscaras de entrada para campos do protótipo.
 *
 * Cada máscara recebe o valor bruto digitado e retorna o valor formatado.
 * O componente `Field` aplica a máscara em onChange e cuida da posição do cursor.
 */

export type MaskType = "phone" | "oab" | "ipl" | "digits" | "infopen";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/**
 * Aplica a máscara ao valor.
 * - phone:   "(DD) NNNNN-NNNN" (celular) ou "(DD) NNNN-NNNN" (fixo).
 * - oab:     "UF-NNN.NNN" (raramente usada; OAB tem componente próprio).
 * - ipl:     "IPL NNNN/NNNN" — prefixo "IPL " é adicionado automaticamente.
 * - infopen: somente dígitos, até 10.
 * - digits:  somente dígitos, até 10.
 */
export function applyMask(value: string, mask: MaskType): string {
  if (!value) return "";
  switch (mask) {
    case "phone": {
      const d = onlyDigits(value).slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : "";
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10)
        return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    case "oab": {
      // Formato: XX-000.000
      const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const letters = raw.replace(/[^A-Z]/g, "").slice(0, 2);
      const digits = raw.replace(/[^0-9]/g, "").slice(0, 6);
      if (!letters) return "";
      if (!digits) return letters;
      if (digits.length <= 3) return `${letters}-${digits}`;
      return `${letters}-${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    case "ipl": {
      // Formato: 0000/0000 com prefixo "IPL " automático.
      const d = onlyDigits(value).slice(0, 8);
      if (!d) return "";
      if (d.length <= 4) return `IPL ${d}`;
      return `IPL ${d.slice(0, 4)}/${d.slice(4)}`;
    }
    case "infopen":
    case "digits":
      return onlyDigits(value).slice(0, 10);
    default:
      return value;
  }
}

