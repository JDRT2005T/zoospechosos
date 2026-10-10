// ZOOspechosos — service worker (app instalable)
// Páginas y código: primero internet (para tener siempre lo último), si no hay, lo guardado.
// Librerías, íconos y fuentes: lo guardado primero (no cambian).
// Nunca guarda nada de Supabase (cuentas, salas, tiempo real).
const CACHE = 'zoo-v10'; // cambiar si cambian vendor/ o iconos/
const BASE = ['./', 'index.html', 'css/estilo.css', 'js/arranque.js', 'js/personaje.js', 'js/particulas.js', 'js/app.js', 'js/salon.js', 'js/mansion.js', 'js/sala.js', 'js/misiones.js', 'js/sabotaje.js', 'js/juego.js', 'js/reunion.js', 'js/pwa.js',
  'vendor/three.module.js', 'vendor/jsm/postprocessing/EffectComposer.js', 'vendor/jsm/postprocessing/RenderPass.js', 'vendor/jsm/postprocessing/UnrealBloomPass.js', 'vendor/jsm/postprocessing/OutputPass.js', 'vendor/jsm/postprocessing/ShaderPass.js', 'vendor/jsm/postprocessing/MaskPass.js', 'vendor/jsm/postprocessing/Pass.js', 'vendor/jsm/shaders/CopyShader.js', 'vendor/jsm/shaders/LuminosityHighPassShader.js', 'vendor/jsm/shaders/OutputShader.js', 'vendor/jsm/environments/RoomEnvironment.js', 'vendor/supabase.js', 'manifest.webmanifest', 'iconos/icono-192.png', 'iconos/icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fuentes = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fuentes) return; // Supabase y demás: directo a internet
  const fijo = fuentes || /\/(vendor|iconos)\//.test(url.pathname);
  if (fijo) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { // siempre pregunta si hay versión nueva
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
