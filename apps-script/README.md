# Apps Script template backend

This folder contains the reusable Google Sheets setup and check-in backend source. It is source only: this repository is not bound to an Apps Script project and no deployment identifiers belong here.

Current files:

- `Schema.gs`: exact sheet/header contracts, enums, settings defaults, and attendance projection
- `SheetRepository.gs`: idempotent sheet/header/protection helpers
- `Setup.gs`: `setupTemplate(options?)`, validations, formats, visibility, metadata, and timezone handling
- `DemoData.gs`: separate opt-in synthetic demo loader
- `RuntimeRepository.gs`: validated runtime table and setting access
- `MemberRepository.gs`: normalized member lookup
- `ScheduleService.gs`: timezone-aware schedule and audience resolution
- `AttendanceRepository.gs`: duplicate checks, attendance/state writes, message selection, and bounded logs
- `ResponseFactory.gs`: stable machine-readable scanner response construction
- `CheckInService.gs`: lock-protected check-in transaction
- `WebApp.gs`: public check-in route and safe JSON/JSONP output
- `appsscript.json`: neutral V8 manifest with UTC default

The public route accepts `api=checkin&id=<member-id>`. A simple callback identifier may be supplied for JSONP; unsafe callback values are rejected and never reflected. See `docs/API_CONTRACT.md` for the frozen response fields.

Runtime features remaining for later phases:

- Phase 5: authenticated owner/admin application
- Phase 6: member ID and QR card workflow
- Phase 7: attendance views and reports

GitHub remains the source of truth. Do not bind this source to AXIS or a live client project, run `clasp push`, or deploy it. Testing against a new development Sheet requires an explicit target confirmation and the checks in `DEPLOYMENT.md` and `docs/SHEETS_SCHEMA.md`.

Local contract coverage is in `tests/phase4-checkin.test.js`. It does not replace the Phase 4 manual checks on an explicitly approved disposable development Apps Script project and Sheet: open/close boundaries, category eligibility, concurrent requests, malformed callbacks, missing sheets, and scanner timeout behavior.
