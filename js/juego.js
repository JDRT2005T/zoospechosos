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
  const cuerpos = [];               // cadáveres que se pueden reportar { id, x, z }

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
    ZooReunion.iniciar();
    ZooMisiones.iniciar(d.tareas, roles, miId());
    ZooSabotaje.iniciar(roles);
    enfriaHasta = Date.now() + 12000; // al principio el impostor espera un poco
    const s = d.salidas && d.salidas[miId()];
    const yp = S().yoPos;
    if (s) { yp.x = s[0]; yp.z = s[1]; yp.r = Math.PI; }
    // ubicar a todos en su salida
    Object.entries(d.salidas || {}).forEach(([id, p]) => { const v = S().pjs.get(id); if (v) { v.cx = v.tx = p[0]; v.cz = v.tz = p[1]; v.cr = v.tr = Math.PI; v.posLista = true; v.caida = 0; v.efecto = null; } });
    // fundido a negro → mostrar rol → la mansión
    const f = $('#fundido'); f.classList.add('ver');
    setTimeout(() => {
      Salon.grupo.visible = false; Mansion.grupo.visible = true; Mansion.reiniciarVista(); window.sinBrillo = true;
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
    $('#h-barra').title = 'Misiones del equipo';
    $('#b-terminar').hidden = !S().soyHost();
  }
  const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================= MATAR =================
  $('#b-matar').addEventListener('click', () => {
    if (!activo || !soyImpostor() || soyFantasma() || bloqueado()) return;
    if (Date.now() < enfriaHasta || !objetivo) return;
    const v = S().pjs.get(objetivo); if (!v) return;
    enfriaHasta = Date.now() + S().cfg().enfriamiento * 1000;
    const yp = S().yoPos;
    S().enviar('muerte', { a: miId(), v: objetivo, x: +v.cx.toFixed(2), z: +v.cz.toFixed(2), r: +v.cr.toFixed(2), ax: +yp.x.toFixed(2), az: +yp.z.toFixed(2), tipo: (S().yo && S().yo.muerte) || 'granada' });
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

  // ================= ANIMACIONES DE MUERTE =================
  const ACERCA = 0.8; // segundos que tarda el impostor en llegar hasta la víctima
  const DIST = 1.25;  // distancia entre impostor y víctima durante la escena (para que se aprecie)
  const suaveM = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  // un objeto sale de la mano y vuela hasta un punto de la víctima (en coordenadas de la víctima)
  function volar(pr, uv, t, t0, t1, punto) {
    if (t < t0 || !uv) return;
    if (!pr.vuela) {
      pr.vuela = true;
      const p0 = new T.Vector3(); pr.g.getWorldPosition(p0); pr.raiz.updateMatrixWorld(); pr.raiz.worldToLocal(p0);
      quitar(pr.g); pr.raiz.add(pr.g); pr.g.position.copy(p0); pr.p0 = p0.clone();
    }
    if (t > t1) return;
    const raizV = uv.cuerpo.parent; raizV.updateMatrixWorld();
    const p1 = raizV.localToWorld(punto.clone()); pr.raiz.worldToLocal(p1);
    const q = suaveM((t - t0) / (t1 - t0));
    pr.g.position.lerpVectors(pr.p0, p1, q); pr.g.position.y += Math.sin(q * Math.PI) * 0.25;
    pr.g.rotation.x = q * 6; pr.g.rotation.z = q * 3;
  }
  const toon = c => new T.MeshToonMaterial({ color: c });
  function hacerBrillo() {
    const b = new T.Mesh(new T.SphereGeometry(0.62, 18, 14), new T.MeshBasicMaterial({ color: '#ff1a1a', transparent: true, opacity: 0, depthWrite: false }));
    b.scale.set(1, 1.45, 1); b.position.y = 0.95; return b;
  }
  const ropaDe = id => S().jugadores.find(j => j.id === id) || {};
  const quitar = o => { if (o && o.parent) o.parent.remove(o); };
  const posVictima = (k, enCine) => enCine ? { x: k.cvx, y: 0, z: SET.z } : { x: k.x, y: 0, z: k.z };
  function sangreChorro(p, mucho) {
    if (sangre()) {
      Part.rafaga(p, { n: mucho ? 60 : 30, colores: ['#b00000', '#e01e37', '#7a0010', '#ff2a3a'], vel: mucho ? 6.5 : 4, arriba: 1.5, grav: 13, vida: 1.3, tam: 0.21, dispersion: 0.4 });
      Part.rafaga(p, { n: mucho ? 16 : 8, colores: ['#8a0000', '#c1121f'], vel: 3, arriba: 1.2, grav: 9, vida: 1.0, tam: 0.45, crecer: 0.6 });
    } else { Part.confeti(p); Part.chispas(p); }
  }
  function fogonazo(p) {
    Part.rafaga(p, { n: 4, colores: ['#fff3b0', '#ffb347'], vel: 0.5, vida: 0.22, tam: 1.6, crecer: 1.5, aditivo: true, brillo: 1.6 });
    Part.impacto(p); Part.humo(p);
  }
  const loVeo = k => { const yp = S().yoPos; return soyFantasma() || Mansion.cuartoDe(k.x, k.z) === Mansion.cuartoDe(yp.x, yp.z) || Math.hypot(yp.x - k.x, yp.z - k.z) < 2.5; };
  function temblor(k, fuerte) {
    const yp = S().yoPos;
    if (Math.hypot(yp.x - k.x, yp.z - k.z) < 9 || k.ca) { S().sacudir(fuerte); document.body.classList.add('sacudir'); setTimeout(() => document.body.classList.remove('sacudir'), 500); }
  }
  function golpeSonido() { A.bip(90, 0.25, 'sawtooth', 0.09); setTimeout(() => A.bip(60, 0.3, 'square', 0.07), 40); }

  // ---------- 💣 GRANADA ----------
  function hacerGranada() {
    const g = new T.Group();
    const c = new T.Mesh(new T.SphereGeometry(0.11, 12, 10), toon('#3a5a2a')); c.scale.y = 1.25; g.add(c);
    const tapa = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.07, 10), toon('#888')); tapa.position.y = 0.15; g.add(tapa);
    const anilla = new T.Mesh(new T.TorusGeometry(0.05, 0.012, 6, 14), toon('#ffd93d')); anilla.position.set(0.07, 0.17, 0); g.add(anilla);
    g.position.y = -0.45; return g;
  }
  // ---------- 🔨 MARTILLO ----------
  function hacerMartillo() {
    const g = new T.Group();
    const palo = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 1.3, 10), toon('#8b5a3c')); palo.position.y = -0.65; g.add(palo);
    const cabeza = new T.Mesh(new T.BoxGeometry(0.62, 0.36, 0.36), new T.MeshToonMaterial({ color: '#9aa5b1' })); cabeza.position.y = -1.32; g.add(cabeza);
    [-0.32, 0.32].forEach(x => { const c = new T.Mesh(new T.BoxGeometry(0.04, 0.38, 0.38), toon('#e63946')); c.position.set(x, -1.32, 0); g.add(c); });
    g.position.y = -0.3; return g;
  }
  // ---------- 🎂 PASTEL EXPLOSIVO ----------
  function hacerPastel() {
    const g = new T.Group();
    const plato = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.03, 20), toon('#ffffff')); g.add(plato);
    const p1 = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.22, 20), toon('#ff7eb6')); p1.position.y = 0.12; g.add(p1);
    const crema = new T.Mesh(new T.TorusGeometry(0.28, 0.04, 8, 20), toon('#fff8e7')); crema.rotation.x = Math.PI / 2; crema.position.y = 0.23; g.add(crema);
    const vela = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.18, 8), toon('#2ee6d6')); vela.position.y = 0.33; g.add(vela);
    const llama = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), window.neon('#ffb347', 4)); llama.position.y = 0.45; g.add(llama);
    const mecha = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), window.neon('#ff2e2e', 3)); mecha.position.set(0.2, 0.2, 0.2); g.add(mecha);
    g.userData = { llama, mecha };
    g.position.set(0, 1.0, 0.72); return g;
  }
  // ---------- 🩸 VARILLA ----------
  function hacerVarilla() {
    const g = new T.Group();
    const v = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3.0, 10), new T.MeshToonMaterial({ color: '#b8c0cc' })); v.position.y = 1.5; g.add(v);
    const punta = new T.Mesh(new T.ConeGeometry(0.085, 0.3, 10), new T.MeshToonMaterial({ color: '#dfe6ee' })); punta.position.y = 3.15; g.add(punta);
    const roja = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 1.0, 10), toon('#a4161a')); roja.position.y = 2.5; roja.visible = false; g.add(roja);
    g.userData = { roja };
    return g;
  }

  const ANIMS = {
    granada: {
      nombre: 'Granada', frente: false, tMuerte: 2.1, tFin: 2.6, lento: [0.45, 0.85],
      montar(ua, uv, raiz) { const g = hacerGranada(); ua.brazos[1].add(g); const b = hacerBrillo(); uv.cuerpo.add(b); return { g, b, raiz, todo: [g, b] }; },
      posar(ua, uv, k, t, pr, alto) {
        if (ua) {
          const br = ua.brazos[1];
          if (t < 0.5) { br.rotation.z = 0.35 + 2.1 * (t / 0.5); br.rotation.x = 0; }
          else if (t < 0.8) { const q = (t - 0.5) / 0.3; br.rotation.z = 2.45 - 2.1 * q; br.rotation.x = -1.15 * q; ua.cuerpo.rotation.x = 0.25 * q; }
          else if (t < 2.4) { ua.brazos.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * 2.7; b.rotation.x = -0.4; }); ua.cuerpo.rotation.x = -0.15; }
        }
        volar(pr, uv, t, 0.55, 0.78, new T.Vector3(0, 0.55, -0.52));
        pr.g.visible = t < 0.78;
        if (uv) {
          if (t >= 0.78 && t < 1.08) { alto(Math.sin((t - 0.78) / 0.3 * Math.PI) * 0.45); uv.ojos.forEach(o => o.scale.set(1.6, 1.6, 1)); }
          if (t >= 1.08 && t < 2.1) {
            alto(0); const q = (t - 1.08) / 1.02;
            uv.cuerpo.scale.set(1 + 0.5 * q, 1 + 0.35 * q, 1 + 0.5 * q);
            uv.cuerpo.rotation.z = (Math.random() - 0.5) * 0.18 * q;
            uv.ojos.forEach(o => o.scale.set(1.6 + q, 1.6 + q, 1));
            pr.b.material.opacity = (0.15 + 0.45 * q) * (0.5 + 0.5 * Math.sin(t * (3 + q * 14) * Math.PI));
          }
        }
      },
      eventos: [
        [0.78, k => { S().texto(k.v, '😳‼️'); S().texto(k.a, '🙉'); A.bip(160, 0.12, 'sine', 0.08); setTimeout(() => A.bip(90, 0.1, 'sine', 0.08), 70); if (k.ca) mostrarFrase('😳 ¡¿POR AHÍ?!'); }],
      ],
      tick(k, t) { if (t >= 1.08 && t < 2.1 && t > (k.proxBip || 1.08)) { const q = (t - 1.08) / 1.02; A.bip(1900, 0.05, 'square', 0.05); k.proxBip = t + Math.max(0.07, 0.35 * (1 - q)); } },
      morir(k, color, jug) {
        explosionSonido(true); temblor(k, 0.9);
        const p = { x: k.x, y: 0.9, z: k.z };
        if (loVeo(k)) { fogonazo(p); Part.humo({ x: p.x, y: 1.3, z: p.z }); sangreChorro(p, true); }
        if (k.cv) { k.cv.visible = false; const c = { x: k.cvx, y: 0.9, z: SET.z }; fogonazo(c); sangreChorro(c, true); lanzarPedazos({ x: k.cvx, z: SET.z }, color, true); mostrarFrase('💥 ¡BOOM!'); }
        lanzarPedazos(k, color, false); dejarCuerpo(k, jug);
      },
    },

    martillo: {
      nombre: 'Martillazo', frente: false, tMuerte: 1.7, tFin: 2.2,
      lento: [0.6, 0.8],
      montar(ua) { const g = hacerMartillo(); ua.brazos[1].add(g); return { g, todo: [g] }; },
      posar(ua, uv, k, t, pr, alto) {
        if (ua) {
          const br = ua.brazos[1];
          if (t < 0.6) { const q = t / 0.6; br.rotation.x = -3.0 * q; br.rotation.z = 0.1; ua.cuerpo.rotation.x = -0.25 * q; }
          else if (t < 0.72) { const q = (t - 0.6) / 0.12; br.rotation.x = -3.0 + 2.15 * q; ua.cuerpo.rotation.x = -0.25 + 0.6 * q; }
          else if (t < 1.6) { br.rotation.x = -0.85; ua.cuerpo.rotation.x = 0.35; }
          else { const q = Math.min(1, (t - 1.6) / 0.4); br.rotation.x = -0.85 * (1 - q); ua.cuerpo.rotation.x = 0.35 * (1 - q); }
        }
        if (uv && t >= 0.72) {
          const q = Math.min(1, (t - 0.72) / 0.08);
          const tiembla = t < 1.4 ? Math.sin(t * 50) * 0.04 : 0;
          uv.cuerpo.scale.set(1 + 0.75 * q + tiembla, 1 - 0.86 * q, 1 + 0.75 * q - tiembla);
          uv.cuerpo.position.y = 0;
          uv.ojos.forEach(o => o.scale.set(1.9, 0.5, 1));
          uv.piernas.forEach(l => l.rotation.x = 0); uv.brazos.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * 1.5; });
          alto(0);
        }
      },
      eventos: [
        [0.05, k => { S().texto(k.a, '😈🔨'); if (k.ca) mostrarFrase('🔨 ¡MARTILLAZO!'); }],
        [0.72, k => {
          golpeSonido(); temblor(k, 0.7); S().texto(k.v, '💫 ¡PAF!');
          const p = { x: k.x, y: 0.4, z: k.z };
          if (loVeo(k)) { Part.impacto(p); sangreChorro(p, false); Part.rafaga(p, { n: 6, tex: '⭐', vel: 1.5, arriba: 1.2, vida: 1.2, tam: 0.3 }); }
          if (k.cv) { const c = { x: k.cvx, y: 0.4, z: SET.z }; Part.impacto(c); sangreChorro(c, true); Part.rafaga(c, { n: 8, tex: '⭐', vel: 1.5, arriba: 1.2, vida: 1.2, tam: 0.3 }); mostrarFrase('💫 ¡PAF!'); }
        }],
      ],
      morir(k, color, jug) {
        dejarAplastado(k, color);
      },
    },

    pastel: {
      nombre: 'Pastel explosivo', frente: true, tMuerte: 1.75, tFin: 2.3,
      montar(ua) { const g = hacerPastel(); ua.cuerpo.add(g); return { g, todo: [g] }; },
      posar(ua, uv, k, t, pr, alto) {
        if (ua) {
          if (t < 1.25) { const q = Math.min(1, t / 0.5); ua.brazos.forEach((b, i) => { b.rotation.x = -1.35 * q; b.rotation.z = (i ? -1 : 1) * 0.15; }); }
          else { ua.brazos.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * 2.7; b.rotation.x = -0.4; }); ua.cuerpo.rotation.x = -0.2; }
          pr.g.visible = t < 1.75;
          if (t >= 1.25 && pr.g.parent === ua.cuerpo) { // suelta el pastel (queda en el aire frente a la víctima)
            pr.g.position.z = 0.72 + Math.min(0.15, (t - 1.25) * 0.5);
          }
          const u = pr.g.userData;
          u.llama.scale.setScalar(1 + Math.sin(t * 20) * 0.2 + (t > 1.0 ? (t - 1.0) * 3 : 0));
          u.mecha.visible = t > 1.0 && Math.sin(t * (10 + (t - 1) * 30)) > 0;
        }
        if (uv) {
          if (t >= 0.6 && t < 1.75) { const q = Math.min(1, (t - 0.6) / 0.4); uv.cuerpo.rotation.x = 0.35 * q; uv.ojos.forEach(o => o.scale.set(1.2, 1.2, 1)); }
        }
      },
      eventos: [
        [0.05, k => { S().texto(k.a, '🎂 ¡Feliz cumple!'); A.bip(523, 0.15); setTimeout(() => A.bip(659, 0.15), 160); setTimeout(() => A.bip(784, 0.25), 320); if (k.ca) mostrarFrase('🎂 ¡FELIZ CUMPLEAÑOS!'); }],
        [0.7, k => { S().texto(k.v, '🥰 ¡Gracias!'); }],
        [1.25, k => { S().texto(k.a, '🙉'); if (k.ca) mostrarFrase('😳 ¿Eso hace bip?'); }],
      ],
      tick(k, t) { if (t >= 1.0 && t < 1.75 && t > (k.proxBip || 1.0)) { A.bip(2000, 0.04, 'square', 0.05); k.proxBip = t + Math.max(0.06, 0.25 * (1 - (t - 1) / 0.75)); } },
      morir(k, color, jug) {
        explosionSonido(true); temblor(k, 0.9);
        const fx = Math.sin(k.r), fz = Math.cos(k.r);
        const p = { x: k.x + fx * 0.4, y: 1.0, z: k.z + fz * 0.4 };
        const crema = q => Part.rafaga(q, { n: 30, colores: ['#ff7eb6', '#fff8e7', '#8b5a3c', '#2ee6d6'], tex: 'cuadro', vel: 5, arriba: 1.5, grav: 10, vida: 1.4, tam: 0.18, giro: 8 });
        if (loVeo(k)) { fogonazo(p); crema(p); sangreChorro({ x: k.x, y: 0.9, z: k.z }, true); }
        if (k.cv) { k.cv.visible = false; const c = { x: k.cvx, y: 1.0, z: SET.z }; fogonazo(c); crema(c); sangreChorro(c, true); lanzarPedazos({ x: k.cvx, z: SET.z }, color, true); mostrarFrase('💥 ¡BOOM DE CUMPLEAÑOS!'); }
        lanzarPedazos(k, color, false); dejarCuerpo(k, jug);
      },
    },

    varilla: {
      nombre: 'La varilla', frente: false, tMuerte: 2.15, tFin: 2.6, lento: [0.45, 0.95],
      montar(ua, uv) { const g = hacerVarilla(); ua.brazos[1].add(g); g.position.set(0, -0.4, 0.05); g.rotation.x = Math.PI; return { g, uv, todo: [g] }; },
      posar(ua, uv, k, t, pr, alto) {
        const g = pr.g;
        if (ua) {
          const br = ua.brazos[1];
          if (t < 0.45) { br.rotation.x = -0.8 * (t / 0.45); }
          else if (t < 0.8) { br.rotation.x = -0.8 - 0.4 * ((t - 0.45) / 0.35); ua.cuerpo.rotation.x = 0.25; }
          else { br.rotation.x = -1.2; ua.cuerpo.rotation.x = 0.2; }
        }
        // a los 0.45 s la varilla pasa a la víctima: entra por atrás y sale por la boca
        if (t >= 0.45 && uv && g.parent !== uv.cuerpo) { quitar(g); uv.cuerpo.add(g); g.rotation.set(0.42, 0, 0); }
        if (uv && g.parent === uv.cuerpo) {
          const q = Math.min(1, Math.max(0, (t - 0.45) / 0.35));
          g.position.set(0, -2.9 + 2.3 * q, -0.95 + 0.15 * q);
          g.userData.roja.visible = q > 0.9 && sangre();
          if (t >= 0.8 && t < 1.8) {
            alto(0.35 + Math.sin(t * 30) * 0.03);
            uv.ojos.forEach(o => o.scale.set(1.8, 1.8, 1));
            uv.piernas.forEach((l, i) => l.rotation.x = Math.sin(t * 18 + i * 2) * 0.6);
            uv.brazos.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * (2.2 + Math.sin(t * 25 + i) * 0.2); });
          }
          if (t >= 1.8) {
            const c = Math.min(1, (t - 1.8) / 0.35);
            alto(0.35 * (1 - c));
            uv.cuerpo.rotation.z = c * Math.PI / 2;
          }
        }
      },
      eventos: [
        [0.05, k => { S().texto(k.a, '😏'); if (k.ca) mostrarFrase('🩸 La varilla…'); }],
        [0.8, k => { S().texto(k.v, '😱 ¡AAAGH!'); A.bip(700, 0.4, 'sawtooth', 0.06); setTimeout(() => A.bip(500, 0.5, 'sawtooth', 0.05), 200); temblor(k, 0.5); if (k.ca) mostrarFrase('😱 ¡POR LA BOCA!'); }],
      ],
      tick(k, t) {
        if (t < 0.8 || t > 2.1 || t < (k.proxSangre || 0)) return;
        k.proxSangre = t + 0.06;
        const fx = Math.sin(k.r), fz = Math.cos(k.r);
        const boca = (x, z) => ({ x: x + fx * 0.45, y: 1.45, z: z + fz * 0.45 });
        const chorro = q => Part.rafaga(q, sangre() ? { n: 3, colores: ['#b00000', '#e01e37', '#7a0010'], vel: 1.4, arriba: 0.5, grav: 10, vida: 0.8, tam: 0.13 } : { n: 2, colores: ['#ff7eb6', '#ffd93d'], tex: 'cuadro', vel: 1.4, arriba: 0.5, grav: 10, vida: 0.8, tam: 0.1 });
        if (loVeo(k)) chorro(boca(k.x, k.z));
        if (k.cv) chorro({ x: k.cvx - 0.45, y: 1.45, z: SET.z });
      },
      morir(k, color) {
        golpeSonido();
        dejarEnsartado(k, color);
        const vv = S().pjs.get(k.v);
        if (vv && vv.obj) vv.obj.userData.cuerpo.rotation.z = 0;
      },
    },
  };
  const MUERTES = Object.keys(ANIMS);

  function alMuerte(m) {
    if (!activo || ZooReunion.activa() || rol(m.a) !== 'i' || !vivo(m.a) || !vivo(m.v) || rol(m.v) === 'i') return;
    const vv = S().pjs.get(m.v), va = S().pjs.get(m.a);
    if (!vv || !va) return;
    const tipo = ANIMS[m.tipo] ? m.tipo : 'granada', D = ANIMS[tipo];
    // la víctima se congela; el impostor aparece detrás (o al frente, si le regala el pastel)
    const fx = Math.sin(m.r), fz = Math.cos(m.r);
    const kx = D.frente ? m.x + fx * 1.3 : m.x - fx * DIST, kz = D.frente ? m.z + fz * 1.3 : m.z - fz * DIST, kr = D.frente ? m.r + Math.PI : m.r;
    const yp = S().yoPos;
    if (m.v === miId()) { yp.x = m.x; yp.z = m.z; yp.r = m.r; S().enviarPos(true); }
    else { vv.cx = vv.tx = m.x; vv.cz = vv.tz = m.z; vv.cr = vv.tr = m.r; }
    if (m.a === miId()) { yp.x = kx; yp.z = kz; yp.r = kr; S().enviarPos(true); }
    else { va.cx = va.tx = kx; va.cz = va.tz = kz; va.cr = va.tr = kr; }
    const k = { tipo, a: m.a, v: m.v, x: m.x, z: m.z, r: m.r, t: -ACERCA, ev: [], murio: false };
    // camino del impostor: desde donde estaba hasta su lugar junto a la víctima
    let sx = m.ax, sz = m.az;
    if (sx == null || Math.hypot(sx - kx, sz - kz) < 0.6) { sx = kx - (D.frente ? -fx : fx) * 1.6; sz = kz - (D.frente ? -fz : fz) * 1.6; }
    k.desde = { x: sx, z: sz }; k.hasta = { x: kx, z: kz, r: kr };
    if (m.a === miId()) { yp.x = sx; yp.z = sz; } else { va.cx = va.tx = sx; va.cz = va.tz = sz; }
    k.pm = D.montar(va.obj.userData, vv.obj.userData, A.escena); // en el mapa (lo ven los demás)
    // en el escenario de cine (lo ven el impostor y la víctima)
    if (m.a === miId() || m.v === miId()) {
      k.ca = Zoo.crear(ropaDe(m.a)); k.cv = Zoo.crear(ropaDe(m.v));
      k.cvx = SET.x + (D.frente ? 0.65 : -0.35);
      k.caFin = k.cvx - SET.x + (D.frente ? -1.3 : DIST); k.caIni = k.caFin + (D.frente ? -2.2 : 2.2);
      k.cv.position.set(k.cvx - SET.x, 0, 0); k.ca.position.set(k.caIni, 0, 0);
      k.cv.rotation.y = -Math.PI / 2; k.ca.rotation.y = D.frente ? Math.PI / 2 : -Math.PI / 2;
      set.add(k.ca); set.add(k.cv); set.visible = true;
      S().reiniciarCamara(); // la cámara salta directo al escenario
      k.pc = D.montar(k.ca.userData, k.cv.userData, set);
      $('#cine').classList.add('ver'); setTimeout(() => $('#cine').classList.remove('ver'), (D.tFin + ACERCA) * 1000 + 600);
    }
    muriendo.set(m.v, k);
    if (m.v === miId()) ZooMisiones.cerrar();
  }

  // ---- animación paso a paso ----
  function animarMuertes(dt) {
    muriendo.forEach((k, vid) => {
      const D = ANIMS[k.tipo];
      const lento = D.lento && k.t >= D.lento[0] && k.t < D.lento[1];
      k.t += lento ? dt * 0.4 : dt; const t = k.t; // 🐢 cámara lenta en el momento clave
      const va = S().pjs.get(k.a), vv = S().pjs.get(k.v);
      const yp = S().yoPos;
      if (k.v === miId()) { yp.x = k.x; yp.z = k.z; yp.r = k.r; }
      else if (vv) { vv.cx = vv.tx = k.x; vv.cz = vv.tz = k.z; vv.cr = vv.tr = k.r; }
      if (t < 0) { // el impostor se acerca caminando (a escondidas 🤫)
        const q = suaveM(1 + t / ACERCA), h = k.hasta;
        const x = k.desde.x + (h.x - k.desde.x) * q, z = k.desde.z + (h.z - k.desde.z) * q;
        const r = q < 0.85 ? Math.atan2(h.x - k.desde.x, h.z - k.desde.z) : h.r;
        if (k.a === miId()) { yp.x = x; yp.z = z; yp.r = r; } else if (va) { va.cx = va.tx = x; va.cz = va.tz = z; va.cr = va.tr = r; }
        if (va && va.obj) Zoo.animar(va.obj, dt, 'caminar');
        if (k.ca) { k.ca.position.x = k.caIni + (k.caFin - k.caIni) * q; Zoo.animar(k.ca, dt, 'caminar'); Zoo.animar(k.cv, dt, 'quieto'); }
        return;
      }
      if (!k.llego) { k.llego = true; const h = k.hasta; if (k.a === miId()) { yp.x = h.x; yp.z = h.z; yp.r = h.r; S().enviarPos(true); } else if (va) { va.cx = va.tx = h.x; va.cz = va.tz = h.z; va.cr = va.tr = h.r; } if (k.ca) k.ca.position.x = k.caFin; }
      if (!k.murio) D.posar(va && va.obj && va.obj.userData, vv && vv.obj && vv.obj.userData, k, t, k.pm, a => { if (vv) vv.alto = a; });
      else if (va && va.obj) D.posar(va.obj.userData, null, k, t, k.pm, () => { });
      if (k.ca) {
        Zoo.animar(k.ca, dt, 'quieto'); if (k.cv.visible) Zoo.animar(k.cv, dt, 'quieto');
        D.posar(k.ca.userData, k.cv.visible ? k.cv.userData : null, k, t, k.pc, a => k.cv.position.y = a);
      }
      D.eventos.forEach(([te, fn], i) => { if (t >= te && !k.ev[i]) { k.ev[i] = true; fn(k); } });
      if (D.tick) D.tick(k, t, dt);
      if (t >= D.tMuerte && !k.murio) { k.murio = true; morir(k); }
      if (t >= D.tFin) { cerrarMuerte(k, vid); if (S().soyHost()) setTimeout(revisarFin, 2600); } // dejar ver la escena antes del final
    });
  }
  function cerrarMuerte(k, vid) {
    const va = S().pjs.get(k.a), vv = S().pjs.get(k.v);
    if (va && va.obj) { va.obj.userData.cuerpo.rotation.x = 0; }
    if (vv) vv.alto = 0;
    k.pm.todo.forEach(quitar);
    if (k.ca) { k.pc.todo.forEach(quitar); set.remove(k.ca); set.remove(k.cv); Zoo.liberar(k.ca); Zoo.liberar(k.cv); if (![...muriendo.values()].some(x => x !== k && x.ca)) set.visible = false; S().reiniciarCamara(); $('#cine').classList.remove('ver'); }
    muriendo.delete(vid);
    pintarHud();
  }
  // si empieza una reunión mientras alguien está muriendo: termina de golpe
  function cortarMuertes() {
    muriendo.forEach((k, vid) => { if (!k.murio) { k.murio = true; morir(k); } cerrarMuerte(k, vid); });
  }
  function mostrarFrase(txt) {
    const f = $('#frase'); f.textContent = txt; f.classList.remove('ver'); void f.offsetWidth; f.classList.add('ver');
  }

  // la víctima muere: lo que deja cada animación + se vuelve fantasma
  function morir(k) {
    const vv = S().pjs.get(k.v);
    const jug = ropaDe(k.v), color = jug.color || '#ff9f43';
    ANIMS[k.tipo].morir(k, color, jug);
    if (vv && vv.obj) { k.pm.todo.forEach(o => { if (o.parent === vv.obj.userData.cuerpo) quitar(o); }); vv.alto = 0; }
    muertos.add(k.v);
    cuerpos.push({ id: k.v, x: k.x, z: k.z });
    hacerFantasma(k.v);
    if (k.v === miId()) setTimeout(() => {
      const a = $('#aviso-muerte'); a.querySelector('b').textContent = { granada: '💥 ¡TE EXPLOTARON!', martillo: '🔨 ¡TE APLASTARON!', pastel: '🎂 ¡PASTEL MORTAL!', varilla: '🩸 ¡TE ENSARTARON!' }[k.tipo];
      a.classList.add('ver'); setTimeout(() => a.classList.remove('ver'), 3500);
      pintarHud();
    }, 600);
  }

  // ---- restos: aplastado como panqueque ----
  function dejarAplastado(k, color) {
    const g = new T.Group(); g.position.set(k.x, 0, k.z); g.rotation.y = k.r;
    const cuerpo = new T.Mesh(new T.SphereGeometry(0.62, 22, 12), toon(color)); cuerpo.scale.set(1.25, 0.14, 1.25); cuerpo.position.y = 0.09; g.add(cuerpo);
    [-0.18, 0.18].forEach(x => { // ojitos en X
      [0.6, -0.6].forEach(rz => { const l = new T.Mesh(new T.BoxGeometry(0.16, 0.03, 0.035), toon('#1b1b24')); l.position.set(x, 0.19, 0.38); l.rotation.y = rz; g.add(l); });
    });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    A.escena.add(g); restos.push(g);
    mancha(k.x, k.z, 1.45, true);
  }
  // ---- restos: ensartado con la varilla ----
  function dejarEnsartado(k, color) {
    const g = new T.Group(); g.position.set(k.x, 0, k.z); g.rotation.y = k.r;
    const cuerpo = new T.Mesh(new T.CapsuleGeometry(0.5, 0.45, 8, 16), toon(color)); cuerpo.rotation.z = Math.PI / 2; cuerpo.position.y = 0.5; g.add(cuerpo);
    const vara = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 2.4, 8), new T.MeshToonMaterial({ color: sangre() ? '#a4161a' : '#b8c0cc' })); vara.rotation.z = Math.PI / 2; vara.position.y = 0.55; g.add(vara);
    const punta = new T.Mesh(new T.ConeGeometry(0.06, 0.22, 8), new T.MeshToonMaterial({ color: '#dfe6ee' })); punta.rotation.z = -Math.PI / 2; punta.position.set(1.3, 0.55, 0); g.add(punta);
    [-0.15, 0.15].forEach(z => { const o = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), toon('#ffffff')); o.position.set(-0.85, 0.75, z); g.add(o); });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.01); g.userData.aparece = true;
    A.escena.add(g); restos.push(g);
    mancha(k.x, k.z, 1.35, true);
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
    ZooMisiones.cuadro(dt, t, S().yoPos, !soyImpostor() && !bloqueado() && !terminando, !mostrandoRol);
    Mansion.actualizarVista(S().yoPos.x, S().yoPos.z, dt, soyFantasma());
    const yp0 = S().yoPos, miCuarto = Mansion.cuartoDe(yp0.x, yp0.z), veTodo = soyFantasma();
    restos.forEach(r => {
      if (!r.userData.libre) r.visible = veTodo || Mansion.cuartoDe(r.position.x, r.position.z) === miCuarto || Math.hypot(r.position.x - yp0.x, r.position.z - yp0.z) < 2.5;
      if (r.userData.crece && r.scale.x < 1) r.scale.setScalar(Math.min(1, r.scale.x + dt * 1.2));
      if (r.userData.aparece && r.scale.x < 1) r.scale.setScalar(Math.min(1, r.scale.x + dt * 8));
    });
    // botón matar: ¿hay alguien cerca?
    objetivo = null;
    if (soyImpostor() && !soyFantasma() && !ZooSabotaje.yoEnVent()) {
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

  ZooMisiones.alTerminar = (mid, paso) => { if (activo) S().enviar('mision', { id: miId(), m: mid, paso }); };

  // ================= FIN DE LA PARTIDA =================
  function revisarFin() {
    if (!activo || terminando || !S().soyHost()) return;
    const presentes = new Set(S().jugadores.map(j => j.id));
    const vivosImp = Object.keys(roles).filter(id => presentes.has(id) && roles[id] === 'i' && vivo(id)).length;
    const vivosTrip = Object.keys(roles).filter(id => presentes.has(id) && roles[id] === 't' && vivo(id)).length;
    let gana = null;
    if (vivosImp === 0 || ZooMisiones.progreso() >= 1) gana = 't';
    else if (nInicial >= 3 ? vivosImp >= vivosTrip : vivosTrip === 0) gana = 'i';
    if (gana) S().enviar('fin', { gana, roles });
  }
  function alFin(m) {
    if (!activo || terminando) return;
    terminando = true;
    ZooReunion.terminar();
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
    ZooMisiones.terminar();
    ZooSabotaje.terminar();
    ZooReunion.terminar();
    activo = false; terminando = false; mostrandoRol = false;
    muriendo.forEach(k => { k.pm.todo.forEach(quitar); if (k.ca) { k.pc.todo.forEach(quitar); set.remove(k.ca); set.remove(k.cv); } });
    set.visible = false;
    muriendo.clear(); muertos.clear(); limpiarRestos(); anillo.visible = false;
    $('#p-sala').classList.remove('en-juego');
    ['#revelar', '#aviso-muerte'].forEach(s => $(s).classList.remove('ver'));
    $('#final').className = '';
    Mansion.grupo.visible = false; Salon.grupo.visible = true; window.sinBrillo = false;
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
    restos.length = 0; pedazos.length = 0; cuerpos.length = 0;
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
    const r = ZooReunion.cine(); if (r) return r;
    for (const k of muriendo.values()) {
      if (!k.ca) continue;
      const atras = k.murio ? 1.6 : 0;
      const alto = k.tipo === 'varilla' ? 0.45 : 0, abierta = k.t < 0 ? 1.8 * (-k.t / ACERCA) : 0, lejos = (k.tipo === 'varilla' || k.tipo === 'pastel' ? 0.9 : 0) + abierta, cx = (k.tipo === 'pastel' ? SET.x : SET.x - 0.05) + (k.ca ? (k.ca.position.x - k.caFin) * 0.4 : 0);
      return { pos: [cx, 1.45 + alto + atras * 0.4, SET.z + 4.4 + lejos + atras], mira: [cx, 0.95 + alto, SET.z] };
    }
    return null;
  }

  // ================= LO QUE USA sala.js =================
  function bloqueado() {
    if (mostrandoRol || terminando) return true;
    if (ZooReunion.bloquea()) return true;
    if (muriendo.has(miId())) return true;
    if (ZooMisiones.abierta()) return true;
    if (ZooSabotaje.yoEnVent()) return true;
    for (const k of muriendo.values()) if (k.a === miId() && k.t < 2.4) return true;
    return false;
  }

  window.ZooJuego = {
    _dbg: { get roles() { return roles; }, sinEspera() { enfriaHasta = 0; }, get muriendo() { return muriendo; } }, // para pruebas automáticas
    MUERTES: ['granada', 'martillo', 'pastel', 'varilla'],
    get activo() { return activo; },
    comenzar, terminar, bloqueado, soyFantasma, cine,
    // lo que usa reunion.js
    interno: {
      get roles() { return roles; }, muertos, cuerpos, vivo, rol, soyImpostor, ropaDe, escapar, mismoCuarto, revisarFin, pintarHud, cortarMuertes, limpiarRestos,
      get terminando() { return terminando; },
      expulsar(id) { if (!roles[id] || muertos.has(id)) return; muertos.add(id); hacerFantasma(id); if (id === miId()) ZooMisiones.cerrar(); pintarHud(); },
      // después de la reunión: todos a la mesa del vestíbulo
      reubicar() {
        const ids = Object.keys(roles), yp = S().yoPos;
        ids.forEach((id, i) => {
          const p = Mansion.salida(i, ids.length);
          if (id === miId()) { yp.x = p.x; yp.z = p.z; yp.r = Math.PI; }
          const v = S().pjs.get(id); if (v) { v.cx = v.tx = p.x; v.cz = v.tz = p.z; v.cr = v.tr = Math.PI; v.alto = 0; v.efecto = null; }
        });
        S().enviarPos(true); S().reiniciarCamara();
      },
      reiniciarEspera() { enfriaHasta = Date.now() + S().cfg().enfriamiento * 1000; },
    },
    velocidad: () => soyFantasma() ? 1.25 : 1,
    // los vivos no ven a los fantasmas
    visible: id => (!muertos.has(id) || soyFantasma()) && !ZooSabotaje.enVent(id),
    efecto(v, id, dt, t) {
      // ¿está en mi mismo cuarto? (los fantasmas ven a todos)
      if (id !== miId() && !soyFantasma() && !muriendo.has(id) && !mismoCuarto(v)) { v.obj.visible = false; v.etiqueta.style.visibility = 'hidden'; }
      // con las luces apagadas, el tripulante solo ve muy cerquita
      if (id !== miId() && ZooSabotaje.oscuro() && !soyImpostor() && !soyFantasma() && Math.hypot(v.cx - S().yoPos.x, v.cz - S().yoPos.z) > 3.2) { v.obj.visible = false; v.etiqueta.style.visibility = 'hidden'; }
      ZooSabotaje.posar(v, id, dt); // trampilla
      if (v.fantasma && v.obj) { v.obj.position.y = 0.35 + Math.sin(t * 2 + id.length) * 0.12; v.obj.userData.piernas.forEach(l => l.rotation.x = 0.4); }
      v.etiqueta.classList.toggle('imp', soyImpostor() && rol(id) === 'i');
      v.etiqueta.classList.toggle('fant', muertos.has(id));
    },
    registrar(canal) {
      ZooSabotaje.registrar(canal);
      ZooReunion.registrar(canal);
      canal.on('broadcast', { event: 'mision' }, ({ payload }) => { if (!activo) return; ZooMisiones.alHecho(payload); if (S().soyHost()) setTimeout(revisarFin, 300); })
        .on('broadcast', { event: 'muerte' }, ({ payload }) => alMuerte(payload))
        .on('broadcast', { event: 'fin' }, ({ payload }) => alFin(payload));
    },
    alCambiarJugadores() { pintarHud(); if (S().soyHost()) setTimeout(revisarFin, 500); },
    salir() { terminar(); },
  };
})();
