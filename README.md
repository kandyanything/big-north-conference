# Big North Conference — Website

Static website for the **Big North Conference (BNC)** — 41 member high schools in
Bergen and Passaic counties, New Jersey. **Live at https://bignorthconference.com**

This repo is fully self-contained. There is no database and no separate backend.

---

## What it is

- A **static site** — plain HTML/CSS/JS, no framework, no build step.
- Content is **data-driven** from JSON files in `data/`.
- The **conference schedule** is aggregated automatically from **DigitalSports** every
  3 hours by a GitHub Action and committed back to this repo.
- Hosted on **Netlify** (auto-deploys on every push to `main`).

## Run it locally

Requires **Node.js 18+**. No install needed just to preview:

```
node scripts/preview-server.js 9000
```

Then open **http://localhost:9000**.

## Repository layout

| Path | What it is |
|------|-----------|
| `*.html` | The pages |
| `css/redesign*.css` | Styles |
| `js/redesign-*.js` | Front-end scripts that render the data-driven sections |
| `data/*.json` | **Editable content** (schools, slides, videos, standings, directory, announcement, nav) |
| `data/schedule.json`, `data/schedule/` | **Generated** schedule data — do not hand-edit |
| `scripts/` | Node scripts: the schedule pipeline + image tools |
| `images/logos/optimized/<slug>.png` | School crests |
| `images/photos/` | Homepage hero photos |
| `.github/workflows/schedule.yml` | The 3-hour schedule auto-rebuild |

> **Note:** many CSS classes / JS selectors use an `njac-` prefix inherited from the
> original template. They are load-bearing — **do not rename them.**

## Editing content

- **Hero photo:** drop a JPG in `images/photos/`, add an entry to `data/slides.json`.
- **BNC Vision video:** add `{ "id": "<youtube-id>", "title": "…", "sport": "…" }` to
  `data/videos.json`. The first entry is the large feature.
- **Standings:** each sport links out to its NJ.com table; edit `data/standings.json`.
- **Announcement pop-up:** in `data/announcement.json`, set `"active": true`, write the
  message, and change `"id"`.

## Schedule pipeline (automatic)

All 41 schools are on **DigitalSports** (`scripts/ds-schools.json`).

- Full rebuild: `node scripts/build-schedule.js` → `data/schedule.json`
- Split for the site: `node scripts/split-schedule.js` → `data/schedule/` month files

Node built-ins only — no `npm install` required. `.github/workflows/schedule.yml`
runs both every 3 hours and commits the result. The repo's **Settings → Actions →
General → Workflow permissions** must be **"Read and write."**

## Deploy

- **Netlify**, connected to `main`. Build command: *(none)* · Publish directory: `.`
- **Domain:** bignorthconference.com (GoDaddy DNS → Netlify). SSL is automatic.

## Handing this off

Give the new maintainer access to the **GitHub repo**, the **Netlify** site, and the
**domain registrar**. The site is entirely contained in this repository.
