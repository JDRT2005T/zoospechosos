// ZOOspechosos — partículas (humo, chispas, confeti, corazones…)
(function () {
  const T = THREE;
  const grupo = new T.Group(); grupo.renderOrder = 5;
  const vivas = [], libres = [];
  const texturas = {};

  function textura(tipo) {
    if (texturas[tipo]) return texturas[tipo];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    if (tipo === 'suave') {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    } else if (tipo === 'chispa') {
      g.translate(32, 32); g.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, -30); g.lineTo(5, 0); g.lineTo(0, 30); g.lineTo(-5, 0); g.fill(); }
    } else if (tipo === 'cuadro') {
      g.fillStyle = '#fff'; g.fillRect(16, 22, 32, 20);
    } else { // emoji
      g.font = '50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tipo, 32, 36);
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return texturas[tipo] = t;
  }

  function pedir() {
    let s = libres.pop();
    if (!s) { s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false })); grupo.add(s); }
    s.visible = true; return s;
  }

  // opciones: n, colores, tex, vel, arriba, grav, vida, tam, crecer, aditivo, giro, dispersion
  function rafaga(p, o) {
    o = Object.assign({ n: 12, colores: ['#ffffff'], tex: 'suave', vel: 2, arriba: 1, grav: 0, vida: 0.8, tam: 0.3, crecer: 1, aditivo: false, dispersion: 0.15, brillo: 1 }, o || {});
    const tex = textura(o.tex);
    for (let i = 0; i < o.n; i++) {
      const s = pedir();
      const m = s.material;
      m.map = tex; m.blending = o.aditivo ? T.AdditiveBlending : T.NormalBlending;
      m.color.set(o.colores[i % o.colores.length]).multiplyScalar(o.brillo);
      m.rotation = Math.random() * Math.PI * 2; m.needsUpdate = true;
      const a = Math.random() * Math.PI * 2, el = Math.random() * 0.8 + 0.2;
      s.position.set(p.x + (Math.random() - 0.5) * o.dispersion, p.y + (Math.random() - 0.5) * o.dispersion, p.z + (Math.random() - 0.5) * o.dispersion);
      const v = o.vel * (0.4 + Math.random() * 0.8);
      s.userData = {
        vx: Math.cos(a) * v * (1 - el * 0.5), vy: o.arriba * v * el, vz: Math.sin(a) * v * (1 - el * 0.5),
        grav: o.grav, vida: o.vida * (0.7 + Math.random() * 0.6), t: 0, tam: o.tam * (0.7 + Math.random() * 0.6), crecer: o.crecer,
        giro: (Math.random() - 0.5) * (o.giro || 0),
      };
      s.scale.setScalar(s.userData.tam);
      vivas.push(s);
    }
  }

  function actualizar(dt) {
    for (let i = vivas.length - 1; i >= 0; i--) {
      const s = vivas[i], u = s.userData;
      u.t += dt;
      const k = u.t / u.vida;
      if (k >= 1) { s.visible = false; vivas.splice(i, 1); libres.push(s); continue; }
      u.vy -= u.grav * dt;
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      if (s.position.y < 0.03 && u.grav) { s.position.y = 0.03; u.vy *= -0.3; u.vx *= 0.7; u.vz *= 0.7; }
      u.vx *= 0.98; u.vz *= 0.98;
      s.scale.setScalar(u.tam * (1 + (u.crecer - 1) * k));
      s.material.opacity = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      s.material.rotation += u.giro * dt;
    }
  }

  // efectos ya armados
  const E = {
    humo: p => rafaga(p, { n: 16, colores: ['#e9e4ff', '#cfc6ef', '#ffffff'], vel: 1.4, arriba: 0.6, vida: 0.9, tam: 0.55, crecer: 2.2, dispersion: 0.5 }),
    impacto: p => { rafaga(p, { n: 18, colores: ['#ffd93d', '#ff7b00', '#ffffff'], tex: 'chispa', vel: 5, arriba: 1, vida: 0.5, tam: 0.35, aditivo: true, brillo: 2.5, giro: 8 }); rafaga(p, { n: 6, colores: ['#ffffff'], vel: 0.5, vida: 0.35, tam: 1.2, crecer: 2, aditivo: true, brillo: 2 }); },
    chispas: p => rafaga(p, { n: 14, colores: ['#ffd93d', '#2ee6d6', '#ffffff'], tex: 'chispa', vel: 3, arriba: 1.2, vida: 0.6, tam: 0.28, aditivo: true, brillo: 2.5, giro: 6 }),
    corazones: p => rafaga(p, { n: 7, tex: '💖', vel: 1, arriba: 1.6, vida: 1.4, tam: 0.35, crecer: 1.3, dispersion: 0.6 }),
    confeti: p => rafaga(p, { n: 40, colores: ['#ff3d9a', '#2ee6d6', '#ffd93d', '#8b5cff', '#5effa0'], tex: 'cuadro', vel: 4, arriba: 1.6, grav: 7, vida: 1.8, tam: 0.14, giro: 10, brillo: 1.4 }),
    polvo: p => rafaga(p, { n: 2, colores: ['#cbb8ff'], vel: 0.4, arriba: 0.3, vida: 0.5, tam: 0.18, crecer: 1.8, dispersion: 0.2 }),
    notas: p => rafaga(p, { n: 3, tex: '🎵', vel: 0.8, arriba: 1.4, vida: 1.2, tam: 0.3, dispersion: 0.5 }),
    caida: p => rafaga(p, { n: 12, colores: ['#e9e4ff', '#ffffff'], vel: 2.2, arriba: 0.25, vida: 0.6, tam: 0.35, crecer: 1.8, dispersion: 0.3 }),
  };

  // haz de luz de discoteca (cono que se desvanece hacia abajo)
  let texHaz = null;
  function haz(color, largo, ancho, fuerza) {
    if (!texHaz) {
      const c = document.createElement('canvas'); c.width = 4; c.height = 128;
      const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
      texHaz = new T.CanvasTexture(c);
    }
    const geo = new T.CylinderGeometry(0.06, ancho, largo, 32, 1, true);
    geo.translate(0, -largo / 2, 0); // la punta queda arriba, en el origen
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(fuerza || 0.35), map: texHaz, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.renderOrder = 4;
    // la textura va de arriba (brilla) hacia abajo (se apaga)
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    return m;
  }

  window.Part = Object.assign({ grupo, rafaga, actualizar, haz }, E);
})();
