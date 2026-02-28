# Current Version Backup Snapshot

This folder is a snapshot backup of the website state before the high-end aesthetic redesign.

## Open backup snapshot
- Open `backup/current-version/index.html`.

## Restore snapshot to root (from repository root)
```bash
cp -f backup/current-version/index.html backup/current-version/team.html backup/current-version/research.html backup/current-version/research-facility.html backup/current-version/projects.html backup/current-version/news.html backup/current-version/apply.html backup/current-version/publications.html .
cp -f backup/current-version/assets/css/style.css assets/css/style.css
cp -f backup/current-version/assets/js/scripts.js assets/js/scripts.js
cp -f backup/current-version/data/* data/
```
