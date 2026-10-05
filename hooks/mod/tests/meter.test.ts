import { describe, expect, mock, test } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On, TurnUsage } from 'claude-code';

import { appendEntry, summarize } from '../meter.mjs';

const METER_KEY = 'opm.meter';
const ENABLED_KEY = 'opm.meter.enabled';
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.UTC(2026, 9, 5, 12, 0, 0);
const SESSION_ID = 'session-1';

const USAGE: TurnUsage = {
  input_tokens: 1200,
  output_tokens: 300,
  cache_read_input_tokens: 5000,
  cache_creation_input_tokens: 800,
  model: 'claude-test',
};

type Entry = {
  at: number;
  sessionId: string;
  isSubagent: boolean;
  skills: string[];
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

function entryAt(at: number, overrides: Partial<Entry> = {}): Entry {
  return { at, sessionId: SESSION_ID, isSubagent: false, skills: [], input: 100, output: 10, cacheRead: 0, cacheWrite: 0, ...overrides };
}

type World = { logs: string[]; store: Map<string, unknown> };
type WorldOptions = { failSet?: boolean };

// The world beneath the meter: an in-memory store the test can read, a fixed
// clock, a session id, core answers for skill.prompt and turn.complete, and
// captured log lines.
function world(on: On, initial: Record<string, unknown> = {}, options: WorldOptions = {}): World {
  const logs: string[] = [];
  const store = new Map<string, unknown>(Object.entries(initial));
  on('store.get', (_$, e) => ({ value: store.get(e.key) }));
  on('store.set', (_$, e) => {
    if (options.failSet) return { deny: 'store full' };
    store.set(e.key, JSON.parse(JSON.stringify(e.value)));
    return { value: undefined };
  });
  mock.clock(on, { now: NOW_MS });
  on('session.id', () => ({ value: SESSION_ID }));
  on('skill.prompt', (_$, e) => ({ text: e.text }));
  on('turn.complete', (_$, e) => ({ text: e.answer, usage: e.usage }));
  on('ui.log', (_$, e) => {
    logs.push(e.text);
    return { value: undefined };
  });
  return { logs, store };
}

async function completeTurn($: Engine, extra: { agentId?: string; usage?: TurnUsage } = { usage: USAGE }) {
  return $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer', ...extra });
}

describe('meter recording', () => {
  test('disabled: a turn leaves the store untouched', async ($, on) => {
    const { store } = world(on);
    const result = await completeTurn($);
    expect(result.text).toBe('done');
    expect(store.has(METER_KEY)).toBe(false);
  });

  test('enabled: records usage and the skills that ran this turn', async ($, on) => {
    const { store } = world(on, { [ENABLED_KEY]: true });
    await $.skill.prompt({ skill: 'opm:tdd-workflow', text: 'skill body' });
    await $.skill.prompt({ skill: 'opm:writing-plans', text: 'skill body' });
    const result = await completeTurn($);
    expect(result.text).toBe('done');
    expect(store.get(METER_KEY)).toEqual([
      { at: NOW_MS, sessionId: SESSION_ID, isSubagent: false, skills: ['opm:tdd-workflow', 'opm:writing-plans'], input: 1200, output: 300, cacheRead: 5000, cacheWrite: 800 },
    ]);
  });

  test('skills are counted once and only for the turn they ran in', async ($, on) => {
    const { store } = world(on, { [ENABLED_KEY]: true });
    await $.skill.prompt({ skill: 'opm:tdd-workflow', text: 'a' });
    await $.skill.prompt({ skill: 'opm:tdd-workflow', text: 'b' });
    await completeTurn($);
    await completeTurn($);
    const entries = store.get(METER_KEY) as Entry[];
    expect(entries.map((entry) => entry.skills)).toEqual([['opm:tdd-workflow'], []]);
  });

  test('a skill prompt passes through unchanged', async ($, on) => {
    world(on, { [ENABLED_KEY]: true });
    expect(await $.skill.prompt({ skill: 'opm:tdd-workflow', text: 'skill body' })).toEqual({ text: 'skill body' });
  });

  test('a subagent turn is marked', async ($, on) => {
    const { store } = world(on, { [ENABLED_KEY]: true });
    await completeTurn($, { agentId: 'agent-7', usage: USAGE });
    const entries = store.get(METER_KEY) as Entry[];
    expect(entries[0].isSubagent).toBe(true);
  });

  test('a turn without usage is not recorded', async ($, on) => {
    const { store } = world(on, { [ENABLED_KEY]: true });
    await completeTurn($, {});
    expect(store.has(METER_KEY)).toBe(false);
  });

  test('entries older than 14 days are pruned on the next turn', async ($, on) => {
    const { store } = world(on, { [ENABLED_KEY]: true, [METER_KEY]: [entryAt(NOW_MS - 15 * DAY_MS), entryAt(NOW_MS - 2 * DAY_MS)] });
    await completeTurn($);
    const entries = store.get(METER_KEY) as Entry[];
    expect(entries.map((entry) => entry.at)).toEqual([NOW_MS - 2 * DAY_MS, NOW_MS]);
  });

  test('a corrupt stored value is reset with a one-line notice', async ($, on) => {
    const { logs, store } = world(on, { [ENABLED_KEY]: true, [METER_KEY]: 'not a list' });
    const result = await completeTurn($);
    expect(result.text).toBe('done');
    expect(logs).toEqual(['opm: meter data was unreadable and has been reset']);
    expect((store.get(METER_KEY) as Entry[]).length).toBe(1);
  });

  test('a store failure never breaks the turn', async ($, on) => {
    const { logs } = world(on, { [ENABLED_KEY]: true }, { failSet: true });
    const result = await completeTurn($);
    expect(result.text).toBe('done');
    expect(logs.length).toBe(1);
    expect(logs[0].startsWith('opm: meter could not record the turn')).toBe(true);
  });
});

describe('appendEntry', () => {
  const limits = { maxBytes: 10_000, maxAgeMs: 14 * DAY_MS };

  test('appends without changing the input list', () => {
    const before = [entryAt(NOW_MS - 1000)];
    const after = appendEntry(before, entryAt(NOW_MS), NOW_MS, limits);
    expect(after.length).toBe(2);
    expect(before.length).toBe(1);
  });

  test('drops by age, then the oldest until the JSON fits the cap', () => {
    const entries = Array.from({ length: 50 }, (_, i) => entryAt(NOW_MS - (50 - i) * 1000));
    const entrySize = JSON.stringify(entryAt(NOW_MS)).length + 1;
    const maxBytes = entrySize * 10;
    const kept = appendEntry([entryAt(NOW_MS - 20 * DAY_MS), ...entries], entryAt(NOW_MS), NOW_MS, { ...limits, maxBytes });
    expect(JSON.stringify(kept).length <= maxBytes).toBe(true);
    expect(kept[kept.length - 1].at).toBe(NOW_MS);
    expect(kept.length >= 9).toBe(true);
    expect(kept[0].at > NOW_MS - 20 * DAY_MS).toBe(true);
  });
});

describe('summarize', () => {
  test('totals and per-skill turns with median input', () => {
    const summary = summarize([
      entryAt(1, { input: 100, output: 1, cacheRead: 5, cacheWrite: 2, skills: ['a'] }),
      entryAt(2, { input: 300, output: 2, cacheRead: 5, cacheWrite: 2, skills: ['a', 'b'] }),
      entryAt(3, { input: 200, output: 3, cacheRead: 5, cacheWrite: 2, skills: ['a'] }),
    ]);
    expect(summary).toEqual({
      turns: 3,
      input: 600,
      output: 6,
      cacheRead: 15,
      cacheWrite: 6,
      bySkill: [
        { name: 'a', turns: 3, medianInput: 200 },
        { name: 'b', turns: 1, medianInput: 300 },
      ],
    });
  });
});
