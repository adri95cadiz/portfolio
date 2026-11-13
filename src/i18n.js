// Runtime strings for JS-rendered UI (game, drum machine, achievements, form). The page itself is
// pre-rendered per language at build time: / is Spanish, /en/ is English (see vite.config.js + i18n-page.js).
export const lang = document.documentElement.lang === 'en' ? 'en' : 'es';

/** JS-generated strings, both languages. */
const STRINGS = {
  es: {
    'ach.unlocked': 'Logro desbloqueado', 'ach.locked': 'Bloqueado', 'ach.keep': 'Sigue explorando.',
    'ach.start.t': 'Pulsa Start', 'ach.start.d': 'Empezaste el viaje.',
    'ach.boss.t': 'Jefe de proyecto', 'ach.boss.d': 'Saludaste al perro.',
    'ach.tuner.t': 'Ingeniero de señal', 'ach.tuner.d': 'Probaste las cuatro formas de onda.',
    'ach.beat.t': 'Primer beat', 'ach.beat.d': 'Le diste al play de la ATH-16.',
    'ach.producer.t': 'Productor', 'ach.producer.d': 'Programaste tu propio patrón.',
    'ach.glitch.t': 'Experimental', 'ach.glitch.d': 'Llevaste el glitch al máximo.',
    'ach.pilot.t': 'Piloto', 'ach.pilot.d': 'Más de 100 puntos en Signal Run.',
    'ach.explorer.t': 'Explorador', 'ach.explorer.d': 'Recorriste todos los capítulos.',
    'ach.demolition.t': 'Demolición', 'ach.demolition.d': 'Rompiste 5 cosas del fondo a disparos.',
    'ach.konami.t': '↑↑↓↓←→←→BA', 'ach.konami.d': 'Modo 8 bits desbloqueado.',
    'ach.contact.t': 'Fin de partida', 'ach.contact.d': 'Me enviaste un mensaje. Gracias.',
    'mc.subtitle': 'Caja de ritmos + sinte mono', 'mc.mutate': 'Mutar bajo', 'mc.bass': 'Bajo', 'mc.step': 'paso',
    'mc.presets': 'Patrones', 'mc.wave': 'Forma de onda', 'mc.keys': 'Teclado del sinte',
    'game.hint': 'Mantén pulsado para volar · recoge tecnologías · esquiva los bugs',
    'game.press': 'PULSA ESPACIO O TOCA PARA EMPEZAR', 'game.lost': 'SEÑAL PERDIDA', 'game.points': 'PUNTOS',
    'game.techs': 'TECNOLOGÍAS', 'game.combo': 'MEJOR COMBO', 'game.zone': 'ZONA', 'game.best': 'RÉCORD',
    'game.newBest': '¡NUEVO RÉCORD!', 'game.noMusic': 'SIN MÚSICA', 'game.near': '¡ROZANDO! +5', 'game.saved': '¡SALVADO!',
    'game.retry': 'Reintentar', 'game.play': 'Jugar', 'game.musicOn': 'Música: DnB', 'game.musicOff': 'Música: off',
    'game.running': 'Partida en marcha.',
    'game.over': 'Señal perdida. {score} puntos, {orbs} tecnologías, mejor combo ×{combo}. Récord: {best}.',
    'zone.Origen': 'Origen', 'zone.Oficio': 'Oficio', 'zone.Laboratorio': 'Laboratorio', 'zone.Athetosis': 'Athetosis', 'zone.Producción': 'Producción',
    'form.invalid': 'Revisa los campos marcados: nombre, un email válido y al menos 20 caracteres sobre el proyecto.',
    'form.sending': 'Enviando…', 'form.ok': '¡Recibido! Te respondo en cuanto lo lea, normalmente en 24–48 h.',
    'form.rate': 'Demasiados envíos seguidos. Prueba en unos minutos.', 'form.fail': 'No he podido enviar el mensaje.',
    'form.fallback': 'Escríbeme a', 'spotify.title': 'Reproductor de Spotify de Athetosis', 'spotify.open': 'Abrir en Spotify',
    'lcd.msgs': 'Compilando ideas|Café nº 3|174 BPM en bucle|Respondo en 24 h|Perro: dormido|Sin bugs (creo)', 'lcd.coords': '40.4°N 3.7°W',
  },
  en: {
    'ach.unlocked': 'Achievement unlocked', 'ach.locked': 'Locked', 'ach.keep': 'Keep exploring.',
    'ach.start.t': 'Press Start', 'ach.start.d': 'You started the journey.',
    'ach.boss.t': 'Project manager', 'ach.boss.d': 'You said hi to the dog.',
    'ach.tuner.t': 'Signal engineer', 'ach.tuner.d': 'You tried all four waveforms.',
    'ach.beat.t': 'First beat', 'ach.beat.d': 'You hit play on the ATH-16.',
    'ach.producer.t': 'Producer', 'ach.producer.d': 'You programmed your own pattern.',
    'ach.glitch.t': 'Experimental', 'ach.glitch.d': 'You maxed out the glitch.',
    'ach.pilot.t': 'Pilot', 'ach.pilot.d': 'Over 100 points in Signal Run.',
    'ach.explorer.t': 'Explorer', 'ach.explorer.d': 'You visited every chapter.',
    'ach.demolition.t': 'Demolition', 'ach.demolition.d': 'You shot 5 things in the background to pieces.',
    'ach.konami.t': '↑↑↓↓←→←→BA', 'ach.konami.d': '8-bit mode unlocked.',
    'ach.contact.t': 'Game over', 'ach.contact.d': 'You sent me a message. Thank you.',
    'mc.subtitle': 'Drum machine + mono synth', 'mc.mutate': 'Mutate bass', 'mc.bass': 'Bass', 'mc.step': 'step',
    'mc.presets': 'Patterns', 'mc.wave': 'Waveform', 'mc.keys': 'Synth keyboard',
    'game.hint': 'Hold to fly · collect tech · dodge the bugs',
    'game.press': 'PRESS SPACE OR TAP TO START', 'game.lost': 'SIGNAL LOST', 'game.points': 'POINTS',
    'game.techs': 'TECH', 'game.combo': 'BEST COMBO', 'game.zone': 'ZONE', 'game.best': 'BEST',
    'game.newBest': 'NEW HIGH SCORE!', 'game.noMusic': 'NO MUSIC', 'game.near': 'CLOSE CALL! +5', 'game.saved': 'SAVED!',
    'game.retry': 'Try again', 'game.play': 'Play', 'game.musicOn': 'Music: DnB', 'game.musicOff': 'Music: off',
    'game.running': 'Game running.',
    'game.over': 'Signal lost. {score} points, {orbs} tech, best combo ×{combo}. High score: {best}.',
    'zone.Origen': 'Origin', 'zone.Oficio': 'Craft', 'zone.Laboratorio': 'Lab', 'zone.Athetosis': 'Athetosis', 'zone.Producción': 'Production',
    'form.invalid': 'Check the highlighted fields: your name, a valid email and at least 20 characters about the project.',
    'form.sending': 'Sending…', 'form.ok': 'Got it! I’ll reply as soon as I read it, usually within 24–48 h.',
    'form.rate': 'Too many messages in a row. Try again in a few minutes.', 'form.fail': 'I couldn’t send your message.',
    'form.fallback': 'Write to me at', 'spotify.title': 'Athetosis Spotify player', 'spotify.open': 'Open in Spotify',
    'lcd.msgs': 'Compiling ideas|Coffee no. 3|174 BPM on loop|Replies within 24 h|Dog: asleep|No bugs (I think)', 'lcd.coords': '40.4°N 3.7°W',
  },
};

/** @param {string} key  @param {Record<string, string|number>} [vars] */
export function t(key, vars) {
  let str = STRINGS[lang][key] ?? STRINGS.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
  return str;
}

const SWITCH_MS = 300; // let the toggle slide before the page changes

/** Hardware-style toggle: slides, remembers the choice, and keeps the current section (/#athetosis -> /en/#athetosis). */
export function initLangSwitch() {
  const box = document.querySelector('.lang');
  if (!box) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const a of box.querySelectorAll('a')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = a.getAttribute('hreflang');
      if (target === lang) return;
      try { localStorage.setItem('ap-lang', target); } catch { /* no storage */ }
      box.dataset.active = target;
      const url = a.getAttribute('href').split('#')[0] + location.hash;
      setTimeout(() => location.assign(url), reduce ? 0 : SWITCH_MS);
    });
  }
}
