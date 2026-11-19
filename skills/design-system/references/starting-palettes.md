# Starting palettes

A starting point per product type, not a catalogue. Each row passes F-01 for text on surface and
3:1 for the primary colour on surface; the test suite checks this.

| Product type | Style | Text | Surface | Primary | Fonts | Spacing |
|---|---|---|---|---|---|---|
| SaaS app or dashboard | Quiet, dense, data first | `#111827` | `#FFFFFF` | `#2563EB` | Inter for everything | 4px base |
| Developer tool | Dark, technical, monospace accents | `#E5E7EB` | `#0B0F14` | `#22D3EE` | Inter, JetBrains Mono for code | 4px base |
| Commerce | Warm, product photos lead | `#1C1917` | `#FAFAF9` | `#B45309` | DM Sans | 8px base |
| Editorial or docs | Reading first, generous line height | `#1F2328` | `#FFFFFF` | `#9A3412` | Source Serif 4 headings, Source Sans 3 body | 8px base |
| Fintech | Calm, trustworthy, high clarity | `#0F172A` | `#F8FAFC` | `#0F766E` | IBM Plex Sans, IBM Plex Mono for figures | 4px base |
| Health | Soft, clear, accessible | `#12263A` | `#F7FAFC` | `#0E7490` | Atkinson Hyperlegible | 8px base |
| Consumer or playful | Bright, friendly, rounded | `#1E1B4B` | `#FFFBEB` | `#DB2777` | Nunito | 8px base |
| B2B marketing site | Bold headline, one accent | `#0A0A0A` | `#FFFFFF` | `#E11D48` | Manrope | 8px base |

After picking a row, add at least a `Muted text`, a `Border` and a `Danger` role, and check each
new text colour against the surface with `contrast.mjs`.
