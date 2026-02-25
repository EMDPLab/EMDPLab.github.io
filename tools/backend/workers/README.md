# Dropbox Apply Backend (Cloudflare Worker)

This Worker receives application submissions from `apply.html`, uploads files to Dropbox, stores metadata, and optionally sends a notification email.

## 1. Create Dropbox App

1. Go to Dropbox App Console.
2. Create an app with minimum required access (App folder is recommended).
3. Add scopes:
   - `files.content.write`
   - `files.content.read`
   - `files.metadata.write`
   - `sharing.write`
   - `sharing.read`
4. Generate either:
   - `DROPBOX_ACCESS_TOKEN` (simple, but may expire), or
   - `DROPBOX_REFRESH_TOKEN` + `DROPBOX_APP_KEY` + `DROPBOX_APP_SECRET` (recommended).

## 2. Deploy Worker

1. Install Wrangler:
   - `npm i -g wrangler`
2. Move into the worker directory:
   - `cd workers`
3. Copy `wrangler.toml.example` to `wrangler.toml`.
4. Edit `ALLOWED_ORIGINS` and other vars in `wrangler.toml`.
5. Set secrets (recommended token flow):
   - `wrangler secret put DROPBOX_REFRESH_TOKEN`
   - `wrangler secret put DROPBOX_APP_KEY`
   - `wrangler secret put DROPBOX_APP_SECRET`
6. Optional direct token:
   - `wrangler secret put DROPBOX_ACCESS_TOKEN`
7. Optional email notifications with Resend:
   - `wrangler secret put RESEND_API_KEY`
   - set `NOTIFY_TO` in `wrangler.toml` vars
8. Deploy:
   - `wrangler deploy`

The Worker endpoint should be:
- `https://<your-worker-subdomain>.workers.dev/api/apply`

## 3. Connect Frontend

In `apply.html`, set:

```html
<form id="applicationForm" data-api-endpoint="https://<your-worker-subdomain>.workers.dev/api/apply">
```

If you use a custom route/domain, put that URL in `data-api-endpoint` instead.

## 4. Dropbox Output Structure

Each submission is stored in:

`<DROPBOX_BASE_PATH>/<YYYY-MM-DD>/<submission-id>/`

Files created:
- `cv-*.pdf`
- `cover-letter-*.(pdf|doc|docx)`
- `submission.json` (full form metadata)

## 5. Notes

- Keep `MAX_UPLOAD_FILE_MB` aligned with frontend validation.
- If `ALLOWED_ORIGINS` is set, requests from other domains are rejected.
- If email sending fails, Dropbox upload still succeeds.
