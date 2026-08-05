/**
 * Toaster institucional da Central.
 *
 * IMPORTANTE: NÃO reativar `richColors`. Os estilos institucionais
 * (fundo, borda, sombra, cores por tipo) vivem em `src/styles.css`,
 * seção `[data-sonner-toast]` — para preservar a identidade sépia
 * e evitar o verde/vermelho genéricos do Sonner.
 */
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      closeButton
      duration={4500}
      {...props}
    />
  );
};

export { Toaster };

