# Gym Check-in System Template

This repository is the source template for a reusable, client-ready check-in system for one gym. It keeps the proven shape of a tablet QR scanner, a Google Apps Script backend, and Google Sheets storage while moving each gym's identity and operating choices into configuration.

This is a new, non-production project. It is not the AXIS production repository, does not deploy or modify AXIS, and is not a multi-tenant SaaS platform. AXIS may be consulted only as a read-only behavioral reference in later phases.

## Architecture overview

The planned MVP has four boundaries:

1. **Scanner/PWA:** a static, tablet-friendly QR scanner with safe public branding and display configuration.
2. **Public Apps Script API:** anonymous check-in and public-scanner-configuration routes with a stable machine-readable response contract.
3. **Protected admin application:** authenticated owner workflows for members, schedules, settings, attendance, and cards.
4. **Google Sheets and Drive:** the single gym's operational data store and generated card files. Internal sheets and integration identifiers stay protected.

The backend is authoritative for member status, schedule resolution, check-in windows, and duplicate prevention. The scanner must not embed a second schedule or infer behavior from translated display text.

## Repository map

```text
.
|-- README.md                  Project orientation and phase status
|-- AGENTS.md                  Agent safety and Fast Build rules
|-- REVIEW_WORKFLOW.md         Developer and read-only Reviewer workflow
|-- DEPLOYMENT.md              Source, setup, deployment, and rollback rules
|-- PRODUCT_PLAN.md            Product scope and phased blueprint
|-- docs/
|   |-- API_CONTRACT.md        Frozen Phase 1 scanner state/payload contract
|   |-- CONFIG.md              Configuration model and security boundary
|   |-- ADMIN_SETUP.md         Admin authentication and acceptance setup
|   |-- CARD_TEMPLATE.md       Neutral Slides card template contract
|   |-- REPORTS.md             Attendance and monthly-report behavior
|   `-- SHEETS_SCHEMA.md       Phase 2 workbook and setup contract
|-- scanner/
|   |-- index.html             Tablet scanner/PWA shell
|   |-- styles.css             Responsive scanner and result layouts
|   |-- app.js                 Camera, rendering, feedback, and reset flow
|   |-- core.mjs               Config, QR, state, and JSONP lifecycle logic
|   |-- config.js              Neutral runnable public configuration
|   |-- config.example.js      Safe public configuration example
|   |-- manifest.json          Neutral PWA metadata
|   |-- service-worker.js      Network-first shell cache
|   `-- assets/                Neutral template logo and icon
|-- apps-script/
|   |-- README.md              Backend source orientation
|   |-- Schema.gs              Exact sheet/header/config contracts
|   |-- SheetRepository.gs     Idempotent sheet setup helpers
|   |-- Setup.gs               Private workbook setup entry point
|   |-- DemoData.gs            Separate synthetic demo loader
|   |-- RuntimeRepository.gs   Validated runtime data/config access
|   |-- MemberRepository.gs    Normalized member lookup
|   |-- ScheduleService.gs     Authoritative schedule resolver
|   |-- AttendanceRepository.gs Attendance/state/message/log persistence
|   |-- ResponseFactory.gs     Frozen scanner response construction
|   |-- CheckInService.gs      Lock-protected check-in transaction
|   |-- WebApp.gs              Public JSON/JSONP check-in route
|   |-- AdminAuth.gs           Active Apps Script user allowlist authorization
|   |-- AdminApi.gs            Allowlisted protected admin RPC boundary
|   |-- Admin*Service.gs       Owner dashboard and management operations
|   |-- Admin.html             Owner application shell
|   |-- Admin.js.html          Navigation, forms, and interface states
|   |-- Admin.css.html         Responsive owner interface styles
|   |-- CardService.gs         Slides/Drive card generation and batches
|   |-- CardRepository.gs      Card state and member-link persistence
|   |-- AttendanceService.gs   Paginated owner attendance queries
|   |-- ReportService.gs       Simple monthly attendance summaries
|   `-- appsscript.json        Neutral V8 manifest
`-- tests/
    |-- phase2-schema.test.js  Local Phase 2 contract checks
    |-- phase2-setup.test.js   Mocked setup/idempotence checks
    |-- phase4-checkin.test.js Backend transaction and route checks
    |-- phase5-admin.test.js   Authentication and admin-surface checks
    |-- phase6-cards.test.js   Card generation and persistence checks
    `-- phase7-attendance.test.js Attendance/report query checks
```

## Current phase status

**Phase 1 — repository structure and configuration model:** complete.

**Phase 2 — Google Sheets schema and setup functions:** implemented in source with exact headers, validation rules, hidden/protected internal sheets, schema metadata, a protected attendance projection, and separate demo data. Completion requires local checks, Reviewer approval, and the manual workbook checks documented in `docs/SHEETS_SCHEMA.md` when an approved disposable development Sheet is available.

**Phase 3 — reusable scanner:** implemented with public configuration fallback, generalized QR parsing, all nine contract states, JSONP cleanup/timeout, feedback, responsive tablet layouts, PWA files, and fixtures. Completion requires automated/browser checks and Reviewer approval; camera/device/PWA installation checks remain manual.

**Phase 4 — template check-in backend:** implemented in source with normalized member lookup, status and category validation, timezone-aware schedule windows, per-session duplicate prevention under a short script lock, complete scanner responses, safe JSONP output, and bounded error logs. Local contract tests cover the deterministic transaction; concurrency, delayed responses, and live web-app behavior remain manual checks on an explicitly approved disposable development target.

**Phase 5 — owner/admin panel MVP:** implemented in source with Apps Script active-user authorization against a protected owner allowlist, an explicit action allowlist, Dashboard, Members, Add/Edit Member, Member Detail, Schedule, Settings, and basic-message workflows. Live identity and Apps Script acceptance checks require the separate admin deployment documented in `docs/ADMIN_SETUP.md`.

**Phase 6 — member card workflow:** implemented in source with configurable Google Slides placeholders, Drive output, QR formats, single/regenerate/confirmed batch actions, fault-isolated card state, and admin card status/actions. Live Slides/Drive acceptance checks require the disposable resources documented in `docs/CARD_TEMPLATE.md`.

**Phase 7 — attendance views and reports:** implemented in source with protected seven-field attendance views, timezone-aware filters, member history, pagination, export-friendly pages, and monthly top/low-attendance summaries. Live acceptance checks remain for an explicitly approved disposable Apps Script/Sheet target.

**Phase 8 — development verification:** development milestone reached; the phase remains open for the manual acceptance checks below. The development scanner and separate admin Apps Script deployments are live, and development Sheet setup/schema verification passed. Admin authentication now uses an Apps Script deployment that executes as the accessing user instead of browser Google Identity Services. The current development admin deployment is restricted to **Only myself** (`salahadin35@gmail.com`): the allowed owner can open the dashboard, while non-owner and incognito access is blocked before dashboard access or Google permission consent.

Remaining Phase 8 manual QA is physical phone/tablet camera scanning, a real generated QR-card scan, and design of a future multi-admin/client access architecture. After those acceptance checks pass, the next stage is **Phase 9 — first client instance from the template**.

## Working rules

- Use `PRODUCT_PLAN.md` one phase at a time.
- Use autonomous Fast Build Mode: execute the current prompt directly, then have the focused diff approved by read-only Reviewer Mode before delivery.
- After approval, commit and push without another confirmation; for Apps Script work, sync/update the existing Phase 8 development target when appropriate.
- Treat public and protected configuration as separate trust boundaries.
- Never commit secrets, credentials, real member data, or client deployment identifiers.
- Phase 8 Google resources are non-production development targets. Stop before creating/modifying a real client instance or affecting AXIS production.
