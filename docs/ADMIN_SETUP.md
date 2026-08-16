# Admin panel setup and acceptance checks

Phase 5 adds an authenticated owner interface at the Apps Script web-app route `?api=admin`. The source remains unbound and undeployed in this repository.

## Authentication properties

The admin uses Google Identity Services in the browser and verifies every ID token server-side. Configure these Apps Script script properties only on a new, explicitly approved single-gym development or client project:

| Property | Value |
|---|---|
| `ADMIN_GOOGLE_CLIENT_ID` | Google OAuth 2.0 web client ID created for that installation |
| `ADMIN_ALLOWED_EMAILS` | JSON array of normalized owner emails, for example `["owner@example.invalid"]` |

The OAuth client ID is public by design. The allowlist is protected and must never be placed in scanner configuration or committed client files. Add the exact deployed web-app origin required by Google Identity Services to that installation's OAuth client configuration. Do not reuse an AXIS OAuth client, deployment, allowlist, or spreadsheet.

## Before any development deployment

The following resources would need to be created and explicitly confirmed before any `clasp push`:

1. A disposable Google Sheet owned by the tester.
2. A new spreadsheet-bound Apps Script project created for this template only.
3. A Google Cloud OAuth 2.0 web client for the development web-app origin.
4. The two script properties above, using synthetic test accounts/data only.
5. A web-app deployment configured for the intended test access, with its project and deployment identifiers recorded for rollback.

Creating or documenting these resources does not authorize `clasp push` or deployment. Never point this source at AXIS or another live Apps Script project.

## Manual Phase 5 checks

- Open `?api=admin` signed out and confirm no operational data appears.
- Sign in with an email outside the allowlist and confirm reads and writes are rejected.
- Sign in as an allowed owner and exercise Dashboard, Members, Member Detail, Schedule, and Settings navigation.
- Test an empty workbook, member creation/editing, immutable generated IDs, activation/deactivation, and a simulated failed status change.
- Create overlapping and non-overlapping schedule entries and confirm the overlap error leaves the form open.
- Save settings, reload, and confirm presentation changes persist while technical sheets/identifiers remain hidden.
- Test dashboard behavior with and without attendance.
- Verify the anonymous scanner check-in and public configuration routes still work independently.

QR generation is intentionally deferred to Phase 6. The Phase 5 card configuration check validates whether IDs are present but does not access Drive or Slides.
