/* "Para quién" (index.html): buscador de ocupaciones centrado en lo que Mi Primer Agente puede hacer.
   Los datos (data/ocupaciones.js, ~550 KB) se cargan solo cuando la sección se acerca a la pantalla o al enfocar el buscador.
   Lógica de búsqueda y etiquetas: buscador.js. Página completa de cada ocupación: ocupaciones.html. */
(function () {
  "use strict";
  var B = window.Buscador, card = document.getElementById("pq-card");
  if (!B || !card) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var NIVEL = { baja: "Baja", media: "Media", alta: "Alta" };
  var MAX_TAREAS = window.matchMedia && matchMedia("(max-width: 560px)").matches ? 2 : 4, EJEMPLO = "2121";
  var D = null, IDX = null, POR = {}, pendiente = null;

  // ---------- carga diferida ----------
  var cargando = false;
  function cargar() {
    if (cargando) return; cargando = true;
    var s = document.createElement("script");
    s.src = "data/ocupaciones.js"; s.async = true;
    s.onload = function () {
      D = window.OCUPACIONES; IDX = B.indexar(D.occ);
      D.occ.forEach(function (o, i) { POR[o.c] = i; });
      card.setAttribute("aria-busy", "false");
      elegir(pendiente || EJEMPLO, false, !pendiente);
      if (q.value.trim() && !pendiente) buscar();
    };
    s.onerror = function () { $("pq-title").textContent = "No pudimos cargar las ocupaciones. Recarga la página."; };
    document.head.appendChild(s);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { cargar(); io.disconnect(); }
    }, { rootMargin: "900px 0px" });
    io.observe(card);
  } else cargar();

  // ---------- búsqueda con autocompletado ----------
  var q = $("pq-q"), list = $("pq-list"), hits = [], active = -1;
  function cerrar() { list.hidden = true; q.setAttribute("aria-expanded", "false"); active = -1; }
  function pintar() {
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.setAttribute("aria-selected", i === active ? "true" : "false");
      if (i === active) q.setAttribute("aria-activedescendant", li.id);
    });
  }
  function buscar() {
    if (!D) { cargar(); return; }
    hits = B.buscar(IDX, q.value, 7);
    list.innerHTML = ""; active = -1;
    if (!q.value.trim()) { cerrar(); return; }
    if (!hits.length) {
      list.innerHTML = '<li class="auto-none">Sin resultados. Prueba con otra palabra o con el código SINCO.</li>';
    } else {
      hits.forEach(function (i, n) {
        var o = D.occ[i], li = document.createElement("li"), k = o.f.filter(function (f) { return f[3].length; }).length;
        li.id = "pq-opt-" + n; li.setAttribute("role", "option");
        li.innerHTML = "<span>" + esc(o.t) + '</span><span class="auto-opt-p">' + (k ? k + " con el agente" : o.c) + "</span>";
        li.addEventListener("mousedown", function (e) { e.preventDefault(); elegir(o.c, true); });
        list.appendChild(li);
      });
    }
    list.hidden = false; q.setAttribute("aria-expanded", "true");
  }
  q.addEventListener("focus", cargar);
  q.addEventListener("input", buscar);
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && hits.length) { active = Math.min(hits.length - 1, active + 1); pintar(); e.preventDefault(); }
    else if (e.key === "ArrowUp" && hits.length) { active = Math.max(0, active - 1); pintar(); e.preventDefault(); }
    else if (e.key === "Enter" && hits.length && D) { elegir(D.occ[hits[Math.max(0, active)]].c, true); e.preventDefault(); }
    else if (e.key === "Escape") cerrar();
  });
  q.addEventListener("blur", function () { setTimeout(cerrar, 120); });
  document.querySelectorAll(".pq-quick button").forEach(function (b) {
    b.addEventListener("click", function () { elegir(b.getAttribute("data-c"), true); });
  });

  // ---------- tarjeta de resultado ----------
  function meter(x) {
    var n = B.nivel(x), k = n === "alta" ? 3 : n === "media" ? 2 : n === "baja" ? 1 : 0;
    return '<span class="px-dots"><i' + (k > 0 ? ' class="on"' : "") + "></i><i" + (k > 1 ? ' class="on"' : "") + "></i><i" + (k > 2 ? ' class="on"' : "") + "></i></span>";
  }

  function elegir(c, delUsuario, esEjemplo) {
    if (!D) { pendiente = c; cargar(); return; }
    var o = D.occ[POR[c]];
    if (!o) return;
    cerrar();
    if (delUsuario) q.value = o.t;
    document.querySelectorAll(".pq-quick button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-c") === c)); });

    var apoya = B.separar(o, "expuestas", "").apoya, caps = B.capacidadesDe(o).map(function (k) { return D.caps[k]; });
    $("pq-code").textContent = "SINCO " + o.c;
    $("pq-tag").hidden = !esEjemplo;
    $("pq-title").textContent = o.t;
    $("pq-n").textContent = o.f.length ? apoya.length : "–";
    $("pq-of").textContent = o.f.length ? "de " + o.f.length : "";
    $("pq-sub").textContent = !o.f.length ? "El catálogo del INEGI no lista funciones para esta ocupación"
      : apoya.length ? "funciones de su catálogo en las que Mi Primer Agente puede ayudarte"
      : "funciones de su catálogo: son de atención directa o de tu criterio, ahí decides tú";
    $("pq-caps").innerHTML = caps.map(function (cp) { return "<li>" + esc(cp.n) + "</li>"; }).join("");
    $("pq-all").href = "ocupaciones.html#sinco=" + o.c;
    card.querySelector("[data-plan]").setAttribute("data-plan", "Mi Primer Agente · " + o.t);

    $("pq-tasks-title").textContent = apoya.length ? "Lo que el agente puede hacer por ti" : "Aquí el agente no sustituye tu trabajo";
    $("pq-tasks").innerHTML = apoya.length
      ? apoya.slice(0, MAX_TAREAS).map(function (f, i) {
          return '<li style="--i:' + i + '"><span class="pq-check" aria-hidden="true"></span><div><p>' + esc(f[1]) + "</p>" +
            '<span class="pq-tag-cap">' + esc(D.caps[f[3][0][0]].n) + "</span>" +
            '<span class="pq-exp">' + meter(f[2]) + "Exposición a la IA: " + (B.nivel(f[2]) || "sin dato") + "</span></div></li>";
        }).join("") + (apoya.length > MAX_TAREAS ? '<li class="pq-rest"><a href="ocupaciones.html#sinco=' + o.c + '">+ ' + (apoya.length - MAX_TAREAS) + " funciones más</a></li>" : "")
      : '<li class="pq-none"><p>Las funciones que el INEGI describe para esta ocupación necesitan tu presencia o tu criterio profesional. Lo que sí te quita tiempo es lo de alrededor, y eso sí lo puede hacer el agente:</p></li>';
    card.classList.toggle("pq-sin", !apoya.length);

    $("pq-p").innerHTML = o.p === null ? "Sin dato" : esc(B.pct(o.p)) + (o.bc ? ' <small title="Emparejamiento de baja confianza">*</small>' : "");
    $("pq-pbar").style.width = o.p === null ? "0" : (o.p * 100) + "%";
    $("pq-pnote").textContent = o.p === null ? "Sin dato de Frey y Osborne para esta ocupación."
      : "Frey y Osborne (2017), para la ocupación completa." + (o.bc ? " * Emparejamiento de baja confianza." : "");
    var nv = B.nivel(o.x);
    $("pq-x").textContent = nv ? NIVEL[nv] : "Sin dato";
    $("pq-xm").innerHTML = meter(o.x);

    card.classList.remove("pq-in"); void card.offsetWidth; card.classList.add("pq-in");   // reinicia la animación
    var tp = card.getBoundingClientRect().top;
    if (delUsuario && (tp < 0 || tp > window.innerHeight * 0.6)) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  window.ParaQuien = { elegir: function (c, u) { elegir(c, u); } };
})();
