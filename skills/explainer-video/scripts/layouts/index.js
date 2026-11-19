'use strict';
// Registry of the slide layout modules, keyed by name.
const title = require('./title');
const flow = require('./flow');
const checklist = require('./checklist');
const chat = require('./chat');
const spreadsheet = require('./spreadsheet');
const funnel = require('./funnel');
const wireframe = require('./wireframe');
const crossed = require('./crossed');
const roadmap = require('./roadmap');

const LAYOUTS = Object.freeze({ title, flow, checklist, chat, spreadsheet, funnel, wireframe, crossed, roadmap });

function getLayout(name) {
  return Object.prototype.hasOwnProperty.call(LAYOUTS, name) ? LAYOUTS[name] : null;
}

module.exports = { LAYOUTS, getLayout };
