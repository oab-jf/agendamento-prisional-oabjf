import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../source/http-functions.js", import.meta.url),
  "utf8",
);

function functionBody(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} deve existir`);
  const next = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("datas prisionais usam lotes concorrentes em vez de validar datas serialmente", () => {
  const body = functionBody("carregarDatasNormalizadas");
  assert.match(body, /TAMANHO_LOTE_DATAS\s*=\s*4/);
  assert.match(body, /Promise\.all\s*\(/);
  assert.doesNotMatch(body, /await\s+chamarListarDatasDisponiveis\s*\(/);
});

test("cliente público deduplica requisições idênticas ainda em voo", async () => {
  const client = await readFile(
    new URL("../../src/lib/oab-api.ts", import.meta.url),
    "utf8",
  );
  assert.match(client, /const inFlightCache = new Map/);
  assert.match(client, /if \(pending\) return pending/);
  assert.match(client, /inFlightCache\.set\(key, request\)/);
});
