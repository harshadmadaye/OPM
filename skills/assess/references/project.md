# Project lenses

Project is every level at once. It is the heaviest run; tell the developer the
lens count before starting.

The baseline (Phase 2) runs first with all gates; see `code.md`, "Baseline
findings". Then the lenses:

1. Architecture: A1 to A4 from `architecture.md`.
2. Code: C1 to C4 from `code.md` on the whole repo.
3. P1 and P2 below.

That is 10 lenses plus the baseline, so Project always gets the Workflow
offer: give the agent count (lenses plus one verifier each). On no, or when
the Workflow tool is not available (say so), run two waves: Architecture plus
P1 and P2, then Code.

## P1 Dependencies

> List direct dependencies from each manifest. Run the stack's outdated and
> audit commands (`npm outdated`, `npm audit --omit=dev`, `uv pip list
> --outdated`, `pip-audit`, `flutter pub outdated`, `dart pub outdated`) when
> available. Report: known vulnerabilities (severity from the advisory),
> dependencies more than one major version behind, packages declared but never
> imported (grep for the import name), and duplicate packages doing the same job.

## P2 Docs and onboarding

> Follow the README as a new developer would: install, configure, run, test.
> Do not run anything that writes outside the repo or needs secrets; read the
> scripts instead. Report each step that is missing, wrong, or depends on
> something undocumented (env vars, services, versions), with the README line
> and the file that proves it.

Feature-level tracing is not part of Project; suggest `/opm:assess feature
<name>` in the report's next steps for the feature with the most findings.
