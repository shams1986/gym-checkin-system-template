# Admin panel setup and acceptance checks

Phase 5 adds an authenticated owner interface at the Apps Script web-app route `?api=admin`. The source remains unbound and undeployed in this repository.

## Authentication property and deployment model

The admin uses the Google account supplied by an Apps Script web-app deployment that executes as the accessing user. Every admin request reads `Session.getActiveUser().getEmail()` on the server and checks it against the protected allowlist. It is separate from both the static HTTPS scanner frontend and the anonymous Apps Script backend/API deployment. Configure this Apps Script script property only on a new, explicitly approved single-gym development or client project:

| Property | Value |
|---|---|
| `ADMIN_ALLOWED_EMAILS` | JSON array of normalized owner emails, for example `["owner@example.invalid"]` |

The allowlist is protected and must never be placed in scanner configuration or committed client files. Deploy the admin separately with **Execute as: User accessing the web app** and access restricted to the intended signed-in audience. Keep the anonymous backend deployment separate and executing as its owner. Host the camera scanner on static HTTPS rather than either Apps Script deployment. Google Identity Services browser tokens and an OAuth web client are not required for the Apps Script admin page. Do not reuse an AXIS deployment, allowlist, or spreadsheet.

The current Phase 8 development admin is version 2 at `https://script.google.com/macros/s/AKfycbwWzMCZ0h2jFSl2iZtY5uOg2R-E1_gm-9wKn17ZI3YKoq4YLBGIM46vMPIfmk6Jq-4-HA/exec?api=admin`. It is separate from the public scanner backend and is restricted to the owner account configured in `ADMIN_ALLOWED_EMAILS`.

## Before creating another development or client deployment

For any future instance, create and explicitly confirm the following resources before its first `clasp push`:

1. A disposable Google Sheet owned by the tester.
2. A new spreadsheet-bound Apps Script project created for this template only.
3. The script property above, using synthetic test accounts/data only.
4. Separate anonymous-backend and admin web-app deployments, plus a static HTTPS scanner host, with their access settings and deployment identifiers/URL recorded for rollback.

Creating or documenting future resources does not by itself authorize their `clasp push` or deployment. The current Phase 8 development project above is the repository's approved non-production target; never point this source at AXIS or another live Apps Script project.

## Manual Phase 5 checks

- Open the admin deployment signed out and confirm Google requires authentication before operational data appears.
- Sign in with an email outside the allowlist and confirm reads and writes are rejected.
- Sign in as an allowed owner and exercise Dashboard, Members, Member Detail, Schedule, and Settings navigation.
- Test an empty workbook, member creation/editing, immutable generated IDs, activation/deactivation, and a simulated failed status change.
- Create overlapping and non-overlapping schedule entries and confirm the overlap error leaves the form open.
- Save settings, reload, and confirm presentation changes persist while technical sheets/identifiers remain hidden.
- Test dashboard behavior with and without attendance.
- Verify the anonymous backend check-in and public configuration routes still work independently from the static scanner frontend.

QR generation is intentionally deferred to Phase 6. The Phase 5 card configuration check validates whether IDs are present but does not access Drive or Slides.
