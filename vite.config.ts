// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Set BUILD_TARGET=pages to produce a static SPA bundle for Cloudflare Pages
// (uses the Node nitro preset only to run the SPA shell prerender locally;
// the generated server files are discarded from the final upload).
const isPagesBuild = process.env.BUILD_TARGET === "pages";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    ...(isPagesBuild
      ? {
          spa: {
            enabled: true,
            maskPath: "/",
            prerender: { outputPath: "/index" },
          },
        }
      : {}),
  },
  ...(isPagesBuild
    ? { nitro: { preset: "node-server" } }
    : {}),
});

