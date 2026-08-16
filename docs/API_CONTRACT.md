# Public Scanner API Contract

## Scope

This document freezes the Phase 1 scanner state and response contract. Runtime transport and implementation arrive in Phases 3 and 4.

The scanner renders behavior from stable `result` and `reason` values. It must never inspect localized `title`, `subtitle`, or `message` strings to decide application state.

## Contract fields

Every normalized scanner state object contains all fields below. Fields that do not apply use `null`; clients must not infer state from missing fields.

| Field | Type | Meaning |
|---|---|---|
| `result` | string | Stable state enum |
| `reason` | string | Stable machine-readable reason enum |
| `memberId` | string or null | Normalized member ID when safely applicable |
| `firstName` | string or null | Display name when disclosure is appropriate |
| `trainingType` | string or null | Stable configured training type |
| `trainingName` | string or null | Localized/display session name |
| `trainingStart` | string or null | ISO 8601 timestamp with gym-timezone offset |
| `title` | string | Localized display title |
| `subtitle` | string | Localized supporting text, or empty string |
| `message` | string | Optional configured post-check-in text, or empty string |
| `color` | string | Six-digit CSS hex display color |
| `sound` | string | `success`, `warning`, `error`, or `none` |

Backend responses for resolved check-in outcomes use HTTP success where transport permits and communicate the domain outcome through `result`. Transport failures may prevent a backend payload; the scanner normalizes those failures into the same shape.

## Result and reason rules

Allowed `result` values are exactly:

`ready`, `loading`, `success`, `duplicate`, `not_found`, `inactive`, `outside_window`, `error`, `timeout`.

- `result` determines rendering, feedback, locking, and reset behavior.
- `reason` refines diagnostics and copy but never replaces `result` branching.
- Both fields use lowercase `snake_case`, are locale-independent, and are not user-editable configuration.
- Display fields may be translated or customized without changing `result` or `reason`.
- Unknown results, unusable payloads, and missing required fields normalize to `result: "error"` and `reason: "invalid_response"`.
- A 20-second callback deadline normalizes to `result: "timeout"` and `reason: "callback_timeout"`; late responses are ignored.
- New result values require a versioned contract change. New reason values may be added only when existing clients can safely use the result-level fallback.

## State matrix

| Result | Source/trigger | Allowed reasons in v1 | Reset behavior |
|---|---|---|---|
| `ready` | Camera active or previous result reset | `camera_ready`, `reset_complete` | Unlocked; no timer |
| `loading` | Valid local payload accepted and request started | `request_started` | Locked until response, error, or timeout |
| `success` | Attendance and state update committed | `attendance_recorded` | Configured success delay; default 15000 ms |
| `duplicate` | Attendance already exists for resolved training key | `already_checked_in` | Configured duplicate delay; default 3500 ms |
| `not_found` | Valid normalized ID has no member | `member_not_found` | Configured error delay; default 5000 ms |
| `inactive` | Member exists but is inactive | `member_inactive` | Configured error delay; default 5000 ms |
| `outside_window` | No eligible training window is open | `no_open_training`, `category_not_eligible` | Configured outside-window delay; default 5000 ms |
| `error` | Local validation, transport, backend, or payload failure | `invalid_payload`, `transport_error`, `backend_error`, `invalid_response` | Configured error delay; default 5000 ms |
| `timeout` | No callback within exactly 20 seconds | `callback_timeout` | Cleanup request, ignore late result, then error delay |

## Payload examples

These examples are normalized state objects. `ready`, `loading`, local `error`, and `timeout` can be scanner-generated; resolved check-in outcomes are backend responses.

### `ready`

```json
{"result":"ready","reason":"camera_ready","memberId":null,"firstName":null,"trainingType":null,"trainingName":null,"trainingStart":null,"title":"Scan your member card","subtitle":"Hold the QR code inside the frame","message":"","color":"#174A5B","sound":"none"}
```

### `loading`

```json
{"result":"loading","reason":"request_started","memberId":"HSC0042","firstName":null,"trainingType":null,"trainingName":null,"trainingStart":null,"title":"Checking you in","subtitle":"Please wait","message":"","color":"#174A5B","sound":"none"}
```

### `success`

```json
{"result":"success","reason":"attendance_recorded","memberId":"HSC0042","firstName":"Taylor","trainingType":"STRENGTH","trainingName":"Evening Strength","trainingStart":"2026-08-17T18:00:00+01:00","title":"Welcome","subtitle":"You're checked in for Evening Strength","message":"Have a strong session!","color":"#2E7D32","sound":"success"}
```

### `duplicate`

```json
{"result":"duplicate","reason":"already_checked_in","memberId":"HSC0042","firstName":"Taylor","trainingType":"STRENGTH","trainingName":"Evening Strength","trainingStart":"2026-08-17T18:00:00+01:00","title":"Already checked in","subtitle":"Your attendance is already recorded","message":"","color":"#ED9B27","sound":"warning"}
```

### `not_found`

```json
{"result":"not_found","reason":"member_not_found","memberId":"HSC9999","firstName":null,"trainingType":null,"trainingName":null,"trainingStart":null,"title":"Member not found","subtitle":"Please ask a trainer for help","message":"","color":"#C62828","sound":"error"}
```

### `inactive`

```json
{"result":"inactive","reason":"member_inactive","memberId":"HSC0042","firstName":null,"trainingType":null,"trainingName":null,"trainingStart":null,"title":"Membership inactive","subtitle":"Please ask a trainer for help","message":"","color":"#C62828","sound":"error"}
```

### `outside_window`

```json
{"result":"outside_window","reason":"no_open_training","memberId":"HSC0042","firstName":"Taylor","trainingType":null,"trainingName":null,"trainingStart":null,"title":"Check-in is closed","subtitle":"There is no eligible session open now","message":"","color":"#C62828","sound":"error"}
```

### `error`

```json
{"result":"error","reason":"invalid_payload","memberId":null,"firstName":null,"trainingType":null,"trainingName":null,"trainingStart":null,"title":"Invalid code","subtitle":"Please scan a valid member card","message":"","color":"#C62828","sound":"error"}
```

### `timeout`

```json
{"result":"timeout","reason":"callback_timeout","memberId":"HSC0042","firstName":null,"trainingType":null,"trainingName":null,"trainingStart":null,"title":"Connection timed out","subtitle":"Please try again","message":"","color":"#C62828","sound":"error"}
```

## Access boundary

The public API surface is limited to anonymous check-in and safe public scanner configuration. It must never route admin functions or return protected settings, sheet/Drive IDs, admin identities, credentials, internal state, or raw errors. Protected admin functions use the separate authentication boundary defined in `CONFIG.md`.

