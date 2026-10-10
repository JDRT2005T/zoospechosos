// ZOOspechosos — Mapa "Mansión Fiesta" (grande, tipo laberinto)
// El mapa se dibuja con letras: cada letra es una celda de 2×2 m.
//   MAYÚSCULA = cuarto · minúscula = pasillo · '+' = puerta · '.' = nada (pared)
// La cámara mira desde el sur (+z).
(function () {
  const T = THREE;
  const PLANO = [
    'OOOOOOO.nn.BBBBBBBBBBBBBBB...nn.LLLLLLLL',
    'OOOOOOO.nn.BBBBBBBBBBBBBBB...nn.LLLLLLLL',
    'OOOOOOO+nn+BBBBBBBBBBBBBBB...nn+LLLLLLLL',
    'OOOOOOO.nn.BBBBBBBBBBBBBBB...nn.LLLLLLLL',
    'OOOOOOO.nn.BBBBBBBBBBBBBBB...nn.LLLLLLLL',
    'nn+nn+nnnnnnnnn+n++nn+nnnnnnnnnnnnn+nnnn',
    'CCCCCCC.DDDDDD.cc.AAAAAAA.GGGG.HHHHHHHHH',
    'CCCCCCC.DDDDDD.cc.AAAAAAA.GGGG.HHHHHHHHH',
    'CCCCCCC.DDDDDD+cc.AAAAAAA+GGGG.HHHHHHHHH',
    'CCCCCCC+DDDDDD.cc.AAAAAAA.GGGG.HHHHHHHHH',
    'CCCCCCC.DDDDDD.cc+AAAAAAA.GGGG+HHHHHHHHH',
    'CCCCCCC.DDDDDD.cc.AAAAAAA.GGGG.HHHHHHHHH',
    'mmm+mmmmmm+mmmm+mm++mmmmmm++mmmmm++mmmmm',
    'PPPPPPPP.EEEE.VVVVVVVVVV.WWW.TTTTTTTTTTT',
    'PPPPPPPP.EEEE.VVVVVVVVVV.WWW.TTTTTTTTTTT',
    'PPPPPPPP.EEEE+VVVVVVVVVV.WWW.TTTTTTTTTTT',
    'PPPPPPPP.EEEE.VVVVVVVVVV.WWW+TTTTTTTTTTT',
    'PPPPPPPP.EEEE.VVVVVVVVVV.WWW.TTTTTTTTTTT',
    'PPPPPPPP.EEEE.VVVVVVVVVV.WWW.TTTTTTTTTTT',
    'sssss+ss+sssssss+ssss+s+ssssssssss+s+sss',
    'JJJJJJJJJJJJJJJJJ.SSSSSSSSSSS.IIIIIIIIII',
    'JJJJJJJJJJJJJJJJJ.SSSSSSSSSSS.IIIIIIIIII',
    'JJJJJJJJJJJJJJJJJ.SSSSSSSSSSS+IIIIIIIIII',
    'JJJJJJJJJJJJJJJJJ+SSSSSSSSSSS.IIIIIIIIII',
    'JJJJJJJJJJJJJJJJJ.SSSSSSSSSSS.IIIIIIIIII',
    'JJJJJJJJJJJJJJJJJ.SSSSSSSSSSS.IIIIIIIIII',
  ];
  const AREAS = {
    O: { n: 'Invernadero', c: ['#bfe8c4', '#a9dcb0'] }, B: { n: 'Salón de baile', c: ['#2b1150', '#3a1670'] },
    L: { n: 'Biblioteca', c: ['#6b4423', '#5a3a1e'] }, C: { n: 'Cocina', c: ['#e9e2d0', '#cfc4aa'] },
    D: { n: 'Comedor', c: ['#8a5a44', '#7a4e3a'] }, A: { n: 'Sala de juegos', c: ['#1d2b6b', '#25357f'] },
    G: { n: 'Seguridad', c: ['#3a4250', '#323946'] }, H: { n: 'Dormitorio', c: ['#3b5bdb', '#3451c4'] },
    P: { n: 'Piscina', c: ['#bfeaf2', '#a6dbe6'] }, E: { n: 'Electricidad', c: ['#4a4a3a', '#3e3e30'] },
    V: { n: 'Vestíbulo', c: ['#f2e9ff', '#d8c8f2'] }, W: { n: 'Baño', c: ['#e8f4ff', '#cfe6fb'] },
    T: { n: 'Garaje', c: ['#6e6e78', '#62626b'] }, J: { n: 'Jardín', c: ['#4caf50', '#43a047'] },
    S: { n: 'Sótano', c: ['#5b4636', '#4f3c2e'] }, I: { n: 'Gimnasio', c: ['#d94848', '#c43d3d'] },
    n: { n: 'Pasillo Norte', c: ['#8a1c3a', '#7a1733'] }, c: { n: 'Pasillo Central', c: ['#8a1c3a', '#7a1733'] },
    m: { n: 'Pasillo del Medio', c: ['#8a1c3a', '#7a1733'] }, s: { n: 'Pasillo Sur', c: ['#8a1c3a', '#7a1733'] },
  };
  const CS = 2, FIL = PLANO.length, COL = PLANO[0].length;
  const MX = COL * CS / 2, MZ = FIL * CS / 2;
  const ALTO = 2.4, PUERTA = CS;
  const grupo = new T.Group(); grupo.visible = false;
  const cajas = [];
  const animados = [];
  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o || {}));
  const neon = (c, k) => window.neon(c, k || 5);

  // ---------- la cuadrícula ----------
  const cx = col => col * CS + CS / 2 - MX, cz = fil => fil * CS + CS / 2 - MZ;
  const letra = (f, c) => (f < 0 || c < 0 || f >= FIL || c >= COL) ? '.' : PLANO[f][c];
  const esPiso = ch => ch !== '.';
  const esPasillo = ch => ch >= 'a' && ch <= 'z';
  // a qué zona pertenece cada celda (las puertas son del pasillo de al lado, o del cuarto si une dos cuartos)
  const zona = [];
  for (let f = 0; f < FIL; f++) {
    zona.push([]);
    for (let c = 0; c < COL; c++) {
      let ch = letra(f, c);
      if (ch === '+') {
        const vec = [letra(f - 1, c), letra(f + 1, c), letra(f, c - 1), letra(f, c + 1)].filter(x => x !== '.' && x !== '+');
        ch = vec.find(esPasillo) || vec[0] || '.';
      }
      zona[f].push(ch);
    }
  }
  const celdaDe = (x, z) => ({ c: Math.floor((x + MX) / CS), f: Math.floor((z + MZ) / CS) });
  function zonaDe(x, z) { const { c, f } = celdaDe(x, z); return (f < 0 || c < 0 || f >= FIL || c >= COL) ? '.' : zona[f][c]; }
  function cuartoDe(x, z) { const k = zonaDe(x, z); return AREAS[k] ? AREAS[k].n : ''; }
  // rectángulo de cada cuarto (en metros)
  const RECT = {};
  for (let f = 0; f < FIL; f++) for (let c = 0; c < COL; c++) {
    const k = PLANO[f][c]; if (!AREAS[k]) continue;
    const r = RECT[k] || (RECT[k] = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 });
    r.x0 = Math.min(r.x0, c * CS - MX); r.x1 = Math.max(r.x1, (c + 1) * CS - MX);
    r.z0 = Math.min(r.z0, f * CS - MZ); r.z1 = Math.max(r.z1, (f + 1) * CS - MZ);
  }
  Object.values(RECT).forEach(r => { r.cx = (r.x0 + r.x1) / 2; r.cz = (r.z0 + r.z1) / 2; r.w = r.x1 - r.x0; r.d = r.z1 - r.z0; });

  // ---------- ayudantes ----------
  function caja(w, h, d, mat, x, y, z, choca) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grupo.add(m);
    if (choca) cajas.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    return m;
  }
  function cilindro(r, h, mat, x, y, z, choca, seg) {
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, seg || 20), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grupo.add(m);
    if (choca) cajas.push([x - r, z - r, x + r, z + r]);
    return m;
  }
  function lienzo(w, h, dibujar) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    dibujar(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // ---------- pisos (una tira por fila de cada zona) ----------
  const texPisos = {};
  function texPiso(k) {
    if (texPisos[k]) return texPisos[k];
    const [c1, c2] = AREAS[k].c;
    const t = lienzo(64, 64, g => { g.fillStyle = c1; g.fillRect(0, 0, 64, 64); g.fillStyle = c2; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); });
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return texPisos[k] = t;
  }
  for (let f = 0; f < FIL; f++) {
    let c = 0;
    while (c < COL) {
      const k = zona[f][c];
      if (!AREAS[k]) { c++; continue; }
      let fin = c; while (fin + 1 < COL && zona[f][fin + 1] === k) fin++;
      const n = fin - c + 1;
      const tex = texPiso(k).clone(); tex.needsUpdate = true; tex.repeat.set(n, 1);
      const m = new T.Mesh(new T.PlaneGeometry(n * CS, CS), new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      m.rotation.x = -Math.PI / 2; m.position.set(c * CS - MX + n * CS / 2, 0, cz(f)); m.receiveShadow = true; grupo.add(m);
      c = fin + 1;
    }
  }
  const fuera = new T.Mesh(new T.PlaneGeometry(260, 260), std('#0d0420', { roughness: 1 }));
  fuera.rotation.x = -Math.PI / 2; fuera.position.y = -0.03; grupo.add(fuera);
  // nombre de cada cuarto en el piso
  Object.entries(RECT).forEach(([k, r]) => {
    if (esPasillo(k)) return;
    const tex = lienzo(512, 128, g => { g.font = '900 64px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.22)'; g.fillText(AREAS[k].n.toUpperCase(), 256, 68); });
    const w = Math.min(r.w - 1, 6);
    const m = new T.Mesh(new T.PlaneGeometry(w, w / 4), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(r.cx, 0.02, r.z1 - 1.1); grupo.add(m);
  });

  // ---------- paredes ----------
  // hay pared entre dos celdas si: una es vacío, o son zonas distintas (y ninguna es puerta)
  function hayPared(a, b) {
    if (!esPiso(a) && !esPiso(b)) return false;
    if (!esPiso(a) || !esPiso(b)) return true;
    if (a === '+' || b === '+') return false;
    return a !== b;
  }
  const matPared = std('#4a2380', { roughness: 0.85 });
  const frentes = []; // paredes a lo largo de x: se vuelven transparentes si te tapan
  for (let f = 0; f <= FIL; f++) { // paredes horizontales (borde entre fila f-1 y f)
    let c = 0;
    while (c < COL) {
      if (!hayPared(letra(f - 1, c), letra(f, c))) { c++; continue; }
      let fin = c; while (fin + 1 < COL && hayPared(letra(f - 1, fin + 1), letra(f, fin + 1))) fin++;
      const x0 = c * CS - MX, x1 = (fin + 1) * CS - MX, z = f * CS - MZ, ancho = x1 - x0 + 0.3;
      const fondo = f === 0; // la pared del fondo del mapa nunca tapa a nadie
      const mat = fondo ? matPared : std('#5b2d99', { roughness: 0.85, transparent: true });
      const m = caja(ancho, ALTO, 0.3, mat, (x0 + x1) / 2, ALTO / 2, z, true);
      caja(ancho, 0.05, 0.32, neon(fondo ? '#2ee6d6' : '#ff3d9a', 4), (x0 + x1) / 2, ALTO + 0.02, z, false);
      if (!fondo) frentes.push({ m, z, x0, x1, op: 1 });
      c = fin + 1;
    }
  }
  for (let c = 0; c <= COL; c++) { // paredes verticales (borde entre columna c-1 y c)
    let f = 0;
    while (f < FIL) {
      if (!hayPared(letra(f, c - 1), letra(f, c))) { f++; continue; }
      let fin = f; while (fin + 1 < FIL && hayPared(letra(fin + 1, c - 1), letra(fin + 1, c))) fin++;
      const z0 = f * CS - MZ, z1 = (fin + 1) * CS - MZ, x = c * CS - MX;
      caja(0.3, ALTO, z1 - z0, matPared, x, ALTO / 2, (z0 + z1) / 2, true);
      caja(0.32, 0.05, z1 - z0, neon('#2ee6d6', 4), x, ALTO + 0.02, (z0 + z1) / 2, false);
      f = fin + 1;
    }
  }
  // marcos de neón y tapetes en las puertas
  let texTapete = null;
  const marcoMat = neon('#5effa0', 4);
  function marco(x, z, giro) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = giro ? Math.PI / 2 : 0; grupo.add(g);
    [-PUERTA / 2, PUERTA / 2].forEach(dx => { const p = new T.Mesh(new T.BoxGeometry(0.14, ALTO, 0.36), marcoMat); p.position.set(dx, ALTO / 2, 0); g.add(p); });
    const arco = new T.Mesh(new T.BoxGeometry(PUERTA + 0.14, 0.14, 0.36), marcoMat); arco.position.y = ALTO; g.add(arco);
  }
  for (let f = 0; f < FIL; f++) for (let c = 0; c < COL; c++) {
    if (PLANO[f][c] !== '+') continue;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([df, dc]) => { // marco en cada lado donde la puerta da a otra zona
      const v = letra(f + df, c + dc);
      if (!esPiso(v) || v === '+' || v === zona[f][c]) return;
      if (df) marco(cx(c), (f + (df > 0 ? 1 : 0)) * CS - MZ, 0);
      else marco((c + (dc > 0 ? 1 : 0)) * CS - MX, cz(f), 1);
    });
    if (!texTapete) texTapete = lienzo(128, 128, (g) => {
      g.fillStyle = 'rgba(20,60,40,.85)'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#5effa0'; g.lineWidth = 8; g.strokeRect(6, 6, 116, 116);
      g.fillStyle = '#5effa0'; g.font = '900 54px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚪', 64, 68);
    });
    const tap = new T.Mesh(new T.PlaneGeometry(CS - 0.3, CS - 0.3), new T.MeshBasicMaterial({ map: texTapete, transparent: true, color: new T.Color(1.4, 1.4, 1.4), depthWrite: false }));
    tap.rotation.x = -Math.PI / 2; tap.position.set(cx(c), 0.025, cz(f)); grupo.add(tap);
  }

  // ---------- muebles de cada cuarto ----------
  const R = RECT;
  (function (r) { // INVERNADERO (aquí estará el oxígeno)
    [-3.5, 0, 3.5].forEach(dx => {
      caja(1.0, 0.6, 4.2, std('#8b5a3c'), r.cx + dx, 0.3, r.cz - 0.3, true);
      for (let i = 0; i < 4; i++) { const h = new T.Mesh(new T.ConeGeometry(0.28, 0.8, 5), std('#2fbf71', { flatShading: true })); h.position.set(r.cx + dx, 1.0, r.cz - 1.8 + i * 1.0); grupo.add(h); }
    });
    cilindro(0.5, 1.8, std('#7fd3ff', { metalness: 0.5, roughness: 0.3, emissive: '#0a3a5a' }), r.x0 + 1.2, 0.9, r.z0 + 1.2, true);
  })(R.O);
  (function (r) { // SALÓN DE BAILE
    const baldosas = [];
    for (let x = -8; x <= 8; x += 2) for (let z = -2; z <= 2; z += 2) {
      const b = new T.Mesh(new T.BoxGeometry(1.9, 0.04, 1.9), std('#2b1150', { emissive: ['#ff3d9a', '#8b5cff', '#2ee6d6', '#ffd93d'][((x + z) / 2 + 40) % 4], emissiveIntensity: 0.4, roughness: 0.3 }));
      b.position.set(r.cx + x, 0.02, r.cz + z + 0.5); b.receiveShadow = true; grupo.add(b); baldosas.push(b);
    }
    animados.push(t => baldosas.forEach((b, i) => b.material.emissiveIntensity = 0.15 + 0.9 * Math.max(0, Math.sin(t * 2.5 + i * 1.3))));
    caja(4, 1.0, 1.0, std('#14091f'), r.cx, 0.5, r.z0 + 0.9, true);
    const frente = caja(3.9, 0.12, 0.02, neon('#2ee6d6'), r.cx, 0.75, r.z0 + 1.41, false);
    animados.push(t => frente.material.color.setHSL((t * 0.1) % 1, 0.9, 0.55).multiplyScalar(5));
    [-3, 3].forEach(dx => caja(0.9, 1.7, 0.8, std('#14091f'), r.cx + dx, 0.85, r.z0 + 0.8, true));
  })(R.B);
  (function (r) { // BIBLIOTECA
    const texLibros = lienzo(256, 128, g => {
      g.fillStyle = '#3b2414'; g.fillRect(0, 0, 256, 128);
      for (let f = 0; f < 3; f++) for (let x = 4; x < 252;) { const w = 6 + Math.random() * 10; g.fillStyle = ['#e63946', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8b5cff'][Math.floor(Math.random() * 6)]; g.fillRect(x, f * 42 + 6, w - 1, 34); x += w; }
    });
    const libros = new T.MeshStandardMaterial({ map: texLibros, roughness: 0.8 });
    [-4.5, 0, 4.5].forEach(dx => caja(3.6, 2.2, 0.6, libros, r.cx + dx, 1.1, r.z0 + 0.5, true));
    [-3, 3].forEach(dx => caja(0.6, 2.0, 3.0, libros, r.cx + dx, 1.0, r.cz + 1.2, true));
    caja(2.4, 0.8, 1.4, std('#8b5a3c'), r.cx, 0.4, r.cz + 1.2, true);
    const globo = new T.Mesh(new T.SphereGeometry(0.4, 20, 16), std('#2a9d8f')); globo.position.set(r.x1 - 1.4, 1.3, r.z1 - 1.6); grupo.add(globo);
    cilindro(0.06, 0.9, std('#c9a227'), r.x1 - 1.4, 0.45, r.z1 - 1.6, true);
    animados.push((t, dt) => globo.rotation.y += dt * 0.5);
  })(R.L);
  (function (r) { // COCINA
    caja(0.9, 1.0, 6, std('#ffffff', { roughness: 0.4 }), r.x0 + 0.6, 0.5, r.cz + 1, true);
    caja(0.95, 0.08, 6, std('#2f2f3a', { roughness: 0.3 }), r.x0 + 0.6, 1.04, r.cz + 1, false);
    caja(1.2, 2.1, 0.9, std('#d9dde6', { metalness: 0.5, roughness: 0.3 }), r.x0 + 0.8, 1.05, r.z1 - 0.7, true);
    const fogon = caja(0.7, 0.06, 1.6, neon('#ff4d2e', 2), r.x0 + 0.6, 1.09, r.cz - 0.6, false);
    animados.push(t => fogon.material.color.setRGB(2 + Math.sin(t * 6) * 0.4, 0.4, 0.1));
    caja(3.6, 1.0, 1.6, std('#c8935a'), r.cx + 0.8, 0.5, r.cz, true);
    ['#ff4d6d', '#ffd93d', '#5ad16b'].forEach((c, i) => cilindro(0.18, 0.2, std(c), r.cx - 0.4 + i * 1.2, 1.1, r.cz, false));
  })(R.C);
  (function (r) { // COMEDOR
    caja(1.6, 0.8, 6, std('#6b3f2a'), r.cx, 0.4, r.cz, true);
    caja(1.7, 0.05, 6.1, std('#fff8e7'), r.cx, 0.82, r.cz, false);
    for (let i = 0; i < 4; i++) [-1.3, 1.3].forEach(dx => caja(0.5, 0.9, 0.5, std('#8b5a3c'), r.cx + dx, 0.45, r.cz - 2.2 + i * 1.45, false));
    [-2, 0, 2].forEach(dz => { cilindro(0.06, 0.4, std('#ffd93d'), r.cx, 1.0, r.cz + dz, false); const l = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), neon('#ffb347', 4)); l.position.set(r.cx, 1.25, r.cz + dz); grupo.add(l); });
  })(R.D);
  (function (r) { // SALA DE JUEGOS
    [-3, -1.5, 0].forEach((dx, i) => {
      caja(0.9, 1.9, 0.8, std(['#ff3d9a', '#2ee6d6', '#ffd93d'][i]), r.cx + dx, 0.95, r.z0 + 0.6, true);
      const p = caja(0.6, 0.6, 0.04, neon('#2ee6d6', 2), r.cx + dx, 1.35, r.z0 + 1.02, false);
      animados.push(t => p.material.color.setHSL((t * 0.3 + i * 0.3) % 1, 0.9, 0.6).multiplyScalar(2));
    });
    caja(2.6, 0.8, 1.5, std('#0b6b3a'), r.cx + 0.5, 0.4, r.cz + 1.5, true);
    caja(2.8, 0.1, 1.7, std('#5a3a1e'), r.cx + 0.5, 0.82, r.cz + 1.5, false);
  })(R.A);
  (function (r) { // SEGURIDAD
    caja(3.2, 0.8, 1.0, std('#2a2f3a'), r.cx, 0.4, r.z0 + 1.2, true);
    [-1, 0, 1].forEach(dx => { const pa = caja(0.9, 0.6, 0.06, neon('#5effa0', 1.6), r.cx + dx, 1.25, r.z0 + 0.9, false); animados.push(t => pa.material.color.setRGB(0.3, 1.2 + Math.sin(t * 3 + dx) * 0.4, 0.5)); });
    caja(0.6, 0.9, 0.6, std('#111'), r.cx, 0.45, r.z0 + 2.3, false);
  })(R.G);
  (function (r) { // DORMITORIO
    [-3.5, 0.5].forEach((dx, i) => {
      const x = r.cx + dx;
      caja(2.0, 0.6, 3.0, std('#ffffff'), x, 0.3, r.cz, true);
      caja(2.0, 0.25, 2.0, std(i ? '#2ed3c6' : '#ff7eb6'), x, 0.72, r.cz + 0.5, false);
      caja(1.4, 0.25, 0.6, std('#ffffff'), x, 0.72, r.cz - 1.1, false);
      caja(2.1, 1.2, 0.2, std('#8b5a3c'), x, 0.6, r.cz - 1.6, false);
    });
    caja(0.8, 2.2, 2.6, std('#8b5a3c'), r.x1 - 0.6, 1.1, r.cz, true);
    cilindro(0.25, 0.4, new T.MeshStandardMaterial({ color: '#ffe7a0', emissive: '#ffd93d', emissiveIntensity: 2 }), r.cx - 1.5, 1.2, r.cz - 1.4, false);
  })(R.H);
  (function (r) { // PISCINA
    const agua = new T.Mesh(new T.PlaneGeometry(9, 5.5), new T.MeshStandardMaterial({ color: '#2ec4f0', emissive: '#0a6f9e', emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 }));
    agua.rotation.x = -Math.PI / 2; agua.position.set(r.cx, 0.05, r.cz); grupo.add(agua);
    caja(9.6, 0.2, 0.3, std('#ffffff'), r.cx, 0.1, r.cz - 2.9, false); caja(9.6, 0.2, 0.3, std('#ffffff'), r.cx, 0.1, r.cz + 2.9, false);
    caja(0.3, 0.2, 6.1, std('#ffffff'), r.cx - 4.65, 0.1, r.cz, false); caja(0.3, 0.2, 6.1, std('#ffffff'), r.cx + 4.65, 0.1, r.cz, false);
    cajas.push([r.cx - 4.8, r.cz - 3.05, r.cx + 4.8, r.cz + 3.05]);
    animados.push(t => agua.material.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.15);
    const flot = new T.Mesh(new T.TorusGeometry(0.45, 0.16, 10, 24), std('#ff4d6d')); flot.rotation.x = Math.PI / 2; flot.position.set(r.cx, 0.15, r.cz); grupo.add(flot);
    animados.push(t => { flot.position.x = r.cx + Math.sin(t * 0.4) * 3; flot.position.y = 0.15 + Math.sin(t * 2) * 0.04; });
  })(R.P);
  (function (r) { // ELECTRICIDAD (aquí se arreglan las luces)
    for (let i = 0; i < 4; i++) {
      caja(0.6, 1.9, 1.3, std('#9aa5b1', { metalness: 0.6, roughness: 0.4 }), r.x0 + 0.5, 0.95, r.z0 + 2 + i * 2.2, true);
      const led = caja(0.04, 0.12, 0.12, neon(i % 2 ? '#ff2e2e' : '#5effa0', 3), r.x0 + 0.82, 1.5, r.z0 + 2 + i * 2.2, false);
      animados.push(t => led.visible = Math.sin(t * (3 + i) + i) > -0.3);
    }
    const cables = new T.Mesh(new T.TorusGeometry(0.6, 0.06, 6, 20), std('#222')); cables.rotation.x = Math.PI / 2; cables.position.set(r.cx + 1, 0.06, r.cz); grupo.add(cables);
  })(R.E);
  (function (r) { // VESTÍBULO (aquí empieza la partida)
    cilindro(1.1, 0.75, std('#ffffff', { roughness: 0.4 }), r.cx, 0.375, r.cz, true, 32);
    const boton = cilindro(0.3, 0.12, neon('#ff2e2e', 3), r.cx, 0.81, r.cz, false);
    animados.push(t => boton.material.color.setRGB(2.4 + Math.sin(t * 4) * 0.6, 0.2, 0.2));
    [-6.5, 6.5].forEach(dx => caja(1.0, 0.8, 2.6, std('#8b5cff'), r.cx + dx, 0.4, r.cz + 1, true));
  })(R.V);
  (function (r) { // BAÑO
    caja(1.0, 0.5, 2.2, std('#ffffff'), r.cx + 1.4, 0.25, r.z1 - 1.8, true);
    caja(0.8, 0.02, 2.0, std('#7fd3ff', { emissive: '#1a6f9e' }), r.cx + 1.4, 0.5, r.z1 - 1.8, false);
    cilindro(0.3, 0.45, std('#ffffff'), r.cx - 1.6, 0.22, r.cz + 1, true);
    caja(0.6, 0.6, 0.25, std('#ffffff'), r.cx - 1.6, 0.6, r.cz + 1.35, false);
    caja(0.9, 0.9, 0.5, std('#e8f4ff'), r.cx - 1.6, 0.45, r.z0 + 1.0, true);
  })(R.W);
  (function (r) { // GARAJE
    const carro = new T.Group(); carro.position.set(r.cx, 0, r.cz); grupo.add(carro);
    const cuerpo = new T.Mesh(new T.BoxGeometry(4.2, 0.8, 2.0), std('#e63946', { metalness: 0.4, roughness: 0.3 })); cuerpo.position.y = 0.7; cuerpo.castShadow = true; carro.add(cuerpo);
    const cab = new T.Mesh(new T.BoxGeometry(2.2, 0.7, 1.8), std('#9ad1ff', { metalness: 0.3, roughness: 0.1 })); cab.position.set(-0.2, 1.4, 0); carro.add(cab);
    [[-1.4, 1], [1.4, 1], [-1.4, -1], [1.4, -1]].forEach(([x, z]) => { const w = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.3, 16), std('#111')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.4, z); carro.add(w); });
    cajas.push([r.cx - 2.2, r.cz - 1.1, r.cx + 2.2, r.cz + 1.1]);
    caja(1.6, 1.0, 0.6, std('#ffb703'), r.x1 - 1.2, 0.5, r.z0 + 0.6, true);
    [0, 1, 2].forEach(i => caja(0.6, 0.3, 0.6, std('#555'), r.x0 + 1 + i * 0.7, 0.15, r.z1 - 1, false));
  })(R.T);
  (function (r) { // JARDÍN (con setos tipo laberinto)
    const seto = std('#1e7d32', { roughness: 0.95 });
    [[-10, -1, 0.8, 5], [-6, 1, 5, 0.8], [-2, -1.5, 0.8, 4], [4, 1, 6, 0.8], [8, -1.2, 0.8, 4.2], [12, 1.2, 4, 0.8], [-13, 2.6, 4, 0.8]].forEach(([dx, dz, w, d]) => caja(w, 1.5, d, seto, r.cx + dx, 0.75, r.cz + dz, true));
    cilindro(1.0, 0.5, std('#d9dde6'), r.cx + 1.5, 0.25, r.cz - 2.6, true, 24);
    const agua = new T.Mesh(new T.CircleGeometry(0.85, 24), new T.MeshStandardMaterial({ color: '#7fd3ff', emissive: '#1a6f9e', emissiveIntensity: 0.6 })); agua.rotation.x = -Math.PI / 2; agua.position.set(r.cx + 1.5, 0.52, r.cz - 2.6); grupo.add(agua);
    for (let i = 0; i < 8; i++) { const fl = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), std(['#ff4d6d', '#ffd93d', '#ff7eb6', '#ffffff'][i % 4])); fl.position.set(r.x0 + 1 + i * 1.4, 0.15, r.z1 - 0.5); grupo.add(fl); }
  })(R.J);
  (function (r) { // SÓTANO
    [[-4, -1.5], [-3.2, -0.8], [4, 1.5], [3, 2.2]].forEach(([dx, dz]) => cilindro(0.45, 1.1, std('#8b5a3c'), r.cx + dx, 0.55, r.cz + dz, true, 14));
    [[0, -2, 1.4], [1.2, -1.6, 1], [-1, 2, 1.2]].forEach(([dx, dz, s]) => caja(s, s, s, std('#a0763c'), r.cx + dx, s / 2, r.cz + dz, true));
    const foco = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), neon('#ffe08a', 4)); foco.position.set(r.cx, 2.2, r.cz); grupo.add(foco);
    animados.push(() => foco.visible = Math.random() > 0.03); // foco que parpadea 😱
  })(R.S);
  (function (r) { // GIMNASIO
    [-4, -1.5].forEach(dx => { caja(0.9, 0.3, 2.2, std('#222'), r.cx + dx, 0.15, r.cz - 1, true); caja(0.9, 1.2, 0.15, std('#444'), r.cx + dx, 0.75, r.cz - 2.0, false); });
    caja(2.2, 0.08, 0.08, std('#999', { metalness: 0.8 }), r.cx + 3, 1.0, r.cz + 1, false);
    [-1.1, 1.1].forEach(dx => { cilindro(0.35, 0.12, std('#111'), r.cx + 3 + dx, 1.0, r.cz + 1, false).rotation.z = Math.PI / 2; });
    caja(2.6, 0.9, 0.6, std('#555'), r.cx + 3, 0.45, r.cz + 1, true);
    caja(3, 0.05, 1.6, std('#2ed3c6'), r.cx + 2.5, 0.03, r.z1 - 1.5, false);
  })(R.I);

  // luces (pocas, para que vaya bien en celular)
  [['#ff3d9a', R.B], ['#2ee6d6', R.P], ['#ffd93d', R.V], ['#5effa0', R.J]].forEach(([c, r]) => { const l = new T.PointLight(c, 8, 14); l.position.set(r.cx, 2.6, r.cz); grupo.add(l); });

  // ---------- techos y sombras por celda: solo ves el cuarto donde estás ----------
  const celdas = [];
  for (let f = 0; f < FIL; f++) for (let c = 0; c < COL; c++) if (esPiso(PLANO[f][c])) celdas.push({ f, c, k: zona[f][c], puerta: PLANO[f][c] === '+', x: cx(c), z: cz(f) });
  const techos = new T.InstancedMesh(new T.BoxGeometry(CS + 0.32, 0.12, CS + 0.32), new T.MeshBasicMaterial({ color: '#0b0318' }), celdas.length);
  const sombras = new T.InstancedMesh(new T.PlaneGeometry(CS, CS).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#05010d', transparent: true, opacity: 0.82, depthWrite: false }), celdas.length);
  techos.castShadow = sombras.castShadow = false; techos.renderOrder = 3; sombras.renderOrder = 2;
  techos.frustumCulled = sombras.frustumCulled = false;
  grupo.add(techos); grupo.add(sombras);
  const M = new T.Matrix4(), CERO = new T.Matrix4().makeScale(0, 0, 0);
  const puertaDeMiZona = (cel, k) => cel.puerta && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([df, dc]) => zona[cel.f + df] && zona[cel.f + df][cel.c + dc] === k);
  let ultimaClave = '';
  function actualizarVista(px, pz, verTodo) {
    const yo = celdaDe(px, pz), miZona = zonaDe(px, pz);
    const clave = yo.f + ',' + yo.c + ',' + (verTodo ? 1 : 0);
    if (clave === ultimaClave) return;
    ultimaClave = clave;
    celdas.forEach((cel, i) => {
      let techo = false, sombra = false;
      if (!verTodo && cel.k !== miZona && !puertaDeMiZona(cel, miZona)) {
        if (cel.z > pz && cel.z - pz < 14) sombra = true; // delante de mí (hacia la cámara): sin techo para no tapar mi puerta
        else techo = true;
      }
      techos.setMatrixAt(i, techo ? M.makeTranslation(cel.x, ALTO + 0.1, cel.z) : CERO);
      sombras.setMatrixAt(i, sombra ? M.makeTranslation(cel.x, 0.035, cel.z) : CERO);
    });
    techos.instanceMatrix.needsUpdate = true; sombras.instanceMatrix.needsUpdate = true;
  }
  function animarFrentes(px, pz, dt) {
    const k = Math.min(1, dt * 6);
    frentes.forEach(f => {
      const tapa = f.z > pz && f.z - pz < 6.5 && px > f.x0 - 3 && px < f.x1 + 3;
      f.op += ((tapa ? 0.32 : 1) - f.op) * k;
      f.m.material.opacity = f.op; f.m.material.depthWrite = f.op > 0.95;
    });
  }

  // ---------- colisiones ----------
  const RAD = 0.42;
  function limites(p) {
    p.x = Math.max(-MX + RAD, Math.min(MX - RAD, p.x));
    p.z = Math.max(-MZ + RAD, Math.min(MZ - RAD, p.z));
    return p;
  }
  function colisionar(p) {
    limites(p);
    for (let n = 0; n < 2; n++) for (const c of cajas) {
      if (p.x < c[0] - RAD || p.x > c[2] + RAD || p.z < c[1] - RAD || p.z > c[3] + RAD) continue;
      const qx = Math.max(c[0], Math.min(c[2], p.x)), qz = Math.max(c[1], Math.min(c[3], p.z));
      const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
      if (d2 >= RAD * RAD) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = qx + dx / d * RAD; p.z = qz + dz / d * RAD; }
      else {
        const op = [[p.x - c[0], -1, 0], [c[2] - p.x, 1, 0], [p.z - c[1], 0, -1], [c[3] - p.z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        p.x += op[1] * (op[0] + RAD); p.z += op[2] * (op[0] + RAD);
      }
    }
    return p;
  }
  // lugares de salida alrededor de la mesa del vestíbulo
  function salida(i, n) {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
    return colisionar({ x: R.V.cx + Math.cos(a) * 2.5, z: R.V.cz + Math.sin(a) * 2.5 });
  }

  window.Mansion = {
    grupo, colisionar, limites, salida, cuartoDe, zonaDe, MX, MZ, RECT, AREAS, PLANO,
    actualizarVista(px, pz, dt, verTodo) { actualizarVista(px, pz, verTodo); animarFrentes(px, pz, dt); },
    reiniciarVista() { ultimaClave = ''; },
    animar(dt, t) { animados.forEach(f => f(t, dt)); },
  };
})();
