// ZOOspechosos — Alcantarillas 🕳️ y sabotajes ⚠️ (luces, puertas, alarma, oxígeno)
(function () {
  const A = window.ZooApp, T = THREE;
  const S = () => ZooSala.interno;
  const $ = s => document.querySelector(s);
  const DUR_CRISIS = 40000, DUR_PUERTAS = 10000, ESPERA = 25000;
  const INFO = {
    luces: { e: '💡', n: 'Apagar las luces', d: 'Los tripulantes casi no ven nada' },
    puertas: { e: '🚪', n: 'Cerrar puertas', d: 'Encierra un cuarto por 10 segundos' },
    alarma: { e: '🚨', n: 'Alarma', d: 'Si no la apagan en 40 s, ¡ganas!' },
    oxigeno: { e: '🧪', n: 'Oxígeno', d: 'Si no ponen el código en 40 s, ¡ganas!' },
  };

  // ---------- estado ----------
  let activo = false, roles = {};
  let sab = null;                 // { tipo, fin, codigo } (luces/alarma/oxígeno)
  const cerradas = new Map();     // cuarto -> hasta cuándo
  let enfriaHasta = 0;
  const enVent = new Map();       // jugador -> alcantarilla
  let miVent = null;
  const miId = () => S().miId();
  const soyImp = () => roles[miId()] === 'i';
  const fantasma = () => window.ZooJuego && ZooJuego.soyFantasma();

  function iniciar(r) {
    activo = true; roles = r || {}; sab = null; cerradas.clear(); enVent.clear(); miVent = null;
    enfriaHasta = Date.now() + 15000;
    Mansion.abrirTodas();
    pintar();
  }
  function terminar() {
    activo = false; sab = null; cerradas.clear(); enVent.clear(); miVent = null;
    Mansion.abrirTodas(); ZooMisiones.setExtras([]);
    ['#oscuro', '#sab-banner', '#vent-ui'].forEach(s => $(s).classList.remove('ver'));
    $('#b-sabotaje').hidden = true; $('#b-vent').hidden = true;
    $('#m-sabotaje').classList.remove('activa');
  }

  // ---------- el impostor sabotea ----------
  $('#b-sabotaje').addEventListener('click', () => {
    if (!activo || !soyImp() || fantasma()) return;
    pintarMenu(); A.abrir('#m-sabotaje');
  });
  function pintarMenu() {
    const falta = Math.ceil((enfriaHasta - Date.now()) / 1000);
    const cont = $('#sab-opciones'); cont.innerHTML = '';
    if (falta > 0) cont.insertAdjacentHTML('beforeend', `<p class="aviso">⏳ Puedes sabotear en ${falta} s</p>`);
    Object.entries(INFO).forEach(([tipo, i]) => {
      const b = document.createElement('button'); b.className = 'tj';
      b.innerHTML = `<span>${i.e}</span><b>${i.n}</b><small>${i.d}</small>`;
      b.disabled = falta > 0 || (tipo !== 'puertas' && !!sab);
      b.onclick = () => {
        if (tipo === 'puertas') return pintarCuartos();
        $('#m-sabotaje').classList.remove('activa');
        lanzar({ tipo, codigo: tipo === 'oxigeno' ? String(Math.floor(10000 + Math.random() * 90000)) : null });
      };
      cont.appendChild(b);
    });
  }
  function pintarCuartos() {
    const cont = $('#sab-opciones'); cont.innerHTML = '<p class="aviso">¿Qué cuarto quieres encerrar? 🚪</p>';
    Object.entries(Mansion.AREAS).forEach(([k, a]) => {
      if (k >= 'a' && k <= 'z') return;
      const b = document.createElement('button'); b.className = 'tj chico'; b.innerHTML = `<b>${a.n}</b>`;
      b.disabled = cerradas.has(k);
      b.onclick = () => { $('#m-sabotaje').classList.remove('activa'); lanzar({ tipo: 'puertas', cuarto: k }); };
      cont.appendChild(b);
    });
  }
  function lanzar(d) {
    enfriaHasta = Date.now() + ESPERA;
    S().enviar('sab', Object.assign({ de: miId(), t: Date.now() }, d));
  }

  function alSabotaje(m) {
    if (!activo) return;
    if (m.tipo === 'puertas') {
      cerradas.set(m.cuarto, Date.now() + DUR_PUERTAS);
      Mansion.puertas(m.cuarto, true);
      A.bip(160, 0.3, 'sawtooth', 0.05);
      // si yo estaba justo en una puerta que se cerró, me empuja afuera
      const yp = S().yoPos; Mansion.colisionar(yp); S().enviarPos(true);
    } else {
      if (sab) return;
      sab = { tipo: m.tipo, codigo: m.codigo, fin: m.tipo === 'luces' ? 0 : Date.now() + DUR_CRISIS };
      for (let i = 0; i < 3; i++) setTimeout(() => A.bip(m.tipo === 'luces' ? 220 : 880, 0.25, 'square', 0.06), i * 300);
    }
    pintar();
  }
  function alArreglo(m) {
    if (!activo || !sab || sab.tipo !== m.tipo) return;
    sab = null;
    A.bip(660, 0.15); setTimeout(() => A.bip(990, 0.2), 140);
    A.toast('✅ ' + S().nombreDe(m.de) + ' arregló ' + (m.tipo === 'luces' ? 'las luces 💡' : m.tipo === 'alarma' ? 'la alarma 🚨' : 'el oxígeno 🧪'));
    pintar();
  }

  // ---------- estaciones para arreglar (usan el botón USAR) ----------
  function pintar() {
    const P = Mansion.PANELES;
    const lista = [];
    if (sab && !soyImp() && !fantasma()) {
      const arreglar = tipo => () => S().enviar('arreglo', { tipo, de: miId() });
      if (sab.tipo === 'luces') lista.push({ x: P.luces.x, z: P.luces.z, e: '💡', tit: '💡 Arreglar las luces', j: 'interruptores', o: { n: 5 }, alListo: arreglar('luces') });
      if (sab.tipo === 'alarma') lista.push({ x: P.alarma.x, z: P.alarma.z, e: '🚨', tit: '🚨 Apagar la alarma', j: 'mantener', o: { seg: 3, emoji: '🚨', txt: 'Mantén presionado para apagarla' }, alListo: arreglar('alarma') });
      if (sab.tipo === 'oxigeno') lista.push({ x: P.teclado.x, z: P.teclado.z, e: '🧪', tit: '🧪 Restaurar el oxígeno', j: 'codigo', o: { largo: 5, cod: sab.codigo, oculto: true }, alListo: arreglar('oxigeno') });
    }
    ZooMisiones.setExtras(lista);
    $('#b-sabotaje').hidden = !activo || !soyImp() || fantasma();
  }

  // ---------- alcantarillas ----------
  $('#b-vent').addEventListener('click', () => {
    const v = ventCerca(); if (v == null || miVent != null) return;
    entrar(v);
  });
  function ventCerca() {
    const yp = S().yoPos; let m = null, d = 1.3;
    Mansion.VENTS.forEach(v => { const k = Math.hypot(v.x - yp.x, v.z - yp.z); if (k < d) { d = k; m = v.id; } });
    return m;
  }
  function entrar(id) {
    miVent = id; const v = Mansion.VENTS[id], yp = S().yoPos;
    yp.x = v.x; yp.z = v.z; S().enviarPos(true);
    S().enviar('vent', { id: miId(), v: id, en: true });
    pintarVentUI();
  }
  function moverA(id) {
    miVent = id; const v = Mansion.VENTS[id], yp = S().yoPos;
    yp.x = v.x; yp.z = v.z; S().enviarPos(true);
    S().enviar('vent', { id: miId(), v: id, en: true, mover: true });
    A.bip(300, 0.08, 'triangle', 0.04);
    pintarVentUI();
  }
  function salir() {
    if (miVent == null) return;
    const v = miVent; miVent = null;
    S().enviar('vent', { id: miId(), v, en: false });
    $('#vent-ui').classList.remove('ver');
  }
  function pintarVentUI() {
    const v = Mansion.VENTS[miVent];
    const cont = $('#vent-destinos'); cont.innerHTML = '';
    Mansion.VENTS.filter(x => x.red === v.red && x.id !== v.id).forEach(x => {
      const b = document.createElement('button'); b.className = 'btn sec'; b.textContent = '➡ ' + Mansion.AREAS[x.k].n;
      b.onclick = () => moverA(x.id); cont.appendChild(b);
    });
    $('#vent-aqui').textContent = '🕳️ Alcantarilla · ' + Mansion.AREAS[v.k].n;
    $('#vent-ui').classList.add('ver');
  }
  $('#vent-salir').addEventListener('click', salir);
  function alVent(m) {
    if (!activo) return;
    if (m.en) enVent.set(m.id, m.v); else enVent.delete(m.id);
    if (!m.mover) {
      Mansion.animarVent(m.v);
      const v = Mansion.VENTS[m.v], yp = S().yoPos;
      if (Mansion.cuartoDe(v.x, v.z) === Mansion.cuartoDe(yp.x, yp.z)) { Part.humo({ x: v.x, y: 0.4, z: v.z }); A.bip(140, 0.18, 'square', 0.05); }
    }
  }

  // ---------- cada cuadro ----------
  const proy = new T.Vector3();
  A.alCuadro.push(() => {
    if (!activo) return;
    const ahora = Date.now();
    // puertas que se vuelven a abrir
    cerradas.forEach((hasta, k) => { if (ahora > hasta) { cerradas.delete(k); Mansion.puertas(k, false); } });
    // botón de alcantarilla (impostor vivo)
    const puedeVent = soyImp() && !fantasma() && miVent == null && !(window.ZooJuego && ZooJuego.bloqueado());
    $('#b-vent').hidden = !(puedeVent && ventCerca() != null);
    // botón de sabotaje: tiempo de espera
    const bs = $('#b-sabotaje');
    if (!bs.hidden) { const falta = Math.ceil((enfriaHasta - ahora) / 1000); bs.querySelector('b').textContent = falta > 0 ? falta : ''; bs.classList.toggle('listo', falta <= 0); }
    // aviso arriba
    const ban = $('#sab-banner');
    if (sab) {
      const P = Mansion.PANELES, yp = S().yoPos;
      let txt = '';
      const seg = sab.fin ? Math.max(0, Math.ceil((sab.fin - ahora) / 1000)) : 0;
      if (sab.tipo === 'luces') txt = '💡 ¡Se fueron las luces! Arréglalas en Electricidad';
      if (sab.tipo === 'alarma') txt = `🚨 ¡ALARMA! Apágala en Seguridad · ${seg} s`;
      if (sab.tipo === 'oxigeno') {
        const veoCodigo = Math.hypot(P.codigo.x - yp.x, P.codigo.z - yp.z) < 2.6;
        txt = veoCodigo ? `🧪 CÓDIGO: ${sab.codigo} · ponlo en la Cocina · ${seg} s` : `🧪 ¡SIN OXÍGENO! Mira el código en el Invernadero y ponlo en la Cocina · ${seg} s`;
      }
      ban.textContent = txt; ban.classList.add('ver'); ban.classList.toggle('crisis', sab.tipo !== 'luces');
      // si se acaba el tiempo, gana el impostor (lo decide el anfitrión)
      if (sab.fin && ahora > sab.fin && S().soyHost() && !sab.avisado) { sab.avisado = true; S().enviar('fin', { gana: 'i', roles }); }
    } else ban.classList.remove('ver');
    // oscuridad (solo tripulantes vivos)
    const osc = $('#oscuro');
    const oscuro = sab && sab.tipo === 'luces' && !soyImp() && !fantasma();
    osc.classList.toggle('ver', !!oscuro);
    if (oscuro) {
      const yp = S().yoPos; proy.set(yp.x, 1, yp.z).project(A.camara);
      osc.style.setProperty('--x', (proy.x * 0.5 + 0.5) * innerWidth + 'px');
      osc.style.setProperty('--y', (-proy.y * 0.5 + 0.5) * innerHeight + 'px');
    }
  });

  window.ZooSabotaje = {
    iniciar, terminar,
    registrar(canal) {
      canal.on('broadcast', { event: 'sab' }, ({ payload }) => alSabotaje(payload))
        .on('broadcast', { event: 'arreglo' }, ({ payload }) => alArreglo(payload))
        .on('broadcast', { event: 'vent' }, ({ payload }) => alVent(payload));
    },
    enVent: id => enVent.has(id),
    yoEnVent: () => miVent != null,
    oscuro: () => !!(sab && sab.tipo === 'luces'),
    salirVent: salir,
    _dbg: { lanzar, entrar, get sab() { return sab; } },
  };
})();
