# opm:story-video

Date: 2026-09-18
Status: approved design, awaiting implementation plan

## Goal

One command turns a spec or document into a narrated explainer video, cheaply and repeatably.

```
/opm:story-video <path to spec or document>
```

Input is any markdown spec, brew-idea result, milestone summary or plain document. Output is a
1920x1080 MP4 of illustrated still slides with a neural voice-over, a sidecar `.srt`, and the
editable sources, written under `docs/story/<slug>/` in the target project.

It is a narrated slideshow with fades, not animation. The skill description must say so. It is
meant for internal explainers and stakeholder walkthroughs.

## Why the design looks like this

The pipeline was run once by hand on 2026-09-17. Measured cost: slide drawing and review took
about 190k subagent tokens, 77 tool calls and 22 minutes. Storyboard, narration, encoding and
rebuilds were near zero. The 14 slides were only about 67 KB of HTML, so the cost was turn count
and image review, not drawing. The design therefore removes the agent from slide production
wherever a layout can be filled from data, and reviews frames through one contact sheet.

Target cost for a video whose scenes all use kit layouts: under 20k tokens.

## Decisions

| Question | Decision |
|---|---|
| Slides | Script-rendered layout kit; `layout: custom` scenes go to one Opus agent |
| Platforms | macOS, Linux and Windows. All orchestration in Node; no bash, zsh, afinfo, sips |
| Voice | Default `en-IN-NeerjaExpressiveNeural` at `+6%`; any edge-tts voice by name; no translation |
| Outputs | `docs/story/<slug>/`; sources, `.srt` and the MP4 are committed; frames, audio and segments are ignored |
| Length | Skill proposes 2, 4 or 6 minutes and asks once; default 4 |
| Storyboard author | Main thread |
| Integration | One-line pointer in brew-idea, jump-start, milestone-planning and using-opm; they never invoke it |
| Subtitles | Sidecar `.srt` only, no burn-in |
| Licensed TTS | Azure AI Speech is named as the option for client-facing videos, not implemented |
| Out of scope | Animation, background music, subtitle burn-in, translation, Azure integration |

## Gates

| Gate | Passes only when |
|---|---|
| G1 Source | The path exists, is readable text, and holds enough content for at least a 2 minute video (about 270 words of narration) |
| G2 Storyboard and audio | The validator passes AND the developer chose a build option on the latest storyboard |
| G3 Video | The developer chose "Approve" on the latest build, not an earlier one |

## Phases

### Phase 0: parse and check tools

1. `$ARGUMENTS` is the source path. Resolve it to an absolute path. Paths may contain spaces, including a trailing space in a directory name; every script takes paths as separate arguments and never builds shell strings.
2. `slug`: the source file name without date prefix and extension, kebab-case.
3. Run `scripts/setup.js --check`. It reports Node version, the browser it found, whether Python 3 is available, and whether the tools folder is already set up. No browser is a hard stop. No Python means only the local voice is offered at G2.

### Phase 1: read and size

Read the source. Count what it holds (sections, distinct facts). Propose a length and ask once
with AskUserQuestion: 2, 4 or 6 minutes, default 4. Measured pace is about 134 words per minute
including pauses, so the targets are roughly 270, 540 and 800 narration words and 5, 9 and 14
scenes.

### Phase 2: storyboard

The main thread writes `docs/story/<slug>/storyboard.json` (shape below), then runs
`scripts/validate-storyboard.js <storyboard>`. Fix every error it reports before G2.

Rules for the author:
- Every fact in narration, headings and slots traces to the source. Each scene names where in `source`. Invent nothing.
- Anything the source describes as not built yet gets `planned: true`.
- Narration is never repeated on the slide. Headings are short; the picture carries the rest.
- Write "AI", not "A.I.".
- One protagonist, declared once at the top level and used in every scene that shows a person.
- Prefer kit layouts. Use `custom` only when no layout can carry the point, and say why in `visual`.

### Phase 3: approve storyboard, consent to audio (G2)

Show: title, scene list with layout and heading, narration word count, estimated length, every
real-looking person name found in the storyboard, and which scenes are `planned`. If a named
person is real, say so and make sure the `note` does not claim the character is made up.

Ask one question with AskUserQuestion:

- "Build with the neural voice": narration text is sent to Microsoft's speech service through edge-tts, an unofficial route with no licence or uptime guarantee. Fine for internal use. For client-facing or public videos the licensed route is Azure AI Speech, which this skill does not implement.
- "Build with the local OS voice": nothing leaves the machine; quality is noticeably robotic.
- "Change the storyboard": free text; revise, re-validate, ask again.

The question is asked once per run. A rebuild after G3 feedback reuses the answer.

### Phase 4: build

1. `node scripts/setup.js`: prepares the tools folder (idempotent).
2. `node scripts/render-slides.js <storyboard> <slides dir>`: writes `slides/slides.css` and one `scene-<id>.html` per kit scene. Lists the custom scenes it skipped.
3. If there are custom scenes, dispatch one agent (model: opus) with: the storyboard path, the custom scene ids, `slides/slides.css`, one rendered kit slide as the exemplar, and the type rules. It writes `scene-<id>.html` for those ids only, drawing a 1740x530 SVG stage inside the shared frame. It does not screenshot or review.
4. `node scripts/render-frames.js <slides dir> <frames dir>`: PNG per slide, verified 1920x1080.
5. `node scripts/build-video.js contact-sheet <frames dir>`: one tiled image. Look at it once. Open a full frame only when a tile looks wrong; fix the storyboard slot or the custom slide, then rerun steps 2 to 4 (hashing makes this incremental).
6. Narrate: `<venv python> scripts/narrate.py <storyboard> <audio dir>` for the neural voice, or `node scripts/narrate-local.js <storyboard> <audio dir>` for the local voice.
7. `node scripts/build-video.js build <story dir>`: per-scene segments, concat, `.srt`.

### Phase 5: approve (G3)

Open the MP4 (`open` on macOS, `xdg-open` on Linux, `start` on Windows). Report length, size and
scene count. Ask: "Approve" or "Request changes" (free text). On changes: edit the storyboard or
a custom slide, re-validate, rerun Phase 4 steps 2 to 7. The manifest makes each step skip scenes
that did not change. Every rebuild gets its own approval question.

### Phase 6: finish

Commit `storyboard.json`, `slides/`, `<slug>.srt`, `<slug>.mp4` and the `.gitignore`:
`docs(story): <slug> explainer video`. Report the MP4 path, length, size, voice used, and how to
rebuild after an edit.

## Storyboard shape

```json
{
  "title": "One campaign, two ways",
  "note": "Who the story is about, what is illustrative, what is planned.",
  "source": "docs/specs/2026-09-17-influencer-platform-brew.md",
  "targetMinutes": 4,
  "voice": "en-IN-NeerjaExpressiveNeural",
  "rate": "+6%",
  "protagonist": { "name": "Prajakta", "role": "campaign executive", "color": "teal" },
  "parts": { "today": { "label": "TODAY", "tone": "amber" }, "after": { "label": "AFTER", "tone": "teal" } },
  "scenes": [
    {
      "id": "03",
      "part": "today",
      "layout": "flow",
      "heading": "Finding creators",
      "sub": "Discovery takes 20% of all campaign effort",
      "slots": { "steps": [ { "icon": "phone", "label": "Hashtag search" }, { "icon": "sheet", "label": "Copy to a spreadsheet" }, { "icon": "chat", "label": "Message each creator" } ] },
      "visual": "",
      "narration": "Next, Prajakta has to find creators...",
      "source": "Questionnaire, section 2: discovery",
      "planned": false
    }
  ]
}
```

`voice`, `rate`, `protagonist`, `parts`, `visual` and `planned` are optional. `visual` is required
when `layout` is `custom` and ignored otherwise. `source` is required on every scene whose layout
is not `title`.

### Validator rules (`validate-storyboard.js`)

Exit code 0 with a summary line, or 1 with one line per error.

- Top level: `title` and `scenes` present; `scenes` non-empty.
- Scene ids unique, two digits, ascending.
- `layout` is a known layout or `custom`; `slots` satisfies that layout's slot schema.
- `heading` at most 48 characters; `sub` at most 90.
- `narration` non-empty; does not contain "A.I."; between 25 and 110 words.
- `source` present unless layout is `title`.
- `custom` scenes have a non-empty `visual`.
- No slot text equals or contains a full narration sentence.
- Total words within 25% of `targetMinutes` x 134 when `targetMinutes` is set (warning, not error).
- Summary prints scenes, words, estimated minutes, custom scene ids, planned scene ids.

## Slide kit

### Frame (`templates/slides.css`)

Fixed 1920x1080 page, 90px safe margin. Chip top-left (part label, tone colour). Heading 84 to
96px. Sub line 40 to 44px. A 1740x530 illustration stage. Scene counter bottom-right. A
"PLANNED" chip top-right when `planned` is true. System font stack with fallbacks that exist on
all three OSes. Two tones, amber and teal, selected by the scene's part. Colours are the ones
from the reference run.

### Layouts (`scripts/layouts/<name>.js`)

Each exports `{ slotSchema, render(slots, context) }` and returns an SVG string for the
1740x530 stage. `context` carries the tone and the protagonist. No text in any layout is set
below 30px. Long labels wrap to two lines and then truncate with an ellipsis; the validator's
length limits keep that rare.

| Layout | Slots | Use |
|---|---|---|
| `title` | `left: { label, icons[] }`, `right: { label, icons[] }`, `footer` | Opening or closing card, optional before/after split |
| `flow` | `steps[2..5]: { icon, label }` | A process, left to right with arrows |
| `checklist` | `items[2..6]: { label, state: done or todo or problem }` | Requirements, outcomes, problems |
| `chat` | `windows[1..3]: { app, messages[1..4]: { from, text } }` | Conversations scattered across apps |
| `spreadsheet` | `columns[2..6]`, `rows[2..6][]`, `highlight[]` | Manual tracking, data tables |
| `funnel` | `stages[2..5]: { label, value }` | Narrowing numbers |
| `wireframe` | `window: { title, nav[], panels[1..4]: { title, lines } }` | A planned screen |
| `crossed` | `cards[2..4]: { icon, label, crossed: bool }` | What goes away, what stays |
| `roadmap` | `phases[2..5]: { label, items[1..3] }` | Phased plan |

### Pictograms (`scripts/pictograms.js`)

A map of name to SVG fragment drawn on a 100x100 box, stroke-based, tone-coloured: person,
people, phone, laptop, email, chat, sheet, deck, document, calendar, clock, money, chart, search,
link, lock, check, cross, warning, star, camera, video, megaphone, handshake. `person` takes the
protagonist colour so the same figure recurs. An unknown icon name is a validator error.

### Custom scenes

The agent gets the frame, one exemplar, the type rules (nothing under 30px, 90px margin, no
narration on the slide, reuse the protagonist figure) and writes only the requested files. The
main thread reviews them in the same contact sheet as the kit slides.

## Scripts

All under `skills/story-video/scripts/`. Node 18 or later, no npm dependencies of their own.
Every script takes explicit path arguments, prints one line per unit of work, exits non-zero
with a message naming the scene on failure, and supports `--dry-run` where it would spawn a tool.

| Script | Does |
|---|---|
| `setup.js` | `--check` reports tools. Without it: creates the tools folder, `npm i ffmpeg-static ffprobe-static` there, creates a Python venv and `pip install edge-tts` when Python exists. Idempotent |
| `validate-storyboard.js` | Rules above |
| `render-slides.js` | Storyboard to `slides.css` plus `scene-<id>.html` for kit scenes; lists custom ids |
| `render-frames.js` | Headless browser screenshot per slide; per-render `--user-data-dir`; polls for a non-empty PNG, waits one second, kills the process; reads the PNG header and fails unless 1920x1080; file URLs are built with `pathToFileURL` so spaces are encoded |
| `narrate.py` | edge-tts per scene to `audio/scene-<id>.mp3`; voice and rate from the storyboard; replaces "A.I." with "AI"; 3 attempts, 2 seconds apart; exits non-zero naming the scene |
| `narrate-local.js` | Local voice to the same file names: `say` on macOS, PowerShell `System.Speech` on Windows, `espeak-ng` on Linux when installed; converts to MP3 with ffmpeg |
| `build-video.js` | `contact-sheet`: ffmpeg tile of all frames. `build`: ffprobe duration per MP3; per-scene encode with 0.6s lead-in, 0.9s tail, 0.4s fades, 25 fps, libx264 crf 20 `-tune stillimage`, AAC 128k stereo 44.1 kHz; concat with `-c copy -movflags +faststart`; writes the `.srt` |
| `lib/paths.js` | Tools folder, venv python path per OS (`bin/python` or `Scripts\python.exe`), browser probing |
| `lib/manifest.js` | Content hashes per scene for slide HTML, frame, narration text plus voice plus rate, and segment inputs; a step skips a scene whose inputs and output are unchanged |
| `lib/png.js` | Width and height from the PNG IHDR chunk |
| `lib/srt.js` | Cues from scene durations; narration split into sentences, each sentence timed by its share of the scene's characters, offset by the lead-in |

### Tools folder

`~/.opm/story-video-tools/` (`%USERPROFILE%\.opm\story-video-tools\` on Windows). Holds
`node_modules/ffmpeg-static`, `node_modules/ffprobe-static` and `venv/`. Nothing is installed
system-wide and nothing is added to PATH. Deleting the folder is a full uninstall.

### Browser probing

In order: `CHROME_PATH` environment variable; then Google Chrome, Chromium, Microsoft Edge,
Brave at their standard locations per OS (application bundles on macOS, `google-chrome`,
`chromium`, `chromium-browser`, `microsoft-edge`, `brave-browser` on PATH on Linux, Program Files
locations on Windows). The first that exists wins.

## Output layout in the target project

```
docs/story/<slug>/
  storyboard.json       committed
  slides/               committed (slides.css, scene-*.html)
  <slug>.srt            committed
  <slug>.mp4            committed
  .gitignore            committed; ignores frames/, audio/, segments/, .build/
  frames/  audio/  segments/  .build/manifest.json, contact-sheet.png
```

## Errors

| Situation | Do |
|---|---|
| Source path missing or not text | Stop at G1 and say so |
| Source too thin for 2 minutes | Stop at G1; say how many words of narration it could support |
| No Chromium-family browser | Stop; name `CHROME_PATH` and the browsers looked for |
| No Python 3 | Continue; offer only the local voice at G2 and say why |
| Tool install fails (offline, npm or pip error) | Stop; show the failing command's last lines; nothing partial is left marked as ready |
| edge-tts fails after 3 attempts | Stop narration, keep finished scenes, offer the local voice or a retry |
| No local voice on Linux (`espeak-ng` missing) | Say so; do not install it |
| Frame not 1920x1080 or never written | Fail naming the scene; the slide file stays for inspection |
| Missing frame or audio at build | `build-video.js` fails naming the scene before encoding anything |
| Custom-slide agent fails | Kit scenes are still built; say which scenes are missing and offer to retry or switch them to a kit layout |

## Tests

`tests/story-video.test.js`, run with `node --test tests/*.test.js`. No network, no browser, no
ffmpeg, no audio.

1. Validator: the shipped example storyboard passes; fixtures fail with the expected message for a duplicate id, unknown layout, slots that do not match the layout, unknown icon, "A.I." in narration, missing `source`, custom scene without `visual`, narration sentence copied into a slot.
2. Layouts: every layout renders the example slots; output contains no `font-size` below 30; output does not contain the scene's narration; an over-long label is wrapped or truncated, not overflowing.
3. `render-slides.js`: writes one file per kit scene and `slides.css`, skips and lists custom ids, draws the PLANNED chip only when `planned` is true.
4. `build-video.js build --dry-run`: prints one ffmpeg command per scene with the lead, tail and fade values and a concat command; fails naming the scene when a frame or an audio file is missing.
5. `lib/srt.js`: cue times from fixed fake durations are cumulative, offset by the lead-in, and never overlap.
6. `lib/manifest.js`: unchanged inputs skip, a changed narration invalidates audio and segment but not the frame, a changed slot invalidates slide, frame and segment but not audio.
7. `lib/png.js`: reads width and height from a generated 1920x1080 header and rejects a non-PNG.
8. `lib/paths.js`: browser probing with an injected exists function picks the first match per OS; venv python path differs by platform.
9. `render-frames.js --dry-run`: the browser arguments include a per-render user-data-dir and a file URL with spaces encoded.
10. `SKILL.md`: frontmatter rules, body under 400 lines, description contains "narrated slideshow" and "not animation".

The existing `tests/manifest.test.js` already enforces README listing, skill count and version
agreement.

Manual, recorded in the PR test plan: one full run on macOS from a real spec, and
`setup.js --check` plus `render-frames.js` on Windows or Linux if a machine is available.

## Files

| Path | Purpose |
|---|---|
| `skills/story-video/SKILL.md` | Gates, phases, errors, red flags, safety |
| `skills/story-video/scripts/*.js`, `narrate.py`, `layouts/*.js`, `lib/*.js`, `pictograms.js` | The pipeline |
| `skills/story-video/templates/slides.css` | The frame |
| `skills/story-video/templates/storyboard.example.json` | A complete small example using every layout |
| `skills/story-video/templates/layouts.md` | Slot reference for every layout and the pictogram names; SKILL.md points here so its body stays under 400 lines |
| `tests/story-video.test.js`, `tests/fixtures/story-video/` | Tests |
| `skills/brew-idea/SKILL.md` (Phase 5), `skills/jump-start/SKILL.md` (Phase 9), `skills/milestone-planning/SKILL.md` (milestone close), `skills/using-opm/SKILL.md` | One line each: "Optional: `/opm:story-video <path>` turns this into a narrated explainer." |
| `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Skill row and section, 0.4.0 |

No rule of this skill is copied into another skill. The other skills hold a pointer only.

## Red flags for the skill

| Thought | Reality |
|---|---|
| "I'll draw every slide myself, the kit looks generic" | That cost 190k tokens once. Use a layout; `custom` is for the scene that truly needs it. |
| "I'll look at every frame to be safe" | Look at the contact sheet once. Open a frame only when a tile looks wrong. |
| "This fact makes the story better" | If it is not in the source, it is not in the video. |
| "It's planned but basically decided" | Planned is labelled planned. |
| "They agreed to the neural voice last time" | Consent is per run. Ask at G2. |
| "The name is obviously fictional" | List the names and let the developer say. Keep the note truthful. |
| "ffmpeg is missing, I'll brew install it" | Tools go in the tools folder. Never touch the system. |
| "I'll put the narration on the slide so it's clear" | The voice carries the words. The slide carries the picture. |
| "Small edit, I'll rebuild everything" | Run the same commands; the manifest rebuilds only what changed. |

## Safety

- Narration text leaves the machine only with consent at G2, and only to Microsoft's speech endpoint.
- Nothing is installed outside the tools folder. No PATH changes, no global packages.
- The skill writes only under `docs/story/<slug>/` in the project and commits only at Phase 6.
- Real people: names are surfaced at G2; the `note` must not describe a real person as made up.
