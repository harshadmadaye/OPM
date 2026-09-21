'use strict';
// Registry of the slide layout modules, keyed by name.
const title = require('./title');
const flow = require('./flow');
const checklist = require('./checklist');
const chat = require('./chat');

const LAYOUTS = Object.freeze({ title, flow, checklist, chat });

function getLayout(name) {
  return Object.prototype.hasOwnProperty.call(LAYOUTS, name) ? LAYOUTS[name] : null;
}

module.exports = { LAYOUTS, getLayout };
