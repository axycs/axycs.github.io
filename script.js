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
