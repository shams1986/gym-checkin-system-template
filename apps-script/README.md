# Apps Script backend placeholder

This directory is reserved for the reusable Google Apps Script backend. Phase 1 intentionally contains no runtime `.gs` files, Apps Script manifest, spreadsheet setup, check-in route, admin endpoint, or deployment binding.

Planned implementation begins in later phases:

- Phase 2: Google Sheets schema and idempotent setup functions
- Phase 4: public check-in backend contract
- Phase 5: authenticated owner/admin application
- Phase 6: member ID and QR card workflow
- Phase 7: attendance views and reports

GitHub remains the source of truth. Do not bind this placeholder to a live Apps Script project, run `clasp push`, or deploy it. Any future live deployment requires the explicit user approval and checks in `DEPLOYMENT.md`.
