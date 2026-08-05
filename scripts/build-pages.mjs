#!/usr/bin/env node
// Cloudflare Pages / SPA build finalizer.
//
// TanStack Start's built-in SPA prerender relies on a Vite preview server that
// only supports the Node nitro preset — which the Lovable sandbox pins to
// `cloudflare-module`. Instead of fighting that override, we take the client
// bundle that vite already produced and generate a plain `index.html` shell
// that boots the SPA. The SSR/worker outputs and Nitro artifacts are dropped.
//
// Run via `npm run build:pages`.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, cpSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, "dist");
const CLIENT = join(DIST, "client");
const OUT = join(ROOT, "dist-pages");

console.log("• Running vite build (client + ssr + nitro)…");
const build = spawnSync(
  process.execPath,
  [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--app"],
  {
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "pages" },
  },
);
// The build itself succeeds; the SPA prerender step may crash inside the
// sandbox because the preview server expects a Node server bundle. That is
// harmless for us — the client assets are already written to dist/client
// before prerender runs.
if (!existsSync(join(CLIENT, "assets"))) {
  console.error("✗ Build failed: dist/client/assets not found.");
  process.exit(build.status ?? 1);
}

console.log("• Locating client entry chunk & stylesheet…");
const assets = readdirSync(join(CLIENT, "assets"));
const entryJs = assets
  .filter((f) => /^index-[^.]+\.js$/.test(f))
  .sort((a, b) => statSync(join(CLIENT, "assets", b)).size - statSync(join(CLIENT, "assets", a)).size)[0];
if (!entryJs) {
  console.error("✗ Could not find a client entry chunk (assets/index-*.js).");
  process.exit(1);
}
const cssFiles = assets.filter((f) => f.endsWith(".css"));
console.log(`  entry: assets/${entryJs}`);
cssFiles.forEach((f) => console.log(`  css:   assets/${f}`));

const cssLinks = cssFiles
  .map((f) => `    <link rel="stylesheet" crossorigin href="/assets/${f}" />`)
  .join("\n");

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Central de Agendamento Prisional — OAB/JF</title>
    <meta name="description" content="Central de Agendamento Prisional da OAB Juiz de Fora." />
    <meta property="og:title" content="Central de Agendamento Prisional — OAB/JF" />
    <meta property="og:description" content="Sistema de agendamento de atendimentos virtuais e envio de documentos." />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
    />
${cssLinks}
    <script type="module" crossorigin src="/assets/${entryJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

console.log("• Assembling dist-pages/…");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(CLIENT, OUT, { recursive: true });

// Drop internal artefacts.
rmSync(join(OUT, ".vite"), { recursive: true, force: true });

writeFileSync(join(OUT, "index.html"), html, "utf8");

const redirectsPath = join(OUT, "_redirects");
const redirectsContent = "/*    /index.html   200\n";
writeFileSync(redirectsPath, redirectsContent, "utf8");

console.log("\n✔ SPA build ready at dist-pages/");
console.log("  contents:");
for (const f of readdirSync(OUT)) console.log("    " + f);

