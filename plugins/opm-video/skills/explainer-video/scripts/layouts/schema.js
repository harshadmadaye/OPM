'use strict';
// Recursive validator for layout `slots` objects against a small shape
// language: 'string'/'string?', 'icon'/'icon?', 'bool?', 'number',
// { enum }, { array: { min, max, of } }, { shape } and plain-object shorthand
// for a required nested shape.

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkPrimitive(spec, value, path, hasIcon, errors) {
  const optional = spec.endsWith('?');
  const base = optional ? spec.slice(0, -1) : spec;
  if (value === undefined) {
    if (!optional) errors.push(`${path}: required`);
    return;
  }
  switch (base) {
    case 'string':
      if (typeof value !== 'string' || value.length === 0) {
        errors.push(`${path}: expected a non-empty string`);
      }
      break;
    case 'icon':
      if (typeof value !== 'string' || !hasIcon(value)) {
        errors.push(`${path}: unknown icon "${value}"`);
      }
      break;
    case 'bool':
      if (typeof value !== 'boolean') {
        errors.push(`${path}: expected a boolean`);
      }
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${path}: expected a number`);
      }
      break;
    default:
      throw new Error(`schema: unknown primitive spec "${spec}"`);
  }
}

function checkEnum(spec, value, path, errors) {
  if (value === undefined) {
    errors.push(`${path}: required`);
    return;
  }
  if (!spec.enum.includes(value)) {
    errors.push(`${path}: expected one of ${spec.enum.join(', ')}`);
  }
}

function checkArray(spec, value, path, hasIcon, errors) {
  const { min, max, of } = spec.array;
  const optional = !!spec.optional;
  if (value === undefined) {
    if (!optional) errors.push(`${path}: required`);
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected an array`);
    return;
  }
  if (value.length < min || value.length > max) {
    errors.push(`${path}: expected ${min} to ${max} items, got ${value.length}`);
  }
  value.forEach((item, i) => checkSpec(of, item, `${path}[${i}]`, hasIcon, errors));
}

function checkNestedShape(spec, value, path, hasIcon, errors) {
  const optional = !!spec.optional;
  if (value === undefined) {
    if (!optional) errors.push(`${path}: required`);
    return;
  }
  errors.push(...checkShape(spec.shape, value, path, hasIcon));
}

function checkSpec(spec, value, path, hasIcon, errors) {
  if (typeof spec === 'string') {
    checkPrimitive(spec, value, path, hasIcon, errors);
    return;
  }
  if ('enum' in spec) {
    checkEnum(spec, value, path, errors);
    return;
  }
  if ('array' in spec) {
    checkArray(spec, value, path, hasIcon, errors);
    return;
  }
  if ('shape' in spec) {
    checkNestedShape(spec, value, path, hasIcon, errors);
    return;
  }
  // Plain object shorthand: a required nested shape.
  checkNestedShape({ shape: spec, optional: false }, value, path, hasIcon, errors);
}

function checkShape(shape, value, path, hasIcon) {
  const errors = [];
  if (!isPlainObject(value)) {
    errors.push(`${path}: expected an object`);
    return errors;
  }
  for (const key of Object.keys(shape)) {
    checkSpec(shape[key], value[key], `${path}.${key}`, hasIcon, errors);
  }
  for (const key of Object.keys(value)) {
    if (!(key in shape)) errors.push(`${path}.${key}: unknown slot`);
  }
  return errors;
}

function checkSlots(shape, slots, { hasIcon }) {
  return checkShape(shape, slots, 'slots', hasIcon);
}

module.exports = { checkSlots };
