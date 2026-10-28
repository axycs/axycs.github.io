(function () {
  var btn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");

  btn.addEventListener("click", function () {
    var open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  menu.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  // Guarda el paquete elegido en el formulario y lo muestra
  var plan = document.getElementById("plan");
  var chosen = document.getElementById("plan-chosen");
  document.querySelectorAll("[data-plan]").forEach(function (a) {
    a.addEventListener("click", function () {
      plan.value = a.getAttribute("data-plan");
      chosen.querySelector("strong").textContent = plan.value;
      chosen.hidden = false;
    });
  });

  // Problemas: el visitante marca los que le pasan y se envían con el formulario
  var pains = document.querySelectorAll(".pain");
  var painMsg = document.getElementById("pain-msg");
  var painCta = document.getElementById("pain-cta");
  var dolores = document.getElementById("dolores");
  pains.forEach(function (b) {
    b.addEventListener("click", function () {
      b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
      var on = document.querySelectorAll('.pain[aria-pressed="true"]');
      var names = [], fixes = [];
      on.forEach(function (p) {
        names.push(p.querySelector("strong").textContent);
        var f = p.getAttribute("data-fix");
        if (fixes.indexOf(f) < 0) fixes.push(f);
      });
      dolores.value = names.join("; ");
      painCta.hidden = on.length === 0;
      painMsg.innerHTML = on.length === 0
        ? "Toca los que te pasen."
        : "Marcaste " + on.length + " de " + pains.length + ". Lo resolvemos con <strong>" + fixes.join(" + ") + "</strong>.";
    });
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  // Confirmación tras enviar el formulario (FormSubmit regresa con ?enviado=1)
  if (/[?&]enviado=1/.test(location.search)) {
    document.getElementById("form-ok").hidden = false;
  }

  // Animación de aparición al hacer scroll
  var items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });
})();
