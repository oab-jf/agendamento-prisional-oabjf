import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { PrototypeProvider } from "./lib/prototype-store";
import { PagesRouter } from "./pages-router";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Elemento #root não encontrado para inicializar a Central.");
}

const queryClient = new QueryClient();

ReactDOM.createRoot(rootEl).render(
  <QueryClientProvider client={queryClient}>
    <PrototypeProvider>
      <PagesRouter />
      <Toaster />
    </PrototypeProvider>
  </QueryClientProvider>,
);

