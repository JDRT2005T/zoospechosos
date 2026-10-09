// ZOOspechosos — Salón VIP (lobby cerrado donde se espera la partida)
(function () {
  const T = THREE;
  const ANCHO = 14, FONDO = 10;           // x: -7..7, z: -5..5
  const MX = ANCHO / 2, MZ = FONDO / 2;
  const grupo = new T.Group(); grupo.visible = false;
  const cajas = [];                        // obstáculos [minX, minZ, maxX, maxZ]
  const animados = [];

  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6 }, o || {}));
  const neon = color => new T.MeshBasicMaterial({ color });
  function caja(w, h, d, mat, x, y, z, sombra = true) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; grupo.add(m); return m;
  }
  function obstaculo(x, z, w, d) { cajas.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]); }
  function texto(txt, w, h, opts) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); opts(g, c);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // ---------- piso ----------
  const texPiso = texto('', 256, 256, g => {
    const cols = ['#2a1250', '#341762'];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = cols[(i + j) % 2]; g.fillRect(i * 128, j * 128, 128, 128); }
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 4; g.strokeRect(0, 0, 256, 256);
  });
  texPiso.wrapS = texPiso.wrapT = T.RepeatWrapping; texPiso.repeat.set(ANCHO / 2, FONDO / 2);
  const piso = new T.Mesh(new T.PlaneGeometry(ANCHO, FONDO), new T.MeshStandardMaterial({ map: texPiso, roughness: 0.35, metalness: 0.1 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; grupo.add(piso);
  // alfombra central con aro de neón
  const alfombra = new T.Mesh(new T.CircleGeometry(2.2, 48), std('#4a1670', { roughness: 0.95 }));
  alfombra.rotation.x = -Math.PI / 2; alfombra.position.y = 0.01; alfombra.receiveShadow = true; grupo.add(alfombra);
  const aroAlf = new T.Mesh(new T.RingGeometry(2.1, 2.2, 64), neon('#ff3d9a'));
  aroAlf.rotation.x = -Math.PI / 2; aroAlf.position.y = 0.015; grupo.add(aroAlf); animados.push(t => aroAlf.material.color.setHSL((t * 0.07) % 1, 0.9, 0.6));
  // piso exterior oscuro (para que no se vea el vacío)
  const fuera = new T.Mesh(new T.PlaneGeometry(80, 80), std('#0d0420', { roughness: 1 }));
  fuera.rotation.x = -Math.PI / 2; fuera.position.y = -0.02; grupo.add(fuera);

  // ---------- paredes ----------
  const matPared = std('#3b1a6b', { roughness: 0.8 });
  const ALTO = 2.6;
  caja(ANCHO + 0.4, ALTO, 0.3, matPared, 0, ALTO / 2, -MZ - 0.15);                // fondo
  caja(0.3, ALTO, FONDO, matPared, -MX - 0.15, ALTO / 2, 0);                       // izquierda
  caja(0.3, ALTO, FONDO, matPared, MX + 0.15, ALTO / 2, 0);                        // derecha
  caja(ANCHO + 0.4, 0.45, 0.3, matPared, 0, 0.225, MZ + 0.15, false);              // frente bajito (baranda)
  // tiras de neón arriba de las paredes
  [[ANCHO, 0.06, 0.06, 0, ALTO, -MZ, '#2ee6d6'], [0.06, 0.06, FONDO, -MX, ALTO, 0, '#ff3d9a'], [0.06, 0.06, FONDO, MX, ALTO, 0, '#ff3d9a'], [ANCHO, 0.06, 0.06, 0, 0.47, MZ, '#ffd93d']]
    .forEach(n => caja(n[0], n[1], n[2], neon(n[6]), n[3], n[4], n[5], false));
  // zócalo brillante
  caja(ANCHO, 0.08, 0.05, neon('#8b5cff'), 0, 0.05, -MZ + 0.01, false);

  // letrero de neón
  const texLetrero = texto('', 1024, 256, g => {
    g.font = '900 150px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff3d9a'; g.shadowBlur = 40; g.fillStyle = '#ffd93d'; g.fillText('ZOO', 330, 135);
    g.shadowColor = '#2ee6d6'; g.fillStyle = '#ffffff'; g.fillText('spechosos', 630, 135);
  });
  const letrero = new T.Mesh(new T.PlaneGeometry(5, 1.25), new T.MeshBasicMaterial({ map: texLetrero, transparent: true }));
  letrero.position.set(0, 1.95, -MZ + 0.02); grupo.add(letrero);

  // puerta (por aquí se sale a la partida)
  caja(1.5, 2.1, 0.12, std('#1c0d36'), -4.6, 1.05, -MZ + 0.05);
  const marcoPuerta = caja(1.7, 0.08, 0.1, neon('#5effa0'), -4.6, 2.12, -MZ + 0.1, false);
  caja(0.08, 2.1, 0.1, neon('#5effa0'), -5.42, 1.05, -MZ + 0.1, false);
  caja(0.08, 2.1, 0.1, neon('#5effa0'), -3.78, 1.05, -MZ + 0.1, false);
  const texSalida = texto('', 256, 64, g => { g.fillStyle = '#5effa0'; g.font = '900 44px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('PARTIDA ▶', 128, 46); });
  const salida = new T.Mesh(new T.PlaneGeometry(1.2, 0.3), new T.MeshBasicMaterial({ map: texSalida, transparent: true }));
  salida.position.set(-4.6, 2.35, -MZ + 0.04); grupo.add(salida);
  animados.push(t => { marcoPuerta.material.color.setHSL(0.4, 1, 0.45 + Math.sin(t * 3) * 0.12); });

  // ---------- muebles ----------
  // cabina de DJ
  caja(3, 1, 0.9, std('#1b1030', { metalness: 0.3 }), 0, 0.5, -4.25);
  const frenteDJ = caja(2.9, 0.12, 0.02, neon('#2ee6d6'), 0, 0.75, -3.79, false);
  caja(0.5, 0.06, 0.5, std('#111'), -0.6, 1.03, -4.25); caja(0.5, 0.06, 0.5, std('#111'), 0.6, 1.03, -4.25);
  const discos = [-0.6, 0.6].map(x => { const d = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.03, 24), std('#222', { metalness: 0.5 })); d.position.set(x, 1.08, -4.25); grupo.add(d); return d; });
  animados.push((t, dt) => { discos.forEach(d => d.rotation.y += dt * 4); frenteDJ.material.color.setHSL((t * 0.1 + 0.5) % 1, 0.9, 0.55); });
  obstaculo(0, -4.25, 3.1, 1.0);
  // parlantes
  [-2.1, 2.1].forEach(x => {
    caja(0.8, 1.6, 0.7, std('#14091f'), x, 0.8, -4.4);
    [0.5, 1.15].forEach((y, i) => {
      const cono = new T.Mesh(new T.CylinderGeometry(i ? 0.16 : 0.26, i ? 0.16 : 0.26, 0.05, 24), std('#333', { metalness: 0.4 }));
      cono.rotation.x = Math.PI / 2; cono.position.set(x, y, -4.04); grupo.add(cono);
      animados.push(t => cono.scale.setScalar(1 + Math.max(0, Math.sin(t * 8.4)) * 0.08));
    });
    obstaculo(x, -4.4, 0.9, 0.8);
  });

  // sofás (izquierda)
  function sofa(x, z, rot, color) {
    const s = new T.Group(); s.position.set(x, 0, z); s.rotation.y = rot; grupo.add(s);
    const m = std(color, { roughness: 0.9 });
    [[2.4, 0.45, 0.9, 0, 0.25, 0], [2.4, 0.7, 0.25, 0, 0.6, -0.35], [0.25, 0.6, 0.9, -1.15, 0.4, 0], [0.25, 0.6, 0.9, 1.15, 0.4, 0]].forEach(p => {
      const b = new T.Mesh(new T.BoxGeometry(p[0], p[1], p[2]), m); b.position.set(p[3], p[4], p[5]); b.castShadow = b.receiveShadow = true; s.add(b);
    });
    [-0.55, 0.55].forEach(px => { const c = new T.Mesh(new T.BoxGeometry(1, 0.15, 0.6), std('#ffd93d')); c.position.set(px, 0.53, 0.05); s.add(c); });
  }
  sofa(-5.0, -3.9, 0, '#ff3d9a'); obstaculo(-5.0, -3.9, 2.5, 1.0);
  sofa(-6.3, -1.2, Math.PI / 2, '#8b5cff'); obstaculo(-6.3, -1.2, 1.0, 2.5);
  // mesita
  const mesita = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 0.4, 24), std('#2ee6d6', { roughness: 0.3 }));
  mesita.position.set(-4.9, 0.2, -2.3); mesita.castShadow = true; grupo.add(mesita); obstaculo(-4.9, -2.3, 0.9, 0.9);

  // barra con bebidas (derecha)
  caja(1.0, 1.1, 3.2, std('#1b1030'), 6.3, 0.55, -2.6);
  caja(1.15, 0.08, 3.35, std('#ffd93d', { metalness: 0.4, roughness: 0.3 }), 6.25, 1.12, -2.6);
  caja(0.04, 0.1, 3.2, neon('#ff3d9a'), 5.79, 0.9, -2.6, false);
  ['#ff4d6d', '#2ee6d6', '#ffd93d', '#5effa0', '#8b5cff'].forEach((c, i) => {
    const v = new T.Mesh(new T.CylinderGeometry(0.07, 0.05, 0.22, 12), new T.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.85, emissive: c, emissiveIntensity: 0.4 }));
    v.position.set(6.2, 1.27, -3.8 + i * 0.6); grupo.add(v);
  });
  obstaculo(6.3, -2.6, 1.2, 3.3);

  // máquina arcade (derecha adelante)
  caja(0.9, 1.9, 0.8, std('#ff3d9a'), 6.35, 0.95, 1.6);
  const pantalla = caja(0.04, 0.6, 0.6, neon('#2ee6d6'), 5.88, 1.35, 1.6, false);
  animados.push(t => pantalla.material.color.setHSL((t * 0.3) % 1, 0.9, 0.6));
  obstaculo(6.35, 1.6, 1.0, 0.9);

  // plantas
  function planta(x, z) {
    const maceta = new T.Mesh(new T.CylinderGeometry(0.3, 0.24, 0.5, 16), std('#c8935a'));
    maceta.position.set(x, 0.25, z); maceta.castShadow = true; grupo.add(maceta);
    [[0, 0.75, 0, 0.35], [0.18, 0.95, 0.05, 0.25], [-0.15, 1.0, -0.05, 0.27], [0, 1.2, 0, 0.22]].forEach(h => {
      const b = new T.Mesh(new T.IcosahedronGeometry(h[3], 0), std('#2fbf71', { flatShading: true })); b.position.set(x + h[0], h[1], z + h[2]); b.castShadow = true; grupo.add(b);
    });
    obstaculo(x, z, 0.7, 0.7);
  }
  planta(-6.4, 4.3); planta(6.4, 4.3); planta(-3.2, -4.5); planta(3.2, -4.5);

  // mesa de snacks (izquierda adelante)
  const mesa = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 0.08, 28), std('#ffffff', { roughness: 0.4 }));
  mesa.position.set(-5.3, 0.75, 2.3); mesa.castShadow = true; grupo.add(mesa);
  const pata = new T.Mesh(new T.CylinderGeometry(0.08, 0.2, 0.75, 12), std('#222')); pata.position.set(-5.3, 0.37, 2.3); grupo.add(pata);
  const torta = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.25, 20), std('#ff7eb6')); torta.position.set(-5.3, 0.92, 2.3); grupo.add(torta);
  const vela = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.14, 8), std('#ffd93d')); vela.position.set(-5.3, 1.12, 2.3); grupo.add(vela);
  const llama = new T.Mesh(new T.SphereGeometry(0.035, 8, 8), neon('#ffb347')); llama.position.set(-5.3, 1.22, 2.3); grupo.add(llama);
  animados.push(t => llama.scale.setScalar(1 + Math.sin(t * 20) * 0.2));
  obstaculo(-5.3, 2.3, 1.4, 1.4);

  // luces del salón
  const luces = [['#ff3d9a', -4, -2], ['#2ee6d6', 4, -2], ['#ffd93d', 0, 3]].map(([c, x, z]) => {
    const l = new T.PointLight(c, 10, 9); l.position.set(x, 2.4, z); grupo.add(l); return l;
  });
  animados.push(t => luces.forEach((l, i) => l.intensity = 8 + Math.sin(t * 2 + i * 2) * 3));

  // ---------- colisiones ----------
  const R = 0.42; // radio del muñeco
  function colisionar(p) {
    p.x = Math.max(-MX + R, Math.min(MX - R, p.x));
    p.z = Math.max(-MZ + R, Math.min(MZ - R - 0.1, p.z));
    for (const c of cajas) {
      const cx = Math.max(c[0], Math.min(c[2], p.x)), cz = Math.max(c[1], Math.min(c[3], p.z));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
        else { // centro dentro de la caja: empujar por el lado más cercano
          const op = [[p.x - c[0], -1, 0], [c[2] - p.x, 1, 0], [p.z - c[1], 0, -1], [c[3] - p.z, 0, 1]].sort((a, b) => a[0] - b[0])[0];
          p.x += op[1] * (op[0] + R); p.z += op[2] * (op[0] + R);
        }
      }
    }
    return p;
  }
  function lugarLibre() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 1.8;
      const p = { x: Math.cos(a) * r, z: Math.sin(a) * r + 0.5 };
      const q = colisionar({ x: p.x, z: p.z });
      if (Math.abs(q.x - p.x) < 1e-3 && Math.abs(q.z - p.z) < 1e-3) return p;
    }
    return { x: 0, z: 0.5 };
  }

  window.Salon = {
    grupo, colisionar, lugarLibre, MX, MZ,
    animar(dt, t) { animados.forEach(f => f(t, dt)); },
  };
})();
