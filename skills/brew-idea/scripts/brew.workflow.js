export const meta = {
  name: 'opm-brew-idea',
  description: 'OPM brew-idea: scout the project, four angles propose, each angle rebuts the others, one judge ranks features and writes a phased plan',
  phases: [
    { title: 'Scout', detail: 'one agent maps the brief and the code' },
    { title: 'Propose', detail: 'product, engineering, skeptic and market angles in parallel' },
    { title: 'Debate', detail: 'each angle endorses or attacks every other idea' },
    { title: 'Judge', detail: 'one judge ranks keep / improve / add / cut and writes the plan', model: 'opus' },
  ],
}

const MIN_PROPOSALS = 2
const IDEAS_PER_ANGLE = '5 to 8'

const ANGLES = [
  { key: 'product', brief: 'Argue from user value: who this is for, the problem it solves, which features matter most, what to cut because nobody asked for it.' },
  { key: 'engineering', brief: 'Argue from feasibility: stack fit, complexity, what is cheap versus expensive to build, risks and debt in the existing code, what should be built first because everything depends on it.' },
  { key: 'skeptic', brief: 'Argue against the idea: failure modes, security and privacy exposure, compliance, what would make the product pointless, which features look good and deliver nothing.' },
  { key: 'market', brief: 'Argue from the market: competitors, prior art, what users of similar products expect as table stakes, what is a differentiator. Use WebSearch (load it with ToolSearch if it is not in your tool list) to check claims. Set webSearchUsed to whether you could search. Mark every idea you could not verify online with unverified: true. Never present a guess as a checked fact.' },
]

const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    why: { type: 'string' },
    impact: { type: 'integer', minimum: 1, maximum: 5 },
    effort: { type: 'integer', minimum: 1, maximum: 5 },
    unverified: { type: 'boolean' },
  },
  required: ['id', 'title', 'why', 'impact', 'effort'],
}

const FACTS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    users: { type: 'string' },
    existingFeatures: { type: 'array', items: { type: 'string' } },
    stack: { type: 'string' },
    constraints: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'users', 'existingFeatures', 'stack', 'constraints', 'gaps'],
}

const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    ideas: { type: 'array', items: IDEA_SCHEMA },
    concerns: { type: 'array', items: { type: 'object', properties: { about: { type: 'string' }, why: { type: 'string' } }, required: ['about', 'why'] } },
    cut: { type: 'array', items: { type: 'object', properties: { feature: { type: 'string' }, why: { type: 'string' } }, required: ['feature', 'why'] } },
    webSearchUsed: { type: 'boolean' },
  },
  required: ['ideas', 'concerns', 'cut'],
}

const REBUTTAL_SCHEMA = {
  type: 'object',
  properties: {
    endorse: { type: 'array', items: { type: 'string' } },
    attack: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, why: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] } },
        required: ['id', 'why', 'severity'],
      },
    },
    revised: { type: 'array', items: IDEA_SCHEMA },
  },
  required: ['endorse', 'attack', 'revised'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    vision: { type: 'string' },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          decision: { type: 'string', enum: ['keep', 'improve', 'add', 'cut'] },
          reason: { type: 'string' },
          votesFor: { type: 'array', items: { type: 'string' } },
          votesAgainst: { type: 'array', items: { type: 'string' } },
          impact: { type: 'integer', minimum: 1, maximum: 5 },
          effort: { type: 'integer', minimum: 1, maximum: 5 },
        },
        required: ['title', 'decision', 'reason', 'votesFor', 'votesAgainst', 'impact', 'effort'],
      },
    },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        properties: { phase: { type: 'string' }, goal: { type: 'string' }, features: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } } },
        required: ['phase', 'goal', 'features', 'risks'],
      },
    },
    cut: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, reason: { type: 'string' } }, required: ['title', 'reason'] } },
    openQuestions: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
  required: ['vision', 'features', 'plan', 'cut', 'openQuestions', 'assumptions'],
}

const readOnly = 'Read-only: do not modify, create or delete files, do not run git commands that change state, do not dispatch subagents. You may not ask the developer anything.'

function scoutPrompt() {
  const codeStep = args.hasCode
    ? `The project has source code. Read, in this order: README or equivalent, package manifests (package.json, pubspec.yaml, pyproject.toml, go.mod), the top-level layout, routes or screens, data models or schemas, and any docs/specs. Do not read every file; stop when you can describe what exists.`
    : `The directory has no source code yet. Derive everything from the brief and say which facts are assumptions.`
  return `You are the scout for an OPM brew-idea run. Produce a short fact sheet that four other agents will argue from.
Project directory: ${args.projectRoot}
Brief from the developer:
"""
${args.brief}
"""
${codeStep}
${readOnly}

Report: summary (three sentences at most), users (who uses it, in one or two sentences), existingFeatures (what already works, empty if nothing), stack (languages, frameworks, services, or "not chosen" for a brief-only run), constraints (platform, compliance, budget, deadline, anything the brief or code forces), gaps (what the brief does not answer and the code does not show).`
}

function proposePrompt(angle, facts) {
  return `You are the ${angle.key} angle in an OPM brew-idea debate about a project. ${angle.brief}
Project directory: ${args.projectRoot}
Brief:
"""
${args.brief}
"""
Fact sheet from the scout:
${JSON.stringify(facts, null, 2)}

Propose ${IDEAS_PER_ANGLE} ideas from your angle. Each idea gets id "${angle.key}-1", "${angle.key}-2" and so on, a title, why it matters from your angle, impact 1 to 5 (5 changes whether the product succeeds) and effort 1 to 5 (5 is weeks of work or a new subsystem). Ideas can be new features, improvements to existing ones, or removals.
Also list concerns (things about the brief or the code that worry you) and cut (existing or implied features you would remove, with why).
Be specific to this project; a generic idea that fits any product does not count. ${readOnly}`
}

function debatePrompt(own, others) {
  const otherIdeas = others.flatMap((p) => p.ideas.map((i) => `- ${i.id}: ${i.title}. ${i.why} (impact ${i.impact}, effort ${i.effort}${i.unverified ? ', unverified' : ''})`)).join('\n')
  return `You are the ${own.angle} angle in an OPM brew-idea debate. You proposed these ideas:
${JSON.stringify(own.ideas, null, 2)}

The other angles proposed:
${otherIdeas}

Take a position on every one of the other angles' ideas by id. Endorse it, or attack it with a reason and a severity: high means it should not be built as described, medium means it needs a change, low means a reservation. "Maybe" is not allowed; every id appears exactly once in endorse or attack. Argue from your angle, with specifics from the brief or the fact sheet, not from taste.
Then return revised: your own ideas after hearing the others, dropping any you no longer defend and keeping ids stable. ${readOnly}`
}

function judgePrompt(facts, proposals, rebuttals, missingAngles, silentAngles) {
  const feedback = args.feedback ? `\n## Developer feedback on the previous verdict, apply it\n${args.feedback}\n` : ''
  const missing = missingAngles.length ? `\nAngles that returned nothing and are not represented: ${missingAngles.join(', ')}. Say so in assumptions.` : ''
  const quiet = silentAngles.length ? `\nAngles that proposed but returned no rebuttal: ${silentAngles.join(', ')}. Their ideas were never defended in the debate; say so in assumptions.` : ''
  return `You are the judge of an OPM brew-idea debate. Decide what the project should build.
Brief:
"""
${args.brief}
"""
Fact sheet:
${JSON.stringify(facts, null, 2)}

Proposals by angle:
${JSON.stringify(proposals, null, 2)}

Rebuttals by angle (endorse and attack refer to idea ids):
${JSON.stringify(rebuttals, null, 2)}
${missing}${quiet}${feedback}
## Rules
- vision: one line saying what the product is for whom.
- features: every idea that survived, plus existing features worth a decision. decision is keep (exists, leave it), improve (exists, change it), add (new) or cut (remove or do not build). reason is one or two sentences that cite the argument that decided it. votesFor and votesAgainst list the angle names that endorsed or attacked it.
- Rank features by impact over effort; break ties by the number of angles in favour.
- An idea attacked with severity high by the skeptic needs a stated mitigation inside its reason, otherwise its decision is cut.
- Ideas marked unverified keep the word "unverified" in their reason.
- plan: two to four phases in build order. Phase one is what everything else depends on. Each phase names its goal, the feature titles it delivers, and risks.
- cut: everything with decision cut, with the reason, so the developer can disagree.
- openQuestions: what only the developer can answer. assumptions: what you decided without evidence.
${readOnly}`
}

phase('Scout')
const facts = await agent(scoutPrompt(), { label: 'scout', phase: 'Scout', schema: FACTS_SCHEMA, model: 'sonnet' })
if (!facts) return { completed: false, reason: 'scout returned nothing', missingAngles: [] }

phase('Propose')
const proposalResults = await parallel(ANGLES.map((angle) => () =>
  agent(proposePrompt(angle, facts), { label: `propose ${angle.key}`, phase: 'Propose', schema: PROPOSAL_SCHEMA, model: 'sonnet' })
))
const proposals = proposalResults.map((p, i) => (p ? { ...p, angle: ANGLES[i].key } : null)).filter(Boolean)
const missingAngles = ANGLES.filter((angle, i) => !proposalResults[i]).map((angle) => angle.key)
if (missingAngles.length) log(`angles with no proposal: ${missingAngles.join(', ')}`)
if (proposals.length < MIN_PROPOSALS) {
  return { completed: false, reason: `only ${proposals.length} proposal(s), need ${MIN_PROPOSALS}`, facts, proposals, missingAngles }
}
log(`${proposals.length} proposals, ${proposals.reduce((n, p) => n + p.ideas.length, 0)} ideas`)

phase('Debate')
const rebuttalResults = await parallel(proposals.map((own) => () =>
  agent(debatePrompt(own, proposals.filter((p) => p.angle !== own.angle)), { label: `debate ${own.angle}`, phase: 'Debate', schema: REBUTTAL_SCHEMA, model: 'sonnet' })
))
const rebuttals = rebuttalResults.map((r, i) => (r ? { ...r, angle: proposals[i].angle } : null)).filter(Boolean)
const silentAngles = proposals.filter((p, i) => !rebuttalResults[i]).map((p) => p.angle)
if (silentAngles.length) log(`angles with no rebuttal: ${silentAngles.join(', ')}`)

phase('Judge')
const verdict = await agent(judgePrompt(facts, proposals, rebuttals, missingAngles, silentAngles), { label: 'judge', phase: 'Judge', schema: VERDICT_SCHEMA, model: 'opus', effort: 'high' })
if (!verdict) return { completed: false, reason: 'judge returned nothing', facts, proposals, rebuttals, missingAngles, silentAngles }

log(`verdict: ${verdict.features.length} features, ${verdict.cut.length} cut, ${verdict.plan.length} plan phases`)
return { completed: true, facts, proposals, rebuttals, verdict, missingAngles, silentAngles }
