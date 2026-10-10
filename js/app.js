// ZOOspechosos — cuentas, menú y escena 3D (la ropa se cambia en el lobby: sala.js)
(function () {
  const SUPA_URL = 'https://kuyeziqwschacefbgjhs.supabase.co';
  const SUPA_KEY = 'sb_publishable_DAyCnLHJVHprc-QO7QOp4g_15UV8NEA';
  const DOMINIO = '@zoospechosos.app'; // el usuario solo escribe su nombre de usuario
  const sb = supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, storageKey: 'zoo-sesion' } });
  const T = THREE;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const guardado = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  let calidad = guardado('zoo-calidad', 'alta');
  let sonido = guardado('zoo-sonido', 'si');
  let sangre = guardado('zoo-sangre', 'si');

  // ================= ESCENA 3D =================
  const canvas = $('#escena');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const escena = new T.Scene();
  const camara = new T.PerspectiveCamera(40, 1, 0.1, 100);

  // ---- efectos de imagen (solo calidad alta): brillo neón + viñeta ----
  const P = window.POST; // puede faltar en celulares viejos (plan B sin efectos)
  const gl = renderer.capabilities;
  const hdr = gl.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  let composer = null, bloom = null;
  if (hdr && P) {
    composer = new P.EffectComposer(renderer, new T.WebGLRenderTarget(2, 2, { type: T.HalfFloatType, samples: 4 }));
    composer.addPass(new P.RenderPass(escena, camara));
    bloom = new P.UnrealBloomPass(new T.Vector2(256, 256), 0.7, 0.45, 1.6); // solo brilla lo que pasa de 1 (los neones)
    composer.addPass(bloom);
    composer.addPass(new P.ShaderPass({
      uniforms: { tDiffuse: { value: null }, fuerza: { value: 0.9 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float fuerza; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; c.rgb *= clamp(1.0 - dot(d, d) * fuerza, 0.0, 1.0); gl_FragColor = c; }',
    }));
    composer.addPass(new P.OutputPass());
  }
  // reflejos solo para las cosas metálicas (bolas disco)
  const pmrem = new T.PMREMGenerator(renderer);
  window.reflejos = P ? pmrem.fromScene(new P.RoomEnvironment(renderer), 0.04).texture : null;
  // material de neón: color más fuerte que 1 para que el bloom lo haga brillar
  window.neon = (hex, k) => new T.MeshBasicMaterial({ color: new T.Color(hex).multiplyScalar(k || 5) });

  // fondo degradado
  (function () {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0d0420'); gr.addColorStop(0.55, '#2a0f52'); gr.addColorStop(1, '#4a1670');
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; escena.background = tex;
  })();
  escena.fog = new T.Fog('#2a0f52', 12, 30);

  // luces
  escena.add(new T.HemisphereLight('#c9b3ff', '#2b1048', 1.4));
  const sol = new T.DirectionalLight('#ffffff', 1.6);
  sol.position.set(3, 7, 5); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  sol.shadow.bias = -0.002;
  escena.add(sol);
  const luzRosa = new T.PointLight('#ff3d9a', 18, 12); escena.add(luzRosa);
  const luzCian = new T.PointLight('#2ee6d6', 18, 12); escena.add(luzCian);

  // piso y escenario
  const piso = new T.Mesh(new T.CircleGeometry(30, 48), new T.MeshStandardMaterial({ color: '#1e0a3a', roughness: 0.9 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; escena.add(piso);
  // baldosas tipo pista de baile
  const pista = new T.Group(); escena.add(pista);
  const colsPista = ['#ff3d9a', '#8b5cff', '#2ee6d6', '#ffd93d'];
  const baldosas = [];
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 2; z++) {
    if (x * x + z * z > 18) continue;
    const m = new T.Mesh(new T.BoxGeometry(0.96, 0.05, 0.96), new T.MeshStandardMaterial({ color: '#2b1150', emissive: colsPista[(x + z + 8) % 4], emissiveIntensity: 0.15, roughness: 0.4 }));
    m.position.set(x, 0.0, z); m.receiveShadow = true; pista.add(m); baldosas.push(m);
  }
  const escenario = new T.Mesh(new T.CylinderGeometry(1.25, 1.35, 0.18, 48), new T.MeshStandardMaterial({ color: '#3a1670', roughness: 0.5 }));
  escenario.position.y = 0.09; escenario.receiveShadow = true; escena.add(escenario);
  const aro = new T.Mesh(new T.TorusGeometry(1.3, 0.035, 8, 64), neon('#2ee6d6'));
  aro.rotation.x = Math.PI / 2; aro.position.y = 0.18; escena.add(aro);

  // bola disco
  const disco = new T.Mesh(new T.IcosahedronGeometry(0.45, 1), new T.MeshStandardMaterial({ color: '#ddd', metalness: 0.9, roughness: 0.15, flatShading: true, emissive: '#3a2a66', envMap: window.reflejos }));
  disco.position.set(0, 4.3, -2); escena.add(disco);
  // haces de luz de discoteca
  const haces = ['#ff3d9a', '#2ee6d6', '#ffd93d', '#8b5cff'].map((c, i) => { const h = Part.haz(c, 7, 1.6); h.position.set(-4.5 + i * 3, 7.2, -3); escena.add(h); return h; });
  const cable = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 3), new T.MeshBasicMaterial({ color: '#555' }));
  cable.position.set(0, 6, -2); escena.add(cable);

  // confeti flotante
  const N = 160, posC = new Float32Array(N * 3), colC = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    posC[i * 3] = (Math.random() - 0.5) * 16; posC[i * 3 + 1] = Math.random() * 7; posC[i * 3 + 2] = (Math.random() - 0.7) * 12;
    const c = new T.Color(colsPista[i % 4]); colC.set([c.r, c.g, c.b], i * 3);
  }
  const geoConf = new T.BufferGeometry();
  geoConf.setAttribute('position', new T.BufferAttribute(posC, 3));
  geoConf.setAttribute('color', new T.BufferAttribute(colC, 3));
  const confeti = new T.Points(geoConf, new T.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.85 }));
  escena.add(confeti);

  function aplicarCalidad() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, calidad === 'alta' ? 2 : 1));
    renderer.shadowMap.enabled = calidad === 'alta';
    luzRosa.visible = luzCian.visible = calidad === 'alta';
    haces.forEach(h => h.visible = calidad === 'alta' && pantalla !== 'sala');
    escena.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    redimensionar();
  }
  function redimensionar() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    camara.aspect = w / h; camara.updateProjectionMatrix();
  }
  addEventListener('resize', redimensionar);

  // personajes
  let miPj = null;           // mi animal
  let invitados = [];        // animales de la pantalla de inicio
  let modoPj = 'baile';
  let giroUsuario = 0, giroVel = 0;

  function ponerMiPj(cfg) {
    if (miPj) { escena.remove(miPj); Zoo.liberar(miPj); }
    miPj = Zoo.crear(cfg);
    miPj.position.y = 0.18;
    miPj.rotation.y = giroUsuario;
    escena.add(miPj);
  }
  function crearInvitados() {
    const lista = [
      { animal: 'zorro', color: '#ff6b2c', sombrero: 'corona', gafas: 'sol', accesorio: 'capa' },
      { animal: 'conejo', color: '#f1e6ff', sombrero: 'fiesta', gafas: 'corazon', accesorio: 'corbatin' },
      { animal: 'panda', color: '#f4f4f4', sombrero: 'gorra', gafas: 'ninguno', accesorio: 'cadena' },
      { animal: 'rana', color: '#5ad16b', sombrero: 'vaquero', gafas: 'redondas', accesorio: 'bufanda' },
      { animal: 'pinguino', color: '#2d3a5a', sombrero: 'copa', gafas: 'ninguno', accesorio: 'corbatin' },
      { animal: 'perro', color: '#c8935a', sombrero: 'vikingo', gafas: 'visor', accesorio: 'mochila' },
      { animal: 'gato', color: '#7b5cff', sombrero: 'aureola', gafas: 'sol', accesorio: 'ninguno' },
    ];
    const lugares = [[0, 0.18, 0], [-1.6, 0, -0.6], [1.6, 0, -0.6], [-2.9, 0, -1.6], [2.9, 0, -1.6], [-1.0, 0, -2.4], [1.1, 0, -2.6]];
    invitados = lista.map((cfg, i) => {
      const p = Zoo.crear(cfg); p.position.set(...lugares[i]); p.rotation.y = -lugares[i][0] * 0.12; escena.add(p); return p;
    });
  }
  function quitarInvitados() { invitados.forEach(p => { escena.remove(p); Zoo.liberar(p); }); invitados = []; }

  // cámara por pantalla
  const VISTAS = {
    auth: { pos: [0, 2.6, 8.6], mira: [0, -0.3, -0.8], h: { pos: [2.7, 2.3, 7.4], mira: [2.7, 0.55, -0.8] } },
    menu: { pos: [0, 1.7, 5.4], mira: [0, 0.75, 0], h: { pos: [0, 1.45, 5.2], mira: [0, 1.08, 0] } },
    sala: { pos: [0, 5.4, 10.8], mira: [0, 0.5, -0.9] },
  };
  let vista = VISTAS.auth;
  const camPos = new T.Vector3(...VISTAS.auth.pos), camMira = new T.Vector3(...VISTAS.auth.mira);
  const tmpV = new T.Vector3();

  function ajusteVertical() { // en pantallas angostas alejamos la cámara
    const a = innerWidth / innerHeight;
    return a < 0.75 ? 1 + (0.75 - a) * 0.9 : 1;
  }

  // arrastrar para girar
  let arrastrando = false, ultimoX = 0;
  canvas.addEventListener('pointerdown', e => { if (pantalla !== 'menu') return; arrastrando = true; ultimoX = e.clientX; giroVel = 0; });
  addEventListener('pointermove', e => { if (!arrastrando) return; const dx = e.clientX - ultimoX; ultimoX = e.clientX; giroVel = dx * 0.012; giroUsuario += giroVel; });
  addEventListener('pointerup', () => arrastrando = false);

  const camLibre = { on: false };
  escena.add(Part.grupo);
  // si el celular no aguanta la calidad alta, la bajamos solos
  let fpsT = 0, fpsN = 0, fpsMalos = 0, fpsAvisado = false;
  function medirFps(dt) {
    if (calidad !== 'alta' || fpsAvisado || document.hidden) return;
    fpsT += dt; fpsN++;
    if (fpsT < 2) return;
    const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
    fpsMalos = fps < 28 ? fpsMalos + 1 : 0;
    if (fpsMalos >= 3) {
      fpsAvisado = true; calidad = 'baja'; guardar('zoo-calidad', calidad); pintarSeg('#seg-calidad', calidad); aplicarCalidad();
      toast('Bajé la calidad gráfica para que vaya más fluido ⚡');
    }
  }
  const reloj = new T.Clock();
  function bucle() {
    requestAnimationFrame(bucle);
    const dt = Math.min(reloj.getDelta(), 0.05), t = reloj.elapsedTime;
    // cámara suave
    const k = ajusteVertical();
    const v = innerWidth > innerHeight && vista.h ? vista.h : vista; // en horizontal hay otro encuadre
    tmpV.set(v.pos[0], v.pos[1] * (0.9 + 0.1 * k), v.pos[2] * k);
    camPos.lerp(tmpV, 1 - Math.pow(0.02, dt));
    camMira.lerp(tmpV.set(...v.mira), 1 - Math.pow(0.02, dt));
    if (!camLibre.on) { camara.position.copy(camPos); camara.lookAt(camMira); } // en la sala la cámara la maneja sala.js
    // luces de fiesta
    luzRosa.position.set(Math.sin(t * 0.8) * 3.5, 2.5, Math.cos(t * 0.8) * 3.5);
    luzCian.position.set(Math.sin(t * 0.8 + Math.PI) * 3.5, 2.5, Math.cos(t * 0.8 + Math.PI) * 3.5);
    disco.rotation.y += dt * 0.6;
    const fuerza = calidad === 'alta' && composer ? 0.9 : 0.35;
    baldosas.forEach((b, i) => b.material.emissiveIntensity = 0.12 + fuerza * Math.max(0, Math.sin(t * 2.5 + i * 1.7)));
    haces.forEach((h, i) => { h.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.45; h.rotation.x = 0.25 + Math.cos(t * 0.5 + i) * 0.25; });
    aro.material.color.setHSL((t * 0.08) % 1, 0.9, 0.6).multiplyScalar(5);
    const p = geoConf.attributes.position;
    for (let i = 0; i < N; i++) { let y = p.getY(i) - dt * (0.25 + (i % 5) * 0.06); if (y < 0) y = 7; p.setY(i, y); }
    p.needsUpdate = true;
    // personajes
    invitados.forEach(pj => Zoo.animar(pj, dt, 'baile'));
    alCuadro.forEach(f => f(dt, t));
    if (miPj) {
      if (!arrastrando) { giroVel *= 0.93; giroUsuario += giroVel; if (pantalla === 'menu' && Math.abs(giroVel) < 0.002) giroUsuario += (0 - giroUsuario) * dt * 1.5; }
      miPj.rotation.y = giroUsuario;
      Zoo.animar(miPj, dt, modoPj);
    }
    Part.actualizar(dt);
    if (calidad === 'alta' && composer) composer.render(); else renderer.render(escena, camara);
    medirFps(dt);
  }

  // ================= SONIDO =================
  let audio = null;
  function bip(f = 660, d = 0.08, tipo = 'triangle', vol = 0.06) {
    if (sonido !== 'si') return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo; o.frequency.value = f; o.frequency.exponentialRampToValueAtTime(f * 1.5, audio.currentTime + d);
      g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + d);
    } catch (e) { }
  }
  document.addEventListener('click', e => { if (e.target.closest('button')) bip(); });

  // ================= UI =================
  let pantalla = 'carga';
  function ir(nombre) {
    pantalla = nombre;
    $$('.pantalla').forEach(p => p.classList.toggle('activa', p.id === 'p-' + nombre));
    vista = VISTAS[nombre] || vista;
    modoPj = 'baile';
    if (nombre === 'auth') { if (!invitados.length) crearInvitados(); if (miPj) { escena.remove(miPj); miPj = null; } }
    else quitarInvitados();
    if (nombre === 'sala' && miPj) { escena.remove(miPj); Zoo.liberar(miPj); miPj = null; }
    if (nombre === 'menu' && perfil) { if (!miPj) ponerMiPj(perfil); pintarPerfil(); } // la ropa pudo cambiar en el lobby
    [piso, pista, escenario, aro, disco, cable, confeti].forEach(o => o.visible = nombre !== 'sala');
    haces.forEach(h => h.visible = calidad === 'alta' && nombre !== 'sala');
    camLibre.on = nombre === 'sala';
  }
  function toast(txt, ms = 2600) {
    const t = $('#toast'); t.textContent = txt; t.classList.add('ver');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('ver'), ms);
  }
  function abrir(id) { $(id).classList.add('activa'); }
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('.cerrar')) m.classList.remove('activa'); }));

  // ================= CUENTAS =================
  let perfil = null;

  $$('.pestana').forEach(b => b.onclick = () => {
    $$('.pestana').forEach(x => x.classList.toggle('activa', x === b));
    $('#f-entrar').classList.toggle('activa', b.dataset.tab === 'entrar');
    $('#f-registro').classList.toggle('activa', b.dataset.tab === 'registro');
    msg('');
  });
  function msg(t, tipo) { const m = $('#auth-msg'); m.textContent = t; m.className = 'msg ' + (tipo || ''); }
  function errorBonito(e) {
    const s = (e && (e.message || e.error_description || e)) + '';
    if (/invalid login/i.test(s)) return 'Usuario o contraseña incorrectos.';
    if (/already registered|already exists/i.test(s)) return 'Ese usuario ya existe. Prueba otro.';
    if (/email not confirmed/i.test(s)) return 'La cuenta aún no está activada (falta desactivar "Confirm email" en Supabase).';
    if (/password/i.test(s)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/rate limit|too many/i.test(s)) return 'Demasiados intentos. Espera un momento.';
    if (/fetch|network/i.test(s)) return 'Sin conexión. Revisa tu internet.';
    return 'Ups: ' + s;
  }
  const limpiarUsuario = u => (u || '').trim().toLowerCase();

  $('#f-entrar').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    const u = limpiarUsuario(f.usuario.value);
    btn.disabled = true; msg('Entrando…');
    const { error } = await sb.auth.signInWithPassword({ email: u + DOMINIO, password: f.clave.value });
    btn.disabled = false;
    if (error) return msg(errorBonito(error), 'error');
    msg('');
    await despuesDeEntrar();
  };

  $('#f-registro').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    const u = limpiarUsuario(f.usuario.value), apodo = f.apodo.value.trim();
    if (!/^[a-z0-9_]{3,16}$/.test(u)) return msg('El usuario solo puede tener letras, números y _ (3 a 16).', 'error');
    if (f.clave.value !== f.clave2.value) return msg('Las contraseñas no coinciden.', 'error');
    btn.disabled = true; msg('Creando tu cuenta…');
    try {
      const { data: libre, error: e1 } = await sb.rpc('zoo_usuario_libre', { u });
      if (e1) throw e1;
      if (!libre) throw new Error('already exists');
      const { data, error } = await sb.auth.signUp({ email: u + DOMINIO, password: f.clave.value, options: { data: { app: 'zoospechosos', usuario: u, apodo } } });
      if (error) throw error;
      if (!data.session) throw new Error('email not confirmed');
      const animal = Zoo.ANIMALES[Math.floor(Math.random() * Zoo.ANIMALES.length)];
      const { error: e2 } = await sb.from('zoo_perfiles').insert({ id: data.user.id, usuario: u, apodo, animal: animal.id, color: animal.color });
      if (e2) throw e2;
      msg('');
      toast('¡Bienvenido a ZOOspechosos, ' + apodo + '! 🎉');
      await despuesDeEntrar();
    } catch (err) { msg(errorBonito(err), 'error'); }
    btn.disabled = false;
  };

  async function despuesDeEntrar() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return ir('auth');
    let { data, error } = await sb.from('zoo_perfiles').select('*').eq('id', user.id).maybeSingle();
    if (!data && !error) { // por si el registro se cortó a la mitad
      const md = user.user_metadata || {};
      const u = md.usuario || (user.email || '').split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'jugador';
      ({ data, error } = await sb.from('zoo_perfiles').insert({ id: user.id, usuario: u, apodo: md.apodo || u, animal: 'gato', color: '#ff9f43' }).select().single());
    }
    if (error || !data) { toast('No pude cargar tu perfil 😕'); return ir('auth'); }
    perfil = data;
    pintarPerfil();
    ponerMiPj(perfil);
    ir('menu');
    if (window.ZooSala) ZooSala.alEntrar();
  }

  function pintarPerfil() {
    $('#m-apodo').textContent = perfil.apodo;
    $('#m-usuario').textContent = '@' + perfil.usuario;
    $('#m-monedas').textContent = perfil.monedas;
    $('#m-avatar').textContent = (Zoo.ANIMALES.find(a => a.id === perfil.animal) || {}).emoji || '🐾';
    $('#s-partidas').textContent = perfil.partidas;
    $('#s-victorias').textContent = perfil.victorias;
    $('#s-porc').textContent = perfil.partidas ? Math.round(perfil.victorias / perfil.partidas * 100) + '%' : '—';
  }

  // ================= MENÚ =================
  $('#b-jugar').onclick = () => abrir('#m-jugar');
  $('#b-perfil').onclick = () => { $('#i-apodo').value = perfil.apodo; abrir('#m-perfil'); };
  $('#b-ajustes').onclick = () => abrir('#m-ajustes');
  $('#i-codigo').oninput = e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  $('#b-apodo').onclick = async () => {
    const ap = $('#i-apodo').value.trim();
    if (ap.length < 2) return toast('El apodo debe tener al menos 2 letras');
    const { error } = await sb.from('zoo_perfiles').update({ apodo: ap, actualizado: new Date().toISOString() }).eq('id', perfil.id);
    if (error) return toast(errorBonito(error));
    perfil.apodo = ap; pintarPerfil(); toast('Apodo cambiado ✅');
  };
  $('#b-salir').onclick = async () => { await sb.auth.signOut(); perfil = null; $('#m-ajustes').classList.remove('activa'); ir('auth'); };

  function pintarSeg(id, val) { $$(id + ' button').forEach(b => b.classList.toggle('activa', b.dataset.v === val)); }
  pintarSeg('#seg-calidad', calidad); pintarSeg('#seg-sonido', sonido); pintarSeg('#seg-sangre', sangre);
  $$('#seg-sangre button').forEach(b => b.onclick = () => { sangre = b.dataset.v; guardar('zoo-sangre', sangre); pintarSeg('#seg-sangre', sangre); });
  $$('#seg-calidad button').forEach(b => b.onclick = () => { calidad = b.dataset.v; guardar('zoo-calidad', calidad); pintarSeg('#seg-calidad', calidad); aplicarCalidad(); });
  $$('#seg-sonido button').forEach(b => b.onclick = () => { sonido = b.dataset.v; guardar('zoo-sonido', sonido); pintarSeg('#seg-sonido', sonido); });

  // lo que necesitan los otros módulos (sala.js, juego…)
  const alCuadro = [];
  $('#version').textContent = window.ZOO_VERSION || '?';
  console.log('ZOOspechosos versión', window.ZOO_VERSION);
  window.ZooApp = {
    sb, escena, camara, renderer, sol, ir, toast, bip, abrir, errorBonito, alCuadro,
    get perfil() { return perfil; },
    get pantalla() { return pantalla; },
    get calidad() { return calidad; },
    get sangre() { return sangre; },
    get sonido() { return sonido; },
  };

  // ================= INICIO =================
  aplicarCalidad();
  bucle();
  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    setTimeout(async () => {
      $('#carga').classList.remove('activa');
      if (location.hash === '#demo') { // vista previa sin cuenta (para pruebas)
        perfil = { id: 'demo', usuario: 'demo', apodo: 'Invitado', animal: 'zorro', color: '#ff6b2c', sombrero: 'corona', gafas: 'sol', accesorio: 'capa', monedas: 100, partidas: 0, victorias: 0 };
        pintarPerfil(); ponerMiPj(perfil); return ir('menu');
      }
      if (session) await despuesDeEntrar(); else ir('auth');
    }, 600);
  })();
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && pantalla !== 'auth') ir('auth'); });
})();
