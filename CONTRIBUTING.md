# Contributing to OPM

Thanks for taking an interest. OPM is a Claude Code plugin: a set of skills,
subagents and hooks that encode one opinionated engineering loop. Contributions
are welcome, and small focused ones are the easiest to accept.

## Getting set up

You need Node 18 or later. There is nothing to install: the plugin and its
tests have no npm dependencies.

```
git clone https://github.com/harshadmadaye/OPM.git
cd OPM
node --test tests/*.test.js
claude plugin validate .
```

To run your working copy as a plugin, start Claude Code with it loaded:

```
claude --plugin-dir /path/to/OPM
```

Disable any installed copy of OPM first, or you will see every skill twice.

## What to work on

Good first contributions:

- A stack patterns skill for a language the plugin does not cover.
- A reviewer subagent for a domain you know well.
- A layout for `story-video`, which is self-contained and has a clear contract.
- Fixing something the README promises and the code does not do.

Please open an issue before a large change, so we can agree the shape before
you spend time on it.

## The rules the code follows

These are not style preferences; the tests enforce most of them.

- **Skills**: the `name` in the frontmatter equals the directory name. The
  description is third person and names its triggers with "Use when". The body
  stays under 400 lines. No first person.
- **Agents**: frontmatter carries `name`, `description`, `tools` and `model`.
  Under 250 lines.
- **Scripts**: CommonJS, Node 18, zero npm dependencies. Spawn with an argument
  array, never a shell string. Take `platform` as a parameter rather than
  reading it deep inside a function, so tests can cover every operating system.
- **Errors**: explicit, one line, naming the thing that failed. No swallowed
  exceptions, no stack traces shown to a user, no leftover debug output.
- **Files**: under 400 lines, one responsibility each.

## One-time setup for this clone

This repository ships a hook that refuses a commit made with a work email
address, because the repository is public and those addresses do not belong in
it. Turn it on once per clone:

```
git config core.hooksPath .githooks
```

## Tests

Every test runs offline. No test may reach the network, launch a browser, run
`ffmpeg`, install a package or speak. Where a script drives an external tool,
give it an injectable seam and a `--dry-run`, and test the arguments it would
have used. `skills/story-video/scripts/` is the worked example of this.

```
node --test tests/*.test.js
```

Write the failing test first. It is the house rule, and the plugin's own
`tdd-workflow` skill describes it in more detail than this file needs to.

## Pull requests

- One concern per pull request.
- Say what you changed, why, and how you verified it. If something is not
  verified, say that too; an honest gap is far better than a confident claim
  that does not hold.
- Bump the version in **both** `.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`, and add a `CHANGELOG.md` entry. A test
  checks that the two versions and the changelog agree.
- If you add a skill, list it in the README. A test checks that too.

## Reporting a security issue

Please do not open a public issue. Email the address on
[the maintainer's GitHub profile](https://github.com/harshadmadaye) with what
you found and how to reproduce it.

## Licence

By contributing you agree that your work is licensed under the MIT Licence in
[LICENSE](LICENSE).
