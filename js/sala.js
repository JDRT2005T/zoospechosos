// ZOOspechosos — Parte 2: salas con código + Salón VIP (moverse, chat e interacciones)
(function () {
  const A = window.ZooApp, sb = A.sb, T = THREE;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // ---------- opciones de la partida ----------
  const MODOS = [
    { id: 'caceria', nombre: 'Cacería', emoji: '🏹', desc: 'Descubran al impostor y armen el arma para cazarlo.', listo: true },
    { id: 'infeccion', nombre: 'Infección', emoji: '🧟', desc: 'Si te atrapan, te vuelves impostor.', listo: false },
    { id: 'escondite', nombre: 'Escondite', emoji: '🙈', desc: 'Escóndete en la mansión antes de que te encuentren.', listo: false },
  ];
  const MAPAS = [
    { id: 'mansion', nombre: 'Mansión Fiesta', emoji: '🏰', listo: true },
    { id: 'zoo', nombre: 'Zoo Nocturno', emoji: '🌙', listo: false },
    { id: 'barco', nombre: 'Barco Pirata', emoji: '🏴‍☠️', listo: false },
  ];
  const NUMEROS = [
    { k: 'max', nombre: 'Jugadores máximos', min: 3, max: 10, paso: 1 },
    { k: 'impostores', nombre: 'Impostores', min: 1, max: 3, paso: 1 },
    { k: 'velocidad', nombre: 'Velocidad', min: 0.75, max: 1.5, paso: 0.25, fmt: v => 'x' + v },
    { k: 'cortas', nombre: '⚡ Misiones cortas', min: 0, max: 6, paso: 1 },
    { k: 'medias', nombre: '🔶 Misiones medianas', min: 0, max: 5, paso: 1 },
    { k: 'largas', nombre: '🔷 Misiones largas', min: 0, max: 3, paso: 1 },
    { k: 'reunion', nombre: 'Tiempo de votación', min: 30, max: 120, paso: 15, fmt: v => v + ' s' },
    { k: 'caza', nombre: 'Tiempo de cacería', min: 90, max: 300, paso: 30, fmt: v => v + ' s' },
    { k: 'enfriamiento', nombre: 'Espera entre ataques', min: 15, max: 60, paso: 5, fmt: v => v + ' s' },
  ];
  const SINO = [
    { k: 'votoAnonimo', nombre: 'Votos anónimos' },
    { k: 'mostrarRol', nombre: 'Revelar rol al expulsar' },
  ];
  const DEF = { modo: 'caceria', mapa: 'mansion', max: 10, impostores: 1, velocidad: 1, cortas: 3, medias: 2, largas: 1, reunion: 60, caza: 180, enfriamiento: 30, votoAnonimo: false, mostrarRol: true };

  // ---------- estado ----------
  let sala = null, canal = null;
  let jugadores = [];            // presencia, ordenados por llegada
  let yo = null;                 // mi estado de presencia
  let primeraSync = true, latido = null, hostAusenteDesde = 0;
  const pjs = new Map();         // id -> datos del muñeco
  const cargas = new Map();      // cargado -> portador
  const yoPos = { x: 0, z: 0, r: 0 };
  let ultimoEnvio = 0, meMovia = false;

  const miId = () => A.perfil && A.perfil.id;
  const soyHost = () => sala && A.perfil && sala.host === miId();
  const cfg = () => Object.assign({}, DEF, sala ? sala.config : {});
  const nombreDe = id => { const j = jugadores.find(x => x.id === id); return j ? j.apodo : '???'; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enviar = (event, payload) => canal && canal.send({ type: 'broadcast', event, payload });
  const llevaA = id => [...cargas.values()].includes(id); // ¿id lleva a alguien cargado?

  A.escena.add(Salon.grupo);
  // la partida (juego.js) usa este mismo movimiento, pero en la Mansión
  const J = () => window.ZooJuego;
  const enJuego = () => !!(J() && J().activo);
  const mundo = () => enJuego() ? Mansion : Salon;

  // ================= ENTRAR / SALIR =================
  $('#b-crear').onclick = async () => {
    const btn = $('#b-crear'); btn.disabled = true;
    const { data: cod, error } = await sb.rpc('zoo_crear_sala', { cfg: DEF });
    btn.disabled = false;
    if (error) return A.toast(A.errorBonito(error));
    $('#m-jugar').classList.remove('activa');
    await unirse(cod);
  };
  $('#b-unirse').onclick = () => unirse($('#i-codigo').value);
  $('#i-codigo').addEventListener('keydown', e => { if (e.key === 'Enter') unirse($('#i-codigo').value); });

  async function unirse(cod) {
    cod = (cod || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{5}$/.test(cod)) return A.toast('El código tiene 5 letras o números');
    const { data, error } = await sb.from('zoo_salas').select('*').eq('codigo', cod).maybeSingle();
    if (error) return A.toast(A.errorBonito(error));
    if (!data) return A.toast('No existe la sala ' + cod + ' 🤔');
    if (data.estado === 'jugando') return A.toast('Esa partida ya empezó ⏳');
    $('#m-jugar').classList.remove('activa');
    $('#i-codigo').value = '';
    entrar(data);
  }

  function entrar(fila) {
    sala = { codigo: fila.codigo, host: fila.host, config: fila.config || {} };
    jugadores = []; primeraSync = true; hostAusenteDesde = 0; cargas.clear();
    const p = A.perfil;
    yo = { id: p.id, apodo: p.apodo, animal: p.animal, color: p.color, sombrero: p.sombrero, gafas: p.gafas, accesorio: p.accesorio, muerte: p.muerte || 'granada', listo: false, desde: Date.now() };
    Object.assign(yoPos, Salon.lugarLibre(), { r: 0 });
    $('#s-cod').textContent = sala.codigo;
    $('#chat-log').innerHTML = '';
    Salon.grupo.visible = true;
    A.ir('sala');
    camaraLista = false;
    pintarTodo();

    canal = sb.channel('zoo-sala-' + sala.codigo, { config: { presence: { key: p.id }, broadcast: { self: true } } });
    canal
      .on('presence', { event: 'sync' }, alSincronizar)
      .on('broadcast', { event: 'mov' }, ({ payload }) => alMover(payload))
      .on('broadcast', { event: 'config' }, ({ payload }) => { sala.config = payload; pintarTodo(); })
      .on('broadcast', { event: 'host' }, ({ payload }) => {
        sala.host = payload.id;
        if (payload.id === miId()) { A.toast('👑 Ahora eres el anfitrión'); yo.listo = false; canal.track(yo); }
        mensajeSistema('👑 ' + nombreDe(payload.id) + ' es el anfitrión');
        pintarTodo();
      })
      .on('broadcast', { event: 'listo' }, ({ payload }) => { const j = jugadores.find(x => x.id === payload.id); if (j) { j.listo = payload.listo; pintarTodo(); if (j.listo) fx('confeti', j.id, 1.8); } })
      .on('broadcast', { event: 'ropa' }, ({ payload }) => alRopa(payload))
      .on('broadcast', { event: 'emote' }, ({ payload }) => mostrarEmote(payload.id, payload.e))
      .on('broadcast', { event: 'chat' }, ({ payload }) => alChat(payload))
      .on('broadcast', { event: 'accion' }, ({ payload }) => alAccion(payload))
      .on('broadcast', { event: 'pedir' }, ({ payload }) => alPedir(payload))
      .on('broadcast', { event: 'respuesta' }, ({ payload }) => alResponder(payload))
      .on('broadcast', { event: 'carga' }, ({ payload }) => alCargar(payload))
      .on('broadcast', { event: 'soltar' }, ({ payload }) => alSoltar(payload))
      .on('broadcast', { event: 'expulsar' }, ({ payload }) => {
        if (payload.id === miId()) { salirLocal(); A.toast('Te sacaron de la sala 🚪'); }
      })
      .on('broadcast', { event: 'inicio' }, ({ payload }) => alIniciar(payload))
    if (J()) J().registrar(canal);
    canal
      .subscribe(estado => {
        if (estado === 'SUBSCRIBED') { canal.track(yo); enviarPos(true); }
        if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') A.toast('Problema de conexión con la sala 📶');
      });

    clearInterval(latido);
    latido = setInterval(revisarHost, 5000);
    if (soyHost()) tocarSala();
  }

  async function salir() {
    if (!sala) return;
    if (soyHost()) {
      const otros = jugadores.filter(j => j.id !== miId());
      if (otros.length) {
        const { data: ok } = await sb.rpc('zoo_pasar_host', { cod: sala.codigo, nuevo: otros[0].id });
        if (ok) enviar('host', { id: otros[0].id });
      } else {
        await sb.from('zoo_salas').delete().eq('codigo', sala.codigo);
      }
    }
    salirLocal();
  }
  function salirLocal() {
    if (J()) J().salir(); // por si estaba en plena partida
    clearInterval(latido);
    if (canal) { canal.untrack(); sb.removeChannel(canal); canal = null; }
    sala = null; jugadores = []; cargas.clear();
    [...pjs.keys()].forEach(quitarPj);
    $$('.modal').forEach(m => m.classList.remove('activa'));
    ['#chat-barra', '#solicitud', '#b-bajar', '#emotes', '#vestidor', '#b-vestidor'].forEach(s => $(s).classList.remove('ver'));
    vistiendo = false; $('#p-sala').classList.remove('vistiendo');
    Salon.grupo.visible = false;
    A.ir('menu');
  }
  $('#s-salir').onclick = () => { if (confirm('¿Salir de la sala?')) salir(); };

  // el anfitrión "late" para que se sepa que sigue conectado
  function tocarSala() { if (soyHost()) sb.from('zoo_salas').update({ actualizado: new Date().toISOString() }).eq('codigo', sala.codigo).then(() => { }); }
  let contLatido = 0;
  async function revisarHost() {
    if (!sala) return;
    if (soyHost()) { if (++contLatido % 2 === 0) tocarSala(); return; }
    if (jugadores.some(j => j.id === sala.host)) { hostAusenteDesde = 0; return; }
    if (!hostAusenteDesde) hostAusenteDesde = Date.now();
    if (Date.now() - hostAusenteDesde > 8000 && jugadores[0] && jugadores[0].id === miId()) {
      const { data: ok } = await sb.rpc('zoo_heredar_host', { cod: sala.codigo });
      if (ok) enviar('host', { id: miId() });
    }
  }

  // ================= PRESENCIA =================
  function alSincronizar() {
    const st = canal.presenceState();
    const lista = [];
    Object.values(st).forEach(arr => { if (arr && arr.length) lista.push(arr[arr.length - 1]); }); // el último es el más nuevo
    lista.sort((a, b) => a.desde - b.desde);
    if (primeraSync && lista.some(j => j.id === miId())) {
      primeraSync = false;
      const pos = lista.findIndex(j => j.id === miId());
      if (pos >= cfg().max) { salirLocal(); return A.toast('La sala está llena 😕'); }
    }
    const antes = new Map(jugadores.map(j => [j.id, j]));
    const nuevos = lista.slice(0, cfg().max);
    const ahora = new Set(nuevos.map(j => j.id));
    nuevos.forEach(j => {
      if (!antes.has(j.id) && antes.size && j.id !== miId()) { mensajeSistema('🐾 ' + j.apodo + ' entró a la sala'); A.bip(1100, 0.1); }
    });
    antes.forEach((j, id) => { if (!ahora.has(id)) mensajeSistema('👋 ' + j.apodo + ' salió'); });
    // si alguien nuevo llegó, le contamos dónde estoy
    if (nuevos.some(j => !antes.has(j.id) && j.id !== miId())) setTimeout(() => enviarPos(true), Math.random() * 300);
    jugadores = nuevos;
    // limpiar cargas de gente que se fue
    [...cargas].forEach(([c, p]) => { if (!ahora.has(c) || !ahora.has(p)) alSoltar({ cargado: c, silencio: true }); });
    if (!enJuego()) revisarColor();
    pintarTodo();
    if (enJuego()) J().alCambiarJugadores();
    if (vistiendo) pintarVestidor();
  }

  // ================= MOVIMIENTO =================
  // joystick táctil
  const joy = { x: 0, y: 0 }; let joyId = null;
  const base = $('#joy'), bola = $('#joy-bola');
  function moverJoy(e) {
    const r = base.getBoundingClientRect(), max = r.width / 2 - 12;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); if (d > max) { dx *= max / d; dy *= max / d; }
    joy.x = dx / max; joy.y = dy / max;
    bola.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  base.addEventListener('pointerdown', e => { joyId = e.pointerId; base.setPointerCapture(e.pointerId); moverJoy(e); });
  base.addEventListener('pointermove', e => { if (e.pointerId === joyId) moverJoy(e); });
  const soltarJoy = e => { if (e.pointerId !== joyId) return; joyId = null; joy.x = joy.y = 0; bola.style.transform = ''; };
  base.addEventListener('pointerup', soltarJoy); base.addEventListener('pointercancel', soltarJoy);
  // teclado (PC)
  const teclas = new Set();
  const escribiendo = () => document.activeElement && document.activeElement.tagName === 'INPUT';
  addEventListener('keydown', e => {
    if (A.pantalla !== 'sala' || escribiendo()) return;
    teclas.add(e.key.toLowerCase());
    if (e.key === 'Enter' && !enJuego()) { e.preventDefault(); abrirChat(); }
  });
  addEventListener('keyup', e => teclas.delete(e.key.toLowerCase()));
  addEventListener('blur', () => teclas.clear());

  function entrada() {
    let x = joy.x, z = joy.y;
    if (!escribiendo()) {
      if (teclas.has('a') || teclas.has('arrowleft')) x -= 1;
      if (teclas.has('d') || teclas.has('arrowright')) x += 1;
      if (teclas.has('w') || teclas.has('arrowup')) z -= 1;
      if (teclas.has('s') || teclas.has('arrowdown')) z += 1;
    }
    const d = Math.hypot(x, z);
    if (d > 1) { x /= d; z /= d; }
    return { x, z, d: Math.min(1, d) };
  }

  function enviarPos(forzar) {
    if (!canal) return;
    const ahora = performance.now();
    if (!forzar && ahora - ultimoEnvio < (enJuego() ? 150 : 110)) return; // en la partida mandamos menos (ahorra mensajes)
    ultimoEnvio = ahora;
    enviar('mov', { i: miId(), x: +yoPos.x.toFixed(2), z: +yoPos.z.toFixed(2), r: +yoPos.r.toFixed(2) });
  }
  function alMover(m) {
    if (m.i === miId()) return;
    const v = pjs.get(m.i); if (!v) return;
    v.tx = m.x; v.tz = m.z; v.tr = m.r; v.ultimoMov = performance.now();
    if (!v.posLista) { v.cx = m.x; v.cz = m.z; v.cr = m.r; v.posLista = true; }
  }

  // ================= MUÑECOS =================
  function claveRopa(j) { return [j.animal, j.color, j.sombrero, j.gafas, j.accesorio].join('|'); }
  function quitarPj(id) {
    const v = pjs.get(id); if (!v) return;
    if (v.obj) { A.escena.remove(v.obj); Zoo.liberar(v.obj); }
    v.etiqueta.remove(); pjs.delete(id);
  }
  function sincronizar3D() {
    const ids = new Set(jugadores.map(j => j.id));
    [...pjs.keys()].forEach(id => { if (!ids.has(id)) quitarPj(id); });
    jugadores.forEach(j => {
      let v = pjs.get(j.id);
      const clave = claveRopa(j);
      if (v && v.clave !== clave) { A.escena.remove(v.obj); Zoo.liberar(v.obj); v.obj = null; v.estrellas = null; }
      if (!v) {
        const et = document.createElement('div'); et.className = 'etiqueta';
        et.innerHTML = '<span class="nom"></span>';
        et.onclick = () => abrirInteraccion(j.id);
        $('#etiquetas').appendChild(et);
        v = { etiqueta: et, obj: null, cx: 0, cz: 0, cr: 0, tx: 0, tz: 0, tr: 0, ultimoMov: 0, posLista: false, efecto: null, caida: 3 };
        if (j.id === miId()) { v.cx = v.tx = yoPos.x; v.cz = v.tz = yoPos.z; v.posLista = true; }
        pjs.set(j.id, v);
      }
      if (!v.obj) {
        v.obj = Zoo.crear(j); v.clave = clave;
        v.obj.userData.idJugador = j.id;
        A.escena.add(v.obj);
      }
      v.listo = j.listo;
      const host = j.id === sala.host, mio = j.id === miId();
      v.etiqueta.classList.toggle('yo', mio);
      v.etiqueta.classList.toggle('ok', !!(j.listo || host));
      v.etiqueta.querySelector('.nom').innerHTML = `${host ? '<i>👑</i>' : ''}<span>${esc(j.apodo)}</span>${host ? '' : (j.listo ? '<em>✔</em>' : '<em class="no">…</em>')}`;
    });
  }

  // ---------- efectos (animaciones especiales) ----------
  const DUR = { jutsu_atacante: 1.5, jutsu_victima: 4.6, abrazo: 2.2, cinco: 1.3, empujar_atacante: 0.7, empujar_victima: 1.1, bailar: 5, emote: 1.3 };
  const BLOQUEA = { jutsu_atacante: 1.2, jutsu_victima: 2.6, abrazo: 2.0, cinco: 1.0, empujar_atacante: 0.4, empujar_victima: 0.8 };
  const suave = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);      // arranca rápido y frena suave
  const rebote = x => { x = Math.min(1, Math.max(0, x)); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }; // se pasa un poquito y vuelve
  const campana = x => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);
  function ponerEfecto(id, nombre, extra) {
    const v = pjs.get(id); if (!v) return;
    if (v.obj) { const c = v.obj.userData.cuerpo; c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); }
    v.alto = 0;
    v.efecto = Object.assign({ n: nombre, t: 0, una: {} }, extra || {});
  }
  function bloqueado() {
    const v = pjs.get(miId());
    if (cargas.has(miId())) return true;
    return !!(v && v.efecto && BLOQUEA[v.efecto.n] && v.efecto.t < BLOQUEA[v.efecto.n]);
  }
  function estrellas(v, ver) {
    if (!v.estrellas && ver) {
      const g = new T.Group();
      for (let i = 0; i < 5; i++) {
        const e = new T.Mesh(new T.OctahedronGeometry(0.09), window.neon(i % 2 ? '#ffd93d' : '#ffffff', 2));
        e.position.set(Math.cos(i / 5 * Math.PI * 2) * 0.45, 0, Math.sin(i / 5 * Math.PI * 2) * 0.45); g.add(e);
      }
      g.position.y = 2.0; v.obj.add(g); v.estrellas = g;
    }
    if (v.estrellas) v.estrellas.visible = ver;
  }
  // partículas cada cierto tiempo durante un efecto
  const cada = (e, clave, seg, fn) => { if ((e.una[clave] || 0) <= e.t) { e.una[clave] = e.t + seg; fn(); } };
  const unaVez = (e, clave, fn) => { if (!e.una[clave]) { e.una[clave] = 1; fn(); } };

  function aplicarEfecto(v, dt, id) {
    const e = v.efecto; if (!e) return;
    e.t += dt;
    const u = v.obj.userData, c = u.cuerpo, t = e.t, br = u.brazos, pi = u.piernas, o = v.obj.position;
    if (t > (DUR[e.n] || 1)) { v.efecto = null; estrellas(v, false); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); u.ojos.forEach(x => x.scale.set(1, 1, 1)); v.alto = 0; return; }
    const pos = (y) => ({ x: o.x, y: o.y + y, z: o.z });

    if (e.n === 'jutsu_atacante') {
      if (t < 0.75) { // sello de manos cargando chakra
        const tiembla = Math.sin(t * 60) * 0.04 * suave(t / 0.4);
        br.forEach((b, i) => { b.rotation.x = -1.35; b.rotation.z = (i ? -1 : 1) * 0.6 + tiembla; });
        c.rotation.x = -0.08; c.scale.set(1, 0.96 + campana(t / 0.75) * 0.06, 1);
        cada(e, 'aura', 0.08, () => Part.rafaga(pos(0.4), { n: 2, colores: ['#2ee6d6', '#7fd3ff'], vel: 0.6, arriba: 2, vida: 0.6, tam: 0.18, aditivo: true, brillo: 2 }));
      } else { // ¡golpe con estocada!
        const k = rebote((t - 0.75) / 0.18);
        br.forEach((b, i) => { b.rotation.x = -1.35 - 1.1 * k; b.rotation.z = (i ? -1 : 1) * 0.45; });
        c.rotation.x = 0.45 * k * (1 - suave((t - 1.1) / 0.4));
      }
    } else if (e.n === 'jutsu_victima') {
      if (t < 0.75) { // susto: se aprieta todo
        u.ojos.forEach(x => x.scale.set(1.35, 1.35, 1));
        c.scale.set(1 - 0.04 * campana(t * 6), 1.06, 1 - 0.04 * campana(t * 6));
      } else if (t < 2.1) { // vuela dando vueltas con estela
        u.ojos.forEach(x => x.scale.set(1, x.scale.y, 1)); c.scale.set(1, 1, 1);
        const s = (t - 0.75) / 1.35;
        v.alto = 4 * 3.4 * s * (1 - s);
        c.rotation.x = s * Math.PI * 4;
        br.forEach((b, i) => b.rotation.z = (i ? -1 : 1) * (2.3 + Math.sin(t * 30) * 0.3));
        pi.forEach((l, i) => l.rotation.x = Math.sin(t * 25 + i * 3) * 0.9);
        cada(e, 'estela', 0.05, () => Part.rafaga(pos(0.9), { n: 1, colores: ['#ffd93d', '#ffffff'], tex: 'chispa', vel: 0.2, vida: 0.5, tam: 0.3, aditivo: true, brillo: 2, giro: 6 }));
      } else { // aterriza rebotando y queda mareado
        c.rotation.x = 0;
        const s = t - 2.1;
        v.alto = s < 0.45 ? Math.abs(Math.sin(s / 0.45 * Math.PI * 2)) * 0.35 * (1 - s / 0.45) : 0;
        unaVez(e, 'cae', () => Part.caida(pos(0.1)));
        const ap = Math.max(0, 1 - s / 0.25);
        c.scale.set(1 + 0.3 * ap, 1 - 0.4 * ap, 1 + 0.3 * ap);
        c.rotation.z = Math.sin(t * 9) * 0.14;
        u.ojos.forEach(x => x.scale.set(1, 0.4 + Math.abs(Math.sin(t * 4)) * 0.6, 1));
        estrellas(v, true); v.estrellas.rotation.y += dt * 5;
      }
    } else if (e.n === 'abrazo') {
      const entra = suave(t / 0.35), sale = 1 - suave((t - 1.8) / 0.4), k = entra * sale;
      br.forEach((b, i) => { b.rotation.x = -1.45 * k; b.rotation.z = (i ? 1 : -1) * 0.95 * k + (i ? -1 : 1) * 0.35 * (1 - k); });
      c.rotation.x = 0.22 * k;
      const apreton = campana((t - 0.6) / 0.25) + campana((t - 1.2) / 0.25);
      c.scale.set(1 + 0.08 * apreton, 1 - 0.06 * apreton, 1 + 0.08 * apreton);
      c.rotation.z = Math.sin(t * 5) * 0.07 * k;
      u.ojos.forEach(x => x.scale.set(1, 1 - 0.75 * k * (t > 0.4 && t < 1.8 ? 1 : 0), 1)); // ojitos cerrados de felicidad
      cada(e, 'amor', 0.45, () => Part.rafaga(pos(1.8), { n: 2, tex: '💖', vel: 0.6, arriba: 1.5, vida: 1.1, tam: 0.28, dispersion: 0.3 }));
    } else if (e.n === 'cinco') {
      if (t < 0.3) { const k = suave(t / 0.3); br[1].rotation.z = 0.35 + 0.6 * k; br[1].rotation.x = 0.7 * k; c.rotation.x = -0.15 * k; } // toma impulso
      else if (t < 0.45) { const k = suave((t - 0.3) / 0.15); br[1].rotation.z = 0.95 + 1.75 * k; br[1].rotation.x = 0.7 - 1.3 * k; c.rotation.x = -0.15 + 0.3 * k; }
      else { br[1].rotation.z = 2.7; br[1].rotation.x = -0.6; br[0].rotation.z = -0.35 - 2.2 * campana((t - 0.6) / 0.6); c.rotation.x = 0.15 * (1 - suave((t - 0.45) / 0.4)); }
      v.alto = t > 0.45 && t < 0.85 ? campana((t - 0.45) / 0.4) * 0.45 : 0;
      if (t > 0.85 && t < 1.0) { const s = campana((t - 0.85) / 0.15); c.scale.set(1 + 0.15 * s, 1 - 0.2 * s, 1 + 0.15 * s); } else c.scale.set(1, 1, 1);
    } else if (e.n === 'empujar_atacante') {
      const k = t < 0.15 ? suave(t / 0.15) : 1 - suave((t - 0.25) / 0.45);
      br.forEach(b => { b.rotation.x = -1.7 * k; b.rotation.z *= 0.4; });
      c.rotation.x = 0.45 * k;
      c.scale.set(1, 1 - 0.08 * k, 1 + 0.1 * k);
    } else if (e.n === 'empujar_victima') {
      if (t < 0.6) { // sale volando de espaldas dando una voltereta
        const s = t / 0.6;
        v.alto = 4 * 0.7 * s * (1 - s);
        c.rotation.x = -s * Math.PI * 2;
        br.forEach((b, i) => b.rotation.z = (i ? -1 : 1) * (0.5 + 1.8 * campana(s)));
        pi.forEach(l => l.rotation.x = -0.8 * campana(s));
      } else { // cae aplastado y se sacude
        c.rotation.x = 0; v.alto = 0;
        unaVez(e, 'cae', () => { Part.caida(pos(0.1)); A.bip(150, 0.12, 'square', 0.05); });
        const s = Math.max(0, 1 - (t - 0.6) / 0.3);
        c.scale.set(1 + 0.3 * s, 1 - 0.4 * s, 1 + 0.3 * s);
        c.rotation.z = Math.sin(t * 30) * 0.15 * s;
      }
    } else if (e.n === 'bailar') { // 4 pasos de baile que se van turnando
      const paso = Math.floor(t / 1.25) % 4, f = (t % 1.25) / 1.25;
      c.rotation.set(0, 0, 0);
      if (paso === 0) { // disco 🕺
        const lado = Math.sin(f * Math.PI * 4) > 0 ? 1 : 0;
        br[0].rotation.z = lado ? -2.5 : -0.4; br[1].rotation.z = lado ? 0.4 : 2.5; br.forEach(b => b.rotation.x = -0.3);
        c.rotation.z = Math.sin(f * Math.PI * 4) * 0.15; v.alto = Math.abs(Math.sin(f * Math.PI * 4)) * 0.08;
      } else if (paso === 1) { // robot 🤖
        const g = Math.floor(f * 8) % 2;
        br.forEach((b, i) => { b.rotation.x = -1.5 + (g === i ? 0.6 : 0); b.rotation.z = (i ? 1 : -1) * 0.3; });
        c.rotation.y = (Math.floor(f * 4) % 2 ? 1 : -1) * 0.4; v.alto = 0;
      } else if (paso === 2) { // vuelta 🌀
        c.rotation.y = f * Math.PI * 2; br.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * 1.5; b.rotation.x = 0; }); v.alto = campana(f) * 0.15;
      } else { // salto y aplauso 👏
        v.alto = Math.abs(Math.sin(f * Math.PI * 2)) * 0.4;
        const aplauso = Math.abs(Math.sin(f * Math.PI * 4));
        br.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * (2.0 + aplauso * 0.5); b.rotation.x = -0.4; });
        cada(e, 'nota', 0.6, () => Part.notas(pos(2)));
      }
    } else if (e.n === 'emote') { // pequeño gesto con cada reacción
      const k = campana(t / 1.3);
      if (e.e === '👋') { br[1].rotation.z = 2.4 * suave(t / 0.2) + Math.sin(t * 16) * 0.35; br[1].rotation.x = -0.2; }
      else if (e.e === '😂') { c.rotation.z = Math.sin(t * 28) * 0.12 * k; c.scale.set(1 + 0.05 * k, 1 - 0.05 * Math.abs(Math.sin(t * 20)), 1); br.forEach(b => b.rotation.x = -0.8 * k); }
      else if (e.e === '😱') { v.alto = campana(t / 0.45) * 0.4; br.forEach((b, i) => b.rotation.z = (i ? 1 : -1) * 2.6 * k); u.ojos.forEach(x => x.scale.set(1.5, 1.5, 1)); }
      else if (e.e === '😡') { v.alto = Math.abs(Math.sin(t * 14)) * 0.08 * k; c.rotation.x = 0.2 * k; br.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * 0.2; b.rotation.x = Math.sin(t * 14 + i * 3) * 0.6 * k; }); u.ojos.forEach(x => x.scale.set(1, 0.55, 1)); cada(e, 'humo', 0.3, () => Part.rafaga(pos(1.9), { n: 2, colores: ['#cccccc'], vel: 0.8, arriba: 1.5, vida: 0.6, tam: 0.25, crecer: 2 })); }
      else if (e.e === '🤔') { br[1].rotation.x = -1.9 * suave(t / 0.25); br[1].rotation.z = 0.7; c.rotation.z = 0.15 * k; }
      else if (e.e === '❤️') { br.forEach((b, i) => { b.rotation.x = -1.3 * k; b.rotation.z = (i ? 1 : -1) * 0.9 * k; }); cada(e, 'amor', 0.3, () => Part.corazones(pos(1.7))); }
      else if (e.e === '🔪') { br[1].rotation.x = -2.6 * suave(t / 0.25); c.rotation.x = 0.25 * k; u.ojos.forEach(x => x.scale.set(1, 0.45, 1)); }
    }
    // movimientos que el dueño hace sobre su propia posición
    if (id === miId() && e.dir) {
      if (e.n === 'jutsu_victima' && t > 0.75 && t < 2.1) mover(e.dir.x * 1.8 * dt / 1.35, e.dir.z * 1.8 * dt / 1.35);
      if (e.n === 'empujar_victima' && t < 0.6) mover(e.dir.x * 2.0 * dt / 0.6, e.dir.z * 2.0 * dt / 0.6);
    }
  }
  function mover(dx, dz) { yoPos.x += dx; yoPos.z += dz; mundo().colisionar(yoPos); enviarPos(); }

  // ---------- bucle del salón ----------
  const proy = new T.Vector3(), camPos = new T.Vector3(), camMira = new T.Vector3(), tmp = new T.Vector3();
  let camaraLista = false, sacudida = 0, botonCerca = false;
  // cámara de la partida: más lejos = se ve más de la casa (la niebla y las sombras se estiran con ella)
  const ZOOM = { cerca: 1, normal: 1.3, lejos: 1.6 };
  let vistaK = 0;
  function ajustarVista(k) {
    if (Math.abs(k - vistaK) < 0.01) return;
    vistaK = k;
    if (A.escena.fog) { A.escena.fog.near = 12 * k; A.escena.fog.far = 30 * k; }
    const c = A.sol.shadow.camera; c.left = c.bottom = -9 * k; c.right = c.top = 9 * k; c.far = 30 * k; c.updateProjectionMatrix();
  }
  function vistaNormal() { if (!vistaK) return; ajustarVista(1); vistaK = 0; }
  $('#b-zoom').addEventListener('click', () => {
    const orden = ['cerca', 'normal', 'lejos'], sig = orden[(orden.indexOf(A.zoom) + 1) % 3];
    A.zoom = sig; A.toast('🎥 Cámara: ' + { cerca: 'cerca', normal: 'normal', lejos: 'lejos' }[sig], 1200);
  });
  const angulo = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

  A.alCuadro.push((dt, t) => {
    if (A.pantalla !== 'sala' || !sala) return;
    mundo().animar(dt, t);
    // 1) mi movimiento
    const yoV = pjs.get(miId());
    const ent = entrada();
    let meMuevo = false;
    const cerca = !vistiendo && !enJuego() && Math.hypot(yoPos.x - Salon.VESTIDOR.x, yoPos.z - Salon.VESTIDOR.z) < 1.6;
    if (cerca !== botonCerca) { botonCerca = cerca; $('#b-vestidor').classList.toggle('ver', cerca); }
    if (!bloqueado() && !vistiendo && !(enJuego() && J().bloqueado()) && ent.d > 0.12) {
      const vel = 3.3 * cfg().velocidad * (llevaA(miId()) ? 0.8 : 1) * (enJuego() ? J().velocidad() : 1);
      yoPos.x += ent.x * vel * dt; yoPos.z += ent.z * vel * dt;
      if (enJuego() && J().soyFantasma()) Mansion.limites(yoPos); else mundo().colisionar(yoPos); // los fantasmas atraviesan paredes
      yoPos.r = angulo(yoPos.r, Math.atan2(ent.x, ent.z), Math.min(1, dt * 14));
      meMuevo = true;
      if (yoV && yoV.efecto && yoV.efecto.n === 'bailar') yoV.efecto = null;
    }
    if (meMuevo) enviarPos();
    else if (meMovia) enviarPos(true);
    else if (performance.now() - ultimoEnvio > 3000) enviarPos(true);
    meMovia = meMuevo;

    // 2) actualizar muñecos
    const w = innerWidth, h = innerHeight;
    const k = 1 - Math.exp(-dt * 12);
    pjs.forEach((v, id) => {
      const o = v.obj; if (!o) return;
      const verlo = v.posLista && (!vistiendo || id === miId()) && (!enJuego() || J().visible(id)); // probador / fantasmas
      o.visible = verlo; v.etiqueta.style.visibility = verlo ? '' : 'hidden';
      let andando;
      if (id === miId()) { v.cx = yoPos.x; v.cz = yoPos.z; v.cr = yoPos.r; andando = meMuevo; }
      else {
        const dx = v.tx - v.cx, dz = v.tz - v.cz;
        if (dx * dx + dz * dz > 9) { v.cx = v.tx; v.cz = v.tz; } // muy lejos: teletransportar
        v.cx += dx * k; v.cz += dz * k; v.cr = angulo(v.cr, v.tr, k);
        andando = Math.hypot(dx, dz) > 0.04 && performance.now() - v.ultimoMov < 400;
      }
      // caída al entrar
      if (v.caida > 0) { v.vy = (v.vy || 0) - 20 * dt; v.caida = Math.max(0, v.caida + v.vy * dt); if (!v.caida) { v.vy = 0; Part.caida({ x: v.cx, y: 0.1, z: v.cz }); } }
      if (andando) { v.paso = (v.paso || 0) - dt; if (v.paso <= 0) { v.paso = 0.16; Part.polvo({ x: v.cx, y: 0.08, z: v.cz }); } }
      const portador = cargas.get(id);
      const pv = portador && pjs.get(portador);
      if (pv) {
        o.position.set(pv.cx, 1.45 + (pv.alto || 0), pv.cz); o.rotation.y = pv.cr;
        Zoo.animar(o, dt, 'quieto');
        o.userData.piernas.forEach(l => l.rotation.x = -1.3);
        o.userData.brazos.forEach((b, i) => b.rotation.z = (i ? -1 : 1) * (2.2 + Math.sin(t * 8 + i) * 0.3));
      } else {
        o.position.set(v.cx, (v.alto || 0) + v.caida, v.cz); o.rotation.y = v.cr;
        const baila = (v.efecto && v.efecto.n === 'bailar') || (v.listo && !andando);
        Zoo.animar(o, dt, andando ? 'caminar' : (baila ? 'baile' : 'quieto'));
        if (llevaA(id)) o.userData.brazos.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * 2.7; b.rotation.x = 0; });
      }
      aplicarEfecto(v, dt, id);
      if (enJuego()) J().efecto(v, id, dt, t);
      // etiqueta
      proy.set(o.position.x, o.position.y + 2.05, o.position.z).project(A.camara);
      v.etiqueta.style.display = proy.z > 1 ? 'none' : '';
      v.etiqueta.style.transform = `translate(${(proy.x * 0.5 + 0.5) * w}px, ${(-proy.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    });

    // 3) cámara que me sigue
    const yv = pjs.get(miId());
    const px = yv && yv.obj ? yv.obj.position.x : yoPos.x, pz = yv && yv.obj ? yv.obj.position.z : yoPos.z;
    const z = innerWidth / innerHeight < 0.75 ? 1.3 : 1;
    const horiz = innerWidth > innerHeight;
    let mx = px * 0.85, my = 0.3, mz = pz - 0.7;
    if (vistiendo) { // primer plano de mi muñeco (a la izquierda del panel)
      const off = horiz ? 1.45 : 0;
      tmp.set(px + off, 1.7, pz + 5.0); mx = px + off; my = horiz ? 0.95 : 0.35; mz = pz;
    } else if (enJuego() && J().cine()) { // escena de la granada: cámara de lado y cerquita
      const c = J().cine(); tmp.set(c.pos[0], c.pos[1], c.pos[2]); mx = c.mira[0]; my = c.mira[1]; mz = c.mira[2];
    } else if (enJuego()) { // en la mansión: el sol (sombras) sigue al jugador; la distancia se elige en Ajustes o con 🔍
      const k = z * (ZOOM[A.zoom] || ZOOM.lejos);
      tmp.set(px, 7.4 * k, pz + 5.6 * k); mx = px; my = 0.3; mz = pz - 0.6 * k;
      ajustarVista(k);
      A.sol.position.set(px + 3, 7, pz + 5); A.sol.target.position.set(px, 0, pz); A.sol.target.updateMatrixWorld();
    } else { tmp.set(px * 0.85, 8.4 * z, pz + 6.2 * z); vistaNormal(); }
    if (!camaraLista) { camPos.copy(tmp); camMira.set(mx, my, mz); camaraLista = true; }
    camPos.lerp(tmp, 1 - Math.exp(-dt * 5));
    camMira.lerp(tmp.set(mx, my, mz), 1 - Math.exp(-dt * 5));
    A.camara.position.copy(camPos);
    if (sacudida > 0) { sacudida -= dt; A.camara.position.x += (Math.random() - 0.5) * sacudida; A.camara.position.y += (Math.random() - 0.5) * sacudida; }
    A.camara.lookAt(camMira);
  });

  // ================= TOCAR A OTRO JUGADOR =================
  const ray = new T.Raycaster(), punto = new T.Vector2();
  let toque = null;
  const lienzo = A.renderer.domElement;
  lienzo.addEventListener('pointerdown', e => { if (A.pantalla === 'sala') toque = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  lienzo.addEventListener('pointerup', e => {
    if (A.pantalla !== 'sala' || !toque || enJuego()) return;
    const corto = performance.now() - toque.t < 400 && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 12;
    toque = null; if (!corto) return;
    punto.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(punto, A.camara);
    const objs = [...pjs.entries()].filter(([id, v]) => id !== miId() && v.obj).map(([, v]) => v.obj);
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return;
    let o = hit.object; while (o && !o.userData.idJugador) o = o.parent;
    if (o) abrirInteraccion(o.userData.idJugador);
  });

  let jugadorSel = null;
  const distA = id => { const v = pjs.get(id); return v ? Math.hypot(v.cx - yoPos.x, v.cz - yoPos.z) : 99; };
  function abrirInteraccion(id) {
    if (!sala || id === miId()) return;
    jugadorSel = id;
    $('#mi-nombre').textContent = nombreDe(id);
    $('#m-interactuar .solo-host').classList.toggle('ver', soyHost());
    A.abrir('#m-interactuar');
  }
  let ultimaAccion = 0, ultimoJutsu = 0;
  $$('#m-interactuar [data-a]').forEach(b => b.onclick = () => {
    const id = jugadorSel, a = b.dataset.a;
    $('#m-interactuar').classList.remove('activa');
    if (!id || !pjs.get(id)) return;
    if (cargas.has(miId())) return A.toast('Primero bájate 😅');
    if (distA(id) > 2.4) return A.toast('Acércate más a ' + nombreDe(id) + ' 🚶');
    const ahora = Date.now();
    if (ahora - ultimaAccion < 1500) return A.toast('Espera un segundito ⏳');
    if (a === 'jutsu' && ahora - ultimoJutsu < 6000) return A.toast('Tu chakra se está recargando 🌀');
    ultimaAccion = ahora; if (a === 'jutsu') ultimoJutsu = ahora;
    hacer(a, id);
  });

  function hacer(a, id) {
    const v = pjs.get(id);
    const vx = v.cx, vz = v.cz;
    if (a === 'cargar') {
      if (cargas.has(id) || llevaA(id)) return A.toast(nombreDe(id) + ' está ocupado 🤭');
      if (llevaA(miId())) return A.toast('Ya llevas a alguien cargado 💪');
      enviar('pedir', { tipo: 'cargar', de: miId(), a: id });
      return A.toast('Esperando a que ' + nombreDe(id) + ' acepte… ⏳');
    }
    if (cargas.has(id)) return A.toast(nombreDe(id) + ' va cargado, ¡déjalo en paz! 😂');
    let ax = yoPos.x, az = yoPos.z;
    if (a === 'jutsu') { // aparecer detrás de la víctima
      const fx = Math.sin(v.cr), fz = Math.cos(v.cr);
      const p = Salon.colisionar({ x: vx - fx * 0.85, z: vz - fz * 0.85 });
      ax = p.x; az = p.z;
    } else if (a === 'abrazo' || a === 'cinco' || a === 'bailar') { // ponerse en frente
      const dx = yoPos.x - vx, dz = yoPos.z - vz, d = Math.hypot(dx, dz) || 1;
      const sep = a === 'abrazo' ? 0.72 : 0.95;
      const p = Salon.colisionar({ x: vx + dx / d * sep, z: vz + dz / d * sep });
      ax = p.x; az = p.z;
    }
    const ar = Math.atan2(vx - ax, vz - az);
    enviar('accion', { tipo: a, de: miId(), a: id, ax: +ax.toFixed(2), az: +az.toFixed(2), ar: +ar.toFixed(2) });
  }

  const P3 = (id, y) => { const v = pjs.get(id); return v && v.obj ? { x: v.obj.position.x, y: (y || 0) + v.obj.position.y, z: v.obj.position.z } : null; };
  const fx = (efecto, id, y) => { const p = P3(id, y); if (p) Part[efecto](p); };
  function posDe(id) { const v = pjs.get(id); return id === miId() ? { x: yoPos.x, z: yoPos.z } : (v ? { x: v.cx, z: v.cz } : null); }
  function alAccion(m) {
    const va = pjs.get(m.de), vb = pjs.get(m.a);
    if (!va || !vb) return;
    // el que hace la acción se ubica (y se gira)
    if (m.tipo === 'jutsu') fx('humo', m.de, 0.8); // humo donde estaba
    if (m.de === miId()) { yoPos.x = m.ax; yoPos.z = m.az; yoPos.r = m.ar; enviarPos(true); }
    else { va.cx = va.tx = m.ax; va.cz = va.tz = m.az; va.cr = va.tr = m.ar; }
    const pb = posDe(m.a);
    let dx = pb.x - m.ax, dz = pb.z - m.az; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    // el que recibe mira al otro (salvo en el jutsu y el empujón: ¡por la espalda!)
    if (m.a === miId() && m.tipo !== 'jutsu' && m.tipo !== 'empujar') { yoPos.r = Math.atan2(-dx, -dz); enviarPos(true); }
    const yoEstoy = m.de === miId() || m.a === miId();
    if (m.tipo === 'jutsu') {
      ponerEfecto(m.de, 'jutsu_atacante'); ponerEfecto(m.a, 'jutsu_victima', { dir: { x: dx, z: dz } });
      texto(m.de, '💨 🙏 ¡Sello del tigre!');
      Part.humo({ x: m.ax, y: 0.8, z: m.az });
      setTimeout(() => fx('impacto', m.a, 0.9), 750);
      setTimeout(() => fx('caida', m.a, 0.1), 2100);
      A.bip(400, 0.3, 'sine', 0.04);
      setTimeout(() => {
        texto(m.a, '💥 ¡MIL AÑOS DE MUERTE! 🍑');
        if (yoEstoy) { sacudida = 0.5; document.body.classList.add('sacudir'); setTimeout(() => document.body.classList.remove('sacudir'), 500); }
        [300, 200, 900, 1400].forEach((f, i) => setTimeout(() => A.bip(f, 0.12, i % 2 ? 'square' : 'sawtooth', 0.05), i * 80));
      }, 750);
      setTimeout(() => texto(m.a, '😵 ¡Ay, ay, ay!'), 2300);
      mensajeSistema('🍑 ' + nombreDe(m.de) + ' le hizo el jutsu MIL AÑOS DE MUERTE a ' + nombreDe(m.a));
    } else if (m.tipo === 'abrazo') {
      ponerEfecto(m.de, 'abrazo'); ponerEfecto(m.a, 'abrazo');
      texto(m.a, '💕'); setTimeout(() => texto(m.de, '🥰'), 300);
      fx('corazones', m.a, 1.6); setTimeout(() => fx('corazones', m.de, 1.6), 300);
      A.bip(660, 0.2, 'sine', 0.05);
    } else if (m.tipo === 'cinco') {
      ponerEfecto(m.de, 'cinco'); ponerEfecto(m.a, 'cinco');
      setTimeout(() => { texto(m.a, '🙌 ¡PAM! ✨'); A.bip(1500, 0.08, 'square', 0.05); const a = P3(m.a, 2), b = P3(m.de, 2); if (a && b) Part.chispas({ x: (a.x + b.x) / 2, y: 2, z: (a.z + b.z) / 2 }); }, 450);
    } else if (m.tipo === 'empujar') {
      ponerEfecto(m.de, 'empujar_atacante'); ponerEfecto(m.a, 'empujar_victima', { dir: { x: dx, z: dz } });
      texto(m.a, '😤 ¡Oye!'); A.bip(220, 0.12, 'square', 0.05);
      fx('impacto', m.a, 1);
      if (m.a === miId()) sacudida = 0.25;
    } else if (m.tipo === 'bailar') {
      ponerEfecto(m.de, 'bailar'); ponerEfecto(m.a, 'bailar');
      texto(m.de, '🎶'); setTimeout(() => texto(m.a, '💃🕺'), 250);
      for (let i = 0; i < 6; i++) setTimeout(() => { fx('notas', m.de, 2); fx('notas', m.a, 2); }, i * 800);
      mensajeSistema('💃 ' + nombreDe(m.de) + ' y ' + nombreDe(m.a) + ' están bailando');
    }
  }

  // ---------- llevar cargado (el otro tiene que aceptar) ----------
  let solicitud = null, solTimer = null;
  function alPedir(m) {
    if (m.a !== miId()) return;
    if (cargas.has(miId()) || llevaA(miId())) return enviar('respuesta', { de: miId(), a: m.de, ok: false, ocupado: true });
    solicitud = m;
    $('#sol-txt').textContent = '🏋️ ' + nombreDe(m.de) + ' quiere llevarte cargado. ¿Te subes?';
    $('#solicitud').classList.add('ver');
    A.bip(880, 0.1); setTimeout(() => A.bip(1180, 0.12), 120);
    clearTimeout(solTimer); solTimer = setTimeout(() => responder(false), 9000);
  }
  function responder(ok) {
    if (!solicitud) return;
    clearTimeout(solTimer);
    enviar('respuesta', { de: miId(), a: solicitud.de, ok });
    solicitud = null; $('#solicitud').classList.remove('ver');
  }
  $('#sol-si').onclick = () => responder(true);
  $('#sol-no').onclick = () => responder(false);
  function alResponder(m) {
    if (m.ok) {
      if (m.a === miId()) enviar('carga', { portador: miId(), cargado: m.de });
    } else {
      mensajeSistema(m.ocupado ? '🤷 ' + nombreDe(m.de) + ' está ocupado' : '💔 ' + nombreDe(m.de) + ' rechazó a ' + nombreDe(m.a));
      texto(m.de, '🙅 ¡NO!');
      if (m.a === miId()) A.bip(200, 0.25, 'sawtooth', 0.04);
    }
  }
  function alCargar(m) {
    if (cargas.has(m.cargado) || llevaA(m.cargado) || cargas.has(m.portador) || llevaA(m.portador)) return;
    cargas.set(m.cargado, m.portador);
    const vc = pjs.get(m.cargado); if (vc) vc.efecto = null;
    texto(m.portador, '💪 ¡Arriba!');
    fx('chispas', m.portador, 2.2);
    mensajeSistema('🏋️ ' + nombreDe(m.portador) + ' lleva cargado a ' + nombreDe(m.cargado));
    botonBajar();
  }
  function alSoltar(m) {
    const portador = cargas.get(m.cargado); if (!portador) return;
    cargas.delete(m.cargado);
    if (m.cargado === miId()) {
      const pv = posDe(portador) || yoPos, vr = pjs.get(portador);
      const r = vr ? vr.cr : 0;
      yoPos.x = pv.x + Math.sin(r) * 0.9; yoPos.z = pv.z + Math.cos(r) * 0.9; Salon.colisionar(yoPos);
      enviarPos(true);
    }
    const vc = pjs.get(m.cargado);
    if (vc) {
      vc.caida = 1.4;
      if (m.cargado !== miId()) { const pv = posDe(portador); if (pv) { vc.cx = pv.x; vc.cz = pv.z; } }
    }
    if (!m.silencio) texto(m.cargado, '🦘');
    botonBajar();
  }
  function botonBajar() {
    const b = $('#b-bajar');
    if (cargas.has(miId())) { b.textContent = '⬇️ Bajarme'; b.classList.add('ver'); }
    else if (llevaA(miId())) { b.textContent = '⬇️ Soltar'; b.classList.add('ver'); }
    else b.classList.remove('ver');
  }
  $('#b-bajar').onclick = () => {
    if (cargas.has(miId())) return enviar('soltar', { cargado: miId() });
    const c = [...cargas].find(([, p]) => p === miId());
    if (c) enviar('soltar', { cargado: c[0] });
  };

  // ================= TEXTOS SOBRE LA CABEZA =================
  function texto(id, txt) {
    const v = pjs.get(id); if (!v) return;
    const d = document.createElement('div'); d.className = 'texto-efecto'; d.textContent = txt;
    v.etiqueta.appendChild(d); setTimeout(() => d.remove(), 2200);
  }
  function mostrarEmote(id, e) {
    const v = pjs.get(id); if (!v) return;
    const b = document.createElement('div'); b.className = 'burbuja'; b.textContent = e;
    v.etiqueta.appendChild(b); setTimeout(() => b.remove(), 2400);
    A.bip(500 + Math.random() * 400, 0.07, 'square', 0.03);
    if ((!v.efecto || v.efecto.n === 'emote') && !cargas.has(id)) ponerEfecto(id, 'emote', { e }); // el muñeco hace el gesto
  }
  let ultimoEmote = 0;
  $$('#emotes button').forEach(b => b.onclick = () => {
    if (!canal || Date.now() - ultimoEmote < 700) return;
    ultimoEmote = Date.now();
    enviar('emote', { id: miId(), e: b.dataset.e });
  });
  $('#s-emo').onclick = () => { $('#emotes').classList.toggle('ver'); $('#s-emo').classList.toggle('on'); };

  // ================= CHAT =================
  function abrirChat() {
    const barra = $('#chat-barra');
    if (barra.classList.contains('ver')) { barra.classList.remove('ver'); $('#chat-input').blur(); return; }
    barra.classList.add('ver'); $('#chat-input').focus();
  }
  $('#s-chat').onclick = abrirChat;
  $('#chat-input').addEventListener('keydown', e => { if (e.key === 'Escape') { $('#chat-barra').classList.remove('ver'); e.target.blur(); } });
  let ultimoChat = 0;
  $('#chat-barra').onsubmit = e => {
    e.preventDefault();
    const inp = $('#chat-input'), txt = inp.value.trim().slice(0, 80);
    if (!txt || !canal) return;
    if (Date.now() - ultimoChat < 800) return A.toast('Más despacio 😅');
    ultimoChat = Date.now();
    enviar('chat', { id: miId(), txt });
    inp.value = '';
  };
  function alChat(m) {
    const txt = String(m.txt || '').slice(0, 80); if (!txt) return;
    agregarLog(`<b>${esc(nombreDe(m.id))}:</b> ${esc(txt)}`);
    const v = pjs.get(m.id);
    if (v) {
      const viejo = v.etiqueta.querySelector('.burbuja-chat'); if (viejo) viejo.remove();
      const b = document.createElement('div'); b.className = 'burbuja-chat'; b.textContent = txt;
      v.etiqueta.appendChild(b); setTimeout(() => b.remove(), 4500);
    }
    if (m.id !== miId()) A.bip(1320, 0.05, 'sine', 0.04);
  }
  function mensajeSistema(txt) { agregarLog(esc(txt), 'sistema'); }
  function agregarLog(html, clase) {
    const log = $('#chat-log');
    const d = document.createElement('div'); if (clase) d.className = clase; d.innerHTML = html;
    log.appendChild(d);
    while (log.children.length > 6) log.firstChild.remove();
    setTimeout(() => d.classList.add('viejo'), 12000);
    setTimeout(() => d.remove(), 13500);
  }

  // ================= VESTIDOR (dentro de la sala) =================
  const MUERTES = [
    { id: 'granada', nombre: 'Granada', emoji: '💣' },
    { id: 'martillo', nombre: 'Martillazo', emoji: '🔨' },
    { id: 'pastel', nombre: 'Pastel bomba', emoji: '🎂' },
    { id: 'varilla', nombre: 'La varilla', emoji: '🩸' },
  ];
  const CAMPOS = ['animal', 'color', 'sombrero', 'gafas', 'accesorio', 'muerte'];
  let vistiendo = false, vCat = 'color', ropaAntes = null;
  const ropaDe = o => { const r = {}; CAMPOS.forEach(k => r[k] = o[k]); return r; };
  const colorDe = c => jugadores.find(j => j.id !== miId() && j.color === c); // ¿quién tiene ese color?
  const colorLibre = pref => (pref && !colorDe(pref)) ? pref : Zoo.COLORES.find(c => !colorDe(c));

  function abrirVestidor() {
    if (!sala) return;
    if (cargas.has(miId()) || llevaA(miId())) return A.toast('Primero bájate 😅');
    vistiendo = true; ropaAntes = ropaDe(yo);
    yoPos.r = 0; enviarPos(true);
    $('#p-sala').classList.add('vistiendo'); $('#vestidor').classList.add('ver');
    ['#chat-barra', '#emotes'].forEach(x => $(x).classList.remove('ver'));
    pintarVestidor();
  }
  async function cerrarVestidor() {
    if (!vistiendo) return;
    vistiendo = false;
    $('#p-sala').classList.remove('vistiendo'); $('#vestidor').classList.remove('ver');
    const cambios = {}; CAMPOS.forEach(k => { if (yo[k] !== ropaAntes[k]) cambios[k] = yo[k]; });
    if (!Object.keys(cambios).length) return;
    Object.assign(A.perfil, cambios); // se guarda en tu cuenta
    const { error } = await sb.from('zoo_perfiles').update(Object.assign({ actualizado: new Date().toISOString() }, cambios)).eq('id', miId());
    A.toast(error ? 'No se pudo guardar tu ropa 😕' : '¡Te ves increíble! 😎');
  }
  $('#s-vestir').onclick = abrirVestidor;
  $('#b-vestidor').onclick = abrirVestidor;
  $('#v-listo').onclick = cerrarVestidor;
  $$('[data-vcat]').forEach(b => b.onclick = () => { vCat = b.dataset.vcat; $$('[data-vcat]').forEach(x => x.classList.toggle('activa', x === b)); pintarVestidor(); });

  function ponerRopa(cambios, silencio) {
    Object.assign(yo, cambios);
    const j = jugadores.find(x => x.id === miId()); if (j) Object.assign(j, cambios);
    canal.track(yo);
    enviar('ropa', Object.assign({ id: miId() }, ropaDe(yo))); // aviso inmediato
    pintarTodo(); if (vistiendo) pintarVestidor();
    if (!silencio) { fx('chispas', miId(), 1.4); A.bip(980, 0.08); }
  }
  function alRopa(m) {
    if (m.id === miId()) return;
    const j = jugadores.find(x => x.id === m.id); if (!j) return;
    CAMPOS.forEach(k => { if (m[k]) j[k] = m[k]; });
    revisarColor(); pintarTodo(); if (vistiendo) pintarVestidor();
  }
  // si otro (que llegó antes) tiene mi mismo color, me cambio a uno libre
  function revisarColor() {
    if (!yo || !canal) return;
    const otro = jugadores.find(j => j.id !== miId() && j.color === yo.color);
    if (!otro) return;
    if (!(otro.desde < yo.desde || (otro.desde === yo.desde && otro.id < miId()))) return;
    const nuevo = colorLibre();
    if (!nuevo || nuevo === yo.color) return;
    ponerRopa({ color: nuevo }, true);
    A.toast('🎨 ' + otro.apodo + ' ya tenía tu color, te di otro. Cámbialo en el 👕 Vestidor');
  }

  function pintarVestidor() {
    const cont = $('#v-opciones'); cont.innerHTML = '';
    if (vCat === 'color') {
      Zoo.COLORES.forEach(c => {
        const due = colorDe(c);
        const b = document.createElement('button');
        b.className = 'op color' + (yo.color === c ? ' sel' : '') + (due ? ' ocupado' : '');
        b.innerHTML = '<i style="background:' + c + '"></i>';
        if (due) b.dataset.de = due.apodo;
        b.onclick = () => due ? A.toast('🔒 Ese color es de ' + due.apodo) : (yo.color !== c && ponerRopa({ color: c }));
        cont.appendChild(b);
      });
      return;
    }
    const lista = { animal: Zoo.ANIMALES, sombrero: Zoo.SOMBREROS, gafas: Zoo.GAFAS, accesorio: Zoo.ACCESORIOS, muerte: MUERTES }[vCat];
    lista.forEach(o => {
      const b = document.createElement('button');
      b.className = 'op' + (yo[vCat] === o.id ? ' sel' : '');
      b.innerHTML = o.emoji + '<small>' + o.nombre + '</small>';
      b.onclick = () => {
        if (yo[vCat] === o.id) return;
        const cambios = { [vCat]: o.id };
        if (vCat === 'animal' && !colorDe(o.color)) cambios.color = o.color; // color típico si está libre
        ponerRopa(cambios);
      };
      cont.appendChild(b);
    });
  }

  // ================= INTERFAZ =================
  function pintarTodo() {
    if (!sala) return;
    const c = cfg();
    $('#s-cupo').textContent = jugadores.length + '/' + c.max;
    const modo = MODOS.find(m => m.id === c.modo), mapa = MAPAS.find(m => m.id === c.mapa);
    $('#s-resumen').textContent = `${modo.emoji} ${modo.nombre} · ${mapa.emoji} ${mapa.nombre} · 🔪 ${c.impostores} · 📋 ${c.cortas}/${c.medias}/${c.largas}`;
    $('#s-config').title = soyHost() ? 'Configurar' : 'Ver reglas';
    const acc = $('#s-accion');
    if (soyHost()) {
      const faltan = jugadores.filter(j => j.id !== miId() && !j.listo).length;
      acc.textContent = faltan ? (faltan === 1 ? '⏳ Falta 1 listo' : `⏳ Faltan ${faltan} listos`) : '▶ EMPEZAR';
      acc.classList.toggle('verde', !faltan);
      acc.disabled = !!faltan;
    } else {
      acc.disabled = false;
      acc.classList.toggle('verde', !!yo.listo);
      acc.textContent = yo.listo ? '✔ ¡Listo!' : '✋ Estoy listo';
    }
    sincronizar3D();
    if ($('#m-config').classList.contains('activa')) pintarConfig();
  }

  $('#s-accion').onclick = () => {
    if (!sala) return;
    if (soyHost()) return empezar();
    yo.listo = !yo.listo; canal.track(yo);
    enviar('listo', { id: miId(), listo: yo.listo }); // aviso inmediato
  };

  function empezar() {
    if (enJuego()) return;
    if (jugadores.length < 3 && !confirm('Se recomienda jugar con 3 o más. ¿Empezar igual?')) return;
    // el anfitrión reparte los roles al azar y los lugares de salida
    const ids = jugadores.map(j => j.id);
    const mezcla = ids.slice().sort(() => Math.random() - 0.5);
    const nImp = ids.length < 2 ? 0 : Math.max(1, Math.min(cfg().impostores, Math.floor((ids.length - 1) / 2) || 1));
    const roles = {}, salidas = {};
    mezcla.forEach((id, i) => roles[id] = i < nImp ? 'i' : 't');
    ids.forEach((id, i) => { const p = Mansion.salida(i, ids.length); salidas[id] = [+p.x.toFixed(2), +p.z.toFixed(2)]; });
    sb.from('zoo_salas').update({ estado: 'jugando', actualizado: new Date().toISOString() }).eq('codigo', sala.codigo).then(() => { });
    const tareas = ZooMisiones.asignar(ids, cfg());
    enviar('inicio', { config: cfg(), roles, salidas, tareas });
  }
  function alIniciar(datos) {
    if (vistiendo) cerrarVestidor();
    [...cargas.keys()].forEach(c => alSoltar({ cargado: c, silencio: true }));
    $$('.modal').forEach(m => m.classList.remove('activa'));
    const c = $('#cuenta'); c.classList.add('ver');
    let n = 3; c.textContent = n; A.bip(700, 0.15);
    const h = setInterval(() => {
      n--;
      if (n > 0) { c.textContent = n; A.bip(700, 0.15); return; }
      clearInterval(h); c.textContent = '¡A JUGAR!'; A.bip(1200, 0.3);
      setTimeout(() => { c.classList.remove('ver'); if (datos && datos.roles && J()) J().comenzar(datos); }, 700);
    }, 800);
  }

  // compartir código
  $('#s-codigo').onclick = async () => {
    if (!sala) return;
    const web = /^https?:/.test(location.protocol);
    const url = web ? location.origin + location.pathname + '?sala=' + sala.codigo : '';
    const txt = `¡Únete a mi partida de ZOOspechosos! 🐾 Código: ${sala.codigo}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'ZOOspechosos', text: txt, url: url || undefined }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url ? txt + ' ' + url : txt); A.toast('Código copiado 📋 ¡Pégalo en WhatsApp!'); }
    catch (e) { A.toast('Código: ' + sala.codigo); }
  };

  // ---------- configuración ----------
  $('#s-config').onclick = $('#s-resumen').onclick = () => { pintarConfig(); A.abrir('#m-config'); };
  function pintarConfig() {
    const c = cfg(), host = soyHost(), dis = host ? '' : 'disabled';
    let h = `${host ? '' : '<p class="aviso">Solo el anfitrión 👑 puede cambiar esto.</p>'}<h4>Modo de juego</h4><div class="tarjetas">`;
    MODOS.forEach(m => h += `<button class="tj ${c.modo === m.id ? 'sel' : ''} ${m.listo ? '' : 'pronto'}" data-k="modo" data-v="${m.id}" ${dis}><span>${m.emoji}</span><b>${m.nombre}</b><small>${m.listo ? m.desc : '🔒 Muy pronto'}</small></button>`);
    h += '</div><h4>Mapa</h4><div class="tarjetas">';
    MAPAS.forEach(m => h += `<button class="tj ${c.mapa === m.id ? 'sel' : ''} ${m.listo ? '' : 'pronto'}" data-k="mapa" data-v="${m.id}" ${dis}><span>${m.emoji}</span><b>${m.nombre}</b><small>${m.listo ? '¡Disponible!' : '🔒 Muy pronto'}</small></button>`);
    h += '</div><h4>Reglas</h4>';
    NUMEROS.forEach(n => {
      const v = c[n.k], f = n.fmt || (x => x);
      h += `<div class="regla"><span>${n.nombre}</span><div class="paso"><button data-n="${n.k}" data-d="-1" ${dis || (v <= n.min ? 'disabled' : '')}>−</button><b>${f(v)}</b><button data-n="${n.k}" data-d="1" ${dis || (v >= n.max ? 'disabled' : '')}>+</button></div></div>`;
    });
    SINO.forEach(s => h += `<div class="regla"><span>${s.nombre}</span><button class="interruptor ${c[s.k] ? 'on' : ''}" data-s="${s.k}" ${dis}><i></i></button></div>`);
    const cont = $('#config-campos'); const scroll = cont.scrollTop;
    cont.innerHTML = h; cont.scrollTop = scroll;
    if (!host) return;
    cont.querySelectorAll('.tj').forEach(b => b.onclick = () => {
      if (b.classList.contains('pronto')) return A.toast('🔒 Ese llega en una próxima parte');
      cambiar({ [b.dataset.k]: b.dataset.v });
    });
    cont.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
      const n = NUMEROS.find(x => x.k === b.dataset.n);
      let v = Math.round((c[n.k] + n.paso * +b.dataset.d) * 100) / 100;
      v = Math.max(n.min, Math.min(n.max, v));
      if (n.k === 'impostores' && v > Math.floor((c.max - 1) / 2)) return A.toast('Demasiados impostores para ' + c.max + ' jugadores');
      if (n.k === 'max' && v < jugadores.length) return A.toast('Ya hay ' + jugadores.length + ' en la sala');
      if (['cortas', 'medias', 'largas'].includes(n.k) && Object.assign({}, c, { [n.k]: v }).cortas + Object.assign({}, c, { [n.k]: v }).medias + Object.assign({}, c, { [n.k]: v }).largas < 1) return A.toast('Debe haber al menos 1 misión');
      cambiar({ [n.k]: v });
    });
    cont.querySelectorAll('[data-s]').forEach(b => b.onclick = () => cambiar({ [b.dataset.s]: !c[b.dataset.s] }));
  }
  let guardarCfg = null;
  function cambiar(parcial) {
    sala.config = Object.assign(cfg(), parcial);
    enviar('config', sala.config);
    pintarTodo();
    clearTimeout(guardarCfg); // guardamos en la base de datos sin saturarla
    guardarCfg = setTimeout(() => sb.from('zoo_salas').update({ config: sala.config, actualizado: new Date().toISOString() }).eq('codigo', sala.codigo).then(() => { }), 600);
  }

  // ---------- anfitrión: expulsar / dar corona ----------
  $('#mj-expulsar').onclick = () => {
    if (!jugadorSel) return;
    enviar('expulsar', { id: jugadorSel });
    $('#m-interactuar').classList.remove('activa');
  };
  $('#mj-host').onclick = async () => {
    if (!jugadorSel) return;
    const { data: ok, error } = await sb.rpc('zoo_pasar_host', { cod: sala.codigo, nuevo: jugadorSel });
    if (error || !ok) return A.toast('No se pudo pasar la corona');
    enviar('host', { id: jugadorSel });
    $('#m-interactuar').classList.remove('activa');
  };

  // ---------- link con ?sala=CODIGO ----------
  // lo que necesita la partida (juego.js)
  const interno = {
    get canal() { return canal; }, get sala() { return sala; }, get jugadores() { return jugadores; }, get yo() { return yo; },
    pjs, yoPos, cargas, enviar, enviarPos, miId, soyHost, cfg, nombreDe, texto, mensajeSistema, pintarTodo, P3,
    sacudir(v) { sacudida = Math.max(sacudida, v); },
    reiniciarCamara() { camaraLista = false; },
  };

  window.ZooSala = {
    interno,
    _dbg: { yoPos, pjs, enviarPos, cargas }, // para pruebas automáticas
    alEntrar() {
      const cod = new URLSearchParams(location.search).get('sala');
      if (!cod) return;
      history.replaceState(null, '', location.pathname + location.hash);
      unirse(cod);
    },
  };
})();
