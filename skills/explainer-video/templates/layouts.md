# Layout reference

Every scene in `storyboard.json` picks a `layout` and fills its `slots` with
JSON matching the shapes below. The kit enforces its own limits: item counts
and enum values are exact, and nothing the kit draws on the 1740x530 stage is
allowed to go under 30px.

## chat

Use for a back-and-forth in an app, an inbox thread, or a tool's message log.
One to three windows sit side by side; a bubble sits on the right when its
sender matches the storyboard's `protagonist` name.

```json
{
  "windows": [
    {
      "app": "Mail",
      "messages": [
        { "from": "Client", "text": "Any update on the March invoice?" },
        { "from": "Asha", "text": "Sending it over within the hour." }
      ]
    },
    {
      "app": "Notes",
      "messages": [
        { "from": "Asha", "text": "Logged the follow-up in the shared sheet." }
      ]
    }
  ]
}
```

Limits: `windows` holds 1 to 3 entries; each window's `messages` holds 1 to 4
entries; `app`, `from` and `text` are all required non-empty strings.

## checklist

Use for a list of statuses: what's done, what's outstanding, what's broken.
2 or 3 items sit in one centred column; 4 to 6 split into two columns.

```json
{
  "items": [
    { "label": "Reply to every enquiry within an hour", "state": "done" },
    { "label": "Log follow-ups in the shared sheet", "state": "done" },
    { "label": "Chase invoices past thirty days", "state": "todo" },
    { "label": "Duplicate entries live across three tools", "state": "problem" }
  ]
}
```

Limits: `items` holds 2 to 6 entries; each item's `state` is one of `done`,
`todo`, `problem`.

## crossed

Use for options being ruled out in favour of one that stays. Renders like
`flow` without arrows; a card marked `crossed: true` is dimmed and struck
through.

```json
{
  "cards": [
    { "icon": "sheet", "label": "Spreadsheets everywhere", "crossed": true },
    { "icon": "email", "label": "Status updates by email", "crossed": true },
    { "icon": "laptop", "label": "One shared workspace", "crossed": false }
  ]
}
```

Limits: `cards` holds 2 to 4 entries; `icon` must be a name from
`pictograms.names()`; `crossed` is an optional boolean and defaults to false
when omitted.

## flow

Use for a process or pipeline read left to right. Renders one card per step
with an arrow to the next.

```json
{
  "steps": [
    { "icon": "document", "label": "Write the storyboard" },
    { "icon": "laptop", "label": "Render the slides" },
    { "icon": "megaphone", "label": "Narrate each scene" },
    { "icon": "video", "label": "Encode the video" }
  ]
}
```

Limits: `steps` holds 2 to 5 entries; `icon` must be a name from
`pictograms.names()`.

## funnel

Use for a narrowing sequence of counts, such as a pipeline or drop-off.
Renders as stacked bars narrowing from top to bottom; the top bar carries the
scene's accent colour.

```json
{
  "stages": [
    { "label": "Creators found", "value": "120" },
    { "label": "Replied to outreach", "value": "40" },
    { "label": "Signed the agreement", "value": "5" }
  ]
}
```

Limits: `stages` holds 2 to 5 entries; `label` and `value` are both required
non-empty strings.

## roadmap

Use for phases or milestones laid out in order over time. Renders as numbered
circles along a horizontal line, each with a label and a short bulleted list.

```json
{
  "phases": [
    { "label": "Foundation", "items": ["Sign-in", "Creator profiles"] },
    { "label": "Discovery", "items": ["Search", "Shortlists"] },
    { "label": "Reporting", "items": ["Exports", "Dashboards"] }
  ]
}
```

Limits: `phases` holds 2 to 5 entries; each phase's `items` holds 1 to 3
entries.

## spreadsheet

Use for tabular data: a comparison, a report, a list of rows and columns.
Renders a header row plus body rows spanning the full stage width, with
optional cell highlights.

```json
{
  "columns": ["Creator", "Rate", "Status"],
  "rows": [
    ["Asha Patel", "₹20k", "Confirmed, contract signed and payment released"],
    ["Ravi Shah", "₹35k", "Pending"],
    ["Mira Nair", "₹18k", "Confirmed"]
  ],
  "highlight": [[1, 2]]
}
```

Limits: `columns` holds 2 to 6 entries; `rows` holds 2 to 6 entries, and every
row must have exactly as many cells as `columns`; `highlight` is optional, 0
to 12 `[row, col]` pairs, each pair a 0-based index that must land inside the
table.

## title

Use for a title card, a before/after or two-option comparison, or a closing
card. Renders up to two half panels, each with a label and icons, plus an
optional footer line. With neither half nor a footer, the kit draws a centred
accent bar instead of leaving the stage empty.

```json
{
  "left": { "label": "Before: scattered spreadsheets", "icons": ["sheet", "search"] },
  "right": { "label": "After: one shared dashboard", "icons": ["chart"] },
  "footer": "A composite story, not a specific client."
}
```

Limits: `left`, `right` and `footer` are all optional; each half's `icons`
holds 1 to 4 entries, and `icon` must be a name from `pictograms.names()`.

## wireframe

Use for an app or product mockup: a title bar, a left nav and a grid of
content panels.

```json
{
  "window": {
    "title": "Creator campaigns",
    "nav": ["Home", "Creators", "Reports"],
    "panels": [
      { "title": "Shortlist", "lines": 3 },
      { "title": "Budget", "lines": 2 }
    ]
  }
}
```

Limits: `nav` holds 0 to 5 entries; `panels` holds 1 to 4 entries; each
panel's `lines` is a number from 1 to 4.

## custom

Use only when no kit layout can carry the scene's point; say why in the
scene's `visual` field, since `visual` is required for a `custom` scene. A
custom scene has no `slots`; instead one agent draws its slide by hand in
Phase 4, copying a kit slide's HTML and drawing only inside the 1740x530
stage, following `visual`.

## Pictograms

`calendar` `camera` `chart` `chat` `check` `clock` `cross` `deck` `document`
`email` `handshake` `laptop` `link` `lock` `megaphone` `money` `people`
`person` `phone` `search` `sheet` `star` `video` `warning`
