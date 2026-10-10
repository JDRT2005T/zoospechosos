// ZOOspechosos — Cacería 🎯: si en la votación adivinan al impostor, no lo expulsan.
// La tripulación junta 3 piezas, arma su arma graciosa en el Garaje y lo caza antes de que se acabe el tiempo.
(function () {
  const A = window.ZooApp, T = THREE;
  const S = () => ZooSala.interno, G = () => ZooJuego.interno;
  const $ = s => document.querySelector(s);
  const miId = () => S().miId();
  const ahora = () => Date.now();
  const r2 = n => +n.toFixed(2);
  const nombre = id => S().nombreDe(id);

  // ---------- las armas (bala = va derecho · golpe = de cerca · area = explota donde cae) ----------
  const ARMAS = {
    platano: { n: 'Lanzaplátanos', e: '🍌', tipo: 'bala', dmg: 12, vel: 12, alc: 9, esp: 0.8, ef: 'resbalon', frase: '¡Se resbaló! 🍌' },
    chile: { n: 'Pistola de chile', e: '🌶️', tipo: 'bala', dmg: 7, vel: 15, alc: 6.5, esp: 0.45, ef: 'picante', frase: '¡PICA PICA! 🔥' },
    sarten: { n: 'Sartén gigante', e: '🍳', tipo: 'golpe', dmg: 22, alc: 1.9, esp: 1.0, ef: 'plonk', frase: '¡PLONK! 🍳' },
    red: { n: 'Red de mariposas', e: '🦋', tipo: 'golpe', dmg: 10, alc: 2.2, esp: 1.0, ef: 'red', frase: '¡Atrapado! 🦋' },
    confeti: { n: 'Bazuca de confeti', e: '🎉', tipo: 'area', dmg: 24, vel: 9, alc: 9, esp: 1.6, radio: 2.4, ef: 'empujon', cuesta: 2, frase: '¡BOOM de fiesta! 🎉' },
    pedos: { n: 'Lanzapedos', e: '💨', tipo: 'area', dmg: 4, vel: 7.5, alc: 8, esp: 1.3, radio: 2.2, ef: 'pedo', nube: 4.5, frase: '¡QUÉ OLOR! 🤢' },
  };
  const PIEZAS = [{ e: '🔧', n: 'el mango' }, { e: '🔩', n: 'el cañón' }, { e: '⚙️', n: 'el gatillo' }];
  const VENTAJA = 5000, MUNI_BASE = 4, MUNI_MISION = 2;
  const DUR = { resbalon: 1.3, picante: 1.8, plonk: 1.1, red: 2.0, empujon: 0.9, pedo: 0.7 };
  const ATURDE = ['resbalon', 'plonk', 'empujon', 'picante']; // no se puede mover solo

  // ---------- estado ----------
  let partida = false;
  let caza = null;             // { imp, vida, max, inicio, fin }
  let misPiezas = [];          // [{ x, z, i, obj }]
  let arma = null, municion = 0, esperaHasta = 0;
  const armas = new Map();     // jugador -> arma (para verla en su mano)
  let efImp = null;            // golpe que está sufriendo el impostor { ef, t, dur, dx, dz }
  const proys = [], nubes = [];
  let contador = 0, golpeInv = 0, terminando = false, avisoFinal = false, ultimoHud = 0, ultimaNube = 0;
  const grupo = new T.Group(); A.escena.add(grupo);
  const aura = new T.Mesh(new T.RingGeometry(0.6, 0.85, 32), window.neon('#ff2e2e', 3));
  aura.rotation.x = -Math.PI / 2; aura.visible = false; A.escena.add(aura);

  const soyImp = () => G().rol(miId()) === 'i';
  const soyPresa = () => caza && caza.imp === miId();
  const puedoCazar = () => partida && caza && !soyImp() && G().vivo(miId()) && !ZooJuego.soyFantasma();

  // ================= DIBUJOS =================
  const toon = c => new T.MeshToonMaterial({ color: c });
  function malla(geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
  const texEmoji = {};
  function emojiTex(e) {
    if (texEmoji[e]) return texEmoji[e];
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
    g.font = '70px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 48, 54);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return texEmoji[e] = t;
  }
  function hacerPieza(x, z, P) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const s = new T.Sprite(new T.SpriteMaterial({ map: emojiTex(P.e), depthWrite: false })); s.scale.setScalar(0.75); s.position.y = 0.85; g.add(s);
    const aro = new T.Mesh(new T.RingGeometry(0.35, 0.5, 24), window.neon('#5effa0', 2.5)); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.05; g.add(aro);
    const haz = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 1.6, 16, 1, true), new T.MeshBasicMaterial({ color: '#5effa0', transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }));
    haz.position.y = 0.8; g.add(haz);
    g.userData.s = s; grupo.add(g); return g;
  }
  // el arma en la mano (la mano está en y = -0.42 del brazo; con el brazo estirado, "adelante" es -y)
  function modeloArma(a) {
    const g = new T.Group();
    const tubo = (r, l, c, y) => malla(new T.CylinderGeometry(r, r * 1.1, l, 12), toon(c), 0, y, 0);
    if (a === 'platano') { g.add(tubo(0.08, 0.5, '#7a7f8c', -0.62)); const b = malla(new T.TorusGeometry(0.13, 0.045, 6, 14, Math.PI), toon('#ffe135'), 0, -0.95, 0); b.rotation.z = Math.PI / 2; g.add(b); }
    if (a === 'chile') { g.add(malla(new T.BoxGeometry(0.16, 0.42, 0.2), toon('#ff7b00'), 0, -0.6, 0)); g.add(tubo(0.04, 0.2, '#2ee6d6', -0.9)); g.add(malla(new T.ConeGeometry(0.06, 0.22, 8), toon('#e01e1e'), 0.1, -0.55, 0.14)); }
    if (a === 'sarten') { g.add(tubo(0.03, 0.4, '#3a2a1a', -0.62)); const p = malla(new T.CylinderGeometry(0.3, 0.26, 0.06, 20), toon('#2b2b33'), 0, -1.02, 0); p.rotation.x = Math.PI / 2; g.add(p); }
    if (a === 'red') {
      g.add(tubo(0.025, 0.9, '#a0763c', -0.85));
      const ar = malla(new T.TorusGeometry(0.24, 0.025, 6, 20), toon('#ff3d9a'), 0, -1.5, 0); ar.rotation.x = Math.PI / 2; g.add(ar);
      g.add(malla(new T.ConeGeometry(0.24, 0.4, 14, 1, true), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: T.DoubleSide }), 0, -1.32, 0));
    }
    if (a === 'confeti') { g.add(tubo(0.12, 0.7, '#ff3d9a', -0.6)); [-0.45, -0.75].forEach(y => { const r = malla(new T.TorusGeometry(0.125, 0.025, 6, 16), toon('#ffd93d'), 0, y, 0); r.rotation.x = Math.PI / 2; g.add(r); }); }
    if (a === 'pedos') { g.add(tubo(0.07, 0.5, '#5a8f1e', -0.65)); g.add(malla(new T.SphereGeometry(0.16, 12, 10), toon('#9bd32b'), 0.14, -0.45, 0.1)); const c = malla(new T.ConeGeometry(0.14, 0.2, 12, 1, true), toon('#5a8f1e'), 0, -0.98, 0); c.rotation.x = Math.PI; g.add(c); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function hacerBala(a, dx, dz) {
    let m;
    if (a === 'platano') m = malla(new T.TorusGeometry(0.16, 0.06, 6, 14, Math.PI), toon('#ffe135'));
    else if (a === 'chile') { m = new T.Group(); [0, 0.25, 0.5].forEach(z => m.add(malla(new T.SphereGeometry(0.08, 8, 6), window.neon('#ff3b1f', 2), 0, 0, -z))); m.rotation.y = Math.atan2(dx, dz); }
    else if (a === 'confeti') m = malla(new T.SphereGeometry(0.2, 14, 10), window.neon('#ff3d9a', 2.2));
    else m = malla(new T.SphereGeometry(0.28, 12, 10), new T.MeshBasicMaterial({ color: '#9bd32b', transparent: true, opacity: 0.7 }));
    grupo.add(m); return m;
  }
  function hacerNube(x, z) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const mat = new T.MeshBasicMaterial({ color: '#9bd32b', transparent: true, opacity: 0.42, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, r = i ? 0.8 + Math.random() * 0.6 : 0;
      const b = malla(new T.SphereGeometry(0.6 + Math.random() * 0.4, 10, 8), mat, Math.cos(a) * r, 0.5 + Math.random() * 0.6, Math.sin(a) * r);
      b.userData.f = Math.random() * 6; g.add(b);
    }
    g.userData.mat = mat; g.scale.setScalar(0.2); grupo.add(g); return g;
  }
  function quitar(o) { if (o.parent) o.parent.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }

  // ================= SONIDOS =================
  let ctx = null;
  const audio = () => { if (A.sonido === 'no') return null; try { return ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } };
  function pedo(vol) {
    const c = audio(); if (!c) return;
    const t0 = c.currentTime, dur = 0.5 + Math.random() * 0.4;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(75 + Math.random() * 30, t0); o.frequency.linearRampToValueAtTime(45, t0 + dur);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 16 + Math.random() * 14; lg.gain.value = 28; lfo.connect(lg).connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 480;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.04); g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f).connect(g).connect(c.destination); o.start(t0); lfo.start(t0); o.stop(t0 + dur); lfo.stop(t0 + dur);
  }
  const volDe = (x, z) => { const yp = S().yoPos; return Math.max(0, 1 - Math.hypot(x - yp.x, z - yp.z) / 14); };
  function sonarDisparo(a, vol) {
    if (vol <= 0) return;
    if (a === 'platano') { A.bip(520, 0.08, 'square', 0.04 * vol); setTimeout(() => A.bip(780, 0.1, 'triangle', 0.04 * vol), 60); }
    if (a === 'chile') A.bip(1300, 0.12, 'sawtooth', 0.03 * vol);
    if (a === 'sarten' || a === 'red') A.bip(240, 0.12, 'triangle', 0.05 * vol);
    if (a === 'confeti') A.bip(150, 0.25, 'square', 0.06 * vol);
    if (a === 'pedos') pedo(0.16 * vol);
  }
  function sonarGolpe(a, vol) {
    if (vol <= 0) return;
    if (a === 'sarten') { A.bip(320, 0.05, 'square', 0.09 * vol); setTimeout(() => A.bip(90, 0.35, 'sine', 0.12 * vol), 30); }
    else if (a === 'platano') { A.bip(900, 0.08, 'sine', 0.06 * vol); setTimeout(() => A.bip(300, 0.3, 'sine', 0.06 * vol), 80); }
    else if (a === 'confeti') { A.bip(600, 0.05, 'square', 0.06 * vol); setTimeout(() => A.bip(1200, 0.2, 'triangle', 0.05 * vol), 50); }
    else if (a !== 'pedos') A.bip(700, 0.1, 'triangle', 0.06 * vol);
  }
  function sirena() { for (let i = 0; i < 6; i++) setTimeout(() => A.bip(i % 2 ? 520 : 780, 0.26, 'sawtooth', 0.05), i * 280); }

  // ================= EMPIEZA LA CACERÍA =================
  // el anfitrión reparte 3 piezas por tripulante vivo (en cuartos al azar)
  function generar() {
    const roles = G().roles, cuartos = Object.keys(Mansion.AREAS).filter(k => k >= 'A' && k <= 'Z' && Mansion.RECT[k]);
    const piezas = {};
    Object.keys(roles).filter(id => roles[id] === 't' && G().vivo(id)).forEach(id => {
      piezas[id] = cuartos.slice().sort(() => Math.random() - 0.5).slice(0, 3).map((k, i) => {
        const r = Mansion.RECT[k];
        const p = Mansion.colisionar({ x: r.x0 + 1.3 + Math.random() * (r.w - 2.6), z: r.z0 + 1.3 + Math.random() * (r.d - 2.6) });
        return [r2(p.x), r2(p.z), i];
      });
    });
    return { piezas };
  }

  function empezar(imp, d) {
    if (!partida || !G().vivo(imp)) return;
    terminando = false; avisoFinal = false; efImp = null;
    const roles = G().roles;
    const tripulantes = Object.keys(roles).filter(id => roles[id] === 't' && G().vivo(id)).length;
    const max = 40 + 30 * Math.max(1, tripulantes);
    caza = { imp, max, vida: max, inicio: ahora() + VENTAJA, fin: ahora() + VENTAJA + (S().cfg().caza || 180) * 1000 };
    limpiarPiezas();
    if (!arma && puedoCazar()) misPiezas = ((d && d.piezas && d.piezas[miId()]) || []).map(([x, z, i]) => ({ x, z, i, obj: hacerPieza(x, z, PIEZAS[i]) }));
    pintarEstaciones();
    document.body.classList.add('caza');
    const yo = imp === miId();
    anuncio(yo ? '😈 ¡TE DESCUBRIERON!' : `🔪 ¡${nombre(imp)} ES EL IMPOSTOR!`,
      yo ? '¡Corre y escóndete! Sobrevive hasta que se acabe el tiempo' : soyImp() ? 'Descubrieron a tu compañero… ¡ayúdalo a escapar!' : ZooJuego.soyFantasma() ? '👻 Mira cómo lo cazan' : arma ? '¡Ya tienes tu arma: a cazarlo!' : '¡Junta 3 piezas, arma tu arma en el Garaje y cázalo!',
      VENTAJA, true);
    sirena();
    pintarHud(true);
  }

  // anuncio grande en el centro (con cuenta regresiva opcional)
  let anuncioH = null;
  function anuncio(tit, sub, ms, cuenta) {
    const a = $('#caza-anuncio');
    a.querySelector('b').textContent = tit; a.querySelector('span').textContent = sub; a.querySelector('i').textContent = '';
    a.classList.remove('ver'); void a.offsetWidth; a.classList.add('ver');
    clearInterval(anuncioH);
    const fin = ahora() + ms;
    anuncioH = setInterval(() => {
      const falta = Math.ceil((fin - ahora()) / 1000);
      if (cuenta) a.querySelector('i').textContent = falta > 0 ? falta : '¡YA!';
      if (ahora() > fin + (cuenta ? 600 : 0)) { clearInterval(anuncioH); a.classList.remove('ver'); }
    }, 100);
  }

  // ================= PIEZAS Y MESA DE ARMAS (usan el botón USAR) =================
  function pintarEstaciones() {
    const l = [];
    if (puedoCazar() && !arma) {
      misPiezas.forEach(p => {
        const P = PIEZAS[p.i];
        l.push({ x: p.x, z: p.z, e: P.e, tit: `${P.e} Recoger ${P.n}`, j: 'mantener', o: { seg: 1, emoji: P.e, txt: 'Mantén presionado para agarrarla' }, ok: '✔ ¡LA TIENES!', alListo: () => recoger(p) });
      });
      if (!misPiezas.length) {
        const M = Mansion.TALLER;
        l.push({ x: M.x - 0.95, z: M.z, e: '🛠️', tit: '🛠️ Armar tu arma', j: 'tocar', o: { n: 10, emoji: '🔨', txt: '¡Martilla para armar tu arma!' }, ok: '🎉 ¡ARMA LISTA!', alListo: armar });
      }
    }
    ZooMisiones.setExtras(l, 'caza');
  }
  function recoger(p) {
    const i = misPiezas.indexOf(p); if (i < 0) return;
    misPiezas.splice(i, 1); quitar(p.obj);
    Part.chispas({ x: p.x, y: 0.9, z: p.z });
    A.toast(misPiezas.length ? `${PIEZAS[p.i].e} ¡Tienes ${PIEZAS[p.i].n}! Faltan ${misPiezas.length}` : '🛠️ ¡Tienes las 3 piezas! Ve a la mesa de armas del Garaje');
    pintarEstaciones(); pintarHud(true);
  }
  function armar() {
    if (arma) return;
    const lista = Object.keys(ARMAS);
    arma = lista[Math.floor(Math.random() * lista.length)];
    municion = MUNI_BASE + MUNI_MISION * ZooMisiones.pasosDe(miId());
    esperaHasta = 0;
    S().enviar('arma', { id: miId(), a: arma });
    const W = ARMAS[arma];
    anuncio(`${W.e} ¡${W.n.toUpperCase()}!`, `Tienes ${municion} tiros · ¡haz misiones para conseguir más!`, 2600, false);
    for (let i = 0; i < 3; i++) setTimeout(() => A.bip(660 + i * 220, 0.12, 'triangle', 0.06), i * 120);
    pintarEstaciones(); pintarHud(true);
  }
  function alArma(m) { if (!partida || !ARMAS[m.a]) return; armas.set(m.id, m.a); }
  function limpiarPiezas() { misPiezas.forEach(p => quitar(p.obj)); misPiezas = []; }

  // ================= DISPARAR =================
  // ¿tengo al impostor a tiro? (tengo que verlo: mismo cuarto, no en la alcantarilla, con luz)
  function objetivo() {
    if (!caza || !arma || ahora() < caza.inicio || terminando) return null;
    const v = S().pjs.get(caza.imp);
    if (!v || !v.obj || !v.obj.visible) return null;
    const W = ARMAS[arma], yp = S().yoPos, d = Math.hypot(v.cx - yp.x, v.cz - yp.z);
    return d <= (W.tipo === 'golpe' ? W.alc + 0.4 : W.alc) ? v : null;
  }
  $('#b-disparar').addEventListener('click', () => {
    if (!puedoCazar() || !arma || ZooJuego.bloqueado()) return;
    const W = ARMAS[arma], cuesta = W.cuesta || 1;
    if (municion < cuesta) return A.toast('¡Sin munición! Haz misiones para conseguir más 📋');
    if (ahora() < esperaHasta) return;
    const v = objetivo(); if (!v) return A.toast('No lo tienes a tiro 🎯 ¡Acércate!');
    municion -= cuesta; esperaHasta = ahora() + W.esp * 1000;
    const yp = S().yoPos; yp.r = Math.atan2(v.cx - yp.x, v.cz - yp.z); S().enviarPos(true);
    S().enviar('disparo', { de: miId(), a: arma, pid: miId().slice(0, 6) + '-' + (++contador), x: r2(yp.x), z: r2(yp.z), tx: r2(v.cx), tz: r2(v.cz) });
    pintarHud(true);
  });

  function alDisparo(m) {
    if (!partida || !caza) return;
    const W = ARMAS[m.a]; if (!W) return;
    const v = S().pjs.get(m.de); if (v) v.cazaSwing = 0.35;
    sonarDisparo(m.a, volDe(m.x, m.z));
    let dx = m.tx - m.x, dz = m.tz - m.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (W.tipo === 'golpe') {
      if (soyPresa() && !ZooSabotaje.yoEnVent()) {
        const yp = S().yoPos;
        if (Math.hypot(yp.x - m.x, yp.z - m.z) <= W.alc + 0.7) recibir(m.a, m.de, m.x, m.z, m.pid);
      }
      return;
    }
    proys.push({ pid: m.pid, a: m.a, de: m.de, x: m.x + dx * 0.5, z: m.z + dz * 0.5, dx, dz, rec: 0, max: W.tipo === 'area' ? Math.min(L, W.alc) : W.alc, obj: hacerBala(m.a, dx, dz) });
  }

  function moverBalas(dt) {
    for (let i = proys.length - 1; i >= 0; i--) {
      const p = proys[i], W = ARMAS[p.a], paso = W.vel * dt;
      p.x += p.dx * paso; p.z += p.dz * paso; p.rec += paso;
      const arco = W.tipo === 'area' ? Math.sin(Math.min(1, p.rec / p.max) * Math.PI) * 1.2 : 0;
      p.obj.position.set(p.x, 1.0 + arco, p.z);
      if (p.a === 'platano') { p.obj.rotation.y += dt * 14; p.obj.rotation.x += dt * 9; }
      const q = Mansion.colisionar({ x: p.x, z: p.z });
      let fin = Math.hypot(q.x - p.x, q.z - p.z) > 0.05 || p.rec >= p.max;
      // ¿le dio? (lo decide el celular del impostor, que sabe dónde está de verdad)
      if (!fin && W.tipo === 'bala' && soyPresa() && !ZooSabotaje.yoEnVent()) {
        const yp = S().yoPos;
        if (Math.hypot(yp.x - p.x, yp.z - p.z) < 0.75) { recibir(p.a, p.de, p.x - p.dx, p.z - p.dz, p.pid); fin = true; }
      }
      if (fin) { proys.splice(i, 1); quitar(p.obj); if (W.tipo === 'area') explotar(p); }
    }
  }
  function explotar(p) {
    const W = ARMAS[p.a], vol = volDe(p.x, p.z);
    if (p.a === 'confeti') {
      Part.confeti({ x: p.x, y: 1, z: p.z }); Part.impacto({ x: p.x, y: 1, z: p.z }); sonarGolpe('confeti', vol);
      if (soyPresa() && !ZooSabotaje.yoEnVent()) { const yp = S().yoPos; if (Math.hypot(yp.x - p.x, yp.z - p.z) <= W.radio) recibir('confeti', p.de, p.x, p.z, p.pid); }
    } else { // 💨 queda una nube verde
      nubes.push({ x: p.x, z: p.z, de: p.de, t: 0, dur: W.nube, obj: hacerNube(p.x, p.z) });
      pedo(0.2 * vol);
    }
  }
  function moverNubes(dt, t) {
    for (let i = nubes.length - 1; i >= 0; i--) {
      const n = nubes[i]; n.t += dt;
      const s = Math.min(1, n.t * 4); n.obj.scale.setScalar(s);
      n.obj.children.forEach(b => b.position.y = 0.5 + Math.sin(t * 2 + b.userData.f) * 0.15);
      n.obj.userData.mat.opacity = 0.42 * Math.min(1, (n.dur - n.t) / 0.8);
      if (n.t >= n.dur) { nubes.splice(i, 1); quitar(n.obj); continue; }
      // el impostor dentro de la nube: pierde vida poco a poco y se marea
      if (soyPresa() && !ZooSabotaje.yoEnVent() && ahora() - ultimaNube > 500) {
        const yp = S().yoPos;
        if (Math.hypot(yp.x - n.x, yp.z - n.z) <= ARMAS.pedos.radio) { ultimaNube = ahora(); recibir('pedos', n.de, n.x, n.z, null); }
      }
    }
  }

  // ---- el impostor recibe el golpe (solo en su celular) y avisa a todos ----
  function recibir(a, de, ox, oz, pid) {
    if (!caza || caza.vida <= 0 || terminando) return;
    if (a !== 'pedos' && ahora() < golpeInv) return;
    if (a !== 'pedos') golpeInv = ahora() + 250;
    let dmg = ARMAS[a].dmg;
    if (a === 'red' && caza.vida <= caza.max * 0.3) dmg = caza.vida; // ¡atrapado en la red: se acabó!
    const yp = S().yoPos; let dx = yp.x - ox, dz = yp.z - oz; const L = Math.hypot(dx, dz) || 1;
    S().enviar('golpe', { de, a, dmg, vida: Math.max(0, caza.vida - dmg), pid, dx: r2(dx / L), dz: r2(dz / L) });
  }
  function alGolpe(m) {
    if (!partida || !caza || terminando) return;
    caza.vida = Math.min(caza.vida, m.vida);
    const k = proys.findIndex(p => p.pid && p.pid === m.pid); if (k >= 0) { quitar(proys[k].obj); proys.splice(k, 1); }
    const W = ARMAS[m.a];
    if (m.a !== 'pedos' || !efImp || efImp.ef === 'pedo') efImp = { ef: W.ef, t: 0, dur: DUR[W.ef], dx: m.dx || 0, dz: m.dz || 1, giro: 0.3 };
    const v = S().pjs.get(caza.imp);
    const veo = soyPresa() || (v && v.obj && v.obj.visible);
    if (veo && v) {
      numero(v, m.dmg, m.a === 'red' && m.vida <= 0);
      if (m.a === 'platano') Part.chispas({ x: v.cx, y: 0.4, z: v.cz });
      if (m.a === 'chile') Part.impacto({ x: v.cx, y: 1.6, z: v.cz });
      if (m.a === 'red') Part.corazones({ x: v.cx, y: 1.8, z: v.cz });
    }
    sonarGolpe(m.a, v ? volDe(v.cx, v.cz) : 0);
    if (m.de === miId() && m.a !== 'pedos') { A.toast(W.frase, 900); A.bip(1500, 0.06, 'square', 0.04); }
    if (soyPresa() && m.a !== 'pedos') S().sacudir(0.25);
    pintarHud(true);
    if (caza.vida <= 0) cazado(m.de, m.a);
  }
  function numero(v, dmg, fin) {
    const s = document.createElement('span'); s.className = 'dano' + (fin ? ' fin' : ''); s.textContent = fin ? '¡ATRAPADO!' : '-' + dmg;
    v.etiqueta.appendChild(s); setTimeout(() => s.remove(), 900);
  }

  // ================= FIN DE LA CACERÍA =================
  function cazado(de, a) {
    if (terminando) return;
    terminando = true;
    const imp = caza.imp, W = ARMAS[a];
    for (let i = 0; i < 4; i++) setTimeout(() => A.bip(523 * Math.pow(1.26, i), 0.18, 'triangle', 0.06), i * 140);
    setTimeout(() => {
      if (!partida) return;
      ZooReunion.cielo({
        id: imp,
        l1: `🎯 ¡CAZARON A ${nombre(imp).toUpperCase()}!`,
        l2: `${W.e} El golpe final fue de ${nombre(de)}`,
        ms: 6500,
        alFin: () => {
          G().expulsar(imp);
          acabar();
          if (S().soyHost()) setTimeout(G().revisarFin, 600);
        },
      });
    }, 1300);
  }
  function acabar() {
    caza = null; efImp = null; terminando = false;
    proys.forEach(p => quitar(p.obj)); proys.length = 0;
    nubes.forEach(n => quitar(n.obj)); nubes.length = 0;
    limpiarPiezas(); aura.visible = false;
    document.body.classList.remove('caza');
    $('#caza-anuncio').classList.remove('ver');
    pintarEstaciones(); pintarHud(true);
  }
  // si se acaba el tiempo, gana el impostor (lo decide el anfitrión; reloj normal para que ande con la app minimizada)
  setInterval(() => {
    if (!partida || !caza || terminando || !S().soyHost()) return;
    if (ahora() > caza.fin) { terminando = true; S().enviar('fin', { gana: 'i', roles: G().roles }); }
  }, 500);

  // ================= CADA CUADRO =================
  A.alCuadro.push((dt, t) => {
    if (!partida) return;
    moverBalas(dt);
    moverNubes(dt, t);
    misPiezas.forEach((p, i) => { p.obj.userData.s.position.y = 0.85 + Math.sin(t * 3 + i) * 0.1; p.obj.rotation.y = t; });
    const bd = $('#b-disparar');
    if (!caza) { bd.hidden = true; aura.visible = false; return; }
    // si el impostor se fue de la partida, se acaba la cacería
    if (!S().jugadores.some(j => j.id === caza.imp)) { acabar(); return; }
    if (efImp) { efImp.t += dt; if (efImp.t >= efImp.dur) efImp = null; }
    // al impostor lo mueven los golpes (corre como loco con el chile, sale volando con el confeti)
    if (soyPresa() && efImp && (efImp.ef === 'picante' || (efImp.ef === 'empujon' && efImp.t < 0.35))) {
      const yp = S().yoPos;
      if (efImp.ef === 'picante') { efImp.giro -= dt; if (efImp.giro <= 0) { efImp.giro = 0.35; const a = Math.random() * Math.PI * 2; efImp.dx = Math.cos(a); efImp.dz = Math.sin(a); } }
      const vel = efImp.ef === 'picante' ? 5.5 : 7;
      yp.x += efImp.dx * vel * dt; yp.z += efImp.dz * vel * dt; Mansion.colisionar(yp);
      yp.r = Math.atan2(efImp.dx, efImp.dz); S().enviarPos();
      if (efImp.ef === 'picante' && Math.random() < dt * 8) Part.humo({ x: yp.x, y: 1.9, z: yp.z });
    }
    // aura roja debajo del impostor
    const v = S().pjs.get(caza.imp);
    aura.visible = !!(v && v.obj && v.obj.visible);
    if (aura.visible) { aura.position.set(v.cx, 0.06, v.cz); aura.material.color.setRGB(2.6 + Math.sin(t * 8) * 0.6, 0.15, 0.15); }
    // botón de disparar
    bd.hidden = !(puedoCazar() && arma);
    if (!bd.hidden) {
      const W = ARMAS[arma], listo = !!objetivo() && municion >= (W.cuesta || 1) && ahora() >= esperaHasta && !ZooJuego.bloqueado();
      bd.classList.toggle('listo', listo);
      bd.querySelector('span').textContent = W.e;
      bd.querySelector('small').textContent = W.tipo === 'golpe' ? 'GOLPEAR' : 'DISPARAR';
      bd.querySelector('em').textContent = municion;
    }
    // aviso de los últimos 15 segundos
    if (!avisoFinal && caza.fin - ahora() < 15000) { avisoFinal = true; A.toast('⏱ ¡Quedan 15 segundos de cacería!'); A.bip(880, 0.3, 'square', 0.05); }
    if (t - ultimoHud > 0.2) { ultimoHud = t; pintarHud(); }
  });

  function pintarHud(forzar) {
    const h = $('#caza-hud');
    if (!caza) { h.classList.remove('ver'); return; }
    h.classList.add('ver');
    const imp = caza.imp, j = G().ropaDe(imp), an = Zoo.ANIMALES.find(x => x.id === j.animal);
    if (forzar || !h.dataset.imp || h.dataset.imp !== imp) { h.dataset.imp = imp; $('#ch-imp').innerHTML = `<i style="background:${j.color || '#888'}">${an ? an.emoji : '🐾'}</i>`; }
    const q = Math.max(0, caza.vida / caza.max);
    $('#caza-hud .ch-barra i').style.width = q * 100 + '%';
    $('#ch-vida').textContent = `${nombre(imp)} · ❤️ ${Math.ceil(caza.vida)}`;
    const falta = Math.max(0, Math.ceil((caza.fin - ahora()) / 1000));
    const r = $('#ch-reloj'); r.textContent = `⏱ ${Math.floor(falta / 60)}:${String(falta % 60).padStart(2, '0')}`; r.classList.toggle('poco', falta <= 15);
    let info;
    if (soyPresa()) info = '😈 ¡Escapa! Sobrevive hasta que se acabe el tiempo';
    else if (soyImp()) info = '🔪 Ayuda a tu compañero a escapar';
    else if (ZooJuego.soyFantasma()) info = '👻 Mira la cacería';
    else if (arma) info = `${ARMAS[arma].e} ${ARMAS[arma].n} · 🎯 ${municion} tiros · ¡haz misiones para más!`;
    else if (misPiezas.length) info = `🔧 Piezas ${3 - misPiezas.length}/3 · sigue la flecha roja`;
    else info = '🛠️ ¡Ve a la mesa de armas del Garaje!';
    $('#ch-info').textContent = info;
  }

  // ================= POSES (las llama juego.js por cada jugador) =================
  function posar(v, id, dt, t) {
    if (!partida || !v.obj) return;
    const u = v.obj.userData, c = u.cuerpo;
    // el arma en la mano
    const a = armas.get(id) || null;
    if (u.armaK !== a) {
      if (u.armaObj) quitar(u.armaObj);
      u.armaObj = a ? modeloArma(a) : null; u.armaK = a;
      if (u.armaObj) u.brazos[1].add(u.armaObj);
    }
    if (a && !v.fantasma) {
      const sw = v.cazaSwing > 0 ? (v.cazaSwing = Math.max(0, v.cazaSwing - dt)) / 0.35 : 0;
      u.brazos[1].rotation.x = ARMAS[a].tipo === 'golpe' ? (sw ? -2.9 + (1 - sw) * 3.3 : -0.9) : -1.45 + sw * 0.6;
      u.brazos[1].rotation.z = 0.15;
    }
    if (u.armaObj) u.armaObj.visible = !v.fantasma;
    // el impostor perseguido
    v.etiqueta.classList.toggle('presa', !!caza && id === caza.imp);
    const presa = !!caza && id === caza.imp;
    if (presa && efImp) {
      const e = efImp, q = e.t / e.dur;
      if (e.ef === 'resbalon') { const caer = Math.min(1, e.t / 0.2) * (q > 0.8 ? (1 - q) / 0.2 : 1); c.rotation.x = -1.45 * caer; c.rotation.y = e.t * 10 * (1 - q); }
      if (e.ef === 'plonk') { c.scale.set(1.3 - q * 0.3, 0.5 + q * 0.5, 1.3 - q * 0.3); if (Math.floor(e.t * 4) !== e.k) { e.k = Math.floor(e.t * 4); if (v.obj.visible) Part.chispas({ x: v.cx, y: 1.6, z: v.cz }); } }
      if (e.ef === 'picante') { c.rotation.z = Math.sin(t * 30) * 0.18; c.scale.set(1, 1 + Math.sin(t * 25) * 0.06, 1); }
      if (e.ef === 'red') { c.rotation.z = Math.sin(t * 18) * 0.12; c.scale.set(0.9, 0.9, 0.9); }
      if (e.ef === 'empujon') c.rotation.x = e.t * 16 * (1 - q);
      if (e.ef === 'pedo') { c.rotation.z = Math.sin(t * 12) * 0.22; c.scale.set(1 + Math.sin(t * 20) * 0.05, 1, 1); }
      u.cazaPose = true;
    } else if (u.cazaPose) { c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); u.cazaPose = false; }
  }

  // ================= LO QUE USAN LOS DEMÁS =================
  function iniciar() { limpiar(); partida = true; }
  function terminar() { limpiar(); partida = false; }
  function limpiar() {
    if (caza || proys.length || nubes.length || misPiezas.length) acabar();
    caza = null; arma = null; municion = 0; armas.clear(); efImp = null; terminando = false;
    document.body.classList.remove('caza');
    $('#b-disparar').hidden = true; $('#caza-hud').classList.remove('ver'); $('#caza-anuncio').classList.remove('ver');
    ZooMisiones.setExtras([], 'caza');
  }

  window.ZooCaceria = {
    ARMAS, iniciar, terminar, generar, empezar, posar,
    activa: () => !!caza,
    // el impostor perseguido no se mueve solo mientras está aturdido; los tripulantes esperan los 5 s de ventaja
    bloquea() {
      if (!partida || !caza) return false;
      if (soyPresa() && efImp && ATURDE.includes(efImp.ef)) return true;
      return ahora() < caza.inicio && !soyImp() && !ZooJuego.soyFantasma();
    },
    velocidad() {
      if (!soyPresa()) return 1;
      return 1.12 * (efImp && (efImp.ef === 'red' || efImp.ef === 'pedo') ? 0.55 : 1);
    },
    registrar(canal) {
      canal.on('broadcast', { event: 'arma' }, ({ payload }) => alArma(payload))
        .on('broadcast', { event: 'disparo' }, ({ payload }) => alDisparo(payload))
        .on('broadcast', { event: 'golpe' }, ({ payload }) => alGolpe(payload))
        // cada misión que haces durante la cacería te da más tiros
        .on('broadcast', { event: 'mision' }, ({ payload }) => {
          if (!partida || payload.id !== miId() || !arma) return;
          municion += MUNI_MISION; A.toast(`📋 ¡Misión hecha! +${MUNI_MISION} tiros 🎯`); pintarHud(true);
        });
    },
    _dbg: {
      get caza() { return caza; }, get arma() { return arma; }, get municion() { return municion; }, get piezas() { return misPiezas; },
      darArma(a) { arma = a || 'platano'; municion = 30; S().enviar('arma', { id: miId(), a: arma }); pintarEstaciones(); },
      recogerTodo() { misPiezas.slice().forEach(recoger); },
      armar,
    },
  };
})();
