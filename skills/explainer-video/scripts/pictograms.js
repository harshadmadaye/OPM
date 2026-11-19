'use strict';
// 24 stroke-only pictogram line icons, each drawn inside a 100x100 box using
// only path, rect, circle, line, polyline and ellipse.

const ICONS = Object.freeze({
  calendar:
    '<rect x="15" y="20" width="70" height="65" rx="6"/>' +
    '<line x1="15" y1="38" x2="85" y2="38"/>' +
    '<line x1="30" y1="12" x2="30" y2="26"/>' +
    '<line x1="70" y1="12" x2="70" y2="26"/>',

  camera:
    '<rect x="12" y="30" width="76" height="55" rx="8"/>' +
    '<rect x="38" y="18" width="24" height="14" rx="3"/>' +
    '<circle cx="50" cy="58" r="16"/>',

  chart:
    '<line x1="15" y1="85" x2="85" y2="85"/>' +
    '<rect x="25" y="55" width="14" height="30"/>' +
    '<rect x="45" y="40" width="14" height="45"/>' +
    '<rect x="65" y="25" width="14" height="60"/>',

  chat:
    '<rect x="15" y="20" width="70" height="45" rx="12"/>' +
    '<polyline points="30,65 30,82 48,65"/>',

  check:
    '<circle cx="50" cy="50" r="38"/>' +
    '<polyline points="32,52 45,65 70,35"/>',

  clock:
    '<circle cx="50" cy="50" r="38"/>' +
    '<line x1="50" y1="50" x2="50" y2="26"/>' +
    '<line x1="50" y1="50" x2="68" y2="58"/>',

  cross:
    '<circle cx="50" cy="50" r="38"/>' +
    '<line x1="36" y1="36" x2="64" y2="64"/>' +
    '<line x1="64" y1="36" x2="36" y2="64"/>',

  deck:
    '<rect x="15" y="15" width="70" height="48" rx="4"/>' +
    '<line x1="50" y1="63" x2="50" y2="80"/>' +
    '<line x1="32" y1="80" x2="68" y2="80"/>',

  document:
    '<path d="M25 10 h35 l15 15 v65 h-50 z"/>' +
    '<line x1="35" y1="45" x2="65" y2="45"/>' +
    '<line x1="35" y1="58" x2="65" y2="58"/>' +
    '<line x1="35" y1="71" x2="55" y2="71"/>',

  email:
    '<rect x="12" y="25" width="76" height="50" rx="6"/>' +
    '<polyline points="14,28 50,58 86,28"/>',

  handshake:
    '<path d="M10 60 L40 40 L50 50 L60 40 L90 60"/>' +
    '<path d="M42 48 q8 10 16 0"/>',

  laptop:
    '<rect x="22" y="15" width="56" height="40" rx="3"/>' +
    '<path d="M12 70 h76 l-8 12 h-60 z"/>',

  link:
    '<rect x="15" y="35" width="40" height="24" rx="12" transform="rotate(-30 35 47)"/>' +
    '<rect x="45" y="35" width="40" height="24" rx="12" transform="rotate(-30 65 47)"/>',

  lock:
    '<rect x="22" y="45" width="56" height="42" rx="6"/>' +
    '<path d="M32 45 v-12 a18 18 0 0 1 36 0 v12"/>' +
    '<circle cx="50" cy="65" r="5"/>',

  megaphone:
    '<path d="M20 40 L70 20 V80 L20 60 Z"/>' +
    '<rect x="12" y="42" width="8" height="16"/>' +
    '<path d="M78 35 q8 15 0 30"/>',

  money:
    '<circle cx="50" cy="50" r="32"/>' +
    '<line x1="34" y1="50" x2="66" y2="50"/>',

  people:
    '<circle cx="35" cy="30" r="13"/>' +
    '<path d="M10 86 a25 25 0 0 1 50 0"/>' +
    '<circle cx="65" cy="30" r="13"/>' +
    '<path d="M40 86 a25 25 0 0 1 50 0"/>',

  person:
    '<circle cx="50" cy="30" r="16"/>' +
    '<path d="M18 88 a32 32 0 0 1 64 0"/>',

  phone:
    '<rect x="30" y="10" width="40" height="80" rx="8"/>' +
    '<line x1="42" y1="22" x2="58" y2="22"/>',

  search:
    '<circle cx="42" cy="42" r="24"/>' +
    '<line x1="60" y1="60" x2="82" y2="82"/>',

  sheet:
    '<rect x="15" y="15" width="70" height="70"/>' +
    '<line x1="15" y1="38" x2="85" y2="38"/>' +
    '<line x1="15" y1="61" x2="85" y2="61"/>' +
    '<line x1="38" y1="15" x2="38" y2="85"/>' +
    '<line x1="61" y1="15" x2="61" y2="85"/>',

  star:
    '<path d="M50 12 L61 38 L90 40 L67 58 L75 86 L50 70 L25 86 L33 58 L10 40 L39 38 Z"/>',

  video:
    '<rect x="12" y="20" width="76" height="60" rx="8"/>' +
    '<path d="M42 36 l24 14 l-24 14 z"/>',

  warning:
    '<path d="M50 12 L90 85 H10 Z"/>' +
    '<line x1="50" y1="38" x2="50" y2="60"/>' +
    '<circle cx="50" cy="70" r="2.5"/>',
});

const NAMES = Object.freeze(Object.keys(ICONS).sort());

function names() {
  return NAMES.slice();
}

function has(name) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

function pictogram(name, { x, y, size = 100, color, strokeWidth = 6 }) {
  const body = ICONS[name];
  if (body === undefined) {
    throw new Error(`unknown pictogram: ${name}`);
  }
  return `<g transform="translate(${x} ${y}) scale(${size / 100})" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

module.exports = { names, has, pictogram };
