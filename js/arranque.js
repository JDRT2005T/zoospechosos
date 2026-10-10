// ZOOspechosos — arranque: carga Three.js (módulos) con sus efectos y después el juego
import * as THREE from 'three';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from '../vendor/jsm/environments/RoomEnvironment.js';

window.__zooModulo = true; // los módulos cargaron bien (el plan B no hace falta)
window.THREE = THREE;
window.POST = { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, RoomEnvironment };

const ARCHIVOS = ['vendor/supabase.js', 'js/personaje.js', 'js/particulas.js', 'js/app.js', 'js/salon.js', 'js/mansion.js', 'js/sala.js', 'js/misiones.js', 'js/sabotaje.js', 'js/juego.js', 'js/reunion.js', 'js/caceria.js', 'js/pwa.js'];
const cargar = src => new Promise((ok, mal) => {
  const s = document.createElement('script');
  s.src = src + '?v=' + window.ZOO_VERSION; s.async = false; s.onload = ok; s.onerror = () => mal(new Error('No cargó ' + src));
  document.body.appendChild(s);
});
for (const src of ARCHIVOS) await cargar(src);
