# Configuration Contract

## Purpose

One configuration model adapts the template to a single gym without editing core check-in logic. The model is split into `public` and `protected` sections according to who may read the values. The backend remains authoritative for schedules and check-in decisions.

The schema version for these Phase 1 examples is `1`.

## Schema outline

| Path | Type | Required | Boundary | Rules |
|---|---|---:|---|---|
| `schemaVersion` | integer | yes | both | Must be `1` for this contract |
| `public.identity.name` | string | yes | public | Human-readable gym name |
| `public.identity.shortName` | string | yes | public | Short scanner/PWA label |
| `public.identity.locale` | string | yes | public | BCP 47 language tag |
| `public.identity.timezone` | string | yes | public | IANA timezone name |
| `public.branding.logoUrl` | string | yes | public | HTTPS URL or relative public asset path |
| `public.branding.iconUrl` | string | yes | public | HTTPS URL or relative public asset path |
| `public.branding.colors` | object | yes | public | Six-digit CSS hex values for `primary`, `accent`, `background`, and `surface` |
| `public.scanner.texts` | object | yes | public | Display text for every scanner state; text never controls logic |
| `public.scanner.resetMs` | object | yes | public | Positive delays for `success`, `duplicate`, `error`, and `outsideWindow` |
| `public.scanner.behavior` | object | yes | public | `sound`, `vibration`, and `preferredCamera` (`environment` or `user`) |
| `public.integration.checkInEndpoint` | string | yes | public | Public Apps Script web-app URL; may be empty before deployment |
| `public.integration.scannerUrl` | string | yes | public | Public scanner URL; may be empty before hosting |
| `protected.checkIn` | object | yes | protected | Minutes before/after start and duplicate policy; backend authoritative |
| `protected.members` | object | yes | protected | ID prefix and number width; next sequence is internal, never public |
| `protected.schedule` | array | yes | protected | Recurring sessions, types, audiences/categories, and active status |
| `protected.messages` | array | yes | protected | Active messages and optional training/category targeting |
| `protected.cards` | object | yes | protected | Slides template ID, Drive folder ID, and design choice |
| `protected.integration` | object | yes | protected | Spreadsheet ID, Apps Script project/deployment binding, and hosting metadata |
| `protected.admin.allowedEmails` | array | yes | protected | Normalized owner email allowlist |

Unknown keys must be rejected by future validation unless a later schema version explicitly adds them. Empty deployment-specific strings are allowed in template/demo configuration but must fail deployment-readiness checks.

## Public versus protected boundary

### Public configuration

Public values may be shipped with the static scanner or returned by `getPublicScannerConfig()`. They are not secrets:

- Gym display name, short name, locale, and timezone
- Public logo/icon paths and brand colors
- Scanner display text and reset delays
- Sound, vibration, and preferred-camera choices
- Public scanner URL and anonymous check-in endpoint
- A public configuration version

Public configuration must not contain schedules, member records, categories tied to members, Drive or spreadsheet IDs, Apps Script project/deployment IDs, admin identities, credentials, tokens, internal sheet names, cache keys, or ID-sequence state.

### Protected configuration

Protected values are loaded by the backend from owner-readable settings where appropriate, internal/protected sheets, or Apps Script properties. They are never embedded in `scanner/config.example.js`:

- Check-in windows and duplicate rules
- Schedule, training types, and audience/category rules
- Member ID prefix/width and internal next-number state
- Message targeting configuration
- Spreadsheet, Drive folder, Slides template, Apps Script project, and deployment identifiers
- Admin authorization allowlist and all credentials/tokens
- Client-specific deployment and hosting metadata

Secrets and credentials belong in Apps Script properties or the deployment platform's secret store, never in Git.

## Admin authentication decision

The protected admin application requires a Google identity token and authorizes the verified email against `protected.admin.allowedEmails`, stored outside public scanner configuration. The installation stores the OAuth web client ID in the `ADMIN_GOOGLE_CLIENT_ID` Apps Script property and the allowlist as a JSON array in `ADMIN_ALLOWED_EMAILS`. Token audience, expiry, verified-email status, and allowlist membership are checked server-side on every protected admin call. The anonymous scanner endpoint grants no admin authority and cannot route internal helpers. See `ADMIN_SETUP.md` for non-deploying setup and acceptance checks.

Admin authentication is a frozen architectural decision in Phase 1; implementation and unauthorized/authorized tests belong to Phase 5. No admin write endpoint may be exposed before that enforcement exists.

## Sample gym A

```json
{
  "schemaVersion": 1,
  "public": {
    "identity": {
      "name": "Harbor Strength Club",
      "shortName": "Harbor",
      "locale": "en-GB",
      "timezone": "Europe/Dublin"
    },
    "branding": {
      "logoUrl": "./assets/demo-harbor-logo.svg",
      "iconUrl": "./assets/demo-harbor-icon.png",
      "colors": {
        "primary": "#174A5B",
        "accent": "#F2B84B",
        "background": "#0E2028",
        "surface": "#FFFFFF"
      }
    },
    "scanner": {
      "texts": {
        "readyTitle": "Scan your member card",
        "readyInstruction": "Hold the QR code inside the frame",
        "loadingTitle": "Checking you in",
        "loadingInstruction": "Please wait",
        "successTitle": "Welcome",
        "duplicateTitle": "Already checked in",
        "notFoundTitle": "Member not found",
        "inactiveTitle": "Membership inactive",
        "outsideWindowTitle": "Check-in is closed",
        "errorTitle": "Unable to check in",
        "invalidInstruction": "Please scan a valid member card",
        "errorInstruction": "Please try again",
        "timeoutTitle": "Connection timed out",
        "timeoutInstruction": "Please try again",
        "cameraStartingText": "Starting camera",
        "cameraActiveText": "Camera active",
        "cameraErrorInstruction": "Allow camera access, then retry",
        "soundHint": "Tap once to enable sound",
        "retryButton": "Retry camera"
      },
      "resetMs": {
        "success": 15000,
        "duplicate": 3500,
        "error": 5000,
        "outsideWindow": 5000
      },
      "behavior": {
        "sound": true,
        "vibration": true,
        "preferredCamera": "environment"
      }
    },
    "integration": {
      "checkInEndpoint": "",
      "scannerUrl": ""
    }
  },
  "protected": {
    "checkIn": {
      "minutesBeforeStart": 20,
      "minutesAfterStart": 30,
      "duplicatePolicy": "per_training_session"
    },
    "members": {
      "idPrefix": "HSC",
      "numberWidth": 4
    },
    "schedule": [
      {
        "day": "MONDAY",
        "start": "18:00",
        "end": "19:00",
        "trainingType": "STRENGTH",
        "displayName": "Evening Strength",
        "audience": "ALL",
        "active": true
      }
    ],
    "messages": [
      {
        "message": "Have a strong session!",
        "active": true,
        "trainingType": "",
        "category": ""
      }
    ],
    "cards": {
      "slidesTemplateId": "",
      "driveFolderId": "",
      "design": "default"
    },
    "integration": {
      "spreadsheetId": "",
      "appsScriptProjectId": "",
      "deploymentId": "",
      "hostingSite": ""
    },
    "admin": {
      "allowedEmails": ["owner@example.invalid"]
    }
  }
}
```

## Sample gym B

This second configuration uses the same keys and types while changing identity, assets, colors, locale, timezone, member format, schedule, and timing.

```json
{
  "schemaVersion": 1,
  "public": {
    "identity": {
      "name": "Meadow Movement Studio",
      "shortName": "Meadow",
      "locale": "de-AT",
      "timezone": "Europe/Vienna"
    },
    "branding": {
      "logoUrl": "./assets/demo-meadow-logo.svg",
      "iconUrl": "./assets/demo-meadow-icon.png",
      "colors": {
        "primary": "#315C45",
        "accent": "#E9C46A",
        "background": "#F4F1EA",
        "surface": "#FFFFFF"
      }
    },
    "scanner": {
      "texts": {
        "readyTitle": "Mitgliedskarte scannen",
        "readyInstruction": "QR-Code in den Rahmen halten",
        "loadingTitle": "Check-in wird geprüft",
        "loadingInstruction": "Bitte warten",
        "successTitle": "Willkommen",
        "duplicateTitle": "Bereits eingecheckt",
        "notFoundTitle": "Mitglied nicht gefunden",
        "inactiveTitle": "Mitgliedschaft inaktiv",
        "outsideWindowTitle": "Check-in geschlossen",
        "errorTitle": "Check-in nicht möglich",
        "invalidInstruction": "Bitte eine gültige Mitgliedskarte scannen",
        "errorInstruction": "Bitte erneut versuchen",
        "timeoutTitle": "Zeitüberschreitung",
        "timeoutInstruction": "Bitte erneut versuchen",
        "cameraStartingText": "Kamera wird gestartet",
        "cameraActiveText": "Kamera aktiv",
        "cameraErrorInstruction": "Kamerazugriff erlauben und erneut versuchen",
        "soundHint": "Einmal tippen, um den Ton zu aktivieren",
        "retryButton": "Kamera erneut starten"
      },
      "resetMs": {
        "success": 12000,
        "duplicate": 4000,
        "error": 6000,
        "outsideWindow": 6000
      },
      "behavior": {
        "sound": false,
        "vibration": true,
        "preferredCamera": "environment"
      }
    },
    "integration": {
      "checkInEndpoint": "",
      "scannerUrl": ""
    }
  },
  "protected": {
    "checkIn": {
      "minutesBeforeStart": 15,
      "minutesAfterStart": 20,
      "duplicatePolicy": "per_training_session"
    },
    "members": {
      "idPrefix": "MMS",
      "numberWidth": 5
    },
    "schedule": [
      {
        "day": "TUESDAY",
        "start": "07:30",
        "end": "08:20",
        "trainingType": "MOBILITY",
        "displayName": "Morgenbewegung",
        "audience": "ALL",
        "active": true
      }
    ],
    "messages": [
      {
        "message": "Viel Freude beim Training!",
        "active": true,
        "trainingType": "MOBILITY",
        "category": ""
      }
    ],
    "cards": {
      "slidesTemplateId": "",
      "driveFolderId": "",
      "design": "default"
    },
    "integration": {
      "spreadsheetId": "",
      "appsScriptProjectId": "",
      "deploymentId": "",
      "hostingSite": ""
    },
    "admin": {
      "allowedEmails": ["inhaber@example.invalid"]
    }
  }
}
```

Neither sample depends on an AXIS name, URL, asset, member prefix, training type, or deployment identifier.
