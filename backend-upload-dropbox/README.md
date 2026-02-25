# EMDP Apply Backend (Railway/Render)

This backend receives application form uploads and stores files in Dropbox automatically.

## Why this
- No Cloudflare dependency.
- No manual Dropbox File Request upload steps for applicants.
- Works with your existing static homepage.

## Deploy (Railway)
1. Create a new GitHub-connected Railway project.
2. Set service root to `backend-upload-dropbox`.
3. Add environment variables from `.env.example`.
4. Start command: `npm start`.
5. Deploy and copy URL, e.g.:
   - `https://your-app.up.railway.app/api/apply`

## Deploy (Render)
1. Create a new Web Service from this repo.
2. Root directory: `backend-upload-dropbox`.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Add environment variables from `.env.example`.

## Required env vars
Use either direct token OR refresh-token flow.

- `ALLOWED_ORIGIN=https://emdplab.github.io`
- `MAX_FILE_MB=10`
- `DROPBOX_BASE_PATH=/EMDP-Lab-Applications`

Option A (simple):
- `DROPBOX_ACCESS_TOKEN=...`

Option B (recommended):
- `DROPBOX_REFRESH_TOKEN=...`
- `DROPBOX_APP_KEY=...`
- `DROPBOX_APP_SECRET=...`

Optional:
- `NOTIFY_WEBHOOK_URL=...` (Google Apps Script notification webhook)

## Frontend wiring
Set this in `apply.html`:

```html
<form id="applicationForm" data-upload-endpoint="https://your-app.up.railway.app/api/apply">
```

## Response format
Success:
```json
{ "success": true, "submission_id": "..." }
```

Failure:
```json
{ "success": false, "error": "..." }
```
