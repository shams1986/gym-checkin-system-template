# Apps Script template backend

This folder contains the reusable Google Sheets setup and check-in backend source. It is source only: this repository is not bound to an Apps Script project and no deployment identifiers belong here.

Current files:

- `Schema.gs`: exact sheet/header contracts, enums, settings defaults, and attendance projection
- `SheetRepository.gs`: idempotent sheet/header/protection helpers
- `Setup.gs`: private maintainer entry point `setupTemplate_(options?)`, validations, formats, visibility, metadata, and timezone handling
- `DemoData.gs`: separate private opt-in synthetic demo loader `loadDemoData_()`
- `RuntimeRepository.gs`: validated runtime table and setting access
- `MemberRepository.gs`: normalized member lookup
- `ScheduleService.gs`: timezone-aware schedule and audience resolution
- `AttendanceRepository.gs`: duplicate checks, attendance/state writes, message selection, and bounded logs
- `ResponseFactory.gs`: stable machine-readable scanner response construction
- `CheckInService.gs`: lock-protected check-in transaction
- `WebApp.gs`: public check-in route and safe JSON/JSONP output
- `ScannerWeb.gs`, `Scanner.html`, `Scanner.css.html`, `Scanner.js.html`: Apps Script root-route scanner shell generated from `scanner/`
- `AdminAuth.gs`: Apps Script active-user verification against the protected owner-email allowlist
- `AdminApi.gs`: browser-callable admin RPC dispatcher and action allowlist
- `AdminRepository.gs`: shared private admin data helpers
- `AdminDashboardService.gs`: dashboard counts, sessions, and recent attendance
- `AdminMemberService.gs`: member list/detail/create/edit/status and attendance queries
- `AdminScheduleService.gs`: schedule and training-type management with overlap validation
- `AdminSettingsService.gs`: validated settings, public scanner config, messages, and card-readiness checks
- `Admin.html`, `Admin.js.html`, `Admin.css.html`: authenticated responsive owner interface
- `CardService.gs`: configurable Slides copy/text/QR generation plus single and batch workflows
- `CardRepository.gs`: atomic `_Card_State` and `Members.CardURL` persistence
- `appsscript.json`: neutral V8 manifest with UTC default

The public route accepts `api=checkin&id=<member-id>`. A simple callback identifier may be supplied for JSONP; unsafe callback values are rejected and never reflected. See `docs/API_CONTRACT.md` for the frozen response fields.

Runtime features remaining for later phases:

- Phase 8: full demo-data acceptance testing

GitHub remains the source of truth. Do not bind this source to AXIS or a live client project, run `clasp push`, or deploy it. Testing against a new development Sheet requires an explicit target confirmation and the checks in `DEPLOYMENT.md` and `docs/SHEETS_SCHEMA.md`.

Local contract coverage is in `tests/phase4-checkin.test.js`. It does not replace the Phase 4 manual checks on an explicitly approved disposable development Apps Script project and Sheet: open/close boundaries, category eligibility, concurrent requests, malformed callbacks, missing sheets, and scanner timeout behavior.

Phase 5 authentication and UI setup are documented in `docs/ADMIN_SETUP.md`. The admin uses a separate web-app deployment that executes as the accessing user; no operational data or mutation is available until `adminApi` verifies `Session.getActiveUser().getEmail()` against the protected allowlist. The anonymous scanner deployment stays separate. Implementation handlers end in `_` and cannot be called directly through `google.script.run`.

Before pushing scanner-source changes to Apps Script, run `node scripts/build-apps-script-scanner.mjs` from the repository root. CI-style checks can use `node scripts/build-apps-script-scanner.mjs --check` to ensure the generated HtmlService bundle matches the canonical files in `scanner/`.

Apps Script treats trailing-underscore functions as private to server-side code. The scanner implementation, setup routine, and demo loader therefore use `checkIn_`, `setupTemplate_`, and `loadDemoData_`; browser clients cannot invoke them with `google.script.run` and the editor function picker does not list them.

For the Apps Script editor function picker, use the public zero-argument `runTemplateSetup` wrapper. It requires an active spreadsheet-bound editor context, then calls the private idempotent setup and demo loader; web-app and Apps Script API executions fail the context guard before any mutation.

Phase 6 uses the protected settings and neutral template contract in `docs/CARD_TEMPLATE.md`. No Slides template, Drive folder, generated card, or deployment binding is committed to this repository. A local development `apps-script/.clasp.json` is intentionally ignored by Git.

Phase 7 uses `AttendanceService.gs` and `ReportService.gs` for protected, timezone-aware attendance queries and simple monthly summaries. The owner-visible contract and export behavior are documented in `docs/REPORTS.md`.
