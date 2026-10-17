// mate0s asomado al marco como a una ventana: de base se queda apoyado y de vez en
// cuando hace algo (saluda, se toma el café, bosteza, se duerme...). Todos los clips
// empiezan y acaban en la misma pose, así que se encadenan sin saltos.
// Con "reducir movimiento" no hay bucle ni animaciones al azar: se queda quieto y
// solo reacciona cuando el visitante pasa el ratón o hace clic.
(() => {
  const box = document.querySelector('.hero-img');
  if (!box) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BASE = 'apoyado';
  // peso para elegir al azar + frases que a veces suelta mientras lo hace
  const EXTRA = {
    saluda:   { w: 2, say: ['ey', 'ah, hola', 'sí, sigo aquí'] },
    cafe:     { w: 3, say: ['café.exe en ejecución', 'la cafeína no falla, a diferencia del deploy'] },
    bosteza:  { w: 2, say: ['son las 17:59 de un viernes', 'solo un commit más…'] },
    hombros:  { w: 2, say: ['en mi máquina funciona', 'no es mi problema'] },
    duerme:   { w: 1, say: ['zzz… git push --force…', 'estaba haciendo code review'] },
    teclea:   { w: 2, say: ['compilando… (mentira)', 'un momento, que esto es una urgencia'] },
    curioso:  { w: 2, say: ['¿eso es un bug?', '¿qué miras?'] },
    pulgar:   { w: 1, say: ['deploy ok (mentira)', 'LGTM'] },
  };
  const CLICK = ['en mi máquina funciona', 'no es un bug, es una feature', '¿has probado a reiniciar?', 'estoy en producción, no me toques'];

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const vids = {};
  for (const name of [BASE, ...Object.keys(EXTRA)]) {
    const v = document.createElement('video');
    v.src = `anim/${name}.mp4`;
    v.muted = v.defaultMuted = true;
    v.playsInline = true;
    v.preload = name === BASE ? 'auto' : 'none';
    v.setAttribute('aria-hidden', 'true');
    box.append(v);
    vids[name] = v;
  }
  const bubble = document.createElement('div');
  bubble.className = 'hero-bubble';
  bubble.setAttribute('aria-hidden', 'true');
  box.append(bubble);

  let current = BASE, busy = false, visible = true, last = '', lastExtra = 0, bubbleTimer = 0;

  function say(msg, ms = 2600) {
    bubble.textContent = msg;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  async function show(name) {
    const next = vids[name], prev = vids[current];
    if (next === prev) return;
    next.currentTime = 0;
    try { await next.play(); } catch { return; }
    next.classList.add('on');
    prev.classList.remove('on');
    prev.pause();
    current = name;
    if (reduced && name === BASE) next.pause();     // vuelve a quedarse quieto en el primer fotograma
  }

  async function playExtra(name, text) {
    const v = vids[name];
    if (busy || !visible || v.readyState < 3 || box.classList.contains('empty')) return false;
    busy = true;
    lastExtra = performance.now();
    last = name;
    await show(name);
    if (text) say(text);
    await new Promise(res => v.addEventListener('ended', res, { once: true }));
    await show(BASE);
    busy = false;
    return true;
  }

  function schedule() {
    setTimeout(async () => {
      const names = Object.keys(EXTRA).filter(n => n !== last && vids[n].readyState >= 3);
      if (names.length && !document.hidden) {
        let r = Math.random() * names.reduce((s, n) => s + EXTRA[n].w, 0);
        const name = names.find(n => (r -= EXTRA[n].w) <= 0) || names[0];
        await playExtra(name, Math.random() < 0.45 ? pick(EXTRA[name].say) : '');
      }
      schedule();
    }, rand(6000, 14000));
  }

  // el base arranca ya; el resto se descarga cuando el navegador está tranquilo
  if (reduced) {
    vids[BASE].addEventListener('loadeddata', () => vids[BASE].classList.add('on'), { once: true });
  } else {
    vids[BASE].loop = true;
    vids[BASE].play().then(() => vids[BASE].classList.add('on')).catch(() => {});
  }
  const preloadRest = () => Object.values(vids).forEach(v => { if (v.preload === 'none') { v.preload = 'auto'; v.load(); } });
  const later = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(preloadRest) : preloadRest()), 1200);
  document.readyState === 'complete' ? later() : addEventListener('load', later);

  // saluda al pasar el ratón; con clic suelta una excusa
  box.addEventListener('pointerenter', e => {
    if (e.pointerType === 'mouse' && performance.now() - lastExtra > 5000) playExtra('saluda', pick(EXTRA.saluda.say));
  });
  box.addEventListener('click', () => {
    if (busy) { say(pick(CLICK)); return; }
    playExtra('hombros', pick(CLICK));
  });

  // sin gastar CPU fuera de pantalla o con la pestaña oculta
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!busy && !reduced) visible ? vids[current].play().catch(() => {}) : vids[current].pause();
  }).observe(box);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) vids[current].pause();
    else if (visible && !reduced) vids[current].play().catch(() => {});
  });

  if (!reduced) schedule();
})();
