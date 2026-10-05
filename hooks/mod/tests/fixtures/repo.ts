// Fake repo contents for the status tests. A mod test has no file system, so
// the fixtures are text in a module and the tests serve them through fs stubs.

export const UPDATED_AT_MS = Date.UTC(2026, 9, 5, 9, 30);
export const OLDER_MS = UPDATED_AT_MS - 86_400_000;

export const OPEN_LEDGER = [
  '# OPM ledger - plan: docs/plans/2026-10-01-widget.md',
  'Branch: feat/widget  Base: abc1234',
  'Mode: subagent (3 tasks)',
  'Task 1: complete (commits a..b, 4 tests green)',
  'Ruling: keep the widget pure - costs nothing if wrong',
  'Task 2: review found 1 Important; fix round 1/3',
].join('\n');

export const OPEN_PLAN = [
  '# Widget plan',
  '### Task 1: Widget model',
  '### Task 2: Widget view',
  '### Task 3: Widget docs',
].join('\n');

export const COMPLETE_LEDGER = [
  '# OPM ledger - plan: docs/plans/2026-09-01-done.md',
  'Mode: subagent (1 task)',
  'Task 1: complete (commits c..d)',
].join('\n');

export const MALFORMED_LEDGER = 'not a ledger header\nTask 1: complete';

export const MILESTONE_STATE = [
  '# Milestone State',
  'Phase: 3 of 4 (First mod)',
  'Plan: 2 of 6 in this phase',
  'Status: In progress',
].join('\n');
