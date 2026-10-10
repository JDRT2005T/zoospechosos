// ZOOspechosos — Reuniones 🚨: reportar cuerpos, botón de emergencia, chat, votación y expulsión
(function () {
  const A = window.ZooApp, T = THREE;
  const S = () => ZooSala.interno;
  const G = () => ZooJuego.interno;
  const $ = s => document.querySelector(s);
  const DIST_CUERPO = 2.4, DIST_BOTON = 2.2, ESPERA_BOTON = 15000;

  // ---------- estado ----------
  let partida = false;
  let fase = null;               // null | 'intro' | 'votar' | 'resultado' | 'expulsion'
  let datos = null;              // { quien, tipo: 'cuerpo'|'boton', muerto }
  let votos = {};                // votante -> elegido | 'saltar'
  let finVoto = 0, enviado = false, elegido = null, botonDesde = 0, accion = null, miCuarto = '';
  const usados = new Set();      // quienes ya usaron su reunión de emergencia
  let timers = [];
  const luego = (ms, f) => timers.push(setTimeout(f, ms));

  const miId = () => S().miId();
  const esc = s => G().escapar(s);
  const nombre = id => S().nombreDe(id);
  function avatar(id, chico) {
    const j = G().ropaDe(id), a = Zoo.ANIMALES.find(x => x.id === j.animal);
    return `<i class="rn-av${chico ? ' chico' : ''}" style="background:${j.color || '#888'}">${a ? a.emoji : '🐾'}</i>`;
  }

  function iniciar() {
    limpiarTodo();
    partida = true; usados.clear();
    botonDesde = Date.now() + ESPERA_BOTON;
  }
  function terminar() { limpiarTodo(); partida = false; }
  function limpiarTodo() {
    timers.forEach(clearTimeout); timers = [];
    fase = null; datos = null; votos = {}; enviado = false; elegido = null; accion = null;
    ['#reunion', '#rn-intro', '#rn-texto'].forEach(s => $(s).classList.remove('ver'));
    document.body.classList.remove('rn-exp');
    $('#b-reportar').hidden = true;
    $('#rn-input').blur();
    pararExpulsion();
  }

  // ================= BOTÓN REPORTAR / REUNIÓN =================
  A.alCuadro.push(dt => {
    animarExpulsion(dt);
    const b = $('#b-reportar');
    if (!partida || fase || !ZooJuego.activo || ZooCaceria.activa()) { accion = null; b.hidden = true; return; } // en la cacería no hay reuniones
    accion = null;
    if (!ZooJuego.soyFantasma() && !ZooJuego.bloqueado()) {
      const yp = S().yoPos, cuarto = Mansion.cuartoDe(yp.x, yp.z);
      for (const c of G().cuerpos) {
        const d = Math.hypot(c.x - yp.x, c.z - yp.z);
        if (d < DIST_CUERPO && (d < 1.6 || Mansion.cuartoDe(c.x, c.z) === cuarto)) { accion = { tipo: 'cuerpo', muerto: c.id }; break; }
      }
      const V = Mansion.RECT.V;
      if (!accion && Math.hypot(V.cx - yp.x, V.cz - yp.z) < DIST_BOTON) accion = { tipo: 'boton' };
    }
    b.hidden = !accion;
    if (!accion) return;
    const boton = accion.tipo === 'boton';
    b.querySelector('span').textContent = boton ? '🚨' : '📢';
    b.querySelector('small').textContent = boton ? 'REUNIÓN' : 'REPORTAR';
    const falta = boton ? Math.ceil((botonDesde - Date.now()) / 1000) : 0;
    b.querySelector('b').textContent = falta > 0 ? falta : '';
    b.classList.toggle('listo', !boton || (falta <= 0 && !usados.has(miId()) && !ZooSabotaje.hay()));
    b.classList.toggle('emergencia', boton);
  });

  $('#b-reportar').addEventListener('click', () => {
    if (!accion || fase) return;
    if (accion.tipo === 'boton') {
      if (usados.has(miId())) return A.toast('Ya usaste tu reunión de emergencia 🚨');
      if (ZooSabotaje.hay()) return A.toast('¡Primero arreglen el sabotaje! ⚠️');
      if (Date.now() < botonDesde) return A.toast('Espera un poquito ⏳');
    }
    S().enviar('reunion', { quien: miId(), tipo: accion.tipo, muerto: accion.muerto || null });
  });

  // ================= EMPIEZA LA REUNIÓN =================
  function alReunion(m) {
    if (!partida || fase || G().terminando || !G().vivo(m.quien)) return;
    if (m.tipo === 'boton') usados.add(m.quien);
    datos = m; votos = {}; elegido = null; enviado = false;
    const yp = S().yoPos; miCuarto = Mansion.cuartoDe(yp.x, yp.z) || 'un pasillo';
    // se corta todo lo que estaba pasando
    G().cortarMuertes();
    ZooSabotaje.limpiar();
    ZooMisiones.cerrar();
    $$('.modal').forEach(x => x.classList.remove('activa'));
    fase = 'intro';
    const cuerpo = m.tipo === 'cuerpo';
    const it = $('#rn-intro');
    it.className = 'ver ' + (cuerpo ? 'cuerpo' : 'boton');
    it.querySelector('.rn-i-ico').textContent = cuerpo ? '📢' : '🚨';
    it.querySelector('b').textContent = cuerpo ? '¡CUERPO REPORTADO!' : '¡REUNIÓN DE EMERGENCIA!';
    it.querySelector('small').innerHTML = cuerpo
      ? `${avatar(m.quien, true)} <b>${esc(nombre(m.quien))}</b> encontró a ${avatar(m.muerto, true)} <b>${esc(nombre(m.muerto))}</b> 💀`
      : `${avatar(m.quien, true)} <b>${esc(nombre(m.quien))}</b> tocó el botón`;
    for (let i = 0; i < 4; i++) setTimeout(() => A.bip(i % 2 ? 660 : 880, 0.22, 'square', 0.06), i * 260);
    luego(2400, abrir);
  }

  function abrir() {
    $('#rn-intro').classList.remove('ver');
    fase = 'votar';
    finVoto = Date.now() + (S().cfg().reunion || 60) * 1000;
    $('#rn-log').innerHTML = '';
    $('#rn-tit').textContent = '¿Quién es el impostor? 🤔';
    $('#rn-sub').innerHTML = datos.tipo === 'cuerpo'
      ? `📢 ${esc(nombre(datos.quien))} reportó el cuerpo de ${esc(nombre(datos.muerto))}`
      : `🚨 ${esc(nombre(datos.quien))} llamó a reunión`;
    const cu = G().cuerpos.find(c => c.id === datos.muerto);
    sistema(datos.tipo === 'cuerpo' ? `📢 ${nombre(datos.quien)} encontró el cuerpo de ${nombre(datos.muerto)} en ${(cu && Mansion.cuartoDe(cu.x, cu.z)) || 'un pasillo'}` : `🚨 ${nombre(datos.quien)} llamó a reunión de emergencia`);
    if (ZooJuego.soyFantasma()) sistema('👻 Eres fantasma: no puedes votar y solo los fantasmas leen tu chat');
    pintarRapidos();
    $('#reunion').classList.add('ver');
    pintar();
  }

  // ================= TARJETAS DE LOS JUGADORES =================
  function pintar() {
    if (!datos) return;
    const g = G(), roles = g.roles, yo = miId(), puedoVotar = fase === 'votar' && g.vivo(yo) && !votos[yo];
    const presentes = new Set(S().jugadores.map(j => j.id));
    const resultado = fase === 'resultado';
    const anon = S().cfg().votoAnonimo;
    const quienesVotaron = a => Object.keys(votos).filter(v => votos[v] === a);
    const puntos = a => quienesVotaron(a).map(v => anon ? '<i class="rn-av chico anon">?</i>' : avatar(v, true)).join('');
    const ids = Object.keys(roles);
    $('#rn-jugadores').innerHTML = ids.map(id => {
      const vivo = g.vivo(id), fuera = !presentes.has(id);
      const imp = g.soyImpostor() && roles[id] === 'i';
      const cls = ['rn-j', vivo ? '' : 'muerto', fuera ? 'fuera' : '', id === yo ? 'yo' : '', imp ? 'imp' : '', elegido === id ? 'sel' : '', puedoVotar && vivo && !fuera ? 'votable' : ''].join(' ');
      const marcas = (datos.quien === id ? '<em title="Llamó a la reunión">' + (datos.tipo === 'cuerpo' ? '📢' : '🚨') + '</em>' : '') + (!resultado && votos[id] ? '<em class="voto">VOTÓ</em>' : '');
      const estado = fuera ? '🚪 se fue' : !vivo ? '💀 muerto' : id === yo ? '(tú)' : '';
      const conf = elegido === id && puedoVotar ? '<span class="rn-conf"><button data-si="1">✔</button><button data-no="1">✖</button></span>' : '';
      return `<div class="${cls}" data-id="${id}">${avatar(id)}<div class="rn-nom"><b>${esc(nombre(id))}</b><small>${estado}</small>${resultado ? `<span class="rn-puntos">${puntos(id)}</span>` : ''}</div>${marcas}${conf}</div>`;
    }).join('');
    $('#rn-saltar').hidden = !puedoVotar;
    $('#rn-saltaron').innerHTML = resultado && quienesVotaron('saltar').length ? '⏭ Saltaron: ' + puntos('saltar') : '';
    const nVivos = ids.filter(id => g.vivo(id) && presentes.has(id)).length, nVotos = Object.keys(votos).length;
    $('#rn-estado').textContent = resultado ? '' : !g.vivo(yo) ? '👻 Los fantasmas no votan' : votos[yo] ? `✅ Ya votaste · ${nVotos}/${nVivos}` : `🗳️ ${nVotos}/${nVivos} votaron`;
  }

  $('#rn-jugadores').addEventListener('click', e => {
    if (fase !== 'votar' || votos[miId()] || !G().vivo(miId())) return;
    if (e.target.closest('[data-si]')) { votar(elegido); return; }
    if (e.target.closest('[data-no]')) { elegido = null; pintar(); return; }
    const c = e.target.closest('.rn-j.votable'); if (!c) return;
    elegido = c.dataset.id; A.bip(900, 0.05, 'sine', 0.04); pintar();
  });
  $('#rn-saltar').addEventListener('click', () => votar('saltar'));
  function votar(a) {
    if (!a || fase !== 'votar' || votos[miId()]) return;
    elegido = null;
    S().enviar('voto', { id: miId(), a });
  }
  function alVoto(m) {
    if (fase !== 'votar' || votos[m.id] || !G().vivo(m.id)) return;
    if (m.a !== 'saltar' && !G().vivo(m.a)) return;
    votos[m.id] = m.a;
    A.bip(m.id === miId() ? 1200 : 520, 0.08, 'triangle', 0.05);
    pintar();
  }

  // ================= CHAT DE LA REUNIÓN =================
  let ultimoChat = 0;
  $('#rn-form').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#rn-input'), txt = inp.value.trim().slice(0, 80);
    if (!txt) return;
    if (decir(txt)) inp.value = '';
  });
  function decir(txt) {
    if (!fase || fase === 'expulsion') return false;
    if (Date.now() - ultimoChat < 700) { A.toast('Más despacio 😅'); return false; }
    ultimoChat = Date.now();
    S().enviar('rchat', { id: miId(), txt });
    return true;
  }
  function pintarRapidos() {
    const frases = [`📍 Estaba en ${miCuarto}`, '🙋 Yo no fui', '🤔 ¿Dónde estaban?', '👀 ¡Yo lo vi!', '⏭ Saltemos'];
    const c = $('#rn-rapidos'); c.innerHTML = '';
    frases.forEach(f => { const b = document.createElement('button'); b.type = 'button'; b.textContent = f; b.onclick = () => decir(f); c.appendChild(b); });
  }
  function alChat(m) {
    if (!fase || fase === 'expulsion') return;
    const txt = String(m.txt || '').slice(0, 80); if (!txt) return;
    const fantasma = !G().vivo(m.id);
    if (fantasma && !ZooJuego.soyFantasma()) return; // los vivos no oyen a los fantasmas
    agregar(`${avatar(m.id, true)}<b>${esc(nombre(m.id))}${fantasma ? ' 👻' : ''}:</b> ${esc(txt)}`, fantasma ? 'fant' : '');
    if (m.id !== miId()) A.bip(1320, 0.05, 'sine', 0.04);
  }
  function sistema(txt) { agregar(esc(txt), 'sis'); }
  function agregar(html, cls) {
    const log = $('#rn-log'), d = document.createElement('div');
    if (cls) d.className = cls; d.innerHTML = html; log.appendChild(d);
    while (log.children.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  // ================= TIEMPO Y CONTEO (lo decide el anfitrión) =================
  A.alCuadro.push(() => {
    if (fase !== 'votar') return;
    const falta = Math.max(0, Math.ceil((finVoto - Date.now()) / 1000));
    const t = $('#rn-tiempo');
    if (t.textContent !== String(falta)) { t.textContent = falta; t.classList.toggle('poco', falta <= 10); if (falta <= 5 && falta > 0) A.bip(440, 0.05, 'square', 0.03); }
  });
  // el anfitrión cuenta con un reloj normal (sigue andando aunque tenga la app minimizada)
  setInterval(() => {
    if (fase !== 'votar' || !S().soyHost() || enviado) return;
    const presentes = new Set(S().jugadores.map(j => j.id));
    const vivos = Object.keys(G().roles).filter(id => G().vivo(id) && presentes.has(id));
    const todos = vivos.every(id => votos[id]);
    if (Date.now() > finVoto + 600 || (todos && vivos.length)) {
      enviado = true;
      S().enviar('expulsion', contar(presentes));
    }
  }, 400);
  function contar(presentes) {
    const valen = {}, cuenta = {};
    Object.entries(votos).forEach(([v, a]) => { if (G().vivo(v) && presentes.has(v)) { valen[v] = a; cuenta[a] = (cuenta[a] || 0) + 1; } });
    let max = 0, quien = null, empate = false;
    Object.entries(cuenta).forEach(([a, n]) => { if (n > max) { max = n; quien = a; empate = false; } else if (n === max) empate = true; });
    const nadie = !quien || empate || quien === 'saltar';
    const r = { id: nadie ? null : quien, empate: !!quien && empate, saltaron: quien === 'saltar' && !empate, votos: valen };
    if (r.id && G().roles[r.id] === 'i') r.caza = ZooCaceria.generar(); // ¡le atinaron! el anfitrión reparte las piezas
    return r;
  }

  // ================= RESULTADO Y EXPULSIÓN =================
  function alExpulsion(m) {
    if (fase !== 'votar' && fase !== 'intro') return;
    timers.forEach(clearTimeout); timers = [];
    $('#rn-intro').classList.remove('ver');
    if (!$('#reunion').classList.contains('ver')) { if (!datos) return; abrir(); }
    fase = 'resultado'; elegido = null;
    votos = m.votos || {};
    $('#rn-tit').textContent = '🗳️ ¡Resultados!';
    $('#rn-tiempo').textContent = '';
    $('#rn-input').blur();
    pintar();
    if (m.id) { const c = $(`.rn-j[data-id="${m.id}"]`); if (c) c.classList.add('expulsado'); }
    A.bip(330, 0.3, 'triangle', 0.06);
    const esImp = m.id && G().roles[m.id] === 'i';
    const inocente = m.id && G().roles[m.id] === 't' && G().vivo(m.id);
    luego(4000, () => fundido(() => { $('#reunion').classList.remove('ver'); if (esImp) cazar(m); else if (inocente) encarcelar(m); else expulsar(m); }));
  }
  function fundido(f) {
    const d = $('#fundido'); d.classList.add('ver');
    setTimeout(() => { f(); d.classList.remove('ver'); }, 600);
  }

  // ---- escena: sale volando por la ventana hacia el cielo de noche ----
  const ESP = new T.Vector3(0, 0, -260);
  let esc3d = null, volador = null, tExp = 0;
  function armarCielo() {
    const g = new T.Group(); g.position.copy(ESP); g.visible = false; A.escena.add(g);
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#05010f'); gr.addColorStop(0.6, '#1b0a3d'); gr.addColorStop(1, '#4a1a6b');
    x.fillStyle = gr; x.fillRect(0, 0, 16, 256);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const cielo = new T.Mesh(new T.CylinderGeometry(40, 40, 50, 40, 1, true), new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false }));
    cielo.position.y = 14; g.add(cielo);
    // estrellas
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 8; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = -2 + Math.random() * 34; pos[i * 3 + 2] = Math.sin(a) * r; }
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const est = new T.Points(pg, new T.PointsMaterial({ color: '#ffffff', size: 0.22, fog: false })); g.add(est);
    // luna
    const luna = new T.Mesh(new T.SphereGeometry(2.2, 24, 16), new T.MeshBasicMaterial({ color: '#fff3c4', fog: false })); luna.position.set(12, 16, -30); g.add(luna);
    const halo = new T.Mesh(new T.CircleGeometry(4, 32), new T.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.12, fog: false, depthWrite: false })); halo.position.set(12, 16, -31); g.add(halo);
    // la mansión de lejos (silueta con ventanas)
    const negro = new T.MeshBasicMaterial({ color: '#0b0418', fog: false }), luz = new T.MeshBasicMaterial({ color: '#ffd36b', fog: false });
    [[-9, 5, 7], [-4, 3.5, 5], [-13, 3, 4]].forEach(([px, h, w]) => {
      const b = new T.Mesh(new T.BoxGeometry(w, h, 2), negro); b.position.set(px, h / 2 - 0.5, -6); g.add(b);
      for (let i = 0; i < 6; i++) { const v = new T.Mesh(new T.PlaneGeometry(0.5, 0.6), luz); v.position.set(px - w / 2 + 0.8 + (i % 3) * (w - 1.6) / 2, 0.6 + Math.floor(i / 3) * 1.4, -4.99); if (Math.random() < 0.8) g.add(v); }
    });
    const techo = new T.Mesh(new T.ConeGeometry(4.6, 2.4, 4), negro); techo.position.set(-9, 5.7, -6); techo.rotation.y = Math.PI / 4; g.add(techo);
    const suelo = new T.Mesh(new T.PlaneGeometry(90, 40), new T.MeshBasicMaterial({ color: '#07020f', fog: false })); suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.5; g.add(suelo);
    g.add(new T.HemisphereLight('#cdb8ff', '#2a0f52', 2.2));
    const pl = new T.PointLight('#ffffff', 30, 30); pl.position.set(0, 6, 8); g.add(pl);
    return g;
  }

  // escena del cielo de noche: alguien sale volando (expulsado o cazado) y un texto se escribe solito
  function cielo(o) {
    fase = 'expulsion'; tExp = 0;
    esc3d = esc3d || armarCielo();
    esc3d.visible = true;
    document.body.classList.add('rn-exp');
    if (o.id) {
      volador = Zoo.crear(G().ropaDe(o.id));
      volador.position.set(-7, 1.2, -4.5); esc3d.add(volador);
    }
    S().reiniciarCamara();
    A.bip(180, 0.5, 'sawtooth', 0.05);
    const t = $('#rn-texto'); t.innerHTML = '<b></b><small></small>'; t.classList.add('ver');
    escribir(t.querySelector('b'), o.l1, 700, () => escribir(t.querySelector('small'), o.l2 || '', 300));
    luego(o.ms || 7200, () => fundido(() => {
      pararExpulsion();
      t.classList.remove('ver');
      document.body.classList.remove('rn-exp');
      fase = null;
      S().reiniciarCamara();
      if (o.alFin) o.alFin();
    }));
  }
  function expulsar(m) {
    const roles = G().roles, cfg = S().cfg();
    let linea1, linea2 = '';
    if (!m.id) linea1 = m.empate ? 'Nadie fue expulsado. (Empate) 🤝' : 'Nadie fue expulsado. (Saltaron el voto) ⏭';
    else if (cfg.mostrarRol) linea1 = nombre(m.id) + (roles[m.id] === 'i' ? ' ERA el impostor. 🔪' : ' NO era el impostor. 😇');
    else linea1 = nombre(m.id) + ' fue expulsado. 🚀';
    if (cfg.mostrarRol) {
      const quedan = Object.keys(roles).filter(id => roles[id] === 'i' && G().vivo(id) && id !== m.id).length;
      linea2 = quedan === 1 ? 'Queda 1 impostor 👀' : `Quedan ${quedan} impostores` + (quedan ? ' 👀' : ' 🎉');
    }
    cielo({ id: m.id, l1: linea1, l2: linea2, ms: m.id ? 7200 : 5200, alFin: () => volver(m) });
  }
  // 🎯 ¡adivinaron al impostor! no se expulsa: empieza la cacería
  function cazar(m) {
    fase = null; datos = null; votos = {};
    const g = G();
    g.limpiarRestos(); g.reubicar(); g.reiniciarEspera();
    botonDesde = Date.now() + ESPERA_BOTON;
    ZooCaceria.empezar(m.id, m.caza || {});
  }
  // 🔒 votaron a un inocente: no lo expulsan, va a la jaula del Sótano (y el impostor se enfurece)
  function encarcelar(m) {
    fase = null; datos = null; votos = {};
    const g = G();
    g.limpiarRestos();
    g.reiniciarEspera();
    ZooCaceria.encerrar(m.id); // primero: así reubicar() no lo saca de la jaula (y la furia acorta la espera)
    g.reubicar();
    botonDesde = Date.now() + ESPERA_BOTON;
    if (S().soyHost()) setTimeout(g.revisarFin, 800);
  }
  function escribir(el, txt, espera, listo) {
    const letras = [...txt]; let i = 0;
    luego(espera, function paso() {
      if (fase !== 'expulsion') return;
      el.textContent = letras.slice(0, ++i).join('');
      if (i % 2) A.bip(1500, 0.02, 'square', 0.015);
      if (i < letras.length) luego(45, paso); else if (listo) listo();
    });
  }
  function animarExpulsion(dt) {
    if (fase !== 'expulsion' || !volador) return;
    tExp += dt;
    const s = Math.min(1, tExp / 4.6), e = 1 - Math.pow(1 - s, 1.6);
    volador.position.set(-7 + e * 13, 1.2 + Math.sin(s * Math.PI) * 3.2 + s * 2.5, -4.5 - e * 9);
    volador.rotation.set(tExp * 3.1, tExp * 1.3, tExp * 5.2);
    Zoo.animar(volador, dt, 'quieto');
    if (s >= 1 && volador.visible) { volador.visible = false; const w = new T.Vector3(); volador.getWorldPosition(w); Part.chispas({ x: w.x, y: w.y, z: w.z }); A.bip(1760, 0.2, 'sine', 0.05); }
  }
  function pararExpulsion() {
    if (volador) { if (volador.parent) volador.parent.remove(volador); Zoo.liberar(volador); volador = null; }
    if (esc3d) esc3d.visible = false;
  }
  function cine() {
    if (fase !== 'expulsion') return null;
    return { pos: [ESP.x, ESP.y + 3, ESP.z + 9], mira: [ESP.x, ESP.y + 3.4, ESP.z - 4] };
  }

  // de vuelta a la mansión: todos a la mesa, sin cuerpos
  function volver(m) {
    datos = null; votos = {};
    const g = G();
    if (m.id) g.expulsar(m.id);
    g.limpiarRestos();
    g.reubicar();
    g.reiniciarEspera();
    botonDesde = Date.now() + ESPERA_BOTON;
    if (m.id === miId()) A.toast('Te expulsaron… ahora eres un fantasma 👻');
    if (S().soyHost()) setTimeout(g.revisarFin, 800);
  }

  const $$ = s => document.querySelectorAll(s);

  window.ZooReunion = {
    iniciar, terminar, cine, cielo,
    activa: () => !!fase,
    bloquea: () => !!fase,
    registrar(canal) {
      canal.on('broadcast', { event: 'reunion' }, ({ payload }) => alReunion(payload))
        .on('broadcast', { event: 'voto' }, ({ payload }) => alVoto(payload))
        .on('broadcast', { event: 'rchat' }, ({ payload }) => alChat(payload))
        .on('broadcast', { event: 'expulsion' }, ({ payload }) => alExpulsion(payload));
    },
    _dbg: { get fase() { return fase; }, get votos() { return votos; }, votar, llamar: (tipo, muerto) => S().enviar('reunion', { quien: miId(), tipo: tipo || 'boton', muerto: muerto || null }), sinEspera() { botonDesde = 0; } },
  };
})();
