# Data Management Guide

This folder is the content source for dynamic sections in the website.

## Current Data Files

- `team-data.json`
  - Used by: the site build to render `team.html`
  - Controls: `Postdoctoral Researchers`, `PhD Course`, `Combined Course (MS/PhD)`, `MSC Course`, `Internship`, `Alumni`
- `publications-data.json`
  - Used by: the site build to render `projects.html`
- `instruments-data.json`
  - Used by: `research-facility.html` instruments table rendering

## Team Data Schema

`team-data.json` contains:

- `postdoctoral_researchers`: array of member cards
- `phd_course`: array of member cards
- `combined_course`: array of member cards
- `msc_course`: array of member cards
- `internship`: array of internship records
- `alumni`: array of alumni records

Member card object:

```json
{
  "name": "Member Name",
  "role": "Program Role",
  "description": "Current project summary",
  "photo": "assets/images/file-name.jpg",
  "alt": "Image alt text"
}
```

Internship/Alumni object:

```json
{
  "name": "Name",
  "period": "Term or year",
  "topic": "Project topic"
}
```

## Editing Rule

Use English names only. Member cards omit previous universities and degrees. Photos and research descriptions can be omitted when unavailable.

When updating team members, edit only `data/team-data.json`.
Do not hardcode member cards in generated root HTML. Run `npm run build` after changing data.
