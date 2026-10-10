// ZOOspechosos — instalar como app
(function () {
  const $$ = s => [...document.querySelectorAll(s)];
  const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let aviso = null;

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    const registrar = () => navigator.serviceWorker.register('sw.js').catch(() => { });
    if (document.readyState === 'complete') registrar(); else addEventListener('load', registrar);
  }

  function mostrar(ver) { $$('[data-instalar]').forEach(b => b.hidden = !ver); }
  mostrar(false);
  if (instalada()) return;
  if (ios) mostrar(true); // en iPhone no hay aviso automático: mostramos cómo hacerlo

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); aviso = e; mostrar(true); });
  addEventListener('appinstalled', () => {
    aviso = null; mostrar(false);
    if (window.ZooApp) ZooApp.toast('¡ZOOspechosos instalado! 🎉 Búscalo en tu pantalla de inicio');
  });

  $$('[data-instalar]').forEach(b => b.addEventListener('click', async () => {
    if (aviso) {
      aviso.prompt();
      const r = await aviso.userChoice.catch(() => null);
      if (r && r.outcome === 'accepted') mostrar(false);
      aviso = null;
      return;
    }
    document.getElementById('pasos-ios').hidden = !ios;
    document.getElementById('pasos-android').hidden = ios;
    document.getElementById('m-instalar').classList.add('activa');
  }));
})();

// ZOOspechosos — siempre en horizontal
(function () {
  const movil = matchMedia('(pointer: coarse)').matches;
  if (!movil) return;
  const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  async function horizontal() {
    if (innerWidth > innerHeight) return;
    try {
      // en el navegador, Android solo deja girar en pantalla completa (y después de un toque)
      if (!instalada() && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (e) { /* iPhone u otros: se muestra el aviso de girar */ }
  }
  horizontal();
  addEventListener('pointerdown', horizontal, true);
})();
