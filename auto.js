(function () {
  var D = window.AUTO_DATA;
  var top = document.getElementById("auto-top");
  if (!D || !top) return;

  var byCode = {};
  D.rows.forEach(function (r) { byCode[r.c] = r; });

  // Nombres cortos para la gráfica (el título completo va en el tooltip)
  var SHORT = {
    "2121": "Contadores y auditores", "2514": "Valuadores", "4223": "Agentes de bienes raíces",
    "4224": "Vendedores por catálogo", "2512": "Auxiliares contables", "5212": "Maquillistas y manicuristas",
    "4222": "Agentes de seguros", "2815": "Técnicos en prótesis dentales", "4221": "Agentes de ventas",
    "5213": "Masajistas"
  };

  function pct(p) { return p > 0 && p < 0.005 ? "&lt;1%" : Math.round(p * 100) + "%"; }

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

  // Al tocar una barra se abre esa ocupación en el buscador de "Para quién"
  function select(r) {
    if (window.ParaQuien) window.ParaQuien.elegir(r.c, true);
  }
})();
