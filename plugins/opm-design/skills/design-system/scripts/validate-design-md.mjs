#!/usr/bin/env node
// Validates DESIGN.md: required token groups, hex colours, text and surface roles, F-01 contrast.
// The frontmatter is a YAML subset: nested maps with 2-space indents and scalar values.
// Usage: node validate-design-md.mjs [path/to/DESIGN.md]
import fs from 'node:fs';
import { isMain } from '../../../shared/is-main.mjs';
import { isHex, contrastRatio, AA_NORMAL_TEXT } from '../../frontend-design/scripts/contrast.mjs';

export const REQUIRED_GROUPS = Object.freeze(['colors', 'typography', 'spacing', 'radius']);
export const REQUIRED_ROLES = Object.freeze(['text', 'surface']);
const KEY_LINE = /^( *)([A-Za-z0-9_.-]+):(?: +(.*))?$/;
const INDENT_STEP = 2;
const FRONTMATTER_FENCE = '---';
const FIRST_TOKEN_LINE = 2;

export class DesignFormatError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

function scalar(value, line) {
  if (/^(['"]).*\1$/.test(value)) return value.slice(1, -1);
  if (value.startsWith('#')) throw new DesignFormatError(`quote values that start with "#", for example "${value}"`, line);
  if (/^[[{]/.test(value)) throw new DesignFormatError('flow style ({...} or [...]) is not supported; use nested keys', line);
  return value;
}

export function parseYamlSubset(source, firstLine = 1) {
  const root = {};
  const stack = [{ indent: -INDENT_STEP, node: root }];
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = firstLine + index;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = raw.match(KEY_LINE);
    if (!match) throw new DesignFormatError(`expected "key: value", got "${trimmed}"`, line);
    const [, spaces, key, rawValue] = match;
    const indent = spaces.length;
    while (stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (indent !== parent.indent + INDENT_STEP) throw new DesignFormatError(`unexpected indent; nest with ${INDENT_STEP} spaces`, line);
    if (Object.prototype.hasOwnProperty.call(parent.node, key)) throw new DesignFormatError(`duplicate key "${key}"`, line);
    const value = (rawValue || '').trim();
    if (value) {
      parent.node[key] = scalar(value, line);
      return;
    }
    const child = {};
    parent.node[key] = child;
    stack.push({ indent, node: child });
  });
  return root;
}

export function parseDesignMd(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== FRONTMATTER_FENCE) throw new DesignFormatError('DESIGN.md must start with a --- frontmatter line', 1);
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === FRONTMATTER_FENCE);
  if (end === -1) throw new DesignFormatError('frontmatter has no closing --- line', 1);
  return {
    tokens: parseYamlSubset(lines.slice(1, end).join('\n'), FIRST_TOKEN_LINE),
    body: lines.slice(end + 1).join('\n'),
  };
}

const isMap = (value) => value !== null && typeof value === 'object';

export function findRole(colors, role) {
  return Object.entries(colors).find(([, c]) => isMap(c) && String(c.role || '').trim().toLowerCase() === role);
}

export function textSurfaceContrast(colors) {
  const text = findRole(colors, 'text');
  const surface = findRole(colors, 'surface');
  if (!text || !surface || !isHex(text[1].value) || !isHex(surface[1].value)) return null;
  return { text: text[0], surface: surface[0], ratio: contrastRatio(text[1].value, surface[1].value) };
}

function colourViolations(colors) {
  return Object.entries(colors).flatMap(([name, colour]) => {
    if (!isMap(colour)) return [{ rule: `colour "${name}" is not a map`, fix: 'give it "value" and "role" keys' }];
    const problems = [];
    if (!isHex(colour.value)) {
      problems.push({ rule: `colour "${name}" value "${colour.value ?? ''}" is not a hex colour`, fix: 'use #RGB or #RRGGBB in quotes' });
    }
    if (!colour.role) {
      problems.push({ rule: `colour "${name}" has no role`, fix: 'add a role named by purpose, such as text, surface or Primary action' });
    }
    return problems;
  });
}

export function validateTokens(tokens) {
  const violations = REQUIRED_GROUPS.filter((group) => !isMap(tokens[group]))
    .map((group) => ({ rule: `missing token group "${group}"`, fix: `add a "${group}:" map to the frontmatter` }));
  if (!isMap(tokens.colors)) return violations;
  violations.push(...colourViolations(tokens.colors));
  for (const role of REQUIRED_ROLES) {
    if (!findRole(tokens.colors, role)) violations.push({ rule: `no colour has role "${role}"`, fix: `mark one colour with role: ${role}` });
  }
  const pair = textSurfaceContrast(tokens.colors);
  if (pair && pair.ratio < AA_NORMAL_TEXT) {
    violations.push({
      rule: `F-01 text "${pair.text}" on surface "${pair.surface}" is ${pair.ratio.toFixed(2)}:1, under ${AA_NORMAL_TEXT}:1`,
      fix: 'darken the text or lighten the surface token',
    });
  }
  return violations;
}

export function validateDesignMd(text) {
  try {
    const { tokens } = parseDesignMd(text);
    return { violations: validateTokens(tokens), tokens };
  } catch (error) {
    if (!(error instanceof DesignFormatError)) throw error;
    return { violations: [{ rule: `malformed frontmatter, ${error.message}`, fix: 'correct that line as references/design-md-format.md shows' }], tokens: null };
  }
}

export const formatViolation = ({ rule, fix }) => `Violation: ${rule}. Fix: ${fix}.`;

function main(argv) {
  const file = argv[0] || 'DESIGN.md';
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`validate-design-md: cannot read ${file}: ${error.message}`);
    return 1;
  }
  const { violations, tokens } = validateDesignMd(text);
  if (violations.length) {
    violations.forEach((v) => console.log(formatViolation(v)));
    return 1;
  }
  const pair = textSurfaceContrast(tokens.colors);
  console.log(`ok: ${file} has ${Object.keys(tokens.colors).length} colours; text on surface is ${pair.ratio.toFixed(2)}:1`);
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
