## What

<!-- What changed, and why. One concern per pull request. -->

## How it was verified

<!-- The commands you ran and what they printed. If something is not verified, say so plainly. -->

- [ ] `node --test tests/*.test.js`
- [ ] `claude plugin validate .`

## Checklist

- [ ] New or changed behaviour has a test, written before the fix
- [ ] No test reaches the network, launches a browser, runs ffmpeg or installs a package
- [ ] Version bumped in both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, with a `CHANGELOG.md` entry
- [ ] A new skill is listed in the README
