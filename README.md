# EMDP Lab website

Static website for the Energy Materials Design and Processing Lab at DGIST.

## Editing

- Page content: `site/pages/`
- Shared page definitions and shell: `tools/site/build.mjs`
- Design source: `site/styles/`
- Team, publication, and instrument content: `data/*.json`
- Korean translation catalog: `data/i18n-ko.json`
- Browser behavior: `assets/js/`
- Active application backend: `tools/google-apps-script-notify.gs`

Do not edit the root HTML files or `assets/css/style.css` directly. They are generated deploy artifacts retained at the repository root for GitHub Pages branch hosting.

## Commands

```bash
npm run build       # regenerate public HTML and CSS
npm test            # behavior tests and site integrity checks
```

The build has no runtime dependencies and requires Node.js 20 or newer.

The application form intentionally reports a queued receipt when it submits through
the Google Apps Script `no-cors` transport. Delivery is not claimed as confirmed
until a verifiable response transport is introduced.

The Apps Script validates field lengths, consent metadata, the CV signature, form
timing, and mail quota before decoding attachments. Its default server limits are
three submissions per hour and two per email every six hours. Override them with
the `MAX_SUBMISSIONS_PER_HOUR`, `MAX_SUBMISSIONS_PER_EMAIL_6H`, and
`MIN_FORM_SECONDS` Script Properties when deployment needs change.
