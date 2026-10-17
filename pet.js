// mate0s se pasea por la landing: camina por los bordes de los elementos, trepa
// por sus paredes, se tira al vacío, borra textos con la esponja y los deja
// limpios, baila, se duerme si nadie toca nada y se acerca al cursor.
(() => {
  const FW = 72, FH = 112, FOOT = 2;               // frame en pantalla y hueco bajo los pies
  const std = (src, n) => ({ src, n, w: FW, h: FH });
  const SHEETS = {
    idle: std('sprites/idle.png', 4),                // manos en el bolsillo, mira arriba, se rasca, se encoge de hombros
    walk: std('sprites/walk.png', 8),
    climb: std('sprites/climb.png', 4),
    clean: std('sprites/clean.png', 4),
    fall: std('sprites/fall.png', 4),                // arranque, grito, voltereta, aterrizaje
    dance: std('sprites/dance.png', 4),
    sleep: std('sprites/sleep.png', 4),              // sentado, cabeceando cada vez más
    // subirse al borde: el frame está anclado a la esquina de la plataforma (cx, cy)
    ledge: { src: 'sprites/ledge.png', n: 4, w: 74, h: 215, cx: 39.5, cy: 101, body: [24.5, 23.5, 27.5, 53.5], feet: [112, 78, 60, 0] },
  };
  const WALL = 15;                                 // distancia del cuerpo a la pared al trepar
  const PLATFORMS = '.hero-img, .tag, h1, .lead, .btn, h2, .card, .card p, .term, .term > div, footer';
  const CLEANABLE = 'h1, h2, .lead, .tag, footer, .card h3, .term > div';
  const SAY = {
    clean: ['esto lo limpio yo', 'no era un bug, era mugre', 'tests: no reproducible', 'git blame: otro', 'ahora sí, en producción'],
    climb: ['subo, que hay un merge pendiente', 'esto era más fácil en mi máquina', 'otro sprint más'],
    click: ['en mi máquina funciona', 'no es mi problema', '¿has probado a reiniciar?', 'estoy en producción, no me toques'],
    dance: ['viernes 17:58, todo en verde', 'cero tests rotos (mentira)', 'deploy sin review', 'LGTM'],
    sleep: ['zzz…', 'zzz… git push --force…', 'zzz… un commit más…'],
    wake: ['¡no dormía!', 'estaba haciendo code review', 'solo cerraba los ojos para compilar'],
    curious: ['¿qué miras?', 'eh, ese es mi sitio', 'voy, voy…', '¿eso es un bug?'],
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const frame = () => new Promise(requestAnimationFrame);
  const vw = () => document.documentElement.clientWidth;
  const ABORT = Symbol('abort'), INTERRUPT = Symbol('interrupt');

  function wpick(items, weight) {
    const ws = items.map(weight);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) if ((r -= ws[i]) <= 0) return items[i];
    return items[items.length - 1];
  }

  const pet = document.createElement('div');
  pet.className = 'pet';
  pet.setAttribute('aria-hidden', 'true');
  const sprite = document.createElement('div');
  sprite.className = 'pet-sprite';
  const bubble = document.createElement('div');
  bubble.className = 'pet-bubble';
  pet.append(sprite, bubble);

  const S = { x: 0, y: 0, dir: 1, key: null, anim: null };
  let gen = 0, stepGen = 0, sayTimer = 0, bubbleOn = false, locked = 0;

  // qué ha hecho últimamente (para no repetirse) y qué hace el visitante
  const mem = { plats: [], jobs: [], act: null, curious: 0 };
  const remember = (list, v, n) => { list.push(v); if (list.length > n) list.shift(); };
  const mouse = { x: 0, y: 0, t: -1e9 };
  let lastInput = performance.now(), call = null;

  function render(anim, idx) {
    const sh = SHEETS[anim];
    if (S.anim !== anim) {
      Object.assign(sprite.style, {
        backgroundImage: `url(${sh.src})`, width: `${sh.w}px`, height: `${sh.h}px`,
        left: `${-sh.w / 2}px`, top: `${-sh.h}px`, backgroundSize: `${sh.w * sh.n}px ${sh.h}px`,
      });
      S.anim = anim;
    }
    sprite.style.backgroundPositionX = `${-idx * sh.w}px`;
    sprite.style.transform = `scaleX(${S.dir})`;
    pet.style.transform = `translate(${S.x}px, ${S.y + FOOT}px)`;
    if (bubbleOn) {
      const half = 100, W = vw();
      const dx = Math.max(half + 8 - S.x, 0) - Math.max(S.x + half + 8 - W, 0);
      bubble.style.setProperty('--dx', `${dx}px`);
    }
  }

  function say(msg, ms = 2400) {
    bubble.textContent = msg;
    bubble.classList.add('show');
    bubbleOn = true;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { bubble.classList.remove('show'); bubbleOn = false; }, ms);
  }

  // Un redimensionado aborta todo; una llamada del visitante interrumpe salvo en trepadas y caídas.
  const chk = () => {
    if (stepGen !== gen) throw ABORT;
    if (!locked && call) throw INTERRUPT;
  };
  const lock = async fn => { locked++; try { return await fn(); } finally { locked--; } };

  async function wait(ms, anim = 'idle', idx = 0) {
    render(anim, idx);
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { await frame(); chk(); }
  }

  async function walkTo(x, { v = 64, anim = 'walk', fps = v / 10.7, onFrame } = {}) {
    S.dir = Math.sign(x - S.x) || S.dir;
    let t = 0, last = performance.now();
    while (Math.abs(x - S.x) > 1) {
      const now = await frame(); chk();
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      S.x += Math.sign(x - S.x) * Math.min(v * dt, Math.abs(x - S.x));
      render(anim, Math.floor(t * fps) % SHEETS[anim].n);
      if (onFrame) onFrame();
    }
  }

  async function climbTo(y, v = 48) {
    let t = 0, last = performance.now();
    while (S.y > y + 0.5) {
      const now = await frame(); chk();
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      S.y = Math.max(y, S.y - v * dt);
      render('climb', Math.floor(t * 6) % 4);
    }
  }

  // Caída: arranque, luego alterna grito y voltereta; si ha sido larga, aterriza agachado.
  async function fallTo(y) {
    const dist = y - S.y;
    let vy = 0, t = 0, last = performance.now();
    while (S.y < y - 0.5) {
      const now = await frame(); chk();
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      vy += 1800 * dt;
      S.y = Math.min(y, S.y + vy * dt);
      render('fall', t < 0.14 ? 0 : 1 + Math.floor((t - 0.14) / 0.2) % 2);
    }
    if (dist > 36) await wait(300, 'fall', 3);
  }

  // Subirse al borde: los frames están anclados a la esquina de la plataforma.
  // Un desnivel corto empieza en un frame más avanzado (los pies ya quedan a la altura justa).
  const mantleStart = dist => { const i = SHEETS.ledge.feet.findIndex(f => f <= dist); return i < 0 ? 3 : i; };

  async function mantle(T, dir, from) {
    const L = SHEETS.ledge;
    const corner = dir > 0 ? T.l : T.r;
    S.dir = dir;
    S.x = corner - dir * (L.cx - L.w / 2);
    S.y = T.y + L.h - L.cy - FOOT;
    for (const [i, ms] of [[0, 380], [1, 300], [2, 300], [3, 340]]) if (i >= from) await wait(ms, 'ledge', i);
    S.x = corner + dir * (L.body[3] - L.cx);
    S.y = T.y;
  }

  // ---- el mundo: bordes superiores de los elementos + el suelo
  function platforms() {
    const list = [];
    for (const el of document.querySelectorAll(PLATFORMS)) {
      const r = el.getBoundingClientRect();
      const y = r.top + scrollY;
      if (r.width < 48 || y < FH + 8) continue;
      list.push({ key: el, l: r.left + scrollX, r: r.right + scrollX, y });
    }
    list.push({ key: 'ground', l: 0, r: vw(), y: document.documentElement.scrollHeight - 6 });
    return list;
  }

  const range = p => {
    const lo = Math.max(p.l, FW / 2), hi = Math.min(p.r, vw() - FW / 2);
    return lo <= hi ? [lo, hi] : [(p.l + p.r) / 2, (p.l + p.r) / 2];
  };
  const clampTo = (p, x) => { const [lo, hi] = range(p); return Math.min(hi, Math.max(lo, x)); };
  const visible = p => p.y > scrollY + FH * 0.6 && p.y < scrollY + innerHeight + 20;
  const onScreen = () => S.y > scrollY + FH * 0.6 && S.y < scrollY + innerHeight + 30;

  function edges(C, P) {
    const out = [], W = vw();
    for (const T of P) {
      if (T === C || T.y > C.y - 24 || C.y - T.y > 900) continue;
      for (const side of [-1, 1]) {
        const x = side < 0 ? T.l - WALL : T.r + WALL;
        if (x < FW / 2 || x > W - FW / 2 || x < C.l - 6 || x > C.r + 6) continue;
        out.push({ to: T, kind: 'climb', x, side });
      }
    }
    for (const side of [-1, 1]) {
      const x = side < 0 ? C.l - 8 : C.r + 8;
      if (x < FW / 2 || x > W - FW / 2) continue;
      const land = P.filter(p => p !== C && p.y > C.y + 10 && x >= p.l - 4 && x <= p.r + 4).sort((a, b) => a.y - b.y)[0];
      if (land) out.push({ to: land, kind: 'drop', x, side });
    }
    return out;
  }

  // BFS desde C: clave de plataforma -> camino (lista de aristas)
  function reachable(C, P) {
    const paths = new Map([[C.key, []]]);
    const queue = [C];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of edges(cur, P)) {
        if (paths.has(e.to.key)) continue;
        paths.set(e.to.key, [...paths.get(cur.key), e]);
        queue.push(e.to);
      }
    }
    return paths;
  }

  async function follow(path) {
    for (const e of path) {
      await walkTo(e.x, { v: rand(58, 84) });
      if (e.kind === 'climb') {
        if (Math.random() < 0.3) say(pick(SAY.climb));
        const dir = -e.side, from = mantleStart(S.y - e.to.y);
        await lock(async () => {
          S.dir = dir;
          await climbTo(e.to.y + SHEETS.ledge.feet[from]);
          await mantle(e.to, dir, from);
        });
        S.y = e.to.y;
        S.key = e.to.key;
        await walkTo(clampTo(e.to, e.side < 0 ? e.to.l + 36 : e.to.r - 36));
      } else {
        await lock(() => fallTo(e.to.y));
      }
      S.y = e.to.y;
      S.key = e.to.key;
      remember(mem.plats, e.to.key, 4);
    }
  }

  async function respawn(P) {
    const vis = P.filter(visible);
    const T = pick(vis.length ? vis : P);
    S.x = rand(...range(T));
    S.y = scrollY - FH - 30;
    S.dir = Math.random() < 0.5 ? 1 : -1;
    S.key = T.key;
    render('fall', 1);
    pet.style.opacity = 1;
    await lock(() => fallTo(T.y));
    await wait(500);
  }

  // ---- limpiar: borra con la esponja, espera, y vuelve a dejar el texto limpiando
  function wrapChars(el) {
    const nodes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const chars = [];
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const ch of node.nodeValue) {
        if (/\s/.test(ch)) { frag.append(ch); continue; }
        const s = document.createElement('span');
        s.className = 'pc';
        s.textContent = ch;
        frag.append(s);
        chars.push({ s });
      }
      node.replaceWith(frag);
    }
    for (const c of chars) {
      const r = c.s.getBoundingClientRect();
      c.cx = r.left + r.width / 2 + scrollX;
      c.cy = r.top + r.height / 2 + scrollY;
    }
    return chars;
  }

  function cleanJobs(P, reach) {
    const jobs = [];
    for (const el of document.querySelectorAll(CLEANABLE)) {
      const r = el.getBoundingClientRect();
      if (r.top < -10 || r.bottom > innerHeight + 10) continue;
      const bottom = r.bottom + scrollY, left = r.left + scrollX, right = r.right + scrollX;
      for (const p of P) {
        if (!reach.has(p.key) || p.y < bottom - 6 || p.y > bottom + 70) continue;
        if (Math.min(p.r, right) - Math.max(p.l, left) > 40) jobs.push({ el, p });
      }
    }
    return jobs;
  }

  async function cleanJob({ el, p }) {
    const html = el.innerHTML;
    const chars = wrapChars(el);
    try {
      const [lo, hi] = range(p);
      const mine = chars.filter(c => c.cy > p.y - 110 && c.cy < p.y - 4 && c.cx > lo - 24 && c.cx < hi + 24);
      if (!mine.length) return;
      let a = Math.max(lo, Math.min(...mine.map(c => c.cx)) - 12);
      let b = Math.min(hi, Math.max(...mine.map(c => c.cx)) + 12);
      if (b - a < 50) { a = Math.max(lo, a - 25); b = Math.min(hi, b + 25); }
      if (Math.abs(S.x - b) < Math.abs(S.x - a)) [a, b] = [b, a];

      const reachOf = () => S.x + S.dir * 14;
      const erase = () => { for (const c of mine) if (Math.abs(c.cx - reachOf()) < 30) c.s.classList.add('off'); };
      const restore = () => {
        for (const c of mine) {
          if (Math.abs(c.cx - reachOf()) >= 30 || !c.s.classList.contains('off')) continue;
          c.s.classList.remove('off');
          c.s.classList.add('shine');
          setTimeout(() => c.s.classList.remove('shine'), 450);
        }
      };

      await walkTo(a);
      say(pick(SAY.clean));
      await walkTo(b, { v: rand(30, 40), anim: 'clean', fps: 8, onFrame: erase });
      erase();
      await wait(rand(700, 1400), 'clean', 0);
      await walkTo(a, { v: rand(36, 48), anim: 'clean', fps: 8, onFrame: restore });
      restore();
      await wait(600, 'clean', 0);
    } finally {
      el.innerHTML = html;
    }
  }

  // ---- otras actividades
  async function stroll(C) {
    for (let n = Math.ceil(rand(0.5, 3)); n > 0; n--) {
      const [lo, hi] = range(C);
      let x = rand(lo, hi);
      if (Math.abs(x - S.x) < 60) x = x > S.x ? Math.min(hi, S.x + 80) : Math.max(lo, S.x - 80);
      const sprint = Math.random() < 0.2;
      await walkTo(x, { v: sprint ? rand(105, 135) : rand(50, 90) });
      const r = Math.random();
      if (r < 0.35) await wait(rand(600, 1800));
      else if (r < 0.5) await fidget();
    }
  }

  async function fidget() {
    await wait(rand(400, 900));
    for (let n = Math.ceil(rand(0.5, 2)); n > 0; n--) {
      await wait(rand(1100, 1800), 'idle', pick([1, 2, 3]));
      await wait(rand(400, 800));
    }
  }

  async function dance() {
    say(pick(SAY.dance), 3000);
    const dur = rand(3500, 6500), t0 = performance.now();
    while (performance.now() - t0 < dur) {
      render('dance', Math.floor((performance.now() - t0) / 190) % 4);
      await frame(); chk();
    }
    await wait(400);
  }

  async function sleep() {
    const since = performance.now();
    S.dir = Math.random() < 0.5 ? 1 : -1;
    await wait(260, 'fall', 3);
    for (let i = 0; i < 4; i++) await wait(650, 'sleep', i);
    let next = 0;
    while (lastInput < since && performance.now() - since < 40000) {
      if (performance.now() > next) { say(pick(SAY.sleep), 2600); next = performance.now() + 4500; }
      await wait(900, 'sleep', 2);
      await wait(900, 'sleep', 3);
    }
    say(pick(SAY.wake), 2600);
    for (let i = 3; i >= 0; i--) await wait(260, 'sleep', i);
    await wait(260, 'fall', 3);
  }

  // Se acerca a donde está el cursor (o a donde has hecho clic) y lo mira.
  async function curious(C, P, reach) {
    const m = call || mouse;
    call = null;
    mem.curious = performance.now();
    const gap = p => (p.y >= m.y - 10 ? p.y - m.y : 400 + m.y - p.y) + 0.4 * (m.x < p.l ? p.l - m.x : m.x > p.r ? m.x - p.r : 0);
    const target = P.filter(p => reach.has(p.key) && (visible(p) || p === C)).sort((a, b) => gap(a) - gap(b))[0] || C;
    say(pick(['voy, voy…', '¿me llamabas?']), 1500);
    await follow(reach.get(target.key));
    await walkTo(clampTo(target, m.x));
    S.dir = m.x >= S.x ? 1 : -1;
    say(pick(SAY.curious));
    await wait(rand(1200, 2200), 'idle', 1);
    await wait(rand(600, 1200));
  }

  // ---- el cerebro
  async function step() {
    stepGen = gen;
    const P = platforms();
    const C = P.find(p => p.key === S.key);
    if (!C || !onScreen()) return respawn(P);
    S.y = C.y;
    const reach = reachable(C, P);
    const now = performance.now();

    const jobs = cleanJobs(P, reach).filter(j => !mem.jobs.includes(j.el));
    const targets = P.filter(p => p !== C && reach.has(p.key) && visible(p));
    const acts = [];
    if (call || (now - mouse.t < 6000 && now - mem.curious > 9000)) acts.push(['curious', call ? 99 : 4]);
    if (jobs.length) acts.push(['clean', 3]);
    if (targets.length) acts.push(['explore', 4]);
    acts.push(['stroll', 2], ['fidget', 1.5], ['dance', 1]);
    if (now - lastInput > 12000) acts.push(['sleep', 7]);
    const [act] = wpick(acts, a => a[1] * (a[0] === mem.act ? 0.15 : 1));
    mem.act = act;

    switch (act) {
      case 'curious': return curious(C, P, reach);
      case 'clean': {
        const job = pick(jobs);
        await follow(reach.get(job.p.key));
        remember(mem.jobs, job.el, 5);
        return cleanJob(job);
      }
      case 'explore': {
        const t = wpick(targets, p =>
          (mem.plats.includes(p.key) ? 0.12 : 1) * (p.key === 'ground' ? 0.5 : 1) * (1 + Math.min(1, Math.abs(p.y - C.y) / 400)));
        return follow(reach.get(t.key));
      }
      case 'stroll': return stroll(C);
      case 'fidget': return fidget();
      case 'dance': return dance();
      case 'sleep': return sleep();
    }
  }

  async function main() {
    document.body.append(pet);
    pet.style.opacity = 0;
    for (;;) {
      try { await step(); }
      catch (e) {
        if (e === ABORT) S.key = null;
        else if (e !== INTERRUPT) { console.error(e); S.key = null; }
        stepGen = gen;
      }
      try { await wait(rand(300, 1200)); } catch (e) { if (e !== INTERRUPT) S.key = null; }
    }
  }

  sprite.addEventListener('click', () => { lastInput = performance.now(); say(pick(SAY.click)); });

  // el visitante: ratón, scroll y teclado deciden si se despierta, si siente curiosidad…
  const poke = () => { lastInput = performance.now(); };
  addEventListener('pointermove', e => { mouse.x = e.pageX; mouse.y = e.pageY; mouse.t = lastInput = performance.now(); }, { passive: true });
  addEventListener('scroll', poke, { passive: true });
  addEventListener('keydown', poke);
  addEventListener('pointerdown', e => {
    poke();
    if (!e.target.closest('a, button, input, textarea, select, .pet')) call = { x: e.pageX, y: e.pageY };
  });

  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => gen++, 200); });

  const start = () => Promise.all(Object.values(SHEETS).map(({ src }) => new Promise(res => {
    const img = new Image();
    img.onload = img.onerror = res;
    img.src = src;
  }))).then(() => setTimeout(main, 800));

  // No arranca solo: se activa con el enlace del footer (o con ?pet). Al animarlo sale
  // del retrato y se queda solo el fondo de matrix.
  const leaveFrame = () => {
    document.querySelector('.hero-img')?.classList.add('empty');
    document.dispatchEvent(new Event('pet:leave'));
  };
  if (new URLSearchParams(location.search).has('pet')) { leaveFrame(); start(); return; }
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = 'animar al personaje';
  link.addEventListener('click', e => { e.preventDefault(); link.remove(); leaveFrame(); start(); });
  document.querySelector('footer').append(' · ', link);
})();
