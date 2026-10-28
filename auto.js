(function () {
  var D = window.AUTO_DATA;
  var top = document.getElementById("auto-top");
  if (!D || !top) return;

  var byCode = {};
  D.rows.forEach(function (r) { byCode[r.c] = r; });
  var withP = D.rows.filter(function (r) { return r.p !== null; });

  // Nombres cortos para la gráfica (el título completo va en el tooltip)
  var SHORT = {
    "2121": "Contadores y auditores", "2514": "Valuadores", "4223": "Agentes de bienes raíces",
    "4224": "Vendedores por catálogo", "2512": "Auxiliares contables", "5212": "Maquillistas y manicuristas",
    "4222": "Agentes de seguros", "2815": "Técnicos en prótesis dentales", "4221": "Agentes de ventas",
    "5213": "Masajistas"
  };

  function pct(p) { return p > 0 && p < 0.005 ? "&lt;1%" : Math.round(p * 100) + "%"; }
  function norm(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function level(p) {
    if (p >= 0.7) return ["Alta", "Muchas de sus tareas son repetitivas. Automatizarlas libera horas cada semana."];
    if (p >= 0.3) return ["Media", "Una parte de sus tareas se puede automatizar; el resto requiere tu criterio."];
    return ["Baja", "Su núcleo es difícil de automatizar. Lo administrativo alrededor (agenda, cobros, reportes) sí se puede."];
  }

  // Tooltip compartido
  var study = document.getElementById("automatizacion");
  var tip = document.getElementById("auto-tip");
  function showTip(el, html) {
    tip.innerHTML = html; tip.hidden = false;
    var a = el.getBoundingClientRect(), b = study.getBoundingClientRect();
    var x = Math.min(Math.max(a.left - b.left + a.width / 2 - tip.offsetWidth / 2, 0), b.width - tip.offsetWidth);
    tip.style.left = x + "px";
    tip.style.top = (a.top - b.top - tip.offsetHeight - 8) + "px";
  }
  function hideTip() { tip.hidden = true; }
  function hover(el, html) {
    el.addEventListener("mouseenter", function () { showTip(el, html); });
    el.addEventListener("focus", function () { showTip(el, html); });
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("blur", hideTip);
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Top 10: barras horizontales ordenadas
  D.top.forEach(function (c) {
    var r = byCode[c];
    var li = document.createElement("li");
    li.className = "bar-row"; li.tabIndex = 0;
    li.innerHTML = '<span class="bar-label">' + esc(SHORT[c] || r.t) + '</span>' +
      '<span class="bar-track"><span class="bar" style="width:' + (r.p * 100) + '%"></span></span>' +
      '<span class="bar-val">' + pct(r.p) + '</span>';
    hover(li, "<strong>" + esc(r.t) + "</strong><br>" + pct(r.p) + " · equivalente en EE. UU.: " + esc(r.o));
    li.addEventListener("click", function () { select(r); });
    li.addEventListener("keydown", function (e) { if (e.key === "Enter") select(r); });
    top.appendChild(li);
  });

  // Histograma: 20 rangos de 5 puntos
  var hist = document.getElementById("auto-hist");
  var bins = new Array(20).fill(0);
  withP.forEach(function (r) { bins[Math.min(19, Math.floor(r.p * 20))]++; });
  var max = Math.max.apply(null, bins);
  var cols = bins.map(function (n, i) {
    var col = document.createElement("span");
    col.className = "hcol"; col.tabIndex = 0;
    col.style.height = Math.max(3, n / max * 100) + "%";
    hover(col, (i * 5) + "–" + (i * 5 + 5) + "%: <strong>" + n + "</strong> ocupaciones");
    hist.appendChild(col);
    return col;
  });
  var marker = document.createElement("span");
  marker.className = "hmark"; marker.hidden = true;
  hist.appendChild(marker);

  // Buscador
  var q = document.getElementById("auto-q");
  var list = document.getElementById("auto-list");
  var out = document.getElementById("auto-result");
  var matches = [], active = -1;

  function select(r) {
    q.value = r.t; closeList();
    cols.forEach(function (c) { c.classList.remove("on"); });
    if (r.p === null) {
      marker.hidden = true;
      out.innerHTML = '<p class="auto-name">' + esc(r.t) + '</p><p class="auto-empty">Sin dato de Frey y Osborne para esta ocupación.</p>';
      return;
    }
    var lv = level(r.p);
    cols[Math.min(19, Math.floor(r.p * 20))].classList.add("on");
    marker.hidden = false; marker.style.left = (r.p * 100) + "%";
    out.innerHTML = '<p class="auto-name">' + esc(r.t) + '</p>' +
      '<p class="auto-big">' + pct(r.p) + ' <span class="auto-level">Probabilidad ' + lv[0].toLowerCase() + '</span></p>' +
      '<p class="auto-msg">' + lv[1] + '</p>' +
      '<p class="auto-meta">Equivalente en EE. UU.: ' + esc(r.o) + (r.b ? ' · <strong>emparejamiento de baja confianza</strong>' : '') + '</p>';
  }
  function closeList() { list.hidden = true; q.setAttribute("aria-expanded", "false"); active = -1; }
  function paint() {
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.setAttribute("aria-selected", String(i === active));
    });
  }
  q.addEventListener("input", function () {
    var words = norm(q.value.trim()).split(/\s+/).filter(Boolean);
    list.innerHTML = "";
    if (q.value.trim().length < 3) { closeList(); return; }
    matches = D.rows.filter(function (r) {
      var t = norm(r.t);
      return words.every(function (w) { return t.indexOf(w.length > 4 ? w.replace(/(as|os|es|a|o|s)$/, "") : w) >= 0; });
    }).slice(0, 8);
    if (!matches.length) {
      list.innerHTML = '<li class="auto-none">Sin resultados. Prueba con otra palabra.</li>';
    }
    matches.forEach(function (r, i) {
      var li = document.createElement("li");
      li.id = "auto-opt-" + i; li.setAttribute("role", "option");
      li.innerHTML = '<span>' + esc(r.t) + '</span><span class="auto-opt-p">' + (r.p === null ? "s/d" : pct(r.p)) + '</span>';
      li.addEventListener("mousedown", function (e) { e.preventDefault(); select(r); });
      list.appendChild(li);
    });
    list.hidden = false; q.setAttribute("aria-expanded", "true"); active = -1;
  });
  q.addEventListener("keydown", function (e) {
    if (list.hidden || !matches.length) return;
    if (e.key === "ArrowDown") { active = (active + 1) % matches.length; }
    else if (e.key === "ArrowUp") { active = (active - 1 + matches.length) % matches.length; }
    else if (e.key === "Enter") { e.preventDefault(); select(matches[Math.max(active, 0)]); return; }
    else if (e.key === "Escape") { closeList(); return; }
    else return;
    e.preventDefault(); paint();
    q.setAttribute("aria-activedescendant", "auto-opt-" + active);
  });
  q.addEventListener("blur", closeList);

  // Ejemplo inicial para que la tarjeta no aparezca vacía
  select(byCode["2433"]);
  q.value = "";
})();
