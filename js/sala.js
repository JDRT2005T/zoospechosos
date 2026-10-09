// ZOOspechosos — Parte 2: salas con código y sala de espera en tiempo real
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
    { k: 'misiones', nombre: 'Misiones por jugador', min: 2, max: 8, paso: 1 },
    { k: 'reunion', nombre: 'Tiempo de votación', min: 30, max: 120, paso: 15, fmt: v => v + ' s' },
    { k: 'caza', nombre: 'Tiempo de cacería', min: 60, max: 240, paso: 30, fmt: v => v + ' s' },
    { k: 'enfriamiento', nombre: 'Espera entre ataques', min: 15, max: 60, paso: 5, fmt: v => v + ' s' },
  ];
  const SINO = [
    { k: 'votoAnonimo', nombre: 'Votos anónimos' },
    { k: 'mostrarRol', nombre: 'Revelar rol al expulsar' },
  ];
  const DEF = { modo: 'caceria', mapa: 'mansion', max: 10, impostores: 1, velocidad: 1, misiones: 4, reunion: 60, caza: 120, enfriamiento: 30, votoAnonimo: false, mostrarRol: true };

  // ---------- estado ----------
  let sala = null;        // { codigo, host, config }
  let canal = null;
  let jugadores = [];     // [{ id, apodo, animal, ..., listo, desde }]
  let yo = null;          // mi estado de presencia
  let primeraSync = true;
  let latido = null, hostAusenteDesde = 0;
  const pjs = new Map();  // id -> { obj, clave, etiqueta, destino, t }

  const soyHost = () => sala && A.perfil && sala.host === A.perfil.id;
  const cfg = () => Object.assign({}, DEF, sala ? sala.config : {});

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
    jugadores = []; primeraSync = true; hostAusenteDesde = 0;
    const p = A.perfil;
    yo = { id: p.id, apodo: p.apodo, animal: p.animal, color: p.color, sombrero: p.sombrero, gafas: p.gafas, accesorio: p.accesorio, listo: false, desde: Date.now() };
    $('#s-cod').textContent = sala.codigo;
    A.ir('sala');
    pintarTodo();

    canal = sb.channel('zoo-sala-' + sala.codigo, { config: { presence: { key: p.id }, broadcast: { self: true } } });
    canal
      .on('presence', { event: 'sync' }, alSincronizar)
      .on('broadcast', { event: 'config' }, ({ payload }) => { sala.config = payload; pintarTodo(); })
      .on('broadcast', { event: 'host' }, ({ payload }) => {
        sala.host = payload.id;
        if (payload.id === A.perfil.id) { A.toast('👑 Ahora eres el anfitrión'); yo.listo = false; canal.track(yo); }
        pintarTodo();
      })
      .on('broadcast', { event: 'listo' }, ({ payload }) => { const j = jugadores.find(x => x.id === payload.id); if (j) { j.listo = payload.listo; pintarTodo(); } })
      .on('broadcast', { event: 'emote' }, ({ payload }) => mostrarEmote(payload.id, payload.e))
      .on('broadcast', { event: 'expulsar' }, ({ payload }) => {
        if (payload.id === A.perfil.id) { salirLocal(); A.toast('Te sacaron de la sala 🚪'); }
      })
      .on('broadcast', { event: 'inicio' }, ({ payload }) => alIniciar(payload))
      .subscribe(estado => {
        if (estado === 'SUBSCRIBED') canal.track(yo);
        if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') A.toast('Problema de conexión con la sala 📶');
      });

    clearInterval(latido);
    latido = setInterval(revisarHost, 5000);
    if (soyHost()) tocarSala();
  }

  async function salir() {
    if (!sala) return;
    if (soyHost()) {
      const otros = jugadores.filter(j => j.id !== A.perfil.id);
      if (otros.length) {
        const { data: ok } = await sb.rpc('zoo_pasar_host', { cod: sala.codigo, nuevo: otros[0].id });
        if (ok) canal.send({ type: 'broadcast', event: 'host', payload: { id: otros[0].id } });
      } else {
        await sb.from('zoo_salas').delete().eq('codigo', sala.codigo);
      }
    }
    salirLocal();
  }
  function salirLocal() {
    clearInterval(latido);
    if (canal) { canal.untrack(); sb.removeChannel(canal); canal = null; }
    sala = null; jugadores = [];
    pjs.forEach((v, id) => quitarPj(id));
    $$('.modal').forEach(m => m.classList.remove('activa'));
    A.ir('menu');
  }
  $('#s-salir').onclick = () => { if (confirm('¿Salir de la sala?')) salir(); };

  // el anfitrión "late" para que se sepa que sigue conectado
  function tocarSala() { if (soyHost()) sb.from('zoo_salas').update({ actualizado: new Date().toISOString() }).eq('codigo', sala.codigo).then(() => { }); }
  let contLatido = 0;
  async function revisarHost() {
    if (!sala) return;
    if (soyHost()) { if (++contLatido % 2 === 0) tocarSala(); return; }
    const hostAqui = jugadores.some(j => j.id === sala.host);
    if (hostAqui) { hostAusenteDesde = 0; return; }
    if (!hostAusenteDesde) hostAusenteDesde = Date.now();
    // el jugador más antiguo hereda la sala si el anfitrión se fue
    if (Date.now() - hostAusenteDesde > 8000 && jugadores[0] && jugadores[0].id === A.perfil.id) {
      const { data: ok } = await sb.rpc('zoo_heredar_host', { cod: sala.codigo });
      if (ok) canal.send({ type: 'broadcast', event: 'host', payload: { id: A.perfil.id } });
    }
  }

  // ================= PRESENCIA =================
  function alSincronizar() {
    const st = canal.presenceState();
    const lista = [];
    Object.values(st).forEach(arr => { if (arr && arr.length) lista.push(arr[arr.length - 1]); }); // el último es el más nuevo
    lista.sort((a, b) => a.desde - b.desde);
    // ¿la sala está llena?
    if (primeraSync && lista.some(j => j.id === A.perfil.id)) {
      primeraSync = false;
      const pos = lista.findIndex(j => j.id === A.perfil.id);
      if (pos >= cfg().max) { salirLocal(); return A.toast('La sala está llena 😕'); }
      if (lista.length > 1) A.bip(990, 0.12);
    }
    const antes = new Set(jugadores.map(j => j.id));
    jugadores = lista.slice(0, cfg().max);
    jugadores.forEach(j => { if (!antes.has(j.id) && !primeraSync && j.id !== A.perfil.id) A.bip(1100, 0.1); });
    pintarTodo();
  }

  // ================= 3D =================
  function lugar(i, n) {
    const ancho = innerWidth / innerHeight < 0.8 ? 3 : 5;
    const fila = Math.floor(i / ancho), enFila = Math.min(ancho, n - fila * ancho), col = i % ancho;
    return new T.Vector3((col - (enFila - 1) / 2) * 1.3, 0, 1.0 - fila * 1.35);
  }
  function claveRopa(j) { return [j.animal, j.color, j.sombrero, j.gafas, j.accesorio].join('|'); }
  function quitarPj(id) {
    const v = pjs.get(id); if (!v) return;
    A.escena.remove(v.obj); Zoo.liberar(v.obj); v.etiqueta.remove(); pjs.delete(id);
  }
  function sincronizar3D() {
    const ids = new Set(jugadores.map(j => j.id));
    [...pjs.keys()].forEach(id => { if (!ids.has(id)) quitarPj(id); });
    jugadores.forEach((j, i) => {
      let v = pjs.get(j.id);
      const clave = claveRopa(j);
      if (v && v.clave !== clave) { A.escena.remove(v.obj); Zoo.liberar(v.obj); v.obj = null; }
      if (!v) {
        const et = document.createElement('div'); et.className = 'etiqueta';
        et.onclick = () => tocarJugador(j.id);
        $('#etiquetas').appendChild(et);
        v = { etiqueta: et, obj: null }; pjs.set(j.id, v);
      }
      if (!v.obj) {
        v.obj = Zoo.crear(j); v.clave = clave;
        v.obj.position.copy(lugar(i, jugadores.length)); v.obj.position.y = 4; // cae desde arriba
        A.escena.add(v.obj);
      }
      v.destino = lugar(i, jugadores.length);
      v.listo = j.listo;
      const host = j.id === sala.host, mio = j.id === A.perfil.id;
      v.etiqueta.className = 'etiqueta' + (mio ? ' yo' : '') + (j.listo || host ? ' ok' : '');
      v.etiqueta.innerHTML = `${host ? '<i>👑</i>' : ''}<span>${esc(j.apodo)}</span>${host ? '' : (j.listo ? '<em>✔</em>' : '<em class="no">…</em>')}`;
    });
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const proy = new T.Vector3();
  A.alCuadro.push(dt => {
    if (A.pantalla !== 'sala') return;
    const w = innerWidth, h = innerHeight;
    pjs.forEach(v => {
      const o = v.obj; if (!o) return;
      o.position.x += (v.destino.x - o.position.x) * Math.min(1, dt * 5);
      o.position.z += (v.destino.z - o.position.z) * Math.min(1, dt * 5);
      if (o.position.y > 0) { o.userData.vy = (o.userData.vy || 0) - 18 * dt; o.position.y = Math.max(0, o.position.y + o.userData.vy * dt); if (!o.position.y) o.userData.vy = 0; }
      if (v.salto > 0) v.salto -= dt;
      Zoo.animar(o, dt, v.salto > 0 ? 'quieto' : (v.listo ? 'baile' : 'quieto'));
      if (v.salto > 0) o.userData.cuerpo.position.y = Math.sin((0.5 - v.salto) / 0.5 * Math.PI) * 0.5;
      proy.set(o.position.x, o.position.y + 2.05, o.position.z).project(A.camara);
      v.etiqueta.style.transform = `translate(${(proy.x * 0.5 + 0.5) * w}px, ${(-proy.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    });
  });

  function mostrarEmote(id, e) {
    const v = pjs.get(id); if (!v) return;
    const b = document.createElement('div'); b.className = 'burbuja'; b.textContent = e;
    v.etiqueta.appendChild(b); setTimeout(() => b.remove(), 2400);
    v.salto = 0.5; A.bip(500 + Math.random() * 400, 0.07, 'square', 0.03);
  }
  let ultimoEmote = 0;
  $$('#emotes button').forEach(b => b.onclick = () => {
    if (!canal || Date.now() - ultimoEmote < 700) return;
    ultimoEmote = Date.now();
    canal.send({ type: 'broadcast', event: 'emote', payload: { id: A.perfil.id, e: b.dataset.e } });
  });

  // ================= INTERFAZ =================
  function pintarTodo() {
    if (!sala) return;
    const c = cfg();
    $('#s-cupo').textContent = jugadores.length + '/' + c.max;
    const modo = MODOS.find(m => m.id === c.modo), mapa = MAPAS.find(m => m.id === c.mapa);
    $('#s-resumen').innerHTML = `
      <div class="chip grande-chip">${modo.emoji} <b>${modo.nombre}</b><small>${modo.desc}</small></div>
      <div class="chips">
        <span class="chip">${mapa.emoji} ${mapa.nombre}</span>
        <span class="chip">🔪 ${c.impostores} impostor${c.impostores > 1 ? 'es' : ''}</span>
        <span class="chip">📋 ${c.misiones} misiones</span>
        <span class="chip">🏃 x${c.velocidad}</span>
        <span class="chip">🗳️ ${c.reunion} s</span>
        <span class="chip">🏹 ${c.caza} s</span>
      </div>`;
    const host = soyHost();
    $('#s-config').textContent = host ? '⚙️ Configurar' : '👀 Ver reglas';
    const acc = $('#s-accion');
    if (host) {
      const otros = jugadores.filter(j => j.id !== A.perfil.id);
      const faltan = otros.filter(j => !j.listo).length;
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
    canal.send({ type: 'broadcast', event: 'listo', payload: { id: A.perfil.id, listo: yo.listo } }); // aviso inmediato
  };

  async function empezar() {
    if (jugadores.length < 3 && !confirm('Se recomienda jugar con 3 o más. ¿Empezar igual?')) return;
    canal.send({ type: 'broadcast', event: 'inicio', payload: { config: cfg(), jugadores: jugadores.map(j => j.id) } });
  }
  function alIniciar() {
    // La partida 3D llega en la Parte 3; por ahora solo se anuncia.
    const c = $('#cuenta'); c.classList.add('ver');
    let n = 3; c.textContent = n; A.bip(700, 0.15);
    const h = setInterval(() => {
      n--;
      if (n > 0) { c.textContent = n; A.bip(700, 0.15); return; }
      clearInterval(h); c.textContent = '¡A JUGAR!'; A.bip(1200, 0.3);
      setTimeout(() => { c.classList.remove('ver'); A.toast('🚧 El mapa y la partida llegan en la Parte 3', 3500); }, 1100);
    }, 800);
  }

  // compartir código
  $('#s-codigo').onclick = async () => {
    if (!sala) return;
    const web = /^https?:/.test(location.protocol);
    const url = web ? location.origin + location.pathname + '?sala=' + sala.codigo : '';
    const texto = `¡Únete a mi partida de ZOOspechosos! 🐾 Código: ${sala.codigo}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'ZOOspechosos', text: texto, url: url || undefined }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url ? texto + ' ' + url : texto); A.toast('Código copiado 📋 ¡Pégalo en WhatsApp!'); }
    catch (e) { A.toast('Código: ' + sala.codigo); }
  };

  // ---------- configuración ----------
  $('#s-config').onclick = () => { pintarConfig(); A.abrir('#m-config'); };
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
      cambiar({ [n.k]: v });
    });
    cont.querySelectorAll('[data-s]').forEach(b => b.onclick = () => cambiar({ [b.dataset.s]: !c[b.dataset.s] }));
  }
  let guardarCfg = null;
  function cambiar(parcial) {
    sala.config = Object.assign(cfg(), parcial);
    canal.send({ type: 'broadcast', event: 'config', payload: sala.config });
    pintarTodo();
    clearTimeout(guardarCfg); // guardamos en la base de datos sin saturarla
    guardarCfg = setTimeout(() => sb.from('zoo_salas').update({ config: sala.config, actualizado: new Date().toISOString() }).eq('codigo', sala.codigo).then(() => { }), 600);
  }

  // ---------- tocar a un jugador (anfitrión) ----------
  let jugadorSel = null;
  function tocarJugador(id) {
    if (!soyHost() || id === A.perfil.id) return;
    const j = jugadores.find(x => x.id === id); if (!j) return;
    jugadorSel = id; $('#mj-nombre').textContent = j.apodo; A.abrir('#m-jugador');
  }
  $('#mj-expulsar').onclick = () => {
    if (!jugadorSel) return;
    canal.send({ type: 'broadcast', event: 'expulsar', payload: { id: jugadorSel } });
    $('#m-jugador').classList.remove('activa');
  };
  $('#mj-host').onclick = async () => {
    if (!jugadorSel) return;
    const { data: ok, error } = await sb.rpc('zoo_pasar_host', { cod: sala.codigo, nuevo: jugadorSel });
    if (error || !ok) return A.toast('No se pudo pasar la corona');
    canal.send({ type: 'broadcast', event: 'host', payload: { id: jugadorSel } });
    $('#m-jugador').classList.remove('activa');
  };

  // ---------- link con ?sala=CODIGO ----------
  window.ZooSala = {
    alEntrar() {
      const cod = new URLSearchParams(location.search).get('sala');
      if (!cod) return;
      history.replaceState(null, '', location.pathname + location.hash);
      unirse(cod);
    },
  };
})();
