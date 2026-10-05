---
phase: 04-evidence
plan: 04
requires:
  - { phase: 04-evidence, provides: status --all, mod bypass checks, eval spike (04-01..04-03) }
provides:
  - README opening "What OPM can show" with four measured, linked claims (always-on cost, split-skill core vs reference sizes, three-OS CI, zero-turn status and safety on 2.1.287+)
  - docs/why-opm.md "What we can and cannot show yet" (measured, bytes/4 estimates, not measured, eval spike)
  - docs/marketplace-listing.md: draft descriptions, keywords, install commands, requirements, validate summary, privacy, support links, submission checklist (nothing submitted)
affects: [04-05]
key_files: [README.md, docs/why-opm.md, docs/marketplace-listing.md]
key_decisions:
  - "opening numbers only from npm run tokens --json (no ceilings there)"
  - "unfavourable sizes stated: unsplit skills, largest milestone-planning at 2,911 tokens"
  - "the eval is a 3-prompt spike, not an accuracy figure"
  - "removed two unmeasured cost statements below the opening ('Stays flat', 'does not get slower, dumber or pricier')"
  - "listing checklist starts with checking the official requirements, which were not verified"
issues_created: [ISS-020]
completed: 2026-10-05
---

# 04-04 Summary

OPM is positioned on measured cost, three-OS CI and zero-turn mod features, and an unsubmitted marketplace listing kit is ready.

## Task commits
- 7064c9f docs(04-04): README and why-opm positioning
- ba9f067 docs(04-04): Marketplace listing kit

## Verification
npm test 237 pass; npm run tokens exit 0 (2,379 / 1,401); every opening number matches the tokens JSON; no market claims in README, why-opm or the listing.

## Notes
- The README mod "Declared" table is stale after 04-02 (tool.call on Edit and Write, $.env.set, $.store.delete and keys, env write OPM_MOD_ACTIVE, more env reads); 04-05 refreshes it.
