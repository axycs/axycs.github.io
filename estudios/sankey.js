(function () {
  var D = window.SINCO_ONET;
  var svg = document.getElementById("sk-svg");
  if (!D || !svg) return;
  var NS = "http://www.w3.org/2000/svg";

  // Cifras del resumen (salen del script de exportación, no se escriben a mano)
  var R = D.resumen;
  R.coincide_pct = Math.round(R.top1_coincide_e5 / R.grupos_unitarios * 100) + "%";
  document.querySelectorAll("[data-k]").forEach(function (el) {
    var v = R[el.getAttribute("data-k")];
    if (v !== undefined) el.textContent = typeof v === "number" ? v.toLocaleString("es-MX") : v;
  });
  document.getElementById("year").textContent = new Date().getFullYear();

  // Rampa secuencial de un solo tono (turquesa claro -> profundo)
  var STOPS = [[0, [191, 230, 229]], [0.25, [159, 222, 221]], [0.5, [79, 191, 194]], [0.75, [31, 143, 151]], [1, [11, 74, 90]]];
  var NA = "#c9d3d6";
  function color(p) {
    if (p === null || p === undefined) return NA;
    for (var i = 1; i < STOPS.length; i++) {
      if (p <= STOPS[i][0]) {
        var a = STOPS[i - 1], b = STOPS[i], t = (p - a[0]) / (b[0] - a[0]);
        return "rgb(" + a[1].map(function (v, k) { return Math.round(v + (b[1][k] - v) * t); }).join(",") + ")";
      }
    }
    return "rgb(11,74,90)";
  }
  document.querySelector(".sk-ramp").style.background =
    "linear-gradient(90deg," + STOPS.map(function (s) { return color(s[0]) + " " + s[0] * 100 + "%"; }).join(",") + ")";

  function pct(p) { return p === null || p === undefined ? "sin dato" : (p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%"); }
  function pctH(p) { return esc(pct(p)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function norm(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function cut(s, n) { return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
  var STATUS = { ok: "", baja_confianza: "Emparejamiento de baja confianza", sin_coincidencia: "Sin coincidencia: queda sin probabilidad" };

  var bySinco = {};
  D.sinco.forEach(function (s) { bySinco[s.c] = s; });

  // Selector de grupo principal, agrupado por división
  var sel = document.getElementById("sk-grupo");
  Object.keys(D.divisiones).forEach(function (dv) {
    var og = document.createElement("optgroup");
    og.label = dv + ". " + D.divisiones[dv];
    Object.keys(D.grupos).filter(function (g) { return g[0] === dv; }).forEach(function (g) {
      var o = document.createElement("option");
      o.value = g; o.textContent = g + " · " + D.grupos[g];
      og.appendChild(o);
    });
    sel.appendChild(og);
  });

  // Tooltip
  var card = document.querySelector(".sk-card");
  var tip = document.getElementById("sk-tip");
  function showTip(evt, html) {
    tip.innerHTML = html; tip.hidden = false;
    var b = card.getBoundingClientRect();
    var x = Math.min(Math.max(evt.clientX - b.left - tip.offsetWidth / 2, 0), b.width - tip.offsetWidth);
    tip.style.left = x + "px";
    tip.style.top = (evt.clientY - b.top - tip.offsetHeight - 14) + "px";
  }
  function hideTip() { tip.hidden = true; }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var current = null, selected = null;

  function draw(g, focus) {
    current = g;
    sel.value = g;
    while (svg.lastChild && svg.lastChild.nodeName !== "title") svg.removeChild(svg.lastChild);

    // Nodos izquierdos: grupos unitarios, de mayor a menor probabilidad
    var left = D.sinco.filter(function (s) { return s.g === g; }).sort(function (a, b) {
      return (b.p === null ? -1 : b.p) - (a.p === null ? -1 : a.p) || a.c.localeCompare(b.c);
    });
    var li = {};
    left.forEach(function (s, i) { li[s.c] = i; });

    // Nodos derechos: O*NET, ordenados por el baricentro de sus fuentes (menos cruces)
    var rightMap = {};
    left.forEach(function (s) {
      s.l.forEach(function (l) {
        var r = rightMap[l.o] || (rightMap[l.o] = { o: l.o, v: 0, bc: 0, links: [] });
        r.v += l.w; r.bc += l.w * li[s.c];
      });
    });
    var right = Object.keys(rightMap).map(function (k) { var r = rightMap[k]; r.bc /= r.v; return r; })
      .sort(function (a, b) { return a.bc - b.bc; });

    var W = 900, LW = 290, RW = 290, NW = 12, GAP = 5, MIN = 14;
    var H = Math.max(260, left.length * 26, right.length * (MIN + 1));
    var totL = left.length, totR = right.reduce(function (a, r) { return a + r.v; }, 0);
    var k = Math.min((H - GAP * (left.length - 1)) / totL, (H - GAP * (right.length - 1)) / totR);
    svg.setAttribute("viewBox", "0 0 " + W + " " + (H + 28));
    svg.style.minWidth = "720px";

    var x0 = LW, x1 = W - RW - NW;
    function stack(nodes, val) {
      var used = nodes.reduce(function (a, nd) { return a + val(nd) * k; }, 0) + GAP * (nodes.length - 1);
      var y = 10 + (H - used) / 2;
      nodes.forEach(function (nd) { nd.y = y; nd.h = Math.max(2, val(nd) * k); y += nd.h + GAP; });
    }
    var L = left.map(function (s) { return { s: s }; });
    stack(L, function () { return 1; });
    stack(right, function (r) { return r.v; });
    var R2 = {};
    right.forEach(function (r) { R2[r.o] = r; r.off = 0; });

    // Flujos: se apilan dentro de cada nodo siguiendo el orden del otro extremo
    var gLinks = el("g", { "class": "sk-links" }, svg);
    var flows = [];
    L.forEach(function (nd) {
      nd.off = 0;
      nd.s.l.slice().sort(function (a, b) { return R2[a.o].y - R2[b.o].y; }).forEach(function (l) {
        flows.push({ src: nd, dst: R2[l.o], l: l, ys: nd.y + nd.off });
        nd.off += l.w * k;
      });
    });
    flows.sort(function (a, b) { return a.src.y - b.src.y; }).forEach(function (f) {
      f.yd = f.dst.y + f.dst.off; f.dst.off += f.l.w * k;
    });
    flows.forEach(function (f) {
      var h = f.l.w * k, xa = x0 + NW, xb = x1, xm = (xa + xb) / 2;
      var d = "M" + xa + "," + f.ys + "C" + xm + "," + f.ys + " " + xm + "," + f.yd + " " + xb + "," + f.yd +
        "L" + xb + "," + (f.yd + h) + "C" + xm + "," + (f.yd + h) + " " + xm + "," + (f.ys + h) + " " + xa + "," + (f.ys + h) + "Z";
      var o = D.onet[f.l.o];
      var p = el("path", { d: d, fill: color(o.p), "class": "sk-flow" }, gLinks);
      p.dataset.src = f.src.s.c; p.dataset.dst = f.l.o;
      p.addEventListener("mousemove", function (e) {
        showTip(e, "<strong>" + esc(f.src.s.t) + "</strong> → <strong>" + esc(o.t) + "</strong><br>Peso " + Math.round(f.l.w * 100) +
          "% · similitud " + f.l.s.toFixed(2) + " · prob. O*NET " + pctH(o.p));
      });
      p.addEventListener("mouseleave", hideTip);
      p.addEventListener("click", function () { pick(f.src.s.c); });
    });

    // Etiquetas: separación mínima MIN; si se mueven, una línea guía las une a su nodo
    function spread(nodes) {
      nodes.forEach(function (nd) { nd.ly = nd.y + nd.h / 2; });
      for (var i = 1; i < nodes.length; i++) nodes[i].ly = Math.max(nodes[i].ly, nodes[i - 1].ly + MIN);
      var bottom = H + 14;
      if (nodes.length && nodes[nodes.length - 1].ly > bottom) nodes[nodes.length - 1].ly = bottom;
      for (var k2 = nodes.length - 2; k2 >= 0; k2--) nodes[k2].ly = Math.min(nodes[k2].ly, nodes[k2 + 1].ly - MIN);
    }
    spread(L); spread(right);
    function guide(g, xa, xb, ya, yb) {
      if (Math.abs(ya - yb) > 1.5) el("path", { d: "M" + xa + "," + ya + "L" + xb + "," + yb, "class": "sk-guide" }, g);
    }

    // Nodos y etiquetas
    var gNodes = el("g", { "class": "sk-nodes" }, svg);
    L.forEach(function (nd) {
      var s = nd.s;
      var gg = el("g", { "class": "sk-node sk-left", tabindex: 0, role: "button", "aria-label": s.t + ", " + pct(s.p) }, gNodes);
      gg.dataset.c = s.c;
      el("rect", { x: x0, y: nd.y, width: NW, height: nd.h, rx: 2, fill: color(s.p) }, gg);
      guide(gg, x0 - 2, x0 - 6, nd.y + nd.h / 2, nd.ly);
      var t = el("text", { x: x0 - 8, y: nd.ly, "text-anchor": "end", "dominant-baseline": "middle" }, gg);
      t.textContent = cut(s.t, 38) + (s.st !== "ok" ? " *" : "");
      var tv = el("tspan", { "class": "sk-val", dx: 6 }, t);
      tv.textContent = pct(s.p);
      gg.addEventListener("mouseenter", function () { hl(s.c, null); });
      gg.addEventListener("mouseleave", function () { hl(null, null); });
      gg.addEventListener("click", function () { pick(s.c); });
      gg.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(s.c); } });
    });
    right.forEach(function (r) {
      var o = D.onet[r.o];
      var gg = el("g", { "class": "sk-node sk-right" }, gNodes);
      el("rect", { x: x1, y: r.y, width: NW, height: r.h, rx: 2, fill: color(o.p) }, gg);
      guide(gg, x1 + NW + 2, x1 + NW + 6, r.y + r.h / 2, r.ly);
      var t = el("text", { x: x1 + NW + 8, y: r.ly, "dominant-baseline": "middle" }, gg);
      t.textContent = cut(o.t, 36);
      var tv = el("tspan", { "class": "sk-val", dx: 6 }, t);
      tv.textContent = pct(o.p);
      gg.addEventListener("mouseenter", function (e) { hl(null, r.o); });
      gg.addEventListener("mousemove", function (e) { showTip(e, "<strong>" + esc(o.t) + "</strong> (" + r.o + ")<br>Probabilidad de automatización: " + pctH(o.p)); });
      gg.addEventListener("mouseleave", function () { hl(null, null); hideTip(); });
    });

    table(left);
    pick(focus && bySinco[focus] && bySinco[focus].g === g ? focus : left[0].c);
  }

  // Resalta los flujos de un nodo; el seleccionado queda resaltado al soltar
  function hl(src, dst) {
    var any = src || dst || selected;
    svg.querySelectorAll(".sk-flow").forEach(function (p) {
      var on = src ? p.dataset.src === src : dst ? p.dataset.dst === dst : p.dataset.src === selected;
      p.classList.toggle("on", !!any && on);
      p.classList.toggle("off", !!any && !on);
    });
  }

  var detail = document.getElementById("sk-detail");
  function pick(c) {
    selected = c;
    var s = bySinco[c];
    svg.querySelectorAll(".sk-left").forEach(function (g) { g.classList.toggle("sel", g.dataset.c === c); });
    hl(null, null);
    var rows = s.l.map(function (l) {
      var o = D.onet[l.o];
      return '<li><span class="sk-sw" style="background:' + color(o.p) + '"></span><span><strong>' + esc(o.t) + "</strong><br>" +
        "Peso " + Math.round(l.w * 100) + "% · similitud " + l.s.toFixed(2) + " · prob. " + pctH(o.p) + "</span></li>";
    }).join("");
    detail.innerHTML =
      '<span class="front-num">SINCO ' + s.c + "</span>" +
      "<h4>" + esc(s.t) + "</h4>" +
      '<p class="sk-big">' + pctH(s.p) + "</p>" +
      '<p class="sk-cap">Probabilidad de automatización (Frey y Osborne), promedio ponderado de sus 2 candidatos.</p>' +
      (STATUS[s.st] ? '<p class="sk-flag">' + STATUS[s.st] + "</p>" : "") +
      '<p class="sk-sub">Candidatos O*NET</p><ul class="sk-cands">' + rows + "</ul>" +
      '<p class="sk-cap">' + (s.e5 ? "El modelo de contraste (e5) eligió el mismo primer candidato." : "El modelo de contraste (e5) eligió otro primer candidato.") + "</p>";
  }

  // Tabla accesible del grupo actual
  function table(left) {
    var h = "<thead><tr><th>SINCO</th><th>Ocupación</th><th>Prob.</th><th>Candidato O*NET</th><th>Peso</th><th>Prob. O*NET</th></tr></thead><tbody>";
    left.forEach(function (s) {
      s.l.forEach(function (l, i) {
        var o = D.onet[l.o];
        h += "<tr>" + (i === 0 ? '<td rowspan="' + s.l.length + '">' + s.c + '</td><td rowspan="' + s.l.length + '">' + esc(s.t) +
          (s.st !== "ok" ? " *" : "") + '</td><td rowspan="' + s.l.length + '">' + pctH(s.p) + "</td>" : "") +
          "<td>" + esc(o.t) + "</td><td>" + Math.round(l.w * 100) + "%</td><td>" + pctH(o.p) + "</td></tr>";
      });
    });
    document.getElementById("sk-tabla").innerHTML = h + "</tbody>";
  }

  sel.addEventListener("change", function () { draw(sel.value); });

  // Buscador: cambia al grupo de la ocupación y la selecciona
  var q = document.getElementById("sk-q"), list = document.getElementById("sk-list"), matches = [], active = -1;
  function closeList() { list.hidden = true; q.setAttribute("aria-expanded", "false"); active = -1; }
  function choose(s) { q.value = s.t; closeList(); draw(s.g, s.c); }
  q.addEventListener("input", function () {
    list.innerHTML = "";
    if (q.value.trim().length < 3) { closeList(); return; }
    var words = norm(q.value.trim()).split(/\s+/);
    matches = D.sinco.filter(function (s) {
      var t = norm(s.t);
      return words.every(function (w) { return t.indexOf(w.length > 4 ? w.replace(/(as|os|es|a|o|s)$/, "") : w) >= 0; });
    }).slice(0, 8);
    if (!matches.length) list.innerHTML = '<li class="auto-none">Sin resultados. Prueba con otra palabra.</li>';
    matches.forEach(function (s, i) {
      var li = document.createElement("li");
      li.id = "sk-opt-" + i; li.setAttribute("role", "option");
      li.innerHTML = "<span>" + esc(s.t) + '</span><span class="auto-opt-p">' + pctH(s.p) + "</span>";
      li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(s); });
      list.appendChild(li);
    });
    list.hidden = false; q.setAttribute("aria-expanded", "true");
  });
  q.addEventListener("keydown", function (e) {
    if (list.hidden || !matches.length) return;
    if (e.key === "ArrowDown") active = (active + 1) % matches.length;
    else if (e.key === "ArrowUp") active = (active - 1 + matches.length) % matches.length;
    else if (e.key === "Enter") { e.preventDefault(); choose(matches[Math.max(active, 0)]); return; }
    else if (e.key === "Escape") { closeList(); return; }
    else return;
    e.preventDefault();
    Array.prototype.forEach.call(list.children, function (li, i) { li.setAttribute("aria-selected", String(i === active)); });
    q.setAttribute("aria-activedescendant", "sk-opt-" + active);
  });
  q.addEventListener("blur", closeList);

  // Se puede abrir directo en una ocupación: ...html#sinco=2121
  var m = /sinco=(\d{4})/.exec(location.hash);
  var start = m && bySinco[m[1]] ? bySinco[m[1]] : bySinco["2121"];
  draw(start.g, start.c);
})();
