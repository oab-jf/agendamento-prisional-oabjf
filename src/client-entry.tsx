import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

let bootstrapped = false;

export function bootstrapClient() {
  if (bootstrapped) return;

  const rootEl = document.getElementById("root");

  if (!rootEl) {
    throw new Error("Elemento #root não encontrado para inicializar a Central.");
  }

  bootstrapped = true;

  const queryClient = new QueryClient();
  const router = getRouter(queryClient);

  ReactDOM.createRoot(rootEl).render(<RouterProvider router={router} />);
}

