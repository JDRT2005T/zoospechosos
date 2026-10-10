// ZOOspechosos — Parte 3A: la partida en la Mansión (roles, matar con granada 💣, fantasmas, final)
(function () {
  const A = window.ZooApp, sb = A.sb, T = THREE;
  const S = () => ZooSala.interno;
  const $ = s => document.querySelector(s);
  A.escena.add(Mansion.grupo);

  // ---------- estado ----------
  let activo = false, roles = {}, nInicial = 0;
  const muertos = new Set();        // ya son fantasmas
  const muriendo = new Map();       // víctima -> animación en curso
  let enfriaHasta = 0, mostrandoRol = false, terminando = false, objetivo = null;
  const restos = [];                // cuerpos, sangre y pedazos (se borran al final)
  const pedazos = [];               // pedazos que todavía vuelan

  const miId = () => S().miId();
  const rol = id => roles[id];
  const soyImpostor = () => rol(miId()) === 'i';
  const soyFantasma = () => muertos.has(miId());
  const sangre = () => A.sangre !== 'no';
  const vivo = id => roles[id] && !muertos.has(id) && !muriendo.has(id);

  // ================= SONIDOS =================
  let ctx = null;
  const audio = () => { if (A.sonido === 'no') return null; try { return ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } };
  function explosionSonido(cerca) {
    const c = audio(); if (!c) return;
    const dur = 1.1, buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.value = cerca ? 0.5 : 0.15;
    src.connect(f).connect(g).connect(c.destination); src.start();
    const o = c.createOscillator(), g2 = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, c.currentTime); o.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.6);
    g2.gain.value = cerca ? 0.4 : 0.12; g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.7); o.connect(g2).connect(c.destination); o.start(); o.stop(c.currentTime + 0.7);
  }

  // ================= EMPEZAR =================
  function comenzar(d) {
    activo = true; terminando = false; roles = d.roles || {}; nInicial = Object.keys(roles).length;
    muertos.clear(); muriendo.clear(); limpiarRestos();
    enfriaHasta = Date.now() + 12000; // al principio el impostor espera un poco
    const s = d.salidas && d.salidas[miId()];
    const yp = S().yoPos;
    if (s) { yp.x = s[0]; yp.z = s[1]; yp.r = Math.PI; }
    // ubicar a todos en su salida
    Object.entries(d.salidas || {}).forEach(([id, p]) => { const v = S().pjs.get(id); if (v) { v.cx = v.tx = p[0]; v.cz = v.tz = p[1]; v.cr = v.tr = Math.PI; v.posLista = true; v.caida = 0; v.efecto = null; } });
    // fundido a negro → mostrar rol → la mansión
    const f = $('#fundido'); f.classList.add('ver');
    setTimeout(() => {
      Salon.grupo.visible = false; Mansion.grupo.visible = true; Mansion.reiniciarVista();
      $('#p-sala').classList.add('en-juego');
      S().reiniciarCamara(); S().enviarPos(true);
      pintarHud();
      mostrarRol();
      f.classList.remove('ver');
    }, 600);
  }

  function mostrarRol() {
    mostrandoRol = true;
    const imp = soyImpostor();
    const r = $('#revelar');
    const otrosImp = Object.keys(roles).filter(id => roles[id] === 'i' && id !== miId()).map(S().nombreDe);
    const nImp = Object.values(roles).filter(x => x === 'i').length;
    r.className = imp ? 'impostor ver' : 'tripulante ver';
    $('#r-tit').textContent = imp ? 'IMPOSTOR' : 'TRIPULANTE';
    $('#r-ico').textContent = imp ? '🔪' : '🐾';
    $('#r-sub').textContent = imp ? 'Elimina a todos sin que te descubran 😈' : (nImp === 1 ? 'Hay 1 impostor entre ustedes 👀' : `Hay ${nImp} impostores entre ustedes 👀`);
    $('#r-equipo').textContent = imp && otrosImp.length ? 'Tu compañero: ' + otrosImp.join(', ') : '';
    [196, 147, 110].forEach((fr, i) => setTimeout(() => A.bip(fr, 0.5, imp ? 'sawtooth' : 'triangle', 0.06), i * 260));
    setTimeout(() => { r.classList.remove('ver'); mostrandoRol = false; }, 3800);
  }

  function pintarHud() {
    const imp = soyImpostor(), fan = soyFantasma();
    const b = $('#h-rol');
    b.className = 'h-rol ' + (fan ? 'fantasma' : imp ? 'impostor' : 'tripulante');
    const comp = Object.keys(roles).filter(id => roles[id] === 'i' && id !== miId()).map(S().nombreDe);
    b.innerHTML = fan ? '👻 FANTASMA' : imp ? '🔪 IMPOSTOR' + (comp.length ? `<small>con ${comp.map(escapar).join(', ')}</small>` : '') : '🐾 TRIPULANTE';
    const vivosN = Object.keys(roles).filter(vivo).length;
    $('#h-vivos').textContent = '🐾 ' + vivosN + ' vivos';
    $('#b-matar').hidden = !imp || fan;
    $('#b-terminar').hidden = !S().soyHost();
  }
  const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================= MATAR =================
  $('#b-matar').addEventListener('click', () => {
    if (!activo || !soyImpostor() || soyFantasma() || bloqueado()) return;
    if (Date.now() < enfriaHasta || !objetivo) return;
    const v = S().pjs.get(objetivo); if (!v) return;
    enfriaHasta = Date.now() + S().cfg().enfriamiento * 1000;
    S().enviar('muerte', { a: miId(), v: objetivo, x: +v.cx.toFixed(2), z: +v.cz.toFixed(2), r: +v.cr.toFixed(2) });
  });

  // ---- escenario de cine (lejos del mapa): ahí ven la escena el impostor y la víctima ----
  const SET = new T.Vector3(0, 0, 260);
  const set = new T.Group(); set.position.copy(SET); set.visible = false; A.escena.add(set);
  (function () {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#12001f'); gr.addColorStop(0.55, '#5a0d3a'); gr.addColorStop(1, '#ff3d6e');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const fondo = new T.Mesh(new T.CylinderGeometry(9, 9, 9, 40, 1, true), new T.MeshBasicMaterial({ map: tex, side: T.BackSide }));
    fondo.position.y = 4.4; set.add(fondo);
    const suelo = new T.Mesh(new T.CircleGeometry(9, 40), new T.MeshStandardMaterial({ color: '#2a0a2e', roughness: 0.6 }));
    suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; set.add(suelo);
    const foco = new T.Mesh(new T.CircleGeometry(1.8, 40), new T.MeshBasicMaterial({ color: new T.Color('#ff9ec7').multiplyScalar(0.6), transparent: true, opacity: 0.35, depthWrite: false }));
    foco.rotation.x = -Math.PI / 2; foco.position.y = 0.01; set.add(foco);
    const luz = new T.PointLight('#ffd1e8', 14, 9); luz.position.set(0, 3.2, 2); set.add(luz);
  })();

  function hacerGranada() {
    const g = new T.Group();
    const c = new T.Mesh(new T.SphereGeometry(0.11, 12, 10), new T.MeshToonMaterial({ color: '#3a5a2a' })); c.scale.y = 1.25; g.add(c);
    const tapa = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.07, 10), new T.MeshToonMaterial({ color: '#888' })); tapa.position.y = 0.15; g.add(tapa);
    const anilla = new T.Mesh(new T.TorusGeometry(0.05, 0.012, 6, 14), new T.MeshToonMaterial({ color: '#ffd93d' })); anilla.position.set(0.07, 0.17, 0); g.add(anilla);
    g.position.y = -0.45;
    return g;
  }
  function hacerBrillo() {
    const b = new T.Mesh(new T.SphereGeometry(0.62, 18, 14), new T.MeshBasicMaterial({ color: '#ff1a1a', transparent: true, opacity: 0, depthWrite: false }));
    b.scale.set(1, 1.45, 1); b.position.y = 0.95; return b;
  }
  const ropaDe = id => S().jugadores.find(j => j.id === id) || {};

  function alMuerte(m) {
    if (!activo || rol(m.a) !== 'i' || !vivo(m.a) || !vivo(m.v) || rol(m.v) === 'i') return;
    const vv = S().pjs.get(m.v), va = S().pjs.get(m.a);
    if (!vv || !va) return;
    // la víctima se congela; el impostor aparece detrás
    const fx = Math.sin(m.r), fz = Math.cos(m.r);
    const kx = m.x - fx * 0.75, kz = m.z - fz * 0.75;
    const yp = S().yoPos;
    if (m.v === miId()) { yp.x = m.x; yp.z = m.z; yp.r = m.r; S().enviarPos(true); }
    else { vv.cx = vv.tx = m.x; vv.cz = vv.tz = m.z; vv.cr = vv.tr = m.r; }
    if (m.a === miId()) { yp.x = kx; yp.z = kz; yp.r = m.r; S().enviarPos(true); }
    else { va.cx = va.tx = kx; va.cz = va.tz = kz; va.cr = va.tr = m.r; }
    const k = { a: m.a, v: m.v, x: m.x, z: m.z, r: m.r, t: 0, fase: 0 };
    // en el mapa (lo ven los demás)
    k.granada = hacerGranada(); va.obj.userData.brazos[1].add(k.granada);
    k.brillo = hacerBrillo(); vv.obj.userData.cuerpo.add(k.brillo);
    // en el escenario de cine (lo ven el impostor y la víctima)
    if (m.a === miId() || m.v === miId()) {
      k.ca = Zoo.crear(ropaDe(m.a)); k.cv = Zoo.crear(ropaDe(m.v));
      k.cv.position.set(-0.6, 0, 0); k.ca.position.set(0.42, 0, 0);
      k.cv.rotation.y = k.ca.rotation.y = -Math.PI / 2; // miran hacia la izquierda; el brazo derecho del impostor da a la cámara
      set.add(k.ca); set.add(k.cv); set.visible = true;
      S().reiniciarCamara(); // la cámara salta directo al escenario
      k.cGranada = hacerGranada(); k.ca.userData.brazos[1].add(k.cGranada);
      k.cBrillo = hacerBrillo(); k.cv.userData.cuerpo.add(k.cBrillo);
      $('#cine').classList.add('ver'); setTimeout(() => $('#cine').classList.remove('ver'), 2700);
    }
    muriendo.set(m.v, k);
    S().texto(m.a, '😏');
  }

  // poses de la escena (sirven para el mapa y para el escenario de cine)
  function posar(ua, uv, k, t, granada, brillo, ponerAlto) {
    if (ua) {
      const br = ua.brazos[1];
      if (t < 0.5) { br.rotation.z = 0.35 + 2.1 * (t / 0.5); br.rotation.x = 0; }
      else if (t < 0.8) { const q = (t - 0.5) / 0.3; br.rotation.z = 2.45 - 2.1 * q; br.rotation.x = -1.15 * q; ua.cuerpo.rotation.x = 0.25 * q; }
      else if (t < 2.4) { ua.brazos.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * 2.7; b.rotation.x = -0.4; }); ua.cuerpo.rotation.x = -0.15; }
      else ua.cuerpo.rotation.x = 0;
    }
    if (granada) granada.visible = t < 0.78;
    if (uv) {
      if (t >= 0.78 && t < 1.08) { ponerAlto(Math.sin((t - 0.78) / 0.3 * Math.PI) * 0.45); uv.ojos.forEach(o => o.scale.set(1.6, 1.6, 1)); }
      if (t >= 1.08 && t < 2.1) {
        ponerAlto(0);
        const q = (t - 1.08) / 1.02;
        uv.cuerpo.scale.set(1 + 0.5 * q, 1 + 0.35 * q, 1 + 0.5 * q);
        uv.cuerpo.rotation.z = (Math.random() - 0.5) * 0.18 * q;
        uv.ojos.forEach(o => o.scale.set(1.6 + q, 1.6 + q, 1));
        brillo.material.opacity = (0.15 + 0.45 * q) * (0.5 + 0.5 * Math.sin(t * (3 + q * 14) * Math.PI));
      }
    }
  }

  // ---- animación paso a paso ----
  function animarMuertes(dt) {
    muriendo.forEach((k, vid) => {
      k.t += dt; const t = k.t;
      const va = S().pjs.get(k.a), vv = S().pjs.get(k.v);
      const yp = S().yoPos;
      // mantenerlos en su lugar
      if (k.v === miId()) { yp.x = k.x; yp.z = k.z; yp.r = k.r; }
      else if (vv) { vv.cx = vv.tx = k.x; vv.cz = vv.tz = k.z; vv.cr = vv.tr = k.r; }
      posar(va && va.obj && va.obj.userData, vv && vv.obj && vv.obj.userData, k, t, k.granada, k.brillo, a => { if (vv) vv.alto = a; });
      if (k.ca) {
        Zoo.animar(k.ca, dt, 'quieto'); if (k.cv.visible) Zoo.animar(k.cv, dt, 'quieto');
        posar(k.ca.userData, k.cv.userData, k, t, k.cGranada, k.cBrillo, a => k.cv.position.y = a);
      }
      if (t >= 0.78 && k.fase === 0) { // ¡adentro!
        k.fase = 1;
        S().texto(k.v, '😳‼️'); S().texto(k.a, '🙉');
        A.bip(160, 0.12, 'sine', 0.08); setTimeout(() => A.bip(90, 0.1, 'sine', 0.08), 70);
        if (k.ca) mostrarFrase('😳 ¡¿POR AHÍ?!');
      }
      if (t >= 1.08 && t < 2.1 && t > (k.proxBip || 1.08)) { // bip… bip… bipbipbip
        const q = (t - 1.08) / 1.02;
        A.bip(1900, 0.05, 'square', 0.05); k.proxBip = t + Math.max(0.07, 0.35 * (1 - q));
      }
      if (t >= 2.1 && k.fase === 1) { k.fase = 2; explotar(k); }
      if (t >= 2.6 && k.fase === 2) { // termina
        k.fase = 3;
        if (va && va.obj) va.obj.userData.cuerpo.rotation.x = 0;
        if (k.granada.parent) k.granada.parent.remove(k.granada);
        if (k.ca) { set.remove(k.ca); set.remove(k.cv); Zoo.liberar(k.ca); Zoo.liberar(k.cv); if (![...muriendo.values()].some(x => x !== k && x.ca)) set.visible = false; S().reiniciarCamara(); }
        muriendo.delete(vid);
        pintarHud();
        if (S().soyHost()) setTimeout(revisarFin, 2600); // dejar ver la explosión antes del final
      }
    });
  }
  function mostrarFrase(txt) {
    const f = $('#frase'); f.textContent = txt; f.classList.remove('ver'); void f.offsetWidth; f.classList.add('ver');
  }

  function explotar(k) {
    const vv = S().pjs.get(k.v);
    const p = { x: k.x, y: 0.9, z: k.z };
    const yp = S().yoPos;
    const cerca = Math.hypot(yp.x - k.x, yp.z - k.z) < 9;
    explosionSonido(cerca);
    if (cerca) { S().sacudir(0.9); document.body.classList.add('sacudir'); setTimeout(() => document.body.classList.remove('sacudir'), 500); }
    const loVeo = soyFantasma() || Mansion.cuartoDe(k.x, k.z) === Mansion.cuartoDe(yp.x, yp.z) || Math.hypot(yp.x - k.x, yp.z - k.z) < 2.5;
    // fogonazo + humo + chispas (si pasó en otro cuarto, solo se escucha)
    if (loVeo) Part.rafaga(p, { n: 4, colores: ['#fff3b0', '#ffb347'], vel: 0.5, vida: 0.22, tam: 1.6, crecer: 1.5, aditivo: true, brillo: 1.6 });
    if (loVeo) { Part.impacto(p); Part.humo(p); Part.humo({ x: p.x, y: 1.3, z: p.z }); }
    if (!loVeo) { /* nada que mostrar */ } else if (sangre()) {
      Part.rafaga(p, { n: 45, colores: ['#b00000', '#e01e37', '#7a0010', '#ff2a3a'], vel: 6.5, arriba: 1.5, grav: 13, vida: 1.3, tam: 0.2, dispersion: 0.4 });
      Part.rafaga(p, { n: 14, colores: ['#8a0000', '#c1121f'], vel: 3, arriba: 1.2, grav: 9, vida: 1.0, tam: 0.45, crecer: 0.6 });
    } else {
      Part.confeti(p); Part.confeti({ x: p.x, y: 1.5, z: p.z }); Part.chispas(p);
    }
    if (k.cv) { // en el escenario de cine
      k.cv.visible = false;
      const c = { x: SET.x - 0.6, y: 0.9, z: SET.z };
      Part.rafaga(c, { n: 4, colores: ['#fff3b0', '#ffb347'], vel: 0.5, vida: 0.22, tam: 1.6, crecer: 1.5, aditivo: true, brillo: 1.6 });
      Part.impacto(c); Part.humo(c);
      if (sangre()) {
        Part.rafaga(c, { n: 70, colores: ['#b00000', '#e01e37', '#7a0010', '#ff2a3a'], vel: 6.5, arriba: 1.5, grav: 12, vida: 1.3, tam: 0.24, dispersion: 0.4 });
        Part.rafaga(c, { n: 16, colores: ['#8a0000', '#c1121f'], vel: 3, arriba: 1.3, grav: 9, vida: 1.1, tam: 0.5, crecer: 0.6 });
      } else { Part.confeti(c); Part.chispas(c); }
      lanzarPedazos({ x: SET.x - 0.6, z: SET.z }, ropaDe(k.v).color || '#ff9f43', true);
      mostrarFrase('💥 ¡BOOM!');
    }
    // el muñeco desaparece y quedan pedazos
    const jug = S().jugadores.find(j => j.id === k.v) || {};
    const color = jug.color || '#ff9f43';
    lanzarPedazos(k, color, false);
    dejarCuerpo(k, jug);
    if (vv && vv.obj) { vv.obj.userData.cuerpo.remove(k.brillo); vv.alto = 0; }
    muertos.add(k.v);
    hacerFantasma(k.v);
    if (k.v === miId()) setTimeout(() => {
      const a = $('#aviso-muerte'); a.classList.add('ver');
      setTimeout(() => a.classList.remove('ver'), 3500);
      pintarHud();
    }, 600);
  }

  // ---- pedazos volando ----
  function lanzarPedazos(k, color, libre) {
    const piel = new T.MeshToonMaterial({ color });
    const carne = new T.MeshToonMaterial({ color: sangre() ? '#a4161a' : '#ffd93d' });
    const hueso = new T.MeshToonMaterial({ color: '#fff8e7' });
    const lista = [];
    for (let i = 0; i < 6; i++) { const m = new T.Mesh(new T.SphereGeometry(0.1 + Math.random() * 0.1, 10, 8), i < 4 ? piel : carne); m.scale.set(1, 0.7 + Math.random() * 0.5, 1); lista.push(m); }
    for (let i = 0; i < 2; i++) { // huesos
      const g = new T.Group();
      const c = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.34, 8), hueso); c.rotation.z = Math.PI / 2; g.add(c);
      [-0.17, 0.17].forEach(x => [-0.035, 0.035].forEach(y => { const b = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), hueso); b.position.set(x, y, 0); g.add(b); }));
      lista.push(g);
    }
    const ojo = new T.Group(); // un ojito suelto 👁️
    ojo.add(new T.Mesh(new T.SphereGeometry(0.09, 12, 10), new T.MeshToonMaterial({ color: '#ffffff' })));
    const pup = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), new T.MeshToonMaterial({ color: '#1b1b24' })); pup.position.z = 0.06; ojo.add(pup);
    lista.push(ojo);
    lista.forEach(m => {
      m.position.set(k.x, 0.9, k.z); m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 3.5;
      m.userData = { vx: Math.cos(a) * v, vy: 4 + Math.random() * 4, vz: Math.sin(a) * v, rx: (Math.random() - 0.5) * 14, rz: (Math.random() - 0.5) * 14, quieto: false, mancha: false, libre };
      A.escena.add(m); restos.push(m); pedazos.push(m);
    });
  }
  function moverPedazos(dt) {
    for (let i = pedazos.length - 1; i >= 0; i--) {
      const m = pedazos[i], u = m.userData;
      u.vy -= 16 * dt;
      m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt;
      m.rotation.x += u.rx * dt; m.rotation.z += u.rz * dt;
      const pp = { x: m.position.x, z: m.position.z }; if (!u.libre) Mansion.colisionar(pp); // rebotan en las paredes
      if (pp.x !== m.position.x) { u.vx *= -0.4; m.position.x = pp.x; }
      if (pp.z !== m.position.z) { u.vz *= -0.4; m.position.z = pp.z; }
      if (m.position.y < 0.06) {
        m.position.y = 0.06; u.vy *= -0.32; u.vx *= 0.6; u.vz *= 0.6; u.rx *= 0.5; u.rz *= 0.5;
        if (!u.mancha) { u.mancha = true; mancha(m.position.x, m.position.z, 0.25 + Math.random() * 0.2); }
        if (Math.abs(u.vy) < 0.6) { u.vy = 0; u.vx = u.vz = 0; pedazos.splice(i, 1); }
      }
    }
  }

  // ---- manchas y charco ----
  const texMancha = {};
  function texturaMancha(tipo) {
    if (texMancha[tipo]) return texMancha[tipo];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const cols = tipo === 'sangre' ? ['#7a0010', '#a4161a', '#c1121f'] : ['#ff3d9a', '#2ee6d6', '#ffd93d', '#8b5cff', '#5effa0'];
    g.fillStyle = cols[0]; g.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, r = 34 + Math.random() * 18; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.fill();
    for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); const a = Math.random() * 6.28, r = 40 + Math.random() * 20; g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 3 + Math.random() * 7, 0, 7); g.fill(); }
    if (tipo === 'sangre') { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(52, 52, 14, 7, -0.6, 0, 7); g.fill(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return texMancha[tipo] = t;
  }
  function mancha(x, z, r, crecer) {
    const m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), new T.MeshBasicMaterial({ map: texturaMancha(sangre() ? 'sangre' : 'confeti'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28; m.position.set(x, 0.03 + Math.random() * 0.005, z);
    m.renderOrder = 1;
    if (crecer) { m.scale.setScalar(0.1); m.userData.crece = true; }
    A.escena.add(m); restos.push(m);
    return m;
  }

  // ---- medio cuerpo con el hueso afuera ----
  function dejarCuerpo(k, jug) {
    const color = jug.color || '#ff9f43';
    const g = new T.Group(); g.position.set(k.x, 0, k.z); g.rotation.y = k.r;
    const piel = new T.MeshToonMaterial({ color });
    const base = new T.Mesh(new T.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), piel); base.position.y = 0.55; g.add(base);
    const cint = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.22, 20), piel); cint.position.y = 0.66; g.add(cint);
    const corte = new T.Mesh(new T.CircleGeometry(0.48, 20), new T.MeshToonMaterial({ color: sangre() ? '#a4161a' : '#ffd93d' }));
    corte.rotation.x = -Math.PI / 2; corte.position.y = 0.775; g.add(corte);
    [-0.2, 0.2].forEach(x => { const l = new T.Mesh(new T.CapsuleGeometry(0.13, 0.12, 6, 12), piel); l.position.set(x, 0.14, 0); g.add(l); });
    const hueso = new T.MeshToonMaterial({ color: '#fff8e7' });
    const hc = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.45, 8), hueso); hc.position.set(0.05, 0.98, 0); hc.rotation.z = 0.25; g.add(hc);
    [-0.04, 0.04].forEach(dx => { const b = new T.Mesh(new T.SphereGeometry(0.065, 8, 6), hueso); b.position.set(-0.01 + dx, 1.2, 0); g.add(b); });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.01); g.userData.aparece = true;
    A.escena.add(g); restos.push(g);
    mancha(k.x, k.z, 1.3, true);
  }

  // ---- fantasma ----
  function hacerFantasma(id) {
    const v = S().pjs.get(id); if (!v || !v.obj) return;
    v.obj.traverse(o => {
      if (!o.isMesh) return;
      if (o.material.side === T.BackSide) { o.visible = false; return; } // sin contorno
      o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.material.depthWrite = false;
    });
    if (v.obj.userData.sombra) v.obj.userData.sombra.visible = false;
    v.obj.userData.cuerpo.scale.set(1, 1, 1); v.obj.userData.cuerpo.rotation.set(0, 0, 0);
    v.obj.userData.ojos.forEach(o => o.scale.set(1, 1, 1));
    v.fantasma = true;
  }

  // ================= CADA CUADRO =================
  const anillo = new T.Mesh(new T.RingGeometry(0.55, 0.7, 32), window.neon('#ff2e2e', 3));
  anillo.rotation.x = -Math.PI / 2; anillo.visible = false; A.escena.add(anillo);

  A.alCuadro.push((dt, t) => {
    if (!activo) return;
    animarMuertes(dt);
    moverPedazos(dt);
    Mansion.actualizarVista(S().yoPos.x, S().yoPos.z, dt, soyFantasma());
    const yp0 = S().yoPos, miCuarto = Mansion.cuartoDe(yp0.x, yp0.z), veTodo = soyFantasma();
    restos.forEach(r => {
      if (!r.userData.libre) r.visible = veTodo || Mansion.cuartoDe(r.position.x, r.position.z) === miCuarto || Math.hypot(r.position.x - yp0.x, r.position.z - yp0.z) < 2.5;
      if (r.userData.crece && r.scale.x < 1) r.scale.setScalar(Math.min(1, r.scale.x + dt * 1.2));
      if (r.userData.aparece && r.scale.x < 1) r.scale.setScalar(Math.min(1, r.scale.x + dt * 8));
    });
    // botón matar: ¿hay alguien cerca?
    objetivo = null;
    if (soyImpostor() && !soyFantasma()) {
      const yp = S().yoPos; let mejor = 1.8;
      S().pjs.forEach((v, id) => {
        if (id === miId() || !vivo(id) || rol(id) === 'i' || !mismoCuarto(v)) return; // no se mata a través de paredes
        const d = Math.hypot(v.cx - yp.x, v.cz - yp.z);
        if (d < mejor) { mejor = d; objetivo = id; }
      });
      const falta = Math.ceil((enfriaHasta - Date.now()) / 1000);
      const b = $('#b-matar');
      const listo = objetivo && falta <= 0 && !bloqueado();
      b.classList.toggle('listo', !!listo);
      b.querySelector('b').textContent = falta > 0 ? falta : '';
      const vo = objetivo && S().pjs.get(objetivo);
      anillo.visible = !!vo;
      if (vo) { anillo.position.set(vo.cx, 0.05, vo.cz); anillo.material.color.setRGB(3 + Math.sin(t * 8), 0.2, 0.2); }
    } else anillo.visible = false;
    // cuarto donde estoy
    const c = Mansion.cuartoDe(S().yoPos.x, S().yoPos.z);
    if (c !== ultimoCuarto) { ultimoCuarto = c; $('#h-cuarto').textContent = c ? '📍 ' + c : ''; }
  });
  let ultimoCuarto = null;

  // ================= FIN DE LA PARTIDA =================
  function revisarFin() {
    if (!activo || terminando || !S().soyHost()) return;
    const presentes = new Set(S().jugadores.map(j => j.id));
    const vivosImp = Object.keys(roles).filter(id => presentes.has(id) && roles[id] === 'i' && vivo(id)).length;
    const vivosTrip = Object.keys(roles).filter(id => presentes.has(id) && roles[id] === 't' && vivo(id)).length;
    let gana = null;
    if (vivosImp === 0) gana = 't';
    else if (nInicial >= 3 ? vivosImp >= vivosTrip : vivosTrip === 0) gana = 'i';
    if (gana) S().enviar('fin', { gana, roles });
  }
  function alFin(m) {
    if (!activo || terminando) return;
    terminando = true;
    const f = $('#final');
    const gana = m.gana;
    f.className = 'ver ' + (gana === 'i' ? 'impostor' : gana === 't' ? 'tripulante' : '');
    $('#f-tit').textContent = gana === 'i' ? '🔪 ¡GANÓ EL IMPOSTOR!' : gana === 't' ? '🐾 ¡GANÓ LA TRIPULACIÓN!' : '⏹ Partida terminada';
    const lista = Object.keys(m.roles || roles).map(id => {
      const r = (m.roles || roles)[id], muerto = muertos.has(id);
      return `<div class="f-jug ${r === 'i' ? 'imp' : ''}"><span>${r === 'i' ? '🔪' : '🐾'}</span><b>${escapar(S().nombreDe(id))}</b><small>${r === 'i' ? 'Impostor' : 'Tripulante'}${muerto ? ' · 💀' : ''}</small></div>`;
    }).join('');
    $('#f-lista').innerHTML = lista;
    const yoRol = rol(miId());
    $('#f-premio').textContent = '';
    if (gana) {
      const gane = (gana === 'i') === (yoRol === 'i');
      A.bip(gane ? 880 : 220, 0.4, gane ? 'triangle' : 'sawtooth', 0.06);
      sb.rpc('zoo_fin_partida', { gane }).then(({ data }) => {
        if (data && A.perfil) { Object.assign(A.perfil, data); $('#f-premio').textContent = (gane ? '🏆 ¡Ganaste! +25 🪙' : '+10 🪙 por jugar') + ` · Tienes ${data.monedas} 🪙`; }
      });
    }
    setTimeout(volverAlLobby, 8000);
  }

  function volverAlLobby() {
    const f = $('#fundido'); f.classList.add('ver');
    setTimeout(() => {
      $('#final').className = '';
      terminar();
      f.classList.remove('ver');
    }, 600);
  }

  // dejar todo como antes de la partida
  function terminar() {
    if (!activo) return;
    activo = false; terminando = false; mostrandoRol = false;
    muriendo.forEach(k => { if (k.granada.parent) k.granada.parent.remove(k.granada); });
    muriendo.clear(); muertos.clear(); limpiarRestos(); anillo.visible = false;
    $('#p-sala').classList.remove('en-juego');
    ['#revelar', '#aviso-muerte'].forEach(s => $(s).classList.remove('ver'));
    $('#final').className = '';
    Mansion.grupo.visible = false; Salon.grupo.visible = true;
    A.sol.position.set(3, 7, 5); A.sol.target.position.set(0, 0, 0); A.sol.target.updateMatrixWorld();
    const s = S();
    if (s.sala) {
      Object.assign(s.yoPos, Salon.lugarLibre(), { r: 0 });
      s.pjs.forEach(v => { v.clave = ''; v.fantasma = false; v.caida = 2.5; v.alto = 0; v.efecto = null; }); // volver a armar los muñecos
      if (s.yo) { s.yo.listo = false; s.canal && s.canal.track(s.yo); }
      s.reiniciarCamara(); s.pintarTodo(); s.enviarPos(true);
      if (s.soyHost()) sb.from('zoo_salas').update({ estado: 'espera', actualizado: new Date().toISOString() }).eq('codigo', s.sala.codigo).then(() => { });
    }
    roles = {};
  }
  function limpiarRestos() {
    restos.forEach(r => { A.escena.remove(r); r.traverse(o => { if (o.geometry) o.geometry.dispose(); }); });
    restos.length = 0; pedazos.length = 0;
  }

  $('#b-terminar').addEventListener('click', () => {
    if (!activo || !S().soyHost()) return;
    if (confirm('¿Terminar la partida y volver al lobby?')) S().enviar('fin', { gana: null, roles });
  });

  // ver solo lo de tu cuarto (o alguien pegadito en la puerta)
  function mismoCuarto(v) {
    const yp = S().yoPos;
    if (Math.hypot(v.cx - yp.x, v.cz - yp.z) < 1.6) return true;
    return Mansion.cuartoDe(v.cx, v.cz) === Mansion.cuartoDe(yp.x, yp.z);
  }

  // cámara de cine (como en Among Us) para el impostor y la víctima
  function cine() {
    for (const k of muriendo.values()) {
      if (!k.ca) continue;
      const atras = k.t > 2.1 ? 1.8 : 0;
      return { pos: [SET.x - 0.05, 1.45 + atras * 0.4, SET.z + 4.4 + atras], mira: [SET.x - 0.05, 0.95, SET.z] };
    }
    return null;
  }

  // ================= LO QUE USA sala.js =================
  function bloqueado() {
    if (mostrandoRol || terminando) return true;
    if (muriendo.has(miId())) return true;
    for (const k of muriendo.values()) if (k.a === miId() && k.t < 2.4) return true;
    return false;
  }

  window.ZooJuego = {
    _dbg: { get roles() { return roles; }, sinEspera() { enfriaHasta = 0; } }, // para pruebas automáticas
    get activo() { return activo; },
    comenzar, terminar, bloqueado, soyFantasma, cine,
    velocidad: () => soyFantasma() ? 1.25 : 1,
    // los vivos no ven a los fantasmas
    visible: id => !muertos.has(id) || soyFantasma(),
    efecto(v, id, dt, t) {
      // ¿está en mi mismo cuarto? (los fantasmas ven a todos)
      if (id !== miId() && !soyFantasma() && !muriendo.has(id) && !mismoCuarto(v)) { v.obj.visible = false; v.etiqueta.style.visibility = 'hidden'; }
      if (v.fantasma && v.obj) { v.obj.position.y = 0.35 + Math.sin(t * 2 + id.length) * 0.12; v.obj.userData.piernas.forEach(l => l.rotation.x = 0.4); }
      v.etiqueta.classList.toggle('imp', soyImpostor() && rol(id) === 'i');
      v.etiqueta.classList.toggle('fant', muertos.has(id));
    },
    registrar(canal) {
      canal.on('broadcast', { event: 'muerte' }, ({ payload }) => alMuerte(payload))
        .on('broadcast', { event: 'fin' }, ({ payload }) => alFin(payload));
    },
    alCambiarJugadores() { pintarHud(); if (S().soyHost()) setTimeout(revisarFin, 500); },
    salir() { terminar(); },
  };
})();
