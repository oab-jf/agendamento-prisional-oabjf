/**
 * Validadores de entrada com mensagens amigáveis em PT-BR.
 *
 * Convenção:
 * - `isValid*` retorna boolean — útil para condicionais.
 * - `*Error` retorna a mensagem de erro (string) ou `undefined` quando válido —
 *   usado nos formulários para exibir a mensagem inline e nos toasts.
 *
 * Os formulários consomem `*Error` em conjunto com um estado `attempted`:
 * a mensagem só aparece após o usuário tentar avançar pela primeira vez,
 * evitando poluição visual enquanto ele ainda está digitando.
 */

/** Remove tudo que não for dígito. Aceita undefined sem quebrar. */
export function digitsOnly(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

/** Valida e-mail no formato `local@dominio.tld` (mínimo 2 chars no TLD). */
export function isValidEmail(value?: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value ?? "").trim());
}

/** Telefone BR: 10 dígitos (fixo com DDD) ou 11 (celular com DDD). */
export function isValidPhone(value?: string) {
  const digits = digitsOnly(value);
  return digits.length === 10 || digits.length === 11;
}

/**
 * OAB: precisa ter UF (2 letras) e pelo menos 4 dígitos no número de inscrição.
 * O componente `OabField` já garante formato; aqui validamos o conteúdo.
 */
export function isValidOab(value?: string) {
  const uf = value?.match(/[A-Za-z]{2}/)?.[0];
  const digits = digitsOnly(value);
  return !!uf && digits.length >= 4;
}

/** IPL com máscara `IPL NNNN/NNNN` — exige exatamente 8 dígitos. */
export function isValidIpl(value?: string) {
  return digitsOnly(value).length === 8;
}

/** Nome completo: pelo menos 3 caracteres e um espaço (nome + sobrenome). */
export function isValidNome(value?: string) {
  const v = (value ?? "").trim();
  return v.length >= 3 && /\s/.test(v);
}

// --------------------------------------------------------------------------
// Helpers de mensagem — retornam string com erro ou undefined quando válido.
// --------------------------------------------------------------------------

export function nomeError(v?: string) {
  if (!v?.trim()) return "Informe seu nome completo.";
  if (!isValidNome(v)) return "Digite o nome e o sobrenome.";
  return undefined;
}

export function emailError(v?: string) {
  if (!v?.trim()) return "Informe um e-mail.";
  if (!isValidEmail(v)) return "Digite um e-mail válido (ex.: nome@dominio.com).";
  return undefined;
}

export function phoneError(v?: string) {
  if (!v?.trim()) return "Informe um telefone.";
  if (!isValidPhone(v)) return "Telefone incompleto. Use DDD + número.";
  return undefined;
}

export function oabError(v?: string) {
  const uf = v?.match(/[A-Za-z]{2}/)?.[0];
  const d = digitsOnly(v);
  if (!uf && !d) return "Informe sua OAB (UF + número).";
  if (!uf) return "Informe a UF da OAB.";
  if (d.length < 4) return "Número da OAB incompleto.";
  return undefined;
}

export function iplError(v?: string) {
  if (!v?.trim()) return "Informe o número da IPL.";
  if (!isValidIpl(v)) return "IPL incompleta. Use o formato 0000/0000.";
  return undefined;
}

/** Nome da IPL: campo textual livre, obrigatório, mínimo 3 caracteres. */
export function nomeIplError(v?: string) {
  const t = (v ?? "").trim();
  if (!t) return "Informe o nome da IPL.";
  if (t.length < 3) return "Informe o nome da IPL.";
  return undefined;
}

/** INFOPEN é opcional: só valida tamanho mínimo se o usuário preencheu algo. */
export function infopenError(v?: string) {
  if (!v) return undefined;
  const d = digitsOnly(v);
  if (d.length < 5) return "INFOPEN deve ter pelo menos 5 dígitos.";
  return undefined;
}

