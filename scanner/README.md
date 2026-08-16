# Scanner frontend

This directory contains the Phase 3 reusable scanner/PWA. It has no gym schedule, member data, protected identifiers, or backend logic.

## Configure locally

Copy `config.example.js` to `config.js` and change only safe public values. The checked-in `config.js` is a neutral demo configuration with an empty endpoint, so scans fail safely until a later development backend is explicitly configured.

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

Do not point this scanner at AXIS, a client endpoint, or any live Apps Script deployment for testing.
