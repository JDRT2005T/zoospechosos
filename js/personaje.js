// ZOOspechosos — personajes 3D (animales tamaño Among Us + ropa)
(function () {
  const T = THREE;

  // ---------- catálogo ----------
  const ANIMALES = [
    { id: 'gato', nombre: 'Gato', emoji: '🐱', color: '#ff9f43' },
    { id: 'perro', nombre: 'Perro', emoji: '🐶', color: '#c8935a' },
    { id: 'conejo', nombre: 'Conejo', emoji: '🐰', color: '#f1e6ff' },
    { id: 'zorro', nombre: 'Zorro', emoji: '🦊', color: '#ff6b2c' },
    { id: 'oso', nombre: 'Oso', emoji: '🐻', color: '#8b5a3c' },
    { id: 'panda', nombre: 'Panda', emoji: '🐼', color: '#f4f4f4' },
    { id: 'rana', nombre: 'Rana', emoji: '🐸', color: '#5ad16b' },
    { id: 'pinguino', nombre: 'Pingüino', emoji: '🐧', color: '#2d3a5a' },
  ];
  const COLORES = ['#ff4d6d', '#ff9f43', '#ffd93d', '#5ad16b', '#2ed3c6', '#3a86ff', '#7b5cff', '#d65cff',
    '#ff7eb6', '#8b5a3c', '#c8935a', '#f4f4f4', '#9aa5b1', '#2d3a5a', '#1c1c24', '#ff6b2c'];
  const SOMBREROS = [
    { id: 'ninguno', nombre: 'Nada', emoji: '🚫' },
    { id: 'gorra', nombre: 'Gorra', emoji: '🧢' },
    { id: 'copa', nombre: 'Copa', emoji: '🎩' },
    { id: 'corona', nombre: 'Corona', emoji: '👑' },
    { id: 'fiesta', nombre: 'Fiesta', emoji: '🥳' },
    { id: 'vikingo', nombre: 'Vikingo', emoji: '🪓' },
    { id: 'vaquero', nombre: 'Vaquero', emoji: '🤠' },
    { id: 'aureola', nombre: 'Aureola', emoji: '😇' },
    { id: 'chef', nombre: 'Chef', emoji: '👨‍🍳' },
  ];
  const GAFAS = [
    { id: 'ninguno', nombre: 'Nada', emoji: '🚫' },
    { id: 'sol', nombre: 'De sol', emoji: '🕶️' },
    { id: 'redondas', nombre: 'Redondas', emoji: '👓' },
    { id: 'visor', nombre: 'Visor', emoji: '🥽' },
    { id: 'corazon', nombre: 'Corazón', emoji: '😍' },
  ];
  const ACCESORIOS = [
    { id: 'ninguno', nombre: 'Nada', emoji: '🚫' },
    { id: 'mochila', nombre: 'Mochila', emoji: '🎒' },
    { id: 'capa', nombre: 'Capa', emoji: '🦸' },
    { id: 'bufanda', nombre: 'Bufanda', emoji: '🧣' },
    { id: 'corbatin', nombre: 'Corbatín', emoji: '🎀' },
    { id: 'cadena', nombre: 'Cadena', emoji: '📿' },
  ];

  // ---------- materiales ----------
  let gradiente = null;
  function gradMap() {
    if (gradiente) return gradiente;
    const c = document.createElement('canvas'); c.width = 4; c.height = 1;
    const g = c.getContext('2d');
    ['#6a6a6a', '#a8a8a8', '#e0e0e0', '#ffffff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i, 0, 1, 1); });
    gradiente = new T.CanvasTexture(c);
    gradiente.minFilter = gradiente.magFilter = T.NearestFilter;
    gradiente.generateMipmaps = false;
    return gradiente;
  }
  const cache = {};
  function mat(color, opts) {
    const k = color + JSON.stringify(opts || {});
    if (!cache[k]) cache[k] = new T.MeshToonMaterial(Object.assign({ color, gradientMap: gradMap() }, opts || {}));
    return cache[k];
  }
  const NEGRO = '#1b1b24', BLANCO = '#ffffff', ROSA = '#ff9bb3';

  function aclarar(hex, f) { return '#' + new T.Color(hex).lerp(new T.Color('#ffffff'), f).getHexString(); }
  function oscurecer(hex, f) { return '#' + new T.Color(hex).lerp(new T.Color('#000000'), f).getHexString(); }

  function malla(geo, color, opts) {
    const m = new T.Mesh(geo, mat(color, opts));
    m.castShadow = true;
    return m;
  }
  function esfera(r, color, sx, sy, sz) {
    const m = malla(new T.SphereGeometry(r, 20, 16), color);
    m.scale.set(sx || 1, sy || 1, sz || 1);
    return m;
  }
  function pos(m, x, y, z) { m.position.set(x, y, z); return m; }

  // contorno estilo dibujo animado (solo para el cuerpo)
  function contorno(geo, grosor) {
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#15121f', side: T.BackSide }));
    m.scale.setScalar(1 + grosor);
    return m;
  }

  // ---------- constructor ----------
  // Cabeza/cuerpo en una sola pieza (como Among Us). Mira hacia +Z. Alto total ≈ 1.7
  const CENTRO = 0.95, MEDIO = 0.225, RADIO = 0.5, TOPE = CENTRO + MEDIO + RADIO; // 1.675

  function crear(cfg) {
    cfg = Object.assign({ animal: 'gato', color: '#ff9f43', sombrero: 'ninguno', gafas: 'ninguno', accesorio: 'ninguno' }, cfg || {});
    const a = cfg.animal, col = cfg.color;
    const raiz = new T.Group();
    const cuerpo = new T.Group(); // se anima (rebote)
    raiz.add(cuerpo);
    const ud = { cuerpo, orejas: [], brazos: [], piernas: [], ojos: [], cola: null, t: Math.random() * 10, parpadeo: 2 + Math.random() * 3 };
    raiz.userData = ud;

    // cuerpo
    const geoC = new T.CapsuleGeometry(RADIO, MEDIO * 2, 10, 24);
    const c = malla(geoC, col); c.position.y = CENTRO; cuerpo.add(c);
    const o = contorno(geoC, 0.035); o.position.y = CENTRO; cuerpo.add(o);

    // panza
    const panzaCol = (a === 'pinguino' || a === 'zorro' || a === 'panda') ? BLANCO : aclarar(col, 0.45);
    const panza = esfera(0.36, panzaCol, 1, a === 'pinguino' ? 1.55 : 1.15, 0.58);
    pos(panza, 0, a === 'pinguino' ? 0.95 : 0.78, 0.34); cuerpo.add(panza);

    // piernas
    const pieCol = a === 'pinguino' ? '#ffa62b' : oscurecer(col, 0.15);
    [-1, 1].forEach(s => {
      const p = new T.Group(); p.position.set(0.2 * s, 0.32, 0);
      const pie = malla(new T.CapsuleGeometry(0.13, 0.12, 6, 12), pieCol);
      pie.position.y = -0.18; p.add(pie);
      if (a === 'pinguino') { pie.scale.set(1.2, 0.6, 1.6); pie.position.z = 0.06; }
      cuerpo.add(p); ud.piernas.push(p);
    });

    // brazos
    [-1, 1].forEach(s => {
      const b = new T.Group(); b.position.set(0.48 * s, 1.0, 0);
      const brazo = malla(new T.CapsuleGeometry(0.095, 0.24, 6, 12), a === 'panda' ? NEGRO : (a === 'pinguino' ? oscurecer(col, 0.1) : col));
      brazo.position.y = -0.18; b.add(brazo);
      if (a === 'pinguino') brazo.scale.set(0.6, 1.2, 1.4);
      b.rotation.z = 0.35 * s;
      cuerpo.add(b); ud.brazos.push(b);
    });

    // ojos
    const ojoY = a === 'rana' ? 1.66 : 1.3, ojoZ = a === 'rana' ? 0.3 : 0.43, ojoX = a === 'rana' ? 0.2 : 0.17;
    if (a === 'rana') [-1, 1].forEach(s => cuerpo.add(pos(esfera(0.17, col), ojoX * s, 1.6, 0.2)));
    if (a === 'panda') [-1, 1].forEach(s => { const m = pos(esfera(0.13, NEGRO, 1, 1.25, 0.5), 0.17 * s, 1.28, 0.42); m.rotation.z = -0.4 * s; cuerpo.add(m); });
    [-1, 1].forEach(s => {
      const g = new T.Group(); g.position.set(ojoX * s, ojoY, ojoZ);
      g.add(esfera(0.115, BLANCO, 1, 1.1, 0.6));
      g.add(pos(esfera(0.068, NEGRO, 1, 1.1, 0.6), 0.01 * s, -0.005, 0.05));
      g.add(pos(esfera(0.024, BLANCO), 0.03 * s + 0.02, 0.035, 0.09));
      cuerpo.add(g); ud.ojos.push(g);
    });

    // mejillas
    if (a !== 'pinguino') [-1, 1].forEach(s => cuerpo.add(pos(esfera(0.06, ROSA, 1.3, 0.8, 0.4), 0.3 * s, 1.12, 0.41)));

    // hocico / pico / boca
    if (a === 'pinguino') {
      const pico = malla(new T.ConeGeometry(0.09, 0.22, 12), '#ffa62b');
      pico.rotation.x = Math.PI / 2; pos(pico, 0, 1.15, 0.55); cuerpo.add(pico);
    } else if (a === 'rana') {
      const boca = malla(new T.TorusGeometry(0.2, 0.022, 8, 24, Math.PI), oscurecer(col, 0.5));
      boca.rotation.z = Math.PI; pos(boca, 0, 1.28, 0.45); boca.rotation.x = -0.25; cuerpo.add(boca);
    } else {
      const largo = (a === 'perro' || a === 'zorro') ? 1.25 : 1;
      cuerpo.add(pos(esfera(0.14, a === 'zorro' || a === 'panda' ? BLANCO : aclarar(col, 0.5), 1.25, 0.85, 0.8 * largo), 0, 1.12, 0.44));
      cuerpo.add(pos(esfera(0.045, NEGRO, 1.3, 0.9, 1), 0, 1.17, 0.44 + 0.11 * largo));
    }

    // orejas
    function oreja(g, s) { cuerpo.add(g); ud.orejas.push(g); g.userData.lado = s; }
    const interior = ROSA;
    if (a === 'gato' || a === 'zorro') {
      const r = a === 'zorro' ? 0.18 : 0.15, h = a === 'zorro' ? 0.4 : 0.3;
      [-1, 1].forEach(s => {
        const g = new T.Group(); g.position.set(0.26 * s, TOPE - 0.12, 0.02); g.rotation.z = -0.35 * s;
        g.add(pos(malla(new T.ConeGeometry(r, h, 4), col), 0, h / 2, 0));
        g.add(pos(malla(new T.ConeGeometry(r * 0.55, h * 0.65, 4), a === 'zorro' ? BLANCO : interior), 0, h * 0.38, 0.06));
        if (a === 'zorro') g.add(pos(malla(new T.ConeGeometry(r * 0.38, h * 0.32, 4), NEGRO), 0, h * 0.86, 0));
        oreja(g, s);
      });
    } else if (a === 'conejo') {
      [-1, 1].forEach(s => {
        const g = new T.Group(); g.position.set(0.16 * s, TOPE - 0.08, 0); g.rotation.z = -0.15 * s;
        g.add(pos(malla(new T.CapsuleGeometry(0.09, 0.4, 6, 12), col), 0, 0.3, 0));
        const in_ = malla(new T.CapsuleGeometry(0.05, 0.32, 6, 12), interior); in_.position.set(0, 0.3, 0.06); g.add(in_);
        oreja(g, s);
      });
    } else if (a === 'perro') {
      [-1, 1].forEach(s => {
        const g = new T.Group(); g.position.set(0.4 * s, TOPE - 0.2, 0); g.rotation.z = 0.35 * s;
        g.add(pos(esfera(0.12, oscurecer(col, 0.3), 0.7, 1.9, 0.5), 0, -0.16, 0));
        oreja(g, s);
      });
    } else if (a === 'oso' || a === 'panda') {
      [-1, 1].forEach(s => {
        const g = new T.Group(); g.position.set(0.32 * s, TOPE - 0.13, 0);
        g.add(esfera(0.13, a === 'panda' ? NEGRO : col, 1, 1, 0.7));
        if (a === 'oso') g.add(pos(esfera(0.07, aclarar(col, 0.4), 1, 1, 0.5), 0, 0, 0.05));
        oreja(g, s);
      });
    }

    // cola
    let cola = null;
    if (a === 'gato') {
      const curva = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(0.1, 0.15, -0.2), new T.Vector3(0.05, 0.45, -0.3), new T.Vector3(0.18, 0.6, -0.22)]);
      cola = new T.Group(); cola.add(malla(new T.TubeGeometry(curva, 20, 0.05, 8), col));
    } else if (a === 'zorro') {
      cola = new T.Group();
      cola.add(pos(esfera(0.17, col, 1, 1, 2.2), 0, 0.12, -0.25));
      cola.add(pos(esfera(0.1, BLANCO, 1, 1, 1.2), 0, 0.18, -0.6));
      cola.children[0].rotation.x = 0.5;
    } else if (a === 'conejo') {
      cola = new T.Group(); cola.add(esfera(0.12, BLANCO));
    } else if (a === 'perro') {
      cola = new T.Group(); const p = malla(new T.CapsuleGeometry(0.05, 0.22, 6, 10), col); p.position.y = 0.12; cola.add(p); cola.rotation.x = -0.7;
    } else if (a === 'oso' || a === 'panda') {
      cola = new T.Group(); cola.add(esfera(0.08, a === 'panda' ? NEGRO : col));
    }
    if (cola) { cola.position.set(0, 0.6, -0.46); cuerpo.add(cola); ud.cola = cola; }

    // ---------- ropa ----------
    const sombrero = new T.Group(); sombrero.position.y = TOPE - (a === 'rana' ? 0.02 : 0.06); cuerpo.add(sombrero);
    const sm = cfg.sombrero;
    if (sm === 'gorra') {
      const domo = malla(new T.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#e63946'); domo.scale.y = 0.6; domo.position.y = -0.08; sombrero.add(domo);
      const vis = malla(new T.CylinderGeometry(0.3, 0.3, 0.03, 24, 1, false, -Math.PI / 2, Math.PI), '#e63946'); vis.position.set(0, -0.07, 0.3); vis.scale.z = 1.1; sombrero.add(vis);
      sombrero.add(pos(esfera(0.05, '#ffffff'), 0, 0.17, 0));
    } else if (sm === 'copa') {
      sombrero.add(pos(malla(new T.CylinderGeometry(0.42, 0.42, 0.04, 28), NEGRO), 0, 0, 0));
      sombrero.add(pos(malla(new T.CylinderGeometry(0.25, 0.27, 0.42, 28), NEGRO), 0, 0.22, 0));
      sombrero.add(pos(malla(new T.CylinderGeometry(0.275, 0.275, 0.09, 28), '#e63946'), 0, 0.07, 0));
    } else if (sm === 'corona') {
      const oro = '#ffcc33';
      sombrero.add(pos(malla(new T.CylinderGeometry(0.27, 0.25, 0.14, 24, 1, true), oro, { side: T.DoubleSide }), 0, 0.04, 0));
      for (let i = 0; i < 6; i++) {
        const an = i / 6 * Math.PI * 2; const p = malla(new T.ConeGeometry(0.06, 0.16, 8), oro);
        p.position.set(Math.sin(an) * 0.25, 0.18, Math.cos(an) * 0.25); sombrero.add(p);
        if (i % 2 === 0) sombrero.add(pos(esfera(0.03, '#e63946'), Math.sin(an) * 0.27, 0.05, Math.cos(an) * 0.27));
      }
    } else if (sm === 'fiesta') {
      const cono = malla(new T.ConeGeometry(0.2, 0.5, 24), '#7b5cff'); cono.position.y = 0.22; sombrero.add(cono);
      [0.05, 0.2, 0.35].forEach((y, i) => { const r = malla(new T.TorusGeometry(0.2 * (1 - (y + 0.03) / 0.5) + 0.005, 0.02, 6, 24), ['#ffd93d', '#2ed3c6', '#ff4d6d'][i]); r.rotation.x = Math.PI / 2; r.position.y = y; sombrero.add(r); });
      sombrero.add(pos(esfera(0.07, '#ffd93d'), 0, 0.5, 0));
    } else if (sm === 'vikingo') {
      const domo = malla(new T.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#9aa5b1'); domo.scale.y = 0.75; domo.position.y = -0.1; sombrero.add(domo);
      const banda = malla(new T.TorusGeometry(0.39, 0.035, 8, 28), '#c8935a'); banda.rotation.x = Math.PI / 2; banda.position.y = -0.07; sombrero.add(banda);
      [-1, 1].forEach(s => { const c2 = malla(new T.ConeGeometry(0.08, 0.35, 12), '#fff3d6'); c2.position.set(0.42 * s, 0.12, 0); c2.rotation.z = -1.0 * s; sombrero.add(c2); });
    } else if (sm === 'vaquero') {
      const ala = malla(new T.CylinderGeometry(0.6, 0.6, 0.04, 32), '#a0522d'); ala.scale.z = 0.85; sombrero.add(ala);
      sombrero.add(pos(malla(new T.CylinderGeometry(0.24, 0.3, 0.3, 24), '#a0522d'), 0, 0.15, 0));
      sombrero.add(pos(malla(new T.CylinderGeometry(0.305, 0.305, 0.06, 24), '#3b2414'), 0, 0.05, 0));
    } else if (sm === 'aureola') {
      const h = malla(new T.TorusGeometry(0.28, 0.04, 10, 32), '#ffe066', { emissive: '#ffcc00', emissiveIntensity: 0.7 }); h.rotation.x = Math.PI / 2; h.position.y = 0.3; sombrero.add(h); ud.aureola = h;
    } else if (sm === 'chef') {
      sombrero.add(pos(malla(new T.CylinderGeometry(0.28, 0.28, 0.25, 24), BLANCO), 0, 0.08, 0));
      [[0, 0.32, 0, 0.24], [-0.16, 0.28, 0, 0.17], [0.16, 0.28, 0, 0.17], [0, 0.28, 0.14, 0.17], [0, 0.28, -0.14, 0.17]].forEach(v => sombrero.add(pos(esfera(v[3], BLANCO), v[0], v[1], v[2])));
    }

    const gafas = new T.Group(); gafas.position.set(0, ojoY, ojoZ + 0.07); cuerpo.add(gafas);
    const gf = cfg.gafas;
    if (gf === 'sol') {
      [-1, 1].forEach(s => { const l = malla(new T.CylinderGeometry(0.13, 0.11, 0.03, 20), '#111', { emissive: '#222244' }); l.rotation.x = Math.PI / 2; l.position.x = ojoX * s; gafas.add(l); });
      gafas.add(pos(malla(new T.BoxGeometry(0.12, 0.025, 0.02), '#111'), 0, 0.03, 0));
    } else if (gf === 'redondas') {
      [-1, 1].forEach(s => { const r = malla(new T.TorusGeometry(0.12, 0.018, 8, 24), '#c9a227'); r.position.x = ojoX * s; gafas.add(r); });
      gafas.add(pos(malla(new T.BoxGeometry(0.1, 0.018, 0.018), '#c9a227'), 0, 0.02, 0));
    } else if (gf === 'visor') {
      const v = malla(new T.CylinderGeometry(0.47, 0.47, 0.16, 32, 1, true, -1.0, 2.0), '#2ed3c6', { transparent: true, opacity: 0.85, emissive: '#0a7f78', side: T.DoubleSide });
      v.position.set(0, 0, -ojoZ - 0.02); gafas.add(v);
    } else if (gf === 'corazon') {
      const forma = new T.Shape(); forma.moveTo(0, -0.1); forma.bezierCurveTo(-0.16, 0.0, -0.12, 0.13, 0, 0.06); forma.bezierCurveTo(0.12, 0.13, 0.16, 0.0, 0, -0.1);
      [-1, 1].forEach(s => { const h = malla(new T.ExtrudeGeometry(forma, { depth: 0.03, bevelEnabled: false }), '#ff2e63', { emissive: '#7a0020' }); h.position.set(ojoX * s, 0, 0); h.scale.setScalar(1.3); gafas.add(h); });
    }

    const acc = cfg.accesorio;
    if (acc === 'mochila') {
      const m = malla(new T.BoxGeometry(0.5, 0.55, 0.25, 2, 2, 2), '#3a86ff'); m.position.set(0, 0.95, -0.5); cuerpo.add(m);
      cuerpo.add(pos(malla(new T.BoxGeometry(0.36, 0.2, 0.06), '#2667cc'), 0, 0.82, -0.64));
    } else if (acc === 'capa') {
      const capa = malla(new T.CylinderGeometry(0.42, 0.62, 0.95, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8), '#d62828', { side: T.DoubleSide });
      capa.position.set(0, 0.72, -0.04); cuerpo.add(capa); ud.capa = capa;
    } else if (acc === 'bufanda') {
      const b = malla(new T.TorusGeometry(0.43, 0.08, 10, 28), '#ffd93d'); b.rotation.x = Math.PI / 2; b.position.y = 1.0; b.scale.set(1.05, 1.05, 1); cuerpo.add(b);
      const tira = malla(new T.BoxGeometry(0.14, 0.38, 0.06), '#ffd93d'); tira.position.set(0.22, 0.8, 0.47); tira.rotation.z = 0.15; cuerpo.add(tira);
      [0.88, 0.72].forEach(y => cuerpo.add(pos(malla(new T.BoxGeometry(0.15, 0.04, 0.07), '#e63946'), 0.21 + (0.88 - y) * 0.15, y, 0.47)));
    } else if (acc === 'corbatin') {
      [-1, 1].forEach(s => { const c3 = malla(new T.ConeGeometry(0.09, 0.16, 12), '#e63946'); c3.rotation.z = Math.PI / 2 * s; c3.position.set(0.08 * s, 1.0, 0.5); cuerpo.add(c3); });
      cuerpo.add(pos(esfera(0.045, '#b5172a'), 0, 1.0, 0.52));
    } else if (acc === 'cadena') {
      const cd = malla(new T.TorusGeometry(0.3, 0.025, 8, 32), '#ffcc33', { emissive: '#6b4f00' }); cd.position.set(0, 0.92, 0.3); cd.rotation.x = 1.2; cuerpo.add(cd);
      const med = pos(malla(new T.CylinderGeometry(0.08, 0.08, 0.03, 16), '#ffcc33', { emissive: '#6b4f00' }), 0, 0.74, 0.5);
      med.rotation.x = Math.PI / 2; cuerpo.add(med);
    }

    // sombra suave falsa (para móviles sin sombras)
    const sombra = new T.Mesh(new T.CircleGeometry(0.5, 24), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.01; raiz.add(sombra); ud.sombra = sombra;

    return raiz;
  }

  // animación: modo 'quieto' | 'baile' | 'caminar'
  function animar(p, dt, modo) {
    const u = p.userData; u.t += dt; const t = u.t;
    const c = u.cuerpo;
    if (modo === 'caminar') {
      c.position.y = Math.abs(Math.sin(t * 10)) * 0.08;
      c.rotation.z = Math.sin(t * 10) * 0.06;
      u.piernas.forEach((l, i) => l.rotation.x = Math.sin(t * 10 + i * Math.PI) * 0.7);
      u.brazos.forEach((b, i) => b.rotation.x = Math.sin(t * 10 + i * Math.PI + Math.PI) * 0.6);
    } else if (modo === 'baile') {
      c.position.y = Math.abs(Math.sin(t * 6)) * 0.12;
      c.rotation.z = Math.sin(t * 3) * 0.12;
      c.rotation.y = Math.sin(t * 1.5) * 0.25;
      u.brazos.forEach((b, i) => b.rotation.z = (i === 0 ? -1 : 1) * (0.35 + 1.4 * Math.max(0, Math.sin(t * 6 + i * Math.PI))));
      u.piernas.forEach((l, i) => l.rotation.x = Math.max(0, Math.sin(t * 6 + i * Math.PI)) * -0.4);
    } else {
      c.position.y *= 0.85; c.rotation.z *= 0.9; c.rotation.y *= 0.9;
      c.scale.y = 1 + Math.sin(t * 2.2) * 0.02; c.scale.x = c.scale.z = 1 - Math.sin(t * 2.2) * 0.01;
      u.brazos.forEach((b, i) => { b.rotation.x = Math.sin(t * 2.2) * 0.08; b.rotation.z = (i === 0 ? -1 : 1) * (0.35 + Math.sin(t * 2.2) * 0.05); });
      u.piernas.forEach(l => l.rotation.x *= 0.85);
    }
    u.orejas.forEach(o => o.rotation.x = Math.sin(t * 3 + o.userData.lado) * 0.08);
    if (u.cola) u.cola.rotation.y = Math.sin(t * 4) * 0.4;
    if (u.aureola) u.aureola.rotation.z = t;
    if (u.capa) u.capa.rotation.x = modo === 'caminar' ? -0.25 : Math.sin(t * 2) * 0.04;
    // parpadeo
    u.parpadeo -= dt;
    const cerr = u.parpadeo < 0.12 && u.parpadeo > 0;
    u.ojos.forEach(o => o.scale.y = cerr ? 0.1 : 1);
    if (u.parpadeo <= 0) u.parpadeo = 2 + Math.random() * 3.5;
  }

  function liberar(p) {
    p.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }

  window.Zoo = { ANIMALES, COLORES, SOMBREROS, GAFAS, ACCESORIOS, crear, animar, liberar };
})();
