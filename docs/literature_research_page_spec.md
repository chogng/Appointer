# Literature Research Page - Stable Anchors (v2)

This doc defines stable automation anchors for the Literature Research page.

Targets:
- `src/pages/LiteratureResearch.jsx`
- `src/features/literature-research/components/JournalLinksCard.jsx`
- `src/features/literature-research/components/ResultsCard.jsx`

General rule (see `docs/stable_selectors_spec.md`):
- **Unique UI:** prefer `id`
- **Repeated/list UI:** use `data-ui` + `data-*` (e.g. `data-item-id`, `data-seed-index`)

## Header / Filters

- Source tabs:
  - Prefer `data-tabs` + `data-cta*` selectors (see `docs/stable_selectors_spec.md`)
- Start date DatePicker trigger: `#literature-start-date`
- End date DatePicker trigger: `#literature-end-date`
- Max results input: `#literature-max-results`
- Add URL button: `#literature-add-url`
- Fetch button: `#literature-fetch`
- Fetch progress:
  - Container: `#literature-fetch-progress`
  - Current URL: `#literature-fetch-progress-active-url`
  - Errors: `#literature-fetch-progress-errors`

## Seed URLs (repeated)

- Row checkbox: `#literature-seed-url-select-0`
- Row URL input: `#literature-seed-url-0`
- Row title input: `#literature-seed-url-title-0`

Note: the page also emits per-row markers such as `data-seed-index` on repeated elements.

## Keyword Matching / Export / Clear

- Keyword panel: `#literature-keyword-panel`
- Keywords textarea: `#literature-keywords`
- Export DOCX: `#literature-export-docx`
- Export JSON: `#literature-export-json`
- Clear page session: `#literature-clear-session`

## Results (repeated)

- Results list card: `[data-ui="literature-result-card"][data-item-id="..."]`
- Title link: `[data-ui="literature-result-title-link"][data-item-id="..."]`
- Translate button: `[data-ui="literature-result-translate-btn"][data-item-id="..."]`
- Download button: `[data-ui="literature-result-download-btn"][data-item-id="..."]`

Group view (repeated by group):
- Group title: `[data-ui="literature-results-group-title"][data-group-key="..."]`
- Group export DOCX: `[data-ui="literature-group-export-docx-btn"][data-group-key="..."]`

## Batch Selection

- Select all / deselect all toggle: `#literature-selection-toggle`
  - Current action token: `[data-action="select-all|deselect-all"]`
