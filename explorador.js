/* Explorador de ocupaciones (ocupaciones.html): interfaz. Datos en data/ocupaciones.js (window.OCUPACIONES) y lógica en buscador.js. */
(function () {
  "use strict";
  var D = window.OCUPACIONES, B = window.Buscador;
  if (!D || !B) return;
  var IDX = B.indexar(D.occ);                      // índice de búsqueda: se arma una sola vez
  var POR_CODIGO = {};
  D.occ.forEach(function (o, i) { POR_CODIGO[o.c] = i; });
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var NIVEL_TXT = { baja: "Baja", media: "Media", alta: "Alta" };
  var MOTIVO_NA = { sin_coincidencia: "No encontramos una ocupación equivalente en EE. UU.", sin_probabilidad_fo: "Su equivalente en EE. UU. no tiene dato de Frey y Osborne." };

  function meter(x) {
    var n = B.nivel(x), k = n === "alta" ? 3 : n === "media" ? 2 : n === "baja" ? 1 : 0;
    return '<span class="px-dots px-' + (n || "na") + '" aria-hidden="true"><i' + (k > 0 ? ' class="on"' : "") + '></i><i' + (k > 1 ? ' class="on"' : "") + '></i><i' + (k > 2 ? ' class="on"' : "") + "></i></span>";
  }

  // ---------- búsqueda con autocompletado ----------
  var q = $("px-q"), list = $("px-list"), hits = [], active = -1;
  function closeList() { list.hidden = true; q.setAttribute("aria-expanded", "false"); active = -1; }
  function paint() {
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.setAttribute("aria-selected", i === active ? "true" : "false");
      if (i === active) { q.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
    });
  }
  q.addEventListener("input", function () {
    hits = B.buscar(IDX, q.value, 8);
    list.innerHTML = ""; active = -1;
    if (!q.value.trim()) { closeList(); return; }
    if (!hits.length) {
      list.innerHTML = '<li class="auto-none">Sin resultados. Prueba con otra palabra o con el código SINCO.</li>';
    } else {
      hits.forEach(function (i, n) {
        var o = D.occ[i], li = document.createElement("li");
        li.id = "px-opt-" + n; li.setAttribute("role", "option");
        li.innerHTML = "<span>" + esc(o.t) + '</span><span class="auto-opt-p">' + o.c + "</span>";
        li.addEventListener("mousedown", function (e) { e.preventDefault(); elegir(o.c); });
        list.appendChild(li);
      });
    }
    list.hidden = false; q.setAttribute("aria-expanded", "true");
  });
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && hits.length) { active = Math.min(hits.length - 1, active + 1); paint(); e.preventDefault(); }
    else if (e.key === "ArrowUp" && hits.length) { active = Math.max(0, active - 1); paint(); e.preventDefault(); }
    else if (e.key === "Enter" && hits.length) { elegir(D.occ[hits[Math.max(0, active)]].c); e.preventDefault(); }
    else if (e.key === "Escape") closeList();
  });
  q.addEventListener("blur", function () { setTimeout(closeList, 120); });
  document.querySelectorAll(".px-quick button").forEach(function (b) {
    b.addEventListener("click", function () { elegir(b.getAttribute("data-c")); });
  });

  // ---------- resultado ----------
  var actual = null;
  function elegir(c, sinScroll) {
    var i = POR_CODIGO[c];
    if (i === undefined) return;
    actual = D.occ[i];
    q.value = actual.t; closeList();
    $("px-f").value = "";
    try { history.replaceState(null, "", "#sinco=" + c); } catch (e) { /* sin historial: no pasa nada */ }
    resumen(actual); funciones();
    $("resultado").hidden = false;
    if (!sinScroll) $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resumen(o) {
    $("px-code").textContent = "SINCO " + o.c;
    $("px-title").textContent = o.t;
    var nf = o.f.length, ns = o.f.filter(function (f) { return f[3].length; }).length;
    var caps = B.capacidadesDe(o).map(function (k) { return D.caps[k]; });
    $("px-n").innerHTML = nf ? ns + ' <small>de ' + nf + "</small>" : "—";
    $("px-caps").innerHTML = caps.length
      ? caps.map(function (c) { return "<li>" + esc(c.n) + "</li>"; }).join("")
      : '<li class="px-none">' + (nf ? "Ninguna del catálogo" : "El catálogo no lista funciones") + "</li>";

    $("px-p").innerHTML = o.p === null ? "Sin dato" : esc(B.pct(o.p)) + (o.bc ? ' <small title="Emparejamiento de baja confianza">*</small>' : "");
    $("px-pbar").style.width = o.p === null ? "0" : (o.p * 100) + "%";
    $("px-pnote").textContent = o.p === null ? (MOTIVO_NA[o.pm] || "Sin dato de Frey y Osborne.")
      : "Frey y Osborne (2017), para la ocupación completa." + (o.bc ? " * Emparejamiento de baja confianza." : "");

    var nv = B.nivel(o.x);
    $("px-x").textContent = nv ? NIVEL_TXT[nv] : "Sin dato";
    $("px-xm").innerHTML = meter(o.x);

    var txt;
    if (caps.length) {
      txt = "<p>En esta ocupación, <strong>Mi Primer Agente</strong> puede ayudarte con: " +
        caps.map(function (c) { return "<strong>" + esc(c.n.toLowerCase()) + "</strong>"; }).join(", ") + ".</p>" +
        '<ul class="px-what">' + caps.map(function (c) { return "<li>" + esc(c.q) + "</li>"; }).join("") + "</ul>";
    } else {
      txt = "<p>Las funciones que el INEGI describe para esta ocupación son de trabajo directo con personas, decisiones profesionales o trabajo físico: ahí el agente no participa. " +
        "Pero la parte administrativa de tu consultorio, despacho o negocio (agenda, recordatorios, correos, cotizaciones, facturas y archivos) sí la puede apoyar.</p>";
    }
    $("px-explain").innerHTML = '<img src="agente.svg" alt="" width="56" height="56"><div>' + txt +
      '<a class="front-link" href="index.html#contacto">Lo vemos en tu diagnóstico sin costo <span aria-hidden="true">→</span></a></div>';
  }

  function item(f, apoya) {
    var nv = B.nivel(f[2]);
    var exp = '<span class="px-exp">' + meter(f[2]) + "Exposición a la IA: <strong>" + (nv ? nv : "sin dato") + "</strong></span>";
    var head = apoya
      ? '<div class="px-fn-tags"><span class="px-badge"><img src="agente.svg" alt="" width="18" height="18">Puede ayudar</span>' +
        f[3].map(function (h) { return '<span class="px-cap" title="Coincide con «' + esc(h[1]) + '»">' + esc(D.caps[h[0]].n) + "</span>"; }).join("") + "</div>"
      : "";
    var motivo = f[4] ? '<span class="px-why">Fuera del alcance: ' + esc(f[4]) + "</span>" : "";
    return '<li class="px-fn' + (apoya ? " px-fn-yes" : "") + '">' + head + "<p>" + esc(f[1]) + "</p>" + exp + motivo + "</li>";
  }

  function funciones() {
    if (!actual) return;
    var g = B.separar(actual, $("px-ord").value, $("px-f").value);
    var vacio = actual.f.length ? "Ninguna coincide con el filtro." : "El catálogo del INEGI no lista funciones para este grupo.";
    $("px-yes").innerHTML = g.apoya.length ? g.apoya.map(function (f) { return item(f, true); }).join("")
      : '<li class="px-empty">' + (actual.f.length && !$("px-f").value ? "Ninguna función del catálogo entra en el alcance del agente." : vacio) + "</li>";
    $("px-no").innerHTML = g.otras.length ? g.otras.map(function (f) { return item(f, false); }).join("") : '<li class="px-empty">' + vacio + "</li>";
    $("px-ny").textContent = "(" + g.apoya.length + ")";
    $("px-nn").textContent = "(" + g.otras.length + ")";
  }
  $("px-f").addEventListener("input", funciones);
  $("px-ord").addEventListener("change", funciones);

  var y = $("year"); if (y) y.textContent = new Date().getFullYear();
  var m = /sinco=(\d{4})/.exec(location.hash);
  if (m) elegir(m[1], true);
})();
