# <name> brew

Date: <date>
Brief: <the brief as given>
Source: brew-idea run <runId>

## Vision

<verdict.vision>

<design.pitch>

Goals: <design.goals>
Not doing: <design.nonGoals>
Success looks like: <design.successSignal>

## Design

### Who uses it

**<persona.name>**: <persona.need>
Flow: <step> → <step> → <step>

### Screens

One block per surface, in the order a user meets them.

#### <surface.name> (<surface.kind>)

<surface.purpose> Delivers: <surface.delivers>

```
<surface.layout, one region per line>
```

States: <surface.states>

### How screens connect

| From | To | Via |
|---|---|---|
| <from> | <to> | <via> |

### Data

| Entity | Fields | Relations |
|---|---|---|
| <entity> | <fields> | <relations> |

### Architecture

| Part | Runs on | Role |
|---|---|---|
| <part> | <runsOn> | <role> |

### Stack

| Choice | Reason |
|---|---|
| <choice> | <reason> |

## Plan

### Phase 1: <plan[0].phase>

Goal: <goal>
Features: <features>
Risks: <risks>

## Features

Ranked by impact over effort. Decision: keep = exists, leave it; improve = exists, change it; add = new; cut = remove or do not build.

| # | Feature | Decision | Impact | Effort | For | Against | Reason |
|---|---|---|---|---|---|---|---|
| 1 | <title> | <decision> | <impact> | <effort> | <votesFor> | <votesAgainst> | <reason> |

## Cut

| Feature | Why |
|---|---|
| <cut.title> | <cut.reason> |

## Open questions

- <openQuestions>

## Assumptions

- <verdict.assumptions and design.assumptions>
- <missing angles, if any: "The <angle> angle returned nothing and is not represented.">

## Why these choices

One or two sentences per angle: its position and the argument that changed the result. Market claims marked unverified were not checked online.

- **Product**: <position>
- **Engineering**: <position>
- **Skeptic**: <position>
- **Market**: <position>

## Run

- Angles present: <list>
- Unverified market claims: <count>
- Revisions: <n>, last feedback: <text or none>
