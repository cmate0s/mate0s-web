/* carlos mateos · pequeñas mejoras, sin dependencias.
   Todo funciona sin este archivo: es progresivo. */

/* --- Huevo de pascua para quien abre la consola --- */
if (typeof console !== "undefined") {
  console.log(
    "%c hola, curioso 👀 ",
    "background:#c65317;color:#fff;padding:6px 12px;border-radius:10px;font-weight:700;font-size:13px"
  );
  console.log("Leo las tripas de webs ajenas de vez en cuando, así que entiendo el hábito.");
  console.log(
    "%c 01001000 01101111 01101100 01100001 00100001  ",
    "color:#e8770d;font-family:monospace;font-size:12px"
  );
  console.log("Traducción: ¡Hola! Si llegaste hasta aquí, escríbeme → cmateos91@gmail.com");
}

/* --- Scroll suave (Lenis) --- */
(() => {
  if (
    typeof Lenis === "undefined" ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) {
    return;
  }
  const lenis = new Lenis({ lerp: 0.1, anchors: true });
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  /* Arrastrar con el ratón para desplazarse, como en el táctil del móvil */
  const interactivo = "a, button, input, textarea, select, label, summary, [contenteditable]";
  let arrastre = null;

  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || e.target.closest(interactivo)) return;
    arrastre = { y: e.clientY, scroll: lenis.scroll, v: 0, ultimoY: e.clientY, ultimoT: e.timeStamp, activo: false };
  });

  window.addEventListener("pointermove", (e) => {
    if (!arrastre) return;
    const dy = e.clientY - arrastre.y;
    if (!arrastre.activo) {
      if (Math.abs(dy) < 5) return;
      arrastre.activo = true;
      document.documentElement.classList.add("arrastrando");
    }
    const dt = e.timeStamp - arrastre.ultimoT;
    if (dt > 0) {
      // velocidad suavizada (px/ms, positiva = hacia abajo en la página)
      arrastre.v = 0.8 * arrastre.v + 0.2 * ((arrastre.ultimoY - e.clientY) / dt);
    }
    arrastre.ultimoY = e.clientY;
    arrastre.ultimoT = e.timeStamp;
    lenis.scrollTo(arrastre.scroll - dy, { immediate: true });
  });

  const soltar = (e) => {
    if (!arrastre) return;
    const a = arrastre;
    arrastre = null;
    document.documentElement.classList.remove("arrastrando");
    if (!a.activo) return;
    document.documentElement.dataset.arrastrado = "1";
    setTimeout(() => delete document.documentElement.dataset.arrastrado, 50);
    // Inercia al soltar, si no se había parado antes de soltar
    if (e && e.timeStamp - a.ultimoT < 80) {
      lenis.scrollTo(lenis.scroll + a.v * 350, {
        duration: 1.2,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    }
  };
  window.addEventListener("pointerup", soltar);
  window.addEventListener("pointercancel", () => soltar(null));

  // Un arrastre no debe contar como clic ni arrancar la selección o el arrastre de imágenes
  document.addEventListener("click", (e) => {
    if (e.detail !== 0 && document.documentElement.dataset.arrastrado) {
      e.preventDefault();
      e.stopPropagation();
    }
    delete document.documentElement.dataset.arrastrado;
  }, true);
  document.addEventListener("selectstart", (e) => { if (arrastre && arrastre.activo) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (arrastre) e.preventDefault(); });
})();

(() => {
  "use strict";

  /* --- Menú en móvil --- */
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("menu");

  if (toggle && menu) {
    const cerrar = () => {
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    };

    toggle.addEventListener("click", () => {
      const abierto = toggle.getAttribute("aria-expanded") === "true";
      if (abierto) {
        cerrar();
      } else {
        toggle.setAttribute("aria-expanded", "true");
        menu.hidden = false;
      }
    });

    // Esc cierra y devuelve el foco al botón
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        cerrar();
        toggle.focus();
      }
    });

    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) cerrar();
    });

    // Si se agrupa o rota la ventana, que el menú no quede colgado
    window.addEventListener("resize", () => {
      if (window.innerWidth > 719) cerrar();
    });
  }

  /* --- Año del pie --- */
  const anio = document.getElementById("anio");
  if (anio) anio.textContent = String(new Date().getFullYear());

  /* --- Aparición suave al hacer scroll --- */
  const elementos = Array.from(document.querySelectorAll(".reveal"));
  const reducirMovimiento =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    !elementos.length ||
    reducirMovimiento ||
    !("IntersectionObserver" in window)
  ) {
    elementos.forEach((el) => el.classList.add("in"));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("in");
          observador.unobserve(entrada.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  elementos.forEach((el) => observador.observe(el));
})();

/* --- Consola: las letras huyen del ratón y vuelven a su sitio --- */
(() => {
  "use strict";

  const terminal = document.querySelector(".terminal");
  if (!terminal || !window.matchMedia) return;
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches
  ) {
    return;
  }

  // Parte el texto en letras (agrupadas por palabra para no romper el ajuste de línea)
  const partir = (el) => {
    const texto = el.textContent.replace(/\s+/g, " ").trim();
    const visible = document.createElement("span");
    visible.setAttribute("aria-hidden", "true");
    texto.split(" ").forEach((palabra, i, todas) => {
      const p = document.createElement("span");
      p.className = "huir-palabra";
      for (const c of palabra) {
        const l = document.createElement("span");
        l.className = "huir-letra";
        l.textContent = c;
        p.appendChild(l);
      }
      visible.appendChild(p);
      if (i < todas.length - 1) visible.appendChild(document.createTextNode(" "));
    });
    const lector = document.createElement("span");
    lector.className = "sr-only";
    lector.textContent = texto;
    el.textContent = "";
    el.append(lector, visible);
  };

  // Línea del prompt: el prompt y el texto suelto ("ahora"), respetando el cursor
  const linea = terminal.querySelector(".terminal-linea");
  if (linea) {
    for (const nodo of Array.from(linea.childNodes)) {
      if (nodo.nodeType === 3 && nodo.textContent.trim()) {
        const sp = document.createElement("span");
        sp.textContent = nodo.textContent;
        linea.replaceChild(sp, nodo);
        partir(sp);
        linea.insertBefore(document.createTextNode(" "), sp); // partir() recorta el espacio
      }
    }
    linea.querySelectorAll(".terminal-prompt").forEach(partir);
  }

  terminal
    .querySelectorAll(".terminal-fila dt, .terminal-fila dd, .terminal-pie")
    .forEach(partir);

  const letras = Array.from(terminal.querySelectorAll(".huir-letra")).map((el) => ({
    el, x: 0, y: 0, rx: 0, ry: 0,
  }));

  const RADIO = 80;    // zona de influencia del ratón
  const EMPUJE = 12;   // desplazamiento máximo (px): sutil y siempre dentro
  const SUAVIDAD = 0.1; // 0-1: más bajo = más lento y fluido
  const MARGEN = 10;   // las letras nunca pasan de aquí al borde de la consola

  let raton = null;
  let activo = false;
  let caja = null;

  // Posición de reposo de cada letra, relativa a la consola
  const medir = () => {
    caja = terminal.getBoundingClientRect();
    for (const l of letras) {
      const r = l.el.getBoundingClientRect();
      l.rx = r.left + r.width / 2 - l.x - caja.left;
      l.ry = r.top + r.height / 2 - l.y - caja.top;
    }
  };

  const bucle = () => {
    let movimiento = false;
    for (const l of letras) {
      let tx = 0;
      let ty = 0;

      if (raton) {
        const dx = l.rx - raton.x;
        const dy = l.ry - raton.y;
        const d = Math.hypot(dx, dy);
        if (d < RADIO) {
          // caída suave (coseno): sin cortes bruscos en el borde del radio
          const f = (1 + Math.cos((d / RADIO) * Math.PI)) / 2;
          const n = d > 0.01 ? d : 1;
          tx = (dx / n) * f * EMPUJE;
          ty = (dy / n) * f * EMPUJE;
        }
        // que no se salga de la consola
        tx = Math.max(MARGEN - l.rx, Math.min(caja.width - MARGEN - l.rx, tx));
        ty = Math.max(MARGEN - l.ry, Math.min(caja.height - MARGEN - l.ry, ty));
      }

      l.x += (tx - l.x) * SUAVIDAD;
      l.y += (ty - l.y) * SUAVIDAD;

      if (Math.abs(tx - l.x) < 0.02 && Math.abs(ty - l.y) < 0.02 && !tx && !ty) {
        if (l.x || l.y) {
          l.x = l.y = 0;
          l.el.style.transform = "";
        }
      } else {
        movimiento = true;
        l.el.style.transform = `translate(${l.x.toFixed(2)}px,${l.y.toFixed(2)}px)`;
      }
    }
    if (movimiento || raton) {
      requestAnimationFrame(bucle);
    } else {
      activo = false;
    }
  };

  const arrancar = () => {
    if (!activo) {
      activo = true;
      requestAnimationFrame(bucle);
    }
  };

  terminal.addEventListener("pointerenter", medir);
  terminal.addEventListener("pointermove", (e) => {
    if (!caja) medir();
    raton = { x: e.clientX - caja.left, y: e.clientY - caja.top };
    arrancar();
  });
  terminal.addEventListener("pointerleave", () => {
    raton = null;
    arrancar();
  });
  window.addEventListener("resize", () => { caja = null; });
})();
