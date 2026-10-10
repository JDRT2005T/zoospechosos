// ZOOspechosos — Misiones: catálogo, minijuegos, flecha guía y mapa
(function () {
  const A = window.ZooApp, T = THREE;
  const $ = s => document.querySelector(s);
  const R = k => Mansion.RECT[k];

  // ---------- catálogo (c = corta, m = media, l = larga con 2 pasos) ----------
  const CAT = {
    panqueques: { n: 'Voltear los panqueques', e: '🍳', t: 'c', pasos: [{ k: 'C', p: r => [r.x0 + 1.8, r.cz - 0.6], j: 'tocar', o: { n: 6, emoji: '🍳', txt: '¡Toca la sartén para voltearlos!' } }] },
    focos: { n: 'Prender las luces', e: '💡', t: 'c', pasos: [{ k: 'H', p: r => [r.cx - 1.5, r.cz - 2.6], j: 'interruptores', o: { n: 5 } }] },
    basura: { n: 'Sacar la basura', e: '🗑️', t: 'c', pasos: [{ k: 'D', p: r => [r.x1 - 1.2, r.z1 - 1.2], j: 'mantener', o: { seg: 2.5, emoji: '🗑️', txt: 'Mantén presionada la palanca' } }] },
    regar: { n: 'Regar las plantas', e: '🌱', t: 'c', pasos: [{ k: 'O', p: r => [r.cx - 1.75, r.cz + 2.4], j: 'mantener', o: { seg: 3, emoji: '🚿', txt: 'Mantén presionado para regar' } }] },
    bola: { n: 'Meter la bola', e: '🎱', t: 'c', pasos: [{ k: 'A', p: r => [r.cx + 0.5, r.cz - 0.2], j: 'punteria', o: { aciertos: 3 } }] },
    inodoro: { n: 'Bajar el agua', e: '🚽', t: 'c', pasos: [{ k: 'W', p: r => [r.cx - 1.6, r.cz + 0.1], j: 'mantener', o: { seg: 2, emoji: '🚽', txt: 'Mantén presionada la palanca' } }] },
    cables: { n: 'Conectar los cables', e: '🔌', t: 'm', pasos: [{ k: 'E', p: r => [r.x0 + 1.5, r.cz], j: 'cables', o: { n: 4 } }] },
    codigo: { n: 'Código de seguridad', e: '🔢', t: 'm', pasos: [{ k: 'G', p: r => [r.cx + 1.0, r.z0 + 2.3], j: 'codigo', o: { largo: 5 } }] },
    coctel: { n: 'Preparar el cóctel', e: '🍹', t: 'm', pasos: [{ k: 'B', p: r => [r.cx - 6, r.z0 + 1.4], j: 'memoria', o: { n: 4, items: ['🍋', '🍓', '🧊', '🍍', '🥥', '🌿'] } }] },
    pesas: { n: 'Levantar pesas', e: '🏋️', t: 'm', pasos: [{ k: 'I', p: r => [r.cx + 3, r.cz + 2.1], j: 'tocar', o: { n: 15, tiempo: 6, emoji: '🏋️', txt: '¡15 toques en 6 segundos!' } }] },
    hojas: { n: 'Limpiar la piscina', e: '🍃', t: 'm', pasos: [{ k: 'P', p: r => [r.cx, r.cz + 3.7], j: 'atrapar', o: { n: 8, emoji: '🍃' } }] },
    carro: { n: 'Arreglar el carro', e: '🚗', t: 'l', pasos: [
      { k: 'S', p: r => [r.cx + 2.2, r.cz], j: 'mantener', o: { seg: 2.5, emoji: '🧰', txt: 'Saca la caja de herramientas' } },
      { k: 'T', p: r => [r.cx + 3.1, r.cz], j: 'memoria', o: { n: 5, items: ['🔴', '🟢', '🔵', '🟡'], colores: true } }] },
    libros: { n: 'Ordenar los libros', e: '📚', t: 'l', pasos: [
      { k: 'L', p: r => [r.cx, r.cz + 2.6], j: 'ordenar', o: { n: 6 } },
      { k: 'J', p: r => [r.cx + 1.5, r.cz - 0.9], j: 'mantener', o: { seg: 2, emoji: '📚', txt: 'Deja los libros en la banca' } }] },
    pastel: { n: 'El pastel de la fiesta', e: '🎂', t: 'l', pasos: [
      { k: 'C', p: r => [r.cx + 0.8, r.cz + 1.5], j: 'punteria', o: { aciertos: 2, txt: '¡Saca el pastel del horno a tiempo!' } },
      { k: 'V', p: r => [r.cx, r.cz + 1.8], j: 'memoria', o: { n: 4, items: ['🍓', '🍒', '🍫', '🕯️', '🍬'] } }] },
  };
  const POR_TIPO = { c: [], m: [], l: [] };
  Object.entries(CAT).forEach(([id, m]) => POR_TIPO[m.t].push(id));
  const pos = (id, i) => { const s = CAT[id].pasos[i]; const [x, z] = s.p(R(s.k)); return Mansion.colisionar({ x, z }); };

  // ---------- reparto (lo hace el anfitrión) ----------
  function asignar(ids, cfg) {
    const t = {};
    const azar = (lista, n) => lista.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(n, lista.length));
    ids.forEach(id => t[id] = [...azar(POR_TIPO.c, cfg.cortas), ...azar(POR_TIPO.m, cfg.medias), ...azar(POR_TIPO.l, cfg.largas)]);
    return t;
  }

  // ---------- estado de la partida ----------
  let tareas = {}, roles = {}, hechos = {}, miId = null, activo = false;
  const pasosHechos = (pid, mid) => (hechos[pid] && hechos[pid][mid]) || 0;
  const terminada = (pid, mid) => pasosHechos(pid, mid) >= CAT[mid].pasos.length;
  function progreso() {
    let total = 0, listo = 0;
    Object.keys(tareas).forEach(pid => {
      if (roles[pid] !== 't') return;
      tareas[pid].forEach(mid => { total += CAT[mid].pasos.length; listo += Math.min(pasosHechos(pid, mid), CAT[mid].pasos.length); });
    });
    return total ? listo / total : 0;
  }

  // ---------- marcadores 3D de mis misiones ----------
  const marcas = new T.Group(); A.escena.add(marcas);
  const flecha = new T.Mesh(new T.ConeGeometry(0.22, 0.6, 3), window.neon('#ffd93d', 3));
  flecha.rotation.x = Math.PI / 2; const flechaG = new T.Group(); flechaG.add(flecha); flecha.position.z = 1.1; A.escena.add(flechaG); flechaG.visible = false;
  let texExcl = null;
  function marca(x, z) {
    if (!texExcl) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#ffd93d'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.fillStyle = '#3a1d00'; g.font = '900 44px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 35);
      texExcl = new T.CanvasTexture(c); texExcl.colorSpace = T.SRGBColorSpace;
    }
    const g = new T.Group(); g.position.set(x, 0, z);
    const s = new T.Sprite(new T.SpriteMaterial({ map: texExcl, depthTest: false })); s.scale.setScalar(0.55); s.position.y = 1.7; s.renderOrder = 9; g.add(s);
    const aro = new T.Mesh(new T.RingGeometry(0.45, 0.6, 28), window.neon('#ffd93d', 2.5)); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.04; g.add(aro);
    g.userData.s = s; marcas.add(g); return g;
  }
  let pendientes = []; // [{ mid, paso, x, z, marca }]
  function rehacerMarcas() {
    marcas.clear(); pendientes = [];
    (tareas[miId] || []).forEach(mid => {
      const paso = pasosHechos(miId, mid);
      if (paso >= CAT[mid].pasos.length) return;
      const p = pos(mid, paso);
      pendientes.push({ mid, paso, x: p.x, z: p.z, marca: marca(p.x, p.z) });
    });
    pintarLista();
  }
  function pintarLista() {
    const l = $('#h-tareas'); if (!l) return;
    const imp = roles[miId] === 'i';
    l.innerHTML = (imp ? '<small>Tareas falsas (finge 😈)</small>' : '') + (tareas[miId] || []).map(mid => {
      const m = CAT[mid], h = pasosHechos(miId, mid), ok = h >= m.pasos.length;
      const sig = ok ? '' : Mansion.AREAS[m.pasos[Math.min(h, m.pasos.length - 1)].k].n;
      return `<div class="${ok ? 'ok' : ''}">${m.e} ${m.n}${m.pasos.length > 1 ? ` (${Math.min(h, m.pasos.length)}/${m.pasos.length})` : ''}${ok ? ' ✔' : `<small>📍 ${sig}</small>`}</div>`;
    }).join('');
    const p = progreso();
    $('#h-barra i').style.width = Math.round(p * 100) + '%';
  }

  function iniciar(t, r, id) {
    tareas = t || {}; roles = r || {}; hechos = {}; miId = id; activo = true;
    rehacerMarcas();
  }
  function terminar() { activo = false; extras = []; cerrar(); marcas.clear(); pendientes = []; flechaG.visible = false; $('#b-usar').hidden = true; }

  // ---------- estaciones extra (arreglar sabotajes) ----------
  let extras = []; // [{ x, z, e, tit, j, o, alListo }]
  function setExtras(lista) { extras = lista || []; }

  // ---------- cada cuadro: flecha, botón USAR ----------
  let cerca = null;
  const cerca2 = (lista, yp) => { let m = null, d = 1e9; lista.forEach(p => { const k = Math.hypot(p.x - yp.x, p.z - yp.z); if (k < d) { d = k; m = p; } }); return [m, d]; };
  function cuadro(dt, t, yp, puedeUsar, verMarcas) {
    if (!activo) return;
    marcas.visible = verMarcas;
    marcas.children.forEach((g, i) => { g.userData.s.position.y = 1.7 + Math.sin(t * 3 + i) * 0.12; });
    const [mejor, dMejor] = cerca2(pendientes, yp);
    const [ext, dExt] = cerca2(puedeUsar ? extras : [], yp);
    // la flecha: primero los sabotajes (rojo), si no la misión más cercana (amarillo)
    const meta = ext || mejor, dMeta = ext ? dExt : dMejor;
    flechaG.visible = verMarcas && !!meta && dMeta > 2.5;
    flecha.material.color.copy(ext ? new T.Color('#ff2e2e').multiplyScalar(3) : new T.Color('#ffd93d').multiplyScalar(3));
    if (meta) { flechaG.position.set(yp.x, 0.12, yp.z); flechaG.rotation.y = Math.atan2(meta.x - yp.x, meta.z - yp.z); }
    cerca = !puedeUsar ? null : (ext && dExt < 1.6) ? ext : (mejor && dMejor < 1.5 ? mejor : null);
    const b = $('#b-usar');
    b.hidden = !puedeUsar;
    b.classList.toggle('listo', !!cerca);
    b.querySelector('span').textContent = cerca ? (cerca.mid ? CAT[cerca.mid].e : cerca.e) : '✋';
  }
  $('#b-usar').addEventListener('click', () => {
    if (!cerca || abierta()) return;
    if (cerca.mid) abrir(cerca);
    else abrirJuego(cerca.tit, cerca.j, cerca.o, cerca.alListo);
  });

  // ---------- panel del minijuego ----------
  let actual = null, alTerminar = null;
  const abierta = () => !!actual;
  function abrir(p) {
    actual = p;
    const m = CAT[p.mid], s = m.pasos[p.paso];
    $('#mj-tit').textContent = m.e + ' ' + m.n + (m.pasos.length > 1 ? ` (${p.paso + 1}/${m.pasos.length})` : '');
    const caja = $('#mj-caja'); caja.innerHTML = '';
    $('#mision').classList.add('ver');
    JUEGOS[s.j](caja, s.o, () => {
      caja.insertAdjacentHTML('beforeend', '<div class="mj-listo">✔ ¡LISTO!</div>');
      A.bip(880, 0.12); setTimeout(() => A.bip(1320, 0.15), 110);
      const hecho = actual; setTimeout(() => { cerrar(); if (alTerminar) alTerminar(hecho.mid, hecho.paso + 1); }, 650);
    });
  }
  function abrirJuego(tit, j, o, alListo) {
    actual = { extra: true };
    $('#mj-tit').textContent = tit;
    const caja = $('#mj-caja'); caja.innerHTML = '';
    $('#mision').classList.add('ver');
    JUEGOS[j](caja, o, () => {
      caja.insertAdjacentHTML('beforeend', '<div class="mj-listo">✔ ¡ARREGLADO!</div>');
      A.bip(880, 0.12); setTimeout(() => A.bip(1320, 0.15), 110);
      setTimeout(() => { cerrar(); alListo(); }, 650);
    });
  }
  function cerrar() { actual = null; $('#mision').classList.remove('ver'); $('#mj-caja').innerHTML = ''; limpiarTimers(); }
  $('#mj-cerrar').addEventListener('click', cerrar);

  // la partida avisa cuando alguien termina un paso
  function alHecho(m) {
    hechos[m.id] = hechos[m.id] || {};
    hechos[m.id][m.m] = Math.max(hechos[m.id][m.m] || 0, m.paso);
    if (m.id === miId) rehacerMarcas(); else pintarLista();
  }

  // ================= MINIJUEGOS =================
  let timers = [];
  const limpiarTimers = () => { timers.forEach(clearInterval); timers.forEach(clearTimeout); timers = []; };
  const h = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
  const mezclar = a => a.slice().sort(() => Math.random() - 0.5);
  const JUEGOS = {
    // tocar N veces (con tiempo opcional)
    tocar(c, o, fin) {
      c.append(h(`<p class="mj-txt">${o.txt}</p>`));
      const b = h(`<button class="mj-gordo">${o.emoji}</button>`), n = h(`<div class="mj-num">0 / ${o.n}</div>`), barra = h('<div class="mj-barra"><i></i></div>');
      c.append(b, n); if (o.tiempo) c.append(barra);
      let k = 0, inicio = 0;
      b.addEventListener('pointerdown', () => {
        if (o.tiempo && (!inicio || performance.now() - inicio > o.tiempo * 1000)) { k = 0; inicio = performance.now(); }
        k++; n.textContent = `${k} / ${o.n}`; b.classList.remove('pum'); void b.offsetWidth; b.classList.add('pum'); A.bip(500 + k * 40, 0.05);
        if (k >= o.n) { b.disabled = true; fin(); }
      });
      if (o.tiempo) timers.push(setInterval(() => { const q = inicio ? Math.max(0, 1 - (performance.now() - inicio) / (o.tiempo * 1000)) : 1; barra.firstChild.style.width = q * 100 + '%'; if (inicio && q <= 0 && k < o.n) { k = 0; inicio = 0; n.textContent = `0 / ${o.n}`; } }, 50));
    },
    // mantener presionado
    mantener(c, o, fin) {
      c.append(h(`<p class="mj-txt">${o.txt}</p>`));
      const b = h(`<button class="mj-gordo">${o.emoji}</button>`), barra = h('<div class="mj-barra"><i></i></div>');
      c.append(b, barra);
      let lleno = 0, apretado = false, listo = false;
      const on = () => apretado = true, off = () => apretado = false;
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
      timers.push(setInterval(() => {
        if (listo) return;
        lleno = Math.max(0, Math.min(1, lleno + (apretado ? 0.05 / o.seg : -0.03)));
        barra.firstChild.style.width = lleno * 100 + '%'; b.classList.toggle('apretado', apretado);
        if (lleno >= 1) { listo = true; fin(); }
      }, 50));
    },
    // prender todos los interruptores
    interruptores(c, o, fin) {
      c.append(h('<p class="mj-txt">Prende todos los interruptores 💡</p>'));
      const g = h('<div class="mj-fila"></div>'); c.append(g);
      const est = Array.from({ length: o.n }, () => Math.random() < 0.5); if (est.every(x => x)) est[0] = false;
      est.forEach((on, i) => {
        const b = h(`<button class="mj-inter ${on ? 'on' : ''}"><i></i></button>`);
        b.onclick = () => { est[i] = !est[i]; b.classList.toggle('on', est[i]); A.bip(est[i] ? 900 : 400, 0.05); if (est.every(x => x)) fin(); };
        g.append(b);
      });
    },
    // tocar cuando la bola pasa por la zona verde
    punteria(c, o, fin) {
      c.append(h(`<p class="mj-txt">${o.txt || '¡Toca cuando la bola esté en lo verde!'}</p>`));
      const pista = h('<div class="mj-pista"><b></b><i></i></div>'), n = h(`<div class="mj-num">0 / ${o.aciertos}</div>`), b = h('<button class="btn grande">¡AHORA!</button>');
      c.append(pista, n, b);
      let x = 0, v = 0.9, aciertos = 0, zona = 0.4;
      const verde = pista.querySelector('b'), bola = pista.querySelector('i');
      const ponerZona = () => { zona = 0.15 + Math.random() * 0.6; verde.style.left = zona * 100 + '%'; };
      ponerZona();
      let ultimo = performance.now();
      timers.push(setInterval(() => { const ahora = performance.now(), dt = (ahora - ultimo) / 1000; ultimo = ahora; x += v * dt; if (x > 1) { x = 1; v = -v; } if (x < 0) { x = 0; v = -v; } bola.style.left = x * 100 + '%'; }, 16));
      b.onclick = () => {
        if (x >= zona && x <= zona + 0.16) { aciertos++; A.bip(1200, 0.08); v *= 1.25; ponerZona(); } else { aciertos = 0; A.bip(200, 0.15, 'sawtooth', 0.04); }
        n.textContent = `${aciertos} / ${o.aciertos}`;
        if (aciertos >= o.aciertos) { b.disabled = true; fin(); }
      };
    },
    // conectar cables por color
    cables(c, o, fin) {
      c.append(h('<p class="mj-txt">Toca un cable y luego el de su mismo color</p>'));
      const cols = ['#ff4d6d', '#ffd93d', '#2ee6d6', '#8b5cff', '#5effa0'].slice(0, o.n);
      const izq = mezclar(cols), der = mezclar(cols);
      const g = h('<div class="mj-cables"><div></div><div></div></div>'); c.append(g);
      let sel = null, hechos = 0;
      const crear = (lado, lista) => lista.forEach(col => {
        const b = h(`<button class="mj-cable" style="--c:${col}"></button>`); b.dataset.c = col;
        b.onclick = () => {
          if (b.classList.contains('ok')) return;
          if (lado === 0) { if (sel) sel.classList.remove('sel'); sel = b; b.classList.add('sel'); A.bip(600, 0.04); return; }
          if (!sel) return;
          if (sel.dataset.c === col) { sel.classList.add('ok'); b.classList.add('ok'); sel.classList.remove('sel'); sel = null; hechos++; A.bip(1000, 0.08); if (hechos >= o.n) fin(); }
          else { A.bip(180, 0.15, 'sawtooth', 0.04); sel.classList.remove('sel'); sel = null; }
        };
        g.children[lado].append(b);
      });
      crear(0, izq); crear(1, der);
    },
    // escribir el código
    codigo(c, o, fin) {
      const cod = o.cod || Array.from({ length: o.largo }, () => Math.floor(Math.random() * 10)).join('');
      c.append(h(o.oculto ? '<p class="mj-txt">Escribe el código que viste en la pantalla del Invernadero 🧪</p>' : `<p class="mj-txt">Escribe el código: <b class="mj-cod">${cod}</b></p>`));
      const pantalla = h('<div class="mj-pantalla">_</div>'), tec = h('<div class="mj-teclado"></div>'); c.append(pantalla, tec);
      let txt = '';
      [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✔'].forEach(k => {
        const b = h(`<button>${k}</button>`); tec.append(b);
        b.onclick = () => {
          if (k === '⌫') txt = txt.slice(0, -1);
          else if (k === '✔') { if (txt === cod) return fin(); txt = ''; A.bip(180, 0.2, 'sawtooth', 0.04); pantalla.classList.add('mal'); setTimeout(() => pantalla.classList.remove('mal'), 400); }
          else if (txt.length < o.largo) { txt += k; A.bip(700 + k * 30, 0.04); }
          pantalla.textContent = txt || '_';
          if (txt === cod) { setTimeout(fin, 200); }
        };
      });
    },
    // memorizar una secuencia
    memoria(c, o, fin) {
      c.append(h('<p class="mj-txt">Mira el orden y repítelo 👀</p>'));
      const sec = Array.from({ length: o.n }, () => o.items[Math.floor(Math.random() * o.items.length)]);
      const muestra = h('<div class="mj-muestra"></div>'), g = h('<div class="mj-fila"></div>'); c.append(muestra, g);
      const botones = o.items.map(it => { const b = h(`<button class="mj-item ${o.colores ? 'color' : ''}">${it}</button>`); g.append(b); return b; });
      let paso = 0, mostrando = true;
      botones.forEach(b => b.disabled = true);
      sec.forEach((it, i) => timers.push(setTimeout(() => { muestra.textContent = it; A.bip(500 + o.items.indexOf(it) * 120, 0.15); timers.push(setTimeout(() => muestra.textContent = '', 450)); }, 600 + i * 700)));
      timers.push(setTimeout(() => { mostrando = false; muestra.textContent = '¡Tu turno!'; botones.forEach(b => b.disabled = false); }, 600 + sec.length * 700));
      botones.forEach(b => b.onclick = () => {
        if (mostrando) return;
        if (b.textContent === sec[paso]) { paso++; A.bip(600 + paso * 100, 0.06); muestra.textContent = sec.slice(0, paso).join(' '); if (paso >= sec.length) { botones.forEach(x => x.disabled = true); fin(); } }
        else { paso = 0; muestra.textContent = '❌ Otra vez'; A.bip(180, 0.2, 'sawtooth', 0.04); }
      });
    },
    // tocar los números en orden
    ordenar(c, o, fin) {
      c.append(h('<p class="mj-txt">Toca los libros del 1 al ' + o.n + ' 📚</p>'));
      const g = h('<div class="mj-fila libros"></div>'); c.append(g);
      let sig = 1;
      mezclar(Array.from({ length: o.n }, (_, i) => i + 1)).forEach(k => {
        const b = h(`<button class="mj-libro" style="--c:hsl(${k * 55},70%,55%)">${k}</button>`); g.append(b);
        b.onclick = () => { if (k === sig) { sig++; b.classList.add('ok'); b.disabled = true; A.bip(500 + k * 80, 0.06); if (sig > o.n) fin(); } else { A.bip(180, 0.15, 'sawtooth', 0.04); } };
      });
    },
    // atrapar cosas que se mueven
    atrapar(c, o, fin) {
      c.append(h('<p class="mj-txt">¡Atrapa las hojas que flotan!</p>'));
      const zona = h('<div class="mj-agua"></div>'), n = h(`<div class="mj-num">0 / ${o.n}</div>`); c.append(zona, n);
      let k = 0;
      const hojas = Array.from({ length: o.n }, () => {
        const b = h(`<button class="mj-hoja">${o.emoji}</button>`); zona.append(b);
        const d = { x: Math.random() * 85, y: Math.random() * 80, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, b };
        b.onclick = () => { b.remove(); d.fuera = true; k++; n.textContent = `${k} / ${o.n}`; A.bip(800 + k * 40, 0.05); if (k >= o.n) fin(); };
        return d;
      });
      let ultimo = performance.now();
      timers.push(setInterval(() => {
        const ahora = performance.now(), dt = (ahora - ultimo) / 1000; ultimo = ahora;
        hojas.forEach(d => { if (d.fuera) return; d.x += d.vx * dt; d.y += d.vy * dt; if (d.x < 0 || d.x > 85) d.vx *= -1; if (d.y < 0 || d.y > 80) d.vy *= -1; d.b.style.left = d.x + '%'; d.b.style.top = d.y + '%'; });
      }, 30));
    },
  };

  // ---------- mapa ----------
  function dibujarMapa(yp, otros) {
    const cv = $('#mapa-lienzo'), P = Mansion.PLANO, F = P.length, C = P[0].length;
    const tam = Math.floor(Math.min((innerWidth - 60) / C, (innerHeight - 190) / F));
    cv.width = C * tam; cv.height = F * tam;
    const g = cv.getContext('2d');
    g.fillStyle = '#0d0420'; g.fillRect(0, 0, cv.width, cv.height);
    for (let f = 0; f < F; f++) for (let c = 0; c < C; c++) {
      const ch = P[f][c]; if (ch === '.') continue;
      const k = Mansion.zonaDe((c + 0.5) * 2 - Mansion.MX, (f + 0.5) * 2 - Mansion.MZ);
      g.fillStyle = ch === '+' ? '#5effa0' : (k >= 'a' && k <= 'z') ? '#6b1a33' : (Mansion.AREAS[k] ? Mansion.AREAS[k].c[0] : '#333');
      g.fillRect(c * tam, f * tam, tam, tam);
    }
    g.font = `900 ${Math.max(9, tam * 0.55)}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    Object.entries(Mansion.RECT).forEach(([k, r]) => {
      if (k >= 'a' && k <= 'z') return;
      const x = (r.cx + Mansion.MX) / 2 * tam, y = (r.cz + Mansion.MZ) / 2 * tam;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(Mansion.AREAS[k].n, x + 1, y + 1); g.fillStyle = '#fff'; g.fillText(Mansion.AREAS[k].n, x, y);
    });
    const punto = (x, z, col, r) => { g.fillStyle = col; g.beginPath(); g.arc((x + Mansion.MX) / 2 * tam, (z + Mansion.MZ) / 2 * tam, r, 0, 7); g.fill(); };
    pendientes.forEach(p => { punto(p.x, p.z, '#3a1d00', tam * 0.45); punto(p.x, p.z, '#ffd93d', tam * 0.35); });
    punto(yp.x, yp.z, '#ffffff', tam * 0.55); punto(yp.x, yp.z, '#2ee6d6', tam * 0.4);
  }
  $('#b-mapa').addEventListener('click', () => { dibujarMapa(ZooSala.interno.yoPos); A.abrir('#m-mapa'); });

  window.ZooMisiones = {
    CAT, asignar, iniciar, terminar, cuadro, progreso, alHecho, abierta, cerrar, setExtras,
    set alTerminar(f) { alTerminar = f; },
    pendientesMias: () => pendientes.length,
    _dbg: { abrir: (mid, paso) => abrir({ mid, paso: paso || 0 }), completarTodo: () => { (tareas[miId] || []).forEach(mid => { for (let p = pasosHechos(miId, mid); p < CAT[mid].pasos.length; p++) alTerminar(mid, p + 1); }); }, get pendientes() { return pendientes; } }, // para pruebas
  };
})();
