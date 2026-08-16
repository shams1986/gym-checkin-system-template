# Apps Script template backend

Phase 2 contains the reusable Google Sheets schema and setup functions. It is source only: this repository is not bound to an Apps Script project and no deployment identifiers belong here.

Current files:

- `Schema.gs`: exact sheet/header contracts, enums, settings defaults, and attendance projection
- `SheetRepository.gs`: idempotent sheet/header/protection helpers
- `Setup.gs`: `setupTemplate(options?)`, validations, formats, visibility, metadata, and timezone handling
- `DemoData.gs`: separate opt-in synthetic demo loader
- `appsscript.json`: neutral V8 manifest with UTC default

Runtime features remain for later phases:

- Phase 4: public check-in backend contract
- Phase 5: authenticated owner/admin application
- Phase 6: member ID and QR card workflow
- Phase 7: attendance views and reports

GitHub remains the source of truth. Do not bind this source to AXIS or a live client project, run `clasp push`, or deploy it. Testing against a new development Sheet requires an explicit target confirmation and the checks in `DEPLOYMENT.md` and `docs/SHEETS_SCHEMA.md`.
