/**
 * Store global do protótipo com persistência assíncrona (debounce).
 *
 * Otimizações:
 * - setBooking/setDoc apenas atualizam estado; persistência no sessionStorage
 *   ocorre via useEffect com debounce (300ms), evitando escrita síncrona por tecla.
 * - value memoizado com useMemo e setters com useCallback para evitar
 *   recriação de referências e re-renderizações em cascata.
 * - resetBooking/resetDoc removem imediatamente do storage.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type BookingDraft = {
  unidadeId?: string;
  unidadeNome?: string;
  data?: string;
  dataLabel?: string;
  horario?: string;
  horarioFim?: string;
  advNome?: string;
  advOab?: string;
  advEmail?: string;
  advTelefone?: string;
  ipl?: string;
  infopen?: string;
  cienciaRegras?: boolean;
  protocolo?: string;
  reagendando?: boolean;
};

export type DocDraft = {
  unidadeId?: string;
  unidadeNome?: string;
  advNome?: string;
  advOab?: string;
  advEmail?: string;
  advTelefone?: string;
  ipl?: string;
  infopen?: string;
  tipoDocumento?: string;
  tipoDocumentoLabel?: string;
  observacoesAdvogado?: string;
  arquivoPrincipalNome?: string;
  arquivoPrincipalUrl?: string;
  arquivoMimeType?: string;
  arquivoTamanhoBytes?: number;
  protocolo?: string;
  solicitacaoId?: string;
  status?: string;
  emailUnidadeEnviado?: boolean;
};

type Ctx = {
  booking: BookingDraft;
  setBooking: (p: Partial<BookingDraft>) => void;
  resetBooking: () => void;
  doc: DocDraft;
  setDoc: (p: Partial<DocDraft>) => void;
  resetDoc: () => void;
};

const PrototypeCtx = createContext<Ctx | null>(null);

const BOOKING_KEY = "bookingDraft";
const DOC_KEY = "docDraft";
const DEBOUNCE_MS = 300;

function readStoredDraft<T>(key: string): T {
  if (typeof window === "undefined") return {} as T;
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

function writeStoredDraft(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function removeStoredDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [booking, setBookingState] = useState<BookingDraft>({});
  const [doc, setDocState] = useState<DocDraft>({});
  const hydratedRef = useRef(false);
  const skipBookingPersistRef = useRef(false);
  const skipDocPersistRef = useRef(false);

  // Hidratação uma vez no cliente.
  useEffect(() => {
    const b = readStoredDraft<BookingDraft>(BOOKING_KEY);
    const d = readStoredDraft<DocDraft>(DOC_KEY);
    skipBookingPersistRef.current = true;
    skipDocPersistRef.current = true;
    setBookingState(b);
    setDocState(d);
    hydratedRef.current = true;
  }, []);

  // Persistência com debounce — booking.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipBookingPersistRef.current) {
      skipBookingPersistRef.current = false;
      return;
    }
    const t = window.setTimeout(() => writeStoredDraft(BOOKING_KEY, booking), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [booking]);

  // Persistência com debounce — doc.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipDocPersistRef.current) {
      skipDocPersistRef.current = false;
      return;
    }
    const t = window.setTimeout(() => writeStoredDraft(DOC_KEY, doc), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [doc]);

  const setBooking = useCallback((p: Partial<BookingDraft>) => {
    setBookingState((s) => ({ ...s, ...p }));
  }, []);

  const resetBooking = useCallback(() => {
    skipBookingPersistRef.current = true;
    removeStoredDraft(BOOKING_KEY);
    setBookingState({});
  }, []);

  const setDoc = useCallback((p: Partial<DocDraft>) => {
    setDocState((s) => ({ ...s, ...p }));
  }, []);

  const resetDoc = useCallback(() => {
    skipDocPersistRef.current = true;
    removeStoredDraft(DOC_KEY);
    setDocState({});
  }, []);

  const value = useMemo<Ctx>(
    () => ({ booking, setBooking, resetBooking, doc, setDoc, resetDoc }),
    [booking, setBooking, resetBooking, doc, setDoc, resetDoc],
  );

  return <PrototypeCtx.Provider value={value}>{children}</PrototypeCtx.Provider>;
}

export function usePrototype() {
  const ctx = useContext(PrototypeCtx);
  if (!ctx) throw new Error("usePrototype deve ser usado dentro de PrototypeProvider");
  return ctx;
}

