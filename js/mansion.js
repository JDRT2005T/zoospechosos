// ZOOspechosos — Mapa "Mansión Fiesta" (6 cuartos + pasillo)
//  x: -20..20   z: -14..14   (la cámara mira desde +z)
//  Arriba:  Cocina | Salón de baile | Biblioteca
//  Medio:   pasillo largo
//  Abajo:   Piscina | Vestíbulo (salida) | Dormitorio
(function () {
  const T = THREE;
  const MX = 20, MZ = 14, ALTO = 2.4, BAJO = 0.7, PUERTA = 2.8;
  const grupo = new T.Group(); grupo.visible = false;
  const cajas = [];
  const animados = [];
  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o || {}));
  const neon = (c, k) => window.neon(c, k || 5);

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

  // ---------- pisos ----------
  function piso(x0, z0, x1, z1, c1, c2, celda) {
    const tex = lienzo(128, 128, (g) => { g.fillStyle = c1; g.fillRect(0, 0, 128, 128); g.fillStyle = c2; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128); });
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set((x1 - x0) / (celda || 2), (z1 - z0) / (celda || 2));
    const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.receiveShadow = true; grupo.add(m);
    return m;
  }
  function nombre(txt, x, z, color) {
    const tex = lienzo(512, 128, g => { g.font = '900 72px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color || 'rgba(255,255,255,.22)'; g.fillText(txt, 256, 68); });
    const m = new T.Mesh(new T.PlaneGeometry(5, 1.25), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); grupo.add(m);
  }
  const CUARTOS = [
    { n: 'Cocina', x0: -20, z0: -14, x1: -7, z1: -3, c: ['#e9e2d0', '#cfc4aa'] },
    { n: 'Salón de baile', x0: -7, z0: -14, x1: 7, z1: -3, c: ['#2b1150', '#3a1670'] },
    { n: 'Biblioteca', x0: 7, z0: -14, x1: 20, z1: -3, c: ['#6b4423', '#5a3a1e'] },
    { n: 'Pasillo', x0: -20, z0: -3, x1: 20, z1: 3, c: ['#8a1c3a', '#7a1733'] },
    { n: 'Piscina', x0: -20, z0: 3, x1: -7, z1: 14, c: ['#bfeaf2', '#a6dbe6'] },
    { n: 'Vestíbulo', x0: -7, z0: 3, x1: 7, z1: 14, c: ['#f2e9ff', '#d8c8f2'] },
    { n: 'Dormitorio', x0: 7, z0: 3, x1: 20, z1: 14, c: ['#3b5bdb', '#3451c4'] },
  ];
  CUARTOS.forEach(q => { piso(q.x0, q.z0, q.x1, q.z1, q.c[0], q.c[1]); if (q.n !== 'Pasillo') nombre(q.n.toUpperCase(), (q.x0 + q.x1) / 2, q.z1 - 1.2); });
  const fuera = new T.Mesh(new T.PlaneGeometry(120, 120), std('#0d0420', { roughness: 1 }));
  fuera.rotation.x = -Math.PI / 2; fuera.position.y = -0.03; grupo.add(fuera);

  // ---------- paredes (con huecos de puerta) ----------
  const matPared = std('#4a2380', { roughness: 0.85 });
  // pared a lo largo de x (z fijo). Todas son altas; las que quedan entre la cámara y tú se vuelven transparentes.
  const frentes = []; // paredes que pueden taparte
  let texTapete = null;
  function puerta(x, z, giro) { // giro 0: pared a lo largo de x; giro 1: pared a lo largo de z
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = giro ? Math.PI / 2 : 0; grupo.add(g);
    const marco = neon('#5effa0', 4);
    [-PUERTA / 2, PUERTA / 2].forEach(dx => { const p = new T.Mesh(new T.BoxGeometry(0.14, ALTO, 0.36), marco); p.position.set(dx, ALTO / 2, 0); g.add(p); });
    const arco = new T.Mesh(new T.BoxGeometry(PUERTA + 0.14, 0.14, 0.36), marco); arco.position.y = ALTO; g.add(arco);
    if (!texTapete) texTapete = lienzo(256, 128, (c) => {
      c.fillStyle = 'rgba(20,60,40,.85)'; c.fillRect(0, 0, 256, 128);
      c.strokeStyle = '#5effa0'; c.lineWidth = 8; c.strokeRect(6, 6, 244, 116);
      c.fillStyle = '#5effa0'; c.font = '900 60px Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('▲   ▼', 128, 66);
    });
    const tapete = new T.Mesh(new T.PlaneGeometry(PUERTA - 0.2, 1.3), new T.MeshBasicMaterial({ map: texTapete, transparent: true, color: new T.Color(1.6, 1.6, 1.6), depthWrite: false }));
    tapete.rotation.x = -Math.PI / 2; tapete.position.y = 0.025; g.add(tapete);
  }
  function paredX(z, x0, x1, huecos, alta) {
    const cortes = [x0];
    (huecos || []).forEach(c => cortes.push(c - PUERTA / 2, c + PUERTA / 2));
    cortes.push(x1);
    for (let i = 0; i < cortes.length; i += 2) {
      const a = cortes[i], b = cortes[i + 1]; if (b - a < 0.05) continue;
      const mat = alta ? matPared : std('#5b2d99', { roughness: 0.85, transparent: true });
      const m = caja(b - a, ALTO, 0.3, mat, (a + b) / 2, ALTO / 2, z, true);
      const tira = caja(b - a, 0.05, 0.32, neon(alta ? '#2ee6d6' : '#ff3d9a', 4), (a + b) / 2, ALTO + 0.02, z, false);
      if (!alta) frentes.push({ m, z, x0: a, x1: b, op: 1 });
    }
    (huecos || []).forEach(c => puerta(c, z, 0));
  }
  function paredZ(x, z0, z1, huecos) {
    const cortes = [z0];
    (huecos || []).forEach(c => cortes.push(c - PUERTA / 2, c + PUERTA / 2));
    cortes.push(z1);
    for (let i = 0; i < cortes.length; i += 2) {
      const a = cortes[i], b = cortes[i + 1]; if (b - a < 0.05) continue;
      caja(0.3, ALTO, b - a, matPared, x, ALTO / 2, (a + b) / 2, true);
      caja(0.32, 0.05, b - a, neon('#2ee6d6', 4), x, ALTO + 0.02, (a + b) / 2, false);
    }
    (huecos || []).forEach(c => puerta(x, c, 1));
  }
  paredX(-MZ, -MX, MX, [], true);              // fondo
  paredX(MZ, -MX, MX, [0], false);             // frente (puerta principal del vestíbulo)
  paredX(-3, -MX, MX, [-13.5, 0, 13.5], false);
  paredX(3, -MX, MX, [-13.5, 0, 13.5], false);
  paredZ(-MX, -MZ, MZ); paredZ(MX, -MZ, MZ);
  paredZ(-7, -MZ, -3, [-8.5]); paredZ(7, -MZ, -3, [-8.5]);
  paredZ(-7, 3, MZ, [8.5]); paredZ(7, 3, MZ, [8.5]);

  // ---------- COCINA ----------
  caja(12, 1.0, 0.9, std('#ffffff', { roughness: 0.4 }), -13.5, 0.5, -13.3, true);       // mesón del fondo
  caja(12, 0.08, 0.95, std('#2f2f3a', { roughness: 0.3 }), -13.5, 1.04, -13.3, false);
  caja(1.2, 2.1, 0.9, std('#d9dde6', { metalness: 0.5, roughness: 0.3 }), -19.2, 1.05, -12.6, true); // nevera
  const fogon = caja(1.6, 0.06, 0.7, neon('#ff4d2e', 2), -10, 1.09, -13.3, false);
  animados.push(t => fogon.material.color.setRGB(2 + Math.sin(t * 6) * 0.4, 0.4, 0.1));
  caja(4.2, 1.0, 1.6, std('#c8935a'), -13.5, 0.5, -8.5, true);                             // isla
  ['#ff4d6d', '#ffd93d', '#5ad16b'].forEach((c, i) => cilindro(0.18, 0.2, std(c), -14.8 + i * 1.3, 1.1, -8.5, false));
  caja(2.4, 0.8, 1.4, std('#8b5a3c'), -17.5, 0.4, -5.6, true);                             // mesa
  // ---------- SALÓN DE BAILE ----------
  const baldosas = [];
  for (let x = -5; x <= 5; x += 2) for (let z = -12; z <= -6; z += 2) {
    const b = new T.Mesh(new T.BoxGeometry(1.9, 0.04, 1.9), std('#2b1150', { emissive: ['#ff3d9a', '#8b5cff', '#2ee6d6', '#ffd93d'][((x + z) / 2 + 20) % 4], emissiveIntensity: 0.4, roughness: 0.3 }));
    b.position.set(x, 0.02, z); b.receiveShadow = true; grupo.add(b); baldosas.push(b);
  }
  animados.push(t => baldosas.forEach((b, i) => b.material.emissiveIntensity = 0.15 + 0.9 * Math.max(0, Math.sin(t * 2.5 + i * 1.3))));
  caja(3.2, 1.0, 1.0, std('#14091f'), 0, 0.5, -13.2, true);                                // DJ
  const frenteDJ = caja(3.1, 0.12, 0.02, neon('#2ee6d6'), 0, 0.75, -12.69, false);
  animados.push(t => frenteDJ.material.color.setHSL((t * 0.1) % 1, 0.9, 0.55).multiplyScalar(5));
  [-2.4, 2.4].forEach(x => caja(0.9, 1.7, 0.8, std('#14091f'), x, 0.85, -13.3, true));
  // ---------- BIBLIOTECA ----------
  const texLibros = lienzo(256, 128, g => {
    g.fillStyle = '#3b2414'; g.fillRect(0, 0, 256, 128);
    for (let f = 0; f < 3; f++) for (let x = 4; x < 252;) { const w = 6 + Math.random() * 10; g.fillStyle = ['#e63946', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8b5cff'][Math.floor(Math.random() * 6)]; g.fillRect(x, f * 42 + 6, w - 1, 34); x += w; }
  });
  [9.5, 13.5, 17.5].forEach(x => { const e = caja(3.6, 2.2, 0.6, new T.MeshStandardMaterial({ map: texLibros, roughness: 0.8 }), x, 1.1, -13.5, true); });
  caja(3, 0.8, 1.6, std('#8b5a3c'), 13.5, 0.4, -8.5, true);                               // mesa de lectura
  [[10.2, -7.2], [16.8, -7.2]].forEach(([x, z]) => caja(1.2, 0.8, 1.2, std('#9d0208'), x, 0.4, z, true)); // sillones
  const globo = new T.Mesh(new T.SphereGeometry(0.4, 20, 16), std('#2a9d8f')); globo.position.set(18.6, 1.3, -5); grupo.add(globo); cilindro(0.06, 0.9, std('#c9a227'), 18.6, 0.45, -5, true);
  animados.push((t, dt) => globo.rotation.y += dt * 0.5);
  // ---------- PISCINA ----------
  const agua = new T.Mesh(new T.PlaneGeometry(8, 5), new T.MeshStandardMaterial({ color: '#2ec4f0', emissive: '#0a6f9e', emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 }));
  agua.rotation.x = -Math.PI / 2; agua.position.set(-13.5, 0.05, 8.5); grupo.add(agua);
  caja(8.6, 0.2, 0.3, std('#ffffff'), -13.5, 0.1, 5.85, false); caja(8.6, 0.2, 0.3, std('#ffffff'), -13.5, 0.1, 11.15, false);
  caja(0.3, 0.2, 5.6, std('#ffffff'), -17.65, 0.1, 8.5, false); caja(0.3, 0.2, 5.6, std('#ffffff'), -9.35, 0.1, 8.5, false);
  cajas.push([-17.8, 5.7, -9.2, 11.3]); // no se puede caminar sobre el agua
  animados.push(t => agua.material.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.15);
  const flotador = new T.Mesh(new T.TorusGeometry(0.45, 0.16, 10, 24), std('#ff4d6d')); flotador.rotation.x = Math.PI / 2; flotador.position.set(-12, 0.15, 8); grupo.add(flotador);
  animados.push(t => { flotador.position.x = -12 + Math.sin(t * 0.4) * 2; flotador.position.y = 0.15 + Math.sin(t * 2) * 0.04; });
  [[-18.5, 13], [-8.5, 13]].forEach(([x, z]) => { cilindro(0.15, 2.2, std('#8b5a3c'), x, 1.1, z, true); [0, 1, 2, 3, 4].forEach(i => { const h = new T.Mesh(new T.ConeGeometry(0.3, 1.4, 4), std('#2fbf71', { flatShading: true })); h.position.set(x + Math.cos(i * 1.25) * 0.6, 2.2, z + Math.sin(i * 1.25) * 0.6); h.rotation.z = Math.cos(i * 1.25) * 1.2; h.rotation.x = Math.sin(i * 1.25) * 1.2; grupo.add(h); }); });
  [-15.5, -11.5].forEach(x => caja(0.8, 0.3, 1.9, std('#ffd93d'), x, 0.25, 12.6, true));  // tumbonas
  // ---------- VESTÍBULO (aquí empieza la partida) ----------
  cilindro(1.1, 0.75, std('#ffffff', { roughness: 0.4 }), 0, 0.375, 8.5, true, 32);       // mesa redonda
  const boton = cilindro(0.3, 0.12, neon('#ff2e2e', 3), 0, 0.81, 8.5, false);            // botón de emergencia (Parte 3B)
  animados.push(t => boton.material.color.setRGB(2.4 + Math.sin(t * 4) * 0.6, 0.2, 0.2));
  [[-5.2, 5], [5.2, 5]].forEach(([x, z]) => caja(1.0, 0.8, 2.6, std('#8b5cff'), x, 0.4, z, true)); // sofás
  // ---------- DORMITORIO ----------
  [[10.5, 6.2], [16.5, 6.2]].forEach(([x, z]) => {
    caja(2.0, 0.6, 3.0, std('#ffffff'), x, 0.3, z, true);
    caja(2.0, 0.25, 2.0, std(x < 13 ? '#ff7eb6' : '#2ed3c6'), x, 0.72, z + 0.5, false);
    caja(1.4, 0.25, 0.6, std('#ffffff'), x, 0.72, z - 1.1, false);
    caja(2.1, 1.2, 0.2, std('#8b5a3c'), x, 0.6, z - 1.6, false);
  });
  caja(2.6, 2.2, 0.8, std('#8b5a3c'), 18.4, 1.1, 12.8, true);                              // armario
  const lampara = cilindro(0.25, 0.4, new T.MeshStandardMaterial({ color: '#ffe7a0', emissive: '#ffd93d', emissiveIntensity: 2 }), 13.5, 1.2, 5.2, false);
  cilindro(0.15, 0.6, std('#8b5a3c'), 13.5, 0.4, 5.2, true);

  // luces (pocas, para que vaya bien en celular)
  [['#ff3d9a', 0, -8.5], ['#2ee6d6', -13.5, 8.5], ['#ffd93d', 0, 8.5]].forEach(([c, x, z]) => { const l = new T.PointLight(c, 6, 11); l.position.set(x, 2.6, z); grupo.add(l); });

  // ---------- colisiones ----------
  const R = 0.42;
  function limites(p) {
    p.x = Math.max(-MX + R, Math.min(MX - R, p.x));
    p.z = Math.max(-MZ + R, Math.min(MZ - R, p.z));
    return p;
  }
  function colisionar(p) {
    limites(p);
    for (let n = 0; n < 2; n++) for (const c of cajas) {
      const cx = Math.max(c[0], Math.min(c[2], p.x)), cz = Math.max(c[1], Math.min(c[3], p.z));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
      else {
        const op = [[p.x - c[0], -1, 0], [c[2] - p.x, 1, 0], [p.z - c[1], 0, -1], [c[3] - p.z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        p.x += op[1] * (op[0] + R); p.z += op[2] * (op[0] + R);
      }
    }
    return p;
  }
  // lugares de salida alrededor de la mesa del vestíbulo
  function salida(i, n) {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
    return colisionar({ x: Math.cos(a) * 2.5, z: 8.5 + Math.sin(a) * 2.5 });
  }
  function cuartoDe(x, z) {
    const q = CUARTOS.find(q => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    return q ? q.n : '';
  }

  // ---------- techos: los cuartos donde no estás quedan tapados ----------
  CUARTOS.forEach(q => {
    const t = new T.Mesh(new T.BoxGeometry(q.x1 - q.x0 + 0.3, 0.12, q.z1 - q.z0 + 0.3), new T.MeshBasicMaterial({ color: '#0b0318', transparent: true, opacity: 1 }));
    t.position.set((q.x0 + q.x1) / 2, ALTO + 0.1, (q.z0 + q.z1) / 2);
    t.castShadow = false; t.receiveShadow = false; t.renderOrder = 3;
    grupo.add(t); q.techo = t; q.op = 1;
    // el cuarto que queda entre la cámara y tú no lleva techo (taparía tu puerta): se oscurece el piso,
    // menos una franja junto a la puerta para que se vea por dónde salir
    const s = new T.Mesh(new T.PlaneGeometry(q.x1 - q.x0, q.z1 - q.z0 - 1.4), new T.MeshBasicMaterial({ color: '#05010d', transparent: true, opacity: 0, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.set((q.x0 + q.x1) / 2, 0.035, (q.z0 + q.z1) / 2 + 0.7); s.renderOrder = 2; s.visible = false;
    grupo.add(s); q.sombra = s; q.opS = 0;
  });
  let cuartoActual = null;
  // verTodo = fantasma (los fantasmas ven toda la mansión)
  function actualizarVista(px, pz, dt, verTodo) {
    const aqui = CUARTOS.find(q => px >= q.x0 && px <= q.x1 && pz >= q.z0 && pz <= q.z1) || cuartoActual;
    cuartoActual = aqui;
    const k = Math.min(1, dt * 6);
    CUARTOS.forEach(q => {
      const delante = !verTodo && aqui && q !== aqui && q.z0 >= aqui.z1 - 0.01; // más cerca de la cámara que yo
      const meta = (verTodo || q === aqui || delante) ? 0 : 1;
      q.op += (meta - q.op) * k;
      q.techo.material.opacity = q.op; q.techo.visible = q.op > 0.02;
      q.opS += ((delante ? 0.82 : 0) - q.opS) * k;
      q.sombra.material.opacity = q.opS; q.sombra.visible = q.opS > 0.02;
    });
    frentes.forEach(f => {
      const tapa = f.z > pz && f.z - pz < 6.5 && px > f.x0 - 3 && px < f.x1 + 3;
      const meta = tapa ? 0.32 : 1;
      f.op += (meta - f.op) * k;
      f.m.material.opacity = f.op; f.m.material.depthWrite = f.op > 0.95;
    });
  }
  function reiniciarVista() { CUARTOS.forEach(q => { q.op = 1; q.techo.material.opacity = 1; q.techo.visible = true; q.opS = 0; q.sombra.visible = false; }); cuartoActual = null; }

  window.Mansion = {
    grupo, colisionar, limites, salida, cuartoDe, MX, MZ, actualizarVista, reiniciarVista,
    animar(dt, t) { animados.forEach(f => f(t, dt)); },
  };
})();
