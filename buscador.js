/* Lógica pura del explorador de ocupaciones: normalización, búsqueda y etiquetas.
   Sin DOM, para usarla en la página (window.Buscador) y en las pruebas de Node (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Buscador = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var STOP = { de: 1, del: 1, la: 1, las: 1, el: 1, los: 1, y: 1, e: 1, en: 1, a: 1, por: 1, para: 1, con: 1, o: 1, u: 1 };

  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  // Raíz sencilla: "nutriólogos" y "nutriologo" -> "nutriolog"
  function stem(w) { return w.length > 4 ? w.replace(/(es|as|os|a|o|s)$/, "") : w; }
  function palabras(s) { return norm(s).split(/[^a-z0-9]+/).filter(Boolean); }
  function tokens(s) {
    return palabras(s).filter(function (w) { return !STOP[w]; }).map(stem);
  }

  // Se construye una sola vez al cargar la página. t/k: raíces; tc/kc: palabras completas (para la palabra que se está escribiendo)
  function indexar(occ) {
    return occ.map(function (o, i) {
      var k = (o.k || []).join(" ");
      return { i: i, c: o.c, t: tokens(o.t), k: tokens(k), tc: palabras(o.t), kc: palabras(k), len: o.t.length };
    });
  }

  function prefijo(lista, q) {
    var best = 0;
    for (var j = 0; j < lista.length; j++) {
      if (lista[j] === q) return 2;
      if (lista[j].indexOf(q) === 0) best = 1;
    }
    return best;
  }

  /* Devuelve índices de ocupaciones ordenados por relevancia.
     Código: prefijo del código SINCO. Texto: cada palabra debe empezar alguna palabra del título o de las palabras clave
     (ocupaciones de ejemplo del INEGI y sinónimos); pesa más el título.
     La última palabra puede estar a medias mientras se escribe ("auditore", "con", "c"): también se compara completa,
     sin raíz, y si es una palabra vacía ("de") no es obligatoria. */
  function buscar(idx, q, limite) {
    limite = limite || 8;
    var raw = String(q || "");
    q = raw.trim();
    if (!q) return [];
    if (/^\d{1,4}$/.test(q)) {
      return idx.filter(function (e) { return e.c.indexOf(q) === 0; }).slice(0, limite).map(function (e) { return e.i; });
    }
    var ps = palabras(q), escribiendo = /[a-z0-9]$/i.test(norm(raw)) ? ps.pop() : null;
    var qs = ps.filter(function (w) { return !STOP[w]; }).map(stem);
    if (!qs.length && !escribiendo) return [];
    var res = [];
    for (var n = 0; n < idx.length; n++) {
      var e = idx[n], score = 0, ok = true;
      for (var j = 0; j < qs.length; j++) {
        var mt = prefijo(e.t, qs[j]), mk = mt ? 0 : prefijo(e.k, qs[j]);
        if (!mt && !mk) { ok = false; break; }
        score += mt ? 3 + mt : mk;
      }
      if (!ok) continue;
      var primera = qs[0];
      if (escribiendo) {
        var st = stem(escribiendo), lt = prefijo(e.t, st) || prefijo(e.tc, escribiendo);
        var lk = lt ? 0 : prefijo(e.k, st) || prefijo(e.kc, escribiendo);
        if (lt || lk) score += lt ? 3 + lt : lk;
        else if (!STOP[escribiendo] || !qs.length) continue;
        if (!primera) primera = lt || lk ? escribiendo : null;
      }
      if (primera && e.tc[0] && e.tc[0].indexOf(primera) === 0) score += 2;
      res.push([score, e.len, e.i]);
    }
    res.sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    return res.slice(0, limite).map(function (r) { return r[2]; });
  }

  // Exposición a la IA (0 a 1, más alto = más expuesta): tres niveles para leerla sin números
  function nivel(x) {
    if (x === null || x === undefined || isNaN(x)) return null;
    return x < 1 / 3 ? "baja" : x < 2 / 3 ? "media" : "alta";
  }
  function pct(p) {
    if (p === null || p === undefined) return "s/d";
    var v = p * 100;
    return v > 0 && v < 1 ? "<1%" : Math.round(v) + "%";
  }

  /* Funciones de una ocupación separadas en las que Mi Primer Agente puede apoyar y el resto.
     orden: "expuestas" (más expuestas a la IA primero; sin dato al final) o "catalogo" (orden del INEGI). */
  function separar(o, orden, filtro) {
    var fq = tokens(filtro || "");
    var fs = o.f.filter(function (f) {
      if (!fq.length) return true;
      var ft = tokens(f[1]);
      return fq.every(function (q) { return prefijo(ft, q); });
    });
    if (orden !== "catalogo") {
      fs = fs.slice().sort(function (a, b) {
        var x = a[2] === null ? -1 : a[2], y = b[2] === null ? -1 : b[2];
        return y - x || a[0] - b[0];
      });
    }
    return {
      apoya: fs.filter(function (f) { return f[3].length > 0; }),
      otras: fs.filter(function (f) { return f[3].length === 0; })
    };
  }

  // Capacidades distintas que aparecen en una ocupación, en el orden de capacidades.json
  function capacidadesDe(o) {
    var seen = {};
    o.f.forEach(function (f) { f[3].forEach(function (h) { seen[h[0]] = 1; }); });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  return { norm: norm, tokens: tokens, indexar: indexar, buscar: buscar, nivel: nivel, pct: pct, separar: separar, capacidadesDe: capacidadesDe };
});
