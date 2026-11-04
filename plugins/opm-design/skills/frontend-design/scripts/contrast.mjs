#!/usr/bin/env node
// WCAG 2.2 contrast ratio and CIE76 colour distance for hex colours. Zero dependencies.
// Usage: node contrast.mjs <foreground> <background> [--large]
//        node contrast.mjs --delta <hexA> <hexB>
import { isMain } from '../../../shared/is-main.mjs';

export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
export const SAME_COLOUR_DELTA_E = 3;
const EXIT = Object.freeze({ pass: 0, fail: 1, usage: 2 });
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const D65_WHITE = Object.freeze({ x: 0.95047, y: 1, z: 1.08883 });
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

export function isHex(value) {
  return typeof value === 'string' && HEX.test(value);
}

export function parseHex(hex) {
  if (!isHex(hex)) throw new Error(`"${hex}" is not a hex colour like #1A1A1A or #FFF`);
  const digits = hex.length === 4 ? [...hex.slice(1)].map((d) => d + d).join('') : hex.slice(1);
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

function toLinear(channel) {
  const s = channel / 255;
  return s <= SRGB_LINEAR_THRESHOLD ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function passesAA(ratio, { isLargeText = false } = {}) {
  return ratio >= (isLargeText ? AA_LARGE_TEXT : AA_NORMAL_TEXT);
}

const labF = (t) => (t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116);

function toLab(hex) {
  const { r, g, b } = parseHex(hex);
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const fx = labF((0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / D65_WHITE.x);
  const fy = labF((0.2126 * lr + 0.7152 * lg + 0.0722 * lb) / D65_WHITE.y);
  const fz = labF((0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / D65_WHITE.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE76(hexA, hexB) {
  const p = toLab(hexA);
  const q = toLab(hexB);
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}

export function runCli(argv) {
  if (argv[0] === '--delta') {
    const distance = deltaE76(argv[1], argv[2]);
    const verdict = distance < SAME_COLOUR_DELTA_E ? 'same colour, merge' : 'distinct';
    return { code: EXIT.pass, out: `ΔE ${distance.toFixed(2)} (${verdict})` };
  }
  const [foreground, background] = argv.filter((a) => !a.startsWith('--'));
  const isLargeText = argv.includes('--large');
  const ratio = contrastRatio(foreground, background);
  const needed = isLargeText ? AA_LARGE_TEXT : AA_NORMAL_TEXT;
  const isPass = passesAA(ratio, { isLargeText });
  return { code: isPass ? EXIT.pass : EXIT.fail, out: `${ratio.toFixed(2)}:1 ${isPass ? 'PASS' : 'FAIL'} (needs ${needed}:1)` };
}

if (isMain(import.meta.url)) {
  try {
    const { code, out } = runCli(process.argv.slice(2));
    console.log(out);
    process.exitCode = code;
  } catch (error) {
    console.error(`contrast: ${error.message}`);
    process.exitCode = EXIT.usage;
  }
}
