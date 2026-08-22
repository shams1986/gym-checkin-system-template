# Scanner frontend

This directory contains the Phase 3 reusable scanner/PWA. It has no gym schedule, member data, protected identifiers, or backend logic.

## Hosting boundary

The scanner is a static PWA and must be served from a normal HTTPS origin. Apps Script HtmlService runs in a Google iframe and is not a supported camera host. Apps Script remains the JSON/JSONP backend, and the authenticated admin remains a separate Apps Script deployment.

Phase 8 development uses:

- Scanner: `https://shams1986.github.io/gym-checkin-system-template/`
- Backend: `https://script.google.com/macros/s/AKfycbzlfmgf3dKyRTGbwwiUKd9evek9-9GeZxMnK4rbmakBrPqAGpJ4k8sSxi1j8ztIWK8p/exec`

GitHub Actions publishes this directory at the Pages site root. `config.js` is the Phase 8 public deployment config; `config.example.js` remains the neutral reusable example.

Phase 8 frontend verification is complete: GitHub Pages is serving the scanner, its public config calls the Phase 8 Apps Script backend, and camera access passed a manual desktop test from the Pages URL. The former Apps Script HtmlService scanner UI was removed because camera capture must run on the normal static HTTPS origin. Remaining optional manual QA is a physical tablet/phone scan, a real QR-card success/duplicate flow, and PWA installation/offline refresh.

## Configure locally

For another installation, copy the shape in `config.example.js` and change only safe public values, including its own static scanner URL and Apps Script API URL. Never point a client or local test at the Phase 8 or AXIS backend.

Changing the public config updates the visible gym name, logo, colors, text, reset delays, feedback choices, preferred camera, and endpoint without editing `app.js` or `core.mjs`. The core sanitizes config values and falls back to neutral defaults if the file is missing or malformed.

## Run locally

Camera APIs require a secure context. Serve the repository through `localhost` or HTTPS rather than opening `index.html` directly. For example, use any existing static development server rooted at `scanner/`; this does not deploy the scanner.

The QR decoder is loaded from the pinned `qr-scanner` 1.4.2 CDN module. A network/module failure produces the configured camera error and retry action. The same-origin PWA shell uses a network-first service worker with cached fallback. Use `localhost` for local camera checks; some browsers or decoder libraries reject other plain-HTTP hostnames even when they resolve locally.

## Accepted QR payloads

- A raw 1–64 character member ID using letters, digits, `_`, or `-`
- An HTTP(S) or relative URL containing `id` or `memberId`

IDs normalize to uppercase. Prefixes and training types are not hardcoded in the scanner.

## Local fixture preview

When the repository root is served on `localhost`, open `/scanner/?fixture=success` (or any other documented state) to render `tests/fixtures/scanner-states.json` through the production DOM without starting the camera or calling a backend. This hook is disabled on non-local hostnames.

## Request lifecycle

The scanner locks on the first valid read, renders `loading`, and sends a JSONP request to the configured endpoint. The callback/script/timer are cleaned after the first response or error. If no callback arrives within exactly 20 seconds, the scanner renders `timeout`, deletes the callback, removes the script, and ignores any late callback reference.

Backend display text is rendered, but only stable `result` controls the state. Unknown/unusable responses become `error` with `invalid_response`.

## Manual checks

Use a disposable local/development endpoint and the fixtures in `tests/fixtures/scanner-states.json`:

1. Camera allowed and denied/retry.
2. Raw ID, URL `id`, URL `memberId`, and invalid payload.
3. Every fixture state through the localhost-only preview at landscape tablet and low-height landscape sizes.
4. Sound unlock, sound disabled, vibration supported/unsupported.
5. JSONP response, script error, exact timeout, late callback, and automatic reset.
6. Refresh, cached fallback, and PWA installation metadata.

Use only the explicitly authorized Phase 8 development backend for this repository's deployment checks. Do not point local experiments at AXIS, a client endpoint, or any production Apps Script deployment.
