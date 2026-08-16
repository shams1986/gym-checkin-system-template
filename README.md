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
|   `-- CONFIG.md              Configuration model and security boundary
|-- scanner/
|   `-- config.example.js      Safe public configuration example only
`-- apps-script/
    `-- README.md              Backend placeholder; runtime begins later
```

## Current phase status

**Phase 1 — repository structure and configuration model:** implemented by the initial skeleton and contract documents. Phase 1 is complete only after its checks pass and Reviewer Mode approves the diff.

No scanner runtime, Apps Script backend, Google Sheets setup, admin UI, or card generator is implemented in Phase 1. Runtime work begins in the later phases defined by `PRODUCT_PLAN.md`.

## Working rules

- Use `PRODUCT_PLAN.md` one phase at a time.
- Use Fast Build Mode: a focused Developer change must receive a read-only Reviewer approval before commit or push.
- Treat public and protected configuration as separate trust boundaries.
- Never commit secrets, credentials, real member data, or client deployment identifiers.
- Never run `clasp push` or deploy to a live Apps Script or production system without explicit user approval.
