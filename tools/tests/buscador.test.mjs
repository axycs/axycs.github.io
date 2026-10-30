// Pruebas de buscador.js con los datos publicados. Uso (desde web/): node --test tools/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const B = require("../../buscador.js");
const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL("../../data/ocupaciones.js", import.meta.url), "utf8"), ctx);
const D = JSON.parse(JSON.stringify(ctx.window.OCUPACIONES)); // mismo "realm" que assert
const IDX = B.indexar(D.occ);
const top = (q) => B.buscar(IDX, q).map((i) => D.occ[i].c);

test("busca por nombre, sin importar acentos, plurales ni mayúsculas", () => {
  assert.equal(top("Nutriólogos")[0], "2433");
  assert.equal(top("nutriologo")[0], "2433");
  assert.equal(top("fisioterapeuta")[0], "2437");
  assert.equal(top("contadores")[0], "2121");
  assert.equal(top("SECRETARIAS")[0], "3111");
});

test("busca por código SINCO (prefijo)", () => {
  assert.deepEqual(top("2121"), ["2121"]);
  assert.ok(top("24").every((c) => c.startsWith("24")));
  assert.deepEqual(top("0000"), []);
});

test("busca por palabras clave: ocupaciones de ejemplo y sinónimos", () => {
  assert.equal(top("agente de seguros")[0], "4222");
  assert.equal(top("contador")[0], "2121");
  assert.equal(top("dentista")[0], "2412");
  assert.ok(top("cirujano dental").includes("2412"));
});

test("búsquedas vacías o sin coincidencia", () => {
  assert.deepEqual(top(""), []);
  assert.deepEqual(top("   "), []);
  assert.deepEqual(top("zzzxxq"), []);
});

test("la búsqueda es rápida con las 490 ocupaciones", () => {
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) B.buscar(IDX, "aux contab");
  assert.ok((performance.now() - t0) / 200 < 5, "más de 5 ms por búsqueda");
});

test("niveles de exposición y formato de porcentaje", () => {
  assert.equal(B.nivel(0), "baja");
  assert.equal(B.nivel(0.3), "baja");
  assert.equal(B.nivel(0.5), "media");
  assert.equal(B.nivel(0.7), "alta");
  assert.equal(B.nivel(1), "alta");
  assert.equal(B.nivel(null), null);
  assert.equal(B.pct(0.004), "<1%");
  assert.equal(B.pct(0.951), "95%");
  assert.equal(B.pct(null), "s/d");
});

test("separar: funciones del agente y el resto, sin perder ninguna", () => {
  const o = D.occ.find((x) => x.c === "3111");
  const g = B.separar(o, "expuestas", "");
  assert.equal(g.apoya.length + g.otras.length, o.f.length);
  assert.ok(g.apoya.every((f) => f[3].length > 0) && g.otras.every((f) => f[3].length === 0));
  const s = g.otras.map((f) => f[2]);
  assert.deepEqual(s, [...s].sort((a, b) => b - a));                 // más expuestas primero
  const cat = B.separar(o, "catalogo", "");
  assert.deepEqual(cat.apoya.map((f) => f[0]), [...cat.apoya.map((f) => f[0])].sort((a, b) => a - b));
  assert.equal(B.separar(o, "expuestas", "fotocopias").otras.length, 1);
});

test("ocupación sin funciones en el catálogo", () => {
  const o = D.occ.find((x) => x.f.length === 0);
  const g = B.separar(o, "expuestas", "");
  assert.equal(g.apoya.length + g.otras.length, 0);
  assert.deepEqual(B.capacidadesDe(o), []);
});

test("capacidadesDe usa solo capacidades definidas", () => {
  for (const o of D.occ) for (const k of B.capacidadesDe(o)) assert.ok(D.caps[k]);
});
