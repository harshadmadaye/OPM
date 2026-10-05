// Token meter: opt-in and local only. When enabled, each finished turn's
// token usage and the skills that ran in it are appended to one capped
// $.store key. Nothing here makes a network or model call.
//
// The validator never follows $ across an import, so $ is used only inside
// the hooks installMeter adds; the rest are pure helpers.

const METER_KEY = 'opm.meter';
const ENABLED_KEY = 'opm.meter.enabled';
const MAX_BYTES = 256 * 1024;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const UNKNOWN_SESSION = 'unknown';
const CORRUPT_NOTICE = 'opm: meter data was unreadable and has been reset';

export const meterCommands = [];

const errorText = (error) => (error && error.message ? error.message : String(error));

// Skill names expanded since the last turn ended. skill.prompt carries no
// turn or agent id, so a skill counts toward the next turn that completes.
let pendingSkills = [];

const isCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function isEntry(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    isCount(value.at) &&
    typeof value.sessionId === 'string' &&
    typeof value.isSubagent === 'boolean' &&
    Array.isArray(value.skills) &&
    value.skills.every((name) => typeof name === 'string') &&
    [value.input, value.output, value.cacheRead, value.cacheWrite].every(isCount)
  );
}

// The stored entries, or null when the value is not a list of entries.
export function parseEntries(value) {
  if (value === undefined) return [];
  return Array.isArray(value) && value.every(isEntry) ? value : null;
}

// A new list: entries within maxAgeMs of now, then the oldest dropped until
// the JSON text fits maxBytes. Entries are ASCII, so characters are bytes.
export function appendEntry(entries, entry, now, { maxBytes, maxAgeMs }) {
  const recent = [...entries.filter((kept) => now - kept.at <= maxAgeMs), entry];
  let size = JSON.stringify(recent).length;
  let first = 0;
  while (size > maxBytes && first < recent.length - 1) {
    size -= JSON.stringify(recent[first]).length + 1;
    first += 1;
  }
  return recent.slice(first);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

// Totals over the entries and, per skill, how many turns it ran in and the
// median input tokens of those turns, most-used first.
export function summarize(entries) {
  const totals = { turns: entries.length, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const inputsBySkill = new Map();
  for (const entry of entries) {
    totals.input += entry.input;
    totals.output += entry.output;
    totals.cacheRead += entry.cacheRead;
    totals.cacheWrite += entry.cacheWrite;
    for (const name of entry.skills) inputsBySkill.set(name, [...(inputsBySkill.get(name) ?? []), entry.input]);
  }
  const bySkill = [...inputsBySkill]
    .map(([name, inputs]) => ({ name, turns: inputs.length, medianInput: median(inputs) }))
    .sort((a, b) => b.turns - a.turns || a.name.localeCompare(b.name));
  return { ...totals, bySkill };
}

function entryFrom(e, skills, now, sessionId) {
  return {
    at: now,
    sessionId,
    isSubagent: Boolean(e.agentId),
    skills,
    input: e.usage.input_tokens,
    output: e.usage.output_tokens,
    cacheRead: e.usage.cache_read_input_tokens,
    cacheWrite: e.usage.cache_creation_input_tokens,
  };
}

export function installMeter(on) {
  on('skill.prompt', async ($, e, next) => {
    if (!pendingSkills.includes(e.skill)) pendingSkills = [...pendingSkills, e.skill];
    return next(e);
  });

  on('turn.complete', async ($, e, next) => {
    const skills = pendingSkills;
    pendingSkills = [];
    const result = await next(e);
    try {
      if ((await $.store.get(ENABLED_KEY)) !== true || !e.usage) return result;
      const sessionId = await $.session.id().catch(() => UNKNOWN_SESSION);
      const now = await $.clock.now();
      let entries = parseEntries(await $.store.get(METER_KEY));
      if (entries === null) {
        $.ui.log(CORRUPT_NOTICE);
        entries = [];
      }
      const entry = entryFrom(e, skills, now, sessionId);
      await $.store.set(METER_KEY, appendEntry(entries, entry, now, { maxBytes: MAX_BYTES, maxAgeMs: MAX_AGE_MS }));
    } catch (error) {
      $.ui.log(`opm: meter could not record the turn: ${errorText(error)}`, { to: 'debug' });
    }
    return result;
  });
}
