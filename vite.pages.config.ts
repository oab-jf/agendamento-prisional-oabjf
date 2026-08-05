// Standalone Vite SPA config for Cloudflare Pages.
// Build Pages NÃO usa TanStack Router, TanStack Start, Nitro nem routeTree.
// O runtime de produção usa um roteador simples próprio baseado em history API.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { existsSync, renameSync } from "node:fs";

function renamePagesHtmlPlugin() {
  return {
    name: "rename-pages-html-plugin",
    closeBundle() {
      const outDir = path.resolve(process.cwd(), "dist-pages");
      const from = path.join(outDir, "index.pages.html");
      const to = path.join(outDir, "index.html");
      if (existsSync(from)) {
        renameSync(from, to);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), renamePagesHtmlPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@tanstack/react-router": path.resolve(
        process.cwd(),
        "src/lib/pages-router-shim.tsx",
      ),
    },
  },
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        index: path.resolve(process.cwd(), "index.pages.html"),
      },
    },
  },
});

